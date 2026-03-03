# iOS App Setup & Getting Started Guide

## Quick Start

This guide will get your React Native iOS app running in minutes.

### Prerequisites ✅
- macOS (for iOS development)
- Node.js 16+ and npm
- Xcode 13+
- Expo CLI

### Step 1: Install Expo CLI
```bash
npm install -g expo-cli
```

Verify installation:
```bash
expo --version
```

### Step 2: Navigate to Mobile Directory
```bash
cd mobile
```

### Step 3: Install Dependencies
```bash
npm install
```

This installs all required packages including:
- React Native & Expo
- React Navigation
- Bluetooth libraries
- Axios for API calls
- TypeScript

### Step 4: Create Environment File
```bash
# Copy from example
cp .env.example .env.local

# Edit to point to your backend
# EXPO_PUBLIC_API_URL=http://192.168.x.x:10000 (use your machine IP for actual device testing)
```

### Step 5: Start Development Server
```bash
npm start
```

You'll see options like:
```
› Android
› iOS
› Web
```

### Step 6: Run on iOS Simulator
Press `i` to launch iOS Simulator automatically, or run:
```bash
npm run ios
```

First launch takes 2-3 minutes to build.

### Step 7: Test the App

#### Login Flow
1. **Admin Login**
   - Email: `admin@restaurant.com`
   - Password: `password123`
   - (Use actual test admin from your database)

2. **Kitchen Login**
   - PIN: `123456`
   - (Use actual kitchen staff PIN from your database)

#### First Features to Try
1. **Admin Dashboard**
   - View tables
   - Check menu items
   - Navigate to Printer Settings

2. **Printer Setup** (if you have a Bluetooth printer)
   - Go to Settings → Printer Configuration
   - Tap "Scan for Printers"
   - Connect to your thermal printer

3. **Kitchen Dashboard**
   - View real-time order queue
   - Mark items as "Ready"
   - See order details with options

## Backend Connection

### Local Development (Simulator)
For iOS Simulator to connect to backend on your Mac:

```bash
# In backend directory, note your local IP
ipconfig getifaddr en0  # macOS
ipconfig getifaddr eth0 # Linux

# Use this IP in .env.local
EXPO_PUBLIC_API_URL=http://192.168.1.100:10000
```

### Physical Device Testing
To test on actual iPhone:

```bash
# 1. Get your Mac's IP
ipconfig getifaddr en0

# 2. Update .env.local
EXPO_PUBLIC_API_URL=http://192.168.1.100:10000

# 3. Ensure device and Mac are on same WiFi network

# 4. Scan QR code with Expo Go app
npm start
```

## Common Issues & Solutions

### ❌ "Expo CLI not found"
```bash
npm install -g expo-cli
```

### ❌ "Failed to connect to [IP]:10000"
- Verify backend is running: `npm run dev` in backend folder
- Check IP address is correct
- Ensure Mac and device are on same network
- Check firewall isn't blocking port 10000

### ❌ "Bluetooth permission denied"
- Go to iPhone Settings → QR Restaurant
- Enable Bluetooth permission
- Restart app

### ❌ "Printer not found during scan"
- Ensure printer is powered on
- Pair printer in iOS Settings first (Settings → Bluetooth)
- Try moving closer to printer
- Restart printer

### ❌ "Port 19000 already in use"
```bash
# Kill existing Expo process
pkill -f "expo"

# Or use different port
expo start --port 19001
```

## Hot Reload & Debugging

### Hot Reload (Dev Feature)
- Save changes to `.tsx` / `.ts` files
- App automatically reloads

### Full Reload
Shake device or press `Cmd+R` in simulator to do a full refresh.

### React DevTools
```bash
npm start
# Press `d` to open Expo DevTools in browser
```

### Console Logs
See device logs:
```bash
expo logs --clear  # Clear and follow logs
```

## Building for Production

### Option 1: Using Expo Application Services (Recommended)

```bash
# First time setup
eas login

# Create build configuration
eas build --platform ios

# Follow prompts to choose:
# - Build type: Archive (for app store) or Simulator Build
# - Workflow: Managed Workflow (Expo handles everything)
```

