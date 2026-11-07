/**
 * Automatyczny „gracz” do testów wydajności i wyglądu (Michał 7.11.2026: „zrób bota, który kieruje kamerą, jakby
 * się grało normalnie”). Tylko w trybie testowym (?test=1). W konsoli: `await __tour()` → raport (FPS średnio,
 * najgorsza klatka, 95. percentyl czasu klatki, rysowania przy kilku przybliżeniach, błędy z dziennika).
 *
 * Przebieg: dzień, kilkanaście budynków wokół twierdzy (budują się na oczach), chłopi, potem kamera: przelot dookoła
 * osady na kilku wysokościach, szybkie przybliżanie i oddalanie, przesuwanie po mapie, na koniec spacer z ziemi.
 */
type T = {
  give(n: number): void; build(id: string): { x: number; y: number } | null; run(n: number): void; hour(h: number): void;
  home(): { x: number; y: number }; cam(x: number, y: number, dist: number, yaw?: number, pitch?: number, lift?: number): void;
  peasants?(n: number): void; speed?(n: number): void;
};
type W = Window & { __test?: T; __perf?: () => Record<string, unknown>; __drawStat?: () => Promise<{ obraz: number; cienie: number }>;
  __walk?: (x: number, y: number, yaw: number, pitch: number) => void; __errors?: () => { errors: number; warnings: number } };

const frame = (): Promise<number> => new Promise((ok) => requestAnimationFrame((t) => ok(t)));

/** Mierzy czasy klatek przez `ms`, wywołując `step(postęp 0..1)` co klatkę */
async function segment(ms: number, step: (k: number) => void): Promise<number[]> {
  const out: number[] = [];
  let last = await frame();
  const t0 = last;
  for (;;) {
    const now = await frame();
    out.push(now - last);
    last = now;
    const k = (now - t0) / ms;
    if (k >= 1) break;
    step(k);
  }
  return out;
}

export async function tour(opts: { buildings?: number } = {}): Promise<Record<string, unknown>> {
  const w = window as W, T = w.__test!;
  const h = T.home();
  T.hour(11);
  T.give(999999);
  const ids = ['house', 'woodcutter', 'farm', 'bakery', 'well', 'granary', 'storehouse', 'barracks', 'tavern', 'smith', 'chapel', 'market', 'mill', 'quarry', 'stable', 'tanner', 'tower', 'archery'];
  const n = opts.buildings ?? 24;
  let built = 0;
  for (let i = 0; i < n; i++) { T.give(999999); if (T.build(ids[i % ids.length]!)) built++; }
  T.peasants?.(30);
  T.run(60); // place budowy ruszają (część stoi jeszcze w rusztowaniach — też do sprawdzenia)
  const report: Record<string, unknown> = { budynki: built };
  const all: number[] = [];
  const seg = async (name: string, ms: number, step: (k: number) => void): Promise<void> => {
    const f = await segment(ms, step);
    all.push(...f);
    const s = [...f].sort((a, b) => a - b);
    report[name] = { fps: Math.round(1000 / (f.reduce((a, b) => a + b, 0) / f.length)), najgorsza: Math.round(s[s.length - 1] ?? 0), p95: Math.round(s[Math.floor(s.length * 0.95)] ?? 0) };
  };
  // 1. przelot dookoła osady na trzech wysokościach
  for (const dist of [12, 30, 55]) await seg(`dookoła ${dist}`, 4000, (k) => T.cam(h.x, h.y + 3, dist, k * Math.PI * 2, dist > 40 ? 50 : 38));
  // 2. szybkie przybliżanie i oddalanie
  await seg('zoom', 4000, (k) => T.cam(h.x, h.y + 3, 6 + 50 * Math.abs(Math.sin(k * Math.PI * 2)), 0.6, 40));
  // 3. przesuwanie po mapie (jak strzałkami)
  await seg('przesuw', 4000, (k) => T.cam(h.x - 30 + 60 * k, h.y + 3 + 15 * Math.sin(k * 6), 32, 0.4, 45));
  // 4. budowa w biegu: symulacja idzie, kamera stoi nad osadą
  await seg('budowa', 4000, () => { T.run(2); T.cam(h.x, h.y + 3, 22, 0.8, 42); });
  // 5. spacer z ziemi
  if (w.__walk) { w.__walk(h.x, h.y + 4, Math.PI, 0.1); await seg('spacer', 3000, () => undefined); }
  const s = [...all].sort((a, b) => a - b);
  report['RAZEM'] = { fps: Math.round(1000 / (all.reduce((a, b) => a + b, 0) / all.length)), najgorsza: Math.round(s[s.length - 1] ?? 0), p95: Math.round(s[Math.floor(s.length * 0.95)] ?? 0), klatek: all.length };
  // rysowania przy trzech przybliżeniach
  for (const dist of [10, 30, 55]) {
    T.cam(h.x, h.y + 3, dist, 0.7, 42);
    for (let i = 0; i < 20; i++) await frame();
    const d = await w.__drawStat?.();
    if (d) report[`rysowania ${dist}`] = `${d.obraz} obraz + ${d.cienie} cień`;
  }
  const p = w.__perf?.() ?? {};
  report['jakość'] = p['jakość'];
  report['rozdzielczość'] = p['rozdzielczość'];
  report['karta'] = p['karta graficzna'];
  report['błędy'] = w.__errors?.().errors;
  return report;
}

(window as unknown as { __tour: typeof tour }).__tour = tour;
