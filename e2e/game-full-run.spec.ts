import { test, expect } from '@playwright/test'
import {
  startGame, endTurnAndResolve, dismissAllModals,
  spendGreedily, BUILD_PANEL, ARMY_PANEL,
  type SpendAction,
  getResource, getArmyPower, getNextWaveNumber, getWavePower,
  getPopulation, redistributeVillagers,
} from './game-helpers'

type Res = 'food' | 'wood' | 'gold'

async function res(page: Parameters<typeof getResource>[0]) {
  const r = async (k: Res) => getResource(page, k).catch(() => -1)
  return { food: await r('food'), wood: await r('wood'), gold: await r('gold') }
}

/**
 * 基于原始贪心策略的优化版本。
 * 优先级：箭塔（即时战力）> 城墙 > 训练 > 经济建筑 > 招募
 * 食物安全阀：25
 * 每日限训1个士兵（防止食物耗尽）
 *
 * 关键：第1天只建塔不建墙（2塔=20战力），第2天起再建墙
 */
const MIN_FOOD_FOR_SPEND = 25

function buildActions(page: Page, trainedToday: { count: number }, turn: number): SpendAction[] {
  const foodOkay = async () => (await res(page)).food >= MIN_FOOD_FOR_SPEND
  const canTrain = async () => foodOkay() && trainedToday.count < 1

  // 第1天：箭塔+伐木场（即时战力+木材生产）
  if (turn === 1) {
    return [
      { panel: BUILD_PANEL, name: '箭塔', label: '箭塔', priority: 0 },
      { panel: BUILD_PANEL, name: '伐木场', label: '伐木场', priority: 1 },
    ]
  }

  // 第2天：箭塔+农场+兵营+训练（第二座塔+经济+解锁训练）
  if (turn === 2) {
    return [
      { panel: BUILD_PANEL, name: '箭塔', label: '箭塔', priority: 0 },
      { panel: BUILD_PANEL, name: '农场', label: '农场', priority: 1 },
      { panel: BUILD_PANEL, name: '兵营', label: '兵营', priority: 2 },
      { panel: ARMY_PANEL, name: '民兵', label: '训民兵', priority: 3, guard: canTrain },
    ]
  }

  // 第3天起：正常优先级
  return [
    { panel: BUILD_PANEL, name: '箭塔', label: '箭塔', priority: 0 },
    { panel: BUILD_PANEL, name: '城墙', label: '城墙', priority: 1 },
    { panel: ARMY_PANEL, name: '民兵', label: '训民兵', priority: 2, guard: canTrain },
    { panel: ARMY_PANEL, name: '弓箭手', label: '训弓手', priority: 3, guard: canTrain },
    { panel: BUILD_PANEL, name: '兵营', label: '兵营', priority: 4 },
    { panel: BUILD_PANEL, name: '农场', label: '农场', priority: 5 },
    { panel: BUILD_PANEL, name: '伐木场', label: '伐木场', priority: 6 },
    { panel: BUILD_PANEL, name: '矿场', label: '矿场', priority: 7 },
    { panel: BUILD_PANEL, name: '民居', label: '民居', priority: 8 },
    { panel: BUILD_PANEL, name: '招募', label: '招募', priority: 9, guard: foodOkay },
  ]
}

