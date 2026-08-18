import { type Page, type Locator, expect } from '@playwright/test'

// ---- Tutorial ----

export async function skipTutorialIfVisible(page: Page) {
  const skip = page.getByText('跳过教程')
  if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skip.click()
    await page.waitForTimeout(300)
  }
}

export async function disableTutorial(page: Page) {
  await page.addInitScript(() => localStorage.setItem('fiftyDays_tutorialCompleted', 'true'))
}

/**
 * 获取当前可见的结束回合按钮。
 * 桌面端和移动端各有一个 EndTurnButton（都带 data-tutorial="end-turn"），
 * 桌面端的那个在移动端视口下被 .hidden 父容器隐藏，需要用不同选择器定位。
 */
export function getEndTurnButton(page: Page): Locator {
  // 移动端的 EndTurnButton 在 .fixed 固定底栏内（lg:hidden 容器）
  // 桌面端的 EndTurnButton 在主内容区（无 .fixed 祖先）
  const isMobile = (page.viewportSize()?.width ?? 1280) < 1024
  if (isMobile) {
    return page.locator('.fixed [data-tutorial="end-turn"]').first()
  }
  return page.locator('[data-tutorial="end-turn"]').first()
}

// ---- Start Screen ----

export type NationId = 'agriculture' | 'military' | 'commerce'

const NATION_NAMES: Record<NationId, string> = {
  agriculture: '丰饶农耕国',
  military: '铁血军事国',
  commerce: '黄金商业联邦',
}

export async function selectNation(page: Page, nation: NationId) {
  await page.getByRole('button', { name: NATION_NAMES[nation] }).click()
}

export type GameMode = 'classic' | 'rogue'

/** 在开始界面选择游戏模式（经典战役 / 无尽远征） */
export async function selectMode(page: Page, mode: GameMode) {
  await page.getByRole('button', { name: mode === 'rogue' ? /无尽远征/ : /经典战役/ }).first().click()
}

export async function clickStart(page: Page) {
  const btn = page.getByRole('button', { name: /以「.*」(开局|踏上无尽远征)/ })
  await expect(btn).toBeEnabled()
  await btn.click()
}

export async function startGame(page: Page, nation: NationId = 'agriculture', mode: GameMode = 'classic') {
  await disableTutorial(page)
  await page.goto('/')
  await expect(page.getByText('五十日坚守')).toBeVisible()
  if (mode === 'rogue') await selectMode(page, 'rogue')
  await selectNation(page, nation)
  await clickStart(page)
  await expect(getEndTurnButton(page)).toBeVisible({ timeout: 10_000 })
}

// ---- End Turn / Battle / Event ----

export async function endTurn(page: Page) {
  await dismissAllModals(page)
  await getEndTurnButton(page).click({ timeout: 5_000 })
}

export async function dismissAllModals(page: Page) {
  for (let attempt = 0; attempt < 15; attempt++) {
    // Check for battle overlay by its unique code-path attribute
    const battleOverlay = page.locator('div[code-path*="BattleModal"]').first()
    const hasBattle = await battleOverlay.isVisible({ timeout: 500 }).catch(() => false)

    if (hasBattle) {
      const btn = page.getByRole('button', { name: '继续坚守' })
      const enabled = await btn.isEnabled({ timeout: 2000 }).catch(() => false)
      if (enabled) {
        await btn.click()
        await page.waitForTimeout(500)
      } else {
        await page.waitForTimeout(500)
      }
      continue
    }

    // Check for event overlay (随机事件 / 远征祝福)
    const eventLabel = page.getByText(/随机事件 · 请抉择|远征祝福 · 三选一/)
    const hasEvent = await eventLabel.isVisible({ timeout: 300 }).catch(() => false)
    if (hasEvent) {
      const btns = page.locator('.fixed').last().locator('button:not([disabled])')
      const count = await btns.count()
      if (count > 0) {
        await btns.first().click()
        await page.waitForTimeout(500)
      }
      continue
    }

    // No modals found, we're clear
    break
  }
}

export async function dismissBattle(page: Page) {
  const btn = page.getByRole('button', { name: '继续坚守' })
  await btn.waitFor({ state: 'visible', timeout: 60_000 })
  await btn.click()
}

export async function dismissEvent(page: Page, choiceIndex = 0) {
  const modal = page.getByText('随机事件')
  if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
    const eventButtons = page.locator('[class*="fixed"] button:not([disabled])')
    const count = await eventButtons.count()
    if (count > choiceIndex) {
      await eventButtons.nth(choiceIndex).click()
    }
  }
}

/**
 * End turn and handle any resulting battle/event modals.
 * Returns true if the game is still in 'playing' phase, false if defeated.
 */
