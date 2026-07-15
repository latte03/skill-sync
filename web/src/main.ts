import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import naive from './naive-ui-provider';
import 'virtual:uno.css';

const app = createApp(App);

// Vue Router
app.use(router);

// Naive UI — 按需引入
app.use(naive);

app.mount('#app');
