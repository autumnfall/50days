import { Castle, Hammer, Hourglass, Medal, Sparkles, Swords, Users } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  activateHeroSkill, applyEventChoice, assign, build, buyUpgrade, chooseNation, closeBattleReport, closeDungeonResult, createGame, endTurn,
  enterDungeon, exchangeForHonor, learnHeroActive, learnHeroPassive, recruit, recruitMax, train, unlockSkill, upgradeHero, waveChanceTomorrow,
  type GameMode, type GameState,
} from '@/game/engine'
import { CONFIG, NATIONS, type BuildingId, type NationId, type ResourceId, type UnitId, type UpgradeId } from '@/game/config'
import { clearRecovery, readRecovery, deleteSave, getAllSaveMetadata, loadGame, saveGame, type SaveMetadata } from '@/game/save'
import { settleGameOnce, type SettleResult } from '@/game/meta'
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
import RelicPanel from './RelicPanel'
import HeroPanel from './HeroPanel'
import EventModal from './EventModal'
import SaveLoadModal from './SaveLoadModal'
import TutorialOverlay from './TutorialOverlay'
import { Panel } from './ui-bits'
import { cn } from '@/lib/utils'

type MobileTab = 'village' | 'people' | 'army' | 'build' | 'skill'

const MOBILE_TABS: { id: MobileTab; icon: typeof Castle; label: string }[] = [
  { id: 'village', icon: Castle, label: '村庄' },
  { id: 'people', icon: Users, label: '村民' },
  { id: 'army', icon: Swords, label: '军队' },
  { id: 'build', icon: Hammer, label: '建造' },
  { id: 'skill', icon: Sparkles, label: '技能' },
]

/** 教程步骤 → 移动端需要切换到的 Tab（面板只在对应 Tab 激活时渲染） */
const TUTORIAL_STEP_TAB: Partial<Record<string, MobileTab>> = {
  assignment: 'people',
  army: 'army',
  build: 'build',
  'skill-tree': 'skill',
}

/** 结束回合按钮（桌面/移动共用） */
function EndTurnButton({ state, onEndTurn, className }: { state: GameState; onEndTurn: () => void; className?: string }) {
  return (
    <button
      onClick={onEndTurn}
      data-tutorial="end-turn"
      className={cn(
        'game-primary turn-action w-full px-3 py-3',
        className,
      )}
    >
      <span className="flex items-center justify-center gap-2 text-base font-bold tracking-wide">
        <Hourglass size={17} aria-hidden="true" />
        {state.mode === 'classic' && state.day >= CONFIG.totalDays - 1 ? '迎接终局决战' : '结束回合'}
      </span>
      <span className="mt-1 block text-xs font-medium">
        {state.mode === 'rogue'
          ? `无尽远征 · 进入第 ${state.day + 1} 天${(state.day + 1) % CONFIG.rogue.blessingInterval === 0 ? '（🎁 远征祝福）' : ''}${(state.day + 1) % CONFIG.rogue.bossInterval === 0 ? '（💀 黑暗领主必来！）' : waveChanceTomorrow(state) > 0 ? `（敌军来袭概率 ${Math.round(waveChanceTomorrow(state) * 100)}%）` : ''}`
          : state.day >= CONFIG.totalDays - 1
            ? '终局 Boss 即将来袭，做好最后的准备！'
            : `结算采集与消耗，进入第 ${state.day + 1} 天${waveChanceTomorrow(state) > 0 ? `（敌军来袭概率 ${Math.round(waveChanceTomorrow(state) * 100)}%）` : ''}`}
      </span>
    </button>
  )
}