export async function endTurnAndResolve(page: Page): Promise<boolean> {
  await endTurn(page)
  await page.waitForTimeout(1000)

  // Wait for battle animation to finish (button becomes enabled after all rounds shown)
  const battleBtn = page.getByRole('button', { name: '继续坚守' })
  const hasBattle = await battleBtn.isVisible({ timeout: 8000 }).catch(() => false)
  if (hasBattle) {
    await expect(battleBtn).toBeEnabled({ timeout: 60_000 })
    await battleBtn.click()
    await page.waitForTimeout(500)
  }

  // Dismiss any remaining modals (battle or event)
  await dismissAllModals(page)

  // Check if game is over (defeat)
  const defeat = await page.getByText('营地已空无一人').isVisible({ timeout: 500 }).catch(() => false)
    || await page.getByText('血洗了村庄').isVisible({ timeout: 500 }).catch(() => false)
    || await page.getByText('所有族人都死于饥荒').isVisible({ timeout: 500 }).catch(() => false)

  return !defeat
}

// ---- Assignment ----

export async function assignVillagers(page: Page, resource: 'food' | 'wood' | 'gold', delta: number) {
  const panel = page.locator('[data-tutorial="assignment-panel"]').last()
  const rows = panel.locator('.flex.items-center.gap-2.rounded-lg')
  const index = resource === 'food' ? 0 : resource === 'wood' ? 1 : 2
  const row = rows.nth(index)

  if (delta > 0) {
    for (let i = 0; i < Math.abs(delta); i++) {
      await row.locator('button', { hasText: '＋' }).first().click()
    }
  } else {
    for (let i = 0; i < Math.abs(delta); i++) {
      await row.locator('button', { hasText: '−' }).first().click()
    }
  }
}

// ---- Building ----

export async function buildBuilding(page: Page, name: string) {
  const panel = page.locator('[data-tutorial="build-panel"]').last()
  const btn = panel.getByRole('button', { name: new RegExp(name) })
  try {
    await btn.first().click({ timeout: 5_000 })
  } catch {
    await btn.first().click({ force: true, timeout: 3_000 })
  }
}

export async function recruit(page: Page) {
  const panel = page.locator('[data-tutorial="build-panel"]').last()
  const btn = panel.getByRole('button', { name: /招募/ })
  try {
    await btn.first().click({ timeout: 5_000 })
  } catch {
    await btn.first().click({ force: true, timeout: 3_000 })
  }
}

export async function recruitMax(page: Page) {
  const panel = page.locator('[data-tutorial="build-panel"]').last()
  const btn = panel.getByRole('button', { name: /×/ })
  try {
    await btn.first().click({ timeout: 5_000 })
  } catch {
    await btn.first().click({ force: true, timeout: 3_000 })
  }
}

// ---- Army ----

export async function trainUnit(page: Page, name: string) {
  const panel = page.locator('[data-tutorial="army-panel"]').last()
  const btn = panel.getByRole('button', { name: new RegExp(name) })
  try {
    await btn.first().click({ timeout: 5_000 })
  } catch {
    await btn.first().click({ force: true, timeout: 3_000 })
  }
}

// ---- Resource reading ----

export async function getDay(page: Page): Promise<number> {
  const el = page.locator('[data-tutorial="resources"]').locator('..').locator('..')
  const text = await el.textContent({ timeout: 3000 }).catch(() => '')
  const match = text?.match(/第\s*(\d+)\s*\/\s*50/)
  return match ? parseInt(match[1]) : -1
}

export async function getResource(page: Page, resource: 'food' | 'wood' | 'gold'): Promise<number> {
  const icons: Record<string, string> = { food: '🌾', wood: '🪵', gold: '🪙' }
  const resBox = page.locator('[data-tutorial="resources"]').getByText(icons[resource]).locator('..')
  const text = await resBox.textContent()
  const match = text?.match(/(\d+)/)
  return match ? parseInt(match[1]) : 0
}

// ---- Dungeon ----

export async function enterDungeon(page: Page, floor: number) {
  const panel = page.getByText('地牢探险').locator('..').first()
  await panel.getByText(`${floor}F`).click()
  await page.getByRole('button', { name: new RegExp(`挑战第${floor}层`) }).click()
}

export async function dismissDungeonResult(page: Page) {
  const btn = page.getByRole('button', { name: '确认' })
  if (await btn.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await btn.click()
  }
}

// ---- Greedy spending ----

export const BUILD_PANEL = '[data-tutorial="build-panel"]'
export const ARMY_PANEL = '[data-tutorial="army-panel"]'

/** 判断面板内某个按钮当前是否可操作（未 disabled、存在于 DOM）。 */
export async function actionEnabled(page: Page, panel: string, name: string): Promise<boolean> {
  const btn = page.locator(panel).getByRole('button', { name: new RegExp(name) }).first()
  return btn.isEnabled({ timeout: 400 }).catch(() => false)
}

