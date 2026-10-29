// verify_add_items_and_departments.mjs
// Rigorous verification of Annamithra Add Items module & Department renaming

const BASE_URL = 'http://localhost:8080/api';

async function login(username, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${username}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { token: data.token, user: data };
}

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

async function runTests() {
  console.log('=== STARTING RIGOROUS VERIFICATION OF ADD ITEMS & DEPARTMENT MODULE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Log in users
    console.log('--- 1. Authenticating test users ---');
    const storeSession = await login('store@manager', '1234');
    assert(storeSession.user.role === 'Store Manager', 'Store Manager login successful');

    const adminSession = await login('admin@saravanas', '1234');
    assert(adminSession.user.role === 'Organisation Admin', 'Organisation Admin login successful');

    const branchSession = await login('Branch1', '1234');
    assert(branchSession.user.role === 'Branch Manager', 'Branch Manager login successful');

    // 2. Persistent default categories in DB
    console.log('\n--- 2. Verifying Persistent Default Categories ---');
    const catRes = await fetch(`${BASE_URL}/categories`, {
      headers: authHeaders(storeSession.token)
    });
    assert(catRes.status === 200, 'Store Manager can fetch /api/categories');
    const categories = await catRes.json();
    console.log(`Retrieved ${categories.length} categories from DB.`);
    const expectedDefaults = [
      'Dairy', 'Pulses', 'Vegetables', 'Groceries', 'Tea/Coffee',
      'Vada Stall', 'Sweet/Savouries', 'Dosa Kal', 'Chinese',
      'Idly', 'Front Office', 'Parcel', 'Dishwasher'
    ];
    const catNames = categories.map(c => c.name);
    const hasAllDefaults = expectedDefaults.every(d => catNames.includes(d));
    assert(hasAllDefaults, 'All 13 default reusable categories are seeded and present in DB');

    // 3. Store Manager can create a category
    console.log('\n--- 3. Category Creation by Store Manager ---');
    const testCatName = `Bakery & Sweets ${Date.now()}`;
    const createCatRes = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: authHeaders(storeSession.token),
      body: JSON.stringify({ name: testCatName })
    });
    assert(createCatRes.status === 201, `Store Manager created category: ${testCatName}`);
    const createdCat = await createCatRes.json();
    assert(createdCat.id != null && createdCat.name === testCatName && createdCat.active === true, 'Created category has ID, active=true, and correct name');

    // 4. Duplicate Category validation (case-insensitive)
    console.log('\n--- 4. Duplicate Category Validation ---');
    const dupCatRes = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: authHeaders(adminSession.token),
      body: JSON.stringify({ name: testCatName.toLowerCase() }) // case insensitive check
    });
    assert(dupCatRes.status === 409, 'Duplicate category creation is safely rejected with HTTP 409 Conflict');
    const dupCatErr = await dupCatRes.json();
    assert(dupCatErr.message.includes('already exists') || (dupCatErr.error && dupCatErr.error.includes('already exists')), 'Conflict response contains clean user-friendly error message');

    // 5. Store Manager creates an item linked to category (with stock = 0)
    console.log('\n--- 5. Add Item with Category Link & Stock = 0 Invariant ---');
    const testItemName = `Butter Bun ${Date.now()}`;
    const createItemRes = await fetch(`${BASE_URL}/items`, {
      method: 'POST',
      headers: authHeaders(storeSession.token),
      body: JSON.stringify({
        name: testItemName,
        unit: 'piece',
        categoryId: createdCat.id,
        category: createdCat.name
      })
    });
    assert(createItemRes.status === 201, `Item created via Add Items module: ${testItemName}`);
    const createdItem = await createItemRes.json();
    assert(createdItem.id != null, 'Created item has an ID');
    assert(createdItem.stock === 0, 'CRITICAL: Stock quantity is strictly 0 (no inventory stock added)');
    assert(createdItem.categoryId === createdCat.id, `Item linked to categoryId: ${createdCat.id}`);
    assert(createdItem.category === createdCat.name, `Item category string matches: ${createdCat.name}`);

    // 6. Duplicate Item validation
    console.log('\n--- 6. Duplicate Item Validation ---');
    const dupItemRes = await fetch(`${BASE_URL}/items`, {
      method: 'POST',
      headers: authHeaders(adminSession.token),
      body: JSON.stringify({
        name: testItemName,
        unit: 'piece',
        categoryId: createdCat.id
      })
    });
    assert(dupItemRes.status === 400 || dupItemRes.status === 409, 'Duplicate item creation rejected safely');

    // 7. Edit Item without modifying stock
    console.log('\n--- 7. Edit Item Name, Unit, and Category ---');
    const updatedItemName = `${testItemName} Premium`;
    const editItemRes = await fetch(`${BASE_URL}/items/${createdItem.id}`, {
      method: 'PUT',
      headers: authHeaders(adminSession.token), // Org Admin can also edit
      body: JSON.stringify({
        name: updatedItemName,
        unit: 'packet',
        categoryId: createdCat.id
      })
    });
    assert(editItemRes.status === 200, 'Item successfully updated by Organisation Admin');
    const updatedItem = await editItemRes.json();
    assert(updatedItem.name === updatedItemName, 'Updated item name matches');
    assert(updatedItem.unit.toUpperCase() === 'PACKET', 'Updated unit matches');
    assert(updatedItem.stock === 0, 'CRITICAL: Stock quantity remains intact (0) after editing item');

    // 8. Category Rename & Automatic Cascade
    console.log('\n--- 8. Category Rename and Item Relationship Preservation ---');
    const renamedCatName = `Artisan Bakery ${Date.now()}`;
    const renameCatRes = await fetch(`${BASE_URL}/categories/${createdCat.id}`, {
      method: 'PUT',
      headers: authHeaders(adminSession.token),
      body: JSON.stringify({ name: renamedCatName, active: true })
    });
    assert(renameCatRes.status === 200, `Category renamed to: ${renamedCatName}`);
    const renamedCat = await renameCatRes.json();
    assert(renamedCat.name === renamedCatName, 'Category response reflects new name');

    // Fetch the item again to confirm relationship & category name cascade
    const getItemsRes = await fetch(`${BASE_URL}/items`, {
      headers: authHeaders(storeSession.token)
    });
    const allItems = await getItemsRes.json();
    const fetchedItem = allItems.find(i => i.id === createdItem.id);
    assert(fetchedItem != null, 'Item fetched from catalogue');
    assert(fetchedItem.categoryId === createdCat.id, 'Item retains categoryId foreign key');
    assert(fetchedItem.category === renamedCatName, 'Item category string automatically updated to match renamed category');

    // 9. Deactivation over Destructive Deletion for In-Use Category
    console.log('\n--- 9. Category Deactivation for In-Use Category ---');
    const delCatRes = await fetch(`${BASE_URL}/categories/${createdCat.id}`, {
      method: 'DELETE',
      headers: authHeaders(adminSession.token)
    });
    assert(delCatRes.status === 200, 'Category delete endpoint returned 200');
    const delResult = await delCatRes.json();
    assert(delResult.action === 'deactivated' || delResult.active === false, 'Category was safely deactivated (not destructively dropped) because it is linked to items');

    // Verify it is inactive in DB
    const allCatsIncludingInactive = await (await fetch(`${BASE_URL}/categories?includeInactive=true`, {
      headers: authHeaders(adminSession.token)
    })).json();
    const inUseCatAfterDelete = allCatsIncludingInactive.find(c => c.id === createdCat.id);
    assert(inUseCatAfterDelete != null && inUseCatAfterDelete.active === false, 'In-use category is flagged active=false in database');

    // 10. Role Access & Permission Enforcement
    console.log('\n--- 10. Role Access & Permission Restrictions ---');
    // Branch Manager should NOT be allowed to access /api/categories
    const branchCatRes = await fetch(`${BASE_URL}/categories`, {
      headers: authHeaders(branchSession.token)
    });
    assert(branchCatRes.status === 403, 'Branch Manager is forbidden (403) from accessing /api/categories');

    // Branch Manager should NOT be allowed to edit items in Item Master
    const branchItemEditRes = await fetch(`${BASE_URL}/items/${createdItem.id}`, {
      method: 'PUT',
      headers: authHeaders(branchSession.token),
      body: JSON.stringify({ name: 'Unauthorized Name' })
    });
    assert(branchItemEditRes.status === 403, 'Branch Manager is forbidden (403) from editing items in Item Master');

    // 11. Persistence Verification Across Re-login
    console.log('\n--- 11. Persistence Verification Across Re-login ---');
    const persistCatName = `Permanent Category ${Date.now()}`;
    const newCatRes = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: authHeaders(storeSession.token),
      body: JSON.stringify({ name: persistCatName })
    });
    const newCat = await newCatRes.json();
    assert(newCat.id != null, `New persistent category created: ${persistCatName}`);

    // Re-login with another session
    const newStoreSession = await login('store@manager', '1234');
    const reloadedCatsRes = await fetch(`${BASE_URL}/categories`, {
      headers: authHeaders(newStoreSession.token)
    });
    const reloadedCats = await reloadedCatsRes.json();
    const foundNewCat = reloadedCats.find(c => c.id === newCat.id);
    assert(foundNewCat != null, 'New category remains available after logout and re-login from new session');
    assert(foundNewCat.name === persistCatName, 'Category name remains accurate after re-login');

    // 12. Branch Manager Department Field & Workflow Integrity
    console.log('\n--- 12. Branch Manager Department Field & Workflow Integrity ---');
    // Submit a branch request using the renamed 'department' field
    const testDept = 'Tea/Coffee';
    const branchReqPayload = {
      items: [
        {
          itemName: 'Sugar',
          unit: 'KG',
          department: testDept, // Using the new 'department' field
          requestedQuantity: 5
        }
      ]
    };
    const submitReqRes = await fetch(`${BASE_URL}/branch-requests`, {
      method: 'POST',
      headers: authHeaders(branchSession.token),
      body: JSON.stringify(branchReqPayload)
    });
    assert(submitReqRes.status === 200, `Branch Manager submitted request with department: "${testDept}"`);

    // Verify branch request history has department field populated
    const branchMyReqsRes = await fetch(`${BASE_URL}/branch-requests/my-branch`, {
      headers: authHeaders(branchSession.token)
    });
    assert(branchMyReqsRes.status === 200, 'Branch requests (/my-branch) retrieved');
    const branchReqs = await branchMyReqsRes.json();
    const matchingReq = branchReqs.find(r => r.item === 'Sugar' && (r.department === testDept || r.category === testDept));
    assert(matchingReq != null, 'Submitted request found in branch requests');
    assert(matchingReq.department === testDept, `Branch request exposes department="${testDept}"`);

    // Verify date-wise aggregated requests has department
    const dateWiseRes = await fetch(`${BASE_URL}/branch-requests`, {
      headers: authHeaders(storeSession.token)
    });
    assert(dateWiseRes.status === 200, 'Store Manager fetched date-wise aggregated branch requests');
    const dateWiseData = await dateWiseRes.json();
    assert(Array.isArray(dateWiseData), 'Date-wise aggregated requests is an array');

    // 13. Independence of Department and Category
    console.log('\n--- 13. Verifying Independence of Department and Category ---');
    // Editing an item category does not alter branch requests
    const initialBranchDept = matchingReq.department;
    // Renaming a category
    await fetch(`${BASE_URL}/categories/${newCat.id}`, {
      method: 'PUT',
      headers: authHeaders(adminSession.token),
      body: JSON.stringify({ name: `${persistCatName} Renamed`, active: true })
    });
    // Check branch requests department again
    const branchReqsAfter = await (await fetch(`${BASE_URL}/branch-requests/my-branch`, {
      headers: authHeaders(branchSession.token)
    })).json();
    const matchingReqAfter = branchReqsAfter.find(r => r.id === matchingReq.id);
    assert(matchingReqAfter.department === initialBranchDept, 'Branch request department is strictly independent of item category edits');

    console.log('\n======================================================');
    console.log(`TOTAL CHECKS: ${passed + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log('======================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
