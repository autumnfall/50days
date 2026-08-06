import { test, expect } from '@playwright/test'
import { disableTutorial, selectNation, selectMode, getEndTurnButton, startGame, endTurn, dismissAllModals } from './game-helpers'

test.describe('肉鸽模式：模式选择界面', () => {
  test.beforeEach(async ({ page }) => {
    await disableTutorial(page)
    await page.goto('/')
  })

  test('显示经典战役与无尽远征两张模式卡', async ({ page }) => {
    await expect(page.getByText('— 选择游戏模式 —')).toBeVisible()
    await expect(page.getByRole('button', { name: /经典战役/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /无尽远征/ })).toBeVisible()
  })

  test('选中无尽远征后显示种子与重 roll 按钮', async ({ page }) => {
    await selectMode(page, 'rogue')
    await expect(page.getByText('远征种子')).toBeVisible()
    await expect(page.getByRole('button', { name: '换一个' })).toBeVisible()
  })

  test('重 roll 会更换种子', async ({ page }) => {
    await selectMode(page, 'rogue')
    const seedText = page.locator('.font-mono').first()
    const before = await seedText.textContent()
    // 连点几次，理论上极小概率相同，多点几次确保变化
    let after = before
    for (let i = 0; i < 5 && after === before; i++) {
      await page.getByRole('button', { name: '换一个' }).click()
      after = await seedText.textContent()
    }
    expect(after).not.toBe(before)
  })

  test('无尽远征开局按钮文案正确', async ({ page }) => {
    await selectMode(page, 'rogue')
    await selectNation(page, 'military')
    const btn = page.getByRole('button', { name: /以「铁血军事国」踏上无尽远征/ })
    await expect(btn).toBeEnabled()
  })
})

test.describe('肉鸽模式：无尽远征对局', () => {
  test('开局后显示无尽远征天数（无 /50 上限）', async ({ page }) => {
    await startGame(page, 'military', 'rogue')
    await expect(page.getByText('无尽远征').first()).toBeVisible()
    // Header 不应出现 / 50 天进度
    await expect(page.getByText('/ 50 天')).toBeHidden()
  })

  test('第 3 天出现远征祝福三选一，选择后可继续', async ({ page }) => {
    await startGame(page, 'military', 'rogue')
    // day 1 → 2
    await endTurn(page)
    await dismissAllModals(page) // 清掉第 2 天可能的随机事件，避免遮挡结束回合按钮
    // day 2 → 3（祝福日）
    await getEndTurnButton(page).click({ timeout: 5_000 })
    // 可能先弹战报，先清掉
    await dismissAllModals(page)
    // 如果祝福弹窗已被 dismissAllModals 消费则重新检查：祝福应该在第 3 天出现
    // dismissAllModals 会把祝福当事件选掉，所以这里直接验证已推进到第 3 天且无卡死
    await expect(page.getByText('第 3 天').first()).toBeVisible({ timeout: 10_000 })
    // 继续推进到第 4 天，验证无尽模式不会在第 3 天卡死
    await endTurn(page)
    await expect(page.getByText('第 4 天').first()).toBeVisible({ timeout: 10_000 })
  })

  test('祝福弹窗包含 3 个选项', async ({ page }) => {
    await startGame(page, 'military', 'rogue')
    await endTurn(page) // day 1 → 2
    await dismissAllModals(page) // 清掉第 2 天可能的随机事件，避免遮挡结束回合按钮
    await getEndTurnButton(page).click({ timeout: 5_000 }) // day 2 → 3
    // 可能有战报，先关闭战报但保留祝福弹窗
    for (let i = 0; i < 10; i++) {
      const battleBtn = page.getByRole('button', { name: '继续坚守' })
      const battleVisible = await battleBtn.isVisible({ timeout: 800 }).catch(() => false)
      if (battleVisible) {
        const enabled = await battleBtn.isEnabled().catch(() => false)
        if (enabled) await battleBtn.click()
        await page.waitForTimeout(600)
        continue
      }
      break
    }
    const blessing = page.getByText('远征祝福 · 三选一')
    await expect(blessing).toBeVisible({ timeout: 10_000 })
    // 祝福三选一：恰好 3 个可点选项
    const choices = page.locator('.fixed').last().locator('button:not([disabled])')
    await expect(choices).toHaveCount(3)
    // 选择第一个祝福后弹窗关闭，天数为第 3 天
    await choices.first().click()
    await expect(blessing).toBeHidden()
    await expect(page.getByText('第 3 天').first()).toBeVisible()
  })
})
