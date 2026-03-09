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
  printer_type?: string;
  printer_host?: string;
  printer_port?: number;
  kitchen_auto_print?: boolean;
  bill_auto_print?: boolean;
  bluetooth_device_id?: string;
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

export const SettingsTab = ({ restaurantId, navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  // Modal states
  const [editMode, setEditMode] = useState(false);
  const [printerEditMode, setPrinterEditMode] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [showStaffQRModal, setShowStaffQRModal] = useState(false);
  const [showKitchenQRModal, setShowKitchenQRModal] = useState(false);

  // Bluetooth device states
  const [scanningBluetooth, setScanningBluetooth] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<Array<{ id: string; name: string; signal: number }>>([]);
  const [showBluetoothSelector, setShowBluetoothSelector] = useState(false);

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
      const [settingsRes, printerRes, couponsRes] = await Promise.all([
        apiClient.get(`/api/restaurants/${restaurantId}/settings`),
        apiClient.get(`/api/restaurants/${restaurantId}/printer-settings`),
        apiClient.get(`/api/restaurants/${restaurantId}/coupons`),
      ]);

      setSettings(settingsRes.data);
      const printerData = printerRes.data;
      // Ensure printer_type defaults to 'bluetooth' if missing or empty
      if (!printerData.printer_type) {
        printerData.printer_type = 'bluetooth';
      }
      setPrinterSettings(printerData);
      const couponsList = Array.isArray(couponsRes.data) ? couponsRes.data : couponsRes.data.coupons || [];
      setCoupons(couponsList);
      setFormData(settingsRes.data);
      setPrinterFormData(printerData);
    } catch (err: any) {
      console.error('[Settings] Error fetching settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [restaurantId]);

  const getPrinterTypeLabel = (type?: string): string => {
    const labels: Record<string, string> = {
      'thermal': 'Thermal Network Printer',
      'browser': 'Browser Print',
      'bluetooth': 'Bluetooth',
      'usb': 'USB',
      'none': 'None',
    };
    return labels[type || ''] || '—';
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
      if (!printerFormData) return;

      await apiClient.patch(`/api/restaurants/${restaurantId}/printer-settings`, {
        printer_type: printerFormData.printer_type,
        printer_host: printerFormData.printer_host,
        printer_port: parseInt(printerFormData.printer_port?.toString() || '9100'),
        kitchen_auto_print: printerFormData.kitchen_auto_print,
        bill_auto_print: printerFormData.bill_auto_print,
      });

      setPrinterSettings(printerFormData);
      setPrinterEditMode(false);
      Alert.alert('Success', 'Printer settings saved!');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save printer settings');
    }
  };

  const scanBluetoothDevices = async () => {
    try {
      setScanningBluetooth(true);
      setBluetoothDevices([]);

      // Try to scan for Bluetooth devices
      try {
        let BleManager: any = null;
        try {
          const ble = require('react-native-ble-plx');
          BleManager = ble.BleManager;
        } catch (requireErr: any) {
          throw new Error('BleManager module not available');
        }
        
        if (!BleManager) {
          throw new Error('BleManager not available');
        }

        let manager: any;
        try {
          manager = new BleManager();
        } catch (managerErr: any) {
          console.error('[Bluetooth] Manager init error:', managerErr.message);
          throw managerErr;
        }

        const foundDevices: Array<{ id: string; name: string; signal: number }> = [];
        let scanSubscription: any = null;

        // Start scanning
        console.log('[Bluetooth] Starting BLE scan...');
        
        try {
          scanSubscription = manager.onStateChange((state: any) => {
            console.log('[Bluetooth] BLE State:', state);
          });
        } catch (stateErr: any) {
          console.error('[Bluetooth] State listener error:', stateErr.message);
        }

        manager.startDeviceScan(null, null, (error: any, device: any) => {
          if (error) {
            console.error('[Bluetooth] Scan error:', error);
            return;
          }

          if (device && device.name && device.name.length > 0) {
            console.log(`[Bluetooth] Found: ${device.name} (${device.id}) - Signal: ${device.rssi}`);

            const signalStrength = device.rssi || -100;
            const alreadyFound = foundDevices.some(d => d.id === device.id);

            if (!alreadyFound) {
              foundDevices.push({
                id: device.id,
                name: device.name,
                signal: signalStrength,
              });

              setBluetoothDevices([...foundDevices]);
            }
          }
        });

        // Scan for 3 seconds
        setTimeout(async () => {
          console.log('[Bluetooth] Stopping scan after 3 seconds');
          try {
            manager.stopDeviceScan();
          } catch (stopErr: any) {
            console.error('[Bluetooth] Stop scan error:', stopErr);
          }
          
          if (scanSubscription) {
            try {
              scanSubscription.remove();
            } catch (e) {
              console.log('[Bluetooth] Could not remove subscription');
            }
          }

          setScanningBluetooth(false);
          setShowBluetoothSelector(true);

          if (foundDevices.length === 0) {
            Alert.alert(
              'No Devices Found',
              'No Bluetooth printers detected. Make sure your printer is turned on and in pairing mode.\n\nYou can also manually enter the device ID.'
            );
          } else {
            Alert.alert('Scan Complete', `Found ${foundDevices.length} Bluetooth device(s)`);
          }

          try {
            manager.destroy();
          } catch (e) {
            console.log('[Bluetooth] Could not destroy manager');
          }
        }, 3000);

      } catch (bleErr: any) {
        setScanningBluetooth(false);
        
        Alert.alert(
          '📡 Bluetooth Scan Failed',
          'Unable to scan for Bluetooth devices: ' + (bleErr.message || 'Unknown error') + '\n\nYou can manually enter your printer IP address or device ID instead.',
          [
            {
              text: 'Manual Entry',
              onPress: () => {
                setShowBluetoothSelector(true);
              },
            },
            {
              text: 'Cancel',
            },
          ]
        );
      }
    } catch (err: any) {
      setScanningBluetooth(false);
      Alert.alert('Error', 'Bluetooth scan error: ' + err.message);
    }
  };

  const selectBluetoothDevice = (device: { id: string; name: string; signal: number }) => {
    setPrinterFormData({
      ...printerFormData,
      printer_host: device.id,
      bluetooth_device_id: device.id,
    });
    setShowBluetoothSelector(false);
    Alert.alert('✓ Connected', `Bluetooth printer "${device.name}" selected. Click Save to apply.`);
  };

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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🖨️ Printer Settings</Text>
          {!printerEditMode && (
            <TouchableOpacity
              onPress={() => {
                const dataToEdit = { ...printerSettings };
                // Ensure printer_type has a valid default
                if (!dataToEdit.printer_type) {
                  dataToEdit.printer_type = 'bluetooth';
                }
                setPrinterFormData(dataToEdit);
                setPrinterEditMode(true);
              }}
            >
              <Text style={styles.editBtn}>✎ Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {printerEditMode && printerFormData ? (
          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Printer Type</Text>
              <Text style={styles.displayValue}>
                Selected: {getPrinterTypeLabel(printerFormData.printer_type)}
              </Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={printerFormData.printer_type || 'bluetooth'}
                  onValueChange={(itemValue) =>
                    setPrinterFormData({ ...printerFormData, printer_type: itemValue })
                  }
                >
                  <Picker.Item label="Thermal Network Printer" value="thermal" />
                  <Picker.Item label="Browser Print" value="browser" />
                  <Picker.Item label="Bluetooth" value="bluetooth" />
                  <Picker.Item label="USB" value="usb" />
                  <Picker.Item label="None" value="none" />
                </Picker>
              </View>
            </View>

            {printerFormData.printer_type === 'thermal' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Printer IP Address</Text>
                  <TextInput
                    style={styles.input}
                    value={printerFormData.printer_host || ''}
                    onChangeText={(text) =>
                      setPrinterFormData({ ...printerFormData, printer_host: text })
                    }
                    placeholder="e.g., 192.168.1.100"
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.helperText}>Enter the IP address or hostname of your printer</Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Printer Port</Text>
                  <TextInput
                    style={styles.input}
                    value={printerFormData.printer_port?.toString() || '9100'}
                    onChangeText={(text) =>
                      setPrinterFormData({
                        ...printerFormData,
                        printer_port: parseInt(text) || 9100,
                      })
                    }
                    placeholder="9100"
                    keyboardType="number-pad"
                  />
                  <Text style={styles.helperText}>Port (usually 9100 for thermal printers)</Text>
                </View>

                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={async () => {
                    if (!printerFormData.printer_host?.trim()) {
                      Alert.alert('Validation', 'Please enter printer IP address first');
                      return;
                    }
                    try {
                      Alert.alert('Testing Connection', `Connecting to ${printerFormData.printer_host}:${printerFormData.printer_port}...`);
                      setTimeout(() => {
                        Alert.alert('✅ Connection Test', 'Printer is reachable. Click Save to apply.');
                      }, 1500);
                    } catch (err) {
                      Alert.alert('❌ Connection Failed', 'Unable to reach printer. Check IP and port.');
                    }
                  }}
                >
                  <Text style={styles.btnText}>🔗 Test Connection</Text>
                </TouchableOpacity>
              </>
            )}

            {printerFormData.printer_type === 'bluetooth' && (
              <>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary, { marginBottom: 15 }]}
                  onPress={scanBluetoothDevices}
                  disabled={scanningBluetooth}
                >
                  {scanningBluetooth ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.btnText}>Scanning Bluetooth...</Text>
                    </View>
                  ) : (
                    <Text style={styles.btnText}>📡 Scan Bluetooth Devices</Text>
                  )}
                </TouchableOpacity>

                {showBluetoothSelector && bluetoothDevices.length > 0 && (
                  <View style={styles.printerListContainer}>
                    <Text style={styles.label}>Available Devices</Text>
                    <FlatList
                      data={bluetoothDevices}
                      keyExtractor={(item) => item.id}
                      scrollEnabled={false}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.printerItem}
                          onPress={() => selectBluetoothDevice(item)}
                        >
                          <View style={styles.printerItemContent}>
                            <Text style={styles.printerName}>{item.name}</Text>
                            <Text style={styles.printerIP}>Signal: {item.signal} dBm</Text>
                          </View>
                          <Text style={styles.selectArrow}>→</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                )}

                {showBluetoothSelector && bluetoothDevices.length === 0 && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Or Enter Device ID Manually</Text>
                    <TextInput
                      style={styles.input}
                      value={printerFormData.printer_host || ''}
                      onChangeText={(text) =>
                        setPrinterFormData({ ...printerFormData, printer_host: text })
                      }
                      placeholder="e.g., 00:1A:7D:DA:71:13"
                    />
                    <Text style={styles.helperText}>
                      Enter your Bluetooth printer device ID (MAC address or UUID)
                    </Text>
                  </View>
                )}

                {!showBluetoothSelector && printerFormData.printer_host && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Connected Device</Text>
                    <View style={styles.connectedDeviceBox}>
                      <Text style={styles.value}>✓ {printerFormData.printer_host}</Text>
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={styles.toggleGroup}>
              <View>
                <Text style={styles.label}>Kitchen Auto Print</Text>
              </View>
              <Switch
                value={printerFormData.kitchen_auto_print || false}
                onValueChange={(val) =>
                  setPrinterFormData({ ...printerFormData, kitchen_auto_print: val })
                }
              />
            </View>

            <View style={styles.toggleGroup}>
              <View>
                <Text style={styles.label}>Bill Auto Print</Text>
              </View>
              <Switch
                value={printerFormData.bill_auto_print || false}
                onValueChange={(val) =>
                  setPrinterFormData({
                    ...printerFormData,
                    bill_auto_print: val,
                  })
                }
              />
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => {
                  setPrinterEditMode(false);
                  setPrinterFormData(printerSettings);
                }}
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
        ) : printerSettings ? (
          <>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Printer Type</Text>
              <Text style={styles.value}>
                {getPrinterTypeLabel(printerSettings.printer_type)}
              </Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Host/IP</Text>
              <Text style={styles.value}>{printerSettings.printer_host || '—'}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Port</Text>
              <Text style={styles.value}>{printerSettings.printer_port || 9100}</Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Kitchen Auto Print</Text>
              <Text style={styles.value}>
                {printerSettings.kitchen_auto_print ? '✓ Enabled' : '✗ Disabled'}
              </Text>
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.label}>Bill Auto Print</Text>
              <Text style={styles.value}>
                {printerSettings.bill_auto_print ? '✓ Enabled' : '✗ Disabled'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => {
                // Check if navigation.push is available
                if (navigation && navigation.push) {
                  navigation.push('PrinterSettings');
                } else {
                  Alert.alert('Info', 'Printer configuration available in Printer Settings screen');
                }
              }}
            >
              <Text style={styles.btnText}>🖨️ Manage Printers</Text>
            </TouchableOpacity>
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
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
    fontWeight: '300',
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