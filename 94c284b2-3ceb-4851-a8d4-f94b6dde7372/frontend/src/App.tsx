import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import AppointmentPage from '@/pages/AppointmentPage';
import PatientListPage from '@/pages/PatientListPage';
import PatientRecordPage from '@/pages/PatientRecordPage';
import WarningCenterPage from '@/pages/WarningCenterPage';
import StatisticsPage from '@/pages/StatisticsPage';
import SettingsPage from '@/pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/appointments" element={<AppointmentPage />} />
          <Route path="/patients" element={<PatientListPage />} />
          <Route path="/patients/:id" element={<PatientRecordPage />} />
          <Route path="/warnings" element={<WarningCenterPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
