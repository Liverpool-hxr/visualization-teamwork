/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import Layout from '@/components/common/Layout';

const Heatmap = lazy(() => import('@/pages/Heatmap'));
const Analysis = lazy(() => import('@/pages/Analysis'));
const Overview = lazy(() => import('@/pages/Overview'));

const SuspenseWrapper = () => (
  <Layout>
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '100px' }}>Loading...</div>}>
      <Outlet />
    </Suspense>
  </Layout>
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