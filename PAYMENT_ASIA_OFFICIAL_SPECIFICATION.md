# Payment Asia Official Specification

**Source**: Official Payment Asia Payment Gateway Documentation  
**Date**: March 2026  
**Version**: 1.0 (COMPLETE)

---

## HTTP POST Request - Endpoints

### Merchant Token
Acquire the Merchant Token from Merchant Platform

### Live Environment
- **Payment Form**: `POST https://payment.pa-sys.com/app/page/[Merchant Token]`
- **Signature Tool**: `POST https://payment.pa-sys.com/app/page/signature/[Merchant Token]`
- **Generic Gateway**: `POST https://payment.pa-sys.com/app/page/generic/[Merchant Token]`

### Sandbox Environment
- **Payment Form**: `POST https://payment-sandbox.pa-sys.com/app/page/[Merchant Token]`
- **Generic Gateway**: `POST https://payment-sandbox.pa-sys.com/app/page/generic/[Merchant Token]`

**Notes**:
- To request a sandbox testing account, contact `technicalsupport@paymentasia.com` with your registered company name and contact email
- To use the signature verification tool, you must have a production account. Otherwise, follow the signature generation method detailed below
- The generic gateway is an all-in-one solution allowing users to choose payment methods freely. Set `network` parameter to `UserDefine` to use it

---

## Complete Field Specification

| Field | Mandatory | Type | Max Length | Constraint | Notes |
|-------|-----------|------|-----------|-----------|-------|
| `merchant_reference` | ✅ | string | 36 | Unique per request | Must be unique across all payment requests |
| `currency` | ✅ | string | 3 | HKD, USD | CreditCard supports HKD and USD; other channels support HKD only |
| `amount` | ✅ | string | 24 | Decimal format | e.g., 10000.00, 100.00, 1.00. **For Octopus: use one decimal place** (e.g., 10000.0, 100.0, 1.0) |
| `sign` | ✅ | string | 128 | SHA-512 hex | Generated signature (see Signature Calculation section) |
| `return_url` | ✅ | string | 255 | Valid URL | Customer redirected here after payment. Must be publicly accessible |
| `customer_ip` | ✅ | string | 15 | IPv4 format | e.g., 123.123.123.123 |
| `customer_first_name` | ✅ | string | 255 | Text | Customer's first name |
| `customer_last_name` | ✅ | string | 255 | Text | Customer's last name |
| `customer_phone` | ✅ | string | 64 | Phone number | Contact number |
| `customer_email` | ✅ | string | 255 | Email | Valid email address |
| `network` | ✅ | string | 64 | Case-sensitive exact match | Values: `Alipay`, `Wechat`, `CUP`, `CreditCard`, `Fps`, `Octopus`, `UserDefine`. **Case must match exactly** |
| `subject` | ✅ | string | 255 | Order description | Order name or keywords of the order |
| `notify_url` | ✅ | string | 255 | Valid URL | Server-to-server callback URL for payment datafeed. Must be publicly accessible |
| `customer_address` | ❌ | text | N/A | Required for CreditCard | Billing address. **REQUIRED if network is CreditCard** |
| `customer_state` | ❌ | string | 2 | Two-letter code | State/Province abbreviation. e.g., 'HK' for Hong Kong. **REQUIRED if network is CreditCard** |
| `customer_country` | ❌ | string | 2 | ISO ALPHA-2 code | Country code (e.g., HK, TW, US). **REQUIRED if network is CreditCard** |
| `customer_postal_code` | ❌ | string | 64 | Postal code format | **REQUIRED if network is CreditCard** |
| `lang` | ❌ | string | 5 | Language code | Options: `zh-en` (default), `zh-cn`, `zh-tw` |

---

## Network-Specific Requirements

### CreditCard Network
**All of these fields are REQUIRED**:
- ✅ `customer_address`
- ✅ `customer_state` (two-letter abbreviation)
- ✅ `customer_country` (ISO ALPHA-2 code)
- ✅ `customer_postal_code`

**Supported currencies**: HKD, USD

### Alipay, Wechat, CUP, Fps, Octopus
**Supported currency**: HKD only

**Special note for Octopus**:
- Amount format must use **ONE decimal place**: `100.0` instead of `100.00`

### Generic Gateway (UserDefine)
- Set `network` to `UserDefine` to allow users to choose payment method
- Users can select from all available payment networks on Payment Asia's interface

---

## Important Recommendations

> ⚠️ **We strongly recommend merchants provide all information even if some fields might not be mandatory for better fraud detection.**

