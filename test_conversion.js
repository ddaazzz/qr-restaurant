// Test the conversion logic

const ACCESS_RIGHTS_MAP = {
  1: { name: 'orders', label: 'Orders', navId: 'orders-nav-btn' },
  2: { name: 'tables', label: 'Tables', navId: 'tables-nav-btn' },
  3: { name: 'reports', label: 'Reports', navId: 'reports-nav-btn' },
  4: { name: 'staff', label: 'Staff', navId: 'staff-nav-btn' },
  5: { name: 'settings', label: 'Settings', navId: 'settings-nav-btn' },
  6: { name: 'bookings', label: 'Bookings', navId: 'bookings-nav-btn' },
};

// Simulate server response with all 6 access rights
const data = {
  access_rights: ['orders', 'tables', 'reports', 'staff', 'settings', 'bookings']
};

console.log("📋 Raw access rights from server:", data.access_rights);

// Convert string access rights to numeric IDs
let rawAccessRights = data.access_rights || [];
console.log("📋 ACCESS_RIGHTS_MAP:", ACCESS_RIGHTS_MAP);

let staffAccessRights = [];
if (Array.isArray(rawAccessRights)) {
  staffAccessRights = rawAccessRights.map(right => {
    console.log(`  Converting: "${right}" (type: ${typeof right})`);
    // If it's a string (e.g., 'orders'), convert to numeric ID
    if (typeof right === 'string') {
      for (const [id, config] of Object.entries(ACCESS_RIGHTS_MAP)) {
        if (config.name === right) {
          console.log(`    ✅ Found match: "${right}" -> ID ${id}`);
          return parseInt(id, 10);
        }
      }
      console.log(`    ❌ No match found for "${right}"`);
      return NaN;
    }
    // If it's already a number, keep it
    const numId = parseInt(right, 10);
    console.log(`    Already number: ${numId}`);
    return numId;
  }).filter(id => !isNaN(id)); // Remove any invalid IDs
  console.log("📋 Converted staffAccessRights:", staffAccessRights);
} else {
  staffAccessRights = [];
}

console.log("\n✅ Final staffAccessRights:", staffAccessRights);

// Test hasAccessRight function
function hasAccessRight(featureId) {
  if (!staffAccessRights) return false;
  if (Array.isArray(staffAccessRights)) {
    return staffAccessRights.includes(featureId);
  }
  return false;
}

console.log("\nTesting hasAccessRight function:");
for (let i = 1; i <= 6; i++) {
  console.log(`  hasAccessRight(${i}): ${hasAccessRight(i)}`);
}
