/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import Layout from '@/components/common/Layout';
import PageTransition from '@/components/common/PageTransition';

const Heatmap = lazy(() => import('@/pages/Heatmap'));
const Analysis = lazy(() => import('@/pages/Analysis'));
const Overview = lazy(() => import('@/pages/Overview'));

const SuspenseWrapper = () => (
  <Layout>
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '100px', color: '#fff' }}>Loading...</div>}>
      <PageTransition />
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
