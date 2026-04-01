import { test, expect } from '@playwright/test'

/**
 * This test replicates the simplest possible capture in Go:
 * White stone at (0,0) gets surrounded by Black stones at (0,1) and (1,0).
 * 
 * In Local PvP on a 9x9 board:
 *   Move 1: Black plays (0,1) → pos=1
 *   Move 2: White plays (0,0) → pos=0
 *   Move 3: Black plays (1,0) → pos=9  ← this captures White at (0,0)
 */
test('corner capture — full browser diagnostic', async ({ page }) => {
  const logs: string[] = []
  page.on('console', msg => {
    const text = msg.text()
    logs.push(text)
    console.log('[BROWSER]', text)
  })

  await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 })

  // Start Local PvP on 9x9
  await page.click('button:has-text("9×9")')
  await page.click('button:has-text("Local PvP")')
  await page.click('button:has-text("2D")')
  await page.click('button:has-text("Start")')
  await page.waitForSelector('canvas', { timeout: 10000 })
  await page.waitForTimeout(500)

  // Read the actual canvas dimensions
  const canvasBox = await page.locator('canvas').boundingBox()
  expect(canvasBox).not.toBeNull()
  console.log('Canvas bounding box:', canvasBox)

  // Get the actual board dimensions from the browser
  const dims = await page.evaluate(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    const padding = 40
    const maxBoardPx = Math.min(w, h) - 120
    const size = 9
    const cellSize = Math.max(20, Math.floor((maxBoardPx - 2 * padding) / (size - 1)))
    const boardPx = cellSize * (size - 1) + 2 * padding
    return { w, h, padding, cellSize, boardPx }
  })
  console.log('Computed board dims:', dims)

  const { padding, cellSize } = dims

  // Helper: click a specific intersection
  async function clickIntersection(row: number, col: number) {
    const canvas = page.locator('canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')
    const x = box.x + padding + col * cellSize
    const y = box.y + padding + row * cellSize
    console.log(`Clicking (${row},${col}) at pixel (${x.toFixed(0)}, ${y.toFixed(0)})`)
    await page.mouse.click(x, y)
    await page.waitForTimeout(300)
  }

  // Move 1: Black plays (0,1) — pos=1
  console.log('\n=== Move 1: Black at (0,1) ===')
  await clickIntersection(0, 1)

  // Move 2: White plays (0,0) — pos=0 
  console.log('\n=== Move 2: White at (0,0) ===')
  await clickIntersection(0, 0)

  // Check board state BEFORE the capture
  const beforeCapture = await page.evaluate(() => {
    // @ts-ignore — access React internals to check state
    const boardState = document.querySelector('canvas')?.getAttribute('data-board')
    return boardState
  })
  console.log('Board state before capture move (from DOM):', beforeCapture)

  // Check what the console logs say about board state
  const syncLogs = logs.filter(l => l.startsWith('[SYNC]'))
  console.log('Sync logs so far:', syncLogs)

  // Move 3: Black plays (1,0) — pos=9 — THIS SHOULD CAPTURE White at (0,0)!
  console.log('\n=== Move 3: Black at (1,0) — should capture White at (0,0) ===')
  await clickIntersection(1, 0)

  // Wait a moment for state to propagate
  await page.waitForTimeout(500)

  // Check captures in DOM
  const playerCards = await page.locator('[class*="player-card"]').allInnerTexts()
  console.log('Player cards after capture:', playerCards)

  // Check via WASM directly
  const result = await page.evaluate(() => {
    // Access the WASM module via imports
    // We can't directly access the React state, so let's check if there are capture indicators
    const cards = document.querySelectorAll('[class*="player-card"]')
    const texts = Array.from(cards).map(c => c.textContent)
    return { cardTexts: texts }
  })
  console.log('Card texts from evaluate:', result.cardTexts)

  // Dump ALL console logs
  console.log('\n\n=== ALL BROWSER CONSOLE LOGS ===')
  for (const l of logs) {
    console.log('  ', l)
  }
  console.log('=== END LOGS ===\n')

  // Assert that at least one player card shows "Captures: 1"
  const allText = logs.join('\n')

  // Check if [PLAY] logs show capture
  const playLogs = logs.filter(l => l.startsWith('[PLAY]'))
  console.log('Play logs:', playLogs)
  
  const captureLogs = logs.filter(l => l.includes('[CAPTURE'))
  console.log('Capture logs:', captureLogs)

  // The test passes if we see capture evidence in the logs
  expect(captureLogs.length).toBeGreaterThan(0)
})
