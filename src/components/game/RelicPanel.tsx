import { Gift } from 'lucide-react'
import { Panel } from './ui-bits'
import { getRelic } from '@/game/relics'
import type { GameState } from '@/game/engine'

export default function RelicPanel({ state }: { state: GameState }) {
  if (state.mode !== 'rogue' || !state.run || state.run.relics.length === 0) return null
  return (
    <Panel title="远征遗物" icon={Gift} className="border-purple-700/40 bg-purple-950/20">
      <div className="grid grid-cols-1 gap-1.5">
        {state.run.relics.map((id) => {
          const r = getRelic(id)
          if (!r) return null
          return (
            <div key={id} className="flex items-start gap-2 rounded-lg border border-purple-800/40 bg-purple-950/30 px-2.5 py-1.5">
              <span className="text-lg leading-none">{r.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-purple-200">{r.name}</div>
                <div className="text-[11px] leading-snug text-purple-300/80">{r.desc}</div>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
