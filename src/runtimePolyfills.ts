/**
 * Hermes compatibility shims used by the Alpine terminal runtime and xterm.
 */
import 'fast-text-encoding';
import 'react-native-get-random-values';
import 'web-streams-polyfill/polyfill';

export function applyRuntimePolyfills(): void {
  const g = globalThis as {navigator?: {userAgent?: string; platform?: string}};
  if (!g.navigator) {
    g.navigator = {userAgent: 'ReactNative', platform: 'ReactNative'};
  } else {
    g.navigator.userAgent ??= 'ReactNative';
    g.navigator.platform ??= 'ReactNative';
  }
}

// xterm/headless requires navigator to be defined at import time.
applyRuntimePolyfills();

