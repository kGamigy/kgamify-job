import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  appType: 'spa',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3000,
    proxy: {
      // Add proxy for API requests in development
      '/api': {
        target: 'https://job-portal-backend-629b.onrender.com',
        changeOrigin: true,
        secure: false,
        xfwd: true
      }
    },
    cors: true
  },
  build: {
    // Keep defaults: stable output ordering and minifier
    target: 'es2020',
    cssCodeSplit: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split('.').at(1);
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) return `assets/images/[name]-[hash][extname]`;
          if (/woff2?|eot|ttf|otf/i.test(extType)) return `assets/fonts/[name]-[hash][extname]`;
          return `assets/[ext]/[name]-[hash][extname]`;
        },
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
      },
    },
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096,
    sourcemap: false,
    reportCompressedSize: true,
  },
  preview: {
    port: process.env.PORT || 3000,
    host: true,
    allowedHosts: ['kgamify-job.onrender.com', 'kgamify-job-portal.vercel.app'],
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
})
