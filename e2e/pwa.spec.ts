import { expect, test } from '@playwright/test'
import { clickStart, disableTutorial, getEndTurnButton, selectNation } from './game-helpers'

test('已安装的生产版本可以在 Pages 子路径离线开局', async ({ page, context }) => {
  await disableTutorial(page)
  await page.goto('./')
  await expect(page.getByRole('heading', { name: '五十日坚守' })).toBeVisible()
  const manifest = await page.request.get('./manifest.json')
  expect(await manifest.json()).toMatchObject({ start_url: './', scope: './' })
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL))
    .toContain('/50days/sw.js')
  await context.setOffline(true)
  await page.reload()
  await selectNation(page, 'military')
  await clickStart(page)
  await expect(getEndTurnButton(page)).toBeEnabled()
})