1. Always provide complete customer information
2. Verify network value case exactly matches specification (case-sensitive)
3. Use ISO ALPHA-2 country codes (HK, TW, US, SG, etc.)
4. For addresses, provide full details when available
5. Keep `merchant_reference` unique and trackable for reconciliation
6. Ensure `return_url` and `notify_url` are publicly accessible HTTPS endpoints
7. Test signature generation before going live

---

## Signature Calculation - EXACT SPECIFICATION

### The Algorithm

1. **Create fields dictionary** with payment parameters
2. **Sort fields alphabetically by key** using `ksort()` (PHP) or equivalent
3. **Build query string** using `http_build_query()` (URL-encoded format)
4. **Append secret code** to query string (NO separator, NO ampersand)
5. **Calculate SHA512 hash** of the combined string
6. **Result is 128-character hexadecimal string**

### Example: Step-by-Step

**Step 1: Original Fields (unsorted)**
```
merchant_reference=1234567890
currency=HKD
amount=100.00
customer_ip=123.123.123.123
customer_first_name=John
customer_last_name=Doe
customer_address=1, Bay Street
customer_phone=0123123123
customer_email=someone@gmail.com
customer_state=NY
customer_country=US
return_url=https://demo.shop.com/payment/return
network=Alipay
subject=IphoneX
```

**Step 2: After Alphabetical Sort (ksort - CRITICAL)**
```
amount=100.00
currency=HKD
customer_address=1, Bay Street
customer_country=US
customer_email=someone@gmail.com
customer_first_name=John
customer_ip=123.123.123.123
customer_last_name=Doe
customer_phone=0123123123
customer_state=NY
merchant_reference=1234567890
network=Alipay
return_url=https://demo.shop.com/payment/return
subject=IphoneX
```

**Step 3: Build Query String (URL-encoded, using http_build_query or equivalent)**
```
amount=100.00&currency=HKD&customer_address=1%2C+Bay+Street&customer_country=US&customer_email=someone%40gmail.com&customer_first_name=John&customer_ip=123.123.123.123&customer_last_name=Doe&customer_phone=0123123123&customer_state=NY&merchant_reference=1234567890&network=Alipay&return_url=https%3A%2F%2Fdemo.shop.com%2Fpayment%2Freturn&subject=IphoneX
```

**Step 4: Append Secret (NO SEPARATOR)**
```
amount=100.00&currency=HKD&customer_address=1%2C+Bay+Street&customer_country=US&customer_email=someone%40gmail.com&customer_first_name=John&customer_ip=123.123.123.123&customer_last_name=Doe&customer_phone=0123123123&customer_state=NY&merchant_reference=1234567890&network=Alipay&return_url=https%3A%2F%2Fdemo.shop.com%2Fpayment%2Freturn&subject=IphoneX127f7830-b856-4ddf-92b4-a6478e38547b
```

**Step 5: SHA512 Hash**
```
SHA512(step_4_string) = a36026912f25eb4ef4ea23d6f9760fa0e664f7561fa993976b44b3036cd251ab53c6d7401e7b0f2f492867d4d4d59a0abee931bb9040ae8a5b0b0516a7f0923b
```

**Result**: 128-character hexadecimal string sent as `sign` parameter

---

## Official Sample Request (PHP)

```php
<?php
$secret = '127f7830-b856-4ddf-92b4-a6478e38547b'; // Signature Secret
$fields = array(
    'merchant_reference' => '1234567890',
    'currency' => 'HKD',
    'amount' => '100.00',
    'customer_ip' => '123.123.123.123',
    'customer_first_name' => 'John',
    'customer_last_name' => 'Doe',
    'customer_address' => '1, Bay Street',
    'customer_phone' => '0123123123',
    'customer_email' => 'someone@gmail.com',
    'customer_state' => 'NY',
    'customer_country' => 'US',
    'return_url' => 'https://demo.shop.com/payment/return',
    'network' => 'Alipay',
    'subject' => 'IphoneX',
    'notify_url' => 'https://demo.shop.com/webhook/payment'
);

// CRITICAL: Sort fields alphabetically by key
ksort($fields);

// Generate signature: SHA512(query_string + secret) - NO SEPARATOR
$fields['sign'] = hash('SHA512', http_build_query($fields) . $secret);
?>
```

---

