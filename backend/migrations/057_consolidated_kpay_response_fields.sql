-- Migration: Consolidated KPay Response Fields
-- Date: 2026-03-30
-- Purpose: Add all KPay API response fields for comprehensive transaction tracking

-- MAIN RESPONSE DATA FIELDS
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS response_code INTEGER;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS out_trade_no VARCHAR(32);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS transaction_no VARCHAR(32);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS ref_no VARCHAR(32);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_out_trade_no VARCHAR(20);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS description VARCHAR(128);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS pay_amount VARCHAR(12);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS tips_amount VARCHAR(12);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS pay_currency VARCHAR(4);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS member_code VARCHAR(32);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS reason VARCHAR(128);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS pay_method BIGINT;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS transaction_type_code BIGINT;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS pay_result INTEGER;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS need_signature BOOLEAN;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS remark VARCHAR(256);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS discount_amount VARCHAR(12);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS discount_description VARCHAR(128);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS order_amount VARCHAR(12);

-- KPAY RECEIPT DATA FIELDS
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_merchant_no VARCHAR(15);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_merchant_name_zh VARCHAR(36);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_merchant_name_en VARCHAR(100);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_merchant_address VARCHAR(100);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS card_no VARCHAR(19);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS card_input_code VARCHAR(1);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS batch_no VARCHAR(6);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS trace_no VARCHAR(6);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS org_trace_no VARCHAR(6);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS org_transaction_no VARCHAR(32);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS kpay_member_no VARCHAR(32);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS auth_code VARCHAR(16);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS payment_id VARCHAR(32);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS commit_time BIGINT;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS aid VARCHAR(32);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS aid_label VARCHAR(32);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS pin_verified VARCHAR(32);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS oem_ref_no VARCHAR(32);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS balance VARCHAR(16);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS tc VARCHAR(32);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS app_version VARCHAR(16);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS terminal_type VARCHAR(16);
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS device_id VARCHAR(12);

-- RECEIPT PROMPTS
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_no_signature_zh TEXT;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_no_signature_en TEXT;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_signature_zh TEXT;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_signature_en TEXT;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_signature_confirm_zh TEXT;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_signature_confirm_en TEXT;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_disclaimers_zh TEXT;
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS receipt_disclaimers_en TEXT;

-- ERROR MESSAGE FROM RESPONSE
ALTER TABLE kpay_transactions ADD COLUMN IF NOT EXISTS message TEXT;

-- CREATE INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_response_code ON kpay_transactions(response_code);
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_pay_result ON kpay_transactions(pay_result);
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_transaction_no ON kpay_transactions(transaction_no);
CREATE INDEX IF NOT EXISTS idx_kpay_transactions_ref_no ON kpay_transactions(ref_no);
