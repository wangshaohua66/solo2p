import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import PatrolPage from '@/pages/PatrolPage';
import WorkOrderPage from '@/pages/WorkOrderPage';
import StatisticsPage from '@/pages/StatisticsPage';
import AdminPage from '@/pages/AdminPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/patrol" replace />} />
        <Route element={<Layout />}>
          <Route path="/patrol" element={<PatrolPage />} />
          <Route path="/workorders" element={<WorkOrderPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
