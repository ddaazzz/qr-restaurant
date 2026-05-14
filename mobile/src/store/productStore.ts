/**
 * productStore.ts
 *
 * Phase 9 — Zustand store for the active product selection.
 * Persists to AsyncStorage so the choice survives app restarts.
 *
 * Products:
 *   'chuio' — Standard Restaurant Operations (default)
 *   'xish'  — Loyalty Program Only
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ActiveProduct = 'chuio' | 'xish';

const STORAGE_KEY = '@chuio_active_product';

interface ProductState {
  activeProduct: ActiveProduct | null;  // null = not yet chosen (show selector)
  isHydrated: boolean;
  setActiveProduct: (product: ActiveProduct) => Promise<void>;
  hydrate: () => Promise<void>;
  reset: () => Promise<void>;
}

export const useProductStore = create<ProductState>((set) => ({
  activeProduct: null,
  isHydrated: false,

  setActiveProduct: async (product: ActiveProduct) => {
    await AsyncStorage.setItem(STORAGE_KEY, product);
    set({ activeProduct: product });
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'chuio' || stored === 'xish') {
        set({ activeProduct: stored, isHydrated: true });
      } else {
        set({ activeProduct: null, isHydrated: true });
      }
    } catch {
      set({ activeProduct: null, isHydrated: true });
    }
  },

  reset: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ activeProduct: null });
  },
}));
