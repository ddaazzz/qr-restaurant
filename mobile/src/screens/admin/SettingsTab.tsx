import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import QRCode from 'react-native-qrcode-svg';
import { apiClient } from '../../services/apiClient';
import { printerSettingsService } from '../../services/printerSettingsService';

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
}

interface VariantPreset {
  id: number;
  name: string;
  description?: string;
  variants_count: number;
  variants?: Variant[];
}

export const SettingsTab = ({ restaurantId, navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [variantPresets, setVariantPresets] = useState<VariantPreset[]>([]);

  // Modal states
  const [editMode, setEditMode] = useState(false);
  const [showingPrinterSettingsPage, setShowingPrinterSettingsPage] = useState(false);
  const [editingPrinterType, setEditingPrinterType] = useState<'qr' | 'bill' | 'kitchen' | null>(null);
  const [bluetoothSearching, setBluetoothSearching] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<Array<{ id: string; name: string; signal: number }>>([]);
  // Modal state: 'printer' | 'bluetooth' | null
  const [activeModal, setActiveModal] = useState<'printer' | 'bluetooth' | null>(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [showVariantPresetsModal, setShowVariantPresetsModal] = useState(false);
  const [selectedVariantPreset, setSelectedVariantPreset] = useState<VariantPreset | null>(null);
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [showStaffQRModal, setShowStaffQRModal] = useState(false);
  const [showKitchenQRModal, setShowKitchenQRModal] = useState(false);

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
      // Fetched printer data from API
      // Ensure printer_type defaults to 'bluetooth' if missing or empty
      if (!printerData.printer_type) {
        console.log('[Settings] Printer type was null/empty, setting to bluetooth');
        printerData.printer_type = 'bluetooth';
      }
      // Printer type set
      setPrinterSettings(printerData);
      setFormData(settingsRes.data);
      setPrinterFormData(printerData);

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

  useEffect(() => {
    fetchSettings();
    fetchVariantPresets();
  }, [restaurantId]);

  const getPrinterTypeLabel = (type?: string): string => {
    const labels: Record<string, string> = {
      'thermal': 'Thermal Network Printer',
      'bluetooth': 'Bluetooth Printer',
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

      const prefix = editingPrinterType; // 'qr', 'bill', or 'kitchen'
      const payload: any = {};

      // Save to per-printer-type columns: {prefix}_printer_type, {prefix}_printer_host, etc.
      payload[`${prefix}_printer_type`] = printerFormData.printer_type;
      payload[`${prefix}_printer_host`] = printerFormData.printer_host;
      payload[`${prefix}_printer_port`] = parseInt((printerFormData.printer_port as any)?.toString() || '9100');

      // Include Bluetooth device info if it's a bluetooth printer
      if (printerFormData.printer_type === 'bluetooth') {
        payload[`${prefix}_bluetooth_device_id`] = printerFormData.bluetooth_device_id;
        payload[`${prefix}_bluetooth_device_name`] = printerFormData.bluetooth_device_name;
      } else {
        // Clear bluetooth fields if switching away from bluetooth
        payload[`${prefix}_bluetooth_device_id`] = null;
        payload[`${prefix}_bluetooth_device_name`] = null;
      }

      // Save auto-print flag for the specific printer type
      if (editingPrinterType === 'bill') {
        payload.bill_auto_print = printerFormData.bill_auto_print || false;
      } else if (editingPrinterType === 'kitchen') {
        payload.kitchen_auto_print = printerFormData.kitchen_auto_print || false;
      } else if (editingPrinterType === 'qr') {
        payload.qr_auto_print = printerFormData.qr_auto_print || false;
      }

      // Save printer paper width if provided
      if (printerFormData.printer_paper_width) {
        payload.printer_paper_width = printerFormData.printer_paper_width;
      }

      console.log(`[SettingsTab] Saving ${editingPrinterType} printer settings with payload:`, payload);

      await apiClient.patch(`/api/restaurants/${restaurantId}/printer-settings`, payload);

      // Update local state with new data
      setPrinterSettings({ ...printerSettings, ...payload } as PrinterSettings);
      
      // Invalidate cache so next fetch gets fresh data from backend
      printerSettingsService.invalidateCache(restaurantId);
      
      setEditingPrinterType(null);
      setActiveModal(null);
      Alert.alert('Success', `${editingPrinterType.toUpperCase()} printer settings saved!`);
    } catch (err: any) {
      console.error('[SettingsTab] Error saving printer settings:', err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to save printer settings');
    }
  };

  const startBluetoothSearch = async () => {
    try {
      setBluetoothSearching(true);
      setBluetoothDevices([]);

      let BleManager: any = null;
      try {
        const ble = require('react-native-ble-plx');
        BleManager = ble.BleManager;
      } catch (e) {
        setBluetoothSearching(false);
        Alert.alert('Error', 'Bluetooth not available on this device');
        return;
      }

      if (!BleManager) {
        setBluetoothSearching(false);
        Alert.alert('Error', 'Bluetooth not available');
        return;
      }

      const manager = new BleManager();

      // Wait for BLE to be ready
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const checkState = async () => {
          try {
            const state = await manager.state();
            if (state === 'PoweredOn') {
              resolve();
            } else if (++attempts < 10) {
              setTimeout(checkState, 200);
            } else {
              resolve();
            }
          } catch (e) {
            if (++attempts < 10) setTimeout(checkState, 200);
            else resolve();
          }
        };
        checkState();
      });

      // Start scanning
      const subscription = manager.onStateChange((state: any) => {
        if (state === 'PoweredOn') {
          manager.startDeviceScan(null, null, (error: any, device: any) => {
            if (error) {
              console.error('Scan error:', error);
              return;
            }

            if (device && device.name) {
              setBluetoothDevices((prev) => {
                const exists = prev.find((d) => d.id === device.id);
                if (!exists) {
                  return [...prev, { id: device.id, name: device.name || 'Unknown', signal: device.rssi || 0 }];
                }
                return prev;
              });
            }
          });

          // Stop scanning after 10 seconds
          setTimeout(() => {
            manager.stopDeviceScan();
            setBluetoothSearching(false);
            if (subscription) subscription.remove();
          }, 10000);
        }
      }, true);
    } catch (err: any) {
      setBluetoothSearching(false);
      Alert.alert('Error', 'Failed to scan Bluetooth devices: ' + err.message);
    }
  };

  const selectBluetoothDevice = (device: { id: string; name: string; signal: number }) => {
    if (!editingPrinterType) return;

    // Backend has generic bluetooth_device_id and bluetooth_device_name fields (not prefixed)
    setPrinterFormData({
      ...printerFormData,
      bluetooth_device_id: device.id,
      bluetooth_device_name: device.name,
    } as PrinterSettings);

    setActiveModal('printer');
    Alert.alert('✓ Device Selected', `"${device.name}" has been selected for your printer.`);
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

  // Printer Settings Full Page View
  if (showingPrinterSettingsPage) {
    return (
      <View style={styles.container}>
        {/* Page Header */}
        <View style={{ padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.printerPageTitle}>🖨️ Printer Settings</Text>
          <TouchableOpacity onPress={() => setShowingPrinterSettingsPage(false)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* QR Code Printer */}
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomWidth: 0, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 12, marginHorizontal: 16, marginTop: 16 }]}
            onPress={() => {
              setEditingPrinterType('qr');
              setPrinterFormData(printerSettings);
              setActiveModal('printer');
            }}
          >
            <Text style={[styles.label, { fontSize: 14, fontWeight: '600', marginBottom: 8 }]}>📋 QR Code Printer</Text>
            <Text style={styles.value}>Type: {getPrinterTypeLabel(printerSettings?.printer_type)}</Text>
            {printerSettings?.printer_host && <Text style={styles.value}>Host: {printerSettings.printer_host}</Text>}
            <Text style={styles.value}>Auto-Print: ✓ Enabled</Text>
            <Text style={[styles.value, { fontSize: 11, color: '#6b7280', marginTop: 4 }]}>Tap to edit</Text>
          </TouchableOpacity>

          {/* Bill Printer */}
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomWidth: 0, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 12, marginHorizontal: 16 }]}
            onPress={() => {
              setEditingPrinterType('bill');
              setPrinterFormData(printerSettings);
              setActiveModal('printer');
            }}
          >
            <Text style={[styles.label, { fontSize: 14, fontWeight: '600', marginBottom: 8 }]}>🧾 Bill Printer</Text>
            <Text style={styles.value}>Type: {getPrinterTypeLabel(printerSettings?.printer_type)}</Text>
            {printerSettings?.printer_host && <Text style={styles.value}>Host: {printerSettings.printer_host}</Text>}
            <Text style={styles.value}>Auto-Print: {printerSettings?.bill_auto_print ? '✓ On' : '✗ Off'}</Text>
            <Text style={[styles.value, { fontSize: 11, color: '#6b7280', marginTop: 4 }]}>Tap to edit</Text>
          </TouchableOpacity>

          {/* Kitchen Order Printer */}
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomWidth: 0, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 12, marginHorizontal: 16 }]}
            onPress={() => {
              setEditingPrinterType('kitchen');
              setPrinterFormData(printerSettings);
              setActiveModal('printer');
            }}
          >
            <Text style={[styles.label, { fontSize: 14, fontWeight: '600', marginBottom: 8 }]}>🍳 Kitchen Order Printer</Text>
            <Text style={styles.value}>Type: {getPrinterTypeLabel(printerSettings?.printer_type)}</Text>
            {printerSettings?.printer_host && <Text style={styles.value}>Host: {printerSettings.printer_host}</Text>}
            <Text style={styles.value}>Auto-Print: {printerSettings?.kitchen_auto_print ? '✓ On' : '✗ Off'}</Text>
            <Text style={[styles.value, { fontSize: 11, color: '#6b7280', marginTop: 4 }]}>Tap to edit</Text>
          </TouchableOpacity>

          {activeModal === 'printer' && editingPrinterType && (
            <Modal
              transparent={true}
              visible={true}
              animationType="slide"
              onRequestClose={() => setActiveModal(null)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {editingPrinterType === 'qr' && '📋 QR Code Printer'}
                      {editingPrinterType === 'bill' && '🧾 Bill Printer'}
                      {editingPrinterType === 'kitchen' && '🍳 Kitchen Order Printer'}
                    </Text>
                    <TouchableOpacity onPress={() => setActiveModal(null)}>
                      <Text style={styles.closeButton}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.modalBody}>
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
                              : false
                          }
                          onValueChange={(value) => {
                            if (editingPrinterType === 'bill') {
                              setPrinterFormData({ ...printerFormData, bill_auto_print: value } as PrinterSettings);
                            } else if (editingPrinterType === 'kitchen') {
                              setPrinterFormData({ ...printerFormData, kitchen_auto_print: value } as PrinterSettings);
                            } else if (editingPrinterType === 'qr') {
                              setPrinterFormData({ ...printerFormData, qr_auto_print: value } as PrinterSettings);
                            }
                          }}
                        />
                      </View>
                    </View>

                    {/* Printer Type Selector */}
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Printer Type</Text>
                      <View>
                        {['thermal', 'bluetooth'].map((type) => (
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

                    {/* Thermal Printer Config */}
                    {printerFormData?.printer_type === 'thermal' && (
                      <>
                        <View style={styles.formGroup}>
                          <Text style={styles.label}>IP Address</Text>
                          <TextInput
                            style={styles.input}
                            value={printerFormData.printer_host || ''}
                            onChangeText={(text) => setPrinterFormData({ ...printerFormData, printer_host: text } as PrinterSettings)}
                            placeholder="e.g., 192.168.1.100"
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.label}>Port</Text>
                          <TextInput
                            style={styles.input}
                            value={(printerFormData.printer_port || 9100).toString()}
                            onChangeText={(text) => setPrinterFormData({ ...printerFormData, printer_port: parseInt(text) || 9100 } as PrinterSettings)}
                            keyboardType="number-pad"
                            placeholder="9100"
                          />
                        </View>
                      </>
                    )}

                    {/* Bluetooth Printer Config */}
                    {printerFormData?.printer_type === 'bluetooth' && (
                      <>
                        <View style={styles.formGroup}>
                          <Text style={styles.label}>Paired Device</Text>
                          <Text style={styles.value}>{printerFormData.bluetooth_device_name || 'Select a device'}</Text>
                        </View>

                        <TouchableOpacity
                          style={styles.button}
                          onPress={() => {
                            setEditingPrinterType(editingPrinterType);
                            setActiveModal('bluetooth');
                          }}
                        >
                          <Text style={styles.buttonText}>🔍 Search Devices</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </ScrollView>

                  <View style={styles.formActions}>
                    <TouchableOpacity style={[styles.button, { flex: 1, marginRight: 8 }]} onPress={savePrinterSettings}>
                      <Text style={styles.buttonText}>💾 Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => setActiveModal(null)}>
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Restaurant Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏪 Restaurant Information</Text>
          {!editMode && (
            <TouchableOpacity
              onPress={() => {
                setFormData(settings);
                setEditMode(true);
              }}
            >
              <Text style={styles.editBtn}>✎ Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {editMode && formData ? (
          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Restaurant Name</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Enter restaurant name"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, { minHeight: 80 }]}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder="Enter address"
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Timezone</Text>
              <TextInput
                style={styles.input}
                value={formData.timezone}
                onChangeText={(text) => setFormData({ ...formData, timezone: text })}
                placeholder="e.g., UTC, EST, PST"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Preferred Language</Text>
              <TextInput
                style={styles.input}
                value={formData.language_preference}
                onChangeText={(text) => setFormData({ ...formData, language_preference: text })}
                placeholder="e.g., en, es, fr"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Service Charge (%)</Text>
              <TextInput
                style={styles.input}
                value={formData.service_charge_percent?.toString() || '0'}
                onChangeText={(text) =>
                  setFormData({ ...formData, service_charge_percent: parseFloat(text) || 0 })
                }
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Logo URL</Text>
              <TextInput
                style={styles.input}
                value={formData.logo_url || ''}
                onChangeText={(text) => setFormData({ ...formData, logo_url: text })}
                placeholder="https://..."
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Background URL</Text>
              <TextInput
                style={styles.input}
                value={formData.background_url || ''}
                onChangeText={(text) => setFormData({ ...formData, background_url: text })}
                placeholder="https://..."
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Booking Time Allowance (minutes)</Text>
              <TextInput
                style={styles.input}
                value={formData.booking_time_allowance_mins?.toString() || '30'}
                onChangeText={(text) =>
                  setFormData({ ...formData, booking_time_allowance_mins: parseInt(text) || 30 })
                }
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => {
                  setEditMode(false);
                  setFormData(settings);
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={saveSettings}>
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : settings ? (
          <>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{settings.name}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{settings.phone || '—'}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>{settings.address || '—'}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Timezone</Text>
              <Text style={styles.value}>{settings.timezone || 'UTC'}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Preferred Language</Text>
              <Text style={styles.value}>{settings.language_preference || '—'}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Service Charge</Text>
              <Text style={styles.value}>{settings.service_charge_percent || 0} %</Text>
            </View>
            {settings.logo_url && (
              <View style={styles.settingItem}>
                <Text style={styles.label}>Logo</Text>
                <Text style={styles.value}>✓ Uploaded</Text>
              </View>
            )}
            {settings.background_url && (
              <View style={styles.settingItem}>
                <Text style={styles.label}>Background</Text>
                <Text style={styles.value}>✓ Uploaded</Text>
              </View>
            )}
          </>
        ) : null}
      </View>

      {/* Printer Settings */}
      <View style={styles.section}>
        <TouchableOpacity
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 }}
          onPress={() => setShowingPrinterSettingsPage(true)}
        >
          <Text style={styles.sectionTitle}>🖨️ Printer Settings</Text>
          <Text style={{ fontSize: 18, color: '#6b7280' }}>→</Text>
        </TouchableOpacity>

        {printerSettings && !showingPrinterSettingsPage ? (
          <>
            {/* Quick preview of printer settings */}
            <View style={[styles.settingItem, { borderBottomWidth: 0, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 12 }]}>
              <Text style={styles.label}>Configured Printers</Text>
              <Text style={styles.value}>QR Code, Bill, Kitchen Order</Text>
              <Text style={[styles.value, { fontSize: 11, color: '#6b7280', marginTop: 4 }]}>Tap header to manage</Text>
            </View>
          </>
        ) : null}
              <Modal
                transparent={true}
                visible={true}
                animationType="slide"
                onRequestClose={() => setActiveModal(null)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>
                        {editingPrinterType === 'qr' && '📋 QR Code Printer'}
                        {editingPrinterType === 'bill' && '🧾 Bill Printer'}
                        {editingPrinterType === 'kitchen' && '🍳 Kitchen Order Printer'}
                      </Text>
                      <TouchableOpacity onPress={() => setActiveModal(null)}>
                        <Text style={styles.closeButton}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalBody}>
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
                                : false
                            }
                            onValueChange={(value) => {
                              if (editingPrinterType === 'bill') {
                                setPrinterFormData({ ...printerFormData, bill_auto_print: value } as PrinterSettings);
                              } else if (editingPrinterType === 'kitchen') {
                                setPrinterFormData({ ...printerFormData, kitchen_auto_print: value } as PrinterSettings);
                              } else if (editingPrinterType === 'qr') {
                                setPrinterFormData({ ...printerFormData, qr_auto_print: value } as PrinterSettings);
                              }
                            }}
                          />
                        </View>
                      </View>

                      {/* Printer Type Selector */}
                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Printer Type</Text>
                        <View>
                          {['thermal', 'bluetooth'].map((type) => (
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

                      {/* Thermal Printer Config */}
                      {printerFormData?.printer_type === 'thermal' && (
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
                            />
                          </View>
                        </>
                      )}

                      {/* Network Printer Config - REMOVED */}
                      {/* System supports Thermal and Bluetooth only */}

                      {/* Bluetooth Config */}
                      {printerFormData?.printer_type === 'bluetooth' && (
                        <View style={styles.formGroup}>
                          <Text style={styles.label}>Bluetooth Device</Text>
                          <TouchableOpacity
                            style={[styles.input, { paddingVertical: 12, borderColor: '#3b82f6', borderWidth: 1 }]}
                            onPress={() => setActiveModal('bluetooth')}
                          >
                            <Text style={{ color: printerFormData?.bluetooth_device_name ? '#1f2937' : '#9ca3af' }}>
                              {printerFormData?.bluetooth_device_name ? `✓ ${printerFormData?.bluetooth_device_name}` : '🔍 Tap to scan devices'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Browser Printer Config - REMOVED */}
                      {/* System supports Thermal and Bluetooth only */}

                      {/* Printer Paper Width (for thermal/bluetooth printers) */}
                      {(printerFormData?.printer_type === 'thermal' || printerFormData?.printer_type === 'bluetooth') && (
                        <View style={styles.formGroup}>
                          <Text style={styles.label}>Printer Paper Width</Text>
                          <Text style={styles.helperText}>Select based on your printer model (affects QR code size)</Text>
                          <View>
                            {[
                              { value: 80, label: '80mm (Standard)' },
                              { value: 58, label: '58mm (Compact)' },
                            ].map((option) => (
                              <TouchableOpacity
                                key={option.value}
                                style={{ paddingVertical: 8 }}
                                onPress={() => {
                                  setPrinterFormData({ 
                                    ...printerFormData, 
                                    printer_paper_width: option.value 
                                  } as PrinterSettings);
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <View
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 9,
                                      borderWidth: 2,
                                      borderColor: (printerFormData?.printer_paper_width || 80) === option.value ? '#3b82f6' : '#d1d5db',
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                    }}
                                  >
                                    {(printerFormData?.printer_paper_width || 80) === option.value && (
                                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' }} />
                                    )}
                                  </View>
                                  <Text style={{ marginLeft: 10, fontSize: 14, color: '#1f2937' }}>{option.label}</Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}
                    </ScrollView>

                    {/* Modal Footer */}
                    <View style={styles.formActions}>
                      <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary]}
                        onPress={() => setActiveModal(null)}
                      >
                        <Text style={styles.btnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btn, styles.btnPrimary]}
                        onPress={savePrinterSettings}
                      >
                        <Text style={styles.btnText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            )}

            {/* Bluetooth Device Search Modal */}
            <Modal
              transparent={true}
              visible={activeModal === 'bluetooth'}
              animationType="slide"
              onRequestClose={() => setActiveModal('printer')}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>🔍 Search Bluetooth Devices</Text>
                    <TouchableOpacity onPress={() => setActiveModal('printer')}>
                      <Text style={styles.closeButton}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalBody}>
                    <TouchableOpacity
                      style={[styles.btn, styles.btnPrimary, { marginBottom: 16 }]}
                      onPress={startBluetoothSearch}
                      disabled={bluetoothSearching}
                    >
                      <Text style={styles.btnText}>{bluetoothSearching ? '🔄 Scanning...' : '🔍 Scan for Devices'}</Text>
                    </TouchableOpacity>

                    {bluetoothDevices.length > 0 ? (
                      <ScrollView style={{ maxHeight: 300 }}>
                        {bluetoothDevices.map((device) => (
                          <TouchableOpacity
                            key={device.id}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: '#e5e7eb',
                              paddingVertical: 12,
                              paddingHorizontal: 8,
                            }}
                            onPress={() => selectBluetoothDevice(device)}
                          >
                            <Text style={{ fontSize: 14, fontWeight: '500', color: '#1f2937' }}>{device.name}</Text>
                            <Text style={{ fontSize: 12, color: '#6b7280' }}>Signal: {device.signal} dBm</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    ) : bluetoothSearching ? (
                      <Text style={styles.helperText}>Searching for devices...</Text>
                    ) : (
                      <Text style={styles.helperText}>Click "Scan for Devices" to search for nearby Bluetooth devices</Text>
                    )}
                  </View>

                  <View style={styles.formActions}>
                    <TouchableOpacity
                      style={[styles.btn, styles.btnSecondary]}
                      onPress={() => setActiveModal('printer')}
                    >
                      <Text style={styles.btnText}>Back</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        ) : (
          <>
            <Text style={styles.emptyText}>No printer settings configured</Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => {
                if (navigation && navigation.push) {
                  navigation.push('PrinterSettings');
                }
              }}
            >
              <Text style={styles.btnText}>🖨️ Configure Printer</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* QR Code Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 QR Code Settings</Text>
        {settings && (
          <>
            <View style={styles.settingItem}>
              <Text style={styles.label}>QR Mode</Text>
              <Text style={styles.value}>{settings.qr_mode || 'regenerate'}</Text>
            </View>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => setShowQRModal(true)}
            >
              <Text style={styles.btnText}>Change QR Mode</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Staff & Kitchen Login QR Codes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔑 Staff & Kitchen Login QR Codes</Text>
        <Text style={styles.sectionDescription}>
          Share these QR codes with your staff. Each staff member scans their unique QR code to login with their PIN.
        </Text>
        <View style={styles.qrCodeContainer}>
          <TouchableOpacity
            style={styles.qrCodeButton}
            onPress={() => setShowStaffQRModal(true)}
          >
            <Text style={styles.qrCodeButtonText}>👤 View Staff QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.qrCodeButton, styles.kitchenQRButton]}
            onPress={() => setShowKitchenQRModal(true)}
          >
            <Text style={styles.qrCodeButtonText}>🍳 View Kitchen QR Code</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.qrCodeHint}>
          Tap the buttons above to view the QR codes and share them with your staff.
        </Text>
      </View>

      {/* Coupons */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🎟️ Coupons</Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnSmall, styles.btnPrimary]}
            onPress={() => setShowCouponModal(true)}
          >
            <Text style={styles.btnSmallText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {coupons.length > 0 ? (
          <FlatList
            data={coupons}
            renderItem={({ item: coupon }) => (
              <View style={styles.couponCard}>
                <View>
                  <Text style={styles.couponCode}>{coupon.code}</Text>
                  <Text style={styles.couponValue}>
                    {coupon.discount_type === 'percentage'
                      ? `${coupon.discount_value}%`
                      : `$${coupon.discount_value}`}
                  </Text>
                  {coupon.description && (
                    <Text style={styles.couponDesc}>{coupon.description}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteCoupon(coupon.id)}
                >
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.emptyText}>No coupons yet</Text>
        )}
      </View>

      {/* Variant Presets */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏷️ Variant Presets</Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnSmall, styles.btnPrimary]}
            onPress={() => {
              // Show create preset dialog
              Alert.prompt(
                '➕ Create Variant Preset',
                'Enter variant title (e.g., "Drink Size", "Temperature")',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Create',
                    onPress: (name) => {
                      if (name) {
                        // For now, log the intent - API integration would go here
                        Alert.alert('Success', `Preset "${name}" created! You can now add options.`);
                      }
                    },
                  },
                ],
                'plain-text'
              );
            }}
          >
            <Text style={styles.btnSmallText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {variantPresets.length > 0 ? (
          <FlatList
            data={variantPresets}
            renderItem={({ item: preset }) => (
              <TouchableOpacity
                style={styles.presetCard}
                onPress={() => {
                  setSelectedVariantPreset(preset);
                }}
              >
                <View style={styles.presetCardHeader}>
                  <View>
                    <Text style={styles.presetName}>{preset.name}</Text>
                    {preset.description && (
                      <Text style={styles.presetDescription}>{preset.description}</Text>
                    )}
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

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Logout Button */}
      <TouchableOpacity
        style={[styles.btn, styles.btnDanger, { marginVertical: 12 }]}
        onPress={() => {
          Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Logout',
              onPress: () => navigation.navigate('Login'),
              style: 'destructive',
            },
          ]);
        }}
      >
        <Text style={styles.btnText}>🚪 Logout</Text>
      </TouchableOpacity>

      {/* Coupon Modal */}
      <Modal visible={showCouponModal} transparent animationType="fade">
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

      {/* QR Mode Modal */}
      <Modal visible={showQRModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select QR Mode</Text>

            {(['regenerate', 'static_table', 'static_seat'] as const).map((mode) => (
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
                  {mode === 'regenerate'
                    ? 'Regenerate (Per Order)'
                    : mode === 'static_table'
                      ? 'Static (Per Table)'
                      : 'Static (Per Seat)'}
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
      <Modal visible={showStaffQRModal} transparent animationType="slide">
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
                  <Text style={styles.btnText}>📤 Share QR Code</Text>
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
      <Modal visible={showKitchenQRModal} transparent animationType="slide">
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
                  <Text style={styles.btnText}>📤 Share QR Code</Text>
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
      <Modal visible={showVariantPresetsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🏷️ Variant Presets</Text>
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
                          '➕ Add New Option',
                          'Enter option name (e.g., "Small", "Medium", "Large")',
                          [
                            {
                              text: 'Cancel',
                              style: 'cancel',
                            },
                            {
                              text: 'Add',
                              onPress: (name) => {
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
                              <Text style={[styles.btnSmallText, { color: '#1e40af' }]}>✏️</Text>
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
                              <Text style={[styles.btnSmallText, { color: '#991b1b' }]}>🗑️</Text>
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
                      <Text style={styles.emptyText}>📋 No variant presets created yet</Text>
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  btnPrimary: {
    backgroundColor: '#3b82f6',
    flex: 1,
  },
  btnSecondary: {
    backgroundColor: '#e5e7eb',
    flex: 1,
  },
  btnDanger: {
    backgroundColor: '#dc2626',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
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
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
    fontWeight: '300',
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
