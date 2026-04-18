-- Migration 074: Square-style restaurant config system
-- Adds feature flags, UI config, and custom_data JSONB columns
-- Enables per-restaurant customization without code forks

-- ============================================================
-- 1. Restaurant-level config & feature flags
-- ============================================================

-- feature_flags: controls which features are enabled per restaurant
-- Examples: {"bookings": true, "waitlist": false, "loyalty": true, "order_pay": true}
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}';

-- ui_config: controls visual/layout customization per restaurant
-- Examples: {
--   "layout": "grid",                -- "grid" | "list" | "magazine"
--   "menu_style": "photo_cards",     -- "photo_cards" | "compact" | "minimal"
--   "primary_color": "#f97316",
--   "secondary_color": "#1e293b",
--   "font_family": "default",
--   "show_prices": true,
--   "show_descriptions": true,
--   "show_category_images": false,
--   "header_style": "banner",        -- "banner" | "minimal" | "none"
--   "cart_style": "bottom_sheet",    -- "bottom_sheet" | "sidebar" | "inline"
--   "custom_css": null
-- }
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS ui_config JSONB NOT NULL DEFAULT '{}';

-- custom_domain: vanity domain for the restaurant (e.g. "order.sushiplace.com")
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- ui_mode: how mobile app renders this restaurant
-- 'native' = standard React Native screens (default)
-- 'webview' = load custom_frontend_url in WebView
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS ui_mode TEXT NOT NULL DEFAULT 'native';

-- custom_frontend_url: URL for webview-based custom UI
-- e.g. "https://sushiplace.chuio.io/mobile"
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS custom_frontend_url TEXT;

-- ============================================================
-- 2. custom_data JSONB on core tables (per-restaurant flexible fields)
-- ============================================================

-- Menu items: e.g. {"calories": 850, "allergens": ["gluten"], "prep_station": "grill"}
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS custom_data JSONB NOT NULL DEFAULT '{}';

-- Orders: e.g. {"loyalty_points": 150, "delivery_notes": "ring doorbell"}
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS custom_data JSONB NOT NULL DEFAULT '{}';

-- Order items: e.g. {"special_request": "no onions", "priority": "rush"}
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS custom_data JSONB NOT NULL DEFAULT '{}';

-- Menu categories: e.g. {"display_style": "carousel", "banner_image": "https://..."}
ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS custom_data JSONB NOT NULL DEFAULT '{}';

-- Table sessions: e.g. {"vip": true, "occasion": "birthday"}
ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS custom_data JSONB NOT NULL DEFAULT '{}';

-- ============================================================
-- 3. GIN indexes for fast JSONB queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_restaurants_feature_flags ON restaurants USING GIN (feature_flags);
CREATE INDEX IF NOT EXISTS idx_restaurants_ui_config ON restaurants USING GIN (ui_config);
CREATE INDEX IF NOT EXISTS idx_menu_items_custom_data ON menu_items USING GIN (custom_data);
CREATE INDEX IF NOT EXISTS idx_orders_custom_data ON orders USING GIN (custom_data);
CREATE INDEX IF NOT EXISTS idx_order_items_custom_data ON order_items USING GIN (custom_data);
CREATE INDEX IF NOT EXISTS idx_menu_categories_custom_data ON menu_categories USING GIN (custom_data);
