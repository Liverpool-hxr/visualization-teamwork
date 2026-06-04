/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import InspectorLayout from '@/components/shell/InspectorLayout';

const Heatmap = lazy(() => import('@/pages/Heatmap'));
const Analysis = lazy(() => import('@/pages/Analysis'));
const Overview = lazy(() => import('@/pages/Overview'));

export const router = createBrowserRouter([
  {
    element: <InspectorLayout />,
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
