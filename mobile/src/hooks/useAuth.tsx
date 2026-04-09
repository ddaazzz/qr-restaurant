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
  googleLogin: (email: string, googleId?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthResponse>) => void;
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
      const token = await SecureStore.getItemAsync('authToken');
      const restaurantId = await SecureStore.getItemAsync('restaurantId');
      const role = await SecureStore.getItemAsync('role');
      const userId = await SecureStore.getItemAsync('userId');
      const accessRightsStr = await SecureStore.getItemAsync('accessRights');
      const clockedInStr = await SecureStore.getItemAsync('clockedIn');

      if (token && restaurantId && role) {
        // Set token and restaurantId on API client
        apiClient.setToken(token);
        apiClient.setRestaurantId(restaurantId);

        let access_rights: Record<string, any> | string[] | undefined;
        if (accessRightsStr) {
          try { access_rights = JSON.parse(accessRightsStr); } catch {}
        }

        setUser({
          token,
          restaurantId,
          role: role as AuthResponse['role'],
          userId: userId || '',
          access_rights,
          currently_clocked_in: clockedInStr === 'true',
        });
      }
    } catch (error) {
      console.error('[Auth] Failed to restore token', error);
    } finally {
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

  const updateUser = (updates: Partial<AuthResponse>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : prev);
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
        googleLogin,
        logout,
        updateUser,
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
