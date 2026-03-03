import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoginScreen } from './screens/LoginScreen';
import { KitchenLoginScreen } from './screens/KitchenLoginScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { KitchenDashboardScreen } from './screens/KitchenDashboardScreen';
import { PrinterSettingsScreen } from './screens/PrinterSettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Login Stack
const LoginStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="LoginChoice">
        {() => <LoginChoiceScreen />}
      </Stack.Screen>
      <Stack.Screen name="AdminLogin" component={LoginScreen} />
      <Stack.Screen name="KitchenLogin" component={KitchenLoginScreen} />
    </Stack.Navigator>
  );
};

// Admin Stack
const AdminStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="PrinterSettings" component={PrinterSettingsScreen} />
    </Stack.Navigator>
  );
};

// Root Navigator
const RootNavigator = () => {
  const { isSignedIn, user } = useAuth();

  if (!isSignedIn) {
    return <LoginStackNavigator />;
  }

  if (user?.role === 'kitchen') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Kitchen" component={KitchenDashboardScreen} />
      </Stack.Navigator>
    );
  }

  if (user?.role === 'admin' || user?.role === 'superadmin') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Admin" component={AdminStackNavigator} />
      </Stack.Navigator>
    );
  }

  // Default fallback
  return <LoginStackNavigator />;
};

// Login Choice Screen
const LoginChoiceScreen = ({ navigation }: any) => {
  const { Theme } = require('react-native-paper');
  const {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
  } = require('react-native');

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>QR Restaurant</Text>
        <Text style={styles.subtitle}>Select Login Type</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('AdminLogin')}
        >
          <Text style={styles.buttonText}>Admin Login</Text>
          <Text style={styles.buttonSubtext}>Email & Password</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.kitchenButton]}
          onPress={() => navigation.navigate('KitchenLogin')}
        >
          <Text style={styles.buttonText}>Kitchen Staff</Text>
          <Text style={styles.buttonSubtext}>6-Digit PIN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = require('react-native').StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 50,
    color: '#666',
  },
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  kitchenButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonSubtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
    opacity: 0.8,
  },
});

// App Component
export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
