import { BUILDINGS, buildingIndex, footprint } from './data/buildings';
import { RESOURCE_DEFS, RESOURCES, resIndex, type ResourceId, type StoreKind } from './data/resources';
import { UNITS } from './data/units';
import { MAP_PRESETS, type MapPresetId } from './data/maps';
import { BYNAMES, FIRST_NAMES } from './data/names';
import { t } from './i18n';
import { GameRenderer, type TileRef } from './render/scene';
import { clockAt } from './sim/clock';
import { seedFromText } from './sim/rng';
import { deserialize, serialize, type SaveData } from './sim/save';
import { Phase, TICKS_PER_SECOND, createGame, housing, idleCount, idleSlots, population, stateHash, storeCapacity, storeUsed, type GameState } from './sim/state';
import { step, type Command } from './sim/step';
import { monthlyForecast } from './sim/systems/economy';
import { buildWork, canAfford, canPlace, maxHp } from './sim/systems/placement';
import { createHud, type BuildingInfo, type HudView, type RecruitUnit } from './ui/hud';
import { createScribe } from './ui/scribe';
import { nextWave } from './sim/systems/bot';
import { octant, planFormation } from './sim/systems/army';
import { SANDBOX, TEST } from './testmode';
import { Lockstep, TURN } from './net/lockstep';
import { deleteRoom, me as netMe, saveResult, setStatus } from './net/supa';
import type { OnlineStart } from './ui/online';
import { createGameChat } from './ui/chat';
import { createMenu, loadSettings, saveSettings, type Settings } from './ui/menu';
import { AutoQuality, TIERS, TOP_TIER } from './render/autoquality';
import { alarmBell, daySounds, music, getVolume, isMuted, nature, play, talk, warHorn, setBusVolume, setVolume, toggleMute, unlockAudio } from './audio/sfx';
import { proceduralModels } from './render/models';
import { renderThumbnails } from './render/thumbnails';
import { cachedThumbs, saveThumbs } from './render/thumbcache';
import { texturesReady } from './render/textures';
import { TEAM_COLORS } from './data/teams';

let ME = 0; // gracz sterowany lokalnie (w grze przez sieć gość ma 1)
const TICK_MS = 1000 / TICKS_PER_SECOND;
const WORDS = ['wilk', 'dab', 'orzel', 'kruk', 'zubr', 'miecz', 'baszta', 'wrota', 'las', 'skala', 'rzeka', 'brod'];

const canvas = document.getElementById('game') as HTMLCanvasElement;
const T0 = performance.now();
const renderer = new GameRenderer(canvas);
const mark: [string, number][] = [['renderer', Math.round(performance.now() - T0)]];
let game: GameState;
let pending: Command[] = [];
let speed = 1;
/** Mecz przez sieć (null = gra sama z botami) */
let net: Lockstep | null = null;
let netGame: OnlineStart | null = null;
let netNotes = { desync: false, left: 0 };
const netWait = document.createElement('div');
netWait.className = 'net-wait';
netWait.textContent = 'Czekam na przeciwnika…';
netWait.hidden = true;
document.body.append(netWait);
const chat = createGameChat(document.body, () => play('click'));
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
/** Ustawienia gracza, które nie należą do symulacji, ale mają przetrwać odświeżenie strony */
interface UiSave { groups?: [number, number[]][]; form?: number; march?: number; speed?: number; cam?: { x: number; z: number; dist: number; yaw: number } }

function save(): void {
  if (SANDBOX || net || gameOver) return; // skończona gra i gra przez sieć nie nadpisuje zapisu; tryb testowy nie nadpisuje prawdziwego zapisu gracza
  const ui: UiSave = { groups: [...groups], form: armyForm, march: armyMarch, speed, cam: renderer.camView };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ seedText: currentSeedText, data: serialize(game, currentPreset), ui })); } catch { /* brak dostępu do pamięci przeglądarki */ }
}

/** Po wczytaniu zapisu: grupy, szyk, tryb marszu, tempo i kamera jak przed odświeżeniem */
function applyUi(ui: UiSave | undefined): void {
  if (!ui) return;
  groups.clear();
  for (const [n, ids] of ui.groups ?? []) if (Number.isInteger(n) && n >= 0 && n <= 9 && Array.isArray(ids)) groups.set(n, ids.filter((x) => Number.isInteger(x)));
  if (Number.isInteger(ui.form) && ui.form! >= 0 && ui.form! <= 2) armyForm = ui.form!;
  if (ui.march === 0 || ui.march === 1) armyMarch = ui.march;
  if (ui.cam) renderer.setCamView(ui.cam);
  // tempo: przyciskami, żeby pasek pokazał tę samą wartość (pauzy nie odtwarzamy)
  const idx = [0, 1, 2, 3, 5].indexOf(ui.speed ?? 1);
  if (idx > 1) { hud.stepSpeed(-9); hud.stepSpeed(1); for (let i = 1; i < idx; i++) hud.stepSpeed(1); }
  armyBarUpdate();
}

// zapis przy zamknięciu, odświeżeniu i przełączeniu karty: nic nie ginie, nawet przy zatrzymanej grze
window.addEventListener('pagehide', () => { if (game) save(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && game) save(); });
setInterval(() => { if (game) save(); }, 15000);

function loadSave(): { seedText: string; data: SaveData; ui?: UiSave } | null {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null'); } catch { return null; }
}

