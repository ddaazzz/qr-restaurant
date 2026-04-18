import React, { useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../services/apiClient';
import { AuthResponse } from '../types';

interface AuthContextType {
  user: AuthResponse | null;
  isLoading: boolean;
  isSignedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  kitchenLogin: (pin: string, restaurantId?: string) => Promise<void>;
  staffLogin: (pin: string, restaurantId?: string) => Promise<void>;
  register: (data: {
    email: string;
    google_id?: string;
    restaurant_name: string;
    address?: string;
    phone?: string;
    service_charge_percent?: number;
    language_preference?: string;
    timezone?: string;
  }) => Promise<void>;
  registerEmail: (data: {
    email: string;
    password: string;
    restaurant_name: string;
    address?: string;
    phone?: string;
    service_charge_percent?: number;
    language_preference?: string;
    timezone?: string;
  }) => Promise<void>;
  googleLogin: (email: string, googleId?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthResponse>) => void;
  switchRestaurant: (restaurantId: string) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      // Always require fresh login on app launch — clear stored credentials
      await apiClient.logout();
      setIsLoading(false);
    } catch (error) {
      console.error('[Auth] Failed to clear token', error);
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.login({ email, password });
      // apiClient already handles storing to SecureStore and setting token/restaurantId
      setUser(response);
    } finally {
      setIsLoading(false);
    }
  };

  const kitchenLogin = async (pin: string, restaurantId?: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.kitchenLogin(pin, restaurantId);
      // apiClient already handles storing to SecureStore and setting token/restaurantId
      setUser(response);
    } finally {
      setIsLoading(false);
    }
  };

  const staffLogin = async (pin: string, restaurantId?: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.staffLogin(pin, restaurantId);
      // apiClient already handles storing to SecureStore and setting token/restaurantId
      setUser(response);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiClient.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    email: string;
    google_id?: string;
    restaurant_name: string;
    address?: string;
    phone?: string;
    service_charge_percent?: number;
    language_preference?: string;
    timezone?: string;
  }) => {
    setIsLoading(true);
    try {
      const response = await apiClient.register(data);
      setUser(response);
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (email: string, googleId?: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.googleLogin(email, googleId);
      setUser(response);
    } finally {
      setIsLoading(false);
    }
  };

  const registerEmail = async (data: {
    email: string;
    password: string;
    restaurant_name: string;
    address?: string;
    phone?: string;
    service_charge_percent?: number;
    language_preference?: string;
    timezone?: string;
  }) => {
    setIsLoading(true);
    try {
      const response = await apiClient.registerEmail(data);
      setUser(response);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (updates: Partial<AuthResponse>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : prev);
  };

  const switchRestaurant = async (restaurantId: string) => {
    await SecureStore.setItemAsync('restaurantId', restaurantId);
    apiClient.setRestaurantId(restaurantId);
    setUser((prev) => prev ? { ...prev, restaurantId } : prev);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSignedIn: !!user,
        login,
        kitchenLogin,
        staffLogin,
        register,
        registerEmail,
        googleLogin,
        logout,
        updateUser,
        switchRestaurant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
