import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Picker,
} from 'react-native';
import { usePrinters } from '../hooks/useAPI';
import { bluetoothService } from '../services/bluetoothService';

export const PrinterSettingsScreen = ({ navigation }: any) => {
  const { printers, scanning, error, scanForPrinters, connectPrinter, disconnectPrinter } =
    usePrinters();
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('kitchen');
  const [testPrinting, setTestPrinting] = useState(false);

  const handleScan = async () => {
    try {
      await scanForPrinters();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Scan failed');
    }
  };

  const handleConnectPrinter = async () => {
    if (!selectedPrinter) return;

    try {
      const success = await connectPrinter(selectedPrinter, selectedLocation);
      if (success) {
        Alert.alert('Success', `Printer connected to ${selectedLocation}`);
        setShowLocationModal(false);
        setSelectedPrinter(null);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handleDisconnect = async (printerId: string) => {
    Alert.alert('Disconnect', 'Remove this printer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await disconnectPrinter(printerId);
        },
      },
    ]);
  };

  const handleTestPrint = async (printerId: string) => {
    setTestPrinting(true);
    try {
      const testOrder = {
        orderId: 'TEST-001',
        tableNumber: 1,
        restaurantName: 'Test Restaurant',
        items: [
          {
            quantity: 1,
            name: 'Test Item',
            selectedOptions: [{ name: 'Test Option' }],
            notes: 'Test print',
          },
        ],
        totalAmount: 9.99,
      };

      await bluetoothService.printOrder(printerId, testOrder);
      Alert.alert('Success', 'Test print sent to printer');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Print failed');
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
      <Modal visible={showLocationModal} transparent animationType="slide">
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
    backgroundColor: '#2196F3',
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
    backgroundColor: '#2196F3',
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
    backgroundColor: '#2196F3',
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
    borderLeftColor: '#4CAF50',
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
    backgroundColor: '#4CAF50',
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
    backgroundColor: '#2196F3',
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
