import { useEffect, useRef } from 'react'
import type { GameState } from '@/game/engine'
import { cn } from '@/lib/utils'
import { Panel } from './ui-bits'

const KIND_STYLE: Record<string, string> = {
  info: 'text-stone-300',
  good: 'text-emerald-300',
  bad: 'text-red-300',
  battle: 'text-orange-300 font-medium',
  event: 'text-purple-300',
  skill: 'text-amber-300 font-medium',
}

export default function LogPanel({ state }: { state: GameState }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [state.log.length])

  return (
    <Panel title="村庄日志" icon="📜" className="flex min-h-0 flex-col">
      <div ref={ref} className="game-scroll h-44 space-y-1 overflow-y-auto pr-1 lg:h-full lg:min-h-40">
        {state.log.map((entry, i) => (
          <p key={i} className={cn('text-xs leading-relaxed', KIND_STYLE[entry.kind])}>
            <span className="mr-1.5 rounded bg-stone-800 px-1 text-[10px] text-stone-500">第{entry.day}天</span>
            {entry.text}
          </p>
        ))}
      </div>
    </Panel>
  )
}