## Official Sample HTML Output

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
</head>
<body>
    <form method="POST" action="https://payment.pasys.com/app/page/ae476881-7bfc-4da8-bc7d-8203ad0fb28c" 
          name="payment" accept-charset="utf-8">
        <!-- Fields are listed in alphabetical order -->
        <input type="hidden" name="amount" value="100.00" />
        <input type="hidden" name="currency" value="HKD" />
        <input type="hidden" name="customer_address" value="1, Bay Street" />
        <input type="hidden" name="customer_country" value="US" />
        <input type="hidden" name="customer_email" value="someone@gmail.com" />
        <input type="hidden" name="customer_first_name" value="John" />
        <input type="hidden" name="customer_ip" value="123.123.123.123" />
        <input type="hidden" name="customer_last_name" value="Doe" />
        <input type="hidden" name="customer_phone" value="0123123123" />
        <input type="hidden" name="customer_state" value="NY" />
        <input type="hidden" name="merchant_reference" value="1234567890" />
        <input type="hidden" name="network" value="Alipay" />
        <input type="hidden" name="return_url" value="https://demo.shop.com/payment/return" />
        <input type="hidden" name="subject" value="IphoneX" />
        <input type="hidden" name="notify_url" value="https://demo.shop.com/webhook/payment" />
        <input type="hidden" name="sign" 
               value="a36026912f25eb4ef4ea23d6f9760fa0e664f7561fa993976b44b3036cd251ab53c6d7401e7b0f2f492867d4d4d59a0abee931bb9040ae8a5b0b0516a7f0923b" />
    </form>
</body>
</html>
```

---

## Implementation Checklist

- ✅ All required fields populated and non-empty
- ✅ Fields sorted strictly alphabetically by key (ksort or equivalent)
- ✅ Query string URL-encoded correctly (spaces = %20 or +)
- ✅ Secret appended with NO separator to query string
- ✅ SHA512 hash calculated on combined string (not any other algorithm)
- ✅ Signature is exactly 128 hexadecimal characters
- ✅ Signature sent as `sign` parameter
- ✅ `network` value matches exactly (case-sensitive)
- ✅ POST to correct endpoint (sandbox vs live)
- ✅ For CreditCard: `customer_address`, `customer_state`, `customer_country`, `customer_postal_code` all included
- ✅ For Octopus: amount uses one decimal place (100.0, not 100.00)
- ✅ return_url and notify_url are publicly accessible HTTPS endpoints

---

## Common Signature Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Signature rejected on Payment Asia | Fields not sorted alphabetically | Use `ksort()` or equivalent to sort by key strictly |
| Signature mismatch | Wrong field order or wrong encoding | Verify alphabetical sort and URL encoding |
| Empty signature | Missing secret code | Ensure secret is appended directly (no separator) |
| Invalid hash format | Using different algorithm | Use **SHA512 only**, not MD5/SHA1 |
| Missing fields in signature | Not including required params | Verify all 12+ mandatory fields are present |
| Network not recognized | Case mismatch in network value | Use exact case: `CreditCard`, `Alipay`, `Wechat`, `CUP`, `Fps`, `Octopus` |
| CreditCard rejected | Missing address fields | For CreditCard, must include address, state, country, postal_code |
| Octopus decimal error | Amount format wrong | For Octopus, use one decimal place: `100.0` not `100.00` |

---

## Handling Payment Asia Response - Validation

When Payment Asia redirects the customer back to your `return_url` (or POSTs to `notify_url`), you receive payment status data. **You MUST validate both the signature and the payment details** before updating your order.

### Response Fields Returned by Payment Asia

| Field | Type | Description |
|-------|------|-------------|
| `amount` | string | Transaction amount (must match order amount exactly) |
| `currency` | string | Transaction currency (must match order currency exactly) |
| `merchant_reference` | string | Your original order/merchant reference (must match) |
| `status` | string | Payment result code (0, 1, 2, etc.) |
| `request_reference` | string | Payment Asia's transaction reference |
| `sign` | string | SHA-512 signature for validation |

### Payment Status Codes

| Status Code | Meaning |
|------------|---------|
| `0` | **Pending** - Payment is pending for deposit |
| `1` | **Accepted** - Payment deposit is accepted / Success |
| `2` | **Rejected** - Payment deposit is rejected / Failed || `4` | **Processing** - Transaction is being processed by the system |
### Response Validation - Official Sample (PHP)

```php
<?php
// 1. Define your order details
$order = array(
    'id' => '1234567890',               // Your merchant_reference
    'currency' => 'USD',                // Original order currency
    'amount' => '100.00'                // Original order amount
);

