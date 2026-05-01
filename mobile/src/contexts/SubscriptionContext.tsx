import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import * as RNIap from 'react-native-iap';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';

// ---------------------------------------------------------------------------
// Product IDs — must match App Store Connect exactly
// ---------------------------------------------------------------------------
export const PREMIUM_PRODUCT_ID = 'com.qrrestaurant.app.premium_monthly';
const IAP_SKUS = [PREMIUM_PRODUCT_ID];

// ---------------------------------------------------------------------------
// Premium feature names — used for gate checks and the popup
// ---------------------------------------------------------------------------
export type PremiumFeatureKey =
  | 'staff_management'
  | 'reports'
  | 'bookings'
  | 'printer_management'
  | 'bill_split'
  | 'crm'
  | 'item_availability'
  | 'timed_menus'
  | 'payment_terminals'
  | 'loyalty_coupons';

export const PREMIUM_FEATURE_LABELS: Record<PremiumFeatureKey, string> = {
  staff_management: 'Staff Management',
  reports: 'Reports & Analytics',
  bookings: 'Bookings & Reservations',
  printer_management: 'Printer Management',
  bill_split: 'Bill Splitting',
  crm: 'CRM & Customer Data',
  item_availability: 'Item Availability Tracking',
  timed_menus: 'Timed Menus',
  payment_terminals: 'Local Payment Terminal',
  loyalty_coupons: 'Loyalty & Coupons',
};

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------
export type SubscriptionTier = 'free' | 'premium';

interface SubscriptionContextType {
  tier: SubscriptionTier;
  isPremium: boolean;
  isLoading: boolean;
  trialEndDate: Date | null;
  isInTrial: boolean;
  /** Opens native Apple subscription purchase sheet */
  purchasePremium: () => Promise<void>;
  /** Restores previous purchases (required by Apple guidelines) */
  restorePurchases: () => Promise<void>;
  /** Checks if a specific feature is accessible */
  canAccess: (feature: PremiumFeatureKey) => boolean;
  /** Refreshes subscription status from server */
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [trialEndDate, setTrialEndDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Superadmin always has premium
  const isSuperadmin = user?.role === 'superadmin';
  const isPremium = isSuperadmin || tier === 'premium';
  const isInTrial = !isSuperadmin && trialEndDate != null && trialEndDate > new Date();

  const canAccess = useCallback(
    (feature: PremiumFeatureKey): boolean => {
      return isPremium;
    },
    [isPremium],
  );

  // ------------------------------------------------------------------
  // Fetch subscription status from backend
  // ------------------------------------------------------------------
  const refreshSubscription = useCallback(async () => {
    if (!user?.restaurantId) return;
    try {
      const res = await apiClient.get(`/api/restaurants/${user.restaurantId}/subscription`);
      const data = res.data as {
        tier: SubscriptionTier;
        trial_end_date?: string | null;
      };
      setTier(data.tier ?? 'free');
      setTrialEndDate(data.trial_end_date ? new Date(data.trial_end_date) : null);
    } catch {
      // Non-critical — default to free tier on error
    }
  }, [user?.restaurantId]);

  useEffect(() => {
    if (user?.restaurantId) {
      refreshSubscription();
    }
  }, [user?.restaurantId, refreshSubscription]);

  // ------------------------------------------------------------------
  // Apple In-App Purchase — init connection
  // ------------------------------------------------------------------
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let purchaseUpdateSub: any;
    let purchaseErrorSub: any;

    const initIAP = async () => {
      try {
        await RNIap.initConnection();

        purchaseUpdateSub = RNIap.purchaseUpdatedListener(async (purchase: RNIap.SubscriptionPurchase | RNIap.ProductPurchase) => {
          const receipt = purchase.transactionReceipt;
          if (!receipt) return;

          try {
            // Validate receipt with backend
            await apiClient.post(`/api/restaurants/${user?.restaurantId}/subscription/verify-receipt`, {
              receipt,
              platform: 'ios',
              productId: purchase.productId,
              transactionId: purchase.transactionId,
            });

            // Acknowledge / finish transaction
            await RNIap.finishTransaction({ purchase, isConsumable: false });
            await refreshSubscription();
          } catch (err: any) {
            console.error('[IAP] Receipt validation failed:', err.message);
            await RNIap.finishTransaction({ purchase, isConsumable: false });
          }
        });

        purchaseErrorSub = RNIap.purchaseErrorListener((error: RNIap.PurchaseError) => {
          if (error.code !== 'E_USER_CANCELLED') {
            console.error('[IAP] Purchase error:', error);
          }
        });
      } catch (err: any) {
        console.warn('[IAP] initConnection failed:', err.message);
      }
    };

    if (user?.restaurantId) {
      initIAP();
    }

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      RNIap.endConnection();
    };
  }, [user?.restaurantId]);

  // ------------------------------------------------------------------
  // Purchase handler
  // ------------------------------------------------------------------
  const purchasePremium = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Subscriptions', 'Subscriptions are only available on iOS devices.');
      return;
    }
    setIsLoading(true);
    try {
      await RNIap.initConnection();
      const subscriptions = await RNIap.getSubscriptions({ skus: IAP_SKUS });
      if (!subscriptions || subscriptions.length === 0) {
        Alert.alert('Not Available', 'This subscription is not available right now. Please try again later.');
        return;
      }
      await RNIap.requestSubscription({ sku: PREMIUM_PRODUCT_ID });
    } catch (err: any) {
      if (err.code !== 'E_USER_CANCELLED') {
        console.error('[IAP] Purchase error:', err);
        Alert.alert('Purchase Failed', err.message || 'Unable to complete purchase. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Restore handler
  // ------------------------------------------------------------------
  const restorePurchases = async () => {
    if (Platform.OS !== 'ios') return;
    setIsLoading(true);
    try {
      await RNIap.initConnection();
      const purchases = await RNIap.getAvailablePurchases();
      const hasPremium = purchases.some((p) => p.productId === PREMIUM_PRODUCT_ID);

      if (hasPremium) {
        // Send latest receipt to backend for validation
        const latestPurchase = purchases.find((p) => p.productId === PREMIUM_PRODUCT_ID);
        if (latestPurchase?.transactionReceipt && user?.restaurantId) {
          await apiClient.post(`/api/restaurants/${user.restaurantId}/subscription/verify-receipt`, {
            receipt: latestPurchase.transactionReceipt,
            platform: 'ios',
            productId: PREMIUM_PRODUCT_ID,
            transactionId: latestPurchase.transactionId,
          });
        }
        await refreshSubscription();
        Alert.alert('Restored', 'Your Premium subscription has been restored!');
      } else {
        Alert.alert('No Purchases', 'No previous Premium subscription found.');
      }
    } catch (err: any) {
      console.error('[IAP] Restore error:', err);
      Alert.alert('Restore Failed', err.message || 'Unable to restore purchases. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        isPremium,
        isLoading,
        trialEndDate,
        isInTrial,
        purchasePremium,
        restorePurchases,
        canAccess,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export const useSubscription = (): SubscriptionContextType => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
};
