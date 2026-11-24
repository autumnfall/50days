import { test, expect } from '@playwright/test'
import { disableTutorial, selectNation, clickStart, getEndTurnButton } from './game-helpers'

test.describe('开始界面', () => {
  test.beforeEach(async ({ page }) => {
    await disableTutorial(page)
    await page.goto('/')
  })

  test('显示游戏标题和副标题', async ({ page }) => {
    await expect(page.getByText('五十日坚守')).toBeVisible()
    await expect(page.getByText('回合制生存策略')).toBeVisible()
  })

  test('显示三个文明选项', async ({ page }) => {
    await expect(page.getByText('丰饶农耕国')).toBeVisible()
    await expect(page.getByText('铁血军事国')).toBeVisible()
    await expect(page.getByText('黄金商业联邦')).toBeVisible()
  })

  test('未选择文明时开局按钮禁用', async ({ page }) => {
    const btn = page.getByRole('button', { name: /请先选择文明/ })
    await expect(btn).toBeDisabled()
  })

  test('选择农业国后可开局', async ({ page }) => {
    await selectNation(page, 'agriculture')
    const btn = page.getByRole('button', { name: /以「丰饶农耕国」开局/ })
    await expect(btn).toBeEnabled()
  })
})

test.describe('三文明开局', () => {
  const nations = ['agriculture', 'military', 'commerce'] as const

  for (const nation of nations) {
    test(`${nation} 能正常进入游戏`, async ({ page }) => {
      await disableTutorial(page)
      await page.goto('/')
      await selectNation(page, nation)
      await clickStart(page)

      // 验证进入游戏界面（end-turn 按钮在桌面/移动端都可见）
      await expect(getEndTurnButton(page)).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('[data-tutorial="resources"]')).toBeVisible()
      // 移动端面板只在对应 Tab 激活时渲染，跳过面板可见性检查
    })
  }
})

test.describe('游戏界面元素', () => {
  test.beforeEach(async ({ page }) => {
    await disableTutorial(page)
    await page.goto('/')
    await selectNation(page, 'agriculture')
    await clickStart(page)
    await expect(getEndTurnButton(page)).toBeVisible({ timeout: 10_000 })
  })

  test('显示第1天', async ({ page }) => {
    await expect(page.getByText('第 1 / 50 天')).toBeVisible()
  })

  test('资源、预警和规则按钮在首屏可见', async ({ page }) => {
    await expect(page.locator('[data-tutorial="resources"]')).toBeInViewport()
    await expect(page.locator('[data-tutorial="wave-warning"]')).toBeInViewport()
    await expect(page.getByTitle('游戏规则')).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize()!.width)
  })

  test('显示初始资源', async ({ page }) => {
    const resources = page.locator('[data-tutorial="resources"]')
    await expect(resources.locator('[data-resource="food"]')).toBeVisible()
    await expect(resources.locator('[data-resource="wood"]')).toBeVisible()
    await expect(resources.locator('[data-resource="gold"]')).toBeVisible()
  })

  test('结束回合按钮可用', async ({ page }) => {
    const btn = getEndTurnButton(page)
    await expect(btn).toBeEnabled()
    await expect(btn).toContainText('结束回合')
  })

  test('村民分配面板有务农/伐木/采矿三行', async ({ page }) => {
    // 移动端需要先切换到 people tab
    if (page.viewportSize()!.width < 1024) {
      await page.getByRole('navigation').getByRole('button', { name: '村民' }).click()
      await page.waitForTimeout(300)
    }
    // .last() 定位移动端面板（桌面/移动端各有一个同 data-tutorial 属性的面板，移动端在 DOM 中靠后）
    const panel = page.locator('[data-tutorial="assignment-panel"]').last()
    await expect(panel.getByText('务农')).toBeVisible()
    await expect(panel.getByText('伐木')).toBeVisible()
    await expect(panel.getByText('采矿')).toBeVisible()
  })

  test('建造面板显示7种建筑', async ({ page }) => {
    // 移动端需要先切换到 build tab
    if (page.viewportSize()!.width < 1024) {
      await page.getByRole('navigation').getByRole('button', { name: '建造' }).click()
      await page.waitForTimeout(300)
    }
    const panel = page.locator('[data-tutorial="build-panel"]').last()
    for (const name of ['农场', '伐木场', '矿场', '民居', '兵营', '城墙', '箭塔']) {
      await expect(panel.getByText(name)).toBeVisible()
    }
  })

  test('军队面板显示4种兵种', async ({ page }) => {
    // 移动端需要先切换到 army tab
    if (page.viewportSize()!.width < 1024) {
      await page.getByRole('navigation').getByRole('button', { name: '军队' }).click()
      await page.waitForTimeout(300)
    }
    const panel = page.locator('[data-tutorial="army-panel"]').last()
    for (const name of ['民兵', '弓箭手', '骑士', '战神']) {
      await expect(panel.getByRole('button', { name: new RegExp(name) })).toBeVisible()
    }
  })

  test('帮助按钮可打开规则面板', async ({ page }) => {
    await page.getByTitle('游戏规则').click()
    await expect(page.getByText('📖 游戏规则')).toBeVisible()
    // 关闭
    await page.getByText('✕').click()
  })
})
