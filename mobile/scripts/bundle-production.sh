#!/bin/bash
# Run this before archiving in Xcode for an App Store / production build.
# It temporarily replaces .env.local with production values so Metro bundles
# the correct API URL into the binary.
#
# Usage:  cd mobile && bash scripts/bundle-production.sh
#
# After Xcode finishes archiving you can restore dev settings with:
#         bash scripts/bundle-dev.sh

set -e
MOBILE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Switching to PRODUCTION environment (https://chuio.io)"

cp "$MOBILE_DIR/.env.local" "$MOBILE_DIR/.env.local.dev.bak" 2>/dev/null || true

cat > "$MOBILE_DIR/.env.local" << 'EOF'
# PRODUCTION — baked in by bundle-production.sh
# Restore dev settings: bash scripts/bundle-dev.sh
EXPO_PUBLIC_API_URL=https://chuio.io
EXPO_PUBLIC_APP_ENV=production
EOF

echo "✅ .env.local now points to https://chuio.io"
echo "   Archive in Xcode now, then run: bash scripts/bundle-dev.sh to restore"
