import { useState } from 'react'
import { CONFIG, NATIONS, type NationId } from '@/game/config'
import { hasAnySave } from '@/game/save'
import { cn } from '@/lib/utils'

export default function StartScreen({ onStart, onLoad }: { onStart: (nation: NationId) => void; onLoad?: (slot: number) => void }) {
  const [selected, setSelected] = useState<NationId | null>(null)

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-stone-950 via-stone-900 to-amber-950/40 px-4 py-8">
      <div className="pointer-events-none absolute inset-0 opacity-20 text-[12rem] leading-none select-none">
        <span className="absolute left-[8%] top-[12%]">🏰</span>
        <span className="absolute right-[10%] top-[18%]">🌲</span>
        <span className="absolute bottom-[8%] left-[15%]">🌲</span>
        <span className="absolute bottom-[12%] right-[12%]">⛰️</span>
      </div>

      <div className="relative w-full max-w-3xl rounded-2xl border border-amber-700/40 bg-stone-900/80 p-6 shadow-2xl backdrop-blur-md sm:p-8">
        <div className="text-center">
          <div className="text-5xl">🏰</div>
          <h1 className="mt-3 text-4xl font-black tracking-widest text-amber-200 sm:text-5xl">五十日坚守</h1>
          <p className="mt-2 text-sm tracking-wider text-stone-400">— 回合制生存策略 · 致敬《50 Years》—</p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-stone-300">
            第 {CONFIG.firstWaveDay} 天起，黑暗大军<b className="text-red-300">随时可能进犯</b>（每天 20% 概率，逐日递增，第 5 天必来），且一波比一波强。
            第 {CONFIG.totalDays} 天将迎来<b className="text-red-300">终局决战</b>，击败最终敌人才能获胜！
          </p>
        </div>

        {/* 国家选择 */}
        <h2 className="mt-7 text-center text-sm font-bold tracking-widest text-stone-400">— 选择你的文明 —</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(Object.values(NATIONS)).map((n) => {
            const active = selected === n.id
            return (
              <button
                key={n.id}
                onClick={() => setSelected(n.id)}
                className={cn(
                  'rounded-xl border-2 p-4 text-left transition',
                  active
                    ? 'border-amber-500 bg-amber-950/40 shadow-lg shadow-amber-500/10'
                    : 'border-stone-700 bg-stone-950/50 hover:border-stone-500 hover:bg-stone-800/60',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{n.icon}</span>
                  <div>
                    <div className={cn('font-bold', active ? 'text-amber-200' : 'text-stone-200')}>{n.name}</div>
                    <div className="text-[10px] tracking-widest text-stone-500">{n.title}</div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-stone-400">{n.desc}</p>
                <ul className="mt-2 space-y-1">
                  {n.bonus.map((b) => (
                    <li key={b} className="flex items-start gap-1 text-[11px] text-emerald-300/90">
                      <span className="text-emerald-500">✦</span>{b}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => selected && onStart(selected)}
          disabled={!selected}
          className={cn(
            'mt-7 w-full rounded-xl py-4 text-lg font-black tracking-[0.3em] transition active:scale-[0.98]',
            selected
              ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-stone-950 shadow-lg hover:from-amber-500 hover:to-amber-400'
              : 'cursor-not-allowed bg-stone-800 text-stone-600',
          )}
        >
          {selected ? `以「${NATIONS[selected].name}」开局` : '请先选择文明'}
        </button>

        {onLoad && hasAnySave() && (
          <button
            onClick={() => onLoad(0)}
            className="mt-3 w-full rounded-xl border border-stone-700 bg-stone-800/60 py-3 text-sm font-bold text-stone-300 transition hover:border-stone-500 hover:bg-stone-700/60 active:scale-[0.98]"
          >
            📂 继续游戏（读取自动存档）
          </button>
        )}
      </div>
    </div>
  )
}
