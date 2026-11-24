import { Users } from 'lucide-react'
import { CONFIG, RESOURCE_INFO, type ResourceId } from '@/game/config'
import { gatherPerPerson, idleVillagers, type GameState } from '@/game/engine'
import { cn } from '@/lib/utils'
import { Panel } from './ui-bits'
import { RESOURCE_ICONS } from './icons'

const JOBS: { id: ResourceId; building: 'farm' | 'lumber' | 'mine'; verb: string }[] = [
  { id: 'food', building: 'farm', verb: '务农' },
  { id: 'wood', building: 'lumber', verb: '伐木' },
  { id: 'gold', building: 'mine', verb: '采矿' },
]

export default function AssignmentPanel({
  state,
  onAssign,
}: {
  state: GameState
  onAssign: (res: ResourceId, delta: number) => void
}) {
  const idle = idleVillagers(state)
  // 直接复用引擎的采集公式（含文明/技能/天赋/遗物全量加成）
  const per = gatherPerPerson(state)

  function perCap(job: (typeof JOBS)[number]): number {
    if (job.id === 'food') return per.foodPer
    if (job.id === 'gold') return per.goldPer
    return per.woodPer
  }

  return (
    <Panel
      title="村民分配"
      icon={Users}
      data-tutorial="assignment-panel"
      extra={
        <span className="text-xs text-stone-400">
          村民 <b className="text-stone-200">{state.villagers}</b> · 空闲 <b className={idle > 0 ? 'text-emerald-400' : 'text-stone-500'}>{idle}</b>
        </span>
      }
    >
      <div className="space-y-2.5">
        {JOBS.map((job) => {
          const info = RESOURCE_INFO[job.id]
          const ResourceIcon = RESOURCE_ICONS[job.id]
          const n = state.assignment[job.id]
          const per = perCap(job)
          return (
            <div key={job.id} className="flex items-center gap-2 rounded-lg bg-stone-950/50 px-3 py-2">
              <ResourceIcon className={cn('shrink-0', info.color)} size={18} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-stone-200">{job.verb}</div>
                <div className="text-[11px] text-stone-500">
                  每人 +{per}{info.name}/天{n > 0 && <span className="text-stone-400"> · 合计 +{n * per}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onAssign(job.id, -10)}
                  disabled={n <= 0}
                  className="h-7 rounded-md bg-stone-800 px-1.5 text-[10px] font-bold text-stone-300 transition hover:bg-stone-700 disabled:opacity-30"
                >
                  −10
                </button>
                <button
                  onClick={() => onAssign(job.id, -1)}
                  disabled={n <= 0}
                  className="h-7 w-7 rounded-md bg-stone-700 text-sm font-bold text-stone-200 transition hover:bg-stone-600 disabled:opacity-30"
                >
                  −
                </button>
                <span className={cn('w-6 text-center text-base font-bold tabular-nums', n > 0 ? info.color : 'text-stone-600')}>
                  {n}
                </span>
                <button
                  onClick={() => onAssign(job.id, 1)}
                  disabled={idle <= 0}
                  className="h-7 w-7 rounded-md bg-stone-700 text-sm font-bold text-stone-200 transition hover:bg-stone-600 disabled:opacity-30"
                >
                  ＋
                </button>
                <button
                  onClick={() => onAssign(job.id, 10)}
                  disabled={idle <= 0}
                  className="h-7 rounded-md bg-stone-800 px-1.5 text-[10px] font-bold text-stone-300 transition hover:bg-stone-700 disabled:opacity-30"
                >
                  ＋10
                </button>
              </div>
            </div>
          )
        })}
        <p className="px-1 text-[11px] leading-relaxed text-stone-500">
          💡 村民每天消耗 {CONFIG.villagerUpkeep} 食物，士兵消耗更高（民兵/弓箭手 3、骑士 4）。食物耗尽会发生饥荒！
        </p>
      </div>
    </Panel>
  )
}
