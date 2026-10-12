import { BUILDINGS, buildingIndex, footprint } from './data/buildings';
import { resIndex, type ResourceId } from './data/resources';
import { UNITS } from './data/units';
import { MAP_PRESETS, type MapPresetId } from './data/maps';
import { BYNAMES, FIRST_NAMES } from './data/names';
import { t } from './i18n';
import { GameRenderer, type TileRef } from './render/scene';
import { clockAt } from './sim/clock';
import { seedFromText } from './sim/rng';
import { deserialize, serialize, type SaveData } from './sim/save';
import { TICKS_PER_SECOND, createGame, housing, idleCount, idleSlots, population, stateHash, storeCapacity, storeUsed, type GameState } from './sim/state';
import { step, type Command } from './sim/step';
import { monthlyForecast } from './sim/systems/economy';
import { canAfford, canPlace, maxHp } from './sim/systems/placement';
import { createHud, type HudView } from './ui/hud';
import { createScribe } from './ui/scribe';
import { nextWave } from './sim/systems/bot';
import { TEST } from './testmode';
import { createMenu, loadSettings, type Settings } from './ui/menu';
import { getVolume, isMuted, nature, play, talk, setBusVolume, setVolume, toggleMute, unlockAudio } from './audio/sfx';
import { proceduralModels } from './render/models';
import { renderThumbnails } from './render/thumbnails';
import { TEAM_COLORS } from './data/teams';

const ME = 0; // gracz sterowany lokalnie
const TICK_MS = 1000 / TICKS_PER_SECOND;
const WORDS = ['wilk', 'dab', 'orzel', 'kruk', 'zubr', 'miecz', 'baszta', 'wrota', 'las', 'skala', 'rzeka', 'brod'];

const canvas = document.getElementById('game') as HTMLCanvasElement;
const T0 = performance.now();
const renderer = new GameRenderer(canvas);
const mark: [string, number][] = [['renderer', Math.round(performance.now() - T0)]];
let game: GameState;
let pending: Command[] = [];
let speed = 1;
let picked: string | null = null;
let hoverTile: TileRef | null = null;
let touchTile: TileRef | null = null;
let selected = 0;
/** Obrót stawianego budynku: 0..3, co 90° */
let placeRot = 0;
/** Tryb wyburzania: kliknięcie usuwa budynek, przeciąganie usuwa drogę */
let wrecking = false;

function setWreck(on: boolean): void {
  wrecking = on;
  if (on) pick(null);
  hud.setWreck(on);
  renderer.setPainting(on);
  canvas.classList.toggle('placing', on);
  if (on) hud.toast(t('hud.wrecking'));
}
let currentPreset: MapPresetId = '1v1';
let currentSeedText = 'project-1';
const SAVE_KEY = 'project1.save';

/** Zapis w pamięci przeglądarki, żeby odświeżenie strony nie zaczynało gry od zera. */
function save(): void {
  if (TEST) return; // tryb testowy nie nadpisuje prawdziwego zapisu gracza
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ seedText: currentSeedText, data: serialize(game, currentPreset) })); } catch { /* brak dostępu do pamięci przeglądarki */ }
}

function loadSave(): { seedText: string; data: SaveData } | null {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); } catch { return null; }
}

const hud = createHud(document.getElementById('ui')!, {
  onNewGame: (seedText, preset) => start(seedText || 'project-1', preset),
  // losowanie nazwy mapy to interfejs, nie symulacja, więc Math.random jest tu w porządku
  onRandom: (preset) => start(`${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 900 + 100)}`, preset),
  onPickBuilding: (id) => { if (wrecking) setWreck(false); pick(id); },
  onRations: (level) => pending.push({ type: 'setRations', player: ME, level }),
  onTax: (level) => pending.push({ type: 'setTax', player: ME, level }),
  onSpeed: (s) => { speed = s; },
  onDemolish: (id) => { pending.push({ type: 'demolish', player: ME, id }); play('demolish'); select(0); },
  onCloseInfo: () => { selectUnit(0); select(0); },
  onRotate: () => rotate(),
  onWreck: () => setWreck(!wrecking),
  onVolume: (v) => setVolume(v),
  onMute: () => hud.setMuted(toggleMute()),
  onMenu: () => menu.open(true),
  onGate: (id, open) => { pending.push({ type: 'gate', player: ME, id, open }); play('click'); },
  onTrain: (id, n) => { const k = Math.min(n, recruitInfo().max); for (let i = 0; i < k; i++) pending.push({ type: 'train', player: ME, building: id, unit: 'spearman' }); if (k) play('build'); },
}, TEST ? new Map() : renderThumbnails(proceduralModels, TEAM_COLORS[0]!, 192));

// Menu główne: przy wejściu do gry osada stoi w tle i powoli się obraca, symulacja czeka
mark.push(['hud+miniatury', Math.round(performance.now() - T0)]);
const menu = createMenu(document.body, {
  onContinue: () => menu.close(),
  onNewGame: (seedText, preset, level, dev) => {
    // nowa mapa buduje się za ekranem wczytywania, a nie w zawieszonym menu
    const cover = document.createElement('div');
    cover.id = 'loading';
    cover.innerHTML = `<div class="loading-card"><p class="loading-title">Project‑1</p><div class="loading-bar"><span style="width:60%"></span></div><p class="loading-line"><span>${t('load.map')}</span><strong></strong></p></div>`;
    document.body.append(cover);
    requestAnimationFrame(() => setTimeout(() => {
      start(seedText, preset, undefined, level, dev);
      renderer.warmup();
      menu.close();
      (cover.querySelector('.loading-bar span') as HTMLElement).style.width = '100%';
      cover.classList.add('done');
      setTimeout(() => cover.remove(), 500);
    }, 30));
  },
  onVolume: (v) => setVolume(v),
  onMute: () => { const m = toggleMute(); hud.setMuted(m); return m; },
  onSettings: (st) => applySettings(st),
});
let titleScreen = true;
function applySettings(st: Settings): void {
  renderer.setGraphics(st);
  setBusVolume('sfx', st.sfx);
  setBusVolume('ui', st.ui);
  setBusVolume('amb', st.amb);
}
applySettings(loadSettings());

