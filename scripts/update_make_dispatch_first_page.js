const fs = require('fs');
const path = require('path');

// ==========================================
// 1. UPDATE main.jsx
// ==========================================
const mainPath = path.resolve(__dirname, '../frontend/src/main.jsx');
let mainCode = fs.readFileSync(mainPath, 'utf8').replace(/\r\n/g, '\n');

// Update initial state of activeTab
const oldActiveTabState = `  const [activeTab, setActiveTab] = useState('branches');`;
const newActiveTabState = `  const [activeTab, setActiveTab] = useState(() => {
    const stored = getStoredAuth();
    if (stored?.user?.role === 'Store Manager') return 'branch-requests';
    if (stored?.user?.role === 'Master Admin') return 'organisations';
    if (stored?.user?.role === 'Branch Manager') return 'order-items';
    return 'branches';
  });`;

if (!mainCode.includes(oldActiveTabState)) {
  throw new Error('main.jsx: oldActiveTabState not found');
}
mainCode = mainCode.replace(oldActiveTabState, newActiveTabState);
console.log('✓ main.jsx: activeTab default state updated.');

// Update role effect
const oldRoleEffect = `else if (auth.user.role === 'Store Manager') setActiveTab('central-inventory');`;
const newRoleEffect = `else if (auth.user.role === 'Store Manager') setActiveTab('branch-requests');`;

if (!mainCode.includes(oldRoleEffect)) {
  throw new Error('main.jsx: oldRoleEffect not found');
}
mainCode = mainCode.replace(oldRoleEffect, newRoleEffect);
console.log('✓ main.jsx: Store Manager default tab in role effect set to branch-requests.');

// Update handleLogin to explicitly set activeTab for Store Manager
const oldLoginSuccess = `      const loginData = await api.login(username.trim(), password, role);
      setAuth({ token: loginData.token, user: loginData });`;

const newLoginSuccess = `      const loginData = await api.login(username.trim(), password, role);
      setAuth({ token: loginData.token, user: loginData });
      if (loginData.role === 'Store Manager') {
        setActiveTab('branch-requests');
      }`;

if (!mainCode.includes(oldLoginSuccess)) {
  throw new Error('main.jsx: oldLoginSuccess not found');
}
mainCode = mainCode.replace(oldLoginSuccess, newLoginSuccess);
console.log('✓ main.jsx: handleLogin sets activeTab to branch-requests for Store Manager.');

fs.writeFileSync(mainPath, mainCode, 'utf8');
console.log('✓ Saved main.jsx successfully.');

// ==========================================
// 2. UPDATE TopNavbar.jsx
// ==========================================
const navPath = path.resolve(__dirname, '../frontend/src/components/TopNavbar.jsx');
let navCode = fs.readFileSync(navPath, 'utf8').replace(/\r\n/g, '\n');

const oldStoreNav = `      case 'Store Manager':
        return [
          { id: 'central-inventory', label: t('Central Inventory'), icon: '📦' },
          { id: 'entry-items', label: t('Entry Items'), icon: '📥' },
          { id: 'branch-requests', label: t('Branch Requests'), icon: '🚚' },
          { id: 'order', label: t('Order'), icon: '📋' },
          { id: 'reports', label: t('Reports'), icon: '📊' }
        ];`;

const newStoreNav = `      case 'Store Manager':
        return [
          { id: 'branch-requests', label: t('dispatch', 'Dispatch'), icon: '🚚' },
          { id: 'central-inventory', label: t('Central Inventory'), icon: '📦' },
          { id: 'entry-items', label: t('Entry Items'), icon: '📥' },
          { id: 'order', label: t('Order'), icon: '📋' },
          { id: 'reports', label: t('Reports'), icon: '📊' }
        ];`;

if (!navCode.includes(oldStoreNav)) {
  throw new Error('TopNavbar.jsx: oldStoreNav not found');
}
navCode = navCode.replace(oldStoreNav, newStoreNav);
console.log('✓ TopNavbar.jsx: Store Manager nav updated (Dispatch is first tab).');

fs.writeFileSync(navPath, navCode, 'utf8');
console.log('✓ Saved TopNavbar.jsx successfully.');

// ==========================================
// 3. UPDATE StorePortal.jsx (Remove Recent Dispatches)
// ==========================================
const storePath = path.resolve(__dirname, '../frontend/src/portals/StorePortal.jsx');
let storeCode = fs.readFileSync(storePath, 'utf8').replace(/\r\n/g, '\n');

const recentDispatchesRegex = /\n\s*{\/\* RECENT DISPATCHES HISTORY ACCORDION\/SECTION FOR THIS BRANCH \*\/}[\s\S]*?<\/table>\s*<\/div>\s*\)\}\s*<\/div>/;

if (!recentDispatchesRegex.test(storeCode)) {
  throw new Error('StorePortal.jsx: Recent Dispatches section not found by regex');
}

storeCode = storeCode.replace(recentDispatchesRegex, '');
console.log('✓ StorePortal.jsx: Recent Dispatches section removed from branch cards.');

fs.writeFileSync(storePath, storeCode, 'utf8');
console.log('✓ Saved StorePortal.jsx successfully.');

console.log('ALL UPDATES COMPLETE!');
