-- =====================================================
-- Migration 018: Fix ended_at Default to NULL
-- =====================================================
-- Problem: Migration 016 set ended_at DEFAULT to now(), which auto-fills
-- new sessions as if they're already closed
-- Solution: Remove DEFAULT from ended_at (should default to NULL)

ALTER TABLE table_sessions ALTER COLUMN ended_at DROP DEFAULT;
ALTER TABLE bookings ALTER COLUMN booking_date DROP DEFAULT;

-- Fix existing sessions that have ended_at = started_at
-- These should have ended_at = NULL unless actually closed
UPDATE table_sessions 
SET ended_at = NULL 
WHERE ended_at = started_at AND order_type IN ('table', 'to-go', 'counter');