function start(seedText: string, preset: MapPresetId, loaded?: GameState, level = 2, dev = false): void {
  endShown = false;
  game = loaded ?? createGame(seedFromText(seedText), preset, level, dev);
  currentPreset = preset;
  currentSeedText = seedText;
  pending = [];
  renderer.setState(game, MAP_PRESETS[preset].waterLevel, MAP_PRESETS[preset].rim, ME);
  hud.setSeed(seedText, preset);
  pick(null);
  selectedUnit = 0;
  renderer.setUnitSelection(0);
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
  const road = id !== null && (!!BUILDINGS[buildingIndex(id)]?.road || !!BUILDINGS[buildingIndex(id)]?.line);
  if (plan.state !== 'none') cancelPlan();
  renderer.setPainting(road);
  if (road) hud.toast(t('hud.paintRoad'));
  if (id) select(0);
  updateGhost();
}

/** Obraca stawiany budynek o 90° w prawo. Drogi i pochodnie są symetryczne, więc ich to nie dotyczy. */
function rotate(): void {
  play('rotate');
  placeRot = (placeRot + 1) % 4;
  updateGhost();
}

let selectedUnit = 0;

/** Imię, przydomek i wiek wynikają na stałe z numeru chłopa i ziarna mapy. */
function personCard(id: number): { name: string; lines: string[] } | null {
  const u = game.units.find((x) => x.id === id);
  if (!u) return null;
  const h = (salt: number): number => { let v = (id * 2654435761 + game.map.seed + salt * 40503) >>> 0; v ^= v >>> 15; v = Math.imul(v, 0x2c1b3c6d); return (v ^ (v >>> 12)) >>> 0; };
  const job = game.buildings.find((b) => b.id === u.job);
  const guild = job ? t(`guild.${BUILDINGS[job.type]!.id}`) : '';
  return {
    name: `${FIRST_NAMES[h(1) % FIRST_NAMES.length]} ${BYNAMES[h(2) % BYNAMES.length]}`,
    lines: [
      `${16 + (h(3) % 45)} ${t('person.age')}`,
      job ? `${t('person.guild')} ${guild}` : t('person.none'),
      `${t('person.doing')}: ${t(`phase.${u.phase}`)}`,
    ],
  };
}

function selectUnit(id: number): void {
  if (id && id !== selectedUnit) play('select');
  selectedUnit = id;
  if (id) { selected = 0; renderer.setSelection(0); }
  renderer.setUnitSelection(id);
  hud.showPerson(id ? personCard(id) : null);
  if (id) speak(id);
}

function select(id: number): void {
  if (id && selectedUnit) { selectedUnit = 0; renderer.setUnitSelection(0); }
  selected = id;
  const b = game.buildings.find((x) => x.id === id);
  renderer.setSelection(b ? id : 0);
  hud.showInfo(b ? { id, def: BUILDINGS[b.type]!, hasWorker: b.worker !== 0, own: b.owner === ME, canTrain: canTrain(), hp: b.hp, maxHp: maxHp(b.type), recruit: BUILDINGS[b.type]!.id === 'barracks' ? recruitInfo() : undefined, gate: BUILDINGS[b.type]!.gate ? { open: b.gateOpen ?? true, shut: !!b.shut } : undefined } : null);
}

/** Lewy górny róg działki tak, żeby budynek był wyśrodkowany na wskazanym polu. */
function origin(tile: TileRef, type: number): TileRef {
  const fp = footprint(BUILDINGS[type]!, placeRot);
  return { x: tile.x - ((fp.w - 1) >> 1), y: tile.y - ((fp.h - 1) >> 1) };
}

function updateGhost(): void {
  const tile = touchTile ?? hoverTile;
  if (!picked || !tile) { renderer.setGhost(null); return; }
  const type = buildingIndex(picked);
  const fp = footprint(BUILDINGS[type]!, placeRot);
  const o = origin(tile, type);
  renderer.setGhost({ ...o, w: fp.w, h: fp.h, ok: canPlace(game, ME, type, o.x, o.y, true, placeRot) === null, id: picked, team: game.players[ME]!.team, rot: placeRot });
}

renderer.onHover = (tile) => { hoverTile = tile; if (!touchTile) updateGhost(); };

// malowanie drogi: każde pole pod kursorem przy wciśniętym przycisku dostaje nawierzchnię
renderer.onPaint = (tile) => {
  if (wrecking) {
    const kind = game.roads[tile.y * game.map.width + tile.x];
    if (kind && !pending.some((c) => c.type === 'unroad' && c.x === tile.x && c.y === tile.y)) { pending.push({ type: 'unroad', player: ME, x: tile.x, y: tile.y }); roadBroken(tile, kind); }
    return;
  }
  if (!picked || plan.state !== 'drag') return;
  if (plan.end.x === tile.x && plan.end.y === tile.y) return;
  plan.end = tile;
  showPlan();
};

/** Efekt i dźwięk rozbijanej drogi; dźwięk nie częściej niż co 120 ms, żeby przeciąganie nie trzeszczało */
let lastBreak = 0;
function roadBroken(tile: TileRef, kind: number): void {
  renderer.roadDust(tile.x, tile.y, kind === 2);
  const now = performance.now();
  if (now - lastBreak > 120) { play('demolish'); lastBreak = now; }
}

// --- planowanie drogi: przeciągnij, zobacz podgląd i koszt; lewy przycisk buduje, prawy anuluje ---
const plan = { state: 'none' as 'none' | 'drag' | 'wait' | 'done', start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, tiles: [] as { x: number; y: number; ok: boolean }[] };
const planTip = document.createElement('div');
planTip.className = 'plan-tip';
planTip.hidden = true;
document.body.append(planTip);

/** Pola drogi od początku do końca: najpierw wzdłuż dłuższej osi, potem zakręt (jak w Twierdzy) */
function planLine(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const sx = Math.sign(b.x - a.x), sy = Math.sign(b.y - a.y);
  const xFirst = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  let x = a.x, y = a.y;
  out.push({ x, y });
  if (xFirst) { while (x !== b.x) { x += sx; out.push({ x, y }); } while (y !== b.y) { y += sy; out.push({ x, y }); } }
  else { while (y !== b.y) { y += sy; out.push({ x, y }); } while (x !== b.x) { x += sx; out.push({ x, y }); } }
  return out;
}

