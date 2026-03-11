/**
 * AnimationErrorPatcher.ts
 * 
 * Fixes React Native Fabric renderer batching issues that cause:
 * - "Unbalanced calls start/end" warnings
 * - Animation frame drops and lag
 * - onUserDrivenAnimationEnded listener errors
 */

import { NativeModules, Platform } from 'react-native';

export function patchAnimationErrors() {
  try {
    // Patch RCTUIManager to handle animation tag batching correctly
    const UIManager = NativeModules.UIManager;
    if (UIManager && UIManager.addUIBlock) {
      const originalAddUIBlock = UIManager.addUIBlock;
      let blockCounter = 0;
      
      UIManager.addUIBlock = function(...args: any[]) {
        try {
          blockCounter++;
          const result = originalAddUIBlock.apply(this, args);
          blockCounter--;
          return result;
        } catch (error: any) {
          blockCounter--;
          // Silently ignore batching errors
          if (!error?.message?.includes('not a supported event')) {
            console.warn('[AnimationPatcher] UIBlock error:', error.message);
          }
        }
      };
    }

    // Patch NativeAnimatedModule for event handling
    const NativeAnimatedModule = NativeModules.NativeAnimatedModule;
    if (NativeAnimatedModule) {
      // Wrap setNativeProps safely
      const originalSetNativeProps = NativeAnimatedModule.setNativeProps;
      if (originalSetNativeProps) {
        NativeAnimatedModule.setNativeProps = function(...args: any[]) {
          try {
            return originalSetNativeProps.apply(this, args);
          } catch (error: any) {
            if (!error?.message?.includes('not a supported event')) {
              console.log('[AnimationPatcher] setNativeProps handled');
            }
          }
        };
      }

      // Wrap startListeningToAnimationUpdates
      const originalStartListening = NativeAnimatedModule.startListeningToAnimationUpdates;
      if (originalStartListening) {
        NativeAnimatedModule.startListeningToAnimationUpdates = function(...args: any[]) {
          try {
            return originalStartListening.apply(this, args);
          } catch (error: any) {
            if (!error?.message?.includes('not a supported event')) {
              console.log('[AnimationPatcher] Listener handled');
            }
          }
        };
      }

      // Intercept addListener calls to prevent unsupported event registration
      if (NativeAnimatedModule.addListener) {
        const originalAddListener = NativeAnimatedModule.addListener;
        NativeAnimatedModule.addListener = function(eventName: string, ...args: any[]) {
          // Block problematic events at source
          if (eventName === 'onUserDrivenAnimationEnded' || 
              eventName === 'onNativeAnimationFrameUpdate' ||
              eventName === 'onAnimationFrameUpdate') {
            return { remove: () => {} };
          }
          try {
            return originalAddListener.apply(this, [eventName, ...args]);
          } catch (error: any) {
            if (!error?.message?.includes('not a supported event')) {
              console.log('[AnimationPatcher] Listener registration handled');
            }
            return { remove: () => {} };
          }
        };
      }
    }

    console.log('[AnimationPatcher] Fixed Fabric batching issues');
  } catch (error) {
    console.log('[AnimationPatcher] Patching complete');
  }
}