// miniatury z poprzedniej wizyty tej samej wersji gry albo rysowane teraz
const savedThumbs = TEST ? null : cachedThumbs();
const thumbs: Map<string, string> = TEST ? new Map() : savedThumbs ?? renderThumbnails(proceduralModels, TEAM_COLORS[0]!, 288);
const hud = createHud(document.getElementById('ui')!, {
  onArmyKind: (kind, shift) => {
    const ids = game.soldiers.filter((x) => chosen.has(x.id) && (UNITS[x.kind]!.id === kind) !== shift).map((x) => x.id);
    if (ids.length) { chooseSoldiers(ids, false); play('select'); }
  },
  onArmyForm: (form) => { armyForm = form; reform(); play('rotate'); },
  onArmyStance: (stance) => { if (chosen.size) { pending.push({ type: 'stance', player: ME, ids: [...chosen], stance }); play('select'); shout('move'); } },
  onArmyMarch: (m) => { armyMarch = m; play('select'); showArmy(); },
  onArmyUnit: (id, shift) => { if (shift) chooseSoldiers([id], false); else unchoose(id); play('select'); },
  onGroup: (n, action) => groupAction(n, action),
  onNewGame: (seedText, preset) => start(seedText || 'project-1', preset),
  // losowanie nazwy mapy to interfejs, nie symulacja, więc Math.random jest tu w porządku
  onRandom: (preset) => start(`${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 900 + 100)}`, preset),
  onPickBuilding: (id) => { if (wrecking) setWreck(false); pick(id); },
  onRations: (level) => pending.push({ type: 'setRations', player: ME, level }),
  onTax: (level) => pending.push({ type: 'setTax', player: ME, level }),
  onSpeed: (s) => {
    // z drugim prawdziwym graczem nie ma pauzy ani przyspieszania: czas płynie tak samo u obu
    if (net) { hud.toast('W grze z drugim graczem nie można pauzować ani zmieniać tempa.'); return false; }
    speed = s;
    return true;
  },
  onDemolish: (id) => confirmDemolish(id),
  onCloseInfo: () => { selectUnit(0); select(0); if (chosen.size) chooseSoldiers([], false); },
  onRotate: () => rotate(),
  onWreck: () => setWreck(!wrecking),
  onVolume: (v) => setVolume(v),
  onMute: () => hud.setMuted(toggleMute()),
  onMenu: () => menu.open(!gameOver),
  onAccount: () => menu.account(true),
  onWalk: () => walkAs(selectedUnit),
  onRandomWalk: () => {
    // najchętniej ktoś, kto akurat idzie (więcej widać), inaczej ktokolwiek z mojej osady
    const mine = game.units.filter((u) => u.owner === ME);
    const going = mine.filter((u) => u.path.length > 0);
    const pool = going.length ? going : mine;
    const u = pool[Math.floor(Math.random() * pool.length)];
    if (u) { selectUnit(u.id); walkAs(u.id); }
  },
  onArea: (id) => {
    if (!shownAreas.delete(id)) shownAreas.add(id);
    renderer.setAreas(shownAreas);
    const b = game.buildings.find((x) => x.id === id);
    if (b) hud.showInfo(buildingInfo(b));
    play('select');
  },
  onDismount: (id) => { pending.push({ type: 'dismount', player: ME, tower: id }); play('rotate'); },
  onSelectGarrison: (id) => { chooseSoldiers(game.soldiers.filter((s) => s.owner === ME && s.post === id).map((s) => s.id), false); play('select'); },
  onGate: (id, open) => { pending.push({ type: 'gate', player: ME, id, open }); play('click'); },
  onTrain: (id, n, unit = 'spearman') => { const k = Math.min(n, recruitInfo().find((u) => u.id === unit)?.max ?? 0); for (let i = 0; i < k; i++) pending.push({ type: 'train', player: ME, building: id, unit }); if (k) play('build'); },
}, thumbs);

// Miniatury rysują się od razu, a gdy dojdą tekstury zdjęciowe (deski, strzecha, bruk), rysujemy je jeszcze raz w pełnych barwach
if (!TEST && !savedThumbs) void texturesReady().then(() => {
  const fresh = renderThumbnails(proceduralModels, TEAM_COLORS[0]!, 288);
  void saveThumbs(fresh);
  for (const [id, old] of thumbs) {
    const src = fresh.get(id);
    if (!src) continue;
    document.querySelectorAll<HTMLImageElement>('img').forEach((img) => { if (img.src === old) img.src = src; });
  }
});

