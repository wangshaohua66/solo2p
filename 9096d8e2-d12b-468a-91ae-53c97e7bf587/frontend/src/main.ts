import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client/core'
import { createApolloProvider } from '@vue/apollo-composable'
import App from './App.vue'
import router from './router'
import './styles/global.scss'

const httpLink = createHttpLink({
  uri: '/graphql'
})

const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache()
})

const apolloProvider = createApolloProvider({
  defaultClient: apolloClient
})

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.use(apolloProvider)

app.mount('#app')
