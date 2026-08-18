import { CONFIG, NATIONS, RESOURCE_INFO, type ResourceId } from '@/game/config'
import { armyPower, finalBossWave, foodUpkeep, nextWave, popCap, population, previewTurnIncome, rogueBossWave, soldierCount, waveChanceTomorrow, wavePower, type GameState } from '@/game/engine'
import { getRelic } from '@/game/relics'
import { MobileTooltip } from './ui-bits'
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
  const isRogue = state.mode === 'rogue'
  const boss = isRogue
    ? rogueBossWave(state.day + (CONFIG.rogue.bossInterval - (state.day % CONFIG.rogue.bossInterval)), state.wavesFaced)
    : finalBossWave()
  const bossPower = wavePower(boss)
  const preview = state.phase === 'playing' ? previewTurnIncome(state) : null

  return (
    <header className="fixed inset-x-0 top-0 z-20 h-14 border-b border-stone-700/60 bg-stone-950/90 backdrop-blur-md lg:sticky lg:h-auto">
      <div className="mx-auto flex h-full max-w-7xl flex-nowrap items-center gap-x-2 overflow-x-auto px-3 sm:px-4 lg:flex-wrap lg:overflow-visible lg:gap-x-5 lg:gap-y-2 lg:py-3">
        <div className="flex flex-none items-center gap-2">
          <span className="text-2xl">{state.nation ? NATIONS[state.nation].icon : '🏰'}</span>
          <div className="hidden sm:block">
            <div className="text-base font-black tracking-widest text-amber-200">五十日坚守</div>
            {state.nation && <div className="text-[10px] text-stone-500">{NATIONS[state.nation].name}</div>}
          </div>
        </div>

        {/* 天数进度 */}
        <div className="flex-none w-28 sm:min-w-32 sm:flex-1 sm:max-w-60">
          {isRogue ? (
            <>
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>第 <b className="text-base text-purple-300">{state.day}</b> 天 · <span className="text-purple-400/80">无尽远征</span></span>
                <span>💀 {CONFIG.rogue.bossInterval - (state.day % CONFIG.rogue.bossInterval)} 天后领主</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                  style={{ width: `${((state.day % CONFIG.rogue.bossInterval) / CONFIG.rogue.bossInterval) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* 遗物栏（肉鸽模式） */}
        {isRogue && state.run && state.run.relics.length > 0 && (
          <div className="flex flex-none items-center gap-1 rounded-lg border border-purple-800/50 bg-purple-950/30 px-2 py-1">
            {state.run.relics.map((id) => {
              const r = getRelic(id)
              return r ? (
                <MobileTooltip key={id} content={`${r.icon} ${r.name}：${r.desc}`}>
                  <span className="text-sm">{r.icon}</span>
                </MobileTooltip>
              ) : null
            })}
          </div>
        )}

        {/* 资源 */}
        <div className="flex flex-none items-center gap-2" data-tutorial="resources">
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
              <MobileTooltip key={r} content={tooltip}>
                <div className="relative group flex h-9 w-14 flex-none flex-col items-center justify-center rounded-lg bg-stone-800/80 px-1 py-0.5 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs sm:text-base">{RESOURCE_INFO[r].icon}</span>
                    <span className={cn('text-xs font-bold tabular-nums sm:text-base', RESOURCE_INFO[r].color, r === 'food' && state.resources.food < foodUpkeep(state) && 'animate-pulse text-red-400')}>
                      {Math.floor(state.resources[r])}
                    </span>
                  </div>
                  {preview && delta !== 0 && (
                    <span className={cn('text-[9px] tabular-nums font-medium sm:text-[10px]', delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  )}
                </div>
              </MobileTooltip>
            )
          })}
          <MobileTooltip content="荣耀点（战斗缴获，用于解锁技能）">
            <div className="flex h-9 w-14 flex-none items-center justify-center gap-1 rounded-lg bg-amber-900/50 px-1 py-0.5 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1">
              <span className="text-xs sm:text-base">🏅</span>
              <span className="text-xs font-bold tabular-nums text-amber-300 sm:text-base">{state.honor}</span>
            </div>
          </MobileTooltip>
          <MobileTooltip content={`总人口（村民 ${state.villagers} + 士兵 ${soldierCount(state)}）/ 住房上限 ${popCap(state)}`}>
            <div className="flex h-9 w-16 flex-none items-center justify-center gap-1 rounded-lg bg-stone-800/80 px-1 py-0.5 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1">
              <span className="text-xs sm:text-base">👥</span>
              <span className={cn('text-xs font-bold tabular-nums text-stone-200 sm:text-base', population(state) >= popCap(state) && 'text-red-400')}>
                {population(state)}<span className="text-stone-500">/{popCap(state)}</span>
              </span>
            </div>
          </MobileTooltip>
        </div>

        {/* 波次预警 */}
        <MobileTooltip content={`第 ${wave.wave} 波：${wave.count} 只${wave.name} · 我方战力 ${myPower} vs 敌方约 ${enemyPower}\n${isRogue ? '下个领主' : '终局 Boss'}：${boss.count} 只${boss.name} · 战力 ${bossPower}`}>
          <div data-tutorial="wave-warning"
            className={cn(
              'flex flex-none items-center gap-1.5 rounded-lg border px-2 py-1 text-xs sm:gap-2 sm:px-3 sm:py-1.5',
              chance >= 1
                ? 'animate-pulse border-red-500/60 bg-red-950/60 text-red-300'
                : chance >= 0.6 || danger
                  ? 'border-orange-500/50 bg-orange-950/40 text-orange-300'
                  : 'border-stone-600 bg-stone-800/60 text-stone-300',
            )}
          >
            <span className="text-base">{wave.icon}</span>
            <span>
              第 {wave.wave} 波{state.omen && (
                <MobileTooltip content="🌑 黑暗交易：下一波敌人获得增强">
                  <span> 🌑</span>
                </MobileTooltip>
              )} ·{' '}
              {chance >= 1 ? '明日必来！' : chance > 0 ? `明袭 ${Math.round(chance * 100)}%` : '暂无动静'}
            </span>
            <span className={cn('font-bold', danger ? 'text-red-400' : 'text-emerald-400')}>
              {danger ? '⚠️ 战力不足' : '✓ 有信心'}
            </span>
            <span className="hidden text-[11px] text-stone-400 sm:inline">
              · {isRogue ? '领主' : '终局'} 💀{bossPower}
            </span>
          </div>
        </MobileTooltip>

        {/* 存档/读档/教程/帮助 */}
        {state.phase === 'playing' && onOpenSaveLoad && (
          <button
            onClick={() => onOpenSaveLoad('save')}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-stone-800/80 text-sm text-stone-300 transition hover:bg-stone-700 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1.5"
            title="保存游戏"
          >
            💾
          </button>
        )}
        {onOpenSaveLoad && (
          <button
            onClick={() => onOpenSaveLoad('load')}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-stone-800/80 text-sm text-stone-300 transition hover:bg-stone-700 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1.5"
            title="读取存档"
          >
            📂
          </button>
        )}
        {onTutorial && (
          <button
            onClick={onTutorial}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-stone-800/80 text-sm text-stone-300 transition hover:bg-stone-700 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1.5"
            title="教程"
          >
            📖
          </button>
        )}
        <button
          onClick={onHelp}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-stone-800/80 text-sm text-stone-300 transition hover:bg-stone-700 sm:h-auto sm:w-auto sm:px-2.5 sm:py-1.5"
          title="游戏规则"
        >
          ❓
        </button>
      </div>
    </header>
  )
}
