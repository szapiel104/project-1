import { GUARD_SAY, SAY } from './data/barks';
import { COLD, SEASON_NAME, shiftToSeason, weatherOf, type Season } from './sim/weather';
import { BUILDINGS, buildingIndex, footprint, isTower } from './data/buildings';
import { RULES } from './data/rules';
import { Terrain } from './data/terrain';
import { RESOURCE_DEFS, RESOURCES, resIndex, type ResourceId, type StoreKind } from './data/resources';
import { UNITS } from './data/units';
import { MAP_PRESETS, type MapPresetId } from './data/maps';
import { BYNAMES, FIRST_NAMES } from './data/names';
import { t } from './i18n';
import { GameRenderer, type TileRef } from './render/scene';
import { clockAt, rainAt } from './sim/clock';
import { seedFromText } from './sim/rng';
import { deserialize, serialize, type SaveData } from './sim/save';
import { Phase, TICKS_PER_SECOND, createGame, housing, idleCount, idleSlots, population, stateHash, storeCapacity, storeUsed, type DevWalls, type GameState } from './sim/state';
import { applyCommands, step, type Command } from './sim/step';
import { FOOD_PER_DAY, FOOD_VALUE, MEALS_PER_DAY, foodTotal, monthlyForecast } from './sim/systems/economy';
/** Indeksy surowców, które są jedzeniem (jabłka, chleb, ryby) */
const FOOD_RES_ALL = RESOURCES.map((r, i) => (RESOURCE_DEFS[r].food ? i : -1)).filter((i) => i >= 0);
import { buildWork, canAfford, canPlace, maxHp, tileBuildable } from './sim/systems/placement';
import { createHud, type BuildingInfo, type HudView, type RecruitUnit } from './ui/hud';
import { createScribe } from './ui/scribe';
import { nextWave } from './sim/systems/bot';
import { garrisonRoom, octant, planFormation } from './sim/systems/army';
import { EMPTY, SANDBOX, TEST } from './testmode';
import { createSimThread, type SimResult } from './sim/simthread';
import { addPeasants, addWolf, emptyScene, placeReady, removeReady, setHour } from './sim/emptyscene';
import { Lockstep, TURN } from './net/lockstep';
import { deleteRoom, me as netMe, saveResult, setStatus } from './net/supa';
import type { OnlineStart } from './ui/online';
import { createGameChat } from './ui/chat';
import { createPings, PINGS } from './ui/pings';
import { createAllies } from './ui/allies';
import { createMinimap } from './ui/minimap';
import { createMenu, loadSettings, saveSettings, type Settings } from './ui/menu';
import { AutoQuality, TIERS, TOP_TIER } from './render/autoquality';
import { alarmBell, daySounds, music, getVolume, isMuted, nature, play, pluck, talk, warHorn, setBusVolume, setVolume, toggleMute, unlockAudio } from './audio/sfx';
import { proceduralModels } from './render/models';
import { renderThumbnails, renderUnitPortraits } from './render/thumbnails';
import { GUARDS, GUARD_COST } from './sim/systems/guards';
import { WOLF_HP } from './sim/systems/wolves';
import { cachedThumbs, saveThumbs } from './render/thumbcache';
import { texturesReady } from './render/textures';
import { TEAM_COLORS } from './data/teams';
import { createDevPanel, type DevSpawn } from './ui/devpanel';
import { walkable } from './sim/path';
import { FP } from './sim/state';
import { unitIndex } from './data/units';

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
/** ?dev&mury=kamien|drewno — mury miasta w trybie deweloperskim z adresu (domyślnie mieszane) */
const URL_WALLS: DevWalls = ((m) => (m === 'kamien' || m === 'kamień' ? 'stone' : m === 'drewno' ? 'wood' : 'mix'))(new URLSearchParams(location.search).get('mury'));
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
  if (Number.isInteger(ui.form) && ui.form! >= 0 && ui.form! <= 3) armyForm = ui.form!;
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
// portrety żołnierzy do koszar (rysowane zawsze: dwa szybkie ujęcia, niezależne od zapisanych miniatur budynków)
if (!TEST) for (const [k, v] of renderUnitPortraits(TEAM_COLORS[0]!)) thumbs.set(k, v);
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
  onPower: (id, on) => { pending.push({ type: 'power', player: ME, id, on }); play('click'); },
  onRally: (id, unit, clear) => {
    const kind = unit ? unitIndex(unit) : -1;
    if (clear) { pending.push({ type: 'rally', player: ME, building: id, kind, tile: -1 }); hud.toast('Flaga zdjęta: nowi staną przed koszarami.'); return; }
    rallyPick = { building: id, kind };
    canvas.classList.add('placing');
    hud.toast(unit ? 'Wskaż na mapie, gdzie mają iść nowi tego rodzaju (Esc anuluje).' : 'Wskaż na mapie punkt zbiórki dla wszystkich nowych (Esc anuluje).');
  },
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
/** Zasłona na czas generowania mapy w podglądzie nowej gry (za panelem menu) */
let previewJob = 0;
const previewCover = document.createElement('div');
previewCover.className = 'preview-cover';
previewCover.hidden = true;
previewCover.setAttribute('role', 'status');
previewCover.innerHTML = '<div class="preview-cover-box"><span class="preview-spin" aria-hidden="true"></span><p>Generuję mapę…</p></div>';
document.body.append(previewCover);
const menu = createMenu(document.body, {
  onContinue: () => { menu.close(); if (!net) setStatus({ where: 'solo' }); },
  // podgląd nowej mapy: generujemy ją obok bieżącej gry i pokazujemy z lotu ptaka; bieżąca gra czeka nietknięta
  onPreviewMap: (seedText, preset, level, dev) => {
    // generowanie mapy zatrzymuje stronę na chwilę: najpierw ciemna zasłona z kręciołkiem za menu (lewy panel zostaje),
    // potem mapa, a zasłona schodzi dopiero, gdy pierwsze klatki nowej mapy są narysowane i kamera rusza
    const job = ++previewJob;
    previewCover.hidden = false;
    previewCover.classList.remove('gone');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (job !== previewJob) return; // w międzyczasie wylosowano kolejną mapę
      preview = createGame(seedFromText(seedText), preset, level, dev);
      renderer.setState(preview, MAP_PRESETS[preset].waterLevel, MAP_PRESETS[preset].rim, 0);
      renderer.startPreview();
      renderer.warmup();
      let frames = 0, done = false;
      const reveal = (): void => {
        if (done || job !== previewJob) return;
        done = true;
        previewCover.classList.add('gone');
        setTimeout(() => { if (job === previewJob) previewCover.hidden = true; }, 450);
      };
      const wait = (): void => { if (++frames < 4) requestAnimationFrame(wait); else reveal(); };
      requestAnimationFrame(wait);
      setTimeout(reveal, 2500); // bardzo wolna karta: zasłona i tak schodzi po chwili
    }));
  },
  onPreviewEnd: () => {
    previewJob++; previewCover.hidden = true;
    if (!preview) return;
    preview = null;
    renderer.endPreview();
    renderer.setState(game, MAP_PRESETS[currentPreset].waterLevel, MAP_PRESETS[currentPreset].rim, ME);
  },
  onNewGame: (seedText, preset, level, dev, instant, walls) => {
    previewJob++; previewCover.hidden = true;
    preview = null;
    renderer.endPreview();
    // nowa mapa buduje się za ekranem wczytywania, a nie w zawieszonym menu
    const cover = document.createElement('div');
    cover.id = 'loading';
    cover.innerHTML = loadingMarkup(t('load.map'));
    document.body.append(cover);
    requestAnimationFrame(() => setTimeout(() => {
      start(seedText, preset, undefined, level, dev, undefined, instant, walls);
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
    simMode = false; // dalej liczy wątek główny: zmiana stanu poza symulacją nie może zginąć pod wynikiem z wątku
    game.players[ME]!.defeated = true;
    menu.close();
    showEnd(false);
  },
  onOnlineStart: (st) => {
    // podgląd mapy z pokoju znika bez wracania do poprzedniej gry: od razu startuje mecz
    previewJob++; previewCover.hidden = true; preview = null; renderer.endPreview();
    const cover = document.createElement('div');
    cover.id = 'loading';
    cover.innerHTML = loadingMarkup(t('load.map'));
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

// ---- znaczniki dla sojuszników: Alt + klik w mapę (ui/pings.ts); w meczu przez sieć idą kanałem pokoju ----
const pings = createPings({
  tileAt: () => hoverTile,
  pick: (kind, x, y) => {
    showPing(ME, kind, x, y);
    net?.send({ k: 'ping', from: ME, kind, x, y });
    // boty w mojej drużynie też słuchają znaczników (przez symulację, żeby u wszystkich wyszło tak samo)
    const mine = game.players[ME];
    if (mine && game.players.some((p) => p.bot && p.team === mine.team && p.id !== ME && !p.defeated)) pending.push({ type: 'signal', player: ME, kind, x: Math.floor(x), y: Math.floor(y) });
  },
  screenOf: (x, y) => renderer.screenOf(x, y),
  lookAt: (x, y) => renderer.lookAt(x, y, 30),
});
function showPing(from: number, kind: number, x: number, y: number): void {
  const p = PINGS[kind];
  if (!p || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const slot = netGame?.slots[from];
  const who = slot?.kind === 'human' ? { id: slot.id, nick: slot.nick, avatar: slot.avatar } : { id: `p${from}`, nick: from === ME ? 'Ty' : `Gracz ${from + 1}`, avatar: 0 };
  renderer.ping(x, y, p.color);
  pings.show(kind, x, y, who.nick);
  if (chat.active) chat.note(who, `${p.icon} ${p.label}`, from === ME);
  // krótki sygnał: atak niżej, pomoc wysoko i dwa razy, zbiórka w środku
  if (kind === 0) { pluck(-5, 1); setTimeout(() => pluck(-12, 1), 120); }
  else if (kind === 1) { pluck(12, 1); setTimeout(() => pluck(12, 1), 160); }
  else { pluck(5, 1); setTimeout(() => pluck(7, 1), 140); }
}
// ---- minimapa (ui/minimap.ts): klik przenosi kamerę, prawy = marsz zaznaczonego wojska, Alt + klik = znacznik ----
const minimap = createMinimap({
  centerOn: (x, y) => renderer.centerOn(x, y),
  order: (x, y) => {
    if (!chosen.size) return false;
    pending.push({ type: 'move', player: ME, ids: [...chosen], x, y, form: armyForm, amove: armyMarch === 1 });
    renderer.orderMarker({ x, y });
    play('rotate');
    shout(armyMarch === 1 ? 'attack' : 'move');
    return true;
  },
  ping: (cx, cy, x, y) => { pings.openMenu(cx, cy, { x, y }); },
  viewQuad: () => renderer.viewQuad(),
  pings: () => pings.active(),
});
window.addEventListener('pointerdown', (e) => {
  if (!e.altKey || e.button !== 0 || e.target !== canvas || menu.isOpen() || renderer.walking) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  pings.openMenu(e.clientX, e.clientY);
}, { capture: true });

// ---- sojusznicy: wysyłanie surowców wozem (polecenie 'send' w symulacji) i powiadomienia o wozach ----
const playerName = (p: number): string => {
  if (p === ME) return 'Ty';
  const slot = netGame?.slots[p];
  if (slot?.kind === 'human') return slot.nick;
  return game.players[p]?.bot ? `Bot ${p + 1}` : `Gracz ${p + 1}`;
};
const allies = createAllies({
  name: playerName,
  send: (to, res, amount) => { pending.push({ type: 'send', player: ME, to, res, amount }); play('click'); },
});
minimap.mount(allies.button);
let caravanSeen = -1;
let alliesTick = 0;
function caravanNews(now: number): void {
  if (now - alliesTick < 400 || !game) return;
  alliesTick = now;
  allies.update(game, ME);
  const log = game.caravanLog ?? [];
  if (caravanSeen < 0) { caravanSeen = log.at(-1)?.id ?? 0; return; }
  for (const n of log) {
    if (n.id <= caravanSeen) continue;
    caravanSeen = n.id;
    const what = `${n.amount} × ${t(RESOURCE_DEFS[RESOURCES[n.res]!].name).toLowerCase()}`;
    if (n.captured) {
      if (n.owner === ME) hud.toast(`Wróg przechwycił Twój wóz dla: ${playerName(n.to)} (${what}).`);
      else if (n.by === ME) hud.toast(`Twoi żołnierze przechwycili wóz wroga: +${what}.`);
      else if (n.to === ME) hud.toast(`Wróg przechwycił wóz, który jechał do Ciebie od: ${playerName(n.owner)}.`);
    } else if (n.by === ME && n.owner !== ME) { hud.toast(`${playerName(n.owner)} przysłał Ci wóz: +${what}.`); play('select'); }
    else if (n.owner === ME && n.by !== ME) hud.toast(`Wóz dotarł do: ${playerName(n.to)} (${what}).`);
    else if (n.owner === ME) hud.toast(`Sojusznik odpadł — wóz wrócił do zamku (${what}).`);
  }
}

/** Mecz 1 na 1 przez sieć: obie przeglądarki stawiają tę samą mapę z tego samego ziarna, bez botów na miejscach graczy. */
function startOnline(st: OnlineStart): void {
  start(st.seed, st.preset, undefined, st.level, false, st);
  const mine = st.slots[st.me];
  if (mine?.kind === 'human') chat.attach(st.link, { id: mine.id, nick: mine.nick, avatar: mine.avatar });
  // znaczniki sojuszników (tylko z mojej drużyny; obcy ich nie widzą — ale też nie powinni ich wysyłać)
  const offPing = st.link.on((m) => {
    if (m.k !== 'ping' || !netGame || m.from === ME || !Number.isInteger(m.from) || !Number.isInteger(m.kind)) return;
    const a = game.players[m.from], b = game.players[ME];
    if (a && b && a.team === b.team) showPing(m.from, m.kind, m.x, m.y);
  });
  pingOff = offPing;
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
let pingOff: (() => void) | null = null;
function endOnline(): void {
  if (!net || !netGame) return;
  net.close();
  chat.detach();
  pingOff?.(); pingOff = null;
  pings.clear();
  netGame.link.close();
  // koniec meczu: gospodarz usuwa pokój z bazy (nic po meczu nie zostaje)
  if (netMe()?.id === netGame.room.host) void deleteRoom(netGame.room.id);
  net = null; netGame = null; netWait.hidden = true;
  setStatus({ where: 'menu' });
}
window.addEventListener('beforeunload', () => endOnline());
/** Ekran wczytywania nowej mapy: ten sam układ co przy starcie gry (herb, złoty tytuł, rada, żarzący się pasek) */
const LOAD_CREST = '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M18 34 L102 86 M102 34 L18 86" stroke="#5a3a1c" stroke-width="5" stroke-linecap="round"/><path d="M60 12 L96 22 V56 C96 82 78 98 60 108 C42 98 24 82 24 56 V22 Z" fill="#8c1f18" stroke="#e9c145" stroke-width="4"/><path d="M60 18 L90 26 V56 C90 78 75 92 60 101 Z" fill="#6e1711"/><path d="M46 84 V52 h4 v-6 h5 v6 h10 v-6 h5 v6 h4 V84 Z" fill="#e9c145"/></svg>';
function loadingMarkup(label: string): string {
  return `<div class="loading-embers" aria-hidden="true">${'<i></i>'.repeat(12)}</div>
  <div class="loading-head"><div class="loading-crest">${LOAD_CREST}</div><p class="loading-title">Project‑1</p><p class="loading-sub">Zbuduj osadę, wykarm ludzi, obroń zamek</p></div>
  <div class="loading-card"><p class="loading-tip">Wilki wychodzą z lasu o zmierzchu. Palisada wokół osady daje ludziom spokojniejszą noc.</p><div class="loading-bar"><span style="width:60%"></span></div><p class="loading-line"><span>${label}</span><strong></strong></p></div>`;
}
let titleScreen = true;
/** Bieżące ustawienia (te same, które zmienia menu) i automat jakości grafiki */
let gfx: Settings = loadSettings();
const autoQ = new AutoQuality(gfx.autoTier ?? TOP_TIER - 1);
function applySettings(st: Settings): void {
  gfx = st;
  fitUi();
  // interfejs z ustawień: licznik FPS (w trybie testowym zawsze), dymki, podpowiedzi
  const bc = document.body.classList;
  bc.toggle('hide-fps', !(st.showFps ?? false) && !SANDBOX);
  bc.toggle('no-bubbles', st.bubbles === false);
  bc.toggle('tips-delay', st.tips === 'delay');
  bc.toggle('tips-off', st.tips === 'off');
  // obraz: jasność, deszcz, mgła
  renderer.brightness = st.brightness ?? 1;
  renderer.rainOn = st.rain ?? true;
  renderer.fogOn = st.fog ?? true;
  // automat: cienie, cieniowanie zagłębień, rozdzielczość i zasięg trawy z poziomu dobranego do komputera
  if (st.auto) { const q = TIERS[autoQ.tier]!; renderer.setGraphics({ ...st, ...q, label: `automat ${autoQ.tier + 1}/${TIERS.length}` }); }
  else renderer.setGraphics({ ...st, grass: st.grass ?? 1 });
  setBusVolume('sfx', st.sfx);
  setBusVolume('ui', st.ui);
  setBusVolume('amb', st.amb);
  setBusVolume('music', st.music ?? 0.45);
}
applySettings(gfx);

function start(seedText: string, preset: MapPresetId, loaded?: GameState, level = 2, dev = false, online?: OnlineStart, instant = true, walls: DevWalls = URL_WALLS): void {
  endShown = false;
  gameOver = false;
  endOnline();
  ME = online ? online.me : 0;
  caravanSeen = -1; allies.close(); pings.clear();
  game = loaded ?? createGame(seedFromText(seedText), preset, level, dev, online?.humans, instant, walls, online?.coop === true);
  if (EMPTY && !loaded && !online) emptyScene(game);
  // wątek symulacji: tylko gra z botami bez trybu dewelopera i testów (tam wątek główny też zmienia stan gry)
  simGen++; simBusy = false;
  // w testach można wymusić wątek: ?test=1&watek=1 (bez pomocników __test, które zmieniają stan)
  const forceThread = SANDBOX && new URLSearchParams(location.search).has('watek');
  simMode = !!simThread && !simBroken && !online && (!SANDBOX || forceThread) && (!game.players[ME]?.dev || forceThread);
  if (simMode) simThread!.set(game, simGen);
  // nowa mapa: grupy i zaznaczenie z poprzedniej gry nie mają sensu (przy wczytaniu wracają z zapisu)
  if (!loaded) groups.clear();
  chosen.clear(); renderer.setSoldierSelection(chosen);
  shownAreas.clear(); renderer.setAreas(shownAreas);
  setStatus({ where: online ? 'game' : 'menu' });
  if (online) {
    net = online.net; netGame = online; netNotes = { desync: false, left: 0 };
    speed = 1; acc = 0;
  } else if (!loaded) {
    // nowa gra: tempo na starcie z ustawień (Rozgrywka)
    speed = gfx.startSpeed ?? 1;
    hud.setSpeed(speed);
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

/** Imię, przydomek i wiek wynikają na stałe z numeru chłopa (albo strażnika) i ziarna mapy. */
function personCard(id: number): { name: string; lines: string[]; walk?: boolean } | null {
  const h = (salt: number): number => { let v = (id * 2654435761 + game.map.seed + salt * 40503) >>> 0; v ^= v >>> 15; v = Math.imul(v, 0x2c1b3c6d); return (v ^ (v >>> 12)) >>> 0; };
  const name = `${FIRST_NAMES[h(1) % FIRST_NAMES.length]} ${BYNAMES[h(2) % BYNAMES.length]}`;
  const age = `${16 + (h(3) % 45)} ${t('person.age')}`;
  const u = game.units.find((x) => x.id === id);
  if (!u) {
    // strażnik miejski: stopień (co trzeci ciężki, w mocniejszym rynsztunku), co teraz robi i zdrowie
    const s = game.soldiers.find((x) => x.id === id);
    const def = s ? UNITS[s.kind]! : undefined;
    if (!s || !def?.guard) return null;
    const rank = h(4) % 3 === 0 ? t('guard.heavy') : t('guard.light');
    const here = (s.py >> 8) * game.map.width + (s.px >> 8);
    const doing = s.target ? t('guard.fight') : s.hunt ? t('guard.wolf')
      : s.stance === 1 && (s.hold ?? -1) >= 0 ? t(here === s.hold ? 'guard.post' : 'guard.toPost')
      : s.goal >= 0 ? t(s.amove ? 'guard.beat' : 'guard.back') : t('guard.watch');
    return { name, walk: false, lines: [`${age} · ${t('person.service')}: ${rank}`, `${t('person.doing')}: ${doing}`, `${t('person.hp')}: ${Math.max(0, s.hp)} / ${def.hp}`] };
  }
  const job = game.buildings.find((b) => b.id === u.job);
  const jobDef = job ? BUILDINGS[job.type]! : undefined;
  // cech z nazwą w dopełniaczu, a gdy budynek takiej nie ma (np. skład), po prostu gdzie pracuje
  const guildKey = jobDef ? `guild.${jobDef.id}` : '';
  const work = !jobDef ? t('person.none') : t(guildKey) !== guildKey ? `${t('person.guild')} ${t(guildKey)}` : `${t('person.works')}: ${t(jobDef.name)}`;
  return {
    name,
    lines: [
      age,
      work,
      `${t('person.doing')}: ${t(`phase.${u.phase}`)}`,
    ],
  };
}

function selectUnit(id: number): void {
  if (id && id !== selectedUnit) play('select');
  selectedUnit = id;
  if (id) { selected = 0; renderer.setSelection(0); renderer.setWorkerMark(0); }
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
    recruit: def.id === 'barracks' ? recruitInfo().map((r) => ({ ...r, rally: (b.rally?.[unitIndex(r.id)] ?? -1) >= 0 })) : undefined, gate: def.gate ? { open: b.gateOpen ?? true, shut: !!b.shut } : undefined,
    power: !b.build && (def.production || def.staff) && def.id !== 'keep' ? { on: !b.off, worker: b.worker !== 0 } : undefined,
    garrison: garrisonRoom(def.id) ? game.soldiers.filter((s) => s.post === b.id && s.up).length : undefined,
    garrisonMax: garrisonRoom(def.id) || undefined,
    prod: b.owner === ME && !b.build && (def.production || def.staff) ? prodInfo(b) : undefined,
    watch: def.id === 'keep' ? watchInfo(b.owner) : undefined,
    area: def.area || isTower(def.id) ? shownAreas.has(b.id) : undefined,
    site: b.build ? siteInfo(b) : undefined };
}

/**
 * Warsztat w oknie budynku: z czego i co robi, kto pracuje i co teraz robi (z postępem), czy coś go blokuje,
 * ile zrobił (od postawienia i w ostatniej dobie), ile przepadło przez pełny skład i ile surowca leży na stanie.
 */
const madeLog = new Map<number, [number, number][]>();
let madeAt = -1;
/** Co 1/24 doby zapisujemy liczniki warsztatów gracza: z nich liczy się tempo z ostatniej doby */
function sampleMade(): void {
  if (madeAt >= 0 && game.tick - madeAt < RULES.dayTicks / 24 && game.tick >= madeAt) return;
  madeAt = game.tick;
  const alive = new Set<number>();
  for (const b of game.buildings) {
    if (b.owner !== ME || !BUILDINGS[b.type]!.production || b.build) continue;
    alive.add(b.id);
    let log = madeLog.get(b.id);
    if (!log) { log = []; madeLog.set(b.id, log); }
    log.push([game.tick, b.made ?? 0]);
    while (log.length > 1 && log[1]![0] <= game.tick - RULES.dayTicks) log.shift();
  }
  for (const id of madeLog.keys()) if (!alive.has(id)) madeLog.delete(id);
}
const SITE_NAME: Record<string, string> = { home: 'w warsztacie', shore: 'na brzegu wody' };
function prodInfo(b: GameState['buildings'][number]): BuildingInfo['prod'] {
  const def = BUILDINGS[b.type]!, pr = def.production, p = game.players[b.owner]!;
  const u = b.worker ? game.units.find((x) => x.id === b.worker) : undefined;
  const resName = (r: string): string => t(RESOURCE_DEFS[r as ResourceId].name).toLowerCase();
  // przepis
  const place = !pr ? '' : typeof pr.site === 'string' ? SITE_NAME[pr.site] ?? '' : pr.site === Terrain.Forest ? 'w lesie' : pr.site === Terrain.Stone ? 'w skałach' : pr.site === Terrain.Iron ? 'przy złożu rudy' : '';
  const recipe = pr ? {
    input: pr.input ? { id: pr.input.res, n: pr.input.amount, name: resName(pr.input.res) } : undefined,
    output: { id: pr.output.res, n: pr.output.amount, name: resName(pr.output.res) },
    secs: Math.round((pr.workTicks + (pr.processTicks ?? 0)) / TICKS_PER_SECOND),
    place,
  } : undefined;
  // pracownik: kto i co robi teraz; postęp roboty w warsztacie albo w terenie
  let worker: { name: string; doing: string; pct?: number } | undefined;
  if (u) {
    let pct: number | undefined;
    if (pr && u.phase === Phase.Working) { const total = (pr.input ? pr.workTicks : pr.processTicks) ?? pr.workTicks; pct = Math.round(100 * (1 - u.timer / Math.max(1, total))); }
    else if (pr && u.phase === Phase.WorkingSite) pct = Math.round(100 * (1 - u.timer / Math.max(1, pr.workTicks)));
    worker = { name: personCard(u.id)?.name ?? '', doing: t(`phase.${u.phase}`), pct: pct === undefined ? undefined : Math.max(0, Math.min(100, pct)) };
  }
  // stan: co blokuje robotę (najważniejsze pierwsze)
  const outKind = pr ? RESOURCE_DEFS[pr.output.res].store : undefined;
  const outFull = !!outKind && storeUsed(p, outKind) >= storeCapacity(game, b.owner, outKind);
  const inHave = pr?.input ? p.res[resIndex(pr.input.res)]! : 0;
  const storeLabel = (k: string): string => (k === 'granary' ? 'spichlerz' : k === 'armory' ? 'zbrojownia' : 'skład');
  let status: { text: string; level: 'ok' | 'warn' | 'bad' };
  if (!u) {
    const free = game.units.some((x) => x.owner === b.owner && x.job === 0 && !x.enlist);
    status = free ? { text: 'Brak pracownika — wolny chłop zaraz przyjdzie.', level: 'warn' }
      : { text: 'Brak pracownika: nie ma wolnych chłopów. Postaw chaty, obniż podatki albo podnieś racje, żeby przyszli nowi.', level: 'bad' };
  } else if (u.phase === Phase.Sleeping || u.phase === Phase.ToSleep) status = { text: 'Noc — pracownik śpi, rano wraca do roboty.', level: 'ok' };
  else if (u.phase === Phase.Evening || u.phase === Phase.ToEvening) status = { text: 'Wieczór — fajrant, rano wraca do roboty.', level: 'ok' };
  else if (pr?.input && RESOURCE_DEFS[pr.input.res].store && !storeCapacity(game, b.owner, RESOURCE_DEFS[pr.input.res].store!)) status = { text: `Nie ma skąd wziąć surowca (${resName(pr.input.res)}): postaw ${storeLabel(RESOURCE_DEFS[pr.input.res].store!).replace(/a$/, 'ę')}.`, level: 'bad' };
  else if (outKind && !storeCapacity(game, b.owner, outKind)) status = { text: `Nie ma gdzie odnieść towaru (${resName(pr!.output.res)}): postaw ${storeLabel(outKind).replace(/a$/, 'ę')}.`, level: 'bad' };
  else if (pr?.input && u.phase === Phase.ToInputStore && inHave < pr.input.amount) status = { text: `Czeka na surowiec: ${resName(pr.input.res)} — na stanie ${inHave}, potrzeba ${pr.input.amount}.`, level: 'bad' };
  else if (u.phase === Phase.ToStore && u.carryAmt > 0 && u.timer > 0) status = { text: `${outKind === 'armory' ? 'Pełna' : 'Pełny'} ${storeLabel(outKind ?? '')} — pracownik czeka z towarem, a nadmiar przepadnie. Postaw kolejny.`, level: 'bad' };
  else if (outFull) status = { text: `${outKind === 'armory' ? 'Pełna' : 'Pełny'} ${storeLabel(outKind ?? '')} — nowy towar nie będzie miał gdzie leżeć.`, level: 'warn' };
  else if (pr?.input && inHave < pr.input.amount) status = { text: `Kończy się surowiec: ${resName(pr.input.res)} — na stanie ${inHave}, na jeden cykl trzeba ${pr.input.amount}.`, level: 'warn' };
  else if (u.phase === Phase.Resting || u.phase === Phase.ToRest) status = { text: 'Krótki odpoczynek w chacie, zaraz wraca.', level: 'ok' };
  else status = { text: 'Pracuje bez przeszkód.', level: 'ok' };
  // liczby
  let day: number | undefined;
  const log = madeLog.get(b.id);
  if (log && log.length > 1) {
    const span = game.tick - log[0]![0];
    if (span >= RULES.dayTicks / 4) day = Math.round((((b.made ?? 0) - log[0]![1]) * RULES.dayTicks) / span);
  }
  return {
    recipe, worker, status, made: b.made ?? 0, lost: b.lost ?? 0, day,
    stockOut: pr ? p.res[resIndex(pr.output.res)]! : undefined,
    stockIn: pr?.input ? inHave : undefined,
    cycles: pr?.input ? Math.floor(inHave / pr.input.amount) : undefined,
  };
}

/** Straż miejska do panelu twierdzy: ilu jest, szkolenie rekruta i co blokuje werbunek */
function watchInfo(owner: number): BuildingInfo['watch'] {
  const p = game.players[owner]!;
  const have = game.soldiers.filter((s) => s.owner === owner && UNITS[s.kind]!.guard).length;
  const want = p.guards ?? GUARDS;
  const training = p.guardReady ? Math.max(0, Math.ceil((p.guardReady - game.tick) / TICKS_PER_SECOND)) : 0;
  let note: string | undefined;
  if (!training && have < want) {
    const lack = Object.entries(GUARD_COST).filter(([r, n]) => p.res[resIndex(r as ResourceId)]! < n!).map(([r]) => t(`res.${r}`).toLowerCase());
    note = lack.length ? `na rekruta brakuje: ${lack.join(', ')}` : !game.units.some((u) => u.owner === owner && u.job === 0) ? 'brak wolnego chłopa na rekruta' : 'werbunek ruszy za dnia, gdy pod zamkiem nie ma wroga';
  }
  return { have, want, training, note };
}

function select(id: number): void {
  if (id && selectedUnit) { selectedUnit = 0; renderer.setUnitSelection(0); }
  selected = id;
  const b = game.buildings.find((x) => x.id === id);
  renderer.setSelection(b ? id : 0);
  // pracownik zaznaczonego budynku dostaje nad głową szpilkę (jak strażnicy po kliknięciu twierdzy)
  renderer.setWorkerMark(b && b.owner === ME ? b.worker : 0);
  hud.showInfo(b ? buildingInfo(b) : null);
}

/** Lewy górny róg działki tak, żeby budynek był wyśrodkowany na wskazanym polu. */
function origin(tile: TileRef, type: number): TileRef {
  const fp = footprint(BUILDINGS[type]!, placeRot);
  return { x: tile.x - ((fp.w - 1) >> 1), y: tile.y - ((fp.h - 1) >> 1) };
}

function updateGhost(): void {
  const tile = touchTile ?? hoverTile;
  if (!picked || !tile) { renderer.setGhost(null); renderer.setBuildGrid(null); return; }
  const type = buildingIndex(picked);
  // siatka budowy wokół kursora: zielone pola wolne, czerwone zajęte (także place budowy postawione przed chwilą)
  const road = !!BUILDINGS[type]!.road;
  renderer.setBuildGrid(tile, road ? (x, y) => canPlace(game, ME, type, x, y, false) === null : (x, y) => tileBuildable(game, ME, x, y));
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

/**
 * Pola muru: jak droga (prosto, potem zakręt), ale gdy po drodze jest woda albo góra, mur je obchodzi —
 * najkrótszą drogą z jak najmniejszą liczbą zakrętów (las i skały mur przechodzi, karczując je).
 */
function wallLine(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number }[] {
  const straight = planLine(a, b);
  const W = game.map.width, H = game.map.height;
  const hard = (x: number, y: number): boolean => { const t = game.map.tiles[y * W + x]; return t === Terrain.Water || t === Terrain.Mountain; };
  if (!straight.some((p) => hard(p.x, p.y)) || hard(a.x, a.y) || hard(b.x, b.y)) return straight;
  // Dijkstra po polach w prostokącie wokół odcinka (z zapasem), stan = pole i kierunek; zakręt kosztuje dodatkowo
  const M = 16;
  const x0 = Math.max(0, Math.min(a.x, b.x) - M), y0 = Math.max(0, Math.min(a.y, b.y) - M);
  const x1 = Math.min(W - 1, Math.max(a.x, b.x) + M), y1 = Math.min(H - 1, Math.max(a.y, b.y) + M);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, N = bw * bh * 4;
  const dist = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  const heap: [number, number][] = [];
  const push = (d: number, s: number): void => {
    heap.push([d, s]);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p]![0] <= heap[i]![0]) break; [heap[p], heap[i]] = [heap[i]!, heap[p]!]; i = p; }
  };
  const pop = (): [number, number] => {
    const top = heap[0]!, last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l; if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i]!, heap[m]!]; i = m; }
    }
    return top;
  };
  const id = (x: number, y: number, d: number): number => ((y - y0) * bw + (x - x0)) * 4 + d;
  for (let d = 0; d < 4; d++) { dist[id(a.x, a.y, d)] = 0; push(0, id(a.x, a.y, d)); }
  let end = -1;
  while (heap.length) {
    const [dd, s] = pop();
    if (dd > dist[s]!) continue;
    const d = s & 3, cell = s >> 2, x = (cell % bw) + x0, y = Math.floor(cell / bw) + y0;
    if (x === b.x && y === b.y) { end = s; break; }
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k]!, ny = y + DY[k]!;
      if (nx < x0 || ny < y0 || nx > x1 || ny > y1 || hard(nx, ny)) continue;
      const ns = id(nx, ny, k), nd = dd + 1 + (k === d ? 0 : 0.6);
      if (nd < dist[ns]!) { dist[ns] = nd; prev[ns] = s; push(nd, ns); }
    }
  }
  if (end < 0) return straight; // nie da się obejść w pobliżu: zostaje prosto (pola w wodzie czerwone)
  const out: { x: number; y: number }[] = [];
  for (let s = end; s >= 0; s = prev[s]!) { const cell = s >> 2; out.push({ x: (cell % bw) + x0, y: Math.floor(cell / bw) + y0 }); }
  return out.reverse();
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
  plan.tiles = (def.line ? wallLine(plan.start, plan.end) : planLine(plan.start, plan.end)).map(({ x, y }) => {
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
  if (rallyPick) {
    pending.push({ type: 'rally', player: ME, building: rallyPick.building, kind: rallyPick.kind, tile: tile.y * game.map.width + tile.x });
    rallyPick = null; canvas.classList.remove('placing'); play('rotate');
    renderer.orderMarker(tile);
    return;
  }
  if (devSpawn && devAllowed()) { devPlace(tile.x, tile.y, devSpawn.kind, devSpawn.foe, devSpawn.count); return; }
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
    // tryb budowy: Esc odkłada wybrany budynek i chowa listę budynków
    else if (picked) { pick(null); hud.closeBuild(); }
    else if (hud.closeBuild()) { /* lista budynków schowana */ }
    else if (chosen.size) chooseSoldiers([], false);
    else if (selected || selectedUnit) { select(0); selectUnit(0); }
    else menu.open(!gameOver);
    return;
  }
  if (menu.isOpen()) return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || e.ctrlKey || e.metaKey) return;
  if (e.key === 'Enter' && chat.active) { e.preventDefault(); chat.open(); return; }
  if (e.code === 'Space' && !e.repeat && !renderer.walking && pings.jumpLast()) { e.preventDefault(); return; } // spacja: do ostatniego znacznika sojusznika
  if (e.code === 'KeyR' && picked) rotate();
  if (e.code === 'KeyF' && selectedUnit && !e.repeat) { walkAs(selectedUnit); return; } // F przy zaznaczonym mieszkańcu = przejdź się jego oczami
  if (e.code === 'KeyM') hud.setMuted(toggleMute());
  if (e.code === 'KeyN' && !e.repeat) minimap.toggle();
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
  const stepLen = (face % 2 ? Math.SQRT2 : 1) * (armyForm === 2 ? 2 : armyForm === 3 ? 0.4 : 1);
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
  if (b && b.owner === ME && garrisonRoom(BUILDINGS[b.type]!.id) && !b.build) {
    const sent = [...chosen];
    pending.push({ type: 'garrison', player: ME, ids: sent, tower: b.id });
    // na wieży nie są już częścią oddziału ani grup 1–0: zostają na wieży, póki nie zdejmie się ich z jej okna
    // (po wykonaniu rozkazu: tylko ci, którzy dostali miejsce na wieży — włócznicy stoją przy niej i zostają w oddziale)
    setTimeout(() => {
      const up = sent.filter(onTower);
      if (!up.length) return;
      for (const [k, l] of groups) groups.set(k, l.filter((id) => !up.includes(id)));
      chooseSoldiers([...chosen].filter((id) => !up.includes(id)), false, true);
      armyBarUpdate();
    }, 300);
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
  renderer.setFormationPreview(o ? [...planFormation(game, ME, [...chosen], o.y * game.map.width + o.x, o).spots.values()] : null, armyForm === 3);
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
  return UNITS.filter((def) => !def.guard).map((def) => {
    const have = p.res[resIndex(def.weapon)]!;
    const cost = def.cost.gold ?? 0;
    // ile sztuk broni (albo drewna na taran) idzie na jednego
    const need = def.cost[def.weapon] ?? 1;
    return { id: def.id, name: t(def.name), weapon: def.weapon, need, have, gold, idle, cost, hp: def.hp, attack: def.attack, range: def.range, max: Math.max(0, Math.min(Math.floor(have / need), cost ? Math.floor(gold / cost) : 999, idle)) };
  });
}

