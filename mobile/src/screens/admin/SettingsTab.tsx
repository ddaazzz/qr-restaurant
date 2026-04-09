import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
  Modal,
  FlatList,
  Share,
  Image,
  Platform,
  Animated,
  Keyboard,
  InputAccessoryView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import QRCode from 'react-native-qrcode-svg';
import { BleManager } from 'react-native-ble-plx';
import { apiClient } from '../../services/apiClient';
import { useTranslation } from '../../contexts/TranslationContext';
import { printerSettingsService } from '../../services/printerSettingsService';
import { Ionicons } from '@expo/vector-icons';
import { UsersTab } from './UsersTab';
import { useAuth } from '../../hooks/useAuth';

interface RestaurantSettings {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  background_url?: string;
  timezone?: string;
  service_charge_percent?: number;
  theme_color?: string;
  language_preference?: string;
  qr_mode?: 'regenerate' | 'static_table' | 'static_seat';
  booking_time_allowance_mins?: number;
  show_item_status_to_diners?: boolean;
  pos_webhook_url?: string;
  pos_api_key?: string;
  pos_system_type?: string;
}

interface PrinterSettings {
  // Generic printer settings (shared for all doc types)
  // Backend stores only ONE printer config, not separate qr/bill/kitchen
  id?: number;
  printer_type?: string;
  printer_host?: string;
  printer_port?: number;
  printer_usb_vendor_id?: string;
  printer_usb_product_id?: string;
  bluetooth_device_id?: string;
  bluetooth_device_name?: string;
  
  // QR Code Printer Configuration
  qr_printer_type?: string;
  qr_printer_host?: string;
  qr_printer_port?: number;
  qr_bluetooth_device_id?: string;
  qr_bluetooth_device_name?: string;
  qr_auto_print?: boolean;
  
  // Bill/Receipt Printer Configuration
  bill_printer_type?: string;
  bill_printer_host?: string;
  bill_printer_port?: number;
  bill_bluetooth_device_id?: string;
  bill_bluetooth_device_name?: string;
  bill_auto_print?: boolean;
  
  // Kitchen Order Printer Configuration
  kitchen_printer_type?: string;
  kitchen_printer_host?: string;
  kitchen_printer_port?: number;
  kitchen_bluetooth_device_id?: string;
  kitchen_bluetooth_device_name?: string;
  kitchen_auto_print?: boolean;

  // KPay Receipt Printer Configuration
  kpay_printer_type?: string;
  kpay_printer_host?: string;
  kpay_printer_port?: number;
  kpay_bluetooth_device_id?: string;
  kpay_bluetooth_device_name?: string;
  kpay_auto_print?: boolean;
  
  // Auto-print flags for specific document types (legacy)
  print_logo?: boolean;
  
  // Printer paper width for adaptive QR code sizing
  printer_paper_width?: number;
}

interface Coupon {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value?: number;
  max_uses?: number;
  description?: string;
}

interface Variant {
  id: number;
  name: string;
  required?: boolean;
  min_select?: number | null;
  max_select?: number | null;
  menu_item_name?: string;
  price_cents?: number;
}

interface VariantPreset {
  id: number;
  name: string;
  description?: string;
  variants_count: number;
  options_count?: number;
  variants?: Variant[];
}

interface PaymentTerminal {
  id: number;
  vendor_name: 'kpay' | 'payment-asia' | 'other';
  is_active: boolean;
  app_id: string;
  terminal_ip?: string;
  terminal_port?: number;
  endpoint_path?: string;
  metadata?: Record<string, any>;
  last_tested_at?: string;
  last_error_message?: string;
  created_at?: string;
  updated_at?: string;
  // Payment Asia fields
  merchant_token?: string;
  secret_code?: string;
  environment?: 'sandbox' | 'production';
}

