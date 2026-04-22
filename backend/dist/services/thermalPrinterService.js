"use strict";
/**
 * SHARED THERMAL PRINTER SERVICE
 * Backend version - used by all printer routes to generate ESC/POS commands
 *
 * This is the SINGLE SOURCE OF TRUTH for receipt formatting.
 * Both mobile and web apps receive pre-generated ESC/POS from backend.
 * File: /backend/src/services/thermalPrinterService.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateESCPOS = generateESCPOS;
exports.generateKitchenOrderESCPOS = generateKitchenOrderESCPOS;
exports.generateKPayReceiptESCPOS = generateKPayReceiptESCPOS;
/**
 * Generate ESC/POS thermal printer commands
 * Returns Uint8Array of binary commands
 */
function generateESCPOS(receipt) {
    const commands = [];
    // === QR CODE ONLY RECEIPT (When no items) ===
    // For QR receipts, make QR code the dominant element covering full paper
    const qrDomain = process.env.CHUIO_DOMAIN || 'chuio.io';
    const qrData = receipt.qrToken ? `https://${qrDomain}/${receipt.qrToken}` : receipt.qrCode;
    if (qrData && (!receipt.items || receipt.items.length === 0)) {
        // QR-only layout: matches preview format exactly
        // === RESTAURANT NAME - CENTERED BOLD ===
        commands.push(27, 97, 1); // ESC 'a' 1 - Center
        if (receipt.restaurantName && receipt.restaurantName !== 'QR Code') {
            commands.push(27, 33, 8); // ESC '!' 8 - Bold
            appendText(commands, receipt.restaurantName);
            commands.push(27, 33, 0); // ESC '!' 0 - Normal
        }
        else {
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
    }
    else {
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
            const maxItemNameLen = 24;
            const displayName = item.name.length > maxItemNameLen
                ? item.name.substring(0, maxItemNameLen - 1)
                : item.name;
            if (priceStr) {
                // Create justified line: name and qty on left, price on right
                const qtyDisplay = `${displayName} ${qtyStr}`;
                const padding = Math.max(0, 32 - qtyDisplay.length - priceStr.length);
                const line = qtyDisplay + ' '.repeat(Math.max(1, padding)) + priceStr;
                appendText(commands, line);
            }
            else {
                appendText(commands, `${displayName} ${qtyStr}`);
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
function appendQRCode(commands, qrData, printerPaperWidth) {
    const dataBytes = [];
    for (let i = 0; i < qrData.length; i++) {
        dataBytes.push(qrData.charCodeAt(i));
    }
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
 * Append text to commands array (TypeScript version)
 */
function appendText(commands, text) {
    for (let i = 0; i < text.length; i++) {
        commands.push(text.charCodeAt(i));
    }
}
/**
 * Generate ESC/POS commands for kitchen order tickets
 * Optimized for TM-U220 Impact Printer (dot-matrix)
 */
function generateKitchenOrderESCPOS(data) {
    const commands = [];
    const sep = '================================';
    const lineWidth = 33;
    commands.push(27, 64); // ESC @ - Initialize
    commands.push(27, 97, 1); // Center
    commands.push(27, 33, 8); // Bold
    appendText(commands, 'KITCHEN ORDER');
    commands.push(27, 33, 0); // Bold off
    commands.push(10);
    appendText(commands, sep);
    commands.push(10);
    commands.push(27, 97, 0); // Left align
    commands.push(10);
    commands.push(27, 33, 8);
    appendText(commands, `Order #${data.orderNumber}`);
    commands.push(27, 33, 0);
    commands.push(10);
    commands.push(27, 33, 8);
    appendText(commands, `Table: ${data.tableNumber}`);
    commands.push(27, 33, 0);
    commands.push(10);
    appendText(commands, `Time:  ${data.timestamp}`);
    commands.push(10, 10);
    appendText(commands, sep);
    commands.push(10);
    for (const item of data.items) {
        commands.push(10);
        commands.push(27, 33, 8);
        const itemLine = `${item.quantity}x ${item.name}`;
        appendText(commands, itemLine.length > lineWidth ? itemLine.substring(0, lineWidth) : itemLine);
        commands.push(27, 33, 0);
        commands.push(10);
        if (item.variants) {
            const variantLine = `   ${item.variants}`;
            appendText(commands, variantLine.length > lineWidth ? variantLine.substring(0, lineWidth) : variantLine);
            commands.push(10);
        }
        if (item.notes) {
            const noteLine = `   * ${item.notes}`;
            appendText(commands, noteLine.length > lineWidth ? noteLine.substring(0, lineWidth) : noteLine);
            commands.push(10);
        }
    }
    commands.push(10);
    appendText(commands, sep);
    commands.push(10, 10);
    if (data.restaurantName) {
        commands.push(27, 97, 1);
        appendText(commands, data.restaurantName);
        commands.push(10);
    }
    commands.push(10, 10, 10, 10, 10); // 5 line feeds
    commands.push(29, 86, 1); // GS V 1 - Partial cut
    return new Uint8Array(commands);
}
/**
 * Generate ESC/POS commands for a KPay payment receipt
 */
function generateKPayReceiptESCPOS(data) {
    const commands = [];
    const sep = '================================';
    commands.push(27, 64); // ESC @ - Initialize
    // Restaurant name centered bold
    commands.push(27, 97, 1); // Center
    commands.push(27, 33, 8); // Bold
    appendText(commands, data.restaurantName);
    commands.push(27, 33, 0); // Bold off
    commands.push(10);
    // Title
    commands.push(27, 97, 1);
    appendText(commands, sep);
    commands.push(10);
    commands.push(27, 33, 8);
    appendText(commands, '     PAYMENT RECEIPT');
    commands.push(27, 33, 0);
    commands.push(10);
    appendText(commands, sep);
    commands.push(10, 10);
    // Details left aligned
    commands.push(27, 97, 0);
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
    const amountStr = `${data.currency} ${(data.amountCents / 100).toFixed(2)}`;
    commands.push(27, 33, 8);
    appendText(commands, `Amount:  ${amountStr}`);
    commands.push(27, 33, 0);
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
    commands.push(10);
    commands.push(27, 97, 1);
    appendText(commands, sep);
    commands.push(10);
    appendText(commands, '    Thank you for dining!');
    commands.push(10);
    appendText(commands, sep);
    commands.push(10, 10);
    commands.push(27, 100, 5);
    commands.push(27, 105);
    return new Uint8Array(commands);
}
//# sourceMappingURL=thermalPrinterService.js.map