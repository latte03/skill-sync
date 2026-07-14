import { createApp } from 'vue';
import App from './App.vue';
import naive from './naive-ui-provider';

const app = createApp(App);

// Naive UI — 按需引入
app.use(naive);

app.mount('#app');
