import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
} from 'react-router-dom';
import { Skeleton } from 'antd';

const AppLayout = lazy(() => import('@/components/Layout/AppLayout'));
const PlanSchedule = lazy(() => import('@/pages/PlanSchedule'));
const TopologyView = lazy(() => import('@/pages/TopologyView'));
const ConflictAnalysis = lazy(() => import('@/pages/ConflictAnalysis'));
const StatisticsReport = lazy(() => import('@/pages/StatisticsReport'));
const HistorySearch = lazy(() => import('@/pages/HistorySearch'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const PageFallback: React.FC = () => (
  <div className="p-6 space-y-4">
    <Skeleton.Input active style={{ width: 200, height: 32 }} />
    <div className="space-y-3">
      <Skeleton active paragraph={{ rows: 4 }} />
      <Skeleton active paragraph={{ rows: 4 }} />
    </div>
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/plan" replace />,
  },
  {
    path: '/',
    element: (
      <Suspense fallback={<PageFallback />}>
        <AppLayout />
      </Suspense>
    ),
    children: [
      {
        path: 'plan',
        element: (
          <Suspense fallback={<PageFallback />}>
            <PlanSchedule />
          </Suspense>
        ),
      },
      {
        path: 'topology',
        element: (
          <Suspense fallback={<PageFallback />}>
            <TopologyView />
          </Suspense>
        ),
      },
      {
        path: 'conflict',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ConflictAnalysis />
          </Suspense>
        ),
      },
      {
        path: 'statistics',
        element: (
          <Suspense fallback={<PageFallback />}>
            <StatisticsReport />
          </Suspense>
        ),
      },
      {
        path: 'history',
        element: (
          <Suspense fallback={<PageFallback />}>
            <HistorySearch />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<PageFallback />}>
        <NotFound />
      </Suspense>
    ),
  },
]);

export default router;
