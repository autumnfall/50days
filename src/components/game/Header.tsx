import { BookOpen, Castle, CircleHelp, FolderOpen, Medal, Moon, Save, Skull, Swords, Users } from 'lucide-react'
import { CONFIG, NATIONS, RESOURCE_INFO, type ResourceId } from '@/game/config'
import { armyPower, finalBossWave, foodUpkeep, nextWave, popCap, population, previewTurnIncome, rogueBossWave, soldierCount, waveChanceTomorrow, wavePower, type GameState } from '@/game/engine'
import { MobileTooltip } from './ui-bits'
import { cn } from '@/lib/utils'
import { RESOURCE_ICONS } from './icons'

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
    <header className="war-room-header lg:sticky lg:top-0 lg:z-20">
      <div className="war-room-status">
        <div className="war-room-brand flex min-w-0 items-center gap-2">
          <span className="campaign-emblem"><Castle size={19} aria-hidden="true" /></span>
          <div className="hidden sm:block">
            <div className="game-display whitespace-nowrap text-lg font-bold text-amber-100">五十日坚守</div>
            {state.nation && <div className="text-xs text-stone-400">{NATIONS[state.nation].name}</div>}
          </div>
        </div>

        {/* 天数进度 */}
        <div className="war-room-day min-w-0">
          {isRogue ? (
            <>
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>第 <b className="text-base text-purple-300">{state.day}</b> 天</span>
                <span>{CONFIG.rogue.bossInterval - (state.day % CONFIG.rogue.bossInterval)} 天后领主</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-stone-800">
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
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-stone-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
                  style={{ width: `${(Math.min(state.day, CONFIG.totalDays) / CONFIG.totalDays) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* 资源 */}
        <div className="war-room-resources" data-tutorial="resources">
          {(Object.keys(RESOURCE_INFO) as ResourceId[]).map((r) => {
            const delta = preview ? (r === 'food' ? preview.food : r === 'wood' ? preview.wood : preview.gold) : 0
            const d = preview?.detail
            const ResourceIcon = RESOURCE_ICONS[r]
            const tooltip = d
              ? r === 'food'
                ? `采集 +${d.foodGather}  消耗 -${d.upkeep}${d.starved > 0 ? `  饥荒死 ${d.starved} 人` : ''}`
                : r === 'wood'
                  ? `采集 +${d.woodGather}`
                  : `采集 +${d.goldGather}${d.interest > 0 ? `  利息 +${d.interest}` : ''}`
              : RESOURCE_INFO[r].name
            return (
              <MobileTooltip key={r} content={tooltip}>
                <div className="war-room-stat" data-resource={r}>
                  <div className="flex items-center gap-1">
                    <ResourceIcon className={RESOURCE_INFO[r].color} size={15} aria-hidden="true" />
                    <span className="sr-only">{RESOURCE_INFO[r].name}</span>
                    <span className={cn('text-sm font-bold tabular-nums', RESOURCE_INFO[r].color, r === 'food' && state.resources.food < foodUpkeep(state) && 'animate-pulse text-red-400')}>
                      {Math.floor(state.resources[r])}
                    </span>
                  </div>
                  {preview && delta !== 0 && (
                    <span className={cn('text-[11px] tabular-nums font-medium', delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  )}
                </div>
              </MobileTooltip>
            )
          })}
          <MobileTooltip content="荣耀点（战斗缴获，用于解锁技能）">
            <div className="war-room-stat war-room-stat-inline">
              <Medal className="text-amber-300" size={15} aria-hidden="true" />
              <span className="sr-only">荣耀</span>
              <span className="text-sm font-bold tabular-nums text-amber-300">{state.honor}</span>
            </div>
          </MobileTooltip>
          <MobileTooltip content={`总人口（村民 ${state.villagers} + 士兵 ${soldierCount(state)}）/ 住房上限 ${popCap(state)}`}>
            <div className="war-room-stat war-room-stat-inline">
              <Users size={15} aria-hidden="true" />
              <span className="sr-only">人口</span>
              <span className={cn('text-sm font-bold tabular-nums text-stone-200', population(state) >= popCap(state) && 'text-red-400')}>
                {population(state)}<span className="text-stone-500">/{popCap(state)}</span>
              </span>
            </div>
          </MobileTooltip>
        </div>

        {/* 波次预警 */}
        <MobileTooltip className="war-room-warning" content={`第 ${wave.wave} 波：${wave.count} 只${wave.name} · 我方战力 ${myPower} vs 敌方约 ${enemyPower}\n${isRogue ? '下个领主' : '终局 Boss'}：${boss.count} 只${boss.name} · 战力 ${bossPower}`}>
          <div data-tutorial="wave-warning"
            className={cn(
              'flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-2.5 py-1 text-xs',
              chance >= 1
                ? 'animate-pulse border-red-500/60 bg-red-950/60 text-red-300'
                : chance >= 0.6 || danger
                  ? 'border-orange-500/50 bg-orange-950/40 text-orange-300'
                  : 'border-stone-600 bg-stone-800/60 text-stone-300',
            )}
          >
            <Swords size={15} aria-hidden="true" />
            <span>
              第 {wave.wave} 波{state.omen && (
                <MobileTooltip content="🌑 黑暗交易：下一波敌人获得增强">
                  <Moon className="inline" size={12} aria-hidden="true" />
                </MobileTooltip>
              )} ·{' '}
              {chance >= 1 ? '明日必来！' : chance > 0 ? `明袭 ${Math.round(chance * 100)}%` : '暂无动静'}
            </span>
            <span className={cn('font-bold', danger ? 'text-red-400' : 'text-emerald-400')}>
              {danger ? '战力不足' : '✓ 有信心'}
            </span>
            <span className="hidden items-center gap-1 text-[11px] text-stone-400 sm:inline-flex">
              · {isRogue ? '领主' : '终局'} <Skull size={12} aria-hidden="true" />{bossPower}
            </span>
          </div>
        </MobileTooltip>

        {/* 存档/读档/教程/帮助 */}
        <div className="war-room-tools">
          {state.phase === 'playing' && onOpenSaveLoad && (
            <button
              onClick={() => onOpenSaveLoad('save')}
              className="war-room-tool"
              title="保存游戏"
              aria-label="保存游戏"
            >
              <Save size={17} aria-hidden="true" />
            </button>
          )}
          {onOpenSaveLoad && (
            <button
              onClick={() => onOpenSaveLoad('load')}
              className="war-room-tool"
              title="读取存档"
              aria-label="读取存档"
            >
              <FolderOpen size={17} aria-hidden="true" />
            </button>
          )}
          {onTutorial && (
            <button
              onClick={onTutorial}
              className="war-room-tool"
              title="教程"
              aria-label="教程"
            >
              <BookOpen size={17} aria-hidden="true" />
            </button>
          )}
          <button
            onClick={onHelp}
            className="war-room-tool"
            title="游戏规则"
            aria-label="游戏规则"
          >
            <CircleHelp size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
