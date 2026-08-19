import { Component, type ErrorInfo, type ReactNode } from 'react'
import { loadGame } from '@/game/save'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }

  handleReload = () => {
    window.location.reload()
  }

  handleLoadAutoSave = () => {
    const loaded = loadGame(0)
    if (loaded) {
      try {
        sessionStorage.setItem('fiftyDays_recover_autosave', JSON.stringify({ ...loaded, skills: [...loaded.skills] }))
      } catch {
        // ignore
      }
    }
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { error, errorInfo } = this.state
    const hasAutoSave = !!loadGame(0)

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950 p-4 text-stone-200">
        <div className="w-full max-w-md rounded-2xl border border-red-700/40 bg-stone-900/90 p-6 shadow-2xl">
          <div className="text-center text-4xl">⚠️</div>
          <h1 className="mt-3 text-center text-xl font-black tracking-widest text-red-300">游戏遇到了错误</h1>
          <p className="mt-2 text-center text-xs text-stone-400">错误信息已记录到控制台，可截图发给开发者排查</p>

          <div className="mt-4 max-h-40 overflow-auto rounded-lg border border-stone-700/60 bg-stone-950 p-3 text-[11px] leading-relaxed text-red-200/80">
            <p className="font-mono">{error?.name}: {error?.message}</p>
            {errorInfo?.componentStack && (
              <pre className="mt-2 whitespace-pre-wrap text-stone-500">{errorInfo.componentStack}</pre>
            )}
          </div>

          <div className="mt-5 space-y-2">
            {hasAutoSave && (
              <button
                onClick={this.handleLoadAutoSave}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3 text-sm font-bold text-stone-950 transition active:scale-[0.98]"
              >
                📂 读取自动存档继续
              </button>
            )}
            <button
              onClick={this.handleReset}
              className="w-full rounded-xl border border-stone-600 bg-stone-800/60 py-3 text-sm font-bold text-stone-200 transition hover:bg-stone-700/60 active:scale-[0.98]"
            >
              🏠 返回主页
            </button>
            <button
              onClick={this.handleReload}
              className="w-full rounded-xl border border-stone-700 bg-stone-900/60 py-2 text-xs font-bold text-stone-400 transition hover:text-stone-200 active:scale-[0.98]"
            >
              🔄 重新加载页面
            </button>
          </div>
        </div>
      </div>
    )
  }
}
