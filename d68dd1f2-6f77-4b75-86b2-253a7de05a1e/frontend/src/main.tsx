import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import App from './App';
import { useUIStore } from '@/store/uiStore';
import './index.css';

dayjs.locale('zh-cn');

const Root: React.FC = () => {
  const { themeMode, getAntdAlgorithm } = useUIStore();

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: getAntdAlgorithm(),
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
        },
        components: {
          Layout: {
            headerBg: themeMode === 'dark' ? '#001529' : '#ffffff',
            siderBg: themeMode === 'dark' ? '#001529' : '#001529',
            triggerBg: themeMode === 'dark' ? '#000c17' : '#f0f0f0'
          },
          Menu: {
            darkItemBg: '#001529',
            darkSubMenuItemBg: '#000c17'
          }
        }
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
