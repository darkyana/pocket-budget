/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/** 代码最近更新时间（ms）：git 最后提交；无 git 时退回 src 下最新的文件改动时间 */
function codeUpdatedAt(): number {
  try {
    return Number(execSync('git log -1 --format=%ct').toString().trim()) * 1000
  } catch {
    let newest = 0
    for (const f of readdirSync('src', { recursive: true })) {
      const st = statSync(`src/${f}`)
      if (st.isFile()) newest = Math.max(newest, st.mtimeMs)
    }
    return newest
  }
}

// 本地 dev 用 '/'；GitHub Pages 构建时通过 BASE_URL=/pocket-budget/ 注入
export default defineConfig({
  base: process.env.BASE_URL || '/',
  define: {
    __CODE_UPDATED_AT__: JSON.stringify(codeUpdatedAt()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: '口袋账房',
        short_name: '口袋账房',
        description: '当下的钱：节律 · 预算池 · 义务 · 走账',
        lang: 'zh-CN',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        background_color: '#f4f2ee',
        theme_color: '#2f6f4f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
