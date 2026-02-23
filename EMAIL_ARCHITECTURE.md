# Email Service Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Order List                                          │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ Order #5                          🖨️ ✉️      │  │  │
│  │  │ Total: $45.50                                 │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Click ✉️ Email
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              FRONTEND: admin-orders.js                       │
│                                                              │
│  emailReceipt(orderId)                                       │
│  1. Prompt user for email                                   │
│  2. Validate email format                                   │
│  3. Build receipt content                                   │
│  4. POST /restaurants/{id}/orders/{id}/send-receipt         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ HTTP POST
                           │ {email, content}
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              BACKEND: orders.routes.ts                       │
│                                                              │
│  POST /restaurants/:restaurantId/orders/:orderId/send-receipt│
│  1. Validate email format                                    │
│  2. Check order exists & belongs to restaurant              │
│  3. Get restaurant name from DB                             │
│  4. Call emailService.sendReceipt()                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Call with:
                           │ - toEmail
                           │ - orderNumber
                           │ - content
                           │ - restaurantName
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         BACKEND: emailService.ts (sendReceipt)               │
│                                                              │
│  1. Get email transporter from config                       │
│  2. Generate HTML email template                            │
│  3. Create mail options (from, to, subject, html, text)     │
│  4. Send via transporter.sendMail()                         │
│  5. Return success/error                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ SMTP Connection
                           │ (from emailConfig.ts)
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         BACKEND: emailConfig.ts (getEmailTransporter)        │
│                                                              │
│  const transporter = nodemailer.createTransport({           │
│    host: process.env.CHUIO_SMTP_HOST                        │
│    port: 587                                                │
│    auth: {                                                  │
│      user: process.env.CHUIO_SMTP_USER                      │
│      pass: process.env.CHUIO_SMTP_PASSWORD                  │
│    }                                                        │
│  })                                                         │
│                                                              │
│  return transporter;                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ SMTP Protocol
                           │ TLS on Port 587
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│               CHUIO.IO SMTP SERVER                           │
│               smtp.chuio.io:587                             │
│                                                              │
│  Authentication: restaurantname.Support@chuio.io            │
│  From: restaurantname.Support@chuio.io                      │
│  Subject: Receipt for Order #5                              │
│  Body: Formatted HTML receipt                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Email Routing
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│            CUSTOMER EMAIL INBOX                             │
│                                                              │
│  From: restaurantname.Support@chuio.io                      │
│  Subject: Receipt for Order #5                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ RESTAURANT NAME                                        │ │
│  │ Order #5                                               │ │
│  │                                                        │ │
│  │ Items:                                                 │ │
│  │ - Burger x2: $15.00                                   │ │
│  │ - Fries x1: $5.50                                     │ │
│  │ - Drink x2: $6.00                                     │ │
│  │                                                        │ │
│  │ Total: $45.50                                          │ │
│  │                                                        │ │
│  │ Thank you for your order!                              │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. User Action
- User opens admin dashboard
- Navigates to Orders tab
- Clicks ✉️ Email button on an order

### 2. Frontend Processing
```javascript
// admin-orders.js
async function emailReceipt(orderId) {
  1. Find order in ORDERS array
  2. Prompt user: "Enter email address to send receipt:"
  3. Validate email with regex
  4. Build email content:
     - Order number
     - Date
     - Items with quantities and prices
     - Total
  5. Send POST request to backend
}
```

### 3. Backend Validation
```typescript
// orders.routes.ts
1. Extract restaurantId and orderId from URL
2. Extract email and content from request body
3. Validate email format: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
4. Query database:
   - SELECT order FROM orders WHERE id = orderId AND restaurant_id = restaurantId
   - Verify order exists and belongs to restaurant
5. Query database:
   - SELECT restaurant name WHERE id = restaurantId
6. Call emailService.sendReceipt() with:
   - toEmail: customer email
   - orderNumber: order ID
   - content: receipt text
   - restaurantName: for personalization
```

### 4. Email Service Processing
```typescript
// emailService.ts (sendReceipt)
1. Get SMTP transporter from emailConfig
2. Generate professional HTML template with:
   - Restaurant name in header
   - Order number in subject and body
   - Formatted receipt content
   - Styled email template
3. Create mail options:
   - From: restaurantname.Support@chuio.io
   - To: customer@example.com
   - Subject: "Receipt for Order #5"
   - HTML: formatted template
   - Text: plain text version
4. Send via transporter.sendMail()
5. Return messageId on success or error on failure
```

### 5. SMTP Transmission
```
nodemailer connects to:
  Host: smtp.chuio.io
  Port: 587 (TLS)
  Auth: restaurantname.Support@chuio.io : password
  
Email headers:
  From: restaurantname.Support@chuio.io
  To: customer@example.com
  Subject: Receipt for Order #5
  Content-Type: text/html
  
Email body:
  [HTML-formatted receipt with styling]
```

