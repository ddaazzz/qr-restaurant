-- Payment terminal applications (paid feature)
CREATE TABLE IF NOT EXISTS payment_terminal_applications (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  br_license_no TEXT NOT NULL,
  br_certificate_url TEXT,       -- path to uploaded PDF
  restaurant_license_url TEXT,   -- path to uploaded PDF
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
  admin_notes TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pta_restaurant_id ON payment_terminal_applications(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_pta_status ON payment_terminal_applications(status);
