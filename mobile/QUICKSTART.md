# Quick Start Reference

## TL;DR - Get Running in 2 Minutes

### Prerequisites
- Node.js 16+
- npm installed
- (iOS) Mac with Xcode 13+
- (Android) Android Studio

### Quick Commands

```bash
# 1. Install Expo CLI (one-time)
npm install -g expo-cli

# 2. Go to mobile directory
cd mobile

# 3. Install dependencies
npm install

# 4. Create .env.local
echo 'EXPO_PUBLIC_API_URL=http://10.0.2.2:10000' > .env.local

# 5. Start dev server
npm start

# 6. Choose platform
# Press 'i' for iOS Simulator
# Press 'a' for Android Emulator
# Scan QR for Expo Go (phone)
```

## Architecture in 30 Seconds

```
┌─────────────────────────┐
│  iOS/Android Native App │ ← React Native + Expo
│   (with Bluetooth)      │
└────────────┬────────────┘
             │ HTTP/REST
┌────────────v────────────┐
│   Express.js Backend    │ ← Node.js
│   (localhost:10000)     │
└────────────┬────────────┘
             │ SQL
┌────────────v─────────────┐
│   PostgreSQL Database    │
└──────────────────────────┘
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app entry, navigation |
| `src/screens/*.tsx` | UI screens |
| `src/services/apiClient.ts` | Backend communication |
| `src/services/bluetoothService.ts` | Printer support |
| `src/hooks/useAuth.tsx` | Authentication |
| `app.json` | Expo configuration |

## Available Commands

```bash
# Development
npm start              # Start Expo dev server
npm run ios           # Open iOS Simulator
npm run android       # Open Android Emulator
npm run web           # Web preview (limited)

# Build & Deploy
eas build --platform ios
eas build --platform android
eas submit --platform ios
eas submit --platform android

# Debugging
expo logs --clear     # Watch device logs
npx tsc --noEmit      # Check TypeScript errors
```

## API Endpoints Used

```
POST   /api/auth/login                    # Admin login
POST   /api/auth/kitchen-login            # Kitchen PIN login
GET    /api/restaurants/:id/menu          # Get menu
GET    /api/restaurants/:id/tables        # Get tables
GET    /api/restaurants/:id/kitchen/items # Kitchen queue
POST   /api/sessions/:id/orders           # Create order
PATCH  /api/orders/:id                    # Update order status
```

## Authentication Flow

1. **Admin Login**: Email → Password → JWT Token
2. **Kitchen Login**: 6-digit PIN → JWT Token
3. **Storage**: SecureStore (encrypted device storage)
4. **Auto**: Token included in all API requests

## Bluetooth Printer Setup

```
1. Printer Setup
   ↓
2. Go to Admin → Settings → Printers
   ↓
3. Tap "Scan for Printers"
   ↓
4. Select printer
   ↓
5. Choose location (Kitchen/Bar/Counter)
   ↓
6. Tap "Test Print"
   ↓
7. Ready!
```

## Environment Variables

Create `.env.local` in `mobile/`:

```env
# Local development - Emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:10000

# Local development - Physical device
# EXPO_PUBLIC_API_URL=http://192.168.1.100:10000

# Production
# EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```

## Testing Credentials

Use these to test the app:

```
Admin:
  Email: admin@restaurant.com
  Password: password123

Kitchen Staff:
  PIN: 123456
```

*(Update based on your database)*

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| `Cannot connect to :10000` | Check backend is running + `.env.local` URL |
| `Expo CLI not found` | `npm install -g expo-cli` |
| `Bluetooth permission denied` | Grant in iOS/Android Settings |
| `Port already in use` | `pkill -f expo` |
| `Printer not found` | Pair in device Settings first |

## Project Directories

```
qr-restaurant-ai/
├── backend/          # Express.js API (existing)
├── frontend/         # Web UI (existing)
├── mobile/           # NEW - React Native iOS/Android
│   ├── src/
│   │   ├── screens/     # Login, Admin, Kitchen, Printers
│   │   ├── services/    # API, Bluetooth, Storage
│   │   ├── hooks/       # useAuth, useAPI, usePrinters
│   │   └── types/       # TypeScript definitions
│   ├── app.json         # Expo config
│   ├── package.json     # Dependencies
│   └── README.md        # Full docs
```

## Next Steps

### To Run
1. `cd mobile`
2. `npm install`
3. `npm start`
4. Press `i` (iOS) or `a` (Android)

### To Deploy
1. Update version in `app.json`
2. Build: `eas build --platform ios/android`
3. Submit: `eas submit --platform ios/android`
4. Wait for review (~24-48 hours)

### To Add Features
1. New screens in `src/screens/`
2. API calls in `src/services/apiClient.ts`
3. Navigation in `src/App.tsx`
4. Test with hot reload

## Useful Resources

- [Expo Docs](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Still Need Help?

1. Check [SETUP_IOS.md](./SETUP_IOS.md) or [SETUP_ANDROID.md](./SETUP_ANDROID.md)
2. Review [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup
3. See [README.md](./README.md) for full feature list

---

**Ready? Run:** `npm start` 🚀

For detailed setup, see SETUP_IOS.md or SETUP_ANDROID.md
