import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { apiClient } from '../services/apiClient';

interface PrinterSettings {
  printer_type?: string;
  printer_host?: string;
  printer_port?: number;
  kitchen_auto_print?: boolean;
  bill_auto_print?: boolean;
}

export const PrinterSettingsScreen = ({ route, navigation }: any) => {
  const restaurantId = route?.params?.restaurantId || '';
  
  const [printerType, setPrinterType] = useState('network');
  const [printerHost, setPrinterHost] = useState('');
  const [printerPort, setPrinterPort] = useState('9100');
  const [testPrinting, setTestPrinting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load printer settings on mount
  useEffect(() => {
    loadPrinterSettings();
  }, []);

  const loadPrinterSettings = async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/printer-settings`);
      if (res.data) {
        setPrinterType(res.data.printer_type || 'network');
        setPrinterHost(res.data.printer_host || '');
        setPrinterPort(res.data.printer_port?.toString() || '9100');
      }
    } catch (err) {
      console.log('Error loading printer settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const savePrinterSettings = async () => {
    if (!restaurantId) {
      Alert.alert('Error', 'No restaurant ID');
      return;
    }
    if (!printerHost.trim()) {
      Alert.alert('Validation', 'Please enter printer IP address or hostname');
      return;
    }

    setSaving(true);
    try {
      await apiClient.patch(
        `/api/restaurants/${restaurantId}/printer-settings`,
        {
          printer_type: printerType,
          printer_host: printerHost.trim(),
          printer_port: parseInt(printerPort) || 9100,
        }
      );
      Alert.alert('✅ Success', 'Printer settings saved successfully');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save printer settings');
    } finally {
      setSaving(false);
    }
  };

  const testPrinterConnection = async () => {
    if (!restaurantId) {
      Alert.alert('Error', 'No restaurant ID');
      return;
    }
    if (!printerHost.trim()) {
      Alert.alert('Validation', 'Please enter printer IP address first');
      return;
    }

    setTestPrinting(true);
    try {
      const res = await apiClient.post(
        `/api/restaurants/${restaurantId}/test-printer`,
        {
          printer_type: printerType,
          printer_host: printerHost.trim(),
          printer_port: parseInt(printerPort) || 9100,
        }
      );

      if (res.data?.success) {
        Alert.alert('✅ Connection Success', 'Printer is reachable and responding');
      } else {
        Alert.alert('⚠️ Connection Failed', res.data?.error || 'Unable to reach printer');
      }
    } catch (err: any) {
      Alert.alert(
        '❌ Connection Error',
        err.response?.data?.error || 'Failed to connect to printer. Check IP and port.'
      );
    } finally {
      setTestPrinting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Printers</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Scan Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Printers</Text>
          <TouchableOpacity
            style={[styles.scanButton, scanning && styles.scanButtonDisabled]}
            onPress={handleScan}
            disabled={scanning}
          >
            {scanning ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.scanButtonText}>Scanning...</Text>
              </>
            ) : (
              <Text style={styles.scanButtonText}>Scan for Printers</Text>
            )}
          </TouchableOpacity>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {printers.length > 0 ? (
            <FlatList
              data={printers}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.printerItem}>
                  <View style={styles.printerInfo}>
                    <Text style={styles.printerName}>{item.name}</Text>
                    <Text style={styles.printerStatus}>
                      {item.isConnected ? '✓ Connected' : 'Not connected'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.connectButton}
                    onPress={() => {
                      setSelectedPrinter(item.id);
                      setShowLocationModal(true);
                    }}
                  >
                    <Text style={styles.connectButtonText}>
                      {item.isConnected ? 'Manage' : 'Connect'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          ) : (
            <Text style={styles.noItemsText}>
              {scanning ? 'Scanning for printers...' : 'No printers found. Tap "Scan for Printers"'}
            </Text>
          )}
        </View>

        {/* Connected Printers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Printers</Text>
          {printers.filter((p) => p.isConnected).length > 0 ? (
            <FlatList
              data={printers.filter((p) => p.isConnected)}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.connectedPrinterCard}>
                  <View style={styles.connectedInfo}>
                    <Text style={styles.connectedName}>{item.name}</Text>
                    <Text style={styles.connectedLocation}>📍 {item.location}</Text>
                  </View>
                  <View style={styles.connectedActions}>
                    <TouchableOpacity
                      style={styles.testButton}
                      onPress={() => handleTestPrint(item.id)}
                      disabled={testPrinting}
                    >
                      <Text style={styles.testButtonText}>
                        {testPrinting ? 'Printing...' : 'Test'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleDisconnect(item.id)}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          ) : (
            <Text style={styles.noItemsText}>No connected printers</Text>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Setup Instructions</Text>
          <View style={styles.instructionBox}>
            <Text style={styles.instructionText}>
              1. Enable Bluetooth on your device{'\n'}
              2. Tap "Scan for Printers"{'\n'}
              3. Select your thermal printer{'\n'}
              4. Choose printer location (kitchen, bar, etc){'\n'}
              5. Tap "Test" to verify connection
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Location Modal */}
      <Modal visible={showLocationModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Printer Location</Text>

            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedLocation}
                onValueChange={(itemValue) => setSelectedLocation(itemValue)}
              >
                <Picker.Item label="Kitchen" value="kitchen" />
                <Picker.Item label="Bar" value="bar" />
                <Picker.Item label="Counter" value="counter" />
              </Picker>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowLocationModal(false);
                  setSelectedPrinter(null);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConnectPrinter}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonPrimaryText]}>
                  Connect
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2C3E50',
    padding: 20,
    paddingTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  scanButton: {
    backgroundColor: '#2C3E50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 15,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
    marginBottom: 15,
  },
  printerItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  printerInfo: {
    flex: 1,
  },
  printerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  printerStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  connectButton: {
    backgroundColor: '#2C3E50',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  noItemsText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
  },
  connectedPrinterCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2C3E50',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectedInfo: {
    flex: 1,
  },
  connectedName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  connectedLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  connectedActions: {
    flexDirection: 'row',
    gap: 10,
  },
  testButton: {
    backgroundColor: '#2C3E50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  testButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  removeButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  instructionBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 20,
    overflow: 'hidden',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#2C3E50',
  },
  modalButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalButtonPrimaryText: {
    color: '#fff',
  },
});
