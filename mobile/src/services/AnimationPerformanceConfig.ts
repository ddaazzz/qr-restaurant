/**
 * AnimationPerformanceConfig.ts
 * 
 * Configures React Native to handle animations efficiently
 * and prevents frame batching issues that cause lag.
 */

import { InteractionManager, UIManager } from 'react-native';

export function configureAnimationPerformance() {
  try {
    // Enable layout animation on Android
    if (UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    // Optimize interaction manager debounce time
    // This prevents animation frame drops during navigation
    InteractionManager.setDeadline(5000);

    console.log('[AnimationConfig] Animation performance optimized');
  } catch (error) {
    console.warn('[AnimationConfig] Failed to configure animations:', error);
  }
}

/**
 * RequestAnimationFrame with proper batching
 * Ensures animations are batched correctly to prevent "Unbalanced calls" errors
 */
export function createOptimizedAnimator() {
  let frameId: any = null;
  let callbacks: Array<(time: number) => any> = [];
  let isProcessing = false;

  return {
    /**
     * Schedule a callback to run in the next animation frame
     */
    schedule(callback: (time: number) => any) {
      callbacks.push(callback);
      this.flush();
    },

    /**
     * Execute all pending callbacks in a single frame
     */
    flush() {
      if (isProcessing) return;

      isProcessing = true;
      frameId = requestAnimationFrame((time) => {
        const toProcess = callbacks;
        callbacks = [];
        isProcessing = false;

        for (const callback of toProcess) {
          try {
            callback(time);
          } catch (error) {
            console.warn('[AnimationOptimizer] Callback error:', error);
          }
        }
      });
    },

    /**
     * Clear pending callbacks
     */
    cancel() {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      callbacks = [];
    },
  };
}
