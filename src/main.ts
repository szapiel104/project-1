import { BUILDINGS, buildingIndex } from './data/buildings';
import { MAP_PRESETS, type MapPresetId } from './data/maps';
import { t } from './i18n';
import { GameRenderer, type TileRef } from './render/scene';
import { clockAt } from './sim/clock';
import { seedFromText } from './sim/rng';
import { deserialize, serialize, type SaveData } from './sim/save';
import { TICKS_PER_SECOND, createGame, housing, idleCount, idleSlots, population, stateHash, storeCapacity, storeUsed, type GameState } from './sim/state';
import { step, type Command } from './sim/step';
import { monthlyForecast } from './sim/systems/economy';
import { canAfford, canPlace } from './sim/systems/placement';
import { createHud } from './ui/hud';
import { proceduralModels } from './render/models';
import { renderThumbnails } from './render/thumbnails';
import { TEAM_COLORS } from './data/teams';

const ME = 0; // gracz sterowany lokalnie
const TICK_MS = 1000 / TICKS_PER_SECOND;
const WORDS = ['wilk', 'dab', 'orzel', 'kruk', 'zubr', 'miecz', 'baszta', 'wrota', 'las', 'skala', 'rzeka', 'brod'];

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new GameRenderer(canvas);
let game: GameState;
let pending: Command[] = [];
let speed = 1;
let picked: string | null = null;
let hoverTile: TileRef | null = null;
let touchTile: TileRef | null = null;
let selected = 0;
let currentPreset: MapPresetId = '1v1';
let currentSeedText = 'project-1';
const SAVE_KEY = 'project1.save';

/** Zapis w pamięci przeglądarki, żeby odświeżenie strony nie zaczynało gry od zera. */
function save(): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ seedText: currentSeedText, data: serialize(game, currentPreset) })); } catch { /* brak dostępu do pamięci przeglądarki */ }
}

function loadSave(): { seedText: string; data: SaveData } | null {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); } catch { return null; }
}

const hud = createHud(document.getElementById('ui')!, {
  onNewGame: (seedText, preset) => start(seedText || 'project-1', preset),
  // losowanie nazwy mapy to interfejs, nie symulacja, więc Math.random jest tu w porządku
  onRandom: (preset) => start(`${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 900 + 100)}`, preset),
  onPickBuilding: (id) => pick(id),
  onRations: (level) => pending.push({ type: 'setRations', player: ME, level }),
  onTax: (level) => pending.push({ type: 'setTax', player: ME, level }),
  onSpeed: (s) => { speed = s; },
  onDemolish: (id) => { pending.push({ type: 'demolish', player: ME, id }); select(0); },
  onCloseInfo: () => select(0),
}, renderThumbnails(proceduralModels, TEAM_COLORS[0]!, 192));

function start(seedText: string, preset: MapPresetId, loaded?: GameState): void {
  game = loaded ?? createGame(seedFromText(seedText), preset);
  currentPreset = preset;
  currentSeedText = seedText;
  pending = [];
  renderer.setState(game, MAP_PRESETS[preset].waterLevel, MAP_PRESETS[preset].rim, ME);
  hud.setSeed(seedText, preset);
  pick(null);
  select(0);
  try { history.replaceState(null, '', `#${preset}/${encodeURIComponent(seedText)}`); } catch { /* podgląd bez dostępu do historii */ }
  refresh();
  save();
}

function pick(id: string | null): void {
  picked = id;
  touchTile = null;
  hud.setPicked(id);
  canvas.classList.toggle('placing', id !== null);
  if (id) select(0);
  updateGhost();
}

function select(id: number): void {
  selected = id;
  const b = game.buildings.find((x) => x.id === id);
  renderer.setSelection(b ? id : 0);
  hud.showInfo(b ? { id, def: BUILDINGS[b.type]!, hasWorker: b.worker !== 0, own: b.owner === ME } : null);
}

/** Lewy górny róg działki tak, żeby budynek był wyśrodkowany na wskazanym polu. */
function origin(tile: TileRef, type: number): TileRef {
  const def = BUILDINGS[type]!;
  return { x: tile.x - ((def.w - 1) >> 1), y: tile.y - ((def.h - 1) >> 1) };
}

function updateGhost(): void {
  const tile = touchTile ?? hoverTile;
  if (!picked || !tile) { renderer.setGhost(null); return; }
  const type = buildingIndex(picked);
  const def = BUILDINGS[type]!;
  const o = origin(tile, type);
  renderer.setGhost({ ...o, w: def.w, h: def.h, ok: canPlace(game, ME, type, o.x, o.y) === null, id: picked, team: game.players[ME]!.team });
}

