import type { DungeonResult, BattleRound } from '@/game/engine'
import type { UnitId } from '@/game/config'

const UNIT_INFO: Record<UnitId, { name: string; icon: string }> = {
  militia: { name: '民兵', icon: '⚔️' },
  archer: { name: '弓箭手', icon: '🏹' },
  knight: { name: '骑士', icon: '🐎' },
}

const UNIT_ORDER: UnitId[] = ['knight', 'archer', 'militia']

function UnitDmgBar({ type, dmg, kills, lost }: { type: UnitId; dmg: number; kills: number; lost: number }) {
  const info = UNIT_INFO[type]
  if (dmg === 0 && kills === 0 && lost === 0) return null
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="w-4 text-center">{info.icon}</span>
      {dmg > 0 && <span className="text-stone-300">⚔{dmg}</span>}
      {kills > 0 && <span className="text-emerald-400">杀{kills}</span>}
      {lost > 0 && <span className="text-red-400">亡{lost}</span>}
    </div>
  )
}

function RoundRow({ r }: { r: BattleRound }) {
  const hasDetail = r.playerDmgByType || r.playerLostByType
  return (
    <div className="rounded-lg bg-stone-950/50 px-2 py-1.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-5 text-right font-bold text-stone-500">{r.round}</span>
        <span className="text-emerald-400">⚔{r.playerDmg}</span>
        <span className="text-red-400">🛡{r.enemyDmg}</span>
        <span className="text-stone-500 ml-auto">
          敌{r.enemiesLeft} / 我{r.playerLeft}
        </span>
        {r.note && <span className="text-amber-500 text-[11px]">{r.note}</span>}
      </div>
      {hasDetail && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-7">
          {UNIT_ORDER.map((id) => (
            <UnitDmgBar
              key={id}
              type={id}
              dmg={r.playerDmgByType?.[id] ?? 0}
              kills={r.playerKillsByType?.[id] ?? 0}
              lost={r.playerLostByType?.[id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function DungeonResultModal({
  result,
  onClose,
}: {
  result: DungeonResult
  onClose: () => void
}) {
  const totalLost = Object.values(result.soldiersLost).reduce((a, b) => a + b, 0)
  const totalRevived = Object.values(result.soldiersRevived).reduce((a, b) => a + b, 0)

  // 汇总各兵种总伤害/总击杀
  const totalDmgByType: Partial<Record<UnitId, number>> = {}
  const totalKillsByType: Partial<Record<UnitId, number>> = {}
  for (const r of result.rounds) {
    if (r.playerDmgByType) {
      for (const [k, v] of Object.entries(r.playerDmgByType) as [UnitId, number][]) {
        totalDmgByType[k] = (totalDmgByType[k] ?? 0) + v
      }
    }
    if (r.playerKillsByType) {
      for (const [k, v] of Object.entries(r.playerKillsByType) as [UnitId, number][]) {
        totalKillsByType[k] = (totalKillsByType[k] ?? 0) + v
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-[popIn_0.25s_ease-out] overflow-hidden rounded-2xl border bg-stone-900 shadow-2xl">
        {/* 头部 */}
        <div className={result.won
          ? 'bg-gradient-to-r from-emerald-900/80 to-emerald-800/60 border-b border-emerald-700/40 p-5'
          : 'bg-gradient-to-r from-red-900/80 to-red-800/60 border-b border-red-700/40 p-5'
        }>
          <div className="text-3xl mb-1">{result.won ? '🏆' : '💀'}</div>
          <h2 className={result.won ? 'text-lg font-black text-emerald-200' : 'text-lg font-black text-red-200'}>
            {result.won ? '地牢通关！' : '挑战失败'}
          </h2>
          <p className="text-sm text-stone-400 mt-1">
            第{result.floor}层 · {result.wave.name} · {result.wave.count}只
          </p>
        </div>

        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* 修饰效果 */}
          {result.modifiers.length > 0 && (
            <div>
              <div className="text-xs font-bold text-stone-500 mb-1.5">本局效果</div>
              <div className="flex flex-wrap gap-1.5">
                {result.modifiers.map((m) => (
                  <span
                    key={m.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                      m.type === 'enemy_buff'
                        ? 'bg-red-900/30 border border-red-700/30 text-red-300'
                        : 'bg-purple-900/30 border border-purple-700/30 text-purple-300'
                    }`}
                  >
                    {m.icon} {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 战斗概要 */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-stone-800/50 p-2">
              <div className="text-xs text-stone-500">回合</div>
              <div className="text-sm font-bold text-stone-200">{result.rounds.length}</div>
            </div>
            <div className="rounded-lg bg-stone-800/50 p-2">
              <div className="text-xs text-stone-500">击杀</div>
              <div className="text-sm font-bold text-stone-200">{result.won ? result.wave.count : result.rounds[result.rounds.length - 1]?.enemiesLeft !== undefined ? result.wave.count - result.rounds[result.rounds.length - 1].enemiesLeft : 0}</div>
            </div>
            <div className="rounded-lg bg-stone-800/50 p-2">
              <div className="text-xs text-stone-500">荣耀</div>
              <div className="text-sm font-bold text-amber-300">{result.won ? `+${result.honorGained}` : '—'}</div>
            </div>
          </div>

          {/* 各兵种贡献总览 */}
          {Object.values(totalDmgByType).some((v) => v > 0) && (
            <div>
              <div className="text-xs font-bold text-stone-500 mb-1.5">兵种贡献</div>
              <div className="flex flex-wrap gap-2">
                {UNIT_ORDER.map((id) => {
                  const dmg = totalDmgByType[id] ?? 0
                  const kills = totalKillsByType[id] ?? 0
                  if (dmg === 0 && kills === 0) return null
                  return (
                    <div key={id} className="flex items-center gap-1.5 rounded-lg bg-stone-800/60 border border-stone-700/30 px-2 py-1 text-xs">
                      <span>{UNIT_INFO[id].icon}</span>
                      <span className="text-stone-300">⚔{dmg}</span>
                      <span className="text-emerald-400">杀{kills}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 士兵损失 */}
          {totalLost > 0 && (
            <div>
              <div className="text-xs font-bold text-stone-500 mb-1.5">部队损失</div>
              <div className="flex flex-wrap gap-2">
                {UNIT_ORDER.map((id) => {
                  const lost = result.soldiersLost[id] ?? 0
                  const revived = result.soldiersRevived[id] ?? 0
                  if (lost === 0) return null
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-red-900/20 border border-red-800/30 px-2 py-1 text-xs text-red-300">
                      {UNIT_INFO[id].icon} -{lost}
                      {revived > 0 && <span className="text-emerald-400">(复活{revived})</span>}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* 战斗日志 */}
          {result.rounds.length > 0 && (
            <div>
              <div className="text-xs font-bold text-stone-500 mb-1.5">战斗过程</div>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {result.rounds.map((r) => (
                  <RoundRow key={r.round} r={r} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 关闭按钮 */}
        <div className="border-t border-stone-700/40 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-500 active:scale-[0.98]"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
