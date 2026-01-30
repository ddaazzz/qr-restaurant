-- Migration: Add kitchen role support and PIN field
-- This migration updates the users table to support kitchen staff role and PIN-based login

-- Step 1: Add PIN column if it doesn't exist
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS pin text;

-- Step 2: Update the role check constraint to allow 'kitchen' role
-- First, we need to drop the old constraint
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 3: Add new constraint that includes 'kitchen' role
ALTER TABLE public.users
ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['admin'::text, 'staff'::text, 'kitchen'::text]));

-- Migration complete
