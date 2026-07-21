import { UNITS, type UnitId } from '@/game/config'
import { armyPower, canAfford, soldierCount, trainCost, unitAtk, unitHp, type GameState } from '@/game/engine'
import { cn } from '@/lib/utils'
import { CostTag, Panel } from './ui-bits'

const ORDER: UnitId[] = ['militia', 'archer', 'knight']

export default function ArmyPanel({
  state,
  onTrain,
}: {
  state: GameState
  onTrain: (id: UnitId) => void
}) {
  const noBarracks = state.buildings.barracks === 0
  return (
    <Panel
      title="军队训练"
      icon="🎖️"
      extra={
        <span className="text-xs text-stone-400">
          士兵 <b className="text-stone-200">{soldierCount(state)}</b> · 战力 <b className="text-red-300">{armyPower(state)}</b>
        </span>
      }
    >
      <div className="space-y-2">
        {ORDER.map((id) => {
          const def = UNITS[id]
          const n = state.soldiers[id]
          const locked = state.buildings.barracks < def.reqBarracks
          const cost = trainCost(state, id)
          const affordable = canAfford(state, cost)
          const disabled = locked || !affordable || state.villagers < 1
          return (
            <button
              key={id}
              onClick={() => onTrain(id)}
              disabled={disabled}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition',
                locked
                  ? 'cursor-not-allowed border-stone-800 bg-stone-950/40 opacity-50'
                  : disabled
                    ? 'cursor-not-allowed border-stone-800 bg-stone-950/40 opacity-70'
                    : 'border-stone-700 bg-stone-950/50 hover:border-red-500/50 hover:bg-stone-800/70',
              )}
            >
              <span className="relative text-2xl">
                {def.icon}
                {n > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {n}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-stone-200">{def.name}</span>
                  <span className="text-[11px] text-stone-500">
                    攻 {unitAtk(state, id)} · 血 {unitHp(state, id)}
                  </span>
                </div>
                <div className="truncate text-[11px] text-stone-500">
                  {locked ? `🔒 需要兵营 Lv${def.reqBarracks}` : '由 1 名村民转职（人口 1:1 转化）'}
                </div>
              </div>
              {!locked && <CostTag cost={cost} resources={state.resources} />}
            </button>
          )
        })}
        {noBarracks && (
          <p className="rounded-lg bg-amber-950/40 px-3 py-2 text-[11px] leading-relaxed text-amber-300/90">
            ⚠️ 还没有兵营！敌人第 5 天就会来袭，尽快建造兵营训练民兵。
          </p>
        )}
      </div>
    </Panel>
  )
}
