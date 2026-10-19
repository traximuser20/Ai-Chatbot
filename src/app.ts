import './process-shim';
import { createApp } from 'nativescript-vue';
import { createPinia } from 'pinia';
import Home from './components/Home.vue';

const app = createApp(Home);
const pinia = createPinia();

app.use(pinia);
app.start();
