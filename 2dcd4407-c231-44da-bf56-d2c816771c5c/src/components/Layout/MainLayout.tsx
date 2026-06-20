import { Layout } from 'antd';
import Header from './Header';
import Sidebar from './Sidebar';
import { useUserStore } from '../../stores/userStore';
import { Navigate } from 'react-router-dom';
import { useState } from 'react';

const { Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { isAuthenticated } = useUserStore();
  const [collapsed, setCollapsed] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout className="min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
      <Layout className="flex flex-col">
        <Header collapsed={collapsed} onCollapse={setCollapsed} />
        <Content className="flex-1 p-6 overflow-auto">
          <div className="max-w-[1920px] mx-auto">
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
