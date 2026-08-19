import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const FALLBACK_SUPABASE_URL = "https://zxulglbcxehqplxainmz.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4dWxnbGJjeGVocXBseGFpbm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMzU5MDUsImV4cCI6MjA5ODYxMTkwNX0.F6QL6_gzGnUUF5VWloZFe1e29OQE9DTogZDPmTiWa4A";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      includeAssets: ["favicon.ico", "pwa-icon-192.png", "pwa-icon-512.png"],
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/zxulglbcxehqplxainmz\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
      manifest: {
        name: "My Health ID – Plataforma Clínica",
        short_name: "My Health ID",
        description: "Avaliação multidimensional da dor e gestão clínica inteligente.",
        theme_color: "#1a2744",
        background_color: "#f5f6f8",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'esnext',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Isola os helpers de interop CJS (commonjsHelpers, tslib) num chunk
          // próprio e minúsculo. Sem isto, o Rollup os hospeda dentro do 1º chunk
          // pesado que precisa deles (vendor-pdf/vendor-charts); como o entry
          // importa o helper, isso cria uma aresta estática entry→vendor-pesado
          // que força o modulepreload de ~1MB de PDF+charts em TODA página,
          // inclusive na landing pública que não usa nenhum dos dois.
          // Helpers e micro-utils usados no app INTEIRO (inclusive no código que
          // carrega logo de cara): interop CJS, tslib, preload-helper do Vite e o
          // clsx/tailwind-merge do cn(). Se ficarem hospedados dentro de um vendor
          // pesado (pdf/charts), o entry passa a importar dele e força o preload
          // desse vendor em toda página. Isolá-los aqui quebra essa aresta.
          if (
            id.includes('commonjsHelpers') || id.includes('tslib') ||
            id.includes('preload-helper') || id.includes('/clsx/') ||
            id.includes('tailwind-merge')
          ) return 'vendor-helpers';
          if (!id.includes('node_modules')) return; // código do app: split por rota (React.lazy) fica intacto
          // Específicos ANTES do catch genérico de "react" (senão @tanstack/react-query,
          // @radix-ui/react-* etc. cairiam no vendor-react por conterem "react").
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('@radix-ui')) return 'vendor-ui';
          if (id.includes('recharts')) return 'vendor-charts';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('date-fns')) return 'vendor-date';
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react';
        },
      },
    },
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    ),
  },
}));
