# Console.log Cleanup - Implementation Code Templates

## Quick Start Pattern

For each file, add this at the top:
```javascript
const DEBUG = false; // Set to true during development, false in production
```

Then wrap debug logs like this:
```javascript
if (DEBUG) console.log("Message");
```

---

## File-by-File Implementation Examples

### 1. admin.js - Template Example

**Current code (lines 77-84):**
```javascript
  const elementsToTranslate = document.querySelectorAll('[data-i18n]');
  elementsToTranslate.forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = t(key);
  });
  console.log('[admin.js] Re-translated', elements.length, 'elements in', currentLang);
```

**After modification:**
```javascript
const DEBUG = false; // Add at top of file

// Then in functions:
if (DEBUG) console.log('[admin.js] Re-translated', elements.length, 'elements in', currentLang);
```

**Lines to modify in admin.js:**
```
Add at top (line 1):
const DEBUG = false;

Then wrap these lines with if(DEBUG):
- Line 78: if (DEBUG) console.log('[admin.js] Re-translated...
- Line 84: if (DEBUG) console.log('[admin.js] Module loaded...
- Line 89: if (DEBUG) console.warn('[admin.js] setLanguage function not available yet');
- Line 193: if (DEBUG) console.log("🔵 Loading STAFF section");
- Line 200-201: if (DEBUG) console.log(...);
- Line 205-221: All the "Fetching" and "Loading" logs
- Line 256-285: All Reports section logs
- Line 429: if (DEBUG) console.log('✅ Restaurant timezone loaded...

KEEP (no change needed):
- Line 28: console.error (error handling)
- Line 31-32: console.warn (role validation)
- Line 165: console.error (HTML loading error)
- Line 186: console.error (HTML loading error)
- Line 214: console.error (error handling)
- Line 235: console.error (error handling)
- Lines 249, 305, 316, 320: console.error (error handling)
- Line 436: console.error (app loading error)
- Lines 846-847: console.warn (role check)
- Lines 870, 875: console.error/log for database operations
```

---

### 2. staff.js - Template Example

**Lines to modify:**
```
Add at top (line 1):
const DEBUG = false;

Wrap with if(DEBUG):
- Line 65: if (DEBUG) console.log("🧑‍💼 Staff portal - checking...
- Line 82: if (DEBUG) console.log("📍 PIN updated...
- Line 89: if (DEBUG) console.log("🗑️ PIN cleared");
- Line 102: if (DEBUG) console.log("📊 PIN display updated...
- Line 111: if (DEBUG) console.log("🔐 Submitting PIN...
- Lines 146-177: All the access rights conversion logs (multiple if (DEBUG))
- Lines 200-201: if (DEBUG) console.log(...);
- Lines 214-216: if (DEBUG) console.log(...);
- Lines 232-235: if (DEBUG) console.log(...);
- Lines 264, 266: if (DEBUG) console.log(...);
- Lines 272-347: All HTML fetch logs (many if (DEBUG))
- Line 370: if (DEBUG) console.log("✅ Tables loaded...
- Lines 408, 420: if (DEBUG) console.log(...);
- Line 434: if (DEBUG) console.log("✅ Staff role validated...
- Line 469: if (DEBUG) console.log("✅ Restaurant timezone loaded...

KEEP (no if (DEBUG)):
- Line 69: console.warn("❌ No restaurantId...
- Line 96: console.warn("❌ PIN dots container not found...
- Line 107: console.warn("⚠️ PIN length is...
- Lines 192, 281, etc: console.error ("Failed to fetch...
- Lines 427-428: console.warn (role validation)
- Line 441: console.warn (missing restaurantId)
- Line 447: console.warn (missing token)
- Line 457: console.warn (HTTP error)
- Line 471: console.warn (timezone load error)
```

**Code block example:**
```javascript
const DEBUG = false; // Add at very top

// Example wrap in PIN submission function:
function submitPin() {
  const pin = Array.from(document.querySelectorAll(".pin-dot.filled")).length;
  if (DEBUG) console.log("📍 PIN updated:", pin.length, "digits");
  
  if (pin.length !== 6) {
    if (DEBUG) console.warn("⚠️ PIN length is", pin.length, "- need exactly 6 digits");
    return;
  }
  
  if (DEBUG) console.log("🔐 Submitting PIN for restaurant:", window.restaurantId);
  // ... rest of code
}
```

---

### 3. admin-tables.js - Template Example

