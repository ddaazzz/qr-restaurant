import React, { useState, useEffect, useRef } from 'react';
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
  ScrollView,
  Image,
  ImageBackground,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';

// Asset imports
const backgroundImage = require('../../assets/background.png');
const logoImage = require('../../assets/logo.png');

type LoginMode = 'choice' | 'admin' | 'kitchen' | 'staff' | 'scan-qr-staff' | 'scan-qr-kitchen' | 'pin-entry';

export const LoginScreen = () => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<LoginMode>('choice');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantInput, setRestaurantInput] = useState('');
  const [currentLoginType, setCurrentLoginType] = useState<'staff' | 'kitchen' | null>(null);
  const [scanned, setScanned] = useState(false);
  const { login, kitchenLogin, staffLogin } = useAuth();

  // Load saved restaurantId on mount
  useEffect(() => {
    loadRestaurantId();
  }, []);

  const loadRestaurantId = async () => {
    try {
      const saved = await SecureStore.getItemAsync('restaurantId');
      if (saved) {
        setRestaurantId(saved);
        setRestaurantInput(saved);
      }
    } catch (error) {
      console.error('Failed to load restaurantId:', error);
    }
  };

  const handleQRScanned = async (data: string) => {
    if (scanned) return;
    setScanned(true);

    try {
      // Parse the QR code URL to extract restaurantId
      const url = new URL(data);
      const rid = url.searchParams.get('rid');

      if (!rid) {
        Alert.alert('Invalid QR Code', 'Could not extract restaurant ID from QR code');
        setScanned(false);
        return;
      }

      // Store the restaurantId
      setRestaurantId(rid);
      await SecureStore.setItemAsync('restaurantId', rid);

      // Move to PIN entry screen
      if (currentLoginType === 'staff') {
        setMode('pin-entry');
      } else if (currentLoginType === 'kitchen') {
        setMode('pin-entry');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process QR code');
      setScanned(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      Alert.alert(t('login.error'), error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleKitchenLogin = async () => {
    if (pin.length !== 6) {
      Alert.alert(t('common.error'), t('login.invalid-pin'));
      return;
    }

    if (!restaurantId && !restaurantInput) {
      Alert.alert('Error', 'Restaurant ID is required. Scan QR code or enter manually.');
      return;
    }

    const rid = restaurantId || restaurantInput;
    setLoading(true);
    try {
      await kitchenLogin(pin, rid);
    } catch (error) {
      Alert.alert(t('login.error'), error instanceof Error ? error.message : 'Unknown error');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async () => {
    if (pin.length !== 6) {
      Alert.alert(t('common.error'), t('login.invalid-pin'));
      return;
    }

    if (!restaurantId && !restaurantInput) {
      Alert.alert('Error', 'Restaurant ID is required. Scan QR code or enter manually.');
      return;
    }

    const rid = restaurantId || restaurantInput;
    setLoading(true);
    try {
      await staffLogin(pin, rid);
    } catch (error) {
      Alert.alert(t('login.error'), error instanceof Error ? error.message : 'Unknown error');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handlePINChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    setPin(numericValue);
    if (numericValue.length === 6) {
      // Auto-submit when 6 digits entered
      if (currentLoginType === 'kitchen') {
        setTimeout(() => handleKitchenLogin(), 100);
      } else if (currentLoginType === 'staff') {
        setTimeout(() => handleStaffLogin(), 100);
      }
    }
  };

  // Login Type Selection Screen
  if (mode === 'choice') {
    return (
      <ImageBackground
        source={backgroundImage}
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageStyle}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <Image
                source={logoImage}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.loginTypeButton, styles.adminButton]}
                onPress={() => {
                  setMode('admin');
                  setEmail('');
                  setPassword('');
                }}
              >
                <Text style={[styles.loginTypeButtonText, styles.adminButtonText]}>{t('login.admin')}</Text>
              </TouchableOpacity>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.loginTypeButton, styles.staffButton]}
                  onPress={() => {
                    setCurrentLoginType('staff');
                    setPin('');
                    setScanned(false);
                    setMode('scan-qr-staff');
                  }}
                >
                  <Text style={styles.loginTypeButtonText}>{t('login.staff')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.loginTypeButton, styles.kitchenButton]}
                  onPress={() => {
                    setCurrentLoginType('kitchen');
                    setPin('');
                    setScanned(false);
                    setMode('scan-qr-kitchen');
                  }}
                >
                  <Text style={styles.loginTypeButtonText}>{t('login.kitchen')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    );
  }

  // Admin Login Screen
  if (mode === 'admin') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setMode('choice')}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>{t('login.back')}</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder={t('login.email')}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder={t('login.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAdminLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('login.login')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // QR Scanner Screen for Staff or Kitchen (Fallback to manual input)
  if (mode === 'scan-qr-staff' || mode === 'scan-qr-kitchen') {
    const isKitchen = mode === 'scan-qr-kitchen';
    const titleText = isKitchen ? `🍳 ${t('login.kitchen')}` : `👤 ${t('login.staff')}`;

    const handleProceedToPin = async () => {
      const rid = restaurantId || restaurantInput;
      if (!rid) {
        Alert.alert(t('common.error'), 'Please enter a restaurant ID');
        return;
      }
      
      if (!restaurantId) {
        setRestaurantId(rid);
        try {
          await SecureStore.setItemAsync('restaurantId', rid);
        } catch (error) {
          console.error('Failed to save restaurantId:', error);
        }
      }
      setMode('pin-entry');
    };

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode('choice')}
            >
              <Text style={styles.backButtonText}>{t('login.back')}</Text>
            </TouchableOpacity>

            <Text style={styles.title}>{titleText}</Text>
            <Text style={styles.subtitle}>{t('login.enter-manually')}</Text>

            <View style={styles.restaurantInputContainer}>
              <Text style={styles.restaurantInputLabel}>{t('login.restaurant-id')}</Text>
              <TextInput
                style={styles.restaurantInputField}
                placeholder={t('login.restaurant-id')}
                value={restaurantInput}
                onChangeText={setRestaurantInput}
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, isKitchen ? styles.kitchenButton : styles.staffLoginButton]}
              onPress={handleProceedToPin}
            >
              <Text style={styles.buttonText}>Continue →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, { marginTop: 12 }]}
              onPress={() => setMode('choice')}
            >
              <Text style={styles.buttonText}>{t('login.back')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // PIN Entry Screen (shared for both staff and kitchen)
  if (mode === 'pin-entry') {
    const isKitchen = currentLoginType === 'kitchen';
    const titleText = isKitchen ? `🍳 ${t('login.kitchen')}` : `👤 ${t('login.staff')}`;
    const buttonColor = isKitchen ? {} : styles.staffLoginButton;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setMode('choice');
              setPin('');
              setRestaurantId(null);
              setCurrentLoginType(null);
            }}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>{t('login.back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{titleText}</Text>
          <Text style={styles.subtitle}>{t('login.enter-pin')}</Text>
          <Text style={styles.restaurantInfo}>Restaurant: {restaurantId}</Text>

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
            autoFocus
          />

          <View style={styles.digitDisplay}>
            {Array(6)
              .fill(0)
              .map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.digit,
                    pin.length > i && (isKitchen ? styles.digitFilled : styles.digitFilledStaff),
                  ]}
                >
                  <Text style={isKitchen ? styles.digitText : styles.digitTextStaff}>●</Text>
                </View>
              ))}
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              isKitchen && styles.kitchenButton,
              !isKitchen && styles.staffLoginButton,
              loading && styles.buttonDisabled,
            ]}
            onPress={isKitchen ? handleKitchenLogin : handleStaffLogin}
            disabled={loading || pin.length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('login.login')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Kitchen Login Screen
  if (mode === 'kitchen') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setMode('choice')}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>{t('login.back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>🍳 {t('login.kitchen')}</Text>
          <Text style={styles.subtitle}>{t('login.enter-pin')}</Text>

          <TextInput
            style={styles.pinInput}
            placeholder={t('login.pin')}
            value={pin}
            onChangeText={handlePINChange}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading}
            textAlign="center"
            secureTextEntry
            autoFocus
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
            onPress={handleKitchenLogin}
            disabled={loading || pin.length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('login.login')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Staff Login Screen
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setMode('choice')}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>{t('login.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>👤 {t('login.staff')}</Text>
        <Text style={styles.subtitle}>{t('login.enter-pin')}</Text>

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
          autoFocus
        />

        <View style={styles.digitDisplay}>
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <View key={i} style={[styles.digit, pin.length > i && styles.digitFilledStaff]}>
                <Text style={styles.digitTextStaff}>●</Text>
              </View>
            ))}
        </View>

        <TouchableOpacity
          style={[styles.button, styles.staffLoginButton, loading && styles.buttonDisabled]}
          onPress={handleStaffLogin}
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
  screenContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImageStyle: {
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
    marginTop: 40,
  },
  logo: {
    width: 120,
    height: 120,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 10,
  },
  backButtonText: {
    color: '#2C3E50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  restaurantInputContainer: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  restaurantInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  restaurantInputField: {
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ffc107',
    fontSize: 14,
  },
  restaurantInfoContainer: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  restaurantInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 8,
  },
  changeRestaurantLink: {
    fontSize: 12,
    color: '#2C3E50',
    textDecorationLine: 'underline',
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
  buttonContainer: {
    alignItems: 'center',
    marginTop: 40,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    justifyContent: 'center',
    width: '100%',
  },
  loginTypeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminButton: {
    backgroundColor: '#2C3E50',
    width: '70%',
    paddingHorizontal: 40,
  },
  staffButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#2C3E50',
    flex: 1,
    paddingHorizontal: 20,
  },
  kitchenButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#2C3E50',
    flex: 1,
    paddingHorizontal: 20,
  },
  loginTypeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  adminButtonText: {
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
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
    borderColor: '#2C3E50',
    backgroundColor: '#FFF3E0',
  },
  digitFilledStaff: {
    borderColor: '#2C3E50',
    backgroundColor: '#E8F5E9',
  },
  digitText: {
    fontSize: 24,
    color: '#2C3E50',
  },
  digitTextStaff: {
    fontSize: 24,
    color: '#2C3E50',
  },
  button: {
    backgroundColor: '#2C3E50',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  staffLoginButton: {
    backgroundColor: '#2C3E50',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  camera: {
    flex: 1,
    display: 'none', // Camera no longer used in this screen
  },
  scannerOverlay: {
    display: 'none', // Scanner overlay no longer used
  },
  restaurantInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#6b7280',
  },
});
