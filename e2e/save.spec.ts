import { expect, test } from '@playwright/test'
import { startGame, getEndTurnButton } from './game-helpers'

test('回合自动存档可在刷新后读回', async ({ page }) => {
  await startGame(page, 'military')
  await getEndTurnButton(page).click()
  await expect(page.getByText('第 2 / 50 天')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /继续游戏/ }).click()
  await page.getByRole('button', { name: '读取', exact: true }).first().click()
  await expect(page.getByText('第 2 / 50 天')).toBeVisible()
})

test('损坏存档可以提示错误并继续开局', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fiftyDays_save_1', '{"phase":"playing","day":1,"resources":{}}')
  })
  await page.goto('/')
  await page.getByRole('button', { name: /继续游戏/ }).click()
  await page.getByRole('button', { name: '读取', exact: true }).nth(1).click()
  await expect(page.getByRole('alert')).toContainText('存档已损坏')
})