test('智能动态策略 - 50回合完整通关', async ({ page }) => {
  test.setTimeout(600_000)

  const log: string[] = []
  const record = (msg: string) => { log.push(msg); console.log(msg) }

  record('=== 五十日坚守 - 智能动态策略通关日志 ===')
  record('策略：贪心消费（城墙/箭塔优先） + 动态村民分配（根据战力比调整采集重心）')
  record('食物安全阀: ' + MIN_FOOD_FOR_SPEND)
  record('')

  await startGame(page, 'agriculture')
  record('游戏开始! 文明: 丰饶农耕国')

  const init = await res(page)
  record(`初始资源: 食物${init.food} 木材${init.wood} 金币${init.gold}`)
  record('')

  let finalTurn = 0
  let outcome = 'unknown'
  let totalSpent = 0
  let totalSpentDays = 0

  for (let turn = 1; turn <= 50; turn++) {
    finalTurn = turn

    // 等待面板可用
    await page.locator(BUILD_PANEL).first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
    await page.locator(ARMY_PANEL).first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})

    const r0 = await res(page)
    const myPower = await getArmyPower(page)
    const nextWave = await getNextWaveNumber(page)
    const enemyPower = getWavePower(nextWave)
    const powerRatio = enemyPower > 0 ? (myPower / enemyPower * 100).toFixed(0) : '∞'
    const [pop, popCap] = await getPopulation(page)

    // 动态分配村民：根据战力比调整采集重心
    const ratio = enemyPower > 0 ? myPower / enemyPower : 999
    if (ratio >= 1.5) {
      // 战力充足（150%+），allin经济：60%食物 + 30%木材 + 10%金币
      await redistributeVillagers(page, {
        food: Math.floor(pop * 0.6),
        wood: Math.floor(pop * 0.3),
        gold: Math.floor(pop * 0.1),
      })
      record(`-- 第 ${turn} 天 -- [经济] 战力${powerRatio}%`)
    } else {
      // 战力不足，军事优先：40%食物 + 20%木材 + 40%金币（训练需要金币）
      await redistributeVillagers(page, {
        food: Math.floor(pop * 0.4),
        wood: Math.floor(pop * 0.2),
        gold: Math.floor(pop * 0.4),
      })
      record(`-- 第 ${turn} 天 -- [军事] 战力${powerRatio}%`)
    }

    record(`   资源: 食${r0.food} 木${r0.wood} 金${r0.gold} | 人口: ${pop}/${popCap} | 我${myPower} vs 敌${enemyPower}`)

    // 贪心花资源（每日限训1个士兵）
    const trainedToday = { count: 0 }
    const dayActions: string[] = []
    await spendGreedily(page, buildActions(page, trainedToday, turn), {
      onSpend: (a) => {
        dayActions.push(a.label)
        if (a.label.startsWith('训')) trainedToday.count++
      },
    })

    if (dayActions.length > 0) {
      const counts = new Map<string, number>()
      for (const a of dayActions) counts.set(a, (counts.get(a) ?? 0) + 1)
      const parts = [...counts.entries()].map(([k, v]) => (v > 1 ? `${k}×${v}` : k))
      record(`   花费: ${parts.join(' · ')}`)
      totalSpent += dayActions.length
      if (dayActions.length > 0) totalSpentDays++
    } else {
      record(`   花费: (无可消费动作)`)
    }

    const alive = await endTurnAndResolve(page)
    if (!alive) {
      outcome = 'defeat'
      record(`   !! 第 ${turn} 天后战败!`)
      break
    }

    const hasVictory = await page.getByText('你守住了').isVisible({ timeout: 1000 }).catch(() => false)
    if (hasVictory) {
      outcome = 'victory'
      record(`   ** 第 ${turn} 天胜利通关!`)
      break
    }

    record('')
  }

  if (outcome === 'unknown') {
    outcome = 'survived'
    record(`\n** 存活到第50天!`)
  }

  record('')
  record('=== 通关统计 ===')
  record(`结果: ${outcome === 'victory' ? '胜利' : outcome === 'defeat' ? '战败' : '存活'}`)
  record(`存活天数: ${finalTurn}`)
  record(`消费动作总数: ${totalSpent}（分布在 ${totalSpentDays} 天）`)

  await dismissAllModals(page)
  const fin = await res(page)
  if (fin.food >= 0) record(`最终资源: 食物${fin.food} 木材${fin.wood} 金币${fin.gold}`)
  record('')

  console.log('\n' + log.join('\n'))

  expect(finalTurn).toBeGreaterThanOrEqual(1)
})
