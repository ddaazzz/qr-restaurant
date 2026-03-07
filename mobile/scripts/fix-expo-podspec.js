#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Try to find and patch Expo.podspec
const podspecPath = path.join(__dirname, '../node_modules/expo/Expo.podspec');
const maxAttempts = 5;
let attempts = 0;
let success = false;

while (attempts < maxAttempts && !success) {
  if (fs.existsSync(podspecPath)) {
    try {
      let content = fs.readFileSync(podspecPath, 'utf8');
      
      if (content.includes("s.dependency 'ReactAppDependencyProvider'")) {
        console.log('[Expo Patch] Removing ReactAppDependencyProvider dependency from Expo.podspec...');
        
        content = content.replace(
          "  s.dependency 'ReactAppDependencyProvider'",
          "  # PATCHED: Removed ReactAppDependencyProvider for RN 0.76.1 compatibility"
        );
        
        fs.writeFileSync(podspecPath, content);
        console.log('[Expo Patch] ✅ Successfully patched Expo.podspec');
        success = true;
      } else {
        console.log('[Expo Patch] ℹ️  Expo.podspec already patched or dependency not found');
        success = true;
      }
    } catch (err) {
      console.error('[Expo Patch] Error patching file:', err.message);
      attempts++;
      if (attempts < maxAttempts) {
        // Wait 100ms before retrying
        const now = Date.now();
        while (Date.now() - now < 100) {} // Block wait
      }
    }
  } else {
    console.log('[Expo Patch] ⚠️  Expo.podspec not found at', podspecPath);
    attempts++;
    if (attempts < maxAttempts) {
      // Wait 100ms before retrying
      const now = Date.now();
      while (Date.now() - now < 100) {} // Block wait
    }
  }
}

if (!success) {
  console.warn('[Expo Patch] Warning: Could not patch Expo.podspec after', maxAttempts, 'attempts');
  process.exit(0); // Don't fail npm install, just warn
}
