// Default feature flags — opt-out model: everything enabled unless explicitly false
export const DEFAULT_FEATURE_FLAGS: Record<string, boolean> = {
  bookings: true,
  waitlist: true,
  order_pay: false,
  coupons: true,
  addons: true,
  variants: true,
  item_status_visible: false,
  staff_timekeeping: true,
  kitchen_display: true,
  printer_support: true,
  crm: true,
  multi_language: true,
  service_requests: false,
};

// Default UI config for customer-facing menu
export const DEFAULT_UI_CONFIG: Record<string, any> = {
  layout: "list",
  menu_style: "photo_cards",
  show_prices: true,
  show_descriptions: true,
  show_category_images: false,
  header_style: "banner",
  cart_style: "bottom_sheet",
  custom_css: null,
};

// Merge stored config with defaults
export function mergeFeatureFlags(stored: Record<string, any> | null, restaurant?: any): Record<string, boolean> {
  const merged: Record<string, boolean> = {
    ...DEFAULT_FEATURE_FLAGS,
    ...(stored || {}),
  };
  // Derive order_pay from existing payment config for backward compat
  if (restaurant) {
    merged.order_pay =
      restaurant.active_payment_vendor === "payment-asia" &&
      restaurant.active_payment_terminal_id != null &&
      restaurant.payment_asia_order_pay_enabled !== false;
    merged.item_status_visible = restaurant.show_item_status_to_diners || false;
  }
  return merged;
}

export function mergeUiConfig(stored: Record<string, any> | null): Record<string, any> {
  return {
    ...DEFAULT_UI_CONFIG,
    ...(stored || {}),
  };
}
