-- Migration 020: Add per-restaurant sequences for bills and bookings
-- Allows each restaurant to have its own 1, 2, 3... numbering for bills and bookings

-- Add restaurant-specific sequence columns to bill_closures table
ALTER TABLE bill_closures
ADD COLUMN IF NOT EXISTS restaurant_bill_number INT;

-- Add restaurant-specific sequence columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS restaurant_booking_number INT;

-- Create a function to get the next bill number for a restaurant
CREATE OR REPLACE FUNCTION get_next_bill_number(p_restaurant_id INT)
RETURNS INT AS $$
DECLARE
  v_next_num INT;
BEGIN
  SELECT COALESCE(MAX(restaurant_bill_number), 0) + 1
  INTO v_next_num
  FROM bill_closures
  WHERE restaurant_id = p_restaurant_id;
  
  RETURN v_next_num;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get the next booking number for a restaurant
CREATE OR REPLACE FUNCTION get_next_booking_number(p_restaurant_id INT)
RETURNS INT AS $$
DECLARE
  v_next_num INT;
BEGIN
  SELECT COALESCE(MAX(restaurant_booking_number), 0) + 1
  INTO v_next_num
  FROM bookings
  WHERE restaurant_id = p_restaurant_id;
  
  RETURN v_next_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for bills
CREATE OR REPLACE FUNCTION set_bill_number_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.restaurant_bill_number IS NULL THEN
    NEW.restaurant_bill_number := get_next_bill_number(NEW.restaurant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for bookings
CREATE OR REPLACE FUNCTION set_booking_number_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.restaurant_booking_number IS NULL THEN
    NEW.restaurant_booking_number := get_next_booking_number(NEW.restaurant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate restaurant_bill_number
DROP TRIGGER IF EXISTS set_restaurant_bill_number ON bill_closures;
CREATE TRIGGER set_restaurant_bill_number
BEFORE INSERT ON bill_closures
FOR EACH ROW
EXECUTE FUNCTION set_bill_number_trigger();

-- Create trigger to auto-populate restaurant_booking_number
DROP TRIGGER IF EXISTS set_restaurant_booking_number ON bookings;
CREATE TRIGGER set_restaurant_booking_number
BEFORE INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_booking_number_trigger();

-- Backfill existing bills with restaurant-specific numbers
UPDATE bill_closures b
SET restaurant_bill_number = (
  SELECT COUNT(*) + 1
  FROM bill_closures b2
  WHERE b2.restaurant_id = b.restaurant_id
  AND b2.id < b.id
)
WHERE restaurant_bill_number IS NULL;

-- Backfill existing bookings with restaurant-specific numbers
UPDATE bookings bk
SET restaurant_booking_number = (
  SELECT COUNT(*) + 1
  FROM bookings bk2
  WHERE bk2.restaurant_id = bk.restaurant_id
  AND bk2.id < bk.id
)
WHERE restaurant_booking_number IS NULL;
