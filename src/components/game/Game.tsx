import { useCallback, useEffect, useState } from 'react'
import {
  applyEventChoice, assign, build, buyUpgrade, chooseNation, closeBattleReport, createGame, endTurn,
  exchangeForHonor, recruit, recruitMax, train, unlockSkill, waveChanceTomorrow,
  type GameState,
} from '@/game/engine'
import { CONFIG, NATIONS, type BuildingId, type NationId, type ResourceId, type UnitId, type UpgradeId } from '@/game/config'
import { autoSave, deleteSave, getAllSaveMetadata, loadGame, saveGame, type SaveMetadata } from '@/game/save'
import { isTutorialCompleted, markTutorialCompleted, TUTORIAL_STEPS } from '@/game/tutorial'
import StartScreen from './StartScreen'
import Header from './Header'
import HelpModal from './HelpModal'
import AssignmentPanel from './AssignmentPanel'
import VillageView from './VillageView'
import BuildPanel from './BuildPanel'
import ArmyPanel from './ArmyPanel'
import LogPanel from './LogPanel'
import BattleModal from './BattleModal'
import EndScreen from './EndScreen'
import SkillTree from './SkillTree'
import EventModal from './EventModal'
import SaveLoadModal from './SaveLoadModal'
import TutorialOverlay from './TutorialOverlay'
import { Panel } from './ui-bits'

export default function Game() {
  const [state, setState] = useState<GameState>(createGame)
  const [saveLoadOpen, setSaveLoadOpen] = useState(false)
  const [saveLoadMode, setSaveLoadMode] = useState<'save' | 'load'>('save')
  const [saveMeta, setSaveMeta] = useState<(SaveMetadata | null)[]>(() => getAllSaveMetadata())
  const [tutorialStep, setTutorialStep] = useState<number | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  // 自动弹出教程（首次进入 playing 阶段）
  const prevPhaseRef = useState(state.phase)
  useEffect(() => {
    if (state.phase === 'playing' && prevPhaseRef[0] === 'start' && !isTutorialCompleted()) {
      setTutorialStep(0)
    }
    prevPhaseRef[0] = state.phase
  }, [state.phase])

  const refreshMeta = useCallback(() => setSaveMeta(getAllSaveMetadata()), [])

  const onStart = useCallback((nation: NationId) => setState(chooseNation(createGame(), nation)), [])
  const onRestart = useCallback(() => setState(createGame()), [])
  const onAssign = useCallback((res: ResourceId, delta: number) => setState((s) => assign(s, res, delta)), [])
  const onBuild = useCallback((id: BuildingId) => setState((s) => build(s, id)), [])
  const onTrain = useCallback((id: UnitId) => setState((s) => train(s, id)), [])
  const onRecruit = useCallback(() => setState((s) => recruit(s)), [])
  const onRecruitMax = useCallback(() => setState((s) => recruitMax(s)), [])
  const onEndTurn = useCallback(() => setState((s) => { const next = endTurn(s); autoSave(next); return next }), [])
  const onCloseBattle = useCallback(() => setState((s) => closeBattleReport(s)), [])
  const onUnlock = useCallback((id: string) => setState((s) => unlockSkill(s, id)), [])
  const onBuyUpgrade = useCallback((id: UpgradeId) => setState((s) => buyUpgrade(s, id)), [])
  const onExchange = useCallback((res: ResourceId) => setState((s) => exchangeForHonor(s, res)), [])
  const onChooseEvent = useCallback((choiceId: string) => setState((s) => applyEventChoice(s, choiceId)), [])

  const onSave = useCallback((slot: number) => { setState((s) => { saveGame(s, slot); return s }); refreshMeta() }, [refreshMeta])
  const onLoad = useCallback((slot: number) => { const loaded = loadGame(slot); if (loaded) setState(loaded) }, [])
  const onDelete = useCallback((slot: number) => { deleteSave(slot); refreshMeta() }, [refreshMeta])
  const onOpenSaveLoad = useCallback((mode: 'save' | 'load') => { refreshMeta(); setSaveLoadMode(mode); setSaveLoadOpen(true) }, [refreshMeta])

  const onTutorial = useCallback(() => setTutorialStep(0), [])
  const onHelp = useCallback(() => setShowHelp(true), [])
  const tutorialNext = useCallback(() => {
    setTutorialStep((s) => {
      if (s === null || s >= TUTORIAL_STEPS.length - 1) { markTutorialCompleted(); return null }
      return s + 1
    })
  }, [])
  const tutorialPrev = useCallback(() => { setTutorialStep((s) => (s !== null && s > 0 ? s - 1 : s)) }, [])
  const tutorialSkip = useCallback(() => { markTutorialCompleted(); setTutorialStep(null) }, [])

  if (state.phase === 'start') return <StartScreen onStart={onStart} onLoad={onLoad} />
  if (state.phase === 'victory' || state.phase === 'defeat') return <EndScreen state={state} onRestart={onRestart} onLoad={onLoad} />

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-stone-100">
      <Header state={state} onOpenSaveLoad={onOpenSaveLoad} onTutorial={onTutorial} onHelp={onHelp} />

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
            data-tutorial="end-turn"
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-4 text-lg font-black tracking-[0.4em] text-stone-950 shadow-lg transition hover:from-amber-500 hover:to-amber-400 hover:shadow-amber-500/25 active:scale-[0.99]"
          >
            {state.day >= CONFIG.totalDays ? '⚔️ 迎接终局决战' : '结束回合 ⏭'}
            <span className="block text-[11px] font-medium tracking-normal text-stone-800/80">
              {state.day >= CONFIG.totalDays
                ? '终局 Boss 即将来袭，做好最后的准备！'
                : `结算采集与消耗，进入第 ${state.day + 1} 天${waveChanceTomorrow(state) > 0 ? `（敌军来袭概率 ${Math.round(waveChanceTomorrow(state) * 100)}%）` : ''}`}
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
            data-tutorial="skill-tree"
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

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <SaveLoadModal
        open={saveLoadOpen}
        mode={saveLoadMode}
        metadata={saveMeta}
        onClose={() => setSaveLoadOpen(false)}
        onSave={onSave}
        onLoad={onLoad}
        onDelete={onDelete}
      />
      {tutorialStep !== null && state.phase === 'playing' && !state.pendingEvent && state.phase !== 'battle' && (
        <TutorialOverlay
          step={tutorialStep}
          onNext={tutorialNext}
          onPrev={tutorialPrev}
          onSkip={tutorialSkip}
        />
      )}
    </div>
  )
}
