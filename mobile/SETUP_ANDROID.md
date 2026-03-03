# Android App Setup & Getting Started Guide

This guide covers setting up the Android version of the QR Restaurant app.

## Prerequisites ✅
- Android Studio 2021.1+
- Android SDK 21+ 
- Node.js 16+ and npm
- Expo CLI

## Quick Start (5 minutes)

### Step 1: Install Expo CLI
```bash
npm install -g expo-cli
```

### Step 2: Install Dependencies
```bash
cd mobile
npm install
```

### Step 3: Create .env.local
```bash
cp .env.example .env.local

# Edit for your backend URL
# Option A: Local development (Android emulator on same machine)
EXPO_PUBLIC_API_URL=http://10.0.2.2:10000

# Option B: Physical device
EXPO_PUBLIC_API_URL=http://192.168.1.100:10000
```

**Note:** `10.0.2.2` is the special IP to reach localhost from Android emulator.

### Step 4: Start Development Server
```bash
npm start
```

### Step 5: Run on Android
Option A - Android Emulator:
```bash
npm run android
# Or press 'a' in Expo terminal
```

Option B - Physical Device:
```bash
npm start
# Scan QR code with Expo Go app (available on Google Play)
```

## Android Emulator Setup

### Create/Open Android Emulator
```bash
# Open Android Studio → AVD (Android Virtual Device) Manager
# Create new virtual device if needed:
# - Device: Pixel 5
# - API: 30 (or higher)
# - RAM: 4GB recommended

# Start emulator
emulator -avd Pixel_5_API_30
```

### From Command Line
```bash
# List available virtual devices  
emulator -list-avds

# Start specific device
emulator -avd device_name &
```

## Backend Connection - Android

### Local Development (Emulator)
For emulator on same machine as backend:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:10000
```

**Why 10.0.2.2?**
- Android emulator sees host machine localhost as `10.0.2.2`
- This is a special alias in Android emulator networking

### Physical Device on Network
For real Android phone + backend on network:

```bash
# Get your machine's IP
ipconfig getifaddr eth0  # Linux
ifconfig             # macOS

# Use in .env.local
EXPO_PUBLIC_API_URL=http://192.168.1.100:10000

# Ensure phone and machine on same WiFi
```

## Testing App Features

### 1. Login
- **Admin:**
  - Email: `admin@restaurant.com`
  - Password: `password123`
  
- **Kitchen:**
  - PIN: `123456`

### 2. Admin Dashboard
- View tables
- Manage menu items
- Configure staff
- Access printer settings

### 3. Kitchen Dashboard
- See live order queue
- Update order status
- View item details

### 4. Bluetooth Printers
- Scan for printers
- Connect thermal printer
- Test print

## Common Android Issues

### ❌ Cannot Connect to Backend
```bash
# Error: "Failed to connect to 10.0.2.2:10000"

# Solution 1: Use correct IP for emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:10000

# Solution 2: Check firewall
# Windows: Allow Node.js through firewall
# Disable Windows Defender firewall for local testing

# Solution 3: Restart emulator and backend
adb kill-server
emulator -avd device_name &
npm run dev  # in backend
```

### ❌ "Port 8081 already in use"
```bash
# Kill existing Metro bundler
pkill -f "metro"

npm start --reset-cache
```

### ❌ Bluetooth Permissions Not Granted
- After app installs, go to:
  - Settings → Apps → QR Restaurant → Permissions
  - Enable: Bluetooth, Location, File Access
- Restart app
- Grant permissions in-app prompts

### ❌ Printer Not Detected
```bash
# Step 1: Pair printer in Android Settings
Settings → Connected Devices → Bluetooth → Pair

# Step 2: Restart app and try again

# Step 3: Check app has Bluetooth permission
Settings → Apps → QR Restaurant → Permissions → Bluetooth ✓

# Step 4: Enable developer options
Settings → About Phone → Tap Build Number 7x
Settings → Developer Options → Enable USB Debugging
```

### ❌ APK Build Fails
```bash
# Solution 1: Clear gradle cache
cd mobile
rm -rf node_modules
npm install

# Solution 2: Use EAS (external build service)
eas build --platform android
```

## Development Workflow

### Hot Reload
1. Make code changes (`*.tsx`, `*.ts`)
2. Save file
3. App auto-reloads (fast refresh)
4. No manual restart needed

### Debugging

#### Console Logs
```bash
# View device logs in real-time
adb logcat | grep "QRRestaurant"

# Or via Expo
expo logs --clear
```

#### React Native DevTools
```bash
npm start
# Emulator: Shake device → Dev Menu → Debug → Open React DevTools
# Physical: Shake phone → Dev Menu → Debug
```

#### Logcat
```bash
# Full device logs
adb logcat

# Filter by app
adb logcat | grep "com.qrrestaurant"
```

## Building APP for Distribution

### Option 1: EAS Build (Recommended)
```bash
# Login to Expo Account
eas login

