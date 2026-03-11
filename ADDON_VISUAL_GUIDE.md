# Addon System - Visual Architecture & Workflows

## 1. Data Model Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      RESTAURANTS                         │
│ ┌──────────────────────────────────────────────────────┐│
│ │ id | name | printer_type | ...                        ││
│ └──────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────┘
                      │
      ┌───────────────┼───────────────────┐
      │               │                   │
      ▼               ▼                   ▼
┌──────────────┐ ┌──────────────┐ ┌────────────────┐
│ MENU_ITEMS   │ │MENU_CATEGORY │ │PRINTER_ZONES   │
│              │ │              │ │                │
│ id    ◄──┐   │ │ id           │ │ id             │
│ name  │  │   │ │ name         │ │ zone_name      │
│ price │  │   │ │ restaurant_id│ │                │
│ cat_id├──┴───┤ │              │ │                │
└──────────────┘ └──────────────┘ └────────────────┘
        ▲                         ▲
        │                         │
        └──────────────┬──────────┘
                       │ (category_printer_zones)
                       
┌──────────────────────────────────────────────────────────┐
│                        ADDONS                            │
│ ┌──────────────────────────────────────────────────────┐│
│ │ id | restaurant_id | menu_item_id | addon_item_id  ││
│ │    | addon_name | regular_price | discount_price   ││
│ │    | is_available | created_at                      ││
│ └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
       ▲          ▲                  ▲
       │          │                  └──► References MENU_ITEMS (drink)
       │          └──────────────────────► References MENU_ITEMS (food)
       └──────────────────────────────────► References RESTAURANTS

┌──────────────────────────────────────────────────────────┐
│                     ORDER_ITEMS                          │
│ ┌──────────────────────────────────────────────────────┐│
│ │ id | order_id | menu_item_id | quantity | price     ││
│ │ is_addon | parent_order_item_id | addon_id          ││
│ │ print_category_id | status | ...                    ││
│ └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
   │
   ├─ is_addon = false ─► MAIN ITEM (parent)
   │  └─ parent_order_item_id = NULL
   │  └─ print_category_id = food category
   │
   └─ is_addon = true ──► ADDON ITEM (child)
      └─ parent_order_item_id = <parent item id>
      └─ addon_id = <addon config>
      └─ print_category_id = drink category
```

---

## 2. Customer Journey Flow

```
┌─────────────────────┐
│ CUSTOMER OPENS QR   │
│    LANDING          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────┐
│ BROWSE MENU & CATEGORIES   │
│                             │
│ 🍽️  Food  |  🥤 Drinks    │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ FIND ITEM                  │
│                             │
│ 🍚 Chicken Rice ✓          │
│    $4.50                   │
│    [Add to Cart]           │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ ITEM ADDED TO CART: ✓       │
│                              │
│ Cart: 1 item                │
├──────────────────────────────┤
│  🍚 Chicken Rice × 1        │
│     $4.50                   │
│                              │
│  ❌ No addons              │
└──────────┬───────────────────┘
           │
           ▼
┌────────────────────────────────────┐
│    ADDON MODAL APPEARS! 🎯         │
├────────────────────────────────────┤
│  Add-ons - Chicken Rice            │
│  Choose to make this a combo       │
├────────────────────────────────────┤
│                                    │
│  ☐ Iced Tea                       │
│    Drinks                         │
│    Regular: $2.50 → $1.50 (-40% ) │
│                                    │
│  ☐ Orange Juice                   │
│    Drinks                         │
│    Regular: $2.50 → $1.50 (-40% ) │
│                                    │
├────────────────────────────────────┤
│  [Skip]         [Confirm]          │
└────┬───────────────────────────────┘
     │
     ├─ Skip ────────────────────┐
     │                           │
     └─ Confirm (select Iced Tea)
                   │
                   ▼
     ┌──────────────────────────────────┐
     │   CART UPDATED: ✓               │
     │                                  │
     │  Cart: 1 item + 1 addon         │
     ├──────────────────────────────────┤
     │  🍚 Chicken Rice × 1            │
     │     $4.50                       │
     │     🥤 Iced Tea (addon) -→ $1.50 │
     │     Subtotal: $6.00             │
     │     Service: $0.60              │
     │     TOTAL: $6.60                │
     │                                  │
     │  [Add More] [Checkout]          │
     └────────────────────────────────┘
           │
           ▼
     ┌──────────────────────┐
     │ PLACE ORDER          │
     │                      │
     │ [Submit to Kitchen]  │
     └──────────┬───────────┘
                │
                ▼
     ┌──────────────────────┐
     │ 📋 ORDER CONFIRMED   │
     │                      │
     │ "Order sent to       │
     │  kitchen!"           │
     └──────────────────────┘
