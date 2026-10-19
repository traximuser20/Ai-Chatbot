/// <reference path="../node_modules/@nativescript/types/index.d.ts" />
declare module '*.vue' {
  import type { DefineComponent } from 'nativescript-vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// Stylesheets are imported for their side effect (the NativeScript runtime
// loads and applies them), there is nothing to import from them.
declare module '*.css';
