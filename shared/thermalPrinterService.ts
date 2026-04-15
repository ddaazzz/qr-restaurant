/**
 * SHARED THERMAL PRINTER SERVICE
 * Used by both Mobile and Web apps to generate identical ESC/POS thermal printer commands
 * Location: /shared/thermalPrinterService.ts
 * 
 * This is the SINGLE SOURCE OF TRUTH for receipt formatting.
 * Both apps must import and use this service to ensure synchronization.
 * 
 * Supported Printers:
 * - TM-T82 (Thermal): QR codes, Bill receipts, KPay receipts
 * - TM-U220 (Impact/Dot-matrix): Kitchen orders only (no graphics/QR support)
 */

export interface ReceiptData {
  orderNumber?: string;
  tableNumber?: string;
  tableName?: string;
  pax?: number;
  startTime?: string;
  startedTime?: string;
  items?: Array<{ name: string; quantity: number; price?: number; isAddon?: boolean }>;
  subtotal?: number;
  serviceCharge?: number;
  tax?: number;
  total?: number;
  timestamp?: string;
  restaurantName?: string;
  restaurantAddress?: string; // Restaurant address for bill printing
  restaurantPhone?: string; // Restaurant phone for bill printing
  qrToken?: string; // QR token (will be converted to full URL)
  qrCode?: string; // Full QR code data/URL to print
  printerPaperWidth?: number; // Paper width in mm (80 for standard, 58 for smaller)
  // QR format customization from database settings
  qrTextAbove?: string; // Customizable text above QR (e.g., "Scan to Order")
  qrTextBelow?: string; // Customizable text below QR (e.g., "Let us know how we did!")
  // Bill format customization from database settings
  billHeaderText?: string; // Customizable header text for bills (e.g., "Thank You")
  billFooterText?: string; // Customizable footer text for bills (e.g., "Follow us on social media")
}

/**
 * Generate ESC/POS thermal printer commands
 * Returns Uint8Array of binary commands
 */
