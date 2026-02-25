# CSS Differences Analysis: admin-tables.css vs admin-orders.css

## Overview
- **admin-tables.css**: 1,709 lines - Manages table layouts, cards, and session panels
- **admin-orders.css**: 1,431 lines - Manages order menu, cart, and category navigation
- **Comparison**: Both use similar mobile sidebar patterns but have distinct purposes and structures

---

## 1. PRIMARY CONTAINER DIFFERENCES

### Tables Container (admin-tables.css)
```css
.tables-container {
  display: flex;
  flex-direction: column;
  gap: 12px;           /* HAS gap */
  margin-top: 0;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  align-items: stretch;
  position: relative;
  overflow: hidden;
}
```

### Orders Container (admin-orders.css)
```css
.orders-container {
  display: flex;
  flex-direction: column;
  gap: 0;              /* NO gap (0) */
  margin-top: 0;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  position: relative;
  overflow: hidden;
  height: calc(100vh - 140px);  /* EXPLICIT height */
}
```

**DIFFERENCE 1**: Orders container has explicit `height: calc(100vh - 140px)` while tables doesn't. Orders also has `gap: 0` instead of `gap: 12px`.

---

## 2. CATEGORY/TAB BAR NAMING AND STRUCTURE

### Tables (admin-tables.css)
- Uses `.table-tabs-bottom` class
- Desktop rule: `margin-top: auto` (pushes to bottom)
- No explicit `flex: 0 0 auto` on desktop

### Orders (admin-orders.css)
- Uses `.orders-category-tabs-bottom` class
- Desktop rule: explicit `flex: 0 0 auto` added
- Also has `.orders-category-bar` class (appears unused/duplicate)

**DIFFERENCE 2**: Orders explicitly sets `flex: 0 0 auto` while tables relies on `margin-top: auto` for bottom positioning.

---

## 3. SIDEBAR VISIBILITY DEFAULT STATE

### Tables Sidebar (admin-tables.css)
**No default `.table-tabs-bottom` styling before media query** - Only styled via media query at 768px breakpoint.

### Orders Sidebar (admin-orders.css)
```css
.orders-container .orders-category-sidebar {
  display: none;  /* EXPLICIT default hiding */
}
```

**DIFFERENCE 3**: Orders explicitly hides sidebar with `display: none` by default, while tables has no default sidebar class (only tab bar).

---

## 4. MOBILE SIDEBAR TRANSFORMATION

### Tables (768px media query)
```css
.table-tabs-bottom {
  position: fixed;
  left: 0;
  top: 70px;
  width: 100px;
  height: calc(100vh - 70px);
  flex-direction: column;
  margin: 0;
  border-top: none;
  border-right: 2px solid var(--border-color);
  border-bottom: none;
  flex-shrink: 0;
  background: var(--bg-white);
  z-index: 40;
  overflow-y: auto;
  pointer-events: auto;
}
```

### Orders (768px media query)
```css
.orders-container .orders-category-sidebar {
  display: flex;           /* TOGGLE: show on mobile */
  width: 100px;
  height: calc(100vh - 140px);  /* DIFFERENT HEIGHT */
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 70px;
  background: var(--bg-white);
  border-right: 2px solid var(--border-color);
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 40;
}
```

**DIFFERENCE 4**: 
- Tables: No display toggle (sidebar is tab bar that transforms)
- Orders: Uses `display: none` → `display: flex` toggle
- Orders height: `calc(100vh - 140px)` vs Tables: `calc(100vh - 70px)` (30px difference for cart bar)

---

## 5. MOBILE CONTAINER LEFT MARGIN

### Tables (768px)
```css
.tables-container {
  margin-left: 100px;  /* Accounts for fixed sidebar */
}
```

### Orders (768px)
```css
.orders-container {
  margin-left: 0px;    /* NO margin (but sidebar positioned differently) */
}

.orders-container .left-column-wrapper {
  margin-left: 0;      /* Also set to 0 */
}
```

