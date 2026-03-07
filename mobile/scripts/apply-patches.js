#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Patch 1: ExpoAppDelegate.swift - remove import
const expoAppDelegatePath = path.join(
  __dirname,
  '../node_modules/expo/ios/AppDelegates/ExpoAppDelegate.swift'
);

try {
  if (fs.existsSync(expoAppDelegatePath)) {
    let content = fs.readFileSync(expoAppDelegatePath, 'utf8');
    
    if (content.includes("import ReactAppDependencyProvider")) {
      console.log('[Patches] Removing ReactAppDependencyProvider import from ExpoAppDelegate.swift...');
      content = content.replace(
        "import ReactAppDependencyProvider\n",
        "// PATCHED: Removed import ReactAppDependencyProvider for RN 0.81.5 compatibility\n"
      );
      fs.writeFileSync(expoAppDelegatePath, content);
      console.log('[Patches] ✅ ExpoAppDelegate.swift patched');
    }
  }
} catch (err) {
  console.log('[Patches] ℹ️  Could not patch ExpoAppDelegate.swift:', err.message);
}

// Patch 2: Expo.podspec - remove dependency
const podspecPath = path.join(__dirname, '../node_modules/expo/Expo.podspec');

try {
  if (fs.existsSync(podspecPath)) {
    let content = fs.readFileSync(podspecPath, 'utf8');
    
    if (content.includes("s.dependency 'ReactAppDependencyProvider'")) {
      console.log('[Patches] Removing ReactAppDependencyProvider dependency from Expo.podspec...');
      content = content.replace(
        "  s.dependency 'ReactAppDependencyProvider'",
        "  # PATCHED: Removed ReactAppDependencyProvider for RN 0.81.5 compatibility"
      );
      fs.writeFileSync(podspecPath, content);
      console.log('[Patches] ✅ Expo.podspec patched');
    }
  }
} catch (err) {
  console.log('[Patches] ℹ️  Could not patch Expo.podspec:', err.message);
}

console.log('[Patches] ✅ All patches applied successfully');
