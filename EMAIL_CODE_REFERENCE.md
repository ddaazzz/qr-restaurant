# Email Service - Complete Implementation Reference

## Files Created/Modified

### 1. Backend Configuration

**File: `backend/src/config/emailConfig.ts`**
```typescript
import * as nodemailer from "nodemailer";

const emailConfig = {
  smtp: {
    host: process.env.CHUIO_SMTP_HOST || "smtp.chuio.io",
    port: parseInt(process.env.CHUIO_SMTP_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.CHUIO_SMTP_USER || process.env.CHUIO_EMAIL_ADDRESS,
      pass: process.env.CHUIO_SMTP_PASSWORD,
    },
  },
  from: process.env.CHUIO_EMAIL_ADDRESS || "noreply@chuio.io",
};

// Create transporter once (reusable)
let transporter: nodemailer.Transporter | null = null;

export const getEmailTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport(emailConfig.smtp);
  }
  return transporter;
};

export const getEmailFromAddress = () => emailConfig.from;

export default emailConfig;
```

**Purpose:** 
- Loads SMTP configuration from environment variables
- Creates singleton transporter for email sending
- Exports utilities for use throughout the app

---

### 2. Email Service

**File: `backend/src/services/emailService.ts`**
```typescript
import { getEmailTransporter, getEmailFromAddress } from "../config/emailConfig";

interface ReceiptEmailOptions {
  toEmail: string;
  orderNumber: string | number;
  content: string;
  restaurantName?: string;
}

interface OrderConfirmationOptions {
  toEmail: string;
  orderNumber: string | number;
  orderData: {
    items?: string[];
    total?: number;
    restaurantName?: string;
  };
}

// HTML receipt template
const getReceiptTemplate = (
  orderNumber: string | number,
  content: string,
  restaurantName: string = "Restaurant"
): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Arial', sans-serif;
          background-color: #f5f5f5;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #3498db;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          color: #2c3e50;
          font-size: 24px;
        }
        .order-number {
          color: #7f8c8d;
          font-size: 14px;
          margin-top: 5px;
        }
        .content {
          line-height: 1.6;
          color: #555;
        }
        .footer {
          border-top: 2px solid #ecf0f1;
          margin-top: 30px;
          padding-top: 20px;
          text-align: center;
          color: #7f8c8d;
          font-size: 12px;
        }
        .receipt-text {
          white-space: pre-wrap;
          font-family: 'Courier New', monospace;
          background-color: #f9f9f9;
          padding: 15px;
          border-radius: 4px;
          border-left: 4px solid #3498db;
          margin: 15px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${restaurantName}</h1>
          <div class="order-number">Order #${orderNumber}</div>
        </div>
        <div class="content">
          <p>Thank you for your order!</p>
          <div class="receipt-text">${content}</div>
          <p>If you have any questions, please don't hesitate to reach out to us.</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Send receipt email to customer
 */
export const sendReceipt = async (options: ReceiptEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const transporter = getEmailTransporter();
    const fromAddress = getEmailFromAddress();

    const htmlContent = getReceiptTemplate(
      options.orderNumber,
      options.content,
      options.restaurantName || "Restaurant"
    );

    const mailOptions = {
      from: fromAddress,
      to: options.toEmail,
      subject: `Receipt for Order #${options.orderNumber}`,
      html: htmlContent,
      text: `Receipt for Order #${options.orderNumber}\n\n${options.content}`,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Receipt sent to ${options.toEmail}. Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error(`❌ Failed to send receipt to ${options.toEmail}:`, error);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
};

/**
 * Send order confirmation email
 */
export const sendOrderConfirmation = async (
  options: OrderConfirmationOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const transporter = getEmailTransporter();
    const fromAddress = getEmailFromAddress();

    const itemsList = options.orderData.items?.length
      ? options.orderData.items.map((item) => `• ${item}`).join("\n")
      : "No items";

    const content = `
Order #${options.orderNumber}
${options.orderData.restaurantName || "Restaurant"}

Items:
${itemsList}

Total: $${options.orderData.total?.toFixed(2) || "0.00"}

Thank you for your order!
    `.trim();

    const htmlContent = getReceiptTemplate(
      options.orderNumber,
      content,
      options.orderData.restaurantName
    );

    const mailOptions = {
      from: fromAddress,
      to: options.toEmail,
      subject: `Order Confirmation #${options.orderNumber}`,
      html: htmlContent,
      text: content,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Order confirmation sent to ${options.toEmail}. Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error(`❌ Failed to send order confirmation to ${options.toEmail}:`, error);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
};

/**
 * Verify SMTP connection (for testing)
 */
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    const transporter = getEmailTransporter();
    await transporter.verify();
    console.log("✅ Email service verified successfully");
    return true;
  } catch (error: any) {
    console.error("❌ Email service verification failed:", error.message);
    return false;
  }
};

export default {
  sendReceipt,
  sendOrderConfirmation,
  verifyEmailConnection,
};
```

**Purpose:**
- Sends professional receipt emails
- Sends order confirmations
- Provides email verification
- Includes HTML templating with styling
- Comprehensive error handling

---

### 3. API Endpoint

**File: `backend/src/routes/orders.routes.ts`** (Addition)

```typescript
// Import at top
import { sendReceipt } from "../services/emailService";

