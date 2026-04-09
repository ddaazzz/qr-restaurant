import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';

export interface SelectedPrinter {
  type: 'bluetooth' | 'network' | 'browser';
  name: string;
  id?: string;
  address?: string;
}

interface PrinterSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPrinter: (printer: SelectedPrinter) => void;
  onPrint: (printer: SelectedPrinter) => Promise<void>;
  jobName: string; // e.g., "QR Code", "Bill", "Kitchen Order"
}

export const PrinterSelectionModal: React.FC<PrinterSelectionModalProps> = ({
  visible,
  onClose,
  onSelectPrinter,
  onPrint,
  jobName,
}) => {
  const [step, setStep] = useState<'select-type' | 'scan' | 'list'>('select-type');
  const [scanning, setScanning] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<Array<{ id: string; name: string; signal: number }>>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<SelectedPrinter | null>(null);
  const [printing, setPrinting] = useState(false);

  const handleBluetoothScan = async () => {
    try {
      setScanning(true);
      setBluetoothDevices([]);

      let BleManager: any = null;
      try {
        const ble = require('react-native-ble-plx');
        BleManager = ble.BleManager;
      } catch (e) {
        throw new Error('Bluetooth not available');
      }

      if (!BleManager) {
        throw new Error('BleManager not available');
      }

      const manager = new BleManager();

      // Scan for devices
      const subscription = manager.onStateChange((state: any) => {
        if (state === 'PoweredOn') {
          manager.startDeviceScan(null, null, (error: any, device: any) => {
            if (error) {
              console.error('Scan error:', error);
              return;
            }

            if (device) {
              setBluetoothDevices((prev) => {
                const existing = prev.find((d) => d.id === device.id);
                if (!existing) {
                  return [
                    ...prev,
                    {
                      id: device.id,
                      name: device.name || 'Unknown Device',
                      signal: device.rssi || 0,
                    },
                  ];
                }
                return prev;
              });
            }
          });

          // Stop scanning after 10 seconds
          setTimeout(() => {
            manager.stopDeviceScan();
            setScanning(false);
            if (subscription) subscription.remove();
          }, 10000);
        }
      }, true);

      setTimeout(() => {
        manager.stopDeviceScan();
        setScanning(false);
        if (subscription) subscription.remove();
      }, 10000);

      setStep('list');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to scan Bluetooth devices: ' + err.message);
      setScanning(false);
    }
  };

  const handleSelectPrinter = (printer: SelectedPrinter) => {
    setSelectedPrinter(printer);
  };

  const handleConfirmAndPrint = async () => {
    if (!selectedPrinter) {
      Alert.alert('Error', 'Please select a printer');
      return;
    }

    try {
      setPrinting(true);
      onSelectPrinter(selectedPrinter);
      await onPrint(selectedPrinter);
      setPrinting(false);
      reset();
      onClose();
      Alert.alert('Printed', `${jobName} sent to printer successfully`);
    } catch (err: any) {
      setPrinting(false);
      Alert.alert('Error', 'Failed to print: ' + err.message);
    }
  };

  const reset = () => {
    setStep('select-type');
    setSelectedPrinter(null);
    setBluetoothDevices([]);
    setScanning(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={visible} transparent={true} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Print {jobName}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Select Printer Type */}
          {step === 'select-type' && (
            <View style={styles.content}>
              <Text style={styles.stepTitle}>Select Printer Type</Text>

              <TouchableOpacity
                style={styles.printerTypeButton}
                onPress={() => {
                  setSelectedPrinter({ type: 'browser', name: 'Browser Print' });
                  setStep('list');
                }}
              >
                <Text style={styles.printerTypeButtonText}>Browser Print</Text>
                <Text style={styles.printerTypeButtonDesc}>Print using your device's browser</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.printerTypeButton}
                onPress={async () => {
                  await handleBluetoothScan();
                }}
              >
                <Text style={styles.printerTypeButtonText}>Bluetooth Printer</Text>
                <Text style={styles.printerTypeButtonDesc}>Scan for nearby Bluetooth printers</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.printerTypeButton}
                onPress={() => {
                  setSelectedPrinter({ type: 'network', name: 'Network Printer' });
                  setStep('list');
                }}
              >
                <Text style={styles.printerTypeButtonText}>Network Printer</Text>
                <Text style={styles.printerTypeButtonDesc}>Connect to a network/thermal printer</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scanning or Bluetooth List */}
          {step === 'list' && selectedPrinter?.type === 'bluetooth' && (
            <View style={styles.content}>
              {scanning ? (
                <View style={styles.scanningContainer}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.scanningText}>Scanning for Bluetooth devices...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.stepTitle}>Available Bluetooth Printers</Text>
                  {bluetoothDevices.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No Bluetooth devices found</Text>
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={handleBluetoothScan}
                      >
                        <Text style={styles.retryButtonText}>Scan Again</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <FlatList
                        data={bluetoothDevices}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[
                              styles.deviceItem,
                              selectedPrinter?.id === item.id && styles.deviceItemSelected,
                            ]}
                            onPress={() =>
                              handleSelectPrinter({
                                type: 'bluetooth',
                                name: item.name,
                                id: item.id,
                              })
                            }
                          >
                            <View>
                              <Text style={styles.deviceName}>{item.name}</Text>
                              <Text style={styles.deviceSignal}>Signal: {item.signal} dBm</Text>
                            </View>
                            {selectedPrinter?.id === item.id && (
                              <Text style={styles.checkmark}>✓</Text>
                            )}
                          </TouchableOpacity>
                        )}
                      />
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={handleBluetoothScan}
                      >
                        <Text style={styles.retryButtonText}>Scan Again</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {/* Browser or Network Printer Confirmation */}
          {step === 'list' && selectedPrinter && selectedPrinter.type !== 'bluetooth' && (
            <View style={styles.content}>
              <Text style={styles.stepTitle}>Printer Selected</Text>
              <View style={styles.printerConfirm}>
                <Text style={styles.printerConfirmText}>
                  {selectedPrinter.name}
                </Text>
              </View>
              <Text style={styles.confirmDesc}>
                {selectedPrinter.type === 'browser'
                  ? 'Ready to print using your device\'s browser print dialog'
                  : 'Ready to print to network printer'}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleClose}
              disabled={printing}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>

            {selectedPrinter && (
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleConfirmAndPrint}
                disabled={printing}
              >
                {printing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Print Now</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    minHeight: '70%',
    maxHeight: '95%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
    fontWeight: '300',
  },
  content: {
    flex: 1,
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  printerTypeButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },
  printerTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  printerTypeButtonDesc: {
    fontSize: 12,
    color: '#6b7280',
  },
  scanningContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  scanningText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  deviceItem: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceItemSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  deviceSignal: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  checkmark: {
    fontSize: 18,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: 'transparent',
    alignItems: 'center',
    marginTop: 12,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  printerConfirm: {
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
  },
  printerConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  confirmDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
  },
  buttonSecondary: {
    backgroundColor: '#e5e7eb',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
