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
import { createHud } from './ui/hud';
import { TEST } from './testmode';
import { createMenu, loadSettings, type Settings } from './ui/menu';
import { getVolume, isMuted, play, setBusVolume, setVolume, toggleMute, unlockAudio } from './audio/sfx';
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
  onTrain: (id, n) => { const k = Math.min(n, recruitInfo().max); for (let i = 0; i < k; i++) pending.push({ type: 'train', player: ME, building: id, unit: 'spearman' }); if (k) play('build'); },
}, TEST ? new Map() : renderThumbnails(proceduralModels, TEAM_COLORS[0]!, 192));

// Menu główne: przy wejściu do gry osada stoi w tle i powoli się obraca, symulacja czeka
const menu = createMenu(document.body, {
  onContinue: () => menu.close(),
  onNewGame: (seedText, preset) => { start(seedText, preset); menu.close(); },
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

function start(seedText: string, preset: MapPresetId, loaded?: GameState): void {
  endShown = false;
  game = loaded ?? createGame(seedFromText(seedText), preset);
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
  const road = id !== null && !!BUILDINGS[buildingIndex(id)]?.road;
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
}

function select(id: number): void {
  if (id && selectedUnit) { selectedUnit = 0; renderer.setUnitSelection(0); }
  selected = id;
  const b = game.buildings.find((x) => x.id === id);
  renderer.setSelection(b ? id : 0);
  hud.showInfo(b ? { id, def: BUILDINGS[b.type]!, hasWorker: b.worker !== 0, own: b.owner === ME, canTrain: canTrain(), hp: b.hp, maxHp: maxHp(b.type), recruit: BUILDINGS[b.type]!.id === 'barracks' ? recruitInfo() : undefined } : null);
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
    if (game.roads[tile.y * game.map.width + tile.x] && !pending.some((c) => c.type === 'unroad' && c.x === tile.x && c.y === tile.y)) pending.push({ type: 'unroad', player: ME, x: tile.x, y: tile.y });
    return;
  }
  if (!picked) return;
  const type = buildingIndex(picked);
  if (canPlace(game, ME, type, tile.x, tile.y) === null && !pending.some((c) => c.type === 'build' && c.x === tile.x && c.y === tile.y))
    { pending.push({ type: 'build', player: ME, building: picked, x: tile.x, y: tile.y }); play('road'); }
};

renderer.onUnit = (id) => { if (!picked && !wrecking) selectUnit(id === selectedUnit ? 0 : id); };

renderer.onClick = (tile, touch) => {
  if (wrecking) {
    const id = game.occupancy[tile.y * game.map.width + tile.x] ?? 0;
    const b = game.buildings.find((x) => x.id === id);
    if (b && b.owner === ME && BUILDINGS[b.type]!.buildable) { pending.push({ type: 'demolish', player: ME, id }); play('demolish'); }
    else if (game.roads[tile.y * game.map.width + tile.x]) pending.push({ type: 'unroad', player: ME, x: tile.x, y: tile.y });
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
    if (!hoverFoe && hoverTile) {
      const b = game.buildings.find((x) => x.id === game.occupancy[hoverTile!.y * game.map.width + hoverTile!.x]);
      if (b && game.players[b.owner]?.team !== game.players[ME]!.team) hoverFoe = b.id;
    }
  }
  canvas.classList.toggle('attack', hoverFoe !== 0);
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
  let n = 0;
  for (const s of list) {
    const max = UNITS[game.soldiers.find((x) => x.id === s.id)?.kind ?? 0]!.hp;
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

let endShown = false;
function showEnd(win: boolean): void {
  endShown = true;
  const box = document.createElement('div');
  box.className = 'end';
  box.innerHTML = `<div class="panel end-panel"><p class="menu-title">${t(win ? 'end.win' : 'end.lose')}</p><p class="menu-sub">${t(win ? 'end.winText' : 'end.loseText')}</p><div class="menu-list"></div></div>`;
  const list = box.querySelector('.menu-list')!;
  const btn = (text: string, fn: () => void): void => { const b = document.createElement('button'); b.type = 'button'; b.className = 'menu-btn'; b.textContent = text; b.addEventListener('click', () => { box.remove(); fn(); }); list.append(b); };
  btn(t('end.menu'), () => menu.open(true));
  btn(t('end.watch'), () => {});
  document.body.append(box);
  play(win ? 'build' : 'collapse');
}

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
    else hud.showInfo({ id: b.id, def: BUILDINGS[b.type]!, hasWorker: b.worker !== 0, own: b.owner === ME, canTrain: canTrain(), hp: b.hp, maxHp: maxHp(b.type), recruit: BUILDINGS[b.type]!.id === 'barracks' ? recruitInfo() : undefined });
  }
}

let last = performance.now();
let acc = 0;
function loop(now: number): void {
  const elapsed = Math.min(250, now - last);
  last = now;
  // otwarte menu wstrzymuje grę; na ekranie tytułowym kamera krąży nad osadą
  if (menu.isOpen()) {
    if (titleScreen) renderer.orbit(elapsed / 1000);
    renderer.frame(elapsed / 1000, 1);
    requestAnimationFrame(loop);
    return;
  }
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
  requestAnimationFrame(loop);
}

// adres strony może nieść mapę: #tryb/ziarno
const [hashPreset, hashSeed] = decodeURIComponent(location.hash.slice(1)).split('/');
hud.setMuted(isMuted());
hud.setVolume(getVolume());
const saved = TEST ? null : loadSave(); // test zawsze na świeżej mapie
const restored = saved ? deserialize(saved.data) : null;
if (saved && restored) start(saved.seedText, saved.data.preset, restored);
else start(hashSeed || 'project-1', hashPreset && hashPreset in MAP_PRESETS ? (hashPreset as MapPresetId) : '1v1');
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
