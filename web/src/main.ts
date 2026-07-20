import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import 'virtual:uno.css';
import '../tokens.css';
import './styles/base.css';

const app = createApp(App);

// Vue Router
app.use(router);

app.mount('#app');