export function generateESCPOS(receipt: ReceiptData): Uint8Array {
  const commands: number[] = [];

  // === QR CODE ONLY RECEIPT (When no items) ===
  // For QR receipts, make QR code the dominant element covering full paper
  const qrData = receipt.qrToken ? `https://chuio.io/${receipt.qrToken}` : receipt.qrCode;
  
  if (qrData && (!receipt.items || receipt.items.length === 0)) {
    // QR-only layout: matches preview format exactly
    
    // === RESTAURANT NAME - CENTERED BOLD ===
    commands.push(27, 97, 1); // ESC 'a' 1 - Center
    if (receipt.restaurantName && receipt.restaurantName !== 'QR Code') {
      commands.push(27, 33, 8); // ESC '!' 8 - Bold
      appendText(commands, receipt.restaurantName);
      commands.push(27, 33, 0); // ESC '!' 0 - Normal
    } else {
      appendText(commands, 'Receipt');
    }
    commands.push(10);
    
    // === SEPARATOR LINE ===
    appendText(commands, '================================');
    commands.push(10, 10); // LF x2
    
    // === TABLE INFO - LEFT ALIGNED ===
    commands.push(27, 97, 0); // ESC 'a' 0 - Left align
    
    if (receipt.tableNumber || receipt.tableName) {
      appendText(commands, `Table: ${receipt.tableNumber || receipt.tableName}`);
      commands.push(10);
    }
    
    if (receipt.pax) {
      appendText(commands, `Pax: ${receipt.pax}`);
      commands.push(10);
    }
    
    const timeStr = receipt.startTime || receipt.startedTime || receipt.timestamp;
    if (timeStr) {
      appendText(commands, `Started: ${timeStr}`);
      commands.push(10);
    }
    
    commands.push(10); // LF
    
    // === TEXT ABOVE QR CODE - CENTERED BOLD (appears BEFORE QR) ===
    commands.push(27, 97, 1); // ESC 'a' 1 - Center
    commands.push(27, 33, 8); // ESC '!' 8 - Bold
    appendText(commands, receipt.qrTextAbove || 'Scan to Order');
    commands.push(27, 33, 0); // ESC '!' 0 - Normal
    commands.push(10, 10); // LF x2
    
    // === SEPARATOR LINE ===
    appendText(commands, '================================');
    commands.push(10, 10); // LF x2
    
    // === LARGE QR CODE - CENTERED ===
    commands.push(27, 97, 1); // ESC 'a' 1 - Center
    appendQRCode(commands, qrData, receipt.printerPaperWidth);
    commands.push(10, 10); // LF x2
    
    // === TEXT BELOW QR CODE - CENTERED (appears AFTER QR) ===
    commands.push(27, 97, 1); // ESC 'a' 1 - Center
    appendText(commands, receipt.qrTextBelow || 'Let us know how we did!');
    commands.push(10, 10); // LF x2
    
    // Paper feed and cut
    commands.push(27, 100, 5); // ESC d 5 - Feed paper 5 lines
    commands.push(27, 105); // ESC i - Full cut
    
    return new Uint8Array(commands);
  }

  // === REGULAR RECEIPT WITH ITEMS (BILLS/ORDERS) ===
  // Center align header
  commands.push(27, 97, 1); // ESC 'a' 1 - Center

  // === RESTAURANT NAME - BOLD ===
  if (receipt.restaurantName) {
    commands.push(27, 33, 8); // ESC '!' 8 - Bold on
    appendText(commands, receipt.restaurantName);
    commands.push(27, 33, 0); // ESC '!' 0 - Bold off
    commands.push(10); // LF
  } else {
    appendText(commands, 'RECEIPT');
    commands.push(10);
  }

  // === RESTAURANT ADDRESS AND PHONE (CENTERED, SMALLER) ===
  if (receipt.restaurantAddress) {
    appendText(commands, receipt.restaurantAddress);
    commands.push(10);
  }
  if (receipt.restaurantPhone) {
    appendText(commands, receipt.restaurantPhone);
    commands.push(10);
  }

  // === SEPARATOR LINE ===
  appendText(commands, '========================================');
  commands.push(10, 10); // LF x2

  // === DETAIL SECTION - LEFT ALIGNED ===
  commands.push(27, 97, 0); // ESC 'a' 0 - Left align

  // Print table and pax info
  if (receipt.tableNumber || receipt.tableName) {
    appendText(commands, `Table: ${receipt.tableNumber || receipt.tableName}`);
    commands.push(10);
  }
  if (receipt.pax) {
    appendText(commands, `Pax: ${receipt.pax}`);
    commands.push(10);
  }

  // Print timestamp
  const timestamp = receipt.timestamp || receipt.startTime || receipt.startedTime;
  if (timestamp) {
    appendText(commands, `Time: ${timestamp}`);
    commands.push(10);
  }

  commands.push(10); // LF

  // === SEPARATOR ===
  appendText(commands, '========================================');
  commands.push(10, 10);

  // === ITEMS SECTION ===
  if (receipt.items && receipt.items.length > 0) {
    for (const item of receipt.items) {
      const qtyStr = `x${item.quantity}`;
      const priceStr = item.price ? (item.price / 100).toFixed(2) : '';

      // Format: "Item Name x#     Price" (right-aligned price)
      // Calculate spacing: max 32 chars per line
      const maxItemNameLen = item.isAddon ? 20 : 24;
      const prefix = item.isAddon ? '  + ' : '';
      const displayName = item.name.length > maxItemNameLen 
        ? item.name.substring(0, maxItemNameLen - 1) 
        : item.name;
      
      if (priceStr) {
        // Create justified line: name and qty on left, price on right
        const qtyDisplay = `${prefix}${displayName} ${qtyStr}`;
        const padding = Math.max(0, 32 - qtyDisplay.length - priceStr.length);
        const line = qtyDisplay + ' '.repeat(Math.max(1, padding)) + priceStr;
        appendText(commands, line);
      } else {
        appendText(commands, `${prefix}${displayName} ${qtyStr}`);
      }
      commands.push(10);
    }

    commands.push(10); // LF

    // === SEPARATOR ===
    appendText(commands, '========================================');
    commands.push(10, 10);
  }

  // === TOTALS SECTION (LEFT ALIGNED) ===
  commands.push(27, 97, 0); // ESC 'a' 0 - Left align

  if (receipt.subtotal !== undefined) {
    const subtotalStr = (receipt.subtotal / 100).toFixed(2);
    const subtotalPadding = Math.max(1, 32 - 'Subtotal'.length - subtotalStr.length);
    const subtotalLine = 'Subtotal' + ' '.repeat(subtotalPadding) + subtotalStr;
    appendText(commands, subtotalLine);
    commands.push(10);
  }

  if (receipt.serviceCharge && receipt.serviceCharge > 0) {
    const chargeStr = (receipt.serviceCharge / 100).toFixed(2);
    const chargePadding = Math.max(1, 32 - 'Service Charge'.length - chargeStr.length);
    const chargeLine = 'Service Charge' + ' '.repeat(chargePadding) + chargeStr;
    appendText(commands, chargeLine);
    commands.push(10);
  }

  if (receipt.tax && receipt.tax > 0) {
    const taxStr = (receipt.tax / 100).toFixed(2);
    const taxPadding = Math.max(1, 32 - 'Tax'.length - taxStr.length);
    const taxLine = 'Tax' + ' '.repeat(taxPadding) + taxStr;
    appendText(commands, taxLine);
    commands.push(10);
  }

  if (receipt.total !== undefined) {
    // Bold text for total
    commands.push(27, 33, 8); // ESC '!' 8 - Bold on
    const totalStr = (receipt.total / 100).toFixed(2);
    const totalPadding = Math.max(1, 32 - 'TOTAL'.length - totalStr.length);
    const totalLine = 'TOTAL' + ' '.repeat(totalPadding) + totalStr;
    appendText(commands, totalLine);
    commands.push(27, 33, 0); // ESC '!' 0 - Bold off
    commands.push(10);
  }

  commands.push(10, 10); // LF x2

  // === FOOTER SECTION ===
  // For bills, use custom header and footer text
  commands.push(27, 97, 1); // ESC 'a' 1 - Center

  if (receipt.billHeaderText) {
    commands.push(27, 33, 8); // ESC '!' 8 - Bold on
    appendText(commands, receipt.billHeaderText);
    commands.push(27, 33, 0); // ESC '!' 0 - Bold off
    commands.push(10);
  }

  if (receipt.billFooterText) {
    appendText(commands, receipt.billFooterText);
    commands.push(10);
  }

  commands.push(10, 10); // LF x2

  // === QR CODE SECTION ===
  if (qrData) {
    commands.push(27, 97, 1); // ESC 'a' 1 - Center
    appendQRCode(commands, qrData, receipt.printerPaperWidth);
    commands.push(10, 10); // LF x2
  }

  // === FOOTER SECTION ===
  commands.push(27, 97, 1); // ESC 'a' 1 - Center
  
  const footerTime = receipt.startTime || receipt.startedTime || receipt.timestamp;
  if (footerTime) {
    appendText(commands, `Time: ${footerTime}`);
    commands.push(10);
  }
  
  // Use billFooterText if provided (bill receipts), otherwise use qrTextBelow (regular receipts)
  const footerText = receipt.billFooterText || receipt.qrTextBelow || 'Scan to Place Order';
  appendText(commands, footerText);
  commands.push(10, 10, 10); // LF x3

  // === PAPER FEED BEFORE CUT ===
  commands.push(27, 100, 5); // ESC d 5 - Feed paper 5 lines

  // === PAPER CUT ===
  commands.push(27, 105); // ESC i - Full cut

  return new Uint8Array(commands);
}