**DIFFERENCE 5**: Tables uses `margin-left: 100px` on container, Orders uses `margin-left: 0px` but applies layout via other means (see Difference 6).

---

## 6. CONTENT POSITIONING FOR MOBILE

### Tables Grid (768px)
```css
#tables-grid {
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 12px 12px 12px 100px;  /* Left padding accounts for sidebar */
  margin-left: 0;
  width: 100%;
}
```

### Orders Grid (768px)
```css
#orders-menu-items {
  flex: 1;
  min-height: 0;
  width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
```

**DIFFERENCE 6**: 
- Tables: Uses left padding (`padding-left: 100px`) to avoid sidebar
- Orders: Relies on `.left-column-wrapper` positioning with `margin-left: 0` but content shifts via other container rules

---

## 7. RIGHT PANEL POSITIONING (MOBILE)

### Tables (No right panel equivalent in provided excerpt)
- Session panel uses `position: fixed` with `right: 0` and `width: 100%`

### Orders (768px)
```css
.orders-container .orders-right-panel {
  width: 100%;
  position: fixed;
  bottom: 48px;         /* Above cart bar */
  left: 100px;          /* Right of sidebar */
  right: 0;
  height: 0;
  max-height: 0;
  overflow: hidden;
  border-left: none;
  border-top: none;
  border-bottom: none;
  transition: max-height 0.3s ease;
  z-index: 30;
  background: white;
  padding: 0;
}

.orders-container .orders-right-panel.show-cart {
  max-height: calc(100vh - 188px);  /* 70px header + 48px cart bar + margins */
  border-top: 2px solid #e0e0e0;
  overflow-y: auto;
  padding: 12px;
}
```

**DIFFERENCE 7**: 
- Orders: Right panel uses animated `max-height: 0 → calc(100vh - 188px)` with `left: 100px` to account for sidebar
- Tables: Session panel slides from right (`transform: translateX(100%)`)

---

## 8. BOTTOM CART BAR (Mobile-only)

### Tables
- No equivalent `.orders-cart-bar` (session actions are inline)

### Orders (768px)
```css
.orders-cart-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: white;
  border-top: 2px solid var(--border-color);
  z-index: 35;
  display: flex;
}
```

**DIFFERENCE 8**: Orders has dedicated fixed bottom cart bar (48px height) on mobile. Tables doesn't have this.

---

## 9. DESKTOP LAYOUT STRUCTURE

### Tables
```css
.tables-container > .left-column-wrapper {
  display: flex;
  flex-direction: row;
  gap: 0;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  margin-top: 0;
  position: relative;
}
```

### Orders
```css
.orders-container > .left-column-wrapper {
  display: flex;
  flex-direction: row;
  gap: 0;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  margin-top: 0;
  position: relative;
}
```

**SIMILARITY**: Both use identical `.left-column-wrapper` structure, but orders also has a nested mobile-only margin-left rule.

---

## 10. CARD/ITEM SIZING DIFFERENCES

### Tables Card
```css
.table-card {
  aspect-ratio: 1;          /* Perfect square */
  min-height: 160px;
  max-width: 100%;
  width: 100%;
  gap: 0;
}

body.edit-mode .table-card {
  min-height: 220px;        /* Edit mode taller */
}
```

### Orders Card
```css
.orders-item-card {
  height: auto;             /* NOT fixed aspect ratio */
  min-height: 180px;        /* Taller than table card */
  display: flex;
  flex-direction: column;
  min-width: 0;
}
```

**DIFFERENCE 10**: 
- Tables: Square cards (`aspect-ratio: 1`, `160px` min)
- Orders: Flexible height cards (`auto`, `180px` min) suitable for image + text layout

---

## 11. ITEM IMAGE HEIGHTS

### Tables
- No `.table-card-image` class (tables use icons/numbers)

### Orders (Desktop)
```css
.orders-item-image {
  width: 100%;
  height: 120px;        /* Desktop height */
  background: #f5f5f5;
  object-fit: cover;
  display: block;
}
```

