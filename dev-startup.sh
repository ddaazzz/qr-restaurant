#!/bin/bash

# Backend startup script for QR Restaurant (production build testing)

echo "🚀 QR Restaurant Backend Setup"
echo "=============================="
echo ""

# Kill any existing processes
echo "🛑 Cleaning up old processes..."
killall -9 npm node 2>/dev/null || true
sleep 2

# Create/update .env.local for mobile app (production backend)
echo "📝 Configuring mobile app..."
cat > /Users/user/Documents/qr-restaurant-ai/mobile/.env.local << EOF
# API URL - connects to production Chuio backend
EXPO_PUBLIC_API_URL=https://chuio.io
EOF
echo "✅ Mobile .env.local configured"
echo "🌐 API URL: https://chuio.io"

sleep 1

# Start Backend
echo ""
echo "📍 Starting Backend Server..."
cd /Users/user/Documents/qr-restaurant-ai/backend
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

sleep 5

echo ""
echo "✅ Backend ready!"
echo ""
echo "📊 Service Status:"
curl -s http://localhost:10000/health > /dev/null && echo "   ✅ Backend responding on http://localhost:10000" || echo "   ❌ Backend not responding"
echo ""
echo "🚀 Next Steps for Xcode Testing:"
echo "   1. Open Xcode"
echo "   2. Press Cmd+Shift+K (Clean Build)"
echo "   3. Press Cmd+B (Build)"
echo "   4. Press Cmd+R (Run on iPhone)"
echo ""
echo "📱 App will connect to: https://chuio.io"
echo ""
echo "Keep this terminal open. Press Ctrl+C to stop backend."
echo ""

# Wait for signals
wait
