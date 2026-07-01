import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  // Tự động tắt HMR nếu là production hoặc có biến DISABLE_HMR=true
  const isProduction = process.env.NODE_ENV === 'production';
  const disableHmr = isProduction || process.env.DISABLE_HMR === 'true';

  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Nếu disable HMR → false, ngược lại → chỉ tắt overlay nhưng vẫn bật HMR
      hmr: disableHmr ? false : { overlay: false },
      watch: disableHmr ? null : {},
    },
  };
});