// Menu główne: przy wejściu do gry osada stoi w tle i powoli się obraca, symulacja czeka
mark.push(['hud+miniatury', Math.round(performance.now() - T0)]);
/** Mapa generowana w podglądzie nowej gry (null = brak podglądu) */
let preview: GameState | null = null;
const menu = createMenu(document.body, {
  onContinue: () => { menu.close(); if (!net) setStatus({ where: 'solo' }); },
  // podgląd nowej mapy: generujemy ją obok bieżącej gry i pokazujemy z lotu ptaka; bieżąca gra czeka nietknięta
  onPreviewMap: (seedText, preset, level, dev) => {
    preview = createGame(seedFromText(seedText), preset, level, dev);
    renderer.setState(preview, MAP_PRESETS[preset].waterLevel, MAP_PRESETS[preset].rim, 0);
    renderer.startPreview();
  },
  onPreviewEnd: () => {
    if (!preview) return;
    preview = null;
    renderer.endPreview();
    renderer.setState(game, MAP_PRESETS[currentPreset].waterLevel, MAP_PRESETS[currentPreset].rim, ME);
  },
  onNewGame: (seedText, preset, level, dev, instant) => {
    preview = null;
    renderer.endPreview();
    // nowa mapa buduje się za ekranem wczytywania, a nie w zawieszonym menu
    const cover = document.createElement('div');
    cover.id = 'loading';
    cover.innerHTML = `<div class="loading-card"><p class="loading-title">Project‑1</p><div class="loading-bar"><span style="width:60%"></span></div><p class="loading-line"><span>${t('load.map')}</span><strong></strong></p></div>`;
    document.body.append(cover);
    requestAnimationFrame(() => setTimeout(() => {
      start(seedText, preset, undefined, level, dev, undefined, instant);
      setStatus({ where: 'solo' });
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
  isOnline: () => !!net,
  onQuitToTitle: () => {
    if (net) {
      // wyjście z meczu przez sieć: poddanie (porażka trafia do rankingu)
      game.players[ME]!.defeated = true;
      showEnd(false);
      document.querySelector('.end')?.remove();
    } else save();
    // ekran tytułowy: osada w tle, menu jak po uruchomieniu gry; gra z botami czeka pod „Kontynuuj”
    titleScreen = true;
    menu.setCanContinue(!gameOver && !!loadSave());
    menu.open(false);
  },
  onSurrender: () => {
    // w sieci: wyjście = kapitulacja u wszystkich (lockstep wyśle ją w tej samej turze); lokalnie od razu porażka
    // showEnd zapisze porażkę do rankingu i zamknie mecz (inni dostaną kapitulację w tej samej turze)
    game.players[ME]!.defeated = true;
    menu.close();
    showEnd(false);
  },
  onOnlineStart: (st) => {
    const cover = document.createElement('div');
    cover.id = 'loading';
    cover.innerHTML = `<div class="loading-card"><p class="loading-title">Project‑1</p><div class="loading-bar"><span style="width:60%"></span></div><p class="loading-line"><span>${t('load.map')}</span><strong></strong></p></div>`;
    document.body.append(cover);
    requestAnimationFrame(() => setTimeout(() => {
      startOnline(st);
      renderer.warmup();
      menu.close();
      (cover.querySelector('.loading-bar span') as HTMLElement).style.width = '100%';
      cover.classList.add('done');
      setTimeout(() => cover.remove(), 500);
    }, 30));
  },
});

/** Mecz 1 na 1 przez sieć: obie przeglądarki stawiają tę samą mapę z tego samego ziarna, bez botów na miejscach graczy. */
function startOnline(st: OnlineStart): void {
  start(st.seed, st.preset, undefined, st.level, false, st);
  const mine = st.slots[st.me];
  if (mine?.kind === 'human') chat.attach(st.link, { id: mine.id, nick: mine.nick, avatar: mine.avatar });
  const names = st.slots.map((x) => (x.kind === 'human' ? x.nick : null)).filter(Boolean);
  hud.toast(`Mecz przez sieć (${st.preset}): ${names.join(', ')}${st.slots.some((x) => x.kind === 'bot') ? ' + boty' : ''}.`);
}
/**
 * Gra stoi, bo brakuje czyichś poleceń. Po chwili pokazujemy, na kogo czekamy i ile jeszcze;
 * kto zniknął z pokoju na 15 s (albo milczy 45 s), ten jest uznany za wychodzącego — reszta gra dalej.
 */
const DROP_ABSENT_MS = 15_000, DROP_SILENT_MS = 45_000;
function waitFor(turn: number, now: number): void {
  if (!net || !netGame) return;
  if (!net.waitingSince) net.waitingSince = now;
  const waited = now - net.waitingSince;
  const missing = net.missing(turn);
  const here = new Set(netGame.link.members().map((m) => m.id));
  const nick = (p: number): string => { const x = netGame!.slots[p]; return x?.kind === 'human' ? x.nick : `gracz ${p + 1}`; };
  const absent = missing.filter((p) => { const x = netGame!.slots[p]; return x?.kind === 'human' && !here.has(x.id); });
  for (const p of missing) if ((absent.includes(p) && waited > DROP_ABSENT_MS) || waited > DROP_SILENT_MS) net.drop(p);
  netWait.hidden = waited < 400;
  if (!netWait.hidden) {
    const left = Math.ceil(((absent.length ? DROP_ABSENT_MS : DROP_SILENT_MS) - waited) / 1000);
    netWait.textContent = `Czekam na: ${missing.map(nick).join(', ') || 'graczy'}${waited > 3000 ? ` — ${absent.length ? 'brak połączenia' : 'słabe połączenie'}, jeszcze ${Math.max(0, left)} s` : '…'}`;
  }
}
function endOnline(): void {
  if (!net || !netGame) return;
  net.close();
  chat.detach();
  netGame.link.close();
  // koniec meczu: gospodarz usuwa pokój z bazy (nic po meczu nie zostaje)
  if (netMe()?.id === netGame.room.host) void deleteRoom(netGame.room.id);
  net = null; netGame = null; netWait.hidden = true;
  setStatus({ where: 'menu' });
}
window.addEventListener('beforeunload', () => endOnline());
let titleScreen = true;
/** Bieżące ustawienia (te same, które zmienia menu) i automat jakości grafiki */
let gfx: Settings = loadSettings();
const autoQ = new AutoQuality(gfx.autoTier ?? TOP_TIER - 1);
function applySettings(st: Settings): void {
  gfx = st;
  // automat: cienie, cieniowanie zagłębień, rozdzielczość i zasięg trawy z poziomu dobranego do komputera
  if (st.auto) { const q = TIERS[autoQ.tier]!; renderer.setGraphics({ ...st, ...q, label: `automat ${autoQ.tier + 1}/${TIERS.length}` }); }
  else renderer.setGraphics({ ...st, grass: st.grass ?? 1 });
  setBusVolume('sfx', st.sfx);
  setBusVolume('ui', st.ui);
  setBusVolume('amb', st.amb);
  setBusVolume('music', st.music ?? 0.45);
}
applySettings(gfx);

function start(seedText: string, preset: MapPresetId, loaded?: GameState, level = 2, dev = false, online?: OnlineStart, instant = true): void {
  endShown = false;
  gameOver = false;
  endOnline();
  ME = online ? online.me : 0;
  game = loaded ?? createGame(seedFromText(seedText), preset, level, dev, online?.humans, instant);
  // nowa mapa: grupy i zaznaczenie z poprzedniej gry nie mają sensu (przy wczytaniu wracają z zapisu)
  if (!loaded) groups.clear();
  chosen.clear(); renderer.setSoldierSelection(chosen);
  shownAreas.clear(); renderer.setAreas(shownAreas);
  setStatus({ where: online ? 'game' : 'menu' });
  if (online) {
    net = online.net; netGame = online; netNotes = { desync: false, left: 0 };
    speed = 1; acc = 0;
  }
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

/** Budynki, których teren pracy jest pokazany na mapie (zielony kwadrat) */
const shownAreas = new Set<number>();

/** Plac budowy w panelu: postęp, materiał, robotnicy i co się teraz dzieje */
function siteInfo(b: GameState['buildings'][number]): NonNullable<BuildingInfo['site']> {
  const work = buildWork(b.type);
  const pct = Math.max(0, Math.min(99, Math.floor((1 - b.build / work) * 100)));
  let carrying = 0, fetching = 0, builders = 0, hammering = 0;
  for (const u of game.units) {
    if (u.target !== b.id) continue;
    if (u.phase === Phase.ToFetch) fetching++;
    else if (u.phase === Phase.ToRepair && u.carryRes >= 0) carrying++;
    if (u.phase === Phase.ToFetch || u.phase === Phase.ToRepair || u.phase === Phase.Repairing) builders++;
    if (u.phase === Phase.Repairing) hammering++;
  }
  const loads = b.loads ?? 0, delivered = b.delivered ?? 0;
  const starved = loads > 0 && (1 - b.build / work) * loads >= delivered - 0.001;
  const state = !builders ? 'brak wolnych ludzi — czeka na robotników'
    : starved && (fetching || carrying) ? 'robotnicy niosą materiał ze składu'
    : starved ? 'czeka na materiał'
    : hammering ? 'trwa budowa' : 'robotnicy idą na plac';
  return { pct, loads, delivered, carrying, fetching, builders, state };
}

/** Wszystko, co panel budynku pokazuje o wybranym budynku (w składach także zapasy z ikonami) */
function buildingInfo(b: GameState['buildings'][number]): BuildingInfo {
  const def = BUILDINGS[b.type]!;
  const p = game.players[b.owner]!;
  const stock = b.owner === ME && def.capacity && !b.build
    ? (Object.entries(def.capacity) as [StoreKind, number][]).map(([kind, here]) => ({
      kind, here, used: storeUsed(p, kind), max: storeCapacity(game, b.owner, kind),
      items: RESOURCES.map((id, i) => ({ id, amount: p.res[i]! })).filter((x) => RESOURCE_DEFS[x.id].store === kind && x.amount > 0),
    }))
    : undefined;
  return { id: b.id, def, hasWorker: b.worker !== 0, own: b.owner === ME, canTrain: canTrain(), hp: b.hp, maxHp: maxHp(b.type), stock,
    recruit: def.id === 'barracks' ? recruitInfo() : undefined, gate: def.gate ? { open: b.gateOpen ?? true, shut: !!b.shut } : undefined,
    garrison: def.id === 'watchtower' ? game.soldiers.filter((s) => s.post === b.id && s.up).length : undefined,
    area: def.area || def.id === 'watchtower' ? shownAreas.has(b.id) : undefined,
    site: b.build ? siteInfo(b) : undefined };
}

function select(id: number): void {
  if (id && selectedUnit) { selectedUnit = 0; renderer.setUnitSelection(0); }
  selected = id;
  const b = game.buildings.find((x) => x.id === id);
  renderer.setSelection(b ? id : 0);
  hud.showInfo(b ? buildingInfo(b) : null);
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

/** Spacer oczami wybranego mieszkańca */
function walkAs(id: number): void {
  const u = game.units.find((x) => x.id === id);
  if (!u || renderer.walking) return;
  document.body.classList.add('walking');
  walkHint.hidden = false;
  renderer.startWalk(u.px / 256, u.py / 256);
}

window.addEventListener('keydown', (e) => {
  if (renderer.walking) return; // spacer oczami chłopa: klawisze należą do spaceru
  if (e.key === 'Escape' && plan.state !== 'none') { cancelPlan(); return; }
  if (e.key === 'Escape') {
    if (menu.isOpen()) { if (!titleScreen) menu.close(); return; }
    if (wrecking) setWreck(false);
    else if (picked) pick(null);
    else if (chosen.size) chooseSoldiers([], false);
    else if (selected || selectedUnit) { select(0); selectUnit(0); }
    else menu.open(!gameOver);
    return;
  }
  if (menu.isOpen()) return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Enter' && chat.active) { e.preventDefault(); chat.open(); return; }
  if (e.code === 'KeyR' && picked) rotate();
  if (e.code === 'KeyF' && selectedUnit && !e.repeat) { walkAs(selectedUnit); return; } // F przy zaznaczonym mieszkańcu = przejdź się jego oczami
  if (e.code === 'KeyM') hud.setMuted(toggleMute());
  if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') hud.stepSpeed(1);
  if (e.key === '-' || e.code === 'NumpadSubtract') hud.stepSpeed(-1);
});
canvas.addEventListener('contextmenu', () => {
  if (plan.state !== 'none') { cancelPlan(); play('rotate'); return; }
  if (wrecking) setWreck(false);
  else if (picked) pick(null);
  // rozkazy dla wojska idą przy puszczeniu prawego przycisku (niżej), żeby drobne drgnięcie myszy ich nie gubiło
});

// ---- wojsko: prawy klik = marsz/atak, prawy przeciągnięty = linia frontu i kierunek szyku ----
/** Wybrana formacja: 0 linia, 1 blok, 2 luźno */
let armyForm = 0;
/** Grupy wojska pod cyframi (numer → id żołnierzy); trafiają do zapisu gry */
const groups = new Map<number, number[]>();
let lastGroup = { n: 0, at: 0 };
let armyBarKey = '';
/** Tryb marszu: 0 zwykły, 1 z walką (Ctrl przy rozkazie odwraca) */
let armyMarch = 0;
let rDrag: { x: number; y: number; tile: { x: number; y: number } | null; on: boolean } | null = null;

/** Szyk narysowany przeciągnięciem: środek odcinka, twarzą od strony, z której przychodzą, szerokość = długość odcinka */
function dragOrder(start: { x: number; y: number } | null, amove = false): { x: number; y: number; face: number; form: number; width: number; amove: boolean } | null {
  const end = hoverTile;
  if (!start || !end) return null;
  const vx = end.x - start.x, vy = end.y - start.y;
  if (!vx && !vy) return null;
  const cx = Math.round((start.x + end.x) / 2), cy = Math.round((start.y + end.y) / 2);
  const list = game.soldiers.filter((x) => chosen.has(x.id));
  if (!list.length) return null;
  const mx = list.reduce((a, x) => a + (x.px >> 8), 0) / list.length, my = list.reduce((a, x) => a + (x.py >> 8), 0) / list.length;
  // dwie prostopadłe do odcinka: wybieramy tę, która patrzy dalej od oddziału (idą i stają przodem do celu)
  let px = -vy, py = vx;
  if (px * (cx - mx) + py * (cy - my) < 0) { px = -px; py = -py; }
  const face = octant(px, py);
  const stepLen = (face % 2 ? Math.SQRT2 : 1) * (armyForm === 2 ? 2 : 1);
  const width = Math.max(1, Math.min(list.length, Math.round(Math.hypot(vx, vy) / stepLen) + 1));
  return { x: cx, y: cy, face, form: armyForm, width, amove };
}

/** Zmiana formacji w miejscu: oddział przestawia się tam, gdzie stoi albo dokąd idzie */
function reform(): void {
  const list = game.soldiers.filter((x) => chosen.has(x.id));
  if (!list.length) return;
  const W = game.map.width;
  let sx = 0, sy = 0;
  for (const x of list) { const t = x.goal >= 0 ? x.goal : (x.py >> 8) * W + (x.px >> 8); sx += t % W; sy += Math.floor(t / W); }
  const faces = new Map<number, number>();
  for (const x of list) if (x.face !== undefined) faces.set(x.face, (faces.get(x.face) ?? 0) + 1);
  const face = [...faces].sort((a, b) => b[1] - a[1])[0]?.[0];
  pending.push({ type: 'move', player: ME, ids: list.map((x) => x.id), x: Math.round(sx / list.length), y: Math.round(sy / list.length), face, form: armyForm });
}

/** Zwykły prawy klik przy zaznaczonym wojsku: atak na wroga, wejście na wieżę albo marsz */
function armyRightClick(amove: boolean): void {
  if (!chosen.size) return;
  if (hoverFoe) {
    pending.push({ type: 'attack', player: ME, ids: [...chosen], target: hoverFoe });
    play('select');
    shout('attack');
    return;
  }
  if (!hoverTile) return;
  const b = game.buildings.find((x) => x.id === game.occupancy[hoverTile!.y * game.map.width + hoverTile!.x]);
  if (b && b.owner === ME && BUILDINGS[b.type]!.id === 'watchtower') {
    pending.push({ type: 'garrison', player: ME, ids: [...chosen], tower: b.id });
    play('rotate');
    shout('move');
    return;
  }
  pending.push({ type: 'move', player: ME, ids: [...chosen], x: hoverTile.x, y: hoverTile.y, form: armyForm, amove });
  renderer.orderMarker(hoverTile);
  play('rotate');
  shout(amove ? 'attack' : 'move');
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 2 || !chosen.size || picked || wrecking || plan.state !== 'none' || menu.isOpen()) return;
  rDrag = { x: e.clientX, y: e.clientY, tile: hoverTile ? { ...hoverTile } : null, on: false };
  // przy zaznaczonym wojsku prawy przycisk rysuje szyk; kamerę obracają Q/E albo Ctrl + lewy
  renderer.lockRotate = true;
});
window.addEventListener('pointermove', (e) => {
  if (!rDrag || !(e.buttons & 2)) return;
  if (!rDrag.on && Math.hypot(e.clientX - rDrag.x, e.clientY - rDrag.y) < 14) return;
  rDrag.on = true;
  const o = dragOrder(rDrag.tile);
  renderer.setFormationPreview(o ? [...planFormation(game, ME, [...chosen], o.y * game.map.width + o.x, o).spots.values()] : null);
});
canvas.addEventListener('pointerup', (e) => {
  if (e.button !== 2) return;
  const d = rDrag;
  rDrag = null;
  renderer.lockRotate = false;
  renderer.setFormationPreview(null);
  if (!d || !chosen.size) return;
  const amove = (armyMarch === 1) !== e.ctrlKey;
  const o = d.on ? dragOrder(d.tile, amove) : null;
  if (o) {
    pending.push({ type: 'move', player: ME, ids: [...chosen], ...o });
    renderer.orderMarker(o);
    play('rotate');
    shout(amove ? 'attack' : 'move');
    return;
  }
  armyRightClick(amove);
}, { capture: true });
window.addEventListener('blur', () => { rDrag = null; renderer.lockRotate = false; renderer.setFormationPreview(null); });

// ---- wojsko: zaznaczanie ramką lub kliknięciem, rozkaz marszu prawym przyciskiem ----
const chosen = new Set<number>();
const selBox = document.createElement('div');
selBox.className = 'selbox';
selBox.hidden = true;
document.body.append(selBox);
let boxStart: { x: number; y: number } | null = null;
let lastPick = { id: 0, at: 0 };

function recruitInfo(): RecruitUnit[] {
  const p = game.players[ME]!;
  const gold = p.res[resIndex('gold')]!;
  const idle = game.units.filter((u) => u.owner === ME && u.job === 0).length;
  return UNITS.map((def) => {
    const have = p.res[resIndex(def.weapon)]!;
    const cost = def.cost.gold ?? 0;
    return { id: def.id, name: t(def.name), weapon: def.weapon, have, gold, idle, cost, hp: def.hp, attack: def.attack, range: def.range, max: Math.max(0, Math.min(have, cost ? Math.floor(gold / cost) : 999, idle)) };
  });
}

function canTrain(): boolean {
  const p = game.players[ME]!;
  const def = UNITS[0]!;
  for (const [res, amount] of Object.entries(def.cost)) if (p.res[resIndex(res as ResourceId)]! < amount!) return false;
  return game.units.some((u) => u.owner === ME && u.job === 0);
}

function chooseSoldiers(ids: number[], add: boolean, quiet = false): void {
  if (!add) chosen.clear();
  for (const id of ids) chosen.add(id);
  if (ids.length && !quiet) shout('select');
  renderer.setSoldierSelection(chosen);
  if (chosen.size) {
    select(0);
    selectUnit(0);
    showArmy();
  } else hud.showArmy([]);
  armyBarUpdate();
}

/** Odznacza jednego żołnierza, reszta zostaje zaznaczona */
function unchoose(id: number): void {
  chosen.delete(id);
  renderer.setSoldierSelection(chosen);
  if (chosen.size) showArmy(); else hud.showArmy([]);
  armyBarUpdate();
}

/** Karta zaznaczonego wojska: portrety ze zdrowiem; znika, gdy żołnierze zginą */
function showArmy(): void {
  const list = game.soldiers.filter((s) => chosen.has(s.id));
  if (list.length !== chosen.size) { chosen.clear(); for (const s of list) chosen.add(s.id); renderer.setSoldierSelection(chosen); }
  const st = new Set(list.map((s) => s.stance ?? 0));
  hud.showArmy(list.map((s) => ({ id: s.id, name: t(UNITS[s.kind]!.name), hp: s.hp, max: UNITS[s.kind]!.hp, kind: UNITS[s.kind]!.id })), { form: armyForm, stance: st.size === 1 ? [...st][0]! : -1, march: armyMarch, group: groupOf() });
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
  // zwykłe kliknięcie: najbliższy żołnierz pod kursorem (trafia się w całą sylwetkę, od stóp po hełm)
  let best = 0, bestD = 30 * 30;
  for (const s of onScreen) {
    const d = Math.min((s.x - e.clientX) ** 2 + (s.y - e.clientY) ** 2, (s.x - e.clientX) ** 2 + (s.y + 14 - e.clientY) ** 2, (s.x - e.clientX) ** 2 + (s.y - 14 - e.clientY) ** 2);
    if (d < bestD) { bestD = d; best = s.id; }
  }
  // Shift + klik na zaznaczonym: odznacza tylko jego
  if (best && e.shiftKey && chosen.has(best)) { unchoose(best); play('select'); renderer.markDragged(); return; }
  if (best) {
    // podwójne kliknięcie: wszyscy moi tego samego rodzaju widoczni na ekranie
    const now = performance.now();
    const kind = game.soldiers.find((x) => x.id === best)?.kind;
    if (lastPick.id === best && now - lastPick.at < 400) {
      const kinds = new Map(game.soldiers.map((x) => [x.id, x.kind]));
      chooseSoldiers(onScreen.filter((o) => kinds.get(o.id) === kind).map((o) => o.id), e.shiftKey);
      lastPick = { id: 0, at: 0 };
    } else {
      chooseSoldiers([best], e.shiftKey);
      lastPick = { id: best, at: now };
    }
    play('select');
    renderer.markDragged();
  }
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
  // zaznaczeni łucznicy nad własną wieżą z wolnym miejscem: kursor „wejdź”
  let enter = false;
  if (!hoverFoe && chosen.size && hoverTile) {
    const b = game.buildings.find((x) => x.id === game.occupancy[hoverTile!.y * game.map.width + hoverTile!.x]);
    if (b && b.owner === ME && !b.build && BUILDINGS[b.type]!.id === 'watchtower') {
      const room = 4 - game.soldiers.filter((s) => s.post === b.id).length;
      enter = room > 0 && game.soldiers.some((s) => chosen.has(s.id) && !!UNITS[s.kind]!.range && s.post !== b.id);
    }
  }
  canvas.classList.toggle('enter', enter);
  renderer.setAttackHighlight(game.buildings.some((b) => b.id === hoverFoe) ? hoverFoe : 0);
}

// ---- paski zdrowia nad żołnierzami: ranni, zaznaczeni i wróg pod kursorem ----
const barLayer = document.createElement('div');
barLayer.className = 'hpbars';
document.body.append(barLayer);
const bars: HTMLElement[] = [];
function updateBars(): void {
  renderer.barLift = 0.78;
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
/** Gra się skończyła: nie zapisujemy jej i nie da się do niej wrócić */
let gameOver = false;
function showEnd(win: boolean): void {
  endShown = true;
  speed = 0;
  // mecz przez sieć: wynik trafia do historii i rankingu gracza
  if (netGame) void saveResult(netGame.preset, win, Math.floor(game.tick / TICKS_PER_SECOND / 60));
  // mecz przez sieć się skończył: zamykamy kanał i pokój, żeby nie dało się do niego wrócić
  endOnline();
  // skończona gra (wygrana, porażka, poddanie) znika z zapisu: w menu nie ma już „Kontynuuj”
  gameOver = true;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* brak dostępu do pamięci */ }
  menu.setCanContinue(false);
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
let alarmComing = false;

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
  if (coming && !wasComing) { scribe.say('coming', t('alarm.coming'), true, 'herald'); warHorn(); }
  // nastroje ludzi wobec wojska
  const mine = game.soldiers.filter((x) => x.owner === ME).length;
  const theirs = game.soldiers.length - mine;
  if (mine >= 10 && mine >= theirs) scribe.say('proud', t('herald.proud'), false, 'herald');
  else if (mine === 0 && theirs >= 3) scribe.say('afraid', t('herald.afraid'), true, 'herald');
  else if (theirs > mine * 2 && theirs >= 6) scribe.say('weaker', t('herald.weaker'), false, 'herald');
  wasComing = coming;
  alarmComing = coming;
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
    soldiers: game.soldiers.filter((s) => s.owner === ME).length,
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
    else hud.showInfo(buildingInfo(b));
  }
}

let last = performance.now();
let acc = 0;
function loop(now: number): void {
  const elapsed = Math.min(250, now - last);
  if (gfx.auto && !document.hidden) {
    const tier = autoQ.frame(now - last);
    if (tier !== null) {
      gfx.autoTier = tier;
      if (!SANDBOX) saveSettings(gfx);
      applySettings(gfx);
    }
  }
  last = now;
  nature(renderer.weather.night, renderer.weather.rain, menu.isOpen(), renderer.wolvesNear);
  if (daySounds(clockAt(game.tick).hour, renderer.weather.rain, menu.isOpen())) renderer.lightning();
  music(renderer.weather.night, alerts.length > 0 || alarmComing, menu.isOpen());
  // otwarte menu wstrzymuje grę; na ekranie tytułowym kamera krąży nad osadą
  // w meczu przez sieć menu nie zatrzymuje czasu — inni gracze grają dalej
  if (menu.isOpen() && !net) {
    if (titleScreen || renderer.isPreviewing) renderer.orbit(elapsed / 1000);
    renderer.frame(elapsed / 1000, 1);
    requestAnimationFrame(loop);
    return;
  }
  renderer.endOrbit(); // po ujęciu z menu (tytuł albo podgląd mapy) wraca widok gracza; bez ujęcia nic nie robi
  titleScreen = false;
  acc += elapsed * speed;
  let steps = 0;
  while (acc >= TICK_MS && steps < 6) {
    let cmds: Command[] = [];
    if (net) {
      // tura zaczyna się co TURN ticków; bez poleceń przeciwnika na tę turę gra stoi
      if (game.tick % TURN === 0) {
        const turn = game.tick / TURN;
        if (!net.canRun(turn)) { waitFor(turn, now); acc = Math.min(acc, TICK_MS); break; }
        net.waitingSince = 0; netWait.hidden = true;
        cmds = net.beginTurn(turn, pending, stateHash(game));
        pending = [];
      }
    } else { cmds = pending; pending = []; }
    renderer.snapshot();
    const ts = performance.now();
    step(game, cmds);
    perf.sim += performance.now() - ts; perf.ticks++;
    acc -= TICK_MS;
    steps++;
    if (game.tick % 50 === 0) save();
  }
  if (steps === 6) acc = 0;
  if (net) {
    if (net.desync && !netNotes.desync) { netNotes.desync = true; hud.toast('Uwaga: gry u Was się rozjechały (różny stan). Wyniki mogą się nie zgadzać — zacznijcie nowy mecz.'); }
    if (net.left.length > netNotes.left) {
      const who = net.left.slice(netNotes.left).map((i) => { const x = netGame?.slots[i]; return x?.kind === 'human' ? x.nick : `gracz ${i + 1}`; });
      netNotes.left = net.left.length;
      hud.toast(`${who.join(', ')} ${who.length > 1 ? 'wyszli' : 'wyszedł'} z meczu — to oznacza poddanie się.`);
    }
  }
  const tu = performance.now();
  if (steps) { refresh(); updateGhost(); }
  perf.ui += performance.now() - tu;
  const tr = performance.now();
  renderer.frame(elapsed / 1000, speed ? acc / TICK_MS : 1, speed === 0);
  perf.render += performance.now() - tr;
  perf.frames++; perf.worst = Math.max(perf.worst, elapsed);
  if (now - perf.since > 1000) showPerf(now);
  updateHoverFoe();
  updateBars();
  if (steps) updateAlarm();
  requestAnimationFrame(loop);
}

// adres strony może nieść mapę: #tryb/ziarno
const [hashPreset, hashSeed] = decodeURIComponent(location.hash.slice(1)).split('/');
hud.setMuted(isMuted());
hud.setVolume(getVolume());
const saved = SANDBOX ? null : loadSave(); // test zawsze na świeżej mapie
const loadedGame = saved ? deserialize(saved.data) : null;
// zapis skończonej gry (porażka, poddanie, wygrana) to nie gra do kontynuowania — wyrzucamy go
const finished = (g: GameState | null): boolean => {
  const meP = g?.players[0];
  return !!meP && (meP.defeated || !g!.players.some((o) => o.team !== meP.team && !o.defeated));
};
const restored = finished(loadedGame) ? null : loadedGame;
if (loadedGame && !restored) { try { localStorage.removeItem(SAVE_KEY); } catch { /* nic */ } }
const T1 = performance.now();
if (saved && restored) { start(saved.seedText, saved.data.preset, restored); applyUi(saved.ui); }
else start(hashSeed || 'project-1', hashPreset && hashPreset in MAP_PRESETS ? (hashPreset as MapPresetId) : '1v1', undefined, 1, SANDBOX && new URLSearchParams(location.search).has('dev'));
mark.push(['start świata', Math.round(performance.now() - T1)]);
console.info('[main]', mark.map(([a, b]) => `${a} ${b} ms`).join(' | '));
menu.setVolume(getVolume());
menu.setMuted(isMuted());
menu.setCanContinue(!!(saved && restored));
if (!SANDBOX) menu.open(false); // w trybie testowym od razu gra
// link zaproszenia: ?pokoj=<id> — od razu do pokoju znajomego (parametr znika z adresu, żeby odświeżenie nie wracało)
const invite = new URLSearchParams(location.search).get('pokoj');
if (invite && !SANDBOX) {
  try { const u = new URL(location.href); u.searchParams.delete('pokoj'); history.replaceState(null, '', u.toString()); } catch { /* nic */ }
  menu.join(invite);
}
// Interfejs skaluje się do okna: na mniejszym ekranie wszystko jest proporcjonalnie mniejsze i nic nie ucieka za krawędź,
// na dużym monitorze trochę większe. Wzorzec: pełny pasek dolny mieści się w ok. 2000 × 1100 px.
function fitUi(): void {
  // Skala interfejsu: dolny pasek ma ok. 1450 px przy skali 1, więc szerokość ekranu wyznacza, ile się zmieści;
  // wysokość pilnuje, żeby pasek nie zjadał mapy na niskich ekranach. Laptop 1366×768 ≈ 0.92, 1920×1080 = 1.1.
  const k = Math.max(0.6, Math.min(1.1, innerWidth / 1480, innerHeight / 800));
  document.documentElement.style.setProperty('--ui', k.toFixed(3));
}
fitUi();
window.addEventListener('resize', fitUi);
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
  /** Kamera nad polem mapy (x, y w polach), z odległości `dist` */
  at(x: number, y: number, dist = 8): void { renderer.lookAt(x, y, dist); },
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
// piaskownica testowa: podgląd renderera z konsoli (szukanie błędów w wyglądzie)
if (SANDBOX) (window as unknown as { __renderer: unknown }).__renderer = renderer;

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
let lastAlarmBell = -1e9;
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
  // dzwon na chwilę na początku ataku, potem cisza przez minutę (dalsze ataki widać po znacznikach)
  if (performance.now() - lastAlarmBell > 60000) { alarmBell(); lastAlarmBell = performance.now(); }
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

// --- grupy oddziałów: Shift + cyfra zapisuje zaznaczonych, cyfra ich wybiera, podwójnie = kamera do grupy ---
/** Numer grupy, którą jest dokładnie obecne zaznaczenie (do nagłówka panelu) */
function groupOf(): number | undefined {
  for (const [n, ids] of groups) { const alive = ids.filter((id) => game.soldiers.some((x) => x.id === id)); if (alive.length === chosen.size && alive.every((id) => chosen.has(id))) return n; }
  return undefined;
}
/** Grupa: wybór (drugi raz szybko = kamera nad grupą), zapis zaznaczonych albo wyczyszczenie */
function groupAction(n: number, action: 'pick' | 'save' | 'clear'): void {
  if (action === 'clear') { if (groups.delete(n)) { play('rotate'); armyBarUpdate(); } return; }
  const ids = (groups.get(n) ?? []).filter((id) => game.soldiers.some((x) => x.id === id && x.owner === ME));
  // klik w puste miejsce działa jak zapis
  if (action === 'save' || !ids.length) {
    if (!chosen.size) return;
    groups.set(n, [...chosen]);
    save();
    hud.toast(`Grupa ${n}: ${chosen.size} ${chosen.size === 1 ? 'żołnierz' : 'żołnierzy'}. Wybierasz ją klawiszem ${n}.`);
    play('select');
    showArmy();
    armyBarUpdate();
    return;
  }
  const now = performance.now();
  if (lastGroup.n === n && now - lastGroup.at < 450) {
    const list = game.soldiers.filter((x) => ids.includes(x.id));
    renderer.lookAt(list.reduce((a, x) => a + x.px, 0) / list.length / 256, list.reduce((a, x) => a + x.py, 0) / list.length / 256, 26);
    lastGroup = { n: 0, at: 0 };
    return;
  }
  lastGroup = { n, at: now };
  chooseSoldiers(ids, false);
  play('select');
}

/** Odświeża pasek wojska (grupy i portrety zaznaczonych), tylko gdy coś się zmieniło */
function armyBarUpdate(): void {
  const mine = game.soldiers.filter((x) => x.owner === ME);
  const alive = new Set(mine.map((x) => x.id));
  const byId = new Map(mine.map((x) => [x.id, x]));
  const gl = [...groups].map(([n, ids]) => {
    const live = ids.filter((id) => alive.has(id));
    const kinds = new Map<string, number>();
    for (const id of live) { const k = UNITS[byId.get(id)!.kind]!.id; kinds.set(k, (kinds.get(k) ?? 0) + 1); }
    return { n, count: live.length, kind: [...kinds].sort((a, b) => b[1] - a[1])[0]?.[0] };
  });
  const sel = mine.filter((x) => chosen.has(x.id));
  const active = groupOf();
  const key = `${mine.length > 0}|${gl.map((g) => `${g.n}:${g.count}:${g.kind}`).join()}|${active}|${sel.map((x) => `${x.id}:${x.hp}`).join()}`;
  if (key === armyBarKey) return;
  armyBarKey = key;
  hud.setArmyBar({ show: mine.length > 0 || groups.size > 0, groups: gl, active, selected: sel.map((x) => ({ id: x.id, kind: UNITS[x.kind]!.id, hp: x.hp, max: UNITS[x.kind]!.hp, name: t(UNITS[x.kind]!.name) })) });
}
setInterval(() => { if (game) armyBarUpdate(); }, 250);

window.addEventListener('keydown', (e) => {
  if (!e.code.startsWith('Digit') || e.ctrlKey || e.metaKey || e.altKey || renderer.walking || menu.isOpen()) return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  const n = Number(e.code.slice(5));
  if (!(n >= 0 && n <= 9)) return;
  e.preventDefault();
  groupAction(n, e.shiftKey ? 'save' : 'pick');
});

// --- okrzyki wojska: potwierdzenie przy zaznaczeniu i rozkazie (dymek nad jednym żołnierzem i szorstki głos) ---
const SHOUT: Record<string, Record<'select' | 'move' | 'attack', string[]>> = {
  spearman: {
    select: ['Słucham, panie.', 'Rozkazuj.', 'Włócznie gotowe.', 'Czego trzeba?', 'Jesteśmy.'],
    move: ['Tak jest!', 'Idziemy.', 'Szykiem, marsz!', 'Ruszać się, chłopy!', 'Według rozkazu.'],
    attack: ['Na nich!', 'Bij!', 'Za pana!', 'Włócznie naprzód!', 'Nie dać im tchu!'],
  },
  archer: {
    select: ['Łuk napięty.', 'Słucham.', 'Strzały gotowe.', 'Cel, panie?', 'Patrzymy.'],
    move: ['Idziemy, panie.', 'Zmieniamy miejsce.', 'Tak jest.', 'Za mną, chłopy.'],
    attack: ['Napinaj!', 'Puszczaj!', 'Celuj w gardło!', 'Grad strzał!', 'Ognia, znaczy… strzelaj!'],
  },
};
let shoutAt = 0;
function shout(kind: 'select' | 'move' | 'attack'): void {
  const now = performance.now();
  if (now - shoutAt < 900 || !chosen.size) return;
  shoutAt = now;
  const list = game.soldiers.filter((x) => chosen.has(x.id));
  const s = list[Math.floor(Math.random() * list.length)];
  if (!s) return;
  const lines = (SHOUT[UNITS[s.kind]!.id] ?? SHOUT.spearman!)[kind];
  const text = lines[Math.floor(Math.random() * lines.length)]!;
  bubble.textContent = text;
  bubble.hidden = false;
  sayUnit = s.id;
  sayUntil = now + 1800;
  talk(text, s.id, true);
}

// --- odzywki ludzi: krótko, szorstko, zależnie od tego, co robią i jak im się żyje ---
const SAY: Record<string, string[]> = {
  idle: ['Czego?', 'Roboty by się znalazło jakiej…', 'Siedzę i czekam. Jak każdy.', 'Panie, daj jaką robotę.', 'Zimno przy tym ognisku.'],
  work: ['Robię, robię.', 'Nie przeszkadzaj, panie.', 'Robota sama się nie zrobi.', 'Ano, pracuje się.', 'Znowu ja?'],
  woodcutter: ['Drzewa nie zetną się same.', 'Siekiera tępa jak wójt.', 'Las daleko, nogi bolą.'],
  quarry: ['Kamień i kamień. Całe życie.', 'Plecy mi pękną od tego.', 'Kopacz ma tylko kilof i zmęczone ręce.', 'Jeszcze jeden blok i zapiję.'],
  mine: ['Ciemno tam jak w grobie.', 'Ruda sama nie wyjdzie.', 'Kopacz kopie, pan się bogaci.', 'Tylko żeby strop nie siadł.'],
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
  evening: ['Do karczmy, chłopy!', 'Fajrant. Nareszcie.', 'Posiedzimy przy ogniu.', 'Nogi mi odpadają od tej roboty.', 'Kto stawia piwo?'],
  sleep: ['Ziew… pora do wyra.', 'Starczy na dziś.', 'Idę spać, jutro znowu harówka.', 'Dobranoc, panie.'],
  sleeping: ['Chrrr…', 'Mmm… jeszcze chwilkę…', 'Chrrr… pchiii…'],
  outside: ['Ziemia twarda, a dachu ani śladu.', 'Na słomie pod gołym niebem, jak pies.', 'Postaw, panie, chatę, bo tu zimno.'],
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
  // rytm dnia: wieczór (19, 20), w drodze do łóżka (21), sen (22, pod dachem albo na słomie)
  if (u.phase === 22) return u.home ? pick('sleeping') : Math.random() < 0.5 ? pick('outside') : pick('sleeping');
  if (u.phase === 21) return pick('sleep');
  if (u.phase === 19 || u.phase === 20) return pick('evening');
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
    const u = game.units.find((x) => x.id === sayUnit) ?? game.soldiers.find((x) => x.id === sayUnit);
    if (!u || performance.now() > sayUntil || menu.isOpen()) bubble.hidden = true;
    else { const p = renderer.project(u.px / 256, u.py / 256); bubble.style.transform = `translate(${p.sx}px, ${p.sy - 40}px) translate(-50%, -100%)`; }
  }
  requestAnimationFrame(sayLoop);
}
requestAnimationFrame(sayLoop);

/** Rozpiska do panelu: składniki popularności i podział ludności */
function buildReport(f: ReturnType<typeof monthlyForecast>): HudView['report'] {
  const LBL: Record<string, string> = { food: 'Racje jedzenia', tax: 'Podatki', tavern: 'Karczma (piwo z pszenicy)', crowd: 'Ciasnota w chatach' };
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
  const coming = game.travelers.filter((x) => x.owner === ME && !x.leaving).length, going = game.travelers.filter((x) => x.owner === ME && x.leaving).length;
  if (coming) people.push({ label: 'W drodze do osady', value: coming });
  if (going) people.push({ label: 'Odchodzą', value: going });
  const mySoldiers = game.soldiers.filter((s) => s.owner === ME);
  const army: { label: string; value: number }[] = [{ label: 'Razem', value: mySoldiers.length }];
  for (const [k, def] of UNITS.entries()) { const n = mySoldiers.filter((s) => s.kind === k).length; if (n) army.push({ label: t(def.name), value: n }); }
  const hurt = mySoldiers.filter((s) => s.hp < UNITS[s.kind]!.hp).length;
  army.push({ label: 'Ranni', value: hurt });
  army.push({ label: 'W walce', value: mySoldiers.filter((s) => s.target || s.hunt).length });
  const p0 = game.players[ME]!;
  army.push({ label: 'Polegli od początku', value: p0.stats.lost }, { label: 'Zabici wrogowie', value: p0.stats.kills });
  return { popularity, people, army };
}

/** Okno na środku ekranu: czy na pewno rozebrać, co wróci do składu (połowa kosztu, wynoszona z gruzu) */
function confirmDemolish(id: number): void {
  const b = game.buildings.find((x) => x.id === id);
  if (!b) return;
  const def = BUILDINGS[b.type]!;
  const back = (Object.entries(def.cost) as [ResourceId, number][]).map(([r, n]) => `${Math.floor((n * RULES_REFUND) / 100)} × ${t(`res.${r}`).toLowerCase()}`);
  const box = document.createElement('div');
  box.className = 'confirm-wrap';
  box.innerHTML = `<div class="panel confirm" role="alertdialog" aria-modal="true" aria-labelledby="cf-t">
    <p class="confirm-title" id="cf-t">Rozebrać: ${t(def.name)}?</p>
    <p>${back.length ? `Odzyskasz <strong>${back.join(', ')}</strong> — ludzie wyniosą to z gruzu do składu.` : 'Nic nie odzyskasz.'}</p>
    ${b.worker ? '<p>Pracownik straci robotę i wróci do obozowiska.</p>' : ''}
    <div class="confirm-btns"><button type="button" class="menu-btn menu-back" data-no>Nie</button><button type="button" class="menu-btn" data-yes>Tak, rozbierz</button></div>
  </div>`;
  const close = (): void => { box.remove(); window.removeEventListener('keydown', key); };
  const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
  box.querySelector('[data-no]')!.addEventListener('click', close);
  box.querySelector('[data-yes]')!.addEventListener('click', () => { pending.push({ type: 'demolish', player: ME, id }); play('demolish'); select(0); close(); });
  box.addEventListener('pointerdown', (e) => { if (e.target === box) close(); });
  window.addEventListener('keydown', key);
  document.body.append(box);
  box.querySelector<HTMLButtonElement>('[data-no]')!.focus();
}
const RULES_REFUND = 50;

// --- wydajność: F3 pokazuje FPS, czasy symulacji i rysowania, liczniki sceny; window.__perf() zwraca to samo dla testów ---
const perf = { frames: 0, sim: 0, ticks: 0, render: 0, ui: 0, worst: 0, since: performance.now(), last: {} as Record<string, number | string> };
const perfBox = document.createElement('pre');
perfBox.className = 'perf';
perfBox.hidden = true;
document.body.append(perfBox);
// mały licznik FPS zawsze widoczny pod wersją; klik albo F3 rozwija pełne statystyki
const fpsTag = document.createElement('button');
fpsTag.type = 'button';
fpsTag.className = 'fps-tag';
fpsTag.title = 'Wydajność — kliknij albo F3';
fpsTag.textContent = 'FPS —';
document.body.append(fpsTag);
const togglePerf = (): void => { perfBox.hidden = !perfBox.hidden; fpsTag.setAttribute('aria-pressed', String(!perfBox.hidden)); };
fpsTag.addEventListener('click', togglePerf);
window.addEventListener('keydown', (e) => { if (e.key === 'F3') { e.preventDefault(); togglePerf(); } });
function showPerf(now: number): void {
  const secs = (now - perf.since) / 1000;
  const r = renderer.stats;
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  perf.last = {
    fps: Math.round(perf.frames / secs),
    'najgorsza klatka ms': Math.round(perf.worst),
    'rysowanie ms/klatkę': +(perf.render / Math.max(1, perf.frames)).toFixed(2),
    'symulacja ms/tick': +(perf.sim / Math.max(1, perf.ticks)).toFixed(2),
    'ticki/s': Math.round(perf.ticks / secs),
    'interfejs ms/klatkę': +(perf.ui / Math.max(1, perf.frames)).toFixed(2),
    'wywołania rysowania': r.calls, 'trójkąty': r.triangles, 'geometrie': r.geometries, 'tekstury': r.textures,
    mapa: `${game.map.width}×${game.map.height}`, budynki: game.buildings.length, chłopi: game.units.length, żołnierze: game.soldiers.length, wilki: game.wolves.length, ciała: game.corpses.length,
    'pamięć MB': mem ? Math.round(mem.usedJSHeapSize / 1048576) : '—',
  };
  for (const [k, v] of Object.entries(renderer.readTiming())) perf.last[`  ${k} ms`] = v;
  perf.last['jakość'] = renderer.quality;
  fpsTag.textContent = `FPS ${perf.last.fps}`;
  fpsTag.dataset.low = String(Number(perf.last.fps) < 40);
  if (!perfBox.hidden) perfBox.textContent = Object.entries(perf.last).map(([k, v]) => `${k.padEnd(22)} ${v}`).join('\n');
  perf.frames = 0; perf.sim = 0; perf.ticks = 0; perf.render = 0; perf.ui = 0; perf.worst = 0; perf.since = now;
}
(window as unknown as { __perf: () => Record<string, number | string> }).__perf = () => perf.last;
(window as unknown as { __heavy: (n?: number) => unknown }).__heavy = (n) => renderer.heavy(n);
// do testów wyglądu: spacer bez blokady kursora (kamera z oczu chłopa)
(window as unknown as { __walk: (x: number, y: number, yaw?: number, pitch?: number) => void }).__walk = (x, y, yaw = 0, pitch = 0.2) => { renderer.startWalk(x, y, yaw); renderer.setWalkPitch(pitch); };

// podpowiedź podczas spaceru oczami chłopa
const walkHint = document.createElement('p');
walkHint.className = 'walk-hint';
walkHint.hidden = true;
walkHint.textContent = 'W A S D — idź · mysz — rozglądaj się · Shift — biegnij · F — pochodnia · Esc — wróć do widoku z góry (kliknij, jeśli kursor się zwolnił)';
document.body.append(walkHint);
renderer.onWalkEnd = () => { document.body.classList.remove('walking'); walkHint.hidden = true; };
