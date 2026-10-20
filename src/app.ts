import './process-shim';
import './app.css';
import { createApp, isKnownView, registerElement } from 'nativescript-vue';
import { View } from '@nativescript/core';
import { createPinia } from 'pinia';
import App from './App.vue';
import { press } from './directives/press';

// `View` is the plain view of the core, but NativeScript-Vue does not
// register it. The icon set draws its parts with it, so it is registered
// here - and only when nobody else has done it already.
if (!isKnownView('View')) {
  registerElement('View', () => View);
}

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
// Tactile feedback for every tappable surface.
app.directive('press', press);
app.start();
