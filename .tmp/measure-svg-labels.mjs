import { chromium } from 'playwright';
import { resolve } from 'node:path';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
await page.goto(`file:///${resolve('.tmp/floor-pdf-visual-check.html').replaceAll('\\', '/')}`);
await page.waitForTimeout(500);
const metrics = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('g.wfp-seat-label')];
  return labels.slice(0, 12).map((label) => {
    const rect = label.querySelector('rect');
    const text = label.querySelector('text');
    const textBox = text.getBBox();
    const rectBox = rect.getBBox();
    const computed = getComputedStyle(text);
    return {
      guestId: label.getAttribute('data-guest-id'),
      className: label.getAttribute('class'),
      rect: { x: rectBox.x, y: rectBox.y, width: rectBox.width, height: rectBox.height },
      text: { x: textBox.x, y: textBox.y, width: textBox.width, height: textBox.height },
      attrFontSize: text.getAttribute('font-size'),
      inlineStyle: text.getAttribute('style'),
      computedFontSize: computed.fontSize,
    };
  });
});
console.log(JSON.stringify(metrics, null, 2));
await browser.close();
