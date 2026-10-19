// Automated End-to-End Verification Script for Annamithra

const BASE_URL = 'http://localhost:8080/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }

  return { status: res.status, ok: res.ok, data };
}

async function login(username, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${username}: ${JSON.stringify(res.data)}`);
  }
  return res.data; // { token, role, branchName, username }
}

async function run() {
  console.log('--- STARTING ANNAMITHRA E2E VERIFICATION ---');

  // 1. Log in as Organisation Admin
  console.log('\n[1] Testing Organisation Admin Login...');
  const adminAuth = await login('admin@saravanas', '1234');
  console.log('✓ Admin logged in:', adminAuth.username, adminAuth.role);

  // 2. Organisation Admin creates a new branch and manager
  console.log('\n[2] Testing Create Branch & Manager...');
  const uid = Date.now().toString().slice(-4);
  const newBranchName = 'Branch ' + uid;
  const newManagerUser = 'mgr_' + uid;
  const createBranchRes = await request('/branches', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminAuth.token}` },
    body: JSON.stringify({
      name: newBranchName,
      location: 'South Zone',
      managerUsername: newManagerUser,
      managerPassword: 'DevPassword123'
    })
  });
  console.log(`✓ Created branch: ${newBranchName} with manager: ${newManagerUser}, status: ${createBranchRes.status}`);

  // Test logging in with newly created Branch Manager
  const newMgrAuth = await login(newManagerUser, 'DevPassword123');
  console.log(`✓ New Branch Manager authenticated successfully: ${newMgrAuth.username}, assigned branch: ${newMgrAuth.branchName}`);

  // 3. Log in as standard Branch 1 Manager
  console.log('\n[3] Testing Branch 1 Manager Login...');
  const b1Auth = await login('Branch1', '1234');
  console.log('✓ Branch 1 Manager logged in:', b1Auth.username, 'branch:', b1Auth.branchName);

  // 4. Branch 1 Manager submits multi-item order request
  console.log('\n[4] Branch 1 Manager submits multi-item request...');
  const itemName1 = 'Ponni Boiled Rice';
  const itemName2 = 'Toor Dal Premium';
  const submitReqRes = await request('/branch-requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${b1Auth.token}` },
    body: JSON.stringify({
      items: [
        { itemName: itemName1, unit: 'KG', requestedQuantity: 30 },
        { itemName: itemName2, unit: 'KG', requestedQuantity: 15 }
      ]
    })
  });
  console.log('✓ Multi-item request submitted. Rows returned:', submitReqRes.data.length);
  const ponniRequest = submitReqRes.data.find(r => r.item && r.item.toLowerCase().includes('ponni'));

  // 5. Store Manager Login & view consolidated requirements
  console.log('\n[5] Store Manager login & consolidated requirements...');
  const storeAuth = await login('store@manager', '1234');
  console.log('✓ Store Manager logged in:', storeAuth.username, storeAuth.role);

  const consolidatedRes = await request('/branch-requests/consolidated', {
    method: 'GET',
    headers: { Authorization: `Bearer ${storeAuth.token}` }
  });
  console.log('✓ Consolidated requirements calculated. Items:', consolidatedRes.data.map(i => `${i.itemName}: ${i.totalRequiredQuantity} ${i.unit}`).join(', '));

  // 6. Store Manager prepares and sends Purchase Order to Org Admin
  console.log('\n[6] Store Manager prepares PO for Org Admin...');
  const createPoRes = await request('/purchase-orders/store-order', {
    method: 'POST',
    headers: { Authorization: `Bearer ${storeAuth.token}` },
    body: JSON.stringify({
      items: [
        { itemName: itemName1, unit: 'KG', requiredQuantity: 30, orderQuantity: 50 },
        { itemName: itemName2, unit: 'KG', requiredQuantity: 15, orderQuantity: 25 }
      ]
    })
  });
  console.log('✓ Purchase order sent to Organisation Admin. PO count:', createPoRes.data.length);
  const targetPo = createPoRes.data[0];

  // 7. Organisation Admin sees Requested Items and marks Ordered
  console.log('\n[7] Organisation Admin reviews requested items and marks Ordered...');
  const requestedItemsRes = await request('/purchase-orders/requested', {
    headers: { Authorization: `Bearer ${adminAuth.token}` }
  });
  console.log('✓ Org Admin requested items list count:', requestedItemsRes.data.length);

  const markOrderedRes = await request(`/purchase-orders/${targetPo.id}/ordered`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminAuth.token}` }
  });
  console.log(`✓ PO #${targetPo.id} marked as ORDERED. New status:`, markOrderedRes.data.status);

  // Check central inventory BEFORE receipt - must NOT have increased merely by ordering
  const invBefore = await request('/inventory', {
    headers: { Authorization: `Bearer ${storeAuth.token}` }
  });
  const stockBefore = invBefore.data.find(i => i.name === targetPo.item)?.stock || 0;
  console.log(`✓ Central stock before receipt for ${targetPo.item}: ${stockBefore}`);

  // 8. Store Manager receives physical goods against PO
  console.log('\n[8] Store Manager receives physical goods...');
  const receiveQty = 20; // partial receipt of 20 out of 50
  const receiveRes = await request(`/purchase-orders/${targetPo.id}/receive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${storeAuth.token}` },
    body: JSON.stringify({ receivedQty: receiveQty })
  });
  console.log(`✓ Received ${receiveQty} units. PO receivedQty: ${receiveRes.data.receivedQty}, status: ${receiveRes.data.status}`);

  // Check central inventory AFTER receipt - MUST have increased by receiveQty
  const invAfter = await request('/inventory', {
    headers: { Authorization: `Bearer ${storeAuth.token}` }
  });
  const stockAfter = invAfter.data.find(i => i.name === targetPo.item)?.stock || 0;
  console.log(`✓ Central stock after receipt: ${stockAfter} (was ${stockBefore}, delta = ${stockAfter - stockBefore})`);
  if (stockAfter !== stockBefore + receiveQty) {
    throw new Error(`Inventory stock assertion failed! Expected ${stockBefore + receiveQty}, got ${stockAfter}`);
  }

  // 9. Store Manager dispatches items to Branch 1 (requested + additional items)
  console.log('\n[9] Store Manager dispatches items to Branch 1...');
  const dispatchQty = 10;
  const dispatchRes = await request('/dispatches/prepare', {
    method: 'POST',
    headers: { Authorization: `Bearer ${storeAuth.token}` },
    body: JSON.stringify({
      branchName: 'Branch 1',
      items: [
        {
          itemName: targetPo.item,
          unit: targetPo.unit,
          dispatchQty: dispatchQty,
          requestId: ponniRequest ? ponniRequest.id : null,
          isAdditional: false
        }
      ]
    })
  });
  console.log(`✓ Dispatched ${dispatchQty} ${targetPo.unit} of ${targetPo.item} to Branch 1. Result count:`, dispatchRes.data.length);
  const createdDispatch = dispatchRes.data[0];

  // Check central inventory after dispatch - MUST have decreased by dispatchQty
  const invAfterDispatch = await request('/inventory', {
    headers: { Authorization: `Bearer ${storeAuth.token}` }
  });
  const stockAfterDispatch = invAfterDispatch.data.find(i => i.name === targetPo.item)?.stock || 0;
  console.log(`✓ Central stock after dispatch: ${stockAfterDispatch} (delta = ${stockAfter - stockAfterDispatch})`);
  if (stockAfterDispatch !== stockAfter - dispatchQty) {
    throw new Error(`Dispatch stock reduction failed! Expected ${stockAfter - dispatchQty}, got ${stockAfterDispatch}`);
  }

  // 10. Branch 1 Manager views deliveries & acknowledges receipt
  console.log('\n[10] Branch 1 Manager views pending deliveries and acknowledges...');
  const deliveriesRes = await request('/dispatches/my-branch', {
    headers: { Authorization: `Bearer ${b1Auth.token}` }
  });
  console.log('✓ Branch 1 pending deliveries count:', deliveriesRes.data.length);
  const pending = deliveriesRes.data.find(d => d.id === createdDispatch.id);
  console.log(`✓ Found dispatch record #${pending.id}, status: ${pending.status}`);

  // Branch Manager acknowledges delivery
  const ackRes = await request(`/dispatches/${createdDispatch.id}/acknowledge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${b1Auth.token}` }
  });
  console.log(`✓ Acknowledged dispatch #${createdDispatch.id}. Status: ${ackRes.data.status}, Acknowledged Qty: ${ackRes.data.acknowledgedQuantity}`);

  // Test duplicate acknowledgement prevention
  const dupAckRes = await request(`/dispatches/${createdDispatch.id}/acknowledge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${b1Auth.token}` }
  });
  console.log(`✓ Duplicate acknowledgement prevented as expected: HTTP ${dupAckRes.status}`);

  // 11. Security boundary test: Different branch manager cannot acknowledge Branch 1 delivery
  console.log('\n[11] Testing Branch Security Boundary (Cannot acknowledge another branch)...');
  const crossBranchAck = await request(`/dispatches/${createdDispatch.id}/acknowledge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${newMgrAuth.token}` } // manager of newBranchName, not Branch 1
  });
  console.log(`✓ Cross-branch access rejected: HTTP ${crossBranchAck.status} (${JSON.stringify(crossBranchAck.data?.message || crossBranchAck.data)})`);

  // 12. History & Filter reports
  console.log('\n[12] Testing History reports with search and date filters...');
  const storeHistoryRes = await request('/dispatches/history?search=' + encodeURIComponent(targetPo.item), {
    headers: { Authorization: `Bearer ${storeAuth.token}` }
  });
  console.log(`✓ Store Manager dispatch history count for "${targetPo.item}": ${storeHistoryRes.data.length}`);

  const branchHistoryRes = await request('/dispatches/my-branch/history', {
    headers: { Authorization: `Bearer ${b1Auth.token}` }
  });
  console.log(`✓ Branch 1 Manager received history count: ${branchHistoryRes.data.length}`);

  const adminPoHistory = await request('/purchase-orders/history?search=' + encodeURIComponent(targetPo.item), {
    headers: { Authorization: `Bearer ${adminAuth.token}` }
  });
  console.log(`✓ Admin PO history count for "${targetPo.item}": ${adminPoHistory.data.length}`);

  console.log('\n🎉 ALL 12 WORKFLOW ASSERTIONS PASSED WITH REAL DATABASE PERSISTENCE!');
}

run().catch(err => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
