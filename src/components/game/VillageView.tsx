import { Shield, Swords, Users } from 'lucide-react'
import { BUILDINGS, NATIONS, type BuildingId } from '@/game/config'
import { armyPower, popCap, population, soldierCount, type GameState } from '@/game/engine'
import { MobileTooltip } from './ui-bits'
import { BUILDING_ICONS } from './icons'

const BUILDING_IDS = Object.keys(BUILDING_ICONS) as BuildingId[]

export default function VillageView({ state }: { state: GameState }) {
  return (
    <section className="village-view game-panel" aria-labelledby="village-title">
      <div className="village-landscape frontier-art">
        <div className="village-landscape-content">
          <div>
            <p className="campaign-kicker">{state.mode === 'rogue' ? '无尽远征' : '经典战役'}</p>
            <h1 id="village-title" className="game-display mt-1 text-3xl font-bold text-amber-100">
              {state.nation ? NATIONS[state.nation].name : '边境村庄'}
            </h1>
          </div>
          <dl className="village-totals">
            <div>
              <dt><Users size={15} aria-hidden="true" /> 人口</dt>
              <dd>{population(state)}<span>/{popCap(state)}</span></dd>
            </div>
            <div>
              <dt><Shield size={15} aria-hidden="true" /> 驻军</dt>
              <dd>{soldierCount(state)}</dd>
            </div>
            <div>
              <dt><Swords size={15} aria-hidden="true" /> 战力</dt>
              <dd>{armyPower(state)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="village-buildings" aria-label="现有建筑">
        {BUILDING_IDS.map((id) => {
          const def = BUILDINGS[id]
          const level = state.buildings[id]
          const BuildingIcon = BUILDING_ICONS[id]
          return (
            <MobileTooltip key={id} content={def.desc} className="min-w-0">
              <div className="village-building" data-built={level > 0}>
                <BuildingIcon size={18} aria-hidden="true" />
                <span>{def.name}</span>
                <b>{level > 0 ? (id === 'barracks' ? `Lv${level}` : `×${level}`) : '—'}</b>
              </div>
            </MobileTooltip>
          )
        })}
      </div>
    </section>
  )
}
