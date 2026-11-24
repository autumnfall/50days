import { Flame, Swords, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { UNITS, type UnitId } from '@/game/config'
import type { BattleReport } from '@/game/engine'
import { cn } from '@/lib/utils'

export default function BattleModal({ report, onClose, closeLabel = '继续坚守' }: { report: BattleReport; onClose: () => void; closeLabel?: string }) {
  const { wave } = report
  const [shown, setShown] = useState(0) // 已展示的轮数
  const total = report.rounds.length
  const done = shown >= total

  // 逐轮播放（BattleModal 在 Game.tsx 中按 state.day 加 key 强制重渲染，shown 初始为 0）
  useEffect(() => {
    if (total === 0) return
    const t = setInterval(() => {
      setShown((v) => {
        if (v >= total) { clearInterval(t); return v }
        return v + 1
      })
    }, 650)
    return () => clearInterval(t)
  }, [total])

  const lostEntries = useMemo(
    () => (Object.entries(report.soldiersLost) as [UnitId, number][]).filter(([, n]) => n > 0),
    [report],
  )

  // 当前战场态势
  const cur = total > 0 ? report.rounds[Math.min(shown, total) - 1] : null
  const startEnemies = wave.count
  const enemiesLeft = done ? (cur?.enemiesLeft ?? startEnemies) : (cur?.enemiesLeft ?? startEnemies)

  return (
    <div data-testid="battle-report" className="fixed inset-0 z-50 flex items-center justify-center game-scrim bg-black/75 p-4 backdrop-blur-sm">
      <div className={cn(
        'game-dialog w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border shadow-2xl transition-colors',
        done ? (report.won ? 'border-amber-500/70' : 'border-red-600/70') : 'border-stone-600',
        'bg-stone-900',
      )}>
        {/* 标题 */}
        <div className={cn('px-6 py-4 text-center', done ? (report.won ? 'bg-amber-950/60' : 'bg-red-950/60') : 'bg-stone-950/60')}>
          <span className="campaign-emblem mx-auto" aria-hidden="true">
            {!done ? <Swords size={23} /> : report.won ? <Trophy size={23} /> : <Flame size={23} />}
          </span>
          <h2 className={cn('mt-1 text-xl font-black tracking-widest', done ? (report.won ? 'text-amber-200' : 'text-red-300') : 'text-stone-200')}>
            {!done ? '战斗进行中…' : report.won ? '村庄守住了！' : '防线被突破！'}
          </h2>
          <p className="mt-1 text-xs text-stone-400">
            第 {wave.wave} 波 · {wave.name} × {startEnemies}
          </p>
          {report.modifier && (
            <div className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-lg border border-purple-700/50 bg-purple-950/40 px-2.5 py-1 text-[11px] text-purple-200" title={report.modifier.desc}>
              <span>{report.modifier.icon}</span>
              <span className="font-bold">战场词条 · {report.modifier.name}</span>
              <span className="text-purple-300/70">{report.modifier.desc}</span>
            </div>
          )}

          {/* 战场进度条 */}
          {total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] text-stone-400">
                <span>🛡️ 我方</span>
                <span className="font-bold text-red-300">余敌 {enemiesLeft}/{startEnemies}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-800">
                <div
                  className={cn('h-full transition-all duration-500', report.won || !done ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-red-500')}
                  style={{ width: `${(enemiesLeft / startEnemies) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 战力明细 */}
        {report.unitDetails.length > 0 && (
          <div className="border-t border-stone-700/40 px-6 py-3">
            <h3 className="mb-2 text-[11px] font-bold tracking-wider text-stone-500">战力明细（基础 → 最终）</h3>
            <div className="space-y-1.5">
              {report.unitDetails.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-xs">
                  <span className="text-stone-300">
                    {u.icon} {u.name} ×{u.count}
                  </span>
                  <span className="text-stone-400">
                    <span className="text-emerald-300">攻 {u.baseAtk}→{u.finalAtk}</span>
                    <span className="mx-1.5 text-stone-600">|</span>
                    <span className="text-sky-300">血 {u.baseHp}→{u.finalHp}</span>
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-stone-700/30 pt-1.5 text-xs">
                <span className="text-stone-300">
                  {report.enemyDetails.icon} {report.enemyDetails.name} ×{report.enemyDetails.count}
                </span>
                <span className="text-stone-400">
                  <span className="text-red-300">攻 {report.enemyDetails.baseAtk}→{report.enemyDetails.finalAtk}</span>
                  <span className="mx-1.5 text-stone-600">|</span>
                  <span className="text-orange-300">血 {report.enemyDetails.baseHp}→{report.enemyDetails.finalHp}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 战斗过程 */}
        <div className="h-52 space-y-1.5 overflow-y-auto px-6 py-4">
          {total === 0 && <p className="text-sm text-stone-400">村庄毫无防备，敌人长驱直入……</p>}
          {report.rounds.slice(0, shown).map((r) => (
            <div
              key={r.round}
              className="flex animate-[slideIn_0.3s_ease-out] items-center gap-2 rounded-lg bg-stone-950/50 px-2.5 py-1.5 text-xs"
            >
              <span className="w-12 shrink-0 rounded bg-stone-800 px-1 py-0.5 text-center text-[10px] text-stone-400">
                R{r.round}
              </span>
              <span className="font-medium text-emerald-300">+{r.playerDmg}</span>
              <span className="text-stone-600">⚔</span>
              <span className="font-medium text-red-300">-{r.enemyDmg}</span>
              <span className="ml-auto text-stone-500">余敌 <b className="text-orange-300">{r.enemiesLeft}</b></span>
              {r.note && <span className="text-orange-300">{r.note}</span>}
            </div>
          ))}
          {!done && total > 0 && (
            <div className="flex items-center gap-2 px-2 text-xs text-stone-500">
              <span className="inline-block h-2 w-2 animate-ping rounded-full bg-red-400" />
              激战正酣…
            </div>
          )}
        </div>

        {/* 结算 */}
        {done && (
          <div className="animate-[slideIn_0.3s_ease-out] space-y-1.5 border-t border-stone-700/60 px-6 py-4 text-sm">
            {lostEntries.map(([id, n]) => {
              const revived = report.soldiersRevived[id] ?? 0
              return (
                <p key={id} className="text-red-300">
                  💀 损失 {UNITS[id].icon} {UNITS[id].name} × {n}
                  {revived > 0 && <span className="text-emerald-300">（💂 战后复活 {revived}）</span>}
                </p>
              )
            })}
            {report.wallLost > 0 && (
              <p className="text-red-300">
                🧱 城墙损毁 {report.wallLost} 级
                {report.wallRepaired > 0 && <span className="text-emerald-300">（🏞️ 大地壁垒自动修复 {report.wallRepaired} 级）</span>}
              </p>
            )}
            {report.towersLost > 0 && <p className="text-red-300">🗼 箭塔被拆毁 × {report.towersLost}</p>}
            {report.villagersLost > 0 && <p className="text-red-300">🩸 {report.villagersLost} 名村民惨遭杀害</p>}
            {report.buildingLost && <p className="text-red-300">💥 {report.buildingLost} 被夷为平地</p>}
            {report.lootGold > 0 && <p className="text-amber-300">🪙 缴获敌军辎重：+{report.lootGold} 金币</p>}
            {report.honorGained > 0 && <p className="text-amber-200">🏅 获得荣耀：+{report.honorGained}</p>}
            {report.won && lostEntries.length === 0 && report.wallLost === 0 && (
              <p className="text-emerald-300">✨ 完美防御，无一伤亡！</p>
            )}
          </div>
        )}

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            disabled={!done}
            className={cn(
              'w-full rounded-xl py-3 font-black tracking-[0.2em] transition active:scale-[0.98]',
              done
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-stone-950 hover:from-amber-500 hover:to-amber-400'
                : 'cursor-wait bg-stone-800 text-stone-600',
            )}
          >
            {done ? closeLabel : '战斗中…'}
          </button>
        </div>
      </div>
    </div>
  )
}
