import { chromium } from 'playwright-core';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const uid = '11111111-1111-1111-1111-111111111111';
const sess = { access_token: 'x.y.z', token_type: 'bearer', expires_in: 360000, expires_at: Math.floor(Date.now() / 1000) + 360000, refresh_token: 'r', user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'a@b.pl', user_metadata: { avatar: 0, nick: 'RebaZius' }, app_metadata: {}, created_at: '2026-01-01' } };
for (const [w, h] of [[2000, 719], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript((s) => localStorage.setItem('sb-psccakqdinwqloozdsyf-auth-token', JSON.stringify(s)), sess);
  await ctx.route(/supabase\.co/, (r) => r.request().url().includes('realtime') ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('profiles') ? JSON.stringify([{ id: uid, nick: 'RebaZius', avatar: 0 }]) : '[]' }));
  const p = await ctx.newPage();
  await p.goto('http://localhost:4173/?hd=1'); await p.waitForTimeout(7000);
  console.log(w, JSON.stringify(await p.evaluate(() => ['.menu-account', '.menu-bar', '.menu-head', '.menu-fine'].map((q) => { const r = document.querySelector(q)?.getBoundingClientRect(); return r && [q, Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom)]; }))));
  await p.screenshot({ path: `${process.argv[2]}/m-${w}.png` });
  await ctx.close();
}
await b.close();
