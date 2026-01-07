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
    // React가 중복으로 번들/로드되면 런타임에서 React 객체가 예상과 달라져
    // 'Cannot set properties of undefined (setting "Children")' 같은 오류가 날 수 있습니다.
    // (특히 링크드 패키지/중복 의존성/번들 캐시가 섞일 때)
    dedupe: ['react', 'react-dom'],
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

          // React 생태계 패키지가 일반 vendor에 섞이면
          // vendor -> vendor-react, vendor-react -> vendor 순환 의존이 생길 수 있어
          // (특히 PWA/캐시가 섞일 때) 런타임 초기화 순서 이슈로 이어질 수 있습니다.
          // React 의존 패키지는 별도 청크로 빼서 순환을 끊습니다.
          const reactEcosystemPkgs = new Set([
            'lucide-react',
            'react-hook-form',
            'sonner',
            'next-themes',
            'react-day-picker',
            'react-popper',
            'react-resizable-panels',
            'react-responsive-masonry',
            'react-slick',
            'embla-carousel-react',
            'input-otp',
            'vaul',
            'cmdk',
            'zustand',
            // React hook shims (can end up in generic vendor and create chunk cycles)
            'use-sync-external-store',
            'use-sync-external-store-shim',
          ]);
          if (reactEcosystemPkgs.has(pkg)) return 'vendor-react-ecosystem';
          if (pkg.startsWith('react-') || pkg.endsWith('-react')) return 'vendor-react-ecosystem';

          // 나머지는 하나의 vendor로 묶되, 너무 비대해지면 위 규칙을 추가해 분리합니다.
          return 'vendor';
        },
      },
    },
  },
})
