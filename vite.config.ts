import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    cacheDir: 'D:/cursor/work/super-agent/.vite_cache',
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'motion/react',
        'lucide-react',
      ],
    },
    plugins: [viteSingleFile(), react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'https://app.liujingzhuwo.site',
          changeOrigin: true,
          secure: false,
        },
        '/dify': {
          target: 'https://app.liujingzhuwo.site',
          changeOrigin: true,
          secure: false,
        }
      }
    },
  };
});
