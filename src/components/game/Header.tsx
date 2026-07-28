import { CONFIG, NATIONS, RESOURCE_INFO, type ResourceId } from '@/game/config'
import { armyPower, finalBossWave, foodUpkeep, nextWave, popCap, population, previewTurnIncome, soldierCount, waveChanceTomorrow, wavePower, type GameState } from '@/game/engine'
import { cn } from '@/lib/utils'

export default function Header({ state, onOpenSaveLoad, onTutorial, onHelp }: {
  state: GameState
  onOpenSaveLoad?: (mode: 'save' | 'load') => void
  onTutorial?: () => void
  onHelp?: () => void
}) {
  const chance = waveChanceTomorrow(state)
  const wave = nextWave(state)
  const myPower = armyPower(state)
  const enemyPower = wavePower(wave)
  const danger = myPower < enemyPower
  const boss = finalBossWave()
  const bossPower = wavePower(boss)
  const preview = state.phase === 'playing' ? previewTurnIncome(state) : null

  return (
    <header className="sticky top-0 z-20 border-b border-stone-700/60 bg-stone-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 sm:gap-x-5 sm:gap-y-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{state.nation ? NATIONS[state.nation].icon : '🏰'}</span>
          <div className="hidden sm:block">
            <div className="text-base font-black tracking-widest text-amber-200">五十日坚守</div>
            {state.nation && <div className="text-[10px] text-stone-500">{NATIONS[state.nation].name}</div>}
          </div>
        </div>

        {/* 天数进度 */}
        <div className="min-w-32 flex-1 sm:max-w-60">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>第 <b className="text-base text-amber-300">{Math.min(state.day, CONFIG.totalDays)}</b> / {CONFIG.totalDays} 天</span>
            <span>{Math.round((Math.min(state.day, CONFIG.totalDays) / CONFIG.totalDays) * 100)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
              style={{ width: `${(Math.min(state.day, CONFIG.totalDays) / CONFIG.totalDays) * 100}%` }}
            />
          </div>
        </div>

        {/* 资源 */}
        <div className="flex items-center gap-2.5" data-tutorial="resources">
          {(Object.keys(RESOURCE_INFO) as ResourceId[]).map((r) => {
            const delta = preview ? (r === 'food' ? preview.food : r === 'wood' ? preview.wood : preview.gold) : 0
            const d = preview?.detail
            const tooltip = d
              ? r === 'food'
                ? `采集 +${d.foodGather}  消耗 -${d.upkeep}${d.starved > 0 ? `  饥荒死 ${d.starved} 人` : ''}`
                : r === 'wood'
                  ? `采集 +${d.woodGather}`
                  : `采集 +${d.goldGather}${d.interest > 0 ? `  利息 +${d.interest}` : ''}`
              : RESOURCE_INFO[r].name
            return (
              <div key={r} className="relative group flex flex-col items-center rounded-lg bg-stone-800/80 px-2 py-0.5 sm:px-2.5 sm:py-1" title={tooltip}>
                <div className="flex items-center gap-1">
                  <span>{RESOURCE_INFO[r].icon}</span>
                  <span className={cn('font-bold tabular-nums', RESOURCE_INFO[r].color, r === 'food' && state.resources.food < foodUpkeep(state) && 'animate-pulse text-red-400')}>
                    {Math.floor(state.resources[r])}
                  </span>
                </div>
                {preview && delta !== 0 && (
                  <span className={cn('text-[10px] tabular-nums font-medium', delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                )}
              </div>
            )
          })}
          <div className="flex items-center gap-1 rounded-lg bg-amber-900/50 px-2.5 py-1" title="荣耀点（战斗缴获，用于解锁技能）">
            <span>🏅</span>
            <span className="font-bold tabular-nums text-amber-300">{state.honor}</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-stone-800/80 px-2.5 py-1" title={`总人口（村民 ${state.villagers} + 士兵 ${soldierCount(state)}）/ 住房上限 ${popCap(state)}`}>
            <span>👥</span>
            <span className={cn('font-bold tabular-nums text-stone-200', population(state) >= popCap(state) && 'text-red-400')}>
              {population(state)}<span className="text-stone-500">/{popCap(state)}</span>
            </span>
          </div>
        </div>

        {/* 波次预警 */}
        <div data-tutorial="wave-warning"
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs sm:gap-2 sm:px-3 sm:py-1.5',
            chance >= 1
              ? 'animate-pulse border-red-500/60 bg-red-950/60 text-red-300'
              : chance >= 0.6 || danger
                ? 'border-orange-500/50 bg-orange-950/40 text-orange-300'
                : 'border-stone-600 bg-stone-800/60 text-stone-300',
          )}
          title={`第 ${wave.wave} 波：${wave.count} 只${wave.name} · 我方战力 ${myPower} vs 敌方约 ${enemyPower}\n终局 Boss：${boss.count} 只${boss.name} · 战力 ${bossPower}`}
        >
          <span className="text-base">{wave.icon}</span>
          <span>
            第 {wave.wave} 波{state.omen && ' 🌑'} ·{' '}
            {chance >= 1 ? '明日必来！' : chance > 0 ? `明袭 ${Math.round(chance * 100)}%` : '暂无动静'}
          </span>
          <span className={cn('font-bold', danger ? 'text-red-400' : 'text-emerald-400')}>
            {danger ? '⚠️ 战力不足' : '✓ 有信心'}
          </span>
          <span className="hidden text-[11px] text-stone-400 sm:inline">
            · 终局 💀{bossPower}
          </span>
        </div>

        {/* 存档/读档/教程/帮助 */}
        {state.phase === 'playing' && onOpenSaveLoad && (
          <button
            onClick={() => onOpenSaveLoad('save')}
            className="rounded-lg bg-stone-800/80 px-2.5 py-1.5 text-sm text-stone-300 transition hover:bg-stone-700"
            title="保存游戏"
          >
            💾
          </button>
        )}
        {onOpenSaveLoad && (
          <button
            onClick={() => onOpenSaveLoad('load')}
            className="rounded-lg bg-stone-800/80 px-2.5 py-1.5 text-sm text-stone-300 transition hover:bg-stone-700"
            title="读取存档"
          >
            📂
          </button>
        )}
        {onTutorial && (
          <button
            onClick={onTutorial}
            className="rounded-lg bg-stone-800/80 px-2.5 py-1.5 text-sm text-stone-300 transition hover:bg-stone-700"
            title="教程"
          >
            📖
          </button>
        )}
        <button
          onClick={onHelp}
          className="rounded-lg bg-stone-800/80 px-2.5 py-1.5 text-sm text-stone-300 transition hover:bg-stone-700"
          title="游戏规则"
        >
          ❓
        </button>
      </div>
    </header>
  )
}
