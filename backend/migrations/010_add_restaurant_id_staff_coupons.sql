-- =====================================================
-- Migration 010: Add restaurant_id to Additional Tables
-- =====================================================
-- This migration adds restaurant_id to staff/user related tables
-- and other entities for multi-restaurant support

-- =====================================================
-- 1. CHECK USERS/STAFF TABLE STRUCTURE
-- =====================================================
-- Note: The users table likely exists from auth routes.
-- Verify it has restaurant_id or add if needed

ALTER TABLE users
ADD COLUMN IF NOT EXISTS restaurant_id INTEGER;

-- Add FK constraint
ALTER TABLE users
ADD CONSTRAINT IF NOT EXISTS users_restaurant_id_fkey
FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_users_restaurant_id ON users(restaurant_id);

-- =====================================================
-- 2. COUPONS TABLE - ADD restaurant_id IF NOT EXISTS
-- =====================================================
-- This table likely exists. Add multi-restaurant support

ALTER TABLE coupons
ADD COLUMN IF NOT EXISTS restaurant_id INTEGER;

-- Populate restaurant_id for existing coupons (default to restaurant 1)
UPDATE coupons
SET restaurant_id = 1
WHERE restaurant_id IS NULL;

-- Add FK constraint
ALTER TABLE coupons
ADD CONSTRAINT IF NOT EXISTS coupons_restaurant_id_fkey
FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

-- Set NOT NULL after population
ALTER TABLE coupons
ALTER COLUMN restaurant_id SET NOT NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_coupons_restaurant_id ON coupons(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_coupons_restaurant_code ON coupons(restaurant_id, code);

-- =====================================================
-- 3. VERIFY BILL_CLOSURES HAS restaurant_id
-- =====================================================
-- bill_closures should have restaurant_id via orders
-- Check if it needs explicit restaurant_id column

-- If bill_closures doesn't have direct restaurant_id, ensure orders has it
-- (already added in migration 009)

-- =====================================================
-- 4. CREATE COMPOSITE UNIQUE CONSTRAINTS
-- =====================================================
-- Ensure data isolation at DB level with composite keys

-- For coupons: restaurant + code must be unique
ALTER TABLE coupons
DROP CONSTRAINT IF EXISTS coupons_code_key;

ALTER TABLE coupons
ADD CONSTRAINT coupons_restaurant_code_unique
UNIQUE (restaurant_id, code);

-- =====================================================
-- SUMMARY OF ALL TABLES WITH MULTI-RESTAURANT SUPPORT
-- =====================================================
/*
TABLE STRUCTURE AFTER THESE MIGRATIONS:

✅ restaurants
  - id (PK)
  - name, created_at, theme_color, logo_url

✅ tables  
  - id (PK)
  - restaurant_id (FK) - restaurant scope
  - name, created_at, qr_token

✅ menu_categories
  - id (PK)
  - restaurant_id (FK) - restaurant scope
  - name, sort_order, icon

✅ menu_items
  - id (PK)
  - category_id (FK) -> restaurant_id via category
  - name, price_cents, description, available, image_url

✅ menu_item_variants
  - id (PK)
  - menu_item_id (FK)
  - restaurant_id (FK) - restaurant scope (ADDED)
  - name, required, min_select, max_select

✅ menu_item_variant_options
  - id (PK)
  - variant_id (FK)
  - restaurant_id (FK) - restaurant scope (ADDED)
  - name, price_cents, is_available

✅ table_sessions
  - id (PK)
  - table_id (FK)
  - restaurant_id (FK) - restaurant scope (ADDED, fixes NULL issue)
  - started_at, ended_at

✅ orders
  - id (PK)
  - session_id (FK)
  - restaurant_id (FK) - restaurant scope (ADDED)
  - status, created_at

✅ order_items
  - id (PK)
  - order_id (FK)
  - menu_item_id (FK)
  - restaurant_id (FK) - restaurant scope (ADDED)
  - quantity, price_cents, status, removed

✅ order_item_variants
  - id (PK)
  - order_item_id (FK)
  - variant_option_id (FK)

✅ users/staff
  - id (PK)
  - restaurant_id (FK) - restaurant scope
  - role, email, password_hash, etc.

✅ coupons
  - id (PK)
  - restaurant_id (FK) - restaurant scope
  - code, discount, etc.
  - UNIQUE constraint: (restaurant_id, code)

✅ bill_closures
  - id (PK)
  - order_id (FK) -> has restaurant_id
  - webhook_success, webhook_response, closed_at
*/

-- =====================================================
-- TESTING QUERIES FOR MULTI-RESTAURANT ISOLATION
-- =====================================================
/*

-- Test 1: Verify restaurant 1 and 2 data separation
SELECT COUNT(*) FROM orders WHERE restaurant_id = 1;
SELECT COUNT(*) FROM orders WHERE restaurant_id = 2;

-- Test 2: Verify variants are restaurant-scoped
SELECT miv.id, miv.name, miv.restaurant_id
FROM menu_item_variants miv
WHERE miv.restaurant_id = 1;

-- Test 3: Verify sessions have restaurant_id
SELECT ts.id, ts.restaurant_id, t.name, t.restaurant_id as table_restaurant
FROM table_sessions ts
JOIN tables t ON ts.table_id = t.id
WHERE ts.restaurant_id = 1;

-- Test 4: Verify order_items have restaurant_id
SELECT oi.id, oi.restaurant_id, o.restaurant_id as order_restaurant
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
WHERE oi.restaurant_id = 1;

-- Test 5: Verify no cross-restaurant variant injection possible
SELECT COUNT(*)
FROM order_item_variants oiv
JOIN order_items oi ON oiv.order_item_id = oi.id
JOIN menu_item_variant_options mivo ON oiv.variant_option_id = mivo.id
WHERE oi.restaurant_id != mivo.restaurant_id;
-- Should return 0 if properly isolated
*/
