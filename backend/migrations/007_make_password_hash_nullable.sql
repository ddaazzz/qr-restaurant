-- Make password_hash column nullable for staff/kitchen users (they use PIN instead)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