**Lines to modify:**
```
Add at top (line 1):
const DEBUG = false;

Wrap with if(DEBUG):
- Line 553: if (DEBUG) console.log(`📝 Creating table...
- Line 572: if (DEBUG) console.log("✅ Table created...

KEEP (no if (DEBUG)):
- Line 65: console.warn("tables-category-tabs element not found");
- Line 349: console.warn("tables-grid element not found");
- Line 429: console.warn('Invalid date...
- Line 541: console.error("❌ Invalid categoryId...
- Line 567: console.error("❌ Server error...
- Line 575: console.error("❌ Error creating table...
- Lines 702, 775, 814, 831, 1015: console.error (all loading errors)
```

---

### 4. menu.js - Template Example

**Lines to modify:**
```
Add at top (line 1):
const DEBUG = false;

Wrap with if(DEBUG):
- Line 71: if (DEBUG) console.log('[Menu] Applying restaurant language preference...
- Line 84: if (DEBUG) console.log("Session data:", session, "Pax value:", session.pax);
- Lines 93, 105, 109, 129: if (DEBUG) console.log("Logo URL set to...".. etc
- Line 258: if (DEBUG) console.log(menu);
- Line 517: if (DEBUG) console.log("Loaded cart from storage:", cart);
- Line 710: if (DEBUG) console.log("📡 Fetching orders from:", url);
- Line 713: if (DEBUG) console.log("📥 Response status:", res.status);
- Line 721: if (DEBUG) console.log("✅ Orders loaded:", data);
- Line 735: if (DEBUG) console.log("✅ renderOrdersDrawer called...
- Line 753: if (DEBUG) console.log(`📦 Order ${oIdx}:`, order);

KEEP (no if (DEBUG)):
- Line 276: console.warn(`[Menu] Item "${item.name}"...
- Line 315: console.warn(`[Menu Drawer] Item...
- Line 284, 323: onerror handlers with console.warn
- Line 508: console.error("Failed to save cart:", e);
- Line 520: console.error("Failed to load cart:", e);
- Line 704: console.warn("❌ loadOrderStatus: No sessionId");
- Line 716: console.warn("❌ API returned:", res.status, res.statusText);
- Line 724: console.error("❌ Error loading orders:", error);
- Line 731: console.error("❌ orders-drawer-content element not found");
- Line 1163: console.error("Error applying coupon:", error);
- Line 1181: console.error("Error removing coupon:", error);
- Lines 1187, 1192: console.error("❌ No session/restaurant ID...
- Line 1197: if (DEBUG) console.log("📡 Requesting bill closure... (optional DEBUG)
- Lines 1211, 1216: console.error/log (bill closure)
- Line 1229: console.error("❌ Error closing bill:", error);
- Line 1321: console.error("Error printing bill:", error);
```

---

### 5. kitchen.js - Template Example

**Lines to modify:**
```
Add at top (line 1):
const DEBUG = false;

Wrap with if(DEBUG):
- Line 24: if (DEBUG) console.log("🍳 Kitchen initialized...
- Line 117: if (DEBUG) console.log("📡 Fetching kitchen orders from:", url);
- Line 120: if (DEBUG) console.log("📊 Response status:", res.status, res.statusText);
- Line 129: if (DEBUG) console.log("✅ Loaded", items.length, "kitchen items");

KEEP (no if (DEBUG)):
- Line 27: console.warn("⚠️ No restaurantId found...
- Line 102: console.error(err);
- Line 111: console.warn("⚠️ restaurantId is not set...
- Line 124: console.error("❌ Failed to load...
- Line 158: console.error("❌ Failed to load...
- Lines 249, 266: console.error("Failed to update item status...
- Line 289: console.error("Error logging logout...
- Lines 314, 318: console.log (can optionally move to DEBUG)
```

---

### 6. admin-settings.js - Template Example

**Lines to modify:**
```
Add at top (line 1):
const DEBUG = false;

Wrap with if(DEBUG):
- Line 27: if (DEBUG) console.log('[Settings] Applying restaurant language preference...
- Line 49: if (DEBUG) console.log('[Settings] Language preference saved locally...
- Line 64: if (DEBUG) console.log('[Settings] Language preference saved to backend...
- Line 208: if (DEBUG) console.log('Staff login links loaded:', { staffLink, kitchenLink });

KEEP (no if (DEBUG)):
- Line 34: console.error("Failed to initialize settings on page load:", err);
- Line 60: console.warn('[Settings] Backend language save failed...
- Line 68: console.warn('[Settings] Backend language save error...
- Line 71: console.error('Failed to save language preference:', err);
- All other console.error and console.warn statements (lines 151+)
```

---

### 7. translations.js - Template Example

**Lines to modify:**
```
Add at top (line 1):
const DEBUG = false;

Wrap with if(DEBUG):
- Line 3465: if (DEBUG) console.log('[Translations] t("' + key + '")...
- Line 3471: if (DEBUG) console.log('[Translations] Setting language to:', lang);
- Line 3479: if (DEBUG) console.log('[Translations] Found', translatableElements.length...
- Line 3486: if (DEBUG) console.log('[Translations] Updated:', key, '→', newText);
- Line 3507: if (DEBUG) console.log('[Translations] Activated language button...
- Line 3514: if (DEBUG) console.log('[Translations] Language changed event dispatched');
- Line 3529: if (DEBUG) console.log('[Translations] Language preference saved to database...
- Line 3546: if (DEBUG) console.log('[Translations] Current language:', lang);

KEEP (no if (DEBUG)):
- Line 3532: console.warn('[Translations] Failed to save language preference...
```

---

### 8. language-switcher.js - Template Example

**Lines to modify:**
```
Add at top (line 1):
const DEBUG = false;

Wrap with if(DEBUG):
- Line 181: if (DEBUG) console.log('[LanguageSwitcher] Translating', elementsToTranslate.length, 'elements');
- Line 192: if (DEBUG) console.log('[LanguageSwitcher] DOM loaded, initializing...');
- Line 196: if (DEBUG) console.log('[LanguageSwitcher] DOM already loaded, initializing...');

KEEP (no if (DEBUG)):
- Line 17: console.warn('[LanguageSwitcher] Language picker element not found');
- Line 74: console.error('[LanguageSwitcher] Toggle button not found');
```

---

### 9. home.js - Template Example

**Lines to modify:**
```
Add at top (line 1):
const DEBUG = false;

Wrap with if(DEBUG):
- Line 201: if (DEBUG) console.log('[Home] Language changed, re-translating...');

KEEP (no if (DEBUG)):
- Line 134: console.error('Error submitting form:', error);
- Line 176: console.log('✅ Waitlist submission successful:', result); (can optionally wrap)
- Line 182: console.error('❌ Error submitting waitlist:', error);
```

---

### 10. mobile-menu.js - Template Example

**Lines to modify:**
```
Add at top (line 1):
const DEBUG = false;

Wrap with if(DEBUG):
- Line 23: if (DEBUG) console.log('Menu toggled - navLinks active class...
- Line 24: if (DEBUG) console.log('navLinks max-height...
- Line 39: if (DEBUG) console.log('Dropdown toggled...
```

---

### 11. timezone-utils.js - Keep All

No modifications needed - all 3 console statements are error handling:
```javascript
// Line 85 - KEEP
console.error('Timezone formatting error:', err, 'timezone:', timezone);

// Line 110 - KEEP
console.error('Elapsed time calculation error:', err);

// Line 207 - KEEP
console.error('Error calculating elapsed time:', err);
```

---

## Automated Script (Optional)

If you want to automate this, here's a regex pattern to find all console statements:

```regex
Find:    console\.(log|warn|info)\(
Replace: if (DEBUG) console\.$1(
```

**But carefully review each match** to ensure you don't wrap error handling logs.

---

## Quality Checklist

After implementing:

- [ ] Added `const DEBUG = false;` at the top of each file
- [ ] All emoji-prefixed logs wrapped with `if (DEBUG)`
- [ ] All "Loading", "Fetching", "Success" messages wrapped with `if (DEBUG)`
- [ ] All `console.error()` calls REMAIN UNCHANGED
- [ ] All `console.warn()` for DOM validation REMAIN UNCHANGED
- [ ] All permission/access validation logs REMAIN UNCHANGED or marked as VALIDATION
- [ ] Tested in development with `DEBUG = true`
- [ ] Tested in production with `DEBUG = false`
- [ ] Bundle size verified (should reduce by ~2-3%)

---

## Testing Commands

In browser console, while on any page:

```javascript
// Test 1: Verify DEBUG flag exists
DEBUG  // Should return false (or true in dev)

// Test 2: Run with DEBUG enabled
DEBUG = true;  // Now all debug logs appear

// Test 3: Go back to production
DEBUG = false; // Debug logs hidden again
```

---

## Production Deployment Checklist

```
Before deploying to production:
✓ All files have const DEBUG = false; at top
✓ All debug logs wrapped with if (DEBUG)
✓ No credentials in any console statements
✓ Error handling logs preserved
✓ Validation logs preserved
✓ Build process verified (no syntax errors)
✓ Browser console clean in production mode
✓ Performance/bundle size improvements verified
```

