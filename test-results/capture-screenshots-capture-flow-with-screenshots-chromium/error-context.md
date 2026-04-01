# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: capture-screenshots.spec.ts >> capture flow with screenshots
- Location: e2e\capture-screenshots.spec.ts:3:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:5173/", waiting until "networkidle"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test('capture flow with screenshots', async ({ page }) => {
  4  |   // Listen for ALL console messages
  5  |   const logs: string[] = []
  6  |   page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`))
  7  | 
> 8  |   await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
     |              ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  9  |   await page.waitForTimeout(2000)
  10 |   await page.screenshot({ path: 'test-results/01-lobby.png', fullPage: true })
  11 | 
  12 |   // Click "Local PvP"
  13 |   await page.click('button:has-text("Local PvP")')
  14 |   await page.waitForTimeout(200)
  15 | 
  16 |   // Click "Start Game"
  17 |   await page.click('button:has-text("Start Game")')
  18 |   await page.waitForTimeout(500)
  19 |   await page.screenshot({ path: 'test-results/02-empty-board.png', fullPage: true })
  20 | 
  21 |   // Get the canvas
  22 |   const canvas = page.locator('canvas')
  23 |   const box = await canvas.boundingBox()
  24 |   if (!box) throw new Error('Canvas not found!')
  25 | 
  26 |   // Read board size and compute cell positions
  27 |   // The board uses responsive sizing. Let's read it from the page.
  28 |   const info = await page.evaluate(() => {
  29 |     const c = document.querySelector('canvas')!
  30 |     const w = c.width
  31 |     const h = c.height
  32 |     const dpr = window.devicePixelRatio || 1
  33 |     // The board renders with padding=40 and cellSize calculated from window size
  34 |     const maxBoardPx = Math.min(window.innerWidth, window.innerHeight) - 120
  35 |     const size = 9
  36 |     const padding = 40
  37 |     const cellSize = Math.max(20, Math.floor((maxBoardPx - 2 * padding) / (size - 1)))
  38 |     return { canvasW: w, canvasH: h, dpr, padding, cellSize, size, maxBoardPx }
  39 |   })
  40 |   console.log('Board info:', info)
  41 |   const { padding, cellSize } = info
  42 | 
  43 |   // Helper: click at grid position (row, col)
  44 |   const clickAt = async (row: number, col: number) => {
  45 |     const x = box.x + padding + col * cellSize
  46 |     const y = box.y + padding + row * cellSize
  47 |     console.log(`Clicking (${row},${col}) at pixel (${x}, ${y})`)
  48 |     await page.mouse.click(x, y)
  49 |     await page.waitForTimeout(300)
  50 |   }
  51 | 
  52 |   // Step 1: Black at (0, 1) — top edge, second from left
  53 |   await clickAt(0, 1)
  54 |   await page.screenshot({ path: 'test-results/03-black-at-0-1.png', fullPage: true })
  55 | 
  56 |   // Step 2: White at (0, 0) — top-left corner (White is surrounded here)
  57 |   await clickAt(0, 0)
  58 |   await page.screenshot({ path: 'test-results/04-white-at-0-0.png', fullPage: true })
  59 | 
  60 |   // Step 3: Black at (1, 0) — this should CAPTURE White at (0,0)
  61 |   await clickAt(1, 0)
  62 |   await page.waitForTimeout(500)
  63 |   await page.screenshot({ path: 'test-results/05-capture-black-at-1-0.png', fullPage: true })
  64 | 
  65 |   // Check console logs for capture
  66 |   const captureLogs = logs.filter(l => l.includes('CAPTURE') || l.includes('PLAY') || l.includes('SYNC'))
  67 |   console.log('=== CAPTURE-RELATED LOGS ===')
  68 |   for (const l of captureLogs) console.log(l)
  69 | 
  70 |   // Check the DOM for capture count
  71 |   const bodyText = await page.textContent('body')
  72 |   console.log('Body text includes captures:', bodyText?.includes('1 captures'))
  73 | 
  74 |   // Verify via WASM directly
  75 |   const wasmState = await page.evaluate(() => {
  76 |     // Access the WASM engine through the module scope
  77 |     return {
  78 |       bodyText: document.body.innerText
  79 |     }
  80 |   })
  81 |   console.log('Page text:', wasmState.bodyText)
  82 | 
  83 |   // Look for "1 captures" in the page
  84 |   const captureText = await page.locator('text=/1 capture/i').count()
  85 |   console.log('Found "1 capture" on page:', captureText > 0)
  86 | 
  87 |   // Final check: the position (0,0) should be empty now on the canvas
  88 |   // We can check by looking at the canvas pixel color at that position
  89 |   await page.screenshot({ path: 'test-results/06-final-state.png', fullPage: true })
  90 | 
  91 |   // Print all logs for debugging
  92 |   console.log('\n=== ALL CONSOLE LOGS ===')
  93 |   for (const l of logs) console.log(l)
  94 | })
  95 | 
```