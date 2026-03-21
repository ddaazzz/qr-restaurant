-- Migration 044: Add order notification trigger for real-time kitchen auto-print
-- Purpose: Enable WebSocket-based kitchen order notifications
-- This allows kitchen staff to receive orders in real-time without polling

-- Create function that notifies on new order creation
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_order',
    json_build_object(
      'id', NEW.id,
      'session_id', NEW.session_id,
      'restaurant_id', NEW.restaurant_id,
      'status', NEW.status,
      'created_at', NEW.created_at,
      'event', 'order_created'
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function that notifies on order status changes
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if status actually changed
  IF NEW.status != OLD.status THEN
    PERFORM pg_notify(
      'order_status_change',
      json_build_object(
        'id', NEW.id,
        'session_id', NEW.session_id,
        'restaurant_id', NEW.restaurant_id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'updated_at', NOW(),
        'event', 'order_status_changed'
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers (for idempotency)
DROP TRIGGER IF EXISTS order_created_trigger ON orders;
DROP TRIGGER IF EXISTS order_status_change_trigger ON orders;

-- Create trigger that fires on INSERT
CREATE TRIGGER order_created_trigger
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_new_order();

-- Create trigger that fires on UPDATE
CREATE TRIGGER order_status_change_trigger
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_order_status_change();

-- Comments for documentation
COMMENT ON TRIGGER order_created_trigger ON orders IS
  'Automatically notify listeners when a new order is created in the database';

COMMENT ON TRIGGER order_status_change_trigger ON orders IS
  'Automatically notify listeners when an order status changes (pending → preparing → served)';
