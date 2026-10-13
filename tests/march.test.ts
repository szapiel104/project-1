import { describe, expect, it } from 'vitest';
import { unitIndex } from '../src/data/units';
import { walkable } from '../src/sim/path';
import { deserialize, serialize } from '../src/sim/save';
import { FP, createGame as realGame, playerKeep, stateHash, type GameState, type Soldier } from '../src/sim/state';
import { step } from '../src/sim/step';

const createGame = (seed: number): GameState => { const g = realGame(seed); for (const p of g.players) { p.bot = false; p.guards = 0; } g.soldiers = []; return g; };

const mk = (g: GameState, owner: number, kind: string, x: number, y: number, extra: Partial<Soldier> = {}): Soldier => {
  const s: Soldier = { id: g.nextId++, owner, kind: unitIndex(kind), px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: kind === 'archer' ? 40 : 60, goal: -1, wait: 0, target: 0, cd: 0, ...extra };
  g.soldiers.push(s);
  return s;
};

/** Pole (x, y), od którego prostokąt w × h jest cały przechodni, szukane od twierdzy w górę mapy */
function openArea(g: GameState, w: number, h: number): { x: number; y: number } {
  const keep = playerKeep(g, 0)!, W = g.map.width;
  for (let r = 4; r < 40; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x0 = keep.x + dx, y0 = keep.y + dy;
        let ok = x0 > 0 && y0 > 0 && x0 + w < W && y0 + h < g.map.height;
        for (let y = y0; ok && y < y0 + h; y++) for (let x = x0; ok && x < x0 + w; x++) if (!walkable(g, y * W + x, 0)) ok = false;
        if (ok) return { x: x0, y: y0 };
      }
  throw new Error('brak wolnego miejsca');
}

const spread = (list: Soldier[]): number => {
  let m = 0;
  for (const a of list) for (const b of list) m = Math.max(m, Math.abs(a.px - b.px) / FP, Math.abs(a.py - b.py) / FP);
  return m;
};

