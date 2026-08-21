const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const shotDir = 'C:\\Users\\sakth\\AppData\\Local\\Temp\\claude\\d--Development-UpFreq\\9bf2b1ab-c0e4-43be-96c2-85c2ee42dd6e\\scratchpad';
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  const createRes = await page.request.post('http://localhost:3000/api/robot-designs', { data: { name: 'FK+UX Test' } });
  const design = await createRes.json();
  await page.goto(`http://localhost:3000/robots/${design.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('--- Uploading 3 files ---');
  const fileInput = page.locator('input[type="file"][multiple]');
  await fileInput.setInputFiles([
    'D:\\Development\\UpFreq\\webapp\\stl_demos\\burger_base.stl',
    'D:\\Development\\UpFreq\\webapp\\stl_demos\\left_tire.stl',
    'D:\\Development\\UpFreq\\webapp\\stl_demos\\right_tire.stl',
  ]);
  await page.waitForFunction(() => document.body.innerText.includes('Links (3)'), undefined, { timeout: 60000 });

  const scaleButtons = page.locator('button[title*="Looks huge"]');
  const count = await scaleButtons.count();
  for (let i = 0; i < count; i++) {
    await scaleButtons.nth(0).click();
    await page.waitForTimeout(300);
  }

  await page.getByTitle(/AI Generate Structure/).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /^Generate$/i }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Proposed'), undefined, { timeout: 100000 });
  await page.getByRole('button', { name: /Confirm & Apply/i }).click();
  await page.waitForTimeout(2500);

  await page.screenshot({ path: `${shotDir}\\120-fk-positioned-robot.png`, fullPage: false });

  // Check cursor style on the viewer
  const cursorStyle = await page.locator('div.cursor-grab, div.cursor-grabbing').first().evaluate(el => getComputedStyle(el).cursor).catch(() => 'NOT FOUND');
  console.log('Viewer cursor style:', cursorStyle);

  // Check sticky positioning
  const stickyCheck = await page.evaluate(() => {
    const el = document.querySelector('.lg\\:sticky');
    if (!el) return 'NOT FOUND';
    const style = getComputedStyle(el);
    return { position: style.position, top: style.top };
  });
  console.log('Sticky viewer computed style:', JSON.stringify(stickyCheck));

  // Scroll down and confirm viewer stays visible
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shotDir}\\121-after-scroll.png`, fullPage: false });

  console.log('\n--- console errors ---');
  console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');

  await browser.close();
})().catch((err) => {
  console.error('SCRIPT FAILED:', err.message);
  process.exit(1);
});