function canTrain(): boolean {
  const p = game.players[ME]!;
  const def = UNITS[0]!;
  for (const [res, amount] of Object.entries(def.cost)) if (p.res[resIndex(res as ResourceId)]! < amount!) return false;
  return game.units.some((u) => u.owner === ME && u.job === 0);
}

/** Łucznik przypisany do wieży (na niej albo w drodze na nią): nie łapie się ramką, podwójnym klikiem ani grupą —
 *  zdejmuje się go tylko z okna wieży („Zaznacz łuczników” / „Zejdźcie z wieży”) */
const onTower = (id: number): boolean => { const s = game.soldiers.find((x) => x.id === id); return !!s && !!s.post; };
function chooseSoldiers(ids: number[], add: boolean, quiet = false): void {
  // straż miejska pilnuje osady sama, nie słucha rozkazów; kliknięty strażnik tylko coś burknie
  const guard = ids.find((id) => { const s = game.soldiers.find((x) => x.id === id); return !!s && !!UNITS[s.kind]!.guard; });
  ids = ids.filter((id) => { const s = game.soldiers.find((x) => x.id === id); return !s || !UNITS[s.kind]!.guard; });
  if (guard && !ids.length && !quiet) { sayGuard(guard); selectUnit(guard); return; }
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
    const ids = onScreen.filter((s) => s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1 && !onTower(s.id)).map((s) => s.id);
    chooseSoldiers(ids, e.shiftKey);
    if (ids.length) play('select');
    renderer.markDragged();
    return;
  }
  // zwykłe kliknięcie: najbliższy żołnierz pod kursorem (trafia się w całą sylwetkę, od stóp po hełm)
  // odległość od odcinka stopy–czubek (sylwetka rośnie przy zbliżeniu), tolerancja zależna od wielkości postaci na ekranie
  let best = 0, bestD = Infinity;
  for (const s of onScreen) {
    const hgt = Math.max(1, s.feet - s.y);
    const tol = Math.max(16, hgt * 0.35);
    const vx = s.x - s.fx, vy = s.y - s.feet, len2 = vx * vx + vy * vy || 1;
    const k = Math.max(0, Math.min(1, ((e.clientX - s.fx) * vx + (e.clientY - s.feet) * vy) / len2));
    const d = Math.hypot(e.clientX - (s.fx + vx * k), e.clientY - (s.feet + vy * k));
    if (d <= tol && d < bestD) { bestD = d; best = s.id; }
  }
  // Shift + klik na zaznaczonym: odznacza tylko jego
  if (best && e.shiftKey && chosen.has(best)) { unchoose(best); play('select'); renderer.markDragged(); return; }
  if (best) {
    // podwójne kliknięcie: wszyscy moi tego samego rodzaju widoczni na ekranie
    const now = performance.now();
    const kind = game.soldiers.find((x) => x.id === best)?.kind;
    if (lastPick.id === best && now - lastPick.at < 400) {
      const kinds = new Map(game.soldiers.map((x) => [x.id, x.kind]));
      chooseSoldiers(onScreen.filter((o) => kinds.get(o.id) === kind && !onTower(o.id)).map((o) => o.id), e.shiftKey);
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
    // wrodzy chłopi pod kursorem: prawy klik = żołnierze idą na nich
    for (const u of game.units) {
      if (game.players[u.owner]?.team === game.players[ME]!.team) continue;
      const p = renderer.project(u.px / 256, u.py / 256);
      if (!p.front) continue;
      const d = (p.sx - mouseX) ** 2 + (p.sy - 12 - mouseY) ** 2;
      if (d < bd) { bd = d; hoverFoe = u.id; }
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
    if (b && b.owner === ME && !b.build && garrisonRoom(BUILDINGS[b.type]!.id)) {
      const room = garrisonRoom(BUILDINGS[b.type]!.id) - game.soldiers.filter((s) => s.post === b.id).length;
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
  // Ustawienia → Interfejs → Paski zdrowia: zawsze / w walce (ranni i zaznaczeni) / tylko zaznaczeni / nigdy
  const mode = gfx.hpBars ?? 'combat';
  for (const s of list) {
    if (mode === 'never') break;
    const max = UNITS[kinds.get(s.id) ?? 0]!.hp;
    const marked = chosen.has(s.id) || s.id === hoverFoe;
    if (mode === 'selected' ? !marked : mode === 'combat' ? s.hp >= max && !marked : false) continue;
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
  // wilki: pasek zdrowia zawsze, w barwie wroga
  for (const w of mode === 'never' || mode === 'selected' ? [] : renderer.wolvesOnScreen()) {
    let bar = bars[n];
    if (!bar) { bar = document.createElement('div'); bar.className = 'hpbar'; bar.append(document.createElement('span')); barLayer.append(bar); bars.push(bar); }
    bar.hidden = false;
    bar.style.transform = `translate(${Math.round(w.x - 17)}px, ${Math.round(w.y - 4)}px)`;
    bar.dataset.team = 'foe';
    const fill = bar.firstChild as HTMLElement;
    fill.style.width = `${Math.max(0, (w.hp / WOLF_HP) * 100)}%`;
    fill.dataset.low = String(w.hp < WOLF_HP * 0.35);
    n++;
  }
  for (let i = n; i < bars.length; i++) bars[i]!.hidden = true;
}

// ---- pasek ostrzeżeń u góry: kiedy wróg wyśle wojsko i czy już nadciąga ----
const alarm = document.createElement('div');
alarm.className = 'alarm';
alarm.setAttribute('role', 'status');
document.body.append(alarm);
/** Środek nadciągającego oddziału wroga (klik w pasek ostrzeżeń przenosi tam kamerę) */
let comingAt: { x: number; y: number } | null = null;
alarm.addEventListener('click', () => { if (comingAt) renderer.lookAt(comingAt.x, comingAt.y, 30); });
alarm.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && comingAt) { e.preventDefault(); renderer.lookAt(comingAt.x, comingAt.y, 30); } });
function updateAlarm(): void {
  const me = game.players[ME]!;
  const enemies = game.players.filter((p) => p.team !== me.team && p.bot && !p.defeated);
  if (!enemies.length || me.defeated) { alarm.hidden = true; return; }
  alarm.hidden = false;
  const keep = game.buildings.find((b) => b.owner === ME && b.type === 0);
  const foes = game.soldiers.filter((s) => game.players[s.owner]!.team !== me.team);
  // nadciąga: wrogie wojsko (bez strażników miejskich, którzy chodzą obchodem po swojej osadzie) idzie do celu
  // przy naszej osadzie — cel marszu najwyżej 30 pól od naszej twierdzy albo właśnie bije kogoś z naszych
  const W = game.map.width;
  const coming = keep ? foes.filter((s) => {
    if (UNITS[s.kind]?.guard) return false;
    if (s.target && (game.soldiers.find((x) => x.id === s.target)?.owner === ME || game.units.find((x) => x.id === s.target)?.owner === ME)) return true;
    if (s.goal < 0 || !s.path.length) return false;
    return Math.hypot((s.goal % W) - keep.x, Math.floor(s.goal / W) - keep.y) < 30;
  }) : [];
  comingAt = coming.length ? { x: coming.reduce((a, s) => a + (s.px >> 8), 0) / coming.length, y: coming.reduce((a, s) => a + (s.py >> 8), 0) / coming.length } : null;
  if (coming.length && keep) {
    const near = Math.min(...coming.map((s) => Math.hypot((s.px >> 8) - keep.x, (s.py >> 8) - keep.y)));
    alarm.dataset.state = 'coming';
    alarm.tabIndex = 0;
    alarm.title = 'Kliknij, żeby zobaczyć nadciągające wojsko';
    alarm.innerHTML = `<strong>${t('alarm.coming')}</strong><span>${coming.length} ${t('alarm.soldiers')} · ${Math.round(near)} ${t('alarm.fields')}</span><span class="alarm-bar"><span style="width:${Math.max(4, Math.min(100, 100 - near))}%"></span></span><span class="alarm-go">Pokaż ▸</span>`;
    return;
  }
  alarm.removeAttribute('tabindex'); alarm.removeAttribute('title');
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
  // mecz przez sieć: wynik trafia do historii i rankingu gracza (kooperacja przeciw botom nie liczy się do rankingu)
  if (netGame && !netGame.coop) void saveResult(netGame.preset, win, Math.floor(game.tick / TICKS_PER_SECOND / 60));
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
  // broń idzie do zbrojowni: gdy są warsztaty broni, a zbrojowni brak albo jest pełna, skryba o tym mówi
  const myB = game.buildings.filter((b) => b.owner === ME && !b.build);
  const smiths = myB.some((b) => ['poleturner', 'fletcher'].includes(BUILDINGS[b.type]!.id));
  if (smiths && !myB.some((b) => BUILDINGS[b.type]!.stores?.includes('armory'))) scribe.say('noArmory', t('scribe.noArmory'));
  else if (smiths && storeUsed(p, 'armory') >= storeCapacity(game, ME, 'armory')) scribe.say('armoryFull', t('scribe.armoryFull'));
  const hour = clockAt(game.tick).hour;
  const night = hour >= 19.5 || hour < 6;
  // dlaczego nikt nie przychodzi: skryba mówi wprost, co blokuje nowych osadników
  const pop = population(game, ME);
  if (p.popularity < 50 && pop <= 6) scribe.say('noComers', `Nikt nie chce tu przyjść — popularność ${p.popularity}. Daj więcej jedzenia albo obniż podatki.`, true);
  else if (p.popularity >= 50 && pop >= housing(game, ME)) scribe.say('noComers', 'Ludzie by przyszli, ale nie ma dla nich dachu. Postaw chatę.');
  else if (p.popularity >= 50 && idleCount(game, ME) >= idleSlots(game, ME)) scribe.say('noComers', `Przy ogniskach komplet (${idleSlots(game, ME)} miejsc) — nowi kopacze nie przyjdą, a nadmiarowi czekają pod chatami. Daj im pracę albo postaw kolejne obozowisko.`);
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
    weather: (() => { const w = weatherOf(game, rainAt(game.tick)); return { season: SEASON_NAME[w.season], temp: w.temp }; })(),
    res: p.res, trend: resTrend(p.res), pop: population(game, ME), housing: housing(game, ME), popularity: p.popularity, idle: idleCount(game, ME), idleSlots: idleSlots(game, ME),
    stock: storeUsed(p, 'stockpile'), stockCap: storeCapacity(game, ME, 'stockpile'),
    food: storeUsed(p, 'granary'), foodCap: storeCapacity(game, ME, 'granary'),
    delta: f.delta, fed: f.fed, bribed: f.bribed, rations: p.rations, tax: p.tax, affordable,
    report: buildReport(f, resTrend(p.res)),
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
  sampleMade();
  if (selected) {
    const b = game.buildings.find((x) => x.id === selected);
    if (!b) select(0);
    else { hud.showInfo(buildingInfo(b)); renderer.setWorkerMark(b.owner === ME ? b.worker : 0); }
  }
}

let last = performance.now();
let acc = 0;
// --- symulacja w osobnym wątku (src/sim/worker.ts): w grze z botami długie ticki nie zatrzymują obrazu ---
// na razie tylko na życzenie (?watek=1): w zwykłej grze ludzie sunęli bez animacji, przeskakiwali i przenikali przez zamek
const simThread = typeof window !== 'undefined' && new URLSearchParams(location.search).has('watek') ? createSimThread() : null;
let simMode = false, simBusy = false, simGen = 0, simBroken = false, simSent = 0;
function onSimResult(r: SimResult): void {
  if (r.gen !== simGen || !simMode) return;
  simBusy = false;
  renderer.snapshot(); // pozycje sprzed porcji kroków: ruch płynny między tickami
  const map = game.map;
  // wycinka lasu i wyczerpane złoża: jedyne zmiany mapy w symulacji — nanosimy je na naszą kopię mapy
  for (let i = game.cut.length; i < r.state.cut.length; i++) map.tiles[r.state.cut[i]!] = 0;
  const before = game.tick;
  r.state.map = map;
  game = r.state;
  renderer.swapState(game);
  perf.sim += r.ms; perf.ticks += r.ticks;
  if (Math.floor(game.tick / 50) !== Math.floor(before / 50)) save();
  refresh(); updateGhost(); updateAlarm();
}
if (simThread) {
  simThread.onResult = onSimResult;
  // wątek nie wstał (np. gra złożona w jeden plik) albo padł: dalej liczy wątek główny, od bieżącego stanu
  simThread.onError = () => { if (simMode) console.warn('Wątek symulacji niedostępny — liczę w wątku głównym'); simMode = false; simBusy = false; simBroken = true; };
}

let lastDraw = 0;
function loop(now: number): void {
  pings.update(now);
  caravanNews(now);
  if (game) minimap.update(game, ME, now);
  // limit klatek z ustawień: klatka pominięta, gdy od poprzedniej minęło za mało czasu (laptop się nie grzeje)
  const cap = gfx.fpsLimit ?? 0;
  if (cap > 0 && now - lastDraw < 1000 / cap - 2) { requestAnimationFrame(loop); return; }
  lastDraw = now;
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
  // pauza w grze z botami: polecenia od razu (plac budowy widać od razu, a siatka budowy pokazuje zajęte pola)
  if (speed === 0 && !net && pending.length && !simBusy) {
    applyCommands(game, pending);
    pending = [];
    if (simMode) { simGen++; simThread!.set(game, simGen); }
    refresh(); updateGhost();
  }
  if (simMode && !net) {
    // symulacja w osobnym wątku: wysyłamy porcję kroków, wynik przychodzi w onSimResult (tam odświeżenie widoku)
    if (!simBusy && acc >= TICK_MS) {
      const n = Math.min(6, Math.floor(acc / TICK_MS));
      acc = n === 6 ? 0 : acc - n * TICK_MS;
      simBusy = true; simSent = now;
      const cmds = pending; pending = [];
      simThread!.run(n, cmds, simGen);
    } else if (simBusy && now - simSent > 3000) {
      // brak odpowiedzi przez 3 s: wątek się zawiesił albo nie wczytał — liczymy dalej sami
      simThread!.onError();
    }
  } else while (acc >= TICK_MS && steps < 6) {
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
  renderer.frame(elapsed / 1000, speed ? Math.min(1, acc / TICK_MS) : 1, speed === 0);
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
  // do tego mnożnik z ustawień (Ustawienia → Interfejs): gracz może powiększyć albo pomniejszyć wszystko
  const k = Math.max(0.3, Math.min(1.9, Math.max(0.6, Math.min(1.1, innerWidth / 1480, innerHeight / 800)) * (gfx?.uiSize ?? 1)));
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
    const kx = keep.x + 5, ky = keep.y + 5;
    for (let r = 7; r < 30; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = kx + dx, y = ky + dy;
          if (canPlace(game, player, type, x, y, false) === null) { step(game, [{ type: 'build', player, building: id, x, y }]); refresh(); return { x, y }; }
        }
    return null;
  },
  /** Nowa gra z botami na wybranej mapie (np. '2v2' — z botem-sojusznikiem) */
  play(preset: MapPresetId = '1v1', seed = 'test'): void { start(seed, preset); },
  /** Dodaje po `n` każdego surowca */
  give(n = 300, player = ME): void { const p = game.players[player]!; for (let i = 0; i < p.res.length; i++) p.res[i]! += n; },
  /** Szkoli `n` włóczników w pierwszych koszarach gracza */
  train(n = 1, player = ME): number { const b = game.buildings.find((x) => x.owner === player && BUILDINGS[x.type]!.id === 'barracks'); if (!b) return 0; for (let i = 0; i < n; i++) pending.push({ type: 'train', player, building: b.id, unit: 'spearman' }); return n; },
  /** Przewija symulację o `ticks` kroków bez rysowania */
  run(ticks: number): void { for (let i = 0; i < ticks; i++) { step(game, pending); pending = []; } refresh(); },
  /** Kamera nad polem mapy (x, y w polach), z odległości `dist` */
  at(x: number, y: number, dist = 8): void { renderer.lookAt(x, y, dist); },
  /** Kamera nad budynkiem danego typu */
  look(id: string, dist = 14): void { const b = game.buildings.find((x) => BUILDINGS[x.type]!.id === id); if (b) { const d = BUILDINGS[b.type]!; renderer.lookAt(b.x + d.w / 2, b.y + d.h / 2, dist); } },
  /** Dostawia `n` wrogich włóczników obok koszar gracza (do testu walki) */
  enemy(n = 3): void {
    const b = game.buildings.find((x) => x.owner === ME && BUILDINGS[x.type]!.id === 'barracks') ?? game.buildings[0]!;
    for (let i = 0; i < n; i++) game.soldiers.push({ id: game.nextId++, owner: 1, kind: 0, px: (b.x + 5 + i) * 256 + 128, py: (b.y + 4) * 256 + 128, path: [], hp: 60, goal: -1, wait: 0, target: 0, cd: 0 });
  },
  /** Pole przed bramą twierdzy gracza (punkt odniesienia na pustej scenie) */
  home(player = ME): { x: number; y: number } | null { const k = game.buildings.find((b) => b.owner === player && b.type === 0); return k && k.door >= 0 ? { x: k.door % game.map.width, y: Math.floor(k.door / game.map.width) } : null; },
  /** Gotowy budynek w polu (x, y), bez budowy; zwraca id albo null (działka zajęta) */
  place(id: string, x: number, y: number, rot = 0, player = ME): number | null { const r = placeReady(game, id, x, y, rot, player); refresh(); return r; },
  /** Pora roku: środek wybranej pory (spring, summer, autumn, winter) */
  season(name: Season): void { game.seasonShift = shiftToSeason(game.tick, name); refresh(); },
  /** Otwiera okno budynku o danym id (jak kliknięcie) */
  open(id: number): void { select(id); },
  /** Godzina na zegarze bieżącego dnia, np. hour(20.5) — wieczór z pochodniami */
  hour(h: number): void { setHour(game, h); refresh(); },
  /** `n` chłopów przy twierdzy */
  peasants(n = 5, player = ME): number { const r = addPeasants(game, n, player).length; refresh(); return r; },
  /**
   * Scena dla nowego modelu: stawia gotowy budynek `id` na środku pustej łąki przed twierdzą (poprzedni model znika),
   * ustawia południe i kamerę od frontu. Potem `view(nazwa)` obchodzi go dookoła — patrz `views`.
   */
  model(id: string, rot = 0, view = 'front'): { id: number; x: number; y: number; views: string[] } | null {
    if (stage) removeReady(game, stage.id);
    stage = null;
    const h = (window as unknown as { __test: { home: () => { x: number; y: number } | null } }).__test.home();
    const type = buildingIndex(id);
    if (!h || type < 0) return null;
    const d = BUILDINGS[type]!, w = rot % 2 ? d.h : d.w, hh = rot % 2 ? d.w : d.h;
    const x = h.x - Math.floor(w / 2), y = h.y + 5;
    const bid = placeReady(game, id, x, y, rot);
    if (bid === null) return null;
    stage = { id: bid, x, y, w, h: hh };
    setHour(game, 11.5);
    refresh();
    // kamera dopiero, gdy model jest w scenie (wymiary z siatki)
    requestAnimationFrame(() => requestAnimationFrame(() => testView(view)));
    return { id: bid, x, y, views: Object.keys(VIEWS) };
  },
  /** Widok na model z `model()`: front, right, back, left, top, near, ground-front, ground-right, ground-back, ground-left, door */
  view(name = 'front'): boolean { return testView(name); },
  views: () => Object.keys(VIEWS),
  /** Zaznacza budynek (jak kliknięcie): otwiera jego okno; zwraca id albo 0 */
  select(id: string | number): number { const b = typeof id === 'number' ? game.buildings.find((x) => x.id === id) : game.buildings.find((x) => x.owner === ME && BUILDINGS[x.type]!.id === id); select(b?.id ?? 0); return b?.id ?? 0; },
  /** Wilk w polu (x, y) */
  wolf(x: number, y: number): void { addWolf(game, x, y); },
  state: () => game,
};
/** Model na scenie testowej (__test.model) */
let stage: { id: number; x: number; y: number; w: number; h: number } | null = null;
/** Widoki na model: obrót względem frontu (strona z drzwiami), nachylenie, odległość w rozmiarach modelu, wysokość celu (część wysokości) */
const VIEWS: Record<string, [number, number, number, number]> = {
  front: [0, 32, 2.2, 0.35], right: [90, 32, 2.2, 0.35], back: [180, 32, 2.2, 0.35], left: [270, 32, 2.2, 0.35],
  top: [30, 85, 2.4, 0], near: [35, 22, 1.3, 0.5], door: [0, 12, 0.9, 0.25],
  // z ziemi, oczami chłopa: nisko, blisko, cel na wysokości okapu
  'ground-front': [0, 6, 1.5, 0.45], 'ground-right': [90, 6, 1.5, 0.45], 'ground-back': [180, 6, 1.5, 0.45], 'ground-left': [270, 6, 1.5, 0.45],
};
function testView(name: string): boolean {
  const v = VIEWS[name];
  const b = stage && game.buildings.find((x) => x.id === stage!.id);
  if (!v || !stage || !b) return false;
  const size = renderer.buildingSize(b.id) ?? { w: stage.w, h: 1, d: stage.h };
  const cx = stage.x + stage.w / 2, cy = stage.y + stage.h / 2;
  // front = strona z drzwiami
  const W = game.map.width, dx = b.door >= 0 ? (b.door % W) + 0.5 - cx : 0, dy = b.door >= 0 ? Math.floor(b.door / W) + 0.5 - cy : 1;
  const front = (Math.atan2(dx, dy) * 180) / Math.PI;
  const span = Math.max(size.w, size.d, size.h, 1.2);
  renderer.viewAround(cx, cy, Math.max(1.2, span * v[2]), front + v[0], v[1], size.h * v[3]);
  return true;
}
// pusta scena: budynki od razu gotowe; ?model=house&rot=1&widok=ground-front od razu stawia model i ustawia widok
if (EMPTY) {
  renderer.noBuildShow = true;
  const q = new URLSearchParams(location.search), id = q.get('model');
  if (id) {
    (window as unknown as { __test: { model: (id: string, rot: number, view: string) => unknown } }).__test.model(id, Number(q.get('rot') ?? 0) || 0, q.get('widok') ?? 'front');
  }
}
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
    if (prev !== undefined && b.hp < prev) raiseAlert(b.x + (BUILDINGS[b.type]!.w >> 1), b.y + (BUILDINGS[b.type]!.h >> 1), game.wolves.some((w) => w.gnaw === b.id) ? 'wolf' : 'enemy');
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
  const ids = (groups.get(n) ?? []).filter((id) => game.soldiers.some((x) => x.id === id && x.owner === ME) && !onTower(id));
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

// --- odzywki ludzi: teksty w data/barks.ts ---
/** Pan zamku spaceruje po dziedzińcu blisko tego miejsca (patrz renderer.lordAt) */
function lordNear(px: number, py: number): boolean {
  const l = renderer.lordAt(ME);
  return !!l && Math.hypot(l.x - px / 256, l.y - py / 256) < 6;
}
/** Sytuacja w osadzie i wokół człowieka: najważniejsza wygrywa (ogień, wróg, wilki, głód, podatki…) */
function situation(px: number, py: number): string | null {
  const p = game.players[ME]!, R2 = (r: number): number => (r * 256) ** 2;
  const d2 = (x: number, y: number): number => (x - px) ** 2 + (y - py) ** 2;
  if (game.buildings.some((b) => b.owner === ME && (b.fire ?? 0) > 0 && d2(b.x * 256, b.y * 256) < R2(10))) return 'fire';
  if (game.soldiers.some((o) => game.players[o.owner]!.team !== p.team && d2(o.px, o.py) < R2(14))) return 'enemy';
  if (game.wolves.some((w) => d2(w.px, w.py) < R2(5))) return 'wolves';
  if (renderer.weather.night > 0.5 && game.wolves.length && Math.random() < 0.5) return 'wolvesNight';
  if (lordNear(px, py)) return 'lord';
  const fc = monthlyForecast(game, p);
  if (!fc.fed) return 'hungry';
  if (fc.parts.some((x) => x.key === 'crowd' && x.value < 0) && Math.random() < 0.35) return 'crowded';
  if (p.tax >= 3 && Math.random() < 0.6) return 'taxHigh';
  if (p.tax === 0 && Math.random() < 0.5) return 'bribe';
  if (p.popularity < 45 && Math.random() < 0.6) return 'angry';
  const tavern = game.buildings.some((b) => b.owner === ME && BUILDINGS[b.type]!.id === 'tavern' && b.worker);
  if (tavern && (p.res[resIndex('ale')] ?? 0) <= 0 && Math.random() < 0.3) return 'dry';
  if (renderer.weather.rain > 0.4 && Math.random() < 0.4) return 'rain';
  { const temp = weatherOf(game, rainAt(game.tick)).temp; if (temp < 2 && Math.random() < 0.5) return 'cold'; if (temp > 25 && Math.random() < 0.35) return 'hot'; }
  if (p.tax === 1 && Math.random() < 0.15) return 'noTax';
  if (p.popularity >= 80 && Math.random() < 0.25) return 'good';
  return null;
}
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
  void p;
  const sit = situation(u.px, u.py);
  if (sit) return pick(sit);
  if (renderer.weather.night > 0.5 && Math.random() < 0.4) return pick('night');
  { const h = clockAt(game.tick).hour; if (h >= 5 && h < 8 && Math.random() < 0.5) return pick('morning'); }
  // rytm dnia: wieczór (19, 20), w drodze do łóżka (21), sen (22, pod dachem albo na słomie)
  if (u.phase === 22) return u.home ? pick('sleeping') : Math.random() < 0.5 ? pick('outside') : pick('sleeping');
  if (u.phase === 21) return weatherOf(game).temp < COLD && Math.random() < 0.6 ? pick('coldNight') : pick('sleep');
  if (u.phase === 19 || u.phase === 20) return pick('evening');
  if (u.phase === 13 || u.phase === 14) return pick('build');
  if (u.carryRes >= 0 && Math.random() < 0.5) return pick('carry');
  if (!u.job) return pick('idle');
  const job = game.buildings.find((b) => b.id === u.job);
  const jid = job ? BUILDINGS[job.type]!.id : '';
  return SAY[jid] && Math.random() < 0.7 ? pick(jid) : pick('work');
}
function sayGuard(id: number): void {
  const s = game.soldiers.find((x) => x.id === id);
  if (!s) return;
  const pick = (l: string[]): string => l[Math.floor(Math.random() * l.length)]!;
  const near = game.soldiers.some((o) => game.players[o.owner]!.team !== game.players[s.owner]!.team && (o.px - s.px) ** 2 + (o.py - s.py) ** 2 < (8 * 256) ** 2) || game.wolves.some((w) => (w.px - s.px) ** 2 + (w.py - s.py) ** 2 < (8 * 256) ** 2);
  const sit = situation(s.px, s.py);
  const extra = sit === 'lord' ? GUARD_SAY.lord : sit === 'cold' ? GUARD_SAY.cold : sit === 'fire' ? GUARD_SAY.fire : sit === 'rain' ? GUARD_SAY.rain : sit === 'hungry' ? GUARD_SAY.hungry : sit === 'taxHigh' ? GUARD_SAY.taxHigh : null;
  bubble.textContent = pick(near || sit === 'enemy' ? GUARD_SAY.danger : extra ?? (clockAt(game.tick).night ? GUARD_SAY.night : GUARD_SAY.day));
  bubble.hidden = false;
  sayUnit = id;
  sayUntil = performance.now() + 3200;
  talk(bubble.textContent ?? '', id, true);
}
function speak(id: number): void {
  bubble.textContent = lineFor(id);
  bubble.hidden = false;
  sayUnit = id;
  sayUntil = performance.now() + 3200;
  talk(bubble.textContent ?? '', id);
}
/** Sami z siebie: co kilkanaście sekund ktoś na ekranie, blisko kamery, rzuca odzywkę o tym, co się dzieje */
let nextChatter = performance.now() + 9000;
function chatter(): void {
  const now = performance.now();
  if (now < nextChatter || !bubble.hidden || menu.isOpen() || titleScreen || gfx.bubbles === false) return;
  nextChatter = now + 9000 + Math.random() * 9000;
  const f = renderer.focusTile, near = (px: number, py: number): boolean => Math.hypot(px / 256 - f.x, py / 256 - f.y) < 12;
  const people = game.units.filter((u) => u.owner === ME && near(u.px, u.py) && u.phase !== 22);
  const guards = game.soldiers.filter((s) => s.owner === ME && UNITS[s.kind]!.guard && near(s.px, s.py));
  const pool = [...people.map((u) => ['u', u.id] as const), ...guards.map((s) => ['g', s.id] as const)];
  if (!pool.length) return;
  const [kind, id] = pool[Math.floor(Math.random() * pool.length)]!;
  if (kind === 'g') sayGuard(id); else speak(id);
}
function sayLoop(): void {
  chatter();
  if (!bubble.hidden) {
    const u = game.units.find((x) => x.id === sayUnit) ?? game.soldiers.find((x) => x.id === sayUnit);
    if (!u || performance.now() > sayUntil || menu.isOpen()) bubble.hidden = true;
    else { const p = renderer.project(u.px / 256, u.py / 256); bubble.style.transform = `translate(${p.sx}px, ${p.sy - 40}px) translate(-50%, -100%)`; }
  }
  requestAnimationFrame(sayLoop);
}
requestAnimationFrame(sayLoop);

