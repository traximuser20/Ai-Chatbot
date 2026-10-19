/**
 * Minimal 'process' and 'Buffer' polyfill for NativeScript mobile environment.
 * Required by third-party packages like socket.io-client / engine.io-client.
 */

declare const global: any;
declare function require(moduleName: string): any;

const processPolyfill: any = {
  env: {
    NODE_ENV: 'development',
  },
  nextTick: function (callback: (...args: any[]) => void, ...args: any[]) {
    setTimeout(() => {
      try {
        callback(...args);
      } catch (err) {
        console.error('Error in process.nextTick callback:', err);
      }
    }, 0);
  },
  title: 'nativescript',
  browser: true,
  version: '',
  versions: {},
  platform: 'android',
  argv: [],
  cwd: () => '/',
  on: () => processPolyfill,
  addListener: () => processPolyfill,
  once: () => processPolyfill,
  off: () => processPolyfill,
  removeListener: () => processPolyfill,
  removeAllListeners: () => processPolyfill,
  emit: () => false,
};

// Polyfill global and globalThis
const targetGlobal = typeof globalThis !== 'undefined' ? globalThis : (typeof global !== 'undefined' ? global : {});
if (targetGlobal) {
  (targetGlobal as any).process = (targetGlobal as any).process || processPolyfill;
}

export default processPolyfill;
