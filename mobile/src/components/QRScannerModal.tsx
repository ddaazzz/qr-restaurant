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

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onQRScanned: (token: string) => void;
  restaurantId: string;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  onQRScanned,
  restaurantId,
}) => {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    (async () => {
      if (!visible) return;

      // Automatically request permission if not yet requested
      if (permission === null) {
        console.log('[QRScanner] Requesting camera permission...');
        try {
          const result = await requestPermission();
          console.log('[QRScanner] Permission result:', result);
        } catch (error) {
          console.error('[QRScanner] Error requesting camera permission:', error);
        }
      }
    })();
  }, [visible, permission, requestPermission]);

  const handleQRScanned = (token: string) => {
    try {
      // Extract token from QR code data
      let finalToken = token;

      // If it's a URL, extract the token from the path
      if (token.includes('/scan/')) {
        const match = token.match(/\/scan\/([^/?]+)/);
        finalToken = match ? match[1] : token;
      } else if (token.includes('token=')) {
        const match = token.match(/token=([^&]+)/);
        finalToken = match ? match[1] : token;
      }

      console.log('[QRScanner] Scanned token:', finalToken);

      // Call the callback with the token
      onQRScanned(finalToken);
      onClose();
    } catch (error) {
      console.error('[QRScanner] Error processing QR code:', error);
      Alert.alert('Invalid QR Code', 'Could not process this QR code. Please try again.');
    }
  };

  if (!visible) return null;

  if (permission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#2C3E50" />
          <Text style={styles.text}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#2C3E50" style={{ marginBottom: 16 }} />
          <Text style={styles.text}>Waiting for camera permission...</Text>
          <Text style={styles.infoText}>Please allow camera access when prompted</Text>
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
          </View>

          {/* Bottom bar with close button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.button, styles.closeButton]}
              onPress={onClose}
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
