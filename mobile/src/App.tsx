import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoginScreen } from './screens/LoginScreen';
import { KitchenLoginScreen } from './screens/KitchenLoginScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { KitchenDashboardScreen } from './screens/KitchenDashboardScreen';

const RootNavigator = () => {
  const { user, isLoading, isSignedIn } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // Determine which screen to show based on user role
  if (isSignedIn && user) {
    if (user.role === 'kitchen_staff') {
      return <KitchenDashboardScreen />;
    } else {
      return <AdminDashboardScreen />;
    }
  }

  // Show role selection (Kitchen or Admin login)
  return <LoginScreen />;
};

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
