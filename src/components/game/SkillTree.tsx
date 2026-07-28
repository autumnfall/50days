import { getColumnsForNation, getSkillsForNation, RESOURCE_INFO, UPGRADES, type ResourceId, type UpgradeId } from '@/game/config'
import {
  canBuyUpgrade, canExchangeHonor, canUnlockSkill, hasSkill, hasT3, honorExchangeCost, upgradeCost, type GameState,
} from '@/game/engine'
import { cn } from '@/lib/utils'

const TIER_STYLE: Record<number, { label: string; color: string }> = {
  1: { label: 'T1', color: 'text-stone-400' },
  2: { label: 'T2', color: 'text-sky-300' },
  3: { label: 'T3', color: 'text-amber-300' },
}

export default function SkillTree({
  state,
  onUnlock,
  onBuyUpgrade,
  onExchange,
}: {
  state: GameState
  onUnlock: (id: string) => void
  onBuyUpgrade: (id: UpgradeId) => void
  onExchange: (res: ResourceId) => void
}) {
  if (!state.nation) return null
  const skills = getSkillsForNation(state.nation)
  const columns = getColumnsForNation(state.nation)
  const endgame = hasT3(state)

  return (
    <div className="space-y-4">
      {/* ---- 3 列技能链 ---- */}
      <div className="grid grid-cols-3 gap-2">
        {columns.map((col) => (
          <div key={col}>
            <div className="mb-1.5 border-b border-stone-700/60 pb-1 text-center text-[10px] font-bold tracking-widest text-amber-200/80">
              {col}
            </div>
            <div className="space-y-1.5">
              {[1, 2, 3].map((tier) => {
                const skill = skills.find((k) => k.column === col && k.tier === tier)
                if (!skill) return null
                const unlocked = hasSkill(state, skill.id)
                const check = canUnlockSkill(state, skill.id)
                const tierInfo = TIER_STYLE[tier]
                return (
                  <button
                    key={skill.id}
                    onClick={() => onUnlock(skill.id)}
                    disabled={unlocked || !check.ok}
                    title={`${skill.desc}${!unlocked && !check.ok ? `\n🔒 ${check.reason}` : ''}`}
                    className={cn(
                      'w-full rounded-lg border px-1.5 py-1.5 text-center transition',
                      unlocked
                        ? 'border-amber-500/60 bg-amber-950/40'
                        : check.ok
                          ? 'border-stone-600 bg-stone-950/50 hover:border-amber-500/60 hover:bg-stone-800/60'
                          : 'cursor-not-allowed border-stone-800 bg-stone-950/30 opacity-55',
                    )}
                  >
                    <div className={cn('text-xl leading-none', unlocked && 'drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]')}>
                      {skill.icon}
                    </div>
                    <div className={cn('mt-1 text-[10px] font-bold leading-tight', unlocked ? 'text-amber-200' : 'text-stone-200')}>
                      {skill.name}
                    </div>
                    <div className={cn('mt-0.5 text-[9px] font-medium', tierInfo.color)}>
                      {tierInfo.label} · 🏅{skill.cost}
                    </div>
                    <div className="mt-0.5 text-[9px] leading-tight text-stone-500">
                      {unlocked ? '✓ 已习得' : !check.ok ? `🔒 ${check.reason}` : skill.desc}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ---- 无限升级 ---- */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest text-stone-500">∞ 无限升级</span>
          {!endgame && <span className="text-[9px] text-stone-600">解锁任意 T3 科技后开放</span>}
        </div>
        <div className={cn('space-y-1.5', !endgame && 'pointer-events-none opacity-45')}>
          {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
            const def = UPGRADES[id]
            const lv = state.upgrades[id]
            const cost = upgradeCost(state, id)
            const can = canBuyUpgrade(state, id)
            return (
              <button
                key={id}
                onClick={() => onBuyUpgrade(id)}
                disabled={!can}
                title={def.desc}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition',
                  can
                    ? 'border-stone-600 bg-stone-950/50 hover:border-purple-500/60 hover:bg-stone-800/60'
                    : 'cursor-not-allowed border-stone-800 bg-stone-950/30',
                )}
              >
                <span className="text-lg">{def.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 text-xs font-bold text-stone-200">
                    {def.name}
                    <span className="text-[10px] font-medium text-purple-300">Lv{lv}</span>
                  </div>
                  <div className="text-[9px] leading-tight text-stone-500">{def.desc}</div>
                </div>
                <span className={cn('shrink-0 text-[10px] font-bold', state.honor >= cost ? 'text-amber-300' : 'text-stone-500')}>
                  🏅{cost}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ---- 资源兑换荣耀 ---- */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest text-stone-500">🏅 资源兑换荣耀</span>
          {!endgame && <span className="text-[9px] text-stone-600">解锁任意 T3 科技后开放</span>}
        </div>
        <div className={cn('space-y-1.5', !endgame && 'pointer-events-none opacity-45')}>
          {(Object.keys(RESOURCE_INFO) as ResourceId[]).map((r) => {
            const info = RESOURCE_INFO[r]
            const cost = honorExchangeCost(state, r)
            const can = canExchangeHonor(state, r)
            return (
              <button
                key={r}
                onClick={() => onExchange(r)}
                disabled={!can}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition',
                  can
                    ? 'border-stone-600 bg-stone-950/50 hover:border-amber-500/60 hover:bg-stone-800/60'
                    : 'cursor-not-allowed border-stone-800 bg-stone-950/30',
                )}
              >
                <span className="text-lg">{info.icon}</span>
                <span className="flex-1 text-xs text-stone-300">
                  <b className={state.resources[r] >= cost ? 'text-stone-100' : 'text-red-400'}>{cost}</b> {info.name} → 1 荣耀
                </span>
                <span className="text-[9px] text-stone-500">已换 {state.honorExchange[r]} 次</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
