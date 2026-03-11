# Building QR Restaurant with Xcode on Physical iPhone

## Prerequisites
- iPhone on same WiFi as Mac
- Metro bundler running on your Mac
- Xcode 15+ with valid provisioning profile

## Step-by-Step Setup

### 1. Start Metro Bundler (Required)
```bash
cd /Users/user/Documents/qr-restaurant-ai/mobile
npx expo start --localhost
```

**Wait for output like:**
```
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▓▓▓▓ new expo  ▓▓▓▓ █
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
 Expo 54.0.33 ready at:

  › Local:    http://127.0.0.1:8081
  › Using Airplane Mode
  › press i ─ open iOS simulator
  › press a ─ open Android
  › press w ─ open web

 💀 Restarting metro...
```

### 2. Build in Xcode (Keep Metro Running)
1. Open `ios/QRRestaurant.xcworkspace` (not .xcodeproj)
2. Select your iPhone device from device picker (top left)
3. Product → Build (Cmd+B)
4. Product → Run (Cmd+R)

### 3. Connect on Device
When the app first launches, it will:
1. Try to find the Metro bundler
2. If using `--localhost`, connect to http://127.0.0.1:8081
3. Load JavaScript bundle

**Keep the terminal with `npx expo start` running the entire time!**

## Troubleshooting

### Socket Error 61 (Connection Refused)
**Cause:** Metro bundler not running
**Fix:** 
```bash
# In a new terminal:
cd /Users/user/Documents/qr-restaurant-ai/mobile
npx expo start --localhost
```

### Socket Error (Different IP)
**Cause:** Trying to connect to old bundler IP
**Fix:** Force clear cache and rebuild:
```bash
cd /Users/user/Documents/qr-restaurant-ai/mobile
npx expo start --clear
```

### App Can't Find Backend API
**Check:** Make sure backend is running on http://localhost:10000
```bash
# In another terminal:
cd /Users/user/Documents/qr-restaurant-ai/backend
npm run dev
```

## Expected Console Output When Working

```
[PrintQR] Button clicked
[PrintQR] Fetching printer settings for QR printer
[PrinterSettings] Getting settings for restaurant 1, forceRefresh=true
[PrinterSettings] Fetching fresh settings from backend for 1
[PrintQR] QR printer config from backend: { 
  qr_printer_type: 'bluetooth',
  qr_printer_host: '...',
  ...
}
[PrintQR] Using QR printer type: bluetooth for QR token: ...
[PrintQR] Printing to Bluetooth printer
```

## Terminal Windows Needed (3 total)

| Window | Command | Location |
|--------|---------|----------|
| 1 | `npx expo start --localhost` | `/mobile` |
| 2 | `npm run dev` | `/backend` |
| 3 | Xcode running | device |

All must run simultaneously for full functionality.