/**
 * 贪心花资源：根据给定的优先级队列，反复购买队列中所有可点的动作，
 * 直到某一轮扫描中没有任何动作可点为止（即当日资源基本花光）。
 *
 * - priority 越小越优先；同一优先级的动作每次扫描按顺序尝试。
 * - maxRounds 防止异常死循环。
 * - onSpend 供调用方记录每次成功动作与当前资源队列。
 */
export interface SpendAction {
  panel: string
  name: string
  label: string
  priority: number
  /** 前置守卫：返回 false 时该动作本轮跳过（用于食物等安全阀） */
  guard?: () => Promise<boolean>
}

export async function spendGreedily(
  page: Page,
  actions: Array<SpendAction>,
  opts: { maxRounds?: number; onSpend?: (a: SpendAction) => void } = {},
): Promise<{ spent: number; skipped: string[] }> {
  const maxRounds = opts.maxRounds ?? 60
  const queue = [...actions].sort((a, b) => a.priority - b.priority)
  const spent: string[] = []
  const skipped: string[] = []

  for (let round = 0; round < maxRounds; round++) {
    let hit = false
    for (const a of queue) {
      if (a.guard && !(await a.guard().catch(() => false))) continue
      const enabled = await actionEnabled(page, a.panel, a.name)
      if (!enabled) continue
      try {
        const btn = page.locator(a.panel).getByRole('button', { name: new RegExp(a.name) }).first()
        await btn.click({ timeout: 1500 })
        spent.push(a.label)
        opts.onSpend?.(a)
        hit = true
        await page.waitForTimeout(100)
      } catch {
        // 点击失败视为该动作无法执行
      }
    }
    if (!hit) break
  }
  return { spent: spent.length, skipped }
}

// ---- Power & Wave reading ----

const WAVE_WARNING = '[data-tutorial="wave-warning"]'

/** 从军队面板读取当前战力值。格式："士兵 X · 战力 Y" */
export async function getArmyPower(page: Page): Promise<number> {
  const panel = page.locator(ARMY_PANEL).last()
  const text = await panel.textContent({ timeout: 3000 }).catch(() => '')
  const match = text?.match(/战力\s*(\d+)/)
  return match ? parseInt(match[1]) : 0
}

/** 从波次提示区读取下一个波次编号。格式："第 X 波" */
export async function getNextWaveNumber(page: Page): Promise<number> {
  const el = page.locator(WAVE_WARNING)
  const text = await el.textContent({ timeout: 3000 }).catch(() => '')
  const match = text?.match(/第\s*(\d+)\s*波/)
  return match ? parseInt(match[1]) : 1
}

/** 计算指定波次的敌人总战力（count * atkEach） */
export function getWavePower(waveNumber: number): number {
  const count = Math.round(2 + waveNumber * 2.2)
  const atkEach = Math.round((2 + waveNumber * 1.1) * 10) / 10
  return Math.round(count * atkEach)
}

/** 读取当前人口信息：[当前人口, 人口上限] */
export async function getPopulation(page: Page): Promise<[number, number]> {
  const el = page.locator('[data-tutorial="resources"]')
  const text = await el.textContent({ timeout: 3000 }).catch(() => '')
  // 格式：人口 X/Y（可能在 🏠 图标附近）
  const match = text?.match(/(\d+)\s*\/\s*(\d+)/)
  if (match) return [parseInt(match[1]), parseInt(match[2])]
  // 备用：尝试读取 👥 图标附近
  const match2 = text?.match(/👥\s*(\d+)\s*\/\s*(\d+)/)
  return match2 ? [parseInt(match2[1]), parseInt(match2[2])] : [0, 0]
}

/** 读取当前食物产量（从食物资源旁的 +X 提示） */
export async function getFoodIncome(page: Page): Promise<number> {
  const el = page.locator('[data-tutorial="resources"]').getByText('🌾').locator('..')
  const text = await el.textContent({ timeout: 3000 }).catch(() => '')
  // 格式可能是：🌾123+5 或 🌾123 (+5)
  const match = text?.match(/\+(\d+)/)
  return match ? parseInt(match[1]) : 0
}

// ---- Villager redistribution ----

