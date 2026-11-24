import { type GameState } from '@/game/engine'
import {
  ACTIVE_UNLOCK_LEVEL, HERO_MAX_LEVEL, canActivateHeroSkill, canLearnActive, canLearnPassive, canUpgradeHero,
  getHeroDef, heroGrowth, heroSkillPoints, heroUpgradeCost, heroXpNeeded,
} from '@/game/heroes'
import { Panel } from './ui-bits'
import { heroIcon } from './icons'
import { cn } from '@/lib/utils'

/** 英雄面板：等级/经验、战功、技能点分配与主动技 */
export default function HeroPanel({ state, onUpgrade, onLearnPassive, onLearnActive, onActivateSkill }: {
  state: GameState
  onUpgrade: () => void
  onLearnPassive: (index: number) => void
  onLearnActive: () => void
  onActivateSkill: () => void
}) {
  const hero = state.hero
  if (!hero) return null
  const def = getHeroDef(hero.id)
  if (!def) return null

  const points = heroSkillPoints(hero)
  const maxed = hero.level >= HERO_MAX_LEVEL
  const xpNeed = heroXpNeeded(hero.level)
  const growth = heroGrowth(hero, state)
  const upgradeCheck = canUpgradeHero(hero, state.honor)
  const activeCheck = canActivateHeroSkill(hero, state.day)
  const learnActiveCheck = canLearnActive(hero)

  return (
    <Panel
      title={`英雄 · ${def.name}`}
      icon={heroIcon(def.id)}
      extra={<span className="text-xs text-stone-400">技能点 <b className={points > 0 ? 'text-sky-300' : 'text-stone-500'}>{points}</b></span>}
    >
      <div className="space-y-3">
        {/* 等级与经验 */}
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-sky-200">Lv {hero.level}<span className="text-stone-500"> / {HERO_MAX_LEVEL}</span></span>
            <span className="text-stone-400">
              {def.growthName} <b className="text-amber-300">{growth}{def.growthCap ? ` / ${def.growthCap}` : ''}</b>
              <span className="ml-1 text-[10px] text-stone-500">（{def.growthDesc}）</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-800" title={maxed ? '已满级' : `经验 ${hero.xp}/${xpNeed}`}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all"
              style={{ width: maxed ? '100%' : `${Math.min(100, (hero.xp / xpNeed) * 100)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-stone-500">{maxed ? '已满级' : `经验 ${hero.xp}/${xpNeed}（每天 +1，战斗胜利 +1）`}</span>
            {!maxed && (
              <button
                onClick={onUpgrade}
                disabled={!upgradeCheck.ok}
                title={upgradeCheck.ok ? `花费 ${heroUpgradeCost(hero.level)} 荣耀升级` : upgradeCheck.reason}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-[11px] font-bold transition active:scale-95',
                  upgradeCheck.ok
                    ? 'border-sky-500 bg-sky-900/40 text-sky-200 hover:bg-sky-800/50'
                    : 'cursor-not-allowed border-stone-700 bg-stone-900/40 text-stone-500',
                )}
              >
                升级 🏅{heroUpgradeCost(hero.level)}
              </button>
            )}
          </div>
        </div>

        {/* 被动技能 */}
        <div className="space-y-2">
          {def.passives.map((p, i) => {
            const lv = hero.passives[i]
            const check = canLearnPassive(hero, i)
            return (
              <div key={p.id} className="rounded-lg border border-stone-700/60 bg-stone-950/40 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-200">{p.name}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] tracking-wider text-stone-500">
                      {[1, 2, 3].map((k) => (
                        <span key={k} className={k <= lv ? 'text-sky-400' : 'text-stone-700'}>●</span>
                      ))}
                    </span>
                    {lv < 3 && (
                      <button
                        onClick={() => onLearnPassive(i)}
                        disabled={!check.ok}
                        title={check.ok ? '消耗 1 技能点' : check.reason}
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-[10px] font-bold transition active:scale-95',
                          check.ok
                            ? 'border-sky-500 bg-sky-900/40 text-sky-200 hover:bg-sky-800/50'
                            : 'cursor-not-allowed border-stone-700 text-stone-600',
                        )}
                      >
                        学习
                      </button>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-stone-400">
                  {lv > 0 ? <b className="text-sky-300">{p.desc(p.values[lv - 1])}</b> : p.desc(p.values[0])}
                  {lv > 0 && lv < 3 && <span className="text-stone-500"> → 下级：{p.desc(p.values[lv])}</span>}
                  {lv === 0 && !check.ok && check.reason && <span className="text-stone-600">（{check.reason}）</span>}
                </p>
              </div>
            )
          })}
        </div>

        {/* 主动技能 */}
        <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-amber-200">🏹 {def.active.name}</span>
            {!hero.activeLearned ? (
              <button
                onClick={onLearnActive}
                disabled={!learnActiveCheck.ok}
                title={learnActiveCheck.ok ? '消耗 1 技能点' : learnActiveCheck.reason}
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[10px] font-bold transition active:scale-95',
                  learnActiveCheck.ok
                    ? 'border-amber-500 bg-amber-900/40 text-amber-200 hover:bg-amber-800/50'
                    : 'cursor-not-allowed border-stone-700 text-stone-600',
                )}
              >
                学习（Lv{ACTIVE_UNLOCK_LEVEL} 解锁）
              </button>
            ) : hero.id === 'huoqubing' && hero.dungeonExtraCharges > 0 ? (
              <span className="rounded border border-amber-500/60 bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">今日可额外挑战</span>
            ) : hero.pendingSkill ? (
              <span className="rounded border border-amber-500/60 bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">已挂起</span>
            ) : (
              <button
                onClick={onActivateSkill}
                disabled={!activeCheck.ok}
                title={activeCheck.ok ? (hero.id === 'huoqubing' ? '激活后今日可额外挑战地牢一次' : '激活后下一场战斗触发') : activeCheck.reason}
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[10px] font-bold transition active:scale-95',
                  activeCheck.ok
                    ? 'border-amber-500 bg-amber-900/40 text-amber-200 hover:bg-amber-800/50'
                    : 'cursor-not-allowed border-stone-700 text-stone-600',
                )}
              >
                {state.day < hero.skillCooldownUntil ? `冷却 ${hero.skillCooldownUntil - state.day} 天` : '激活'}
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-stone-400">{def.active.desc}（冷却 {def.active.cooldownDays} 天）</p>
          {hero.pendingSkill && (
            <p className="mt-1 text-[10px] text-amber-400/80">
              {hero.id === 'limu' ? '将在下一场敌袭或地牢战斗中触发' : '将在下一场敌袭战斗中触发'}
            </p>
          )}
        </div>
      </div>
    </Panel>
  )
}
