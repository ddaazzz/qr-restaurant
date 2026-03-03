# Architecture & Deployment Guide

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User Devices                         │
├─────────┬─────────┬──────────┬────────────────────────┤
│ iOS App │Android  │ Web Site │  Admin Browser         │
│ (Native)│ App     │(Optional)│ (localhost:3000)       │
│(Expo)   │(Expo)   │          │                        │
└────┬────┴────┬────┴───┬──────┴──────┬─────────────────┘
     │         │        │             │
     └─────────┴────┬───┴─────────────┘  HTTPS/OAuth
                    │
           ┌────────v────────┐
           │  Express.js     │
           │  Backend        │
           │ (Port 10000)    │
           │  - Auth         │
           │  - Orders       │
           │  - Menu         │
           │  - Printers     │
           └────────┬────────┘
                    │
           ┌────────v─────────┐
           │ PostgreSQL       │
           │ Database         │
           │ - Restaurants    │
           │ - Users/Staff    │
           │ - Orders         │
           │ - Menu Items     │
           └──────────────────┘
```

## Mobile App Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React Native + Expo | Cross-platform iOS/Android |
| **Language** | TypeScript | Type-safe development |
| **UI** | React Native Built-in | Native components |
| **Navigation** | React Navigation | Screen transitions |
| **HTTP** | Axios | API communication |
| **State** | React Context + Hooks | State management |
| **Storage** | AsyncStorage + SecureStore | Persist data locally |
| **Bluetooth** | react-native-ble-plx | Printer communication |
| **Build Tool** | Expo EAS | CI/CD builds |

### Component Architecture

```
App.tsx (Root)
├── AuthProvider (Context)
├── NavigationContainer (React Navigation)
│   ├── LoginStackNavigator
│   │   ├── LoginChoiceScreen
│   │   ├── LoginScreen (Admin)
│   │   └── KitchenLoginScreen
│   ├── AdminStackNavigator
│   │   ├── AdminDashboardScreen
│   │   └── PrinterSettingsScreen
│   └── KitchenDashboard
│
Services Layer
├── apiClient.ts (HTTP + Auth)
├── bluetoothService.ts (Printer Discovery)
└── storageService.ts (Local Persistence)

Hooks Layer
├── useAuth.tsx (Authentication)
└── useAPI.ts (Data Fetching)
```

### Data Flow

```
User Input
    ↓
Screen Component
    ↓
useAuth/useAPI Hook
    ↓
Service Layer
    ├── apiClient.ts
    ├── bluetoothService.ts
    └── storageService.ts
    ↓
API / Bluetooth / Storage
    ↓
Backend / Device / LocalDB
```

## API Integration

### Authentication Flow

```
Login Screen
    ↓
POST /api/auth/login {email, password}
    ↓
Backend validates JWT
    ↓
Returns: {token, role, restaurantId}
    ↓
SecureStore saves token
    ↓
API client adds to headers:
    Authorization: Bearer <token>
    X-Restaurant-ID: <restaurantId>
    ↓
Authenticated Requests
```

### Printer Workflow

```
Printer Settings Screen
    ↓
bluetoothService.scanForPrinters()
    ↓
BLE Scan (10 seconds)
    ↓
Returns discovered devices
    ↓
User selects printer
    ↓
bluetoothService.connectPrinter(deviceId)
    ↓
Discovers services & characteristics
    ↓
storageService.savePrinter(config)
    ↓
Stored for future sessions
```

### Order Printing

```
Kitchen Dashboard
    (Views new order)
    ↓
KitchenStaff taps "Ready"
    ↓
bluetoothService.printOrder(orderId, {items, total})
    ↓
Generates ESC/POS commands
    ↓
Sends via BLE to printer
    ↓
Thermal printer outputs receipt
```

## Deployment Strategy

### Development Environment
```
Local Machine:
- Node.js 16+ (backend runs with npm run dev)
- PostgreSQL (local or Docker)
- Expo CLI (local development)
- iOS Simulator / Android Emulator