/** 重新分配村民。根据当前值和目标值的差值，点击加/减按钮。 */
export async function redistributeVillagers(page: Page, target: {
  food: number
  wood: number
  gold: number
}): Promise<void> {
  // 移动端：分配面板只在「村民」Tab 激活时渲染，需先切换
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.locator('nav button:has-text("👥")').first().click()
    await page.waitForTimeout(300)
  }
  const panel = page.locator('[data-tutorial="assignment-panel"]').last()
  const rows = panel.locator('.flex.items-center.gap-2.rounded-lg')

  // 读取当前分配值（从行内第二个元素获取数字，避开按钮）
  const getCurrent = async (index: number): Promise<number> => {
    const row = rows.nth(index)
    // 获取行内所有 span 的文本，找到纯数字的那个
    const spans = row.locator('span')
    const count = await spans.count()
    for (let i = 0; i < count; i++) {
      const text = await spans.nth(i).textContent({ timeout: 500 }).catch(() => '')
      if (text && /^\d+$/.test(text.trim())) {
        return parseInt(text.trim())
      }
    }
    return 0
  }

  const current = [await getCurrent(0), await getCurrent(1), await getCurrent(2)]
  const targets = [target.food, target.wood, target.gold]

  // 计算每个资源的差值，点击加号或减号
  for (let i = 0; i < 3; i++) {
    const delta = targets[i] - current[i]
    if (delta === 0) continue

    const row = rows.nth(i)
    const btn = delta > 0
      ? row.locator('button', { hasText: '＋' }).first()
      : row.locator('button', { hasText: '−' }).first()

    const clicks = Math.abs(delta)
    for (let j = 0; j < clicks; j++) {
      if (await btn.isEnabled({ timeout: 300 }).catch(() => false)) {
        await btn.click()
        await page.waitForTimeout(50)
      }
    }
  }
}

// ---- Dynamic strategy ----

export interface DayStrategy {
  phase: 'economy' | 'military'
  buildPriority: string[]
  trainPriority: string[]
  assignment: { food: number; wood: number; gold: number }
  shouldRecruit: boolean
}

/**
 * 根据当前回合数、战力对比、人口状况计算当日策略。
 *
 * 前2天（安全期）：allin 经济
 * 第3天起：根据战力比动态切换
 * - 我方战力 >= 敌方200%：allin 经济
 * - 我方战力 >= 敌方150%：经济为主，保持少量军事
 * - 我方战力 < 敌方150%：军事优先
 * - 我方战力 < 敌方80%：紧急军事（放弃经济全力出兵）
 */
export async function calculateDayStrategy(page: Page, turn: number): Promise<DayStrategy> {
  const myPower = await getArmyPower(page)
  const nextWave = await getNextWaveNumber(page)
  const enemyPower = getWavePower(nextWave)
  const [pop, popCap] = await getPopulation(page)

  // 前2天：安全期，全力经济
  if (turn <= 2) {
    return {
      phase: 'economy',
      buildPriority: ['民居', '农场', '伐木场', '矿场'],
      trainPriority: [],
      assignment: calculateEconomyAssignment(pop),
      shouldRecruit: pop < popCap,
    }
  }

  // 第3天起：根据战力比判断
  const powerRatio = enemyPower > 0 ? myPower / enemyPower : 999

  if (powerRatio >= 2.0) {
    // 战力充足（200%以上），allin 经济
    return {
      phase: 'economy',
      buildPriority: ['民居', '农场', '伐木场', '矿场'],
      trainPriority: [],
      assignment: calculateEconomyAssignment(pop),
      shouldRecruit: pop < popCap,
    }
  } else if (powerRatio >= 1.5) {
    // 战力较好（150%-200%），经济为主但保持军事建筑
    return {
      phase: 'economy',
      buildPriority: ['民居', '农场', '伐木场', '矿场', '箭塔', '城墙'],
      trainPriority: ['民兵'],
      assignment: calculateEconomyAssignment(pop),
      shouldRecruit: pop < popCap,
    }
  } else if (powerRatio < 0.8) {
    // 紧急状态：战力不足80%，全力军事
    return {
      phase: 'military',
      buildPriority: ['兵营', '箭塔', '城墙'],
      trainPriority: ['民兵', '弓箭手', '骑士'],
      assignment: calculateMilitaryAssignment(pop),
      shouldRecruit: false, // 不招募，专注训练
    }
  } else {
    // 战力在80%-150%之间：军事优先但保持经济
    return {
      phase: 'military',
      buildPriority: ['兵营', '箭塔', '城墙', '民居', '农场', '伐木场', '矿场'],
      trainPriority: ['民兵', '弓箭手', '骑士'],
      assignment: calculateMilitaryAssignment(pop),
      shouldRecruit: pop < popCap,
    }
  }
}

/** 经济优先分配：食物60%，木材30%，金币10% */
function calculateEconomyAssignment(pop: number): { food: number; wood: number; gold: number } {
  const available = pop
  const food = Math.floor(available * 0.6)
  const gold = Math.floor(available * 0.1)
  const wood = available - food - gold
  return { food, wood, gold }
}

/** 军事优先分配：食物40%，木材20%，金币40%（需要大量金币训练士兵） */
function calculateMilitaryAssignment(pop: number): { food: number; wood: number; gold: number } {
  const available = pop
  const food = Math.floor(available * 0.4)
  const gold = Math.floor(available * 0.4)
  const wood = available - food - gold
  return { food, wood, gold }
}
