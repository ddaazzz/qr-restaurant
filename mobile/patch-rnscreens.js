#!/usr/bin/env node
/**
 * Patch react-native-screens to remove unsupported onUserDrivenAnimationEnded listener
 * This fixes SDK 54 compatibility with React Native 0.76.0
 */
const fs = require('fs');
const path = require('path');

const nativeModuleFile = path.join(
  __dirname,
  'node_modules',
  'react-native-screens',
  'lib',
  'commonjs',
  'native-stack',
  'index.native.js'
);

const alternativePath = path.join(
  __dirname,
  'node_modules',
  'react-native-screens',
  'lib',
  'commonjs',
  'native-stack',
  'utils',
  'RNSScreenStackHeaderConfig.js'
);

// Also try the ios-handler file
const iosHandlerPath = path.join(
  __dirname,
  'node_modules',
  'react-native-screens',
  'ios',
  'RNSScreenStackHeaderConfig.m'
);

function patchFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove the event listener for onUserDrivenAnimationEnded
    if (content.includes('onUserDrivenAnimationEnded')) {
      content = content.replace(
        /\.addListener\s*\(\s*['"']?onUserDrivenAnimationEnded['"']?\s*,/g,
        '.addListener('
      );
      content = content.replace(
        /\.addListener\(\s*['"']?onUserDrivenAnimationEnded['"']?\s*,\s*\(\s*\)\s*=>\s*\{\}/g,
        ''
      );
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Patched: ${filePath}`);
      return true;
    } else {
      console.log(`No changes needed in: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`Error patching ${filePath}:`, error.message);
    return false;
  }
}

// Try all known locations
const files = [nativeModuleFile, alternativePath, iosHandlerPath];
let patched = false;

files.forEach(file => {
  if (patchFile(file)) {
    patched = true;
  }
});

if (!patched) {
  console.log('⚠ Warning: Could not locate react-native-screens files to patch');
  console.log('The app may still experience animation-related errors');
}
