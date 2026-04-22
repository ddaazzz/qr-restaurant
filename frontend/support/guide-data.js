window.CHUIO_GUIDE_TOPICS = [
  {
    step: 1,
    slug: 'menu-setup',
    title: 'Menu Setup',
    summary: 'Set up categories, menu items, variants, and combos/add-ons before going live.',
    keywords: ['menu', 'category', 'item', 'variant', 'addons', 'combo', 'price', 'image'],
    images: [
      { src: '/support/images/image1.png', alt: 'Menu Setup overview' },
      { src: '/support/images/image2.png', alt: 'Adding a menu category' },
      { src: '/support/images/image3.png', alt: 'Adding a menu item' },
      { src: '/support/images/image4.png', alt: 'Configuring item variants' },
      { src: '/support/images/image5.png', alt: 'Setting up combos and add-ons' },
      { src: '/support/images/image6.png', alt: 'Menu item price and availability' },
    ],
    sections: [
      {
        heading: 'What You Configure',
        points: [
          'Create food categories to group items clearly.',
          'Add menu items with names, descriptions, prices, and images.',
          'Configure variants (for example size, toppings, and required choices).',
          'Set up combo and add-on structures for upselling.'
        ]
      },
      {
        heading: 'Recommended Checks',
        points: [
          'Verify each item appears in the correct category.',
          'Confirm variant pricing and required selection rules.',
          'Review item availability toggles before opening service.'
        ]
      }
    ]
  },
  {
    step: 2,
    slug: 'table-setup',
    title: 'Table Setup',
    summary: 'Configure table categories and physical tables, then prepare QR usage and table status flow.',
    keywords: ['table', 'tables', 'floor', 'section', 'qr', 'session', 'pax', 'status'],
    images: [
      { src: '/support/images/image7.png', alt: 'Table categories overview' },
      { src: '/support/images/image8.png', alt: 'Creating a table' },
      { src: '/support/images/image9.png', alt: 'Table QR code' },
      { src: '/support/images/image10.png', alt: 'Table status indicators' },
    ],
    sections: [
      {
        heading: 'What You Configure',
        points: [
          'Create table categories (for example Main Hall, Patio, VIP).',
          'Add table numbers and seat capacity.',
          'Generate QR and verify each code maps to the intended table.',
          'Understand and validate table states during operations.'
        ]
      },
      {
        heading: 'Recommended Checks',
        points: [
          'Scan random QR codes to verify routing correctness.',
          'Confirm table capacity and naming standards are consistent.'
        ]
      }
    ]
  },
  {
    step: 3,
    slug: 'staff-setup',
    title: 'Staff Setup',
    summary: 'Create users, assign PINs and roles, and ensure each role has correct permissions.',
    keywords: ['staff', 'users', 'pin', 'role', 'admin', 'kitchen', 'permissions', 'clock'],
    images: [
      { src: '/support/images/image11.png', alt: 'Staff list' },
      { src: '/support/images/image12.png', alt: 'Adding a staff member' },
      { src: '/support/images/image13.png', alt: 'Role permissions overview' },
    ],
    sections: [
      {
        heading: 'What You Configure',
        points: [
          'Add staff profiles and assign secure 6-digit PIN codes.',
          'Assign role access (Admin, Staff, Kitchen) based on responsibility.',
          'Enable clock-in and clock-out flow where applicable.'
        ]
      },
      {
        heading: 'Recommended Checks',
        points: [
          'Test login for each role on real devices.',
          'Validate restricted pages are not accessible to unauthorized roles.'
        ]
      }
    ]
  },
  {
    step: 4,
    slug: 'managing-orders',
    title: 'Managing Orders',
    summary: 'Monitor active orders, create POS orders, process payments, and handle void/refund actions.',
    keywords: ['orders', 'pos', 'table order', 'counter', 'to-go', 'payment', 'refund', 'void'],
    images: [
      { src: '/support/images/image14.png', alt: 'Orders overview' },
      { src: '/support/images/image15.png', alt: 'Creating a POS order' },
    ],
    sections: [
      {
        heading: 'Core Workflows',
        points: [
          'View and manage active incoming orders in real time.',
          'Create manual POS orders for Table, Counter, and To-Go scenarios.',
          'Process payment by cash or terminal integration.',
          'Handle void/refund according to store policy and audit requirements.'
        ]
      },
      {
        heading: 'Recommended Checks',
        points: [
          'Confirm status changes from pending to completed are reflected correctly.',
          'Review payment status and history records after each operation.'
        ]
      }
    ]
  },
  {
    step: 5,
    slug: 'managing-tables',
    title: 'Managing Tables',
    summary: 'Use the table dashboard to control sessions, pax, table moves, bills, and split operations.',
    keywords: ['tables', 'dashboard', 'session', 'move table', 'split bill', 'close bill', 'pax'],
    images: [],
    sections: [
      {
        heading: 'Core Workflows',
        points: [
          'Track table availability and occupancy in real time.',
          'Start, update, and end sessions from table management.',
          'Adjust pax count and move sessions to another table when needed.',
          'Print bills and manage bill-splitting at settlement time.'
        ]
      },
      {
        heading: 'Recommended Checks',
        points: [
          'Validate bill totals before closure.',
          'Confirm table state returns to available after settlement.'
        ]
      }
    ]
  },
  {
    step: 6,
    slug: 'printer-setup',
    title: 'Printer Setup',
    summary: 'Set up QR, Bill, Kitchen, and terminal-related printers with proper connection mode and test output.',
    keywords: ['printer', 'network printer', 'bluetooth printer', 'qr printer', 'bill printer', 'kitchen printer', 'test print'],
    images: [
      { src: '/support/images/image16.png', alt: 'Printer settings overview' },
      { src: '/support/images/image17.png', alt: 'Bill printer configuration' },
      { src: '/support/images/image18.png', alt: 'Kitchen printer settings' },
    ],
    sections: [
      {
        heading: 'What You Configure',
        points: [
          'Choose connection mode (Network IP or Bluetooth) per printer.',
          'Configure QR printer, Bill printer, Kitchen printer, and terminal print options.',
          'Enable or disable auto-print behavior by printer type.'
        ]
      },
      {
        heading: 'Recommended Checks',
        points: [
          'Run test print for each configured printer.',
          'Confirm content layout and cut behavior are correct.'
        ]
      }
    ]
  },
  {
    step: 7,
    slug: 'bookings',
    title: 'Bookings',
    summary: 'Manage reservations, guest details, statuses, and check-in flow into active sessions.',
    keywords: ['booking', 'reservation', 'calendar', 'guest', 'check in', 'session'],
    images: [
      { src: '/support/images/image19.png', alt: 'Bookings calendar view' },
      { src: '/support/images/image20.png', alt: 'Creating a booking' },
    ],
    sections: [
      {
        heading: 'Core Workflows',
        points: [
          'Create bookings with date, time, pax, and guest contact details.',
          'Track booking status throughout the day.',
          'Check in guests to convert reservation into an active table session.'
        ]
      },
      {
        heading: 'Recommended Checks',
        points: [
          'Prevent double-booking by monitoring overlapping slots.',
          'Ensure no-show and cancellation status updates are consistent.'
        ]
      }
    ]
  },
  {
    step: 8,
    slug: 'coupons-and-discounts',
    title: 'Coupons and Discounts',
    summary: 'Create and control fixed or percentage discounts with rules and active state management.',
    keywords: ['coupon', 'discount', 'promo', 'percentage', 'fixed amount', 'minimum spend'],
    images: [
      { src: '/support/images/image21.png', alt: 'Coupons and discounts list' },
    ],
    sections: [
      {
        heading: 'What You Configure',
        points: [
          'Create coupon codes using fixed amount or percentage discounts.',
          'Set minimum spend and validity conditions.',
          'Enable or disable codes as campaigns change.'
        ]
      },
      {
        heading: 'Recommended Checks',
        points: [
          'Test coupon application in both table and counter checkout flows.',
          'Validate discount calculation in final bill summary.'
        ]
      }
    ]
  },
  {
    step: 9,
    slug: 'payment-terminal-setup',
    title: 'Payment Terminal Setup',
    summary: 'Integrate KPay or Payment Asia terminals and verify end-to-end payment execution.',
    keywords: ['kpay', 'payment asia', 'terminal', 'app id', 'secret', 'device ip', 'card payment'],
    images: [
      { src: '/support/images/image22.png', alt: 'Payment terminal setup' },
      { src: '/support/images/image23.png', alt: 'Terminal credentials configuration' },
    ],
    sections: [
      {
        heading: 'What You Configure',
        points: [
          'Enter provider credentials such as App ID and Secret.',
          'Set terminal endpoint and network settings.',
          'Bind terminal flow to payment action in Orders and Tables.'
        ]
      },
      {
        heading: 'Recommended Checks',
        points: [
          'Run a small-value test transaction and confirm callback status.',
          'Verify failed and timeout states are handled clearly.'
        ]
      }
    ]
  },
  {
    step: 10,
    slug: 'kitchen-display',
    title: 'Kitchen Display',
    summary: 'Operate kitchen workflow with real-time order queue and item status progression.',
    keywords: ['kitchen', 'kds', 'pending', 'preparing', 'ready', 'served', 'category filter'],
    images: [
      { src: '/support/images/image24.png', alt: 'Kitchen display order queue' },
    ],
    sections: [
      {
        heading: 'Core Workflows',
        points: [
          'View incoming orders in kitchen queue in real time.',
          'Update item status from pending to preparing to ready.',
          'Filter by category to reduce noise during peak hours.'
        ]
      },
      {
        heading: 'Recommended Checks',
        points: [
          'Confirm status updates reflect in front-of-house screens quickly.',
          'Validate completed items are removed or grouped correctly.'
        ]
      }
    ]
  },
  {
    step: 11,
    slug: 'reports-and-analytics',
    title: 'Reports and Analytics',
    summary: 'Track revenue and operations performance using daily, hourly, and item-level metrics.',
    keywords: ['reports', 'analytics', 'revenue', 'top items', 'hourly', 'daily trends', 'metrics'],
    images: [
      { src: '/support/images/image25.png', alt: 'Reports dashboard' },
      { src: '/support/images/image26.png', alt: 'Revenue analytics breakdown' },
    ],
    sections: [
      {
        heading: 'Key Insights',
        points: [
          'Review sales totals and order volume by date range.',
          'Analyze top-performing items and peak operating hours.',
          'Use trends to guide staffing and menu strategy.'
        ]
      },
      {
        heading: 'Recommended Checks',
        points: [
          'Cross-check report values with sample completed orders.',
          'Export and archive regular snapshots for management review.'
        ]
      }
    ]
  },
  {
    step: 12,
    slug: 'bill-printing',
    title: 'Bill Printing',
    summary: 'Configure bill printer hardware and receipt format, then validate with test bill output.',
    keywords: ['bill printing', 'receipt', 'paper width', '58mm', '80mm', 'bill format', 'footer', 'logo'],
    images: [
      { src: '/support/images/image27.png', alt: 'Bill printer settings' },
      { src: '/support/images/image28.png', alt: 'Bill format configuration' },
      { src: '/support/images/image29.png', alt: 'Test bill print output' },
    ],
    sections: [
      {
        heading: 'What You Configure',
        points: [
          'Open Bill Printer settings and select the output device.',
          'Set bill format options such as paper width, logo visibility, table info, and footer text.',
          'Choose content visibility for item lines, subtotal, tax, and totals.'
        ]
      },
      {
        heading: 'Validation Flow',
        points: [
          'Run Print Test Bill and inspect alignment and readability.',
          'Save settings and confirm bills print correctly during close-bill checkout.',
          'Use bill printing for final receipt output; do not duplicate QR setup instructions here.'
        ]
      }
    ]
  },
  {
    step: 13,
    slug: 'customer-ordering-flow',
    title: 'Customer Ordering Flow',
    summary: 'Test the full guest journey from scanning QR to checkout and post-order confirmation.',
    keywords: ['customer flow', 'scan qr', 'menu', 'cart', 'checkout', 'coupon', 'order submit'],
    images: [],
    sections: [
      {
        heading: 'End-to-End Test',
        points: [
          'Scan table QR and open menu on a customer device.',
          'Add items, variants, and optional add-ons to cart.',
          'Apply coupon (if any), submit order, and verify order received by kitchen.',
          'Confirm final checkout flow behaves as expected.'
        ]
      },
      {
        heading: 'Go-Live Checklist',
        points: [
          'Validate all critical flows on both iOS and Android browsers.',
          'Confirm print outputs, payment statuses, and table state synchronization.'
        ]
      }
    ]
  }
];
