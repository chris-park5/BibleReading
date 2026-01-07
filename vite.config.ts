import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function getNodeModulePackageName(id: string): string | null {
  const parts = id.split('node_modules/')[1];
  if (!parts) return null;

  const segments = parts.split('/');
  if (segments[0]?.startsWith('@') && segments.length >= 2) {
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0] ?? null;
}

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'icon.svg',
        'maskable-icon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-192x192.png',
        'maskable-512x512.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'Bible Reading Plan App',
        short_name: 'Bible Plan',
        description: '성경 읽기 계획과 진도 관리',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    rollupOptions: {
      output: {
        // Manual chunks: 큰 vendor 의존성을 분리해서 초기 번들 크기와 캐시 효율을 개선합니다.
        // (필요 시 더 세분화 가능)
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          const pkg = getNodeModulePackageName(id);
          if (!pkg) return;

          if (pkg === 'react' || pkg === 'react-dom' || pkg === 'scheduler') return 'vendor-react';
          if (pkg.startsWith('@supabase/')) return 'vendor-supabase';
          if (pkg.startsWith('@tanstack/')) return 'vendor-tanstack';
          if (pkg.startsWith('@mui/') || pkg.startsWith('@emotion/')) return 'vendor-mui';
          if (pkg.startsWith('@radix-ui/')) return 'vendor-radix';
          if (pkg === 'recharts' || pkg.startsWith('d3-')) return 'vendor-charts';
          if (pkg === 'react-dnd' || pkg === 'react-dnd-html5-backend' || pkg === 'dnd-core') return 'vendor-dnd';
          if (pkg === 'motion') return 'vendor-motion';

          // 나머지는 하나의 vendor로 묶되, 너무 비대해지면 위 규칙을 추가해 분리합니다.
          return 'vendor';
        },
      },
    },
  },
})
