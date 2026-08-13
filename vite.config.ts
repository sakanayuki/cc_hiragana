import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages のプロジェクトサイトは /cc_hiragana/ 配下に載る。
// Service Worker のスコープには絶対パスが要るので相対 './' ではなく明示する。
const base = process.env.GITHUB_ACTIONS ? '/cc_hiragana/' : '/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  plugins: [
    VitePWA({
      base,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      workbox: {
        // 絵と音を含めて全部プリキャッシュする（完全オフライン動作）
        globPatterns: ['**/*.{js,css,html,png,mp3,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
      },
      manifest: {
        name: 'ひらがな あいうえお',
        short_name: 'あいうえお',
        description: 'えをタップすると ひらがなの おとが なるアプリ',
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#FFF7E8',
        theme_color: '#FFF7E8',
        icons: [
          { src: 'app-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'app-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
