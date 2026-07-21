import { BUILDINGS, CONFIG, type BuildingId } from '@/game/config'
import { buildCost, canAfford, effectiveMax, hasSkill, popCap, population, recruitCost, recruitMaxCount, towerDmg, wallAbsorb, type GameState } from '@/game/engine'
import { cn } from '@/lib/utils'
import { CostTag, Panel } from './ui-bits'

const ORDER: BuildingId[] = ['farm', 'lumber', 'mine', 'house', 'barracks', 'wall', 'tower']

function BuildingDesc({ state, id }: { state: GameState; id: BuildingId }) {
  const lv = state.buildings[id]
  switch (id) {
    case 'farm': {
      const farmBonus = CONFIG.farmBonus * (hasSkill(state, 'ag_fertility') ? 2 : 1)
      const base = CONFIG.foodGatherBase + lv * farmBonus
      return <div className="truncate text-[11px] text-stone-500">每位村民食物产出 <b className="text-amber-300">{base}</b>/天（基础 {CONFIG.foodGatherBase} + 建筑 +{lv * farmBonus}）</div>
    }
    case 'lumber': {
      const base = CONFIG.gatherBase + lv
      return <div className="truncate text-[11px] text-stone-500">每位村民木材产出 <b className="text-orange-300">{base}</b>/天（基础 {CONFIG.gatherBase} + 建筑 +{lv}）</div>
    }
    case 'mine': {
      const base = CONFIG.gatherBase + lv
      return <div className="truncate text-[11px] text-stone-500">每位村民金币产出 <b className="text-yellow-300">{base}</b>/天（基础 {CONFIG.gatherBase} + 建筑 +{lv}）</div>
    }
    case 'house':
      return <div className="truncate text-[11px] text-stone-500">住房上限 +{CONFIG.houseCapPer}/座，当前上限 <b className="text-stone-200">{popCap(state)}</b></div>
    case 'barracks':
      return <div className="truncate text-[11px] text-stone-500">{lv >= 3 ? '可训练骑士' : lv >= 2 ? '可训练弓手' : lv >= 1 ? '可训练民兵' : '解锁士兵训练'}</div>
    case 'wall': {
      const ab = wallAbsorb(state)
      return <div className="truncate text-[11px] text-stone-500">每级吸收 <b className="text-emerald-300">{ab}</b> 点伤害（共 <b className="text-emerald-300">{lv * ab}</b>）</div>
    }
    case 'tower': {
      const dmg = towerDmg(state)
      return <div className="truncate text-[11px] text-stone-500">每座每轮 <b className="text-red-300">{dmg}</b> 伤害（共 <b className="text-red-300">{lv * dmg}</b>）</div>
    }
  }
}

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
      data-tutorial="build-panel"
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
                <BuildingDesc state={state} id={id} />
              </div>
              {!maxed && <CostTag cost={cost} resources={state.resources} />}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}
