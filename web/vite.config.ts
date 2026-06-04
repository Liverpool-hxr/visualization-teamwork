import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:8080';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      fs: {
        allow: [path.resolve(__dirname), path.resolve(__dirname, '../mock')],
      },
      proxy: {
        '/run': { target: apiTarget, changeOrigin: true },
        '/tree_stats': { target: apiTarget, changeOrigin: true },
        '/visualize': { target: apiTarget, changeOrigin: true },
        '/analysis': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
