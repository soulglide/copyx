import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'public/manifest.chrome.json', // Chrome専用マニフェストを直接指定
          dest: '.',
          rename: 'manifest.json'
        },
        {
          src: 'public/icon.png',
          dest: '.'
        }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        background: 'src/background.chrome.ts', // Chrome専用バックグラウンドスクリプトを直接指定
        content: 'src/content.chrome.ts' // Chrome専用コンテンツスクリプトを直接指定
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/vendor.js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});