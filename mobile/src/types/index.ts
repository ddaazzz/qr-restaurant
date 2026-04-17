// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  role: 'admin' | 'staff' | 'kitchen' | 'superadmin';
  restaurantId: string;
  userId: string;
  access_rights?: Record<string, any> | string[];
  currently_clocked_in?: boolean;
  apiBaseUrl?: string | null;
}

export interface AuthToken {
  token: string;
  expiresAt: number;
}

// Restaurant Types
export interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  logo_url?: string;
  currency: string;
  timezone: string;
}

// Menu Types
export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category_id: string;
  available: boolean;
  variants?: MenuItemVariant[];
}

export interface MenuItemVariant {
  id: string;
  name: string;
  options: VariantOption[];
  required: boolean;
  min_selections?: number;
  max_selections?: number;
}

export interface VariantOption {
  id: string;
  name: string;
  price_modifier: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  order: number;
}

// Table Types
export interface Table {
  id: string;
  number: string;
  capacity: number;
  section?: string;
}

// Session Types
export interface TableSession {
  id: string;
  table_id: string;
  restaurant_id: string;
  qr_token: string;
  started_at: string;
  ended_at?: string;
  total_amount?: number;
  status: 'active' | 'closed';
}

// Order Types
export interface Order {
  id: string;
  session_id: string;
  table_id: string;
  restaurant_id: string;
  items: OrderItem[];
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid';
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  selected_options: OrderItemOption[];
  notes?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served';
}

export interface OrderItemOption {
  variant_id: string;
  option_id: string;
  option_name: string;
  price_modifier: number;
}

// Staff Types
export interface Staff {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'kitchen';
  restaurant_id: string;
  pin?: string;
  active: boolean;
}

// Printer Types
export interface BluetoothPrinter {
  id: string;
  name: string;
  location: 'kitchen' | 'bar' | 'counter';
  isConnected: boolean;
  lastConnected?: number;
}

export interface PrinterConfig {
  deviceId: string;
  name: string;
  location: string;
  paperWidth: number; // in mm
  temperatureSetting: number; // 0-255
}

// POS Integration
export interface BillClosure {
  id: string;
  session_id: string;
  total_amount: number;
  payment_method: string;
  closed_at: string;
  webhook_sent: boolean;
  webhook_response?: any;
}
