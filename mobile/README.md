# QR Restaurant - Native iOS/Android App

This is a React Native + Expo application for the QR Restaurant ordering system. It provides native iOS and Android apps with Bluetooth printer support.

## Features

- ✅ Multi-role authentication (Admin, Staff, Kitchen)
- ✅ Real-time order management
- ✅ Bluetooth thermal printer support
- ✅ Offline menu caching
- ✅ Kitchen order queue
- ✅ Admin dashboard
- ✅ POS integration ready

## Prerequisites

- Node.js 16+ and npm
- Expo CLI: `npm install -g expo-cli`
- iOS: Xcode 13+ (for local development)
- Android: Android Studio (for local development)

## Installation

```bash
# Install dependencies
npm install

# Start Expo development server
npm start

# For iOS
npm run ios

# For Android  
npm run android

# For web (preview only)
npm run web
```

## Project Structure

```
mobile/
├── src/
│   ├── screens/          # Screen components
│   ├── services/         # API, Bluetooth, Storage services
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript type definitions
│   ├── components/       # Reusable components
│   └── App.tsx           # Main app component
├── app.json              # Expo configuration
├── package.json          # Dependencies
└── index.js              # Entry point
```

## Screens

### Authentication
- **Login Screen**: Admin login with email/password
- **Kitchen Login**: Kitchen staff login with 6-digit PIN
- **Login Choice**: Select login type on startup

### Admin
- **Dashboard**: Table management, menu items, staff
- **Printer Settings**: Bluetooth printer configuration

### Kitchen
- **Order Queue**: Real-time order updates with status management

## Services

### apiClient.ts
Handles all API communication with the backend. Automatically includes JWT tokens and restaurant ID.

### bluetoothService.ts
Manages Bluetooth printer scanning, connection, and printing:
- Scans for Bluetooth thermal printers
- Connects to ESC/POS compliant printers
- Generates thermal receipt format
- Handles print job queuing

### storageService.ts
Persists data locally:
- Printer configurations
- Cached menu items
- Draft orders
- User preferences

## Bluetooth Printer Support

### Supported Printers
- Epson TM Series
- Star Micronics
- Sunmi
- Zebra
- Any ESC/POS compatible thermal printer

### Setup
1. Enable Bluetooth on device
2. Pair printer in iOS/Android Settings
3. Go to Printer Settings in Admin
4. Tap "Scan for Printers"
5. Select printer and choose location (Kitchen, Bar, Counter)
6. Tap "Test" to verify

## Building for Production

### iOS
```bash
# Build for App Store
eas build --platform ios

# Or build locally
npm run build:ios
```

### Android
```bash
# Build for Play Store
eas build --platform android

# Or build locally
npm run build:android
```

## Configuration

### Backend Connection
Edit the `EXPO_PUBLIC_API_URL` environment variable in `.env.local`:

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```

### Permissions
Required permissions are configured in `app.json`:
- Bluetooth (iOS & Android)
- Location (for Bluetooth scanning on iOS)
- File system access (for printing)

## Troubleshooting

### Bluetooth not working
- Ensure device has Bluetooth enabled
- Go to system Bluetooth settings and pair printer first
- Check that app has Bluetooth permissions
- Restart Expo app

### Printer connection fails
- Verify printer is powered on and in pairing mode
- Check device is within Bluetooth range (usually 10m)
- Try restarting the printer
- Test with "Test print" button

### API connection issues
- Verify backend is running
- Check `EXPO_PUBLIC_API_URL` is correct
- Ensure device is on same network as backend (for local development)
- Check firewall settings

## Development

### Hot Reload
Changes to JavaScript files automatically reload. Native changes require full rebuild.

### Debugging
- Use Expo DevTools in the app
- Use React DevTools browser extension
- Check console output: `expo logs`

### Testing Bluetooth
Test printer connectivity without actual printer using the test print feature.

## Database & Backend

The app connects to the same Express.js backend API. Ensure:
- Backend is running on the configured API URL
- Database migrations are up-to-date
- Authentication tokens are valid

## Support

For issues, check:
1. Backend API is responding
2. Restaurant ID is set correctly
3. Authentication tokens are valid
4. Bluetooth device permissions are granted

## License

Same as QR Restaurant project
