import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import App from './App';
import './styles/global.less';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1890ff',
          colorBgLayout: '#0a0e1a',
          colorBgContainer: '#0f172a',
          colorText: 'rgba(255, 255, 255, 0.85)',
          colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
          colorBorder: '#1e293b',
          borderRadius: 4,
        },
        components: {
          Layout: {
            bodyBg: '#0a0e1a',
            headerBg: '#0f172a',
            siderBg: '#0f172a',
          },
          Card: {
            colorBgContainer: '#0f172a',
            colorBorder: '#1e293b',
          },
          Table: {
            colorBgContainer: '#0f172a',
            colorBgElevated: '#1e293b',
            colorBorder: '#1e293b',
          },
          Modal: {
            colorBgElevated: '#0f172a',
            colorBgMask: 'rgba(0, 0, 0, 0.7)',
          },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
