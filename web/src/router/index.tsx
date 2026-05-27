/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';

const Heatmap = lazy(() => import('@/pages/Heatmap'));
const Analysis = lazy(() => import('@/pages/Analysis'));
const Overview = lazy(() => import('@/pages/Overview'));

const SuspenseWrapper = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <Outlet />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    element: <SuspenseWrapper />,
    children: [
      {
        path: '/',
        element: <Navigate to="/heatmap" replace />,
      },
      {
        path: '/heatmap',
        element: <Heatmap />,
      },
      {
        path: '/analysis',
        element: <Analysis />,
      },
      {
        path: '/overview',
        element: <Overview />,
      },
    ],
  },
]);
