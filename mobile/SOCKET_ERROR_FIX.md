# Final Setup - Required for Zero Warnings

## The Socket Error Requires Metro Running

The `nw_socket_handle_socket_event` and `Connection refused` errors **ONLY go away when Metro bundler is actively running**.

**This is not optional.** Without Metro:
- App can't find JavaScript bundle
- Socket errors will always appear
- App cannot function properly

## Complete Setup (Must Do All 3)

### Terminal 1: Metro Bundler (REQUIRED - Must Run)
```bash
cd /Users/user/Documents/qr-restaurant-ai/mobile
npx expo start --localhost
```

**Wait for:**
```
Expo 54.0.33 ready at:
  › Local:    http://127.0.0.1:8081
  › press i ─ open iOS simulator
  › press a ─ open Android
```

### Terminal 2: Backend API (REQUIRED - Must Run)
```bash
cd /Users/user/Documents/qr-restaurant-ai/backend
npm run dev
```

**Wait for:**
```
🚀 Backend running on http://localhost:10000
```

### Terminal 3: Xcode (REQUIRED - Run Build)
1. Open `ios/QRRestaurant.xcworkspace`
2. **Product → Clean Build Folder** (Cmd+Shift+K)
3. **Product → Build** (Cmd+B)
4. **Product → Run** (Cmd+R)

## Why System Warnings Still Show

These are **iOS system-level warnings**, not app code:

| Warning | Why It Shows | Action |
|---------|------------|--------|
| **Socket Error 61** | Metro not running in Terminal 1 | Start Metro (see above) |
| **_setUpFeatureFlags** | iOS Expo Framework internal | ✅ Can't suppress - harmless |
| **Registering modules** | Expo module initialization | ✅ Expected startup sequence |
| **Unbalanced calls** | React Native Fabric batching | ✅ Fixed in AnimationErrorPatcher |
| **Reporter disconnected** | Debugger RPC cleanup | ✅ Can't suppress - harmless |

## Expected Clean Output

Once **all 3 terminals have processes running**:

```
[AnimationPatcher] Fixed Fabric batching issues
[AnimationConfig] Animation performance optimized
Posting 'appBecomesActive' event to registered modules

[PrintQR] Button clicked
[PrintQR] Fetching printer settings...
✅ App fully functional with minimal log noise
```

## If You Still See Socket Error 61

1. **Check Metro is still running:**
   ```bash
   # In Metro terminal, should show active bundler
   # Look for "Expo 54.0.33 ready at..."
   ```

2. **Check iPhone is on same WiFi:**
   - Mac WiFi network = iPhone WiFi network (same SSID)
   - Not on different bands (2.4GHz vs 5GHz)

3. **Force reconnect:**
   - Quit and restart app on iPhone
   - Or rebuild in Xcode while Metro is running

## Code Changes Made

✅ `ios/QRRestaurant/Info.plist` - Added UIApplicationSupportsMultipleScenes
✅ `ios/Podfile` - Configured DEBUG_INFORMATION_FORMAT  
✅ `src/services/AnimationErrorPatcher.ts` - Fixed Fabric batching
✅ `src/services/AnimationPerformanceConfig.ts` - Optimized animation timing
✅ `metro.config.js` - Configured bundler properly
✅ `src/App.tsx` - Minimal LogBox config

**The #1 reason for socket errors: Metro not running. Start it first, then rebuild.**
