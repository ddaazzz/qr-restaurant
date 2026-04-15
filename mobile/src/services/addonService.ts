import { apiClient } from './apiClient';

export interface Addon {
  id: number;
  menu_item_id: number;
  addon_item_id: number;
  addon_name: string;
  addon_description?: string;
  regular_price_cents: number;
  addon_discount_price_cents: number;
  is_available: boolean;
  menu_item_name?: string;
  addon_item_name?: string;
  addon_item_image?: string;
  addon_category_name?: string;
  created_at?: string;
}

export const addonService = {
  /**
   * Get all addons for a restaurant
   */
  async getAllAddons(restaurantId: string): Promise<Addon[]> {
    const response = await apiClient.get(
      `/api/restaurants/${restaurantId}/addons`
    );
    return response.data || [];
  },

  /**
   * Get addons for a specific menu item
   */
  async getAddonsForMenuItem(
    restaurantId: string,
    menuItemId: number
  ): Promise<Addon[]> {
    const response = await apiClient.get(
      `/api/restaurants/${restaurantId}/menu-items/${menuItemId}/addons`
    );
    return response.data || [];
  },

  /**
   * Create a new addon
   */
  async createAddon(restaurantId: string, addon: {
    menu_item_id: number;
    addon_item_id: number;
    addon_name: string;
    addon_description?: string;
    regular_price_cents: number;
    addon_discount_price_cents: number;
  }): Promise<Addon> {
    const response = await apiClient.post(
      `/api/restaurants/${restaurantId}/addons`,
      addon
    );
    return response.data;
  },

  /**
   * Update an addon
   */
  async updateAddon(
    restaurantId: string,
    addonId: number,
    updates: Partial<{
      addon_name: string;
      addon_description: string;
      regular_price_cents: number;
      addon_discount_price_cents: number;
      is_available: boolean;
    }>
  ): Promise<Addon> {
    const response = await apiClient.patch(
      `/api/restaurants/${restaurantId}/addons/${addonId}`,
      updates
    );
    return response.data;
  },

  /**
   * Delete an addon
   */
  async deleteAddon(restaurantId: string, addonId: number): Promise<void> {
    await apiClient.delete(
      `/api/restaurants/${restaurantId}/addons/${addonId}`
    );
  },

  /**
   * Calculate discount percentage
   */
  calculateDiscountPercentage(
    regularPrice: number,
    discountedPrice: number
  ): number {
    if (regularPrice === 0) return 0;
    return Math.round(
      ((regularPrice - discountedPrice) / regularPrice) * 100
    );
  },

  /**
   * Format price for display
   */
  formatPrice(cents: number): string {
    return (cents / 100).toFixed(2);
  }
};
