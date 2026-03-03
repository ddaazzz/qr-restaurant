import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';

export const KitchenLoginScreen = () => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { kitchenLogin } = useAuth();

  const handlePINChange = (value: string) => {
    // Only allow numbers and limit to 6 digits
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    setPin(numericValue);

    // Auto-submit when 6 digits entered
    if (numericValue.length === 6) {
      handleLogin(numericValue);
    }
  };

  const handleLogin = async (pinValue?: string) => {
    const loginPin = pinValue || pin;
    if (loginPin.length !== 6) {
      Alert.alert('Error', 'PIN must be 6 digits');
      return;
    }

    setLoading(true);
    try {
      await kitchenLogin(loginPin);
    } catch (error) {
      Alert.alert('Login Failed', error instanceof Error ? error.message : 'Unknown error');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Kitchen</Text>
        <Text style={styles.subtitle}>Enter PIN</Text>

        <TextInput
          style={styles.pinInput}
          placeholder="000000"
          value={pin}
          onChangeText={handlePINChange}
          keyboardType="number-pad"
          maxLength={6}
          editable={!loading}
          textAlign="center"
          secureTextEntry
        />

        <View style={styles.digitDisplay}>
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <View key={i} style={[styles.digit, pin.length > i && styles.digitFilled]}>
                <Text style={styles.digitText}>●</Text>
              </View>
            ))}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => handleLogin()}
          disabled={loading || pin.length !== 6}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
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
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  pinInput: {
    opacity: 0,
    height: 0,
  },
  digitDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
    gap: 10,
  },
  digit: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  digitFilled: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  digitText: {
    fontSize: 24,
    color: '#2196F3',
  },
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
