import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

// 全局未捕获错误：同步错误与未处理的 Promise 拒绝都打印到控制台，便于定位白屏根因
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// 注册 PWA Service Worker，使 Chrome 满足“可安装应用”条件
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.error('Service Worker 注册失败:', err)
  })
}
