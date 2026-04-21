#!/bin/bash
# Restores .env.local to dev settings after a production archive.
# Run this after Xcode finishes archiving.

set -e
MOBILE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -f "$MOBILE_DIR/.env.local.dev.bak" ]; then
  mv "$MOBILE_DIR/.env.local.dev.bak" "$MOBILE_DIR/.env.local"
  echo "✅ .env.local restored to dev settings (https://dev.chuio.io)"
else
  cat > "$MOBILE_DIR/.env.local" << 'EOF'
# DEV — restored by bundle-dev.sh
EXPO_PUBLIC_API_URL=https://dev.chuio.io
EXPO_PUBLIC_APP_ENV=dev
EOF
  echo "✅ .env.local restored to dev settings (https://dev.chuio.io)"
fi
