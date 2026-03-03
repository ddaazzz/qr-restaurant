import React, { useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../services/apiClient';
import { AuthResponse } from '../types';

interface AuthContextType {
  user: AuthResponse | null;
  isLoading: boolean;
  isSignedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  kitchenLogin: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
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

      if (token && restaurantId && role) {
        apiClient.setRestaurantId(restaurantId);
        setUser({
          token,
          restaurantId,
          role: role as AuthResponse['role'],
          userId: userId || '',
        });
      }
    } catch (error) {
      console.error('Failed to restore token', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.login({ email, password });
      await SecureStore.setItemAsync('role', response.role);
      await SecureStore.setItemAsync('userId', response.userId);
      apiClient.setRestaurantId(response.restaurantId);
      setUser(response);
    } finally {
      setIsLoading(false);
    }
  };

  const kitchenLogin = async (pin: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.kitchenLogin(pin);
      await SecureStore.setItemAsync('role', response.role);
      await SecureStore.setItemAsync('userId', response.userId);
      apiClient.setRestaurantId(response.restaurantId);
      setUser(response);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiClient.logout();
      await SecureStore.deleteItemAsync('role');
      await SecureStore.deleteItemAsync('userId');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSignedIn: !!user,
        login,
        kitchenLogin,
        logout,
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
