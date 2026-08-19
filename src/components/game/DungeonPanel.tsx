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
  const inEndless = highestCleared >= DUNGEON_FLOORS.length
  const endlessFloor = inEndless
    ? { floor: nextFloor, name: '无尽深渊', icon: '♾️', wave: nextFloor + 5, honor: 3 }
    : null

  const selectedFloor = selected !== null
    ? (DUNGEON_FLOORS[selected - 1] ?? endlessFloor)
    : null

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
          const available = f.floor === nextFloor && !dailyAttempted && totalSoldiers > 0
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
                <DungeonFloorDetail
                  floor={selectedFloor}
                  state={state}
                  available={available}
                  dailyAttempted={dailyAttempted}
                  totalSoldiers={totalSoldiers}
                  onEnter={() => { onEnter(selectedFloor.floor); setSelected(null) }}
                />
              )}
            </div>
          )
        })}

        {/* 无尽地牢入口 */}
        {endlessFloor && (
          <div key={endlessFloor.floor}>
            <button
              onClick={() => setSelected(selected === endlessFloor.floor ? null : endlessFloor.floor)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                'bg-purple-950/30 border border-purple-800/40 hover:bg-purple-900/30',
                selected === endlessFloor.floor && 'ring-1 ring-purple-500/50',
              )}
            >
              <span className="text-lg">{endlessFloor.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-purple-200">{endlessFloor.floor}F 无尽</span>
                  <span className="text-xs text-stone-400">{endlessFloor.name}</span>
                </div>
                <div className="text-xs text-stone-500">
                  战力 {estimateDungeonPower(endlessFloor.wave).min}~{estimateDungeonPower(endlessFloor.wave).max}
                  {' · '}
                  <span className="text-amber-400">🏅{endlessFloor.honor}</span>
                </div>
              </div>
            </button>
            {selected === endlessFloor.floor && selectedFloor && (
              <DungeonFloorDetail
                floor={selectedFloor}
                state={state}
                available={!dailyAttempted && totalSoldiers > 0}
                dailyAttempted={dailyAttempted}
                totalSoldiers={totalSoldiers}
                onEnter={() => { onEnter(selectedFloor.floor); setSelected(null) }}
                endless
              />
            )}
          </div>
        )}
      </div>
    </Panel>
  )
}

function DungeonFloorDetail({
  floor,
  state,
  available,
  dailyAttempted,
  totalSoldiers,
  onEnter,
  endless = false,
}: {
  floor: { floor: number; name: string; icon: string; wave: number; honor: number }
  state: GameState
  available: boolean
  dailyAttempted: boolean
  totalSoldiers: number
  onEnter: () => void
  endless?: boolean
}) {
  return (
    <div className="mt-1 rounded-lg border border-stone-700/40 bg-stone-800/30 p-3 space-y-2">
      <div className="text-xs text-stone-400">
        敌人规模预估：<span className="text-stone-300">{estimateDungeonPower(floor.wave).min} ~ {estimateDungeonPower(floor.wave).max}</span>
      </div>
      <div className="text-xs text-stone-400">
        荣耀奖励：<span className="text-amber-300">🏅 {floor.honor}{state.skills?.has('mi_honor') ? ' +1（军功授爵）' : ''}{state.skills?.has('co_war_economy') ? ' +1（战争经济）' : ''}</span>
      </div>
      <div className="text-xs text-stone-500 leading-relaxed">
        {endless
          ? '🔴 无尽难度：敌军强度逐层提升，固定 3 荣耀'
          : floor.floor <= 3
            ? '🟢 无特殊效果，纯粹战斗'
            : floor.floor <= 7
              ? '🟡 随机 1 个增益或减益'
              : '🔴 随机 1 个增益 + 1 个减益'}
      </div>
      <div className="text-xs text-stone-500 leading-relaxed">
        ⚠️ 城墙和箭塔不生效，仅部队和科技有效。
      </div>
      <button
        onClick={onEnter}
        disabled={!available}
        className={cn(
          'w-full rounded-lg py-2 text-sm font-bold transition',
          available
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98]'
            : 'bg-stone-800 text-stone-500 cursor-not-allowed',
        )}
      >
        {endless
          ? `⚔️ 挑战第${floor.floor}层（无尽）`
          : dailyAttempted
            ? '今日已挑战'
            : totalSoldiers <= 0
              ? '无可用部队'
              : `⚔️ 挑战第${floor.floor}层`}
      </button>
    </div>
  )
}