Connection:
- App → http://localhost:10000 (or 10.0.2.2 for Android)
```

### Staging Environment
```
Staging Server:
- Express.js deployed (PM2 or Docker)
- PostgreSQL RDS instance
- SSL certificate (self-signed for testing)

Connection:
- App → https://staging-api.yourdomain.com:10000
- Env: EXPO_PUBLIC_API_URL=https://staging-api.yourdomain.com:10000
```

### Production Environment
```
Production Server:
- Express.js (load balanced with PM2 cluster mode)
- PostgreSQL RDS (replicated, backed up)
- CloudFlare/Nginx (reverse proxy)
- SSL certificate (Let's Encrypt)

Connection:
- App → https://api.yourdomain.com
- Env: EXPO_PUBLIC_API_URL=https://api.yourdomain.com

Distribution:
- iOS: App Store
- Android: Google Play Store
- Web: yourdomain.com
```

## Deployment Step-by-Step

### 1. Backend Deployment (Render/Heroku/AWS)

#### Render Deployment
```bash
# 1. Create Render account
# 2. Connect GitHub repo
# 3. Create new Web Service
#    - Build: npm install
#    - Start: npm run build && npm start
# 4. Add environment variables:
#    DATABASE_URL=postgresql://...
#    NODE_ENV=production
#    PORT=10000
# 5. Deploy
```

#### Docker (Self-Hosted)
```dockerfile
# backend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 10000
CMD ["npm", "start"]
```

```bash
docker build -t qr-restaurant-api .
docker run -e DATABASE_URL=postgres://... -p 10000:10000 qr-restaurant-api
```

### 2. Database Setup (Production)

```bash
# AWS RDS PostgreSQL
# 1. Create RDS instance
# 2. Run migrations:
psql $DATABASE_URL < migrations/001_init.sql
psql $DATABASE_URL < migrations/002_users.sql
...

# 3. Create backups:
pg_dump $DATABASE_URL > backup.sql

# 4. Enable automated backups in RDS console
```

### 3. iOS App Distribution

#### Build
```bash
# 1. Update version in app.json
{
  "expo": {
    "version": "1.0.0",
    ...
  }
}

# 2. Build for production
eas build --platform ios --auto-submit

# 3. Incremental builds
eas build --platform ios --type release --profile production
```

#### App Store Submission
```bash
# 1. Create Apple Developer Account ($99/year)

# 2. In Xcode:
# - Set Team ID
# - Configure signing certificates
# - Set provisioning profile

# 3. Submit via Expo
eas submit --platform ios

# 4. Apple review (24-48 hours)

# 5. Release in App Store Connect
```

#### TestFlight (Beta Testing)
```bash
# 1. Build with --production flag
eas build --platform ios --production

# 2. Upload to TestFlight automatically
# 3. Invite testers via email
# 4. Testers install via TestFlight app
```

### 4. Android App Distribution

#### Build
```bash
# 1. Update version in app.json
# 2. Build release APK
eas build --platform android --type apk

# 3. Build App Bundle (for Play Store)
eas build --platform android --type app-bundle
```

#### Google Play Store
```bash
# 1. Create Google Play Developer account ($25 one-time)

# 2. Setup in Google Play Console:
# - Create app listing
# - Add store content (screenshots, description)
# - Set pricing & distribution

# 3. Configure signing:
eas build --platform android --auto-submit

# 4. Submit for review
eas submit --platform android

# 5. Wait for review (24-72 hours)

# 6. Release to production
```

#### Internal Testing Track
```bash
# Release to internal testers before public launch
eas submit --platform android --track internal

# After testing, promote to production
# via Google Play Console
```

## Environment Configuration

### .env in Backend
```env
# database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SSL=true

# api
PORT=10000
NODE_ENV=production
JWT_SECRET=your-secret-key-here

# cors
FRONTEND_URL=https://yourdomain.com
MOBILE_URL=https://api.yourdomain.com

# email (if configured)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=465
SMTP_USER=user@example.com
SMTP_PASS=password

# printer webhook
POS_WEBHOOK_TIMEOUT=30000

# stripe (if payment enabled)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### app.json in Mobile (Production Updates)
```json
{
  "expo": {
    "name": "QR Restaurant",
    "version": "1.0.0",
    "ios": {
      "buildNumber": "1",
      "bundleIdentifier": "com.qrrestaurant.app"
    },
    "android": {
      "versionCode": 1,
      "package": "com.qrrestaurant.app"
    }
  }
}
```

## Monitoring & Maintenance

### Uptime Monitoring
```bash
# Setup 3rd party monitoring
# - Render: Built-in uptime monitoring
# - Sentry: Error tracking
# - DataDog: Performance monitoring

# Health Check Endpoint (add to backend)
GET /api/health
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Log Monitoring
```bash
# Real-time logs from Render
render logs --service qr-restaurant-api

# Database query logs
SET log_statement = 'all';
```

### Performance Optimization

1. **API Response Caching**
   ```
   Menu: Cache 24 hours (rarely changes)
   Orders: Cache 5 seconds (frequent updates)
   User: Cache 1 hour
   ```

2. **Database Indexes**
   ```sql
   CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
   CREATE INDEX idx_items_created ON menu_items(created_at);
   CREATE INDEX idx_sessions_ended ON table_sessions(ended_at);
   ```

3. **Connection Pooling**
   ```
   Backend: Use PgBouncer
   Pool Size: 20-50
   Max Overflow: 10
   ```

4. **CDN for Static Files**
   ```
   Uploads (images): CloudFront or Cloudflare
   App Screenshots: CloudFront
   ```

## Rollback & Recovery

### Database Backup/Restore
```bash
# Backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup-20240101.sql
```

### API Rollback
```bash
# 1. Revert commit
git revert <commit-hash>
git push

# 2. Render auto-deploys
# Or manually trigger:
render deploy --service qr-restaurant-api

# 3. Database migrations (if needed)
npm run migrate:rollback
```

### App Emergency Updates
```bash
# Use Expo Over-The-Air (OTA) Updates
# Changes to JavaScript reload without app store review

# 1. Publish update
expo publish

# 2. App downloads on next launch
# 3. Can revert immediately if issues
```

## Security Considerations

### HTTPS/SSL
```bash
# All API requests must be HTTPS
FRONTEND_URL=https://yourdomain.com
NODE_ENV=production

# Self-signed for testing only:
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem
```

### Authentication
- JWT tokens with 24-hour expiry
- Refresh tokens in secure HTTP-only cookies
- SecureStore for mobile token storage

### Database
- Connection strings never in code
- Parameterized queries (prevent SQL injection)
- Row-level security for multi-tenant

### Data Privacy
- GDPR compliance (implement data export/deletion)
- Audit logs for sensitive operations
- Encryption at rest for sensitive data

## Troubleshooting Deployment

### App Won't Connect to API
```bash
# 1. Check API is running
curl https://api.yourdomain.com/api/health

# 2. Verify CORS
# Backend should allow mobile origin

# 3. Check JWT token
# Token may have expired

# 4. Review firewall rules
# Ensure port 10000 is open
```

### Database Connection Failed
```bash
# 1. Verify connection string
# DATABASE_URL format: postgresql://user:pass@host:5432/db

# 2. Check network access
# RDS security group should allow backend IP

# 3. Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### App Store Review Rejection
- Common issues: Privacy violations, unclear purpose
- See guidelines: [App Store Review Guidelines](https://developer.apple.com/app-store/review/)
- Appeal with explanation

## Success Checklist

- [ ] Backend deployed to production domain
- [ ] Database setup with backups
- [ ] HTTPS/SSL certificates configured
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] iOS app built & submitted to App Store
- [ ] Android app built & submitted to Play Store
- [ ] Monitoring/alerting configured
- [ ] Domain DNS configured
- [ ] Email notifications working

---

**Deployment Complete!** Your app is now live on iOS & Android. 🚀
