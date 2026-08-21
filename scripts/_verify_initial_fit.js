const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const shotDir = 'C:\\Users\\sakth\\AppData\\Local\\Temp\\claude\\d--Development-UpFreq\\9bf2b1ab-c0e4-43be-96c2-85c2ee42dd6e\\scratchpad';

  const createRes = await page.request.post('http://localhost:3000/api/robot-designs', { data: { name: 'Initial Fit Test' } });
  const design = await createRes.json();
  await page.goto(`http://localhost:3000/robots/${design.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const fileInput = page.locator('input[type="file"][multiple]');
  await fileInput.setInputFiles(['D:\\Development\\UpFreq\\webapp\\stl_demos\\burger_base.stl']);
  await page.waitForFunction(() => document.body.innerText.includes('Links (1)'), undefined, { timeout: 60000 });

  for (const delay of [500, 1500, 3000, 5000]) {
    await page.waitForTimeout(delay === 500 ? 500 : 1000);
    await page.screenshot({ path: `${shotDir}\\140-fit-at-${delay}ms.png`, fullPage: false });
    console.log('Screenshotted at cumulative delay', delay);
  }

  await browser.close();
})().catch((err) => {
  console.error('SCRIPT FAILED:', err.message);
  process.exit(1);
});
