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

async function main() {
  console.log('--- STARTING COMPREHENSIVE DATE-WISE VERIFICATION ---');
  const todayStr = new Date().toISOString().slice(0, 10);
  console.log(`Testing with date: ${todayStr}`);

  // 1. Admin Tests
  console.log('\n[1] Testing Organisation Admin Date-Wise Organisation...');
  const adminToken = await login('admin@saravanas', '1234', 'Organisation Admin');
  
  // 1a. Requested groups by date
  const { status: s1, data: groupsToday } = await req(`/api/purchase-orders/requested-groups?date=${todayStr}`, {
    headers: authHeader(adminToken)
  });
  assert.strictEqual(s1, 200);
  console.log(`✓ Admin requested groups for today (${todayStr}): ${groupsToday.length} date sections`);

  // 1b. Requested groups All Dates
  const { status: s2, data: groupsAll } = await req('/api/purchase-orders/requested-groups', {
    headers: authHeader(adminToken)
  });
  assert.strictEqual(s2, 200);
  console.log(`✓ Admin requested groups for All Dates: ${groupsAll.length} date sections`);

  // 1c. Org New Item Orders
  const { status: s3, data: newItems } = await req(`/api/purchase-orders/org-new-items?date=${todayStr}`, {
    headers: authHeader(adminToken)
  });
  assert.strictEqual(s3, 200);
  console.log(`✓ Admin new item orders for today: ${newItems.length} records`);

  // 1d. PO History with Date Range
  const { status: s4, data: poHistory } = await req(`/api/purchase-orders/history?fromDate=2026-01-01&toDate=${todayStr}`, {
    headers: authHeader(adminToken)
  });
  assert.strictEqual(s4, 200);
  console.log(`✓ Admin PO History with date range: ${poHistory.length} records`);

  // 2. Store Manager Tests
  console.log('\n[2] Testing Store Manager Date-Wise Organisation...');
  const storeToken = await login('store@manager', '1234', 'Store Manager');

  // 2a. Inventory activity / transactions with date & date range
  const { status: s5, data: invTxToday } = await req(`/api/inventory/transactions?date=${todayStr}`, {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(s5, 200);
  console.log(`✓ Central inventory transactions for today: ${invTxToday.length} records`);

  const { status: s6, data: invTxRange } = await req(`/api/inventory/transactions?fromDate=2026-01-01&toDate=${todayStr}`, {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(s6, 200);
  console.log(`✓ Central inventory transactions with date range: ${invTxRange.length} records`);

  // 2b. Entry Items -> View & Entry orders
  const { status: s7, data: viewOrders } = await req(`/api/purchase-orders/store-view?date=${todayStr}`, {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(s7, 200);
  console.log(`✓ Store Manager PO View for today: ${viewOrders.length} records`);

  const { status: s8, data: entryOrders } = await req(`/api/purchase-orders/ordered-for-entry?date=${todayStr}`, {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(s8, 200);
  console.log(`✓ Store Manager Orders Awaiting Receipt for today: ${entryOrders.length} records`);

  // 2c. Branch Requests -> Branches & Dispatch
  const { status: s9, data: branchReqsToday } = await req(`/api/branch-requests?branch=Branch 1&date=${todayStr}`, {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(s9, 200);
  console.log(`✓ Branch 1 requests aggregated for today: ${branchReqsToday.length} date sections`);

  const { status: s10, data: outstandingReqs } = await req(`/api/branch-requests/outstanding?branch=Branch 1&date=${todayStr}`, {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(s10, 200);
  console.log(`✓ Branch 1 outstanding requests for today: ${outstandingReqs.length} items`);

  const { status: s11, data: storeDispatches } = await req(`/api/dispatches/history?branch=Branch 1&date=${todayStr}`, {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(s11, 200);
  console.log(`✓ Store dispatches to Branch 1 for today: ${storeDispatches.length} records`);

  // 2d. Order tab: Consolidated requirements & previous orders
  const { status: s12, data: consolidated } = await req(`/api/branch-requests/consolidated?date=${todayStr}`, {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(s12, 200);
  console.log(`✓ Consolidated requirements for today: ${consolidated.length} items`);

  const { status: s13, data: prevOrders } = await req(`/api/purchase-orders/previous-orders?date=${todayStr}`, {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(s13, 200);
  console.log(`✓ Previous orders for today: ${prevOrders.length} orders`);

  // 2e. Reports with Date Ranges
  const { status: s14, data: poRep } = await req(`/api/reports/purchase-orders?fromDate=2026-01-01&toDate=${todayStr}`, {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(s14, 200);
  console.log(`✓ Purchase orders report with date range: ${poRep.length} rows`);

  const { status: s15, data: reqRep } = await req(`/api/reports/branch-requests?fromDate=2026-01-01&toDate=${todayStr}`, {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(s15, 200);
  console.log(`✓ Branch requests report with date range: ${reqRep.length} rows`);

  const { status: s16, data: dispRep } = await req(`/api/reports/dispatches?fromDate=2026-01-01&toDate=${todayStr}`, {
    headers: authHeader(storeToken)
  });
  assert.strictEqual(s16, 200);
  console.log(`✓ Dispatches report with date range: ${dispRep.length} rows`);

  // 3. Branch Manager Tests
  console.log('\n[3] Testing Branch Manager Date-Wise Organisation...');
  const branchToken = await login('Branch1', '1234', 'Branch Manager');

  // 3a. Branch Requisitions / Order Items previous requests
  const { status: s17, data: branchReqHistory } = await req(`/api/branch-requests/my-branch?date=${todayStr}`, {
    headers: authHeader(branchToken)
  });
  assert.strictEqual(s17, 200);
  console.log(`✓ Branch Manager requests for today: ${branchReqHistory.length} requests`);

  // 3b. Deliveries / Entry with date filter
  const { status: s18, data: branchDeliveriesToday } = await req(`/api/dispatches/my-branch?date=${todayStr}`, {
    headers: authHeader(branchToken)
  });
  assert.strictEqual(s18, 200);
  console.log(`✓ Branch deliveries for today: ${branchDeliveriesToday.length} records`);

  const { status: s19, data: branchDeliveriesAll } = await req('/api/dispatches/my-branch', {
    headers: authHeader(branchToken)
  });
  assert.strictEqual(s19, 200);
  console.log(`✓ Branch deliveries All Dates: ${branchDeliveriesAll.length} records`);

  // 3c. History / Goods received with date range
  const { status: s20, data: branchHistoryRange } = await req(`/api/dispatches/my-branch/history?fromDate=2026-01-01&toDate=${todayStr}`, {
    headers: authHeader(branchToken)
  });
  assert.strictEqual(s20, 200);
  console.log(`✓ Branch goods received history with date range: ${branchHistoryRange.length} records`);

  console.log('\n🎉 ALL 20 DATE-WISE API & DATA ORGANISATION TESTS PASSED!');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
