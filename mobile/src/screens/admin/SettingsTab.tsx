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
import QRCode from 'react-native-qrcode-svg';
import { BleManager } from 'react-native-ble-plx';
import { apiClient, ENVIRONMENTS } from '../../services/apiClient';
import { useTranslation } from '../../contexts/TranslationContext';
import { printerSettingsService } from '../../services/printerSettingsService';
import { Ionicons } from '@expo/vector-icons';
import { UsersTab } from './UsersTab';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../hooks/useAuth';
import { Linking } from 'react-native';
import { paTerminalPing, paTerminalSign } from '../../services/paTerminalDirectService';
import { TIMEZONE_OPTIONS } from '../../constants/timezones';

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
  minimum_order_value?: number;
  max_uses?: number;
  description?: string;
  coupon_type?: 'open' | 'closed';
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
  vendor_name: 'kpay' | 'payment-asia' | 'payment-asia-offline' | 'other';
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
  // Payment Asia (Online) fields
  merchant_token?: string;
  secret_code?: string;
  environment?: 'sandbox' | 'production';
  payment_gateway_env?: 'sandbox' | 'production';
}

interface CrmCustomer {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  total_visits?: number;
  total_spent_cents?: number;
  last_visit_at?: string | null;
  created_at?: string;
}

interface CrmOrder {
  order_id: number;
  restaurant_order_number?: number | null;
  status?: string;
  payment_method?: string | null;
  created_at: string;
  order_type?: string | null;
  session_id?: number | null;
  linked_booking_id?: number | null;
  table_label?: string | null;
  pax?: number | null;
  discount_applied?: number | null;
  total_cents?: number;
}

interface CrmBooking {
  id: number;
  guest_name: string;
  phone?: string | null;
  pax: number;
  booking_date: string;
  booking_time?: string | null;
  status: string;
  notes?: string | null;
  table_label?: string | null;
  session_id?: number | null;
  session_total_cents?: number | null;
}

interface CrmCustomerProfile {
  customer: CrmCustomer;
  orders: CrmOrder[];
  total_transacted_cents: number;
  past_bookings: CrmBooking[];
  future_bookings: CrmBooking[];
  eligible_coupons?: Array<{
    id: number;
    code: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    minimum_order_value?: number;
    coupon_type?: 'open' | 'closed';
    valid_until?: string | null;
  }>;
}

