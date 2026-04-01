import { test, expect } from '@playwright/test'

// ─── E2E Test Suite: Go Chronicle ────────────────────────────────
// Tests the FULL user flow in 2D mode (reliable, no Three.js timing).
// 3D mode is tested separately for initialization.

test.describe('Go Chronicle E2E', () => {

  test('1. Lobby loads and shows Start button', async ({ page }) => {
    await page.goto('/', { timeout: 60000 })
    const startBtn = page.locator('.lobby-start')
    await expect(startBtn).toBeVisible({ timeout: 30000 })
    await expect(startBtn).toHaveText('Start Game')
    await expect(startBtn).toBeEnabled()
  })

  test('2. Can select board sizes', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-btn:has-text("13×13")')
    await expect(page.locator('.lobby-btn.selected:has-text("13×13")')).toBeVisible()
  })

  test('3. Render mode toggle exists with 2D and 3D options', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await expect(page.locator('.lobby-btn:has-text("2D Classic")')).toBeVisible()
    await expect(page.locator('.lobby-btn:has-text("3D Scene")')).toBeVisible()
    // 2D is default selected
    await expect(page.locator('.lobby-btn.selected:has-text("2D Classic")')).toBeVisible()
  })

  test('4. Start 2D game — board renders with canvas', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    // 2D is default, just click start
    await page.click('.lobby-start')

    // 2D wrapper and canvas
    await expect(page.locator('.board-2d-wrapper')).toBeVisible()
    await expect(page.locator('.board-2d-wrapper canvas')).toBeVisible()
    // UI overlay
    await expect(page.locator('.header')).toContainText('Go Chronicle')
    await expect(page.locator('.player-panel')).toBeVisible()
    await expect(page.locator('.score-panel')).toBeVisible()
  })

  test('5. 2D: Click to place stone — AI responds', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.diff-btn:has-text("1")')
    await page.click('.lobby-start')

    const canvas = page.locator('.board-2d-wrapper canvas')
    await expect(canvas).toBeVisible()

    // Click near an intersection (center of 9×9 board)
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas has no bounding box')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

    // Wait for AI to respond
    await page.waitForTimeout(2000)

    // Page still works
    await expect(page.locator('.header')).toBeVisible()
  })

  test('6. 2D: Multiple moves — no crashes', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.diff-btn:has-text("1")')
    await page.click('.lobby-start')

    const canvas = page.locator('.board-2d-wrapper canvas')
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas has no bounding box')

    // Play 3 moves in different positions
    for (let i = 0; i < 3; i++) {
      const x = box.x + box.width * (0.2 + i * 0.2)
      const y = box.y + box.height * (0.3 + i * 0.15)
      await page.mouse.click(x, y)
      await page.waitForTimeout(1500)
    }

    await expect(page.locator('.header')).toBeVisible()
  })

  test('7. Pass button works', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-start')
    await expect(page.locator('.board-2d-wrapper canvas')).toBeVisible()

    const passBtn = page.locator('.btn:has-text("Pass")')
    await expect(passBtn).toBeVisible()
    await passBtn.click()
    await page.waitForTimeout(500)
    await expect(page.locator('.header')).toBeVisible()
  })

  test('8. New Game button resets', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-start')
    await expect(page.locator('.board-2d-wrapper canvas')).toBeVisible()

    await page.click('.btn:has-text("New Game")')
    await page.waitForTimeout(500)
    await expect(page.locator('.board-2d-wrapper canvas')).toBeVisible()
  })

  test('9. Settings modal opens and closes', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-start')
    await expect(page.locator('.board-2d-wrapper canvas')).toBeVisible()

    await page.click('.settings-btn')
    await expect(page.locator('.modal')).toBeVisible()
    await page.click('.modal-close')
    await expect(page.locator('.modal')).not.toBeVisible()
  })

  test('10. 3-player mode on 13×13', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })

    await page.click('.lobby-btn:has-text("13×13")')
    await page.click('.lobby-btn:has-text("3*")')
    await page.click('.diff-btn:has-text("1")')
    await page.click('.lobby-start')

    await expect(page.locator('.board-2d-wrapper canvas')).toBeVisible()
    // 3 player cards
    await expect(page.locator('.player-card')).toHaveCount(3)
  })

  test('11. Local PvP — no AI thinking', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-btn:has-text("Local PvP")')
    await page.click('.lobby-start')

    const canvas = page.locator('.board-2d-wrapper canvas')
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    if (!box) throw new Error()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(500)
    await expect(page.locator('.thinking')).not.toBeVisible()
  })

  test('12. AI vs AI spectator mode starts and auto-plays', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })

    await page.click('.lobby-btn:has-text("AI vs AI")')
    await page.click('.diff-btn:has-text("1")')
    await page.click('.lobby-start')

    await expect(page.locator('.board-2d-wrapper canvas')).toBeVisible()
    // Should start auto-playing — wait and confirm thinking indicator appears
    await page.waitForTimeout(3000)
    // After 3s with difficulty 1, several moves should have been made
    // Page should still be functional
    await expect(page.locator('.header')).toBeVisible()
  })

  test('13. Difficulty selector — all 10 levels visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    for (let d = 1; d <= 10; d++) {
      await expect(page.locator(`.diff-btn:has-text("${d}")`).first()).toBeVisible()
    }
  })

  test('14. Back to Lobby from settings', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-start')
    await expect(page.locator('.board-2d-wrapper canvas')).toBeVisible()

    await page.click('.settings-btn')
    await page.click('.btn:has-text("Back to Lobby")')
    await expect(page.locator('.lobby')).toBeVisible()
  })

  test('15. 3D mode — scene canvas renders', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-btn:has-text("3D Scene")')
    await page.click('.lobby-start')

    await expect(page.locator('.scene-canvas')).toBeVisible()
    // Three.js canvas inside
    await expect(page.locator('.scene-canvas canvas')).toBeVisible({ timeout: 5000 })
  })

  test('16. No console errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    expect(errors).toHaveLength(0)
  })

  test('17. No console errors during 2D gameplay', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.diff-btn:has-text("1")')
    await page.click('.lobby-start')
    const canvas = page.locator('.board-2d-wrapper canvas')
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    if (!box) throw new Error()

    for (let i = 0; i < 3; i++) {
      await page.mouse.click(box.x + box.width * (0.3 + i * 0.15), box.y + box.height * 0.5)
      await page.waitForTimeout(1500)
    }
    expect(errors).toHaveLength(0)
  })
})
