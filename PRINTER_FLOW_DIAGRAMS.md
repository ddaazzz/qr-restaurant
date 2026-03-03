# 🖨️ Printer Integration - Visual Flow Diagrams

## Overall Printer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CHUIO RESTAURANT SYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  KITCHEN DASHBOARD (kitchen.html)                                  │
│  ├─ Load orders every 5 seconds                                    │
│  ├─ Display pending orders                                         │
│  └─ PRINT BUTTON (new) →─────┐                                    │
│                              │                                     │
│  ADMIN SETTINGS (admin-settings.html)                              │
│  ├─ 🖨️ Printer Settings Card (new)                                │
│  ├─ Configure printer type                                         │
│  ├─ Enable auto-print                                              │
│  └─ Test connection ──────────┐                                   │
│                               │                                    │
│  FRONTEND (JavaScript)         │                                    │
│  ├─ kitchen-printing.js        ├──→ Generate Receipt HTML         │
│  ├─ admin-printer-settings.js  │    (80mm thermal format)         │
│  └─ Browser Print API ─────────┴──→ window.print()               │
│                                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                          BACKEND (Express)                          │
│                                                                    │
│  Printer Routes API                                                │
│  ├─ GET  /printer-settings          ← Load settings              │
│  ├─ PATCH /printer-settings         ← Save settings              │
│  ├─ POST  /print-order              ← Print kitchen order        │
│  ├─ POST  /print-bill               ← Print bill/receipt         │
│  ├─ POST  /printer-test             ← Test connection            │
│  └─ GET   /printer-jobs             ← View history               │
│           ↓                                                        │
│  Printer Service (printerService.ts)                              │
│  ├─ generateReceiptHTML()     ← Format receipt 80mm              │
│  ├─ printOrder()              ← Send ESC/POS commands            │
│  └─ testPrinterConnection()   ← Verify connectivity              │
│           ↓                                                        │
│  Database                                                         │
│  ├─ restaurants table                                             │
│  │  ├─ printer_type                                               │
│  │  ├─ printer_host                                               │
│  │  ├─ kitchen_auto_print                                         │
│  │  └─ bill_auto_print                                            │
│  └─ printer_jobs (audit)                                          │
│     ├─ Track all print jobs                                       │
│     └─ Log failures for debugging                                 │
│                                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                         PRINTERS (Hardware)                         │
│                                                                    │
│  ┌─ Browser Print                                                 │
│  │  └─ Any network printer (Office, thermal, etc)                 │
│  │                                                                 │
│  ├─ Network Thermal Printer                                       │
│  │  └─ ESC/POS over TCP/IP (Port 9100)                           │
│  │     Example: Epson TM-T88V, Star Micronics                    │
│  │                                                                 │
│  └─ USB Thermal Printer                                           │
│     └─ ESC/POS over USB                                          │
│        Example: Epson TM-T88V USB, Star Micronics USB           │
│                                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Order Printing Flow (Kitchen)

