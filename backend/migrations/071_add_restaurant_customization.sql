-- Migration 071: Add restaurant customization and version tracking columns
-- is_customized: whether this restaurant has a dedicated forked branch/deployment
-- app_version: the platform version this restaurant is pinned to (e.g. '1.1.1')
-- custom_branch: git branch name for this restaurant's fork (e.g. 'restaurant/sushi-ko')
-- render_service_id: Render.com service ID for the custom deployment

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS is_customized BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS app_version TEXT NOT NULL DEFAULT '1.1.1';

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS custom_branch TEXT;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS render_service_id TEXT;
