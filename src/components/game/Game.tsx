import { useCallback, useState } from 'react'
import {
  applyEventChoice, assign, build, buyUpgrade, chooseNation, closeBattleReport, createGame, endTurn,
  exchangeForHonor, recruit, recruitMax, train, unlockSkill, waveChanceTomorrow,
  type GameState,
} from '@/game/engine'
import { NATIONS, type BuildingId, type NationId, type ResourceId, type UnitId, type UpgradeId } from '@/game/config'
import StartScreen from './StartScreen'
import Header from './Header'
import AssignmentPanel from './AssignmentPanel'
import VillageView from './VillageView'
import BuildPanel from './BuildPanel'
import ArmyPanel from './ArmyPanel'
import LogPanel from './LogPanel'
import BattleModal from './BattleModal'
import EndScreen from './EndScreen'
import SkillTree from './SkillTree'
import EventModal from './EventModal'
import { Panel } from './ui-bits'

export default function Game() {
  const [state, setState] = useState<GameState>(createGame)

  const onStart = useCallback((nation: NationId) => setState(chooseNation(createGame(), nation)), [])
  const onRestart = useCallback(() => setState(createGame()), [])
  const onAssign = useCallback((res: ResourceId, delta: number) => setState((s) => assign(s, res, delta)), [])
  const onBuild = useCallback((id: BuildingId) => setState((s) => build(s, id)), [])
  const onTrain = useCallback((id: UnitId) => setState((s) => train(s, id)), [])
  const onRecruit = useCallback(() => setState((s) => recruit(s)), [])
  const onRecruitMax = useCallback(() => setState((s) => recruitMax(s)), [])
  const onEndTurn = useCallback(() => setState((s) => endTurn(s)), [])
  const onCloseBattle = useCallback(() => setState((s) => closeBattleReport(s)), [])
  const onUnlock = useCallback((id: string) => setState((s) => unlockSkill(s, id)), [])
  const onBuyUpgrade = useCallback((id: UpgradeId) => setState((s) => buyUpgrade(s, id)), [])
  const onExchange = useCallback((res: ResourceId) => setState((s) => exchangeForHonor(s, res)), [])
  const onChooseEvent = useCallback((choiceId: string) => setState((s) => applyEventChoice(s, choiceId)), [])

  if (state.phase === 'start') return <StartScreen onStart={onStart} />
  if (state.phase === 'victory' || state.phase === 'defeat') return <EndScreen state={state} onRestart={onRestart} />

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-stone-100">
      <Header state={state} />

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-[290px_1fr_330px]">
        {/* 左栏：村民 + 军队 */}
        <div className="flex flex-col gap-4">
          <AssignmentPanel state={state} onAssign={onAssign} />
          <ArmyPanel state={state} onTrain={onTrain} />
        </div>

        {/* 中栏：村庄视图 + 结束回合 + 日志 */}
        <div className="flex flex-col gap-4">
          <VillageView state={state} />
          <button
            onClick={onEndTurn}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-4 text-lg font-black tracking-[0.4em] text-stone-950 shadow-lg transition hover:from-amber-500 hover:to-amber-400 hover:shadow-amber-500/25 active:scale-[0.99]"
          >
            结束回合 ⏭
            <span className="block text-[11px] font-medium tracking-normal text-stone-800/80">
              结算采集与消耗，进入第 {state.day + 1} 天{waveChanceTomorrow(state) > 0 ? `（敌军来袭概率 ${Math.round(waveChanceTomorrow(state) * 100)}%）` : ''}
            </span>
          </button>
          <LogPanel state={state} />
        </div>

        {/* 右栏：建造 + 技能树 */}
        <div className="flex flex-col gap-4">
          <BuildPanel state={state} onBuild={onBuild} onRecruit={onRecruit} onRecruitMax={onRecruitMax} />
          <Panel
            title={`技能树 · ${state.nation ? NATIONS[state.nation].name : ''}`}
            icon="✨"
            extra={<span className="text-xs text-stone-400">荣耀 <b className="text-amber-300">🏅{state.honor}</b></span>}
          >
            <SkillTree state={state} onUnlock={onUnlock} onBuyUpgrade={onBuyUpgrade} onExchange={onExchange} />
          </Panel>
        </div>
      </main>

      {state.phase === 'battle' && state.battle && (
        <BattleModal report={state.battle} onClose={onCloseBattle} />
      )}
      {state.phase === 'playing' && state.pendingEvent && (
        <EventModal state={state} event={state.pendingEvent.event} onChoose={onChooseEvent} />
      )}
    </div>
  )
}
