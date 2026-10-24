import { BUILDINGS, buildingIndex, footprint } from '../../data/buildings';
import { RULES } from '../../data/rules';
import { clockAt, rainAt } from '../clock';
import type { Building, GameState } from '../state';
import { seasonAt, temperatureAt, weatherOf } from '../weather';

/**
 * Burze i susza (pogoda, która coś robi).
 *
 * Burza: przy mocnym deszczu poza zimą od czasu do czasu piorun trafia w budynek gracza i podpala go (pożar gaszą
 * ludzie z wiadrami i magowie Źródła, jak każdy inny). Budynki z kamienia (mury, wieże, twierdza, studnia, siedziby
 * magów, kapliczka) się nie palą. Deszcz sam przygasza każdy pożar — w ulewie płonie krócej.
 *
 * Susza: w gorące letnie dni bez deszczu sady i pola rodzą o połowę mniej. Studnia blisko budynku (RULES.drought.wellRange)
 * ratuje większość plonu, więc latem studnie są ważne.
 *
 * Wszystko liczy się z numeru ticka, ziarna mapy i `g.rng`, więc u każdego gracza wychodzi tak samo.
 */

const FIREPROOF = new Set(['keep', 'stoneWall', 'stoneGate', 'stoneTower', 'stoneTowerBig', 'stoneTowerGreat', 'well', 'brazier', 'mageFire', 'mageWater', 'shrine', 'ladder', 'torch']);
const WELL = buildingIndex('well');
const CROPS = new Set([buildingIndex('orchard'), buildingIndex('farm')]);

/** Burza: mocny deszcz, ale nie zimą (zimą pada śnieg i nie grzmi) */
export function stormAt(g: GameState): boolean {
  return rainAt(g.tick) >= RULES.storm.rain && seasonAt(g.tick, g.seasonShift ?? 0) !== 'winter';
}

/** Susza: lato, gorący dzień (temperatura bez rytmu doby od RULES.drought.temp °C) i bez deszczu */
export function droughtAt(g: GameState): boolean {
  const shift = g.seasonShift ?? 0;
  if (seasonAt(g.tick, shift) !== 'summer' || rainAt(g.tick) > 0.05) return false;
  // bez rytmu doby (najcieplej o 15, najzimniej o 3): zostaje rok i pogoda dnia, zmienia się płynnie z dnia na dzień
  const hour = clockAt(g.tick).hour;
  const t = temperatureAt(g.tick, g.map.seed, 0, shift) - 4 * Math.cos((2 * Math.PI * (hour - 15)) / 24);
  return t >= RULES.drought.temp;
}

/** Ile procent zwykłego plonu daje sad albo pole w tej chwili (susza bez studni blisko: połowa) */
export function harvestPct(g: GameState, b: Building): number {
  if (!CROPS.has(b.type) || !droughtAt(g)) return 100;
  const fp = footprint(BUILDINGS[b.type]!, b.rot), r = RULES.drought.wellRange;
  const near = g.buildings.some((w) => w.type === WELL && w.owner === b.owner && !w.build && !w.ruined
    && Math.max(Math.max(w.x - (b.x + fp.w - 1), b.x - w.x, 0), Math.max(w.y - (b.y + fp.h - 1), b.y - w.y, 0)) <= r);
  return near ? RULES.drought.withWell : RULES.drought.yield;
}

/** Co `every` ticków w czasie burzy: każdy gracz losuje, czy piorun trafia w któryś z jego budynków; deszcz przygasza pożary */
export function stormSystem(g: GameState): void {
  const rain = rainAt(g.tick);
  // deszcz gasi: w ulewie pożar dogasa kilka razy szybciej (co tick ubywa dodatkowo)
  if (rain > 0.3) {
    const extra = Math.round(rain * RULES.storm.rainDouse);
    for (const b of g.buildings) if (b.fire) b.fire = Math.max(0, b.fire - extra);
  }
  if (g.tick % RULES.storm.every !== 0 || !stormAt(g)) return;
  if (weatherOf(g, rain).temp < RULES.storm.minTemp) return;
  for (const p of g.players) {
    if (p.defeated || g.rng.int(100) >= RULES.storm.chance) continue;
    const pool = g.buildings.filter((b) => b.owner === p.id && !b.build && !b.ruined && !b.fire && !BUILDINGS[b.type]!.road && !BUILDINGS[b.type]!.line && !FIREPROOF.has(BUILDINGS[b.type]!.id));
    if (!pool.length) continue;
    const b = pool[g.rng.int(pool.length)]!;
    b.fire = Math.max(b.fire ?? 0, RULES.storm.burn);
    const fp = footprint(BUILDINGS[b.type]!, b.rot);
    p.lastStrike = { tick: g.tick, building: b.id, x: b.x + fp.w / 2, y: b.y + fp.h / 2 };
  }
}