$secret = '127f7830-b856-4ddf-92b4-a6478e38547b'; // Signature Secret

// 2. Define which fields to extract from response
$fields = array(
    'amount',
    'currency',
    'request_reference',
    'merchant_reference',
    'status',
    'sign'
);

// 3. Extract all fields from POST data (Payment Asia return/notify)
$data = array();
foreach ($fields as $_field) {
    $data[$_field] = filter_input(INPUT_POST, $_field, FILTER_SANITIZE_STRING);
}

// 4. Extract and remove signature (don't include in hash calculation)
$sign = $data['sign'];
unset($data['sign']);

// 5. Sort fields alphabetically (critical for validation)
ksort($data);

// 6. VALIDATE SIGNATURE - Verify Payment Asia's authenticity
if ($sign !== hash('SHA512', http_build_query($data) . $secret)) {
    exit; // ❌ SIGNATURE VALIDATION FAILED - IGNORE THIS RESPONSE
}

// 7. VALIDATE AMOUNT - Must match order exactly (use bccomp for precision)
if (bccomp($order['amount'], $data['amount'], 2) !== 0) {
    exit; // ❌ AMOUNT MISMATCH - IGNORE THIS RESPONSE
}

// 8. VALIDATE CURRENCY - Must match order exactly
if ($order['currency'] !== $data['currency']) {
    exit; // ❌ CURRENCY MISMATCH - IGNORE THIS RESPONSE
}

// 9. VALIDATE MERCHANT REFERENCE - Must match order ID
if ($order['id'] !== $data['merchant_reference']) {
    exit; // ❌ MERCHANT REFERENCE MISMATCH - IGNORE THIS RESPONSE
}

// ✅ ALL VALIDATIONS PASSED - Response is authentic and matches order

/**
 * After validation above, the response is valid for your system to update accordingly:
 *
 * $data['status'] === '0' → Payment pending for deposit
 * $data['status'] === '1' → Payment deposit accepted (SUCCESS)
 * $data['status'] === '2' → Payment deposit rejected (FAILED)
 */

switch ($data['status']) {
    case '0':
        // Update order status to PENDING
        break;
    case '1':
        // Update order status to PAID/COMPLETED
        break;
    case '2':
        // Update order status to FAILED
        break;
}
?>
```

### Critical Validation Points

⚠️ **IMPORTANT**: Always validate in this exact order:

1. **Signature Validation** - Verify Payment Asia authenticity
   - Extract `sign` parameter
   - Sort remaining fields alphabetically (ksort)
   - Calculate SHA512(query_string + secret)
   - Compare with received `sign`
   - If mismatch: **IGNORE the response entirely**

2. **Amount Validation** - Verify transaction amount
   - Use precise decimal comparison (not string comparison)
   - Use `bccomp()` function for decimal precision (compare 2 decimal places)
   - Must match your order amount exactly
   - If mismatch: **IGNORE the response entirely**

3. **Currency Validation** - Verify transaction currency
   - Must match your order currency exactly
   - If mismatch: **IGNORE the response entirely**

4. **Merchant Reference Validation** - Verify order identity
   - Must match your order ID/reference exactly
   - Prevents processing payment for wrong order
   - If mismatch: **IGNORE the response entirely**

### Response Signature Validation Algorithm

**Different from request signature!** Response signature only includes 5 fields:

```
Fields to sign (in alphabetical order):
- amount
- currency
- merchant_reference
- request_reference
- status

DO NOT INCLUDE: sign field itself
```

**Step-by-step**:

```
1. Extract all fields from POST data
2. Remove 'sign' field from data before signing
3. Sort remaining 5 fields alphabetically by key (ksort)
4. Build query string: http_build_query($data)
5. Append secret: query_string + secret (NO SEPARATOR)
6. Calculate SHA512 hash
7. Compare with received 'sign' parameter
8. If mismatch, ignore the response
```

### Example: Processing Valid Payment Response

```php
// After all validations pass:

$paymentStatus = $data['status'];
$merchantRef = $data['merchant_reference'];
$paymentRef = $data['request_reference'];
$amount = $data['amount'];
$currency = $data['currency'];

// Update your database
$query = "UPDATE orders SET";
switch ($paymentStatus) {
    case '0':
        $query .= " status = 'PENDING'";
        break;
    case '1':
        $query .= " status = 'PAID', payment_reference = '{$paymentRef}', paid_at = NOW()";
        break;
    case '2':
        $query .= " status = 'FAILED', payment_failed_at = NOW()";
        break;
}
$query .= " WHERE merchant_reference = '{$merchantRef}'";

