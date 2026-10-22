// Unified API client for Annamithra with Supabase PostgreSQL backend integration

const TOKEN_KEY = 'annamithra_token';
const USER_KEY = 'annamithra_user';

export const getStoredAuth = () => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    const user = userStr ? JSON.parse(userStr) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

export const setStoredAuth = (token, user) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);

  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
};

export const clearStoredAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// Base URL for the Spring Boot backend on Render
// Configured via Vite environment variable VITE_API_BASE_URL (e.g. https://annamithra-api.onrender.com)
// In local development without this variable, defaults to '' to leverage the Vite dev server proxy
const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();
const CLEAN_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

export function getFullUrl(endpoint) {
  if (!endpoint) return '';

  // Return full URL if already absolute
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  // Ensure leading slash
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (!CLEAN_BASE_URL) {
    // Relative path for local development proxy
    return path;
  }

  // Prevent accidental /api duplication if base URL already ends with /api
  if (CLEAN_BASE_URL.endsWith('/api') && path.startsWith('/api/')) {
    return `${CLEAN_BASE_URL}${path.substring(4)}`;
  }

  return `${CLEAN_BASE_URL}${path}`;
}

async function request(endpoint, options = {}) {
  const url = getFullUrl(endpoint);
  const { token } = getStoredAuth();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = `Server error (${response.status})`;
    try {
      const errJson = await response.json();
      errorMsg = errJson.message || errJson.error || errorMsg;
    } catch {
      // not JSON
    }
    const err = new Error(errorMsg);
    err.status = response.status;
    throw err;
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

export const api = {
  // Auth
  login: async (username, password, role) => {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });
    setStoredAuth(data.token, data);
    return data;
  },

  getMe: () => request('/api/auth/me'),

  logout: () => {
    clearStoredAuth();
  },

  checkHealth: () => request('/api/health'),

  // Catalog & Inventory
  getItems: () => request('/api/items'),
  createItem: (itemData) => request('/api/items', {
    method: 'POST',
    body: JSON.stringify(itemData)
  }),
  receiveDirectGoods: (receiptData) => request('/api/inventory/receive', {
    method: 'POST',
    body: JSON.stringify(receiptData)
  }),
  addDirectStock: (stockData) => request('/api/inventory/add-direct-stock', {
    method: 'POST',
    body: JSON.stringify(stockData)
  }),
  getCentralInventory: () => request('/api/inventory'),
  getCentralInventoryTransactions: (date, item, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (item) params.append('item', item);
    const qs = params.toString();
    return request(`/api/inventory/transactions${qs ? `?${qs}` : ''}`);
  },

  // Branches
  getBranches: () => request('/api/branches'),
  createBranch: (branchData) => request('/api/branches', {
    method: 'POST',
    body: JSON.stringify(branchData)
  }),
  getBranchManagers: () => request('/api/branches/managers'),

  // Organisation Admin Purchase Orders
  createOrgNewItemsOrder: (items) => request('/api/purchase-orders/new-items', {
    method: 'POST',
    body: JSON.stringify({ items })
  }),
  getOrgNewItemOrders: (date, search, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (search) params.append('search', search);
    const qs = params.toString();
    return request(`/api/purchase-orders/org-new-items${qs ? `?${qs}` : ''}`);
  },
  getOrgRequestedOrders: () => request('/api/purchase-orders/requested'),
  markOrderAsOrdered: (orderId) => request(`/api/purchase-orders/${orderId}/ordered`, {
    method: 'PATCH'
  }),
  getPurchaseOrderHistory: (date, search, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (search) params.append('search', search);
    const qs = params.toString();
    return request(`/api/purchase-orders/history${qs ? `?${qs}` : ''}`);
  },

  // Store Manager Purchase Orders & Goods Receiving
  getStoreOrdersView: (date, search, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (search) params.append('search', search);
    const qs = params.toString();
    return request(`/api/purchase-orders/store-view${qs ? `?${qs}` : ''}`);
  },
  getOrdersForReceiving: (date, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    const qs = params.toString();
    return request(`/api/purchase-orders/ordered-for-entry${qs ? `?${qs}` : ''}`);
  },
  receiveOrderGoods: (orderId, receivedQty) => request(`/api/purchase-orders/${orderId}/receive`, {
    method: 'POST',
    body: JSON.stringify({ receivedQty })
  }),
  getOrderReceipts: (orderId) => request(`/api/purchase-orders/${orderId}/receipts`),
  getOrderReceiptsByOrderNumber: (orderNumber) => request(`/api/purchase-orders/by-order-number/${encodeURIComponent(orderNumber)}/receipts`),
  getConsolidatedRequirements: (date) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    const qs = params.toString();
    return request(`/api/branch-requests/consolidated${qs ? `?${qs}` : ''}`);
  },
  sendStoreOrder: (items) => request('/api/purchase-orders/store-order', {
    method: 'POST',
    body: JSON.stringify({ items })
  }),
  getPreviousOrders: (date, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    const qs = params.toString();
    return request(`/api/purchase-orders/previous-orders${qs ? `?${qs}` : ''}`);
  },
  getAlreadyOrderedToday: (date) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    const qs = params.toString();
    return request(`/api/purchase-orders/already-ordered-today${qs ? `?${qs}` : ''}`);
  },
  getOrderByOrderNumber: (orderNumber) => request(`/api/purchase-orders/by-order-number/${encodeURIComponent(orderNumber)}`),
  getRequestedOrdersGrouped: (date, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    const qs = params.toString();
    return request(`/api/purchase-orders/requested-groups${qs ? `?${qs}` : ''}`);
  },
  markOrderByOrderNumberAsOrdered: (orderNumber) => request(`/api/purchase-orders/by-order-number/${encodeURIComponent(orderNumber)}/ordered`, {
    method: 'PATCH'
  }),
  getOrderDraft: () => request('/api/purchase-orders/draft'),
  saveOrderDraft: (lines) => request('/api/purchase-orders/draft', {
    method: 'POST',
    body: JSON.stringify(lines)
  }),
  clearOrderDraft: () => request('/api/purchase-orders/draft', {
    method: 'DELETE'
  }),

  // Branch Requests (Store Manager view & Branch Manager submit)
  getBranchRequests: (branch, date, fromDate, toDate, category) => {
    const params = new URLSearchParams();
    if (branch) params.append('branch', branch);
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (category && category !== 'ALL') params.append('category', category);
    const qs = params.toString();
    return request(`/api/branch-requests${qs ? `?${qs}` : ''}`);
  },
  getOutstandingBranchRequests: (branch, date) => {
    const params = new URLSearchParams();
    if (branch) params.append('branch', branch);
    if (date) params.append('date', date);
    const qs = params.toString();
    return request(`/api/branch-requests/outstanding${qs ? `?${qs}` : ''}`);
  },
  getRawBranchRequests: (branch, date, fromDate, toDate, category) => {
    const params = new URLSearchParams();
    if (branch) params.append('branch', branch);
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (category && category !== 'ALL') params.append('category', category);
    const qs = params.toString();
    return request(`/api/branch-requests/raw${qs ? `?${qs}` : ''}`);
  },
  submitBranchRequest: (items) => request('/api/branch-requests', {
    method: 'POST',
    body: JSON.stringify({ items })
  }),
  getMyBranchRequests: (date, fromDate, toDate, category) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (category && category !== 'ALL') params.append('category', category);
    const qs = params.toString();
    return request(`/api/branch-requests/my-branch${qs ? `?${qs}` : ''}`);
  },

  // Branch Order Drafts
  saveBranchDraft: (draftName, items) => request('/api/branch-drafts', {
    method: 'POST',
    body: JSON.stringify({ draftName, items })
  }),
  getBranchDrafts: (branch) => {
    const params = new URLSearchParams();
    if (branch) params.append('branch', branch);
    const qs = params.toString();
    return request(`/api/branch-drafts${qs ? `?${qs}` : ''}`);
  },
  getBranchDraft: (id) => request(`/api/branch-drafts/${id}`),
  updateBranchDraft: (id, draftName, items) => request(`/api/branch-drafts/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ draftName, items })
  }),
  deleteBranchDraft: (id) => request(`/api/branch-drafts/${id}`, {
    method: 'DELETE'
  }),
  markBranchDraftMoved: (id) => request(`/api/branch-drafts/${id}/move`, {
    method: 'POST'
  }),

  // Dispatches & Acknowledgements
  dispatchItems: (branchName, items) => request('/api/dispatches/prepare', {
    method: 'POST',
    body: JSON.stringify({ branchName, items })
  }),
  getStoreDispatchHistory: (branch, date, search, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (branch) params.append('branch', branch);
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (search) params.append('search', search);
    const qs = params.toString();
    return request(`/api/dispatches/history${qs ? `?${qs}` : ''}`);
  },
  getMyBranchDeliveries: (date, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    const qs = params.toString();
    return request(`/api/dispatches/my-branch${qs ? `?${qs}` : ''}`);
  },
  acknowledgeDelivery: (dispatchId, actualReceivedQty, remarks) => request(`/api/dispatches/${dispatchId}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({
      actualReceivedQty: actualReceivedQty !== undefined && actualReceivedQty !== null ? Number(actualReceivedQty) : undefined,
      remarks: remarks || ''
    })
  }),
  returnDelivery: (dispatchId, returnQty, reason) => request(`/api/dispatches/${dispatchId}/return`, {
    method: 'POST',
    body: JSON.stringify({ returnQty: Number(returnQty), reason })
  }),
  getDispatchReturns: (dispatchId) => request(`/api/dispatches/${dispatchId}/returns`),
  getAllReturns: (branch) => request(`/api/dispatches/returns${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`),
  getMyBranchReceivedHistory: (date, search, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (search) params.append('search', search);
    const qs = params.toString();
    return request(`/api/dispatches/my-branch/history${qs ? `?${qs}` : ''}`);
  },

  // Operational Reports (Store Manager)
  getReportSummary: ({ fromDate, toDate } = {}) => {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    const qs = params.toString();
    return request(`/api/reports/summary${qs ? `?${qs}` : ''}`);
  },
  getCentralInventoryReport: (search) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    const qs = params.toString();
    return request(`/api/reports/central-inventory${qs ? `?${qs}` : ''}`);
  },
  getPurchaseOrderReport: ({ date, fromDate, toDate, search, status } = {}) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (search) params.append('search', search);
    if (status && status !== 'ALL') params.append('status', status);
    const qs = params.toString();
    return request(`/api/reports/purchase-orders${qs ? `?${qs}` : ''}`);
  },
  getInventoryEntryReport: ({ date, fromDate, toDate, search } = {}) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (search) params.append('search', search);
    const qs = params.toString();
    return request(`/api/reports/inventory-entries${qs ? `?${qs}` : ''}`);
  },
  getBranchRequestReport: ({ fromDate, toDate, branch, search, status, category } = {}) => {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (branch && branch !== 'ALL') params.append('branch', branch);
    if (search) params.append('search', search);
    if (status && status !== 'ALL') params.append('status', status);
    if (category && category !== 'ALL') params.append('category', category);
    const qs = params.toString();
    return request(`/api/reports/branch-requests${qs ? `?${qs}` : ''}`);
  },
  getBranchDispatchReport: ({ date, fromDate, toDate, branch, search, status, category } = {}) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (branch && branch !== 'ALL') params.append('branch', branch);
    if (search) params.append('search', search);
    if (status && status !== 'ALL') params.append('status', status);
    if (category && category !== 'ALL') params.append('category', category);
    const qs = params.toString();
    return request(`/api/reports/dispatches${qs ? `?${qs}` : ''}`);
  },

  // Master Admin
  getMasterOrganisations: (search) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return request(`/api/master/organisations${qs}`);
  },
  getMasterOrganisationById: (id) => request(`/api/master/organisations/${id}`),
  createOrganisation: (orgData) => request('/api/master/organisations', {
    method: 'POST',
    body: JSON.stringify(orgData)
  }),
  setOrganisationStatus: (id, status) => request(`/api/master/organisations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),

  // Organisation Admin - Organisation & Store Manager Management
  getMyOrganisation: () => request('/api/organisation/my-organisation'),
  getStoreManager: () => request('/api/organisation/store-manager'),
  saveStoreManager: (managerData) => request('/api/organisation/store-manager', {
    method: 'POST',
    body: JSON.stringify(managerData)
  })
};
