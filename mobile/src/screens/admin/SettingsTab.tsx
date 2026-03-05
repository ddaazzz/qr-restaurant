import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Switch } from 'react-native';
import { apiClient } from '../../services/apiClient';

interface RestaurantSettings {
  id: number;
  name: string;
  timezone?: string;
  service_charge_fee?: number;
  currency?: string;
}

interface SettingsTabProps {
  restaurantId: string;
  navigation: any;
}

export const SettingsTab = ({ restaurantId, navigation }: SettingsTabProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [printerEnabled, setPrinterEnabled] = useState(false);

  const fetchSettings = async () => {
    try {
      setError(null);
      const response = await apiClient.get<RestaurantSettings>(`/api/restaurants/${restaurantId}`);
      setSettings(response.data);
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [restaurantId]);

  const handlePrinterToggle = async (value: boolean) => {
    setPrinterEnabled(value);
    if (value) {
      Alert.alert('Printer Configuration', 'Bluetooth printer support is enabled. Ensure your device has Bluetooth enabled.');
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
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Restaurant</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Name</Text>
          <Text style={styles.settingValue}>{settings?.name || 'N/A'}</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Timezone</Text>
          <Text style={styles.settingValue}>{settings?.timezone || 'UTC'}</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Currency</Text>
          <Text style={styles.settingValue}>{settings?.currency || 'USD'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Printer</Text>
        <View style={styles.toggleItem}>
          <View>
            <Text style={styles.settingLabel}>Bluetooth Printer</Text>
            <Text style={styles.settingDescription}>Enable Bluetooth for receipt printing</Text>
          </View>
          <Switch 
            value={printerEnabled} 
            onValueChange={handlePrinterToggle}
            trackColor={{ false: '#ccc', true: '#81c784' }}
            thumbColor={printerEnabled ? '#4caf50' : '#f1f1f1'}
          />
        </View>
        {printerEnabled && (
          <TouchableOpacity style={styles.configButton}>
            <Text style={styles.configButtonText}>⚙️ Configure Printer</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fees & Charges</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Service Charge</Text>
          <Text style={styles.settingValue}>
            {settings?.service_charge_fee ? `${settings.service_charge_fee}%` : 'Not set'}
          </Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchSettings} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingVertical: 16,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    backgroundColor: '#f9fafb',
    color: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  settingValue: {
    fontSize: 14,
    color: '#6b7280',
  },
  settingDescription: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  configButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0369a1',
  },
  configButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369a1',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fee',
    marginHorizontal: 12,
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#c33',
    fontSize: 13,
    marginBottom: 8,
  },
  retryBtn: {
    backgroundColor: '#c33',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