```

---

## 3. Kitchen Printing Workflow

```
SERVER: Order #5 placed
        1x Chicken Rice + Iced Tea addon

        ↓

BACKEND: Process order
        ├─ Create main item: Chicken Rice
        │  ├─ is_addon = false
        │  ├─ parent_order_item_id = NULL
        │  └─ print_category_id = FOOD (id: 2)
        │
        └─ Create addon item: Iced Tea
           ├─ is_addon = true
           ├─ parent_order_item_id = 10 (Chicken Rice)
           ├─ addon_id = 3
           └─ print_category_id = DRINKS (id: 5)

        ↓

MULTI-ZONE ROUTING:
        ├─ Group by print_category_id
        │  ├─ FOOD (2): [Chicken Rice]
        │  └─ DRINKS (5): [Iced Tea]
        │
        ├─ Get zones for each category
        │  ├─ FOOD → Zone 1: "Grill"
        │  └─ DRINKS → Zone 2: "Beverages"
        │
        └─ Queue print jobs

        ↓

KITCHEN PRINTER 1 (Grill):
┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🍳 KITCHEN STATION: GRILL ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Table 3  |  Order #5       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                           ┃
┃  Qty: 1x Chicken Rice    ┃
┃                           ┃
┃ ✓ Mark done when ready   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛

        ↓ (same time)

KITCHEN PRINTER 2 (Beverages):
┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🥤 KITCHEN STATION: BEVERAGES ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Table 3  |  Order #5       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                           ┃
┃  Qty: 1x Iced Tea [addon]│
┃                           ┃
┃ ✓ Mark done when ready   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛

        ↓

KITCHEN STAFF:
- Grill staff prepares Chicken Rice
- Beverage staff pours Iced Tea
- Both items ready at ~same time
- Server brings combo to Table 3
```

---

## 4. API Flow Diagram

```
┌────────────────────────────────────────────────────────────┐
│                  ADMIN SETTING UP ADDONS                   │
└────────────┬─────────────────────────────────────────────┘
             │
    ┌────────▼────────┐
    │ GET all menu    │
    │ items & prices  │
    └────────┬────────┘
             │
    ┌────────▼──────────────────────┐
    │ Identify pairs:              │
    │ - Main: Chicken Rice         │
    │ - Addon: Iced Tea, Orange J. │
    └────────┬──────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │ POST /api/restaurants/1/addons               │
    │ {                                            │
    │   menu_item_id: 5,      // Chicken Rice     │
    │   addon_item_id: 8,     // Iced Tea         │
    │   addon_name: "Add Drink"                   │
    │   regular_price_cents: 250,  // $2.50      │
    │   addon_discount_price_cents: 150   // $1.50│
    │ }                                            │
    └────────┬──────────────────────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ ✅ Addon created              │
    │ ID: 42                        │
    │ Status: available             │
    └────────┬──────────────────────┘
             │
    └────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│              CUSTOMER PLACING ORDER WITH ADDON             │
