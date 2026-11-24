import { ScrollText, Sparkles, TriangleAlert } from 'lucide-react'
import { RESOURCE_INFO, type GameEvent, type ResourceId } from '@/game/config'
import { soldierCount, type GameState } from '@/game/engine'
import { cn } from '@/lib/utils'

export default function EventModal({
  state,
  event,
  onChoose,
}: {
  state: GameState
  event: GameEvent
  onChoose: (choiceId: string) => void
}) {
  const theme = {
    good: { border: 'border-sky-500/60', bg: 'bg-sky-950/40', title: 'text-sky-200' },
    bad: { border: 'border-red-500/60', bg: 'bg-red-950/40', title: 'text-red-300' },
    neutral: { border: 'border-purple-500/60', bg: 'bg-purple-950/40', title: 'text-purple-300' },
  }[event.kind]

  /** 计算选项禁用原因（基于缩放后数值） */
  function disabledReason(choice: GameEvent['choices'][number]): string | null {
    if (choice.reqResources) {
      for (const [r, v] of Object.entries(choice.reqResources) as [ResourceId, number][]) {
        if (state.resources[r] < v) return `${RESOURCE_INFO[r].name}不足 ${v}`
      }
    }
    if (choice.reqSoldiers && soldierCount(state) < choice.reqSoldiers) {
      return `需要至少 ${choice.reqSoldiers} 名士兵`
    }
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center game-scrim bg-black/60 p-4 backdrop-blur-sm">
      <div className={cn('game-dialog w-full max-w-md max-h-[92vh] overflow-y-auto animate-[popIn_0.25s_ease-out] rounded-2xl border bg-stone-900 shadow-2xl', theme.border)}>
        <div className={cn('px-6 py-5 text-center', theme.bg)}>
          <span className="campaign-emblem mx-auto" aria-hidden="true">
            {event.id === 'blessing' ? <Sparkles size={23} /> : event.kind === 'bad' ? <TriangleAlert size={23} /> : <ScrollText size={23} />}
          </span>
          <h2 className={cn('mt-2 text-lg font-black tracking-widest', theme.title)}>{event.title}</h2>
          <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-stone-500">
            {event.id === 'blessing' ? '远征祝福 · 三选一' : '随机事件 · 请抉择'}
          </p>
        </div>
        <div className="px-6 pt-4">
          <p className="text-sm leading-relaxed text-stone-300">{event.text}</p>
        </div>
        <div className="space-y-2 px-6 py-4">
          {event.choices.map((choice) => {
            const reason = disabledReason(choice)
            const disabled = !!reason
            return (
              <button
                key={choice.id}
                onClick={() => !disabled && onChoose(choice.id)}
                disabled={disabled}
                className={cn(
                  'w-full rounded-xl border px-4 py-2.5 text-left transition',
                  disabled
                    ? 'cursor-not-allowed border-stone-800 bg-stone-950/40 opacity-50'
                    : 'border-stone-600 bg-stone-950/50 hover:border-amber-500/60 hover:bg-stone-800/70 active:scale-[0.99]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('text-sm font-bold', disabled ? 'text-stone-500' : 'text-stone-100')}>
                    {choice.label}
                  </span>
                  {disabled && <span className="text-[10px] text-red-400">🔒 {reason}</span>}
                </div>
                <div className="mt-0.5 text-[11px] text-stone-400">
                  {choice.desc}
                  {choice.flavor && <span className="text-stone-500">（{choice.flavor}）</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
