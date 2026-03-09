import React from 'react';
import { ActivityIndicator, View, LogBox } from 'react-native';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoginScreen } from './screens/LoginScreen';
import { StaffLoginScreen } from './screens/StaffLoginScreen';
import { KitchenLoginScreen } from './screens/KitchenLoginScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { KitchenDashboardScreen } from './screens/KitchenDashboardScreen';
import { patchAnimationErrors } from './services/AnimationErrorPatcher';

// Patch animation errors at startup
patchAnimationErrors();

// Suppress the onUserDrivenAnimationEnded warning from native animated module
// This is a known issue with SDK 54 and doesn't affect functionality
LogBox.ignoreLogs([
  'onUserDrivenAnimationEnded',
  'RCTNativeAnimatedModule'
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
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