// Execute with safety checks...
```

---

## Integration Points

### Receiving Payment Results (return_url)

Payment Asia redirects the customer browser back to your `return_url` with these parameters:
- `amount`: Transaction amount
- `currency`: Transaction currency  
- `merchant_reference`: Your original order reference
- `request_reference`: Payment Asia's transaction ID
- `status`: Payment result (0=pending, 1=accepted, 2=rejected)
- `sign`: Signature for validation

### Server-to-Server Callback (notify_url)

Payment Asia POSTs to your `notify_url` with the same payment datafeed for asynchronous processing:
- Same fields as return_url redirect
- For server-side verification and order updates
- Happens independently of customer's browser

**Note**: Always validate responses from BOTH redirect and webhook endpoints using the same validation process.

---

## Our Implementation

**File**: [backend/src/routes/payment-gateway.routes.ts](backend/src/routes/payment-gateway.routes.ts)  
**Function**: `createPaymentAsiaSignature(fields, secretCode)`

Aligns with official spec:
- ✅ Uses sortedKeys array with all required fields in alphabetical order
- ✅ Never re-sorts the keys (maintains exact alphabetical order)
- ✅ URL-encodes using RFC 3986 compatible `encodeForSignature()`
- ✅ Appends secretCode directly with NO separator
- ✅ Calculates SHA512 hash (not any other algorithm)
- ✅ Returns 128-character hexadecimal signature
- ✅ Supports network-specific field requirements (CreditCard, Octopus, etc.)

---

# Appendix

## Signature Generation

Signatures are used to protect your payment requests and prevent data forgery. Each signature is a SHA-512 hash calculated from your payment fields and a secret code.

### Acquiring Signature Secret

Your Signature Secret is provided by Payment Asia and can be retrieved from your Merchant Platform account. This secret must be kept confidential and never exposed in client-side code.

```
Example Secret: 127f7830-b856-4ddf-92b4-a6478e38547b
```

### Complete Signature Example

#### Step 1: Payment Fields (before sorting)

```php
<?php
$secret = '127f7830-b856-4ddf-92b4-a6478e38547b'; // Signature Secret

$fields = array(
    'merchant_reference' => '1234567890',
    'currency' => 'HKD',
    'amount' => '100.00',
    'customer_ip' => '123.123.123.123',
    'customer_first_name' => 'John',
    'customer_last_name' => 'Doe',
    'customer_address' => '1, Bay Street',
    'customer_phone' => '0123123123',
    'customer_email' => 'someone@gmail.com',
    'customer_state' => 'NY',
    'customer_country' => 'US',
    'return_url' => 'https://demo.shop.com/payment/return',
    'network' => 'Alipay',
    'subject' => 'IphoneX'
);
?>
```

#### Step 2: Sort Fields Alphabetically

```php
ksort($fields);  // Result: fields sorted by key alphabetically
```

#### Step 3: Pre-Signature String (Query String + Secret)

```
amount=100.00&currency=HKD&customer_address=1%2C+Bay+Street&customer_country=US&customer_email=someone%40gmail.com&customer_first_name=John&customer_ip=123.123.123.123&customer_last_name=Doe&customer_phone=0123123123&customer_state=NY&merchant_reference=1234567890&network=Alipay&return_url=https%3A%2F%2Fdemo.shop.com%2Fpayment%2Freturn&subject=IphoneX127f7830-b856-4ddf-92b4-a6478e38547b
```

**Key points**:
- Query string is URL-encoded (using `http_build_query()`)
- Secret is appended directly with NO separator
- Spaces become `%20` or `+`
- Special characters are URL-encoded

#### Step 4: Calculate SHA-512 Hash

```php
$fields['sign'] = hash('SHA512', http_build_query($fields) . $secret);
```

#### Step 5: Result Signature

```
a36026912f25eb4ef4ea23d6f9760fa0e664f7561fa993976b44b3036cd251ab53c6d7401e7b0f2f492867d4d4d59a0abee931bb9040ae8a5b0b0516a7f0923b
```

**Properties**:
- Exactly 128 hexadecimal characters
- SHA-512 algorithm (definitive)
- Unique to this specific field set and secret combination

### Signature Verification

To verify a received signature (from Payment Asia response):

```php
// Remove the signature from data before hashing
$receivedSign = $data['sign'];
unset($data['sign']);

