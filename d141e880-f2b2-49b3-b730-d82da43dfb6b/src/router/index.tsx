import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from 'antd';
import TopNavbar from '@/components/TopNavbar';
import Dashboard from '@/pages/Dashboard';
import Workbench from '@/pages/Workbench';
import StrataComparison from '@/pages/StrataComparison';
import Statistics from '@/pages/Statistics';

const { Content } = Layout;

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  const isWorkbench = location.pathname === '/workbench';

  return (
    <Layout className="h-screen overflow-hidden">
      <TopNavbar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <Content className="overflow-hidden">
        {children}
      </Content>
    </Layout>
  );
};

const router = (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <AppLayout>
            <Dashboard />
          </AppLayout>
        }
      />
      <Route
        path="/workbench"
        element={
          <AppLayout>
            <Workbench />
          </AppLayout>
        }
      />
      <Route
        path="/strata"
        element={
          <AppLayout>
            <StrataComparison />
          </AppLayout>
        }
      />
      <Route
        path="/statistics"
        element={
          <AppLayout>
            <Statistics />
          </AppLayout>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </BrowserRouter>
);

export default router;
