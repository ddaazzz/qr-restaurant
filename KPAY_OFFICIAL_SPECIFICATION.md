# KPay Official API Specification

**Provider:** KPay (Payment Terminal System)  
**Version:** 2.0  
**Last Updated:** March 29, 2026  
**Documentation Purpose:** POS Terminal Integration Reference

---

## Table of Contents

1. [Authentication & Sign-In](#authentication--sign-in)
2. [Standard Transactions](#standard-transactions)
3. [API Reference](#api-reference)
4. [Request/Response Format](#requestresponse-format)
5. [Error Handling](#error-handling)
6. [Implementation Guide](#implementation-guide)

---

## Authentication & Sign-In

### Overview

Before your application can send any transaction request to KPOS, it must perform an application sign-in to obtain the working keys. Only after a successful sign-in can the app continue calling other KPOS APIs.

**Key Points:**
- Working keys become invalid after the terminal performs settlement & sign-out
- Fresh keys must be obtained when they expire
- This is a prerequisite for all other API calls

---

## Standard Transactions

### Sale Transaction

**Endpoint:** `POST /v2/pos/sales`

**Purpose:** Initiate a sale transaction and bring up the KPOS payment screen. The customer taps/inserts/swipes a card or presents/scans a QR code.

**Default Timeout:** 65 seconds  
**Timeout Behavior:** If no asynchronous callback is received after timeout, actively query transaction status using the Query API.

---

## API Reference

### 1. Application Sign-In

#### Endpoint
```
POST /v2/pos/sign
```

#### Purpose
Sign in to KPOS and obtain the working key pair.

#### Request Headers

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | Long | ✅ | Current timestamp, accurate to milliseconds (UTC) |
| `nonceStr` | String | ✅ | 32-character random string, e.g.: `BlW41Z20zy801bcjBbBx7fQVYkHNoAm7` |

#### Request Body

| Field | Type | Length | Required | Description |
|-------|------|--------|----------|-------------|
| `appId` | String | 1-32 | ✅ | Developer application ID |
| `appSecret` | String | 1-64 | ✅ | Developer application secret |
| `actionCallbackUrl` | String | 1-256 | ⚠️ | Terminal operation callback address in Kiosk mode (required in Kiosk mode) |

#### Response Data

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | Integer | ✅ | Response code |
| `data` | Object | ~ | Response data (returned when code is 10000) |
| `platformPublicKey` | String | ✅ | Platform working public key (1-2048 chars) |
| `appPrivateKey` | String | ✅ | Application working private key (1-2048 chars) |
| `message` | String | ~ | Error message (returned when code is not 10000) |

#### Request Example

```bash
POST http://10.0.0.114:18080/v2/pos/sign

Headers:
{
    "Content-Type": "application/json",
    "timestamp": "1654652134298"
}

Body:
{
    "appId": "20xxxxxxxxxxxxxx",
    "appSecret": "3nexzW7klObmTW5dl5Z8weuBxxxxxxxxxxxxxxxxxx"
}
```

#### Response Example

```json
{
    "code": 10000,
    "data": {
        "platformPublicKey": "eyJhbGciOiJSUzI1N******************************************************ZVnQ",
        "appPrivateKey": "eyJhbGciOiJSUzI1N******************************************************ZVnQ"
    }
}
```

---

### 2. Sale Transaction

#### Endpoint
```
POST /v2/pos/sales
```

#### Purpose
Initiate a sale transaction and bring up the KPOS payment screen for customer payment.

#### When to Use
The merchant invokes this to start the KPOS collection (payment) flow and accept a payment from the customer.

#### Request Headers

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | String | ✅ | Application ID, e.g.: `202xxxxxxxxxx` |
| `signature` | String | ✅ | Signature string |
| `timestamp` | Long | ✅ | Current timestamp, accurate to milliseconds (UTC) |
| `nonceStr` | String | ✅ | 32-character random string, e.g.: `BlW41Z20zy801bcjBbBx7fQVYkHNoAm7` |

#### Request Body

| Field | Type | Length | Required | Description |
|-------|------|--------|----------|-------------|
| `outTradeNo` | String | 1-32 | ✅ | Merchant order number (must be unique for each transaction, avoid special characters) |
| `memberCode` | String | 1-32 | ⚠️ | Member code |
| `description` | String | 1-128 | ⚠️ | Product description |
| `payAmount` | String | 12 | ✅ | Payment amount, format `000000000100`, unit: smallest currency unit |
| `tipsAmount` | String | 12 | ✅ | Tip amount, format `000000000100`, unit: smallest currency unit |
| `paymentType` | Long | - | ⚠️ | Payment type (see Payment Types below) |
| `payCurrency` | String | 1-4 | ✅ | Payment currency code, currently only supports `344` (HKD) |
| `callbackUrl` | String | 1-256 | ⚠️ | Payment callback URL. KPOS will callback this URL with payment info after successful payment |
| `qrCodeContent` | String | 1-256 | ⚠️ | Payment channel QR code string (required for reverse scan in Kiosk mode) |
| `includeReceipt` | Boolean | - | ⚠️ | Whether to return KPay receipt data. When true, receipt returned and POS won't print |
| `hideRetryButton` | Boolean | - | ⚠️ | Whether to hide retry button on transaction result page |
| `remark` | String | 1-256 | ⚠️ | Merchant custom information (appears in settlement reports) |
| `discountAmount` | String | 12 | ⚠️ | Discount amount, format `000000000100`, unit: smallest currency unit (KPayPOS device only) |
| `discountDescription` | String | 1-128 | ⚠️ | Discount description (KPayPOS device only) |
| `frontCamera` | Boolean | - | ⚠️ | Use front camera for QR code reverse scan (auto-uses front camera when true) |

#### Payment Types

| Code | Type | Description |
|------|------|-------------|
| 1 | Card | Physical card payment |
| 2 | QR Code Scan | Merchant scans customer QR code |
| 3 | QR Code Reverse Scan | Customer scans merchant QR code |
| 4 | Octopus | Octopus card payment |
| 5 | Octopus QR | Octopus via QR code scan |
| 6 | Payme Scan | Payme scan payment |
| 7 | Payme Reverse Scan | Payme reverse scan |
| 8 | FPS Scan | FPS (Fast Payment System) scan |

#### Response Data

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | Integer | ✅ | Response code |
| `data` | Object | ~ | Response data (returned when code is 10000) |
| `message` | String | ~ | Error message (returned when code is not 10000) |

#### Request Example

```bash
POST http://10.0.0.114:18080/v2/pos/sales

Headers:
{
    "Content-Type": "application/json",
    "timestamp": "1654652134298",
    "appId": "202xxxxxxxxxx",
    "nonceStr": "BlW41Z20zy801bcjBbBx7fQVYkHNoAm7",
    "signature": "hXKbWYyHH/H05Rjd6TC0x7LzJg4v2aw7Kg/Kjv5oMz0jjh2qG4SHWwTymQ4jmCCjmzqyC3gEM3ARXBicbdlp1TWrPJgg51w9uc4SIRwnQhHh0FackKXFBjsMFDnJEl+VzLPueyFAy50jeaS1lUIZu7r2cD/TDUKiyucDKaZ4fwNmgsHUDmchqka8dT5JnqlCLs0lEQEkxmLzxvnay+eLAmiM8hzbq4NoHgCoAriCbqPcseUUJmUBMdLt+/lJa+qL8f2yFJRFpO69u3KFd8bt7/SqPZEwZaKroB2trqm9PotaGvLMOjvVvHnyQ8acdY0owBaae7l6LDZIUQHvhaHzMQ=="
}

Body:
{
    "outTradeNo": "20xxxxxxxxxxxx1",
    "payAmount": "000000000100",
    "tipsAmount": "000000000000",
    "payCurrency": "344",
    "callbackUrl": "http://10.0.0.115:8080/callback"
}
```

#### Response Example

```json
{
    "code": 10000,
    "data": {}
}
```

---

### 3. Query Transaction Status

#### Endpoint
```
GET /v2/pos/query
```

#### Purpose
Query the current status of a transaction by merchant order number.

#### Request Headers

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | String | ✅ | Application ID |
| `signature` | String | ✅ | Signature string |
| `timestamp` | Long | ✅ | Current timestamp, accurate to milliseconds (UTC) |
| `nonceStr` | String | ✅ | 32-character random string |

#### Query Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `outTradeNo` | String | ✅ | Merchant order number |

#### Response Data (data object)

| Field | Type | Description |
|-------|------|-------------|
| `outTradeNO` | String | Merchant order number |
| `transactionNo` | String | KPay internal transaction number |
| `payResult` | Integer | 1=pending, 2=success, 3=failed, 4=cancelled |
| `payAmount` | String | Payment amount |
| `payCurrency` | String | Currency code |

---

### 4. Cancel (Void) Transaction

#### Endpoint
```
POST /v2/pos/sales/cancel
```

#### Purpose
Initiate a sale cancellation (void) on KPOS and put the terminal into the cancellation flow.

#### When to Use
Use this when a sale has just been completed but you realize there was an error (wrong amount, wrong item, duplicate charge, customer immediately changes their mind, etc.). You can call this API to void the completed (but not yet settled) transaction.

#### Important Notes
- Only same-day transactions that have **NOT** yet entered settlement can be voided.
- Once settled, use the refund endpoint instead.

#### Request Headers

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | String | ✅ | Application ID, e.g.: `202xxxxxxxxxx` |
| `signature` | String | ✅ | Signature string |
| `timestamp` | Long | ✅ | Current timestamp, accurate to milliseconds (UTC) |
| `nonceStr` | String | ✅ | 32-character random string |

#### Request Body

| Field | Type | Length | Required | Description |
|-------|------|--------|----------|-------------|
| `outTradeNo` | String | 1-32 | ✅ | New unique merchant order number for this void transaction |
| `originOutTradeNo` | String | 1-32 | ✅ | Original transaction's `outTradeNo` (the sale being voided) |
| `callbackUrl` | String | 1-256 | ⚠️ | Cancellation callback URL |
| `includeReceipt` | Boolean | - | ⚠️ | Whether to return KPay receipt data (suppresses terminal printing) |
| `managerPassword` | String | - | ⚠️ | RSA-encrypted admin password using `platformPublicKey` to skip terminal password prompt |

#### Response Data

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | Integer | ✅ | Response code |
| `data` | Object | ~ | Response data (returned when code is 10000) |
| `message` | String | ~ | Error message (returned when code is not 10000) |

#### Request Example

```bash
POST http://10.0.0.114:18080/v2/pos/sales/cancel

Headers:
{
    "Content-Type": "application/json",
    "timestamp": "1654652134298",
    "appId": "202xxxxxxxxxx",
    "nonceStr": "BlW41Z20zy801bcjBbBx7fQVYkHNoAm7",
    "signature": "hXKbWYyHH/H05Rjd6TC0x7LzJg4v2aw7..."
}

Body:
{
    "outTradeNo": "20xxxxxxxxxxxxx2",
    "originOutTradeNo": "20xxxxxxxxxxxxx1",
    "callbackUrl": "http://10.0.0.115:8080/callback"
}
```

#### Response Example

```json
{
    "code": 10000,
    "data": {}
}
```

#### Administrator Password Encryption

```js
const publicKey = forge.pki.publicKeyFromPem(pubKey);
const encryptedText = forge.util.encode64(
    publicKey.encrypt(data, 'RSAES-PKCS1-V1_5', {
        md: forge.md.sha1.create(),
        mgf: forge.mgf.mgf1.create(forge.md.sha1.create())
    }),
);
```

---

### 5. Transaction Refund

#### Endpoint
```
POST /v2/pos/sales/refund
```

#### Purpose
Initiate a refund request on KPOS and put the terminal into the refund flow.

#### When to Use
A merchant has completed a payment that has moved into the settlement stage. Use this to fully or partially refund to the consumer.

#### Important Notes
- Only transactions that have **already entered settlement** can be refunded. For unsettled transactions, use void/cancel instead.
- All refunds follow the "original route return" rule — funds return via the same payment method.
- Refund processing time varies by payment provider (immediate to several days).

#### Request Headers

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | String | ✅ | Application ID, e.g.: `202xxxxxxxxxx` |
| `signature` | String | ✅ | Signature string |
| `timestamp` | Long | ✅ | Current timestamp, accurate to milliseconds (UTC) |
| `nonceStr` | String | ✅ | 32-character random string |

#### Request Body

| Field | Type | Length | Required | Description |
|-------|------|--------|----------|-------------|
| `outTradeNo` | String | 1-32 | ✅ | New unique merchant order number for this refund |
| `refundType` | Long | - | ✅ | Refund type: `1` = Card, `2` = QR code |
| `transactionNo` | String | 1-32 | ⚠️ | KPay merchant order number — returned for QR code sale transactions; **required when refundType=2** |
| `refNo` | String | 1-32 | ⚠️ | KPay merchant transaction reference number — returned for card sale transactions; **required when refundType=1** |
| `commitTime` | Long | - | ⚠️ | Original sale submission time (UTC ms timestamp); **required when refundType=1** |
| `refundAmount` | String | 12 | ⚠️ | Refund amount, format `000000000100`; omit for full refund |
| `callbackUrl` | String | 1-256 | ⚠️ | Refund callback URL |
| `includeReceipt` | Boolean | - | ⚠️ | Whether to return KPay receipt data (suppresses terminal printing) |
| `managerPassword` | String | - | ✅ | RSA-encrypted admin password using `platformPublicKey` |

#### Response Data

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | Integer | ✅ | Response code |
| `data` | Object | ~ | Response data (returned when code is 10000) |
| `message` | String | ~ | Error message (returned when code is not 10000) |

#### Request Example

```bash
POST http://10.0.0.114:18080/v2/pos/sales/refund

Headers:
{
    "Content-Type": "application/json",
    "timestamp": "1654652134298",
    "appId": "202xxxxxxxxxx",
    "nonceStr": "BlW41Z20zy801bcjBbBx7fQVYkHNoAm7",
    "signature": "hXKbWYyHH/H05Rjd6TC0x7LzJg4v2aw7..."
}

Body:
{
    "outTradeNo": "20xxxxxxxxxxxxx2",
    "refundType": 1,
    "refundAmount": "000000000100",
    "transactionNo": "",
    "refNo": "516103263184",
    "commitTime": "1749557640956",
    "managerPassword": "NbWENhhGF7gn2/...",
    "callbackUrl": "http://10.0.0.115:8080/callback"
}
```

#### Response Example

```json
{
    "code": 10000,
    "data": {}
}
```

#### Administrator Password Encryption

```js
const publicKey = forge.pki.publicKeyFromPem(pubKey);
const encryptedText = forge.util.encode64(
    publicKey.encrypt(data, 'RSAES-PKCS1-V1_5', {
        md: forge.md.sha1.create(),
        mgf: forge.mgf.mgf1.create(forge.md.sha1.create())
    }),
);
```

---

### 6. Close Transaction

#### Endpoint
```
POST /v2/pos/sales/close
```

#### Purpose
Abort (close) the currently in-progress sale on KPOS, freeing the terminal to idle state.

#### When to Use
KPOS can process only one transaction at a time. If the customer does not complete authorization in time or has left, call this API to close the active transaction and return the terminal to idle.

#### Request Headers

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | String | ✅ | Application ID, e.g.: `202xxxxxxxxxx` |
| `signature` | String | ✅ | Signature string |
| `timestamp` | Long | ✅ | Current timestamp, accurate to milliseconds (UTC) |
| `nonceStr` | String | ✅ | 32-character random string |

#### Request Body

| Field | Type | Length | Required | Description |
|-------|------|--------|----------|-------------|
| `outTradeNo` | String | 1-32 | ✅ | Merchant order number of the in-progress transaction to close |

#### Response Data

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | Integer | ✅ | Response code |
| `data` | Object | ~ | Response data (returned when code is 10000) |
| `message` | String | ~ | Error message (returned when code is not 10000) |

#### Request Example

```bash
POST http://10.0.0.114:18080/v2/pos/sales/close

Headers:
{
    "Content-Type": "application/json",
    "timestamp": "1654652134298",
    "appId": "202xxxxxxxxxx",
    "nonceStr": "BlW41Z20zy801bcjBbBx7fQVYkHNoAm7",
    "signature": "hXKbWYyHH/H05Rjd6TC0x7LzJg4v2aw7..."
}

Body:
{
    "outTradeNo": "20xxxxxxxxxxxxx2"
}
```

#### Response Example

```json
{
    "code": 10000,
    "data": {}
}
```

---

## Request/Response Format

### Standard Format

All KPay API requests and responses follow a consistent JSON format.

#### Request Structure
```json
{
    "appId": "Application ID",
    "signature": "Digital signature of request",
    "timestamp": "Millisecond timestamp",
    "nonceStr": "32-character random string",
    // ... transaction-specific fields
}
```

#### Response Structure
```json
{
    "code": 10000,  // Response code (10000 = success)
    "data": {
        // Response-specific data
    },
    "message": "Error message if code !== 10000"
}
```

### Amount Format

All monetary amounts use the **smallest currency unit** (e.g., cents for HKD):

**Format:** 12-character zero-padded string  
**Example:** `"000000000100"` = 100 units (1 HKD)  
**Calculation:** Display amount × 100 = API amount

| Display | API Format |
|---------|-----------|
| 100.00 HKD | `000000010000` |
| 50.50 HKD | `000000005050` |
| 1.00 HKD | `000000000100` |
| 0.01 HKD | `000000000001` |

---

## Error Handling

### Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 10000 | Success | Transaction processed normally |
| Other | Error | Check `message` field for details, implement retry logic |

### Timeout Handling

**Sale Transaction Timeout:** 65 seconds default

**When Timeout Occurs:**
1. No response received from terminal
2. No asynchronous callback received
3. Application should wait for callback (implementation dependent)
4. If no callback after timeout window, actively query transaction status

**Query Strategy:**
- Implement delayed retry with exponential backoff
- Query transaction status using Query API
- Do not re-initiate same transaction (use same `outTradeNo`)

---

## Implementation Guide

### Key Implementation Points

#### 1. Key Exchange & Sign-In
- **Frequency:** Once at application startup or when keys expire
- **Storage:** Securely store `appPrivateKey` and `platformPublicKey`
- **Invalidation:** Keys become invalid after terminal settlement & sign-out
- **Process:** Automatic key request before transaction if keys missing

#### 2. Transaction Uniqueness
- **outTradeNo:** Must be unique for each transaction
- **Format:** Recommend `ORD${timestamp}${random}` (avoid special characters)
- **Length:** Maximum 32 characters
- **Usage:** Link all transaction events to original order

#### 3. Amount Calculations
- **Always use smallest currency unit** (cents)
- **Include service charges:** `total = subtotal - discount + service_charge`
- **Tip handling:** Include `tipsAmount` in every request (0 if no tip)
- **No rounding:** All amounts pre-calculated before sending

#### 4. Callback Handling
- **Optional but recommended:** Implement `callbackUrl`
- **Async notification:** Payment success/failure sent via callback
- **Backup plan:** Always implement timeout-based query for missed callbacks
- **Idempotency:** Callbacks may be retried, handle duplicate notifications

#### 5. Security
- **Signature:** Sign all requests with `appPrivateKey`
- **Timestamp validation:** Keep system clock in sync (UTC)
- **nonceStr:** Generate new random string for each request
- **HTTPS only:** All communications must be encrypted

#### 6. Payment Types
- **Default:** Let customer choose payment method on terminal
- **Specific:** Optionally specify `paymentType` to limit options:
  - 1 = Card only
  - 2 = Merchant scans QR
  - 3 = Customer scans QR
  - Others = Alternative payment methods

#### 7. Receipt Management
- **Default:** KPOS prints receipt automatically
- **Custom receipt:** Set `includeReceipt: true` to get receipt data and prevent auto-print
- **Handling:** Implement custom receipt printing/storage as needed

---

## Transaction Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Application                           │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ├─► 1. Sign-In (POST /v2/pos/sign)
                  │   Request: appId, appSecret
                  │   Response: platformPublicKey, appPrivateKey
                  │
                  ├─► 2. Initiate Sale (POST /v2/pos/sales)
                  │   Request: outTradeNo, payAmount, tipsAmount
                  │   Response: code 10000 (queued for processing)
                  │
                  ├─► 3a. Callback Notification (async)
                  │   KPOS → callbackUrl with payment result
                  │   OR
                  ├─► 3b. Query Status (on timeout)
                  │   Poll transaction status until completion
                  │
                  └─► 4. Handle Result
                      Success: Continue processing
                      Failure: Display error, allow retry
```

---

## Best Practices

### Request Management
- ✅ Always validate local amount calculations before sending
- ✅ Use unique `outTradeNo` to prevent duplicate charges
- ✅ Implement retry logic with exponential backoff
- ✅ Log all requests and responses for audit trail
- ✅ Validate `timestamp` is within acceptable range

### Response Handling
- ✅ Check `code` field first (10000 = success, other = error)
- ✅ Parse `message` field for user-friendly error display
- ✅ Implement callback handler to catch async responses
- ✅ Fallback to query API if callback not received within reasonable time
- ✅ Handle network timeouts gracefully (don't assume failure)

### Error Recovery
- ✅ For 65-second timeout: Query transaction status
- ✅ For declined cards: Show error message, allow retry
- ✅ For network errors: Implement exponential backoff, max 3 retries
- ✅ For invalid signature: Verify key exchange was successful
- ✅ Log all errors for troubleshooting

### Security
- ✅ Keep `appPrivateKey` secure and encrypted
- ✅ Validate `platformPublicKey` matches expected value
- ✅ Sign all requests with valid signature
- ✅ Use HTTPS for all communications
- ✅ Validate callback source (verify signature)

---

## Response Codes Reference

### Complete Response Code List

| Code | Meaning | Category | Action |
|------|---------|----------|--------|
| **10000** | Success | ✅ Success | **Close bill/process payment** |
| 10001 | Invalid Parameters | ❌ Error | Verify request parameters |
| 11000 | POS Transaction Forwarded to Foreground Application | ⏳ Processing | Wait for callback |
| 20001 | Transaction Number Already Exists | ❌ Error | Use unique outTradeNo |
| 20002 | Incorrect Amount | ❌ Error | Verify payment amount matches |
| 20003 | Currency Not Supported | ❌ Error | Use supported currency (344=HKD) |
| 20004 | Tip Exceeds Limit | ❌ Error | Reduce tip amount |
| 20005 | Related Transaction Not Found | ❌ Error | Verify transaction reference |
| 20006 | Transaction Status Cannot Be Reversed/Refunded | ❌ Error | Check transaction state |
| 20007 | Next-Day Transaction, Cannot Be Reversed | ❌ Error | Transaction outside reversal window |
| 20008 | Terminal Does Not Support Tips | ❌ Error | Disable tips for this terminal |
| 20009 | Payment Type Not Supported | ❌ Error | Verify payment_type is valid |
| 20010 | Transaction Completed, Cannot Be Closed | ❌ Error | Transaction already finalized |
| **20011** | Transaction Processing, Please Wait or Actively Query Transaction Result | ⏳ Pending | **Actively query with GET /v2/pos/query** |
| 20012 | This Transaction Type Does Not Support Reversal | ❌ Error | Cannot reverse this transaction type |
| 20013 | This Transaction Type Does Not Support Tips | ❌ Error | Disable tips for this payment type |
| **20014** | Transaction Query in Progress... | ⏳ Pending | **Wait and retry query** |
| 20015 | Member Information Does Not Exist | ❌ Error | Verify member code |
| **20016** | Waiting for Foreground Application Processing, Please Wait or Actively Query Transaction Result | ⏳ Pending | **Query status actively** |
| **20017** | QR Code Transaction Closed, Please Refer to User's Actual Payment Result | ⚠️ Cancelled | User cancelled QR payment |
| 20018 | Administrator Password Incorrect | ❌ Error | Use correct admin password |
| 20019 | Transaction Closure Failed, Please Manually Close | ❌ Error | Manual intervention required |
| 20020 | Transaction Status Cannot Be Adjusted for Tips | ❌ Error | Cannot modify tip after transaction |
| 20021 | This Transaction Type Does Not Support Tip Adjustment | ❌ Error | Tip adjustment not supported |
| 20022 | This Transaction Already Has a Tip Adjustment Record | ❌ Error | Tip already adjusted |
| 20023 | Tip Amount Exceeds Limit | ❌ Error | Reduce tip amount |
| 20024 | Order Amount Fully Refunded, No Further Refunds Allowed | ❌ Error | No refund balance remaining |
| 20025 | Incorrect Card Number | ❌ Error | Customer entered invalid card |
| 20026 | This Transaction Type Does Not Support Refund | ❌ Error | Cannot refund this type |
| 40001 | Authentication Failed | ❌ Error | Re-sign in to terminal |
| 40002 | Invalid Signature | ❌ Error | Verify signature generation |
| 40003 | Unauthorized Access | ❌ Error | Check app permissions |
| 40004 | Working Key Does Not Exist, Please Re-sign In | ❌ Error | **Call POST /v2/pos/sign** |
| 40005 | Key Pair Generation Failed | ❌ Error | Contact KPay support |
| 40006 | Developer Application Information Does Not Exist | ❌ Error | Verify appId is valid |
| 40007 | Developer Application Authentication Failed | ❌ Error | Verify appSecret is correct |
| 40008 | Application Not Signed In, Please Sign In on KpayPos First | ❌ Error | **Call POST /v2/pos/sign** |
| 40010 | Foreground Application Not Signed In | ❌ Error | Sign in on KPOS terminal |
| 40011 | Message Forwarding Failed | ❌ Error | Network/terminal issue |
| 50001 | Unknown Error | ❌ Error | Retry or contact support |
| 50002 | Terminal Busy | ⏳ Processing | Retry after delay |
| 50003 | Printer Status Abnormal | ⚠️ Warning | Check printer, receipt not printed |
| 50004 | Request Too Frequent | ⏳ Pending | Implement rate limiting |
| 50005 | KPay POS Not Set to Background Mode | ❌ Error | Configure terminal settings |
| **50006** | Last Transaction Not Completed, Please Query on POS | ⏳ Pending | **Use GET /v2/pos/query** |
| **50007** | Last Transaction Failed, Please Reverse on POS | ❌ Error | **Call POST /v2/pos/reverse** |
| 50008 | Last Transaction Reversal Failed, Please Retry Reversal on POS | ❌ Error | Retry reversal |
| 50009 | Terminal Status Abnormal, Please Perform Settlement First | ❌ Error | Run settlement on terminal |
| 50010 | Settlement Failed | ❌ Error | Retry settlement |
| 50011 | Terminal not settled yet, unable to query last settlement data | ⚠️ Info | Settlement data unavailable |
| 50012 | Settlement data is empty | ⚠️ Info | No settlement records |
| 60002 | Adjusted Amount Cannot Be Greater Than Original Payment Amount | ❌ Error | Keep adjusted amount ≤ original |
| 60003 | This Transaction Only Supports Payment Amount Modification | ❌ Error | Only amount can be modified |
| 60004 | Invalid Discount Amount | ❌ Error | Verify discount amount |
| 90000 | POS Sign-In Successful | ✅ Success | Terminal ready |
| 90001 | POS Sign-In Failed | ❌ Error | Retry sign-in |
| 700001 | KPOS is Upgrading | ⏳ Processing | Wait for upgrade completion |
| 700002 | KPOS Upgrade Successful | ✅ Success | Terminal upgraded |
| 700003 | Application Update Failed | ❌ Error | Retry update |
| 700004 | Kiosk Mode Does Not Support Tips | ❌ Error | Disable tips in Kiosk mode |
| 700005 | Kiosk Mode Does Not Support Reversal | ❌ Error | Reversal not available |
| 700006 | Kiosk Mode Does Not Support Refund | ❌ Error | Refund not available |
| 700007 | Kiosk Mode Does Not Support Printing Operations | ❌ Error | Print not available |
| **700029** | Password (PIN) Canceled | ⚠️ Cancelled | **User cancelled payment** |
| **700034** | Transaction Not Completed, Please Query | ⏳ Pending | **Use GET /v2/pos/query** |
| **700035** | Transaction Failed, Please Reverse | ❌ Failed | **Call POST /v2/pos/reverse** |
| 700040 | Print Successful | ✅ Success | Receipt printed |
| 700041 | Print Failed | ⚠️ Warning | Receipt not printed |

### Critical Response Code Categories

#### ✅ Success - Close Bill/Session
- **10000**: Transaction completely successful → **Close bill and session**

#### ⏳ Pending - Query Actively
When receiving these codes, **DO NOT CLOSE THE BILL**. Actively query transaction status:
- **20011**: Transaction Processing
- **20014**: Transaction Query in Progress
- **20016**: Waiting for Foreground Application Processing
- **50006**: Last Transaction Not Completed
- **700034**: Transaction Not Completed

**Action:** Call `GET /v2/pos/query` with the outTradeNo to check actual transaction status

#### ⚠️ Cancelled/Failed - Keep Bill Open
When user cancels or transaction fails, **DO NOT CLOSE THE BILL**:
- **20017**: QR Code Transaction Closed (user cancelled)
- **700029**: Password/PIN Cancelled (user cancelled)
- **700035**: Transaction Failed
- network timeouts or no response

**Action:** Keep bill open, allow user to retry payment

### Implementation Rule

```
IF response code == 10000:
    ✅ Close bill and session
ELSE:
    ❌ Keep bill open
    If code in [20011, 20014, 20016, 50006, 700034]:
        ⏳ Query status with GET /v2/pos/query
    Else if code in [20017, 700029, 700035]:
        ⚠️ Show cancellation message, allow retry
    Else:
        ❌ Show error and allow retry
```

---

## Related Documentation

For additional payment processing systems and reference implementations, see:
- `PAYMENT_ASIA_SPECIFICATION.md` - Payment Asia Gateway API
- `DATABASE_SCHEMA_FINAL.md` - Transaction table structures
- `KPay_TERMINAL_SERVICE_INTEGRATION.md` - Service layer implementation

---

**Last Updated:** March 29, 2026  
**For Questions:** Refer to KPay official documentation or contact support  
**Integration Status:** ✅ Implemented and tested in production