export const SettingsTab = ({ restaurantId, navigation }: any) => {
  const { t, lang, setLanguage } = useTranslation();
  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.role === 'superadmin';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [variantPresets, setVariantPresets] = useState<VariantPreset[]>([]);
  const [addonPresets, setAddonPresets] = useState<any[]>([]);
  const [paymentTerminals, setPaymentTerminals] = useState<PaymentTerminal[]>([]);

  // Settings page navigation
  type SettingsPage = 'main' | 'restaurant-info' | 'printer' | 'payment-terminals' | 'qr-settings' | 'staff-links' | 'coupons' | 'variant-presets' | 'addon-presets' | 'language' | 'users' | 'profile';
  const [settingsPage, setSettingsPage] = useState<SettingsPage>('main');
  const slideAnim = useRef(new Animated.Value(0)).current;

  const navigateToPage = (page: SettingsPage) => {
    slideAnim.setValue(1);
    setSettingsPage(page);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const navigateBack = () => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setSettingsPage('main');
      slideAnim.setValue(0);
    });
  };

  // Modal states
  const [editMode, setEditMode] = useState(false);
  const [showingPrinterSettingsPage, setShowingPrinterSettingsPage] = useState(false);

  // Profile state
  const [profileData, setProfileData] = useState<{ name: string; email: string; pin: string; role: string } | null>(null);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '', pin: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [editingPrinterType, setEditingPrinterType] = useState<'qr' | 'bill' | 'kitchen' | 'kpay' | null>(null);
  const [bluetoothSearching, setBluetoothSearching] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<Array<{ id: string; name: string; signal: number }>>([]);
  // Modal state: 'printer' | 'bluetooth' | null
  const [activeModal, setActiveModal] = useState<'printer' | 'bluetooth' | null>(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showPaymentTerminalModal, setShowPaymentTerminalModal] = useState(false);
  const [editingTerminalId, setEditingTerminalId] = useState<number | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
  const [showCouponDetailModal, setShowCouponDetailModal] = useState(false);
  const [showVariantPresetsModal, setShowVariantPresetsModal] = useState(false);
  const [selectedVariantPreset, setSelectedVariantPreset] = useState<VariantPreset | null>(null);
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [showStaffQRModal, setShowStaffQRModal] = useState(false);
  const [showKitchenQRModal, setShowKitchenQRModal] = useState(false);
  
  // Format preferences (displayed directly on printer settings page)
  const [qrCodeSize, setQrCodeSize] = useState('medium');
  const [qrTextAbove, setQrTextAbove] = useState('Scan to Order');
  const [qrTextBelow, setQrTextBelow] = useState('Let us know how we did!');
  const [billPaperWidth, setBillPaperWidth] = useState('80');
  const [billShowPhone, setBillShowPhone] = useState(true);
  const [billShowAddress, setBillShowAddress] = useState(true);
  const [billShowTime, setBillShowTime] = useState(true);
  const [billShowItems, setBillShowItems] = useState(true);
  const [billShowTotal, setBillShowTotal] = useState(true);
  const [billFooterMsg, setBillFooterMsg] = useState('Thank you for your business!');

  // Form states
  const [formData, setFormData] = useState<RestaurantSettings | null>(null);
  const [printerFormData, setPrinterFormData] = useState<PrinterSettings | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    min_order_value: '',
    description: '',
  });
  const [terminalForm, setTerminalForm] = useState({
    vendor_name: 'kpay' as 'kpay' | 'payment-asia' | 'other',
    app_id: '',
    app_secret: '',
    terminal_ip: '192.168.50.210',
    terminal_port: '18080',
    endpoint_path: '/v2/pos/sign',
    merchant_token: '',
    secret_code: '',
    environment: 'sandbox' as 'sandbox' | 'production',
  });
  const [testingTerminal, setTestingTerminal] = useState(false);
  const [terminalTestResult, setTerminalTestResult] = useState<any>(null);

  const fetchSettings = async () => {
    try {
      setError(null);
      // Fetch critical settings first (don't wait for coupons - they're not critical)
      const [settingsRes, printerRes] = await Promise.all([
        apiClient.get(`/api/restaurants/${restaurantId}/settings`),
        apiClient.get(`/api/restaurants/${restaurantId}/printer-settings`),
      ]);

      setSettings(settingsRes.data);
      const printerData = printerRes.data;
      
      // Convert array format from API to flat object (same logic as webapp admin-printer.js)
      let flatSettings: any = {};
      if (Array.isArray(printerData)) {
        printerData.forEach((printer: any) => {
          const typeLower = (printer.type || '').toLowerCase();
          const prefix = typeLower === 'qr' ? 'qr_' : typeLower === 'bill' ? 'bill_' : typeLower === 'kpay' ? 'kpay_' : 'kitchen_';
          
          if (typeLower === 'kitchen') {
            flatSettings[`${prefix}printer_type`] = printer.printer_type || 'none';
            if (printer.settings && Array.isArray(printer.settings.printers)) {
              flatSettings.kitchen_printers = printer.settings.printers;
            }
            if (printer.settings) {
              Object.entries(printer.settings).forEach(([key, value]) => {
                if (key !== 'printers') {
                  flatSettings[`${prefix}${key}`] = value;
                }
              });
            }
          } else {
            flatSettings[`${prefix}printer_type`] = printer.printer_type || 'none';
            flatSettings[`${prefix}printer_host`] = printer.printer_host;
            flatSettings[`${prefix}printer_port`] = printer.printer_port;
            flatSettings[`${prefix}bluetooth_device_id`] = printer.bluetooth_device_id;
            flatSettings[`${prefix}bluetooth_device_name`] = printer.bluetooth_device_name;
            if (printer.settings) {
              Object.entries(printer.settings).forEach(([key, value]) => {
                flatSettings[`${prefix}${key}`] = value;
              });
            }
          }
        });
      } else {
        // Old format fallback
        flatSettings = printerData || {};
      }
      
      if (!flatSettings.qr_printer_type) flatSettings.qr_printer_type = 'none';
      if (!flatSettings.bill_printer_type) flatSettings.bill_printer_type = 'none';
      if (!flatSettings.kitchen_printer_type) flatSettings.kitchen_printer_type = 'none';
      if (!flatSettings.kpay_printer_type) flatSettings.kpay_printer_type = 'none';
      
      setPrinterSettings(flatSettings);
      setFormData(settingsRes.data);
      setPrinterFormData(flatSettings);

      // Fetch coupons separately (non-blocking) with shorter timeout
      // Don't block settings load if coupons endpoint is slow/unavailable
      fetchCoupons();
    } catch (err: any) {
      console.error('[Settings] Error fetching settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchCoupons = async () => {
    try {
      const couponsRes = await apiClient.get(`/api/restaurants/${restaurantId}/coupons`);
      const couponsList = Array.isArray(couponsRes.data) ? couponsRes.data : couponsRes.data.coupons || [];
      setCoupons(couponsList);
    } catch (err: any) {
      console.warn('[Settings] Failed to fetch coupons (non-critical):', err.message);
      // Don't show error or block UI - coupons fetching is non-critical
      setCoupons([]);
    }
  };

  const fetchVariantPresets = async () => {
    try {
      const presetsRes = await apiClient.get(`/api/restaurants/${restaurantId}/variant-presets`);
      const presetsList = Array.isArray(presetsRes.data) ? presetsRes.data : presetsRes.data.presets || [];
      setVariantPresets(presetsList);
    } catch (err: any) {
      console.warn('[Settings] Failed to fetch variant presets (non-critical):', err.message);
      // Don't show error or block UI - variant presets fetching is non-critical
      setVariantPresets([]);
    }
  };

  const fetchPaymentTerminals = async () => {
    try {
      const terminalsRes = await apiClient.get(`/api/restaurants/${restaurantId}/payment-terminals`);
      const terminalsList = Array.isArray(terminalsRes.data) ? terminalsRes.data : [];
      setPaymentTerminals(terminalsList);
    } catch (err: any) {
      console.warn('[Settings] Failed to fetch payment terminals (non-critical):', err.message);
      setPaymentTerminals([]);
    }
  };

  const fetchAddonPresets = async () => {
    try {
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/addon-presets`);
      const presetsList = Array.isArray(res.data) ? res.data : [];
      setAddonPresets(presetsList);
    } catch (err: any) {
      console.warn('[Settings] Failed to fetch addon presets (non-critical):', err.message);
      setAddonPresets([]);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchVariantPresets();
    fetchPaymentTerminals();
    fetchAddonPresets();
  }, [restaurantId]);

  const getPrinterTypeLabel = (type?: string): string => {
    const labels: Record<string, string> = {
      'thermal': 'Thermal Network Printer',
      'network': 'Network Printer',
      'bluetooth': 'Bluetooth Printer',
      'none': 'Not Configured',
    };
    const label = labels[type || ''] || '—';
    console.log('[Printer] getPrinterTypeLabel called with:', type, '-> result:', label);
    return label;
  };

  const saveSettings = async () => {
    try {
      if (!formData) return;

      await apiClient.patch(`/api/restaurants/${restaurantId}/settings`, {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        timezone: formData.timezone,
        service_charge_percent: parseFloat(formData.service_charge_percent?.toString() || '0'),
        language_preference: formData.language_preference,
        logo_url: formData.logo_url,
        background_url: formData.background_url,
        booking_time_allowance_mins: parseInt(formData.booking_time_allowance_mins?.toString() || '30'),
        qr_mode: formData.qr_mode,
        show_item_status_to_diners: formData.show_item_status_to_diners,
      });

      setSettings(formData);
      setEditMode(false);
      Alert.alert('Success', 'Settings saved successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save settings');
    }
  };

  const savePrinterSettings = async () => {
    try {
      if (!printerFormData || !editingPrinterType) return;

      const prefix = editingPrinterType; // 'qr', 'bill', 'kitchen', or 'kpay'

      // Build payload matching webapp format (individual record with type field)
      const payload: any = {
        type: prefix.toUpperCase(),
        printer_type: printerFormData.printer_type,
        printer_host: printerFormData.printer_type === 'network' ? printerFormData.printer_host : null,
        printer_port: printerFormData.printer_type === 'network' ? parseInt((printerFormData.printer_port as any)?.toString() || '9100') : null,
        bluetooth_device_id: printerFormData.printer_type === 'bluetooth' ? printerFormData.bluetooth_device_id : null,
        bluetooth_device_name: printerFormData.printer_type === 'bluetooth' ? printerFormData.bluetooth_device_name : null,
      };

      // Auto-print and paper width go into settings JSONB
      const settings: any = {};
      const autoPrintKey = `${prefix}_auto_print`;
      if ((printerFormData as any)[autoPrintKey] !== undefined) {
        settings.auto_print = (printerFormData as any)[autoPrintKey] || false;
      }
      if (printerFormData.printer_paper_width) {
        settings.printer_paper_width = printerFormData.printer_paper_width;
      }
      if (Object.keys(settings).length > 0) {
        payload.settings = settings;
      }

      console.log(`[SettingsTab] Saving ${editingPrinterType} printer settings with payload:`, payload);

      await apiClient.patch(`/api/restaurants/${restaurantId}/printer-settings`, payload);

      // Update local flat state with new data
      const flatUpdate: any = {};
      flatUpdate[`${prefix}_printer_type`] = payload.printer_type;
      flatUpdate[`${prefix}_printer_host`] = payload.printer_host;
      flatUpdate[`${prefix}_printer_port`] = payload.printer_port;
      flatUpdate[`${prefix}_bluetooth_device_id`] = payload.bluetooth_device_id;
      flatUpdate[`${prefix}_bluetooth_device_name`] = payload.bluetooth_device_name;
      if (settings.auto_print !== undefined) {
        flatUpdate[`${prefix}_auto_print`] = settings.auto_print;
      }
      if (settings.printer_paper_width) {
        flatUpdate.printer_paper_width = settings.printer_paper_width;
      }
      setPrinterSettings({ ...printerSettings, ...flatUpdate } as PrinterSettings);
      
      // Invalidate cache so next fetch gets fresh data from backend
      printerSettingsService.invalidateCache(restaurantId);
      
      setEditingPrinterType(null);
      setActiveModal(null);
      setShowingPrinterSettingsPage(false);
      Alert.alert('Success', `${editingPrinterType.toUpperCase()} printer settings saved!`);
    } catch (err: any) {
      console.error('[SettingsTab] Error saving printer settings:', err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to save printer settings');
    }
  };

  const saveQRFormatSettings = async () => {
    try {
      const payload = {
        type: 'QR',
        printer_type: printerSettings?.qr_printer_type || 'none',
        settings: {
          code_size: qrCodeSize,
          text_above: qrTextAbove,
          text_below: qrTextBelow,
        },
      };

      console.log('[SettingsTab] Saving QR Code Format settings:', payload);

      await apiClient.patch(`/api/restaurants/${restaurantId}/printer-settings`, payload);

      // Invalidate cache so next fetch gets fresh data from backend
      printerSettingsService.invalidateCache(restaurantId);
      
      Alert.alert('Success', 'QR Code Format settings saved!');
    } catch (err: any) {
      console.error('[SettingsTab] Error saving QR Code Format settings:', err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to save QR Code Format settings');
    }
  };

  const startBluetoothSearch = async () => {
    try {
      setBluetoothSearching(true);
      setBluetoothDevices([]);

      // Request permissions through BleManager's native implementation
      console.log('Initializing Bluetooth...');
      const manager = new BleManager();
      
      try {
        // Check Bluetooth state
        const state = await manager.state();
        console.log('[Bluetooth] Manager state:', state);
        
        if (state !== 'PoweredOn') {
          Alert.alert('Bluetooth', 'Please enable Bluetooth on your device and try again');
          return;
        }
      } catch (err) {
        console.warn('Bluetooth state check failed, attempting to scan anyway:', err);
      }

      const foundDevices: Map<string, { id: string; name: string; signal: number }> = new Map();

      // Start scanning immediately
      console.log('Starting device scan...');
      manager.startDeviceScan(null, null, (error: any, device: any) => {
        if (error) {
          console.error('Bluetooth scan callback error:', error);
          return;
        }

        // Add any device found (with or without name)
        if (device && device.id) {
          const deviceName = device.name && device.name.trim().length > 0 
            ? device.name 
            : `Device ${device.id.substring(0, 8)}`;
          
          if (!foundDevices.has(device.id)) {
            foundDevices.set(device.id, {
              id: device.id,
              name: deviceName,
              signal: device.rssi || 0,
            });
            
            // Update state immediately
            setBluetoothDevices(Array.from(foundDevices.values()));
            console.log(`📱 Found Bluetooth device: ${deviceName} (ID: ${device.id}, Signal: ${device.rssi})`);
          }
        }
      });

      // Stop scanning after 10 seconds
      setTimeout(() => {
        manager.stopDeviceScan();
        setBluetoothSearching(false);
        console.log(`✓ Bluetooth scan completed. Found ${foundDevices.size} devices`);
        
        if (foundDevices.size === 0) {
          Alert.alert('No Devices Found', 'No Bluetooth devices detected. Make sure your printer is powered on and in pairing mode.\n\nTip: On iOS, ensure Location permission is granted. On Android, ensure Bluetooth permission is granted.');
        }
      }, 10000);
    } catch (err: any) {
      console.error('❌ Bluetooth search error:', err);
      setBluetoothSearching(false);
      Alert.alert('Error', 'Failed to search for Bluetooth devices: ' + err.message + '\n\nMake sure Bluetooth permissions are granted.');
    }
  };

  const selectBluetoothDevice = (device: { id: string; name: string; signal: number }) => {
    if (!editingPrinterType) return;

    // Use prefixed fields for each printer type (qr_, bill_, kitchen_)
    const payload: any = {
      ...printerFormData,
    };
    
    const prefix = editingPrinterType; // 'qr', 'bill', or 'kitchen'
    payload[`${prefix}_bluetooth_device_id`] = device.id;
    payload[`${prefix}_bluetooth_device_name`] = device.name;

    setPrinterFormData(payload as PrinterSettings);

    setActiveModal('printer');
    Alert.alert('Device Selected', `"${device.name}" has been selected for your ${editingPrinterType.toUpperCase()} printer.`);
  };

  // Bluetooth device selection is now handled at runtime during printing

  const createCoupon = async () => {
    try {
      if (!couponForm.code || !couponForm.discount_value) {
        Alert.alert('Validation', 'Please fill in all required fields');
        return;
      }

      await apiClient.post(`/api/restaurants/${restaurantId}/coupons`, {
        code: couponForm.code.toUpperCase(),
        discount_type: couponForm.discount_type,
        discount_value: parseFloat(couponForm.discount_value),
        min_order_value: couponForm.min_order_value ? parseFloat(couponForm.min_order_value) : null,
        description: couponForm.description || null,
      });

      await fetchSettings();
      setCouponForm({
        code: '',
        discount_type: 'percentage',
        discount_value: '',
        min_order_value: '',
        description: '',
      });
      setShowCouponModal(false);
      Alert.alert('Success', 'Coupon created!');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create coupon');
    }
  };

  const deleteCoupon = async (couponId: number) => {
    Alert.alert('Delete Coupon', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/coupons/${couponId}`);
            await fetchSettings();
            Alert.alert('Success', 'Coupon deleted!');
          } catch (err: any) {
            Alert.alert('Error', 'Failed to delete coupon');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  // Payment Terminal Functions
  const savePaymentTerminal = async () => {
    try {
      // Validation differs by vendor
      if (terminalForm.vendor_name === 'payment-asia') {
        if (!terminalForm.merchant_token || !terminalForm.secret_code) {
          Alert.alert('Validation', 'Please fill in Merchant Token and Secret Code');
          return;
        }
      } else {
        if (!terminalForm.app_id || !terminalForm.app_secret || !terminalForm.terminal_ip || !terminalForm.terminal_port) {
          Alert.alert('Validation', 'Please fill in all required fields');
          return;
        }
      }

      const payload: any = {
        vendor_name: terminalForm.vendor_name,
        app_id: terminalForm.app_id,
        app_secret: terminalForm.app_secret,
      };

      if (terminalForm.vendor_name === 'payment-asia') {
        payload.merchant_token = terminalForm.merchant_token;
        payload.secret_code = terminalForm.secret_code;
        payload.environment = terminalForm.environment;
      } else {
        payload.terminal_ip = terminalForm.terminal_ip;
        payload.terminal_port = parseInt(terminalForm.terminal_port);
        payload.endpoint_path = terminalForm.endpoint_path || '/v2/pos/sign';
      }

      if (editingTerminalId) {
        // Update existing terminal
        await apiClient.patch(`/api/restaurants/${restaurantId}/payment-terminals/${editingTerminalId}`, payload);
        Alert.alert('Success', 'Payment terminal updated successfully!');
      } else {
        // Create new terminal
        await apiClient.post(`/api/restaurants/${restaurantId}/payment-terminals`, payload);
        Alert.alert('Success', 'Payment terminal created successfully!');
      }

      await fetchPaymentTerminals();
      resetTerminalForm();
      setShowPaymentTerminalModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save payment terminal');
    }
  };

  const testPaymentTerminal = async () => {
    try {
      if (!editingTerminalId) {
        Alert.alert('Error', 'Please save the terminal configuration first');
        return;
      }

      setTestingTerminal(true);
      const response = await apiClient.post(
        `/api/restaurants/${restaurantId}/payment-terminals/${editingTerminalId}/test`
      );

      setTerminalTestResult(response.data);
      
      if (response.data.success) {
        Alert.alert(
          'Connection Successful',
          `Connected to ${terminalForm.vendor_name.toUpperCase()} terminal at ${terminalForm.terminal_ip}:${terminalForm.terminal_port}`
        );
      } else {
        Alert.alert(
          'Connection Failed',
          response.data.error || response.data.message
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to test terminal connection');
    } finally {
      setTestingTerminal(false);
    }
  };

  const deletePaymentTerminal = async (terminalId: number) => {
    Alert.alert('Delete Payment Terminal', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/restaurants/${restaurantId}/payment-terminals/${terminalId}`);
            await fetchPaymentTerminals();
            Alert.alert('Success', 'Payment terminal deleted!');
          } catch (err: any) {
            Alert.alert('Error', 'Failed to delete payment terminal');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const editPaymentTerminal = (terminal: PaymentTerminal) => {
    setEditingTerminalId(terminal.id);
    setTerminalForm({
      vendor_name: terminal.vendor_name,
      app_id: terminal.app_id,
      app_secret: '', // Don't pre-fill secret for security
      terminal_ip: terminal.terminal_ip || '192.168.50.210',
      terminal_port: terminal.terminal_port?.toString() || '18080',
      endpoint_path: terminal.endpoint_path || '/v2/pos/sign',
      merchant_token: terminal.merchant_token || '',
      secret_code: '',
      environment: terminal.environment || 'sandbox',
    });
    setTerminalTestResult(null);
    setShowPaymentTerminalModal(true);
  };

  const resetTerminalForm = () => {
    setEditingTerminalId(null);
    setTerminalForm({
      vendor_name: 'kpay',
      app_id: '',
      app_secret: '',
      terminal_ip: '192.168.50.210',
      terminal_port: '18080',
      endpoint_path: '/v2/pos/sign',
      merchant_token: '',
      secret_code: '',
      environment: 'sandbox',
    });
    setTerminalTestResult(null);
  };

  const copyToClipboard = async (text: string, label: string) => {
    // In React Native, we'd use a library like @react-native-clipboard/clipboard
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const getWebOrigin = () => {
    // This should match your backend server URL
    // For development, you might need to set this via environment variables
    return 'http://localhost:3000'; // Update based on your setup
  };

  const generateStaffQRUrl = () => {
    return `${getWebOrigin()}/staff.html?rid=${restaurantId}`;
  };

  const generateKitchenQRUrl = () => {
    return `${getWebOrigin()}/kitchen.html?rid=${restaurantId}`;
  };

  const shareQRCode = async (type: 'staff' | 'kitchen') => {
    try {
      const url = type === 'staff' ? generateStaffQRUrl() : generateKitchenQRUrl();
      const title = type === 'staff' ? 'Staff Login QR Code' : 'Kitchen Login QR Code';
      
      await Share.share({
        message: `${title}\n\nScan this link with your phone to login:\n${url}`,
        url: url, // For iOS
        title: title,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share QR code');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Bluetooth Device Search Modal - rendered at root level so it's always available
  const bluetoothModal = (
    <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      transparent={true}
      visible={activeModal === 'bluetooth'}
      animationType="slide"
      onRequestClose={() => setActiveModal(null)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Search Bluetooth Devices</Text>
            <TouchableOpacity onPress={() => setActiveModal(null)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { marginBottom: 16, marginHorizontal: 16 }]}
            onPress={startBluetoothSearch}
            disabled={bluetoothSearching}
          >
            <Text style={styles.btnText}>{bluetoothSearching ? 'Scanning...' : 'Scan for Devices'}</Text>
          </TouchableOpacity>

          <ScrollView style={{ flex: 1, marginHorizontal: 0 }}>
            {bluetoothDevices.length > 0 ? (
              bluetoothDevices.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: '#e5e7eb',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                  }}
                  onPress={() => selectBluetoothDevice(device)}
                >
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#1f2937' }}>{device.name}</Text>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>Signal: {device.signal} dBm</Text>
                </TouchableOpacity>
              ))
            ) : bluetoothSearching ? (
              <Text style={[styles.helperText, { marginHorizontal: 16, marginTop: 20 }]}>Searching for devices...</Text>
            ) : (
              <Text style={[styles.helperText, { marginHorizontal: 16, marginTop: 20 }]}>Click "Scan for Devices" to search for nearby Bluetooth devices</Text>
            )}
          </ScrollView>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => {
                setActiveModal(null);
                setShowingPrinterSettingsPage(false);
              }}
            >
              <Text style={styles.btnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Printer Configuration Page View (when editing a specific printer type)
  if (showingPrinterSettingsPage && editingPrinterType) {
    return (
      <>
        <View style={styles.container}>
        {/* Page Header */}
        <View style={{ padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.printerPageTitle}>
            {editingPrinterType === 'qr' && 'QR Code Printer'}
            {editingPrinterType === 'bill' && 'Bill Printer'}
            {editingPrinterType === 'kitchen' && 'Kitchen Order Printer'}
            {editingPrinterType === 'kpay' && 'KPay Receipt Printer'}
          </Text>
          <TouchableOpacity onPress={() => { setEditingPrinterType(null); setShowingPrinterSettingsPage(false); }}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            {/* Auto-Print Toggle */}
            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Auto-Print</Text>
                <Switch
                  value={
                    editingPrinterType === 'bill'
                      ? (printerFormData?.bill_auto_print || false)
                      : editingPrinterType === 'kitchen'
                      ? (printerFormData?.kitchen_auto_print || false)
                      : editingPrinterType === 'qr'
                      ? (printerFormData?.qr_auto_print || false)
                      : editingPrinterType === 'kpay'
                      ? (printerFormData?.kpay_auto_print || false)
                      : false
                  }
                  onValueChange={(value) => {
                    if (editingPrinterType === 'bill') {
                      setPrinterFormData({ ...printerFormData, bill_auto_print: value } as PrinterSettings);
                    } else if (editingPrinterType === 'kitchen') {
                      setPrinterFormData({ ...printerFormData, kitchen_auto_print: value } as PrinterSettings);
                    } else if (editingPrinterType === 'qr') {
                      setPrinterFormData({ ...printerFormData, qr_auto_print: value } as PrinterSettings);
                    } else if (editingPrinterType === 'kpay') {
                      setPrinterFormData({ ...printerFormData, kpay_auto_print: value } as PrinterSettings);
                    }
                  }}
                />
              </View>
            </View>

            {/* Printer Type Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Printer Type</Text>
              <View>
                {['none', 'network', 'bluetooth'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={{ paddingVertical: 8 }}
                    onPress={() => {
                      setPrinterFormData({ ...printerFormData, printer_type: type } as PrinterSettings);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          borderWidth: 2,
                          borderColor: printerFormData?.printer_type === type ? '#3b82f6' : '#d1d5db',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        {printerFormData?.printer_type === type && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' }} />
                        )}
                      </View>
                      <Text style={{ marginLeft: 10, fontSize: 14, color: '#1f2937' }}>{getPrinterTypeLabel(type)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Network Printer Config */}
            {printerFormData?.printer_type === 'network' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>IP Address</Text>
                  <TextInput
                    style={styles.input}
                    value={printerFormData?.printer_host?.toString() || ''}
                    onChangeText={(text) => {
                      setPrinterFormData({ ...printerFormData, printer_host: text } as PrinterSettings);
                    }}
                    placeholder="e.g., 192.168.1.100"
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Port</Text>
                  <TextInput
                    style={styles.input}
                    value={printerFormData?.printer_port?.toString() || '9100'}
                    onChangeText={(text) => {
                      setPrinterFormData({ ...printerFormData, printer_port: parseInt(text) || 9100 } as PrinterSettings);
                    }}
                    placeholder="9100"
                    keyboardType="number-pad"
                    inputAccessoryViewID="numpadDone"
                  />
                </View>
              </>
            )}

            {/* Bluetooth Printer Config */}
            {printerFormData?.printer_type === 'bluetooth' && (
              <>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { marginBottom: 16 }]}
                  onPress={() => setActiveModal('bluetooth')}
                >
                  <Text style={styles.btnText}>Scan for Bluetooth Devices</Text>
                </TouchableOpacity>

                {(printerFormData?.bluetooth_device_name || 
                  (editingPrinterType === 'qr' && printerSettings?.qr_bluetooth_device_name) ||
                  (editingPrinterType === 'bill' && printerSettings?.bill_bluetooth_device_name) ||
                  (editingPrinterType === 'kitchen' && printerSettings?.kitchen_bluetooth_device_name) ||
                  (editingPrinterType === 'kpay' && printerSettings?.kpay_bluetooth_device_name)) && (
                  <View style={{ backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#86efac', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#059669', marginBottom: 4 }}>Connected Device</Text>
                    <Text style={{ fontSize: 14, color: '#1f2937', fontWeight: '500' }}>
                      {printerFormData?.bluetooth_device_name || 
                      (editingPrinterType === 'qr' ? printerSettings?.qr_bluetooth_device_name : '') ||
                      (editingPrinterType === 'bill' ? printerSettings?.bill_bluetooth_device_name : '') ||
                      (editingPrinterType === 'kitchen' ? printerSettings?.kitchen_bluetooth_device_name : '') ||
                      (editingPrinterType === 'kpay' ? printerSettings?.kpay_bluetooth_device_name : '')}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>ID: {printerFormData?.bluetooth_device_id || 
                      (editingPrinterType === 'qr' ? printerSettings?.qr_bluetooth_device_id : '') ||
                      (editingPrinterType === 'bill' ? printerSettings?.bill_bluetooth_device_id : '') ||
                      (editingPrinterType === 'kitchen' ? printerSettings?.kitchen_bluetooth_device_id : '') ||
                      (editingPrinterType === 'kpay' ? printerSettings?.kpay_bluetooth_device_id : '')}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>

        <View style={styles.formActions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => { setEditingPrinterType(null); setShowingPrinterSettingsPage(false); }}
          >
            <Text style={styles.btnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => savePrinterSettings()}
          >
            <Text style={styles.btnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
      {bluetoothModal}
    </>
  );
  }

  // Printer Settings Full Page View
  if (showingPrinterSettingsPage) {
    return (
      <>
        <View style={styles.container}>
        {/* Page Header */}
        <View style={{ padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.printerPageTitle}>{t('admin.printer-settings')}</Text>
          <TouchableOpacity onPress={() => setShowingPrinterSettingsPage(false)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* QR Code Format Section */}
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            <Text style={[styles.label, { fontSize: 14, fontWeight: '600', marginBottom: 12 }]}>QR Code Format</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>QR Code Size</Text>
              <View style={styles.toggleGroup}>
                {['small', 'medium', 'large'].map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.typeBtn,
                      qrCodeSize === size && styles.typeBtnActive,
                    ]}
                    onPress={() => setQrCodeSize(size)}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        qrCodeSize === size && styles.typeBtnTextActive,
                      ]}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Text Above QR Code</Text>
              <TextInput
                style={styles.input}
                value={qrTextAbove}
                onChangeText={setQrTextAbove}
                placeholder="e.g., Scan to Order"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Text Below QR Code</Text>
              <TextInput
                style={styles.input}
                value={qrTextBelow}
                onChangeText={setQrTextBelow}
                placeholder="e.g., Let us know how we did!"
              />
            </View>

            <View style={[styles.formGroup, { marginBottom: 20 }]}>
              <Text style={styles.label}>Preview</Text>
              <View style={{
                borderColor: '#ddd',
                borderWidth: 2,
                borderRadius: 6,
                padding: 16,
                backgroundColor: '#f9fafb',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 8 }}>La Cave (Sai Ying Pun)</Text>
                <Text style={{ fontSize: 10, marginBottom: 2 }}>Table: T02</Text>
                <Text style={{ fontSize: 10, marginBottom: 8 }}>Time: 2026-03-13 18:24</Text>
                <Text style={{ fontSize: 10, marginBottom: 12 }}>{'='.repeat(40)}</Text>
                <View style={{
                  width: qrCodeSize === 'small' ? 120 : qrCodeSize === 'medium' ? 150 : 180,
                  height: qrCodeSize === 'small' ? 120 : qrCodeSize === 'medium' ? 150 : 180,
                  backgroundColor: '#f0f0f0',
                  borderWidth: 1,
                  borderColor: '#ccc',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <Text style={{ fontSize: 11, color: '#999' }}>QR Code</Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{qrTextAbove}</Text>
                <Text style={{ fontSize: 10, marginBottom: 8, textAlign: 'center' }}>{qrTextBelow}</Text>
                <Text style={{ fontSize: 9, color: '#666' }}>Powered by Chuio</Text>
              </View>
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 20, marginBottom: 20 }} />
          </View>

          {/* Bill Format Section */}
          <View style={{ marginHorizontal: 16 }}>
            <Text style={[styles.label, { fontSize: 14, fontWeight: '600', marginBottom: 12 }]}>Bill Format</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Paper Width</Text>
              <View style={styles.toggleGroup}>
                {['58', '80'].map((width) => (
                  <TouchableOpacity
                    key={width}
                    style={[
                      styles.typeBtn,
                      billPaperWidth === width && styles.typeBtnActive,
                    ]}
                    onPress={() => setBillPaperWidth(width)}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        billPaperWidth === width && styles.typeBtnTextActive,
                      ]}
                    >
                      {width}mm
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Show Phone</Text>
                <Switch value={billShowPhone} onValueChange={setBillShowPhone} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Show Address</Text>
                <Switch value={billShowAddress} onValueChange={setBillShowAddress} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Show Order Time</Text>
                <Switch value={billShowTime} onValueChange={setBillShowTime} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Show Items</Text>
                <Switch value={billShowItems} onValueChange={setBillShowItems} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>Show Total</Text>
                <Switch value={billShowTotal} onValueChange={setBillShowTotal} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Footer Message</Text>
              <TextInput
                style={styles.input}
                value={billFooterMsg}
                onChangeText={setBillFooterMsg}
                placeholder="Thank you for your business!"
              />
            </View>

            <View style={[styles.formGroup, { marginBottom: 20 }]}>
              <Text style={styles.label}>Preview</Text>
              <View style={{
                borderColor: '#ddd',
                borderWidth: 2,
                borderRadius: 6,
                padding: 12,
                backgroundColor: '#f9fafb',
              }}>
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 11 : 13,
                  fontWeight: '600',
                  textAlign: 'center',
                  marginBottom: 2,
                  fontFamily: 'Courier New',
                }}>La Cave (Sai Ying Pun)</Text>
                {billShowPhone && (
                  <Text style={{
                    fontSize: billPaperWidth === '58' ? 9 : 11,
                    textAlign: 'center',
                    marginBottom: 1,
                    fontFamily: 'Courier New',
                  }}>Phone: +852 1234 5678</Text>
                )}
                {billShowAddress && (
                  <Text style={{
                    fontSize: billPaperWidth === '58' ? 9 : 11,
                    textAlign: 'center',
                    marginBottom: 4,
                    fontFamily: 'Courier New',
                  }}>123 Main Street</Text>
                )}
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 9 : 11,
                  textAlign: 'center',
                  marginVertical: 4,
                  letterSpacing: 1,
                  fontFamily: 'Courier New',
                }}>{'='.repeat(billPaperWidth === '58' ? 40 : 50)}</Text>
                {billShowTime && (
                  <Text style={{
                    fontSize: billPaperWidth === '58' ? 9 : 11,
                    textAlign: 'center',
                    marginVertical: 2,
                    fontFamily: 'Courier New',
                  }}>Order Time: 2026-03-13 18:24</Text>
                )}
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 9 : 11,
                  marginVertical: 2,
                  fontFamily: 'Courier New',
                }}>Table: T02       Pax: 4</Text>
                {billShowItems && (
                  <>
                    <Text style={{
                      fontSize: billPaperWidth === '58' ? 9 : 11,
                      marginVertical: 4,
                      fontFamily: 'Courier New',
                    }}>Domaine Rolet          $450</Text>
                  </>
                )}
                {billShowTotal && (
                  <>
                    <Text style={{
                      fontSize: billPaperWidth === '58' ? 9 : 11,
                      textAlign: 'right',
                      marginVertical: 2,
                      fontFamily: 'Courier New',
                    }}>Subtotal: $450</Text>
                    <Text style={{
                      fontSize: billPaperWidth === '58' ? 11 : 13,
                      fontWeight: 'bold',
                      textAlign: 'right',
                      marginVertical: 2,
                      fontFamily: 'Courier New',
                    }}>Total: $450</Text>
                  </>
                )}
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 9 : 11,
                  textAlign: 'center',
                  marginVertical: 4,
                  fontFamily: 'Courier New',
                }}>{'='.repeat(billPaperWidth === '58' ? 40 : 50)}</Text>
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 10 : 12,
                  fontWeight: '600',
                  textAlign: 'center',
                  marginVertical: 6,
                  fontFamily: 'Courier New',
                }}>Thank You</Text>
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 8 : 10,
                  textAlign: 'center',
                  marginBottom: 2,
                  fontFamily: 'Courier New',
                }}>{billFooterMsg}</Text>
                <Text style={{
                  fontSize: billPaperWidth === '58' ? 8 : 10,
                  textAlign: 'center',
                  color: '#666',
                  fontFamily: 'Courier New',
                }}>Powered by Chuio</Text>
              </View>
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 20, marginBottom: 20 }} />
          </View>

          {/* Printer Configuration - Separate for each type */}
          <View style={{ marginHorizontal: 16 }}>
            <Text style={[styles.label, { fontSize: 14, fontWeight: '600', marginBottom: 12 }]}>Printer Configuration</Text>
            
            {/* QR Code Printer */}
            <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#93c5fd', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>QR Code Printer</Text>
              </View>
              {printerSettings?.qr_printer_type && (
                <>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
                    Type: {getPrinterTypeLabel(printerSettings.qr_printer_type)}
                  </Text>
                  {printerSettings.qr_bluetooth_device_name && (
                    <Text style={{ fontSize: 12, color: '#059669', marginBottom: 2 }}>
                      ✓ Device: {printerSettings.qr_bluetooth_device_name}
                    </Text>
                  )}
                  {printerSettings.qr_printer_host && (
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      Host: {printerSettings.qr_printer_host}:{printerSettings.qr_printer_port}
                    </Text>
                  )}
                </>
              )}
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { paddingVertical: 8 }]}
                onPress={() => {
                  setEditingPrinterType('qr');
                  // Load current QR printer settings into form
                  const qrSettings: PrinterSettings = {
                    printer_type: printerSettings?.qr_printer_type || 'none',
                    printer_host: printerSettings?.qr_printer_host,
                    printer_port: printerSettings?.qr_printer_port,
                    bluetooth_device_id: printerSettings?.qr_bluetooth_device_id,
                    bluetooth_device_name: printerSettings?.qr_bluetooth_device_name,
                    qr_auto_print: printerSettings?.qr_auto_print,
                  };
                  setPrinterFormData(qrSettings);
                }}
              >
                <Text style={styles.btnText}>Configure</Text>
              </TouchableOpacity>
            </View>

            {/* Bill Printer */}
            <View style={{ backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>Bill Printer</Text>
              </View>
              {printerSettings?.bill_printer_type && (
                <>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
                    Type: {getPrinterTypeLabel(printerSettings.bill_printer_type)}
                  </Text>
                  {printerSettings.bill_bluetooth_device_name && (
                    <Text style={{ fontSize: 12, color: '#059669', marginBottom: 2 }}>
                      ✓ Device: {printerSettings.bill_bluetooth_device_name}
                    </Text>
                  )}
                  {printerSettings.bill_printer_host && (
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      Host: {printerSettings.bill_printer_host}:{printerSettings.bill_printer_port}
                    </Text>
                  )}
                </>
              )}
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { paddingVertical: 8 }]}
                onPress={() => {
                  setEditingPrinterType('bill');
                  // Load current Bill printer settings into form
                  const billSettings: PrinterSettings = {
                    printer_type: printerSettings?.bill_printer_type || 'none',
                    printer_host: printerSettings?.bill_printer_host,
                    printer_port: printerSettings?.bill_printer_port,
                    bluetooth_device_id: printerSettings?.bill_bluetooth_device_id,
                    bluetooth_device_name: printerSettings?.bill_bluetooth_device_name,
                    bill_auto_print: printerSettings?.bill_auto_print,
                  };
                  setPrinterFormData(billSettings);
                }}
              >
                <Text style={styles.btnText}>Configure</Text>
              </TouchableOpacity>
            </View>

            {/* Kitchen Printer */}
            <View style={{ backgroundColor: '#fce7f3', borderWidth: 1, borderColor: '#fbcfe8', borderRadius: 8, padding: 14, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>Kitchen Order Printer</Text>
              </View>
              {printerSettings?.kitchen_printer_type && (
                <>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
                    Type: {getPrinterTypeLabel(printerSettings.kitchen_printer_type)}
                  </Text>
                  {printerSettings.kitchen_bluetooth_device_name && (
                    <Text style={{ fontSize: 12, color: '#059669', marginBottom: 2 }}>
                      ✓ Device: {printerSettings.kitchen_bluetooth_device_name}
                    </Text>
                  )}
                  {printerSettings.kitchen_printer_host && (
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      Host: {printerSettings.kitchen_printer_host}:{printerSettings.kitchen_printer_port}
                    </Text>
                  )}
                </>
              )}
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { paddingVertical: 8 }]}
                onPress={() => {
                  setEditingPrinterType('kitchen');
                  // Load current Kitchen printer settings into form
                  const kitchenSettings: PrinterSettings = {
                    printer_type: printerSettings?.kitchen_printer_type || 'none',
                    printer_host: printerSettings?.kitchen_printer_host,
                    printer_port: printerSettings?.kitchen_printer_port,
                    bluetooth_device_id: printerSettings?.kitchen_bluetooth_device_id,
                    bluetooth_device_name: printerSettings?.kitchen_bluetooth_device_name,
                    kitchen_auto_print: printerSettings?.kitchen_auto_print,
                  };
                  setPrinterFormData(kitchenSettings);
                }}
              >
                <Text style={styles.btnText}>Configure</Text>
              </TouchableOpacity>
            </View>

            {/* Back Button */}
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, { paddingVertical: 10 }]}
              onPress={() => setShowingPrinterSettingsPage(false)}
            >
              <Text style={styles.btnText}>← Back</Text>
            </TouchableOpacity>
          </View>

          {/* Save Button for QR Format Settings */}
          <View style={{marginHorizontal: 16, marginBottom: 20}}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={saveQRFormatSettings}
            >
              <Text style={styles.btnText}>Save QR Format</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
      {bluetoothModal}
    </>
  );
  }

  // Settings card grid items
  const settingsCards: { page: SettingsPage; iconName: keyof typeof Ionicons.glyphMap; label: string; description: string }[] = [
    { page: 'profile', iconName: 'person-circle-outline', label: 'My Profile', description: currentUser?.role || 'View profile' },
    { page: 'language', iconName: 'globe-outline', label: t('admin.language') || 'Language', description: lang === 'en' ? 'English' : '中文' },
    { page: 'restaurant-info', iconName: 'storefront-outline', label: t('admin.restaurant-info') || 'Restaurant Info', description: settings?.name || '—' },
    { page: 'printer', iconName: 'print-outline', label: t('admin.printer-settings') || 'Printers', description: 'QR, Bill, Kitchen' },
    { page: 'payment-terminals', iconName: 'card-outline', label: t('admin.payment-terminal') || 'Payment Terminals', description: `${paymentTerminals.length} configured` },
    { page: 'qr-settings', iconName: 'qr-code-outline', label: t('admin.qr-settings') || 'QR Settings', description: settings?.qr_mode || 'regenerate' },
    { page: 'staff-links', iconName: 'key-outline', label: 'Staff & Kitchen Links', description: 'QR codes for staff login' },
    { page: 'coupons', iconName: 'pricetag-outline', label: t('admin.coupons') || 'Coupons', description: `${coupons.length} coupons` },
    { page: 'variant-presets', iconName: 'pricetags-outline', label: 'Variant Presets', description: `${variantPresets.length} presets` },
    { page: 'addon-presets', iconName: 'layers-outline', label: t('admin.addon-presets') || 'Addon Presets', description: `${addonPresets.length} presets` },
    ...(isSuperadmin ? [{ page: 'users' as SettingsPage, iconName: 'people-circle-outline' as keyof typeof Ionicons.glyphMap, label: 'Users & Restaurants', description: 'Manage users & roles' }] : []),
  ];

  // Sub-page header
  const renderSubPageHeader = (title: string) => (
    <View style={styles.subPageHeader}>
      <TouchableOpacity onPress={navigateBack} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={20} color="#4f46e5" />
        <Text style={styles.backBtnText}> Back</Text>
      </TouchableOpacity>
      <Text style={styles.subPageTitle}>{title}</Text>
      <View style={{ width: 60 }} />
    </View>
  );

  // Language selection page
  const renderLanguagePage = () => (
    <View style={styles.container}>
      {renderSubPageHeader(t('admin.language') || 'Language')}
      <View style={{ padding: 16 }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.language') || 'Select Language'}</Text>
          {(['en', 'zh'] as const).map((langOption) => (
            <TouchableOpacity
              key={langOption}
              style={[styles.option, lang === langOption && styles.optionActive]}
              onPress={async () => {
                await setLanguage(langOption);
              }}
            >
              <Text style={[styles.optionText, lang === langOption && styles.optionTextActive]}>
                {langOption === 'en' ? 'English' : '中文'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  // Restaurant info page
  const renderRestaurantInfoPage = () => (
    <View style={styles.container}>
      {renderSubPageHeader(t('admin.restaurant-info') || 'Restaurant Info')}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Restaurant Information</Text>
            {!editMode && (
              <TouchableOpacity
                onPress={() => {
                  setFormData(settings);
                  setEditMode(true);
                }}
              >
                <Text style={styles.editBtn}>{t('common.edit')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {renderRestaurantInfoContent()}
        </View>
      </ScrollView>
    </View>
  );

  // Restaurant info content helper
  const renderRestaurantInfoContent = () => {
    if (editMode && formData) {
      return (
        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('admin.restaurant-name')}</Text>
            <TextInput style={styles.input} value={formData.name} onChangeText={(text) => setFormData({ ...formData, name: text })} placeholder="Enter restaurant name" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={formData.phone} onChangeText={(text) => setFormData({ ...formData, phone: text })} placeholder="Enter phone number" keyboardType="phone-pad" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput style={[styles.input, { minHeight: 80 }]} value={formData.address} onChangeText={(text) => setFormData({ ...formData, address: text })} placeholder="Enter address" multiline />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Timezone</Text>
            <TextInput style={styles.input} value={formData.timezone} onChangeText={(text) => setFormData({ ...formData, timezone: text })} placeholder="e.g., UTC, EST, PST" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Preferred Language</Text>
            <TextInput style={styles.input} value={formData.language_preference} onChangeText={(text) => setFormData({ ...formData, language_preference: text })} placeholder="e.g., en, es, fr" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('admin.service-charge')} (%)</Text>
            <TextInput style={styles.input} value={formData.service_charge_percent?.toString() || '0'} onChangeText={(text) => setFormData({ ...formData, service_charge_percent: parseFloat(text) || 0 })} placeholder="0" keyboardType="decimal-pad" inputAccessoryViewID="numpadDone" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Logo URL</Text>
            <TextInput style={styles.input} value={formData.logo_url || ''} onChangeText={(text) => setFormData({ ...formData, logo_url: text })} placeholder="https://..." />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Background URL</Text>
            <TextInput style={styles.input} value={formData.background_url || ''} onChangeText={(text) => setFormData({ ...formData, background_url: text })} placeholder="https://..." />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Booking Time Allowance (minutes)</Text>
            <TextInput style={styles.input} value={formData.booking_time_allowance_mins?.toString() || '30'} onChangeText={(text) => setFormData({ ...formData, booking_time_allowance_mins: parseInt(text) || 30 })} keyboardType="number-pad" inputAccessoryViewID="numpadDone" />
          </View>
          <View style={styles.formActions}>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => { setEditMode(false); setFormData(settings); }}>
              <Text style={styles.btnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={saveSettings}>
              <Text style={styles.btnText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    if (settings) {
      return (
        <>
          <View style={styles.settingItem}><Text style={styles.label}>{t('common.name')}</Text><Text style={styles.value}>{settings.name}</Text></View>
          <View style={styles.settingItem}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{settings.phone || '—'}</Text></View>
          <View style={styles.settingItem}><Text style={styles.label}>Address</Text><Text style={styles.value}>{settings.address || '—'}</Text></View>
          <View style={styles.settingItem}><Text style={styles.label}>Timezone</Text><Text style={styles.value}>{settings.timezone || 'UTC'}</Text></View>
          <View style={styles.settingItem}><Text style={styles.label}>Preferred Language</Text><Text style={styles.value}>{settings.language_preference || '—'}</Text></View>
          <View style={styles.settingItem}><Text style={styles.label}>Service Charge</Text><Text style={styles.value}>{settings.service_charge_percent || 0} %</Text></View>
          {settings.logo_url && (<View style={styles.settingItem}><Text style={styles.label}>Logo</Text><Text style={styles.value}>Uploaded</Text></View>)}
          {settings.background_url && (<View style={styles.settingItem}><Text style={styles.label}>Background</Text><Text style={styles.value}>Uploaded</Text></View>)}
        </>
      );
    }
    return null;
  };

  // Printer page
  const renderPrinterPage = () => {
    const configurePrinter = (type: 'qr' | 'bill' | 'kitchen' | 'kpay') => {
      const p = printerSettings;
      setEditingPrinterType(type);
      setShowingPrinterSettingsPage(true);
      setPrinterFormData({
        printer_type: p?.[`${type}_printer_type`] || 'none',
        printer_host: p?.[`${type}_printer_host`],
        printer_port: p?.[`${type}_printer_port`],
        bluetooth_device_id: p?.[`${type}_bluetooth_device_id`],
        bluetooth_device_name: p?.[`${type}_bluetooth_device_name`],
        [`${type}_auto_print`]: p?.[`${type}_auto_print`],
      } as PrinterSettings);
    };

    const printerCards: { type: 'qr' | 'bill' | 'kitchen' | 'kpay'; label: string; bg: string; border: string }[] = [
      { type: 'qr', label: 'QR Code Printer', bg: '#f0f9ff', border: '#93c5fd' },
      { type: 'bill', label: 'Bill Printer', bg: '#fef3c7', border: '#fcd34d' },
      { type: 'kitchen', label: 'Kitchen Order Printer', bg: '#fce7f3', border: '#fbcfe8' },
      { type: 'kpay', label: 'KPay Receipt Printer', bg: '#ecfdf5', border: '#6ee7b7' },
    ];

    return (
      <View style={styles.container}>
        {renderSubPageHeader(t('admin.printer-settings') || 'Printers')}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Printer Configuration</Text>
            {printerCards.map(({ type, label, bg, border }) => {
              const pType = printerSettings?.[`${type}_printer_type`];
              const pHost = printerSettings?.[`${type}_printer_host`];
              const pPort = printerSettings?.[`${type}_printer_port`];
              const btName = printerSettings?.[`${type}_bluetooth_device_name`];
              return (
                <View key={type} style={{ backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 8, padding: 14, marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 6 }}>{label}</Text>
                  {pType ? (
                    <>
                      <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Type: {getPrinterTypeLabel(pType)}</Text>
                      {btName && <Text style={{ fontSize: 12, color: '#059669', marginBottom: 2 }}>✓ {btName}</Text>}
                      {pHost && <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{pHost}:{pPort}</Text>}
                    </>
                  ) : (
                    <Text style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Not configured</Text>
                  )}
                  <TouchableOpacity style={[styles.btn, styles.btnPrimary, { paddingVertical: 8 }]} onPress={() => configurePrinter(type)}>
                    <Text style={styles.btnText}>Configure</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <TouchableOpacity
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4 }}
              onPress={() => setShowingPrinterSettingsPage(true)}
            >
              <Text style={styles.label}>Format Settings (QR & Bill)</Text>
              <Text style={{ fontSize: 18, color: '#6b7280' }}>→</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  // Payment terminals page
  const renderPaymentTerminalsPage = () => (
    <View style={styles.container}>
      {renderSubPageHeader(t('admin.payment-terminal') || 'Payment Terminals')}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin.payment-terminal')}</Text>
            <TouchableOpacity style={[styles.btn, styles.btnSmall, styles.btnPrimary]} onPress={() => { resetTerminalForm(); setShowPaymentTerminalModal(true); }}>
              <Text style={styles.btnSmallText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {paymentTerminals.length > 0 ? (
            <FlatList
              data={paymentTerminals}
              renderItem={({ item: terminal }) => (
                <View style={[styles.terminalCard, terminal.is_active && styles.terminalCardActive]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={styles.terminalVendor}>{terminal.vendor_name.toUpperCase()}</Text>
                      {terminal.is_active && (
                        <View style={{ backgroundColor: '#059669', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: 'white' }}>ACTIVE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>ID: {terminal.app_id}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{terminal.terminal_ip}:{terminal.terminal_port}</Text>
                    {terminal.last_tested_at && (<Text style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>Last tested: {new Date(terminal.last_tested_at).toLocaleDateString()}</Text>)}
                    {terminal.last_error_message && (<Text style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Error: {terminal.last_error_message}</Text>)}
                  </View>
                  <View style={{ marginLeft: 12, justifyContent: 'space-around' }}>
                    <TouchableOpacity style={[styles.btn, styles.btnSmall, styles.btnPrimary]} onPress={() => editPaymentTerminal(terminal)}>
                      <Ionicons name="create-outline" size={14} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.btnSmall, { backgroundColor: '#ef4444', marginTop: 4 }]} onPress={() => deletePaymentTerminal(terminal.id)}>
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>No payment terminals configured yet</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );

  // QR Settings page
  const renderQRSettingsPage = () => (
    <View style={styles.container}>
      {renderSubPageHeader(t('admin.qr-settings') || 'QR Settings')}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {bluetoothModal}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.qr-settings')}</Text>
          {settings && (
            <>
              <View style={styles.settingItem}>
                <Text style={styles.label}>QR Mode</Text>
                <Text style={styles.value}>
                  {settings.qr_mode === 'static_table' ? 'Static (Per Table)'
                    : settings.qr_mode === 'static_seat' ? 'Static (Per Seat)'
                    : 'Regenerate (Per Order)'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, lineHeight: 18 }}>
                {settings.qr_mode === 'static_table'
                  ? 'Each table has a fixed QR code sticker. Only one active order is allowed per table at a time. When the order is closed, the same QR code can be reused for the next customer.'
                  : settings.qr_mode === 'static_seat'
                  ? 'Each seat has its own fixed QR code sticker (e.g. T01A, T01B). When starting a new order, you select which seats are occupied. Guests scanning different seat QR codes at the same table share the same order.'
                  : 'A new QR code is generated for each order. Old QR codes become invalid when the session ends. Best for restaurants that print QR codes on receipts or table tents.'}
              </Text>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setShowQRModal(true)}>
                <Text style={styles.btnText}>Change QR Mode</Text>
              </TouchableOpacity>
              <View style={[styles.settingItem, { marginTop: 12 }]}>
                <Text style={styles.label}>Show Item Status to Diners</Text>
                <TouchableOpacity
                  style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: settings.show_item_status_to_diners ? '#10b981' : '#d1d5db', justifyContent: 'center', paddingHorizontal: 2 }}
                  onPress={async () => {
                    const newVal = !settings.show_item_status_to_diners;
                    try {
                      await apiClient.put(`/api/restaurants/${restaurantId}/settings`, { show_item_status_to_diners: newVal });
                      setSettings({ ...settings, show_item_status_to_diners: newVal });
                    } catch (err) {
                      Alert.alert('Error', 'Failed to update setting');
                    }
                  }}
                >
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignSelf: settings.show_item_status_to_diners ? 'flex-end' : 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.5, elevation: 2 }} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>When enabled, diners can see the preparation status of their items on the QR menu page</Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );

  // Staff Links page
  const renderStaffLinksPage = () => (
    <View style={styles.container}>
      {renderSubPageHeader('Staff & Kitchen Links')}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Staff & Kitchen Login QR Codes</Text>
          <Text style={styles.sectionDescription}>Share these QR codes with your staff. Each staff member scans their unique QR code to login with their PIN.</Text>
          <View style={styles.qrCodeContainer}>
            <TouchableOpacity style={styles.qrCodeButton} onPress={() => setShowStaffQRModal(true)}>
              <Text style={styles.qrCodeButtonText}>View Staff QR Code</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.qrCodeButton, styles.kitchenQRButton]} onPress={() => setShowKitchenQRModal(true)}>
              <Text style={styles.qrCodeButtonText}>View Kitchen QR Code</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.qrCodeHint}>Tap the buttons above to view the QR codes and share them with your staff.</Text>
        </View>
      </ScrollView>
    </View>
  );

  // Coupons page
  const renderCouponsPage = () => (
    <View style={styles.container}>
      {renderSubPageHeader(t('admin.coupons') || 'Coupons')}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin.coupons')}</Text>
            <TouchableOpacity style={[styles.btn, styles.btnSmall, styles.btnPrimary]} onPress={() => setShowCouponModal(true)}>
              <Text style={styles.btnSmallText}>+ New</Text>
            </TouchableOpacity>
          </View>
          {coupons.length > 0 ? (
            <FlatList
              data={coupons}
              renderItem={({ item: coupon }) => (
                <TouchableOpacity style={styles.couponCard} onPress={() => { setSelectedCoupon(coupon); setShowCouponDetailModal(true); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.couponCode}>{coupon.code}</Text>
                    <Text style={styles.couponValue}>{coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `$${coupon.discount_value}`}</Text>
                    {coupon.description && <Text style={styles.couponDesc}>{coupon.description}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>No coupons yet</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );

  // Variant Presets page
  const renderVariantPresetsPage = () => (
    <View style={styles.container}>
      {renderSubPageHeader('Variant Presets')}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Variant Presets</Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnSmall, styles.btnPrimary]}
              onPress={() => {
                Alert.prompt('Create Variant Preset', 'Enter variant title (e.g., "Drink Size", "Temperature")', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Create', onPress: (name: string | undefined) => { if (name) Alert.alert('Success', `Preset "${name}" created!`); } },
                ], 'plain-text');
              }}
            >
              <Text style={styles.btnSmallText}>+ New</Text>
            </TouchableOpacity>
          </View>
          {variantPresets.length > 0 ? (
            <FlatList
              data={variantPresets}
              renderItem={({ item: preset }) => (
                <TouchableOpacity style={styles.presetCard} onPress={() => { setSelectedVariantPreset(preset); setShowVariantPresetsModal(true); }}>
                  <View style={styles.presetCardHeader}>
                    <View>
                      <Text style={styles.presetName}>{preset.name}</Text>
                      {preset.description && <Text style={styles.presetDescription}>{preset.description}</Text>}
                    </View>
                    <View style={styles.variantBadge}>
                      <Text style={styles.variantBadgeText}>{preset.options_count || 0}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>No variant presets yet</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );

  // Addon Presets page
  const renderAddonPresetsPage = () => (
    <View style={styles.container}>
      {renderSubPageHeader(t('admin.addon-presets') || 'Addon Presets')}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin.addon-presets') || 'Addon Presets'}</Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnSmall, styles.btnPrimary]}
              onPress={() => {
                Alert.prompt('Create Addon Preset', 'Enter preset name (e.g., "Drinks Bundle", "Sides Pack")', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Create',
                    onPress: async (name: string | undefined) => {
                      if (!name) return;
                      try {
                        await apiClient.post(`/api/restaurants/${restaurantId}/addon-presets`, { name, description: '' });
                        Alert.alert('Success', `Preset "${name}" created!`);
                        fetchAddonPresets();
                      } catch (err: any) {
                        Alert.alert('Error', err.response?.data?.error || 'Failed to create preset');
                      }
                    },
                  },
                ], 'plain-text');
              }}
            >
              <Text style={styles.btnSmallText}>+ New</Text>
            </TouchableOpacity>
          </View>
          {addonPresets.length > 0 ? (
            <FlatList
              data={addonPresets}
              renderItem={({ item: preset }) => (
                <View style={styles.presetCard}>
                  <View style={styles.presetCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.presetName}>{preset.name}</Text>
                      {preset.description ? <Text style={styles.presetDescription}>{preset.description}</Text> : null}
                      <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Items: {preset.items_count || 0}</Text>
                    </View>
                    <TouchableOpacity
                      style={{ padding: 6 }}
                      onPress={() => {
                        Alert.alert('Delete Preset', `Delete "${preset.name}"?`, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await apiClient.delete(`/api/restaurants/${restaurantId}/addon-presets/${preset.id}`);
                                fetchAddonPresets();
                              } catch (err: any) {
                                Alert.alert('Error', err.response?.data?.error || 'Failed to delete preset');
                              }
                            },
                          },
                        ]);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>No addon presets yet</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );

  // Profile page
  const loadProfile = async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await apiClient.getProfile();
      setProfileData(data);
      setProfileForm({
        name: data.name || '',
        email: data.email || '',
        password: '',
        pin: data.pin || '',
      });
    } catch (err: any) {
      setProfileError(err.message || 'Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileError(null);
    try {
      const payload: any = {};
      if (profileForm.name && profileForm.name !== profileData?.name) payload.name = profileForm.name;
      if (profileForm.email !== (profileData?.email || '')) payload.email = profileForm.email;
      if (profileForm.password) payload.password = profileForm.password;
      if (profileData?.role === 'staff' || profileData?.role === 'kitchen') {
        if (profileForm.pin !== (profileData?.pin || '')) payload.pin = profileForm.pin;
      }
      if (Object.keys(payload).length === 0) {
        Alert.alert('No Changes', 'No fields were modified.');
        setProfileSaving(false);
        return;
      }
      await apiClient.updateProfile(payload);
      Alert.alert('Success', 'Profile updated!');
      await loadProfile();
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const renderProfilePage = () => {
    if (profileLoading && !profileData) {
      return (
        <View style={styles.container}>
          {renderSubPageHeader('My Profile')}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {renderSubPageHeader('My Profile')}
        <ScrollView style={{ padding: 16 }}>
          {profileError && (
            <View style={{ backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 12 }}>
              <Text style={{ color: '#991b1b', fontSize: 13 }}>{profileError}</Text>
            </View>
          )}

          {/* Role Badge */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="person" size={32} color="#4f46e5" />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
              {profileData?.role || currentUser?.role || '—'}
            </Text>
          </View>

          {/* Name */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={profileForm.name}
              onChangeText={(text) => setProfileForm({ ...profileForm, name: text })}
              placeholder="Your name"
            />
          </View>

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={profileForm.email}
              onChangeText={(text) => setProfileForm({ ...profileForm, email: text })}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Password (for admin/superadmin) */}
          {(profileData?.role === 'admin' || profileData?.role === 'superadmin') && (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={profileForm.password}
                onChangeText={(text) => setProfileForm({ ...profileForm, password: text })}
                placeholder="Leave blank to keep current"
                secureTextEntry
              />
            </View>
          )}

          {/* PIN (for staff/kitchen) */}
          {(profileData?.role === 'staff' || profileData?.role === 'kitchen') && (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>PIN (6 digits)</Text>
              <TextInput
                style={styles.input}
                value={profileForm.pin}
                onChangeText={(text) => setProfileForm({ ...profileForm, pin: text })}
                placeholder="6-digit PIN"
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { marginTop: 8 }, profileSaving && { opacity: 0.6 }]}
            onPress={saveProfile}
            disabled={profileSaving}
          >
            <Text style={styles.btnText}>{profileSaving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // Card grid main page
  const renderMainPage = () => (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.cardGrid}>
        {settingsCards.map((card) => (
          <TouchableOpacity key={card.page} style={styles.settingsCard} onPress={() => navigateToPage(card.page)} activeOpacity={0.7}>
            <View style={styles.cardIconContainer}>
              <Ionicons name={card.iconName} size={26} color="#4f46e5" />
            </View>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardDescription}>{card.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.btn, styles.btnDanger, { marginVertical: 12 }]}
        onPress={() => {
          Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: () => navigation.navigate('Login'), style: 'destructive' },
          ]);
        }}
      >
        <Text style={styles.btnText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Route to sub-page content
  const renderCurrentPage = () => {
    switch (settingsPage) {
      case 'language': return renderLanguagePage();
      case 'restaurant-info': return renderRestaurantInfoPage();
      case 'printer': return renderPrinterPage();
      case 'payment-terminals': return renderPaymentTerminalsPage();
      case 'qr-settings': return renderQRSettingsPage();
      case 'staff-links': return renderStaffLinksPage();
      case 'coupons': return renderCouponsPage();
      case 'variant-presets': return renderVariantPresetsPage();
      case 'addon-presets': return renderAddonPresetsPage();
      case 'users': return <UsersTab onBack={navigateBack} />;
      case 'profile':
        if (!profileData && !profileLoading) loadProfile();
        return renderProfilePage();
      default: return renderMainPage();
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 300] }) }] }]}>
        {renderCurrentPage()}
      </Animated.View>

      {/* Coupon Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showCouponModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Coupon</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Coupon Code</Text>
              <TextInput
                style={styles.input}
                value={couponForm.code}
                onChangeText={(text) =>
                  setCouponForm({ ...couponForm, code: text.toUpperCase() })
                }
                placeholder="e.g., SAVE10"
                maxLength={50}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Discount Type</Text>
              <View style={styles.toggleGroup}>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    couponForm.discount_type === 'percentage' && styles.typeBtnActive,
                  ]}
                  onPress={() => setCouponForm({ ...couponForm, discount_type: 'percentage' })}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      couponForm.discount_type === 'percentage' && styles.typeBtnTextActive,
                    ]}
                  >
                    Percentage
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    couponForm.discount_type === 'fixed' && styles.typeBtnActive,
                  ]}
                  onPress={() => setCouponForm({ ...couponForm, discount_type: 'fixed' })}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      couponForm.discount_type === 'fixed' && styles.typeBtnTextActive,
                    ]}
                  >
                    Fixed
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Discount Value</Text>
              <TextInput
                style={styles.input}
                value={couponForm.discount_value}
                onChangeText={(text) =>
                  setCouponForm({ ...couponForm, discount_value: text })
                }
                placeholder="Amount"
                keyboardType="decimal-pad"
                inputAccessoryViewID="numpadDone"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Min Order Value (optional)</Text>
              <TextInput
                style={styles.input}
                value={couponForm.min_order_value}
                onChangeText={(text) =>
                  setCouponForm({ ...couponForm, min_order_value: text })
                }
                placeholder="Minimum order amount"
                keyboardType="decimal-pad"
                inputAccessoryViewID="numpadDone"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                value={couponForm.description}
                onChangeText={(text) =>
                  setCouponForm({ ...couponForm, description: text })
                }
                placeholder="Coupon description"
                multiline
              />
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => {
                  setShowCouponModal(false);
                  setCouponForm({
                    code: '',
                    discount_type: 'percentage',
                    discount_value: '',
                    min_order_value: '',
                    description: '',
                  });
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={createCoupon}
              >
                <Text style={styles.btnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Coupon Detail Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showCouponDetailModal && selectedCoupon !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Coupon Details</Text>
              <TouchableOpacity onPress={() => { setShowCouponDetailModal(false); setSelectedCoupon(null); }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            {selectedCoupon && (
              <View style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Code</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', letterSpacing: 1 }}>{selectedCoupon.code}</Text>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Discount</Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#059669' }}>
                    {selectedCoupon.discount_type === 'percentage' ? `${selectedCoupon.discount_value}% off` : `$${selectedCoupon.discount_value} off`}
                  </Text>
                </View>
                {selectedCoupon.min_order_value > 0 && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Minimum Order</Text>
                    <Text style={{ fontSize: 14, color: '#1f2937' }}>${selectedCoupon.min_order_value}</Text>
                  </View>
                )}
                {selectedCoupon.description ? (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Description</Text>
                    <Text style={{ fontSize: 14, color: '#6b7280' }}>{selectedCoupon.description}</Text>
                  </View>
                ) : null}
                <View style={[styles.formActions, { marginTop: 16 }]}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={() => { setShowCouponDetailModal(false); setSelectedCoupon(null); }}
                  >
                    <Text style={styles.btnText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: '#fee2e2' }]}
                    onPress={() => {
                      Alert.alert('Delete Coupon', `Delete coupon "${selectedCoupon.code}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: async () => {
                          await deleteCoupon(selectedCoupon.id);
                          setShowCouponDetailModal(false);
                          setSelectedCoupon(null);
                        }},
                      ]);
                    }}
                  >
                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 13 }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Payment Terminal Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showPaymentTerminalModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: 0 }]}>
            <Text style={styles.modalTitle}>
              {editingTerminalId ? 'Edit Payment Terminal' : 'Add Payment Terminal'}
            </Text>

            <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Text style={styles.label}>Payment Vendor</Text>
              <View>
                {(['kpay', 'payment-asia', 'other'] as const).map((vendor) => (
                  <TouchableOpacity
                    key={vendor}
                    style={{ paddingVertical: 8 }}
                    onPress={() => setTerminalForm({ ...terminalForm, vendor_name: vendor })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          borderWidth: 2,
                          borderColor: terminalForm.vendor_name === vendor ? '#3b82f6' : '#d1d5db',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        {terminalForm.vendor_name === vendor && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' }} />
                        )}
                      </View>
                      <Text style={{ marginLeft: 10, fontSize: 14, color: '#1f2937', fontWeight: '500' }}>
                        {vendor === 'kpay' ? 'KPay' : vendor === 'payment-asia' ? 'Payment Asia' : 'Other'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* App ID */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>App ID / Terminal ID</Text>
              <TextInput
                style={styles.input}
                value={terminalForm.app_id}
                onChangeText={(text) => setTerminalForm({ ...terminalForm, app_id: text })}
                placeholder="Enter app ID"
              />
            </View>

            {/* App Secret */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>App Secret / Token</Text>
              <TextInput
                style={styles.input}
                value={terminalForm.app_secret}
                onChangeText={(text) => setTerminalForm({ ...terminalForm, app_secret: text })}
                placeholder="Enter app secret"
                secureTextEntry
              />
            </View>

            {/* Terminal IP - KPay only */}
            {terminalForm.vendor_name === 'kpay' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Terminal IP Address</Text>
                  <TextInput
                    style={styles.input}
                    value={terminalForm.terminal_ip}
                    onChangeText={(text) => setTerminalForm({ ...terminalForm, terminal_ip: text })}
                    placeholder="e.g., 192.168.50.210"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Terminal Port</Text>
                  <TextInput
                    style={styles.input}
                    value={terminalForm.terminal_port}
                    onChangeText={(text) => setTerminalForm({ ...terminalForm, terminal_port: text })}
                    placeholder="e.g., 18080"
                    keyboardType="number-pad"
                    inputAccessoryViewID="numpadDone"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>API Endpoint Path</Text>
                  <TextInput
                    style={styles.input}
                    value={terminalForm.endpoint_path}
                    onChangeText={(text) => setTerminalForm({ ...terminalForm, endpoint_path: text })}
                    placeholder="e.g., /v2/pos/sign"
                  />
                </View>
              </>
            )}

            {/* Payment Asia fields */}
            {terminalForm.vendor_name === 'payment-asia' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Merchant Token</Text>
                  <TextInput
                    style={styles.input}
                    value={terminalForm.merchant_token}
                    onChangeText={(text) => setTerminalForm({ ...terminalForm, merchant_token: text })}
                    placeholder="Enter merchant token"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Secret Code</Text>
                  <TextInput
                    style={styles.input}
                    value={terminalForm.secret_code}
                    onChangeText={(text) => setTerminalForm({ ...terminalForm, secret_code: text })}
                    placeholder="Enter secret code"
                    secureTextEntry
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Environment</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    {(['sandbox', 'production'] as const).map((env) => (
                      <TouchableOpacity
                        key={env}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 16,
                          borderRadius: 6,
                          backgroundColor: terminalForm.environment === env ? '#3b82f6' : '#f3f4f6',
                        }}
                        onPress={() => setTerminalForm({ ...terminalForm, environment: env })}
                      >
                        <Text style={{
                          color: terminalForm.environment === env ? '#fff' : '#374151',
                          fontSize: 13,
                          fontWeight: '600',
                        }}>
                          {env.charAt(0).toUpperCase() + env.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Test Result */}
            {terminalTestResult && (
              <View style={[styles.formGroup, {
                borderRadius: 6,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: terminalTestResult.success ? '#ecfdf5' : '#fef2f2',
                borderWidth: 1,
                borderColor: terminalTestResult.success ? '#86efac' : '#fecaca'
              }]}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: terminalTestResult.success ? '#059669' : '#dc2626',
                  marginBottom: 4
                }}>
                  {terminalTestResult.success ? 'Connection Successful' : 'Connection Failed'}
                </Text>
                <Text style={{ fontSize: 12, color: '#1f2937' }}>
                  {terminalTestResult.message}
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            </ScrollView>
            <View style={[styles.formActions, { paddingVertical: 12 }]}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => {
                  setShowPaymentTerminalModal(false);
                  resetTerminalForm();
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              
              {editingTerminalId && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnSmall, { backgroundColor: '#f59e0b', flex: 1 }]}
                  onPress={testPaymentTerminal}
                  disabled={testingTerminal}
                >
                  <Text style={styles.btnText}>{testingTerminal ? 'Testing...' : 'Test'}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={savePaymentTerminal}
              >
                <Text style={styles.btnText}>{editingTerminalId ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Mode Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showQRModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select QR Mode</Text>

            {([
              { mode: 'regenerate' as const, label: 'Regenerate (Per Order)', desc: 'A new QR code is generated for each order. Old codes expire when the session ends. Best for printed receipts or table tents.' },
              { mode: 'static_table' as const, label: 'Static (Per Table)', desc: 'Each table has a fixed QR code sticker. Only one active order per table at a time.' },
              { mode: 'static_seat' as const, label: 'Static (Per Seat)', desc: 'Each seat has its own QR sticker (e.g. T01A, T01B). Select occupied seats when starting an order. Guests at the same table share one order.' },
            ]).map(({ mode, label, desc }) => (
              <TouchableOpacity
                key={mode}
                style={[styles.option, settings?.qr_mode === mode && styles.optionActive]}
                onPress={async () => {
                  try {
                    await apiClient.patch(`/api/restaurants/${restaurantId}/settings`, {
                      qr_mode: mode,
                    });
                    setSettings({ ...settings!, qr_mode: mode });
                    setShowQRModal(false);
                    Alert.alert('Success', 'QR mode updated!');
                  } catch {
                    Alert.alert('Error', 'Failed to update QR mode');
                  }
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    settings?.qr_mode === mode && styles.optionTextActive,
                  ]}
                >
                  {label}
                </Text>
                <Text style={{ fontSize: 11, color: settings?.qr_mode === mode ? 'rgba(255,255,255,0.8)' : '#9ca3af', marginTop: 4, lineHeight: 16 }}>
                  {desc}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, { marginTop: 12 }]}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Staff QR Code Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showStaffQRModal} transparent animationType="slide">
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Staff Login QR Code</Text>
              <TouchableOpacity onPress={() => setShowStaffQRModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrModalBody}>
              <Text style={styles.qrModalDescription}>
                Table staff can scan this QR code to access the staff login. Share this code with your table staff members.
              </Text>

              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={generateStaffQRUrl()}
                  size={200}
                  color="#2C3E50"
                  backgroundColor="#fff"
                />
              </View>

              <Text style={styles.qrModalUrl}>{generateStaffQRUrl()}</Text>

              <View style={styles.qrActionButtons}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => shareQRCode('staff')}
                >
                  <Text style={styles.btnText}>Share QR Code</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => setShowStaffQRModal(false)}
            >
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Kitchen QR Code Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showKitchenQRModal} transparent animationType="slide">
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Kitchen Login QR Code</Text>
              <TouchableOpacity onPress={() => setShowKitchenQRModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrModalBody}>
              <Text style={styles.qrModalDescription}>
                Kitchen staff can scan this QR code to access the kitchen dashboard. Share this code with your kitchen staff members.
              </Text>

              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={generateKitchenQRUrl()}
                  size={200}
                  color="#2C3E50"
                  backgroundColor="#fff"
                />
              </View>

              <Text style={styles.qrModalUrl}>{generateKitchenQRUrl()}</Text>

              <View style={styles.qrActionButtons}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => shareQRCode('kitchen')}
                >
                  <Text style={styles.btnText}>Share QR Code</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => setShowKitchenQRModal(false)}
            >
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Variant Presets Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showVariantPresetsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Variant Presets</Text>
              <TouchableOpacity onPress={() => setShowVariantPresetsModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedVariantPreset ? (
              <>
                <ScrollView style={styles.presetDetailScroll}>
                  <View style={styles.modalBody}>
                    <Text style={styles.presetDetailTitle}>{selectedVariantPreset.name}</Text>
                    {selectedVariantPreset.description && (
                      <Text style={styles.presetDetailDesc}>{selectedVariantPreset.description}</Text>
                    )}

                    <TouchableOpacity
                      style={[styles.btn, styles.btnPrimary, { marginBottom: 16 }]}
                      onPress={() => {
                        // Show create option dialog
                        Alert.prompt(
                          'Add New Option',
                          'Enter option name (e.g., "Small", "Medium", "Large")',
                          [
                            {
                              text: 'Cancel',
                              style: 'cancel',
                            },
                            {
                              text: 'Add',
                              onPress: (name: string | undefined) => {
                                if (name) {
                                  Alert.alert('Success', `Option "${name}" added to "${selectedVariantPreset.name}"`);
                                }
                              },
                            },
                          ],
                          'plain-text'
                        );
                      }}
                    >
                      <Text style={styles.btnText}>+ Add Option</Text>
                    </TouchableOpacity>

                    <Text style={styles.variantsLabel}>Options in "{selectedVariantPreset.name}":</Text>
                    {selectedVariantPreset.variants && selectedVariantPreset.variants.length > 0 ? (
                      selectedVariantPreset.variants.map((option, idx) => (
                        <View key={idx} style={styles.variantDetailItem}>
                          <View style={styles.variantDetailContent}>
                            <Text style={styles.variantDetailName}>{option.name}</Text>
                            {option.price_cents && option.price_cents > 0 && (
                              <Text style={styles.variantDetailMeta}>
                                +${(option.price_cents / 100).toFixed(2)}
                              </Text>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6, marginLeft: 10 }}>
                            <TouchableOpacity
                              style={[styles.btn, styles.btnSmall, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}
                              onPress={() => Alert.alert('Edit', `Edit option: ${option.name}`)}
                            >
                              <Text style={[styles.btnSmallText, { color: '#1e40af' }]}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.btn, styles.btnSmall, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}
                              onPress={() =>
                                Alert.alert(
                                  'Delete',
                                  `Delete option "${option.name}"?`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Delete', style: 'destructive', onPress: () => {} },
                                  ]
                                )
                              }
                            >
                              <Text style={[styles.btnSmallText, { color: '#991b1b' }]}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No options yet. Click "Add Option" to add one.</Text>
                    )}
                  </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={() => setSelectedVariantPreset(null)}
                  >
                    <Text style={styles.btnText}>Back</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <ScrollView style={styles.presetsListScroll}>
                  <View style={styles.modalBody}>
                    {variantPresets.length > 0 ? (
                      variantPresets.map((preset) => (
                        <TouchableOpacity
                          key={preset.id}
                          style={styles.presetListItem}
                          onPress={() => setSelectedVariantPreset(preset)}
                        >
                          <View>
                            <Text style={styles.presetListName}>{preset.name}</Text>
                            {preset.description && (
                              <Text style={styles.presetListDesc}>{preset.description}</Text>
                            )}
                          </View>
                          <View style={styles.presetListBadge}>
                            <Text style={styles.presetListBadgeText}>{preset.variants_count}</Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>No variant presets created yet</Text>
                    )}
                  </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={() => setShowVariantPresetsModal(false)}
                  >
                    <Text style={styles.btnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Done button for iOS number-pad */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="numpadDone">
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: '#f1f1f1', borderTopWidth: 1, borderTopColor: '#ccc', paddingHorizontal: 12, paddingVertical: 6 }}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#007AFF' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  // Card grid styles
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  settingsCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 110,
  },
  cardIconContainer: {
    marginBottom: 8,
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  // Sub-page header styles
  subPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4f46e5',
  },
  subPageTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  printerPageTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  backButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  editBtn: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 13,
  },
  settingItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 10,
  },
  label: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  form: {
    gap: 12,
  },
  formGroup: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  displayValue: {
    fontSize: 13,
    color: '#2C3E50',
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    overflow: 'hidden',
  },
  printerTypeButtons: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  typeButton: {
    flex: 0.45,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  typeButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  typeButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 12,
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  toggleGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  btnPrimary: {
    backgroundColor: '#3b82f6',
  },
  btnSecondary: {
    backgroundColor: '#e5e7eb',
  },
  btnDanger: {
    backgroundColor: '#dc2626',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  btnSmallText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  qrCodeContainer: {
    flexDirection: 'column',
    gap: 12,
    marginVertical: 12,
  },
  qrCodeButton: {
    backgroundColor: '#2C3E50',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kitchenQRButton: {
    backgroundColor: '#2C3E50',
  },
  qrCodeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  qrCodeHint: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  couponCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  couponCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  couponValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 4,
  },
  couponDesc: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  terminalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#f3f4f6',
    padding: 14,
    marginBottom: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  terminalCardActive: {
    borderLeftColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  terminalVendor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  presetCard: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    elevation: 1,
  },
  presetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  presetName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  presetDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  variantBadge: {
    backgroundColor: '#dbeafe',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    minWidth: 35,
    alignItems: 'center',
  },
  variantBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  presetListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  presetListName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  presetListDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  presetListBadge: {
    backgroundColor: '#dbeafe',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  presetListBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  presetDetailScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  presetsListScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  presetDetailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  presetDetailDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
  },
  variantsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  variantDetailItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  variantDetailContent: {
    flex: 1,
  },
  variantDetailName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  requiredBadge: {
    color: '#dc2626',
    fontWeight: '900',
  },
  variantDetailMeta: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  variantDetailFrom: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  variantDetailRequired: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600',
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  errorText: {
    color: '#c33',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 24,
    flex: 1,
    maxHeight: '95%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 0,
    color: '#1f2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 12,
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
    fontWeight: '300',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  typeBtnActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  typeBtnText: {
    color: '#6b7280',
    fontWeight: '500',
    fontSize: 13,
  },
  typeBtnTextActive: {
    color: '#fff',
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  optionActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  optionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#3b82f6',
  },
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingTop: 50,
  },
  qrModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 'auto',
    maxHeight: '90%',
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  qrModalBody: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrModalDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  qrCodeWrapper: {
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalUrl: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Courier New',
  },
  qrActionButtons: {
    width: '100%',
  },
  printerListContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  printerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  printerItemContent: {
    flex: 1,
  },
  printerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  printerIP: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'Courier New',
  },
  selectArrow: {
    fontSize: 20,
    color: '#3b82f6',
    marginLeft: 16,
  },
  connectedDeviceBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
