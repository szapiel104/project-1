/**
 * Próbkowanie procesora z samej strony (JS Self-Profiling API), do szukania, gdzie ucieka czas klatki na prawdziwym
 * zapisie gracza, bez DevTools (Michał 9.11.2026: „fps 41, dalej muli”). Działa lokalnie (`npx vite` wysyła nagłówek
 * Document-Policy: js-profiling). W konsoli: `JSON.stringify(await __prof(8))` — 8 s gry, potem lista funkcji, które
 * same zjadają najwięcej czasu (self) i razem z tym, co wywołują (total), w % wszystkich próbek.
 */
interface Frame { name: string; line?: number; column?: number; resourceId?: number }
interface Stack { frameId: number; parentId?: number }
interface Trace { resources: string[]; frames: Frame[]; stacks: Stack[]; samples: { timestamp: number; stackId?: number }[] }
type ProfilerCtor = new (o: { sampleInterval: number; maxBufferSize: number }) => { stop(): Promise<Trace> };

export async function prof(seconds = 8): Promise<unknown> {
  const P = (window as unknown as { Profiler?: ProfilerCtor }).Profiler;
  if (!P) return 'Brak Profiler API — uruchom grę z `npx vite` (nagłówek Document-Policy: js-profiling) w Chrome';
  let p: InstanceType<ProfilerCtor>;
  try { p = new P({ sampleInterval: 1, maxBufferSize: 200000 }); } catch (e) { return `Profiler niedostępny: ${String(e)}`; }
  await new Promise((r) => setTimeout(r, seconds * 1000));
  const t = await p.stop();
  const label = (f: Frame): string => `${f.name || '(anon)'} ${(t.resources[f.resourceId ?? -1] ?? '').split('/').pop()?.split('?')[0] ?? ''}:${f.line ?? ''}`;
  const self = new Map<string, number>(), total = new Map<string, number>();
  let n = 0, idle = 0;
  for (const s of t.samples) {
    n++;
    if (s.stackId === undefined) { idle++; continue; }
    let st: Stack | undefined = t.stacks[s.stackId];
    const seen = new Set<string>();
    let first = true;
    while (st) {
      const k = label(t.frames[st.frameId]!);
      if (first) { self.set(k, (self.get(k) ?? 0) + 1); first = false; }
      if (!seen.has(k)) { seen.add(k); total.set(k, (total.get(k) ?? 0) + 1); }
      st = st.parentId === undefined ? undefined : t.stacks[st.parentId];
    }
  }
  const pct = (v: number): string => `${((v * 100) / Math.max(1, n)).toFixed(1)}%`;
  const top = (m: Map<string, number>, k: number): string[] => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([name, v]) => `${pct(v)} ${name}`);
  return { próbki: n, bezczynnie: pct(idle), self: top(self, 40), total: top(total, 50) };
}
(window as unknown as { __prof: typeof prof }).__prof = prof;
