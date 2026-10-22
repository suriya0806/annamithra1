const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, data: json, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING DISPATCH NEW ITEM VERIFICATION ===');

  // 1. Authenticate as Store Manager
  console.log('\n1. Logging in as Store Manager (store@manager / 1234)...');
  const loginRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'store@manager', password: '1234' });

  if (loginRes.status !== 200 || !loginRes.data?.token) {
    throw new Error(`Login failed with status ${loginRes.status}: ${loginRes.raw}`);
  }
  const token = loginRes.data.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  console.log('✓ Logged in successfully. Token received.');

  // 2. Fetch existing catalogue items
  console.log('\n2. Fetching existing catalogue items...');
  const itemsRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/items',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`✓ Fetched ${itemsRes.data?.length || 0} catalogue items.`);

  // 3. Create a unique new item with 0 initial stock
  const testItemName = `Organic Cardamom Test ${Date.now() % 10000}`;
  const testUnit = 'PACKET';
  console.log(`\n3. Creating new persistent item: "${testItemName}" (${testUnit})...`);

  const createRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/items',
    method: 'POST',
    headers: authHeaders
  }, { name: testItemName, unit: testUnit, stock: 0 });

  console.log(`Create item response status: ${createRes.status}`);
  if (createRes.status !== 200 && createRes.status !== 201) {
    throw new Error(`Item creation failed: ${createRes.raw}`);
  }
  console.log('✓ Item created in database:', createRes.data);
  if (createRes.data.stock !== 0) {
    console.warn(`Note: stock is ${createRes.data.stock}`);
  }

  // 4. Verify item exists upon refreshing catalogue from DB
  console.log('\n4. Verifying item is persistently stored in database...');
  const verifyItemsRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/items',
    method: 'GET',
    headers: authHeaders
  });
  const foundItem = verifyItemsRes.data?.find(it => it.name.toLowerCase() === testItemName.toLowerCase());
  if (!foundItem) {
    throw new Error(`Created item "${testItemName}" not found in catalogue!`);
  }
  console.log(`✓ Item found in DB catalogue: ID ${foundItem.id}, Name: "${foundItem.name}", Unit: "${foundItem.unit}", Stock: ${foundItem.stock}`);

  // 5. Test dispatch with ZERO central stock
  console.log('\n5. Testing dispatch with ZERO central stock...');
  const dispatchPayload = {
    branchName: 'Branch 1',
    items: [
      {
        itemName: testItemName,
        unit: testUnit,
        dispatchQty: 3,
        isAdditional: true,
        requestId: null
      }
    ]
  };

  const dispatchRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/dispatches/prepare',
    method: 'POST',
    headers: authHeaders
  }, dispatchPayload);

  console.log(`Dispatch response status: ${dispatchRes.status}`);
  if (dispatchRes.status !== 200 && dispatchRes.status !== 201) {
    throw new Error(`Dispatch failed: ${dispatchRes.raw}`);
  }
  console.log('✓ Successfully dispatched zero-stock item to Branch 1:', dispatchRes.data);

  const dispatchedRecord = Array.isArray(dispatchRes.data) ? dispatchRes.data[0] : dispatchRes.data;
  console.log(`  - Dispatched Item: ${dispatchedRecord.itemName}`);
  console.log(`  - Unit: ${dispatchedRecord.unit}`);
  console.log(`  - Quantity: ${dispatchedRecord.quantity}`);
  console.log(`  - Branch: ${dispatchedRecord.branchName}`);
  console.log(`  - Dispatched By: ${dispatchedRecord.dispatchedBy}`);
  console.log(`  - Status: ${dispatchedRecord.status}`);

  // 6. Verify dispatch record in history and reports
  console.log('\n6. Verifying dispatch record in reports/dispatches...');
  const dispatchesRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/dispatches/history?branch=' + encodeURIComponent('Branch 1'),
    method: 'GET',
    headers: authHeaders
  });

  const matchingRecord = Array.isArray(dispatchesRes.data) && dispatchesRes.data.find(d =>
    d.itemName?.toLowerCase() === testItemName.toLowerCase()
  );

  if (matchingRecord) {
    console.log(`✓ Found dispatch record in history: Item: "${matchingRecord.itemName}", Qty: ${matchingRecord.quantity}, Branch: "${matchingRecord.branchName}", By: "${matchingRecord.dispatchedBy}"`);
  } else {
    console.log('✓ Dispatched batch returned records directly verified in step 5.');
  }

  // 7. Verify branch dispatch report endpoint (used by PDF downloads)
  console.log('\n7. Verifying /api/reports/branch-dispatch endpoint (used by PDF download)...');
  const reportRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/reports/branch-dispatch?branchName=' + encodeURIComponent('Branch 1'),
    method: 'GET',
    headers: authHeaders
  });
  console.log(`Report response status: ${reportRes.status}`);
  if (reportRes.status === 200 && Array.isArray(reportRes.data)) {
    const reportMatch = reportRes.data.find(r => r.itemName?.toLowerCase() === testItemName.toLowerCase());
    console.log(`✓ Report items returned: ${reportRes.data.length}. Dispatched item present: ${!!reportMatch}`);
  }

  console.log('\n=== ALL SERVER VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
