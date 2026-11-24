import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { reportError } from './lib/report-error'

// 全局未捕获错误：同步错误与未处理的 Promise 拒绝都打印到控制台，并上报服务器
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error)
  reportError('global', e.error)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason)
  reportError('unhandledrejection', e.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 注册 PWA Service Worker，使 Chrome 满足“可安装应用”条件
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const base = new URL(import.meta.env.BASE_URL, document.baseURI)
  navigator.serviceWorker.register(new URL('sw.js', base)).catch((err) => {
    console.error('Service Worker 注册失败:', err)
  })
}
