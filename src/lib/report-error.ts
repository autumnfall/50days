/**
 * 客户端错误上报
 * 通过 POST 到 VITE_ERROR_REPORT_URL 配置的接口，把关键错误信息落到服务器，
 * 便于在手机端等无法打开控制台的场景排查白屏/崩溃根因。
 *
 * 接口期望：
 *   POST {url}
 *   Content-Type: application/json
 *   Body: {
 *     type: 'react' | 'global' | 'unhandledrejection',
 *     name?: string,
 *     message?: string,
 *     stack?: string,
 *     componentStack?: string,
 *     url: string,
 *     userAgent: string,
 *     timestamp: string,
 *     day?: number,
 *     phase?: string,
 *     mode?: string,
 *   }
 */

const ENDPOINT = import.meta.env.VITE_ERROR_REPORT_URL as string | undefined

export interface ErrorReportPayload {
  type: 'react' | 'global' | 'unhandledrejection'
  name?: string
  message?: string
  stack?: string
  componentStack?: string
  url: string
  userAgent: string
  timestamp: string
  day?: number
  phase?: string
  mode?: string
}

export function reportError(
  type: ErrorReportPayload['type'],
  error: unknown,
  extra?: { componentStack?: string; day?: number; phase?: string; mode?: string },
) {
  if (!ENDPOINT) return

  const payload: ErrorReportPayload = {
    type,
    url: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    timestamp: new Date().toISOString(),
    ...extra,
    componentStack: extra?.componentStack?.slice(0, 1000),
  }

  if (error instanceof Error) {
    payload.name = error.name.slice(0, 100)
    payload.message = error.message.slice(0, 400)
    payload.stack = error.stack?.slice(0, 1800)
  } else if (typeof error === 'string') {
    payload.message = error.slice(0, 400)
  } else if (error && typeof error === 'object' && 'message' in error) {
    payload.message = String((error as Record<string, unknown>).message).slice(0, 400)
  }

  try {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // 错误上报不阻塞页面，也不强制要求成功
      keepalive: true,
    }).catch(() => {
      // 上报本身失败时静默忽略，避免二次崩溃
    })
  } catch {
    // ignore
  }
}
