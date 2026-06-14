import router from '@/router';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';

const themeConfig = {
  token: {
    colorPrimary: '#8B4513',
    colorInfo: '#8B4513',
    colorSuccess: '#22c55e',
    colorWarning: '#eab308',
    colorError: '#ef4444',
    borderRadius: 6,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
  },
  components: {
    Layout: {
      bodyBg: '#F5F2ED',
      headerBg: '#ffffff',
      siderBg: '#F5F2ED',
    },
    Button: {
      colorPrimary: '#8B4513',
      colorPrimaryHover: '#A0522D',
      colorPrimaryActive: '#6B3410',
    },
    Tag: {
      colorBorder: '#8B4513',
    },
    Menu: {
      itemSelectedColor: '#8B4513',
      itemSelectedBg: '#FFF7ED',
      horizontalItemSelectedColor: '#8B4513',
    },
    Drawer: {
      colorPrimary: '#8B4513',
    },
    Modal: {
      colorPrimary: '#8B4513',
    },
  },
};

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      {router}
    </ConfigProvider>
  );
}
