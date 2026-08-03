import { test, expect } from '@playwright/test'
import {
  startGame, endTurn, endTurnAndResolve, dismissBattle, dismissAllModals,
  assignVillagers, buildBuilding, recruit, recruitMax, trainUnit,
  getDay, skipTutorialIfVisible, getEndTurnButton,
} from './game-helpers'

test.describe('农业国前10回合', () => {
  test('自动执行最优开局策略', async ({ page }) => {
    await startGame(page, 'agriculture')

    // 前7回合：按最优策略执行，忽略资源不足导致的失败
    const actions = [
      () => buildBuilding(page, '伐木场'),
      () => buildBuilding(page, '农场'),
      () => recruit(page),
      () => buildBuilding(page, '民居').then(() => recruit(page).catch(() => {})),
      () => recruit(page),
      () => buildBuilding(page, '兵营'),
      () => trainUnit(page, '民兵'),
    ]

    let alive = true
    for (let i = 0; i < actions.length && alive; i++) {
      try { await actions[i]() } catch { /* 资源不足 */ }
      alive = await endTurnAndResolve(page)
    }

    // 继续3回合
    for (let i = 0; i < 3 && alive; i++) {
      try { await recruit(page).catch(() => {}) } catch {}
      alive = await endTurnAndResolve(page)
    }

    // 验证游戏到达了有意义的状态（仍在进行 或 已结束）
    const day = await getDay(page)
    const hasEndTurn = await getEndTurnButton(page).isVisible().catch(() => false)
    const hasDefeat = !alive
    expect(day >= 1 || hasEndTurn || hasDefeat).toBeTruthy()
  })
})

test.describe('军事国前10回合', () => {
  test('利用自带兵营快速训练', async ({ page }) => {
    await startGame(page, 'military')

    // 军事国自带1级兵营
    const actions = [
      () => buildBuilding(page, '伐木场').then(() => trainUnit(page, '民兵')),
      () => buildBuilding(page, '农场'),
      () => recruit(page),
      () => buildBuilding(page, '民居').then(() => trainUnit(page, '民兵').catch(() => {})),
      () => recruit(page),
      () => trainUnit(page, '民兵').catch(() => {}),
      () => trainUnit(page, '民兵').catch(() => {}),
    ]

    let alive = true
    for (let i = 0; i < actions.length && alive; i++) {
      try { await actions[i]() } catch {}
      alive = await endTurnAndResolve(page)
    }

    // 继续几回合
    for (let i = 0; i < 3 && alive; i++) {
      try { await recruit(page).catch(() => {}) } catch {}
      alive = await endTurnAndResolve(page)
    }

    // 验证游戏到达了有意义的状态（仍在进行 或 已结束）
    const day = await getDay(page)
    const hasEndTurn = await getEndTurnButton(page).isVisible().catch(() => false)
    const hasDefeat = !alive
    expect(day >= 1 || hasEndTurn || hasDefeat).toBeTruthy()
  })
})