export const SettingsTab = ({ restaurantId, navigation }: any) => {
  const CRM_PAGE_SIZE = 30;
  const { t, lang, setLanguage } = useTranslation();
  const { user: currentUser, logout: authLogout } = useAuth();
  const isSuperadmin = currentUser?.role === 'superadmin';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [variantPresets, setVariantPresets] = useState<VariantPreset[]>([]);
  const [addonPresets, setAddonPresets] = useState<any[]>([]);
  const [paymentTerminals, setPaymentTerminals] = useState<PaymentTerminal[]>([]);
  const [crmCount, setCrmCount] = useState<number | null>(null);
  const [crmCustomers, setCrmCustomers] = useState<CrmCustomer[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmLoadingMore, setCrmLoadingMore] = useState(false);
  const [crmSearchInput, setCrmSearchInput] = useState('');
  const [crmSearchTerm, setCrmSearchTerm] = useState('');
  const [crmSortBy, setCrmSortBy] = useState<'last_visit' | 'total_spent' | 'total_orders' | 'created_at'>('last_visit');
  const [crmOffset, setCrmOffset] = useState(0);
  const [crmHasMore, setCrmHasMore] = useState(false);
  const [crmProfileLoading, setCrmProfileLoading] = useState(false);
  const [selectedCrmProfile, setSelectedCrmProfile] = useState<CrmCustomerProfile | null>(null);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [crmOrderDetail, setCrmOrderDetail] = useState<any | null>(null);
  const [crmOrderDetailLoading, setCrmOrderDetailLoading] = useState(false);
  const [crmSyncing, setCrmSyncing] = useState(false);

  // Dev environment switcher (hidden by default)
  const [devTapCount, setDevTapCount] = useState(0);
  const [showDevMenu, setShowDevMenu] = useState(false);
  const [currentEnv, setCurrentEnv] = useState(apiClient.getCurrentBaseUrl());
  const devTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDevTap = () => {
    const newCount = devTapCount + 1;
    setDevTapCount(newCount);
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    devTapTimer.current = setTimeout(() => setDevTapCount(0), 2000);
    if (newCount >= 7) {
      setShowDevMenu(!showDevMenu);
      setDevTapCount(0);
    }
  };

  const switchEnv = async (name: string, url: string) => {
    Alert.alert(
      'Switch Environment',
      `Switch to ${name} (${url})?\n\nYou will be logged out.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.switchEnvironment(url);
              setCurrentEnv(url);
              await authLogout();
            } catch (e) {
              console.error('Env switch error:', e);
              await authLogout();
            }
          },
        },
      ]
    );
  };

  // Settings page navigation
  type SettingsPage = 'main' | 'restaurant-info' | 'printer' | 'payment-terminals' | 'qr-settings' | 'staff-links' | 'coupons' | 'variant-presets' | 'addon-presets' | 'language' | 'users' | 'profile' | 'menu-settings' | 'crm' | 'feature-flags' | 'service-requests';

  interface SRItem {
    id: number;
    request_type: string;
    label_en: string;
    label_zh?: string;
    is_active: boolean;
    sort_order: number;
    color?: string;
    image_url?: string;
  }
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
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '', confirmPassword: '', pin: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [editingPrinterType, setEditingPrinterType] = useState<'qr' | 'bill' | 'kitchen' | 'kpay' | null>(null);
  const [bluetoothSearching, setBluetoothSearching] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<Array<{ id: string; name: string; signal: number }>>([]);
  // Modal state: 'printer' | 'bluetooth' | null
  const [activeModal, setActiveModal] = useState<'printer' | 'bluetooth' | null>(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<number | null>(null);
  const [showPaymentTerminalModal, setShowPaymentTerminalModal] = useState(false);
  const [editingTerminalId, setEditingTerminalId] = useState<number | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
  const [showCouponDetailModal, setShowCouponDetailModal] = useState(false);
  // CRM coupon assignment
  const [showAssignCouponModal, setShowAssignCouponModal] = useState(false);
  const [assignCouponCustomerId, setAssignCouponCustomerId] = useState<number | null>(null);
  const [showVariantPresetsModal, setShowVariantPresetsModal] = useState(false);
  const [selectedVariantPreset, setSelectedVariantPreset] = useState<VariantPreset | null>(null);
  const [selectedAddonPreset, setSelectedAddonPreset] = useState<any>(null);
  const [addonPresetItems, setAddonPresetItems] = useState<any[]>([]);
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  // Menu settings state
  const [menuSettingsLoading, setMenuSettingsLoading] = useState(false);
  const [menuSettingsLoaded, setMenuSettingsLoaded] = useState(false);
  const [menuColumns, setMenuColumns] = useState<1 | 2>(1);
  const [allowCustomFoodItems, setAllowCustomFoodItems] = useState(false);
  const [customItemLabel, setCustomItemLabel] = useState('');
  // Feature flags (module enable/disable)
  const [moduleFlags, setModuleFlags] = useState<Record<string, boolean>>({});
  const [moduleFlagsLoading, setModuleFlagsLoading] = useState(false);
  const [moduleFlagsLoaded, setModuleFlagsLoaded] = useState(false);

  // Service requests configuration
  const [srItems, setSrItems] = useState<SRItem[]>([]);
  const [srLoading, setSrLoading] = useState(false);
  const [srLoaded, setSrLoaded] = useState(false);
  const [showSrModal, setShowSrModal] = useState(false);
  const [editingSrItem, setEditingSrItem] = useState<SRItem | null>(null);
  const [srLabelEn, setSrLabelEn] = useState('');
  const [srLabelZh, setSrLabelZh] = useState('');
  const [srRequestType, setSrRequestType] = useState('');
  const [srColor, setSrColor] = useState('#4f46e5');
  const [srIsActive, setSrIsActive] = useState(true);
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
  const [showSettingsTzPicker, setShowSettingsTzPicker] = useState(false);
  const [settingsTzSearch, setSettingsTzSearch] = useState('');
  const [printerFormData, setPrinterFormData] = useState<PrinterSettings | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    min_order_value: '',
    description: '',
    coupon_type: 'open' as 'open' | 'closed',
  });
  const [terminalForm, setTerminalForm] = useState({
    vendor_name: 'kpay' as 'kpay' | 'payment-asia' | 'payment-asia-offline' | 'other',
    app_id: '',
    app_secret: '',
    terminal_ip: '192.168.50.210',
    terminal_port: '18080',
    endpoint_path: '/v2/pos/sign',
    merchant_token: '',
    secret_code: '',
    environment: 'sandbox' as 'sandbox' | 'production',
    // PA Offline fields
    pa_offline_ip: '',
    pa_offline_port: '8080',
    pa_offline_api_key: '',
  });
  const [testingTerminal, setTestingTerminal] = useState(false);
  const [terminalTestResult, setTerminalTestResult] = useState<any>(null);

  // Payment terminal application form (for non-superadmin users)
  const [applicationForm, setApplicationForm] = useState({
    company_name: '',
    contact_number: '',
    contact_email: '',
    br_license_no: '',
  });
  const [brCertificateUri, setBrCertificateUri] = useState<string | null>(null);
  const [restaurantLicenseUri, setRestaurantLicenseUri] = useState<string | null>(null);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [existingApplications, setExistingApplications] = useState<any[]>([]);

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

  const fetchTerminalApplications = async () => {
    try {
      const apps = await apiClient.getTerminalApplications(parseInt(String(restaurantId)));
      setExistingApplications(apps);
    } catch (err: any) {
      console.warn('[Settings] Failed to fetch terminal applications:', err.message);
      setExistingApplications([]);
    }
  };

  const pickDocument = async (type: 'br_certificate' | 'restaurant_license') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (type === 'br_certificate') {
          setBrCertificateUri(asset.uri);
        } else {
          setRestaurantLicenseUri(asset.uri);
        }
      }
    } catch (err) {
      console.error('Document picker error:', err);
    }
  };

  const handleSubmitApplication = async () => {
    const { company_name, contact_number, contact_email, br_license_no } = applicationForm;
    if (!company_name.trim() || !contact_number.trim() || !contact_email.trim() || !br_license_no.trim()) {
      Alert.alert(t('common.error'), t('admin.terminal-app-fields-required'));
      return;
    }

    setSubmittingApplication(true);
    try {
      const formData = new FormData();
      formData.append('company_name', company_name.trim());
      formData.append('contact_number', contact_number.trim());
      formData.append('contact_email', contact_email.trim());
      formData.append('br_license_no', br_license_no.trim());

      if (brCertificateUri) {
        const filename = brCertificateUri.split('/').pop() || 'br_certificate.pdf';
        formData.append('br_certificate', {
          uri: brCertificateUri,
          name: filename,
          type: 'application/pdf',
        } as any);
      }
      if (restaurantLicenseUri) {
        const filename = restaurantLicenseUri.split('/').pop() || 'restaurant_license.pdf';
        formData.append('restaurant_license', {
          uri: restaurantLicenseUri,
          name: filename,
          type: 'application/pdf',
        } as any);
      }

      await apiClient.submitTerminalApplication(parseInt(String(restaurantId)), formData);
      Alert.alert(t('common.success'), t('admin.terminal-app-submitted'));
      setApplicationForm({ company_name: '', contact_number: '', contact_email: '', br_license_no: '' });
      setBrCertificateUri(null);
      setRestaurantLicenseUri(null);
      await fetchTerminalApplications();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('admin.terminal-app-failed'));
    } finally {
      setSubmittingApplication(false);
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

  const syncCrmFromBookings = async () => {
    try {
      setCrmSyncing(true);
      const res = await apiClient.post(`/api/restaurants/${restaurantId}/crm/sync-from-bookings`);
      const { inserted, total } = res.data;
      setCrmCount(total);
      Alert.alert('Sync Complete', `Imported ${inserted} new customer${inserted === 1 ? '' : 's'} from bookings. Total: ${total}.`);
      fetchCrmCustomers({ offset: 0, append: false, search: crmSearchTerm, sortBy: crmSortBy });
    } catch (err: any) {
      Alert.alert('Sync Failed', err.response?.data?.error || 'Failed to sync customers from bookings');
    } finally {
      setCrmSyncing(false);
    }
  };

  const fetchCrmCount = async () => {
    try {
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/crm/count`);
      setCrmCount(typeof res.data?.total === 'number' ? res.data.total : 0);
    } catch (err: any) {
      console.warn('[Settings] Failed to fetch CRM count:', err.message);
      setCrmCount(0);
    }
  };

  const fetchCrmCustomers = async ({
    offset = 0,
    append = false,
    search = crmSearchTerm,
    sortBy = crmSortBy,
  }: {
    offset?: number;
    append?: boolean;
    search?: string;
    sortBy?: 'last_visit' | 'total_spent' | 'total_orders' | 'created_at';
  } = {}) => {
    try {
      setCrmError(null);
      if (append) {
        setCrmLoadingMore(true);
      } else {
        setCrmLoading(true);
      }

      const params = new URLSearchParams({
        limit: String(CRM_PAGE_SIZE),
        offset: String(offset),
        sort_by: sortBy,
      });

      if (search.trim()) {
        params.set('search', search.trim());
      }

      const res = await apiClient.get(`/api/restaurants/${restaurantId}/crm/customers?${params.toString()}`);
      const rows: CrmCustomer[] = Array.isArray(res.data) ? res.data : [];

      setCrmCustomers((prev) => (append ? [...prev, ...rows] : rows));
      setCrmOffset(offset + rows.length);
      setCrmHasMore(rows.length >= CRM_PAGE_SIZE);

      if (!search.trim()) {
        setCrmCount((prev) => (prev === null ? rows.length : prev));
      }
    } catch (err: any) {
      console.error('[Settings] Failed to fetch CRM customers:', err);
      setCrmError(err.response?.data?.error || 'Failed to load customers');
      if (!append) {
        setCrmCustomers([]);
        setCrmOffset(0);
        setCrmHasMore(false);
      }
    } finally {
      setCrmLoading(false);
      setCrmLoadingMore(false);
    }
  };

  const openCrmProfile = async (customerId: number) => {
    try {
      setCrmProfileLoading(true);
      setCrmError(null);
      setSelectedCrmProfile(null);
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/crm/customers/${customerId}`);
      setSelectedCrmProfile(res.data);
    } catch (err: any) {
      console.error('[Settings] Failed to fetch CRM profile:', err);
      setCrmError(err.response?.data?.error || 'Failed to load customer profile');
    } finally {
      setCrmProfileLoading(false);
    }
  };

  const openCrmOrderDetail = async (orderId: number) => {
    setCrmOrderDetailLoading(true);
    setCrmOrderDetail(null);
    try {
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/orders/${orderId}`);
      setCrmOrderDetail(res.data);
    } catch (err) {
      console.error('[CRM] Failed to load order detail:', err);
      Alert.alert('Error', 'Could not load order details.');
    } finally {
      setCrmOrderDetailLoading(false);
    }
  };


  const loadAddonPresetItems = async (presetId: number) => {
    try {
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/addon-presets/${presetId}/items`);
      setAddonPresetItems(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.warn('[Settings] Failed to fetch addon preset items:', err.message);
      setAddonPresetItems([]);
    }
  };

  const removeAddonPresetItem = async (presetId: number, itemId: number) => {
    try {
      await apiClient.delete(`/api/restaurants/${restaurantId}/addon-presets/${presetId}/items/${itemId}`);
      await loadAddonPresetItems(presetId);
      await fetchAddonPresets();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.error || 'Failed to remove item');
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchVariantPresets();
    fetchPaymentTerminals();
    fetchAddonPresets();
    fetchTerminalApplications();
    fetchCrmCount();
  }, [restaurantId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCrmSearchTerm(crmSearchInput.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [crmSearchInput]);

  useEffect(() => {
    if (settingsPage !== 'crm') return;
    fetchCrmCustomers({ offset: 0, append: false, search: crmSearchTerm, sortBy: crmSortBy });
  }, [settingsPage, crmSearchTerm, crmSortBy]);

  const getPrinterTypeLabel = (type?: string): string => {
    const labels: Record<string, string> = {
      'thermal': t('settings.thermal-network'),
      'network': t('settings.network-printer'),
      'bluetooth': t('settings.bluetooth-printer'),
      'none': t('settings.not-configured'),
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
      Alert.alert(t('common.success'), t('settings.settings-saved'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('settings.settings-failed'));
    }
  };

  const savePrinterSettings = async () => {
    try {
      if (!printerFormData || !editingPrinterType) return;

      const prefix = editingPrinterType; // 'qr', 'bill', 'kitchen', or 'kpay'

      // Map prefix to DB type value (must match CHECK constraint: 'QR', 'Bill', 'Kitchen', 'KPAY')
      const typeMap: Record<string, string> = { qr: 'QR', bill: 'Bill', kitchen: 'Kitchen', kpay: 'KPAY' };
      const dbType = typeMap[prefix] || prefix.toUpperCase();

      // Bluetooth device may be stored under prefixed key (set by selectBluetoothDevice)
      // or under the unprefixed key (loaded from DB for editing)
      const btDeviceId = (printerFormData as any)[`${prefix}_bluetooth_device_id`] ?? printerFormData.bluetooth_device_id;
      const btDeviceName = (printerFormData as any)[`${prefix}_bluetooth_device_name`] ?? printerFormData.bluetooth_device_name;

      // Build payload matching webapp format (individual record with type field)
      const payload: any = {
        type: dbType,
        printer_type: printerFormData.printer_type,
        printer_host: printerFormData.printer_type === 'network' ? printerFormData.printer_host : null,
        printer_port: printerFormData.printer_type === 'network' ? (printerFormData.printer_port || null) : null,
        bluetooth_device_id: printerFormData.printer_type === 'bluetooth' ? btDeviceId : null,
        bluetooth_device_name: printerFormData.printer_type === 'bluetooth' ? btDeviceName : null,
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

      // Include format settings in the same save
      if (editingPrinterType === 'qr') {
        settings.code_size = qrCodeSize;
        settings.text_above = qrTextAbove;
        settings.text_below = qrTextBelow;
      } else if (editingPrinterType === 'bill') {
        settings.paper_width = billPaperWidth;
        settings.show_phone = billShowPhone;
        settings.show_address = billShowAddress;
        settings.show_time = billShowTime;
        settings.show_items = billShowItems;
        settings.show_total = billShowTotal;
        settings.footer_message = billFooterMsg;
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
      Alert.alert(t('common.success'), t('settings.printer-saved'));
    } catch (err: any) {
      console.error('[SettingsTab] Error saving printer settings:', err);
      Alert.alert(t('common.error'), err.response?.data?.error || t('settings.printer-failed'));
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
          Alert.alert(t('settings.bluetooth-enable'), t('settings.bluetooth-msg'));
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
          Alert.alert(t('settings.no-devices'), t('settings.no-devices-msg'));
        }
      }, 10000);
    } catch (err: any) {
      console.error('❌ Bluetooth search error:', err);
      setBluetoothSearching(false);
      Alert.alert(t('common.error'), t('settings.bluetooth-error') + ': ' + err.message);
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
    Alert.alert(t('settings.device-selected'), t('settings.device-selected-msg', { '0': device.name }));
  };

  // Bluetooth device selection is now handled at runtime during printing

  const resetCouponForm = () => {
    setCouponForm({ code: '', discount_type: 'percentage', discount_value: '', min_order_value: '', description: '', coupon_type: 'open' });
    setEditingCouponId(null);
  };

  const createCoupon = async () => {
    try {
      if (!couponForm.code || !couponForm.discount_value) {
        Alert.alert(t('settings.validation'), t('settings.fill-required'));
        return;
      }

      if (editingCouponId) {
        // Update existing coupon
        await apiClient.patch(`/api/coupons/${editingCouponId}`, {
          code: couponForm.code.toUpperCase(),
          discount_type: couponForm.discount_type,
          discount_value: parseFloat(couponForm.discount_value),
          min_order_value: couponForm.min_order_value ? parseFloat(couponForm.min_order_value) : null,
          minimum_order_value: couponForm.min_order_value ? parseFloat(couponForm.min_order_value) : null,
          description: couponForm.description || null,
          coupon_type: couponForm.coupon_type,
          restaurantId,
        });
        await fetchCoupons();
        resetCouponForm();
        setShowCouponModal(false);
        Alert.alert(t('common.success'), t('settings.coupon-updated') || 'Coupon updated');
        return;
      }

      await apiClient.post(`/api/restaurants/${restaurantId}/coupons`, {
        code: couponForm.code.toUpperCase(),
        discount_type: couponForm.discount_type,
        discount_value: parseFloat(couponForm.discount_value),
        min_order_value: couponForm.min_order_value ? parseFloat(couponForm.min_order_value) : null,
        description: couponForm.description || null,
        coupon_type: couponForm.coupon_type,
      });

      await fetchSettings();
      resetCouponForm();
      setShowCouponModal(false);
      Alert.alert(t('common.success'), t('settings.coupon-created'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('settings.coupon-failed'));
    }
  };

  const openEditCoupon = (coupon: any) => {
    setCouponForm({
      code: coupon.code || '',
      discount_type: coupon.discount_type || 'percentage',
      discount_value: String(coupon.discount_value || ''),
      min_order_value: String(coupon.minimum_order_value || coupon.min_order_value || ''),
      description: coupon.description || '',
      coupon_type: coupon.coupon_type || 'open',
    });
    setEditingCouponId(coupon.id);
    setShowCouponDetailModal(false);
    setSelectedCoupon(null);
    setShowCouponModal(true);
  };

  const assignCouponToCustomer = async (customerId: number, couponId: number) => {
    try {
      await apiClient.post(`/api/restaurants/${restaurantId}/crm/customers/${customerId}/coupons`, { coupon_id: couponId });
      // Reload customer profile
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/crm/customers/${customerId}`);
      setSelectedCrmProfile(res.data);
      Alert.alert(t('common.success'), t('settings.coupon-assigned') || 'Coupon assigned');
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.error || 'Failed to assign coupon');
    }
  };

  const revokeCouponFromCustomer = async (customerId: number, couponId: number) => {
    try {
      await apiClient.delete(`/api/restaurants/${restaurantId}/crm/customers/${customerId}/coupons/${couponId}`);
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/crm/customers/${customerId}`);
      setSelectedCrmProfile(res.data);
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.error || 'Failed to revoke coupon');
    }
  };

  const deleteCoupon = async (couponId: number) => {
    Alert.alert(t('settings.delete-coupon'), t('settings.delete-coupon-msg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        onPress: async () => {
          try {
            await apiClient.delete(`/api/coupons/${couponId}`);
            await fetchSettings();
            Alert.alert(t('common.success'), t('settings.coupon-deleted'));
          } catch (err: any) {
            Alert.alert(t('common.error'), t('settings.coupon-delete-failed'));
          }
        },
        style: 'destructive',
      },
    ]);
  };

  // Payment Terminal Functions
  const savePaymentTerminal = async () => {
    try {
      // Non-superadmin can only update connection details on existing terminals
      if (!isSuperadmin) {
        if (!editingTerminalId) {
          Alert.alert(t('common.error'), 'Only superadmins can create new terminals');
          return;
        }
        const payload: any = {
          terminal_ip: terminalForm.terminal_ip,
          terminal_port: parseInt(terminalForm.terminal_port),
          endpoint_path: terminalForm.endpoint_path || '/v2/pos/sign',
        };
        await apiClient.patch(`/api/restaurants/${restaurantId}/payment-terminals/${editingTerminalId}`, payload);
        Alert.alert(t('common.success'), t('settings.terminal-updated'));
        await fetchPaymentTerminals();
        resetTerminalForm();
        setShowPaymentTerminalModal(false);
        return;
      }

      const vendor = terminalForm.vendor_name;

      // Validation differs by vendor
      if (vendor === 'payment-asia') {
        if (!terminalForm.merchant_token || !terminalForm.secret_code) {
          Alert.alert(t('settings.pa-validation'), t('settings.pa-validation-msg'));
          return;
        }
      } else if (vendor === 'payment-asia-offline') {
        if (!terminalForm.pa_offline_ip || !terminalForm.pa_offline_port || !terminalForm.pa_offline_api_key) {
          Alert.alert(t('settings.validation'), 'Terminal IP, Port, and API Key are required for PA Offline');
          return;
        }
      } else {
        if (!terminalForm.app_id || !terminalForm.app_secret || !terminalForm.terminal_ip || !terminalForm.terminal_port) {
          Alert.alert(t('settings.validation'), t('settings.fill-required'));
          return;
        }
      }

      let payload: any = { vendor_name: vendor };

      if (vendor === 'payment-asia') {
        payload.merchant_token = terminalForm.merchant_token;
        payload.secret_code = terminalForm.secret_code;
        payload.payment_gateway_env = terminalForm.environment; // fix: was 'environment'
      } else if (vendor === 'payment-asia-offline') {
        payload.terminal_ip = terminalForm.pa_offline_ip;
        payload.terminal_port = parseInt(terminalForm.pa_offline_port);
        payload.app_secret = terminalForm.pa_offline_api_key;
        payload.app_id = terminalForm.pa_offline_api_key;
      } else {
        payload.app_id = terminalForm.app_id;
        payload.app_secret = terminalForm.app_secret;
        payload.terminal_ip = terminalForm.terminal_ip;
        payload.terminal_port = parseInt(terminalForm.terminal_port);
        payload.endpoint_path = terminalForm.endpoint_path || '/v2/pos/sign';
      }

      if (editingTerminalId) {
        await apiClient.patch(`/api/restaurants/${restaurantId}/payment-terminals/${editingTerminalId}`, payload);
        Alert.alert(t('common.success'), t('settings.terminal-updated'));
      } else {
        await apiClient.post(`/api/restaurants/${restaurantId}/payment-terminals`, payload);
        Alert.alert(t('common.success'), t('settings.terminal-created'));
      }

      await fetchPaymentTerminals();
      resetTerminalForm();
      setShowPaymentTerminalModal(false);
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('settings.terminal-failed'));
    }
  };

  const testPaymentTerminal = async () => {
    try {
      if (!editingTerminalId) {
        Alert.alert(t('common.error'), t('settings.save-first'));
        return;
      }

      const vendor = terminalForm.vendor_name;

      // PA Online: open payment-test.html in Safari — the browser handles form submission
      if (vendor === 'payment-asia') {
        const baseUrl = apiClient.getCurrentBaseUrl();
        const testUrl = `${baseUrl}/payment-test.html?terminalId=${editingTerminalId}&restaurantId=${restaurantId}`;
        try {
          await Linking.openURL(testUrl);
          setTerminalTestResult({
            success: true,
            message: 'Sandbox payment test opened in browser. Complete the payment to verify.',
          });
        } catch {
          Alert.alert(t('common.error'), 'Could not open browser. Please open: ' + testUrl);
        }
        return;
      }

      // PA Offline: ping the terminal directly over LAN
      if (vendor === 'payment-asia-offline') {
        const ip = terminalForm.pa_offline_ip;
        const port = parseInt(terminalForm.pa_offline_port);
        const apiKey = terminalForm.pa_offline_api_key;
        if (!ip || !port || !apiKey) {
          Alert.alert(t('common.error'), 'Save terminal first before testing');
          return;
        }
        setTestingTerminal(true);
        try {
          const pingResult = await paTerminalPing({ terminalIp: ip, terminalPort: port, apiKey });
          if (pingResult.success) {
            const signResult = await paTerminalSign({ terminalIp: ip, terminalPort: port, apiKey });
            const msg = signResult.success
              ? `✅ Connected to PA terminal at ${ip}:${port}. Sign handshake OK.`
              : `✅ Ping OK, but sign step failed: ${signResult.message}`;
            setTerminalTestResult({ success: signResult.success || pingResult.success, message: msg });
          } else {
            setTerminalTestResult({ success: false, message: `❌ Cannot reach terminal at ${ip}:${port}. Check IP, port and network.` });
          }
        } catch (err: any) {
          setTerminalTestResult({ success: false, message: `Error: ${err.message}` });
        } finally {
          setTestingTerminal(false);
        }
        return;
      }

      // KPay / other: call backend test endpoint
      setTestingTerminal(true);
      const response = await apiClient.post(
        `/api/restaurants/${restaurantId}/payment-terminals/${editingTerminalId}/test`
      );
      setTerminalTestResult(response.data);
      if (response.data.success) {
        Alert.alert(
          t('settings.connection-success'),
          t('settings.connected-to', { '0': terminalForm.vendor_name.toUpperCase(), '1': `${terminalForm.terminal_ip}:${terminalForm.terminal_port}` })
        );
      } else {
        Alert.alert(
          t('settings.connection-failed'),
          response.data.error || response.data.message
        );
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('settings.test-failed'));
    } finally {
      setTestingTerminal(false);
    }
  };

  const deletePaymentTerminal = async (terminalId: number) => {
    Alert.alert(t('settings.delete-terminal'), t('settings.delete-terminal-msg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        onPress: async () => {
          try {
            await apiClient.delete(`/api/restaurants/${restaurantId}/payment-terminals/${terminalId}`);
            await fetchPaymentTerminals();
            Alert.alert(t('common.success'), t('settings.terminal-deleted'));
          } catch (err: any) {
            Alert.alert(t('common.error'), t('settings.terminal-delete-failed'));
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
      environment: terminal.environment || (terminal.payment_gateway_env as 'sandbox' | 'production') || 'sandbox',
      pa_offline_ip: terminal.vendor_name === 'payment-asia-offline' ? (terminal.terminal_ip || '') : '',
      pa_offline_port: terminal.vendor_name === 'payment-asia-offline' ? (terminal.terminal_port?.toString() || '8080') : '8080',
      pa_offline_api_key: '',
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
      pa_offline_ip: '',
      pa_offline_port: '8080',
      pa_offline_api_key: '',
    });
    setTerminalTestResult(null);
  };

  const copyToClipboard = async (text: string, label: string) => {
    // In React Native, we'd use a library like @react-native-clipboard/clipboard
    Alert.alert(t('settings.copied'), t('settings.copied-msg'));
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
      const title = type === 'staff' ? t('settings.staff-qr-title') : t('settings.kitchen-qr-title');
      
      await Share.share({
        message: `${title}\n\n${t('settings.share-login')}\n${url}`,
        url: url, // For iOS
        title: title,
      });
    } catch (error) {
      Alert.alert(t('common.error'), t('settings.share-failed'));
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
            <Text style={styles.modalTitle}>{t('settings.bluetooth-title')}</Text>
            <TouchableOpacity onPress={() => setActiveModal(null)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { marginBottom: 16, marginHorizontal: 16 }]}
            onPress={startBluetoothSearch}
            disabled={bluetoothSearching}
          >
            <Text style={styles.btnText}>{bluetoothSearching ? t('settings.scanning') : t('settings.scan-devices')}</Text>
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
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>{t('settings.signal')}: {device.signal} dBm</Text>
                </TouchableOpacity>
              ))
            ) : bluetoothSearching ? (
              <Text style={[styles.helperText, { marginHorizontal: 16, marginTop: 20 }]}>{t('settings.searching')}</Text>
            ) : (
              <Text style={[styles.helperText, { marginHorizontal: 16, marginTop: 20 }]}>{t('settings.search-hint')}</Text>
            )}
          </ScrollView>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => setActiveModal(null)}
            >
              <Text style={styles.btnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => {
                setActiveModal(null);
                setShowingPrinterSettingsPage(false);
              }}
            >
              <Text style={styles.btnText}>{t('common.done')}</Text>
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
            {editingPrinterType === 'qr' && t('settings.qr-printer')}
            {editingPrinterType === 'bill' && t('settings.bill-printer')}
            {editingPrinterType === 'kitchen' && t('settings.kitchen-printer')}
            {editingPrinterType === 'kpay' && t('settings.kpay-printer')}
          </Text>
          <TouchableOpacity onPress={() => setEditingPrinterType(null)}>
            <Text style={styles.backButton}>{t('settings.back-arrow')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            {/* Auto-Print Toggle */}
            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.label}>{t('settings.auto-print')}</Text>
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
              <Text style={styles.label}>{t('settings.printer-type')}</Text>
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
                  <Text style={styles.label}>{t('settings.ip-address')}</Text>
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
                  <Text style={styles.label}>{t('settings.port')}</Text>
                  <TextInput
                    style={styles.input}
                    value={printerFormData?.printer_port?.toString() || ''}
                    onChangeText={(text) => {
                      const parsed = parseInt(text);
                      setPrinterFormData({ ...printerFormData, printer_port: isNaN(parsed) ? undefined : parsed } as PrinterSettings);
                    }}
                    placeholder="9100 (optional)"
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
                  <Text style={styles.btnText}>{t('settings.scan-bluetooth')}</Text>
                </TouchableOpacity>

                {(printerFormData?.bluetooth_device_name || 
                  (editingPrinterType === 'qr' && printerSettings?.qr_bluetooth_device_name) ||
                  (editingPrinterType === 'bill' && printerSettings?.bill_bluetooth_device_name) ||
                  (editingPrinterType === 'kitchen' && printerSettings?.kitchen_bluetooth_device_name) ||
                  (editingPrinterType === 'kpay' && printerSettings?.kpay_bluetooth_device_name)) && (
                  <View style={{ backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#86efac', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#059669', marginBottom: 4 }}>{t('settings.connected-device')}</Text>
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

          {/* QR Code Format Settings (only for QR printer) */}
          {editingPrinterType === 'qr' && (
            <View style={{ marginHorizontal: 16, marginTop: 8 }}>
              <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 16, marginBottom: 12 }}>
                <Text style={[styles.label, { fontSize: 14, fontWeight: '600', marginBottom: 12 }]}>{t('settings.qr-format') || 'QR Code Format'}</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('settings.qr-size')}</Text>
                <View style={styles.toggleGroup}>
                  {['small', 'medium', 'large'].map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[styles.typeBtn, qrCodeSize === size && styles.typeBtnActive]}
                      onPress={() => setQrCodeSize(size)}
                    >
                      <Text style={[styles.typeBtnText, qrCodeSize === size && styles.typeBtnTextActive]}>
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('settings.text-above')}</Text>
                <TextInput style={styles.input} value={qrTextAbove} onChangeText={setQrTextAbove} placeholder={t('settings.text-above')} />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('settings.text-below')}</Text>
                <TextInput style={styles.input} value={qrTextBelow} onChangeText={setQrTextBelow} placeholder={t('settings.text-below')} />
              </View>

              <View style={[styles.formGroup, { marginBottom: 20 }]}>
                <Text style={styles.label}>{t('settings.preview')}</Text>
                <View style={{ borderColor: '#ddd', borderWidth: 2, borderRadius: 6, padding: 16, backgroundColor: '#f9fafb', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 8 }}>{settings?.name || 'Restaurant'}</Text>
                  <Text style={{ fontSize: 10, marginBottom: 2 }}>Table: T02</Text>
                  <Text style={{ fontSize: 10, marginBottom: 8 }}>Time: 2026-03-13 18:24</Text>
                  <Text style={{ fontSize: 10, marginBottom: 12 }}>{'='.repeat(40)}</Text>
                  <View style={{
                    width: qrCodeSize === 'small' ? 120 : qrCodeSize === 'medium' ? 150 : 180,
                    height: qrCodeSize === 'small' ? 120 : qrCodeSize === 'medium' ? 150 : 180,
                    backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ccc',
                    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
                  }}>
                    <Text style={{ fontSize: 11, color: '#999' }}>QR</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{qrTextAbove}</Text>
                  <Text style={{ fontSize: 10, marginBottom: 8, textAlign: 'center' }}>{qrTextBelow}</Text>
                  <Text style={{ fontSize: 9, color: '#666' }}>Powered by Chuio</Text>
                </View>
              </View>
            </View>
          )}

          {/* Bill Receipt Format Settings (only for Bill printer) */}
          {editingPrinterType === 'bill' && (
            <View style={{ marginHorizontal: 16, marginTop: 8 }}>
              <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 16, marginBottom: 12 }}>
                <Text style={[styles.label, { fontSize: 14, fontWeight: '600', marginBottom: 12 }]}>{t('settings.bill-format') || 'Bill Receipt Format'}</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('settings.paper-width')}</Text>
                <View style={styles.toggleGroup}>
                  {['58', '80'].map((width) => (
                    <TouchableOpacity
                      key={width}
                      style={[styles.typeBtn, billPaperWidth === width && styles.typeBtnActive]}
                      onPress={() => setBillPaperWidth(width)}
                    >
                      <Text style={[styles.typeBtnText, billPaperWidth === width && styles.typeBtnTextActive]}>{width}mm</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.label}>{t('settings.show-phone')}</Text>
                  <Switch value={billShowPhone} onValueChange={setBillShowPhone} />
                </View>
              </View>

              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.label}>{t('settings.show-address')}</Text>
                  <Switch value={billShowAddress} onValueChange={setBillShowAddress} />
                </View>
              </View>

              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.label}>{t('settings.show-order-time')}</Text>
                  <Switch value={billShowTime} onValueChange={setBillShowTime} />
                </View>
              </View>

              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.label}>{t('settings.show-items')}</Text>
                  <Switch value={billShowItems} onValueChange={setBillShowItems} />
                </View>
              </View>

              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.label}>{t('settings.show-total')}</Text>
                  <Switch value={billShowTotal} onValueChange={setBillShowTotal} />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('settings.footer-message')}</Text>
                <TextInput style={styles.input} value={billFooterMsg} onChangeText={setBillFooterMsg} placeholder={t('settings.footer-placeholder')} />
              </View>

              <View style={[styles.formGroup, { marginBottom: 20 }]}>
                <Text style={styles.label}>{t('settings.preview')}</Text>
                <View style={{ borderColor: '#ddd', borderWidth: 2, borderRadius: 6, padding: 12, backgroundColor: '#f9fafb' }}>
                  <Text style={{ fontSize: billPaperWidth === '58' ? 11 : 13, fontWeight: '600', textAlign: 'center', marginBottom: 2, fontFamily: 'Courier New' }}>{settings?.name || 'Restaurant'}</Text>
                  {billShowPhone && (
                    <Text style={{ fontSize: billPaperWidth === '58' ? 9 : 11, textAlign: 'center', marginBottom: 1, fontFamily: 'Courier New' }}>Phone: +852 1234 5678</Text>
                  )}
                  {billShowAddress && (
                    <Text style={{ fontSize: billPaperWidth === '58' ? 9 : 11, textAlign: 'center', marginBottom: 4, fontFamily: 'Courier New' }}>123 Main Street</Text>
                  )}
                  <Text style={{ fontSize: billPaperWidth === '58' ? 9 : 11, textAlign: 'center', marginVertical: 4, letterSpacing: 1, fontFamily: 'Courier New' }}>{'='.repeat(billPaperWidth === '58' ? 40 : 50)}</Text>
                  {billShowTime && (
                    <Text style={{ fontSize: billPaperWidth === '58' ? 9 : 11, textAlign: 'center', marginVertical: 2, fontFamily: 'Courier New' }}>Order Time: 2026-03-13 18:24</Text>
                  )}
                  <Text style={{ fontSize: billPaperWidth === '58' ? 9 : 11, marginVertical: 2, fontFamily: 'Courier New' }}>Table: T02       Pax: 4</Text>
                  {billShowItems && (
                    <Text style={{ fontSize: billPaperWidth === '58' ? 9 : 11, marginVertical: 4, fontFamily: 'Courier New' }}>Domaine Rolet          $450</Text>
                  )}
                  {billShowTotal && (
                    <>
                      <Text style={{ fontSize: billPaperWidth === '58' ? 9 : 11, textAlign: 'right', marginVertical: 2, fontFamily: 'Courier New' }}>Subtotal: $450</Text>
                      <Text style={{ fontSize: billPaperWidth === '58' ? 11 : 13, fontWeight: 'bold', textAlign: 'right', marginVertical: 2, fontFamily: 'Courier New' }}>Total: $450</Text>
                    </>
                  )}
                  <Text style={{ fontSize: billPaperWidth === '58' ? 9 : 11, textAlign: 'center', marginVertical: 4, fontFamily: 'Courier New' }}>{'='.repeat(billPaperWidth === '58' ? 40 : 50)}</Text>
                  <Text style={{ fontSize: billPaperWidth === '58' ? 10 : 12, fontWeight: '600', textAlign: 'center', marginVertical: 6, fontFamily: 'Courier New' }}>Thank You</Text>
                  <Text style={{ fontSize: billPaperWidth === '58' ? 8 : 10, textAlign: 'center', marginBottom: 2, fontFamily: 'Courier New' }}>{billFooterMsg}</Text>
                  <Text style={{ fontSize: billPaperWidth === '58' ? 8 : 10, textAlign: 'center', color: '#666', fontFamily: 'Courier New' }}>Powered by Chuio</Text>
                </View>
              </View>
            </View>
          )}

          {/* Kitchen Order Format Preview (only for Kitchen printer) */}
          {editingPrinterType === 'kitchen' && (
            <View style={{ marginHorizontal: 16, marginTop: 8 }}>
              <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 16, marginBottom: 12 }}>
                <Text style={[styles.label, { fontSize: 14, fontWeight: '600', marginBottom: 12 }]}>{t('admin.printer-kitchen-format') || 'Kitchen Order Format'}</Text>
              </View>

              <View style={[styles.formGroup, { marginBottom: 20 }]}>
                <Text style={styles.label}>{t('settings.preview')}</Text>
                <View style={{ borderColor: '#ddd', borderWidth: 2, borderRadius: 6, padding: 12, backgroundColor: '#f9fafb' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 4, fontFamily: 'Courier New' }}>KITCHEN ORDER</Text>
                  <Text style={{ fontSize: 11, textAlign: 'center', marginVertical: 4, fontFamily: 'Courier New' }}>{'='.repeat(40)}</Text>
                  <Text style={{ fontSize: 11, marginVertical: 2, fontFamily: 'Courier New' }}>Order #42   Table: T02</Text>
                  <Text style={{ fontSize: 11, marginVertical: 2, fontFamily: 'Courier New' }}>Time: 2026-03-13 18:24</Text>
                  <Text style={{ fontSize: 11, textAlign: 'center', marginVertical: 4, fontFamily: 'Courier New' }}>{'='.repeat(40)}</Text>
                  <Text style={{ fontSize: 11, marginVertical: 2, fontFamily: 'Courier New' }}>1x  Caesar Salad</Text>
                  <Text style={{ fontSize: 11, marginVertical: 2, fontFamily: 'Courier New' }}>2x  Margherita Pizza</Text>
                  <Text style={{ fontSize: 10, marginLeft: 20, color: '#666', fontFamily: 'Courier New' }}>Size: Large</Text>
                  <Text style={{ fontSize: 11, textAlign: 'center', marginVertical: 4, fontFamily: 'Courier New' }}>{'='.repeat(40)}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 12 }}>
                {t('settings.kitchen-format-note') || 'Kitchen order format uses a standard layout.'}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.formActions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => setEditingPrinterType(null)}
          >
            <Text style={styles.btnText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => savePrinterSettings()}
          >
            <Text style={styles.btnText}>{t('settings.save')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {bluetoothModal}
    </>
  );
  }

  // Printer Settings Main Page
  if (showingPrinterSettingsPage) {
    return (
      <>
        <View style={styles.container}>
        {/* Page Header */}
        <View style={{ padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.printerPageTitle}>{t('admin.printer-settings')}</Text>
          <TouchableOpacity onPress={() => setShowingPrinterSettingsPage(false)}>
            <Text style={styles.backButton}>{t('settings.back-arrow')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Printer Configuration - Separate for each type */}
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            <Text style={[styles.label, { fontSize: 16, fontWeight: '700', marginBottom: 12 }]}>{t('settings.printer-config')}</Text>
            
            {/* QR Code Printer */}
            <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#93c5fd', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>{t('settings.qr-printer')}</Text>
              </View>
              {printerSettings?.qr_printer_type && printerSettings.qr_printer_type !== 'none' && (
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
                <Text style={styles.btnText}>{t('settings.configure')}</Text>
              </TouchableOpacity>
            </View>

            {/* Bill Printer */}
            <View style={{ backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>{t('settings.bill-printer')}</Text>
              </View>
              {printerSettings?.bill_printer_type && printerSettings.bill_printer_type !== 'none' && (
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
                <Text style={styles.btnText}>{t('settings.configure')}</Text>
              </TouchableOpacity>
            </View>

            {/* Kitchen Printer */}
            <View style={{ backgroundColor: '#fce7f3', borderWidth: 1, borderColor: '#fbcfe8', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>{t('settings.kitchen-printer')}</Text>
              </View>
              {printerSettings?.kitchen_printer_type && printerSettings.kitchen_printer_type !== 'none' && (
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
                <Text style={styles.btnText}>{t('settings.configure')}</Text>
              </TouchableOpacity>
            </View>

            {/* KPay Receipt Printer */}
            <View style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderRadius: 8, padding: 14, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>{t('settings.kpay-printer')}</Text>
              </View>
              {printerSettings?.kpay_printer_type && printerSettings.kpay_printer_type !== 'none' && (
                <>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
                    Type: {getPrinterTypeLabel(printerSettings.kpay_printer_type)}
                  </Text>
                  {printerSettings.kpay_bluetooth_device_name && (
                    <Text style={{ fontSize: 12, color: '#059669', marginBottom: 2 }}>
                      ✓ Device: {printerSettings.kpay_bluetooth_device_name}
                    </Text>
                  )}
                  {printerSettings.kpay_printer_host && (
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      Host: {printerSettings.kpay_printer_host}:{printerSettings.kpay_printer_port}
                    </Text>
                  )}
                </>
              )}
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { paddingVertical: 8 }]}
                onPress={() => {
                  setEditingPrinterType('kpay');
                  const kpaySettings: PrinterSettings = {
                    printer_type: printerSettings?.kpay_printer_type || 'none',
                    printer_host: printerSettings?.kpay_printer_host,
                    printer_port: printerSettings?.kpay_printer_port,
                    bluetooth_device_id: printerSettings?.kpay_bluetooth_device_id,
                    bluetooth_device_name: printerSettings?.kpay_bluetooth_device_name,
                    kpay_auto_print: printerSettings?.kpay_auto_print,
                  };
                  setPrinterFormData(kpaySettings);
                }}
              >
                <Text style={styles.btnText}>{t('settings.configure')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
      {bluetoothModal}
    </>
  );
  }

  // Settings card grid items
  const settingsCards: { page: SettingsPage; iconName: keyof typeof Ionicons.glyphMap; label: string; description: string }[] = [
    { page: 'profile', iconName: 'person-circle-outline', label: t('settings.my-profile'), description: currentUser?.role || t('settings.view-profile') },
    { page: 'language', iconName: 'globe-outline', label: t('admin.language') || 'Language', description: lang === 'en' ? 'English' : '中文' },
    { page: 'restaurant-info', iconName: 'storefront-outline', label: t('admin.restaurant-info') || 'Restaurant Info', description: settings?.name || '—' },
    { page: 'printer', iconName: 'print-outline', label: t('admin.printer-settings') || 'Printers', description: t('settings.printer-desc') },
    { page: 'crm', iconName: 'people-outline', label: 'CRM', description: crmCount === null ? 'Loading customers...' : `${crmCount} customer${crmCount === 1 ? '' : 's'}` },
    { page: 'payment-terminals', iconName: 'card-outline', label: t('admin.payment-terminal') || 'Payment Terminals', description: t('settings.configured', { '0': paymentTerminals.length.toString() }) },
    { page: 'qr-settings', iconName: 'qr-code-outline', label: t('admin.qr-settings') || 'QR Settings', description: settings?.qr_mode || 'regenerate' },
    { page: 'menu-settings', iconName: 'restaurant-outline', label: t('admin.menu-settings') || 'Menu Settings', description: t('admin.menu-settings-desc') || 'Layout and feature options' },
    { page: 'feature-flags' as SettingsPage, iconName: 'toggle-outline' as keyof typeof Ionicons.glyphMap, label: t('settings.feature-flags') || 'Feature Flags', description: t('settings.feature-flags-desc') || 'Enable or disable modules' },
    { page: 'service-requests' as SettingsPage, iconName: 'hand-left-outline' as keyof typeof Ionicons.glyphMap, label: 'Service Requests', description: 'Configure request types and labels' },
    { page: 'staff-links', iconName: 'key-outline', label: t('settings.staff-links'), description: t('settings.staff-links-desc') },
    { page: 'coupons', iconName: 'pricetag-outline', label: t('admin.coupons') || 'Coupons', description: t('settings.coupons-count', { '0': coupons.length.toString() }) },
    { page: 'variant-presets', iconName: 'pricetags-outline', label: t('settings.variant-presets'), description: t('settings.presets-count', { '0': variantPresets.length.toString() }) },
    { page: 'addon-presets', iconName: 'layers-outline', label: t('admin.addon-presets') || 'Addon Presets', description: t('settings.presets-count', { '0': addonPresets.length.toString() }) },
    ...(isSuperadmin ? [{ page: 'users' as SettingsPage, iconName: 'people-circle-outline' as keyof typeof Ionicons.glyphMap, label: t('settings.users-restaurants'), description: t('settings.users-desc') }] : []),
  ];

  // Sub-page header
  const renderSubPageHeader = (title: string) => (
    <View style={styles.subPageHeader}>
      <TouchableOpacity onPress={navigateBack} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={20} color="#4f46e5" />
        <Text style={styles.backBtnText}> {t('settings.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.subPageTitle}>{title}</Text>
      <View style={{ width: 60 }} />
    </View>
  );

  const formatCurrency = (amountCents?: number | null) => {
    return `$${((amountCents || 0) / 100).toFixed(2)}`;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
  };

  const renderCrmCustomerCard = (customer: CrmCustomer) => {
    const initials = (customer.name || '?').slice(0, 2).toUpperCase();

    return (
      <TouchableOpacity
        key={customer.id}
        style={styles.crmCustomerCard}
        activeOpacity={0.8}
        onPress={() => openCrmProfile(customer.id)}
      >
        <View style={styles.crmCustomerAvatar}>
          <Text style={styles.crmCustomerAvatarText}>{initials}</Text>
        </View>
        <View style={styles.crmCustomerMeta}>
          <Text style={styles.crmCustomerName}>{customer.name || '—'}</Text>
          {!!(customer.phone || customer.email) ? (
            <View style={{ marginTop: 2 }}>
              {!!customer.phone && (
                <Text style={styles.crmCustomerSubline}>📞 {customer.phone}</Text>
              )}
              {!!customer.email && (
                <Text style={styles.crmCustomerSubline}>✉️ {customer.email}</Text>
              )}
            </View>
          ) : (
            <Text style={styles.crmCustomerSubline}>No contact details</Text>
          )}
          <Text style={styles.crmCustomerSubline}>
            {customer.total_visits || 0} visits · Last visit {formatDate(customer.last_visit_at)}
          </Text>
        </View>
        <View style={styles.crmCustomerSpendBlock}>
          <Text style={styles.crmCustomerSpend}>{formatCurrency(customer.total_spent_cents || 0)}</Text>
          <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
        </View>
      </TouchableOpacity>
    );
  };

  const bookingStatusColor = (status: string) => {
    if (status === 'confirmed') return { bg: '#dcfce7', text: '#16a34a' };
    if (status === 'completed') return { bg: '#ede9fe', text: '#7c3aed' };
    if (status === 'cancelled') return { bg: '#fee2e2', text: '#dc2626' };
    if (status === 'no-show')   return { bg: '#fef3c7', text: '#d97706' };
    return { bg: '#f3f4f6', text: '#6b7280' };
  };

  const renderCrmBookingRow = (booking: CrmBooking, tone: 'future' | 'past') => {
    const colors = bookingStatusColor(booking.status);
    return (
      <View key={`${tone}-${booking.id}`} style={styles.crmHistoryRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.crmHistoryTitle}>
            {formatDate(booking.booking_date)}{booking.booking_time ? ` · ${booking.booking_time}` : ''}
          </Text>
          <Text style={styles.crmHistoryMeta}>
            {booking.pax} pax{booking.table_label ? ` · ${booking.table_label}` : ''}
          </Text>
        </View>
        <View style={[styles.crmStatusBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.crmStatusBadgeText, { color: colors.text }]}>{booking.status}</Text>
        </View>
      </View>
    );
  };

  const renderCrmProfile = () => {
    if (crmProfileLoading) {
      return (
        <View style={styles.crmLoadingState}>
          <ActivityIndicator size="small" color="#4f46e5" />
          <Text style={styles.emptyText}>Loading customer...</Text>
        </View>
      );
    }

    if (!selectedCrmProfile) {
      return null;
    }

    const { customer, orders, future_bookings, past_bookings, total_transacted_cents, eligible_coupons } = selectedCrmProfile;
    const initials = (customer.name || '?').slice(0, 2).toUpperCase();

    // Build unified timeline: merge past bookings + orders chronologically
    const orderBySessionId = new Map<number, CrmOrder>();
    orders.forEach(o => { if (o.session_id) orderBySessionId.set(o.session_id, o); });

    type TLItem = { date: string; booking?: CrmBooking; order?: CrmOrder };
    const timeline: TLItem[] = [];
    const usedSessionIds = new Set<number>();

    // Each past booking (with linked order if booking started a session)
    past_bookings.forEach(b => {
      const linkedOrder = b.session_id ? orderBySessionId.get(b.session_id) : undefined;
      timeline.push({ date: b.booking_date, booking: b, order: linkedOrder });
      if (linkedOrder?.session_id) usedSessionIds.add(linkedOrder.session_id);
    });

    // Standalone orders (not linked to any booking in past_bookings)
    orders.forEach(o => {
      if (!o.session_id || !usedSessionIds.has(o.session_id)) {
        const dateStr = o.created_at ? o.created_at.substring(0, 10) : '';
        timeline.push({ date: dateStr, order: o });
      }
    });

    timeline.sort((a, b) => b.date.localeCompare(a.date));

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.crmBackToListBtn} onPress={() => setSelectedCrmProfile(null)}>
            <Ionicons name="arrow-back" size={16} color="#4f46e5" />
            <Text style={styles.crmBackToListText}>Back to customers</Text>
          </TouchableOpacity>

          <View style={styles.crmProfileHero}>
            <View style={styles.crmProfileHeroAvatar}>
              <Text style={styles.crmProfileHeroAvatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.crmProfileName}>{customer.name || '—'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Text style={{ color: '#9ca3af', fontSize: 11 }}>📞</Text>
                <Text style={styles.crmProfileContact}>{customer.phone || '—'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Text style={{ color: '#9ca3af', fontSize: 11 }}>✉️</Text>
                <Text style={styles.crmProfileContact}>{customer.email || '—'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.crmStatsRow}>
            <View style={styles.crmStatCard}>
              <Text style={styles.crmStatValue}>{customer.total_visits || 0}</Text>
              <Text style={styles.crmStatLabel}>Visits</Text>
            </View>
            <View style={styles.crmStatCard}>
              <Text style={styles.crmStatValue}>{formatCurrency(customer.total_spent_cents || 0)}</Text>
              <Text style={styles.crmStatLabel}>Spent</Text>
            </View>
            <View style={styles.crmStatCard}>
              <Text style={styles.crmStatValue}>{formatCurrency(total_transacted_cents || 0)}</Text>
              <Text style={styles.crmStatLabel}>Transacted</Text>
            </View>
            <View style={styles.crmStatCard}>
              <Text style={styles.crmStatValue} numberOfLines={1} adjustsFontSizeToFit>{customer.last_visit_at ? formatDate(customer.last_visit_at) : '—'}</Text>
              <Text style={styles.crmStatLabel}>Last Visit</Text>
            </View>
          </View>

          {!!customer.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.sectionDescription}>{customer.notes}</Text>
            </View>
          )}

          {future_bookings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
              {future_bookings.map((booking) => renderCrmBookingRow(booking, 'future'))}
            </View>
          )}

          {/* Unified history timeline */}
          {timeline.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>History</Text>
              {timeline.map((item, idx) => {
                const { booking, order } = item;
                const colors = booking ? bookingStatusColor(booking.status) : null;
                const hasOrder = !!order;
                return (
                  <View key={idx} style={[styles.crmHistoryRow, { flexDirection: 'column', alignItems: 'stretch', paddingVertical: 10 }]}>
                    {/* Booking row */}
                    {booking && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: hasOrder ? 6 : 0 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.crmHistoryTitle}>
                            📅 {formatDate(booking.booking_date)}{booking.booking_time ? ` · ${booking.booking_time}` : ''}
                          </Text>
                          <Text style={styles.crmHistoryMeta}>
                            {booking.pax} pax{booking.table_label ? ` · ${booking.table_label}` : ''}
                          </Text>
                        </View>
                        {colors && (
                          <View style={[styles.crmStatusBadge, { backgroundColor: colors.bg }]}>
                            <Text style={[styles.crmStatusBadgeText, { color: colors.text }]}>{booking.status}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    {/* Order row (linked or standalone) */}
                    {order && (
                      <TouchableOpacity
                        onPress={() => openCrmOrderDetail(order.order_id)}
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 6, padding: 8, marginTop: booking ? 2 : 0 }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#4f46e5' }}>
                            🧾 Order #{order.restaurant_order_number || order.order_id}
                          </Text>
                          <Text style={styles.crmHistoryMeta}>
                            {order.table_label || 'Counter'}{!booking ? ` · ${formatDate(order.created_at)}` : ''}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.crmOrderAmount}>{formatCurrency(order.total_cents || 0)}</Text>
                          {(order.discount_applied || 0) > 0 && (
                            <Text style={{ fontSize: 11, color: '#dc2626' }}>−{formatCurrency(order.discount_applied)}</Text>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={14} color="#9ca3af" style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    )}
                    {/* Booking only (no order) and not upcoming */}
                    {booking && !order && booking.status !== 'confirmed' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 6, padding: 8, marginTop: 2 }}>
                        <Text style={{ fontSize: 11, color: '#9ca3af' }}>No order recorded for this visit</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Eligible Coupons */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('settings.eligible-coupons') || 'Eligible Coupons'}</Text>
              <TouchableOpacity
                style={[styles.btn, styles.btnSmall, styles.btnPrimary]}
                onPress={() => { setAssignCouponCustomerId(customer.id); setShowAssignCouponModal(true); }}
              >
                <Text style={styles.btnSmallText}>{t('common.assign') || 'Assign'}</Text>
              </TouchableOpacity>
            </View>
            {eligible_coupons && eligible_coupons.length > 0 ? (
              eligible_coupons.map((coupon) => (
                <View key={coupon.id} style={[styles.couponCard, { flexDirection: 'row', alignItems: 'center' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.couponCode}>{coupon.code}</Text>
                    <Text style={styles.couponValue}>
                      {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `$${coupon.discount_value}`}
                      {' · '}
                      <Text style={{ color: coupon.coupon_type === 'closed' ? '#b45309' : '#15803d' }}>
                        {coupon.coupon_type === 'closed' ? (t('settings.coupon-closed') || 'Closed') : (t('settings.coupon-open') || 'Open')}
                      </Text>
                    </Text>
                  </View>
                  {coupon.coupon_type === 'closed' && (
                    <TouchableOpacity
                      onPress={() => Alert.alert(
                        t('settings.revoke-coupon') || 'Revoke Access',
                        `${t('settings.revoke-coupon-confirm') || 'Remove this customer\'s access to'} ${coupon.code}?`,
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          { text: t('common.remove') || 'Remove', style: 'destructive', onPress: () => revokeCouponFromCustomer(customer.id, coupon.id) },
                        ]
                      )}
                    >
                      <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '600', marginLeft: 8 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>{t('settings.no-eligible-coupons') || 'No coupons assigned'}</Text>
            )}
          </View>

          {timeline.length === 0 && future_bookings.length === 0 && !eligible_coupons?.length && (
            <View style={styles.section}>
              <Text style={styles.emptyText}>No order or booking history yet.</Text>
            </View>
          )}
        </ScrollView>
    );
  };

  const renderCrmPage = () => (
    <View style={styles.container}>
      {renderSubPageHeader('CRM')}
      {selectedCrmProfile ? (
        renderCrmProfile()
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Customers</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.label}>
                  {crmSearchTerm
                    ? `${crmCustomers.length} result${crmCustomers.length === 1 ? '' : 's'}`
                    : `${crmCount || 0} customer${crmCount === 1 ? '' : 's'}`}
                </Text>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary, { paddingVertical: 4, paddingHorizontal: 10, opacity: crmSyncing ? 0.6 : 1 }]}
                  disabled={crmSyncing}
                  onPress={syncCrmFromBookings}
                >
                  <Text style={[styles.crmLoadMoreText, { fontSize: 11 }]}>{crmSyncing ? 'Syncing...' : 'Sync Bookings'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              style={styles.input}
              value={crmSearchInput}
              onChangeText={setCrmSearchInput}
              placeholder="Search name, phone or email"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.crmSortRow}>
              <Text style={styles.label}>Sort by:</Text>
              <View style={styles.crmSortChips}>
                {(['last_visit', 'total_spent', 'total_orders', 'created_at'] as const).map((val) => {
                  const labels: Record<string, string> = { last_visit: 'Last Visit', total_spent: 'Most Spent', total_orders: 'Most Orders', created_at: 'Newest' };
                  const active = crmSortBy === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      onPress={() => setCrmSortBy(val)}
                      style={[styles.crmSortChip, active && styles.crmSortChipActive]}
                    >
                      <Text style={[styles.crmSortChipText, active && styles.crmSortChipTextActive]}>{labels[val]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {crmLoading ? (
              <View style={styles.crmLoadingState}>
                <ActivityIndicator size="small" color="#4f46e5" />
                <Text style={styles.emptyText}>Loading customers...</Text>
              </View>
            ) : crmError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{crmError}</Text>
              </View>
            ) : crmCustomers.length === 0 ? (
              <Text style={styles.emptyText}>
                {crmSearchTerm ? 'No customers matched your search.' : 'No customers yet. Import bookings to get started.'}
              </Text>
            ) : (
              <View style={styles.crmListWrap}>
                {crmCustomers.map((customer) => renderCrmCustomerCard(customer))}
              </View>
            )}

            {crmHasMore && !crmLoading && (
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary, styles.crmLoadMoreBtn, crmLoadingMore && { opacity: 0.6 }]}
                disabled={crmLoadingMore}
                onPress={() =>
                  fetchCrmCustomers({
                    offset: crmOffset,
                    append: true,
                    search: crmSearchTerm,
                    sortBy: crmSortBy,
                  })
                }
              >
                <Text style={styles.crmLoadMoreText}>{crmLoadingMore ? 'Loading...' : 'Load More'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
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
            <Text style={styles.sectionTitle}>{t('settings.restaurant-info')}</Text>
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
            <TextInput style={styles.input} value={formData.name} onChangeText={(text) => setFormData({ ...formData, name: text })} placeholder={t('settings.enter-name')} />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('settings.phone')}</Text>
            <TextInput style={styles.input} value={formData.phone} onChangeText={(text) => setFormData({ ...formData, phone: text })} placeholder={t('settings.enter-phone')} keyboardType="phone-pad" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('settings.address')}</Text>
            <TextInput style={[styles.input, { minHeight: 80 }]} value={formData.address} onChangeText={(text) => setFormData({ ...formData, address: text })} placeholder={t('settings.enter-address')} multiline />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('settings.timezone')}</Text>
            <TouchableOpacity
              style={[styles.input, { justifyContent: 'center' }]}
              onPress={() => { setSettingsTzSearch(''); setShowSettingsTzPicker(true); }}
            >
              <Text style={{ fontSize: 14, color: '#1f2937' }}>
                {TIMEZONE_OPTIONS.find(o => o.value === formData.timezone)?.label || formData.timezone || 'Select timezone'}
              </Text>
            </TouchableOpacity>
            <Modal visible={showSettingsTzPicker} transparent animationType="slide">
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>Select Timezone</Text>
                    <TouchableOpacity onPress={() => setShowSettingsTzPicker(false)}>
                      <Text style={{ fontSize: 16, color: '#6b7280' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={{ margin: 12, padding: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, fontSize: 14 }}
                    placeholder="Search timezones..."
                    value={settingsTzSearch}
                    onChangeText={setSettingsTzSearch}
                    autoFocus
                  />
                  <FlatList
                    data={TIMEZONE_OPTIONS.filter(o => o.label.toLowerCase().includes(settingsTzSearch.toLowerCase()) || o.value.toLowerCase().includes(settingsTzSearch.toLowerCase()))}
                    keyExtractor={item => item.value}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={{ padding: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: item.value === formData.timezone ? '#eff6ff' : '#fff' }}
                        onPress={() => { setFormData({ ...formData, timezone: item.value }); setShowSettingsTzPicker(false); }}
                      >
                        <Text style={{ fontSize: 14, color: item.value === formData.timezone ? '#2563eb' : '#1f2937', fontWeight: item.value === formData.timezone ? '600' : '400' }}>{item.label}</Text>
                      </TouchableOpacity>
                    )}
                    keyboardShouldPersistTaps="handled"
                  />
                </View>
              </View>
            </Modal>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('settings.preferred-language')}</Text>
            <TextInput style={styles.input} value={formData.language_preference} onChangeText={(text) => setFormData({ ...formData, language_preference: text })} placeholder="e.g., en, es, fr" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('admin.service-charge')} (%)</Text>
            <TextInput style={styles.input} value={formData.service_charge_percent?.toString() || '0'} onChangeText={(text) => setFormData({ ...formData, service_charge_percent: parseFloat(text) || 0 })} placeholder="0" keyboardType="decimal-pad" inputAccessoryViewID="numpadDone" />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('settings.logo-url')}</Text>
            <TextInput style={styles.input} value={formData.logo_url || ''} onChangeText={(text) => setFormData({ ...formData, logo_url: text })} placeholder="https://..." />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('settings.background-url')}</Text>
            <TextInput style={styles.input} value={formData.background_url || ''} onChangeText={(text) => setFormData({ ...formData, background_url: text })} placeholder="https://..." />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('settings.booking-allowance')}</Text>
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
          <View style={styles.settingItem}><Text style={styles.label}>{t('settings.phone')}</Text><Text style={styles.value}>{settings.phone || '—'}</Text></View>
          <View style={styles.settingItem}><Text style={styles.label}>{t('settings.address')}</Text><Text style={styles.value}>{settings.address || '—'}</Text></View>
          <View style={styles.settingItem}><Text style={styles.label}>{t('settings.timezone')}</Text><Text style={styles.value}>{settings.timezone || 'UTC'}</Text></View>
          <View style={styles.settingItem}><Text style={styles.label}>{t('settings.preferred-language')}</Text><Text style={styles.value}>{settings.language_preference || '—'}</Text></View>
          <View style={styles.settingItem}><Text style={styles.label}>{t('settings.service-charge')}</Text><Text style={styles.value}>{settings.service_charge_percent || 0} %</Text></View>
          {settings.logo_url && (<View style={styles.settingItem}><Text style={styles.label}>{t('settings.logo')}</Text><Text style={styles.value}>{t('settings.uploaded')}</Text></View>)}
          {settings.background_url && (<View style={styles.settingItem}><Text style={styles.label}>{t('settings.background')}</Text><Text style={styles.value}>{t('settings.uploaded')}</Text></View>)}
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

    const hasActiveKpayTerminal = paymentTerminals.some(t => t.vendor_name === 'kpay' && t.is_active);

    const allPrinterCards: { type: 'qr' | 'bill' | 'kitchen' | 'kpay'; label: string; subtitle: string; bg: string; border: string }[] = [
      { type: 'qr', label: t('settings.qr-printer'), subtitle: 'Epson TM-T82', bg: '#f0f9ff', border: '#93c5fd' },
      { type: 'bill', label: t('settings.bill-printer'), subtitle: 'Epson TM-T82', bg: '#fef3c7', border: '#fcd34d' },
      { type: 'kitchen', label: t('settings.kitchen-printer'), subtitle: 'Epson TM-U220', bg: '#fce7f3', border: '#fbcfe8' },
      { type: 'kpay', label: t('settings.kpay-printer'), subtitle: 'Epson TM-T82', bg: '#ecfdf5', border: '#6ee7b7' },
    ];

    // Only show KPay printer card when an active KPay terminal is configured
    const printerCards = allPrinterCards.filter(c => c.type !== 'kpay' || hasActiveKpayTerminal);

    return (
      <View style={styles.container}>
        {renderSubPageHeader(t('admin.printer-settings') || 'Printers')}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>{t('settings.printer-config')}</Text>
            {printerCards.map(({ type, label, subtitle, bg, border }) => {
              const pType = printerSettings?.[`${type}_printer_type`];
              const pHost = printerSettings?.[`${type}_printer_host`];
              const pPort = printerSettings?.[`${type}_printer_port`];
              const btName = printerSettings?.[`${type}_bluetooth_device_name`];
              return (
                <View key={type} style={{ backgroundColor: bg, borderWidth: 1, borderColor: border, borderRadius: 8, padding: 14, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>{label}</Text>
                    <Text style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>{subtitle}</Text>
                  </View>
                  {pType ? (
                    <>
                      <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Type: {getPrinterTypeLabel(pType)}</Text>
                      {btName && <Text style={{ fontSize: 12, color: '#059669', marginBottom: 2 }}>✓ {btName}</Text>}
                      {pHost && <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{pHost}:{pPort}</Text>}
                    </>
                  ) : (
                    <Text style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>{t('settings.not-configured')}</Text>
                  )}
                  <TouchableOpacity style={[styles.btn, styles.btnPrimary, { paddingVertical: 8 }]} onPress={() => configurePrinter(type)}>
                    <Text style={styles.btnText}>{t('settings.configure')}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <TouchableOpacity
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4 }}
              onPress={() => setShowingPrinterSettingsPage(true)}
            >
              <Text style={styles.label}>{t('settings.format-settings')}</Text>
              <Text style={{ fontSize: 18, color: '#6b7280' }}>→</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  // Payment terminals page
  const renderPaymentTerminalsPage = () => {
    // Non-superadmin: show paid feature notice if no terminals, or limited edit if terminals exist
    if (!isSuperadmin) {
      // If terminals exist, show them with limited editing (connection details only)
      if (paymentTerminals.length > 0) {
        return (
          <View style={styles.container}>
            {renderSubPageHeader(t('admin.payment-terminal') || 'Payment Terminals')}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('admin.payment-terminal')}</Text>
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
                      </View>
                    </View>
                  )}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                />
              </View>
            </ScrollView>
          </View>
        );
      }

      // No terminals: show paid feature notice + application form
      return (
        <View style={styles.container}>
          {renderSubPageHeader(t('admin.payment-terminal') || 'Payment Terminals')}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Paid feature notice */}
            <View style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="lock-closed" size={20} color="#d97706" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#92400e', marginLeft: 8 }}>{t('admin.terminal-paid-feature')}</Text>
              </View>
              <Text style={{ fontSize: 13, color: '#92400e', lineHeight: 20 }}>{t('admin.terminal-paid-desc')}</Text>
            </View>

            {/* Existing applications */}
            {existingApplications.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('admin.terminal-app-history')}</Text>
                {existingApplications.map((app: any) => (
                  <View key={app.id} style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>{app.company_name}</Text>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: app.status === 'approved' ? '#dcfce7' : app.status === 'rejected' ? '#fef2f2' : '#fef3c7' }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: app.status === 'approved' ? '#166534' : app.status === 'rejected' ? '#991b1b' : '#92400e' }}>
                          {app.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>{t('admin.terminal-app-submitted-at')}: {new Date(app.submitted_at).toLocaleDateString()}</Text>
                    {app.admin_notes && <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{t('admin.terminal-app-notes')}: {app.admin_notes}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Application form */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.terminal-app-title')}</Text>
              <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>{t('admin.terminal-app-desc')}</Text>

              <Text style={styles.label}>{t('admin.terminal-app-company')} *</Text>
              <TextInput
                style={styles.input}
                value={applicationForm.company_name}
                onChangeText={(v) => setApplicationForm({ ...applicationForm, company_name: v })}
                placeholder={t('admin.terminal-app-company-placeholder')}
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.label}>{t('admin.terminal-app-phone')} *</Text>
              <TextInput
                style={styles.input}
                value={applicationForm.contact_number}
                onChangeText={(v) => setApplicationForm({ ...applicationForm, contact_number: v })}
                placeholder={t('admin.terminal-app-phone-placeholder')}
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>{t('admin.terminal-app-email')} *</Text>
              <TextInput
                style={styles.input}
                value={applicationForm.contact_email}
                onChangeText={(v) => setApplicationForm({ ...applicationForm, contact_email: v })}
                placeholder={t('admin.terminal-app-email-placeholder')}
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>{t('admin.terminal-app-br-no')} *</Text>
              <TextInput
                style={styles.input}
                value={applicationForm.br_license_no}
                onChangeText={(v) => setApplicationForm({ ...applicationForm, br_license_no: v })}
                placeholder={t('admin.terminal-app-br-no-placeholder')}
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.label}>{t('admin.terminal-app-br-cert')}</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 12, borderStyle: 'dashed' }}
                onPress={() => pickDocument('br_certificate')}
              >
                <Ionicons name="document-attach-outline" size={20} color="#6b7280" />
                <Text style={{ marginLeft: 8, color: brCertificateUri ? '#1f2937' : '#9ca3af', fontSize: 13, flex: 1 }}>
                  {brCertificateUri ? brCertificateUri.split('/').pop() : t('admin.terminal-app-upload-pdf')}
                </Text>
                {brCertificateUri && (
                  <TouchableOpacity onPress={() => setBrCertificateUri(null)}>
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <Text style={styles.label}>{t('admin.terminal-app-rest-license')}</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 16, borderStyle: 'dashed' }}
                onPress={() => pickDocument('restaurant_license')}
              >
                <Ionicons name="document-attach-outline" size={20} color="#6b7280" />
                <Text style={{ marginLeft: 8, color: restaurantLicenseUri ? '#1f2937' : '#9ca3af', fontSize: 13, flex: 1 }}>
                  {restaurantLicenseUri ? restaurantLicenseUri.split('/').pop() : t('admin.terminal-app-upload-pdf')}
                </Text>
                {restaurantLicenseUri && (
                  <TouchableOpacity onPress={() => setRestaurantLicenseUri(null)}>
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { paddingVertical: 14, opacity: submittingApplication ? 0.6 : 1 }]}
                onPress={handleSubmitApplication}
                disabled={submittingApplication}
              >
                {submittingApplication ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.btnText, { fontWeight: '700' }]}>{t('admin.terminal-app-submit')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }

    // Superadmin: show terminal configuration
    return (
      <View style={styles.container}>
        {renderSubPageHeader(t('admin.payment-terminal') || 'Payment Terminals')}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('admin.payment-terminal')}</Text>
              <TouchableOpacity style={[styles.btn, styles.btnSmall, styles.btnPrimary]} onPress={() => { resetTerminalForm(); setShowPaymentTerminalModal(true); }}>
                <Text style={styles.btnSmallText}>{t('settings.add-terminal')}</Text>
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
              <Text style={styles.emptyText}>{t('settings.no-terminals')}</Text>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

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
                <Text style={styles.label}>{t('settings.qr-mode')}</Text>
                <Text style={styles.value}>
                  {settings.qr_mode === 'static_table' ? t('settings.static-table')
                    : settings.qr_mode === 'static_seat' ? t('settings.static-seat')
                    : t('settings.regenerate')}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, lineHeight: 18 }}>
                {settings.qr_mode === 'static_table'
                  ? t('settings.static-table-desc')
                  : settings.qr_mode === 'static_seat'
                  ? t('settings.static-seat-desc')
                  : t('settings.regenerate-desc')}
              </Text>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setShowQRModal(true)}>
                <Text style={styles.btnText}>{t('settings.change-qr-mode')}</Text>
              </TouchableOpacity>
              <View style={[styles.settingItem, { marginTop: 12 }]}>
                <Text style={styles.label}>{t('settings.show-item-status')}</Text>
                <TouchableOpacity
                  style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: settings.show_item_status_to_diners ? '#10b981' : '#d1d5db', justifyContent: 'center', paddingHorizontal: 2 }}
                  onPress={async () => {
                    const newVal = !settings.show_item_status_to_diners;
                    try {
                      await apiClient.put(`/api/restaurants/${restaurantId}/settings`, { show_item_status_to_diners: newVal });
                      setSettings({ ...settings, show_item_status_to_diners: newVal });
                    } catch (err) {
                      Alert.alert(t('common.error'), t('settings.qr-mode-failed'));
                    }
                  }}
                >
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignSelf: settings.show_item_status_to_diners ? 'flex-end' : 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.5, elevation: 2 }} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{t('settings.item-status-desc')}</Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );

  // Staff Links page
  const renderStaffLinksPage = () => (
    <View style={styles.container}>
      {renderSubPageHeader(t('settings.staff-kitchen-links'))}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.login-qr-codes')}</Text>
          <Text style={styles.sectionDescription}>{t('settings.qr-share-desc')}</Text>
          <View style={styles.qrCodeContainer}>
            <TouchableOpacity style={styles.qrCodeButton} onPress={() => setShowStaffQRModal(true)}>
              <Text style={styles.qrCodeButtonText}>{t('settings.view-staff-qr')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.qrCodeButton, styles.kitchenQRButton]} onPress={() => setShowKitchenQRModal(true)}>
              <Text style={styles.qrCodeButtonText}>{t('settings.view-kitchen-qr')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.qrCodeHint}>{t('settings.tap-view-hint')}</Text>
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
              <Text style={styles.btnSmallText}>{t('common.new')}</Text>
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
            <Text style={styles.emptyText}>{t('settings.no-coupons')}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );

  // Variant Presets page
  const renderVariantPresetsPage = () => (
    <View style={styles.container}>
      {renderSubPageHeader(t('settings.variant-presets-title'))}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('settings.variant-presets-title')}</Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnSmall, styles.btnPrimary]}
              onPress={() => {
                Alert.prompt(t('settings.create-variant'), t('settings.variant-title-prompt'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('settings.create'), onPress: async (name: string | undefined) => {
                    if (!name) return;
                    try {
                      await apiClient.post(`/api/restaurants/${restaurantId}/variant-presets`, { name, description: '', is_active: true });
                      await fetchVariantPresets();
                      Alert.alert(t('common.success'), name);
                    } catch (err: any) {
                      Alert.alert(t('common.error'), err.response?.data?.error || 'Failed to create preset');
                    }
                  }},
                ], 'plain-text');
              }}
            >
              <Text style={styles.btnSmallText}>{t('common.new')}</Text>
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
            <Text style={styles.emptyText}>{t('settings.no-variant-presets')}</Text>
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
                Alert.prompt(t('settings.create-addon'), t('settings.addon-name-prompt'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: 'Create',
                    onPress: async (name: string | undefined) => {
                      if (!name) return;
                      try {
                        await apiClient.post(`/api/restaurants/${restaurantId}/addon-presets`, { name, description: '' });
                        Alert.alert(t('common.success'), `${name}`);
                        fetchAddonPresets();
                      } catch (err: any) {
                        Alert.alert(t('common.error'), err.response?.data?.error || t('settings.addon-create-failed'));
                      }
                    },
                  },
                ], 'plain-text');
              }}
            >
              <Text style={styles.btnSmallText}>{t('common.new')}</Text>
            </TouchableOpacity>
          </View>
          {addonPresets.length > 0 ? (
            <FlatList
              data={addonPresets}
              renderItem={({ item: preset }) => (
                <TouchableOpacity
                  style={styles.presetCard}
                  onPress={async () => {
                    setSelectedAddonPreset(preset);
                    await loadAddonPresetItems(preset.id);
                  }}
                >
                  <View style={styles.presetCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.presetName}>{preset.name}</Text>
                      {preset.description ? <Text style={styles.presetDescription}>{preset.description}</Text> : null}
                      <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{t('settings.items-label')} {preset.items_count || 0}</Text>
                    </View>
                    <TouchableOpacity
                      style={{ padding: 6 }}
                      onPress={() => {
                        Alert.alert(t('settings.delete-preset'), `${preset.name}?`, [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('common.delete'),
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await apiClient.delete(`/api/restaurants/${restaurantId}/addon-presets/${preset.id}`);
                                fetchAddonPresets();
                              } catch (err: any) {
                                Alert.alert(t('common.error'), err.response?.data?.error || t('settings.addon-delete-failed'));
                              }
                            },
                          },
                        ]);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>{t('settings.no-addon-presets')}</Text>
          )}
        </View>
      </ScrollView>

      {/* Addon Preset Detail Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={!!selectedAddonPreset} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedAddonPreset?.name}</Text>
              <TouchableOpacity onPress={() => setSelectedAddonPreset(null)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.presetDetailScroll}>
              <View style={styles.modalBody}>
                {selectedAddonPreset?.description && (
                  <Text style={styles.presetDetailDesc}>{selectedAddonPreset.description}</Text>
                )}

                <Text style={styles.variantsLabel}>{t('settings.items-in-preset') || `Items in ${selectedAddonPreset?.name}`}</Text>
                {addonPresetItems.length > 0 ? (
                  addonPresetItems.map((item, idx) => (
                    <View key={idx} style={styles.variantDetailItem}>
                      <View style={styles.variantDetailContent}>
                        <Text style={styles.variantDetailName}>{item.menu_item?.name || 'Unknown'}</Text>
                        <Text style={styles.variantDetailMeta}>
                          {t('settings.discount-price') || 'Discount'}: ${(item.addon_discount_price_cents / 100).toFixed(2)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.btn, styles.btnSmall, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}
                        onPress={() =>
                          Alert.alert(
                            t('common.delete'),
                            `${item.menu_item?.name || 'Unknown'}?`,
                            [
                              { text: t('common.cancel'), style: 'cancel' },
                              {
                                text: t('common.delete'),
                                style: 'destructive',
                                onPress: () => removeAddonPresetItem(selectedAddonPreset!.id, item.id),
                              },
                            ]
                          )
                        }
                      >
                        <Text style={[styles.btnSmallText, { color: '#991b1b' }]}>{t('common.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>{t('settings.no-items-in-preset') || 'No items in this preset'}</Text>
                )}
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => setSelectedAddonPreset(null)}
              >
                <Text style={styles.btnText}>{t('settings.close') || 'Close'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
        confirmPassword: '',
        pin: data.pin || '',
      });
    } catch (err: any) {
      setProfileError(err.message || t('settings.profile-load-failed'));
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
      if (profileForm.password) {
        if (profileForm.password !== profileForm.confirmPassword) {
          Alert.alert(t('common.error'), t('settings.passwords-mismatch'));
          setProfileSaving(false);
          return;
        }
        if (profileForm.password.length < 8) {
          Alert.alert(t('common.error'), t('settings.password-too-short'));
          setProfileSaving(false);
          return;
        }
        payload.password = profileForm.password;
      }
      if (profileData?.role === 'staff' || profileData?.role === 'kitchen') {
        if (profileForm.pin !== (profileData?.pin || '')) payload.pin = profileForm.pin;
      }
      if (Object.keys(payload).length === 0) {
        Alert.alert(t('settings.no-changes'), t('settings.no-changes-msg'));
        setProfileSaving(false);
        return;
      }
      await apiClient.updateProfile(payload);
      Alert.alert(t('common.success'), t('settings.profile-updated'));
      await loadProfile();
    } catch (err: any) {
      setProfileError(err.message || t('settings.profile-save-failed'));
    } finally {
      setProfileSaving(false);
    }
  };

  const renderProfilePage = () => {
    if (profileLoading && !profileData) {
      return (
        <View style={styles.container}>
          {renderSubPageHeader(t('settings.profile-title'))}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {renderSubPageHeader(t('settings.profile-title'))}
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
            <Text style={styles.label}>{t('settings.name')}</Text>
            <TextInput
              style={styles.input}
              value={profileForm.name}
              onChangeText={(text) => setProfileForm({ ...profileForm, name: text })}
              placeholder={t('settings.name-placeholder')}
            />
          </View>

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>{t('settings.email')}</Text>
            <TextInput
              style={styles.input}
              value={profileForm.email}
              onChangeText={(text) => setProfileForm({ ...profileForm, email: text })}
              placeholder={t('settings.email-placeholder')}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Password (for admin/superadmin) */}
          {(profileData?.role === 'admin' || profileData?.role === 'superadmin') && (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>{t('settings.new-password')}</Text>
              <TextInput
                style={styles.input}
                value={profileForm.password}
                onChangeText={(text) => setProfileForm({ ...profileForm, password: text })}
                placeholder={t('settings.password-placeholder')}
                secureTextEntry
              />
              {profileForm.password.length > 0 && (
                <>
                  <Text style={[styles.label, { marginTop: 12 }]}>{t('settings.confirm-password')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profileForm.confirmPassword}
                    onChangeText={(text) => setProfileForm({ ...profileForm, confirmPassword: text })}
                    placeholder={t('settings.confirm-password-placeholder')}
                    secureTextEntry
                  />
                </>
              )}
            </View>
          )}

          {/* PIN (for staff/kitchen) */}
          {(profileData?.role === 'staff' || profileData?.role === 'kitchen') && (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>{t('settings.pin-label')}</Text>
              <TextInput
                style={styles.input}
                value={profileForm.pin}
                onChangeText={(text) => setProfileForm({ ...profileForm, pin: text })}
                placeholder={t('settings.pin-placeholder')}
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
            <Text style={styles.btnText}>{profileSaving ? t('settings.saving') : t('settings.save-changes')}</Text>
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
          Alert.alert(t('settings.logout'), t('settings.logout-msg'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('settings.logout'), onPress: () => navigation.navigate('Login'), style: 'destructive' },
          ]);
        }}
      >
        <Text style={styles.btnText}>{t('settings.logout')}</Text>
      </TouchableOpacity>

      {/* Version label — tap 7 times to reveal dev menu */}
      <TouchableOpacity onPress={handleDevTap} activeOpacity={1}>
        <Text style={{ textAlign: 'center', fontSize: 11, color: currentEnv !== ENVIRONMENTS['Production'] ? '#ef4444' : '#9ca3af', marginBottom: 8 }}>
          v1.0.0{currentEnv !== ENVIRONMENTS['Production'] ? ` • DEV MODE (${Object.entries(ENVIRONMENTS).find(([, url]) => url === currentEnv)?.[0] || 'Custom'})` : (showDevMenu ? ` • Production` : '')}
        </Text>
      </TouchableOpacity>

      {showDevMenu && (
        <View style={{ backgroundColor: '#1e1b4b', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <Text style={{ color: '#c7d2fe', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>Developer Mode</Text>
          <Text style={{ color: '#818cf8', fontSize: 11, marginBottom: 12 }}>API: {currentEnv}</Text>
          {Object.entries(ENVIRONMENTS).map(([name, url]) => (
            <TouchableOpacity
              key={name}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                padding: 12, borderRadius: 8, marginBottom: 6,
                backgroundColor: currentEnv === url ? '#312e81' : '#1e1b4b',
                borderWidth: 1, borderColor: currentEnv === url ? '#6366f1' : '#374151',
              }}
              onPress={() => currentEnv !== url && switchEnv(name, url)}
            >
              <View>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{name}</Text>
                <Text style={{ color: '#9ca3af', fontSize: 11 }}>{url}</Text>
              </View>
              {currentEnv === url && (
                <View style={{ backgroundColor: '#22c55e', width: 8, height: 8, borderRadius: 4 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );

  // Route to sub-page content
  const loadMenuSettings = async () => {
    setMenuSettingsLoading(true);
    try {
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/settings`);
      const s = res.data;
      const flags = s.feature_flags || {};
      const uiConf = s.ui_config || {};
      setAllowCustomFoodItems(flags.allow_custom_food_items === true);
      setMenuColumns((uiConf.menu_columns === 2 ? 2 : 1) as 1 | 2);
      setCustomItemLabel(uiConf.custom_item_label || '');
      setMenuSettingsLoaded(true);
    } catch (err: any) {
      console.warn('[MenuSettings] Failed to load:', err.message);
    } finally {
      setMenuSettingsLoading(false);
    }
  };

  const saveMenuSettings = async (patch: object) => {
    try {
      await apiClient.patch(`/api/restaurants/${restaurantId}/settings`, patch);
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('settings.settings-failed'));
    }
  };

  const loadFeatureFlags = async () => {
    setModuleFlagsLoading(true);
    try {
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/settings`);
      const flags = res.data?.feature_flags || {};
      setModuleFlags(flags);
      setModuleFlagsLoaded(true);
    } catch (err: any) {
      console.warn('[FeatureFlags] Failed to load:', err.message);
    } finally {
      setModuleFlagsLoading(false);
    }
  };

  const saveModuleFlag = async (key: string, value: boolean) => {
    setModuleFlags(prev => ({ ...prev, [key]: value }));
    try {
      await apiClient.patch(`/api/restaurants/${restaurantId}/settings`, {
        feature_flags: { [key]: value },
      });
    } catch (err: any) {
      setModuleFlags(prev => ({ ...prev, [key]: !value }));
      Alert.alert(t('common.error'), err.response?.data?.error || t('settings.settings-failed'));
    }
  };

  const MODULE_FLAG_DEFS: { key: string; labelKey: string; defaultLabel: string; descKey: string; defaultDesc: string }[] = [
    { key: 'bookings',             labelKey: 'settings.flag-bookings',          defaultLabel: 'Bookings',         descKey: 'settings.flag-bookings-desc',          defaultDesc: 'Table reservations module' },
    { key: 'waitlist',             labelKey: 'settings.flag-waitlist',          defaultLabel: 'Waitlist',         descKey: 'settings.flag-waitlist-desc',          defaultDesc: 'Queue / walk-in waitlist' },
    { key: 'crm',                  labelKey: 'settings.flag-crm',               defaultLabel: 'CRM',              descKey: 'settings.flag-crm-desc',               defaultDesc: 'Customer relationship management' },
    { key: 'coupons',              labelKey: 'settings.flag-coupons',           defaultLabel: 'Coupons',          descKey: 'settings.flag-coupons-desc',           defaultDesc: 'Discount coupons and promotions' },
    { key: 'service_requests',     labelKey: 'settings.flag-service-requests',  defaultLabel: 'Service Requests', descKey: 'settings.flag-service-requests-desc',  defaultDesc: 'Customer call-waiter / bill requests' },
  ];

  // ==================== SERVICE REQUESTS CRUD ====================

  const loadSrItems = async () => {
    setSrLoading(true);
    try {
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/service-request-items/all`);
      setSrItems(Array.isArray(res.data) ? res.data : []);
      setSrLoaded(true);
    } catch {
      Alert.alert(t('common.error'), 'Failed to load service request items');
    } finally {
      setSrLoading(false);
    }
  };

  const createSrItem = async () => {
    if (!srRequestType.trim() || !srLabelEn.trim()) {
      Alert.alert(t('common.error'), 'Request type and English label are required');
      return;
    }
    try {
      await apiClient.post(`/api/restaurants/${restaurantId}/service-request-items`, {
        request_type: srRequestType.trim(),
        label_en: srLabelEn.trim(),
        label_zh: srLabelZh.trim() || null,
        color: srColor,
        is_active: srIsActive,
      });
      setShowSrModal(false);
      await loadSrItems();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || 'Failed to create item');
    }
  };

  const saveSrItem = async () => {
    if (!editingSrItem) return;
    if (!srLabelEn.trim()) {
      Alert.alert(t('common.error'), 'English label is required');
      return;
    }
    try {
      await apiClient.patch(
        `/api/restaurants/${restaurantId}/service-request-items/${editingSrItem.id}`,
        { label_en: srLabelEn.trim(), label_zh: srLabelZh.trim() || null, color: srColor, is_active: srIsActive }
      );
      setShowSrModal(false);
      setEditingSrItem(null);
      await loadSrItems();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || 'Failed to save item');
    }
  };

  const deleteSrItem = (itemId: number) => {
    Alert.alert('Delete Item', 'Delete this service request item?', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/restaurants/${restaurantId}/service-request-items/${itemId}`);
            await loadSrItems();
          } catch {
            Alert.alert(t('common.error'), 'Failed to delete item');
          }
        },
      },
    ]);
  };

  const renderServiceRequestsPage = () => (
    <View style={styles.container}>
      {renderSubPageHeader('Service Requests')}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, { marginBottom: 12, alignSelf: 'flex-start' }]}
          onPress={() => {
            setEditingSrItem(null);
            setSrLabelEn('');
            setSrLabelZh('');
            setSrRequestType('');
            setSrColor('#4f46e5');
            setSrIsActive(true);
            setShowSrModal(true);
          }}
        >
          <Text style={styles.btnText}>+ Add Service Request Item</Text>
        </TouchableOpacity>
        {srLoading ? (
          <ActivityIndicator color="#3b82f6" style={{ marginTop: 24 }} />
        ) : srItems.length === 0 ? (
          <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 24 }}>No service request items yet.</Text>
        ) : (
          srItems.map(item => (
            <View key={item.id} style={{ flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
              <View style={{ flex: 1, padding: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color || '#4f46e5' }} />
                  <Text style={{ fontWeight: '700', fontSize: 13, flex: 1 }} numberOfLines={1}>{item.label_en}</Text>
                  <View style={{ backgroundColor: item.is_active ? '#d1fae5' : '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, color: item.is_active ? '#065f46' : '#991b1b', fontWeight: '600' }}>{item.is_active ? 'Active' : 'Off'}</Text>
                  </View>
                </View>
                {item.label_zh ? <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.label_zh}</Text> : null}
                <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Type: {item.request_type}</Text>
              </View>
              <View style={{ justifyContent: 'center', gap: 6, paddingHorizontal: 8 }}>
                <TouchableOpacity
                  style={{ backgroundColor: '#dbeafe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}
                  onPress={() => {
                    setEditingSrItem(item);
                    setSrLabelEn(item.label_en);
                    setSrLabelZh(item.label_zh || '');
                    setSrRequestType(item.request_type);
                    setSrColor(item.color || '#4f46e5');
                    setSrIsActive(item.is_active);
                    setShowSrModal(true);
                  }}
                >
                  <Text style={{ fontSize: 11, color: '#1d4ed8', fontWeight: '600' }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: '#fee2e2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}
                  onPress={() => deleteSrItem(item.id)}
                >
                  <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '600' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* SR Item Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showSrModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingSrItem ? 'Edit Service Request Item' : 'New Service Request Item'}</Text>

            {!editingSrItem && (
              <>
                <Text style={styles.label}>Request Type (unique key)</Text>
                <TextInput
                  style={styles.input}
                  value={srRequestType}
                  onChangeText={setSrRequestType}
                  placeholder="e.g. napkins, water"
                  autoCapitalize="none"
                />
              </>
            )}

            <Text style={styles.label}>English Label</Text>
            <TextInput style={styles.input} value={srLabelEn} onChangeText={setSrLabelEn} placeholder="e.g. Extra Napkins" />

            <Text style={styles.label}>Chinese Label (optional)</Text>
            <TextInput style={styles.input} value={srLabelZh} onChangeText={setSrLabelZh} placeholder="e.g. 额外纸巾" />

            <Text style={styles.label}>Color (hex)</Text>
            <TextInput style={styles.input} value={srColor} onChangeText={setSrColor} placeholder="#4f46e5" autoCapitalize="none" />

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}
              onPress={() => setSrIsActive(prev => !prev)}
            >
              <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#3b82f6', backgroundColor: srIsActive ? '#3b82f6' : '#fff', justifyContent: 'center', alignItems: 'center' }}>
                {srIsActive && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 14, color: '#374151' }}>Active</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => { setShowSrModal(false); setEditingSrItem(null); }}>
                <Text style={styles.btnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={editingSrItem ? saveSrItem : createSrItem}>
                <Text style={styles.btnText}>{editingSrItem ? 'Save' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderFeatureFlagsPage = () => {
    if (moduleFlagsLoading) {
      return (
        <View style={styles.container}>
          {renderSubPageHeader(t('settings.feature-flags') || 'Feature Flags')}
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        {renderSubPageHeader(t('settings.feature-flags') || 'Feature Flags')}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.feature-flags-modules') || 'Modules'}</Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              {t('settings.feature-flags-hint') || 'Disabled modules are hidden from all users of this restaurant.'}
            </Text>

            {MODULE_FLAG_DEFS.map((def, idx) => {
              const isOn = moduleFlags[def.key] !== false; // default true (opt-out)
              return (
                <View
                  key={def.key}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: idx < MODULE_FLAG_DEFS.length - 1 ? 1 : 0,
                    borderBottomColor: '#e5e7eb',
                  }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.label}>{t(def.labelKey) || def.defaultLabel}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t(def.descKey) || def.defaultDesc}</Text>
                  </View>
                  <Switch
                    value={isOn}
                    onValueChange={(val) => saveModuleFlag(def.key, val)}
                    trackColor={{ false: '#d1d5db', true: '#6366f1' }}
                    thumbColor="#ffffff"
                  />
                </View>
              );
            })}
          </View>

        </ScrollView>
      </View>
    );
  };

  const renderMenuSettingsPage = () => {
    if (menuSettingsLoading) {
      return (
        <View style={styles.container}>
          {renderSubPageHeader(t('admin.menu-settings') || 'Menu Settings')}
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        {renderSubPageHeader(t('admin.menu-settings') || 'Menu Settings')}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>

          {/* Admin Portal section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.menu-settings-admin-portal') || 'Admin Portal'}</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.label}>{t('admin.custom-food-item') || 'Custom Food Item'}</Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t('admin.custom-food-item-desc') || 'Allow staff to add free-text custom items to orders'}</Text>
              </View>
              <Switch
                value={allowCustomFoodItems}
                onValueChange={(val) => {
                  setAllowCustomFoodItems(val);
                  saveMenuSettings({ feature_flags: { allow_custom_food_items: val } });
                }}
              />
            </View>
            <View style={{ paddingVertical: 12, opacity: allowCustomFoodItems ? 1 : 0.45 }}>
              <Text style={styles.label}>Default Item Label</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Name shown on the custom item card (staff can change it per order)</Text>
              <TextInput
                style={styles.input}
                value={customItemLabel}
                onChangeText={setCustomItemLabel}
                placeholder="Custom Item"
                editable={allowCustomFoodItems}
                onBlur={() => allowCustomFoodItems && saveMenuSettings({ ui_config: { custom_item_label: customItemLabel.trim() || null } })}
              />
            </View>
          </View>

          {/* Customer Menu section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.menu-settings-customer-menu') || 'Customer Menu'}</Text>

            <Text style={[styles.label, { marginBottom: 10 }]}>{t('admin.menu-layout') || 'Menu Layout'}</Text>
            {([1, 2] as const).map((cols) => (
              <TouchableOpacity
                key={cols}
                style={[styles.option, menuColumns === cols && styles.optionActive]}
                onPress={() => {
                  setMenuColumns(cols);
                  saveMenuSettings({ ui_config: { menu_columns: cols } });
                }}
              >
                <Text style={[styles.optionText, menuColumns === cols && styles.optionTextActive]}>
                  {cols === 1 ? (t('admin.single-column') || 'Single Column') : (t('admin.two-column') || 'Two Columns')}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 6, padding: 10, marginTop: 16 }}>
              <Text style={{ fontSize: 12, color: '#0369a1' }}>
                <Text style={{ fontWeight: '600' }}>{t('admin.image-tip-title') || 'Image tip: '}</Text>
                {t('admin.image-tip-desc') || 'Optimal food image size is 800 × 600 px (4:3 ratio).'}
              </Text>
            </View>
          </View>

        </ScrollView>
      </View>
    );
  };

  const renderCurrentPage = () => {
    switch (settingsPage) {
      case 'language': return renderLanguagePage();
      case 'restaurant-info': return renderRestaurantInfoPage();
      case 'printer': return renderPrinterPage();
      case 'crm': return renderCrmPage();
      case 'payment-terminals': return renderPaymentTerminalsPage();
      case 'qr-settings': return renderQRSettingsPage();
      case 'staff-links': return renderStaffLinksPage();
      case 'coupons': return renderCouponsPage();
      case 'variant-presets': return renderVariantPresetsPage();
      case 'addon-presets': return renderAddonPresetsPage();
      case 'menu-settings':
        if (!menuSettingsLoading && !menuSettingsLoaded) loadMenuSettings();
        return renderMenuSettingsPage();
      case 'feature-flags':
        if (!moduleFlagsLoading && !moduleFlagsLoaded) loadFeatureFlags();
        return renderFeatureFlagsPage();
      case 'service-requests':
        if (!srLoading && !srLoaded) loadSrItems();
        return renderServiceRequestsPage();
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

      {/* CRM Order Detail Modal */}
      <Modal
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        visible={!!crmOrderDetail || crmOrderDetailLoading}
        animationType="slide"
        transparent
        onRequestClose={() => { setCrmOrderDetail(null); setCrmOrderDetailLoading(false); }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                {crmOrderDetail ? `Order #${crmOrderDetail.restaurant_order_number || crmOrderDetail.id}` : 'Loading…'}
              </Text>
              <TouchableOpacity onPress={() => { setCrmOrderDetail(null); setCrmOrderDetailLoading(false); }}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {crmOrderDetailLoading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#4f46e5" />
              </View>
            ) : crmOrderDetail ? (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>📅 {formatDate(crmOrderDetail.created_at)}</Text>
                  {crmOrderDetail.table_name ? <Text style={{ fontSize: 12, color: '#6b7280' }}>🪑 {crmOrderDetail.table_name}</Text> : null}
                  {crmOrderDetail.order_type ? <Text style={{ fontSize: 12, color: '#6b7280' }}>📦 {crmOrderDetail.order_type}</Text> : null}
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>💳 {crmOrderDetail.payment_method_label || crmOrderDetail.payment_method_online || '—'}</Text>
                </View>
                {(crmOrderDetail.items || []).map((item: any) => (
                  <View key={item.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 }}>
                        {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.menu_item_name || '—'}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#059669', fontWeight: '600' }}>
                        {formatCurrency(item.item_total_cents)}
                      </Text>
                    </View>
                    {item.variants ? <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{item.variants}</Text> : null}
                    {(item.addons || []).map((addon: any) => (
                      <View key={addon.order_item_id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 12, marginTop: 2 }}>
                        <Text style={{ fontSize: 11, color: '#6b7280' }}>+ {addon.menu_item_name}</Text>
                        <Text style={{ fontSize: 11, color: '#6b7280' }}>{formatCurrency(addon.item_total_cents)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>Total</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#059669' }}>{formatCurrency(crmOrderDetail.total_cents)}</Text>
                  </View>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Coupon Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showCouponModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingCouponId ? (t('settings.edit-coupon') || 'Edit Coupon') : t('settings.create-coupon')}</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('settings.coupon-code')}</Text>
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
              <Text style={styles.label}>{t('settings.discount-type')}</Text>
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
                    {t('settings.percentage')}
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
                    {t('settings.fixed')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('settings.discount-value')}</Text>
              <TextInput
                style={styles.input}
                value={couponForm.discount_value}
                onChangeText={(text) =>
                  setCouponForm({ ...couponForm, discount_value: text })
                }
                placeholder={t('settings.amount')}
                keyboardType="decimal-pad"
                inputAccessoryViewID="numpadDone"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('settings.min-order')}</Text>
              <TextInput
                style={styles.input}
                value={couponForm.min_order_value}
                onChangeText={(text) =>
                  setCouponForm({ ...couponForm, min_order_value: text })
                }
                placeholder={t('settings.min-order-placeholder')}
                keyboardType="decimal-pad"
                inputAccessoryViewID="numpadDone"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('settings.coupon-desc')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                value={couponForm.description}
                onChangeText={(text) =>
                  setCouponForm({ ...couponForm, description: text })
                }
                placeholder={t('settings.coupon-desc-placeholder')}
                multiline
              />
            </View>

            {/* Coupon access type */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('settings.coupon-access-type') || 'Access Type'}</Text>
              <View style={styles.toggleGroup}>
                <TouchableOpacity
                  style={[styles.typeBtn, couponForm.coupon_type === 'open' && styles.typeBtnActive]}
                  onPress={() => setCouponForm({ ...couponForm, coupon_type: 'open' })}
                >
                  <Text style={[styles.typeBtnText, couponForm.coupon_type === 'open' && styles.typeBtnTextActive]}>
                    {t('settings.coupon-open') || 'Open'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, couponForm.coupon_type === 'closed' && styles.typeBtnActive]}
                  onPress={() => setCouponForm({ ...couponForm, coupon_type: 'closed' })}
                >
                  <Text style={[styles.typeBtnText, couponForm.coupon_type === 'closed' && styles.typeBtnTextActive]}>
                    {t('settings.coupon-closed') || 'Closed'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                {couponForm.coupon_type === 'open'
                  ? (t('settings.coupon-open-desc') || 'Anyone with the code can use this coupon')
                  : (t('settings.coupon-closed-desc') || 'Only customers you assign this coupon to can use it')}
              </Text>
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => {
                  setShowCouponModal(false);
                  resetCouponForm();
                }}
              >
                <Text style={styles.btnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={createCoupon}
              >
                <Text style={styles.btnText}>{editingCouponId ? (t('common.save') || 'Save') : t('settings.create')}</Text>
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
              <Text style={styles.modalTitle}>{t('settings.coupon-details')}</Text>
              <TouchableOpacity onPress={() => { setShowCouponDetailModal(false); setSelectedCoupon(null); }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            {selectedCoupon && (
              <View style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('settings.code')}</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', letterSpacing: 1 }}>{selectedCoupon.code}</Text>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('settings.discount')}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#059669' }}>
                    {selectedCoupon.discount_type === 'percentage' ? `${selectedCoupon.discount_value}% off` : `$${selectedCoupon.discount_value} off`}
                  </Text>
                </View>
                {(selectedCoupon.minimum_order_value > 0 || selectedCoupon.min_order_value > 0) && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('settings.min-order-label')}</Text>
                    <Text style={{ fontSize: 14, color: '#1f2937' }}>${selectedCoupon.minimum_order_value || selectedCoupon.min_order_value}</Text>
                  </View>
                )}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('settings.coupon-access-type') || 'Access Type'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ backgroundColor: selectedCoupon.coupon_type === 'closed' ? '#fef3c7' : '#dcfce7', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: selectedCoupon.coupon_type === 'closed' ? '#b45309' : '#15803d' }}>
                        {selectedCoupon.coupon_type === 'closed' ? (t('settings.coupon-closed') || 'Closed') : (t('settings.coupon-open') || 'Open')}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#6b7280' }}>
                      {selectedCoupon.coupon_type === 'closed'
                        ? (t('settings.coupon-closed-desc') || 'Assigned customers only')
                        : (t('settings.coupon-open-desc') || 'Anyone with the code')}
                    </Text>
                  </View>
                </View>
                {selectedCoupon.description ? (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('settings.description')}</Text>
                    <Text style={{ fontSize: 14, color: '#6b7280' }}>{selectedCoupon.description}</Text>
                  </View>
                ) : null}
                <View style={[styles.formActions, { marginTop: 16 }]}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={() => { setShowCouponDetailModal(false); setSelectedCoupon(null); }}
                  >
                    <Text style={styles.btnText}>{t('settings.close')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary]}
                    onPress={() => openEditCoupon(selectedCoupon)}
                  >
                    <Text style={styles.btnText}>{t('common.edit') || 'Edit'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: '#fee2e2' }]}
                    onPress={() => {
                      Alert.alert(t('settings.delete-coupon'), `${selectedCoupon.code}?`, [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('common.delete'), style: 'destructive', onPress: async () => {
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

      {/* Assign Coupon to Customer Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showAssignCouponModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.assign-coupon') || 'Assign Coupon'}</Text>
              <TouchableOpacity onPress={() => setShowAssignCouponModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {coupons.filter(c => c.coupon_type === 'closed').length === 0 ? (
                <Text style={[styles.emptyText, { padding: 16 }]}>
                  {t('settings.no-closed-coupons') || 'No closed coupons available. Create a closed coupon first.'}
                </Text>
              ) : (
                coupons.filter(c => c.coupon_type === 'closed').map(coupon => (
                  <TouchableOpacity
                    key={coupon.id}
                    style={[styles.couponCard]}
                    onPress={() => {
                      if (assignCouponCustomerId) {
                        assignCouponToCustomer(assignCouponCustomerId, coupon.id);
                        setShowAssignCouponModal(false);
                      }
                    }}
                  >
                    <Text style={styles.couponCode}>{coupon.code}</Text>
                    <Text style={styles.couponValue}>
                      {coupon.discount_type === 'percentage' ? `${coupon.discount_value}% off` : `$${coupon.discount_value} off`}
                    </Text>
                    {coupon.description ? <Text style={styles.couponDesc}>{coupon.description}</Text> : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary, { marginTop: 12 }]} onPress={() => setShowAssignCouponModal(false)}>
              <Text style={styles.btnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Payment Terminal Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showPaymentTerminalModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: 0 }]}>
            <Text style={styles.modalTitle}>
              {editingTerminalId ? t('settings.edit-terminal') : t('settings.add-terminal-title')}
            </Text>

            <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
            {/* Vendor selector - superadmin only */}
            {isSuperadmin && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('settings.payment-vendor')}</Text>
              <View>
                {(['kpay', 'payment-asia', 'payment-asia-offline', 'other'] as const).map((vendor) => (
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
                        {vendor === 'kpay' ? 'KPay'
                          : vendor === 'payment-asia' ? 'Payment Asia (Online · Cloud Gateway)'
                          : vendor === 'payment-asia-offline' ? 'Payment Asia (Offline · Physical Terminal)'
                          : t('settings.other')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            )}

            {/* Non-superadmin: show vendor as read-only label */}
            {!isSuperadmin && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('settings.payment-vendor')}</Text>
                <Text style={{ fontSize: 14, color: '#6b7280', paddingVertical: 8 }}>
                  {terminalForm.vendor_name === 'kpay' ? 'KPay'
                    : terminalForm.vendor_name === 'payment-asia' ? 'Payment Asia (Online)'
                    : terminalForm.vendor_name === 'payment-asia-offline' ? 'Payment Asia (Offline)'
                    : 'Other'}
                </Text>
              </View>
            )}

            {/* App ID - superadmin only, KPay/other only */}
            {isSuperadmin && terminalForm.vendor_name !== 'payment-asia' && terminalForm.vendor_name !== 'payment-asia-offline' && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('settings.app-id')}</Text>
              <TextInput
                style={styles.input}
                value={terminalForm.app_id}
                onChangeText={(text) => setTerminalForm({ ...terminalForm, app_id: text })}
                placeholder={t('settings.enter-app-id')}
              />
            </View>
            )}

            {/* App Secret - superadmin only, KPay/other only */}
            {isSuperadmin && terminalForm.vendor_name !== 'payment-asia' && terminalForm.vendor_name !== 'payment-asia-offline' && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('settings.app-secret')}</Text>
              <TextInput
                style={styles.input}
                value={terminalForm.app_secret}
                onChangeText={(text) => setTerminalForm({ ...terminalForm, app_secret: text })}
                placeholder={t('settings.enter-app-secret')}
                secureTextEntry
              />
            </View>
            )}

            {/* Terminal IP - KPay only */}
            {terminalForm.vendor_name === 'kpay' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('settings.terminal-ip')}</Text>
                  <TextInput
                    style={styles.input}
                    value={terminalForm.terminal_ip}
                    onChangeText={(text) => setTerminalForm({ ...terminalForm, terminal_ip: text })}
                    placeholder="e.g., 192.168.50.210"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('settings.terminal-port')}</Text>
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
                  <Text style={styles.label}>{t('settings.api-endpoint')}</Text>
                  <TextInput
                    style={styles.input}
                    value={terminalForm.endpoint_path}
                    onChangeText={(text) => setTerminalForm({ ...terminalForm, endpoint_path: text })}
                    placeholder="e.g., /v2/pos/sign"
                  />
                </View>
              </>
            )}

            {/* Payment Asia fields - superadmin only */}
            {terminalForm.vendor_name === 'payment-asia' && isSuperadmin && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('settings.merchant-token')}</Text>
                  <TextInput
                    style={styles.input}
                    value={terminalForm.merchant_token}
                    onChangeText={(text) => setTerminalForm({ ...terminalForm, merchant_token: text })}
                    placeholder={t('settings.enter-merchant-token')}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('settings.secret-code')}</Text>
                  <TextInput
                    style={styles.input}
                    value={terminalForm.secret_code}
                    onChangeText={(text) => setTerminalForm({ ...terminalForm, secret_code: text })}
                    placeholder={t('settings.enter-secret-code')}
                    secureTextEntry
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('settings.environment')}</Text>
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

            {/* Payment Asia (Offline) fields - superadmin only */}
            {terminalForm.vendor_name === 'payment-asia-offline' && isSuperadmin && (
              <>
                <View style={[styles.formGroup, { backgroundColor: '#fffbeb', borderRadius: 6, padding: 10, borderWidth: 1, borderColor: '#fcd34d' }]}>
                  <Text style={{ fontSize: 12, color: '#92400e' }}>
                    ⚠️ PA Offline terminals communicate directly over your local network (LAN). The iOS app pings the terminal IP directly.
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Terminal IP Address</Text>
                  <TextInput
                    style={styles.input}
                    value={terminalForm.pa_offline_ip}
                    onChangeText={(text) => setTerminalForm({ ...terminalForm, pa_offline_ip: text })}
                    placeholder="e.g., 192.168.1.100"
                    autoCapitalize="none"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Terminal Port</Text>
                  <TextInput
                    style={styles.input}
                    value={terminalForm.pa_offline_port}
                    onChangeText={(text) => setTerminalForm({ ...terminalForm, pa_offline_port: text })}
                    placeholder="e.g., 8080"
                    keyboardType="number-pad"
                    inputAccessoryViewID="numpadDone"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>API Key</Text>
                  <TextInput
                    style={styles.input}
                    value={terminalForm.pa_offline_api_key}
                    onChangeText={(text) => setTerminalForm({ ...terminalForm, pa_offline_api_key: text })}
                    placeholder="Enter API Key"
                    secureTextEntry
                  />
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
                  {terminalTestResult.success ? t('settings.connection-success') : t('settings.connection-failed')}
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
                <Text style={styles.btnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              
              {editingTerminalId && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnSmall, { backgroundColor: '#f59e0b', flex: 1 }]}
                  onPress={testPaymentTerminal}
                  disabled={testingTerminal}
                >
                  <Text style={styles.btnText}>{testingTerminal ? t('settings.testing') : t('settings.test')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={savePaymentTerminal}
              >
                <Text style={styles.btnText}>{editingTerminalId ? t('settings.update') : t('settings.create')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Mode Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showQRModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('settings.select-qr-mode')}</Text>

            {([
              { mode: 'regenerate' as const, label: t('settings.regenerate'), desc: t('settings.regenerate-desc') },
              { mode: 'static_table' as const, label: t('settings.static-table'), desc: t('settings.static-table-desc') },
              { mode: 'static_seat' as const, label: t('settings.static-seat'), desc: t('settings.static-seat-desc') },
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
                    Alert.alert(t('common.success'), t('settings.qr-mode-updated'));
                  } catch {
                    Alert.alert(t('common.error'), t('settings.qr-mode-failed'));
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
              <Text style={styles.btnText}>{t('settings.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Staff QR Code Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showStaffQRModal} transparent animationType="slide">
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>{t('settings.staff-qr-title')}</Text>
              <TouchableOpacity onPress={() => setShowStaffQRModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrModalBody}>
              <Text style={styles.qrModalDescription}>
                {t('settings.staff-qr-desc')}
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
                  <Text style={styles.btnText}>{t('settings.share-qr')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => setShowStaffQRModal(false)}
            >
              <Text style={styles.btnText}>{t('settings.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Kitchen QR Code Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showKitchenQRModal} transparent animationType="slide">
        <View style={styles.qrModalOverlay}>
          <View style={styles.qrModalContent}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>{t('settings.kitchen-qr-title')}</Text>
              <TouchableOpacity onPress={() => setShowKitchenQRModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrModalBody}>
              <Text style={styles.qrModalDescription}>
                {t('settings.kitchen-qr-desc')}
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
                  <Text style={styles.btnText}>{t('settings.share-qr')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => setShowKitchenQRModal(false)}
            >
              <Text style={styles.btnText}>{t('settings.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Variant Presets Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showVariantPresetsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.variant-modal-title')}</Text>
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
                          t('settings.add-option-title'),
                          t('settings.option-name-prompt'),
                          [
                            {
                              text: t('common.cancel'),
                              style: 'cancel',
                            },
                            {
                              text: t('common.add'),
                              onPress: async (name: string | undefined) => {
                                if (!name) return;
                                // Prompt for price
                                Alert.prompt(
                                  t('settings.option-price-title') || 'Option Price',
                                  t('settings.option-price-prompt') || 'Price in cents (0 for no extra charge)',
                                  [
                                    { text: t('common.cancel'), style: 'cancel' },
                                    {
                                      text: t('common.add'),
                                      onPress: async (priceStr: string | undefined) => {
                                        try {
                                          const priceCents = parseInt(priceStr || '0') || 0;
                                          await apiClient.post(
                                            `/api/restaurants/${restaurantId}/variant-presets/${selectedVariantPreset.id}/options`,
                                            { name, price_cents: priceCents }
                                          );
                                          // Reload the preset to show new option
                                          const res = await apiClient.get(
                                            `/api/restaurants/${restaurantId}/variant-presets/${selectedVariantPreset.id}`
                                          );
                                          const optionsRes = await apiClient.get(
                                            `/api/restaurants/${restaurantId}/variant-presets/${selectedVariantPreset.id}/options`
                                          );
                                          setSelectedVariantPreset({
                                            ...res.data,
                                            variants: Array.isArray(optionsRes.data) ? optionsRes.data : [],
                                          });
                                          await fetchVariantPresets();
                                        } catch (err: any) {
                                          Alert.alert(t('common.error'), err.response?.data?.error || 'Failed to add option');
                                        }
                                      },
                                    },
                                  ],
                                  'plain-text',
                                  '0'
                                );
                              },
                            },
                          ],
                          'plain-text'
                        );
                      }}
                    >
                      <Text style={styles.btnText}>{t('settings.add-option')}</Text>
                    </TouchableOpacity>

                    <Text style={styles.variantsLabel}>{t('settings.options-in', { '0': selectedVariantPreset.name })}</Text>
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
                              onPress={() => {
                                Alert.prompt(
                                  t('common.edit'),
                                  t('settings.option-name'),
                                  [
                                    { text: t('common.cancel'), style: 'cancel' },
                                    {
                                      text: t('common.next'),
                                      onPress: (newName) => {
                                        if (!newName?.trim()) return;
                                        Alert.prompt(
                                          t('common.edit'),
                                          t('settings.option-price'),
                                          [
                                            { text: t('common.cancel'), style: 'cancel' },
                                            {
                                              text: t('common.save'),
                                              onPress: async (priceStr) => {
                                                try {
                                                  const priceCents = parseInt(priceStr || '0') || 0;
                                                  await apiClient.patch(
                                                    `/api/restaurants/${restaurantId}/variant-presets/${selectedVariantPreset!.id}/options/${option.id}`,
                                                    { name: newName.trim(), price_cents: priceCents }
                                                  );
                                                  const res = await apiClient.get(
                                                    `/api/restaurants/${restaurantId}/variant-presets/${selectedVariantPreset!.id}`
                                                  );
                                                  const optionsRes = await apiClient.get(
                                                    `/api/restaurants/${restaurantId}/variant-presets/${selectedVariantPreset!.id}/options`
                                                  );
                                                  setSelectedVariantPreset({
                                                    ...res.data,
                                                    variants: Array.isArray(optionsRes.data) ? optionsRes.data : [],
                                                  });
                                                  await fetchVariantPresets();
                                                } catch (err: any) {
                                                  Alert.alert(t('common.error'), err.response?.data?.error || 'Failed to update option');
                                                }
                                              },
                                            },
                                          ],
                                          'plain-text',
                                          String(option.price_cents || 0)
                                        );
                                      },
                                    },
                                  ],
                                  'plain-text',
                                  option.name
                                );
                              }}
                            >
                              <Text style={[styles.btnSmallText, { color: '#1e40af' }]}>{t('common.edit')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.btn, styles.btnSmall, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}
                              onPress={() =>
                                Alert.alert(
                                  t('common.delete'),
                                  `${option.name}?`,
                                  [
                                    { text: t('common.cancel'), style: 'cancel' },
                                    {
                                      text: t('common.delete'),
                                      style: 'destructive',
                                      onPress: async () => {
                                        try {
                                          await apiClient.delete(
                                            `/api/restaurants/${restaurantId}/variant-presets/${selectedVariantPreset!.id}/options/${option.id}`
                                          );
                                          const res = await apiClient.get(
                                            `/api/restaurants/${restaurantId}/variant-presets/${selectedVariantPreset!.id}`
                                          );
                                          const optionsRes = await apiClient.get(
                                            `/api/restaurants/${restaurantId}/variant-presets/${selectedVariantPreset!.id}/options`
                                          );
                                          setSelectedVariantPreset({
                                            ...res.data,
                                            variants: Array.isArray(optionsRes.data) ? optionsRes.data : [],
                                          });
                                          await fetchVariantPresets();
                                        } catch (err: any) {
                                          Alert.alert(t('common.error'), err.response?.data?.error || 'Failed to delete option');
                                        }
                                      },
                                    },
                                  ]
                                )
                              }
                            >
                              <Text style={[styles.btnSmallText, { color: '#991b1b' }]}>{t('common.delete')}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyText}>{t('settings.no-options')}</Text>
                    )}
                  </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={() => setSelectedVariantPreset(null)}
                  >
                    <Text style={styles.btnText}>{t('settings.back-btn')}</Text>
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
                      <Text style={styles.emptyText}>{t('settings.no-variant-presets-modal')}</Text>
                    )}
                  </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={() => setShowVariantPresetsModal(false)}
                  >
                    <Text style={styles.btnText}>{t('settings.close')}</Text>
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
  crmSortRow: {
    marginTop: 12,
    marginBottom: 12,
  },
  crmSortChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  crmSortChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  crmSortChipActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  crmSortChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  crmSortChipTextActive: {
    color: '#fff',
  },
  crmListWrap: {
    marginTop: 4,
  },
  crmCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  crmCustomerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crmCustomerAvatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  crmCustomerMeta: {
    flex: 1,
  },
  crmCustomerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  crmCustomerSubline: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  crmCustomerSpendBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  crmCustomerSpend: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  crmLoadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  crmLoadMoreBtn: {
    marginTop: 12,
  },
  crmLoadMoreText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13,
  },
  crmBackToListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  crmBackToListText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 13,
  },
  crmProfileHero: {
    backgroundColor: '#4338ca',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  crmProfileHeroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crmProfileHeroAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  crmProfileName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  crmProfileContact: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 3,
  },
  crmStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  crmStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  crmStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  crmStatLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  crmHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 10,
  },
  crmHistoryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  crmHistoryMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 3,
  },
  crmOrderAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  crmStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  crmStatusBadgeUpcoming: {
    backgroundColor: '#dcfce7',
  },
  crmStatusBadgePast: {
    backgroundColor: '#e5e7eb',
  },
  crmStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  crmStatusBadgeTextUpcoming: {
    color: '#166534',
  },
  crmStatusBadgeTextPast: {
    color: '#4b5563',
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
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
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
