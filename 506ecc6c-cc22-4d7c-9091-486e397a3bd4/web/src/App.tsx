import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import { store } from './store';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Works from './pages/Works';
import Royalty from './pages/Royalty';
import Monitor from './pages/Monitor';
import Dashboard from './pages/Dashboard';
import Copyright from './pages/Copyright';
import ProtectedRoute from './components/ProtectedRoute';

dayjs.locale('zh-cn');

const darkGoldTheme = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#D4AF37',
    colorInfo: '#D4AF37',
    colorSuccess: '#52C41A',
    colorWarning: '#FAAD14',
    colorError: '#FF4D4F',
    colorBgBase: '#0F0D06',
    colorBgContainer: '#1A170E',
    colorBgElevated: '#231F12',
    colorBgLayout: '#0F0D06',
    colorBorder: '#3B3218',
    colorBorderSecondary: '#2A2312',
    colorText: '#E8D8A0',
    colorTextSecondary: '#B8A06A',
    colorTextTertiary: '#8B7A4A',
    borderRadius: 8,
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#151208',
      siderBg: '#151208',
      bodyBg: '#0F0D06',
      triggerBg: '#231F12',
      triggerColor: '#D4AF37',
    },
    Menu: {
      darkItemBg: '#151208',
      darkSubMenuItemBg: '#1A170E',
      darkItemSelectedBg: '#3B3218',
      darkItemSelectedColor: '#FFD700',
      darkItemColor: '#B8A06A',
      darkItemHoverColor: '#E8D8A0',
      darkItemHoverBg: '#231F12',
    },
    Table: {
      headerBg: '#231F12',
      headerColor: '#FFD700',
      rowHoverBg: '#1E1A0E',
      borderColor: '#3B3218',
      headerSortActiveBg: '#2A2312',
      headerSortHoverBg: '#2A2312',
    },
    Card: {
      headerBg: '#1A170E',
      colorBorderSecondary: '#3B3218',
    },
    Modal: {
      contentBg: '#1A170E',
      headerBg: '#1A170E',
      maskBg: 'rgba(0,0,0,0.75)',
    },
    Drawer: {
      colorBgElevated: '#1A170E',
    },
    Tag: {
      defaultBg: '#2A2312',
      defaultColor: '#D4AF37',
    },
    Tabs: {
      itemColor: '#8B7A4A',
      itemSelectedColor: '#FFD700',
      itemHoverColor: '#E8D8A0',
      inkBarColor: '#D4AF37',
    },
    Button: {
      defaultBg: '#231F12',
      defaultBorderColor: '#3B3218',
      defaultColor: '#E8D8A0',
      defaultHoverBg: '#2A2312',
      defaultHoverColor: '#FFD700',
      primaryShadow: '0 2px 8px rgba(212,175,55,0.25)',
    },
    Input: {
      colorBgContainer: '#1A170E',
      activeBorderColor: '#D4AF37',
      hoverBorderColor: '#B89A2E',
    },
    Select: {
      colorBgContainer: '#1A170E',
      colorBgElevated: '#231F12',
      optionSelectedBg: '#3B3218',
    },
  },
};

function App() {
  return (
    <Provider store={store}>
      <ConfigProvider locale={zhCN} theme={darkGoldTheme}>
        <AntdApp>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/works" element={<Works />} />
                  <Route path="/copyright" element={<Copyright />} />
                  <Route path="/royalty" element={<Royalty />} />
                  <Route path="/monitor" element={<Monitor />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </Provider>
  );
}

export default App;
