import { it } from 'vitest';
import { BUILDINGS } from '../../src/data/buildings';
import { UNITS } from '../../src/data/units';
import { clockAt } from '../../src/sim/clock';
import { walkable } from '../../src/sim/path';
import { deserialize, serialize } from '../../src/sim/save';
import { createGame, FP, stateHash, type GameState } from '../../src/sim/state';
import { step } from '../../src/sim/step';

/**
 * Przegląd długiej gry: same boty, kilka godzin czasu gry, co chwilę sprawdzamy, czy nic się nie zawiesiło.
 * Wynik: lista podejrzanych sytuacji (kto, gdzie, od kiedy) i statystyki gry.
 */
const SEEDS = (process.env.SOAK_SEEDS ?? '11,22').split(',').map(Number);
const HOURS = Number(process.env.SOAK_HOURS ?? 2);
const PRESET = (process.env.SOAK_PRESET ?? '1v1') as '1v1';
const TICKS = Math.round(HOURS * 3600 * 10);

interface Issue { kind: string; tick: number; text: string }

function soak(seed: number): void {
  const g = createGame(seed, PRESET, 2, false, []);
  for (const p of g.players) p.bot = true;
  const issues: Issue[] = [];
  const once = new Set<string>();
  /** Każdy przypadek (rodzaj + kto) zgłaszany raz, najwyżej 15 na rodzaj */
  const add = (kind: string, text: string, who: number | string = text): void => {
    const key = `${kind}:${who}`;
    if (once.has(key)) return;
    once.add(key);
    if (issues.filter((i) => i.kind === kind).length < 15) issues.push({ kind, tick: g.tick, text });
  };
  const W = g.map.width;
  // ostatnie położenie i od kiedy się nie rusza (ludzie i żołnierze)
  const still = new Map<number, { x: number; y: number; since: number; phase: number }>();
  const siteSeen = new Map<number, { build: number; since: number }>();
  const t0 = Date.now();
  let simMs = 0, maxStep = 0;
  const slow: string[] = [];
  for (let i = 0; i < TICKS; i++) {
    const a = performance.now();
    step(g, []);
    const d = performance.now() - a;
    simMs += d; if (d > maxStep) maxStep = d;
    if (d > 25 && slow.length < 12) slow.push(`t=${g.tick} ${d.toFixed(0)}ms`);
    if (g.tick % 50 !== 0) continue;
    // ---- ludzie ----
    for (const u of g.units) {
      if (!Number.isFinite(u.px) || !Number.isFinite(u.py)) add('nan', `chłop ${u.id} ma złe położenie`);
      const s = still.get(u.id);
      if (!s || s.x !== u.px || s.y !== u.py || s.phase !== u.phase) { still.set(u.id, { x: u.px, y: u.py, since: g.tick, phase: u.phase }); continue; }
      // stoi w miejscu z drogą do przejścia: zawieszony w marszu
      if (u.path.length && g.tick - s.since > 300) add('chłop-stoi-z-drogą', `chłop ${u.id} faza ${u.phase} stoi ${(g.tick - s.since) / 10}s na (${u.px >> 8},${u.py >> 8}) z drogą ${u.path.length} pól, wait=${u.wait}`, u.id);
      // ta sama faza w ruchu bez drogi długo
      const moving = [1, 2, 3, 5, 7, 8, 10, 11, 12, 13, 15, 16, 18, 19, 21].includes(u.phase);
      if (moving && !u.path.length && g.tick - s.since > 1200) add('chłop-zawieszony', `chłop ${u.id} faza ${u.phase} bez drogi od ${(g.tick - s.since) / 10}s na (${u.px >> 8},${u.py >> 8}), job=${u.job} (${BUILDINGS[g.buildings.find((b) => b.id === u.job)?.type ?? -1]?.id ?? '-'}) target=${u.target} wait=${u.wait}`, u.id);
    }
    // ---- żołnierze ----
    for (const s of g.soldiers) {
      if (!Number.isFinite(s.px) || !Number.isFinite(s.py) || !Number.isFinite(s.hp)) add('nan', `żołnierz ${s.id} ma złe liczby`);
      const t = (s.py >> 8) * W + (s.px >> 8);
      if (!s.up && !walkable(g, t, s.owner) && g.occupancy[t] && !BUILDINGS[g.buildings.find((b) => b.id === g.occupancy[t])?.type ?? 0]?.gate) add('żołnierz-w-ścianie', `żołnierz ${s.id} (${UNITS[s.kind]!.id}) stoi na zajętym polu (${s.px >> 8},${s.py >> 8})`, s.id);
      const k = -s.id;
      const r = still.get(k);
      if (!r || r.x !== s.px || r.y !== s.py || r.phase !== s.goal) { still.set(k, { x: s.px, y: s.py, since: g.tick, phase: s.goal }); continue; }
      const foe = s.target ? g.soldiers.find((o) => o.id === s.target) : undefined;
      if (foe && !s.up && g.tick - r.since > 600 && Math.max(Math.abs(foe.px - s.px), Math.abs(foe.py - s.py)) > 2 * FP + (UNITS[s.kind]!.range ?? 0) * FP) add('pat', `żołnierz ${s.id} (${UNITS[s.kind]!.id}) od ${(g.tick - r.since) / 10}s stoi na (${s.px >> 8},${s.py >> 8}) z celem ${foe.id} (${UNITS[foe.kind]!.id}) na (${foe.px >> 8},${foe.py >> 8}), nie podchodzi`, s.id);
      if (s.goal >= 0 && !s.target && g.tick - r.since > 600) add('żołnierz-utknął', `żołnierz ${s.id} (${UNITS[s.kind]!.id}${s.wounded ? ', ranny' : ''}) ma cel (${s.goal % W},${Math.floor(s.goal / W)}), stoi ${(g.tick - r.since) / 10}s na (${s.px >> 8},${s.py >> 8}), droga ${s.path.length}, marsz ${s.slot ? 'tak' : 'nie'}`, s.id);
    }
    // ---- budowy ----
    for (const b of g.buildings) {
      if (!b.build) { siteSeen.delete(b.id); continue; }
      const s = siteSeen.get(b.id);
      if (!s || s.build !== b.build) { siteSeen.set(b.id, { build: b.build, since: g.tick }); continue; }
      if (g.tick - s.since > 6000) add('budowa-stoi', `budowa ${BUILDINGS[b.type]!.id} gracza ${b.owner} bez postępu od ${(g.tick - s.since) / 10}s (zostało ${b.build}), dostarczono ${b.delivered ?? 0}/${b.loads ?? 0}, wolnych chłopów gracza ${g.units.filter((u) => u.owner === b.owner && !u.job).length}`, b.id);
    }
    // ---- zgodność zapisu i sieci: kopia z zapisu liczy dalej to samo ----
    if (g.tick % 36000 === 0) {
      const copy = deserialize(JSON.parse(JSON.stringify(serialize(g, PRESET))))!;
      const probe = deserialize(JSON.parse(JSON.stringify(serialize(g, PRESET))))!;
      for (let j = 0; j < 300; j++) { step(copy, []); step(probe, []); }
      if (stateHash(copy) !== stateHash(probe)) add('rozjazd', `po wczytaniu zapisu dwie kopie liczą różnie (tick ${g.tick})`);
    }
  }
  const c = clockAt(g.tick);
  const lines = [
    `=== ziarno ${seed}, ${HOURS} h gry (${TICKS} ticków), dzień ${c.day}, czas liczenia ${(Date.now() - t0) / 1000 | 0}s, symulacja średnio ${(simMs / TICKS).toFixed(2)} ms/tick, najdłużej ${maxStep.toFixed(1)} ms`,
    ...g.players.map((p) => `gracz ${p.id}: ${p.defeated ? 'PRZEGRAŁ' : 'gra'}, ludzie ${g.units.filter((u) => u.owner === p.id).length}, wojsko ${g.soldiers.filter((s) => s.owner === p.id).length}, budynki ${g.buildings.filter((b) => b.owner === p.id && !b.ruined).length}, popularność ${p.popularity}, zabici ${p.stats.kills}, straceni ${p.stats.lost}, ofiary wilków ${p.wolfKills ?? 0}`),
    `wolne ticki: ${slow.join(', ') || 'brak'}`,
    `wilki teraz ${g.wolves.length}, ciała ${g.corpses.length}, drogi w planie ${[...g.roadPlan].filter(Boolean).length}`,
    `problemy (${issues.length}):`,
    ...issues.map((i) => `  [${i.kind}] t=${i.tick} (${(i.tick / 10 / 60).toFixed(1)} min): ${i.text}`),
  ];
  console.log(lines.join('\n'));
}

it('długa gra bot kontra bot', () => { for (const s of SEEDS) soak(s); });
