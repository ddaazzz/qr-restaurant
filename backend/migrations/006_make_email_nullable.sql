-- Make email column nullable to support staff/kitchen users
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