function showPlan(): void {
  if (!picked || plan.state === 'none' || plan.state === 'done') { renderer.setRoadPlan([]); planTip.hidden = true; return; }
  const type = buildingIndex(picked);
  const def = BUILDINGS[type]!;
  const p = game.players[ME]!;
  // koszt liczymy narastająco: gdy zabraknie surowca, dalsze pola są czerwone
  const left = new Map<ResourceId, number>();
  for (const res of Object.keys(def.cost) as ResourceId[]) left.set(res, p.res[resIndex(res)]!);
  let count = 0;
  plan.tiles = planLine(plan.start, plan.end).map(({ x, y }) => {
    let ok = (!def.road || !game.roads[y * game.map.width + x]) && canPlace(game, ME, type, x, y, false) === null;
    if (ok) for (const [res, n] of Object.entries(def.cost) as [ResourceId, number][]) if ((left.get(res) ?? 0) < n) ok = false;
    if (ok) { for (const [res, n] of Object.entries(def.cost) as [ResourceId, number][]) left.set(res, left.get(res)! - n); count++; }
    return { x, y, ok };
  });
  renderer.setRoadPlan(plan.tiles);
  const costs = (Object.entries(def.cost) as [ResourceId, number][]).map(([res, n]) => {
    const need = n * count, have = p.res[resIndex(res)]!;
    return `<span class="${need > have ? 'bad' : ''}">${t(`res.${res}`)}: ${need} <small>(masz ${have})</small></span>`;
  });
  const bad = plan.tiles.length - count;
  planTip.innerHTML = `<strong>${t(def.name)}: ${count} ${count === 1 ? 'pole' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'pola' : 'pól'}</strong>`
    + (costs.length ? costs.join('') : '<span>za darmo</span>')
    + (bad ? `<span class="bad">${bad} poza zasięgiem / zajęte</span>` : '')
    + (plan.state === 'wait' ? '<em>Lewy przycisk — buduj · prawy — anuluj</em>' : '<em>Puść, żeby zobaczyć plan</em>');
  planTip.hidden = false;
  planTip.style.left = `${mouseX + 18}px`;
  planTip.style.top = `${mouseY + 18}px`;
}

function cancelPlan(): void { plan.state = 'none'; plan.tiles = []; showPlan(); }

renderer.onPaintDown = (tile) => {
  if (wrecking || !picked) return;
  if (plan.state === 'wait') {
    // zatwierdzenie: stawiamy tylko zielone pola
    let n = 0;
    for (const x of plan.tiles) if (x.ok) { pending.push({ type: 'build', player: ME, building: picked, x: x.x, y: x.y }); n++; }
    if (n) play('road'); else play('error');
    plan.state = 'done';
    plan.tiles = [];
    showPlan();
    return;
  }
  plan.state = 'drag';
  plan.start = tile; plan.end = tile;
  showPlan();
};

renderer.onUnit = (id) => { if (!picked && !wrecking) selectUnit(id === selectedUnit ? 0 : id); };

renderer.onClick = (tile, touch) => {
  if (wrecking) {
    const id = game.occupancy[tile.y * game.map.width + tile.x] ?? 0;
    const b = game.buildings.find((x) => x.id === id);
    if (b && b.owner === ME && BUILDINGS[b.type]!.buildable) { pending.push({ type: 'demolish', player: ME, id }); play('demolish'); }
    else if (game.roads[tile.y * game.map.width + tile.x]) { roadBroken(tile, game.roads[tile.y * game.map.width + tile.x]!); pending.push({ type: 'unroad', player: ME, x: tile.x, y: tile.y }); }
    return;
  }
  if (!picked) {
    if (selectedUnit) selectUnit(0);
    const id = game.occupancy[tile.y * game.map.width + tile.x] ?? 0;
    if (id && id !== selected) play('select');
    select(id === selected ? 0 : id);
    return;
  }
  // na ekranie dotykowym pierwsze dotknięcie pokazuje działkę, drugie w tym samym miejscu stawia budynek
  if (BUILDINGS[buildingIndex(picked)]?.road || BUILDINGS[buildingIndex(picked)]?.line) {
    // puszczenie przycisku po przeciągnięciu: plan czeka na decyzję
    if (plan.state === 'drag') { plan.state = 'wait'; showPlan(); }
    else if (plan.state === 'done') plan.state = 'none';
    return;
  }
  if (touch && !BUILDINGS[buildingIndex(picked)]?.road && (!touchTile || touchTile.x !== tile.x || touchTile.y !== tile.y)) {
    touchTile = tile;
    updateGhost();
    hud.toast(t('hud.tapAgain'));
    return;
  }
  const type = buildingIndex(picked);
  const o = origin(tile, type);
  const error = canPlace(game, ME, type, o.x, o.y, true, placeRot);
  if (error) { hud.toast(t(error)); play('error'); return; }
  pending.push({ type: 'build', player: ME, building: picked, x: o.x, y: o.y, rot: placeRot });
  play('build');
  touchTile = null;
};

// dźwięk rusza po pierwszym kliknięciu albo klawiszu; każdy przycisk interfejsu stuka
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
document.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('button')) play('click'); });
renderer.onCollapse = () => play('collapse');

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && plan.state !== 'none') { cancelPlan(); return; }
  if (e.key === 'Escape') {
    if (menu.isOpen()) { if (!titleScreen) menu.close(); return; }
    if (wrecking) setWreck(false);
    else if (picked) pick(null);
    else if (chosen.size) chooseSoldiers([], false);
    else if (selected || selectedUnit) { select(0); selectUnit(0); }
    else menu.open(true);
    return;
  }
  if (menu.isOpen()) return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || e.ctrlKey || e.metaKey) return;
  if (e.code === 'KeyR' && picked) rotate();
  if (e.code === 'KeyM') hud.setMuted(toggleMute());
  if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') hud.stepSpeed(1);
  if (e.key === '-' || e.code === 'NumpadSubtract') hud.stepSpeed(-1);
});
canvas.addEventListener('contextmenu', () => {
  if (plan.state !== 'none') { cancelPlan(); play('rotate'); return; }
  if (wrecking) setWreck(false);
  else if (picked) pick(null);
  else if (chosen.size && hoverFoe) {
    pending.push({ type: 'attack', player: ME, ids: [...chosen], target: hoverFoe });
    play('select');
  } else if (chosen.size && hoverTile && !renderer.dragged) {
    pending.push({ type: 'move', player: ME, ids: [...chosen], x: hoverTile.x, y: hoverTile.y });
    renderer.orderMarker(hoverTile);
    play('rotate');
  }
});

