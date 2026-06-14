import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import { ElMessage, ElMessageBox } from 'element-plus'

import App from './App.vue'
import router from './router'
import './styles/global.scss'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.config.globalProperties.$message = ElMessage
app.config.globalProperties.$msgbox = ElMessageBox

app.mount('#app')
