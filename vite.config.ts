/// <reference types="vitest/config" />
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { offlineWorker } from './scripts/pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), offlineWorker()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // e2e 目录是 Playwright 测试，不纳入 vitest
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
