import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import pinia from './stores/user'
import './styles/index.scss'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus)
app.use(pinia)
app.use(router)

app.mount('#app')

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => console.log('SW registered:', reg.scope))
    .catch((err) => console.error('SW registration failed:', err))
} else if ('serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then(() => console.log('SW registered (dev mode)'))
    .catch((err) => console.warn('SW registration skipped (dev):', err))
}