// ---- wojsko: zaznaczanie ramką lub kliknięciem, rozkaz marszu prawym przyciskiem ----
const chosen = new Set<number>();
const selBox = document.createElement('div');
selBox.className = 'selbox';
selBox.hidden = true;
document.body.append(selBox);
let boxStart: { x: number; y: number } | null = null;

function recruitInfo(): { spears: number; gold: number; idle: number; max: number; cost: number; hp: number; attack: number } {
  const p = game.players[ME]!;
  const def = UNITS[0]!;
  const spears = p.res[resIndex('spear')]!, gold = p.res[resIndex('gold')]!;
  const idle = game.units.filter((u) => u.owner === ME && u.job === 0).length;
  const cost = def.cost.gold ?? 0;
  return { spears, gold, idle, cost, hp: def.hp, attack: def.attack, max: Math.max(0, Math.min(spears, cost ? Math.floor(gold / cost) : 999, idle)) };
}

function canTrain(): boolean {
  const p = game.players[ME]!;
  const def = UNITS[0]!;
  for (const [res, amount] of Object.entries(def.cost)) if (p.res[resIndex(res as ResourceId)]! < amount!) return false;
  return game.units.some((u) => u.owner === ME && u.job === 0);
}

function chooseSoldiers(ids: number[], add: boolean): void {
  if (!add) chosen.clear();
  for (const id of ids) chosen.add(id);
  renderer.setSoldierSelection(chosen);
  if (chosen.size) {
    select(0);
    selectUnit(0);
    showArmy();
  } else hud.showArmy([]);
}

/** Karta zaznaczonego wojska: portrety ze zdrowiem; znika, gdy żołnierze zginą */
function showArmy(): void {
  const list = game.soldiers.filter((s) => chosen.has(s.id));
  if (list.length !== chosen.size) { chosen.clear(); for (const s of list) chosen.add(s.id); renderer.setSoldierSelection(chosen); }
  hud.showArmy(list.map((s) => ({ name: t(UNITS[s.kind]!.name), hp: s.hp, max: UNITS[s.kind]!.hp })));
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.ctrlKey || picked || wrecking || menu.isOpen()) return;
  boxStart = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointermove', (e) => {
  if (!boxStart || !(e.buttons & 1)) return;
  const x0 = Math.min(boxStart.x, e.clientX), y0 = Math.min(boxStart.y, e.clientY);
  const w = Math.abs(e.clientX - boxStart.x), h = Math.abs(e.clientY - boxStart.y);
  if (w + h < 8 && selBox.hidden) return;
  selBox.hidden = false;
  Object.assign(selBox.style, { left: `${x0}px`, top: `${y0}px`, width: `${w}px`, height: `${h}px` });
});
// w fazie przechwytywania, żeby zadziałało przed zwykłym kliknięciem w mapę
canvas.addEventListener('pointerup', (e) => {
  if (e.button !== 0 || !boxStart) return;
  const start = boxStart;
  boxStart = null;
  const onScreen = renderer.soldiersOnScreen(ME);
  if (!selBox.hidden) {
    selBox.hidden = true;
    const x0 = Math.min(start.x, e.clientX), x1 = Math.max(start.x, e.clientX), y0 = Math.min(start.y, e.clientY), y1 = Math.max(start.y, e.clientY);
    const ids = onScreen.filter((s) => s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1).map((s) => s.id);
    chooseSoldiers(ids, e.shiftKey);
    if (ids.length) play('select');
    renderer.markDragged();
    return;
  }
  // zwykłe kliknięcie: najbliższy żołnierz pod kursorem
  let best = 0, bestD = 22 * 22;
  for (const s of onScreen) { const d = (s.x - e.clientX) ** 2 + (s.y - e.clientY) ** 2; if (d < bestD) { bestD = d; best = s.id; } }
  if (best) { chooseSoldiers([best], e.shiftKey); play('select'); renderer.markDragged(); }
  else if (chosen.size && !e.shiftKey) chooseSoldiers([], false);
}, { capture: true });

