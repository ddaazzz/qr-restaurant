-- Create trigger to notify when new sessions are created
-- This allows the backend to listen for and react to new sessions in real-time

-- Create function that notifies on new session
CREATE OR REPLACE FUNCTION notify_new_session()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_session',
    json_build_object(
      'id', NEW.id,
      'table_id', NEW.table_id,
      'restaurant_id', NEW.restaurant_id,
      'pax', NEW.pax,
      'started_at', NEW.started_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS session_notification_trigger ON table_sessions;

-- Create trigger that fires on INSERT
CREATE TRIGGER session_notification_trigger
AFTER INSERT ON table_sessions
FOR EACH ROW
EXECUTE FUNCTION notify_new_session();

-- Comment for documentation
COMMENT ON TRIGGER session_notification_trigger ON table_sessions IS
  'Automatically notify listeners when a new session is created in the database';
