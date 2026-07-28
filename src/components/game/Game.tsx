import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyEventChoice, assign, build, buyUpgrade, chooseNation, closeBattleReport, closeDungeonResult, createGame, endTurn,
  enterDungeon, exchangeForHonor, recruit, recruitMax, train, unlockSkill, waveChanceTomorrow,
  type GameState,
} from '@/game/engine'
import { CONFIG, NATIONS, type BuildingId, type NationId, type ResourceId, type UnitId, type UpgradeId } from '@/game/config'
import { autoSave, deleteSave, getAllSaveMetadata, loadGame, saveGame, type SaveMetadata } from '@/game/save'
import { loadMeta, saveMeta as saveMetaProgress, settleRun, type SettleResult } from '@/game/meta'
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
import DungeonPanel from './DungeonPanel'
import DungeonResultModal from './DungeonResultModal'
import EndScreen from './EndScreen'
import SkillTree from './SkillTree'
import EventModal from './EventModal'
import SaveLoadModal from './SaveLoadModal'
import TutorialOverlay from './TutorialOverlay'
import { Panel } from './ui-bits'
import { cn } from '@/lib/utils'

type MobileTab = 'village' | 'people' | 'army' | 'build' | 'skill'

const MOBILE_TABS: { id: MobileTab; icon: string; label: string }[] = [
  { id: 'village', icon: '🏘️', label: '村庄' },
  { id: 'people', icon: '👥', label: '村民' },
  { id: 'army', icon: '🎖️', label: '军队' },
  { id: 'build', icon: '🔨', label: '建造' },
  { id: 'skill', icon: '✨', label: '技能' },
]

/** 结束回合按钮（桌面/移动共用） */
function EndTurnButton({ state, onEndTurn, className }: { state: GameState; onEndTurn: () => void; className?: string }) {
  return (
    <button
      onClick={onEndTurn}
      data-tutorial="end-turn"
      className={cn(
        'group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-4 text-lg font-black tracking-[0.4em] text-stone-950 shadow-lg transition hover:from-amber-500 hover:to-amber-400 hover:shadow-amber-500/25 active:scale-[0.99]',
        className,
      )}
    >
      {state.day >= CONFIG.totalDays ? '⚔️ 迎接终局决战' : '结束回合 ⏭'}
      <span className="block text-[11px] font-medium tracking-normal text-stone-800/80">
        {state.day >= CONFIG.totalDays
          ? '终局 Boss 即将来袭，做好最后的准备！'
          : `结算采集与消耗，进入第 ${state.day + 1} 天${waveChanceTomorrow(state) > 0 ? `（敌军来袭概率 ${Math.round(waveChanceTomorrow(state) * 100)}%）` : ''}`}
      </span>
    </button>
  )
}

