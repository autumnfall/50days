import { BUILDINGS, type BuildingId } from '@/game/config'
import { buildCost, canAfford, effectiveMax, popCap, population, recruitCost, recruitMaxCount, type GameState } from '@/game/engine'
import { cn } from '@/lib/utils'
import { CostTag, Panel } from './ui-bits'

const ORDER: BuildingId[] = ['farm', 'lumber', 'mine', 'house', 'barracks', 'wall', 'tower']

export default function BuildPanel({
  state,
  onBuild,
  onRecruit,
  onRecruitMax,
}: {
  state: GameState
  onBuild: (id: BuildingId) => void
  onRecruit: () => void
  onRecruitMax: () => void
}) {
  const rCost = recruitCost(state)
  const canRecruit = population(state) < popCap(state) && canAfford(state, rCost)
  const maxN = recruitMaxCount(state)
  const totalCost = maxN * (rCost.food ?? 0)
  return (
    <Panel
      title="建造与招募"
      icon="🔨"
      extra={
        <div className="flex items-center gap-1.5">
          <button
            onClick={onRecruit}
            disabled={!canRecruit}
            className={cn(
              'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition',
              canRecruit ? 'bg-emerald-700/80 text-emerald-100 hover:bg-emerald-600' : 'cursor-not-allowed bg-stone-800 text-stone-500',
            )}
            title="消耗食物招募一位新村民（需要空余住房）"
          >
            🧑‍🌾 招募 <CostTag cost={rCost} resources={state.resources} />
          </button>
          <button
            onClick={onRecruitMax}
            disabled={maxN <= 0}
            className={cn(
              'rounded-lg px-2 py-1 text-xs font-bold transition',
              maxN > 0 ? 'bg-emerald-900/70 text-emerald-200 hover:bg-emerald-800' : 'cursor-not-allowed bg-stone-800 text-stone-500',
            )}
            title={`一次招募 ${maxN} 人（min 食物可负担, 剩余住房）`}
          >
            招满 ×{maxN}（🌾{totalCost}）
          </button>
        </div>
      }
    >
      <div className="space-y-2">
        {ORDER.map((id) => {
          const def = BUILDINGS[id]
          const lv = state.buildings[id]
          const max = effectiveMax(state, id)
          const maxed = lv >= max
          const cost = maxed ? {} : buildCost(state, id)
          const affordable = !maxed && canAfford(state, cost)
          return (
            <button
              key={id}
              onClick={() => onBuild(id)}
              disabled={maxed || !affordable}
              className={cn(
                'group flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition',
                maxed
                  ? 'cursor-default border-stone-800 bg-stone-950/40 opacity-60'
                  : affordable
                    ? 'border-stone-700 bg-stone-950/50 hover:border-amber-600/60 hover:bg-stone-800/70'
                    : 'cursor-not-allowed border-stone-800 bg-stone-950/40 opacity-70',
              )}
            >
              <span className="text-2xl">{def.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-stone-200">{def.name}</span>
                  <span className="text-[11px] text-amber-400/90">
                    {id === 'barracks' ? (lv > 0 ? `Lv${lv}` : '未建造') : `×${lv}/${max}`}
                    {maxed && ' · 已满级'}
                  </span>
                </div>
                <div className="truncate text-[11px] text-stone-500">{def.desc}</div>
              </div>
              {!maxed && <CostTag cost={cost} resources={state.resources} />}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}
