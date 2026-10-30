// Automated test suite for Branch Manager Order Entry Workflow
const BASE = 'http://localhost:8080/api';

async function main() {
  console.log('=== RUNNING BRANCH MANAGER ORDER ENTRY VERIFICATION SUITE ===');

  // 1. Branch Manager Login
  console.log('\n[Test 1] Logging in as Branch Manager...');
  const bmRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Branch1', password: '1234', role: 'Branch Manager' })
  });
  if (!bmRes.ok) throw new Error('Branch Manager login failed: ' + bmRes.status);
  const bmUser = await bmRes.json();
  const bmToken = bmUser.token;
  console.log(`✓ Logged in as: ${bmUser.username}, Branch: "${bmUser.branchName}", Role: ${bmUser.role}`);

  // 2. Fetch shared catalogue items
  console.log('\n[Test 2] Fetching catalogue items...');
  const catRes = await fetch(`${BASE}/items`, {
    headers: { 'Authorization': `Bearer ${bmToken}` }
  });
  if (!catRes.ok) throw new Error('Failed to fetch items: ' + catRes.status);
  const catalogue = await catRes.json();
  console.log(`✓ Fetched ${catalogue.length} catalogue items.`);
  const curdItem = catalogue.find(i => i.name.toLowerCase().includes('curd'));
  console.log(`✓ Found Curd item: "${curdItem?.name}" (Unit: ${curdItem?.unit})`);

  // 3. Duplicate catalogue item validation
  console.log('\n[Test 3] Testing duplicate catalogue item validation (case-insensitive & trimmed)...');
  const dupItemName = curdItem ? '  ' + curdItem.name.toUpperCase() + '  ' : '  CURD  ';
  const dupRes = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bmToken}`
    },
    body: JSON.stringify({ name: dupItemName, unit: 'KG' })
  });
  console.log(`✓ Duplicate catalogue item response: HTTP ${dupRes.status}`);
  if (dupRes.status !== 409) throw new Error('Expected HTTP 409 for duplicate item, got: ' + dupRes.status);
  const dupErr = await dupRes.json();
  console.log(`✓ Error message: "${dupErr.message || dupErr.error}"`);

  // 4. Missing fields validation
  console.log('\n[Test 4] Testing missing field validation on item creation...');
  const badRes = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bmToken}`
    },
    body: JSON.stringify({ name: '', unit: '' })
  });
  if (badRes.status !== 400) throw new Error('Expected HTTP 400 for empty fields, got: ' + badRes.status);
  console.log('✓ Validation correctly rejected empty fields with HTTP 400');

  // 5. Create genuinely new catalogue item as Branch Manager
  const uniqueName = 'Organic Jaggery ' + Math.floor(Math.random() * 10000);
  console.log(`\n[Test 5] Creating new catalogue item: "${uniqueName}" (Unit: KG)...`);
  const createRes = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bmToken}`
    },
    body: JSON.stringify({ name: uniqueName, unit: 'KG' })
  });
  if (!createRes.ok) throw new Error('Failed to create new item: ' + createRes.status);
  const createdItem = await createRes.json();
  console.log(`✓ Item created successfully: ID=${createdItem.id}, Name="${createdItem.name}", Unit="${createdItem.unit}", Stock=${createdItem.stock}`);
  if (createdItem.stock !== 0) {
    throw new Error('Expected initial stock = 0, got: ' + createdItem.stock);
  }
  console.log('✓ Invariant verified: Creating a catalogue item does NOT increase inventory (currentStock = 0)');

  // 6. Submit multi-item request from Branch Manager
  console.log('\n[Test 6] Submitting multi-item request from Branch Manager with catalogue item and new item...');
  const submitRes = await fetch(`${BASE}/branch-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bmToken}`
    },
    body: JSON.stringify({
      items: [
        { itemName: curdItem ? curdItem.name : 'Curd', unit: 'KG', department: 'Groceries', requestedQuantity: 15, isNewItem: false },
        { itemName: uniqueName, unit: 'KG', department: 'Groceries', requestedQuantity: 25, isNewItem: true }
      ]
    })
  });
  if (!submitRes.ok) throw new Error('Failed to submit branch request: ' + submitRes.status);
  const submittedRows = await submitRes.json();
  console.log(`✓ Successfully submitted ${submittedRows.length} item lines.`);
  for (const row of submittedRows) {
    console.log(`  - Line ID=${row.id}, Item="${row.item}", Unit="${row.unit}", Requested=${row.requested}, Branch="${row.branch}", BatchId="${row.batchId}", RequestDate="${row.requestDate}", CreatedAt="${row.createdAt}"`);
    if (!row.createdAt || !row.requestDate) throw new Error('Missing timestamp in branch request record!');
    if (row.branch !== bmUser.branchName) throw new Error(`Expected branch "${bmUser.branchName}", got "${row.branch}"`);
  }

  // 7. Branch Manager fetches own branch requests
  console.log('\n[Test 7] Fetching Branch Manager requests (/my-branch)...');
  const myReqsRes = await fetch(`${BASE}/branch-requests/my-branch`, {
    headers: { 'Authorization': `Bearer ${bmToken}` }
  });
  if (!myReqsRes.ok) throw new Error('Failed to fetch my branch requests: ' + myReqsRes.status);
  const myReqs = await myReqsRes.json();
  const foundCurd = myReqs.find(r => r.item.toLowerCase().includes('curd'));
  const foundNew = myReqs.find(r => r.item.toLowerCase() === uniqueName.toLowerCase());
  if (!foundCurd || !foundNew) throw new Error('Submitted requests not found in /my-branch!');
  console.log(`✓ Verified both submitted items present in branch requests history.`);

  // 8. Store Manager verifies visibility of submitted request
  console.log('\n[Test 8] Logging in as Store Manager to verify visibility...');
  const storeLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'store@manager', password: '1234', role: 'Store Manager' })
  });
  if (!storeLoginRes.ok) throw new Error('Store Manager login failed');
  const storeUser = await storeLoginRes.json();

  console.log('\n[Test 9] Store Manager checking consolidated requirements...');
  const consRes = await fetch(`${BASE}/branch-requests/consolidated`, {
    headers: { 'Authorization': `Bearer ${storeUser.token}` }
  });
  if (!consRes.ok) throw new Error('Failed to fetch consolidated: ' + consRes.status);
  const consolidated = await consRes.json();
  const consNew = consolidated.find(c => c.itemName.toLowerCase() === uniqueName.toLowerCase());
  if (!consNew) throw new Error(`Consolidated requirement for "${uniqueName}" not found!`);
  const totalReq = consNew.totalBranchRequirement ?? consNew.totalRequiredQuantity ?? consNew.outstandingRequirement;
  console.log(`✓ Store Manager sees consolidated requirement: "${consNew.itemName}", Total Requested = ${totalReq} ${consNew.unit}`);

  // 10. Persistence after re-querying
  console.log('\n[Test 10] Checking catalogue persistence after reload...');
  const reloadCatRes = await fetch(`${BASE}/items`);
  const reloadedItems = await reloadCatRes.json();
  const persisted = reloadedItems.find(it => it.name.toLowerCase() === uniqueName.toLowerCase());
  if (!persisted) throw new Error('New item was not persisted in database catalogue!');
  console.log(`✓ Catalogue persistence verified: "${persisted.name}" exists in database.`);

  console.log('\n=== ALL 10 TESTS PASSED SUCCESSFULLY! ===\n');
}

main().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
