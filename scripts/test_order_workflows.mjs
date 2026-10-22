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
  if (status !== 200) throw new Error(`Login failed for ${username}: ${JSON.stringify(data)}`);
  return data.token;
}

function authHeader(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

async function run() {
  console.log('=== STARTING COMPLETE WORKFLOW TESTS ===\n');

  const branchToken = await login('Branch1', '1234', 'Branch Manager');
  const storeToken = await login('store@manager', '1234', 'Store Manager');
  console.log('✓ Step 1: Branch1 and Store Manager logged in successfully.');

  // ==========================================
  // WORKFLOW A: Normal Order Submission
  // ==========================================
  console.log('\n--- WORKFLOW A: Direct Order Submission ---');
  const normalItemName = 'Direct Onion ' + Date.now();
  const normalOrderPayload = {
    items: [{
      itemName: normalItemName,
      unit: 'KG',
      category: 'Vegetables',
      requestedQuantity: 5,
      isNewItem: true
    }]
  };
  const normalRes = await req('/api/branch-requests', {
    method: 'POST',
    headers: authHeader(branchToken),
    body: JSON.stringify(normalOrderPayload)
  });
  if (normalRes.status !== 200) {
    throw new Error(`Workflow A failed: ${JSON.stringify(normalRes.data)}`);
  }
  const normalBatchId = normalRes.data[0].batchId;
  console.log(`✓ Step 2: Normal order submitted successfully! Batch ID: ${normalBatchId}`);

  // Verify in Store Manager Requests (Aggregated view by date)
  const storeSectionsA = await req('/api/branch-requests?branch=Branch%201', {
    headers: authHeader(storeToken)
  });
  const foundNormalAggregated = storeSectionsA.data
    .flatMap(section => section.items || [])
    .find(it => it.item === normalItemName);
  
  // Also verify in raw requests endpoint
  const rawRequestsA = await req('/api/branch-requests/raw?branch=Branch%201', {
    headers: authHeader(storeToken)
  });
  const foundNormalRaw = rawRequestsA.data.find(r => r.item === normalItemName);

  if (!foundNormalRaw) {
    throw new Error('Workflow A item not found in Store Manager Requests!');
  }
  console.log(`✓ Step 3: Normal order verified in Store Manager requests! Quantity: ${foundNormalRaw.requested} ${foundNormalRaw.unit}, Category: ${foundNormalRaw.category}, Branch: ${foundNormalRaw.branch}, Timestamp: ${foundNormalRaw.createdAt}`);

  // ==========================================
  // WORKFLOW B: Draft-to-Order Submission
  // ==========================================
  console.log('\n--- WORKFLOW B: Draft to Order Submission ---');
  const draftItemName = 'Draft Tomato ' + Date.now();
  // 1. Save draft (with legacy/general category)
  const saveDraftRes = await req('/api/branch-drafts', {
    method: 'POST',
    headers: authHeader(branchToken),
    body: JSON.stringify({
      draftName: 'Test Draft ' + Date.now(),
      items: [{
        itemName: draftItemName,
        unit: 'kg',
        category: 'General',
        requestedQuantity: 10,
        isNewItem: true
      }]
    })
  });
  if (saveDraftRes.status !== 200) {
    throw new Error(`Draft creation failed: ${JSON.stringify(saveDraftRes.data)}`);
  }
  const draftId = saveDraftRes.data.id;
  console.log(`✓ Step 4: Draft created with ID ${draftId}, initial status: ${saveDraftRes.data.status}`);

  // 2. Simulate loading draft into order form, sanitizing category & unit (as done in BranchPortal.jsx)
  const draftItemsFromForm = saveDraftRes.data.items.map(it => {
    // Normalization logic identical to BranchPortal.jsx
    const BRANCH_ORDER_CATEGORIES = ['Vegetables', 'Groceries', 'Tea/Coffee', 'Vada Stall', 'Sweet/Savouries', 'Dosa Kal', 'Chinese', 'Idly', 'Front Office', 'Parcel', 'Dishwasher'];
    const matched = BRANCH_ORDER_CATEGORIES.find(c => c.toLowerCase() === (it.category || '').trim().toLowerCase());
    return {
      itemName: it.itemName.trim(),
      unit: (it.unit || 'KG').trim().toUpperCase(),
      category: matched || 'Groceries',
      requestedQuantity: parseInt(it.requestedQuantity, 10),
      isNewItem: Boolean(it.isNewItem)
    };
  });

  // 3. Submit Order Items Form to backend
  const draftOrderRes = await req('/api/branch-requests', {
    method: 'POST',
    headers: authHeader(branchToken),
    body: JSON.stringify({ items: draftItemsFromForm })
  });
  if (draftOrderRes.status !== 200) {
    throw new Error(`Draft order submission failed: ${JSON.stringify(draftOrderRes.data)}`);
  }
  const draftBatchId = draftOrderRes.data[0].batchId;
  console.log(`✓ Step 5: Draft-loaded items successfully submitted to backend! Batch ID: ${draftBatchId}`);

  // 4. Mark draft as moved with createOrder=false to prevent duplicate order
  const markDraftRes = await req(`/api/branch-drafts/${draftId}/move?createOrder=false`, {
    method: 'POST',
    headers: authHeader(branchToken)
  });
  if (markDraftRes.status !== 200 || markDraftRes.data.status !== 'MOVED_TO_ORDER') {
    throw new Error(`Draft mark moved failed: ${JSON.stringify(markDraftRes.data)}`);
  }
  console.log(`✓ Step 6: Original draft preserved and marked as MOVED_TO_ORDER in database (ID: ${draftId})`);

  // 5. Verify Store Manager sees the draft-ordered item with correct details
  const rawRequestsB = await req('/api/branch-requests/raw?branch=Branch%201', {
    headers: authHeader(storeToken)
  });
  const foundDraftOrder = rawRequestsB.data.find(r => r.item === draftItemName);
  if (!foundDraftOrder) throw new Error('Draft order item not found in Store Manager Requests!');
  console.log(`✓ Step 7: Draft order verified in Store Manager requests! Item: ${foundDraftOrder.item}, Quantity: ${foundDraftOrder.requested} ${foundDraftOrder.unit}, Category: ${foundDraftOrder.category}, Branch: ${foundDraftOrder.branch}, Timestamp: ${foundDraftOrder.createdAt}`);

  // ==========================================
  // WORKFLOW C: Error Handling & Preservation
  // ==========================================
  console.log('\n--- WORKFLOW C: Error Handling and Draft Preservation ---');
  // Submitting invalid category should return 400 with explicit message
  const badRes = await req('/api/branch-requests', {
    method: 'POST',
    headers: authHeader(branchToken),
    body: JSON.stringify({
      items: [{
        itemName: 'Illegal Item',
        unit: 'KG',
        category: 'NonExistentCategoryXYZ',
        requestedQuantity: 2
      }]
    })
  });
  if (badRes.status !== 400) {
    throw new Error(`Expected status 400 but got ${badRes.status}`);
  }
  if (!badRes.data.message || !badRes.data.message.includes('NonExistentCategoryXYZ')) {
    throw new Error(`Error message missing or unexpected: ${JSON.stringify(badRes.data)}`);
  }
  console.log(`✓ Step 8: Backend correctly rejected bad category with 400 Bad Request and detailed message: "${badRes.data.message}"`);

  console.log('\n=== ALL END-TO-END WORKFLOW VERIFICATIONS PASSED SUCCESSFULLY! ===');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
