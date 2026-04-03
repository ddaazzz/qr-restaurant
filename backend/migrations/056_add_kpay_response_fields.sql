-- Migration: Add comprehensive KPay response data fields
-- Date: 2026-03-30
-- Purpose: Store all KPay API response fields for audit trail, reconciliation, and compliance

-- Main Response Data Fields
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS response_code INTEGER;
COMMENT ON COLUMN kpay_transactions.response_code IS 'KPay response code (10000=success, others indicate failures/pending)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS out_trade_no VARCHAR(32);
COMMENT ON COLUMN kpay_transactions.out_trade_no IS 'Merchant order number from KPay response';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS transaction_no VARCHAR(32);
COMMENT ON COLUMN kpay_transactions.transaction_no IS 'KPay merchant order number (QR code and Octopus transactions)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS ref_no VARCHAR(32);
COMMENT ON COLUMN kpay_transactions.ref_no IS 'KPay merchant transaction reference number (card transactions)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_out_trade_no VARCHAR(20);
COMMENT ON COLUMN kpay_transactions.kpay_out_trade_no IS 'KPay merchant order number (20 digits)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS description VARCHAR(128);
COMMENT ON COLUMN kpay_transactions.description IS 'Product description from response';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS pay_amount VARCHAR(12);
COMMENT ON COLUMN kpay_transactions.pay_amount IS 'Payment amount (smallest currency unit, e.g., 000000000100 for HKD 1.00)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS tips_amount VARCHAR(12);
COMMENT ON COLUMN kpay_transactions.tips_amount IS 'Tip amount (smallest currency unit)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS pay_currency VARCHAR(4);
COMMENT ON COLUMN kpay_transactions.pay_currency IS 'Payment currency code (currently only 344 for HKD)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS member_code VARCHAR(32);
COMMENT ON COLUMN kpay_transactions.member_code IS 'Member code from response';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS reason VARCHAR(128);
COMMENT ON COLUMN kpay_transactions.reason IS 'Transaction failure reason';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS pay_method BIGINT;
COMMENT ON COLUMN kpay_transactions.pay_method IS 'Payment method (1:Visa, 2:MC, 3:UnionPay, 4:WeChat, 5:Alipay, 6:AmEx, 7:Diners, 8:JCB, 9:UPQuickPass, 11:Octopus, 12:Payme, 14:FPS)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS transaction_type_code BIGINT;
COMMENT ON COLUMN kpay_transactions.transaction_type_code IS 'Transaction type code (1:Sale, 2:Refund, 3:Reversal, 4:Pre-auth, 5:Pre-auth completion, 6:Sale cancellation, 7:Tip adjustment, 8:Tip cancellation, 9:Pre-auth cancellation, 10:Pre-auth completion cancellation)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS pay_result INTEGER;
COMMENT ON COLUMN kpay_transactions.pay_result IS 'Payment result (-1:Timeout, 1:Pending, 2:Success, 3:Failed, 4:Refunded, 5:Cancelled, 6:Transaction cancelled)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS need_signature BOOLEAN;
COMMENT ON COLUMN kpay_transactions.need_signature IS 'Whether signature is required on receipt';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS remark VARCHAR(256);
COMMENT ON COLUMN kpay_transactions.remark IS 'Merchant custom information';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS discount_amount VARCHAR(12);
COMMENT ON COLUMN kpay_transactions.discount_amount IS 'Discount amount (smallest currency unit)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS discount_description VARCHAR(128);
COMMENT ON COLUMN kpay_transactions.discount_description IS 'Discount description';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS order_amount VARCHAR(12);
COMMENT ON COLUMN kpay_transactions.order_amount IS 'Order amount (payAmount+tipsAmount+discountAmount)';

