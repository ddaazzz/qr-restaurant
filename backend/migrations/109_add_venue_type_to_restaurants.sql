ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS venue_type VARCHAR(50) DEFAULT 'restaurant',
  ADD COLUMN IF NOT EXISTS has_table_service BOOLEAN DEFAULT true;
