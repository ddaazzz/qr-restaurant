import React, { useRef, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, BackHandler, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../hooks/useAuth';

interface CustomWebViewScreenProps {
  url: string;
  restaurantId: string;
  token: string;
}

/**
 * WebView bridge for custom restaurant UIs.
 * 
 * When a restaurant has ui_mode="webview", the app renders this screen
 * instead of the native Admin/Kitchen dashboard. The WebView loads
 * the restaurant's custom frontend URL and bridges native features
 * (auth, push notifications, camera) via postMessage.
 */
export const CustomWebViewScreen: React.FC<CustomWebViewScreenProps> = ({ url, restaurantId, token }) => {
  const webViewRef = useRef<WebView>(null);
  const { logout } = useAuth();

  // Inject auth credentials into the WebView so the custom frontend can make API calls
  const injectedJS = `
    (function() {
      window.__CHUIO_BRIDGE__ = {
        token: "${token}",
        restaurantId: "${restaurantId}",
        platform: "${Platform.OS}",
        version: "${Platform.Version}",
      };
      // Dispatch event so custom frontend knows bridge is ready
      window.dispatchEvent(new CustomEvent('chuio-bridge-ready', { detail: window.__CHUIO_BRIDGE__ }));
    })();
    true;
  `;

  // Handle messages from the WebView (native feature requests)
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'logout':
          logout();
          break;
        case 'haptic':
          // Could add haptic feedback here
          break;
        default:
          console.log('[WebView Bridge] Unknown message type:', data.type);
      }
    } catch (e) {
      console.error('[WebView Bridge] Failed to parse message:', e);
    }
  }, [logout]);

  // Android back button support
  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        injectedJavaScript={injectedJS}
        onMessage={onMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#2C3E50" />
          </View>
        )}
        allowsBackForwardNavigationGestures
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
