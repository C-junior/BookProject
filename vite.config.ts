import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    createHtmlPlugin(),
    visualizer(),
    VitePWA({
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      }
    })
  ]
});