/**
 * Add ESC/POS QR code commands using GS(k format
 * Module size: 12=large (80mm), 10=medium (58mm)
 */
function appendQRCode(
  commands: number[],
  qrData: string,
  printerPaperWidth?: number
): void {
  const dataBytes = qrData.split('').map(c => c.charCodeAt(0));
  const dataLength = dataBytes.length;
  
  // Adaptive module size based on printer paper width
  // 80mm printers: module size 12 (fills paper width)
  // 58mm printers: module size 10 (fills paper width)
  let moduleSize = 12;
  if (printerPaperWidth && printerPaperWidth < 70) {
    moduleSize = 10;
  }
  
  // Set QR code model 2: GS ( k pL pH 49 65 50 model
  commands.push(29, 40, 107); // GS ( k
  commands.push(4, 0); // pL=4, pH=0
  commands.push(49, 65); // cn=49, fnm=65
  commands.push(50); // model=50 (Model 2)
  commands.push(0);
  
  // Set QR code size: GS ( k pL pH 49 67 size
  commands.push(29, 40, 107); // GS ( k
  commands.push(3, 0); // pL=3, pH=0
  commands.push(49, 67); // cn=49, fnm=67
  commands.push(moduleSize);
  
  // Set QR code data: GS ( k pL pH 49 80 48 d...
  const pL = (dataLength + 3) & 0xFF;
  const pH = ((dataLength + 3) >> 8) & 0xFF;
  commands.push(29, 40, 107); // GS ( k
  commands.push(pL, pH);
  commands.push(49, 80); // cn=49, fnm=80
  commands.push(48); // fn2=48
  for (const byte of dataBytes) {
    commands.push(byte);
  }
  
  // Print QR code: GS ( k pL pH 49 81 48
  commands.push(29, 40, 107); // GS ( k
  commands.push(3, 0); // pL=3, pH=0
  commands.push(49, 81); // cn=49, fnm=81
  commands.push(48);
}

