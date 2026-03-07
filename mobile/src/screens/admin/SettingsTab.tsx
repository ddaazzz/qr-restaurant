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
} from 'react-native';
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
      setPrinterSettings(printerRes.data);
      const couponsList = Array.isArray(couponsRes.data) ? couponsRes.data : couponsRes.data.coupons || [];
      setCoupons(couponsList);
      setFormData(settingsRes.data);
      setPrinterFormData(printerRes.data);
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
                setPrinterFormData(printerSettings);
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
              <TextInput
                style={styles.input}
                value={printerFormData.printer_type || ''}
                onChangeText={(text) =>
                  setPrinterFormData({ ...printerFormData, printer_type: text })
                }
                placeholder="e.g., thermal, bluetooth, usb"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Printer Host/IP</Text>
              <TextInput
                style={styles.input}
                value={printerFormData.printer_host || ''}
                onChangeText={(text) =>
                  setPrinterFormData({ ...printerFormData, printer_host: text })
                }
                placeholder="e.g., 192.168.1.100"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Port</Text>
              <TextInput
                style={styles.input}
                value={printerFormData.printer_port?.toString() || '9100'}
                onChangeText={(text) =>
                  setPrinterFormData({
                    ...printerFormData,
                    printer_port: parseInt(text) || 9100,
                  })
                }
                keyboardType="number-pad"
              />
            </View>

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
              <Text style={styles.value}>{printerSettings.printer_type || '—'}</Text>
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
          </>
        ) : null}
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
});