### Orders (Mobile 768px)
```css
.orders-item-image {
  height: 90px;         /* Smaller on mobile */
}
```

**DIFFERENCE 11**: Orders has responsive image heights (`120px` desktop → `90px` mobile). Tables has no equivalent.

---

## 12. GRID COLUMN COUNTS (MOBILE)

### Tables (768px & 480px)
```css
#tables-grid {
  grid-template-columns: repeat(2, 1fr);  /* ALWAYS 2 columns on mobile */
}
```

### Orders (768px)
```css
#orders-menu-items {
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));  /* RESPONSIVE */
}
```

**DIFFERENCE 12**: 
- Tables: Fixed 2-column grid on mobile
- Orders: Responsive auto-fit grid (4-5 items depending on 140px min-width)

---

## 13. SIDEBAR HEIGHT ON SMALL MOBILE (480px)

### Tables (480px)
```css
.table-tabs-bottom {
  width: 80px;                  /* NARROWER */
  top: 60px;                    /* Different top offset */
  height: calc(100vh - 60px);   /* Accounts for narrower header */
}
```

### Orders (480px)
```css
.orders-container .orders-category-sidebar {
  width: 80px;                  /* Same width */
  top: 60px;                    /* Same top offset */
  height: calc(100vh - 60px);   /* Same height */
}
```

**SIMILARITY**: Both use identical 480px breakpoint rules (80px width, 60px top).

---

## 14. BUTTON STYLING IN SIDEBARS

### Tables (768px)
```css
.table-tabs-bottom button {
  padding: 12px 8px;
  font-size: 11px;
  border-right: none;
  border-bottom: 1px solid var(--border-color);
  border-top: none;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  pointer-events: auto;
}
```

### Orders (Default state)
```css
.orders-category-sidebar button {
  padding: 12px 8px;
  border-radius: 0;
  border: none;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-white);
  color: var(--text-dark);
  font-weight: 600;
  font-family: 'Poppins', ...;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 11px;
  flex: 0 0 auto;
  text-align: center;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: normal;
  word-break: break-word;
  width: 100%;
}
```

**DIFFERENCE 14**: 
- Orders: More complete styling with `font-family`, `transition`, `flex`, `min-height`, `display: flex` alignment
- Tables: Minimal styling (assumes cascading from `.table-tabs-bottom button`)

---

## 15. GRID COLUMN DEFAULT (Desktop)

### Tables
```css
#tables-grid {
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));  /* 140px min */
}
```

### Orders
```css
#orders-menu-items {
  grid-template-columns: repeat(auto-fit, minmax(155px, 1fr));  /* 155px min (larger) */
}
```

**DIFFERENCE 15**: Orders uses larger column min-width (`155px` vs `140px`) for wider menu items.

---

## 16. MODAL/OVERLAY COMPLEXITY

### Tables
- `.session-panel` with `transform: translateX(100%)` for slide-in
- `.modal-overlay` basic styling

### Orders
- `.modal-overlay` extensive styling
- `.variant-slide-panel` with multiple nested elements (overlay, content, image, header, footer)
- `.variant-option-item` with checkbox/radio styling
- Complete form handling for variants

**DIFFERENCE 16**: Orders has much more complex modal/variant handling than tables.

---

## 17. EXPLICIT DISPLAY RULES

### Tables
- Relies on media queries for show/hide (no `.display: none` at desktop for sidebar)

### Orders
```css
.orders-container .orders-category-sidebar {
  display: none;        /* EXPLICIT desktop hide */
}

/* Then at 768px */
.orders-container .orders-category-sidebar {
  display: flex;        /* EXPLICIT mobile show */
}
```

**DIFFERENCE 17**: Orders uses explicit `display` property toggle, Tables doesn't have sidebar at desktop level.

---

## 18. HISTORY VIEW (Orders-specific feature)

### Tables
- No history view equivalent

### Orders
```css
#orders-history-left-view {
  display: none;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  z-index: 20;
}

#orders-history-left-view.active {
  display: flex;
}

#orders-history-left-view.active ~ #orders-menu-items-view {
  display: none !important;  /* Hide menu when history active */
}
```

