# KPay Integration - Quick Reference Guide

## 🚀 Quick Start

### 1. Database is Ready
Migration 045 created the `payment_terminals` table with all necessary fields.

### 2. Backend API Endpoints

#### List Payment Terminals
```
GET /api/restaurants/:restaurantId/payment-terminals
Response: Array of PaymentTerminal objects
```

#### Create Payment Terminal
```
POST /api/restaurants/:restaurantId/payment-terminals

Request Body:
{
  "vendor_name": "kpay",
  "app_id": "your-app-id",
  "app_secret": "your-app-secret",
  "terminal_ip": "192.168.50.210",
  "terminal_port": 18080,
  "endpoint_path": "/v2/pos/sign"
}

Response: Created PaymentTerminal object
```

#### Update Payment Terminal
```
PATCH /api/restaurants/:restaurantId/payment-terminals/:terminalId

Request Body: (all fields optional)
{
  "app_id": "updated-id",
  "app_secret": "updated-secret",
  "terminal_ip": "192.168.1.100",
  "terminal_port": 18080,
  "endpoint_path": "/v2/pos/sign"
}

Response: Updated PaymentTerminal object
```

#### Test Terminal Connection
```
POST /api/restaurants/:restaurantId/payment-terminals/:terminalId/test

Response:
{
  "success": true/false,
  "message": "Connection status message",
  "response": { ... },
  "error": "Error message if failed",
  "timestamp": "ISO timestamp"
}
```

#### Delete Payment Terminal
```
DELETE /api/restaurants/:restaurantId/payment-terminals/:terminalId

Response: { "success": true, "message": "Payment terminal deleted successfully" }
```

#### Activate Payment Terminal
```
POST /api/restaurants/:restaurantId/payment-terminals/:terminalId/activate

Response: { "success": true, "message": "...", "terminal": {...} }
```

### 3. Frontend Component

**Location:** `mobile/src/screens/admin/SettingsTab.tsx`

**Features:**
- Payment Terminal Card displays list of configured terminals
- Add/Edit/Delete functionality
- Test connection button
- Real-time status updates
- Error message display

**State Variables:**
```typescript
const [paymentTerminals, setPaymentTerminals] = useState<PaymentTerminal[]>([]);
const [showPaymentTerminalModal, setShowPaymentTerminalModal] = useState(false);
const [editingTerminalId, setEditingTerminalId] = useState<number | null>(null);
const [terminalForm, setTerminalForm] = useState({...});
const [testingTerminal, setTestingTerminal] = useState(false);
const [terminalTestResult, setTerminalTestResult] = useState<any>(null);
```

**Key Functions:**
- `fetchPaymentTerminals()` - Load all terminals
- `savePaymentTerminal()` - Create or update
- `testPaymentTerminal()` - Test connectivity
- `deletePaymentTerminal()` - Remove terminal
- `editPaymentTerminal()` - Load terminal for editing
- `resetTerminalForm()` - Clear form

### 4. KPay Service

**Location:** `backend/src/services/kpayTerminalService.ts`

```typescript
import { kpayTerminalService } from '../services/kpayTerminalService';

// Initialize with credentials
kpayTerminalService.initialize({
  appId: 'your-app-id',
  appSecret: 'your-app-secret',
  terminalIp: '192.168.50.210',
  terminalPort: 18080,
  endpointPath: '/v2/pos/sign'
});

// Test connection
const result = await kpayTerminalService.testConnection();
if (result.success) {
  console.log('Connected:', result.response);
} else {
  console.error('Failed:', result.error);
}

// Send sign request
const signRequest = {
  appId: 'your-app-id',
  appSecret: 'your-app-secret',
  timestamp: Math.floor(Date.now() / 1000),
  nonce: 'random-nonce'
};
const response = await kpayTerminalService.sendSignRequest(signRequest);
```

## 📊 PaymentTerminal Interface

```typescript
interface PaymentTerminal {
  id: number;
  vendor_name: 'kpay' | 'other';
  is_active: boolean;
  app_id: string;
  terminal_ip?: string;
  terminal_port?: number;
  endpoint_path?: string;
  metadata?: Record<string, any>;
  last_tested_at?: string;
  last_error_message?: string;
  created_at?: string;
  updated_at?: string;
}
```

## 🔗 KPay Protocol

### Sign Request
```
POST http://192.168.50.210:18080/v2/pos/sign

{
  "appId": "restaurant-app-id",
  "appSecret": "restaurant-app-secret",
  "timestamp": 1711000000,
  "nonce": "abc123xyz"
}
```

### Sign Response
```json
{
  "code": "0",
  "message": "Success",
  "data": {
    "sign": "signature-hash",
    "timestamp": 1711000000,
    "nonce": "abc123xyz"
  }
}
```

## 🛠️ Configuration Defaults

```typescript
// Default KPay terminal configuration
const defaults = {
  terminalIp: '192.168.50.210',
  terminalPort: 18080,
  endpointPath: '/v2/pos/sign',
  timeout: 10000 // 10 seconds
};
```

## ✅ Testing Checklist

### For Developers
- [ ] Create payment terminal via API
- [ ] Retrieve payment terminals list
- [ ] Update terminal configuration
- [ ] Test connection endpoint
- [ ] Delete terminal
- [ ] Verify database changes

### For Backend Team
- [ ] Verify KPayTerminalService initializes properly
- [ ] Check error handling for network failures
- [ ] Validate credential handling
- [ ] Test with various terminal IPs/ports
- [ ] Monitor database queries

### For Mobile Team
- [ ] Payment Terminal Card renders
- [ ] Add button opens modal
- [ ] Form validation works
- [ ] Test button sends request
- [ ] Error messages display
- [ ] Loading states show correctly
- [ ] Edit functionality works
- [ ] Delete with confirmation works

## 🚨 Common Issues

### "Connection Failed" Error
- Check if terminal IP is correct
- Verify terminal is powered on
- Check port number is correct (default 18080)
- Ensure device is on same network
- Confirm firewall allows connection

### "Relation does not exist" Error
- Migration 045 didn't run successfully
- Check migration status in migrations table
- Run migrations: `npx ts-node src/scripts/runMigrations.ts`

### "App ID/Secret rejected"
- Verify credentials from KPay
- Check for extra spaces or typos
- Ensure app_secret is correct (case-sensitive)

### Timeout Error
- Terminal might be offline
- Network connection issue
- Port might be blocked

## 📈 Next Steps

1. **Add to Order Processing:**
   - Trigger payment terminal when bill is closed
   - Parse response and create payment record
   - Handle success/failure scenarios

2. **Implement Payment History:**
   - Store transaction records
   - Link to orders
   - Generate reports

3. **Add Multiple Vendors:**
   - Extend kpayTerminalService for other providers
   - Add vendor-specific configuration
   - Handle different response formats

4. **Security Enhancements:**
   - Encrypt stored secrets
   - Implement audit logging
   - Add rate limiting

## 📞 Quick Links

- **Migration File:** `backend/migrations/045_add_payment_terminals.sql`
- **Service File:** `backend/src/services/kpayTerminalService.ts`
- **API Routes:** `backend/src/routes/payment-terminals.routes.ts`
- **UI Component:** `mobile/src/screens/admin/SettingsTab.tsx`
- **Documentation:** `KPAY_INTEGRATION_COMPLETE.md`

---

Ready to integrate with order processing and payment handling!
