// pomiar: najdłuższe zatrzymanie strony przy „Losuj inną mapę” (Chromium bez okna)
import { chromium } from 'playwright-core';
import { preview } from 'vite';
const dist = process.argv[2] || 'dist';
const server = await preview({ build: { outDir: dist }, preview: { port: 4190, strictPort: false }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { localStorage.setItem('project1.lang', 'pl'); window.__long = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); });
await page.goto(base, { waitUntil: 'load', timeout: 120000 });
await page.getByRole('button', { name: 'Nowa gra' }).first().click({ timeout: 120000 });
await page.getByRole('button', { name: 'Losuj inną mapę' }).waitFor({ timeout: 60000 });
await page.waitForTimeout(8000);
const res = [];
for (let i = 0; i < 2; i++) {
  await page.evaluate(() => { window.__long = []; });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Losuj inną'))?.click());
  await page.waitForTimeout(9000);
  res.push(await page.evaluate(() => window.__long.slice().sort((a, b) => b - a).slice(0, 4)));
}
console.log(dist, JSON.stringify(res));
await browser.close(); await server.close();
