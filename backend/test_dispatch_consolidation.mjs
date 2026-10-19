import assert from 'assert';

const BASE_URL = 'http://localhost:8080';

async function req(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function login(username, password, role) {
  const { status, data } = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role })
  });
  assert.strictEqual(status, 200, `Login failed for ${username}: ${JSON.stringify(data)}`);
  return data.token;
}

function authHeader(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

async function run() {
  console.log('=== TEST DISPATCH CONSOLIDATION WORKFLOW ===');

  // 1. Log in as Branch 1 and Store Manager
  const branchToken = await login('Branch1', '1234', 'Branch Manager');
  const storeToken = await login('store@manager', '1234', 'Store Manager');
  console.log('✓ Both Branch1 and Store Manager logged in successfully.');

  // Check initial Curd stock in central warehouse
  const { data: initialItems } = await req('/api/items', { headers: authHeader(storeToken) });
  const curdItem = initialItems.find(i => i.name.toLowerCase() === 'curd');
  console.log(`✓ Initial central stock for Curd: ${curdItem.stock} ${curdItem.unit}`);

  // 2. Branch Manager submits two separate requests for Curd at different times
  console.log('\n[Step 1] Branch Manager submits Request A: 4 L of Curd...');
  const resA = await req('/api/branch-requests', {
    method: 'POST',
    headers: authHeader(branchToken),
    body: JSON.stringify({
      items: [{
        itemName: 'Curd',
        unit: 'L',
        requestedQuantity: 4
      }]
    })
  });
  assert.strictEqual(resA.status, 200, `Failed to submit request A: ${JSON.stringify(resA.data)}`);
  const reqA = resA.data[0];
  console.log(`✓ Request A created: ID #${reqA.id}, Item: ${reqA.item}, Requested: ${reqA.requested} ${reqA.unit}`);

  console.log('\n[Step 2] Branch Manager submits Request B: 1 L of Curd...');
  const resB = await req('/api/branch-requests', {
    method: 'POST',
    headers: authHeader(branchToken),
    body: JSON.stringify({
      items: [{
        itemName: 'Curd',
        unit: 'L',
        requestedQuantity: 1
      }]
    })
  });
  assert.strictEqual(resB.status, 200, `Failed to submit request B: ${JSON.stringify(resB.data)}`);
  const reqB = resB.data[0];
  console.log(`✓ Request B created: ID #${reqB.id}, Item: ${reqB.item}, Requested: ${reqB.requested} ${reqB.unit}`);

  // 3. Store Manager fetches outstanding requests for Branch 1
  console.log('\n[Step 3] Store Manager fetches outstanding requests for Branch 1...');
  const resOutstanding = await req('/api/branch-requests/outstanding?branch=Branch%201', {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(resOutstanding.status, 200, 'Failed to get outstanding requests');
  const outstanding = resOutstanding.data;
  console.log(`✓ Found ${outstanding.length} total outstanding request rows from server.`);

  // Test frontend consolidation algorithm
  const groupMap = new Map();
  outstanding.forEach(r => {
    const branchId = r.branchId || (r.branch || 'Branch 1');
    const itemId = r.itemId || (r.item || '').trim().toLowerCase();
    const unit = (r.unit || 'KG').trim().toUpperCase();
    const groupKey = `${branchId}_${itemId}_${unit}`.toLowerCase();

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        key: groupKey,
        branchId,
        itemId,
        itemName: r.item,
        unit,
        totalRequested: 0,
        alreadyDispatched: 0,
        remainingToDispatch: 0,
        requests: []
      });
    }
    const group = groupMap.get(groupKey);
    group.totalRequested += (r.requested || 0);
    group.alreadyDispatched += (r.dispatched || 0);
    group.requests.push(r);
  });

  const consolidated = Array.from(groupMap.values()).map(g => {
    g.remainingToDispatch = Math.max(0, g.totalRequested - g.alreadyDispatched);
    g.requests.sort((a, b) => (a.id || 0) - (b.id || 0));
    return g;
  }).filter(g => g.remainingToDispatch > 0);

  const curdConsolidated = consolidated.find(g => g.itemName.toLowerCase() === 'curd' && g.unit === 'L');
  assert(curdConsolidated, 'Curd must be in consolidated list');
  console.log('\n--- Consolidated Curd Row ---');
  console.log(`Item Name:           ${curdConsolidated.itemName}`);
  console.log(`Unit:                ${curdConsolidated.unit}`);
  console.log(`Total Requested Qty: ${curdConsolidated.totalRequested}`);
  console.log(`Already Dispatched:  ${curdConsolidated.alreadyDispatched}`);
  console.log(`Remaining:           ${curdConsolidated.remainingToDispatch}`);
  console.log(`Requests Combined:   ${curdConsolidated.requests.length}`);

  assert(curdConsolidated.requests.length >= 2, 'Curd row must consolidate multiple requests');
  assert(curdConsolidated.totalRequested >= 5, 'Total requested must include both requests (at least 5 L)');

  // 4. Test Partial Dispatch of 3 L out of the 5 L
  console.log('\n[Step 4] Store Manager dispatches partial quantity (3 L) for consolidated Curd...');
  // Allocate 3 L in FIFO order across underlying requests
  let needed = 3;
  const dispatchPayload = [];
  for (const r of curdConsolidated.requests) {
    if (needed <= 0) break;
    const reqRem = Math.max(0, (r.requested || 0) - (r.dispatched || 0));
    if (reqRem <= 0) continue;
    const toAlloc = Math.min(needed, reqRem);
    dispatchPayload.push({
      requestId: r.id,
      itemName: r.item,
      unit: r.unit,
      dispatchQty: toAlloc,
      isAdditional: false
    });
    needed -= toAlloc;
  }

  console.log('Sending dispatch payload:', JSON.stringify(dispatchPayload));
  const resDispatch1 = await req('/api/dispatches/prepare', {
    method: 'POST',
    headers: authHeader(storeToken),
    body: JSON.stringify({
      branchName: 'Branch 1',
      items: dispatchPayload
    })
  });
  assert.strictEqual(resDispatch1.status, 200, `Dispatch 1 failed: ${JSON.stringify(resDispatch1.data)}`);
  console.log(`✓ Partial dispatch successful! Dispatched ${resDispatch1.data.length} item lines.`);

  // Verify stock decreased by 3
  const { data: itemsAfter1 } = await req('/api/items', { headers: authHeader(storeToken) });
  const curdAfter1 = itemsAfter1.find(i => i.name.toLowerCase() === 'curd');
  console.log(`✓ Central stock for Curd after 3 L dispatch: ${curdAfter1.stock} (was ${curdItem.stock})`);
  assert.strictEqual(curdAfter1.stock, curdItem.stock - 3, 'Central stock should have decreased by exactly 3');

  // Verify outstanding requests now show remaining 2 L for Curd
  const resOutstanding2 = await req('/api/branch-requests/outstanding?branch=Branch%201', {
    headers: authHeader(storeToken)
  });
  const outstanding2 = resOutstanding2.data;
  
  // Re-consolidate
  const groupMap2 = new Map();
  outstanding2.forEach(r => {
    const branchId = r.branchId || (r.branch || 'Branch 1');
    const itemId = r.itemId || (r.item || '').trim().toLowerCase();
    const unit = (r.unit || 'KG').trim().toUpperCase();
    const groupKey = `${branchId}_${itemId}_${unit}`.toLowerCase();
    if (!groupMap2.has(groupKey)) {
      groupMap2.set(groupKey, {
        key: groupKey,
        branchId,
        itemId,
        itemName: r.item,
        unit,
        totalRequested: 0,
        alreadyDispatched: 0,
        remainingToDispatch: 0,
        requests: []
      });
    }
    const group = groupMap2.get(groupKey);
    group.totalRequested += (r.requested || 0);
    group.alreadyDispatched += (r.dispatched || 0);
    group.requests.push(r);
  });
  const consolidated2 = Array.from(groupMap2.values()).map(g => {
    g.remainingToDispatch = Math.max(0, g.totalRequested - g.alreadyDispatched);
    g.requests.sort((a, b) => (a.id || 0) - (b.id || 0));
    return g;
  }).filter(g => g.remainingToDispatch > 0);

  const curdConsolidated2 = consolidated2.find(g => g.itemName.toLowerCase() === 'curd' && g.unit === 'L');
  console.log('\n--- Consolidated Curd Row After Partial Dispatch ---');
  console.log(`Item Name:           ${curdConsolidated2.itemName}`);
  console.log(`Unit:                ${curdConsolidated2.unit}`);
  console.log(`Total Requested Qty: ${curdConsolidated2.totalRequested}`);
  console.log(`Already Dispatched:  ${curdConsolidated2.alreadyDispatched}`);
  console.log(`Remaining:           ${curdConsolidated2.remainingToDispatch}`);
  assert.strictEqual(curdConsolidated2.remainingToDispatch, curdConsolidated.remainingToDispatch - 3);

  // 5. Test dispatching remaining 2 L
  console.log('\n[Step 5] Store Manager dispatches remaining 2 L...');
  let neededRemaining = 2;
  const dispatchPayload2 = [];
  for (const r of curdConsolidated2.requests) {
    if (neededRemaining <= 0) break;
    const reqRem = Math.max(0, (r.requested || 0) - (r.dispatched || 0));
    if (reqRem <= 0) continue;
    const toAlloc = Math.min(neededRemaining, reqRem);
    dispatchPayload2.push({
      requestId: r.id,
      itemName: r.item,
      unit: r.unit,
      dispatchQty: toAlloc,
      isAdditional: false
    });
    neededRemaining -= toAlloc;
  }

  const resDispatch2 = await req('/api/dispatches/prepare', {
    method: 'POST',
    headers: authHeader(storeToken),
    body: JSON.stringify({
      branchName: 'Branch 1',
      items: dispatchPayload2
    })
  });
  assert.strictEqual(resDispatch2.status, 200, `Dispatch 2 failed: ${JSON.stringify(resDispatch2.data)}`);
  console.log(`✓ Full remaining dispatch successful! Dispatched ${resDispatch2.data.length} item lines.`);

  // Verify stock decreased by additional 2
  const { data: itemsAfter2 } = await req('/api/items', { headers: authHeader(storeToken) });
  const curdAfter2 = itemsAfter2.find(i => i.name.toLowerCase() === 'curd');
  console.log(`✓ Central stock for Curd after 2 L dispatch: ${curdAfter2.stock} (was ${curdAfter1.stock})`);
  assert.strictEqual(curdAfter2.stock, curdAfter1.stock - 2, 'Central stock should have decreased by another 2');

  console.log('\n=== ALL CONSOLIDATION TESTS PASSED SUCCESSFULLY! ===');
}

run().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
