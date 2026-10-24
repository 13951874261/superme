import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

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
    plugins: [react(), tailwindcss()],
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
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
            if (id.includes('/motion/') || id.includes('/framer-motion/') || id.includes('/gsap/')) return 'vendor-motion';
            if (id.includes('/lucide-react/') || id.includes('/@phosphor-icons/')) return 'vendor-icons';
            if (id.includes('/react-markdown/') || id.includes('/remark-') || id.includes('/rehype-')) return 'vendor-markdown';
            if (id.includes('/@google/genai/')) return 'vendor-ai';
            return 'vendor';
          },
        },
      },
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
