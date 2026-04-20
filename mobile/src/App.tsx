import React from 'react';
import { ActivityIndicator, View, Text, LogBox } from 'react-native';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { TranslationProvider } from './contexts/TranslationContext';
import { ToastProvider } from './components/ToastProvider';
import { LoginScreen } from './screens/LoginScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { KitchenDashboardScreen } from './screens/KitchenDashboardScreen';
import { patchAnimationErrors } from './services/AnimationErrorPatcher';
import { configureAnimationPerformance } from './services/AnimationPerformanceConfig';
import { API_URL } from './services/apiClient';

// Fix animation batching issues at startup
patchAnimationErrors();
configureAnimationPerformance();

const IS_DEV_BUILD = API_URL !== 'https://chuio.io';

// Suppress only specific known harmless warnings
LogBox.ignoreLogs([
  // Network warnings from iOS when bundler not connected
  'nw_socket_handle_socket_event',
  'nw_endpoint_flow_failed_with_error',
  'nw_connection'
]);

const RootNavigator = () => {
  const { user, isLoading, isSignedIn } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2C3E50" />
      </View>
    );
  }

  if (isSignedIn && user) {
    if (user.role === 'kitchen') {
      return <KitchenDashboardScreen />;
    } else if (user.role === 'staff') {
      return <AdminDashboardScreen />;
    } else {
      return <AdminDashboardScreen />;
    }
  }

  return <LoginScreen />;
};

export default function App() {
  return (
    <TranslationProvider>
      <AuthProvider>
        <ToastProvider>
          {IS_DEV_BUILD && (
            <View style={{ backgroundColor: '#dc2626', paddingVertical: 2, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>DEV BUILD</Text>
            </View>
          )}
          <RootNavigator />
        </ToastProvider>
      </AuthProvider>
    </TranslationProvider>
  );
}
