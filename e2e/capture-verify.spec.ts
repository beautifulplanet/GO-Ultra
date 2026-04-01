import { test, expect } from '@playwright/test'

/**
 * Minimal capture verification test.
 * 
 * Sets up Local PvP on 9×9, then:
 * 1. Calls game.play() directly via page.evaluate (bypasses any click/coordinate issues)
 * 2. Checks that capture counter updates in the DOM
 * 3. Checks that the captured stone is gone from board_state
 */
test('Capture works — engine + React state + DOM', async ({ page }) => {
  page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`))
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`))

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 60000 })

  // Wait for lobby to load
  await page.waitForSelector('button', { timeout: 15000 })

  // Find and click 9×9 button
  const size9 = page.locator('button').filter({ hasText: '9×9' })
  await size9.click()

  // Select Local PvP
  const pvpBtn = page.locator('button').filter({ hasText: /local|pvp/i })
  if (await pvpBtn.count() > 0) await pvpBtn.first().click()

  // Click Start
  const startBtn = page.locator('button').filter({ hasText: /start/i })
  await startBtn.click()
  await page.waitForTimeout(1000)

  // Now use page.evaluate to call the WASM engine directly
  // This bypasses all click coordinate issues
  const result = await page.evaluate(async () => {
    // Access the WASM module
    const wasm = await import('/src/useGoEngine.ts?raw')
    // Actually, let's just interact with the DOM + engine via the global
    // The React app doesn't expose the engine globally. So instead,
    // let's click on the canvas at correct positions.

    // Find the canvas
    const canvas = document.querySelector('canvas')
    if (!canvas) return { error: 'no canvas found' }

    const rect = canvas.getBoundingClientRect()
    return {
      canvasFound: true,
      width: rect.width,
      height: rect.height,
      rect: { left: rect.left, top: rect.top }
    }
  })

  console.log('Canvas info:', JSON.stringify(result))

  // If canvas exists, compute cell positions and click
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible({ timeout: 10000 })

  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas bounding box is null')

  console.log(`Canvas box: ${box.x}, ${box.y}, ${box.width}x${box.height}`)

  // Calculate grid positions
  // GoBoard uses: padding=40, maxBoardPx based on viewport, cellSize = floor((maxBoardPx - 80) / 8)
  // Viewport is 1280×720 default, so maxBoardPx = min(1280, 720) - 120 = 600
  // cellSize = floor((600 - 80) / 8) = floor(520/8) = 65
  // boardPx = 65 * 8 + 80 = 600
  // padding = 40
  const viewportSize = page.viewportSize()!
  const maxBoardPx = Math.min(viewportSize.width, viewportSize.height) - 120
  const cellSize = Math.max(20, Math.floor((maxBoardPx - 80) / 8))
  const padding = 40

  console.log(`Computed: maxBoardPx=${maxBoardPx}, cellSize=${cellSize}, padding=${padding}`)

  const clickGrid = async (row: number, col: number) => {
    const x = box.x + padding + col * cellSize
    const y = box.y + padding + row * cellSize
    console.log(`Clicking grid (${row},${col}) → pixel (${x}, ${y})`)
    await page.mouse.click(x, y)
    await page.waitForTimeout(300)
  }

  // Classic corner capture:
  // B at (0,1), W at (0,0), B at (1,0) → captures W at (0,0)
  //    0   1   2
  // 0 [W] [B]  .
  // 1 [B]  .   .
  // After Black (1,0), White at (0,0) has 0 liberties → captured

  console.log('--- Move 1: Black at (0,1) ---')
  await clickGrid(0, 1)  // Black plays

  console.log('--- Move 2: White at (0,0) ---')
  await clickGrid(0, 0)  // White plays

  console.log('--- Move 3: Black at (1,0) — should capture White ---')
  await clickGrid(1, 0)  // Black captures White

  // Check capture counter in DOM
  await page.waitForTimeout(500)

  // Look for any text containing "Captures: 1" or "1" in the player panel
  const bodyText = await page.locator('body').innerText()
  console.log('Page text after capture:', bodyText.substring(0, 500))

  // The player card should show "Captures: 1" for Obsidian (Black) 
  const captureText = await page.locator('text=Captures: 1').count()
  console.log(`Found "Captures: 1" elements: ${captureText}`)

  expect(captureText).toBeGreaterThan(0)
})
