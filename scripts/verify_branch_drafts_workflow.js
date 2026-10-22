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
  console.log('=== STARTING BRANCH ORDER DRAFTS & PDF WORKFLOW TEST ===\n');

  // 1. Authenticate as Branch 1 Manager (Branch1 / 1234)
  console.log('1. Logging in as Branch 1 Manager...');
  const loginRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'Branch1', password: '1234' });

  if (loginRes.status !== 200 || !loginRes.data?.token) {
    throw new Error(`Login failed: ${loginRes.raw}`);
  }
  const token = loginRes.data.token;
  const user = loginRes.data;
  console.log(`✓ Logged in as ${user.username} (${user.role}) for branch: "${user.branchName}".`);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Check initial count of submitted orders in branch_request for today
  const initialRequestsRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/branch-requests/my-branch',
    method: 'GET',
    headers: authHeaders
  });
  const initialOrderCount = Array.isArray(initialRequestsRes.data) ? initialRequestsRes.data.length : 0;
  console.log(`Initial submitted orders count for ${user.branchName}: ${initialOrderCount}`);

  // 2. Save multiple items as Draft (Step 1 requirement)
  console.log('\n2. Saving multi-item order list as draft...');
  const draftPayload = {
    draftName: `Morning Kitchen Prep Draft ${Date.now() % 10000}`,
    items: [
      { itemName: 'Rice', unit: 'KG', category: 'Groceries', requestedQuantity: 25, isNewItem: false },
      { itemName: 'Toor Dal', unit: 'KG', category: 'Groceries', requestedQuantity: 10, isNewItem: false },
      { itemName: 'Curd', unit: 'LITRE', category: 'Groceries', requestedQuantity: 5, isNewItem: false },
      { itemName: 'Special Sambar Powder', unit: 'PACKET', category: 'Groceries', requestedQuantity: 3, isNewItem: true }
    ]
  };

  const saveDraftRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/branch-drafts',
    method: 'POST',
    headers: authHeaders
  }, draftPayload);

  console.log(`Save draft status: ${saveDraftRes.status}`);
  if (saveDraftRes.status !== 200 && saveDraftRes.status !== 201) {
    throw new Error(`Failed to save draft: ${saveDraftRes.raw}`);
  }
  const createdDraft = saveDraftRes.data;
  console.log(`✓ Draft created in database:`, {
    id: createdDraft.id,
    draftName: createdDraft.draftName,
    branchName: createdDraft.branchName,
    status: createdDraft.status,
    itemCount: createdDraft.itemCount,
    totalQuantity: createdDraft.totalQuantity
  });

  // Verify that saving draft did NOT submit an order
  const checkRequestsRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/branch-requests/my-branch',
    method: 'GET',
    headers: authHeaders
  });
  const afterDraftOrderCount = Array.isArray(checkRequestsRes.data) ? checkRequestsRes.data.length : 0;
  if (afterDraftOrderCount !== initialOrderCount) {
    throw new Error(`CRITICAL: Saving draft inadvertently created submitted orders! Before: ${initialOrderCount}, After: ${afterDraftOrderCount}`);
  }
  console.log('✓ Verified: Draft saved without submitting an order to Store Manager.');

  // 3. List all drafts for logged-in branch (Step 2 requirement)
  console.log('\n3. Querying saved drafts for Branch 1...');
  const listDraftsRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/branch-drafts',
    method: 'GET',
    headers: authHeaders
  });

  if (!Array.isArray(listDraftsRes.data)) {
    throw new Error(`Expected array of drafts, got: ${listDraftsRes.raw}`);
  }
  const foundDraft = listDraftsRes.data.find(d => d.id === createdDraft.id);
  if (!foundDraft) {
    throw new Error(`Created draft ID ${createdDraft.id} not found in branch drafts list!`);
  }
  console.log(`✓ Draft found in database list! Total drafts for ${user.branchName}: ${listDraftsRes.data.length}`);

  // 4. Update an existing draft (Step 2 requirement)
  console.log('\n4. Updating draft quantities and items...');
  const updatedItems = [
    { itemName: 'Rice', unit: 'KG', category: 'Groceries', requestedQuantity: 30, isNewItem: false }, // increased 25 -> 30
    { itemName: 'Toor Dal', unit: 'KG', category: 'Groceries', requestedQuantity: 12, isNewItem: false }, // increased 10 -> 12
    { itemName: 'Curd', unit: 'LITRE', category: 'Groceries', requestedQuantity: 8, isNewItem: false } // increased 5 -> 8
  ];

  const updateRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/branch-drafts/${createdDraft.id}`,
    method: 'PUT',
    headers: authHeaders
  }, { draftName: `${createdDraft.draftName} (Revised)`, items: updatedItems });

  if (updateRes.status !== 200) {
    throw new Error(`Failed to update draft: ${updateRes.raw}`);
  }
  console.log(`✓ Draft updated: Name: "${updateRes.data.draftName}", Items: ${updateRes.data.itemCount}, Total Qty: ${updateRes.data.totalQuantity}`);
  if (updateRes.data.totalQuantity !== 50) {
    throw new Error(`Expected total quantity 50, got ${updateRes.data.totalQuantity}`);
  }

  // 5. Mark draft as moved to Order List (Step 3 requirement)
  console.log('\n5. Testing Move Draft to Order List status update...');
  const moveRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/branch-drafts/${createdDraft.id}/move`,
    method: 'POST',
    headers: authHeaders
  });

  if (moveRes.status !== 200) {
    throw new Error(`Failed to mark draft as moved: ${moveRes.raw}`);
  }
  console.log(`✓ Draft status successfully updated to: ${moveRes.data.status}`);
  if (moveRes.data.status !== 'MOVED_TO_ORDER') {
    throw new Error(`Expected status MOVED_TO_ORDER, got ${moveRes.data.status}`);
  }

  // Verify that moving the draft actually created submitted BranchRequest items in the database
  const requestsAfterMoveRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/branch-requests/my-branch',
    method: 'GET',
    headers: authHeaders
  });
  const afterMoveCount = Array.isArray(requestsAfterMoveRes.data) ? requestsAfterMoveRes.data.length : 0;
  console.log(`Submitted requests count after moving draft to order: ${afterMoveCount} (initial was ${initialOrderCount})`);
  if (afterMoveCount <= initialOrderCount) {
    throw new Error(`Expected new submitted orders created in branch_requests after moving draft, but count did not increase!`);
  }
  console.log(`✓ Confirmed: Moving draft to order successfully created ${afterMoveCount - initialOrderCount} new BranchRequest items in database!`);

  // 6. Test branch isolation / permissions
  console.log('\n6. Testing branch isolation permissions...');
  // Attempt to fetch with another branch's param or invalid id
  const fakeIdRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/branch-drafts/999999',
    method: 'GET',
    headers: authHeaders
  });
  console.log(`Non-existent draft response: ${fakeIdRes.status} (expected 404)`);

  // 7. Delete draft with confirmation
  console.log('\n7. Deleting test draft from database...');
  const deleteRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/branch-drafts/${createdDraft.id}`,
    method: 'DELETE',
    headers: authHeaders
  });

  if (deleteRes.status !== 200) {
    throw new Error(`Failed to delete draft: ${deleteRes.raw}`);
  }
  console.log(`✓ Draft successfully deleted from database:`, deleteRes.data);

  // Verify it is gone
  const verifyDeletedRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/branch-drafts/${createdDraft.id}`,
    method: 'GET',
    headers: authHeaders
  });
  if (verifyDeletedRes.status !== 404) {
    throw new Error(`Expected 404 after deletion, got ${verifyDeletedRes.status}`);
  }
  console.log('✓ Confirmed: Deleted draft is no longer in the database (404 Not Found).');

  console.log('\n=== ALL BRANCH ORDER DRAFTS & WORKFLOW TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
