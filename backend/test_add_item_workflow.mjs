// Verification script for Adding New Items during Goods Receipt
const BASE = 'http://localhost:8080/api';

async function main() {
  console.log('--- TESTING ADD NEW ITEM & GOODS RECEIPT WORKFLOW ---');

  // 1. Login as Store Manager
  console.log('\n[1] Logging in as Store Manager...');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'store@manager', password: '1234', role: 'Store Manager' })
  });
  if (!loginRes.ok) throw new Error('Store Manager login failed: ' + loginRes.status);
  const storeUser = await loginRes.json();
  const token = storeUser.token;
  console.log(`✓ Store Manager logged in: ${storeUser.username}`);

  // 2. Test Duplicate Item Validation
  console.log('\n[2] Testing Duplicate Item validation...');
  const dupRes = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name: '  rice  ', unit: 'KG' })
  });
  console.log(`✓ Duplicate item check response: HTTP ${dupRes.status}`);
  if (dupRes.status !== 409) throw new Error('Expected 409 Conflict for duplicate item, got: ' + dupRes.status);
  const dupErr = await dupRes.json();
  console.log(`✓ Error message: "${dupErr.message || dupErr.error}"`);

  // 3. Test Missing Field Validation
  console.log('\n[3] Testing Missing Field validation...');
  const emptyRes = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name: '', unit: '' })
  });
  console.log(`✓ Empty fields check response: HTTP ${emptyRes.status}`);
  if (emptyRes.status !== 400) throw new Error('Expected 400 Bad Request for empty fields, got: ' + emptyRes.status);

  // 4. Create a new unique item
  const testItemName = 'Kashmiri Saffron ' + Math.floor(Math.random() * 10000);
  console.log(`\n[4] Adding new item to catalogue: "${testItemName}"...`);
  const createRes = await fetch(`${BASE}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name: testItemName, unit: 'Grams' })
  });
  if (!createRes.ok) throw new Error('Failed to create new item: ' + createRes.status);
  const createdItem = await createRes.json();
  console.log(`✓ Created item: ID=${createdItem.id}, Name="${createdItem.name}", Unit="${createdItem.unit}", Stock=${createdItem.stock}`);
  if (createdItem.stock !== 0) throw new Error('Created item must have initial stock of 0, got: ' + createdItem.stock);

  // 5. Verify catalogue fetch
  console.log('\n[5] Verifying item catalogue...');
  const catRes = await fetch(`${BASE}/items`);
  const catItems = await catRes.json();
  const found = catItems.find(it => it.name === createdItem.name);
  if (!found) throw new Error('Newly created item not found in catalogue!');
  console.log(`✓ Found in catalogue: "${found.name}" with stock ${found.stock} ${found.unit}`);

  // 6. Record Goods Receipt for the new item
  console.log('\n[6] Entering received quantity for the new item...');
  const receiptRes = await fetch(`${BASE}/inventory/receive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      itemName: createdItem.name,
      receivedQty: 50,
      receiptDate: new Date().toISOString().slice(0, 10),
      remarks: 'Initial batch delivery'
    })
  });
  if (!receiptRes.ok) throw new Error('Goods receipt failed: ' + receiptRes.status);
  const receiptData = await receiptRes.json();
  console.log(`✓ Receipt confirmed: Type=${receiptData.receiptType}, ReceivedQty=${receiptData.receivedQty}, CurrentStock=${receiptData.currentStock}`);
  if (receiptData.currentStock !== 50) throw new Error('Expected stock to be 50 after receipt, got: ' + receiptData.currentStock);

  // 7. Verify inventory audit transaction
  console.log('\n[7] Verifying Inventory Transactions...');
  const txRes = await fetch(`${BASE}/inventory/transactions?item=${encodeURIComponent(createdItem.name)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const txList = await txRes.json();
  console.log(`✓ Found ${txList.length} transaction(s) for "${createdItem.name}"`);
  if (txList.length === 0) throw new Error('No transaction found for received goods');
  console.log(`✓ Latest transaction: Type=${txList[0].type}, RefType=${txList[0].referenceType}, Qty=${txList[0].quantity}, BalanceAfter=${txList[0].balanceAfter}`);

  console.log('\n🎉 ALL ADD ITEM & GOODS RECEIPT VERIFICATION ASSERTIONS PASSED!');
}

main().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
