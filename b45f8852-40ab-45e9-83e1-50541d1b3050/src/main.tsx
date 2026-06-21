import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import App from './App';
import './index.css';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const primaryColor = '#4F46E5';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.compactAlgorithm,
        token: {
          colorPrimary: primaryColor,
          colorInfo: primaryColor,
          colorLink: primaryColor,
          borderRadius: 6,
          colorPrimaryBg: '#EEF2FF',
          colorPrimaryBgHover: '#E0E7FF',
          colorPrimaryBorder: '#C7D2FE',
          colorPrimaryBorderHover: '#A5B4FC',
          colorPrimaryHover: '#6366F1',
          colorPrimaryActive: '#4338CA',
          colorPrimaryText: '#4F46E5',
          colorPrimaryTextHover: '#6366F1',
          fontFamily:
            '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", sans-serif',
        },
        components: {
          Button: {
            borderRadius: 6,
            controlHeight: 36,
            controlHeightLG: 44,
            controlHeightSM: 28,
            primaryShadow: '0 2px 6px 0 rgba(79, 70, 229, 0.3)',
          },
          Card: {
            borderRadius: 10,
            borderRadiusLG: 12,
            borderRadiusSM: 8,
          },
          Table: {
            borderRadius: 8,
            borderRadiusLG: 10,
          },
          Input: {
            borderRadius: 6,
            controlHeight: 36,
            controlHeightLG: 44,
          },
          Select: {
            borderRadius: 6,
            controlHeight: 36,
            controlHeightLG: 44,
          },
          DatePicker: {
            borderRadius: 6,
            controlHeight: 36,
            controlHeightLG: 44,
          },
          Modal: {
            borderRadius: 8,
          },
          Drawer: {
            borderRadiusLG: 12,
          },
          Tabs: {
            borderRadius: 6,
            inkBarColor: primaryColor,
            itemSelectedColor: primaryColor,
            itemHoverColor: '#6366F1',
          },
          Steps: {
            colorPrimary: primaryColor,
            colorBorder: '#C7D2FE',
          },
          Tag: {
            borderRadiusSM: 100,
            borderRadius: 100,
            borderRadiusLG: 100,
          },
          Progress: {
            colorInfo: primaryColor,
          },
          Badge: {
            colorPrimary: primaryColor,
          },
          Avatar: {
            containerSize: 36,
            containerSizeLG: 48,
            containerSizeSM: 24,
          },
          Pagination: {
            colorPrimary: primaryColor,
          },
          Checkbox: {
            colorPrimary: primaryColor,
          },
          Radio: {
            colorPrimary: primaryColor,
          },
          Switch: {
            colorPrimary: primaryColor,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>
);