/** Rozpiska do panelu: składniki popularności i podział ludności */
function buildReport(f: ReturnType<typeof monthlyForecast>, trend: number[]): HudView['report'] {
  const LBL: Record<string, string> = { food: 'Racje jedzenia', tax: 'Podatki', tavern: 'Karczma (piwo z browaru)', crowd: 'Ciasnota w chatach', rough: 'Spanie na słomie pod gołym niebem', cold: 'Zmarznięci w deszczu', winter: 'Zimno (pora roku)', freezing: 'Brak drewna na opał — marzną w chatach' };
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
  const people: { label: string; value: number }[] = [{ label: 'Wszyscy chłopi', value: mine.length }, { label: 'Kopacze bez fachu', value: idle }, { label: 'Na budowie', value: builders }];
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
  // spichlerz: zapotrzebowanie, zapas, prognoza
  const pop = population(game, ME);
  const lvl = RULES.rations[p0.rations]!;
  const perMonthWant = Math.ceil((pop * lvl.foodPer8) / 8);
  const perDayWant = perMonthWant * MEALS_PER_DAY;
  const have = foodTotal(p0); // porcje (ryba liczy się podwójnie)
  const net = FOOD_RES_ALL.reduce((n, i) => n + (trend[i] ?? 0) * (FOOD_VALUE[RESOURCES[i]!] ?? 1), 0); // zmiana z ostatnich ok. 600 ticków (1/6 doby)
  const mineB = game.buildings.filter((b) => b.owner === ME && !b.build);
  const count = (id: string, worked = true): number => mineB.filter((b) => BUILDINGS[b.type]!.id === id && (!worked || b.worker) && !b.off).length;
  const bakeries = Math.min(count('bakery'), count('mill'), count('farm'));
  const made = count('orchard') * FOOD_PER_DAY.orchard! + count('fisher') * FOOD_PER_DAY.fisher! + bakeries * FOOD_PER_DAY.bakery!;
  const perPerson = (lvl.foodPer8 / 8) * MEALS_PER_DAY;
  const feeds = perPerson > 0 ? Math.floor(made / perPerson) : 0;
  const lasts = perDayWant > 0 ? have / perDayWant : Infinity;
  const fmtLast = (d: number): string => d === Infinity ? 'bez końca' : d >= 2 ? `${Math.floor(d)} dni` : d >= 1 ? '1 dzień' : `${Math.max(0, Math.floor(d * 24))} godz.`;
  const food: NonNullable<HudView['report']>['food'] = [
    { label: 'Jedzących', value: String(pop), note: `(racje: ${t(lvl.name).toLowerCase()})` },
    ...(p0.hungry ? [{ label: 'Głód!', value: 'odchodzą', sign: 'minus' as const, note: '(zabrakło jedzenia — póki go nie ma, ludzie opuszczają osadę)' }] : []),
    { label: 'Zjadają co miesiąc', value: `${perMonthWant} porcji`, note: '(rozliczenie)' },
    { label: 'Zjadają na dobę', value: `${perDayWant} porcji`, note: `(${perPerson.toFixed(perPerson % 1 ? 1 : 0)} na osobę)` },
    { label: 'W spichlerzach', value: `${storeUsed(p0, 'granary')} / ${storeCapacity(game, ME, 'granary')}`, note: `(${have} porcji: jabłko 1, chleb 2, ryba 3)` },
    { label: 'Zapas starczy na', value: fmtLast(lasts), sign: lasts < 0.5 ? 'minus' : lasts >= 2 ? 'plus' : undefined },
    { label: 'Gospodarstwa dają na dobę', value: `ok. ${made}`, note: `(sady ${count('orchard')}, rybacy ${count('fisher')}, piekarnie ${bakeries})` },
    { label: 'Wykarmią', value: `ok. ${feeds} osób`, sign: feeds < pop ? 'minus' : 'plus' },
    { label: 'Bilans teraz', value: `${net * 6 > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net * 6)} na dobę`, sign: net < 0 ? 'minus' : net > 0 ? 'plus' : undefined, note: '(z ostatnich 4 godzin)' },
  ];
  const lack = Math.max(0, Math.ceil((pop * perPerson - made) / FOOD_PER_DAY.orchard!));
  const foodHint = (lack > 0 ? `Brakuje jedzenia dla ${pop - feeds} osób — postaw jeszcze ok. ${lack} ${lack === 1 ? 'sad' : lack < 5 ? 'sady' : 'sadów'} (albo wyłącz mniej ważny budynek, żeby pracownik poszedł do sadu). ` : '')
    + `Jeden sad wykarmi ok. ${Math.floor(FOOD_PER_DAY.orchard! / (perPerson || 1))} osób, rybak ok. ${Math.floor(FOOD_PER_DAY.fisher! / (perPerson || 1))}, pole z młynem i piekarnią ok. ${Math.floor(FOOD_PER_DAY.bakery! / (perPerson || 1))}. Jeden spichlerz mieści ${BUILDINGS.find((b) => b.id === 'granary')?.capacity?.granary ?? 0}.`;
  return { popularity, people, army, food, foodHint };
}

