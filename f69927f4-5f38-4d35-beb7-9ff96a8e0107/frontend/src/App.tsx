import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import SchedulePage from '@/pages/SchedulePage';
import FiringCurveEditor from '@/pages/FiringCurveEditor';
import InventoryPage from '@/pages/InventoryPage';
import MembersPage from '@/pages/MembersPage';
import ReportsPage from '@/pages/ReportsPage';
import EquipmentPage from '@/pages/EquipmentPage';
import IncidentsPage from '@/pages/IncidentsPage';
import SettingsPage from '@/pages/SettingsPage';

function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '100px 0' }}>
      <h1>404</h1>
      <p>页面不存在</p>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/schedule" replace />,
      },
      {
        path: 'schedule',
        element: <SchedulePage />,
      },
      {
        path: 'curves',
        element: <FiringCurveEditor />,
      },
      {
        path: 'inventory',
        element: <InventoryPage />,
      },
      {
        path: 'members',
        element: <MembersPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'equipment',
        element: <EquipmentPage />,
      },
      {
        path: 'incidents',
        element: <IncidentsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
