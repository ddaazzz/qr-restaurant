import React from 'react';
import { ActivityIndicator, View, LogBox } from 'react-native';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { TranslationProvider } from './contexts/TranslationContext';
import { ToastProvider } from './components/ToastProvider';
import { LoginScreen } from './screens/LoginScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { KitchenDashboardScreen } from './screens/KitchenDashboardScreen';
import { patchAnimationErrors } from './services/AnimationErrorPatcher';
import { configureAnimationPerformance } from './services/AnimationPerformanceConfig';

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
          <RootNavigator />
        </ToastProvider>
      </AuthProvider>
    </TranslationProvider>
  );
}
