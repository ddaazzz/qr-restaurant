-- Migration 019: Add per-restaurant sequences for orders and sessions
-- This allows each restaurant to have its own 1, 2, 3... numbering

-- Add restaurant-specific sequence columns to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS restaurant_order_number INT;

-- Add restaurant-specific sequence columns to table_sessions table
ALTER TABLE table_sessions
ADD COLUMN IF NOT EXISTS restaurant_session_number INT;

-- Create a function to get the next order number for a restaurant
CREATE OR REPLACE FUNCTION get_next_order_number(p_restaurant_id INT)
RETURNS INT AS $$
DECLARE
  v_next_num INT;
BEGIN
  SELECT COALESCE(MAX(restaurant_order_number), 0) + 1
  INTO v_next_num
  FROM orders
  WHERE restaurant_id = p_restaurant_id;
  
  RETURN v_next_num;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get the next session number for a restaurant
CREATE OR REPLACE FUNCTION get_next_session_number(p_restaurant_id INT)
RETURNS INT AS $$
DECLARE
  v_next_num INT;
BEGIN
  SELECT COALESCE(MAX(restaurant_session_number), 0) + 1
  INTO v_next_num
  FROM table_sessions
  WHERE restaurant_id = p_restaurant_id;
  
  RETURN v_next_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for orders
CREATE OR REPLACE FUNCTION set_order_number_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.restaurant_order_number IS NULL THEN
    NEW.restaurant_order_number := get_next_order_number(NEW.restaurant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for sessions
CREATE OR REPLACE FUNCTION set_session_number_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.restaurant_session_number IS NULL THEN
    NEW.restaurant_session_number := get_next_session_number(NEW.restaurant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate restaurant_order_number
DROP TRIGGER IF EXISTS set_restaurant_order_number ON orders;
CREATE TRIGGER set_restaurant_order_number
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION set_order_number_trigger();

-- Create trigger to auto-populate restaurant_session_number
DROP TRIGGER IF EXISTS set_restaurant_session_number ON table_sessions;
CREATE TRIGGER set_restaurant_session_number
BEFORE INSERT ON table_sessions
FOR EACH ROW
EXECUTE FUNCTION set_session_number_trigger();

-- Backfill existing orders with restaurant-specific numbers
UPDATE orders o
SET restaurant_order_number = (
  SELECT COUNT(*) + 1
  FROM orders o2
  WHERE o2.restaurant_id = o.restaurant_id
  AND o2.id < o.id
)
WHERE restaurant_order_number IS NULL;

-- Backfill existing sessions with restaurant-specific numbers
UPDATE table_sessions s
SET restaurant_session_number = (
  SELECT COUNT(*) + 1
  FROM table_sessions s2
  WHERE s2.restaurant_id = s.restaurant_id
  AND s2.id < s.id
)
WHERE restaurant_session_number IS NULL;