// Sort and hash
ksort($data);
$expectedSign = hash('SHA512', http_build_query($data) . $secret);

// Compare
if ($receivedSign === $expectedSign) {
    // ✅ Signature is valid - from Payment Asia
} else {
    // ❌ Signature is invalid - reject this data
    exit;
}
```

---

## Transaction Status Codes

Payment Asia returns one of these status codes to indicate the payment result:

| Code | Status | Meaning |
|------|--------|---------|
| `0` | **PENDING** | Transaction is pending for further action from customer. Payment processing has not completed. |
| `1` | **SUCCESS** | Transaction is accepted by gateway. Payment has been successfully processed. |
| `2` | **FAIL** | Transaction is rejected by gateway. Payment failed or was declined. |
| `4` | **PROCESSING** | Transaction is being processed by the system. Status pending confirmation. |

### Status Handling Logic

```php
switch ($data['status']) {
    case '0':
        // Order status: PENDING
        // Action: Await customer completion or timeout
        // DB: UPDATE orders SET status = 'PENDING' WHERE id = {order_id}
        break;
        
    case '1':
        // Order status: PAID / COMPLETED
        // Action: Fulfill order, send confirmation
        // DB: UPDATE orders SET status = 'PAID', paid_at = NOW() WHERE id = {order_id}
        break;
        
    case '2':
        // Order status: FAILED / REJECTED
        // Action: Notify customer, allow retry
        // DB: UPDATE orders SET status = 'FAILED', failed_at = NOW() WHERE id = {order_id}
        break;
        
    case '4':
        // Order status: PROCESSING
        // Action: Hold, await final status update
        // DB: UPDATE orders SET status = 'PROCESSING' WHERE id = {order_id}
        break;
        
    default:
        // Unknown status - reject
        exit;
}
```

### Status Flow

```
Customer initiates payment
           ↓
Status 0 (PENDING) - Processing started
           ↓
    ┌─────┴─────┬─────────┐
    ↓           ↓         ↓
Status 1    Status 2   Status 4
(SUCCESS)   (FAIL)    (PROCESSING)
   ↓           ↓           ↓
 PAID      REJECTED    HOLD STATE
(Fulfill)  (Retry)    (Await update)
```

---

## Management API — Payment Query Record Fields

When calling `POST /[Merchant Token]/payment/query`, the `payload` array contains transaction records. Each record includes the following fields:

### Record Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Record type — see Type Codes below |
| `status` | string | Transaction status — see Status Codes below |
| `amount` | string | Transaction amount (decimal, e.g. `"100.00"`) |
| `currency` | string | Currency code (e.g. `"HKD"`) |
| `merchant_reference` | string | Your original merchant reference |
| `request_reference` | string | Payment Asia's internal transaction reference |
| `created_time` | string | Transaction creation timestamp |
| `completed_time` | string | Transaction completion timestamp (if completed) |

### Record Type Codes (`type` field)

| Value | Meaning |
|-------|---------|
| `1` | **Sale** — original payment transaction |
| other | **Refund** — a refund record linked to the sale |

### Record Status Codes (`status` field)

These apply to each record returned by the Payment Query API and the Refund Query API:

| Value | Status | Description |
|-------|--------|-------------|
| `0` | **PENDING** | Transaction is pending for further action from customer |
| `1` | **SUCCESS** | Transaction is accepted by gateway |
| `2` | **FAIL** | Transaction is rejected by gateway |
| `4` | **PROCESSING** | Transaction is processing by the system |

### Example Response Structure

```json
{
  "payload": [
    {
      "type": "1",
      "status": "1",
      "amount": "100.00",
      "currency": "HKD",
      "merchant_reference": "ORDER-12345",
      "request_reference": "PA-REF-XXXXXXXX",
      "created_time": "2026-03-31 10:00:00",
      "completed_time": "2026-03-31 10:00:05"
    }
  ]
}
```

> ⚠️ If `payload` is `[]` (empty array), no transaction record was found for the given `merchant_reference`. This does **not** mean payment was successful — it means the query API has no record for that reference. Always treat an empty result as "unknown / unverified".

### Refund Query Status Codes

When calling `POST /v1.1/online/[Merchant Token]/transactions/refund-query`, the `payload` contains:

| Value | Status | Description |
|-------|--------|-------------|
| `4` | **PROCESSING** | Refund is being processed (initial state after submission) |
| `1` | **SUCCESS** | Refund has been completed successfully |
| `2` | **FAIL** | Refund was rejected |