// ---- wróg pod kursorem: miecz zamiast strzałki, prawy przycisk = atak ----
let hoverFoe = 0;
let mouseX = -1, mouseY = -1;
window.addEventListener('pointermove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
function updateHoverFoe(): void {
  hoverFoe = 0;
  if (chosen.size && mouseX >= 0) {
    let bd = 26 * 26;
    for (const s of renderer.soldiersOnScreen(-1)) {
      if (game.players[s.owner]?.team === game.players[ME]!.team) continue;
      const d = (s.x - mouseX) ** 2 + (s.y - mouseY) ** 2;
      if (d < bd) { bd = d; hoverFoe = s.id; }
    }
    // wilki pod kursorem też można zaatakować
    for (const w of game.wolves) {
      const p = renderer.project(w.px / 256, w.py / 256);
      if (!p.front) continue;
      const d = (p.sx - mouseX) ** 2 + (p.sy - 10 - mouseY) ** 2;
      if (d < bd) { bd = d; hoverFoe = w.id; }
    }
    if (!hoverFoe && hoverTile) {
      const b = game.buildings.find((x) => x.id === game.occupancy[hoverTile!.y * game.map.width + hoverTile!.x]);
      if (b && game.players[b.owner]?.team !== game.players[ME]!.team) hoverFoe = b.id;
    }
  }
  canvas.classList.toggle('attack', hoverFoe !== 0);
  renderer.setAttackHighlight(game.buildings.some((b) => b.id === hoverFoe) ? hoverFoe : 0);
}

// ---- paski zdrowia nad żołnierzami: ranni, zaznaczeni i wróg pod kursorem ----
const barLayer = document.createElement('div');
barLayer.className = 'hpbars';
document.body.append(barLayer);
const bars: HTMLElement[] = [];
function updateBars(): void {
  renderer.barLift = 0.95;
  const list = renderer.soldiersOnScreen(-1);
  renderer.barLift = 0.45;
  const kinds = new Map<number, number>();
  for (const x of game.soldiers) kinds.set(x.id, x.kind);
  let n = 0;
  for (const s of list) {
    const max = UNITS[kinds.get(s.id) ?? 0]!.hp;
    if (s.hp >= max && !chosen.has(s.id) && s.id !== hoverFoe) continue;
    let bar = bars[n];
    if (!bar) { bar = document.createElement('div'); bar.className = 'hpbar'; bar.append(document.createElement('span')); barLayer.append(bar); bars.push(bar); }
    bar.hidden = false;
    bar.style.transform = `translate(${Math.round(s.x - 17)}px, ${Math.round(s.y - 4)}px)`;
    bar.dataset.team = game.players[s.owner]?.team === game.players[ME]!.team ? 'own' : 'foe';
    const fill = bar.firstChild as HTMLElement;
    fill.style.width = `${Math.max(0, (s.hp / max) * 100)}%`;
    fill.dataset.low = String(s.hp < max * 0.35);
    n++;
  }
  for (let i = n; i < bars.length; i++) bars[i]!.hidden = true;
}

// ---- pasek ostrzeżeń u góry: kiedy wróg wyśle wojsko i czy już nadciąga ----
const alarm = document.createElement('div');
alarm.className = 'alarm';
alarm.setAttribute('role', 'status');
document.body.append(alarm);
function updateAlarm(): void {
  const me = game.players[ME]!;
  const enemies = game.players.filter((p) => p.team !== me.team && p.bot && !p.defeated);
  if (!enemies.length || me.defeated) { alarm.hidden = true; return; }
  alarm.hidden = false;
  const keep = game.buildings.find((b) => b.owner === ME && b.type === 0);
  const foes = game.soldiers.filter((s) => game.players[s.owner]!.team !== me.team);
  // nadciąga: wrogowie w marszu, bliżej naszej twierdzy niż swojej
  const coming = keep ? foes.filter((s) => {
    const own = game.buildings.find((b) => b.owner === s.owner && b.type === 0);
    const dMe = Math.hypot((s.px >> 8) - keep.x, (s.py >> 8) - keep.y);
    const dHome = own ? Math.hypot((s.px >> 8) - own.x, (s.py >> 8) - own.y) : 99;
    return s.path.length > 0 && dMe < dHome + 30 && dHome > 12;
  }) : [];
  if (coming.length && keep) {
    const near = Math.min(...coming.map((s) => Math.hypot((s.px >> 8) - keep.x, (s.py >> 8) - keep.y)));
    alarm.dataset.state = 'coming';
    alarm.innerHTML = `<strong>${t('alarm.coming')}</strong><span>${coming.length} ${t('alarm.soldiers')} · ${Math.round(near)} ${t('alarm.fields')}</span><span class="alarm-bar"><span style="width:${Math.max(4, Math.min(100, 100 - near))}%"></span></span>`;
    return;
  }
  const w = nextWave(game.tick, enemies[0]!.level);
  if (!w) { alarm.dataset.state = 'calm'; alarm.innerHTML = `<strong>${t('alarm.peace')}</strong><span>${t('alarm.has')} ${foes.length}</span>`; return; }
  const secs = Math.max(0, Math.round((w.at - game.tick) / TICKS_PER_SECOND));
  const army = foes.length;
  alarm.dataset.state = secs < 60 ? 'soon' : 'calm';
  alarm.innerHTML = `<strong>${t('alarm.next')} ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</strong><span>${t('alarm.wave')} ${w.size} · ${t('alarm.has')} ${army}</span>`;
}

let endShown = false;
function showEnd(win: boolean): void {
  endShown = true;
  speed = 0;
  const p = game.players[ME]!;
  const st = p.stats;
  const mins = Math.floor(game.tick / TICKS_PER_SECOND / 60);
  const rows: [string, string | number][] = [
    [t('sum.time'), `${mins} min`], [t('sum.gathered'), st.gathered], [t('sum.built'), st.built], [t('sum.trained'), st.trained],
    [t('sum.kills'), st.kills], [t('sum.lost'), st.lost], [t('sum.razed'), st.razed], [t('sum.people'), population(game, ME)],
  ];
  const box = document.createElement('div');
  box.className = 'end';
  box.innerHTML = `<div class="panel end-panel"><p class="menu-title">${t(win ? 'end.win' : 'end.lose')}</p><p class="menu-sub">${t(win ? 'end.winText' : 'end.loseText')}</p>
    <dl class="summary">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><div class="menu-list"></div></div>`;
  const list = box.querySelector('.menu-list')!;
  const btn = (text: string, fn: () => void): void => { const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-btn'; b.textContent = text; b.addEventListener('click', () => { box.remove(); fn(); }); list.append(b); };
  btn(t('end.again'), () => { menu.open(false); });
  document.body.append(box);
  play(win ? 'build' : 'collapse');
}

const scribe = createScribe(() => play('babble'));
let wolvesSeen = false, wolfKillsSeen = 0;
let wasNight = false, wasComing = false, stockFull = false;

// historia zapasów co 5 sekund gry: trend = różnica wobec stanu sprzed minuty
const resHistory: { tick: number; res: number[] }[] = [];
function resTrend(res: ArrayLike<number>): number[] {
  if (!resHistory.length || game.tick - resHistory[resHistory.length - 1]!.tick >= 50 || game.tick < resHistory[resHistory.length - 1]!.tick) {
    if (resHistory.length && game.tick < resHistory[resHistory.length - 1]!.tick) resHistory.length = 0;
    resHistory.push({ tick: game.tick, res: Array.from(res) });
    while (resHistory.length > 13) resHistory.shift();
  }
  const old = resHistory[0]!;
  return Array.from(res, (v, i) => v - (old.res[i] ?? v));
}

let warnedHungry = false;
let warnedLeaving = false;

function refresh(): void {
  const p = game.players[ME]!;
  const f = monthlyForecast(game, p);
  // ostrzeżenia pokazujemy raz, w chwili gdy problem się zaczyna
  // skryba: ważne wiadomości w lewym górnym rogu, z „mową”
  const food = storeUsed(p, 'granary');
  if (!f.fed && !warnedHungry) scribe.say('hungry', t('warn.hungry'), true);
  else if (f.fed && food < 15 && population(game, ME) > 0) scribe.say('foodLow', t('scribe.foodLow'));
  if (p.popularity < 50 && !warnedLeaving) scribe.say('leaving', t('warn.leaving'), true);
  const full = storeUsed(p, 'stockpile') >= storeCapacity(game, ME, 'stockpile');
  if (full && !stockFull) scribe.say('stockFull', t('scribe.stockFull'));
  stockFull = full;
  const hour = clockAt(game.tick).hour;
  const night = hour >= 19.5 || hour < 6;
  // dlaczego nikt nie przychodzi: skryba mówi wprost, co blokuje nowych osadników
  const pop = population(game, ME);
  if (p.popularity < 50 && pop <= 6) scribe.say('noComers', `Nikt nie chce tu przyjść — popularność ${p.popularity}. Daj więcej jedzenia albo obniż podatki.`, true);
  else if (p.popularity >= 50 && pop >= housing(game, ME)) scribe.say('noComers', 'Ludzie by przyszli, ale nie ma dla nich dachu. Postaw chatę.');
  else if (p.popularity >= 50 && idleCount(game, ME) >= idleSlots(game, ME)) scribe.say('noComers', 'Obozowisko pełne — nowi nie mają gdzie czekać. Daj im pracę albo postaw drugie obozowisko.');
  if (game.wolves.length && !wolvesSeen) scribe.say('wolves', 'Wilki wyszły z lasu! Trzymajcie ludzi za palisadą.', true, 'herald');
  wolvesSeen = game.wolves.length > 0;
  if ((p.wolfKills ?? 0) > wolfKillsSeen) scribe.say('wolfKill', 'Wilki zagryzły naszego człowieka…', true);
  wolfKillsSeen = p.wolfKills ?? 0;
  if (night !== wasNight) scribe.say(night ? 'dusk' : 'dawn', t(night ? 'scribe.dusk' : 'scribe.dawn'));
  wasNight = night;
  const coming = alarm.dataset.state === 'coming';
  if (coming && !wasComing) scribe.say('coming', t('alarm.coming'), true, 'herald');
  // nastroje ludzi wobec wojska
  const mine = game.soldiers.filter((x) => x.owner === ME).length;
  const theirs = game.soldiers.length - mine;
  if (mine >= 10 && mine >= theirs) scribe.say('proud', t('herald.proud'), false, 'herald');
  else if (mine === 0 && theirs >= 3) scribe.say('afraid', t('herald.afraid'), true, 'herald');
  else if (theirs > mine * 2 && theirs >= 6) scribe.say('weaker', t('herald.weaker'), false, 'herald');
  wasComing = coming;
  warnedHungry = !f.fed;
  warnedLeaving = p.popularity < 50;
  const affordable = new Set<string>();
  for (const def of BUILDINGS) if (canAfford(game, ME, def)) affordable.add(def.id);
  const clock = clockAt(game.tick);
  hud.update({
    day: clock.day, hour: clock.hour, night: clock.night,
    res: p.res, trend: resTrend(p.res), pop: population(game, ME), housing: housing(game, ME), popularity: p.popularity, idle: idleCount(game, ME), idleSlots: idleSlots(game, ME),
    stock: storeUsed(p, 'stockpile'), stockCap: storeCapacity(game, ME, 'stockpile'),
    food: storeUsed(p, 'granary'), foodCap: storeCapacity(game, ME, 'granary'),
    delta: f.delta, fed: f.fed, bribed: f.bribed, rations: p.rations, tax: p.tax, affordable,
    report: buildReport(f),
  });
  hud.setHash(stateHash(game));
  if (chosen.size) showArmy();
  // koniec gry: zburzona twierdza gracza albo wszystkich wrogów
  const meP = game.players[ME]!;
  const foesLeft = game.players.some((o) => o.team !== meP.team && !o.defeated);
  if (!endShown && (meP.defeated || !foesLeft)) showEnd(!meP.defeated);
  if (selectedUnit) {
    const card = personCard(selectedUnit);
    if (card) hud.showPerson(card); else selectUnit(0); // odszedł z osady
  }
  if (selected) {
    const b = game.buildings.find((x) => x.id === selected);
    if (!b) select(0);
    else hud.showInfo({ id: b.id, def: BUILDINGS[b.type]!, hasWorker: b.worker !== 0, own: b.owner === ME, canTrain: canTrain(), hp: b.hp, maxHp: maxHp(b.type), recruit: BUILDINGS[b.type]!.id === 'barracks' ? recruitInfo() : undefined, gate: BUILDINGS[b.type]!.gate ? { open: b.gateOpen ?? true, shut: !!b.shut } : undefined });
  }
}

let last = performance.now();
let acc = 0;
function loop(now: number): void {
  const elapsed = Math.min(250, now - last);
  last = now;
  nature(renderer.weather.night, renderer.weather.rain, menu.isOpen(), renderer.wolvesNear);
  // otwarte menu wstrzymuje grę; na ekranie tytułowym kamera krąży nad osadą
  if (menu.isOpen()) {
    if (titleScreen) renderer.orbit(elapsed / 1000);
    renderer.frame(elapsed / 1000, 1);
    requestAnimationFrame(loop);
    return;
  }
  if (titleScreen) renderer.endOrbit();
  titleScreen = false;
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
  updateHoverFoe();
  updateBars();
  if (steps) updateAlarm();
  requestAnimationFrame(loop);
}

// adres strony może nieść mapę: #tryb/ziarno
const [hashPreset, hashSeed] = decodeURIComponent(location.hash.slice(1)).split('/');
hud.setMuted(isMuted());
hud.setVolume(getVolume());
const saved = TEST ? null : loadSave(); // test zawsze na świeżej mapie
const restored = saved ? deserialize(saved.data) : null;
const T1 = performance.now();
if (saved && restored) start(saved.seedText, saved.data.preset, restored);
else start(hashSeed || 'project-1', hashPreset && hashPreset in MAP_PRESETS ? (hashPreset as MapPresetId) : '1v1', undefined, 1, TEST && new URLSearchParams(location.search).has('dev'));
mark.push(['start świata', Math.round(performance.now() - T1)]);
console.info('[main]', mark.map(([a, b]) => `${a} ${b} ms`).join(' | '));
menu.setVolume(getVolume());
menu.setMuted(isMuted());
menu.setCanContinue(!!(saved && restored));
if (!TEST) menu.open(false); // w trybie testowym od razu gra
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
requestAnimationFrame(loop);

// podgląd stanu dla testów w przeglądarce
(window as unknown as { __game: () => GameState }).__game = () => game;
(window as unknown as { __cmd: (c: Command) => void }).__cmd = (c) => pending.push(c);
// Skróty do testów w przeglądarce: znajdź miejsce i postaw budynek, dodaj surowce, wyszkol wojsko, przewiń czas
(window as unknown as { __test: unknown }).__test = {
  /** Stawia budynek na pierwszym wolnym miejscu przy twierdzy; zwraca pole albo null */
  build(id: string, player = ME): { x: number; y: number } | null {
    const type = buildingIndex(id);
    const keep = game.buildings.find((b) => b.owner === player && b.type === 0);
    if (!keep || type < 0) return null;
    for (let r = 3; r < 24; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = keep.x + dx, y = keep.y + dy;
          if (canPlace(game, player, type, x, y, false) === null) { step(game, [{ type: 'build', player, building: id, x, y }]); refresh(); return { x, y }; }
        }
    return null;
  },
  /** Dodaje po `n` każdego surowca */
  give(n = 300, player = ME): void { const p = game.players[player]!; for (let i = 0; i < p.res.length; i++) p.res[i]! += n; },
  /** Szkoli `n` włóczników w pierwszych koszarach gracza */
  train(n = 1, player = ME): number { const b = game.buildings.find((x) => x.owner === player && BUILDINGS[x.type]!.id === 'barracks'); if (!b) return 0; for (let i = 0; i < n; i++) pending.push({ type: 'train', player, building: b.id, unit: 'spearman' }); return n; },
  /** Przewija symulację o `ticks` kroków bez rysowania */
  run(ticks: number): void { for (let i = 0; i < ticks; i++) { step(game, pending); pending = []; } refresh(); },
  /** Kamera nad budynkiem danego typu */
  look(id: string, dist = 14): void { const b = game.buildings.find((x) => BUILDINGS[x.type]!.id === id); if (b) renderer.lookAt(b.x + 1, b.y + 1, dist); },
  /** Dostawia `n` wrogich włóczników obok koszar gracza (do testu walki) */
  enemy(n = 3): void {
    const b = game.buildings.find((x) => x.owner === ME && BUILDINGS[x.type]!.id === 'barracks') ?? game.buildings[0]!;
    for (let i = 0; i < n; i++) game.soldiers.push({ id: game.nextId++, owner: 1, kind: 0, px: (b.x + 5 + i) * 256 + 128, py: (b.y + 4) * 256 + 128, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0 });
  },
  state: () => game,
};
(window as unknown as { __look: (x: number, y: number, d?: number) => void }).__look = (x, y, d) => renderer.lookAt(x, y, d);

declare const __BUILD__: string;
const badge = document.createElement('div');
badge.className = 'build';
badge.textContent = `wersja ${__BUILD__}`;
document.body.append(badge);

/** Wywoływane z ekranu wczytywania: kompilacja shaderów i pierwsza klatka jeszcze przed menu */
export function warmup(): void { renderer.warmup(); }

// --- alarmy na mapie: czerwony trójkąt z wykrzyknikiem nad miejscem ataku, a gdy poza ekranem, strzałka przy krawędzi ---
const alertLayer = document.createElement('div');
alertLayer.className = 'alerts';
document.body.append(alertLayer);
type Alert = { x: number; y: number; until: number; kind: 'wolf' | 'enemy'; el: HTMLButtonElement };
const alerts: Alert[] = [];
const hpBefore = new Map<number, number>();
function raiseAlert(x: number, y: number, kind: Alert['kind']): void {
  const now = performance.now();
  const near = alerts.find((a) => Math.abs(a.x - x) < 8 && Math.abs(a.y - y) < 8);
  if (near) { near.until = now + 4000; near.x = x; near.y = y; return; }
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `alert alert-${kind}`;
  el.title = kind === 'wolf' ? 'Wilki atakują — pokaż' : 'Atak wroga — pokaż';
  el.innerHTML = '<span class="alert-tri">!</span>';
  const a: Alert = { x, y, until: now + 4000, kind, el };
  el.addEventListener('click', () => renderer.lookAt(a.x, a.y, 26));
  alertLayer.append(el);
  alerts.push(a);
  play('error');
}
function scanAttacks(): void {
  const mineAt: [number, number][] = [];
  for (const u of game.units) if (u.owner === ME) mineAt.push([u.px / 256, u.py / 256]);
  for (const s of game.soldiers) if (s.owner === ME) mineAt.push([s.px / 256, s.py / 256]);
  const close = (x: number, y: number, r: number): boolean => mineAt.some(([a, b]) => Math.abs(a - x) <= r && Math.abs(b - y) <= r);
  for (const w of game.wolves) {
    const x = w.px / 256, y = w.py / 256;
    const wall = w.gnaw ? game.buildings.find((b) => b.id === w.gnaw && b.owner === ME) : undefined;
    if (close(x, y, 2.5) || wall) raiseAlert(x, y, 'wolf');
  }
  const myTeam = game.players[ME]!.team;
  for (const s of game.soldiers) {
    if (game.players[s.owner]?.team === myTeam) continue;
    const x = s.px / 256, y = s.py / 256;
    if (close(x, y, 3)) raiseAlert(x, y, 'enemy');
  }
  for (const b of game.buildings) {
    if (b.owner !== ME) continue;
    const prev = hpBefore.get(b.id);
    if (prev !== undefined && b.hp < prev) raiseAlert(b.x + 1, b.y + 1, game.wolves.some((w) => w.gnaw === b.id) ? 'wolf' : 'enemy');
    hpBefore.set(b.id, b.hp);
  }
}
let alertTick = 0;
function drawAlerts(): void {
  if (++alertTick % 10 === 0 && !menu.isOpen()) scanAttacks();
  const now = performance.now();
  const W = window.innerWidth, H = window.innerHeight, M = 46;
  for (let i = alerts.length - 1; i >= 0; i--) {
    const a = alerts[i]!;
    if (now > a.until || menu.isOpen()) { a.el.remove(); alerts.splice(i, 1); continue; }
    const p = renderer.project(a.x, a.y);
    const top = 70, bottom = H - 150; // nie wchodzimy na alarm u góry ani na dolny pasek
    const inside = p.front && p.sx > M && p.sx < W - M && p.sy > top && p.sy < bottom;
    if (inside) {
      a.el.classList.remove('edge');
      a.el.style.transform = `translate(${p.sx}px, ${p.sy - 30}px)`;
    } else {
      // strzałka przy krawędzi w stronę ataku
      let dx = p.sx - W / 2, dy = p.sy - H / 2;
      if (!p.front) { dx = -dx; dy = -dy; }
      const k = Math.min((W / 2 - M) / Math.max(1, Math.abs(dx)), ((bottom - top) / 2) / Math.max(1, Math.abs(dy)));
      const ex = W / 2 + dx * k, ey = (top + bottom) / 2 + dy * k;
      a.el.classList.add('edge');
      a.el.style.transform = `translate(${ex}px, ${ey}px) rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
    }
  }
}
(function alertLoop(): void { drawAlerts(); requestAnimationFrame(alertLoop); })();

// --- odzywki ludzi: krótko, szorstko, zależnie od tego, co robią i jak im się żyje ---
const SAY: Record<string, string[]> = {
  idle: ['Czego?', 'Roboty by się znalazło jakiej…', 'Siedzę i czekam. Jak każdy.', 'Panie, daj jaką robotę.', 'Zimno przy tym ognisku.'],
  work: ['Robię, robię.', 'Nie przeszkadzaj, panie.', 'Robota sama się nie zrobi.', 'Ano, pracuje się.', 'Znowu ja?'],
  woodcutter: ['Drzewa nie zetną się same.', 'Siekiera tępa jak wójt.', 'Las daleko, nogi bolą.'],
  quarry: ['Kamień i kamień. Całe życie.', 'Plecy mi pękną od tego.'],
  mine: ['Ciemno tam jak w grobie.', 'Ruda sama nie wyjdzie.'],
  farm: ['Byle deszcz nie zbił zboża.', 'Ziemia dobra, tylko ręce bolą.'],
  orchard: ['Jabłka w tym roku jak pięść.', 'Robaki w połowie, ale jeść można.'],
  fisher: ['Dziś nie biorą.', 'Woda zimna jak serce poborcy.'],
  build: ['Stuk, stuk, i stoi.', 'Kto to projektował, ten nie nosił belek.', 'Jeszcze jedna belka i fajrant.'],
  carry: ['Ciężkie to cholerstwo.', 'Niosę, niosę.', 'Z drogi!'],
  hungry: ['Głodno w osadzie, panie.', 'Brzuch mi do krzyża przyrasta.', 'Z pustym brzuchem nie popracuję.'],
  angry: ['Podatki nas wykończą.', 'Inni pany lepiej płacą.', 'Jeszcze trochę i pójdę stąd.'],
  night: ['Wilki dziś wyją, słyszysz?', 'Po ciemku lepiej nie łazić za palisadę.', 'Spać by się chciało.'],
  wolves: ['Wilki! Ratujcie!', 'Bierz kij, idą!', 'Matko Boska, wilki!'],
  rain: ['Leje i leje.', 'Błoto po kolana.'],
};
const bubble = document.createElement('div');
bubble.className = 'say';
bubble.hidden = true;
document.body.append(bubble);
let sayUnit = 0, sayUntil = 0;
function lineFor(id: number): string {
  const u = game.units.find((x) => x.id === id);
  const p = game.players[ME]!;
  const pick = (k: string): string => { const l = SAY[k]!; return l[Math.floor(Math.random() * l.length)]!; };
  if (!u) return pick('work');
  if (game.wolves.some((w) => (w.px - u.px) ** 2 + (w.py - u.py) ** 2 < (5 * 256) ** 2)) return pick('wolves');
  if (!monthlyForecast(game, p).fed) return pick('hungry');
  if (p.popularity < 45 && Math.random() < 0.6) return pick('angry');
  if (renderer.weather.rain > 0.4 && Math.random() < 0.4) return pick('rain');
  if (renderer.weather.night > 0.5 && Math.random() < 0.4) return pick('night');
  if (u.phase === 13 || u.phase === 14) return pick('build');
  if (u.carryRes >= 0 && Math.random() < 0.5) return pick('carry');
  if (!u.job) return pick('idle');
  const job = game.buildings.find((b) => b.id === u.job);
  const jid = job ? BUILDINGS[job.type]!.id : '';
  return SAY[jid] && Math.random() < 0.7 ? pick(jid) : pick('work');
}
function speak(id: number): void {
  bubble.textContent = lineFor(id);
  bubble.hidden = false;
  sayUnit = id;
  sayUntil = performance.now() + 3200;
  talk(bubble.textContent ?? '', id);
}
function sayLoop(): void {
  if (!bubble.hidden) {
    const u = game.units.find((x) => x.id === sayUnit);
    if (!u || performance.now() > sayUntil || menu.isOpen()) bubble.hidden = true;
    else { const p = renderer.project(u.px / 256, u.py / 256); bubble.style.transform = `translate(${p.sx}px, ${p.sy - 40}px) translate(-50%, -100%)`; }
  }
  requestAnimationFrame(sayLoop);
}
requestAnimationFrame(sayLoop);

/** Rozpiska do panelu: składniki popularności i podział ludności */
function buildReport(f: ReturnType<typeof monthlyForecast>): HudView['report'] {
  const LBL: Record<string, string> = { food: 'Racje jedzenia', tax: 'Podatki', crowd: 'Ciasnota w chatach' };
  const popularity = f.parts.map((x) => ({ label: LBL[x.key] ?? x.key, value: x.value, note: x.level ? `(${t(x.level).toLowerCase()})` : undefined }));
  if (!f.fed) popularity.push({ label: 'Brak jedzenia na wybrane racje', value: 0, note: '(jedzą mniej)' });
  const mine = game.units.filter((u) => u.owner === ME);
  const jobs = new Map<string, number>();
  let idle = 0, builders = 0;
  for (const u of mine) {
    if (u.phase === 13 || u.phase === 14) { builders++; continue; }
    if (!u.job) { idle++; continue; }
    const b = game.buildings.find((x) => x.id === u.job);
    const name = b ? t(BUILDINGS[b.type]!.name) : '?';
    jobs.set(name, (jobs.get(name) ?? 0) + 1);
  }
  const people: { label: string; value: number }[] = [{ label: 'Wszyscy chłopi', value: mine.length }, { label: 'Bez pracy', value: idle }, { label: 'Na budowie', value: builders }];
  for (const [k, v] of [...jobs.entries()].sort((a, b) => b[1] - a[1])) people.push({ label: k, value: v });
  people.push({ label: 'Żołnierze', value: game.soldiers.filter((s) => s.owner === ME).length });
  const coming = game.travelers.filter((x) => x.owner === ME && !x.leaving).length, going = game.travelers.filter((x) => x.owner === ME && x.leaving).length;
  if (coming) people.push({ label: 'W drodze do osady', value: coming });
  if (going) people.push({ label: 'Odchodzą', value: going });
  return { popularity, people };
}