### Manual Printing (Browser)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. ORDER ARRIVES IN KITCHEN                                  │
│    └─ New order shown in kitchen.html                       │
│       Status: "pending" (red badge)                         │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. KITCHEN STAFF CLICKS "🖨️ PRINT" BUTTON                  │
│    └─ Calls kitchenPrinting.print(order)                    │
│       └─ kitchen-printing.js function triggered            │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. RECEIPT HTML GENERATED                                    │
│    ├─ Format: 80mm width (thermal receipt size)             │
│    ├─ Content:                                               │
│    │  ┌────────────────────────┐                             │
│    │  │  KITCHEN ORDER         │                             │
│    │  │  Order #12345          │                             │
│    │  │  Table 5               │                             │
│    │  │  10:30 AM              │                             │
│    │  │────────────────────────│                             │
│    │  │ Pizza ×2               │                             │
│    │  │ Extra Cheese ×1        │                             │
│    │  │────────────────────────│                             │
│    │  │  Thank you!            │                             │
│    │  └────────────────────────┘                             │
│    └─ No images, text-only formatted                         │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. BROWSER PRINT DIALOG OPENS                                │
│    ├─ window.open() creates new window                       │
│    ├─ Receipt HTML written to new window                     │
│    └─ Automatic print() call (with 250ms delay)             │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. PRINT DIALOG APPEARS                                      │
│    ├─ User selects printer                                   │
│    ├─ Confirms paper size / orientation                      │
│    └─ Clicks "Print" button                                  │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. ORDER PRINTS                                              │
│    └─ Physical receipt sent to kitchen printer               │
│       Kitchen staff can start cooking with physical ticket   │
└──────────────────────────────────────────────────────────────┘
```

### Auto-Print (Thermal Printer)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. KITCHEN AUTO-PRINT ENABLED IN ADMIN SETTINGS              │
│    ├─ Printer Type: "Network Thermal"                        │
│    ├─ Printer Host: "192.168.1.100"                          │
│    ├─ Printer Port: 9100                                     │
│    └─ ✓ kitchen_auto_print checkbox enabled                 │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. ORDER SENT TO KITCHEN (API)                               │
│    ├─ Admin dashboard creates order via POST /orders         │
│    ├─ Backend inserts to database                            │
│    └─ Event: "order_created"                                 │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. KITCHEN JS POLL DETECTS NEW ORDER                         │
│    ├─ loadKitchenOrders() called every 5 seconds             │
│    ├─ GET /api/kitchen/items?restaurantId=X                 │
│    ├─ New order found with status="pending"                 │
│    └─ autoPrintKitchenOrder() triggered                      │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. CHECK AUTO-PRINT SETTING                                  │
│    ├─ GET /api/restaurants/X/printer-settings               │
│    ├─ kitchen_auto_print = true?                             │
│    └─ printer_type != "none"?                                │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. BUILD PRINT JOB PAYLOAD                                   │
│    ├─ orderNumber: "12345"                                   │
│    ├─ tableNumber: "Table 5"                                 │
│    ├─ items: []{name, qty, variants}                         │
│    ├─ timestamp: "10:30:45 AM"                               │
│    └─ type: "kitchen"                                        │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. SEND TO SERVER                                            │
│    ├─ POST /api/restaurants/X/print-order                    │
│    ├─ Body: { orderId, orderType: "kitchen" }               │
│    └─ Kitchen dashboard makes request (no user action!)      │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. SERVER PROCESSES PRINT JOB                                │
│    ├─ Fetch printer config from database                     │
│    ├─ Build ESC/POS formatting commands                      │
│    ├─ Connect to thermal printer TCP socket                  │
│    ├─ Send ESC/POS commands (ESC @, text, formatting, cut)   │
│    ├─ Close socket                                           │
│    └─ Log result to printer_jobs table                       │
└──────────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ 8. PRINTER EXECUTES                                          │
│    ├─ Receipt pre-printed from server memory                 │
│    ├─ Text formatted at 80mm width                           │
│    ├─ Motor: Feed paper, print text, cut paper               │
│    └─ Result: Physical receipt in kitchen immediately        │
└──────────────────────────────────────────────────────────────┘
```

---

## Bill Printing Flow

```
SCENARIO: Table paying and leaving

┌──────────────────────────────────────┐
│ 1. ADMIN CLICKS "CLOSE TABLE"         │
│    (in Tables view)                   │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ 2. BILL MODAL APPEARS                 │
│    ├─ Shows order summary              │
│    └─ Buttons:                         │
│       ├─ 🖨️ Print Bill (new)          │
│       └─ ✓ Confirm Payment             │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ 3. STAFF CLICKS "🖨️ PRINT BILL"     │
│    (or auto-triggers if enabled)      │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ 4. SEND TO PRINTER                    │
│    └─ POST /print-bill                │
│       ├─ sessionId                    │
│       ├─ billData (items, total)      │
│       └─ Auto-print setting check     │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ 5. PRINTER TYPE CHECK                 │
│    ├─ Browser?                        │
│    │  └─ Return HTML, use window.print()
│    │                                  │
│    └─ Thermal?                        │
│       └─ Send ESC/POS to printer     │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ 6. BILL PRINTS                        │
│    ├─ Number:   BILL #5               │
│    ├─ Table:    Table 5               │
│    ├─ Items:    [all ordered items]   │
│    ├─ Subtotal: $45.50                │
│    ├─ Tax:      $4.55                 │
│    ├─ Total:    $50.05                │
│    └─ Message:  "Thank you, come      │
│       back soon!"                     │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ 7. CONFIRM PAYMENT                    │
│    ├─ Staff confirms bill paid        │
│    ├─ Session marked closed           │
│    └─ If POS configured:              │
│       └─ Send webhook to POS          │
└──────────────────────────────────────┘
```

---

## Database State Diagram

