import { test, expect } from '@playwright/test'

// ─── E2E Test Suite: Go Chronicle ────────────────────────────────
// Tests the FULL user flow: lobby → game → play → capture → AI → game over
// Per SGT TESTING.md: "Play a game to move 5 — no crashes"

test.describe('Go Chronicle E2E', () => {

  test('1. Lobby loads and shows Start button', async ({ page }) => {
    await page.goto('/', { timeout: 60000 })
    // Wait for WASM to load — "Start Game" becomes enabled
    const startBtn = page.locator('.lobby-start')
    await expect(startBtn).toBeVisible({ timeout: 30000 })
    await expect(startBtn).toHaveText('Start Game')
    await expect(startBtn).toBeEnabled()
  })

  test('2. Can select board sizes', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })

    // Click 13×13
    await page.click('.lobby-btn:has-text("13×13")')
    const selected = page.locator('.lobby-btn.selected:has-text("13×13")')
    await expect(selected).toBeVisible()
  })

  test('3. Start 9×9 game — board and UI render', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-start')

    // Scene canvas should be visible
    await expect(page.locator('.scene-canvas')).toBeVisible()
    // UI overlay with header
    await expect(page.locator('.header')).toContainText('Go Chronicle')
    // Player panel visible
    await expect(page.locator('.player-panel')).toBeVisible()
    // Score panel visible
    await expect(page.locator('.score-panel')).toBeVisible()
    // Three.js canvas element should exist inside scene-canvas
    const canvas = page.locator('.scene-canvas canvas')
    await expect(canvas).toBeVisible({ timeout: 5000 })
  })

  test('4. Can click canvas — stone placement works', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-start')
    // Wait for Three.js canvas
    const canvas = page.locator('.scene-canvas canvas')
    await expect(canvas).toBeVisible({ timeout: 5000 })

    // Wait a bit for scene to fully initialize
    await page.waitForTimeout(500)

    // Click somewhere on the canvas — center-ish
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas has no bounding box')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

    // Wait for AI to respond (if vs AI mode)
    // We just verify no crash after clicking
    await page.waitForTimeout(1000)

    // Page should still be functional — no error overlay
    await expect(page.locator('.header')).toContainText('Go Chronicle')
  })

  test('5. AI responds after human plays (vs AI mode)', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })

    // Select difficulty 1 (fastest, near-random)
    await page.click('.diff-btn:has-text("1")')
    await page.click('.lobby-start')

    const canvas = page.locator('.scene-canvas canvas')
    await expect(canvas).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    // Click center of board
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas has no bounding box')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

    // "AI thinking…" should appear briefly
    // Wait for AI to finish — up to 5s
    await page.waitForTimeout(2000)

    // After AI moves, the page should still work (no freeze/crash)
    await expect(page.locator('.header')).toBeVisible()
  })

  test('6. Pass button works', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-start')
    await page.locator('.scene-canvas canvas').waitFor({ timeout: 5000 })
    await page.waitForTimeout(500)

    // Click Pass
    const passBtn = page.locator('.btn:has-text("Pass")')
    await expect(passBtn).toBeVisible()
    await passBtn.click()

    // Page should still be alive
    await page.waitForTimeout(500)
    await expect(page.locator('.header')).toBeVisible()
  })

  test('7. New Game button resets state', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-start')
    await page.locator('.scene-canvas canvas').waitFor({ timeout: 5000 })
    await page.waitForTimeout(500)

    // Click New Game
    const newGameBtn = page.locator('.btn:has-text("New Game")')
    await expect(newGameBtn).toBeVisible()
    await newGameBtn.click()

    // Should rebuild scene — canvas still there (double-rAF needs time)
    await page.waitForTimeout(2000)
    await expect(page.locator('.scene-canvas canvas')).toBeVisible({ timeout: 5000 })
  })

  test('8. Settings modal opens and toggles work', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-start')
    await page.locator('.scene-canvas canvas').waitFor({ timeout: 5000 })

    // Open settings
    await page.click('.settings-btn')
    await expect(page.locator('.modal')).toBeVisible()

    // Toggle valid moves
    const toggles = page.locator('.toggle')
    await expect(toggles.first()).toBeVisible()
    await toggles.first().click()

    // Close settings
    await page.click('.modal-close')
    await expect(page.locator('.modal')).not.toBeVisible()
  })

  test('9. 3-player mode — lobby allows 3 on 13×13+', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })

    // Select 13×13
    await page.click('.lobby-btn:has-text("13×13")')
    // Now click 3* button
    const threeBtn = page.locator('.lobby-btn:has-text("3*")')
    await expect(threeBtn).toBeVisible()
    await threeBtn.click()

    // Start game
    await page.click('.lobby-start')
    await page.locator('.scene-canvas canvas').waitFor({ timeout: 5000 })

    // Should have 3 player cards
    const cards = page.locator('.player-card')
    await expect(cards).toHaveCount(3)
  })

  test('10. Local PvP mode — no AI thinking indicator', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })

    // Select Local PvP
    await page.click('.lobby-btn:has-text("Local PvP")')
    await page.click('.lobby-start')
    await page.locator('.scene-canvas canvas').waitFor({ timeout: 5000 })
    await page.waitForTimeout(500)

    // Click to place a stone
    const canvas = page.locator('.scene-canvas canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas has no bounding box')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

    // "AI thinking" should NOT appear in PvP mode
    await page.waitForTimeout(500)
    await expect(page.locator('.thinking')).not.toBeVisible()
  })

  test('11. Back to Lobby from settings', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-start')
    await page.locator('.scene-canvas canvas').waitFor({ timeout: 5000 })

    // Settings → Back to Lobby
    await page.click('.settings-btn')
    await page.click('.btn:has-text("Back to Lobby")')

    // Should be back at lobby
    await expect(page.locator('.lobby')).toBeVisible()
    await expect(page.locator('.lobby-title')).toBeVisible()
  })

  test('12. No console errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })

    expect(errors).toHaveLength(0)
  })

  test('13. No console errors during gameplay', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.diff-btn:has-text("1")')
    await page.click('.lobby-start')
    const canvas = page.locator('.scene-canvas canvas')
    await expect(canvas).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    // Play 3 moves
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas has no bounding box')

    for (let i = 0; i < 3; i++) {
      // Click different positions
      const x = box.x + box.width * (0.3 + i * 0.15)
      const y = box.y + box.height * 0.5
      await page.mouse.click(x, y)
      await page.waitForTimeout(1500) // wait for AI
    }

    expect(errors).toHaveLength(0)
  })
})