-- KPay Receipt Data (returned when includeReceipt is true)
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_merchant_no VARCHAR(15);
COMMENT ON COLUMN kpay_transactions.kpay_merchant_no IS 'KPay merchant number (15 digits)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_merchant_name_zh VARCHAR(36);
COMMENT ON COLUMN kpay_transactions.kpay_merchant_name_zh IS 'KPay merchant store Chinese name';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_merchant_name_en VARCHAR(100);
COMMENT ON COLUMN kpay_transactions.kpay_merchant_name_en IS 'KPay merchant store English name';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_merchant_address VARCHAR(100);
COMMENT ON COLUMN kpay_transactions.kpay_merchant_address IS 'KPay merchant store address';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS card_no VARCHAR(19);
COMMENT ON COLUMN kpay_transactions.card_no IS 'Bank card number (masked) / Octopus card number';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS card_input_code VARCHAR(1);
COMMENT ON COLUMN kpay_transactions.card_input_code IS 'Card data acquisition method (S:Swipe, I:Insert, C:Tap, F:Chip downgrade, M:Manual)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS batch_no VARCHAR(6);
COMMENT ON COLUMN kpay_transactions.batch_no IS 'KPay batch number';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS trace_no VARCHAR(6);
COMMENT ON COLUMN kpay_transactions.trace_no IS 'KPay trace number';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS org_trace_no VARCHAR(6);
COMMENT ON COLUMN kpay_transactions.org_trace_no IS 'KPay original transaction trace number (refunds)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS org_transaction_no VARCHAR(32);
COMMENT ON COLUMN kpay_transactions.org_transaction_no IS 'KPay original merchant order number (QR code transactions)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_member_no VARCHAR(32);
COMMENT ON COLUMN kpay_transactions.kpay_member_no IS 'KPay member number';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS auth_code VARCHAR(16);
COMMENT ON COLUMN kpay_transactions.auth_code IS 'Authorization code (bank card transactions)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS payment_id VARCHAR(32);
COMMENT ON COLUMN kpay_transactions.payment_id IS 'Payment institution transaction number (QR code transactions)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS commit_time BIGINT;
COMMENT ON COLUMN kpay_transactions.commit_time IS 'Transaction submission time (UTC timestamp, milliseconds)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS aid VARCHAR(32);
COMMENT ON COLUMN kpay_transactions.aid IS 'Card application ID (card EMV transactions)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS aid_label VARCHAR(32);
COMMENT ON COLUMN kpay_transactions.aid_label IS 'Card application name (card EMV transactions)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS pin_verified VARCHAR(32);
COMMENT ON COLUMN kpay_transactions.pin_verified IS 'Whether offline PIN verification passed (cardInputCode=I only)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS oem_ref_no VARCHAR(32);
COMMENT ON COLUMN kpay_transactions.oem_ref_no IS 'Octopus transaction reference number (Octopus transactions only)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS balance VARCHAR(16);
COMMENT ON COLUMN kpay_transactions.balance IS 'Octopus card balance (Octopus card transactions only)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS tc VARCHAR(32);
COMMENT ON COLUMN kpay_transactions.tc IS 'Card transaction application cryptogram (TC) (card EMV transactions only)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS app_version VARCHAR(16);
COMMENT ON COLUMN kpay_transactions.app_version IS 'KPay POS version number';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS terminal_type VARCHAR(16);
COMMENT ON COLUMN kpay_transactions.terminal_type IS 'Device model';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS device_id VARCHAR(12);
COMMENT ON COLUMN kpay_transactions.device_id IS 'Device unique number';

-- Receipt prompts (for display on POS system)
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_no_signature_zh TEXT;
COMMENT ON COLUMN kpay_transactions.receipt_no_signature_zh IS 'Receipt no signature prompt (Traditional Chinese)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_no_signature_en TEXT;
COMMENT ON COLUMN kpay_transactions.receipt_no_signature_en IS 'Receipt no signature prompt (English)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_signature_zh TEXT;
COMMENT ON COLUMN kpay_transactions.receipt_signature_zh IS 'Receipt signature prompt (Traditional Chinese)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_signature_en TEXT;
COMMENT ON COLUMN kpay_transactions.receipt_signature_en IS 'Receipt signature prompt (English)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_signature_confirm_zh TEXT;
COMMENT ON COLUMN kpay_transactions.receipt_signature_confirm_zh IS 'Receipt account confirmation prompt (Traditional Chinese)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_signature_confirm_en TEXT;
COMMENT ON COLUMN kpay_transactions.receipt_signature_confirm_en IS 'Receipt account confirmation prompt (English)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_disclaimers_zh TEXT;
COMMENT ON COLUMN kpay_transactions.receipt_disclaimers_zh IS 'Receipt disclaimer prompt (Traditional Chinese)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_disclaimers_en TEXT;
COMMENT ON COLUMN kpay_transactions.receipt_disclaimers_en IS 'Receipt disclaimer prompt (English)';

ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS message TEXT;
COMMENT ON COLUMN kpay_transactions.message IS 'Error message (returned when response code is not 10000)';

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_response_code ON kpay_transactions(response_code);
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_pay_result ON kpay_transactions(pay_result);
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_transaction_no ON kpay_transactions(transaction_no);
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_ref_no ON kpay_transactions(ref_no);
