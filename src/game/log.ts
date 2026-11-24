import type { GameState, LogEntry } from './state'

export function pushLog(s: GameState, text: string, kind: LogEntry['kind']): LogEntry[] {
  return [...s.log, { day: s.day, text, kind }].slice(-100)
}