### 6. Delivery
- SMTP server receives email
- Routes to customer email provider
- Email delivered to customer inbox
- Returns messageId to frontend

### 7. Response to Frontend
```json
{
  "success": true,
  "message": "Receipt sent successfully",
  "messageId": "..."
}
```

## Configuration Hierarchy

```
┌─────────────────────────────────────────┐
│  Environment Variables (.env)           │
│  CHUIO_EMAIL_ADDRESS                    │
│  CHUIO_SMTP_HOST                        │
│  CHUIO_SMTP_PORT                        │
│  CHUIO_SMTP_USER                        │
│  CHUIO_SMTP_PASSWORD                    │
└─────────────────────┬───────────────────┘
                      │ read by
                      ▼
┌─────────────────────────────────────────┐
│  emailConfig.ts (Configuration)         │
│  - SMTP connection settings             │
│  - Transporter creation                 │
│  - Email address getter                 │
└─────────────────────┬───────────────────┘
                      │ used by
                      ▼
┌─────────────────────────────────────────┐
│  emailService.ts (Service Layer)        │
│  - sendReceipt()                        │
│  - sendOrderConfirmation()              │
│  - verifyEmailConnection()              │
└─────────────────────┬───────────────────┘
                      │ called by
                      ▼
┌─────────────────────────────────────────┐
│  orders.routes.ts (API Route)           │
│  POST /send-receipt endpoint            │
│  - Validation                           │
│  - Database queries                     │
│  - Response handling                    │
└─────────────────────────────────────────┘
```

## Error Handling Flow

```
User Input
    │
    ├─ Email Validation (Frontend)
    │  └─ Invalid? → "Please enter valid email"
    │
    ├─ Email Format Validation (Backend)
    │  └─ Invalid? → 400 "Invalid email format"
    │
    ├─ Order Verification (Backend)
    │  └─ Not found? → 404 "Order not found"
    │
    ├─ Restaurant Verification (Backend)
    │  └─ Mismatch? → Implicit 404 (order filtering)
    │
    ├─ SMTP Connection (Service)
    │  └─ Failed? → Console error + 500 response
    │
    ├─ Email Sending (Service)
    │  └─ Failed? → Error returned + logged
    │
    └─ Success
       └─ Return messageId + success response
```

## Database Queries Used

### Query 1: Verify Order Exists
```sql
SELECT id, restaurant_order_number 
FROM orders 
WHERE id = $1 AND restaurant_id = $2
```
- Ensures order exists
- Ensures restaurant ownership
- Gets order number for email

### Query 2: Get Restaurant Name
```sql
SELECT name 
FROM restaurants 
WHERE id = $1
```
- Personalizes email with restaurant name

## Email Template Structure

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial; color: #333; }
    .container { max-width: 600px; background: white; }
    .header { border-bottom: 2px solid #3498db; }
    .header h1 { color: #2c3e50; }
    .receipt-text { 
      white-space: pre-wrap; 
      font-family: monospace; 
      background: #f9f9f9;
      border-left: 4px solid #3498db;
    }
    .footer { text-align: center; color: #7f8c8d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>RESTAURANT NAME</h1>
      <div class="order-number">Order #5</div>
    </div>
    <div class="content">
      <p>Thank you for your order!</p>
      <div class="receipt-text">
        Order Receipt
        [formatted receipt content]
      </div>
    </div>
    <div class="footer">
      <p>Automated message - do not reply</p>
    </div>
  </div>
</body>
</html>
```

## Performance Characteristics

- **SMTP Connection**: Singleton (reused for all emails)
- **Transporter Creation**: Done once, cached in memory
- **Email Sending**: ~1-3 seconds per email
- **Database Queries**: 2 queries per send operation
- **Scalability**: Can handle multiple concurrent email sends

## Security Features

✅ **Input Validation**
- Email format validated twice (frontend + backend)
- Restaurant ID must match order

✅ **Authorization**
- Order must belong to restaurant
- Restaurant ID from URL path

✅ **Credentials**
- SMTP password in environment variables only
- Never hardcoded
- Never logged

✅ **Data Protection**
- Email sent over TLS (port 587)
- HTTPS for API calls

## Monitoring & Logging

```
Console Output Examples:

✅ Success:
   ✅ Receipt sent to customer@example.com. Message ID: <...>

❌ Failure:
   ❌ Failed to send receipt to customer@example.com: ECONNREFUSED

📝 Testing:
   ✅ Email service verified successfully
   ❌ Email service verification failed: [reason]
```

---

**Complete architecture ready for production use!** 🚀
