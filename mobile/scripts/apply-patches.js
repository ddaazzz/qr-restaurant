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

// Patch 3: engine.io-client - replace .node.js imports with browser equivalents
// Metro with unstable_enablePackageExports doesn't honor the "browser" field file-level
// remapping, so Node.js-specific transports/globals get loaded and crash React Native.
const engineIoBase = path.join(__dirname, '../node_modules/engine.io-client/build');

try {
  const replacements = [
    // Transport index files: replace .node.js transport imports with browser versions
    { file: 'esm/transports/index.js', from: /\.\/polling-xhr\.node\.js/g, to: './polling-xhr.js' },
    { file: 'esm/transports/index.js', from: /\.\/websocket\.node\.js/g, to: './websocket.js' },
    { file: 'cjs/transports/index.js', from: /\.\/polling-xhr\.node\.js/g, to: './polling-xhr.js' },
    { file: 'cjs/transports/index.js', from: /\.\/websocket\.node\.js/g, to: './websocket.js' },
    // globals.node.js → globals.js (ESM)
    { file: 'esm/util.js', from: /\.\/globals\.node\.js/g, to: './globals.js' },
    { file: 'esm/socket.js', from: /\.\/globals\.node\.js/g, to: './globals.js' },
    { file: 'esm/index.js', from: /\.\/globals\.node\.js/g, to: './globals.js' },
    { file: 'esm/transports/webtransport.js', from: /\.\.\/globals\.node\.js/g, to: '../globals.js' },
    { file: 'esm/transports/polling-xhr.js', from: /\.\.\/globals\.node\.js/g, to: '../globals.js' },
    { file: 'esm/transports/websocket.js', from: /\.\.\/globals\.node\.js/g, to: '../globals.js' },
    // globals.node.js → globals.js (CJS)
    { file: 'cjs/util.js', from: /\.\/globals\.node\.js/g, to: './globals.js' },
    { file: 'cjs/socket.js', from: /\.\/globals\.node\.js/g, to: './globals.js' },
    { file: 'cjs/index.js', from: /\.\/globals\.node\.js/g, to: './globals.js' },
    { file: 'cjs/transports/webtransport.js', from: /\.\.\/globals\.node\.js/g, to: '../globals.js' },
    { file: 'cjs/transports/polling-xhr.js', from: /\.\.\/globals\.node\.js/g, to: '../globals.js' },
    { file: 'cjs/transports/websocket.js', from: /\.\.\/globals\.node\.js/g, to: '../globals.js' },
  ];

  let patchedCount = 0;
  for (const { file, from, to } of replacements) {
    const filePath = path.join(engineIoBase, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      if (from.test(content)) {
        // Reset regex lastIndex since we used .test()
        from.lastIndex = 0;
        content = content.replace(from, to);
        fs.writeFileSync(filePath, content);
        patchedCount++;
      }
    }
  }

  if (patchedCount > 0) {
    console.log(`[Patches] ✅ engine.io-client patched (${patchedCount} files)`);
  } else {
    console.log('[Patches] ℹ️  engine.io-client already patched or not found');
  }
} catch (err) {
  console.log('[Patches] ℹ️  Could not patch engine.io-client:', err.message);
}

// Patch 4: react-native-svg - fix Apple header imports for filter enum headers
const rnsvgHeaderFiles = [
  path.join(__dirname, '../node_modules/react-native-svg/apple/Utils/RCTConvert+RNSVG.h'),
  path.join(__dirname, '../node_modules/react-native-svg/apple/Utils/RNSVGConvert.h'),
];

try {
  let patchedCount = 0;
  const replacements = [
    ['#import "RNSVGBlendMode.h"', '#import "../Filters/RNSVGBlendMode.h"'],
    ['#import "RNSVGColorMatrixType.h"', '#import "../Filters/RNSVGColorMatrixType.h"'],
    ['#import "RNSVGCompositeOperator.h"', '#import "../Filters/RNSVGCompositeOperator.h"'],
    ['#import "RNSVGEdgeMode.h"', '#import "../Filters/RNSVGEdgeMode.h"'],
  ];

  for (const filePath of rnsvgHeaderFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let filePatched = false;

    for (const [from, to] of replacements) {
      if (content.includes(from)) {
        content = content.replace(from, to);
        filePatched = true;
      }
    }

    if (filePatched) {
      fs.writeFileSync(filePath, content);
      patchedCount++;
    }
  }

  if (patchedCount > 0) {
    console.log(`[Patches] ✅ react-native-svg patched (${patchedCount} files)`);
  } else {
    console.log('[Patches] ℹ️  react-native-svg already patched or not found');
  }
} catch (err) {
  console.log('[Patches] ℹ️  Could not patch react-native-svg:', err.message);
}

console.log('[Patches] ✅ All patches applied successfully');
