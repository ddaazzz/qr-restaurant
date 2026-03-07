/**
 * AnimationErrorPatcher.ts
 * 
 * Patches the native NativeAnimatedModule to silently ignore unsupported listener registrations.
 * This prevents the "onUserDrivenAnimationEnded" error that occurs in SDK 54 / RN 0.76
 * while maintaining full app functionality.
 */

import { NativeModules, NativeEventEmitter } from 'react-native';

export function patchAnimationErrors() {
  try {
    const NativeAnimatedModule = NativeModules.NativeAnimatedModule;
    
    if (!NativeAnimatedModule) {
      console.log('[AnimationPatcher] NativeAnimatedModule not available');
      return;
    }

    // Wrap the native module's addListener to catch unsupported event errors
    const originalAddListener = NativeAnimatedModule.addListener;
    
    if (originalAddListener) {
      NativeAnimatedModule.addListener = function(...args: any[]) {
        try {
          return originalAddListener.apply(this, args);
        } catch (error: any) {
          // Silently ignore "onUserDrivenAnimationEnded" and other unsupported events
          if (error?.message?.includes('onUserDrivenAnimationEnded') ||
              error?.message?.includes('not a supported event')) {
            console.log('[AnimationPatcher] Suppressed unsupported event listener:', error.message);
            return;
          }
          // Re-throw other errors
          throw error;
        }
      };
      
      console.log('[AnimationPatcher] Patched NativeAnimatedModule.addListener');
    }
  } catch (error) {
    console.warn('[AnimationPatcher] Failed to patch animation errors:', error);
  }
}