const desktopQuery = '(min-width: 1024px)'
function subscribeToDesktop(onChange: () => void) {
  const query = window.matchMedia(desktopQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const isDesktop = () => window.matchMedia(desktopQuery).matches

export default function Game() {
  const [state, setState] = useState<GameState>(() => readRecovery() ?? createGame())
  const [saveLoadOpen, setSaveLoadOpen] = useState(false)
  const [saveLoadMode, setSaveLoadMode] = useState<'save' | 'load'>('save')
  const [saveMeta, setSaveMeta] = useState<(SaveMetadata | null)[]>(() => getAllSaveMetadata())
  const [tutorialStep, setTutorialStep] = useState<number | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('village')
  const [settleInfo, setSettleInfo] = useState<SettleResult | null>(null)
  const settledState = useRef<GameState | null>(null)
  const desktop = useSyncExternalStore(subscribeToDesktop, isDesktop)
  const [storageNotice, setStorageNotice] = useState<string | null>(null)
  const refreshMeta = useCallback(() => setSaveMeta(getAllSaveMetadata()), [])

  const screen = state.phase === 'start' ? 'start'
    : state.phase === 'victory' || (state.phase === 'defeat' && !state.battle) ? 'end' : 'campaign'
  const activeTab = desktop ? null : mobileTab

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [screen, state.gameId, activeTab])

  useEffect(clearRecovery, [])

  useEffect(() => {
    if (state.phase !== 'victory' && state.phase !== 'defeat') return
    if (state.battle || settledState.current === state) return
    const result = settleGameOnce(state)
    if (!result) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageNotice('传承进度保存失败。可在存储恢复后读取自动存档重新结算。')
      return
    }
    settledState.current = state
    setSettleInfo(result)
    const auto = loadGame(0)
    if (auto.ok && auto.state.gameId === state.gameId) deleteSave(0)
    refreshMeta()
  }, [state, refreshMeta])

  /** 切换教程步骤，并联动移动端 Tab 确保目标面板已渲染（与步骤状态同批次更新） */
  const gotoTutorialStep = useCallback((n: number | null) => {
    setTutorialStep(n)
    if (n !== null) {
      const tab = TUTORIAL_STEP_TAB[TUTORIAL_STEPS[n].id]
      if (tab) setMobileTab(tab)
    }
  }, [])

  const onStart = useCallback((nation: NationId, talents: string[], mode: GameMode, seed?: number, heroId?: string) => {
    setStorageNotice(null)
    setMobileTab('village')
    setState(chooseNation(createGame(talents, { mode, seed, hero: heroId }), nation))
    if (!isTutorialCompleted()) setTutorialStep(0)
  }, [])
  const onRestart = useCallback(() => {
    setSettleInfo(null)
    setStorageNotice(null)
    setState(createGame())
  }, [])
  const onRetrySeed = useCallback(() => {
    if (!state.run || !state.nation) return
    setSettleInfo(null)
    setStorageNotice(null)
    setMobileTab('village')
    setState(chooseNation(createGame(state.talents, { mode: 'rogue', seed: state.run.seed, hero: state.hero?.id }), state.nation))
  }, [state])
  const onAssign = useCallback((res: ResourceId, delta: number) => setState((s) => assign(s, res, delta)), [])
  const onBuild = useCallback((id: BuildingId) => setState((s) => build(s, id)), [])
  const onTrain = useCallback((id: UnitId) => setState((s) => train(s, id)), [])
  const onRecruit = useCallback(() => setState((s) => recruit(s)), [])
  const onRecruitMax = useCallback(() => setState((s) => recruitMax(s)), [])
  const onEndTurn = useCallback(() => {
    if (state.pendingEvent) return
    const next = endTurn(state)
    if (next === state) return
    setState(next)
    setStorageNotice(saveGame(next, 0) ? null : '自动存档失败，请检查浏览器存储空间。')
  }, [state])
  const onCloseBattle = useCallback(() => setState((s) => closeBattleReport(s)), [])
  const onUnlock = useCallback((id: string) => setState((s) => unlockSkill(s, id)), [])
  const onBuyUpgrade = useCallback((id: UpgradeId) => setState((s) => buyUpgrade(s, id)), [])
  const onExchange = useCallback((res: ResourceId) => setState((s) => exchangeForHonor(s, res)), [])
  const onChooseEvent = useCallback((choiceId: string) => setState((s) => applyEventChoice(s, choiceId)), [])
  const onEnterDungeon = useCallback((floor: number) => setState((s) => enterDungeon(s, floor)), [])
  const onCloseDungeonResult = useCallback(() => setState((s) => closeDungeonResult(s)), [])
  const onUpgradeHero = useCallback(() => setState((s) => upgradeHero(s)), [])
  const onLearnPassive = useCallback((index: number) => setState((s) => learnHeroPassive(s, index)), [])
  const onLearnActive = useCallback(() => setState((s) => learnHeroActive(s)), [])
  const onActivateHeroSkill = useCallback(() => setState((s) => activateHeroSkill(s)), [])

  const onSave = useCallback((slot: number) => {
    const saved = saveGame(state, slot)
    setStorageNotice(saved ? null : '保存失败，请检查浏览器存储空间。')
    if (saved) refreshMeta()
    return saved
  }, [state, refreshMeta])
  const onLoad = useCallback((slot: number) => {
    const loaded = loadGame(slot)
    if (!loaded.ok) {
      setStorageNotice(loaded.reason === 'invalid' ? '存档已损坏或版本不兼容。'
        : loaded.reason === 'unavailable' ? '浏览器存储不可用。' : '该槽位没有存档。')
      return false
    }
    setStorageNotice(null)
    setSettleInfo(null)
    setMobileTab('village')
    setTutorialStep(null)
    setState(loaded.state)
    return true
  }, [])
  const onDelete = useCallback((slot: number) => {
    setStorageNotice(deleteSave(slot) ? null : '删除存档失败。')
    refreshMeta()
  }, [refreshMeta])
  const onOpenSaveLoad = useCallback((mode: 'save' | 'load') => { refreshMeta(); setSaveLoadMode(mode); setSaveLoadOpen(true) }, [refreshMeta])

  const onTutorial = useCallback(() => gotoTutorialStep(0), [gotoTutorialStep])
  const onHelp = useCallback(() => setShowHelp(true), [])
  const tutorialNext = useCallback(() => {
    const done = tutorialStep === null || tutorialStep >= TUTORIAL_STEPS.length - 1
    if (done) { markTutorialCompleted(); gotoTutorialStep(null) } else { gotoTutorialStep(tutorialStep + 1) }
  }, [tutorialStep, gotoTutorialStep])
  const tutorialPrev = useCallback(() => {
    if (tutorialStep !== null && tutorialStep > 0) gotoTutorialStep(tutorialStep - 1)
  }, [tutorialStep, gotoTutorialStep])
  const tutorialSkip = useCallback(() => { markTutorialCompleted(); gotoTutorialStep(null) }, [gotoTutorialStep])

  const openLoad = () => onOpenSaveLoad('load')

  return <>
    {saveLoadOpen && (
      <SaveLoadModal
        open
        mode={saveLoadMode}
        metadata={saveMeta}
        onClose={() => setSaveLoadOpen(false)}
        onSave={onSave}
        onLoad={onLoad}
        onDelete={onDelete}
      />
    )}
    {storageNotice && (
      <div role="alert" className="fixed inset-x-3 top-3 z-[90] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-lg border border-red-700 bg-stone-900 p-3 text-sm text-red-200 shadow-lg">
        {storageNotice}
        <button onClick={() => setStorageNotice(null)} aria-label="关闭提示">✕</button>
      </div>
    )}
    {screen === 'start' ? <StartScreen onStart={onStart} onLoad={openLoad} />
      : screen === 'end'
        ? <EndScreen state={state} settleInfo={settleInfo} onRestart={onRestart} onRetrySeed={onRetrySeed} onLoad={saveMeta.some(Boolean) ? openLoad : undefined} />
        : (
    <div className="game-shell flex min-h-dvh flex-col">
      <Header state={state} onOpenSaveLoad={onOpenSaveLoad} onTutorial={onTutorial} onHelp={onHelp} />

      {/* ============ 桌面端：三栏布局（lg 起） ============ */}
      {desktop ? <main className="mx-auto hidden w-full max-w-7xl flex-1 gap-3 p-4 lg:grid lg:grid-cols-[minmax(252px,1fr)_minmax(0,1.9fr)_minmax(260px,1.1fr)] xl:gap-4">
        {/* 左栏：村民 + 军队 */}
        <div className="flex min-w-0 flex-col gap-3 xl:gap-4">
          <AssignmentPanel state={state} onAssign={onAssign} />
          <ArmyPanel state={state} onTrain={onTrain} />
        </div>

        {/* 中栏：村庄视图 + 结束回合 + 地牢 + 日志 */}
        <div className="flex min-w-0 flex-col gap-3 xl:gap-4">
          <VillageView state={state} />
          <EndTurnButton state={state} onEndTurn={onEndTurn} />
          <DungeonPanel state={state} onEnter={onEnterDungeon} />
          <LogPanel state={state} />
        </div>

        {/* 右栏：建造 + 技能树 */}
        <div className="flex min-w-0 flex-col gap-3 xl:gap-4">
          <BuildPanel state={state} onBuild={onBuild} onRecruit={onRecruit} onRecruitMax={onRecruitMax} />
          <Panel
            title={`技能树 · ${state.nation ? NATIONS[state.nation].name : ''}`}
            icon={Sparkles}
            data-tutorial="skill-tree"
            extra={<span className="inline-flex items-center gap-1 text-xs text-stone-400"><Medal className="text-amber-300" size={14} aria-hidden="true" />荣耀 <b className="text-amber-300">{state.honor}</b></span>}
          >
            <SkillTree state={state} onUnlock={onUnlock} onBuyUpgrade={onBuyUpgrade} onExchange={onExchange} />
          </Panel>
          {state.hero && (
            <HeroPanel state={state} onUpgrade={onUpgradeHero} onLearnPassive={onLearnPassive} onLearnActive={onLearnActive} onActivateSkill={onActivateHeroSkill} />
          )}
          {state.mode === 'rogue' && <RelicPanel state={state} />}
        </div>
      </main>

      : <main className="mx-auto w-full max-w-xl flex-1 px-3 pb-40 pt-3 lg:hidden">
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
          <>
            <Panel
              title={`技能树 · ${state.nation ? NATIONS[state.nation].name : ''}`}
              icon={Sparkles}
              data-tutorial="skill-tree"
              extra={<span className="inline-flex items-center gap-1 text-xs text-stone-400"><Medal className="text-amber-300" size={14} aria-hidden="true" />荣耀 <b className="text-amber-300">{state.honor}</b></span>}
            >
              <SkillTree state={state} onUnlock={onUnlock} onBuyUpgrade={onBuyUpgrade} onExchange={onExchange} />
            </Panel>
            {state.hero && (
              <HeroPanel state={state} onUpgrade={onUpgradeHero} onLearnPassive={onLearnPassive} onLearnActive={onLearnActive} onActivateSkill={onActivateHeroSkill} />
            )}
            <RelicPanel state={state} />
          </>
        )}
      </main>}

      {/* 移动端固定底栏：常驻结束回合 + Tab 导航（不用 backdrop-blur：常驻大区域模糊会触发 Chromium 合成层重绘故障，导致内容偶发不显示） */}
      {!desktop && <div className="war-room-dock fixed inset-x-0 bottom-0 z-30 px-3 pb-[env(safe-area-inset-bottom)] pt-2 lg:hidden">
        <EndTurnButton state={state} onEndTurn={onEndTurn} className="py-2.5" />
        <nav className="mt-2 flex items-stretch justify-between gap-1 pb-1">
          {MOBILE_TABS.map((tab) => {
            const active = mobileTab === tab.id
            const TabIcon = tab.icon
            const idleBadge = tab.id === 'people' ? state.villagers - state.assignment.food - state.assignment.wood - state.assignment.gold : 0
            return (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id)}
                aria-pressed={active}
                aria-label={tab.label}
                className={cn(
                  'war-room-tab relative flex flex-1 flex-col items-center gap-1 rounded-md py-1.5 transition',
                  active ? 'bg-amber-400/10 text-amber-200' : 'text-stone-400 hover:bg-stone-800/60 hover:text-stone-200',
                )}
              >
                <TabIcon size={19} aria-hidden="true" />
                <span className="text-xs font-bold">{tab.label}</span>
                {idleBadge > 0 && (
                  <span className="absolute right-1.5 top-0.5 rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white">
                    {idleBadge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>}

      {(state.phase === 'battle' || state.phase === 'defeat') && state.battle && (
        <BattleModal report={state.battle} onClose={onCloseBattle} key={`battle-${state.day}`} closeLabel={state.phase === 'defeat' ? '查看结局' : undefined} />
      )}
      {state.phase === 'dungeon_result' && state.dungeon?.pendingResult && (
        <DungeonResultModal result={state.dungeon.pendingResult} onClose={onCloseDungeonResult} />
      )}
      {state.phase === 'playing' && state.pendingEvent && (
        <EventModal state={state} event={state.pendingEvent.event} onChoose={onChooseEvent} />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {tutorialStep !== null && state.phase === 'playing' && !state.pendingEvent && (
        <TutorialOverlay
          step={tutorialStep}
          onNext={tutorialNext}
          onPrev={tutorialPrev}
          onSkip={tutorialSkip}
        />
      )}
    </div>
    )}
  </>
}
