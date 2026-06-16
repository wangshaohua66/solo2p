import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const ProjectList = lazy(() => import('@/pages/ProjectList'));
const StoryboardEditor = lazy(() => import('@/pages/StoryboardEditor'));
const TimelinePreview = lazy(() => import('@/pages/TimelinePreview'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const PageLoader = () => (
  <div className="h-full w-full flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-sidebar-light border-t-accent animate-spin" />
      <div className="text-sidebar-fg text-sm font-mono">加载中...</div>
    </div>
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/projects" replace />,
  },
  {
    path: '/projects',
    element: (
      <Suspense fallback={<PageLoader />}>
        <ProjectList />
      </Suspense>
    ),
  },
  {
    path: '/editor',
    element: (
      <Suspense fallback={<PageLoader />}>
        <StoryboardEditor />
      </Suspense>
    ),
  },
  {
    path: '/preview',
    element: (
      <Suspense fallback={<PageLoader />}>
        <TimelinePreview />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<PageLoader />}>
        <NotFound />
      </Suspense>
    ),
  },
]);
