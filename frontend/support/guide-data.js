window.CHUIO_GUIDE_TOPICS = [
  {
    step: 1,
    slug: 'menu-setup',
    title: 'Menu Setup',
    summary: 'Your menu must be configured before anything else. The menu is what customers see when they scan a table QR code. Without menu items, customers cannot place orders.',
    keywords: ['menu', 'category', 'item', 'variant', 'addons', 'combo', 'price', 'image', 'preset'],
    images: [
      { src: '/support/images/image1.png', alt: 'Create a menu Category' },
      { src: '/support/images/image2.png', alt: 'Adding a menu item' },
      { src: '/support/images/image3.png', alt: 'Adding a menu item variant' },
      { src: '/support/images/image4.png', alt: 'Edit Variant Details' },
      { src: '/support/images/image5.png', alt: 'Variant list in menu item details' },
      { src: '/support/images/image6.png', alt: 'Adding a combo for a menu item' },
    ],
    sections: [
      {
        heading: 'Create Categories',
        points: [
          'Categories organize your food items and make browsing easy for customers. Examples include Appetizers, Main Course, Drinks, and Desserts.',
          'Click on Menu Tab in the SideMenu Bar.',
          'Click Add Category (click "Edit" in Header first if not displayed).',
          'Enter category name.',
          'Save.'
        ]
      },
      {
        heading: 'Create Menu Items',
        points: [
          'Click Add Item.',
          'Enter item name, add a description if necessary, enter price and upload a food item image [280x280].',
          'Save.'
        ]
      },
      {
        heading: 'Add Variants For Food Items',
        points: [
          'Variants let you add customizable option groups to a menu item — such as Size, Toppings, Spice Level, or Extras. Each variant group contains selectable options that can carry an additional price upcharge.',
          'Example: Food item "Caesar Salad", Variant name: Meat Options, Required: Yes, Min: 1, Max: 1, Variant Options: Grilled Chicken, Salmon (+$10), No Meat (-$20).',
          'Go to the Menu tab in admin.',
          'Click on the menu item you want to add variants to.',
          'In the item detail panel, click Edit.',
          'Check "Has Variants" — the variants section appears.',
          'Click "+ Add Variant".',
          'Fill in the variant group details: Variant Name (e.g. "Size", "Extras", "Spice Level"), Min Select (minimum options customer must choose; 0 = optional), Max Select (maximum allowed; 1 = single choice; leave empty for unlimited), and Required checkbox (if checked, customers cannot add item to cart without selecting).',
          'Click "+ Add Option" to add choices within the group.',
          'For each option, enter: Option Name (e.g. "Large", "Extra Cheese") and Price in cents (e.g. 150 = +$1.50; leave 0 for no extra charge).',
          'Click Save for the option.',
          'Repeat for each option in the group, then click Save Variant.',
          'Repeat to add more variant groups (e.g. a second group for "Extras").',
          'Use the pencil icon to edit or the trash icon to delete any variant group or option.',
          'Tip: If you have already created Variant Presets in Settings, click "Browse Presets" to apply a whole set of variant groups and options at once.'
        ]
      },
      {
        heading: 'Add Combo / Add-ons For Food Items',
        points: [
          'The Addon/Combo feature lets you turn any menu item into a customizable meal deal. Customers are prompted to add supplementary items (e.g. a drink or side) at a special discounted price.',
          'Go to the Menu tab in admin.',
          'Click on the menu item you want to turn into a combo.',
          'In the edit modal, check "Is Meal/Combo (Enable Add-ons)".',
          'The "Available Add-ons" section appears.',
          'Click "+ Add Custom Addon".',
          'In the popup, search or browse for the item you want to offer as an add-on.',
          'Click the item to select it (it highlights green).',
          'Set the Addon Discount Price — the special price customers pay for this item as part of the combo.',
          'Click "✓ Confirm".',
          'Repeat for each add-on item you want to include.',
          'Review your configured add-ons — each shows the item name, regular price, and addon price.',
          'Use the pencil icon to edit the addon price; use the X icon to remove an add-on.',
          'Save the menu item.',
          'Tip: If you have already created Addon Preset Lists in Settings, use the "Add Preset List" dropdown to add a whole group at once.'
        ]
      }
    ]
  },
  {
    step: 2,
    slug: 'table-setup',
    title: 'Table Setup',
    summary: 'Tables must be configured so customers can scan QR codes assigned to specific seating locations. Each table has its own QR code used for ordering.',
    keywords: ['table', 'tables', 'floor', 'section', 'qr', 'session', 'pax', 'status', 'regenerate', 'static'],
    images: [
      { src: '/support/images/image7.png', alt: 'Create a table category' },
      { src: '/support/images/image8.png', alt: 'Create a table' },
      { src: '/support/images/image9.png', alt: 'Restaurant QR code' },
      { src: '/support/images/image10.png', alt: 'Gear Icon Features' },
    ],
    sections: [
      {
        heading: 'Create a Table Category',
        points: [
          'Open the Tables tab.',
          'Tap Edit in the top right.',
          'Tap + Add Category.',
          'Enter a category name (e.g. "Patio", "Main Floor", "VIP Room").',
          'Save.'
        ]
      },
      {
        heading: 'Create a Table',
        points: [
          'In the Tables tab, tap Edit.',
          'Tap + Add Table.',
          'Enter the table name or number (e.g. "Table 1").',
          'Enter the seat count.',
          'Assign to a category if you created one.',
          'Save.',
          'The table appears as a card in the grid view.'
        ]
      },
      {
        heading: 'Generate and Print QR Codes',
        points: [
          'Go to Settings → Restaurant Info.',
          'Under QR Mode, select one of: Regenerate (a fresh QR code is generated for each new session — most secure), Static Table (one fixed QR code per table — same QR always works), or Static Seat (one fixed QR code per seat/unit — best for counter seating).',
          'Go to Settings → QR Settings to set text shown above and below the QR code, choose print size (Small / Medium / Large), and preview your QR layout before printing.',
          'Tap on a table card to view its QR code.',
          'Open the gear icon list and tap Print QR code to send the printing job to a thermal/Bluetooth printer.',
          'You can also tap "Print" to send to a configured thermal printer, or use the share button to save/share the image.'
        ]
      },
      {
        heading: 'Table Status Colors',
        points: [
          'Gray — Available',
          'Dark Blue — Active session (less than 30 min)',
          'Purple — Session 30–60 min',
          'Orange — Session 60–120 min',
          'Red — Session more than 120 min',
          'Green — Payment received',
          'Yellow — Bill closure requested',
          'Light Blue — Reserved (booking)'
        ]
      }
    ]
  },
  {
    step: 3,
    slug: 'staff-setup',
    title: 'Staff Setup',
    summary: 'Staff accounts let employees access relevant parts of the system. Assigning correct roles ensures security and prevents accidental changes.',
    keywords: ['staff', 'users', 'pin', 'role', 'admin', 'kitchen', 'permissions', 'clock', 'timekeeping', 'hourly'],
    images: [
      { src: '/support/images/image11.png', alt: 'Staff list' },
      { src: '/support/images/image12.png', alt: 'Adding a staff member' },
      { src: '/support/images/image13.png', alt: 'Role permissions overview' },
    ],
    sections: [
      {
        heading: 'Create a Staff Member',
        points: [
          'Go to the Staff tab.',
          'Tap Edit in the top right.',
          'Tap + Add Staff.',
          "Enter the staff member's name.",
          'Set a 6-digit PIN (used to log in).',
          'Select a role: Staff (front-of-house access) or Kitchen (kitchen display only).',
          'Optionally enter an hourly rate for timekeeping.',
          'Select Access Rights: for Staff role, choose which tabs they can see (Orders, Tables, Menu, Staff, Settings, Bookings); for Kitchen role, choose which food categories they can view.',
          'Save.'
        ]
      },
      {
        heading: 'Role Types',
        points: [
          'Admin — Full access to all features and settings.',
          'Staff — Access limited to assigned tabs only.',
          'Kitchen — Can only view the Kitchen Display and update order status for assigned categories.'
        ]
      },
      {
        heading: 'Staff Timekeeping',
        points: [
          "Tap on a staff member's card to view their details.",
          'Use Clock In / Clock Out to track shifts.',
          'View total shifts, total hours worked, and a log of all clock in/out records.'
        ]
      }
    ]
  },
  {
    step: 4,
    slug: 'managing-orders',
    title: 'Managing Orders',
    summary: 'Orders appear in real time. Admin, Staff or Kitchen users can update status as preparation progresses.',
    keywords: ['orders', 'pos', 'table order', 'counter', 'to-go', 'payment', 'refund', 'void', 'history', 'cash', 'terminal'],
    images: [
      { src: '/support/images/image14.png', alt: 'Orders History overview' },
      { src: '/support/images/image15.png', alt: 'Creating a POS order' },
    ],
    sections: [
      {
        heading: 'Viewing Orders',
        points: [
          'Open the Orders tab.',
          'Active orders appear in the main view.',
          'Tap History in the top right to view all past orders.',
          'Use the search bar to find orders by item name, table name, or order ID.'
        ]
      },
      {
        heading: 'Creating Orders from Admin (POS Mode)',
        points: [
          'Tap the Orders tab in the side menu.',
          'Browse the menu, add items to cart with variants and addons.',
          'Select order type: Table Order (select a table and session, or create a new session), Counter Order (for walk-in, pay-at-counter), or To-Go Order (for takeaway).',
          'Submit the order.'
        ]
      },
      {
        heading: 'Payment Processing — Table Orders (Dine-in)',
        points: [
          'Go to the Tables tab.',
          'Select the table.',
          'Tap Close Bill.',
          'Choose a payment method: Cash (manually mark as paid) or Card/Terminal (process via KPay or Payment Asia terminal).',
          'After payment, the bill is closed and the order is marked as Paid.'
        ]
      },
      {
        heading: 'Payment Processing — Counter / To-Go Orders',
        points: [
          'Go to the Orders tab and create a counter or to-go order.',
          'Payment is prompted immediately after placing the order.',
          'Choose a payment method: Cash or Card/Terminal.',
          'After payment, the order is marked as Paid.'
        ]
      },
      {
        heading: 'Refunds & Voids',
        points: [
          'From a paid order, tap Refund or Void.',
          'For terminal payments (KPay/Payment Asia), refunds are processed through the terminal.',
          'For cash, refunds are recorded manually.'
        ]
      }
    ]
  },
  {
    step: 5,
    slug: 'managing-tables',
    title: 'Managing Tables',
    summary: 'The table dashboard gives a live overview of restaurant activity.',
    keywords: ['tables', 'dashboard', 'session', 'move table', 'split bill', 'close bill', 'pax', 'qr scanner', 'end order'],
    images: [],
    sections: [
      {
        heading: 'Session Management',
        points: [
          'Tap a table to view its active session.',
          'View session details: Pax, duration, orders placed, bill total.',
          'Click into the gear icon for other functions related to the table.',
          'Change Pax Size — tap to adjust the number of guests.',
          'Move Table — transfer the customer to a different table using the table picker.',
          'Order for Table — brings you back to the Orders tab so staff can place an order for that table.',
          'Print QR — brings out the QR code on screen and prints to the printer.',
          'Print Bill — prints the bill receipt of its current order to the printer.',
          'Split Bill — asks for the number of diners and shows the amount to be paid per person.',
          'End Order — ends the session manually without settling the bill; order remains unpaid and table returns to Available.'
        ]
      },
      {
        heading: 'Quick Actions',
        points: [
          "Use the QR Scanner button (top right) to scan a table's QR code and jump directly to that session.",
          'Filter tables by room/category using the dropdown in the header.'
        ]
      }
    ]
  },
  {
    step: 6,
    slug: 'printer-setup',
    title: 'Printer Setup',
    summary: 'The app supports 4 independent printer configurations, each with Network (TCP/IP) or Bluetooth options.',
    keywords: ['printer', 'network printer', 'bluetooth printer', 'qr printer', 'bill printer', 'kitchen printer', 'test print', 'auto print', 'ip address', 'port'],
    images: [
      { src: '/support/images/image16.png', alt: 'Printer settings overview' },
      { src: '/support/images/image17.png', alt: 'QR printer configuration' },
      { src: '/support/images/image18.png', alt: 'QR printer preview' },
    ],
    sections: [
      {
        heading: 'Printer Types',
        points: [
          'QR Code Printer — prints table QR codes.',
          'Bill/Receipt Printer — prints customer bills.',
          'Kitchen Printer — prints kitchen order tickets.',
          'KPay Printer — prints payment terminal receipts.'
        ]
      },
      {
        heading: 'Set Up a Printer',
        points: [
          'Go to Settings → Printer.',
          'Select the printer type you want to configure (QR / Bill / Kitchen).',
          "Choose connection type: Network (enter the printer's IP address, e.g. 192.168.1.100, and port, default: 9100) or Bluetooth (tap Scan Bluetooth Devices, wait for the scan to complete, then select your printer from the list).",
          'Tap Test Connection to verify the printer is reachable.',
          'Toggle Auto-Print on if you want this printer to print automatically: QR Printer auto-prints when a QR code is generated, Bill Printer auto-prints when a bill is closed, Kitchen Printer auto-prints when a new order is created.'
        ]
      },
      {
        heading: 'QR Print Format Settings',
        points: [
          'Set the Code Size (Small / Medium / Large).',
          'Set Text Above Code (e.g. "Scan to Order").',
          'Set Text Below Code (e.g. "Let us know how we did!").',
          'Preview updates in real time.',
          'Tip: Kitchen auto-printing works server-side — tickets print even if no kitchen staff is logged in. Kitchen staff can also manually reprint any order from the Kitchen Display.'
        ]
      }
    ]
  },
  {
    step: 7,
    slug: 'bookings',
    title: 'Bookings',
    summary: 'Manage reservations with a calendar view and guest tracking.',
    keywords: ['booking', 'reservation', 'calendar', 'guest', 'check in', 'session', 'phone', 'email', 'party size'],
    images: [
      { src: '/support/images/image19.png', alt: 'Bookings calendar view' },
      { src: '/support/images/image20.png', alt: 'Manage a booking' },
    ],
    sections: [
      {
        heading: 'Create a Booking',
        points: [
          'Go to the Bookings tab.',
          'Tap the date on the calendar.',
          'Tap + Add Booking.',
          'Enter: Guest name (required), phone number, email, party size (required), booking date (required), booking time (required), table assignment (optional), and notes (optional).',
          'Save.'
        ]
      },
      {
        heading: 'Manage Bookings',
        points: [
          'Dates with bookings show a dot indicator (●) and a count.',
          'Tap a date to see all bookings for that day.',
          'Tap a booking to view details, edit, or delete.',
          'Use the search bar to search by guest name, phone, or email across all dates.'
        ]
      },
      {
        heading: 'Check In a Booking',
        points: [
          'When the guest arrives, tap the booking and select Check In.',
          'This automatically creates a session at the assigned table.',
          'All orders placed during that session are linked to the booking.'
        ]
      },
      {
        heading: 'Booking Statuses',
        points: [
          'Confirmed — Reservation confirmed.',
          'Pending — Awaiting confirmation.',
          'Cancelled — Booking cancelled.'
        ]
      }
    ]
  },
  {
    step: 8,
    slug: 'coupons-and-discounts',
    title: 'Coupons & Discounts',
    summary: 'Create discount codes that customers can enter at checkout.',
    keywords: ['coupon', 'discount', 'promo', 'percentage', 'fixed amount', 'minimum spend', 'code', 'active'],
    images: [
      { src: '/support/images/image21.png', alt: 'Create a coupon' },
    ],
    sections: [
      {
        heading: 'Create a Coupon',
        points: [
          'Go to Settings → Coupons.',
          'Tap + Add Coupon.',
          'Enter the coupon code (automatically converted to uppercase).',
          'Select the discount type: Percentage (discount as a % of the order, e.g. 10%) or Fixed Amount (discount as a fixed dollar amount, e.g. $5.00).',
          'Enter the discount value.',
          'Optionally set a minimum order value — the coupon only applies if the order total meets this amount.',
          'Optionally add a description.',
          'Save.'
        ]
      },
      {
        heading: 'Manage Coupons',
        points: [
          'View all coupons in the list with their code, type, value, and minimum.',
          'Toggle Active/Inactive per coupon.',
          'Edit or delete coupons as needed.',
          "Customers enter the coupon code in the cart before submitting. The system validates the code, checks if it's active, verifies the order meets the minimum, then applies the discount automatically."
        ]
      }
    ]
  },
  {
    step: 9,
    slug: 'payment-terminal-setup',
    title: 'Payment Terminal Setup',
    summary: 'Connect a payment terminal so customers can pay by card, Alipay, WeChat Pay, Octopus, FPS, and more.',
    keywords: ['kpay', 'payment asia', 'terminal', 'app id', 'secret', 'device ip', 'card payment', 'alipay', 'wechat', 'octopus', 'fps', 'sandbox'],
    images: [
      { src: '/support/images/image22.png', alt: 'Payment terminal setup' },
      { src: '/support/images/image23.png', alt: 'Terminal credentials configuration' },
    ],
    sections: [
      {
        heading: 'KPay Terminal',
        points: [
          'Go to Settings → Payment Terminals.',
          'Tap + Add Terminal.',
          'Select KPay as the vendor.',
          'Enter: App ID, App Secret, Terminal IP (default: 192.168.50.210 — check the terminal for the IP Address), Terminal Port (default: 18080 — check the terminal for the Port), and Endpoint Path (default: /v2/pos/sign).',
          'Tap Test Connection to verify.',
          'Save.'
        ]
      },
      {
        heading: 'Payment Asia Terminal',
        points: [
          'Go to Settings → Payment Terminals.',
          'Tap + Add Terminal.',
          'Select Payment Asia as the vendor.',
          'Enter: Merchant Token, Secret Code, and Environment (Sandbox for testing or Production for live).',
          'Tap Test Connection to verify.',
          'Save.',
          'Tip: Always run a test transaction after setting up a terminal. You can manage, edit, or delete terminals from the terminal list.'
        ]
      }
    ]
  },
  {
    step: 10,
    slug: 'kitchen-display',
    title: 'Kitchen Display',
    summary: 'The Kitchen Display shows incoming orders in real time so kitchen staff can track and update preparation status.',
    keywords: ['kitchen', 'kds', 'pending', 'preparing', 'ready', 'served', 'category filter', 'clock in', 'print ticket'],
    images: [
      { src: '/support/images/image24.png', alt: 'Kitchen display order queue' },
    ],
    sections: [
      {
        heading: 'How It Works',
        points: [
          'Kitchen staff log in with their PIN.',
          'Clock in to start their shift.',
          'Orders appear automatically as cards, grouped by order.',
          'Each card shows: order number, table name, order type, items (with variants and notes), and time since order was placed.'
        ]
      },
      {
        heading: 'Updating Order Status',
        points: [
          'Tap an order card to update item status: Pending → Confirmed → Preparing → Ready.',
          'The card displays the least ready status across all items (e.g. if one item is Pending, the whole order shows Pending).'
        ]
      },
      {
        heading: 'Filtering & Printing',
        points: [
          'Filter orders by food category (kitchen staff only see their assigned categories).',
          'Filter by order status.',
          'Tap the print icon on an order card to manually print a kitchen ticket.',
          'Select the printer if multiple are configured.',
          'Auto-print handles new orders automatically if configured.'
        ]
      }
    ]
  },
  {
    step: 11,
    slug: 'reports-and-analytics',
    title: 'Reports & Analytics',
    summary: "Track your restaurant's performance with built-in analytics.",
    keywords: ['reports', 'analytics', 'revenue', 'top items', 'hourly', 'daily trends', 'metrics', 'total orders', 'average bill'],
    images: [
      { src: '/support/images/image25.png', alt: 'Reports dashboard' },
      { src: '/support/images/image26.png', alt: 'Revenue analytics breakdown' },
    ],
    sections: [
      {
        heading: 'Accessing Reports',
        points: [
          'Open the Reports tab.',
          'Select a date range: Today, Last 7 Days, Last 30 Days, or All Time.'
        ]
      },
      {
        heading: 'Key Metrics',
        points: [
          'Total Orders',
          'Total Revenue',
          'Average Bill',
          'Active Sessions'
        ]
      },
      {
        heading: 'Available Reports',
        points: [
          'Top Items — Best-selling items ranked by quantity sold and revenue.',
          'Top Tables — Revenue and order count by table.',
          'Hourly Breakdown — Revenue and orders by hour of day (identify peak hours).',
          'Daily Trends — Revenue and orders over time.'
        ]
      }
    ]
  },
  {
    step: 12,
    slug: 'bill-printing',
    title: 'Bill Printing',
    summary: 'Configure bill printer hardware and receipt format, then validate with test bill output.',
    keywords: ['bill printing', 'receipt', 'paper width', '58mm', '80mm', 'bill format', 'footer', 'logo', 'test bill', 'auto print'],
    images: [
      { src: '/support/images/image27.png', alt: 'Restaraurant QR settings' },
      { src: '/support/images/image28.png', alt: 'Select QR Mode' },
      { src: '/support/images/image29.png', alt: 'Configure bill print layout' },
    ],
    sections: [
      {
        heading: 'Configure Bill Printer',
        points: [
          'Go to Printer Settings and open Bill Printer.',
          'Select the bill printer device and confirm connection.',
          'Set bill format options: Paper width (58mm or 80mm), show logo / table number / pax / footer text, and item and total layout.',
          'Use Print Test Bill to verify alignment and readability.',
          'Save settings.'
        ]
      },
      {
        heading: 'How Bill Printing Works',
        points: [
          'When closing a bill (or when auto-print is enabled), the system automatically prints the customer bill from this bill printer configuration.',
          'QR printing is for table QR slips only.',
          'Bill printing is for payment receipts and final bills.'
        ]
      }
    ]
  },
  {
    step: 13,
    slug: 'customer-ordering-flow',
    title: 'Customer Ordering Flow',
    summary: 'Test the customer experience before going live. Always perform a full test order before opening.',
    keywords: ['customer flow', 'scan qr', 'menu', 'cart', 'checkout', 'coupon', 'order submit', 'go live', 'checklist'],
    images: [],
    sections: [
      {
        heading: 'End-to-End Test',
        points: [
          'Scan a table QR code with a phone camera.',
          'The restaurant menu loads automatically in the browser.',
          'Browse categories, tap items to view details.',
          'If an item has variants (e.g. Size), select the required options.',
          'If an item is a combo/meal, choose optional add-ons at a discounted price.',
          'Add items to cart.',
          'Review the cart — adjust quantities, add item notes.',
          'Enter a coupon code if applicable.',
          'Submit the order.',
          'Verify the order appears in the Orders tab and Kitchen Display.'
        ]
      },
      {
        heading: 'Go-Live Checklist',
        points: [
          'Menu created with categories, items, prices, and images.',
          'Variants and addons configured where needed.',
          'Tables created and assigned to categories/rooms.',
          'QR codes generated, printed, and placed on tables.',
          'Staff accounts created with correct roles and access rights.',
          'Printers configured and tested (kitchen, bill, QR).',
          'Payment terminal connected and test transaction completed.',
          'Coupons created (if applicable).',
          'Full test order completed end-to-end (scan → order → kitchen → payment).',
          'QR code mode selected (Regenerate / Static Table / Static Seat).',
          'Your system is now ready for live customers.'
        ]
      }
    ]
  }
];
