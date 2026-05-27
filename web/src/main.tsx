import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { router } from '@/router';
import { theme } from '@/styles/theme';
import '@/styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={theme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  </StrictMode>,
);
