const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const shotDir = 'C:\\Users\\sakth\\AppData\\Local\\Temp\\claude\\d--Development-UpFreq\\9bf2b1ab-c0e4-43be-96c2-85c2ee42dd6e\\scratchpad';
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  const createRes = await page.request.post('http://localhost:3000/api/robot-designs', { data: { name: 'Drag Test' } });
  const design = await createRes.json();
  await page.goto(`http://localhost:3000/robots/${design.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const fileInput = page.locator('input[type="file"][multiple]');
  await fileInput.setInputFiles(['D:\\Development\\UpFreq\\webapp\\stl_demos\\burger_base.stl']);
  await page.waitForFunction(() => document.body.innerText.includes('Links (1)'), undefined, { timeout: 60000 });
  await page.waitForTimeout(1500);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  console.log('Canvas box:', JSON.stringify(box));

  await page.screenshot({ path: `${shotDir}\\130-before-drag.png`, fullPage: false });

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  console.log('--- Dragging diagonally (should tilt AND rotate) ---');
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  // Multiple small steps so TrackballControls/OrbitControls sees a real drag gesture, not a teleport
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(cx - 200 * (i / 20), cy - 150 * (i / 20));
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shotDir}\\131-after-drag-1.png`, fullPage: false });

  console.log('--- Second drag, opposite diagonal (testing for "stuck" pole) ---');
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(cx + 100 * (i / 20), cy - 250 * (i / 20));
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shotDir}\\132-after-drag-2.png`, fullPage: false });

  console.log('\n--- console errors ---');
  console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');

  await browser.close();
})().catch((err) => {
  console.error('SCRIPT FAILED:', err.message);
  process.exit(1);
});
