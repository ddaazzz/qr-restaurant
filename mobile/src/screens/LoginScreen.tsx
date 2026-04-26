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
  Modal,
  FlatList,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../contexts/TranslationContext';
import { apiClient } from '../services/apiClient';
import { TIMEZONE_OPTIONS } from '../constants/timezones';

const backgroundImage = require('../../assets/background.png');
const logoImage = require('../../assets/logo.png');

type LoginMode =
  | 'choice'
  | 'admin'
  | 'scan-qr'
  | 'pin-entry'
  | 'email-register'
  | 'verify-code'
  | 'restaurant-info'
  | 'forgot-password'
  | 'google-signup';

export const LoginScreen = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<LoginMode>('choice');

  // Admin login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // PIN login
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [currentLoginType, setCurrentLoginType] = useState<'staff' | 'kitchen' | null>(null);

  // QR Scanner
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualRid, setManualRid] = useState('');

  // Google signup / onboarding
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleId, setGoogleId] = useState<string | undefined>();
  const [regRestaurantName, setRegRestaurantName] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regCountry, setRegCountry] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regServiceCharge, setRegServiceCharge] = useState('10');
  const [regLanguage, setRegLanguage] = useState('en');
  const [regTimezone, setRegTimezone] = useState('Asia/Hong_Kong');
  const [showTimezonePicker, setShowTimezonePicker] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [regLogoUri, setRegLogoUri] = useState<string | null>(null);
  const [regBgUri, setRegBgUri] = useState<string | null>(null);

  // Email registration
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const pinInputRef = useRef<TextInput>(null);

  const { login, kitchenLogin, staffLogin, register, registerEmail, googleLogin } = useAuth();

  useEffect(() => {
    loadRestaurantId();
  }, []);

  const loadRestaurantId = async () => {
    try {
      const saved = await SecureStore.getItemAsync('restaurantId');
      if (saved) {
        setRestaurantId(saved);
        setManualRid(saved);
        fetchRestaurantName(saved);
      }
    } catch (error) {
      console.error('Failed to load restaurantId:', error);
    }
  };

  const fetchRestaurantName = async (rid: string) => {
    try {
      const info = await apiClient.getRestaurantInfo(rid);
      setRestaurantName(info.name);
    } catch {
      setRestaurantName(null);
    }
  };

  // ---- QR scan handler ----
  const handleQRScanned = async (data: string) => {
    if (scanned) return;
    setScanned(true);

    try {
      let rid: string | null = null;
      try {
        const url = new URL(data);
        rid = url.searchParams.get('rid');
      } catch {
        if (/^\d+$/.test(data.trim())) {
          rid = data.trim();
        }
      }

      if (!rid) {
        Alert.alert(t('login.invalid-qr-title'), t('login.invalid-qr-message'));
        setScanned(false);
        return;
      }

      setRestaurantId(rid);
      await SecureStore.setItemAsync('restaurantId', rid);
      await fetchRestaurantName(rid);
      setMode('pin-entry');
    } catch (error) {
      Alert.alert(t('common.error'), t('login.qr-process-failed'));
      setScanned(false);
    }
  };

  // ---- Admin login ----
  const handleAdminLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('login.email-password-required'));
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      Alert.alert(t('login.login-failed'), error instanceof Error ? error.message : t('login.unknown-error'));
    } finally {
      setLoading(false);
    }
  };

  // ---- PIN handlers ----
  const handlePINSubmitDirect = async (pinValue: string) => {
    if (pinValue.length !== 6) return;
    const rid = restaurantId;
    if (!rid) {
      Alert.alert(t('common.error'), t('login.restaurant-id-required'));
      return;
    }

    setLoading(true);
    try {
      if (currentLoginType === 'kitchen') {
        await kitchenLogin(pinValue, rid);
      } else {
        await staffLogin(pinValue, rid);
      }
    } catch (error) {
      Alert.alert(t('login.login-failed'), error instanceof Error ? error.message : t('login.unknown-error'));
      setPin('');
      setTimeout(() => pinInputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handlePINChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    setPin(numericValue);
    if (numericValue.length === 6) {
      setTimeout(() => handlePINSubmitDirect(numericValue), 150);
    }
  };

  // ---- Google sign-in ----
  const handleGoogleSignIn = () => {
    Alert.prompt(
      'Google Sign In',
      'Enter your Google email address',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async (inputEmail?: string) => {
            if (!inputEmail || !inputEmail.includes('@')) {
              Alert.alert('Error', 'Please enter a valid email');
              return;
            }
            setGoogleEmail(inputEmail);
            setLoading(true);
            try {
              await googleLogin(inputEmail);
              // If we get here, login succeeded (existing user)
            } catch {
              // No account found -> go to onboarding
              setOnboardingStep(0);
              setMode('google-signup');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'plain-text',
      '',
      'email-address'
    );
  };

  // ---- Registration submit ----
  const handleRegisterSubmit = async () => {
    if (!regRestaurantName.trim()) {
      Alert.alert('Error', 'Restaurant name is required');
      return;
    }

    setLoading(true);
    try {
      await register({
        email: googleEmail,
        google_id: googleId,
        restaurant_name: regRestaurantName.trim(),
        address: regAddress.trim() || undefined,
        phone: regPhone.trim() || undefined,
        service_charge_percent: parseFloat(regServiceCharge) || 0,
        language_preference: regLanguage,
        timezone: regTimezone,
      });

      // Upload logo/background if selected
      if (regLogoUri) {
        try { await apiClient.uploadImage(regLogoUri, 'logo'); } catch (e) { console.warn('Logo upload failed:', e); }
      }
      if (regBgUri) {
        try { await apiClient.uploadImage(regBgUri, 'background'); } catch (e) { console.warn('Background upload failed:', e); }
      }
    } catch (error) {
      Alert.alert('Registration Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (type: 'logo' | 'background') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: type === 'logo' ? [1, 1] : [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      if (type === 'logo') setRegLogoUri(result.assets[0].uri);
      else setRegBgUri(result.assets[0].uri);
    }
  };

  // ---- Resend countdown timer ----
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // ---- Email registration: send verification code ----
  const handleSendVerification = async () => {
    if (!regEmail.trim() || !regEmail.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (regPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await apiClient.sendVerificationCode(regEmail.trim());
      setMode('verify-code');
      setResendCountdown(60);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  // ---- Email registration: verify code ----
  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Error', 'Please enter the full 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await apiClient.verifyCode(regEmail.trim(), verificationCode);
      setMode('restaurant-info');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  // ---- Email registration: complete restaurant creation ----
  const handleEmailRegisterSubmit = async () => {
    if (!regFullName.trim()) {
      Alert.alert('Error', 'Full name is required');
      return;
    }
    if (!regRestaurantName.trim()) {
      Alert.alert('Error', 'Restaurant name is required');
      return;
    }

    setLoading(true);
    try {
      await registerEmail({
        email: regEmail.trim(),
        password: regPassword,
        name: regFullName.trim(),
        restaurant_name: regRestaurantName.trim(),
        address: regAddress.trim() || undefined,
        country: regCountry.trim() || undefined,
        phone: regPhone.trim() || undefined,
        service_charge_percent: parseFloat(regServiceCharge) || 0,
        language_preference: regLanguage,
        timezone: regTimezone,
      });
    } catch (error) {
      Alert.alert('Registration Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // ---- Forgot password ----
  const handleForgotPassword = async () => {
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await apiClient.forgotPassword(forgotEmail.trim());
      setForgotSent(true);
    } catch (error) {
      // Always show success to prevent email enumeration
      setForgotSent(true);
    } finally {
      setLoading(false);
    }
  };

  // ===================== CHOICE SCREEN =====================
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
              <Image source={logoImage} style={styles.logo} resizeMode="contain" />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.choiceButton, styles.adminButton]}
                onPress={() => { setMode('admin'); setEmail(''); setPassword(''); }}
              >
                <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                <Text style={[styles.choiceButtonText, { color: '#fff' }]}>Admin Login</Text>
              </TouchableOpacity>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.choiceButton, styles.outlineButton]}
                  onPress={() => {
                    setCurrentLoginType('staff');
                    setPin('');
                    setScanned(false);
                    setMode('scan-qr');
                  }}
                >
                  <Ionicons name="people-outline" size={20} color="#2C3E50" />
                  <Text style={styles.choiceButtonText}>Staff</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.choiceButton, styles.outlineButton]}
                  onPress={() => {
                    setCurrentLoginType('kitchen');
                    setPin('');
                    setScanned(false);
                    setMode('scan-qr');
                  }}
                >
                  <Ionicons name="restaurant-outline" size={20} color="#2C3E50" />
                  <Text style={styles.choiceButtonText}>Kitchen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    );
  }

  // ===================== ADMIN LOGIN =====================
  if (mode === 'admin') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={() => setMode('choice')} disabled={loading}>
            <Ionicons name="arrow-back" size={22} color="#2C3E50" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Admin Login</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#999"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
            placeholderTextColor="#999"
          />

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleAdminLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Login</Text>}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
            <TouchableOpacity onPress={() => { setForgotEmail(''); setForgotSent(false); setMode('forgot-password'); }}>
              <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '500' }}>Forgot Password?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setRegEmail(''); setRegPassword(''); setRegConfirmPassword(''); setVerificationCode(''); setMode('email-register'); }}>
              <Text style={{ color: '#f97316', fontSize: 13, fontWeight: '600' }}>Create Account →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ===================== QR SCANNER =====================
  if (mode === 'scan-qr') {
    const isKitchen = currentLoginType === 'kitchen';
    const titleText = isKitchen ? 'Kitchen Login' : 'Staff Login';

    return (
      <View style={styles.scannerContainer}>
        <View style={styles.scannerHeader}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }}
            onPress={() => setMode('choice')}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.scannerTitle}>{titleText}</Text>
        </View>

        {cameraPermission?.granted ? (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : (result) => handleQRScanned(result.data)}
            />
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame} />
              <Text style={styles.scannerHint}>
                Scan the Staff/Kitchen QR code{'\n'}from Settings &gt; Staff &amp; Kitchen Links
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={48} color="#999" />
            <Text style={styles.permissionText}>Camera permission is required to scan QR codes</Text>
            <TouchableOpacity style={styles.submitButton} onPress={requestCameraPermission}>
              <Text style={styles.submitButtonText}>Grant Camera Access</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.manualEntrySection}>
          <Text style={styles.manualEntryLabel}>Or enter Restaurant ID manually:</Text>
          <View style={styles.manualEntryRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Restaurant ID"
              value={manualRid}
              onChangeText={setManualRid}
              keyboardType="number-pad"
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={[styles.submitButton, { marginTop: 0, marginLeft: 10, paddingHorizontal: 20 }]}
              onPress={async () => {
                if (!manualRid.trim()) {
                  Alert.alert('Error', 'Please enter a restaurant ID');
                  return;
                }
                const rid = manualRid.trim();
                setRestaurantId(rid);
                await SecureStore.setItemAsync('restaurantId', rid);
                await fetchRestaurantName(rid);
                setMode('pin-entry');
              }}
            >
              <Text style={styles.submitButtonText}>Go</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ===================== PIN ENTRY =====================
  if (mode === 'pin-entry') {
    const isKitchen = currentLoginType === 'kitchen';
    const accentColor = isKitchen ? '#FF9800' : '#27ae60';

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.pinContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => { setMode('scan-qr'); setPin(''); }}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={22} color="#2C3E50" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.pinHeader}>
            <View style={[styles.pinIconCircle, { backgroundColor: accentColor + '20' }]}>
              <Ionicons
                name={isKitchen ? 'restaurant' : 'people'}
                size={32}
                color={accentColor}
              />
            </View>
            <Text style={styles.pinTitle}>{isKitchen ? 'Kitchen' : 'Staff'}</Text>
            <Text style={styles.pinSubtitle}>Enter your 6-digit PIN</Text>
            {(restaurantName || restaurantId) && (
              <Text style={styles.restaurantLabel}>
                {restaurantName || `Restaurant ${restaurantId}`}
              </Text>
            )}
          </View>

          {/* Hidden input */}
          <TextInput
            ref={pinInputRef}
            style={styles.hiddenInput}
            value={pin}
            onChangeText={handlePINChange}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading}
            autoFocus
            caretHidden
          />

          {/* PIN dots - tap to focus */}
          <TouchableOpacity
            style={styles.pinDotsRow}
            activeOpacity={0.9}
            onPress={() => pinInputRef.current?.focus()}
          >
            {Array(6).fill(0).map((_, i) => {
              const filled = pin.length > i;
              return (
                <View
                  key={i}
                  style={[
                    styles.pinDot,
                    filled && { backgroundColor: accentColor, borderColor: accentColor },
                  ]}
                >
                  {filled && <View style={styles.pinDotInner} />}
                </View>
              );
            })}
          </TouchableOpacity>

          {loading && (
            <ActivityIndicator size="large" color={accentColor} style={{ marginTop: 20 }} />
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: accentColor, width: '100%' },
              (loading || pin.length !== 6) && styles.buttonDisabled,
            ]}
            onPress={() => handlePINSubmitDirect(pin)}
            disabled={loading || pin.length !== 6}
          >
            <Text style={styles.submitButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ===================== EMAIL REGISTER (Step 1: Email + Password) =====================
  if (mode === 'email-register') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.onboardingScroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => setMode('admin')} disabled={loading}>
            <Ionicons name="arrow-back" size={22} color="#2C3E50" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 60 }}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Step 1 of 3 — Your credentials</Text>
          </View>

          <View style={styles.stepContent}>
            <Text style={styles.fieldLabel}>Email Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              value={regEmail}
              onChangeText={setRegEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#999"
              editable={!loading}
              autoComplete="off"
              textContentType="none"
            />

            <Text style={styles.fieldLabel}>Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="Min 8 characters"
              value={regPassword}
              onChangeText={setRegPassword}
              secureTextEntry
              placeholderTextColor="#999"
              editable={!loading}
              autoComplete="off"
              textContentType="none"
            />

            <Text style={styles.fieldLabel}>Confirm Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              value={regConfirmPassword}
              onChangeText={setRegConfirmPassword}
              secureTextEntry
              placeholderTextColor="#999"
              editable={!loading}
              autoComplete="off"
              textContentType="none"
            />

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSendVerification}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Send Verification Code</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setMode('admin')} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: '#6b7280', fontSize: 13 }}>Already have an account? <Text style={{ color: '#f97316', fontWeight: '600' }}>Sign In</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ===================== VERIFY CODE (Step 2) =====================
  if (mode === 'verify-code') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.onboardingScroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => setMode('email-register')} disabled={loading}>
            <Ionicons name="arrow-back" size={22} color="#2C3E50" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 60 }}>
            <Text style={styles.title}>Verify Email</Text>
            <Text style={styles.subtitle}>Step 2 of 3 — Enter the 6-digit code sent to{'\n'}{regEmail}</Text>
          </View>

          <View style={styles.stepContent}>
            <TextInput
              style={[styles.input, { textAlign: 'center', fontSize: 24, fontWeight: '700', letterSpacing: 8, paddingVertical: 16 }]}
              placeholder="000000"
              value={verificationCode}
              onChangeText={(t) => setVerificationCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholderTextColor="#ccc"
              editable={!loading}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.submitButton, (loading || verificationCode.length !== 6) && styles.buttonDisabled]}
              onPress={handleVerifyCode}
              disabled={loading || verificationCode.length !== 6}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Verify Code</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
                if (resendCountdown > 0) return;
                try {
                  await apiClient.sendVerificationCode(regEmail.trim());
                  setResendCountdown(60);
                  Alert.alert('Sent', 'Verification code resent');
                } catch {}
              }}
              disabled={resendCountdown > 0}
              style={{ marginTop: 16, alignItems: 'center' }}
            >
              <Text style={{ color: resendCountdown > 0 ? '#9ca3af' : '#f97316', fontSize: 13, fontWeight: '500' }}>
                {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ===================== RESTAURANT INFO (Step 3) =====================
  if (mode === 'restaurant-info') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.onboardingScroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => setMode('verify-code')} disabled={loading}>
            <Ionicons name="arrow-back" size={22} color="#2C3E50" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 60 }}>
            <Text style={styles.title}>Restaurant Details</Text>
            <Text style={styles.subtitle}>Step 3 of 3 — Tell us about your restaurant</Text>
          </View>

          <View style={styles.stepContent}>
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              value={regFullName}
              onChangeText={setRegFullName}
              placeholderTextColor="#999"
              editable={!loading}
              autoComplete="off"
              textContentType="none"
            />

            <Text style={styles.fieldLabel}>Restaurant Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="My Restaurant"
              value={regRestaurantName}
              onChangeText={setRegRestaurantName}
              placeholderTextColor="#999"
              editable={!loading}
              autoComplete="off"
              textContentType="none"
            />

            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={styles.input}
              placeholder="123 Main St, City"
              value={regAddress}
              onChangeText={setRegAddress}
              placeholderTextColor="#999"
              editable={!loading}
              autoComplete="off"
              textContentType="none"
            />

            <Text style={styles.fieldLabel}>Country</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Hong Kong"
              value={regCountry}
              onChangeText={setRegCountry}
              placeholderTextColor="#999"
              editable={!loading}
              autoComplete="off"
              textContentType="none"
            />

            <Text style={styles.fieldLabel}>Contact Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+852 1234 5678"
              value={regPhone}
              onChangeText={setRegPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#999"
              editable={!loading}
              autoComplete="off"
              textContentType="none"
            />

            <Text style={styles.fieldLabel}>Timezone</Text>
            <TouchableOpacity
              style={[styles.optionButton, styles.optionButtonActive, { flex: undefined, paddingHorizontal: 16 }]}
              onPress={() => { setTimezoneSearch(''); setShowTimezonePicker(true); }}
            >
              <Text style={[styles.optionButtonText, styles.optionButtonTextActive]}>
                {TIMEZONE_OPTIONS.find(o => o.value === regTimezone)?.label || regTimezone}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#059669' }, (loading || !regFullName.trim() || !regRestaurantName.trim()) && styles.buttonDisabled]}
              onPress={handleEmailRegisterSubmit}
              disabled={loading || !regFullName.trim() || !regRestaurantName.trim()}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Create Restaurant</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Timezone Picker Modal */}
        <Modal visible={showTimezonePicker} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>Select Timezone</Text>
                <TouchableOpacity onPress={() => setShowTimezonePicker(false)}>
                  <Text style={{ fontSize: 16, color: '#6b7280' }}>✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={{ margin: 12, padding: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, fontSize: 14 }}
                placeholder="Search timezones..."
                value={timezoneSearch}
                onChangeText={setTimezoneSearch}
                autoFocus
              />
              <FlatList
                data={TIMEZONE_OPTIONS.filter(o => o.label.toLowerCase().includes(timezoneSearch.toLowerCase()) || o.value.toLowerCase().includes(timezoneSearch.toLowerCase()))}
                keyExtractor={item => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{ padding: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: item.value === regTimezone ? '#eff6ff' : '#fff' }}
                    onPress={() => { setRegTimezone(item.value); setShowTimezonePicker(false); }}
                  >
                    <Text style={{ fontSize: 14, color: item.value === regTimezone ? '#2563eb' : '#1f2937', fontWeight: item.value === regTimezone ? '600' : '400' }}>{item.label}</Text>
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
              />
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // ===================== FORGOT PASSWORD =====================
  if (mode === 'forgot-password') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={() => { setMode('admin'); setForgotSent(false); }} disabled={loading}>
            <Ionicons name="arrow-back" size={22} color="#2C3E50" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>Enter your email and we'll send you a reset link</Text>

          {!forgotSent ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                value={forgotEmail}
                onChangeText={setForgotEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#999"
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.buttonDisabled]}
                onPress={handleForgotPassword}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Send Reset Link</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ backgroundColor: '#f0fdf4', borderRadius: 12, padding: 20, alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={48} color="#059669" />
              <Text style={{ fontSize: 15, color: '#1f2937', fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
                Check your email
              </Text>
              <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
                If an account exists with that email, a password reset link has been sent to your inbox.
              </Text>
              <TouchableOpacity
                style={[styles.submitButton, { marginTop: 20, width: '100%' }]}
                onPress={() => { setMode('admin'); setForgotSent(false); }}
              >
                <Text style={styles.submitButtonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ===================== GOOGLE SIGNUP / ONBOARDING =====================
  if (mode === 'google-signup') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.onboardingScroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => setMode('choice')} disabled={loading}>
            <Ionicons name="arrow-back" size={22} color="#2C3E50" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 40 }}>
            <Text style={styles.title}>Create Your Restaurant</Text>
            <Text style={styles.subtitle}>Setting up for: {googleEmail}</Text>
          </View>

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            {['Details', 'Preferences', 'Branding'].map((label, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={[styles.stepCircle, onboardingStep >= i && styles.stepCircleActive]}>
                  <Text style={[styles.stepCircleText, onboardingStep >= i && styles.stepCircleTextActive]}>
                    {i + 1}
                  </Text>
                </View>
                <Text style={[styles.stepLabel, onboardingStep >= i && styles.stepLabelActive]}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Step 0: Restaurant details */}
          {onboardingStep === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.fieldLabel}>Restaurant Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="My Restaurant"
                value={regRestaurantName}
                onChangeText={setRegRestaurantName}
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput
                style={styles.input}
                placeholder="123 Main St, City"
                value={regAddress}
                onChangeText={setRegAddress}
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="+852 1234 5678"
                value={regPhone}
                onChangeText={setRegPhone}
                keyboardType="phone-pad"
                placeholderTextColor="#999"
              />

              <TouchableOpacity
                style={[styles.submitButton, !regRestaurantName.trim() && styles.buttonDisabled]}
                onPress={() => setOnboardingStep(1)}
                disabled={!regRestaurantName.trim()}
              >
                <Text style={styles.submitButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 1: Preferences */}
          {onboardingStep === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.fieldLabel}>Service Charge (%)</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                value={regServiceCharge}
                onChangeText={setRegServiceCharge}
                keyboardType="decimal-pad"
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>Language</Text>
              <View style={styles.optionRow}>
                {[{ value: 'en', label: 'English' }, { value: 'zh', label: '中文' }].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.optionButton, regLanguage === opt.value && styles.optionButtonActive]}
                    onPress={() => setRegLanguage(opt.value)}
                  >
                    <Text style={[styles.optionButtonText, regLanguage === opt.value && styles.optionButtonTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Timezone</Text>
              <TouchableOpacity
                style={[styles.optionButton, styles.optionButtonActive, { flex: undefined, paddingHorizontal: 16 }]}
                onPress={() => { setTimezoneSearch(''); setShowTimezonePicker(true); }}
              >
                <Text style={[styles.optionButtonText, styles.optionButtonTextActive]}>
                  {TIMEZONE_OPTIONS.find(o => o.value === regTimezone)?.label || regTimezone}
                </Text>
              </TouchableOpacity>

              <View style={styles.stepNavRow}>
                <TouchableOpacity style={styles.stepBackBtn} onPress={() => setOnboardingStep(0)}>
                  <Text style={styles.stepBackBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.submitButton, { flex: 1 }]} onPress={() => setOnboardingStep(2)}>
                  <Text style={styles.submitButtonText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 2: Branding */}
          {onboardingStep === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.fieldLabel}>Restaurant Logo</Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={() => pickImage('logo')}>
                {regLogoUri ? (
                  <Image source={{ uri: regLogoUri }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="camera-outline" size={32} color="#999" />
                    <Text style={styles.imagePickerText}>Tap to select logo</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Background Image</Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={() => pickImage('background')}>
                {regBgUri ? (
                  <Image source={{ uri: regBgUri }} style={[styles.imagePreview, { borderRadius: 8 }]} />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="image-outline" size={32} color="#999" />
                    <Text style={styles.imagePickerText}>Tap to select background</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.stepNavRow}>
                <TouchableOpacity style={styles.stepBackBtn} onPress={() => setOnboardingStep(1)}>
                  <Text style={styles.stepBackBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, { flex: 1, backgroundColor: '#27ae60' }, loading && styles.buttonDisabled]}
                  onPress={handleRegisterSubmit}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Create Restaurant</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Timezone Picker Modal */}
        <Modal visible={showTimezonePicker} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>Select Timezone</Text>
                <TouchableOpacity onPress={() => setShowTimezonePicker(false)}>
                  <Text style={{ fontSize: 16, color: '#6b7280' }}>✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={{ margin: 12, padding: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, fontSize: 14 }}
                placeholder="Search timezones..."
                value={timezoneSearch}
                onChangeText={setTimezoneSearch}
                autoFocus
              />
              <FlatList
                data={TIMEZONE_OPTIONS.filter(o => o.label.toLowerCase().includes(timezoneSearch.toLowerCase()) || o.value.toLowerCase().includes(timezoneSearch.toLowerCase()))}
                keyExtractor={item => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{ padding: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: item.value === regTimezone ? '#eff6ff' : '#fff' }}
                    onPress={() => { setRegTimezone(item.value); setShowTimezonePicker(false); }}
                  >
                    <Text style={{ fontSize: 14, color: item.value === regTimezone ? '#2563eb' : '#1f2937', fontWeight: item.value === regTimezone ? '600' : '400' }}>{item.label}</Text>
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
              />
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  return null;
};

const styles = StyleSheet.create({
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 28,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
    marginTop: 40,
  },
  logo: {
    width: 110,
    height: 110,
  },

  // Choice screen
  buttonContainer: {
    alignItems: 'center',
    width: '100%',
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
  },
  adminButton: {
    backgroundColor: '#2C3E50',
  },
  outlineButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#2C3E50',
    flex: 1,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  choiceButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    width: '100%',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#999',
    fontSize: 13,
  },

  // Back button
  backButton: {
    position: 'absolute',
    top: 54,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
    padding: 6,
  },
  backButtonText: {
    color: '#2C3E50',
    fontSize: 16,
    fontWeight: '600',
  },

  // Forms
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    color: '#6b7280',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
    color: '#1f2937',
  },
  submitButton: {
    backgroundColor: '#2C3E50',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.45,
  },

  // Scanner
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerHeader: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scannerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scannerHint: {
    color: '#fff',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 20,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#f9fafb',
  },
  permissionText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginVertical: 16,
  },
  manualEntrySection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  manualEntryLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  manualEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // PIN Entry
  pinContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  pinHeader: {
    alignItems: 'center',
    marginBottom: 36,
  },
  pinIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pinTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  pinSubtitle: {
    fontSize: 15,
    color: '#6b7280',
  },
  restaurantLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 8,
    fontStyle: 'italic',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  pinDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 32,
  },
  pinDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  pinDotInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
  },

  // Onboarding
  onboardingScroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 28,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#2C3E50',
  },
  stepCircleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9ca3af',
  },
  stepCircleTextActive: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  stepLabelActive: {
    color: '#2C3E50',
  },
  stepContent: {
    marginTop: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  optionButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionButtonActive: {
    backgroundColor: '#2C3E50',
    borderColor: '#2C3E50',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  stepNavRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  stepBackBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
  },
  stepBackBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  imagePickerBtn: {
    marginBottom: 18,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  imagePickerPlaceholder: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    gap: 6,
  },
  imagePickerText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  imagePreview: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
});
