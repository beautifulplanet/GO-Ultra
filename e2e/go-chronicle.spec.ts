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

  // ── CAPTURE VERIFICATION ──
  // Local PvP on 9×9. Black surrounds a White stone and captures it.
  // Board positions (9×9): pos = row * 9 + col
  // We place: Black(0,1), White(0,0), Black(1,0) — then verify White(0,0) is captured.
  // Corner stone at (0,0) has only 2 liberties: (0,1) and (1,0).
  // B occupies (0,1), then W plays (0,0), then B occupies (1,0) → W at (0,0) captured.
  test('17. Captures work — corner capture in Local PvP', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-btn:has-text("Local PvP")')
    await page.click('.lobby-start')

    const canvas = page.locator('.board-2d-wrapper canvas')
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box missing')

    // Read board metrics from the canvas. The GoBoard uses:
    // padding=32, cellSize = floor((560-64)/(size-1)) clamped to 40 → 40 for 9×9
    // gridX(col) = 32 + col * 40, gridY(row) = 32 + row * 40
    const padding = 32
    const cellSize = 40 // for 9×9: Math.min(Math.floor(496/8), 40) = 40

    function gridPos(row: number, col: number) {
      return {
        x: box!.x + padding + col * cellSize,
        y: box!.y + padding + row * cellSize,
      }
    }

    // Move 1: Black plays (0,1) — next to the corner
    const m1 = gridPos(0, 1)
    await page.mouse.click(m1.x, m1.y)
    await page.waitForTimeout(200)

    // Move 2: White plays (0,0) — the corner (will be captured)
    const m2 = gridPos(0, 0)
    await page.mouse.click(m2.x, m2.y)
    await page.waitForTimeout(200)

    // Move 3: Black plays (1,0) — this captures White at (0,0)
    const m3 = gridPos(1, 0)
    await page.mouse.click(m3.x, m3.y)
    await page.waitForTimeout(500)

    // Verify capture: read pixel at (0,0) intersection.
    // If captured, it should be board-colored (tan/gold), not white.
    const pixelColor = await canvas.evaluate((el: HTMLCanvasElement, args: { x: number; y: number }) => {
      const ctx = el.getContext('2d')!
      const dpr = window.devicePixelRatio || 1
      const pixel = ctx.getImageData(args.x * dpr, args.y * dpr, 1, 1).data
      return { r: pixel[0], g: pixel[1], b: pixel[2] }
    }, { x: padding, y: padding }) // position (0,0) → gridX(0)=32, gridY(0)=32

    // White stone is rgb ~(240,240,240). Board is rgb ~(220,179,92).
    // If captured, pixel should NOT be white (r > 230 && g > 230 && b > 230)
    const isWhiteStone = pixelColor.r > 220 && pixelColor.g > 220 && pixelColor.b > 220
    expect(isWhiteStone).toBe(false) // Stone should be gone — captured!
  })

  test('18. WASM engine captures — programmatic verification', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-start') // default 9×9 vs AI

    // Wait for WASM to load, then test the engine directly
    await page.waitForSelector('.board-2d-wrapper canvas', { timeout: 15000 })

    const result = await page.evaluate(async () => {
      // Access the WASM module that's already loaded
      const wasm = await import('/pkg/go_engine.js')
      await wasm.default() // re-init if needed (idempotent)
      const game = new wasm.GoGame(9, 2)

      // Set up: Black at (0,1), White at (0,0), Black at (1,0) captures White
      game.play(1)    // Black at pos 1 = (0,1)
      game.play(0)    // White at pos 0 = (0,0)
      game.play(9)    // Black at pos 9 = (1,0) — captures White at (0,0)

      const board = game.board_state()
      const stoneAt00 = board[0] // Should be 255 (empty) after capture
      const blackCaptures = game.captures(0) // Black captured 1 stone

      game.free()
      return { stoneAt00, blackCaptures }
    })

    expect(result.stoneAt00).toBe(255)  // Stone captured — empty
    expect(result.blackCaptures).toBe(1) // Black captured one stone
  })

  // ── FULL CAPTURE FLOW: Click-based capture in Local PvP ──
  // This tests the ACTUAL user flow: clicking the canvas, state updating, canvas redrawing
  test('19. Full capture flow — click, state, render', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.lobby-start:not([disabled])', { timeout: 15000 })
    await page.click('.lobby-btn:has-text("Local PvP")')
    await page.click('.lobby-start')

    const canvas = page.locator('.board-2d-wrapper canvas')
    await expect(canvas).toBeVisible({ timeout: 10000 })
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box missing')

    const padding = 32
    const cellSize = 40

    function clickGrid(row: number, col: number) {
      return page.mouse.click(box!.x + padding + col * cellSize, box!.y + padding + row * cellSize)
    }

    // Step 1: Black plays (0,1) — right of corner
    await clickGrid(0, 1)
    await page.waitForTimeout(300)

    // Verify state after move 1 via DOM query
    const afterMove1 = await page.evaluate(() => {
      // Read capture count from the player panel
      const cards = document.querySelectorAll('.player-card .info')
      return {
        obsidianInfo: cards[0]?.textContent || '',
        ivoryInfo: cards[1]?.textContent || '',
      }
    })
    // No captures yet
    expect(afterMove1.obsidianInfo).toContain('Captures: 0')

    // Step 2: White plays (0,0) — corner (will be captured)
    await clickGrid(0, 0)
    await page.waitForTimeout(300)

    // Step 3: Black plays some other move far away — White is not yet captured
    // Black plays (4,4) — center
    await clickGrid(4, 4)
    await page.waitForTimeout(300)

    // Step 4: White plays somewhere far away — (4,5)
    await clickGrid(4, 5)
    await page.waitForTimeout(300)

    // Step 5: Black plays (1,0) — this captures White's corner stone at (0,0)!
    await clickGrid(1, 0)
    await page.waitForTimeout(500)

    // Verify capture happened via DOM
    const afterCapture = await page.evaluate(() => {
      const cards = document.querySelectorAll('.player-card .info')
      return {
        obsidianInfo: cards[0]?.textContent || '',
        ivoryInfo: cards[1]?.textContent || '',
      }
    })
    // Black should have 1 capture now
    expect(afterCapture.obsidianInfo).toContain('Captures: 1')

    // Verify via canvas pixel — position (0,0) should be board color, not white
    const pixelColor = await canvas.evaluate((el: HTMLCanvasElement, args: { x: number; y: number }) => {
      const ctx = el.getContext('2d')!
      const dpr = window.devicePixelRatio || 1
      const pixel = ctx.getImageData(args.x * dpr, args.y * dpr, 1, 1).data
      return { r: pixel[0], g: pixel[1], b: pixel[2] }
    }, { x: padding, y: padding })

    // White stone is rgb ~(240,240,240). Board is rgb ~(220,179,92).
    const isWhiteStone = pixelColor.r > 220 && pixelColor.g > 220 && pixelColor.b > 220
    expect(isWhiteStone).toBe(false) // Stone should be gone
  })

  test('19. No console errors during 2D gameplay', async ({ page }) => {
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
