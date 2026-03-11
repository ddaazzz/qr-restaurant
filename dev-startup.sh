#!/bin/bash

# Complete startup script for QR Restaurant development

echo "🚀 QR Restaurant Development Setup"
echo "===================================="
echo ""

# Kill any existing processes
echo "🛑 Cleaning up old processes..."
killall -9 npm node expo 2>/dev/null || true
sleep 2

# Create/update .env.local for mobile app (production backend)
echo "📝 Configuring mobile app..."
cat > /Users/user/Documents/qr-restaurant-ai/mobile/.env.local << EOF
# API URL - connects to production Chuio backend
EXPO_PUBLIC_API_URL=https://www.chuio.io
EOF
echo "✅ Mobile .env.local configured"
echo "🌐 API URL: https://www.chuio.io"

sleep 1

# Start Backend (optional - for local testing)
echo ""
echo "📍 Starting Local Backend (optional)..."
echo "   Set EXPO_PUBLIC_API_URL=http://localhost:10000 in .env.local to use local backend"
echo ""

cd /Users/user/Documents/qr-restaurant-ai/backend
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

sleep 5

# Start Metro Bundler
echo "📍 Starting Metro Bundler..."
cd /Users/user/Documents/qr-restaurant-ai/mobile
npm start > /tmp/metro.log 2>&1 &
METRO_PID=$!
echo "✅ Metro started (PID: $METRO_PID)"

sleep 5

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Service Status:"
curl -s http://localhost:10000/health > /dev/null && echo "   ✅ Local backend responding" || echo "   ℹ️  Local backend not needed (using production)"
lsof -i :8081 > /dev/null && echo "   ✅ Metro on port 8081" || echo "   ❌ Metro not listening"
echo ""
echo "🚀 Next Steps:"
echo "   1. Open Xcode"
echo "   2. Press Cmd+Shift+K (Clean Build)"
echo "   3. Press Cmd+B (Build)"
echo "   4. Press Cmd+R (Run)"
echo ""
echo "🔗 App will connect to: https://www.chuio.io"
echo ""
echo "Keep this terminal open. Press Ctrl+C to stop all services."
echo ""

# Wait for signals
wait
