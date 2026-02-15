-- Create bookings table for table reservations
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  guest_name VARCHAR(255) NOT NULL,
  pax INTEGER NOT NULL CHECK (pax > 0),
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status VARCHAR(50) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no-show')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(table_id, booking_date, booking_time)
);

-- Index for faster lookups
CREATE INDEX idx_bookings_restaurant_date ON bookings(restaurant_id, booking_date);
CREATE INDEX idx_bookings_table_date ON bookings(table_id, booking_date);
