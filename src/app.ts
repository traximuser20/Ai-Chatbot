import './process-shim';
import './app.css';
import { createApp } from 'nativescript-vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { press } from './directives/press';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
// Tactile feedback for every tappable surface.
app.directive('press', press);
app.start();