/**
 * Append text to commands array
 */
function appendText(commands: number[], text: string): void {
  for (let i = 0; i < text.length; i++) {
    commands.push(text.charCodeAt(i));
  }
}

export interface KitchenOrderData {
  orderNumber: string;
  tableNumber: string;
  items: Array<{ name: string; quantity: number; variants?: string; notes?: string; isAddon?: boolean }>;
  timestamp: string;
  restaurantName?: string;
}

/**
 * Generate ESC/POS commands for kitchen order tickets
 * Optimized for TM-U220 Impact Printer (dot-matrix)
 * - No QR codes or graphics (impact printers cannot print raster images)
 * - Uses GS V for paper cut instead of ESC i (not supported on TM-U220)
 * - Uses multiple LFs for paper feed instead of ESC d (limited support)
 * - 33 columns at Font A on 76mm paper
 */
export function generateKitchenOrderESCPOS(data: KitchenOrderData): Uint8Array {
  const commands: number[] = [];
  const sep = '================================';
  const lineWidth = 33; // TM-U220 columns at Font A

  // === INITIALIZE ===
  commands.push(27, 64); // ESC @ - Initialize printer

  // === HEADER: KITCHEN ORDER - CENTERED BOLD ===
  commands.push(27, 97, 1); // ESC a 1 - Center
  commands.push(27, 33, 8); // ESC ! 8 - Bold on
  appendText(commands, 'KITCHEN ORDER');
  commands.push(27, 33, 0); // ESC ! 0 - Bold off
  commands.push(10); // LF

  // === SEPARATOR ===
  appendText(commands, sep);
  commands.push(10);

  // === ORDER INFO - LEFT ALIGNED ===
  commands.push(27, 97, 0); // ESC a 0 - Left align
  commands.push(10); // LF

  // Order number - bold
  commands.push(27, 33, 8); // Bold
  appendText(commands, `Order #${data.orderNumber}`);
  commands.push(27, 33, 0); // Bold off
  commands.push(10);

  // Table
  commands.push(27, 33, 8); // Bold
  appendText(commands, `Table: ${data.tableNumber}`);
  commands.push(27, 33, 0); // Bold off
  commands.push(10);

  // Time
  appendText(commands, `Time:  ${data.timestamp}`);
  commands.push(10, 10);

  // === SEPARATOR ===
  appendText(commands, sep);
  commands.push(10);

  // === ITEMS - LEFT ALIGNED, BOLD ITEM NAMES ===
  for (const item of data.items) {
    commands.push(10); // spacing between items

    // Item line: "qty x ItemName" in bold (addons indented with + prefix)
    if (item.isAddon) {
      const addonLine = `  + ${item.quantity}x ${item.name}`;
      appendText(commands, addonLine.length > lineWidth ? addonLine.substring(0, lineWidth) : addonLine);
      commands.push(10);
    } else {
      commands.push(27, 33, 8); // Bold
      const itemLine = `${item.quantity}x ${item.name}`;
      appendText(commands, itemLine.length > lineWidth ? itemLine.substring(0, lineWidth) : itemLine);
      commands.push(27, 33, 0); // Bold off
      commands.push(10);
    }

    // Variants (if any) - indented
    if (item.variants) {
      const variantLine = `   ${item.variants}`;
      appendText(commands, variantLine.length > lineWidth ? variantLine.substring(0, lineWidth) : variantLine);
      commands.push(10);
    }

    // Notes (if any) - indented with marker
    if (item.notes) {
      const noteLine = `   * ${item.notes}`;
      appendText(commands, noteLine.length > lineWidth ? noteLine.substring(0, lineWidth) : noteLine);
      commands.push(10);
    }
  }

  commands.push(10); // LF

  // === FOOTER SEPARATOR ===
  appendText(commands, sep);
  commands.push(10, 10);

  // === RESTAURANT NAME (if provided) ===
  if (data.restaurantName) {
    commands.push(27, 97, 1); // Center
    appendText(commands, data.restaurantName);
    commands.push(10);
  }

  // === PAPER FEED (multiple LFs - ESC d not reliably supported on TM-U220) ===
  commands.push(10, 10, 10, 10, 10); // 5 line feeds

  // === PAPER CUT - GS V (supported by TM-U220, ESC i is NOT) ===
  commands.push(29, 86, 1); // GS V 1 - Partial cut

  return new Uint8Array(commands);
}

