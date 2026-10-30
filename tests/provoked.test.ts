import { describe, expect, it } from 'vitest';
import { UNITS, unitIndex } from '../src/data/units';
import { createGame, FP, playerKeep, type GameState, type Soldier } from '../src/sim/state';
import { step } from '../src/sim/step';
import { emptyScene } from '../src/sim/emptyscene';

const soldier = (g: GameState, owner: number, kind: string, x: number, y: number): Soldier => {
  const s: Soldier = { id: g.nextId++, owner, kind: unitIndex(kind), px: x * FP + FP / 2, py: y * FP + FP / 2, path: [], hp: UNITS[unitIndex(kind)]!.hp, goal: -1, wait: 0, target: 0, cd: 0 };
  g.soldiers.push(s);
  return s;
};

describe('odruch na strzały (30.10.2026)', () => {
  it('trafiony z daleka włócznik i jego towarzysz ruszają na łucznika, którego nie widzą', () => {
    const g = createGame(9); emptyScene(g);
    const k = playerKeep(g, 0)!, w = g.map.width, x = (k.door % w) - 6, y = Math.floor(k.door / w) + 18;
    const archer = soldier(g, 0, 'archer', x, y);
    // poza wzrokiem włócznika (6 pól), ale w zasięgu łuku (8 pól)
    const a = soldier(g, 1, 'spearman', x, y + 8), b = soldier(g, 1, 'spearman', x + 1, y + 8);
    const held = soldier(g, 1, 'spearman', x - 1, y + 8); held.stance = 2;
    archer.stance = 2;
    for (let i = 0; i < 120 && (!a.target || !b.target); i++) step(g, []);
    expect(a.target).toBe(archer.id);
    expect(b.target).toBe(archer.id);
    expect(held.target === archer.id && held.py !== (y + 8) * FP + FP / 2).toBe(false); // „stój”: nie biegnie
    const d0 = Math.abs(a.py - archer.py);
    for (let i = 0; i < 30; i++) step(g, []);
    expect(Math.abs(a.py - archer.py)).toBeLessThan(d0); // podbiega
  });
});

describe('spalone ciała (30.10.2026)', () => {
  it('zabity przez maga ognia leży spalony, zabity włócznią — nie', () => {
    const g = createGame(9); emptyScene(g);
    const k = playerKeep(g, 0)!, w = g.map.width, x = (k.door % w) - 6, y = Math.floor(k.door / w) + 18;
    const mage = soldier(g, 0, 'mageFire', x, y); mage.stance = 2;
    const v = soldier(g, 1, 'archer', x, y + 6); v.stance = 2; v.hp = 10;
    for (let i = 0; i < 200 && !g.corpses.some((c) => c.id === v.id); i++) step(g, []);
    expect(g.corpses.find((c) => c.id === v.id)?.burnt).toBe(true);
    const sp = soldier(g, 0, 'spearman', x + 10, y);
    const u = soldier(g, 1, 'archer', x + 11, y); u.hp = 5; u.stance = 2;
    for (let i = 0; i < 200 && !g.corpses.some((c) => c.id === u.id); i++) step(g, []);
    void sp;
    const c = g.corpses.find((cc) => cc.id === u.id);
    expect(c).toBeTruthy();
    expect(c?.burnt).toBeFalsy();
  });
});

describe('palenie ciał przez Maga Płomienia (30.10.2026)', () => {
  it('z włączonym paleniem podchodzi i pali ciało (znika), bez niego nie', () => {
    const g = createGame(9); emptyScene(g);
    const k = playerKeep(g, 0)!, w = g.map.width, x = (k.door % w) - 6, y = Math.floor(k.door / w) + 18;
    const mage = soldier(g, 0, 'mageFire', x, y);
    g.corpses.push({ id: 99901, owner: 1, kind: unitIndex('spearman'), px: (x + 8) * FP + 128, py: (y + 2) * FP + 128, at: g.tick, taken: false });
    for (let i = 0; i < 100; i++) step(g, []);
    expect(g.corpses.some((c) => c.id === 99901)).toBe(true);           // wyłączone: ciało leży
    step(g, [{ type: 'cremate', player: 0, ids: [mage.id], on: true }]);
    let lit = false;
    for (let i = 0; i < 400 && g.corpses.some((c) => c.id === 99901); i++) { step(g, []); if (g.corpses.find((c) => c.id === 99901)?.pyre !== undefined) lit = true; }
    expect(lit).toBe(true);
    expect(g.corpses.some((c) => c.id === 99901)).toBe(false);          // spalone i zniknęło
  });
});

describe('magowie leczą bez walki (30.10.2026)', () => {
  it('mag bez wroga powoli leczy rannego obok, po jednym, aż do pełna', () => {
    const g = createGame(9); emptyScene(g);
    const k = playerKeep(g, 0)!, w = g.map.width, x = (k.door % w) - 6, y = Math.floor(k.door / w) + 18;
    const mage = soldier(g, 0, 'mageWater', x, y);
    const a = soldier(g, 0, 'spearman', x + 2, y); a.hp = 20;
    const b = soldier(g, 0, 'spearman', x + 3, y); b.hp = 50;
    for (let i = 0; i < 30; i++) step(g, []);
    expect(mage.healing).toBe(a.id);                 // najpierw najbardziej ranny
    expect(b.hp).toBe(50);                            // drugi czeka na swoją kolej
    const h0 = a.hp;
    for (let i = 0; i < 50; i++) step(g, []);
    expect(a.hp - h0).toBeGreaterThan(5);             // powoli (ok. 2 na sekundę)
    expect(a.hp - h0).toBeLessThan(15);
    for (let i = 0; i < 600; i++) step(g, []);
    expect(a.hp).toBe(60);
    expect(b.hp).toBe(60);
  });
});

describe('jednego leczy jeden mag (30.10.2026)', () => {
  it('pięciu magów obok jednego rannego: leczy go tylko jeden', () => {
    const g = createGame(9); emptyScene(g);
    const k = playerKeep(g, 0)!, w = g.map.width, x = (k.door % w) - 6, y = Math.floor(k.door / w) + 18;
    const mages = [0, 1, 2, 3, 4].map((i) => soldier(g, 0, 'mageWater', x + i, y));
    const a = soldier(g, 0, 'spearman', x + 2, y + 1); a.hp = 20;
    for (let i = 0; i < 30; i++) step(g, []);
    expect(mages.filter((m) => m.healing === a.id).length).toBe(1);
  });
});
