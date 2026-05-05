import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';

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
  /** Checks if a specific feature is accessible */
  canAccess: (feature: PremiumFeatureKey) => boolean;
  /** Re-fetches subscription status from the backend */
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

  // All features are enabled for all restaurants by default.
  // Feature-level gating remains in place for future per-restaurant configuration.
  // Local payment terminal access is controlled by Chuio setup, not subscription tier.
  const canAccess = useCallback(
    (_feature: PremiumFeatureKey): boolean => true,
    [],
  );

  // ------------------------------------------------------------------
  // Fetch subscription status from backend
  // ------------------------------------------------------------------
  const refreshSubscription = useCallback(async () => {
    if (!user?.restaurantId) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/api/restaurants/${user.restaurantId}/subscription`);
      const data = res.data as { tier: SubscriptionTier; trial_end_date?: string | null };
      setTier(data.tier ?? 'free');
      setTrialEndDate(data.trial_end_date ? new Date(data.trial_end_date) : null);
    } catch {
      // Non-critical — default to free tier on error
    } finally {
      setIsLoading(false);
    }
  }, [user?.restaurantId]);

  useEffect(() => {
    if (user?.restaurantId) {
      refreshSubscription();
    }
  }, [user?.restaurantId, refreshSubscription]);

  return (
    <SubscriptionContext.Provider
      value={{ tier, isPremium, isLoading, trialEndDate, isInTrial, canAccess, refreshSubscription }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