**DIFFERENCE 18**: Orders has overlay history view that hides menu items when active. Tables has no equivalent.

---

## 19. CART PANEL ANIMATION (Orders-specific)

### Orders
```css
.orders-container .orders-right-panel {
  max-height: 0;
  transition: max-height 0.3s ease;  /* ANIMATED transition */
}

.orders-container .orders-right-panel.show-cart {
  max-height: calc(100vh - 188px);
}
```

**DIFFERENCE 19**: Orders uses `max-height` animation for cart slide-up. Tables uses `transform` for session panel slide.

---

## 20. HEIGHT CALCULATIONS DIFFERENCES

| Measurement | Tables | Orders |
|---|---|---|
| Header Height | 70px | 70px |
| Sidebar Top | 70px | 70px |
| Container Height | Not set | `calc(100vh - 140px)` |
| Sidebar Height (768px) | `calc(100vh - 70px)` | `calc(100vh - 140px)` |
| Cart Bar Height (Mobile) | None | 48px |
| Right Panel Bottom (Mobile) | N/A | 48px above cart |
| History View Bottom (Mobile) | N/A | 48px (for cart) |

**DIFFERENCE 20**: Orders accounts for 48px cart bar in all mobile height calculations. Tables doesn't have this bar.

---

## SUMMARY TABLE: 20 Key Differences

| # | Aspect | Tables | Orders | Impact |
|---|---|---|---|---|
| 1 | Container height | Not set | `calc(100vh - 140px)` | Orders fills specific height |
| 2 | Tab bar positioning | `margin-top: auto` | `flex: 0 0 auto` | Different flex approach |
| 3 | Sidebar default state | No sidebar class | `display: none` | Orders explicit hiding |
| 4 | Sidebar height (768px) | `calc(100vh - 70px)` | `calc(100vh - 140px)` | Orders taller (cart space) |
| 5 | Container left margin (768px) | 100px | 0px | Different offset method |
| 6 | Content left offset | Padding: 100px | Uses container rules | Different avoidance method |
| 7 | Right panel slide | `transform: translateX()` | `max-height: 0 → value` | Different animation |
| 8 | Bottom cart bar | None | Fixed 48px bar | Orders has mobile cart bar |
| 9 | Card aspect ratio | 1:1 square | Auto height | Different content type |
| 10 | Card min-height | 160px | 180px | Orders taller |
| 11 | Image responsive | None | 120px → 90px | Orders has responsive images |
| 12 | Mobile grid cols | Fixed 2 | Auto-fit responsive | Different grid strategy |
| 13 | 480px sidebar | 80px, 60px top | 80px, 60px top | Same |
| 14 | Button styling | Minimal | Complete | Orders more detailed |
| 15 | Grid min-width | 140px | 155px | Orders wider columns |
| 16 | Modal complexity | Simple | Very complex (variants) | Orders has variant handling |
| 17 | Display toggle | Not used | Used explicitly | Orders uses display prop |
| 18 | History view | None | Full overlay system | Orders-only feature |
| 19 | Cart animation | N/A | `max-height` transition | Orders-only animation |
| 20 | Height calculations | 70px base | 70px header + 48px cart | Orders accounts for cart |

---

## KEY ARCHITECTURAL INSIGHTS

### Design Philosophy
- **Tables**: Square card layout with status indicators, fixed grid
- **Orders**: Product image + text layout, responsive grid, cart-centric mobile UI

### Mobile Strategy
- **Tables**: Simple transform-based panel sliding
- **Orders**: Complex height-based animations with multiple fixed layers

### Space Usage
- **Tables**: 70px header only on mobile
- **Orders**: 70px header + 48px cart bar on mobile (140px total reserved)

### Sidebar Pattern
- **Both**: Fixed left sidebar at 100px (mobile), 80px (small mobile)
- **Tables**: Tab bar transforms into sidebar
- **Orders**: Sidebar hidden by default, toggles on mobile

