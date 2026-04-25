-- Migration 083: Track order item status change timestamps
-- Used for "average time to prepare dish" report

CREATE TABLE IF NOT EXISTS order_item_status_history (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_oish_order_item ON order_item_status_history(order_item_id);
CREATE INDEX IF NOT EXISTS idx_oish_restaurant ON order_item_status_history(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_oish_changed_at ON order_item_status_history(changed_at);

COMMENT ON TABLE order_item_status_history IS 'Tracks every status transition for order items to enable cooking-speed analytics';
