/**
 * 最小错误日志接收服务（Node.js 原生 http，无需额外依赖）
 *
 * 用法：
 *   1. 把 .env.example 复制为 .env，填入 VITE_ERROR_REPORT_URL=http://localhost:4000/log-error
 *   2. node server/error-logger.mjs
 *   3. 日志会写入 server/logs/error-YYYY-MM-DD.log
 *
 * 部署到生产时，建议：
 *   - 加上域名/IP 白名单或简单鉴权
 *   - 使用 pm2 / systemd 托管
 *   - 日志接入 rotate（如 logrotate）
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = process.env.PORT || 4000
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_DIR = path.join(__dirname, 'logs')

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

function todayFile() {
  const d = new Date()
  const iso = d.toISOString().slice(0, 10)
  return path.join(LOG_DIR, `error-${iso}.log`)
}

const server = http.createServer((req, res) => {
  // 允许前端跨域上报
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'POST' || req.url !== '/log-error') {
    res.writeHead(404)
    res.end('Not Found')
    return
  }

  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    try {
      const payload = JSON.parse(body)
      const line = JSON.stringify({ receivedAt: new Date().toISOString(), ...payload })
      fs.appendFileSync(todayFile(), line + '\n')
      console.log('[error-logger]', payload.type, payload.message)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      res.writeHead(400)
      res.end('Bad Request')
    }
  })
})

server.listen(PORT, () => {
  console.log(`Error logger listening on http://localhost:${PORT}/log-error`)
})
