import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/store/authStore';
import MainLayout from '@/components/MainLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import IntakePage from '@/pages/IntakePage';
import WorkOrderListPage from '@/pages/WorkOrderListPage';
import WorkOrderPage from '@/pages/WorkOrderPage';
import PartsPage from '@/pages/PartsPage';
import ReportPage from '@/pages/ReportPage';
import CustomerPage from '@/pages/CustomerPage';
import MovementPage from '@/pages/MovementPage';
import WarrantyPage from '@/pages/WarrantyPage';
import PublicIntakePage from '@/pages/PublicIntakePage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  if (typeof window !== 'undefined' && isAuthenticated && !localStorage.getItem('jwt_token')) {
    useAuthStore.getState().logout();
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/public/intake/:token" element={<PublicIntakePage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="intake" element={<IntakePage />} />
        <Route path="work-orders" element={<WorkOrderListPage />} />
        <Route path="work-orders/:id" element={<WorkOrderPage />} />
        <Route path="parts" element={<PartsPage />} />
        <Route path="report/:id" element={<ReportPage />} />
        <Route path="customers" element={<CustomerPage />} />
        <Route path="movements" element={<MovementPage />} />
        <Route path="warranty" element={<WarrantyPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
