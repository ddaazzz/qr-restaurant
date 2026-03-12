import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { apiClient } from '../services/apiClient';

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onQRScanned: (data: { sessionId: number; tableName: string; token: string }) => void;
  restaurantId: string;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  onQRScanned,
  restaurantId,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedOnce, setScannedOnce] = useState(false);

  useEffect(() => {
    (async () => {
      if (!visible) {
        setScannedOnce(false);
        return;
      }

      // Automatically request permission if not yet requested
      if (permission === null) {
        try {
          await requestPermission();
        } catch (error) {
          console.error('[QRScanner] Error requesting camera permission:', error);
        }
      } else if (permission && !permission.granted) {
        // Permission was previously denied, try requesting again
        try {
          await requestPermission();
        } catch (error) {
          console.error('[QRScanner] Error re-requesting camera permission:', error);
        }
      }
    })();
  }, [visible, permission, requestPermission]);

  const handleBarcodeScanned = async (barcode: any) => {
    if (isProcessing || scannedOnce) return;

    try {
      setIsProcessing(true);
      setScannedOnce(true);

      const token = barcode.data || '';
      console.log('[QRScanner] Barcode scanned:', token);

      // Extract token from QR code data (if it's a URL)
      let finalToken = token;
      if (token.includes('/')) {
        // It's a URL like https://chuio.io/40aabd8ce... - extract the last segment
        const parts = token.split('/');
        finalToken = parts[parts.length - 1];
        console.log('[QRScanner] Extracted token from URL:', finalToken);
      }

      if (!finalToken || finalToken.trim().length === 0) {
        Alert.alert('Invalid QR Code', 'Could not process this QR code. Please try again.');
        setIsProcessing(false);
        setScannedOnce(false);
        return;
      }

      // Call backend /scan endpoint to get session info (matching webapp behavior)
      console.log('[QRScanner] Calling backend /scan endpoint with token:', finalToken);
      const response = await apiClient.post(`/api/scan/${finalToken}`, {});

      if (response.status !== 200) {
        Alert.alert('Error', 'Invalid QR code or session not found');
        setIsProcessing(false);
        setScannedOnce(false);
        return;
      }

      const data = response.data;
      console.log('[QRScanner] Scan response:', data);

      if (!data.session_id) {
        Alert.alert('No Session', `${data.table_name} has no active session. Start a new session from the tables view.`);
        setIsProcessing(false);
        setScannedOnce(false);
        return;
      }

      // Successfully got session info - pass to parent
      onQRScanned({
        sessionId: data.session_id,
        tableName: data.table_name,
        token: finalToken,
      });
      onClose();
    } catch (error) {
      console.error('[QRScanner] Error processing QR code:', error);
      
      let errorMsg = 'Could not process this QR code. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          errorMsg = 'QR code not found or expired';
        }
        console.error('Error details:', error.message);
      }
      
      Alert.alert('Invalid QR Code', errorMsg);
      setIsProcessing(false);
      setScannedOnce(false);
    }
  };

  if (!visible) return null;

  // If permission is still being determined or was denied, show appropriate screen
  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.text}>Camera permission required</Text>
          <Text style={styles.infoText}>Please allow camera access in Settings</Text>
          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={() => requestPermission()}>
            <Text style={styles.buttonText}>Request Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.closeButton]} onPress={onClose}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={isProcessing ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />

        {/* Overlay UI */}
        <View style={styles.overlay}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <Text style={styles.title}>Scan Table QR Code</Text>
          </View>

          {/* Center scanning frame */}
          <View style={styles.centerContent}>
            <View style={styles.scanFrame} />
            <Text style={styles.instructionText}>Point camera at QR code</Text>
            {isProcessing && (
              <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
            )}
          </View>

          {/* Bottom bar with close button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.button, styles.closeButton]}
              onPress={onClose}
              disabled={isProcessing}
            >
              <Text style={styles.buttonText}>Close Scanner</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  topBar: {
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 20,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#2C3E50',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  instructionText: {
    marginTop: 20,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2C3E50',
    borderRadius: 6,
  },
  secondaryButton: {
    backgroundColor: '#2C3E50',
  },
  closeButton: {
    backgroundColor: '#2C3E50',
  },
  primaryButton: {
    backgroundColor: '#2C3E50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  infoText: {
    color: '#666',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#2C3E50',
    borderRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    color: '#fff',
    fontSize: 16,
  },
});
