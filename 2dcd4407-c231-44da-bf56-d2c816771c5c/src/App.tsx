import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from './components/Layout/MainLayout';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Schedule from './views/Schedule';
import Contract from './views/Contract';
import Finance from './views/Finance';
import Booth from './views/Booth';
import Provider from './views/Provider';
import Visitor from './views/Visitor';
import Analytics from './views/Analytics';
import System from './views/System';
import { useUserStore } from './stores/userStore';

const ProtectedRoute = () => {
  const { isAuthenticated } = useUserStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const theme = {
  token: {
    colorPrimary: '#165DFF',
    borderRadius: 6,
    colorInfo: '#165DFF',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#001529',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: '#165DFF',
      itemColor: '#ffffff',
      itemSelectedColor: '#ffffff',
      subMenuItemBg: 'transparent',
    },
  },
};

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntdApp>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout><Outlet /></MainLayout>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/contract" element={<Contract />} />
                <Route path="/finance" element={<Finance />} />
                <Route path="/booth" element={<Booth />} />
                <Route path="/provider" element={<Provider />} />
                <Route path="/visitor" element={<Visitor />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/system" element={<System />} />
              </Route>
            </Route>

            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
                  <p className="text-gray-500 mb-8">页面不存在或您没有访问权限</p>
                </div>
              </div>
            } />
          </Routes>
        </Router>
      </AntdApp>
    </ConfigProvider>
  );
}