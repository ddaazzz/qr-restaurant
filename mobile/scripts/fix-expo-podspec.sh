#!/bin/bash

# Fix Expo.podspec ReactAppDependencyProvider dependency for RN 0.76.1
PODSPEC_FILE="node_modules/expo/Expo.podspec"

if [ -f "$PODSPEC_FILE" ]; then
  # Check if the problematic dependency exists
  if grep -q "s.dependency 'ReactAppDependencyProvider'" "$PODSPEC_FILE"; then
    echo "Patching Expo.podspec to remove ReactAppDependencyProvider dependency..."
    sed -i '' "s/  s\.dependency 'ReactAppDependencyProvider'/  # PATCHED: Removed ReactAppDependencyProvider for RN 0.76.1 compatibility/" "$PODSPEC_FILE"
    echo "✓ Expo.podspec patched successfully"
  fi
else
  echo "⚠ Expo.podspec not found - skipping patch"
fi