renderer.onHover = (tile) => { hoverTile = tile; if (!touchTile) updateGhost(); };

renderer.onClick = (tile, touch) => {
  if (!picked) {
    const id = game.occupancy[tile.y * game.map.width + tile.x] ?? 0;
    select(id === selected ? 0 : id);
    return;
  }
  // na ekranie dotykowym pierwsze dotknięcie pokazuje działkę, drugie w tym samym miejscu stawia budynek
  if (touch && (!touchTile || touchTile.x !== tile.x || touchTile.y !== tile.y)) {
    touchTile = tile;
    updateGhost();
    hud.toast(t('hud.tapAgain'));
    return;
  }
  const type = buildingIndex(picked);
  const o = origin(tile, type);
  const error = canPlace(game, ME, type, o.x, o.y);
  if (error) { hud.toast(t(error)); return; }
  pending.push({ type: 'build', player: ME, building: picked, x: o.x, y: o.y });
  touchTile = null;
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (picked) pick(null); else select(0); }
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || e.ctrlKey || e.metaKey) return;
  if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') hud.stepSpeed(1);
  if (e.key === '-' || e.code === 'NumpadSubtract') hud.stepSpeed(-1);
});
canvas.addEventListener('contextmenu', () => { if (picked) pick(null); });

let warnedHungry = false;
let warnedLeaving = false;

function refresh(): void {
  const p = game.players[ME]!;
  const f = monthlyForecast(game, p);
  // ostrzeżenia pokazujemy raz, w chwili gdy problem się zaczyna
  if (!f.fed && !warnedHungry) hud.toast(t('warn.hungry'));
  else if (p.popularity < 50 && !warnedLeaving) hud.toast(t('warn.leaving'));
  warnedHungry = !f.fed;
  warnedLeaving = p.popularity < 50;
  const affordable = new Set<string>();
  for (const def of BUILDINGS) if (canAfford(game, ME, def)) affordable.add(def.id);
  const clock = clockAt(game.tick);
  hud.update({
    day: clock.day, hour: clock.hour, night: clock.night,
    res: p.res, pop: population(game, ME), housing: housing(game, ME), popularity: p.popularity, idle: idleCount(game, ME), idleSlots: idleSlots(game, ME),
    stock: storeUsed(p, 'stockpile'), stockCap: storeCapacity(game, ME, 'stockpile'),
    food: storeUsed(p, 'granary'), foodCap: storeCapacity(game, ME, 'granary'),
    delta: f.delta, fed: f.fed, bribed: f.bribed, rations: p.rations, tax: p.tax, affordable,
  });
  hud.setHash(stateHash(game));
  if (selected) {
    const b = game.buildings.find((x) => x.id === selected);
    if (!b) select(0);
    else hud.showInfo({ id: b.id, def: BUILDINGS[b.type]!, hasWorker: b.worker !== 0, own: b.owner === ME });
  }
}

let last = performance.now();
let acc = 0;
function loop(now: number): void {
  const elapsed = Math.min(250, now - last);
  last = now;
  acc += elapsed * speed;
  let steps = 0;
  while (acc >= TICK_MS && steps < 6) {
    renderer.snapshot();
    step(game, pending);
    pending = [];
    acc -= TICK_MS;
    steps++;
    if (game.tick % 50 === 0) save();
  }
  if (steps === 6) acc = 0;
  if (steps) { refresh(); updateGhost(); }
  renderer.frame(elapsed / 1000, speed ? acc / TICK_MS : 1);
  requestAnimationFrame(loop);
}

// adres strony może nieść mapę: #tryb/ziarno
const [hashPreset, hashSeed] = decodeURIComponent(location.hash.slice(1)).split('/');
const saved = loadSave();
const restored = saved ? deserialize(saved.data) : null;
if (saved && restored) start(saved.seedText, saved.data.preset, restored);
else start(hashSeed || 'project-1', hashPreset && hashPreset in MAP_PRESETS ? (hashPreset as MapPresetId) : '1v1');
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
requestAnimationFrame(loop);

// podgląd stanu dla testów w przeglądarce
(window as unknown as { __game: () => GameState }).__game = () => game;

declare const __BUILD__: string;
const badge = document.createElement('div');
badge.className = 'build';
badge.textContent = `wersja ${__BUILD__}`;
document.body.append(badge);