export default function Game() {
  const [state, setState] = useState<GameState>(createGame)
  const [saveLoadOpen, setSaveLoadOpen] = useState(false)
  const [saveLoadMode, setSaveLoadMode] = useState<'save' | 'load'>('save')
  const [saveMeta, setSaveMeta] = useState<(SaveMetadata | null)[]>(() => getAllSaveMetadata())
  const [tutorialStep, setTutorialStep] = useState<number | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [settleInfo, setSettleInfo] = useState<SettleResult | null>(null)
  const settledForRef = useRef<GameState | null>(null)

  // 局结束结算：传承点 + 生涯记录（每局只结算一次，ref 防 StrictMode 双写）
  useEffect(() => {
    if (state.phase !== 'victory' && state.phase !== 'defeat') return
    if (settledForRef.current === state) return
    settledForRef.current = state
    const result = settleRun(state, loadMeta())
    saveMetaProgress(result.meta)
    setSettleInfo(result)
  }, [state])

  // 自动弹出教程（首次进入 playing 阶段）
  const prevPhaseRef = useState(state.phase)
  useEffect(() => {
    if (state.phase === 'playing' && prevPhaseRef[0] === 'start' && !isTutorialCompleted()) {
      setTutorialStep(0)
    }
    prevPhaseRef[0] = state.phase
  }, [state.phase])

  const refreshMeta = useCallback(() => setSaveMeta(getAllSaveMetadata()), [])

  const onStart = useCallback((nation: NationId, talents: string[]) => setState(chooseNation(createGame(talents), nation)), [])
  const onRestart = useCallback(() => { settledForRef.current = null; setSettleInfo(null); setState(createGame()) }, [])
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
  const onEnterDungeon = useCallback((floor: number) => setState((s) => enterDungeon(s, floor)), [])
  const onCloseDungeonResult = useCallback(() => setState((s) => closeDungeonResult(s)), [])

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

  const [mobileTab, setMobileTab] = useState<MobileTab>('village')

  if (state.phase === 'start') return <StartScreen onStart={onStart} onLoad={onLoad} />
  if (state.phase === 'victory' || state.phase === 'defeat') return <EndScreen state={state} settleInfo={settleInfo} onRestart={onRestart} onLoad={onLoad} />

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-stone-100">
      <Header state={state} onOpenSaveLoad={onOpenSaveLoad} onTutorial={onTutorial} onHelp={onHelp} />

      {/* ============ 桌面端：三栏布局（lg 起） ============ */}
      <main className="mx-auto hidden w-full max-w-7xl flex-1 gap-4 p-4 lg:grid lg:grid-cols-[290px_1fr_330px]">
        {/* 左栏：村民 + 军队 */}
        <div className="flex flex-col gap-4">
          <AssignmentPanel state={state} onAssign={onAssign} />
          <ArmyPanel state={state} onTrain={onTrain} />
        </div>

        {/* 中栏：村庄视图 + 结束回合 + 地牢 + 日志 */}
        <div className="flex flex-col gap-4">
          <VillageView state={state} />
          <EndTurnButton state={state} onEndTurn={onEndTurn} />
          <DungeonPanel state={state} onEnter={onEnterDungeon} />
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

      {/* ============ 移动端：底部 Tab 导航（lg 以下） ============ */}
      <main className="mx-auto w-full max-w-xl flex-1 px-3 pb-40 pt-3 lg:hidden">
        {mobileTab === 'village' && (
          <div className="flex flex-col gap-3">
            <VillageView state={state} />
            <DungeonPanel state={state} onEnter={onEnterDungeon} />
            <LogPanel state={state} />
          </div>
        )}
        {mobileTab === 'people' && <AssignmentPanel state={state} onAssign={onAssign} />}
        {mobileTab === 'army' && <ArmyPanel state={state} onTrain={onTrain} />}
        {mobileTab === 'build' && (
          <BuildPanel state={state} onBuild={onBuild} onRecruit={onRecruit} onRecruitMax={onRecruitMax} />
        )}
        {mobileTab === 'skill' && (
          <Panel
            title={`技能树 · ${state.nation ? NATIONS[state.nation].name : ''}`}
            icon="✨"
            data-tutorial="skill-tree"
            extra={<span className="text-xs text-stone-400">荣耀 <b className="text-amber-300">🏅{state.honor}</b></span>}
          >
            <SkillTree state={state} onUnlock={onUnlock} onBuyUpgrade={onBuyUpgrade} onExchange={onExchange} />
          </Panel>
        )}
      </main>

      {/* 移动端固定底栏：常驻结束回合 + Tab 导航 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-700/60 bg-stone-950/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-md lg:hidden">
        <EndTurnButton state={state} onEndTurn={onEndTurn} className="py-3 text-base" />
        <nav className="mt-2 flex items-stretch justify-between gap-1 pb-1">
          {MOBILE_TABS.map((tab) => {
            const active = mobileTab === tab.id
            const idleBadge = tab.id === 'people' ? state.villagers - state.assignment.food - state.assignment.wood - state.assignment.gold : 0
            return (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id)}
                className={cn(
                  'relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition',
                  active ? 'bg-amber-900/40 text-amber-200' : 'text-stone-400 hover:bg-stone-800/60 hover:text-stone-200',
                )}
              >
                <span className="text-lg leading-none">{tab.icon}</span>
                <span className="text-[10px] font-bold">{tab.label}</span>
                {idleBadge > 0 && (
                  <span className="absolute right-1.5 top-0.5 rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white">
                    {idleBadge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {state.phase === 'battle' && state.battle && (
        <BattleModal report={state.battle} onClose={onCloseBattle} />
      )}
      {state.phase === 'dungeon_result' && state.dungeon?.pendingResult && (
        <DungeonResultModal result={state.dungeon.pendingResult} onClose={onCloseDungeonResult} />
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
      {tutorialStep !== null && state.phase === 'playing' && !state.pendingEvent && (
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