└────────────┬─────────────────────────────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ GET QR Landing                │
    │ /api/scan/:qrToken            │
    └────────┬──────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ GET Menu Items                │
    │ /api/restaurants/1/menu       │
    └────────┬──────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ Click "Add to Cart"           │
    │ Item: Chicken Rice            │
    └────────┬──────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │ GET /api/restaurants/1/menu-items/5/addons   │
    │                                               │
    │ Response:                                     │
    │ [                                             │
    │   {                                           │
    │     id: 42,                                   │
    │     addon_item_name: "Iced Tea",            │
    │     addon_discount_price_cents: 150,        │
    │     addon_category_name: "Drinks",          │
    │     ...                                       │
    │   }                                           │
    │ ]                                             │
    └────────┬──────────────────────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ 🎯 Addon Modal Shows           │
    │                                │
    │ [✓] Iced Tea $1.50 (-40%)     │
    │ [✓] Orange J. $1.50 (-40%)    │
    │                                │
    │ [Skip] [Confirm]              │
    └────────┬──────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │ POST /api/sessions/123/orders                │
    │ {                                            │
    │   items: [                                   │
    │     {                                        │
    │       menu_item_id: 5,                      │
    │       quantity: 1,                          │
    │       selected_option_ids: [],              │
    │       addons: [                             │
    │         { addon_id: 42, quantity: 1 }      │
    │       ]                                      │
    │     }                                        │
    │   ]                                          │
    │ }                                            │
    └────────┬──────────────────────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ ✅ Order Created              │
    │ ID: 1000                      │
    │ Status: pending               │
    │                               │
    │ Items:                        │
    │ - Chicken Rice (main)         │
    │ - Iced Tea (addon)            │
    └────────┬──────────────────────┘
             │
    ┌────────▼──────────────────────┐
    │ Auto-Print Triggered          │
    │ (if enabled)                  │
    └────────┬──────────────────────┘
             │
    ┌────────▼──────────────────────────────────────┐
    │ GET /api/sessions/123/orders                 │
    │                                               │
    │ Response:                                     │
    │ {                                             │
    │   items: [{                                   │
    │     order_item_id: 100,                      │
    │     menu_item_name: "Chicken Rice",         │
    │     quantity: 1,                            │
    │     unit_price_cents: 450,                  │
    │     addons: [{                              │
    │       order_item_id: 101,                   │
    │       menu_item_name: "Iced Tea",          │
    │       quantity: 1,                          │
    │       unit_price_cents: 150                │
    │     }]                                       │
    │   }],                                        │
    │   total_cents: 600                          │
    │ }                                             │
    └────────────────────────────────────────────┘
```

---

## 5. Database State Diagram

### Before Order (Setup)

```
MENU_ITEMS:
┌─────┬──────────────┬────────┬──────────┐
│ id  │ name         │ price  │ cat_id   │
├─────┼──────────────┼────────┼──────────┤
│ 5   │ Chicken Rice │ 450¢   │ 2 (Food) │
│ 8   │ Iced Tea     │ 250¢   │ 5 (Drink)│
└─────┴──────────────┴────────┴──────────┘

ADDONS:
┌────┬──────────┬──────────┬────────┬───────┬──────────┐
│ id │ menu_id  │ addon_id │ name   │ price │ discount │
├────┼──────────┼──────────┼────────┼───────┼──────────┤
│ 42 │ 5        │ 8        │ Drink  │ 250¢  │ 150¢     │
└────┴──────────┴──────────┴────────┴───────┴──────────┘

PRINTER_ZONES:
┌────┬───────────┐
│ id │ name      │
├────┼───────────┤
│ 1  │ Grill     │
│ 2  │ Beverages │
└────┴───────────┘

CATEGORY_PRINTER_ZONES:
┌────┬─────────┬──────────┐
│ id │ zone_id │ cat_id   │
├────┼─────────┼──────────┤
│ A  │ 1       │ 2 (Food) │
│ B  │ 2       │ 5 (Drink)│
└────┴─────────┴──────────┘
```

### After Order (Order #1000)

```
ORDERS:
┌────┬──────────┐
│ id │ status   │
├────┼──────────┤
│1000│ pending  │
└────┴──────────┘

ORDER_ITEMS:
┌─────┬──────────┬──────────┬──────────┬────────┬──────────┬────────────┬─────────────────┐
│ id  │ order_id │ menu_id  │ quantity │ price  │ is_addon │ parent_id  │ print_category  │
├─────┼──────────┼──────────┼──────────┼────────┼──────────┼────────────┼─────────────────┤
│ 100 │ 1000     │ 5        │ 1        │ 450¢   │ false    │ NULL       │ 2 (Food)        │
│ 101 │ 1000     │ 8        │ 1        │ 150¢   │ true     │ 100        │ 5 (Drink)       │
└─────┴──────────┴──────────┴──────────┴────────┴──────────┴────────────┴─────────────────┘