```
BEFORE IMPLEMENTATION:
┌────────────────────────────────────┐
│ restaurants table                  │
├────────────────────────────────────┤
│ id: 1                              │
│ name: "My Restaurant"              │
│ address: "123 Main St"             │
│ pos_webhook_url: (optional)        │
│ ...                                │
└────────────────────────────────────┘

AFTER IMPLEMENTATION:
┌─────────────────────────────────────────────────┐
│ restaurants table (NEW COLUMNS)                 │
├─────────────────────────────────────────────────┤
│ ... (existing fields)                           │
│ printer_type: "none"                            │
│ printer_host: null                              │
│ printer_port: 9100                              │
│ kitchen_auto_print: false                       │
│ bill_auto_print: false                          │
│ print_logo: true                                │
└─────────────────────────────────────────────────┘
         ↓
         ├─ Links to ─→ ┌────────────────────────┐
         │              │ printer_jobs (NEW)     │
         │              ├────────────────────────┤
         │              │ id: 1, 2, 3, ...       │
         │              │ restaurant_id: 1      │
         │              │ order_id: "12345"     │
         │              │ job_type: "kitchen"   │
         │              │ status: "sent"        │
         │              │ created_at: ...       │
         │              │ completed_at: ...     │
         │              │ error_message: null   │
         │              └────────────────────────┘
         │
         └─ When admin configures:
            ├─ printer_type ← "network"
            ├─ printer_host ← "192.168.1.100"
            ├─ kitchen_auto_print ← true
            └─ printer_jobs records track all printing
```

---

## State Machine: Order Print State

```
                    ┌─────────────────┐
                    │     Created     │
                    │   (Kitchen API) │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
         ┌──────────│  pending_print  │◄──────────────┐
         │          │  (check enabled)│               │
         │          └────────┬────────┘               │
         │                   │                        │
         │          ┌────────▼────────────┐           │
         │          │  Send Print Job    │           │
         │          │ (POST /print-order)│           │
         │          └────────┬───────────┘           │
         │                   │                        │
         │          ┌────────▼────────┐      Error   │
         │          │ Print Success?  │──────────────┤
         │          └────┬────────┬─────┘           │
         │           YES │        │ NO              │
         │              │        └────────────┐     │
         │              │                     │     │
         │    ┌─────────▼──────────┐ ┌──────▼───────┐
         │    │  printed_log entry │ │ Log error    │
         │    │  status: "sent"    │ │ status: "failed"
         └────┤                    │ └──────────────┘
         │    │  Add to printer_jobs
         │    │  table              │
         │    └────────────────────┘
         │
         └─ Can Retry ──┘
```

---

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   KITCHEN DASHBOARD                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Order Card                                            │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ #12345 - Table 5                               │  │  │
│  │  │ Pizza ×2, Extra Cheese ×1                      │  │  │
│  │  │                                                 │  │  │
│  │  │ [Start Preparing] [🖨️ Print] ← New Button    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                    [🖨️ Print] clicked
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  kitchen-printing.js                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ printKitchenOrder(order)                            │  │
│  │   ├─ generateKitchenOrderHTML()                     │  │
│  │   ├─ window.open() → new window                     │  │
│  │   ├─ printWindow.document.write(html)               │  │
│  │   └─ printWindow.print() → Browser Dialog          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                   OR (if configured)
                           │
                    sendPrintJobToServer()
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  BACKEND - printer.routes.ts                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ POST /print-order                                   │  │
│  │   ├─ Get restaurantId, orderId                      │  │
│  │   ├─ Fetch printer settings                         │  │
│  │   ├─ Get order items from DB                        │  │
│  │   ├─ Call printerService.printOrder()              │  │
│  │   └─ Log to printer_jobs table                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ├─ Browser Type
                           │  └─→ Return HTML for window.print()
                           │
                           └─ Thermal Type
                              └─→ printerService.printOrder()
                                  ├─ Connect to printer
                                  ├─ Build ESC/POS commands
                                  ├─ Send to printer TCP socket
                                  └─ Update status
                                     (sent/failed)
                                     ↓
                              Printer outputs receipt
```

---

## Browser Print vs Thermal Printer Comparison

```
┌────────────────────────────────────────────────────────────────┐
│ FEATURE                  │ BROWSER PRINT    │ THERMAL PRINTER  │
├──────────────────────────┼──────────────────┼──────────────────┤
│ Hardware Cost            │ $0               │ $200-500         │
│ Setup Time               │ 5 min            │ 30 min           │
│ Manual/Auto             │ Manual only      │ Both             │
│ User Interaction         │ Click print btn  │ Automatic        │
│ Paper Savings            │ Moderate        │ Excellent        │
│ Network Reliability      │ High            │ Depends on LAN   │
│ Printer Compatibility    │ Any printer     │ ESC/POS only     │
│ Format Control           │ Browser decides │ Server controls  │
│ Error Handling           │ Simple          │ Complex          │
│ Multi-printer Support    │ Yes (browser)   │ Future feature   │
│ Recipe Audit Trail       │ No              │ Yes (jobs table) │
└────────────────────────────────────────────────────────────────┘
```

---

**These diagrams illustrate the complete printer integration system and data flows.**