describe('zwarty szyk w marszu', () => {
  it('oddział idzie razem: przez cały marsz nie rozłazi się szerzej niż szyk, na końcu każdy na swoim miejscu', () => {
    const g = createGame(7);
    const a = openArea(g, 14, 4);
    // szybcy włócznicy i wolniejsi łucznicy w jednej linii
    const list = [0, 1, 2, 3, 4, 5].map((i) => mk(g, 0, i % 2 ? 'archer' : 'spearman', a.x + i * 2, a.y + 1));
    const ids = list.map((s) => s.id);
    // cel daleko: szukamy przechodniego pola ~20 pól dalej
    const W = g.map.width;
    let target = -1;
    for (let d = 20; d < 40 && target < 0; d++) for (const [dx, dy] of [[0, d], [0, -d], [d, 0], [-d, 0]] as const) {
      const t = (a.y + 1 + dy) * W + a.x + 6 + dx;
      if (t > 0 && t < g.map.tiles.length && walkable(g, t, 0)) { target = t; break; }
    }
    expect(target).toBeGreaterThan(0);
    step(g, [{ type: 'move', player: 0, ids, x: target % W, y: Math.floor(target / W), form: 1 }]);
    expect(g.marches?.length).toBe(1);
    let worst = 0, ticks = 0;
    // po zbiórce (pierwsze kilkadziesiąt ticków) szyk ma się trzymać razem
    for (; ticks < 1500 && list.some((s) => s.goal >= 0 || s.path.length); ticks++) {
      step(g, []);
      if (ticks > 60 && g.marches?.length) worst = Math.max(worst, spread(list));
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(5); // blok 3×2 z łucznikami: najwyżej kilka pól między skrajnymi
    expect(g.marches?.length ?? 0).toBe(0);
    for (const s of list) expect(s.goal).toBe(-1);
    // wszyscy blisko celu
    const tx = target % W, ty = Math.floor(target / W);
    for (const s of list) expect(Math.max(Math.abs((s.px >> 8) - tx), Math.abs((s.py >> 8) - ty))).toBeLessThanOrEqual(3);
  });

  it('marsz zapisuje się i wczytuje bez zmiany przebiegu', () => {
    const g = createGame(7);
    const a = openArea(g, 10, 4);
    const ids = [0, 1, 2, 3].map((i) => mk(g, 0, 'spearman', a.x + i * 2, a.y + 1).id);
    step(g, [{ type: 'move', player: 0, ids, x: a.x + 9, y: a.y + 2 }]);
    expect(g.marches?.length).toBe(1);
    for (let i = 0; i < 10; i++) step(g, []);
    const copy = deserialize(JSON.parse(JSON.stringify(serialize(g, '1v1'))))!;
    for (let i = 0; i < 30; i++) { step(g, []); step(copy, []); }
    expect(stateHash(copy)).toBe(stateHash(g));
  });

  it('atak w marszu w szyku: oddział staje, bije wroga na drodze i idzie dalej', () => {
    const g = createGame(7);
    const a = openArea(g, 14, 4);
    const ids = [0, 1, 2].map((i) => mk(g, 0, 'spearman', a.x + 1, a.y + i).id);
    const foe = mk(g, 1, 'spearman', a.x + 6, a.y + 1, { hp: 12, stance: 2 });
    step(g, [{ type: 'move', player: 0, ids, x: a.x + 12, y: a.y + 1, amove: true }]);
    expect(g.marches?.length).toBe(1);
    for (let i = 0; i < 900; i++) step(g, []);
    expect(g.soldiers.some((s) => s.id === foe.id)).toBe(false);
    for (const id of ids) { const s = g.soldiers.find((x) => x.id === id)!; expect(Math.abs((s.px >> 8) - (a.x + 12))).toBeLessThanOrEqual(2); }
  });

  it('pojedynczy żołnierz albo krótki marsz idzie po staremu, bez szyku', () => {
    const g = createGame(7);
    const a = openArea(g, 6, 3);
    const s = mk(g, 0, 'spearman', a.x, a.y);
    step(g, [{ type: 'move', player: 0, ids: [s.id], x: a.x + 5, y: a.y + 1 }]);
    expect(g.marches?.length ?? 0).toBe(0);
  });
});

describe('ranni', () => {
  it('ciężko ranny cofa się z walki, idzie do twierdzy, leczy się i wraca na swoje miejsce', () => {
    const g = createGame(7);
    const a = openArea(g, 8, 3);
    const W = g.map.width, keep = playerKeep(g, 0)!;
    const hold = (a.y + 1) * W + a.x + 2;
    const s = mk(g, 0, 'spearman', a.x + 2, a.y + 1, { hp: 15, stance: 1, hold });
    const foe = mk(g, 1, 'spearman', a.x + 3, a.y + 1, { hp: 600, stance: 2 });
    let wentAway = false, healed = false;
    for (let i = 0; i < 4000; i++) {
      step(g, []);
      if (s.hp <= 0) break;
      if (s.wounded) wentAway = true;
      // ranny za szykiem czeka, dopóki widzi wroga; po wygranej (wróg znika) idzie do twierdzy
      if (i === 80) { expect(s.wounded).toBe(1); expect(Math.abs(s.px - foe.px)).toBeGreaterThan(2 * FP); g.soldiers = g.soldiers.filter((o) => o !== foe); }
      if (wentAway && !s.wounded && s.hp >= 54) { healed = true; break; }
    }
    expect(s.hp).toBeGreaterThan(0);
    expect(wentAway).toBe(true);
    expect(healed).toBe(true);
    expect(s.goal === hold || (s.py >> 8) * W + (s.px >> 8) === hold).toBe(true);
    void keep;
  });

  it('w postawie „stój” ranny nie ustępuje', () => {
    const g = createGame(7);
    const a = openArea(g, 8, 3);
    const s = mk(g, 0, 'spearman', a.x + 2, a.y + 1, { hp: 15, stance: 2 });
    mk(g, 1, 'spearman', a.x + 3, a.y + 1, { hp: 600, stance: 2 });
    for (let i = 0; i < 60 && s.hp > 0; i++) step(g, []);
    expect(s.wounded ?? 0).toBe(0);
  });

  it('przy własnej twierdzy rany się goją, daleko od niej nie', () => {
    const g = createGame(7);
    const keep = playerKeep(g, 0)!;
    const W = g.map.width;
    // pole tuż przy twierdzy
    let near = -1;
    for (let y = keep.y - 1; y <= keep.y + 3 && near < 0; y++) for (let x = keep.x - 1; x <= keep.x + 3; x++) if (walkable(g, y * W + x, 0)) { near = y * W + x; break; }
    const s = mk(g, 0, 'spearman', near % W, Math.floor(near / W), { hp: 20 });
    const a = openArea(g, 3, 3);
    const far = mk(g, 0, 'spearman', a.x + 1, a.y + 1, { hp: 20 });
    const farFromKeep = Math.max(Math.abs(a.x - keep.x), Math.abs(a.y - keep.y)) > 6;
    for (let i = 0; i < 300; i++) step(g, []);
    expect(s.hp).toBeGreaterThan(30);
    if (farFromKeep) expect(far.hp).toBe(20);
  });
});