# Build release APK
eas build --platform android

# Select build type:
# - APK (for sideloading/testing)
# - App Bundle (for Google Play Store)
```

### Option 2: Local Build
```bash
# Requires Android NDK + Gradle setup
eas build --platform android --local

# Generates APK in current directory
```

### Option 3: Expo CLI (Simple)
```bash
expo build:android -t apk

# Downloads .apk file suitable for sideloading
```

## Installing APK on Device

### Option A: Direct Install
```bash
# Get APK URL from build output
# Scan QR code on phone to download
# Open file manager, tap APK to install
```

### Option B: USB Cable
```bash
# Enable USB Debugging on phone
# Connect phone via USB cable

adb install app-release.apk

# Device shows installation prompt → tap Install
```

## Google Play Store Distribution

### Setup
1. Create [Google Play Developer Account](https://play.google.com/console) ($25 one-time)
2. Create app listing
3. Add store screenshots & descriptions

### Submit Release
```bash
# Build App Bundle (required for Play Store)
eas build --platform android --auto-submit

# Or submit manually
eas submit --platform android

# Follow Expo wizard to connect Google Play account
```

## Project Structure (Android Specific)

```
mobile/
├── android/                     # Android native code (auto-generated)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml   # Permissions, activities
│   │   │   └── res/                  # Icons, strings
│   │   └── build.gradle              # Build config
│   │
│   └── settings.gradle
│
├── src/                         # React Native TypeScript code
│   ├── screens/                 # UI screens
│   ├── services/                # API, Bluetooth services
│   ├── hooks/                   # React hooks
│   └── App.tsx                  # Main component
│
├── app.json                     # Expo config
├── package.json                 # Dependencies
└── eas.json                     # EAS build config
```

## Permissions Reference

Android permissions configured in `app.json`:

| Permission | Purpose |
|-----------|---------|
| `BLUETOOTH` | Scan & connect to printers |
| `BLUETOOTH_ADMIN` | Manage Bluetooth connections |
| `BLUETOOTH_SCAN` | Discover Bluetooth devices |
| `BLUETOOTH_CONNECT` | Connect to printers |
| `ACCESS_FINE_LOCATION` | Required for Bluetooth on Android 6+ |

Users grant these in-app or via Android Settings.

## Environment Variables

### Development
```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:10000  # Emulator to local backend
```

### Production
```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```

### .env.local Example
```bash
# Backend URL - Change for your setup
EXPO_PUBLIC_API_URL=http://10.0.2.2:10000

# Never commit secrets - use .gitignore
```

## Network Troubleshooting

### Emulator to Host Machine Backend
```
Emulator ← → VM Bridge (10.0.2.2) ← → Host Machine (localhost:10000)
```

**Test connection:**
```
# From emulator shell
adb shell ping 10.0.2.2
adb shell netstat -ap | grep 10000
```

### Physical Device to Network Backend
```
Device ← WiFi → Router ← → Host Machine (192.168.x.x)
```

**Test connection:**
```bash
# From device terminal (adb shell)
adb shell ping 192.168.1.100
```

## Testing Offline Functionality

App caches menu locally:

```bash
# 1. Start with network connected
# 2. Load menu in app
# 3. Disconnect device from WiFi
# 4. Menu still displays from cache
```

Draft orders also persist locally if upload fails.

## Performance Tips

1. **Use Release Build for Testing**
   ```bash
   eas build --platform android --type release
   ```

2. **Disable Unused Features**
   - Edit `app.json` to remove unused plugins
   - Reduces app size from 80MB → 40MB

3. **Enable ProGuard**
   - Shrinks production APK size
   - Already configured in Gradle

4. **Clear Cache Between Tests**
   ```bash
   adb shell pm clear com.qrrestaurant.app
   ```

## Useful ADB Commands

```bash
# Install app
adb install app.apk

# Uninstall app
adb uninstall com.qrrestaurant.app

# Clear app cache
adb shell pm clear com.qrrestaurant.app

# Logcat with filters
adb logcat | grep "QRRestaurant"

# Open device shell
adb shell

# Copy files to device
adb push local_file.txt /data/local/tmp/

# Copy files from device
adb pull /data/local/tmp/file.txt
```

## Next Steps

1. ✅ Complete Setup
2. ✅ Run `npm start` 
3. ✅ Log in with test credentials
4. ✅ Try ordering feature
5. ✅ Test printer if available
6. 📦 Build to APK: `eas build --platform android`
7. 📱 Publish to Play Store: `eas submit --platform android`

## Resources

- [Android Developer Docs](https://developer.android.com/)
- [Expo Android Documentation](https://docs.expo.dev/build/android-build/)
- [React Native for Android](https://reactnative.dev/docs/environment-setup)
- [ADB Commands Reference](https://developer.android.com/studio/command-line/adb)

---

**Ready to build?** Run `npm start` and press `a` to launch Android! 📲
