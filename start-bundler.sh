#!/bin/bash

# QR Restaurant Metro Bundler Startup Script
# Run this to start the development bundler

cd /Users/user/Documents/qr-restaurant-ai/mobile

echo "🚀 Starting Metro Bundler..."
echo "📍 Binding to: http://127.0.0.1:8081"
echo ""
echo "Keep this terminal open while building in Xcode"
echo "Press Ctrl+C to stop the bundler"
echo ""

# Start the bundler using node directly
node_modules/.bin/expo start --localhost
