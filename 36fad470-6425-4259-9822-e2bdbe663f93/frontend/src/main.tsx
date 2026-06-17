import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import App from './App'
import { store } from './store'
import { setDispatch } from './api'
import './styles/global.scss'

dayjs.locale('zh-cn')
setDispatch(store.dispatch)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 6
          }
        }}
      >
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>
    </Provider>
  </React.StrictMode>
)
