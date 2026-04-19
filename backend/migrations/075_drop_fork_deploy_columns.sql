-- Drop unused fork/deploy columns from restaurants table
-- These were used for the per-restaurant git branch + Render service deployment model
-- which has been replaced by the JSONB config system (feature_flags, ui_config)

ALTER TABLE restaurants DROP COLUMN IF EXISTS custom_branch;
ALTER TABLE restaurants DROP COLUMN IF EXISTS render_service_id;
