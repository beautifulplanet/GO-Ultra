import { test, expect } from '@playwright/test'

test('capture flow with screenshots', async ({ page }) => {
  // Listen for ALL console messages
  const logs: string[] = []
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`))

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'test-results/01-lobby.png', fullPage: true })

  // Click "Local PvP"
  await page.click('button:has-text("Local PvP")')
  await page.waitForTimeout(200)

  // Click "Start Game"
  await page.click('button:has-text("Start Game")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/02-empty-board.png', fullPage: true })

  // Get the canvas
  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas not found!')

  // Read board size and compute cell positions
  // The board uses responsive sizing. Let's read it from the page.
  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas')!
    const w = c.width
    const h = c.height
    const dpr = window.devicePixelRatio || 1
    // The board renders with padding=40 and cellSize calculated from window size
    const maxBoardPx = Math.min(window.innerWidth, window.innerHeight) - 120
    const size = 9
    const padding = 40
    const cellSize = Math.max(20, Math.floor((maxBoardPx - 2 * padding) / (size - 1)))
    return { canvasW: w, canvasH: h, dpr, padding, cellSize, size, maxBoardPx }
  })
  console.log('Board info:', info)
  const { padding, cellSize } = info

  // Helper: click at grid position (row, col)
  const clickAt = async (row: number, col: number) => {
    const x = box.x + padding + col * cellSize
    const y = box.y + padding + row * cellSize
    console.log(`Clicking (${row},${col}) at pixel (${x}, ${y})`)
    await page.mouse.click(x, y)
    await page.waitForTimeout(300)
  }

  // Step 1: Black at (0, 1) — top edge, second from left
  await clickAt(0, 1)
  await page.screenshot({ path: 'test-results/03-black-at-0-1.png', fullPage: true })

  // Step 2: White at (0, 0) — top-left corner (White is surrounded here)
  await clickAt(0, 0)
  await page.screenshot({ path: 'test-results/04-white-at-0-0.png', fullPage: true })

  // Step 3: Black at (1, 0) — this should CAPTURE White at (0,0)
  await clickAt(1, 0)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/05-capture-black-at-1-0.png', fullPage: true })

  // Check console logs for capture
  const captureLogs = logs.filter(l => l.includes('CAPTURE') || l.includes('PLAY') || l.includes('SYNC'))
  console.log('=== CAPTURE-RELATED LOGS ===')
  for (const l of captureLogs) console.log(l)

  // Check the DOM for capture count
  const bodyText = await page.textContent('body')
  console.log('Body text includes captures:', bodyText?.includes('1 captures'))

  // Verify via WASM directly
  const wasmState = await page.evaluate(() => {
    // Access the WASM engine through the module scope
    return {
      bodyText: document.body.innerText
    }
  })
  console.log('Page text:', wasmState.bodyText)

  // Look for "1 captures" in the page
  const captureText = await page.locator('text=/1 capture/i').count()
  console.log('Found "1 capture" on page:', captureText > 0)

  // Final check: the position (0,0) should be empty now on the canvas
  // We can check by looking at the canvas pixel color at that position
  await page.screenshot({ path: 'test-results/06-final-state.png', fullPage: true })

  // Print all logs for debugging
  console.log('\n=== ALL CONSOLE LOGS ===')
  for (const l of logs) console.log(l)
})
