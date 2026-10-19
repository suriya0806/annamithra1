async function req(path, opts = {}) {
  const res = await fetch('http://localhost:8080/api' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTest() {
  console.log('=== TEST 1 & 2: TWO REQUESTS COMBINED & HISTORY PRESERVED ===');
  const storeAuth = (await req('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'store@manager', password: '1234', role: 'Store Manager' }) })).data;
  const b1Auth = (await req('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'Branch1', password: '1234', role: 'Branch Manager' }) })).data;

  let sections = (await req('/branch-requests?branch=Branch 1', { headers: { Authorization: 'Bearer ' + storeAuth.token } })).data;
  const todaySection = sections.find(s => s.formattedDate.includes('18 October') || s.requestDate === '2026-10-18');
  console.log('Today Section found:', todaySection.formattedDate);
  const rice = todaySection.items.find(i => i.item.toLowerCase() === 'rice');
  console.log('Rice Total Requested:', rice.totalRequestedQuantity, 'Unit:', rice.unit);
  console.log('Rice History entries count:', rice.history.length);
  rice.history.forEach(h => console.log('  -> Request ID:', h.id, 'Time:', h.requestTime, 'Qty:', h.requested));

  console.log('\n=== TEST 5: DISPATCH 3 KG (UNACKNOWLEDGED) ===');
  const dispatchRes1 = await req('/dispatches/prepare', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + storeAuth.token },
    body: JSON.stringify({
      branchName: 'Branch 1',
      items: [{ requestId: 22, itemName: 'Rice', unit: 'KG', dispatchQty: 3, isAdditional: false }]
    })
  });
  console.log('Dispatched 3 KG for request 22. Status:', dispatchRes1.status);

  sections = (await req('/branch-requests?branch=Branch 1', { headers: { Authorization: 'Bearer ' + storeAuth.token } })).data;
  const riceAfterDispatch1 = sections[0].items.find(i => i.item.toLowerCase() === 'rice');
  console.log('After Dispatch 1:');
  console.log('  Total Requested:', riceAfterDispatch1.totalRequestedQuantity);
  console.log('  Already Dispatched:', riceAfterDispatch1.alreadyDispatchedQuantity);
  console.log('  Confirmed Received:', riceAfterDispatch1.confirmedReceivedQuantity);
  console.log('  Remaining to Dispatch:', riceAfterDispatch1.remainingToDispatch);
  console.log('  Delivery Status:', riceAfterDispatch1.deliveryStatus, '(', riceAfterDispatch1.deliveryStatusLabel, ')');

  console.log('\n=== TEST 6: BRANCH MANAGER ACKNOWLEDGES 3 KG -> PARTIALLY DELIVERED (BLUE) ===');
  const d1Id = dispatchRes1.data[0].id;
  const ackRes1 = await req('/dispatches/' + d1Id + '/acknowledge', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + b1Auth.token }
  });
  console.log('Acknowledged dispatch', d1Id, 'Status:', ackRes1.status);

  sections = (await req('/branch-requests?branch=Branch 1', { headers: { Authorization: 'Bearer ' + storeAuth.token } })).data;
  const riceAfterAck1 = sections[0].items.find(i => i.item.toLowerCase() === 'rice');
  console.log('After Ack 1:');
  console.log('  Total Requested:', riceAfterAck1.totalRequestedQuantity);
  console.log('  Already Dispatched:', riceAfterAck1.alreadyDispatchedQuantity);
  console.log('  Confirmed Received:', riceAfterAck1.confirmedReceivedQuantity);
  console.log('  Remaining to Dispatch:', riceAfterAck1.remainingToDispatch);
  console.log('  Delivery Status:', riceAfterAck1.deliveryStatus, '(', riceAfterAck1.deliveryStatusLabel, ')');

  console.log('\n=== TEST 7: DISPATCH REMAINING 4 KG & ACKNOWLEDGE -> COMPLETED (GREEN) ===');
  const dispatchRes2 = await req('/dispatches/prepare', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + storeAuth.token },
    body: JSON.stringify({
      branchName: 'Branch 1',
      items: [{ requestId: 23, itemName: 'Rice', unit: 'KG', dispatchQty: 4, isAdditional: false }]
    })
  });
  console.log('Dispatched 4 KG for request 23. Status:', dispatchRes2.status);

  const d2Id = dispatchRes2.data[0].id;
  const ackRes2 = await req('/dispatches/' + d2Id + '/acknowledge', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + b1Auth.token }
  });
  console.log('Acknowledged dispatch', d2Id, 'Status:', ackRes2.status);

  sections = (await req('/branch-requests?branch=Branch 1', { headers: { Authorization: 'Bearer ' + storeAuth.token } })).data;
  const riceFinal = sections[0].items.find(i => i.item.toLowerCase() === 'rice');
  console.log('Final State:');
  console.log('  Total Requested:', riceFinal.totalRequestedQuantity);
  console.log('  Already Dispatched:', riceFinal.alreadyDispatchedQuantity);
  console.log('  Confirmed Received:', riceFinal.confirmedReceivedQuantity);
  console.log('  Remaining to Dispatch:', riceFinal.remainingToDispatch);
  console.log('  Delivery Status:', riceFinal.deliveryStatus, '(', riceFinal.deliveryStatusLabel, ')');

  console.log('\n=== TEST 3 & 4: DATE SECTIONS PRESERVED ===');
  sections.forEach((s, idx) => {
    console.log('Section [' + idx + ']: Date: ' + s.formattedDate + ' (reqDate: ' + s.requestDate + '), Item count: ' + s.items.length);
  });
}
runTest();