/** Okno na środku ekranu: czy na pewno rozebrać, co wróci do składu (połowa kosztu, wynoszona z gruzu) */
function confirmDemolish(id: number): void {
  const b = game.buildings.find((x) => x.id === id);
  if (!b) return;
  // Ustawienia → Rozgrywka: bez pytania rozbiera od razu
  if (gfx.confirmDemolish === false) { pending.push({ type: 'demolish', player: ME, id }); play('demolish'); select(0); return; }
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
const perfBox = document.createElement('div');
perfBox.className = 'perf';
perfBox.hidden = true;
// dwie kolumny: ogólne liczniki | karta graficzna przejście po przejściu i najcięższe rzeczy na scenie
const perfMain = document.createElement('pre'), perfGpu = document.createElement('pre');
perfBox.append(perfMain, perfGpu);
document.body.append(perfBox);
// mały licznik FPS zawsze widoczny pod wersją; klik albo F3 rozwija pełne statystyki
const fpsTag = document.createElement('button');
fpsTag.type = 'button';
fpsTag.className = 'fps-tag';
fpsTag.title = 'Wydajność — kliknij albo F3';
fpsTag.textContent = 'FPS —';
document.body.append(fpsTag);
const togglePerf = (): void => {
  perfBox.hidden = !perfBox.hidden;
  fpsTag.setAttribute('aria-pressed', String(!perfBox.hidden));
  // przy otwartym oknie co 15. klatka jest mierzona przejście po przejściu (cienie, scena, AO, poświata…)
  renderer.gpuProfile = !perfBox.hidden;
};
fpsTag.addEventListener('click', togglePerf);
window.addEventListener('keydown', (e) => { if (e.key === 'F3') { e.preventDefault(); togglePerf(); } });

// ---- panel dewelopera (F9): stawianie jednostek i wilków, scenki, czas — tylko w grze z botami w trybie dewelopera ----
/** Czeka na klik na mapie: punkt zbiórki koszar */
let rallyPick: { building: number; kind: number } | null = null;
let devSpawn: { kind: DevSpawn; foe: boolean; count: number } | null = null;
function devAllowed(): boolean { return !net && (SANDBOX || !!game.players[ME]?.dev); }
const devFoe = (): number => game.players.find((p) => p.team !== game.players[ME]!.team && !p.defeated)?.id ?? -1;
/** Stawia jednostki wokół pola (x, y): po spirali na przechodnich polach */
function devPlace(x: number, y: number, kind: DevSpawn, foe: boolean, count: number): number {
  const W = game.map.width, H = game.map.height;
  const owner = foe ? devFoe() : ME;
  let n = 0;
  for (let r = 0; r < 8 && n < count; r++)
    for (let dy = -r; dy <= r && n < count; dy++)
      for (let dx = -r; dx <= r && n < count; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = x + dx, ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H || !walkable(game, ty * W + tx, owner < 0 ? ME : owner)) continue;
        const px = tx * FP + FP / 2, py = ty * FP + FP / 2;
        if (kind === 'wolf') game.wolves.push({ id: game.nextId++, px, py, hp: 45, path: [], target: 0, cd: 0, leaving: false });
        else {
          if (owner < 0) return 0;
          const k = unitIndex(kind);
          game.soldiers.push({ id: game.nextId++, owner, kind: k, px, py, path: [], hp: UNITS[k]!.hp, goal: -1, wait: 0, target: 0, cd: 0 });
        }
        n++;
      }
  const what = kind === 'wolf' ? 'wilków' : kind === 'archer' ? 'łuczników' : 'włóczników';
  const h = clockAt(game.tick).hour;
  if (kind === 'wolf' && h >= 6.5 && h < 19.5 && n) { devPanel.placed(`Postawiono ${n} wilków, ale jest dzień — od razu uciekną do lasu. Najpierw „Przewiń do nocy”.`); return n; }
  devPanel.placed(n ? `Postawiono ${n} ${what}${kind === 'wolf' ? '' : foe ? ' wroga' : ' swoich'}. Klikaj dalej albo Esc.` : 'Tu nie da się postawić — wybierz wolne pole.');
  return n;
}
const devPanel = createDevPanel(document.body, {
  onPlace: (sp) => { devSpawn = sp; canvas.classList.toggle('placing', !!sp); },
  onFoeAtTower: () => {
    const W = game.map.width;
    const towers = game.buildings.filter((b) => b.owner === ME && isTower(BUILDINGS[b.type]!.id));
    const manned = towers.find((t) => game.soldiers.some((s) => s.post === t.id && s.up)) ?? towers[0];
    if (!manned) { devPanel.placed('Nie masz wieży strażniczej.'); return; }
    for (const [dx, dy] of [[6, 0], [-6, 0], [0, 6], [0, -6], [5, 5], [-5, -5]] as const) {
      const tx = manned.x + 1 + dx, ty = manned.y + 1 + dy;
      if (walkable(game, ty * W + tx, devFoe()) && devPlace(tx, ty, 'spearman', true, 3)) { renderer.lookAt(manned.x + 1 + dx / 2, manned.y + 1 + dy / 2, 16); return; }
    }
  },
  onSkip: (to) => {
    // szybko do przodu, aż wybije zmierzch (20:30) albo ranek (7:00); najwyżej jedna doba
    for (let i = 0; i < 7200; i++) {
      const h = clockAt(game.tick).hour;
      if (to === 'night' ? h >= 20.5 || h < 4 : h >= 7 && h < 12) break;
      step(game, []);
    }
    refresh();
    devPanel.placed(`Jest ${Math.floor(clockAt(game.tick).hour)}:${String(Math.floor((clockAt(game.tick).hour % 1) * 60)).padStart(2, '0')}.`);
  },
  onSeason: (s: Season) => {
    game.seasonShift = shiftToSeason(game.tick, s);
    refresh();
    const w = weatherOf(game, rainAt(game.tick));
    return `${SEASON_NAME[w.season]}: teraz ${w.temp.toFixed(1).replace('.', ',')}°C${w.temp < COLD ? ' — w chatach palą w piecach (drewno na opał)' : ''}.`;
  },
  onFire: () => {
    // płonie mój gotowy budynek najbliżej studni albo cechu inżynierów (żeby było widać gaszenie)
    const wellT = BUILDINGS.findIndex((d) => d.id === 'well'), engT = BUILDINGS.findIndex((d) => d.id === 'engineers');
    const water = game.buildings.filter((b) => b.owner === ME && (b.type === wellT || b.type === engT) && !b.build);
    const keep = game.buildings.find((b) => b.owner === ME && b.type === 0);
    const ref = water.length ? water : keep ? [keep] : [];
    let best: (typeof game.buildings)[number] | undefined, bd = Infinity;
    for (const b of game.buildings) {
      if (b.owner !== ME || b.type === 0 || b.type === wellT || b.build || b.fire) continue;
      for (const r of ref) { const d = Math.hypot(b.x - r.x, b.y - r.y); if (d < bd) { bd = d; best = b; } }
    }
    if (!best) { devPanel.placed('Nie masz budynku, który mógłby się zapalić.'); return; }
    best.hp = Math.min(best.hp, Math.floor(maxHp(best.type) * 0.5)); best.hpWas = best.hp; best.fire = 600;
    renderer.lookAt(best.x + BUILDINGS[best.type]!.w / 2, best.y + BUILDINGS[best.type]!.h / 2, 18);
    devPanel.placed(water.length ? 'Pali się budynek przy studni — chłopi powinni zaraz przybiec z wiadrami.' : 'Pali się budynek, ale nie masz studni ani cechu inżynierów — postaw studnię obok.');
  },
  onHeal: () => { for (const s of game.soldiers) if (s.owner === ME) s.hp = UNITS[s.kind]!.hp; },
  onGive: () => { const p = game.players[ME]!; for (let i = 0; i < p.res.length; i++) p.res[i]! += 1000; refresh(); },
  onCamera: (which) => {
    const owner = which === 'mine' ? ME : devFoe();
    const k = game.buildings.find((b) => b.owner === owner && b.type === 0);
    if (k) renderer.lookAt(k.x + 1.5, k.y + 1.5, 26);
  },
  onKillFoes: () => { const me = game.players[ME]!; game.soldiers = game.soldiers.filter((s) => game.players[s.owner]!.team === me.team); game.wolves = []; },
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'F9' && devAllowed()) { e.preventDefault(); devPanel.toggle(); return; }
  if (e.key === 'Escape' && rallyPick) { e.preventDefault(); e.stopImmediatePropagation(); rallyPick = null; canvas.classList.remove('placing'); return; }
  if (e.key === 'Escape' && devPanel.isPlacing()) { e.preventDefault(); e.stopImmediatePropagation(); devPanel.stop(); }
}, true);
// przycisk na dolnej belce (obok Menu), widoczny tylko gdy panel jest dostępny
const devBtn = document.createElement('button');
devBtn.type = 'button';
devBtn.className = 'dev-open';
devBtn.textContent = 'Deweloper';
devBtn.title = 'Panel dewelopera (F9)';
devBtn.addEventListener('click', () => devPanel.toggle());
document.body.append(devBtn);
setInterval(() => { devBtn.hidden = !devAllowed() || document.body.classList.contains('menu-open'); }, 500);
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
    'wywołania rysowania': r.calls, 'trójkąty': r.triangles, 'poza kadrem': renderer.culled, 'geometrie': r.geometries, 'tekstury': r.textures,
    mapa: `${game.map.width}×${game.map.height}`, budynki: game.buildings.length, chłopi: game.units.length, żołnierze: game.soldiers.length, wilki: game.wolves.length, ciała: game.corpses.length,
    'pamięć MB': mem ? Math.round(mem.usedJSHeapSize / 1048576) : '—',
  };
  for (const [k, v] of Object.entries(renderer.readTiming())) perf.last[`  ${k} ms`] = v;
  perf.last['jakość'] = renderer.quality;
  perf.last['rozdzielczość'] = renderer.resolution;
  perf.last['wątek symulacji'] = simMode ? 'tak' : 'nie';
  perf.last['budynki z daleka'] = renderer.lodInfo;
  // karta graficzna przejście po przejściu (tylko przy otwartym oknie; mierzona co 15. klatka)
  const gpu = renderer.readGpu();
  if (Object.keys(gpu).length) { perf.last['KARTA: co ile liczy'] = ''; Object.assign(perf.last, gpu); }
  if (!perfBox.hidden) {
    perf.last['NAJWIĘCEJ TRÓJKĄTÓW'] = 'w kadrze + w cieniu';
    const k = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(2)} mln` : `${Math.round(n / 1000)} tys.`);
    for (const h of renderer.heavy(10)) perf.last[`  ${h.cat}`] = `${k(h.tris)} + ${k(h.shadow)} · ${h.meshes} siatek`;
  }
  fpsTag.textContent = `FPS ${perf.last.fps}`;
  fpsTag.dataset.low = String(Number(perf.last.fps) < 40);
  if (!perfBox.hidden) {
    const rows = Object.entries(perf.last).map(([k, v]) => `${k.padEnd(22)} ${v}`);
    const cut = Object.keys(perf.last).indexOf('budynki z daleka');
    perfMain.textContent = rows.slice(0, cut < 0 ? rows.length : cut).join('\n');
    perfGpu.textContent = cut < 0 ? '' : rows.slice(cut).join('\n');
  }
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
walkHint.textContent = 'W A S D — idź · mysz — rozglądaj się · Shift — biegnij · Spacja — skok · F — pochodnia · Esc — wróć do widoku z góry (kliknij, jeśli kursor się zwolnił)';
document.body.append(walkHint);
renderer.onWalkEnd = () => { document.body.classList.remove('walking'); walkHint.hidden = true; };