export interface KPayReceiptData {
  restaurantName: string;
  tableName?: string;
  orderRef?: string;
  transactionNo?: string;
  refNo?: string;
  paymentMethod?: string;
  amountCents: number;
  currency: string;
  timestamp: string;
  status: string;
  approvalCode?: string;
  printerPaperWidth?: number;
}

/**
 * Generate ESC/POS commands for a KPay payment receipt
 */
export function generateKPayReceiptESCPOS(data: KPayReceiptData): Uint8Array {
  const commands: number[] = [];
  const sep = '================================';

  // === INITIALIZE ===
  commands.push(27, 64); // ESC @ - Initialize

  // === HEADER: Restaurant name centered bold ===
  commands.push(27, 97, 1); // Center
  commands.push(27, 33, 8); // Bold
  appendText(commands, data.restaurantName);
  commands.push(27, 33, 0); // Bold off
  commands.push(10);

  // === TITLE ===
  commands.push(27, 97, 1); // Center
  appendText(commands, sep);
  commands.push(10);
  commands.push(27, 33, 8); // Bold
  appendText(commands, '     PAYMENT RECEIPT');
  commands.push(27, 33, 0); // Bold off
  commands.push(10);
  appendText(commands, sep);
  commands.push(10, 10);

  // === DETAILS - LEFT ALIGNED ===
  commands.push(27, 97, 0); // Left

  appendText(commands, `Date:    ${data.timestamp}`);
  commands.push(10);

  if (data.tableName) {
    appendText(commands, `Table:   ${data.tableName}`);
    commands.push(10);
  }

  if (data.orderRef) {
    appendText(commands, `Order:   ${data.orderRef}`);
    commands.push(10);
  }

  appendText(commands, '--------------------------------');
  commands.push(10);

  appendText(commands, `Payment: ${data.paymentMethod || 'KPay Terminal'}`);
  commands.push(10);

  // Amount in bold
  const amountStr = `${data.currency} ${(data.amountCents / 100).toFixed(2)}`;
  commands.push(27, 33, 8); // Bold
  appendText(commands, `Amount:  ${amountStr}`);
  commands.push(27, 33, 0); // Bold off
  commands.push(10);

  appendText(commands, `Status:  ${data.status}`);
  commands.push(10);

  if (data.refNo) {
    appendText(commands, `Ref No:  ${data.refNo}`);
    commands.push(10);
  }

  if (data.transactionNo) {
    appendText(commands, `Trans No:${data.transactionNo}`);
    commands.push(10);
  }

  if (data.approvalCode) {
    appendText(commands, `Approval:${data.approvalCode}`);
    commands.push(10);
  }

  // === FOOTER ===
  commands.push(10);
  commands.push(27, 97, 1); // Center
  appendText(commands, sep);
  commands.push(10);
  appendText(commands, '    Thank you for dining!');
  commands.push(10);
  appendText(commands, sep);
  commands.push(10, 10);

  // Feed + cut
  commands.push(27, 100, 5); // Feed 5 lines
  commands.push(27, 105);    // Full cut

  return new Uint8Array(commands);
}

export default { generateESCPOS, generateKitchenOrderESCPOS, generateKPayReceiptESCPOS };
