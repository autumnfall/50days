import http from 'node:http'
import { appendFile, mkdir } from 'node:fs/promises'

const port = Number(process.env.PORT ?? 4000)
const host = process.env.HOST ?? '127.0.0.1'
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',').map((origin) => origin.trim()))
const logDir = new URL('./logs/', import.meta.url)
const maxBytes = 16 * 1024
const maxReportsPerMinute = 120
const types = new Set(['react', 'global', 'unhandledrejection'])
let minute = 0
let reports = 0

await mkdir(logDir, { recursive: true })

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin
  if (req.url !== '/log-error') return res.writeHead(404).end()
  if (origin && !allowedOrigins.has(origin)) return res.writeHead(403).end()
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.writeHead(204).end()
  }
  if (req.method !== 'POST') return res.writeHead(405, { Allow: 'POST, OPTIONS' }).end()
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') return res.writeHead(415).end()

  const window = Math.floor(Date.now() / 60_000)
  if (window !== minute) { minute = window; reports = 0 }
  if (++reports > maxReportsPerMinute) return res.writeHead(429, { 'Retry-After': '60' }).end()
  if (Number(req.headers['content-length']) > maxBytes) return res.writeHead(413, { Connection: 'close' }).end()

  const chunks = []
  let bytes = 0
  try {
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      bytes += chunk.length
      if (bytes > maxBytes) return res.writeHead(413, { Connection: 'close' }).end()
      chunks.push(chunk)
    }
  } catch {
    return
  }

  let payload
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return res.writeHead(400).end()
  }
  if (!payload || !types.has(payload.type)) return res.writeHead(400).end()

  const receivedAt = new Date().toISOString()
  const fields = ['name', 'message', 'stack', 'componentStack', 'url', 'userAgent', 'timestamp', 'phase', 'mode']
  const report = Object.fromEntries(fields.filter((key) => typeof payload[key] === 'string').map((key) => [key, payload[key]]))
  if (Number.isSafeInteger(payload.day)) report.day = payload.day
  try {
    await appendFile(new URL(`error-${receivedAt.slice(0, 10)}.log`, logDir),
      JSON.stringify({ ...report, receivedAt, type: payload.type }) + '\n')
    return res.writeHead(204).end()
  } catch (error) {
    console.error('Error logger write failed:', error)
    return res.writeHead(500).end()
  }
})

server.requestTimeout = 15_000
server.listen(port, host, () => {
  console.log(`Error logger listening on ${host}:${port}/log-error`)
})
