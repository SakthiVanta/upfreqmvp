const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const shotDir = 'C:\\Users\\sakth\\AppData\\Local\\Temp\\claude\\d--Development-UpFreq\\9bf2b1ab-c0e4-43be-96c2-85c2ee42dd6e\\scratchpad';
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  const createRes = await page.request.post('http://localhost:3000/api/robot-designs', { data: { name: 'Pivot Test' } });
  const design = await createRes.json();
  await page.goto(`http://localhost:3000/robots/${design.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const fileInput = page.locator('input[type="file"][multiple]');
  await fileInput.setInputFiles(['D:\\Development\\UpFreq\\webapp\\stl_demos\\burger_base.stl']);
  await page.waitForFunction(() => document.body.innerText.includes('Links (1)'), undefined, { timeout: 60000 });
  await page.waitForTimeout(3500);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.screenshot({ path: `${shotDir}\\160-pivot-before.png`, fullPage: false });

  // Small drag: if pivoting around the true center, the mesh should stay
  // roughly centered in the canvas while rotating in place. If pivoting
  // around a wrong point (e.g. world origin while the mesh center is
  // offset from it), a small drag would swing the mesh noticeably
  // off-center or out of frame.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(cx - 80 * (i / 15), cy - 40 * (i / 15));
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shotDir}\\161-pivot-after-small-drag.png`, fullPage: false });

  // Larger drag to confirm full free rotation still works (no stuck pole).
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 25; i++) {
    await page.mouse.move(cx + 250 * (i / 25), cy - 300 * (i / 25));
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shotDir}\\162-pivot-after-large-drag.png`, fullPage: false });

  console.log('\n--- console errors ---');
  console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');

  await browser.close();
})().catch((err) => {
  console.error('SCRIPT FAILED:', err.message);
  process.exit(1);
});
