// Automated verification test for Delivery Acknowledgement & Shortage Calculation
const BASE_URL = 'http://localhost:8080/api';

async function login(username, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Login failed for ${username}: ${res.status} ${txt}`);
  }
  return await res.json();
}

async function runTest() {
  console.log('🚀 Starting Delivery Acknowledgement & Shortage Calculation Tests...\n');

  // 1. Login Store Manager and Branch Manager
  console.log('1. Logging in as Store Manager (store@manager)...');
  const storeUser = await login('store@manager', '1234');
  console.log(`✓ Store Manager logged in: token=${storeUser.token?.substring(0, 10)}... branch=${storeUser.branchName}`);

  console.log('2. Logging in as Branch Manager (Branch1)...');
  const branchUser = await login('Branch1', '1234');
  console.log(`✓ Branch Manager logged in: token=${branchUser.token?.substring(0, 10)}... branch=${branchUser.branchName}`);

  const storeHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${storeUser.token}`
  };
  const branchHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${branchUser.token}`
  };

  // 2. Create 3 dispatches to Branch 1 for testing:
  // Item A: 10 KG (for Partial receipt test: receive 7, shortage 3)
  // Item B: 5 KG  (for Zero receipt test: receive 0, shortage 5)
  // Item C: 8 KG  (for Full receipt test: receive 8, shortage 0)
  console.log('\n3. Creating 3 test dispatches to Branch 1 via /dispatches/prepare...');
  const dispatchRes = await fetch(`${BASE_URL}/dispatches/prepare`, {
    method: 'POST',
    headers: storeHeaders,
    body: JSON.stringify({
      branchName: 'Branch 1',
      items: [
        { itemName: 'Carrot (Shortage Test A)', unit: 'KG', dispatchQty: 10, isAdditional: true },
        { itemName: 'Potato (Shortage Test B)', unit: 'KG', dispatchQty: 5, isAdditional: true },
        { itemName: 'Tomato (Shortage Test C)', unit: 'KG', dispatchQty: 8, isAdditional: true }
      ]
    })
  });
  if (!dispatchRes.ok) throw new Error(`Failed to dispatch items: ${await dispatchRes.text()}`);
  const createdDispatches = await dispatchRes.json();
  const itemA = createdDispatches.find(d => d.itemName.toLowerCase().includes('carrot (shortage test a)'));
  const itemB = createdDispatches.find(d => d.itemName.toLowerCase().includes('potato (shortage test b)'));
  const itemC = createdDispatches.find(d => d.itemName.toLowerCase().includes('tomato (shortage test c)'));

  console.log(`✓ Dispatched Item A (id=${itemA.id}): ${itemA.quantity} ${itemA.unit}`);
  console.log(`✓ Dispatched Item B (id=${itemB.id}): ${itemB.quantity} ${itemB.unit}`);
  console.log(`✓ Dispatched Item C (id=${itemC.id}): ${itemC.quantity} ${itemC.unit}`);

  // 4. Test Validation on Item A:
  console.log('\n4. Testing Validation on Acknowledge Endpoint...');
  // 4a. Negative quantity should fail
  const negRes = await fetch(`${BASE_URL}/dispatches/${itemA.id}/acknowledge`, {
    method: 'POST',
    headers: branchHeaders,
    body: JSON.stringify({ actualReceivedQty: -2, remarks: 'negative test' })
  });
  if (negRes.status === 400) {
    console.log(`✓ Negative quantity properly rejected (HTTP 400): ${await negRes.text()}`);
  } else {
    throw new Error(`Expected 400 for negative qty, got ${negRes.status}`);
  }

  // 4b. Quantity exceeding dispatched should fail
  const excessRes = await fetch(`${BASE_URL}/dispatches/${itemA.id}/acknowledge`, {
    method: 'POST',
    headers: branchHeaders,
    body: JSON.stringify({ actualReceivedQty: 15, remarks: 'excess test' })
  });
  if (excessRes.status === 400) {
    console.log(`✓ Excess quantity properly rejected (HTTP 400): ${await excessRes.text()}`);
  } else {
    throw new Error(`Expected 400 for excess qty, got ${excessRes.status}`);
  }

  // 5. Test Partial Receipt on Item A:
  // Dispatched = 10, Received = 7, Shortage = 3
  console.log('\n5. Testing Partial Receipt on Item A (Dispatched 10, Received 7, Shortage 3)...');
  const ackResA = await fetch(`${BASE_URL}/dispatches/${itemA.id}/acknowledge`, {
    method: 'POST',
    headers: branchHeaders,
    body: JSON.stringify({ actualReceivedQty: 7, remarks: '3 kg damaged during transit' })
  });
  if (!ackResA.ok) throw new Error(`Failed to acknowledge Item A: ${await ackResA.text()}`);
  const ackA = await ackResA.json();
  console.log('Response for Item A:', {
    id: ackA.id,
    quantity: ackA.quantity,
    acknowledgedQuantity: ackA.acknowledgedQuantity,
    shortageQuantity: ackA.shortageQuantity,
    acknowledgementStatus: ackA.acknowledgementStatus,
    acknowledgementRemarks: ackA.acknowledgementRemarks,
    acknowledgedBy: ackA.acknowledgedBy
  });

  if (ackA.quantity !== 10) throw new Error(`Original dispatched quantity altered! Expected 10, got ${ackA.quantity}`);
  if (ackA.acknowledgedQuantity !== 7) throw new Error(`Expected acknowledgedQuantity 7, got ${ackA.acknowledgedQuantity}`);
  if (ackA.shortageQuantity !== 3) throw new Error(`Expected shortageQuantity 3, got ${ackA.shortageQuantity}`);
  if (ackA.acknowledgementStatus !== 'PARTIALLY_RECEIVED') throw new Error(`Expected status PARTIALLY_RECEIVED, got ${ackA.acknowledgementStatus}`);
  if (ackA.acknowledgementRemarks !== '3 kg damaged during transit') throw new Error(`Remarks not preserved!`);
  console.log('✓ Partial receipt verified successfully!');

  // 6. Test Duplicate Prevention on Item A:
  console.log('\n6. Testing Duplicate Acknowledgement Prevention on Item A...');
  const dupRes = await fetch(`${BASE_URL}/dispatches/${itemA.id}/acknowledge`, {
    method: 'POST',
    headers: branchHeaders,
    body: JSON.stringify({ actualReceivedQty: 7, remarks: 'trying again' })
  });
  if (dupRes.status === 409 || dupRes.status === 400) {
    console.log(`✓ Duplicate acknowledgement prevented (HTTP ${dupRes.status}): ${await dupRes.text()}`);
  } else {
    throw new Error(`Expected 409 or 400 for duplicate ack, got ${dupRes.status}`);
  }

  // 7. Test Zero Receipt on Item B:
  // Dispatched = 5, Received = 0, Shortage = 5
  console.log('\n7. Testing Zero Receipt on Item B (Dispatched 5, Received 0, Shortage 5)...');
  const ackResB = await fetch(`${BASE_URL}/dispatches/${itemB.id}/acknowledge`, {
    method: 'POST',
    headers: branchHeaders,
    body: JSON.stringify({ actualReceivedQty: 0, remarks: 'Box missing entirely' })
  });
  if (!ackResB.ok) throw new Error(`Failed to acknowledge Item B: ${await ackResB.text()}`);
  const ackB = await ackResB.json();
  console.log('Response for Item B:', {
    id: ackB.id,
    quantity: ackB.quantity,
    acknowledgedQuantity: ackB.acknowledgedQuantity,
    shortageQuantity: ackB.shortageQuantity,
    acknowledgementStatus: ackB.acknowledgementStatus,
    acknowledgementRemarks: ackB.acknowledgementRemarks
  });

  if (ackB.quantity !== 5) throw new Error(`Original dispatched quantity altered! Expected 5, got ${ackB.quantity}`);
  if (ackB.acknowledgedQuantity !== 0) throw new Error(`Expected acknowledgedQuantity 0, got ${ackB.acknowledgedQuantity}`);
  if (ackB.shortageQuantity !== 5) throw new Error(`Expected shortageQuantity 5, got ${ackB.shortageQuantity}`);
  if (ackB.acknowledgementStatus !== 'NOT_RECEIVED') throw new Error(`Expected status NOT_RECEIVED, got ${ackB.acknowledgementStatus}`);
  console.log('✓ Zero receipt verified successfully!');

  // 8. Test Full Receipt on Item C:
  // Dispatched = 8, Received = 8, Shortage = 0
  console.log('\n8. Testing Full Receipt on Item C (Dispatched 8, Received 8, Shortage 0)...');
  const ackResC = await fetch(`${BASE_URL}/dispatches/${itemC.id}/acknowledge`, {
    method: 'POST',
    headers: branchHeaders,
    body: JSON.stringify({ actualReceivedQty: 8, remarks: 'Full quantity received in good shape' })
  });
  if (!ackResC.ok) throw new Error(`Failed to acknowledge Item C: ${await ackResC.text()}`);
  const ackC = await ackResC.json();
  console.log('Response for Item C:', {
    id: ackC.id,
    quantity: ackC.quantity,
    acknowledgedQuantity: ackC.acknowledgedQuantity,
    shortageQuantity: ackC.shortageQuantity,
    acknowledgementStatus: ackC.acknowledgementStatus,
    acknowledgementRemarks: ackC.acknowledgementRemarks
  });

  if (ackC.quantity !== 8) throw new Error(`Original dispatched quantity altered! Expected 8, got ${ackC.quantity}`);
  if (ackC.acknowledgedQuantity !== 8) throw new Error(`Expected acknowledgedQuantity 8, got ${ackC.acknowledgedQuantity}`);
  if (ackC.shortageQuantity !== 0) throw new Error(`Expected shortageQuantity 0, got ${ackC.shortageQuantity}`);
  if (ackC.acknowledgementStatus !== 'FULLY_RECEIVED') throw new Error(`Expected status FULLY_RECEIVED, got ${ackC.acknowledgementStatus}`);
  console.log('✓ Full receipt verified successfully!');

  // 9. Verify Persistence After Reload (simulating page refresh):
  console.log('\n9. Testing Persistence via GET /dispatches/my-branch...');
  const reloadRes = await fetch(`${BASE_URL}/dispatches/my-branch`, {
    headers: branchHeaders
  });
  if (!reloadRes.ok) throw new Error(`Failed to fetch dispatches for Branch 1: ${await reloadRes.text()}`);
  const reloadedList = await reloadRes.json();

  const foundA = reloadedList.find(d => d.id === itemA.id);
  const foundB = reloadedList.find(d => d.id === itemB.id);
  const foundC = reloadedList.find(d => d.id === itemC.id);

  if (!foundA || !foundB || !foundC) throw new Error('Not all test dispatches found on reload!');

  console.log('Reloaded Item A:', {
    qty: foundA.quantity,
    ackQty: foundA.acknowledgedQuantity,
    shortage: foundA.shortageQuantity,
    status: foundA.acknowledgementStatus,
    remarks: foundA.acknowledgementRemarks
  });
  if (foundA.shortageQuantity !== 3 || foundA.acknowledgedQuantity !== 7 || foundA.quantity !== 10) {
    throw new Error('Item A data corrupted on reload!');
  }

  console.log('Reloaded Item B:', {
    qty: foundB.quantity,
    ackQty: foundB.acknowledgedQuantity,
    shortage: foundB.shortageQuantity,
    status: foundB.acknowledgementStatus,
    remarks: foundB.acknowledgementRemarks
  });
  if (foundB.shortageQuantity !== 5 || foundB.acknowledgedQuantity !== 0 || foundB.quantity !== 5) {
    throw new Error('Item B data corrupted on reload!');
  }

  console.log('Reloaded Item C:', {
    qty: foundC.quantity,
    ackQty: foundC.acknowledgedQuantity,
    shortage: foundC.shortageQuantity,
    status: foundC.acknowledgementStatus,
    remarks: foundC.acknowledgementRemarks
  });
  if (foundC.shortageQuantity !== 0 || foundC.acknowledgedQuantity !== 8 || foundC.quantity !== 8) {
    throw new Error('Item C data corrupted on reload!');
  }
  console.log('✓ Persistence verified after reload!');

  // 10. Verify Reports Include Correct Shortage & Receipt Data:
  console.log('\n10. Testing Reports endpoint (GET /reports/dispatches)...');
  const reportRes = await fetch(`${BASE_URL}/reports/dispatches?branch=Branch%201`, {
    headers: storeHeaders
  });
  if (!reportRes.ok) throw new Error(`Failed to fetch branch dispatch report: ${await reportRes.text()}`);
  const reportItems = await reportRes.json();
  const repA = reportItems.find(r => r.id === itemA.id);
  const repB = reportItems.find(r => r.id === itemB.id);
  const repC = reportItems.find(r => r.id === itemC.id);

  console.log('Report Item A:', {
    dispatchedQuantity: repA?.dispatchedQuantity,
    acknowledgedQuantity: repA?.acknowledgedQuantity,
    shortageQuantity: repA?.shortageQuantity,
    acknowledgementStatus: repA?.acknowledgementStatus
  });
  console.log('Report Item B (Zero receipt):', {
    dispatchedQuantity: repB?.dispatchedQuantity,
    acknowledgedQuantity: repB?.acknowledgedQuantity,
    shortageQuantity: repB?.shortageQuantity,
    acknowledgementStatus: repB?.acknowledgementStatus
  });
  console.log('Report Item C (Full receipt):', {
    dispatchedQuantity: repC?.dispatchedQuantity,
    acknowledgedQuantity: repC?.acknowledgedQuantity,
    shortageQuantity: repC?.shortageQuantity,
    acknowledgementStatus: repC?.acknowledgementStatus
  });

  if (repA?.shortageQuantity !== 3 || repA?.acknowledgedQuantity !== 7) {
    throw new Error('Report Item A figures incorrect!');
  }
  if (repB?.shortageQuantity !== 5 || repB?.acknowledgedQuantity !== 0) {
    throw new Error('Report Item B figures incorrect!');
  }
  if (repC?.shortageQuantity !== 0 || repC?.acknowledgedQuantity !== 8) {
    throw new Error('Report Item C figures incorrect!');
  }
  console.log('✓ Reports accurately reflect received and shortage quantities!');

  console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
