-- Phone verification codes (for guest order SMS gate)
CREATE TABLE IF NOT EXISTS phone_verifications (
    id SERIAL PRIMARY KEY,
    phone TEXT NOT NULL,
    restaurant_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone, restaurant_id);
