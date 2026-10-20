import './process-shim';
import './app.css';
import { createApp } from 'nativescript-vue';
import { createPinia } from 'pinia';
import Diag from './components/Diag.vue';

const app = createApp(Diag);
const pinia = createPinia();

app.use(pinia);
app.start();
