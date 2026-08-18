import { BUILDINGS, type BuildingId } from '@/game/config'
import type { GameState } from '@/game/engine'
import { MobileTooltip } from './ui-bits'

/** 村庄全景：把建筑与军队可视化 */
export default function VillageView({ state }: { state: GameState }) {
  const b = state.buildings
  const icons: string[] = []
  // 城墙在两侧
  const wall = '🧱'.repeat(Math.min(b.wall, 5))
  for (let i = 0; i < Math.min(b.house, 6); i++) icons.push(BUILDINGS.house.icon)
  for (let i = 0; i < Math.min(b.farm, 4); i++) icons.push(BUILDINGS.farm.icon)
  for (let i = 0; i < Math.min(b.lumber, 3); i++) icons.push(BUILDINGS.lumber.icon)
  for (let i = 0; i < Math.min(b.mine, 3); i++) icons.push(BUILDINGS.mine.icon)
  for (let i = 0; i < b.barracks; i++) icons.push(BUILDINGS.barracks.icon)
  const towers = '🗼'.repeat(Math.min(b.tower, 5))

  const army: string[] = []
  for (let i = 0; i < Math.min(state.soldiers.warlord, 1); i++) army.push('🦾')
  for (let i = 0; i < Math.min(state.soldiers.knight, 10); i++) army.push('🐎')
  for (let i = 0; i < Math.min(state.soldiers.archer, 10); i++) army.push('🏹')
  for (let i = 0; i < Math.min(state.soldiers.militia, 10); i++) army.push('⚔️')
  const villagers: string[] = Array.from({ length: Math.min(state.villagers, 12) }, () => '🧑‍🌾')

  const buildingIds: BuildingId[] = ['farm', 'lumber', 'mine', 'house', 'barracks', 'wall', 'tower']

  return (
    <section className="overflow-hidden rounded-xl border border-stone-700/60 bg-gradient-to-b from-stone-900/80 to-emerald-950/30 shadow-lg">
      {/* 天际线 */}
      <div className="relative border-b border-stone-700/40 px-4 pb-2 pt-4">
        <div className="pointer-events-none absolute right-4 top-2 text-3xl opacity-70 select-none">🌙</div>
        <div className="flex min-h-14 flex-wrap items-end gap-1 text-3xl select-none">
          {wall && <span className="opacity-80">{wall}</span>}
          {icons.length > 0 ? icons.map((ic, i) => <span key={i}>{ic}</span>) : <span className="text-2xl">⛺</span>}
          {towers && <span>{towers}</span>}
          {wall && <span className="opacity-80">{wall}</span>}
        </div>
        {/* 军队列队 */}
        <div className="mt-2 flex min-h-8 flex-wrap items-center gap-0.5 text-2xl select-none">
          {army.map((ic, i) => (
            <span key={`a${i}`} className="drop-shadow">{ic}</span>
          ))}
          {army.length > 0 && villagers.length > 0 && <span className="mx-1 text-stone-600">│</span>}
          {villagers.map((ic, i) => (
            <span key={`v${i}`} className="opacity-80">{ic}</span>
          ))}
          {army.length === 0 && villagers.length === 0 && <span className="text-sm text-stone-500">空无一人的营地……</span>}
        </div>
      </div>
      {/* 建筑列表 */}
      <div className="grid grid-cols-4 gap-1.5 p-3 sm:grid-cols-7">
        {buildingIds.map((id) => {
          const def = BUILDINGS[id]
          const lv = b[id]
          return (
            <MobileTooltip key={id} content={def.desc}>
              <div
                className={`rounded-lg px-1.5 py-1.5 text-center ${lv > 0 ? 'bg-stone-800/70' : 'bg-stone-950/40 opacity-45'}`}
              >
                <div className="text-lg leading-none">{def.icon}</div>
                <div className="mt-1 text-[10px] text-stone-400">{def.name}</div>
                <div className={`text-[11px] font-bold ${lv > 0 ? 'text-amber-300' : 'text-stone-600'}`}>
                  {id === 'barracks' ? (lv > 0 ? `Lv${lv}` : '—') : lv > 0 ? `×${lv}` : '—'}
                </div>
              </div>
            </MobileTooltip>
          )
        })}
      </div>
    </section>
  )
}
