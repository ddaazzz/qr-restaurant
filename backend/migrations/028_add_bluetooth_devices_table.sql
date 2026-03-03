-- Create bluetooth_devices table to store paired/connected devices per restaurant
CREATE TABLE IF NOT EXISTS bluetooth_devices (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  last_connected TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(restaurant_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_bluetooth_devices_restaurant ON bluetooth_devices(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_bluetooth_devices_last_connected ON bluetooth_devices(last_connected DESC);