ROUTING LOGIC:
┌─ Item 100: print_category_id = 2
│  └─ Maps to Zone 1 (Grill)
│
└─ Item 101: print_category_id = 5
   └─ Maps to Zone 2 (Beverages)
```

---

## 6. State Machine: Addon Item Lifecycle

```
                    ┌─────────────────┐
                    │   CONFIGURED    │
                    │   is_available  │
                    │      = true     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ CUSTOMER VIEWS  │
                    │ ADDON MODAL     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ CUSTOMER        │
                    │ SELECTS ADDON   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ ORDER ITEM      │
                    │ CREATED         │
                    │ is_addon=true   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ ITEM PENDING    │
                    │ status=pending  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ KITCHEN PRINTS  │
                    │ (Beverages Zone)│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ KITCHEN QUEUE   │
                    │ status=queued   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ BEING PREPARED  │
                    │ status=in_prep  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ READY           │
                    │ status=ready    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ SERVED          │
                    │ status=served   │
                    └─────────────────┘

PARALLEL FLOW:
Main Item (Chicken Rice)  vs  Addon Item (Iced Tea)
    ↓ in Grill                     ↓ in Beverages
    [========COOKING========]      [==POURING==]
    
Both ready at ~same time
Server brings combo to table
```

---

## 7. Error Handling Flow

```
┌────────────────────────────────┐
│ CUSTOMER REQUESTS ADDONS       │
│ for item that has no addons    │
└────────────┬───────────────────┘
             │
    ┌────────▼─────────────────┐
    │ GET addons for item      │
    │ /api/restaurants/1/menu- │
    │ items/99/addons          │
    └────────┬─────────────────┘
             │
    ┌────────▼──────────────────┐
    │ Response: []              │
    │ (empty array)             │
    └────────┬──────────────────┘
             │
    ┌────────▼──────────────────┐
    │ Modal doesn't show        │
    │ (gracefully skipped)       │
    │                            │
    │ Order proceeds without     │
    │ addons                     │
    └────────────────────────────┘

─────────────────────────────────

┌────────────────────────────────┐
│ CREATE ADDON FOR MISMATCH      │
│ items from different           │
│ restaurants                    │
└────────┬───────────────────────┘
         │
┌────────▼───────────────────────────────────────┐
│ POST /api/restaurants/1/addons                │
│ {                                             │
│   menu_item_id: 5,  // Belongs to rest. 1   │
│   addon_item_id: 15 // Belongs to rest. 2   │
│ }                                             │
└────────┬───────────────────────────────────────┘
         │
┌────────▼──────────────────────┐
│ ❌ Error 403                  │
│                               │
│ {                             │
│   error: "Addon item doesn't  │
│           belong to this      │
│           restaurant"         │
│ }                             │
└───────────────────────────────┘

─────────────────────────────────

┌────────────────────────────────┐
│ DUPLICATE ADDON CREATION       │
│ Same item + addon pair twice   │
└────────┬───────────────────────┘
         │
┌────────▼───────────────────────────────────────┐
│ POST /api/restaurants/1/addons                │
│ {                                             │
│   menu_item_id: 5,                           │
│   addon_item_id: 8 // Already has addon     │
│ }                                             │
└────────┬───────────────────────────────────────┘
         │
┌────────▼──────────────────────┐
│ ❌ Error 400                  │
│                               │
│ {                             │
│   error: "This addon already  │
│           exists for this     │
│           menu item"          │
│ }                             │
└───────────────────────────────┘
```

---

This visual documentation complements the technical guides and helps understand:
- ✅ How data flows through the system
- ✅ Kitchen printing separation by zone
- ✅ Customer experience with addons
- ✅ API request/response patterns
- ✅ Database relationships
- ✅ Error scenarios

All diagrams represent actual implementation!
