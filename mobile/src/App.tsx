import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View, Text, LogBox } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { TranslationProvider } from './contexts/TranslationContext';
import { ToastProvider } from './components/ToastProvider';
import { LoginScreen } from './screens/LoginScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { KitchenDashboardScreen } from './screens/KitchenDashboardScreen';
import { patchAnimationErrors } from './services/AnimationErrorPatcher';
import { configureAnimationPerformance } from './services/AnimationPerformanceConfig';
import { ENVIRONMENTS } from './services/apiClient';

// Fix animation batching issues at startup
patchAnimationErrors();
configureAnimationPerformance();

// Suppress only specific known harmless warnings
LogBox.ignoreLogs([
  // Network warnings from iOS when bundler not connected
  'nw_socket_handle_socket_event',
  'nw_endpoint_flow_failed_with_error',
  'nw_connection'
]);

const PROD_URL = ENVIRONMENTS['Production'];

const DevBanner = () => {
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('devEnvironmentUrl').then((url) => {
      setIsDev(!!url && url !== PROD_URL);
    });
  }, []);

  // Re-check whenever the component re-renders (e.g. after login)
  useEffect(() => {
    const interval = setInterval(() => {
      SecureStore.getItemAsync('devEnvironmentUrl').then((url) => {
        setIsDev(!!url && url !== PROD_URL);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!isDev) return null;

  return (
    <View style={{ backgroundColor: '#dc2626', paddingVertical: 2, alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>DEV MODE</Text>
    </View>
  );
};

const RootNavigator = () => {
  const { user, isLoading, isSignedIn } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2C3E50" />
      </View>
    );
  }

  // Determine which screen to show based on user role
  if (isSignedIn && user) {
    if (user.role === 'kitchen') {
      return <KitchenDashboardScreen />;
    } else if (user.role === 'staff') {
      return <AdminDashboardScreen />;
    } else {
      return <AdminDashboardScreen />;
    }
  }

  // Show role selection (Kitchen, Staff, or Admin login)
  return <LoginScreen />;
};

export default function App() {
  return (
    <TranslationProvider>
      <AuthProvider>
        <ToastProvider>
          <DevBanner />
          <RootNavigator />
        </ToastProvider>
      </AuthProvider>
    </TranslationProvider>
  );
}