// Add this new endpoint before export default
router.post("/restaurants/:restaurantId/orders/:orderId/send-receipt", async (req, res) => {
  const { restaurantId, orderId } = req.params;
  const { email, content } = req.body;

  // Validate input
  if (!email || !content) {
    return res.status(400).json({ error: "Email and content are required" });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    // Verify order exists and belongs to restaurant
    const orderRes = await pool.query(
      `SELECT id, restaurant_order_number FROM orders WHERE id = $1 AND restaurant_id = $2`,
      [orderId, restaurantId]
    );

    if (orderRes.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRes.rows[0];

    // Get restaurant name for email
    const restaurantRes = await pool.query(
      `SELECT name FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    const restaurantName = restaurantRes.rows[0]?.name || "Restaurant";

    // Send receipt email
    const result = await sendReceipt({
      toEmail: email,
      orderNumber: order.restaurant_order_number || orderId,
      content: content,
      restaurantName: restaurantName,
    });

    if (result.success) {
      res.json({
        success: true,
        message: "Receipt sent successfully",
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || "Failed to send receipt",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

**Purpose:**
- Handles POST request from frontend
- Validates email format
- Verifies order ownership
- Gets restaurant details
- Sends receipt via email service
- Returns status to frontend

---

### 4. Frontend Integration

**File: `frontend/admin-orders.js`** (Existing, shown for reference)

```javascript
async function emailReceipt(orderId) {
  try {
    const order = ORDERS.find(o => o.id === orderId);
    if (!order) {
      alert('Order not found');
      return;
    }

    // Prompt for email address
    const email = prompt('Enter email address to send receipt:', 'customer@example.com');
    if (!email) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Build email content
    let emailContent = `Order Receipt\n\n`;
    emailContent += `Order #${order.id}\n`;
    emailContent += `Date: ${new Date(order.created_at).toLocaleString()}\n\n`;
    emailContent += `Items:\n`;

    order.items.forEach(item => {
      const itemTotal = (item.item_total_cents / 100).toFixed(2);
      emailContent += `- ${item.menu_item_name} x${item.quantity}: $${itemTotal}\n`;
    });

    const totalAmount = (order.total_cents / 100).toFixed(2);
    emailContent += `\nTotal: $${totalAmount}\n\n`;
    emailContent += `Thank you for your order!\n`;

    // Send email via API
    const response = await fetch(`${API}/restaurants/${restaurantId}/orders/${orderId}/send-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, content: emailContent })
    });

    if (response.ok) {
      alert(`Receipt sent to ${email}`);
    } else {
      const error = await response.json();
      alert('Error sending receipt: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error sending receipt: ' + error.message);
  }
}
```

**Features:**
- Prompts user for email
- Validates email format
- Builds professional receipt text
- Sends to backend API
- Shows success/error feedback

---

## Environment Configuration

**File: `backend/.env`**
```env
# Existing variables...

# NEW: Email Configuration
CHUIO_EMAIL_ADDRESS=restaurantname.Support@chuio.io
CHUIO_SMTP_HOST=smtp.chuio.io
CHUIO_SMTP_PORT=587
CHUIO_SMTP_USER=restaurantname.Support@chuio.io
CHUIO_SMTP_PASSWORD=your_chuio_password_here
```

---

## Installation Steps

### 1. Install Dependencies
```bash
cd backend
npm install nodemailer @types/nodemailer
```

### 2. Create Configuration Files
Create `/backend/src/config/emailConfig.ts` (shown above)

### 3. Create Service File
Create `/backend/src/services/emailService.ts` (shown above)

### 4. Update Routes
Update `/backend/src/routes/orders.routes.ts` (shown above)

### 5. Add Environment Variables
Update `/backend/.env` with Chuio credentials (shown above)

### 6. Restart Backend
```bash
npm run dev
```

---

## Usage Example

### Frontend User Flow
1. User opens Admin Dashboard
2. Goes to Orders tab
3. Finds order they want to send receipt for
4. Clicks ✉️ Email button
5. Enters customer email: `customer@example.com`
6. System sends receipt
7. User sees: "Receipt sent to customer@example.com"

### API Request/Response

**Request:**
```json
POST /restaurants/123/orders/456/send-receipt
Content-Type: application/json

{
  "email": "customer@example.com",
  "content": "Order Receipt\n\nOrder #456\nDate: 12/20/2024...\n\nItems:\n- Burger x2: $15.00\n...\n\nTotal: $45.50"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Receipt sent successfully",
  "messageId": "<abcd1234@chuio.io>"
}
```

**Error Response:**
```json
{
  "error": "Invalid email format"
}
```

---

## Testing Checklist

- [ ] Backend starts without errors: `npm run dev`
- [ ] Admin dashboard loads
- [ ] Orders tab displays orders
- [ ] ✉️ Email button is visible
- [ ] Clicking email button prompts for email
- [ ] Invalid email shows error
- [ ] Valid email sends receipt
- [ ] Receipt arrives in customer inbox
- [ ] Email shows correct restaurant name
- [ ] Email shows correct order number
- [ ] Email formatting looks professional
- [ ] Check spam folder if email missing

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Cannot find module 'nodemailer'" | Run: `npm install nodemailer @types/nodemailer` |
| "EAUTH" error | Check SMTP credentials in .env are correct |
| "ECONNREFUSED" | Verify SMTP host and port are correct |
| Email validation fails | Ensure email format is user@domain.com |
| Email never arrives | Check spam folder, verify recipient email |

---

**Complete implementation ready!** 🎉
