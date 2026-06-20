import React, { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { validateAuth, fetchMe } from '@/store/appSlice';
import { getToken } from '@/api';
import { Spin } from 'antd';

const ProtectedRoute: React.FC = () => {
  const dispatch = useAppDispatch();
  const { authenticated, authLoading } = useAppSelector((s) => s.app);
  const [checking, setChecking] = React.useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChecking(false);
      return;
    }
    dispatch(validateAuth())
      .unwrap()
      .then(() => dispatch(fetchMe()))
      .finally(() => setChecking(false));
  }, [dispatch]);

  if (checking || authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F0D06' }}>
        <Spin size="large" tip="正在验证身份..." style={{ color: '#D4AF37' }} />
      </div>
    );
  }

  return authenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
