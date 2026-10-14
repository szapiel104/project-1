import { expect, it } from 'vitest';
import { UNITS } from '../src/data/units';
import { FP, createGame } from '../src/sim/state';
import { step } from '../src/sim/step';
it('łucznicy z wież w osadzie w murach: każdy rozkaz do przodu przesuwa oddział (nie stoją, nie czekają w kółko)', () => {
  const g = createGame(5, '1v1', 1, true);
  const mine = g.soldiers.filter((s) => s.owner === 0 && !UNITS[s.kind]!.guard && UNITS[s.kind]!.range);
    const sel = mine.slice(0, 8);
  const cx = Math.round(sel.reduce((a, s) => a + (s.px >> 8), 0) / sel.length), cy = Math.round(sel.reduce((a, s) => a + (s.py >> 8), 0) / sel.length);
  const keep = g.buildings.find((b) => b.owner === 0 && b.type === 0)!;
  // kierunek od twierdzy na zewnątrz
  const dx = Math.sign(cx - keep.x) || 1, dy = Math.sign(cy - keep.y);
  for (let k = 0; k < 4; k++) {
    const mx = sel.reduce((a, s) => a + s.px / FP, 0) / sel.length, my = sel.reduce((a, s) => a + s.py / FP, 0) / sel.length;
    const tx = Math.round(mx + dx * 6), ty = Math.round(my + dy * 6);
    step(g, [{ type: 'move', player: 0, ids: sel.map((s) => s.id), x: tx, y: ty }]);
    for (let t = 0; t < 120; t++) step(g, []);
    const nx = sel.reduce((a, s) => a + s.px / FP, 0) / sel.length, ny = sel.reduce((a, s) => a + s.py / FP, 0) / sel.length;
    // po 12 s każdy rozkaz daje wyraźny postęp w stronę celu (wcześniej: stali albo się cofali)
    expect((nx - mx) * dx + (ny - my) * dy).toBeGreaterThan(3);
  }
});
