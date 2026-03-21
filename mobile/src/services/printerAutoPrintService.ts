/**
 * Auto-Print Subscription Service
 * 
 * Subscribes to real-time kitchen order events and automatically prints orders
 * Works in parallel with manual printing
 */

import apiClient from './apiClient';

export interface KitchenOrderEvent {
  orderId: string;
  categoryId: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    specialInstructions?: string;
  }>;
  timestamp: number;
}

class PrinterAutoPrintService {
  private isSubscribed = false;
  private subscriptionCallbacks: ((order: KitchenOrderEvent) => Promise<void>)[] = [];
  private pollIntervalId: NodeJS.Timeout | null = null;
  private lastOrderId: string = '';
  private restaurantId: string = '';

  /**
   * Subscribe to kitchen order events for auto-printing
   * This polls the backend for new orders in the kitchen
   */
  async subscribeToOrders(restaurantId: string, pollingIntervalMs: number = 2000): Promise<void> {
    if (this.isSubscribed) {
      console.log('[AutoPrint] Already subscribed to orders');
      return;
    }

    this.restaurantId = restaurantId;
    this.isSubscribed = true;

    console.log(`[AutoPrint] Subscribed to kitchen orders for restaurant ${restaurantId}`);

    // Start polling for new orders
    this.pollIntervalId = setInterval(async () => {
      try {
        await this.pollForNewOrders();
      } catch (err) {
        console.error('[AutoPrint] Error polling for orders:', err);
      }
    }, pollingIntervalMs);
  }

  /**
   * Unsubscribe from order events
   */
  unsubscribeFromOrders(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    this.isSubscribed = false;
    console.log('[AutoPrint] Unsubscribed from kitchen orders');
  }

  /**
   * Register callback for when new orders arrive
   * Callback should handle printing the order
   */
  onOrder(callback: (order: KitchenOrderEvent) => Promise<void>): void {
    this.subscriptionCallbacks.push(callback);
  }

  /**
   * Poll for new kitchen orders
   */
  private async pollForNewOrders(): Promise<void> {
    try {
      // Fetch active kitchen items (new orders ready to print)
      const response = await apiClient.get(
        `/api/restaurants/${this.restaurantId}/kitchen-items`
      );

      if (!response || !response.data || !Array.isArray(response.data)) {
        return;
      }

      // Check for new orders (orders we haven't seen before)
      for (const item of response.data) {
        // Convert item to KitchenOrderEvent format
        if (item.orderId && item.orderId !== this.lastOrderId) {
          this.lastOrderId = item.orderId;

          const order: KitchenOrderEvent = {
            orderId: item.orderId,
            categoryId: item.categoryId || 0,
            items: item.items || [
              {
                id: item.id,
                name: item.name,
                quantity: item.quantity || 1,
                specialInstructions: item.specialInstructions,
              },
            ],
            timestamp: Date.now(),
          };

          console.log(`[AutoPrint] New order detected: ${order.orderId}`);
          await this.notifyOrderCallbacks(order);
        }
      }
    } catch (err) {
      // Silently fail on network errors - will retry on next poll
      console.debug('[AutoPrint] Poll request failed (will retry)');
    }
  }

  /**
   * Notify all subscribers of new order
   */
  private async notifyOrderCallbacks(order: KitchenOrderEvent): Promise<void> {
    for (const callback of this.subscriptionCallbacks) {
      try {
        await callback(order);
      } catch (err) {
        console.error('[AutoPrint] Callback error:', err);
      }
    }
  }

  /**
   * Check if currently subscribed
   */
  isActive(): boolean {
    return this.isSubscribed;
  }

  /**
   * Get current subscription status
   */
  getStatus(): {
    isSubscribed: boolean;
    restaurantId: string;
    callbackCount: number;
  } {
    return {
      isSubscribed: this.isSubscribed,
      restaurantId: this.restaurantId,
      callbackCount: this.subscriptionCallbacks.length,
    };
  }
}

export const printerAutoPrintService = new PrinterAutoPrintService();
export default PrinterAutoPrintService;