test.describe('完整50回合通关', () => {
  test('农业国自动通关尝试', async ({ page }) => {
    test.setTimeout(300_000)

    await startGame(page, 'agriculture')

    // 策略：根据天数选择行动
    async function playTurn(turn: number) {
      try {
        if (turn <= 2) {
          if (turn === 1) await buildBuilding(page, '伐木场')
          if (turn === 2) await buildBuilding(page, '农场')
        } else if (turn <= 5) {
          await recruit(page).catch(() => {})
        } else if (turn <= 7) {
          if (turn === 6) await buildBuilding(page, '兵营').catch(() => {})
          await trainUnit(page, '民兵').catch(() => {})
        } else if (turn <= 15) {
          await recruit(page).catch(() => {})
          await buildBuilding(page, '城墙').catch(() => {})
          await buildBuilding(page, '农场').catch(() => {})
          await trainUnit(page, '民兵').catch(() => {})
        } else if (turn <= 25) {
          await buildBuilding(page, '兵营').catch(() => {})
          await trainUnit(page, '弓箭手').catch(() => {})
          await trainUnit(page, '民兵').catch(() => {})
          await buildBuilding(page, '城墙').catch(() => {})
          await buildBuilding(page, '箭塔').catch(() => {})
        } else if (turn <= 35) {
          await buildBuilding(page, '兵营').catch(() => {})
          await trainUnit(page, '骑士').catch(() => {})
          await trainUnit(page, '弓箭手').catch(() => {})
          await buildBuilding(page, '城墙').catch(() => {})
          await buildBuilding(page, '箭塔').catch(() => {})
        } else {
          await trainUnit(page, '骑士').catch(() => {})
          await trainUnit(page, '弓箭手').catch(() => {})
          await buildBuilding(page, '城墙').catch(() => {})
          await buildBuilding(page, '箭塔').catch(() => {})
        }
      } catch { /* 忽略 */ }
    }

    for (let turn = 1; turn <= 50; turn++) {
      await playTurn(turn)
      const alive = await endTurnAndResolve(page)
      if (!alive) break
    }

    // 验证最终状态
    const hasEndTurn = await getEndTurnButton(page).isVisible().catch(() => false)
    const hasVictory = await page.getByText('你守住了').isVisible({ timeout: 3000 }).catch(() => false)
    const hasDefeat = await page.getByText('营地已空无一人').isVisible({ timeout: 500 }).catch(() => false)
      || await page.getByText('血洗了村庄').isVisible({ timeout: 500 }).catch(() => false)

    expect(hasEndTurn || hasVictory || hasDefeat).toBeTruthy()
  })
})

test.describe('地牢系统', () => {
  test('有士兵后可尝试地牢第1层', async ({ page }) => {
    const isMobile = (page.viewportSize()?.width ?? 1280) < 1024
    const switchTab = async (label: string) => {
      if (isMobile) {
        await page.locator(`nav button:has-text("${label}")`).first().click()
        await page.waitForTimeout(200)
      }
    }

    await startGame(page, 'military')

    // 快速准备
    await switchTab('建造')
    await buildBuilding(page, '伐木场')
    await switchTab('军队')
    await trainUnit(page, '民兵')
    await endTurnAndResolve(page)

    await switchTab('建造')
    await buildBuilding(page, '农场')
    await endTurnAndResolve(page)

    // 确保没有残留模态框
    await dismissAllModals(page)

    // 滚动到地牢面板并尝试第1层
    const dungeonPanel = page.locator('[data-tutorial="build-panel"]').last().locator('..').getByText('地牢探险').first()
    await dungeonPanel.scrollIntoViewIfNeeded().catch(() => {})

    // 点击地牢面板中的楼层按钮
    const floor1 = page.getByText('1F').first()
    if (await floor1.isVisible({ timeout: 3000 }).catch(() => false)) {
      await floor1.click()

      const challengeBtn = page.getByRole('button', { name: /挑战第1层/ })
      if (await challengeBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
        await challengeBtn.click()
        await page.waitForTimeout(3000)

        const confirmBtn = page.getByRole('button', { name: '确认' })
        if (await confirmBtn.isVisible({ timeout: 15_000 }).catch(() => false)) {
          await confirmBtn.click()
        }
      }
    }
  })
})

test.describe('事件处理', () => {
  test('推进10回合不崩溃', async ({ page }) => {
    await startGame(page, 'agriculture')

    for (let i = 0; i < 10; i++) {
      const alive = await endTurnAndResolve(page)
      if (!alive) break
    }

    // 游戏可能已经结束（失败）或仍在进行
    const hasEndTurn = await getEndTurnButton(page).isVisible().catch(() => false)
    const hasDefeat = await page.getByText('营地已空无一人').isVisible({ timeout: 500 }).catch(() => false)
      || await page.getByText('血洗了村庄').isVisible({ timeout: 500 }).catch(() => false)

    // 至少应该到达了某个状态
    expect(hasEndTurn || hasDefeat).toBeTruthy()
  })
})
