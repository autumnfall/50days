import { useState } from 'react'
import { DUNGEON_FLOORS, estimateDungeonPower } from '@/game/dungeon'
import type { GameState } from '@/game/engine'
import { cn } from '@/lib/utils'
import { Panel } from './ui-bits'

export default function DungeonPanel({
  state,
  onEnter,
}: {
  state: GameState
  onEnter: (floor: number) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const dungeon = state.dungeon ?? { highestCleared: 0, dailyAttempted: false, pendingResult: null }
  const { highestCleared, dailyAttempted } = dungeon
  const nextFloor = highestCleared + 1
  const soldiers = state.soldiers
  const totalSoldiers = soldiers.militia + soldiers.archer + soldiers.knight + soldiers.warlord

  const selectedFloor = selected !== null ? DUNGEON_FLOORS[selected - 1] : null

  return (
    <Panel
      title="地牢探险"
      icon="🏚️"
      extra={
        <span className="text-xs text-stone-400">
          {dailyAttempted
            ? <span className="text-red-400">今日已挑战</span>
            : <span className="text-emerald-400">可挑战</span>}
        </span>
      }
    >
      <div className="space-y-2">
        {DUNGEON_FLOORS.map((f) => {
          const cleared = f.floor <= highestCleared
          const available = f.floor <= nextFloor && !dailyAttempted && totalSoldiers > 0
          const locked = f.floor > nextFloor
          const isSelected = selected === f.floor

          return (
            <div key={f.floor}>
              <button
                onClick={() => setSelected(isSelected ? null : f.floor)}
                disabled={locked}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                  cleared && 'bg-emerald-900/20 border border-emerald-700/30',
                  !cleared && !locked && 'bg-stone-800/50 border border-stone-700/40 hover:bg-stone-800',
                  locked && 'bg-stone-900/30 border border-stone-800/30 opacity-40 cursor-not-allowed',
                  isSelected && 'ring-1 ring-amber-500/50',
                )}
              >
                <span className="text-lg">{f.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-bold', cleared ? 'text-emerald-300' : 'text-stone-200')}>
                      {f.floor}F
                    </span>
                    <span className="text-xs text-stone-400">{f.name}</span>
                    {cleared && <span className="text-xs text-emerald-500">✓</span>}
                  </div>
                  <div className="text-xs text-stone-500">
                    战力 {estimateDungeonPower(f.wave).min}~{estimateDungeonPower(f.wave).max}
                    {' · '}
                    <span className="text-amber-400">🏅{f.honor}</span>
                  </div>
                </div>
                {locked && <span className="text-xs text-stone-600">🔒</span>}
              </button>

              {/* 展开的详情 */}
              {isSelected && selectedFloor && (
                <div className="mt-1 rounded-lg border border-stone-700/40 bg-stone-800/30 p-3 space-y-2">
                  <div className="text-xs text-stone-400">
                    敌人规模预估：<span className="text-stone-300">{estimateDungeonPower(selectedFloor.wave).min} ~ {estimateDungeonPower(selectedFloor.wave).max}</span>
                  </div>
                  <div className="text-xs text-stone-400">
                    荣耀奖励：<span className="text-amber-300">🏅 {selectedFloor.honor}{state.skills?.has('mi_honor') ? ' +1（军功授爵）' : ''}{state.skills?.has('co_war_economy') ? ' +1（战争经济）' : ''}</span>
                  </div>
                  <div className="text-xs text-stone-500 leading-relaxed">
                    {selectedFloor.floor <= 3
                      ? '🟢 无特殊效果，纯粹战斗'
                      : selectedFloor.floor <= 7
                        ? '🟡 随机 1 个增益或减益'
                        : '🔴 随机 1 个增益 + 1 个减益'}
                  </div>
                  <div className="text-xs text-stone-500 leading-relaxed">
                    ⚠️ 城墙和箭塔不生效，仅部队和科技有效。
                  </div>
                  <button
                    onClick={() => { onEnter(selectedFloor.floor); setSelected(null) }}
                    disabled={!available}
                    className={cn(
                      'w-full rounded-lg py-2 text-sm font-bold transition',
                      available
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98]'
                        : 'bg-stone-800 text-stone-500 cursor-not-allowed',
                    )}
                  >
                    {dailyAttempted ? '今日已挑战' : totalSoldiers <= 0 ? '无可用部队' : locked ? '未解锁' : `⚔️ 挑战第${selectedFloor.floor}层`}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
