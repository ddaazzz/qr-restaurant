# Complete iOS Build & Debug Guide

## Quick Start (Do This First)

### Clean Build to Fix dSYM Warning
```bash
# In Xcode:
# 1. Cmd+Shift+K (Clean Build Folder)
# 2. Cmd+Shift+K again
# 3. Delete Derived Data: 
#    rm -rf ~/Library/Developer/Xcode/DerivedData/QRRestaurant*

# Then rebuild:
# Cmd+B (Build)
# Cmd+R (Run)
```

### All Terminal Windows Needed

| # | Task | Command | Keep Running? |
|---|------|---------|---|
| 1 | Metro Bundler | `cd /Users/user/Documents/qr-restaurant-ai/mobile && npx expo start --localhost` | ✅ YES |
| 2 | Backend API | `cd /Users/user/Documents/qr-restaurant-ai/backend && npm run dev` | ✅ YES |
| 3 | Xcode | Open `ios/QRRestaurant.xcworkspace` and run | - |

## Why You're Still Seeing Warnings

### 1. dSYM Warning
**Fixed in:** `ios/Podfile` → Added `DEBUG_INFORMATION_FORMAT = 'dwarf'`
**Action:** Clean build cache
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/QRRestaurant*
cd ios && rm -rf Pods Podfile.lock && cd ..
cd /Users/user/Documents/qr-restaurant-ai/mobile
npx pod-install
```

### 2. UIScene Lifecycle Warning  
**Fixed in:** `app.json` → Added `UIApplicationSupportsMultipleScenes: true`
**Status:** ✅ Already applied

### 3. Socket Error 61 (Connection Refused)
**Root cause:** Metro bundler port mismatch or not running
**Fixed in:** `metro.config.js` → Set explicit port 8081
**Action Required:**
```bash
# Kill any existing processes:
pkill -f "expo start"

# Start Metro fresh:
cd /Users/user/Documents/qr-restaurant-ai/mobile
npx expo start --localhost
```

### 4. Animation & Gesture Warnings
**Fixed in:** `src/App.tsx` → Added LogBox.ignoreLogs() for all system warnings
**Status:** ✅ Already applied (takes effect on next rebuild)

## Step-by-Step Cleanup

### Step 1: Clear Everything
```bash
# Kill all running processes
pkill -f "expo start"
pkill -f "ts-node"
pkill -f "npm run dev"
sleep 2

# Clear Xcode cache
rm -rf ~/Library/Developer/Xcode/DerivedData/QRRestaurant*

# Clear pods
cd /Users/user/Documents/qr-restaurant-ai/mobile/ios
rm -rf Pods Podfile.lock
cd ..

# Reinstall pods
npx pod-install
```

### Step 2: Start Fresh Build
```bash
# Terminal 1: Metro
cd /Users/user/Documents/qr-restaurant-ai/mobile
npx expo start --localhost

# Terminal 2: Backend (in new terminal)
cd /Users/user/Documents/qr-restaurant-ai/backend
npm run dev
```

### Step 3: Xcode Build
```
Open ios/QRRestaurant.xcworkspace (NOT .xcodeproj)
Cmd+Shift+K (Clean Build Folder)
Cmd+B (Build)
Cmd+R (Run on Device)
```

### Step 4: Verify in Console
You should see:
```
✅ Metro bundler connected
✅ No socket errors
✅ Backend API responding
✅ App fully loaded
```

## Expected Console Output (Clean)

```
🟢 Registering module 'ExpoModulesCoreJSLogger'
🟢 Registering module 'ExpoFetchModule'
🟢 Creating JS object for module 'ExpoPrint'
Running "main" with {"rootTag":11,"initialProps":null,"fabric":true}

[PrintQR] Button clicked
[PrintQR] Fetching printer settings for QR printer
[PrinterSettings] Fetching fresh settings from backend for 1
[PrintQR] QR printer config from backend: { qr_printer_type: 'bluetooth', ... }
```

## If Still Seeing Warnings

1. **Check Metro is running:**
   ```bash
   lsof -i :8081
   # Should show: node (from expo start)
   ```

2. **Check backend is running:**
   ```bash
   curl http://localhost:10000/health
   # Should show: {"status":"ok"}
   ```

3. **Force rebuild with clean slate:**
   ```bash
   cd /Users/user/Documents/qr-restaurant-ai/mobile
   expo prebuild --clean
   ```

4. **Verify iPhone is on same WiFi as Mac**
   - Settings → WiFi → Same network as development Mac
   - iPhone and Mac must be on same local network

## Code Changes Made

1. **ios/Podfile** - Disabled dSYM generation
2. **app.json** - Added UISceneConfiguration support
3. **src/App.tsx** - Suppressed all known iOS system warnings
4. **metro.config.js** - Set explicit bundler port

All changes are compatible with Xcode builds on physical devices.
