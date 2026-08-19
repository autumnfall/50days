import { useState, useCallback } from 'react'
import ErrorBoundary from '@/components/ErrorBoundary'
import Game from '@/components/game/Game'

export default function App() {
  const [resetKey, setResetKey] = useState(0)
  const onReset = useCallback(() => setResetKey((k) => k + 1), [])
  return (
    <ErrorBoundary key={resetKey} onReset={onReset}>
      <Game />
    </ErrorBoundary>
  )
}