### Option 2: Local Build

```bash
# Requires full native toolchain setup
eas build --platform ios --local

# Generates IPA file in current directory
```

### App Store Distribution
```bash
# Setup App Store Connect
eas submit --platform ios

# Follows interactive workflow to upload to App Store
```

## Project Structure Reference

```
mobile/
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx              # Admin email/password login
│   │   ├── KitchenLoginScreen.tsx       # Kitchen PIN login
│   │   ├── AdminDashboardScreen.tsx     # Admin dashboard with tabs
│   │   ├── KitchenDashboardScreen.tsx   # Kitchen order queue
│   │   └── PrinterSettingsScreen.tsx    # Bluetooth printer config
│   │
│   ├── services/
│   │   ├── apiClient.ts                 # Axios HTTP client + auth
│   │   ├── bluetoothService.ts          # Printer scanning/printing
│   │   └── storageService.ts            # Local storage (AsyncStorage)
│   │
│   ├── hooks/
│   │   ├── useAuth.tsx                  # Auth context + hooks
│   │   └── useAPI.ts                    # API data hooks
│   │
│   ├── types/
│   │   └── index.ts                     # TypeScript definitions
│   │
│   └── App.tsx                          # Main app & navigation
│
├── app.json                             # Expo configuration
├── package.json                         # Dependencies
├── tsconfig.json                        # TypeScript config
├── babel.config.js                      # Babel/Expo config  
└── eas.json                             # Build configuration
```

## Key Features Ready to Use

### Authentication
- [x] Admin login (email/password)
- [x] Kitchen login (6-digit PIN)
- [x] JWT token persistence
- [x] Secure token storage

### Data Management
- [x] API client with auth headers
- [x] Menu caching
- [x] Draft orders
- [x] Printer configuration

### Bluetooth Printing
- [x] Printer discovery via BLE
- [x] Connect/disconnect
- [x] ESC/POS thermal receipt generation
- [x] Test print functionality

### Admin Features
- [x] Dashboard with tabs
- [x] Printer settings
- [x] Table management UI
- [ ] Create/edit menu items (backend ready, UI todo)
- [ ] Staff management (backend ready, UI todo)

### Kitchen Features  
- [x] Real-time order queue
- [x] Order status management
- [x] Auto-refresh (5 second polling)
- [x] Item details with options

## Next Steps

### To Run App:
1. `npm start` - Start Expo dev server
2. Press `i` - Launch iOS Simulator
3. Login with test credentials
4. Explore features

### To Build & Deploy:
1. `eas build --platform ios` - Build production IPA
2. `eas submit --platform ios` - Upload to App Store
3. Wait for Apple review (~24 hours)

### To Add Features:
- New screens go in `src/screens/`
- New API calls in `src/services/apiClient.ts`
- Custom hooks in `src/hooks/`

## Support & Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [iOS Simulator Keyboard Shortcuts](https://developer.apple.com/library/archive/documentation/IDEs/Conceptual/iOS_Simulator_Guide/Introduction/Introduction.html)

## Environment Variables

Create `.env.local` in mobile directory:

```env
# Backend API URL
EXPO_PUBLIC_API_URL=http://192.168.1.100:10000

# For production
# EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```

## Database Test Data

For testing, ensure your backend database has:

```sql
-- Admin user
INSERT INTO users (email, password_hash, role, restaurant_id)
VALUES ('admin@restaurant.com', '...hash...', 'admin', 'restaurant_id');

-- Kitchen staff user with PIN
INSERT INTO staff (name, pin, role, restaurant_id)
VALUES ('John', '123456', 'kitchen', 'restaurant_id');

-- Tables
INSERT INTO tables (number, capacity, restaurant_id)
VALUES (1, 4, 'restaurant_id'),
       (2, 2, 'restaurant_id'),
       (3, 6, 'restaurant_id');
```

---

**Ready to start?** Run `npm start` and press `i` to open iOS Simulator! 🚀
