import { loadInfo } from './ui/loadinfo';
import { loadingMarkup, setLoadingProgress } from './ui/loadscreen';
import { counts as errCounts, entries as errEntries, formatText as errText, onReport, setContext as errContext } from './debug/errlog';
import { BANDIT_SAY, GUARD_SAY, SAY } from './data/barks';
import { COLD, SEASON_DAYS, SEASON_NAME, shiftToSeason, weatherOf, yearPos, type Season } from './sim/weather';
import { winterReadiness } from './sim/systems/economy';
import { BUILDINGS, buildingIndex, footprint, isTower } from './data/buildings';
import { RULES } from './data/rules';
import { Terrain } from './data/terrain';
import { RESOURCE_DEFS, RESOURCES, resIndex, type ResourceId, type StoreKind } from './data/resources';
import { BANDITS, GUARD, MAGE_CAP, UNITS } from './data/units';
import { placeDen } from './sim/systems/bandits';
import { MAP_PRESETS, type MapPresetId } from './data/maps';
import { BYNAMES, FIRST_NAMES } from './data/names';
import { lang, t, tx } from './i18n';
import { GameRenderer, type TileRef } from './render/scene';
import { clockAt, rainAt } from './sim/clock';
import { seedFromText } from './sim/rng';
import { deserialize, serialize, type SaveData } from './sim/save';
import { enemyRoad } from './sim/systems/roadwreck';
import { applyCut, TICKS_PER_SECOND, createGame, housing, idleCount, idleSlots, playerKeep, population, stateHash, storeCapacity, storeUsed, type DevWalls, type GameState } from './sim/state';
import { createGameAsync } from './sim/mapthread';
import { SimBatch } from './sim/simbatch';
import { applyCommands, step, type Command } from './sim/step';
import { doleCost, rioters } from './sim/systems/unrest';
import { canQuarantine, magesOf, startPlague } from './sim/systems/plague';
import { droughtAt, stormAt } from './sim/systems/storms';
import { feastDay, preached } from './sim/systems/faith';
import { FOOD_PER_DAY, FOOD_VALUE, GRAIN_PER_DAY, MEALS_PER_DAY, foodTotal, monthlyForecast } from './sim/systems/economy';
/** Indeksy surowców, które są jedzeniem (jabłka, chleb, ryby) */
const FOOD_RES_ALL = RESOURCES.map((r, i) => (RESOURCE_DEFS[r].food ? i : -1)).filter((i) => i >= 0);
import { buildCost, canAfford, canPlace, doorTile, missingRequirement, maxHp, tileBuildable, ruin } from './sim/systems/placement';
import { canRelocate, canRelocateTo, movable, relocateCost, type MoveError } from './sim/systems/relocate';
import { createHud, tierNeedText, TIER_NAMES, type BuildingInfo, type HudView, type JumpKind, type RecruitUnit } from './ui/hud';
import { createScribe, type ScribeAction } from './ui/scribe';
import { storeLogistics } from './ui/storePanel';
import { storeNotes } from './ui/storeNotes';
import { createHpBars } from './ui/hpBars';
import { usedIn } from './sim/systems/stock';
import { nextWave } from './sim/systems/bot';
import { battleMages, garrisonRoom, octant, planFormation, towerOf, trainsAt } from './sim/systems/army';
import { campWatch, prodInfo, sampleMade, siteInfo, watchInfo } from './ui/buildingPanel';
import { EMPTY, SANDBOX, TEST } from './testmode';
import { census } from './debug/census';
import { createSimThread, type SimResult } from './sim/simthread';
import { addPeasants, addWolf, emptyScene, placeReady, removeReady, setHour } from './sim/emptyscene';
import { Lockstep, TURN } from './net/lockstep';
import { awardMatch, deleteRoom, matchBegin, me as netMe, onAccount, saveResult, setStatus } from './net/supa';
import { forgetMatch, recallMatch, rejoinMatch, rememberMatch, sendState, type MatchMemo } from './net/rejoin';
import { matchXp, MODE_MULT, xpParts, type MatchMode } from './data/progress';
import { xpReport } from './ui/xpReport';
import { createTutorial } from './ui/tutorial';
import type { OnlineStart } from './ui/online';
import { createGameChat } from './ui/chat';
import { createPings, PINGS } from './ui/pings';
import { createAllies } from './ui/allies';
import { createMinimap } from './ui/minimap';
import { createMenu, loadSettings, saveSettings, type Settings } from './ui/menu';
import { AutoQuality, TIERS, TOP_TIER } from './render/autoquality';
import { alarmBell, shrineBell, thunderClap, daySounds, music, musicEnd, getVolume, isMuted, caveSounds, nature, play, setGamePaused, pluck, talk, warHorn, setBusVolume, setVolume, toggleMute, unlockAudio, audioStats, listenerPos, play3d, type WorldSound } from './audio/sfx';
import { proceduralModels } from './render/models';
import { renderThumbnails, renderUnitPortraits } from './render/thumbnails';
import { WOLF_HP } from './sim/systems/wolves';
import { cachedThumbs, saveThumbs } from './render/thumbcache';
import { texturesReady } from './render/textures';
import { TEAM_COLORS } from './data/teams';
import { createDevPanel, type DevSpawn } from './ui/devpanel';
import { walkable } from './sim/path';
import { FP } from './sim/state';
import { unitIndex } from './data/units';
import { randomTip } from './data/tips';
import { glFallback } from './render/glcontext';

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
let netNotes = { desync: false, left: 0, back: 0 };
/** Prośby o powrót do meczu, na które już wydaliśmy polecenie `rejoin` (miejsce → kiedy), żeby nie powtarzać ich co 3 s */
const rejoinAsked = new Map<number, number>();
const netWait = document.createElement('div');
netWait.className = 'net-wait';
netWait.textContent = tx('Czekam na przeciwnika…', 'Waiting for your opponent…');
netWait.hidden = true;
document.body.append(netWait);
const chat = createGameChat(document.body, () => play('click'));
let picked: string | null = null;
let hoverTile: TileRef | null = null;
let touchTile: TileRef | null = null;
let selected = 0;
/** Obrót stawianego budynku: 0..3, co 90° */
let placeRot = 0;
/** Przenosiny (relocate.ts): id przenoszonego budynku; podgląd działki jak przy stawianiu, klik wysyła rozkaz przenosin */
let moveId = 0;
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
  onArmyPatrol: () => setPatrolPick(!patrolPick),
  onArmyUnit: (id, shift) => { if (shift) chooseSoldiers([id], false); else unchoose(id); play('select'); },
  onGroup: (n, action) => groupAction(n, action),
  onJump: (kind) => jumpTo(kind),
  onNewGame: (seedText, preset) => start(seedText || 'project-1', preset),
  // losowanie nazwy mapy to interfejs, nie symulacja, więc Math.random jest tu w porządku
  onRandom: (preset) => start(`${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 900 + 100)}`, preset),
  onPickBuilding: (id) => {
    // drzewko budowy: zablokowanej karty nie da się wybrać, gracz od razu słyszy, czego brakuje
    const lock = id ? missingRequirement(game, ME, BUILDINGS[buildingIndex(id)]!) : null;
    if (lock) { hud.toast(placeErrorText('place.needs', buildingIndex(id!))); play('error'); return; }
    if (wrecking) setWreck(false); pick(id);
  },
  onRations: (level) => pending.push({ type: 'setRations', player: ME, level }),
  onDole: () => { pending.push({ type: 'dole', player: ME }); play('click'); },
  onQuell: () => { pending.push({ type: 'quell', player: ME }); play('click'); },
  onTax: (level) => pending.push({ type: 'setTax', player: ME, level }),
  onSpeed: (s) => {
    // z drugim prawdziwym graczem nie ma pauzy ani przyspieszania: czas płynie tak samo u obu
    if (net) { hud.toast(tx('W grze z drugim graczem nie można pauzować ani zmieniać tempa.', 'In a game against another player you cannot pause or change the pace.')); return false; }
    speed = s;
    return true;
  },
  onDemolish: (id) => confirmDemolish(id),
  onRelocate: (id) => startMove(id),
  onCloseInfo: () => { selectUnit(0); select(0); if (chosen.size) chooseSoldiers([], false); },
  onRotate: () => rotate(),
  onWreck: () => setWreck(!wrecking),
  onVolume: (v) => setVolume(v),
  onMute: () => hud.setMuted(toggleMute()),
  onMenu: () => menu.open(!gameOver),
  onAccount: () => menu.account(true),
  onWalk: () => walkAs(selectedUnit),
  onRandomWalk: () => {
    // oko: najpierw wybór miejsca na mapie (klik = start spaceru tam); drugie kliknięcie oka = losowy mieszkaniec
    if (!walkPick) { setWalkPick(true); return; }
    setWalkPick(false);
    // najchętniej ktoś, kto akurat idzie (więcej widać), inaczej ktokolwiek z mojej osady
    const mine = game.units.filter((u) => u.owner === ME);
    const going = mine.filter((u) => u.path.length > 0);
    const pool = going.length ? going : mine;
    const u = pool[Math.floor(Math.random() * pool.length)];
    if (u) { selectUnit(u.id); walkAs(u.id); }
  },
  onEnterMine: (id) => {
    // spacer w sztolni kopalni: ta sama klasa „walking” i podpowiedź co przy zwykłym spacerze
    if (!renderer.walking) { document.body.classList.add('walking'); walkHint.hidden = false; }
    renderer.enterMine(id);
    select(0);
  },
  onArea: (id) => {
    if (!shownAreas.delete(id)) shownAreas.add(id);
    renderer.setAreas(shownAreas);
    const b = game.buildings.find((x) => x.id === id);
    if (b) hud.showInfo(buildingInfo(b));
    play('select');
  },
  onDismount: (id) => { pending.push({ type: 'dismount', player: ME, tower: id }); play('rotate'); },
  onSelectGarrison: (id) => { chooseSoldiers(game.soldiers.filter((s) => s.owner === ME && towerOf(game, s) === id).map((s) => s.id), false); play('select'); },
  onGate: (id, open) => { pending.push({ type: 'gate', player: ME, id, open }); play('click'); },
  onPower: (id, on) => { pending.push({ type: 'power', player: ME, id, on }); play('click'); },
  onQuarantine: (id, on) => { pending.push({ type: 'quarantine', player: ME, id, on }); play('click'); },
  onRally: (id, unit, clear) => {
    const kind = unit ? unitIndex(unit) : -1;
    if (clear) { pending.push({ type: 'rally', player: ME, building: id, kind, tile: -1 }); hud.toast(tx('Flaga zdjęta: nowi staną przed koszarami.', 'Banner taken down: new recruits will muster before the barracks.')); return; }
    rallyPick = { building: id, kind };
    canvas.classList.add('placing');
    hud.toast(unit ? tx('Wskaż na mapie, gdzie mają iść nowi tego rodzaju (Esc anuluje).', 'Point on the map where new recruits of this kind should go (Esc cancels).') : tx('Wskaż na mapie punkt zbiórki dla wszystkich nowych (Esc anuluje).', 'Point on the map to set a rally point for all new recruits (Esc cancels).'));
  },
  onTrain: (id, n, unit = 'spearman') => { const hall = game.buildings.find((x) => x.id === id)?.type; const k = Math.min(n, recruitInfo(hall).find((u) => u.id === unit)?.max ?? 0); for (let i = 0; i < k; i++) pending.push({ type: 'train', player: ME, building: id, unit }); if (k) play('build'); },
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
/** Ustawienia, z którymi policzono `preview` — „Graj” z tymi samymi bierze gotową mapę zamiast liczyć ją drugi raz */
let previewKey = '';
const previewKeyOf = (seedText: string, preset: MapPresetId, level: number, dev: boolean, walls: DevWalls | undefined): string => JSON.stringify([seedText, preset, level, dev, walls ?? 'mix']);
/** Zasłona na czas generowania mapy w podglądzie nowej gry (za panelem menu) */
let previewJob = 0;
const previewCover = document.createElement('div');
previewCover.className = 'preview-cover';
previewCover.hidden = true;
previewCover.setAttribute('role', 'status');
previewCover.innerHTML = '<div class="preview-cover-box"><span class="preview-spin" aria-hidden="true"></span><p>' + tx('Generuję mapę…', 'Generating the map…') + '</p></div>';
document.body.append(previewCover);
const menu = createMenu(document.body, {
  onTutorialReset: () => tutorial.reset(),
  // z ekranu tytułowego (zapis wczytany przy starcie) wchodzimy przez ekran wczytywania, a powrót z pauzy jest od razu
  onContinue: () => {
    if (!titleScreen) { menu.close(); if (!net) setStatus({ where: 'solo' }); return; }
    enterGame(tx('Wczytywanie zapisu…', 'Loading the saved game…'), () => { if (!net) setStatus({ where: 'solo' }); });
  },
  // podgląd nowej mapy: generujemy ją obok bieżącej gry i pokazujemy z lotu ptaka; bieżąca gra czeka nietknięta
  onPreviewMap: (seedText, preset, level, dev, walls) => {
    // najpierw ciemna zasłona z kręciołkiem za menu (lewy panel zostaje),
    // potem mapa, a zasłona schodzi dopiero, gdy pierwsze klatki nowej mapy są narysowane i kamera rusza
    const job = ++previewJob;
    previewCover.hidden = false;
    previewCover.classList.remove('gone');
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      if (job !== previewJob) return; // w międzyczasie wylosowano kolejną mapę
      // sama mapa liczy się w osobnym wątku (sim/mapthread.ts): kręciołek się kręci, menu nie staje
      const next = await createGameAsync(seedFromText(seedText), preset, level, dev, walls ?? 'mix');
      if (job !== previewJob) return; // w międzyczasie wylosowano kolejną mapę albo zamknięto podgląd
      preview = next;
      previewKey = previewKeyOf(seedText, preset, level, dev, walls);
      // teren etapami, z przerwą na klatkę między nimi: kręciołek się kręci, strona nie staje
      const built = await renderer.setStateAsync(preview, MAP_PRESETS[preset].waterLevel, MAP_PRESETS[preset].rim, 0, pauseFrame);
      if (!built || job !== previewJob) return;
      renderer.startPreview();
      let frames = 0, done = false;
      const reveal = (): void => {
        if (done || job !== previewJob) return;
        done = true;
        previewCover.classList.add('gone');
        setTimeout(() => { if (job === previewJob) previewCover.hidden = true; }, 450);
      };
      const wait = (): void => { if (++frames < 4) requestAnimationFrame(wait); else reveal(); };
      // shadery nowej mapy kompilują się w tle; zasłona schodzi po kilku klatkach od ich gotowości
      void renderer.warmup().then(() => renderer.prepareView()).catch((e) => console.error(e)).then(() => { if (job === previewJob) requestAnimationFrame(wait); });
      setTimeout(reveal, 2500); // bardzo wolna karta: zasłona i tak schodzi po chwili
    }));
  },
  onPreviewEnd: () => {
    previewJob++; previewCover.hidden = true;
    if (!preview) return;
    preview = null;
    renderer.endPreview();
    // powrót do bieżącej gry: teren etapami, bez zatrzymania strony
    void renderer.setStateAsync(game, MAP_PRESETS[currentPreset].waterLevel, MAP_PRESETS[currentPreset].rim, ME, pauseFrame).catch((e) => console.error(e));
  },
  onNewGame: (seedText, preset, level, dev, instant, walls) => {
    previewJob++; previewCover.hidden = true;
    // mapa z podglądu jest jeszcze nieruszona (tick 0, symulacja w podglądzie nie rusza): przy tych samych ustawieniach bierzemy ją
    const ready = preview && instant && preview.tick === 0 && previewKey === previewKeyOf(seedText, preset, level, dev, walls) ? preview : undefined;
    preview = null;
    renderer.endPreview();
    // nowa mapa buduje się za ekranem wczytywania, a nie w zawieszonym menu
    enterGame(t('load.map'), () => {
      start(seedText, preset, undefined, level, dev, undefined, instant, walls, ready);
      setStatus({ where: 'solo' });
    });
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
    enterGame(t('load.map'), () => startOnline(st));
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
  const who = slot?.kind === 'human' ? { id: slot.id, nick: slot.nick, avatar: slot.avatar } : { id: `p${from}`, nick: from === ME ? tx('Ty', 'You') : tx(`Gracz ${from + 1}`, `Player ${from + 1}`), avatar: 0 };
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
  if (p === ME) return tx('Ty', 'You');
  const slot = netGame?.slots[p];
  if (slot?.kind === 'human') return slot.nick;
  return game.players[p]?.bot ? `Bot ${p + 1}` : tx(`Gracz ${p + 1}`, `Player ${p + 1}`);
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
  renderer.cartIcons = allies.isOpen() ? ME : -1; // przy otwartym oknie sojuszników nad własnymi wozami znacznik
  const log = game.caravanLog ?? [];
  if (caravanSeen < 0) { caravanSeen = log.at(-1)?.id ?? 0; return; }
  for (const n of log) {
    if (n.id <= caravanSeen) continue;
    caravanSeen = n.id;
    // „kamień: 60” zamiast „60 × kamień” — bez odmiany przez przypadki, czytelne w obu językach
    const what = `${t(RESOURCE_DEFS[RESOURCES[n.res]!].name).toLowerCase()}: ${n.amount}`;
    if (n.captured) {
      if (n.owner === ME && n.by === BANDITS) hud.toast(tx(`Zbóje z lasu złupili Twój wóz (${what}). Łup leży w ich obozie.`, `Brigands from the wood have plundered your cart (${what}). The haul lies in their camp.`));
      else if (n.owner === ME && n.to === ME) hud.toast(tx(`Wróg przechwycił wóz z urobkiem Twojej kopalni (${what}).`, `The enemy seized a haul cart from your mine (${what}).`));
      else if (n.owner === ME) hud.toast(tx(`Wróg przechwycił Twój wóz dla: ${playerName(n.to)} (${what}).`, `The enemy seized your cart bound for ${playerName(n.to)} (${what}).`));
      else if (n.by === ME) hud.toast(tx(`Twoi żołnierze przechwycili wóz wroga: +${what}.`, `Your soldiers seized an enemy cart: +${what}.`));
      else if (n.to === ME) hud.toast(tx(`Wróg przechwycił wóz, który jechał do Ciebie od: ${playerName(n.owner)}.`, `The enemy seized a cart sent to you by ${playerName(n.owner)}.`));
    } else if (n.to === n.owner) continue; // wóz z urobkiem kopalni do własnego zamku — zwykła dostawa, bez komunikatu
    else if (n.by === ME && n.owner !== ME) { hud.toast(tx(`${playerName(n.owner)} przysłał Ci wóz: +${what}.`, `${playerName(n.owner)} sent you a cart: +${what}.`)); play('select'); }
    else if (n.owner === ME && n.by !== ME) hud.toast(tx(`Wóz dotarł do: ${playerName(n.to)} (${what}).`, `Your cart reached ${playerName(n.to)} (${what}).`));
    else if (n.owner === ME) hud.toast(tx(`Wóz nie dojechał do: ${playerName(n.to)} — ten gracz przegrał albo wyszedł z gry, więc nie miał kto go odebrać. Ładunek wrócił do Twoich zapasów (${what}).`, `Your cart never reached ${playerName(n.to)} — they were defeated or left the game, so no one was there to take it. The load is back in your stores (${what}).`));
  }
}

/** Mecz 1 na 1 przez sieć: obie przeglądarki stawiają tę samą mapę z tego samego ziarna, bez botów na miejscach graczy. */
function startOnline(st: OnlineStart, loaded?: GameState): void {
  start(st.seed, st.preset, loaded, st.level, false, st);
  // przeglądarka pamięta mecz: po odświeżeniu strony albo zerwanym połączeniu da się do niego wrócić
  rememberMatch({ room: st.room, seed: st.seed, preset: st.preset, level: st.level, slots: st.slots, me: st.me, humans: st.humans, coop: st.coop });
  rejoinAsked.clear();
  // ranking: od startu wpis „w toku” — kto ucieknie z meczu i nie wróci, zostaje z porażką (kooperacja się nie liczy)
  if (!st.coop) void matchBegin(st.room.id, st.preset);
  // ktoś wraca do meczu: odpowiada gracz o najniższym numerze, który jest w grze — wydaje polecenie powrotu,
  // a po jego wykonaniu (w pętli gry) przesyła wracającemu stan gry
  const offRejoin = st.link.on((m) => {
    if (m.k !== 'rejoin' || !net || !netGame || net.leader() !== ME || !Number.isInteger(m.slot)) return;
    const seat = netGame.slots[m.slot];
    if (seat?.kind !== 'human' || seat.id !== m.id || m.slot === ME) return;
    const now = performance.now();
    if ((rejoinAsked.get(m.slot) ?? -1e9) > now - 10_000) return;
    if (!net.canTakeBack(m.slot, Math.floor(game.tick / TURN))) return;
    rejoinAsked.set(m.slot, now);
    pending.push({ type: 'rejoin', player: ME, who: m.slot });
  });
  const mine = st.slots[st.me];
  if (mine?.kind === 'human') chat.attach(st.link, { id: mine.id, nick: mine.nick, avatar: mine.avatar });
  // znaczniki sojuszników (tylko z mojej drużyny; obcy ich nie widzą — ale też nie powinni ich wysyłać)
  const offPing = st.link.on((m) => {
    if (m.k !== 'ping' || !netGame || m.from === ME || !Number.isInteger(m.from) || !Number.isInteger(m.kind)) return;
    const a = game.players[m.from], b = game.players[ME];
    if (a && b && a.team === b.team) showPing(m.from, m.kind, m.x, m.y);
  });
  pingOff = () => { offPing(); offRejoin(); };
  const names = st.slots.map((x) => (x.kind === 'human' ? x.nick : null)).filter(Boolean);
  hud.toast(tx(`Mecz przez sieć (${st.preset}): `, `Online match (${st.preset}): `) + `${names.join(', ')}${st.slots.some((x) => x.kind === 'bot') ? tx(' + boty', ' + bots') : ''}.`);
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
  const nick = (p: number): string => { const x = netGame!.slots[p]; return x?.kind === 'human' ? x.nick : tx(`gracz ${p + 1}`, `player ${p + 1}`); };
  const absent = missing.filter((p) => { const x = netGame!.slots[p]; return x?.kind === 'human' && !here.has(x.id); });
  for (const p of missing) if ((absent.includes(p) && waited > DROP_ABSENT_MS) || waited > DROP_SILENT_MS) net.drop(p);
  netWait.hidden = waited < 400;
  if (!netWait.hidden) {
    const left = Math.ceil(((absent.length ? DROP_ABSENT_MS : DROP_SILENT_MS) - waited) / 1000);
    netWait.textContent = `${tx('Czekam na', 'Waiting for')}: ${missing.map(nick).join(', ') || tx('graczy', 'players')}${waited > 3000 ? ` — ${absent.length ? tx('brak połączenia', 'connection lost') : tx('słabe połączenie', 'poor connection')}, ${tx('jeszcze', 'another')} ${Math.max(0, left)} s` : '…'}`;
  }
}
/** Trwa powrót do meczu (prośba o miejsce, pobieranie stanu gry) */
let returning = false;
/**
 * Powrót do meczu przez sieć: prośba o miejsce, pobranie stanu gry od grających i wejście do gry za ekranem wczytywania.
 * Napis na środku ekranu mówi, na co czekamy; gdy się nie uda, wracamy do menu z wyjaśnieniem.
 */
async function backToMatch(memo: MatchMemo): Promise<void> {
  if (returning) return;
  returning = true;
  document.querySelector('.net-return')?.remove();
  speed = 0;
  netWait.hidden = false;
  // mecz bez innych ludzi: stan z tej przeglądarki — po zerwanym połączeniu gra jest jeszcze w pamięci karty,
  // a po odświeżeniu w zapisie (przy zamknięciu karty `endOnline` odpina sieć przed `pagehide`, więc `save()` zapisuje mecz)
  let localUi: UiSave | undefined;
  const local = (): GameState | null => {
    if (!titleScreen && currentSeedText === memo.seed && currentPreset === memo.preset && game.tick > 0) return deserialize(serialize(game, currentPreset));
    const s = loadSave();
    if (!s || s.seedText !== memo.seed || s.data.preset !== memo.preset) return null;
    localUi = s.ui;
    return deserialize(s.data);
  };
  const r = await rejoinMatch(memo, (text) => { netWait.textContent = text; }, local);
  netWait.hidden = true;
  returning = false;
  if (typeof r === 'string') {
    hud.toast(r);
    menu.open(false);
    return;
  }
  const { memo: m, link, net: ls, game: loaded } = r;
  const st: OnlineStart = { room: m.room, seed: m.seed, preset: m.preset, level: m.level, slots: m.slots, me: m.me, humans: m.humans, coop: m.coop, link, net: ls };
  menu.close();
  previewJob++; previewCover.hidden = true; preview = null; renderer.endPreview();
  enterGame(t('load.map'), () => {
    startOnline(st, loaded);
    if (r.solo) { applyUi(localUi); hud.toast(tx('Wróciłeś do meczu.', 'You are back in the match.')); }
    else hud.toast(tx('Wróciłeś do meczu — bot oddał Ci zamek.', 'You are back in the match — the bot handed back your keep.'));
  });
}
/** Po uruchomieniu gry: trwa mecz przez sieć, z którego wyszliśmy (odświeżenie, zamknięta karta) — okienko z powrotem */
function offerReturn(memo: MatchMemo): void {
  document.querySelector('.net-return')?.remove();
  const box = document.createElement('div');
  box.className = 'invite-toast panel net-return';
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-label', tx('Trwa Twój mecz przez sieć', 'Your online match is still on'));
  const txt = document.createElement('div');
  txt.className = 'invite-text';
  const head = document.createElement('strong');
  head.textContent = tx('Twój mecz przez sieć trwa', 'Your online match is still on');
  txt.append(head, document.createElement('br'), tx(`${memo.room.name || memo.preset} — zamkiem rządzi teraz bot. Wróć, a odda Ci go.`, `${memo.room.name || memo.preset} — a bot holds your keep for now. Return and it will hand it back.`));
  const acts = document.createElement('div');
  acts.className = 'invite-acts';
  const yes = document.createElement('button');
  yes.type = 'button'; yes.className = 'menu-btn'; yes.textContent = tx('Wróć do meczu', 'Return to match');
  yes.addEventListener('click', () => { play('click'); box.remove(); void backToMatch(memo); });
  const no = document.createElement('button');
  no.type = 'button'; no.className = 'link-btn'; no.textContent = tx('Porzuć mecz', 'Abandon match');
  no.addEventListener('click', () => { play('click'); box.remove(); forgetMatch(); });
  acts.append(yes, no);
  box.append(txt, acts);
  document.body.append(box);
  yes.focus();
}
let pingOff: (() => void) | null = null;
/** Koniec meczu przez sieć. `give` = koniec gry albo poddanie; bez niego (zamknięta karta) zamkiem rządzi bot, a pokój i pamięć meczu zostają, żeby dało się wrócić */
function endOnline(give = true): void {
  if (!net || !netGame) return;
  net.close(give);
  chat.detach();
  pingOff?.(); pingOff = null;
  pings.clear();
  netGame.link.close();
  // koniec meczu: gospodarz usuwa pokój z bazy (nic po meczu nie zostaje)
  if (give) { forgetMatch(); if (netMe()?.id === netGame.room.host) void deleteRoom(netGame.room.id); }
  net = null; netGame = null; netWait.hidden = true;
  setStatus({ where: 'menu' });
}
window.addEventListener('beforeunload', () => endOnline(false));
/** Ekran wczytywania nowej mapy: ten sam układ co przy starcie gry (ui/loadscreen.ts) */
let titleScreen = true;
/** Trwa wejście do gry za ekranem wczytywania: pętla rysuje świat pod zasłoną, ale symulacja i automat jakości stoją */
let entering = false;
/**
 * Wejście do gry (Kontynuuj, nowa gra, mecz przez sieć) za ekranem wczytywania z paskiem. Kolejno: przygotowanie świata
 * (`prep`), kompilacja shaderów, wgranie tekstur do karty, a potem kilkanaście klatek rysowanych pod zasłoną z widoku
 * gracza (cienie, trawa, drzewa, ludzie). Zasłona schodzi dopiero, gdy klatki są równe — w grze nic już nie przycina.
 */
/** Przerwa na jedną klatkę (z zapasowym zegarem, gdy karta jest w tle i klatki stoją) */
const pauseFrame = (): Promise<void> => new Promise((ok) => { requestAnimationFrame(() => setTimeout(ok, 0)); setTimeout(ok, 60); });

function enterGame(label: string, prep?: () => void): void {
  if (entering) return;
  entering = true;
  document.getElementById('loading')?.remove();
  const cover = document.createElement('div');
  cover.id = 'loading';
  cover.setAttribute('role', 'status');
  cover.innerHTML = loadingMarkup(label, randomTip());
  document.body.append(cover);
  const text = cover.querySelector('.loading-line span') as HTMLElement;
  const info = loadInfo(cover.querySelector('.loading-card'));
  const show = (p: number, what?: string): void => {
    setLoadingProgress(cover, p);
    if (what) text.textContent = what;
  };
  show(4);
  info.step(label.replace(/…$/, ''), prep ? tx('teren, rzeki, lasy, osady i boty — licznik może na chwilę stanąć', 'terrain, rivers, forests, settlements and bots — the timer may pause for a moment') : '');
  // każdy krok w osobnej klatce, żeby pasek zdążył się odświeżyć
  const next = (fn: () => void): void => { requestAnimationFrame(() => setTimeout(fn, 0)); };
  const finish = (): void => {
    info.done();
    show(100, tx('Gotowe', 'Ready'));
    titleScreen = false;
    autoQ.reset();
    last = performance.now();
    entering = false;
    cover.classList.add('done');
    setTimeout(() => cover.remove(), 500);
  };
  next(() => {
    // od zbudowania mapy do końca rozgrzewki nic nie rysujemy: shadery nowej mapy skompiluje w tle warmup(),
    // a nie pierwsza klatka (ta blokowała stronę na 1–3 s)
    renderer.hold(true);
    try { prep?.(); } catch (e) { console.error(e); }
    previewJob++; previewCover.hidden = true; preview = null;
    renderer.endPreview();
    menu.close();
    renderer.endOrbit(); // od razu widok gracza: to jego rozgrzewamy
    show(25, tx('Przygotowanie grafiki…', 'Preparing the graphics…'));
    info.step(tx('Shadery', 'Shaders'), tx('kompilacja grafiki mapy w tle (teren, woda, las, trawa, budynki)', 'compiling the map graphics in the background (terrain, water, forest, grass, buildings)'));
    next(async () => {
      try { await renderer.warmup(); } catch (e) { console.error(e); } finally { renderer.hold(false); }
      show(45, tx('Wczytywanie tekstur…', 'Loading the textures…'));
      info.step(tx('Tekstury w karcie', 'Textures on the GPU'), tx('wysyłanie tekstur do karty graficznej', 'sending textures to the graphics card'));
      next(() => {
        const nTex = renderer.uploadTextures();
        show(55, tx('Rozgrzewanie świata…', 'Warming up the world…'));
        info.step(tx('Panel', 'Panel'), tx(`wgrano ${nTex} tekstur · rysowanie panelu i minimapy`, `${nTex} textures uploaded · drawing the panel and minimap`));
        try { refresh(); updateBars(); } catch (e) { console.error(e); } // pierwszy, najcięższy obraz panelu też pod zasłoną
        // 1) obchód kamerą: osiem kierunków z bliska i dwa z daleka, po kilka klatek — wszystko dookoła (drzewa, trawa,
        //    budynki, dalekie wersje modeli, cienie) wgrywa się do karty teraz, a nie przy pierwszym obrocie w grze
        const home = renderer.camView;
        const shots: { yaw: number; dist: number }[] = [];
        for (let k = 0; k < 8; k++) shots.push({ yaw: home.yaw + (k * Math.PI) / 4, dist: home.dist });
        shots.push({ yaw: home.yaw, dist: home.dist * 2.2 }, { yaw: home.yaw + Math.PI, dist: home.dist * 2.2 });
        const PER = 4;
        let shot = 0, inShot = 0;
        info.step(tx('Obchód kamerą', 'Camera sweep'));
        let prepared = -1;
        const sweep = (): void => {
          if (shot < shots.length) {
            if (inShot === 0 && prepared !== shot) {
              info.detail(shot < 8 ? tx(`kierunek ${shot + 1} z 8 — drzewa, trawa, budynki i cienie dookoła`, `direction ${shot + 1} of 8 — trees, grass, buildings and shadows all around`) : tx(`widok z daleka ${shot - 7} z 2 — dalekie wersje modeli`, `distant view ${shot - 7} of 2 — far versions of models`));
              renderer.setCamView({ x: home.x, z: home.z, dist: shots[shot]!.dist, yaw: shots[shot]!.yaw });
              // najpierw to, co widać z tego miejsca, powstaje i kompiluje się w tle, dopiero potem rysujemy
              prepared = shot;
              void renderer.prepareView().catch((e) => console.error(e)).then(() => requestAnimationFrame(sweep));
              return;
            }
            show(55 + (25 * (shot * PER + inShot)) / (shots.length * PER), undefined);
            if (++inShot >= PER) { inShot = 0; shot++; }
            requestAnimationFrame(sweep);
            return;
          }
          renderer.setCamView(home);
          settle();
        };
        // 2) uspokojenie: zasłona schodzi dopiero po 30 równych klatkach z rzędu (bez skoków ponad typową klatkę tego komputera)
        const settle = (): void => {
          show(80, tx('Ostatnie przygotowania…', 'Final preparations…'));
          info.step(tx('Równe klatki', 'Steady frames'));
          const t0 = performance.now();
          let prev = t0, frames = 0, calm = 0;
          const recent: number[] = [];
          const watch = (now: number): void => {
            const dt = now - prev; prev = now; frames++;
            recent.push(dt); if (recent.length > 40) recent.shift();
            const typical = [...recent].sort((x, y) => x - y)[Math.floor(recent.length * 0.3)] ?? dt;
            calm = dt < Math.max(20, typical * 1.5) ? calm + 1 : 0;
            show(80 + Math.min(19, calm * 0.63), undefined);
            info.detail(tx(`równe klatki z rzędu: ${calm} / 30 · ostatnia ${Math.round(dt)} ms, typowa ${Math.round(typical)} ms`, `steady frames in a row: ${calm} / 30 · last ${Math.round(dt)} ms, typical ${Math.round(typical)} ms`));
            // najdłużej 12 s: bardzo słaby komputer i tak wejdzie do gry
            if ((frames >= 30 && calm >= 30) || now - t0 > 12000) finish();
            else requestAnimationFrame(watch);
          };
          requestAnimationFrame(watch);
        };
        requestAnimationFrame(sweep);
      });
    });
  });
}
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
  if (st.auto) { const q = TIERS[autoQ.tier]!; renderer.setGraphics({ ...st, ...q, label: `${tx('automat', 'auto')} ${autoQ.tier + 1}/${TIERS.length}` }); }
  else renderer.setGraphics({ ...st, grass: st.grass ?? 1 });
  setBusVolume('sfx', st.sfx);
  setBusVolume('ui', st.ui);
  setBusVolume('amb', st.amb);
  setBusVolume('music', st.music ?? 0.45);
}
applySettings(gfx);

/** Herby na chorągwiach: gracze z kontem — ich herb z „Mój ród” (mój zawsze aktualny z konta), boty i gracze bez herbu — stały herb z numeru */
function crestList(): (number | null)[] {
  const mine = netMe()?.avatar || null;
  return game.players.map((_, i) => {
    if (i === ME) return mine;
    const slot = netGame?.slots[i];
    return slot?.kind === 'human' ? slot.avatar || null : null;
  });
}
// konto wczytuje się chwilę po starcie gry, a herb można zmienić w trakcie: flagi na mapie idą za kontem od razu
onAccount(() => { if (game) renderer.setCrests(crestList()); });

/** Budowa pierwszego świata przy wczytywaniu strony (etapami); undefined = jeszcze nie ruszyła */
let bootWorld: Promise<boolean> | null | undefined;
let bootStages = 0;
let bootProgress: ((stage: number) => void) | null = null;
/**
 * Dla boot.ts: czeka, aż teren pierwszego świata się zbuduje (etapami, ok. 20 kroków). `onStage(n)` po każdym etapie.
 * Gdy budowa się nie uda, świat buduje się jeszcze raz od razu (jak dawniej), żeby gra na pewno wstała.
 */
export async function worldReady(onStage?: (stage: number) => void): Promise<void> {
  bootProgress = onStage ?? null;
  onStage?.(bootStages);
  try { if (bootWorld) await bootWorld; }
  catch (e) { console.error(e); renderer.setState(game, MAP_PRESETS[currentPreset].waterLevel, MAP_PRESETS[currentPreset].rim, ME); }
  finally { bootProgress = null; bootWorld = null; }
}
/** `fresh` = nowa, jeszcze nieruszona gra policzona wcześniej z tymi samymi ustawieniami (mapa z podglądu „Nowej gry”) */
function start(seedText: string, preset: MapPresetId, loaded?: GameState, level = 2, dev = false, online?: OnlineStart, instant = true, walls: DevWalls = URL_WALLS, fresh?: GameState): void {
  tierSeen = -1;
  endShown = false;
  gameOver = false;
  musicEnd(null);
  endOnline();
  ME = online ? online.me : 0;
  caravanSeen = -1; allies.close(); pings.clear();
  game = loaded ?? (!online && fresh ? fresh : createGame(seedFromText(seedText), preset, level, dev, online?.humans, instant, walls, online?.coop === true));
  if (EMPTY && !loaded && !online) emptyScene(game);
  // wątek symulacji: gra z botami, także w trybie dewelopera (akcje panelu dewelopera idą przez resyncSim);
  // bez testów (tam pomocniki __test zmieniają stan bez resyncSim) i bez meczu przez sieć (lockstep w wątku głównym)
  simGen++; simBusy = false;
  // w testach można wymusić wątek: ?test=1&watek=1 (bez pomocników __test, które zmieniają stan)
  const forceThread = SANDBOX && new URLSearchParams(location.search).has('watek');
  simMode = !!simThread && !simBroken && !online && (!SANDBOX || forceThread);
  if (simMode) simThread!.set(game, simGen);
  // nowa mapa: grupy i zaznaczenie z poprzedniej gry nie mają sensu (przy wczytaniu wracają z zapisu)
  if (!loaded) groups.clear();
  chosen.clear(); renderer.setSoldierSelection(chosen);
  shownAreas.clear(); renderer.setAreas(shownAreas);
  setStatus({ where: online ? 'game' : 'menu' });
  if (online) {
    net = online.net; netGame = online; netNotes = { desync: false, left: 0, back: 0 };
    speed = 1; acc = 0;
  } else if (!loaded) {
    // nowa gra: tempo na starcie z ustawień (Rozgrywka)
    speed = Math.min(3, gfx.startSpeed ?? 1); // najwyżej 3×
    hud.setSpeed(speed);
  }
  currentPreset = preset;
  currentSeedText = seedText;
  pending = [];
  renderer.setCrests(crestList());
  // tryb testowy (?test=1) jak dawniej, od razu: pomocniki __test i narzędzia sprawdzające zakładają gotowy świat po imporcie
  if (bootWorld === undefined && SANDBOX) bootWorld = null;
  if (bootWorld === undefined) {
    // pierwszy świat przy wczytywaniu strony: teren etapami z przerwą na klatkę (pasek wczytywania idzie dalej, strona nie
    // staje na ok. 2 s); boot.ts czeka na worldReady() przed rozgrzewką grafiki. Każdy następny start — od razu, jak dawniej
    bootWorld = renderer.setStateAsync(game, MAP_PRESETS[preset].waterLevel, MAP_PRESETS[preset].rim, ME, () => { bootStages++; bootProgress?.(bootStages); return pauseFrame(); });
  } else renderer.setState(game, MAP_PRESETS[preset].waterLevel, MAP_PRESETS[preset].rim, ME);
  hud.setSeed(seedText, preset);
  pick(null);
  selectedUnit = 0;
  renderer.setUnitSelection(0);
  select(0);
  try { history.replaceState(null, '', `#${preset}/${encodeURIComponent(seedText)}`); } catch { /* podgląd bez dostępu do historii */ }
  refresh();
  save();
}

/** Komunikat, czemu tu nie wolno budować (przy drzewku budowy z nazwą brakującego budynku) */
function placeErrorText(error: string, type: number): string {
  if (error !== 'place.needs') return t(error);
  const lock = BUILDINGS[type] ? missingRequirement(game, ME, BUILDINGS[type]!) : null;
  if (lock?.tier) return tierNeedText(lock.tier);
  const need = BUILDINGS[type]?.requires;
  const def = need ? BUILDINGS[buildingIndex(need)] : undefined;
  return t('place.needs').replace('{b}', def ? t(def.name) : need ?? '');
}

function pick(id: string | null): void {
  picked = id;
  moveId = 0;
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

/** Przenosiny: podgląd przenoszonego budynku idzie za kursorem, klik na mapie wskazuje nowe miejsce */
function startMove(id: number): void {
  const b = game.buildings.find((x) => x.id === id);
  const err = b ? canRelocate(game, ME, id) : 'move.cannot';
  if (!b || err) { hud.toast(t(err ?? 'move.cannot')); play('error'); return; }
  placeRot = b.rot;
  pick(BUILDINGS[b.type]!.id);
  moveId = id;
  updateGhost();
  hud.toast(t('move.pick'));
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
    if (s && def?.bandit) {
      // zbój z obozu w lesie: przydomek z puszczy, co robi i zdrowie
      const doing = s.den === -1 ? tx('ucieka w las', 'fleeing into the wood') : s.target || s.hitting ? tx('walczy', 'fighting') : s.raid ? tx('na napadzie', 'out on a raid') : s.goal >= 0 ? tx('wraca do obozu', 'going back to camp') : tx('siedzi przy ognisku w obozie', 'sitting by the fire in camp');
      return { name: `${FIRST_NAMES[h(1) % FIRST_NAMES.length]} ${tx('Zbój', 'the Brigand')}`, walk: false, lines: [`${age} · ${t('u.bandit')}`, `${t('person.doing')}: ${doing}`, `${t('person.hp')}: ${Math.max(0, s.hp)} / ${def.hp}`] };
    }
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
      ...(u.sick ? [t(game.tick < (u.sickFrom ?? 0) ? 'person.incubating' : u.care ? 'person.feverCare' : 'person.fever')] : (u.immune ?? 0) > game.tick ? [t('person.immune')] : []),
    ],
  };
}

function selectUnit(id: number): void {
  if (id && id !== selectedUnit) play('select');
  selectedUnit = id;
  if (id) { selected = 0; renderer.setSelection(0); renderer.setWorkerMark(0); }
  renderer.setUnitSelection(id);
  hud.showPerson(id ? personCard(id) : null);
  if (id) { if (isBandit(id)) sayBandit(id); else speak(id); }
}

/** Budynki, których teren pracy jest pokazany na mapie (zielony kwadrat) */
const shownAreas = new Set<number>();

/** Wszystko, co panel budynku pokazuje o wybranym budynku (w składach także zapasy z ikonami) */
function buildingInfo(b: GameState['buildings'][number]): BuildingInfo {
  const def = BUILDINGS[b.type]!;
  const p = game.players[b.owner]!;
  const stock = b.owner === ME && def.capacity && !b.build
    ? (Object.entries(def.capacity) as [StoreKind, number][]).map(([kind, here]) => ({
      // to, co leży w tym jednym magazynie (stock.ts), i osobno suma ze wszystkich magazynów tego rodzaju
      kind, here, hereUsed: usedIn(b, kind), used: storeUsed(p, kind), max: storeCapacity(game, b.owner, kind),
      stores: game.buildings.filter((o) => o.owner === b.owner && !o.build && BUILDINGS[o.type]!.capacity?.[kind]).length,
      items: RESOURCES.map((id, i) => ({ id, amount: b.stock?.[i] ?? 0 })).filter((x) => RESOURCE_DEFS[x.id].store === kind && x.amount > 0),
    }))
    : undefined;
  const mine = game.players[ME], theirs = game.players[b.owner];
  const owner = theirs ? { name: playerName(b.owner), rel: (b.owner === ME ? 'own' : mine && theirs.team === mine.team ? 'ally' : 'enemy') as 'own' | 'ally' | 'enemy', color: TEAM_COLORS[theirs.team] ?? 0x888888 } : undefined;
  return { owner, id: b.id, def, hasWorker: b.worker !== 0, own: b.owner === ME, ruined: b.ruined, move: b.owner === ME && movable(b.type) && !b.ruined && !b.build ? { cost: relocateCost(b.type), why: ((e) => (e ? t(e) : null))(canRelocate(game, ME, b.id)) } : undefined, canTrain: canTrain(), hp: b.hp, maxHp: maxHp(b.type), stock,
    recruit: (def.id === 'barracks' || def.id === 'mageFire' || def.id === 'mageWater') && !b.build && !b.ruined ? recruitInfo(b.type).map((r) => ({ ...r, rally: (b.rally?.[unitIndex(r.id)] ?? -1) >= 0 })) : undefined, gate: def.gate ? { open: b.gateOpen ?? true, shut: !!b.shut } : undefined,
    power: !b.build && (def.production || def.staff) && def.id !== 'keep' ? { on: !b.off, worker: b.worker !== 0 } : undefined,
    quarantine: canQuarantine(b) && (game.players[b.owner]?.plague || b.quarantine) ? { on: !!b.quarantine, sick: game.units.filter((u) => u.home === b.id && u.sick && u.phase === 22).length } : undefined,
    garrison: garrisonRoom(def.id) ? game.soldiers.filter((s) => towerOf(game, s) === b.id).length : undefined,
    garrisonMax: garrisonRoom(def.id) || undefined,
    prod: b.owner === ME && !b.build && (def.production || def.staff) && !def.keepers ? prodInfo(game, b, (id) => personCard(id)?.name ?? '') : undefined,
    logistics: b.owner === ME ? storeLogistics(game, b, (id) => personCard(id)?.name ?? '') : undefined,
    riot: def.id === 'keep' && b.owner === ME && p.revolt ? { count: rioters(game, ME), cost: doleCost(game, ME), food: foodTotal(p), guards: game.soldiers.filter((s) => s.owner === ME && s.kind === GUARD && !s.camp && s.hp > 0).length, quelling: !!p.quell } : undefined,
    watch: def.id === 'keep' ? watchInfo(game, b.owner) : def.id === 'minecamp' ? campWatch(game, b) : undefined,
    area: def.area || isTower(def.id) ? shownAreas.has(b.id) : undefined,
    site: b.build ? siteInfo(game, b) : undefined };
}

/** Skrót z paska: kamera do własnych koszar albo składu i okno budynku; kolejne kliknięcia idą po kolejnych */
const jumpAt: Record<string, number> = {};
/** Skróty na dolnym pasku: koszary, składy (mały i duży) i spichlerze (mały i duży) */
const JUMP_IDS: Record<JumpKind, readonly string[]> = { barracks: ['barracks'], stockpile: ['stockpile', 'barn'], granary: ['granary', 'granaryBig'] };
function jumpTo(kind: JumpKind): void {
  const ids = JUMP_IDS[kind];
  const list = game.buildings.filter((b) => b.owner === ME && ids.includes(BUILDINGS[b.type]!.id)).sort((a, b) => a.id - b.id);
  if (!list.length) return;
  const cur = list.findIndex((b) => b.id === selected);
  const next = cur >= 0 ? (cur + 1) % list.length : (jumpAt[kind] ?? 0) % list.length;
  jumpAt[kind] = next;
  const b = list[next]!;
  const d = BUILDINGS[b.type]!;
  renderer.lookAt(b.x + d.w / 2, b.y + d.h / 2, 22);
  select(b.id);
  play('select');
  // okno budynku zasłania środek ekranu (i sam budynek): kamera przesuwa się tak, żeby budynek stał obok okna.
  // Dawniej przy pierwszym kliknięciu budynek chował się pod oknem i wyglądało, jakby kamera w ogóle nie ruszyła
  requestAnimationFrame(() => requestAnimationFrame(() => frameBeside(b.x + d.w / 2, b.y + d.h / 2, 22)));
}
/** Kamera na punkt mapy, ale tak, żeby wypadł w wolnej części ekranu obok otwartego okna budynku */
function frameBeside(x: number, y: number, dist: number): void {
  const panel = document.querySelector<HTMLElement>('.panel.info:not([hidden])');
  if (!panel) return;
  const r = panel.getBoundingClientRect(), c = canvas.getBoundingClientRect();
  if (!r.width || !c.width) return;
  const right = r.left + r.width / 2 > c.left + c.width / 2;
  const wantX = right ? (c.left + r.left) / 2 : (r.right + c.right) / 2, wantY = c.top + c.height * 0.45;
  renderer.lookAt(x, y, dist);
  const p0 = renderer.project(x, y), pa = renderer.project(x + 1, y), pb = renderer.project(x, y + 1);
  const ax = pa.sx - p0.sx, ay = pa.sy - p0.sy, bx = pb.sx - p0.sx, by = pb.sy - p0.sy, det = ax * by - ay * bx;
  if (Math.abs(det) < 1e-6) return;
  // przesunięcie celu kamery o (u, v) pól przesuwa budynek na ekranie o −(u·a + v·b)
  const ex = p0.sx - wantX, ey = p0.sy - wantY;
  const u = (ex * by - ey * bx) / det, v = (ax * ey - ay * ex) / det;
  renderer.lookAt(x + u, y + v, dist);
}
const jumpCount = (kind: JumpKind): number => { const ids = JUMP_IDS[kind]; let n = 0; for (const b of game.buildings) if (b.owner === ME && ids.includes(BUILDINGS[b.type]!.id)) n++; return n; };

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
  // wyjście zawsze przed drzwiami modelu (nie przeskakuje); gdy to pole jest zajęte, podgląd jest czerwony
  const def = BUILDINGS[type]!;
  const door = def.wall || def.gate || def.road || def.line || def.id === 'torch' ? -1 : doorTile(game, o.x, o.y, fp.w, fp.h, placeRot);
  renderer.setGhost({ ...o, w: fp.w, h: fp.h, ok: (moveId ? canRelocateTo(game, ME, moveId, o.x, o.y, placeRot) : canPlace(game, ME, type, o.x, o.y, true, placeRot)) === null, id: picked, team: game.players[ME]!.team, rot: placeRot, door });
}

renderer.onHover = (tile) => { hoverTile = tile; if (!touchTile) updateGhost(); };

/** Własna (albo niczyja ze starego zapisu) droga — tylko taką zdejmuje się narzędziem rozbiórki; wrogą rozkopuje wojsko */
const ownRoad = (tile: { x: number; y: number }): boolean => { const o = game.roadOwner[tile.y * game.map.width + tile.x]!; return !o || o === ME + 1; };
// malowanie drogi: każde pole pod kursorem przy wciśniętym przycisku dostaje nawierzchnię
renderer.onPaint = (tile) => {
  if (wrecking) {
    const kind = ownRoad(tile) ? game.roads[tile.y * game.map.width + tile.x] : 0;
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
    return `<span class="${need > have ? 'bad' : ''}">${t(`res.${res}`)}: ${need} <small>(${tx('masz', 'you have')} ${have})</small></span>`;
  });
  const bad = plan.tiles.length - count;
  planTip.innerHTML = `<strong>${t(def.name)}: ${count} ${lang() === 'en' ? (count === 1 ? 'tile' : 'tiles') : count === 1 ? 'pole' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'pola' : 'pól'}</strong>`
    + (costs.length ? costs.join('') : `<span>${tx('za darmo', 'free of charge')}</span>`)
    + (bad ? `<span class="bad">${bad} ${tx('poza zasięgiem / zajęte', 'out of reach / taken')}</span>` : '')
    + (plan.state === 'wait' ? `<em>${tx('Lewy przycisk — buduj · prawy — anuluj', 'Left click — build · right click — cancel')}</em>` : `<em>${tx('Puść, żeby zobaczyć plan', 'Release to see the plan')}</em>`);
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
  if (walkPick) { setWalkPick(false); walkAt(tile.x, tile.y); return; }
  if (rallyPick) {
    pending.push({ type: 'rally', player: ME, building: rallyPick.building, kind: rallyPick.kind, tile: tile.y * game.map.width + tile.x });
    rallyPick = null; canvas.classList.remove('placing'); play('rotate');
    renderer.orderMarker(tile);
    return;
  }
  if (devSpawn && devAllowed()) { devPlace(tile.x, tile.y, devSpawn.kind, devSpawn.foe, devSpawn.count); resyncSim(); return; }
  if (wrecking) {
    const id = game.occupancy[tile.y * game.map.width + tile.x] ?? 0;
    const b = game.buildings.find((x) => x.id === id);
    if (b && b.owner === ME && BUILDINGS[b.type]!.buildable) { pending.push({ type: 'demolish', player: ME, id }); play('demolish'); }
    else if (game.roads[tile.y * game.map.width + tile.x] && ownRoad(tile)) { roadBroken(tile, game.roads[tile.y * game.map.width + tile.x]!); pending.push({ type: 'unroad', player: ME, x: tile.x, y: tile.y }); }
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
  // stawiamy dokładnie tam, gdzie stoi podgląd (pole z ostatniego ruchu myszy), a nie tam, gdzie trafił klik
  const o = origin(!touch && hoverTile ? hoverTile : tile, type);
  if (moveId) {
    const err = canRelocateTo(game, ME, moveId, o.x, o.y, placeRot);
    if (err) { hud.toast(err.startsWith('move.') ? t(err as MoveError) : placeErrorText(err, type)); play('error'); return; }
    pending.push({ type: 'relocate', player: ME, id: moveId, x: o.x, y: o.y, rot: placeRot });
    play('demolish');
    pick(null);
    return;
  }
  const error = canPlace(game, ME, type, o.x, o.y, true, placeRot);
  if (error) { hud.toast(placeErrorText(error, type)); play('error'); return; }
  pending.push({ type: 'build', player: ME, building: picked, x: o.x, y: o.y, rot: placeRot });
  play('build');
  touchTile = null;
};

// dźwięk rusza po pierwszym kliknięciu albo klawiszu; każdy przycisk interfejsu stuka
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
document.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('button')) play('click'); });
// zawalenie budynku gra scena z jego miejsca (play3d), więc nie słychać go z drugiego końca mapy
renderer.onCollapse = () => {};

/** Wybór miejsca startu spaceru: następne kliknięcie na mapie stawia tam chłopa (Esc anuluje) */
let walkPick = false;
function setWalkPick(on: boolean): void {
  walkPick = on;
  canvas.classList.toggle('placing', on);
  if (on) hud.toast(tx('Kliknij na mapie miejsce, w którym zaczniesz spacer chłopem. Oko jeszcze raz: losowy mieszkaniec. Esc: anuluj.', 'Click a spot on the map to start walking as a peasant. Click the eye again for a random villager. Esc: cancel.'));
}
/** Spacer od wskazanego pola: najbliższe wolne pole, po którym da się chodzić (nie w wodzie, skale ani w murze) */
function walkAt(atX: number, atY: number): void {
  if (renderer.walking) return;
  const { width: w, height: h } = game.map;
  for (let r = 0; r < 8; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = atX + dx, y = atY + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const t = y * w + x, tile = game.map.tiles[t];
        if (game.occupancy[t] !== 0 || tile === Terrain.Water || tile === Terrain.Mountain) continue;
        document.body.classList.add('walking');
        walkHint.hidden = false;
        renderer.startWalk(x + 0.5, y + 0.5);
        return;
      }
  hud.toast(tx('Tu nie da się stanąć — wybierz miejsce na lądzie, poza budynkami i skałami.', 'You cannot stand here — pick a spot on dry land, clear of buildings and rocks.'));
}

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
  if (e.key === 'Escape' && walkPick) { setWalkPick(false); return; }
  if (e.key === 'Escape' && patrolPick) { setPatrolPick(false); return; }
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
  if (e.code === 'KeyF' && !selectedUnit && !e.repeat) { setWalkPick(!walkPick); return; } // F bez zaznaczenia: wybierz miejsce startu spaceru
  if (e.code === 'KeyM') hud.setMuted(toggleMute());
  if (e.code === 'KeyN' && !e.repeat) minimap.toggle();
  if (e.code === 'KeyP' && !e.repeat && chosen.size) setPatrolPick(!patrolPick);
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

/** Wybieranie punktów patrolu (P albo przycisk „Patrol”): prawy klik = punkt obchodu, Shift = jeszcze jeden punkt */
let patrolPick: { x: number; y: number }[] | null = null;
function setPatrolPick(on: boolean): void {
  if (on && !chosen.size) return;
  patrolPick = on ? [] : null;
  canvas.classList.toggle('placing', on);
  if (on) hud.toast(tx('Patrol: prawy klik wskazuje punkt obchodu (Shift + prawy klik: kolejny punkt). Oddział chodzi tam i z powrotem i bije wrogów po drodze. Esc anuluje.', 'Patrol: right-click marks a waypoint (Shift + right-click: another one). The troop walks there and back, striking any foe on the way. Esc cancels.'));
  showArmy();
}
/** Prawy klik w trybie patrolu: dopisuje punkt; bez Shift kończy wybór i wysyła rozkaz */
function patrolClick(more: boolean): void {
  if (!patrolPick || !hoverTile) return;
  patrolPick.push({ ...hoverTile });
  renderer.orderMarker(hoverTile);
  play('rotate');
  if (more && patrolPick.length < 11) return;
  const pts = patrolPick.map((p) => [p.x, p.y] as [number, number]);
  pending.push({ type: 'patrol', player: ME, ids: [...chosen], pts, form: armyForm, amove: true });
  shout('move');
  setPatrolPick(false);
}

let wreckHinted = false;
/** Zwykły prawy klik przy zaznaczonym wojsku: atak na wroga, wejście na wieżę albo marsz (queue: Shift = dopisz do kolejki) */
function armyRightClick(amove: boolean, queue = false): void {
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
    // na pomoście stoją jak na zwykłym terenie: dalej należą do oddziału i grup, zaznacza się ich normalnie
    play('rotate');
    shout('move');
    return;
  }
  // wroga droga pod kursorem (bez budynku na niej): oddział idzie ją rozkopać
  if (!b && !queue && enemyRoad(game, ME, hoverTile.y * game.map.width + hoverTile.x)) {
    pending.push({ type: 'wreck', player: ME, ids: [...chosen], x: hoverTile.x, y: hoverTile.y });
    renderer.orderMarker(hoverTile);
    play('rotate');
    shout('attack');
    if (!wreckHinted) { wreckHinted = true; hud.toast(tx('Żołnierze rozkopią wrogą drogę. Kamienna schodzi wolniej niż piaskowa; im więcej ludzi, tym szybciej.', 'Your men will tear up the enemy road. Stone takes longer than sand; the more hands, the quicker.')); }
    return;
  }
  pending.push({ type: 'move', player: ME, ids: [...chosen], x: hoverTile.x, y: hoverTile.y, form: armyForm, amove, queue: queue || undefined });
  renderer.orderMarker(hoverTile);
  play('rotate');
  if (!queue) shout(amove ? 'attack' : 'move');
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
  if (patrolPick) { patrolClick(e.shiftKey); return; }
  const amove = (armyMarch === 1) !== e.ctrlKey;
  const queue = e.shiftKey;
  const o = d.on ? dragOrder(d.tile, amove) : null;
  if (o) {
    pending.push({ type: 'move', player: ME, ids: [...chosen], ...o, queue: queue || undefined });
    renderer.orderMarker(o);
    play('rotate');
    if (!queue) shout(amove ? 'attack' : 'move');
    return;
  }
  armyRightClick(amove, queue);
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

function recruitInfo(hall = buildingIndex('barracks')): RecruitUnit[] {
  const p = game.players[ME]!;
  const gold = p.res[resIndex('gold')]!;
  const idle = game.units.filter((u) => u.owner === ME && u.job === 0).length;
  const magesLeft = Math.max(0, MAGE_CAP - battleMages(game, ME));
  return UNITS.filter((def) => !def.guard && !def.bandit && trainsAt(def, hall)).map((def) => {
    if (def.magic) {
      const cost = def.cost.gold ?? 0;
      const crystals = p.res[resIndex('crystal')]!, needC = def.cost.crystal ?? 0;
      return { id: def.id, name: t(def.name), weapon: 'gold', have: gold, gold, idle, cost, hp: def.hp, attack: def.attack, range: def.range, gear: needC ? { res: 'crystal', have: crystals } : undefined, magic: { have: MAGE_CAP - magesLeft, cap: MAGE_CAP }, max: Math.max(0, Math.min(cost ? Math.floor(gold / cost) : 999, needC ? Math.floor(crystals / needC) : 999, idle, magesLeft)) };
    }
    const have = p.res[resIndex(def.weapon)]!;
    const cost = def.cost.gold ?? 0;
    // ile sztuk broni (albo drewna na taran) idzie na jednego
    const need = def.cost[def.weapon] ?? 1;
    // drugi sprzęt ze zbrojowni (kolczuga zbrojnego)
    const gear = def.gear ? { res: def.gear, have: p.res[resIndex(def.gear)]! } : undefined;
    const gearMax = gear ? Math.floor(gear.have / (def.cost[def.gear!] ?? 1)) : 999;
    return { id: def.id, name: t(def.name), weapon: def.weapon, need, have, gear, armor: def.armor, gold, idle, cost, hp: def.hp, attack: def.attack, range: def.range, max: Math.max(0, Math.min(Math.floor(have / need), gearMax, cost ? Math.floor(gold / cost) : 999, idle)) };
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
/** Zaznaczeni chodzą na patrolu (cały oddział w jednej kolejce z obchodem) */
function patrolling(list: { grp?: number }[]): boolean {
  const grp = list[0]?.grp;
  return !!grp && list.every((s) => s.grp === grp) && !!game.orders?.some((q) => q.owner === ME && q.grp === grp && q.patrol);
}

/** Numer grupy, do której należy żołnierz (najniższy, gdy jest w kilku); 0 = bez grupy */
function groupOfUnit(id: number): number {
  let best = 0;
  for (const [n, ids] of groups) if (ids.includes(id) && (!best || n < best)) best = n;
  return best;
}
function showArmy(): void {
  if (patrolPick && !chosen.size) { patrolPick = null; canvas.classList.remove('placing'); }
  const list = game.soldiers.filter((s) => chosen.has(s.id));
  if (list.length !== chosen.size) { chosen.clear(); for (const s of list) chosen.add(s.id); renderer.setSoldierSelection(chosen); }
  const st = new Set(list.map((s) => s.stance ?? 0));
  hud.showArmy(list.map((s) => ({ id: s.id, name: t(UNITS[s.kind]!.name), hp: s.hp, max: UNITS[s.kind]!.hp, kind: UNITS[s.kind]!.id, group: groupOfUnit(s.id) })), { form: armyForm, stance: st.size === 1 ? [...st][0]! : -1, march: armyMarch, group: groupOf(), patrol: patrolPick ? 2 : patrolling(list) ? 1 : 0 });
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
    // wrogi żołnierz (także strażnik miejski, łucznik, mag): odległość kursora od całej sylwetki — odcinka od stóp
    // do paska zdrowia nad głową; dawniej liczył się tylko punkt przy pasku, więc kursor na tułowiu nie dawał miecza
    for (const s of renderer.soldiersOnScreen(-1)) {
      if (game.players[s.owner]?.team === game.players[ME]!.team) continue;
      const vx = s.x - s.fx, vy = s.y - s.feet, len = vx * vx + vy * vy;
      const k = len > 0 ? Math.max(0, Math.min(1, ((mouseX - s.fx) * vx + (mouseY - s.feet) * vy) / len)) : 0;
      const d = (s.fx + vx * k - mouseX) ** 2 + (s.feet + vy * k - mouseY) ** 2;
      if (d < bd) { bd = d; hoverFoe = s.id; }
    }
    // wrodzy chłopi pod kursorem: prawy klik = żołnierze idą na nich
    // (promień z kamery w sylwetkę, jak przy klikaniu w chłopa — dawniej jeden punkt metr nad ziemią, nad głową chłopa,
    // więc przy zbliżeniu kursor na chłopie nie dawał miecza i nie dało się go wskazać)
    if (!hoverFoe) {
      const myTeam = game.players[ME]!.team;
      const foeIds = new Set(game.units.filter((u) => game.players[u.owner]?.team !== myTeam).map((u) => u.id));
      const u = foeIds.size ? renderer.unitAt(mouseX, mouseY, (id) => foeIds.has(id)) : 0;
      if (u) hoverFoe = u;
    }
    // wilki pod kursorem też można zaatakować (każdym wojskiem, także magiem i łucznikiem): odległość kursora od sylwetki
    // wilka — od łap do grzbietu, z promieniem rosnącym przy zbliżeniu; dawniej jeden punkt metr nad ziemią i stałe 26 px,
    // więc przy zbliżeniu kursor na wilku nie dawał miecza (28.10.2026)
    for (const w of game.wolves) {
      if (w.hp <= 0) continue;
      const a = renderer.project(w.px / 256, w.py / 256, 0.05), b = renderer.project(w.px / 256, w.py / 256, 0.75);
      if (!a.front) continue;
      const vx = b.sx - a.sx, vy = b.sy - a.sy, len = vx * vx + vy * vy;
      const k = len > 0 ? Math.max(0, Math.min(1, ((mouseX - a.sx) * vx + (mouseY - a.sy) * vy) / len)) : 0;
      const d = (a.sx + vx * k - mouseX) ** 2 + (a.sy + vy * k - mouseY) ** 2;
      const r = Math.max(26, Math.sqrt(len) * 0.9);
      // odległość przeliczona na skalę 26 px, żeby porównywać uczciwie z żołnierzami obok
      const n = (d * 26 * 26) / (r * r);
      if (n < bd) { bd = n; hoverFoe = w.id; }
    }
    if (!hoverFoe && hoverTile) {
      const b = game.buildings.find((x) => x.id === game.occupancy[hoverTile!.y * game.map.width + hoverTile!.x]);
      if (b && game.players[b.owner]?.team !== game.players[ME]!.team) hoverFoe = b.id;
      // wroga ruina muru albo bramy nie zajmuje pól (da się przejść): saperzy też mogą ją wskazać
      if (!b && [...chosen].some((id) => { const s = game.soldiers.find((x) => x.id === id); return !!s && !!UNITS[s.kind]!.sapper; })) {
        const r = game.buildings.find((o) => o.ruined && game.players[o.owner]?.team !== game.players[ME]!.team && hoverTile!.x >= o.x && hoverTile!.y >= o.y
          && hoverTile!.x < o.x + footprint(BUILDINGS[o.type]!, o.rot).w && hoverTile!.y < o.y + footprint(BUILDINGS[o.type]!, o.rot).h);
        if (r) hoverFoe = r.id;
      }
    }
  }
  canvas.classList.toggle('attack', hoverFoe !== 0);
  // zaznaczeni łucznicy nad własną wieżą z wolnym miejscem: kursor „wejdź”
  let enter = false;
  if (!hoverFoe && chosen.size && hoverTile) {
    const b = game.buildings.find((x) => x.id === game.occupancy[hoverTile!.y * game.map.width + hoverTile!.x]);
    if (b && b.owner === ME && !b.build && garrisonRoom(BUILDINGS[b.type]!.id)) {
      const room = garrisonRoom(BUILDINGS[b.type]!.id) - game.soldiers.filter((s) => towerOf(game, s) === b.id).length;
      enter = room > 0 && game.soldiers.some((s) => chosen.has(s.id) && !UNITS[s.kind]!.ram && towerOf(game, s) !== b.id);
    }
  }
  canvas.classList.toggle('enter', enter);
  renderer.setAttackHighlight(game.buildings.some((b) => b.id === hoverFoe) ? hoverFoe : 0);
  renderer.setFoeMark(hoverFoe && !game.buildings.some((b) => b.id === hoverFoe) ? hoverFoe : 0);
}

// ---- paski zdrowia nad żołnierzami: ranni, zaznaczeni i wróg pod kursorem (ui/hpBars.ts) ----
const updateBars = createHpBars({
  game: () => game, me: () => ME,
  mode: () => gfx.hpBars ?? 'combat',
  marked: (id) => chosen.has(id) || id === hoverFoe,
  soldiers: () => { renderer.barLift = 0.78; const l = renderer.soldiersOnScreen(-1); renderer.barLift = 0.45; return l; },
  wolves: () => renderer.wolvesOnScreen(),
  wolfHp: WOLF_HP,
});

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
  const foes = game.soldiers.filter((s) => s.owner !== BANDITS && game.players[s.owner]?.team !== me.team); // zbóje z lasu to nie wojsko wroga: o nich mówi skryba
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
    alarm.title = tx('Kliknij, żeby zobaczyć nadciągające wojsko', 'Click to see the approaching host');
    alarm.innerHTML = `<strong>${t('alarm.coming')}</strong><span>${coming.length} ${t('alarm.soldiers')} · ${Math.round(near)} ${t('alarm.fields')}</span><span class="alarm-bar"><span style="width:${Math.max(4, Math.min(100, 100 - near))}%"></span></span><span class="alarm-go">${tx('Pokaż', 'Show')} ▸</span>`;
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
  musicEnd(win);
  speed = 0;
  // mecz przez sieć: wynik trafia do historii i rankingu gracza (kooperacja przeciw botom nie liczy się do rankingu)
  if (netGame && !netGame.coop) void saveResult(netGame.preset, win, Math.floor(game.tick / TICKS_PER_SECOND / 60), netGame.room.id);
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
  if (netMe() && !SANDBOX) btn(tx('Mój ród', 'My house'), () => { menu.house(false); });
  document.body.append(box);
  play(win ? 'build' : 'collapse');
  endXp(box.querySelector('.summary')!, win, mins);
}

/**
 * Doświadczenie za mecz (konto): rozpiska nabija się po kolei, suma i pasek poziomu dochodzą z bazy (award_match liczy
 * z limitami — to, co policzy przeglądarka, to tylko podgląd). Gdy PD nie ma, okno mówi dlaczego (tryb
 * testowy, brak konta).
 */
function endXp(after: Element, win: boolean, mins: number): void {
  const p = game.players[ME]!;
  const enemy = game.players.find((q) => q.id !== ME && q.bot);
  const mode: MatchMode = netGame ? (netGame.coop ? 'coop' : 'online') : (`bots${Math.max(0, Math.min(3, enemy?.level ?? 2))}` as MatchMode);
  const st = p.stats;
  const stats = { won: win, minutes: mins, kills: st.kills, razed: st.razed, built: st.built };
  const host = document.createElement('div');
  after.after(host);
  const multLabel = mode === 'coop' ? tx('razem przeciw botom', 'together against bots') : mode.startsWith('bots') ? tx('mecz z botami', 'match against bots') : tx('przez sieć', 'online');
  // tryb deweloperski też daje doświadczenie (decyzja Michała 19.10.2026); bez PD tylko tryb testowy (?test) i gra bez konta
  const reason = SANDBOX ? tx('Tryb testowy (?test w adresie) nie daje doświadczenia.', 'Test mode (?test in the address) gives no experience.')
    : !netMe() ? tx('Zaloguj się, żeby zbierać doświadczenie, poziomy i tytuły.', 'Sign in to earn experience, levels and ranks.') : undefined;
  const counts = !reason;
  xpReport(host, {
    parts: xpParts(stats).filter((x) => x.xp > 0),
    mult: { label: multLabel, value: MODE_MULT[mode] },
    preview: matchXp(stats, mode),
    award: counts ? awardMatch(mode, stats) : null,
    reason,
    action: !netMe() && !SANDBOX ? { label: tx('Zaloguj się', 'Sign in'), run: () => { document.querySelector('.end')?.remove(); menu.account(false); } } : undefined,
    sound: (k) => play(k === 'level' ? 'build' : 'click'),
  });
}

// kronika skryby: każda wiadomość z dniem i godziną gry
const scribeClock = (): string => {
  const c = clockAt(game.tick), h = Math.floor(c.hour), m = Math.floor((c.hour - h) * 60);
  return tx(`dzień ${c.day}, ${h}:${String(m).padStart(2, '0')}`, `day ${c.day}, ${h}:${String(m).padStart(2, '0')}`);
};
const scribe = createScribe(() => play('babble'), scribeClock);
let wolvesSeen = false, wolfKillsSeen = 0;
/** Zbóje z lasu: ostatnio widziane liczniki napadów, zabitych i rozbitych obozów (wiadomość skryby przy każdej zmianie) */
let banditSeen: { raids: number; kills: number; razed: number } | null = null;
/** Gry, w których skryba już powiedział, gdzie obozują zbóje */
const banditIntro = new WeakSet<object>();
/** Najbliższy obóz zbójów od naszego zamku: środek i strona świata (na mapie północ jest u góry) */
function nearestDen(): { x: number; y: number; dir: string } | null {
  const keep = game.buildings.find((b) => b.owner === ME && b.type === 0);
  if (!keep) return null;
  const kx = keep.x + 5, ky = keep.y + 5;
  let best: { x: number; y: number } | null = null, bd = Infinity;
  for (const b of game.buildings) if (BUILDINGS[b.type]!.id === 'banditCamp') { const d = Math.hypot(b.x + 1 - kx, b.y + 1 - ky); if (d < bd) { bd = d; best = { x: b.x + 1.5, y: b.y + 1.5 }; } }
  if (!best) return null;
  const a = Math.atan2(best.x - kx, -(best.y - ky)) * 180 / Math.PI; // 0 = północ, zgodnie z zegarem
  const k = Math.round(((a + 360) % 360) / 45) % 8;
  const dir = [tx('na północ', 'north'), tx('na północny wschód', 'north-east'), tx('na wschód', 'east'), tx('na południowy wschód', 'south-east'), tx('na południe', 'south'), tx('na południowy zachód', 'south-west'), tx('na zachód', 'west'), tx('na północny zachód', 'north-west')][k]!;
  return { ...best, dir };
}
const showAt = (x: number, y: number): ScribeAction => ({ label: tx('Pokaż', 'Show'), run: () => renderer.lookAt(x, y, 28) });
function banditNotes(p: (typeof game.players)[number]): void {
  const b = p.bandit ?? { raids: 0, kills: 0, robbed: 0, razed: 0, loot: [] };
  // na początku gry skryba mówi, gdzie w puszczy siedzą zbóje (z przyciskiem, który pokazuje obóz)
  if (!banditIntro.has(game) && game.tick >= 150 && game.tick < RULES.dayTicks * 2) {
    const den = nearestDen();
    if (den) { banditIntro.add(game); scribe.say('banditIntro', tx(`Panie, zwiadowcy donoszą: w puszczy ${den.dir} od zamku obozują zbóje. Od jutra będą napadać na drwali z dala od osady.`, `My lord, the scouts report brigands camped in the deep wood ${den.dir} of the castle. From tomorrow they will waylay woodcutters far from the settlement.`), false, 'herald', showAt(den.x, den.y)); }
  }
  const was = banditSeen;
  banditSeen = { raids: b.raids, kills: b.kills, razed: b.razed };
  if (!was) return; // pierwszy odczyt (nowa gra albo wczytany zapis): bez wiadomości o dawnych sprawach
  if (b.raids > was.raids) {
    // gdzie jest napad: przy ofierze, którą gonią zbóje
    const r = game.soldiers.find((s) => s.owner === BANDITS && s.raid && s.prey);
    const u = r ? game.units.find((x) => x.id === r.prey) : undefined;
    scribe.say('banditRaid', tx('Zbóje z lasu napadli naszych ludzi przy robocie! Ślijcie straż albo wojsko, a ludzie niech uciekają pod zamek.', 'Brigands from the wood have fallen upon our folk at their work! Send the guard or soldiers, and let the people run for the castle.'), true, 'herald', u ? showAt(u.px / 256, u.py / 256) : undefined);
  }
  if (b.kills > was.kills) { const den = nearestDen(); scribe.say('banditKill', tx(`Zbóje zabili naszego człowieka i złupili skarbiec (razem zabrali już ${b.robbed} rudy i drewna). Ich obóz jest w puszczy — rozbijcie go.`, `Brigands have slain one of ours and robbed the treasury (${b.robbed} ore and timber taken so far). Their camp lies in the deep wood — break it.`), true, 'scribe', den ? showAt(den.x, den.y) : undefined); }
  if (b.razed > was.razed) {
    const loot = RESOURCES.map((id, i) => ({ id, n: b.loot[i] ?? 0 })).filter((x) => x.n > 0).map((x) => `${x.n} × ${t(RESOURCE_DEFS[x.id].name).toLowerCase()}`).join(', ');
    scribe.say('banditRazed', tx(`Obóz zbójów rozbity! ${loot ? `Łup trafił do skarbca: ${loot}.` : 'Łupu nie było.'}`, `The brigands' camp is broken! ${loot ? `The plunder is in our stores: ${loot}.` : 'There was no plunder.'}`), false, 'herald');
    play('build');
  }
}
let wasComing = false;
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
let warnedRevolt = false;
let raidSeen = 0;

/** Skryba przed zimą: na początku jesieni zapowiedź, ok. półtora dnia przed zimą rachunek drewna i jedzenia, a gdy zima
 * przyjdzie — krótko, co robić. Progi liczone z położenia w roku; skok pory roku z menu dewelopera nic nie ogłasza. */
let yearSeen = -1;
function winterNotes(p: (typeof game.players)[number]): void {
  const pos = yearPos(game.tick, game.seasonShift ?? 0);
  const was = yearSeen;
  yearSeen = pos;
  if (was < 0 || pos < was || pos - was > 0.02) return; // start gry, nowy rok albo przeskok pory roku
  const crossed = (th: number): boolean => was < th && pos >= th;
  const n = (x: number): string => String(Math.round(x));
  if (crossed(0.5)) {
    const w = winterReadiness(game, p);
    scribe.say('autumn', tx(`Nadeszła jesień. Za ${n(w.days)} dni zima — chaty będą palić w piecach. Gromadźcie drewno na opał (na zimę ok. ${w.fuel}) i jedzenie na zapas.`, `Autumn is upon us. Winter comes in ${n(w.days)} days — the hovels will need their hearths lit. Lay in firewood (about ${w.fuel} for the winter) and store up food.`));
  }
  if (crossed(0.68)) {
    const w = winterReadiness(game, p), short = w.wood < w.fuel, hungry = w.foodDays < SEASON_DAYS;
    const fuel = short ? tx(`drewna na opał za mało: potrzeba ok. ${w.fuel}, w składzie ${w.wood}. Postawcie drwali`, `we lack firewood: about ${w.fuel} is needed and the stockpile holds ${w.wood}. Set woodcutters to work`) : tx(`drewna na opał starczy (potrzeba ok. ${w.fuel}, jest ${w.wood})`, `there is firewood enough (about ${w.fuel} needed, ${w.wood} in store)`);
    const food = hungry ? tx(`, a jedzenia ledwie na ${n(Math.max(0, w.foodDays))} dni — zróbcie zapasy w spichlerzu`, `, and food for barely ${n(Math.max(0, w.foodDays))} days — fill the granary`) : '';
    scribe.say('winterSoon', tx(`Panie, za ${Math.max(1, Math.round(w.days))} dni zima: ${fuel}${food}.`, `My lord, winter comes in ${Math.max(1, Math.round(w.days))} days: ${fuel}${food}.`), short || hungry);
  }
  if (crossed(0.75)) {
    const w = winterReadiness(game, p);
    scribe.say('winter', w.wood < w.fuel / 2 ? tx(`Zima nadeszła, a drewna na opał mało (${w.wood}). Ludzie zmarzną w chatach — tnijcie drewno.`, `Winter has come and firewood is scarce (${w.wood}). The people will freeze in their hovels — cut more wood.`) : tx('Zima nadeszła. Chaty palą w piecach; pilnujcie drewna na opał.', 'Winter has come. The hearths are burning in every hovel; keep the firewood coming.'), w.wood < w.fuel / 2);
  }
}

let plagueSeen = 0, plagueToll = 0, plagueOverSeen = 0, droughtDay = -1, feastSeen = -1;
/** Ostatni piorun każdego gracza, który już pokazaliśmy (tick) */
const strikesSeen = new Map<number, number>();
let lastHourBell = 0;
/** Etap osady przy ostatnim odświeżeniu (-1 = świeży start: nie ogłaszamy etapu wczytanego z zapisu) */
let tierSeen = -1;
function refresh(): void {
  const p = game.players[ME]!;
  const f = monthlyForecast(game, p);
  // ostrzeżenia pokazujemy raz, w chwili gdy problem się zaczyna
  // skryba: ważne wiadomości w lewym górnym rogu, z „mową”
  // samo jedzenie (jabłka, chleb, ryby) — pszenica i mąka też leżą w spichlerzu, ale nikt ich nie zje
  const food = RESOURCES.reduce((n, id, i) => n + (RESOURCE_DEFS[id].food ? p.res[i]! : 0), 0);
  if (!f.fed && !warnedHungry) scribe.say('hungry', t('warn.hungry'), true);
  else if (f.fed && food < 15 && population(game, ME) > 0) scribe.say('foodLow', t('scribe.foodLow'));
  if (p.popularity < 50 && !warnedLeaving) scribe.say('leaving', t('warn.leaving'), true);
  // bunt głodowy: raz na początku (z przyciskiem do tłumu pod bramą) i raz, gdy się rozejdą
  if (p.revolt && !warnedRevolt) {
    const keep = playerKeep(game, ME);
    const w = game.map.width;
    scribe.say('revolt', t('scribe.revolt'), true, 'scribe', keep && keep.door >= 0 ? showAt(keep.door % w, Math.floor(keep.door / w)) : undefined);
  } else if (!p.revolt && warnedRevolt) scribe.say('revoltOver', t('scribe.revoltOver'));
  warnedRevolt = !!p.revolt;
  // napad tłumu w czasie długiego buntu: skryba z przyciskiem do napadniętego budynku
  if (p.lastRaid && p.lastRaid.tick !== raidSeen && game.tick - p.lastRaid.tick < 100) {
    raidSeen = p.lastRaid.tick;
    const rb = game.buildings.find((x) => x.id === p.lastRaid!.building);
    const fp = rb ? footprint(BUILDINGS[rb.type]!, rb.rot) : null;
    scribe.say(`raid${raidSeen}`, t(p.lastRaid.kind === 2 ? 'scribe.riotFire' : 'scribe.riotLoot'), true, 'scribe', rb && fp ? showAt(rb.x + fp.w / 2, rb.y + fp.h / 2) : undefined);
  }
  // etap osady: skryba ogłasza awans i to, co się odblokowało
  const tierNow = p.tier ?? 0;
  if (tierNow > tierSeen && tierSeen >= 0) {
    const opened = BUILDINGS.filter((d) => d.tier === tierNow && d.buildable).map((d) => t(d.name)).join(', ');
    const next = RULES.tiers[tierNow + 1];
    scribe.say(`tier${tierNow}`, tx(`Panie, nasza wioska urosła — jesteśmy teraz: ${TIER_NAMES()[tierNow]}. Wolno stawiać: ${opened}.${next ? ` Następny etap od ${next} ludzi.` : ''}`,
      `My lord, our settlement has grown — we are now a ${(TIER_NAMES()[tierNow] ?? '').toLowerCase()}. You may now build: ${opened}.${next ? ` The next stage comes at ${next} people.` : ''}`));
  }
  tierSeen = tierNow;
  // święto pod kapliczką z kaznodzieją: skryba ogłasza je raz, z rana
  if (feastDay(game) && preached(game, ME)) {
    const day = clockAt(game.tick).day;
    if (feastSeen !== day) { feastSeen = day; scribe.say(`feast${day}`, tx('Panie, dziś święto Ojca Płomienia! Ludzie są w dobrym nastroju, a wieczorem cała osada zbierze się pod kapliczką na kazanie.', 'My lord, today is the feast of the Father of Flame! The folk are in good spirits, and this evening the whole settlement will gather at the shrine for the sermon.')); }
  }
  // susza latem: skryba raz na dzień suszy mówi, że sady i pola rodzą mniej, i radzi studnie
  if (droughtAt(game)) {
    const day = clockAt(game.tick).day;
    if (droughtDay !== day) { droughtDay = day; scribe.say(`drought${day}`, tx('Panie, susza! Sady i pola rodzą dziś o połowę mniej. Studnia blisko sadu albo pola ratuje większość plonu.', 'My lord, a drought! Orchards and fields will yield half today. A well close to an orchard or field saves most of the harvest.')); }
  }
  // zaraza: skryba ogłasza wybuch (z przyciskiem do pierwszego chorego), zgony bez magów i koniec zarazy z liczbą ofiar
  if (p.plague && p.plague !== plagueSeen) {
    plagueSeen = p.plague;
    const m = magesOf(game, ME), any = m.water.length + m.fire.length + m.hut.length > 0;
    const first = game.units.find((u) => u.owner === ME && u.sick);
    scribe.say(`plague${p.plague}`, t(any ? 'scribe.plagueMages' : 'scribe.plague'), true, 'scribe', first ? showAt(first.px / 256, first.py / 256) : undefined);
  }
  if (p.plague && (p.plagueDead ?? 0) >= 3 && plagueToll !== p.plague) {
    const m = magesOf(game, ME);
    if (!m.water.length && !m.fire.length && !m.hut.length) { plagueToll = p.plague; scribe.say(`plagueToll${p.plague}`, t('scribe.plagueToll'), true); }
  }
  if (p.plagueOver && p.plagueOver.tick !== plagueOverSeen && game.tick - p.plagueOver.tick < 200) {
    plagueOverSeen = p.plagueOver.tick;
    scribe.say(`plagueOver${plagueOverSeen}`, t('scribe.plagueOver').replace('{n}', String(p.plagueOver.dead)));
  }
  // pełne magazyny: kto stoi, co leży pod drzwiami i co postawić (storeNotes.ts, logika w storage.ts)
  storeNotes(game, ME, scribe, showAt);
  // broń idzie do zbrojowni: gdy są warsztaty broni, a zbrojowni brak, skryba o tym mówi
  const myB = game.buildings.filter((b) => b.owner === ME && !b.build);
  const smiths = myB.some((b) => ['poleturner', 'fletcher', 'smithy', 'armorer'].includes(BUILDINGS[b.type]!.id));
  if (smiths && !myB.some((b) => BUILDINGS[b.type]!.stores?.includes('armory'))) scribe.say('noArmory', t('scribe.noArmory'));
  // dlaczego nikt nie przychodzi: skryba mówi wprost, co blokuje nowych osadników
  const pop = population(game, ME);
  if (p.popularity < 50 && pop <= 6) scribe.say('noComers', tx(`Nikt nie chce tu przyjść — popularność ${p.popularity}. Daj więcej jedzenia albo obniż podatki.`, `No one wishes to settle here — popularity is ${p.popularity}. Give more food or lower taxes.`), true);
  else if (p.popularity >= 50 && pop >= housing(game, ME)) scribe.say('noComers', tx('Ludzie by przyszli, ale nie ma dla nich dachu. Postaw chatę.', 'Folk would come, but there is no roof for them. Build a hovel.'));
  else if (p.popularity >= 50 && idleCount(game, ME) >= idleSlots(game, ME)) scribe.say('noComers', tx(`Przy ogniskach komplet (${idleSlots(game, ME)} miejsc) — nowi kopacze nie przyjdą, a nadmiarowi czekają pod chatami. Daj im pracę albo postaw kolejne obozowisko.`, `The campfires are full (${idleSlots(game, ME)} places) — no new labourers will come, and the surplus wait by the hovels. Give them work or build another camp.`));
  if (game.wolves.length && !wolvesSeen) scribe.say('wolves', tx('Wilki wyszły z lasu! Trzymajcie ludzi za palisadą.', 'Wolves have come out of the forest! Keep the people behind the palisade.'), true, 'herald');
  wolvesSeen = game.wolves.length > 0;
  if ((p.wolfKills ?? 0) > wolfKillsSeen) scribe.say('wolfKill', tx('Wilki zagryzły naszego człowieka…', 'Wolves have savaged one of our people…'), true);
  wolfKillsSeen = p.wolfKills ?? 0;
  banditNotes(p);
  winterNotes(p);
  const coming = alarm.dataset.state === 'coming';
  if (coming && !wasComing) { scribe.say('coming', t('alarm.coming'), true, 'herald'); warHorn(); }
  // nastroje ludzi wobec wojska
  const mine = game.soldiers.filter((x) => x.owner === ME).length;
  const theirs = game.soldiers.filter((x) => x.owner !== BANDITS).length - mine;
  // „dumni z wojska” wypadło z kroniki (27.10.2026) — skryba mówi tylko o brakach i zagrożeniach
  if (mine === 0 && theirs >= 3) scribe.say('afraid', t('herald.afraid'), true, 'herald');
  else if (theirs > mine * 2 && theirs >= 6) scribe.say('weaker', t('herald.weaker'), false, 'herald');
  wasComing = coming;
  alarmComing = coming;
  warnedHungry = !f.fed;
  warnedLeaving = p.popularity < 50;
  const affordable = new Set<string>();
  const locked = new Map<string, { need: string; building: boolean; tier?: number }>();
  const costs = new Map<string, Partial<Record<ResourceId, number>>>();
  for (const def of BUILDINGS) {
    if (canAfford(game, ME, def)) affordable.add(def.id);
    costs.set(def.id, buildCost(game, ME, BUILDINGS.indexOf(def)));
    const lock = missingRequirement(game, ME, def);
    if (lock) locked.set(def.id, lock);
  }
  const clock = clockAt(game.tick);
  hud.update({
    jumps: { barracks: jumpCount('barracks'), stockpile: jumpCount('stockpile'), granary: jumpCount('granary') },
    day: clock.day, hour: clock.hour, night: clock.night,
    weather: (() => { const w = weatherOf(game, rainAt(game.tick)); return { season: SEASON_NAME[w.season], temp: w.temp, note: stormAt(game) ? tx('burza', 'storm') : droughtAt(game) ? tx('susza', 'drought') : undefined }; })(),
    res: p.res, trend: resTrend(p.res), pop: population(game, ME), housing: housing(game, ME), popularity: p.popularity, idle: idleCount(game, ME), idleSlots: idleSlots(game, ME),
    stock: storeUsed(p, 'stockpile'), stockCap: storeCapacity(game, ME, 'stockpile'),
    food: storeUsed(p, 'granary'), foodCap: storeCapacity(game, ME, 'granary'),
    delta: f.delta, fed: f.fed, bribed: f.bribed, rations: p.rations, tax: p.tax, affordable, locked, costs,
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
  sampleMade(game, ME);
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
/** Porcja kroków w drodze do wątku: polecenia gracza i liczba kroków (do powtórki, gdy porcję trzeba odrzucić) */
const simInFlight = new SimBatch();
/**
 * Stan gry zmienił się w wątku głównym poza symulacją (panel dewelopera: surowce, przewinięcie czasu, nowe jednostki,
 * pożar…). Wątek dostaje ten stan od nowa. Porcja kroków, która właśnie się liczy, jest odrzucana (wynik ze starym
 * numerem `simGen` nie nadpisze zmiany) i liczy się jeszcze raz od nowego stanu, z tymi samymi poleceniami gracza
 * i tą samą liczbą kroków — nic nie ginie, gra traci najwyżej ułamek sekundy liczenia.
 */
function resyncSim(): void {
  if (!simMode) return;
  if (simBusy) {
    const back = simInFlight.cancel();
    pending = [...back.cmds, ...pending];
    acc += back.ticks * TICK_MS;
    simBusy = false;
  }
  simInFlight.done();
  simGen++;
  simThread!.set(game, simGen);
}
function onSimResult(r: SimResult): void {
  if (r.gen !== simGen || !simMode) return;
  simBusy = false;
  simInFlight.done();
  renderer.snapshot(); // pozycje sprzed porcji kroków: ruch płynny między tickami
  const map = game.map;
  // wycinka lasu i wyczerpane złoża: jedyne zmiany mapy w symulacji — nanosimy je na naszą kopię mapy
  for (let i = game.cut.length; i < r.state.cut.length; i++) applyCut(map.tiles, r.state.cut[i]!);
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
  simThread.onError = () => {
    if (simMode) console.warn('Wątek symulacji niedostępny — liczę w wątku głównym');
    // porcja w drodze przepada razem z wątkiem: jej polecenia i kroki liczy teraz wątek główny
    const back = simInFlight.cancel();
    pending = [...back.cmds, ...pending]; acc += back.ticks * TICK_MS;
    simMode = false; simBusy = false; simBroken = true;
  };
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
  if (entering) {
    // ekran wczytywania: świat rysuje się pod zasłoną (wgrywa się wszystko, co widać), czas gry stoi
    last = now;
    renderer.frame(elapsed / 1000, 1, true);
    requestAnimationFrame(loop);
    return;
  }
  // automat jakości mierzy tylko prawdziwą grę: puste klatki menu podbijały go i po wejściu gra przycinała
  if (gfx.auto && !document.hidden && !(menu.isOpen() && !renderer.isPreviewing)) {
    const tier = autoQ.frame(now - last);
    if (tier !== null) {
      gfx.autoTier = tier;
      if (!SANDBOX) saveSettings(gfx);
      applySettings(gfx);
    }
  }
  last = now;
  // pauza (tempo 0 albo menu w trakcie gry) wycisza odgłosy świata; na ekranie tytułowym i w meczu przez sieć świat brzmi dalej
  setGamePaused(!net && !titleScreen && (speed === 0 || menu.isOpen()));
  if (renderer.inMineWalk) caveSounds(0, renderer.minePicks);
  else {
    nature(renderer.weather.night, renderer.weather.rain, menu.isOpen(), renderer.wolvesNear);
    if (daySounds(clockAt(game.tick).hour, renderer.weather.rain, menu.isOpen())) renderer.lightning();
    // dzwonek kapliczki o zmierzchu, gdy jest kaznodzieja: zaczyna się kazanie (w święto dłużej)
    { const hr = clockAt(game.tick).hour; if (lastHourBell < RULES.eveningHour && hr >= RULES.eveningHour && hr < RULES.eveningHour + 0.5 && preached(game, ME)) shrineBell(feastDay(game) ? 6 : 3); lastHourBell = hr; }
    // piorun w budynek (storms.ts): kanał z chmur, błysk i trzask; w swój budynek — skryba z przyciskiem do pożaru
    for (const pl of game.players) {
      const st = pl.lastStrike;
      if (!st || strikesSeen.get(pl.id) === st.tick) continue;
      strikesSeen.set(pl.id, st.tick);
      if (game.tick - st.tick > 30) continue; // stary piorun z wczytanego zapisu
      renderer.strike(st.x, st.y);
      thunderClap();
      if (pl.id === ME) {
        const hit = game.buildings.find((x) => x.id === st.building);
        const name = hit ? t(BUILDINGS[hit.type]!.name).toLowerCase() : '';
        scribe.say(`strike${st.tick}`, tx(`Panie, piorun trafił w budynek: ${name}! Pali się — ludzie biegną z wiadrami.`, `My lord, lightning has struck the ${name}! It is burning — the folk are running with buckets.`), true, 'scribe', showAt(st.x, st.y));
      }
    }
  }
  music(renderer.weather.night, alerts.length > 0 || alarmComing, menu.isOpen(), renderer.walking);
  // otwarte menu wstrzymuje grę
  // w meczu przez sieć menu nie zatrzymuje czasu — inni gracze grają dalej
  if (menu.isOpen() && !net) {
    // menu główne zasłania świat w całości (bez osady pod spodem, tylko podgląd mapy przy nowej grze)
    if (renderer.isPreviewing) { renderer.orbit(elapsed / 1000); renderer.frame(elapsed / 1000, 1); }
    // menu pauzy w trakcie gry: pod spodem widać wstrzymaną osadę (woda, ogień i niebo dalej żyją), żeby nie mylić go z menu głównym
    else if (!titleScreen && !gameOver) renderer.frame(elapsed / 1000, 1, true);
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
      simInFlight.sent(cmds, n);
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
    // wykonane polecenie powrotu, które wydaliśmy: wracający dostaje stan gry z tej chwili (po turze, u wszystkich taki sam)
    if (net && netGame) for (const c of cmds) if (c.type === 'rejoin' && c.player === ME) { const turn = (game.tick - 1) / TURN; sendState(netGame.link, c.who, turn, serialize(game, currentPreset), net.exportNet(turn)); }
    perf.sim += performance.now() - ts; perf.ticks++;
    acc -= TICK_MS;
    steps++;
    if (game.tick % 50 === 0) save();
  }
  if (steps === 6) acc = 0;
  if (net) {
    if (net.desync && !netNotes.desync) { netNotes.desync = true; hud.toast(tx('Uwaga: gry u Was się rozjechały (różny stan). Wyniki mogą się nie zgadzać — zacznijcie nowy mecz.', 'Warning: your games have fallen out of sync. Results may not match — start a new match.')); }
    if (net.left.length > netNotes.left) {
      const who = net.left.slice(netNotes.left).map((i) => { const x = netGame?.slots[i]; return x?.kind === 'human' ? x.nick : tx(`gracz ${i + 1}`, `player ${i + 1}`); });
      netNotes.left = net.left.length;
      hud.toast(tx(`${who.join(', ')} ${who.length > 1 ? 'stracili' : 'stracił'} połączenie albo ${who.length > 1 ? 'się poddali' : 'się poddał'}. Po zerwanym połączeniu zamkiem rządzi bot, dopóki gracz nie wróci do meczu.`, `${who.join(', ')} lost connection or surrendered. After a lost connection a bot holds the keep until the player returns.`));
    }
    if (net.back.length > netNotes.back) {
      const who = net.back.slice(netNotes.back).map((i) => { rejoinAsked.delete(i); const x = netGame?.slots[i]; return x?.kind === 'human' ? x.nick : tx(`gracz ${i + 1}`, `player ${i + 1}`); });
      netNotes.back = net.back.length;
      hud.toast(tx(`${who.join(', ')} ${who.length > 1 ? 'wrócili' : 'wrócił'} do meczu — bot oddał zamek.`, `${who.join(', ')} rejoined the match — the bot handed back the keep.`));
    }
    // inni uznali nas za rozłączonych (długo nie dochodziły nasze polecenia): wracamy do meczu od nowa
    if (net.kicked && netGame) {
      const memo = recallMatch();
      endOnline(false);
      hud.toast(tx('Połączenie było zerwane i zamek przejął bot — wracam do meczu…', 'The connection dropped and a bot took the keep — rejoining the match…'));
      if (memo) void backToMatch(memo);
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
if (saved && restored) {
  start(saved.seedText, saved.data.preset, restored);
  // kamera z zapisu dopiero na gotowym terenie (budowa etapami ustawia granice kamery i widok na końcu)
  const ui = saved.ui;
  if (bootWorld) void bootWorld.then(() => applyUi(ui), () => applyUi(ui)); else applyUi(ui);
}
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
} else if (!SANDBOX) {
  // mecz przez sieć przerwany odświeżeniem albo zamknięciem karty: okienko z powrotem do niego
  const memo = recallMatch();
  if (memo) offerReturn(memo);
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
  /** Podgląd stawiania (duch budynku ze strzałką wyjścia) na polu x, y, jak przy najechaniu kursorem; ghost(null) chowa */
  ghost(id: string | null, x = 0, y = 0, rot = 0): void {
    placeRot = rot;
    pick(id);
    hoverTile = id ? { x, y } : null;
    updateGhost();
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
  /** Piorun od ręki: trafia w budynek o tym id (albo w pierwszy drewniany budynek gracza) i podpala go */
  strike(id = 0, player = ME): boolean {
    const b = game.buildings.find((x) => (id ? x.id === id : x.owner === player && !x.build && !['keep', 'well'].includes(BUILDINGS[x.type]!.id)));
    if (!b) return false;
    const fp = footprint(BUILDINGS[b.type]!, b.rot);
    b.fire = Math.max(b.fire ?? 0, 600);
    game.players[b.owner]!.lastStrike = { tick: game.tick, building: b.id, x: b.x + fp.w / 2, y: b.y + fp.h / 2 };
    refresh();
    return true;
  },
  /** Żołnierz od ręki w polu (x, y): rodzaj z UNITS (np. 'mageFire', 'mageWater', 'spearman'), właściciel; zwraca id */
  soldier(kind: string, x: number, y: number, player = ME): number {
    const k = unitIndex(kind), def = UNITS[k];
    if (!def) return 0;
    const id = game.nextId++;
    game.soldiers.push({ id, owner: player, kind: k, px: x * 256 + 128, py: y * 256 + 128, path: [], hp: def.hp, goal: -1, wait: 0, target: 0, cd: 0 });
    refresh();
    return id;
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
  /** Zaraza od ręki: tylu ludzi gracza zaczyna chorować (gorączka po chwili wylęgania; `fever` = od razu w gorączce) */
  plague(n = 4, fever = false, player = ME): number { const k = startPlague(game, player, n); if (fever) for (const u of game.units) if (u.owner === player && u.sick && (u.sickFrom ?? 0) > game.tick) { u.sick -= u.sickFrom! - game.tick; u.sickFrom = game.tick; } refresh(); return k; },
  /** Bunt głodowy od ręki: pusty licznik głodu dobity do progu, tłum zbiera się przy następnym przejściu symulacji */
  riot(player = ME): void { const p = game.players[player]; if (p) { p.famine = RULES.revoltMeals; step(game, []); refresh(); } },
  /** Obóz zbójów ze środkiem w (x, y) z czterema zbójami (pusta scena: zbóje napadają dopiero od 2. dnia, poziom pokojowy ich nie zatrzymuje); id obozu albo null */
  den(x: number, y: number): number | null { const b = placeDen(game, x, y); refresh(); return b?.id ?? null; },
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
  /** Zawala budynek o tym id w ruinę (gruz spada w fizyce) — do sprawdzania gruzu na pustej scenie */
  raze(id: number): boolean { const b = game.buildings.find((x) => x.id === id); if (!b) return false; ruin(game, b); refresh(); return true; },
  state: () => game,
  /** Tempo gry (0 = pauza, czas w obrazie stoi) */
  speed(n: number): void { speed = n; hud.setSpeed(n); },
  /** Spis sceny 3D do porównań przy przebudowie kodu rysowania (src/debug/census.ts) */
  census: () => census((renderer as unknown as { scene: Parameters<typeof census>[0] }).scene),
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
badge.textContent = `${tx('wersja', 'version')} ${__BUILD__}`;
document.body.append(badge);

/** Wywoływane z ekranu wczytywania: kompilacja shaderów i pierwsza klatka jeszcze przed menu */
export function warmup(onProgress?: (done: number, total: number) => void): Promise<void> { return renderer.warmup(onProgress); }

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
  el.title = kind === 'wolf' ? tx('Wilki atakują — pokaż', 'Wolves attacking — show') : tx('Atak wroga — pokaż', 'Enemy attack — show');
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
    hud.toast(tx(`Grupa ${n}: ${chosen.size} ${chosen.size === 1 ? 'żołnierz' : chosen.size % 10 >= 2 && chosen.size % 10 <= 4 && (chosen.size % 100 < 10 || chosen.size % 100 >= 20) ? 'żołnierze' : 'żołnierzy'}. Wybierasz ją klawiszem ${n}.`, `Company ${n}: ${chosen.size} ${chosen.size === 1 ? 'soldier' : 'soldiers'}. Press ${n} to select it.`));
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
  const key = `${mine.length > 0}|${gl.map((g) => `${g.n}:${g.count}:${g.kind}`).join()}|${active}|${sel.map((x) => `${x.id}:${x.hp}:${groupOfUnit(x.id)}`).join()}`;
  if (key === armyBarKey) return;
  armyBarKey = key;
  hud.setArmyBar({ show: mine.length > 0 || groups.size > 0, groups: gl, active, selected: sel.map((x) => ({ id: x.id, kind: UNITS[x.kind]!.id, hp: x.hp, max: UNITS[x.kind]!.hp, name: t(UNITS[x.kind]!.name), group: groupOfUnit(x.id) })) });
}
setInterval(() => { if (game) armyBarUpdate(); }, 250);
/** ?test=1&plan=1: przewodnik widoczny także w trybie testowym (do sprawdzania wyglądu) */
const TUT_TEST = new URLSearchParams(location.search).has('plan');
// „Plan na start”: przewodnik w grze (tylko zwykła gra solo — bez trybu deweloperskiego, testowego i gry przez sieć)
const tutorial = createTutorial(() => {
  if (!game) return null;
  const counts = new Map<string, number>();
  for (const b of game.buildings) if (b.owner === ME) { const id = BUILDINGS[b.type]!.id; counts.set(id, (counts.get(id) ?? 0) + 1); }
  let soldiers = 0;
  for (const u of game.soldiers) if (u.owner === ME) soldiers++;
  return { count: (id) => counts.get(id) ?? 0, soldiers: () => soldiers };
}, () => play('build'));
setInterval(() => {
  const p = game?.players[ME];
  tutorial.show(!!game && !!p && !p.dev && (!SANDBOX || TUT_TEST) && !netGame && !endShown && !document.body.classList.contains('menu-open') && !document.body.classList.contains('walking'));
  tutorial.update();
}, 400);

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
const SHOUT_PL: Record<string, Record<'select' | 'move' | 'attack', string[]>> = {
  spearman: {
    select: ['Słucham, panie.', 'Rozkazuj.', 'Włócznie gotowe.', 'Czego trzeba?', 'Jesteśmy.'],
    move: ['Tak jest!', 'Idziemy.', 'Szykiem, marsz!', 'Ruszać się, chłopy!', 'Według rozkazu.'],
    attack: ['Na nich!', 'Bij!', 'Za pana!', 'Włócznie naprzód!', 'Nie dać im tchu!'],
  },
  manatarms: {
    select: ['Stal gotowa, panie.', 'Słucham.', 'Zbroja dopięta.', 'Kogo mamy rozbić?', 'Czekamy na rozkaz.'],
    move: ['Idziemy, równo!', 'Tak jest.', 'Ciężko, ale idziemy.', 'Szyk trzymać!', 'Według rozkazu, panie.'],
    attack: ['Miecze w dłoń!', 'Rąbać!', 'Za pana, bez litości!', 'Nie cofać się!', 'Na nich, chłopy!'],
  },
  sapper: {
    select: ['Kilof ostry, panie.', 'Słucham.', 'Co rozbieramy?', 'Łom gotowy.', 'Jesteśmy.'],
    move: ['Idziemy.', 'Tak jest.', 'Narzędzia na plecy!', 'Już się robi.'],
    attack: ['Rozbierać do gołej ziemi!', 'Co się nada, do zamku!', 'Belki, kamień — wszystko bierzemy!', 'Do roboty, chłopy!'],
  },
  archer: {
    select: ['Łuk napięty.', 'Słucham.', 'Strzały gotowe.', 'Cel, panie?', 'Patrzymy.'],
    move: ['Idziemy, panie.', 'Zmieniamy miejsce.', 'Tak jest.', 'Za mną, chłopy.'],
    attack: ['Napinaj!', 'Puszczaj!', 'Celuj w gardło!', 'Grad strzał!', 'Ognia, znaczy… strzelaj!'],
  },
};
const SHOUT_EN: Record<string, Record<'select' | 'move' | 'attack', string[]>> = {
  spearman: {
    select: ['Aye, my lord.', 'Command us.', 'Spears ready.', 'What is needed?', 'We are here.'],
    move: ['Aye!', 'On our way.', 'In formation, march!', 'Move it, lads!', 'As you command.'],
    attack: ['At them!', 'Strike!', 'For our lord!', 'Spears forward!', 'Give them no quarter!'],
  },
  manatarms: {
    select: ['Steel ready, my lord.', 'Aye?', 'Mail\'s buckled.', 'Who do we break?', 'Awaiting orders.'],
    move: ['Steady, march!', 'Aye.', 'Heavy going, but going.', 'Hold the line!', 'As you command, my lord.'],
    attack: ['Swords out!', 'Cut them down!', 'For our lord, no mercy!', 'Not one step back!', 'At them, lads!'],
  },
  sapper: {
    select: ['Pick\'s sharp, my lord.', 'Aye?', 'What are we pulling down?', 'Crowbar ready.', 'We\'re here.'],
    move: ['On our way.', 'Aye.', 'Tools on your backs!', 'Right away.'],
    attack: ['Strip it to the ground!', 'Anything useful goes to the keep!', 'Beams, stone — take it all!', 'To work, lads!'],
  },
  archer: {
    select: ['Bow drawn.', 'Aye?', 'Arrows ready.', 'Target, my lord?', 'Watching.'],
    move: ['On our way, my lord.', 'Changing position.', 'Aye.', 'Follow me, lads.'],
    attack: ['Draw!', 'Loose!', 'Aim for the throat!', 'Rain of arrows!', 'Fire— er, loose!'],
  },
};
const SHOUT = lang() === 'en' ? SHOUT_EN : SHOUT_PL;
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
  if (game.soldiers.some((o) => game.players[o.owner]?.team !== p.team && d2(o.px, o.py) < R2(14))) return 'enemy';
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
  // buntownik pod bramą krzyczy swoje, bez względu na resztę
  if (u.riot) return pick('revolt');
  // zaraza: leżący w gorączce kaszle i jęczy; zdrowi w czasie zarazy częściej o niej mówią
  if (u.sick && game.tick >= (u.sickFrom ?? 0)) return pick('fever');
  if (p.plague && !u.job && Math.random() < 0.5) return pick('plague');
  if (p.plague && Math.random() < 0.25) return pick('plague');
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
  const near = game.soldiers.some((o) => game.players[o.owner]?.team !== game.players[s.owner]?.team && (o.px - s.px) ** 2 + (o.py - s.py) ** 2 < (8 * 256) ** 2) || game.wolves.some((w) => (w.px - s.px) ** 2 + (w.py - s.py) ** 2 < (8 * 256) ** 2);
  const sit = game.players[s.owner]?.revolt && Math.random() < 0.6 ? 'revolt' : situation(s.px, s.py);
  const extra = sit === 'lord' ? GUARD_SAY.lord : sit === 'cold' ? GUARD_SAY.cold : sit === 'fire' ? GUARD_SAY.fire : sit === 'rain' ? GUARD_SAY.rain : sit === 'hungry' ? GUARD_SAY.hungry : sit === 'revolt' ? GUARD_SAY.revolt : sit === 'taxHigh' ? GUARD_SAY.taxHigh : null;
  bubble.textContent = pick(near || sit === 'enemy' ? GUARD_SAY.danger : extra ?? (clockAt(game.tick).night ? GUARD_SAY.night : GUARD_SAY.day));
  bubble.hidden = false;
  sayUnit = id;
  sayUntil = performance.now() + 3200;
  talk(bubble.textContent ?? '', id, true);
}
const isBandit = (id: number): boolean => { const s = game.soldiers.find((x) => x.id === id); return !!s && !!UNITS[s.kind]!.bandit; };
/** Zbój z puszczy: zaczepia przy napadzie, odgraża się w walce, w obozie drwi (za dnia) albo straszy (nocą); po spaleniu obozu ucieka */
function sayBandit(id: number): void {
  const s = game.soldiers.find((x) => x.id === id);
  if (!s) return;
  const pick = (l: string[]): string => l[Math.floor(Math.random() * l.length)]!;
  const foe = s.target ? game.soldiers.find((o) => o.id === s.target) : undefined;
  const lines = s.den === -1 ? BANDIT_SAY.flee : foe ? BANDIT_SAY.fight : s.raid || s.hitting ? BANDIT_SAY.raid : clockAt(game.tick).night ? BANDIT_SAY.night : BANDIT_SAY.camp;
  bubble.textContent = pick(lines);
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
  // zbóje z puszczy blisko kamery też się odzywają (napad, walka, obóz)
  const bandits = game.soldiers.filter((s) => s.owner === BANDITS && near(s.px, s.py));
  const pool = [...people.map((u) => ['u', u.id] as const), ...guards.map((s) => ['g', s.id] as const), ...bandits.map((s) => ['b', s.id] as const)];
  if (!pool.length) return;
  const [kind, id] = pool[Math.floor(Math.random() * pool.length)]!;
  if (kind === 'g') sayGuard(id); else if (kind === 'b') sayBandit(id); else speak(id);
}
// --- numery grup nad oddziałami: złota cyfra na ciemnej tarczy nad środkiem grupy (tylko moje, żywe, nie na wieżach) ---
const groupTags = new Map<number, HTMLDivElement>();
let groupTagMembers = new Map<number, number[]>();
let groupTagAt = 0;
function syncGroupTags(): void {
  const now = performance.now();
  // skład grup liczymy rzadziej (co 0,25 s), położenie co klatkę
  if (now - groupTagAt > 250) {
    groupTagAt = now;
    const mine = new Set(game.soldiers.filter((x) => x.owner === ME && !x.post).map((x) => x.id));
    groupTagMembers = new Map([...groups].map(([n, ids]) => [n, ids.filter((id) => mine.has(id))] as [number, number[]]).filter(([, l]) => l.length > 0));
  }
  const hide = menu.isOpen() || titleScreen || renderer.walking || gfx.groupTags === false;
  const byId = new Map(game.soldiers.map((x) => [x.id, x]));
  for (const [n, tag] of groupTags) if (hide || !groupTagMembers.has(n)) tag.hidden = true;
  if (hide) return;
  for (const [n, ids] of groupTagMembers) {
    let x = 0, y = 0, k = 0;
    // położenie tak, jak żołnierze są narysowani (płynnie między tickami), a nie skokami co tick symulacji
    for (const id of ids) { const s = byId.get(id); if (s) { const at = renderer.smoothTile(s.id, s.px, s.py); x += at.x; y += at.y; k++; } }
    if (!k) continue;
    let tag = groupTags.get(n);
    if (!tag) {
      tag = document.createElement('div');
      tag.className = 'group-tag';
      tag.textContent = String(n);
      tag.setAttribute('aria-hidden', 'true');
      document.body.append(tag);
      groupTags.set(n, tag);
    }
    const p = renderer.project(x / k, y / k);
    tag.hidden = !p.front;
    tag.classList.toggle('on', ids.some((id) => chosen.has(id)));
    tag.style.transform = `translate(${Math.round(p.sx)}px, ${Math.round(p.sy - 58)}px) translate(-50%, -100%)`;
  }
}
function sayLoop(): void {
  chatter();
  if (game) syncGroupTags();
  if (!bubble.hidden) {
    const u = game.units.find((x) => x.id === sayUnit) ?? game.soldiers.find((x) => x.id === sayUnit);
    if (!u || performance.now() > sayUntil || menu.isOpen()) bubble.hidden = true;
    else { const at = renderer.smoothTile(u.id, u.px, u.py), p = renderer.project(at.x, at.y); bubble.style.transform = `translate(${p.sx}px, ${p.sy - 40}px) translate(-50%, -100%)`; }
  }
  requestAnimationFrame(sayLoop);
}
requestAnimationFrame(sayLoop);

/** Rozpiska do panelu: składniki popularności i podział ludności */
function buildReport(f: ReturnType<typeof monthlyForecast>, trend: number[]): HudView['report'] {
  const LBL: Record<string, string> = lang() === 'en'
    ? { food: 'Food rations', tax: 'Taxes', tavern: 'Tavern (ale from the brewery)', crowd: 'Overcrowded hovels', rough: 'Sleeping on straw under the open sky', cold: 'Chilled in the rain', winter: 'Cold (season)', freezing: 'No firewood — freezing in their hovels', revolt: 'Bread riot at the keep gate', shrine: 'Shrines (evening prayers)', plague: 'Plague in the settlement (fear)', mages: 'Mages watching over the sick', quarrel: 'The two orders quarrelling (seats too close)', quarantine: 'Hovels shut for quarantine', sermon: 'Preacher\'s evening sermon', feast: 'Feast day at the shrine', graves: 'The dead buried in the woods (no cemetery)' }
    : { food: 'Racje jedzenia', tax: 'Podatki', tavern: 'Karczma (piwo z browaru)', crowd: 'Ciasnota w chatach', rough: 'Spanie na słomie pod gołym niebem', cold: 'Zmarznięci w deszczu', winter: 'Zimno (pora roku)', freezing: 'Brak drewna na opał — marzną w chatach', revolt: 'Bunt głodowy pod bramą twierdzy', shrine: 'Kapliczki (wieczorne modły)', plague: 'Zaraza w osadzie (strach)', mages: 'Magowie czuwają nad chorymi', quarrel: 'Kłótnie zakonów (siedziby za blisko siebie)', quarantine: 'Chaty zamknięte na kwarantannę', sermon: 'Wieczorne kazanie kaznodziei', feast: 'Święto pod kapliczką', graves: 'Zmarli pochowani w lesie (brak cmentarza)' };
  const popularity = f.parts.map((x) => ({ label: LBL[x.key] ?? x.key, value: x.value, note: x.level ? `(${t(x.level).toLowerCase()})` : undefined }));
  if (!f.fed) popularity.push({ label: tx('Brak jedzenia na wybrane racje', 'Not enough food for the chosen rations'), value: 0, note: tx('(jedzą mniej)', '(they eat less)') });
  const mine = game.units.filter((u) => u.owner === ME);
  const jobs = new Map<string, number>();
  let idle = 0, builders = 0, sick = 0;
  for (const u of mine) {
    if (u.sick && game.tick >= (u.sickFrom ?? 0)) { sick++; continue; }
    if (u.phase === 13 || u.phase === 14) { builders++; continue; }
    if (!u.job) { idle++; continue; }
    const b = game.buildings.find((x) => x.id === u.job);
    const name = b ? t(BUILDINGS[b.type]!.name) : '?';
    jobs.set(name, (jobs.get(name) ?? 0) + 1);
  }
  const people: { label: string; value: number }[] = [{ label: tx('Wszyscy chłopi', 'All peasants'), value: mine.length }, { label: tx('Kopacze bez fachu', 'Unskilled labourers'), value: idle }, { label: tx('Na budowie', 'On building sites'), value: builders }];
  if (sick) people.push({ label: tx('Leżą w gorączce', 'Laid low with fever'), value: sick });
  { const tr = game.players[ME]!.tier ?? 0, next = RULES.tiers[tr + 1]; people.unshift({ label: tx(`Etap osady: ${TIER_NAMES()[tr]}${next ? ` (następny od ${next} ludzi)` : ''}`, `Settlement stage: ${TIER_NAMES()[tr]}${next ? ` (next at ${next} people)` : ''}`), value: tr + 1 }); }
  for (const [k, v] of [...jobs.entries()].sort((a, b) => b[1] - a[1])) people.push({ label: k, value: v });
  const coming = game.travelers.filter((x) => x.owner === ME && !x.leaving).length, going = game.travelers.filter((x) => x.owner === ME && x.leaving).length;
  if (coming) people.push({ label: tx('W drodze do osady', 'On their way to the settlement'), value: coming });
  if (going) people.push({ label: tx('Odchodzą', 'Leaving'), value: going });
  const mySoldiers = game.soldiers.filter((s) => s.owner === ME);
  const army: { label: string; value: number }[] = [{ label: tx('Razem', 'Total'), value: mySoldiers.length }];
  for (const [k, def] of UNITS.entries()) { const n = mySoldiers.filter((s) => s.kind === k).length; if (n) army.push({ label: t(def.name), value: n }); }
  const hurt = mySoldiers.filter((s) => s.hp < UNITS[s.kind]!.hp).length;
  army.push({ label: tx('Ranni', 'Wounded'), value: hurt });
  army.push({ label: tx('W walce', 'In combat'), value: mySoldiers.filter((s) => s.target || s.hunt).length });
  const p0 = game.players[ME]!;
  army.push({ label: tx('Polegli od początku', 'Fallen since the start'), value: p0.stats.lost }, { label: tx('Zabici wrogowie', 'Enemies slain'), value: p0.stats.kills });
  // spichlerz: zapotrzebowanie, zapas, prognoza
  const pop = population(game, ME);
  const lvl = RULES.rations[p0.rations]!;
  const perMonthWant = Math.ceil((pop * lvl.foodPer8) / 8);
  const perDayWant = perMonthWant * MEALS_PER_DAY;
  const have = foodTotal(p0); // porcje (ryba liczy się podwójnie)
  const net = FOOD_RES_ALL.reduce((n, i) => n + (trend[i] ?? 0) * (FOOD_VALUE[RESOURCES[i]!] ?? 1), 0); // zmiana z ostatnich ok. 600 ticków (1/6 doby)
  const mineB = game.buildings.filter((b) => b.owner === ME && !b.build);
  const count = (id: string, worked = true): number => mineB.filter((b) => BUILDINGS[b.type]!.id === id && (!worked || b.worker) && !b.off).length;
  // piekarnie liczone tyle, ile starcza im mąki z młynów i zboża z pól (młyn ok. 8 piekarni, pole ok. 1,5 piekarni)
  const bakeries = Math.min(count('bakery'), (count('mill') * GRAIN_PER_DAY.mill) / GRAIN_PER_DAY.bakery, (count('farm') * GRAIN_PER_DAY.farm) / GRAIN_PER_DAY.bakery);
  const made = Math.round(count('orchard') * FOOD_PER_DAY.orchard! + count('fisher') * FOOD_PER_DAY.fisher! + bakeries * FOOD_PER_DAY.bakery!);
  const perPerson = (lvl.foodPer8 / 8) * MEALS_PER_DAY;
  const feeds = perPerson > 0 ? Math.floor(made / perPerson) : 0;
  const lasts = perDayWant > 0 ? have / perDayWant : Infinity;
  const fmtLast = (d: number): string => d === Infinity ? tx('bez końca', 'indefinitely') : d >= 2 ? `${Math.floor(d)} ${tx('dni', 'days')}` : d >= 1 ? tx('1 dzień', '1 day') : `${Math.max(0, Math.floor(d * 24))} ${tx('godz.', 'h')}`;
  const food: NonNullable<HudView['report']>['food'] = [
    { label: tx('Jedzących', 'Mouths to feed'), value: String(pop), note: `(${tx('racje', 'rations')}: ${t(lvl.name).toLowerCase()})` },
    ...(p0.hungry ? [{ label: tx('Głód!', 'Famine!'), value: tx('odchodzą', 'leaving'), sign: 'minus' as const, note: tx('(zabrakło jedzenia — póki go nie ma, ludzie opuszczają osadę)', '(the food has run out — until there is more, people are abandoning the settlement)') }] : []),
    ...(p0.revolt ? [{ label: tx('Bunt!', 'Riot!'), value: tx(`${game.units.filter((u) => u.owner === ME && u.riot).length} pod bramą`, `${game.units.filter((u) => u.owner === ME && u.riot).length} at the gate`), sign: 'minus' as const, note: tx('(nie pracują, póki się nie najedzą; pomagają większe racje i straż)', '(no work until they are fed; better rations and the watch help)') }] : []),
    { label: tx('Zjadają co miesiąc', 'Eaten each month'), value: `${perMonthWant} ${tx('porcji', 'portions')}`, note: tx('(rozliczenie)', '(reckoning)') },
    { label: tx('Zjadają na dobę', 'Eaten per day'), value: `${perDayWant} ${tx('porcji', 'portions')}`, note: `(${perPerson.toFixed(perPerson % 1 ? 1 : 0)} ${tx('na osobę', 'per head')})` },
    { label: tx('W spichlerzach', 'In the granaries'), value: `${storeUsed(p0, 'granary')} / ${storeCapacity(game, ME, 'granary')}`, note: tx(`(${have} porcji: jabłko 1, chleb 2, ryba 3)`, `(${have} portions: apple 1, bread 2, fish 3)`) },
    { label: tx('Zapas starczy na', 'Stores will last'), value: fmtLast(lasts), sign: lasts < 0.5 ? 'minus' : lasts >= 2 ? 'plus' : undefined },
    { label: tx('Gospodarstwa dają na dobę', 'Farms yield per day'), value: `${tx('ok.', 'c.')} ${made}`, note: tx(`(sady ${count('orchard')}, rybacy ${count('fisher')}, piekarnie ${count('bakery', false)})`, `(orchards ${count('orchard')}, fishermen ${count('fisher')}, bakeries ${count('bakery', false)})`) },
    { label: tx('Wykarmią', 'Enough to feed'), value: tx(`ok. ${feeds} osób`, `c. ${feeds} people`), sign: feeds < pop ? 'minus' : 'plus' },
    { label: tx('Bilans teraz', 'Current balance'), value: `${net * 6 > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net * 6)} ${tx('na dobę', 'per day')}`, sign: net < 0 ? 'minus' : net > 0 ? 'plus' : undefined, note: tx('(z ostatnich 4 godzin)', '(over the last 4 hours)') },
  ];
  const lack = Math.max(0, Math.ceil((pop * perPerson - made) / FOOD_PER_DAY.orchard!));
  const perOrchard = Math.floor(FOOD_PER_DAY.orchard! / (perPerson || 1)), perFisher = Math.floor(FOOD_PER_DAY.fisher! / (perPerson || 1)), perBakery = Math.floor(FOOD_PER_DAY.bakery! / (perPerson || 1));
  const granaryCap = BUILDINGS.find((b) => b.id === 'granary')?.capacity?.granary ?? 0;
  const foodHint = lang() === 'en'
    ? (lack > 0 ? `Food is short for ${pop - feeds} people — build about ${lack} more ${lack === 1 ? 'orchard' : 'orchards'} (or shut down a less vital building so its worker moves to an orchard). ` : '')
      + `One orchard feeds about ${perOrchard} people, a fisherman about ${perFisher}, a bakery with its supply chain about ${perBakery} (one mill serves about 5 farms and 8 bakeries). One granary holds ${granaryCap}.`
    : (lack > 0 ? `Brakuje jedzenia dla ${pop - feeds} osób — postaw jeszcze ok. ${lack} ${lack === 1 ? 'sad' : lack < 5 ? 'sady' : 'sadów'} (albo wyłącz mniej ważny budynek, żeby pracownik poszedł do sadu). ` : '')
      + `Jeden sad wykarmi ok. ${perOrchard} osób, rybak ok. ${perFisher}, piekarnia z zapleczem ok. ${perBakery} (młyn obsłuży ok. 5 pól i 8 piekarni). Jeden spichlerz mieści ${granaryCap}.`;
  return { popularity, people, army, food, foodHint };
}

/** Okno na środku ekranu: czy na pewno rozebrać, co wróci do składu (połowa kosztu, wynoszona z gruzu) */
function confirmDemolish(id: number): void {
  const b = game.buildings.find((x) => x.id === id);
  if (!b) return;
  // Ustawienia → Rozgrywka: bez pytania rozbiera od razu
  if (gfx.confirmDemolish === false) { pending.push({ type: 'demolish', player: ME, id }); play('demolish'); select(0); return; }
  const def = BUILDINGS[b.type]!;
  const ruinNote = tx('Porzucona ruina nic nie zwraca — zostanie sam gruz, a po jego wyniesieniu miejsce jest wolne pod nowy budynek.', 'Abandoned ruins return nothing — only rubble is left, and once it is cleared the ground is free to build on.');
  const back = b.ruined ? [] : (Object.entries(def.cost) as [ResourceId, number][]).map(([r, n]) => `${Math.floor((n * RULES_REFUND) / 100)} × ${t(`res.${r}`).toLowerCase()}`);
  const box = document.createElement('div');
  box.className = 'confirm-wrap';
  box.innerHTML = `<div class="panel confirm" role="alertdialog" aria-modal="true" aria-labelledby="cf-t">
    <p class="confirm-title" id="cf-t">${b.ruined ? tx('Porzucić ruinę', 'Abandon the ruins') : tx('Rozebrać', 'Demolish')}: ${t(def.name)}?</p>
    <p>${b.ruined ? ruinNote : back.length ? tx(`Odzyskasz <strong>${back.join(', ')}</strong> — ludzie wyniosą to z gruzu do składu.`, `You will recover <strong>${back.join(', ')}</strong> — your people will carry it from the rubble to the stockpile.`) : tx('Nic nie odzyskasz.', 'Nothing will be recovered.')}</p>
    ${b.worker ? `<p>${tx('Pracownik straci robotę i wróci do obozowiska.', 'The worker will lose his post and return to the camp.')}</p>` : ''}
    <div class="confirm-btns"><button type="button" class="menu-btn menu-back" data-no>${tx('Nie', 'No')}</button><button type="button" class="menu-btn" data-yes>${b.ruined ? tx('Tak, porzuć', 'Yes, abandon them') : tx('Tak, rozbierz', 'Yes, tear it down')}</button></div>
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
// dziennik błędów gry i grafiki (src/debug/errlog.ts): ostatnie wpisy pod licznikami i kopiowanie całości
const perfErr = document.createElement('div');
perfErr.className = 'perf-err';
const perfErrList = document.createElement('pre');
const perfErrCopy = document.createElement('button');
perfErrCopy.type = 'button';
perfErrCopy.textContent = tx('Kopiuj dziennik błędów', 'Copy error log');
perfErrCopy.addEventListener('click', () => {
  void navigator.clipboard?.writeText(errText()).then(() => { perfErrCopy.textContent = tx('Skopiowano', 'Copied'); setTimeout(() => { perfErrCopy.textContent = tx('Kopiuj dziennik błędów', 'Copy error log'); }, 1500); }, () => { /* bez schowka */ });
});
perfErr.append(perfErrList, perfErrCopy);
perfBox.append(perfMain, perfGpu, perfErr);
document.body.append(perfBox);
// mały licznik FPS zawsze widoczny pod wersją; klik albo F3 rozwija pełne statystyki
const fpsTag = document.createElement('button');
fpsTag.type = 'button';
fpsTag.className = 'fps-tag';
fpsTag.title = tx('Wydajność i dziennik błędów — kliknij albo F3', 'Performance and error log — click or press F3');
fpsTag.textContent = 'FPS —';
document.body.append(fpsTag);
const togglePerf = (): void => {
  perfBox.hidden = !perfBox.hidden;
  fpsTag.setAttribute('aria-pressed', String(!perfBox.hidden));
  // przy otwartym oknie co 15. klatka jest mierzona przejście po przejściu (cienie, scena, AO, poświata…)
  renderer.gpuProfile = !perfBox.hidden;
};
fpsTag.addEventListener('click', togglePerf);
// nagłówek skopiowanego dziennika błędów: w jakim stanie była gra (żeby naprawa nie wymagała dopytywania)
errContext('ekran', () => (titleScreen ? 'tytułowy' : menu.isOpen() ? 'menu' : entering ? 'wczytywanie' : 'gra'));
errContext('gra', () => (game ? `${net ? 'sieć' : game.players[ME]?.dev ? 'deweloperska' : 'z botami'} ${currentPreset}, tick ${game.tick}, ludzie ${game.units.length}, wojsko ${game.soldiers.length}, budynki ${game.buildings.length}` : ''));
errContext('wątek symulacji', () => (simMode ? 'tak' : 'nie'));
errContext('WebGL', () => glFallback || 'zwykły');
errContext('jakość', () => `${gfx.auto ? 'auto ' : ''}${renderer.quality} · ${renderer.resolution}`);
errContext('FPS', () => perf.last.fps ?? '?');
errContext('spacer/kopalnia', () => (renderer.walking ? 'spacer' : renderer.inMineWalk ? 'kopalnia' : ''));
window.addEventListener('keydown', (e) => { if (e.key === 'F3') { e.preventDefault(); togglePerf(); } });

// ---- panel dewelopera (F9): stawianie jednostek i wilków, scenki, czas — tylko w grze z botami w trybie dewelopera ----
/** Czeka na klik na mapie: punkt zbiórki koszar */
let rallyPick: { building: number; kind: number } | null = null;
let devSpawn: { kind: DevSpawn; foe: boolean; count: number } | null = null;
/** Każda akcja panelu dewelopera zmienia stan w wątku głównym — po niej stan idzie do wątku symulacji (resyncSim) */
function withResync<T extends object>(ev: T): T {
  const out = { ...ev } as Record<string, unknown>;
  for (const [k, fn] of Object.entries(ev)) {
    if (typeof fn !== 'function') continue;
    out[k] = (...args: unknown[]): unknown => { const r = (fn as (...a: unknown[]) => unknown)(...args); resyncSim(); return r; };
  }
  return out as T;
}
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
          if (k < 0) return 0;
          game.soldiers.push({ id: game.nextId++, owner, kind: k, px, py, path: [], hp: UNITS[k]!.hp, goal: -1, wait: 0, target: 0, cd: 0 });
        }
        n++;
      }
  const what = kind === 'wolf' ? tx('wilk', 'wolf') : t(UNITS[unitIndex(kind)]?.name ?? 'u.spearman').toLowerCase();
  const h = clockAt(game.tick).hour;
  if (kind === 'wolf' && h >= 6.5 && h < 19.5 && n) { devPanel.placed(tx(`Postawiono ${n} wilków, ale jest dzień — od razu uciekną do lasu. Najpierw „Przewiń do nocy”.`, `Placed ${n} wolves, but it is daytime — they will flee to the forest at once. Skip to night first.`)); return n; }
  devPanel.placed(n ? tx(`Postawiono: ${what} ×${n}${kind === 'wolf' ? '' : foe ? ' (wróg)' : ' (moi)'}. Klikaj dalej albo Esc.`, `Placed: ${what} ×${n}${kind === 'wolf' ? '' : foe ? ' (enemy)' : ' (mine)'}. Keep clicking or press Esc.`) : tx('Tu nie da się postawić — wybierz wolne pole.', 'Cannot place here — pick a free tile.'));
  return n;
}
const devPanel = createDevPanel(document.body, withResync({
  onWin: () => { if (!endShown) { devPanel.close(); showEnd(true); } },
  onPlace: (sp) => { devSpawn = sp; canvas.classList.toggle('placing', !!sp); },
  onFoeAtTower: () => {
    const W = game.map.width;
    const towers = game.buildings.filter((b) => b.owner === ME && isTower(BUILDINGS[b.type]!.id));
    const manned = towers.find((t) => game.soldiers.some((s) => towerOf(game, s) === t.id)) ?? towers[0];
    if (!manned) { devPanel.placed(tx('Nie masz wieży strażniczej.', 'You have no watchtower.')); return; }
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
    devPanel.placed(`${tx('Jest', 'It is')} ${Math.floor(clockAt(game.tick).hour)}:${String(Math.floor((clockAt(game.tick).hour % 1) * 60)).padStart(2, '0')}.`);
  },
  onSeason: (s: Season) => {
    game.seasonShift = shiftToSeason(game.tick, s);
    refresh();
    const w = weatherOf(game, rainAt(game.tick));
    return `${SEASON_NAME[w.season]}: ${tx('teraz', 'now')} ${lang() === 'en' ? w.temp.toFixed(1) : w.temp.toFixed(1).replace('.', ',')}°C${w.temp < COLD ? tx(' — w chatach palą w piecach (drewno na opał)', ' — the hovels burn firewood in their hearths') : ''}.`;
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
    if (!best) { devPanel.placed(tx('Nie masz budynku, który mógłby się zapalić.', 'You have no building that could catch fire.')); return; }
    best.hp = Math.min(best.hp, Math.floor(maxHp(best.type) * 0.5)); best.hpWas = best.hp; best.fire = 600;
    renderer.lookAt(best.x + BUILDINGS[best.type]!.w / 2, best.y + BUILDINGS[best.type]!.h / 2, 18);
    devPanel.placed(water.length ? tx('Pali się budynek przy studni — chłopi powinni zaraz przybiec z wiadrami.', 'A building near the well is ablaze — peasants should come running with buckets.') : tx('Pali się budynek, ale nie masz studni ani cechu inżynierów — postaw studnię obok.', 'A building is ablaze, but you have no well or engineers\' guild — build a well nearby.'));
  },
  onHeal: () => { for (const s of game.soldiers) if (s.owner === ME) s.hp = UNITS[s.kind]!.hp; },
  onGive: () => { const p = game.players[ME]!; for (let i = 0; i < p.res.length; i++) p.res[i]! += 1000; refresh(); },
  onCamera: (which) => {
    const owner = which === 'mine' ? ME : devFoe();
    const k = game.buildings.find((b) => b.owner === owner && b.type === 0);
    if (k) renderer.lookAt(k.x + 1.5, k.y + 1.5, 26);
  },
  onKillFoes: () => { const me = game.players[ME]!; game.soldiers = game.soldiers.filter((s) => game.players[s.owner]?.team === me.team); game.wolves = []; },
}));
window.addEventListener('keydown', (e) => {
  if (e.key === 'F9' && devAllowed()) { e.preventDefault(); devPanel.toggle(); return; }
  if (e.key === 'Escape' && rallyPick) { e.preventDefault(); e.stopImmediatePropagation(); rallyPick = null; canvas.classList.remove('placing'); return; }
  if (e.key === 'Escape' && devPanel.isPlacing()) { e.preventDefault(); e.stopImmediatePropagation(); devPanel.stop(); return; }
  // Esc najpierw zamyka otwarty panel dewelopera (także nad menu gry), dopiero następny Esc robi resztę
  if (e.key === 'Escape' && devPanel.isOpen() && !document.body.classList.contains('menu-open')) { e.preventDefault(); e.stopImmediatePropagation(); devPanel.close(); }
}, true);
// przycisk na dolnej belce (obok Menu), widoczny tylko gdy panel jest dostępny
const devBtn = document.createElement('button');
devBtn.type = 'button';
devBtn.className = 'dev-open';
devBtn.textContent = tx('Deweloper', 'Developer');
devBtn.title = tx('Panel dewelopera (F9)', 'Developer panel (F9)');
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
  perf.last['karta graficzna'] = renderer.gpu;
  perf.last['rdzenie procesora'] = navigator.hardwareConcurrency || '?';
  { const a = audioStats(); perf.last['dźwięki (głosy · pętle · pliki)'] = `${a.voices} · ${a.loops} · ${a.buffers}`; }
  perf.last['budynki z daleka'] = renderer.lodInfo;
  // karta graficzna przejście po przejściu (tylko przy otwartym oknie; mierzona co 15. klatka)
  const gpu = renderer.readGpu();
  if (Object.keys(gpu).length) { perf.last['KARTA: co ile liczy'] = ''; Object.assign(perf.last, gpu); }
  if (!perfBox.hidden) {
    perf.last['NAJWIĘCEJ TRÓJKĄTÓW'] = 'w kadrze + w cieniu';
    const k = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(2)} mln` : `${Math.round(n / 1000)} tys.`);
    for (const h of renderer.heavy(10)) perf.last[`  ${h.cat}`] = `${k(h.tris)} + ${k(h.shadow)} · ${h.meshes} siatek`;
  }
  const ec = errCounts();
  perf.last['błędy'] = ec.errors; perf.last['ostrzeżenia'] = ec.warnings;
  fpsTag.textContent = ec.errors ? `FPS ${perf.last.fps} · ⚠ ${ec.errors}` : `FPS ${perf.last.fps}`;
  fpsTag.dataset.low = String(Number(perf.last.fps) < 40);
  fpsTag.dataset.err = String(ec.errors > 0);
  if (!perfBox.hidden) {
    const list = errEntries();
    perfErrList.textContent = list.length
      ? `${tx('DZIENNIK BŁĘDÓW', 'ERROR LOG')} (${ec.errors} ${tx('błędów', 'errors')}, ${ec.warnings} ${tx('ostrzeżeń', 'warnings')})\n` + list.slice(-8).map((e) => `${e.level === 'error' ? '✖' : '!'} ×${e.count} ${e.msg.slice(0, 110)}`).join('\n')
      : tx('DZIENNIK BŁĘDÓW: czysto', 'ERROR LOG: clean');
  }
  if (!perfBox.hidden) {
    const rows = Object.entries(perf.last).map(([k, v]) => `${k.padEnd(22)} ${v}`);
    const cut = Object.keys(perf.last).indexOf('budynki z daleka');
    perfMain.textContent = rows.slice(0, cut < 0 ? rows.length : cut).join('\n');
    perfGpu.textContent = cut < 0 ? '' : rows.slice(cut).join('\n');
  }
  perf.frames = 0; perf.sim = 0; perf.ticks = 0; perf.render = 0; perf.ui = 0; perf.worst = 0; perf.since = now;
}
(window as unknown as { __perf: () => Record<string, number | string> }).__perf = () => perf.last;
// do testów dźwięku: stan silnika i dźwięk z miejsca na mapie (pola świata, jak w scenie)
(window as unknown as { __audio: unknown }).__audio = { stats: audioStats, ear: listenerPos, play: (k: WorldSound, x: number, z: number) => play3d(k, x, z) };
// nowy błąd od razu podbija licznik przy FPS (bez czekania na kolejne odświeżenie statystyk)
onReport(() => { const n = errCounts().errors; if (n) { fpsTag.textContent = `FPS ${perf.last.fps ?? '—'} · ⚠ ${n}`; fpsTag.dataset.err = 'true'; } });
(window as unknown as { __heavy: (n?: number) => unknown }).__heavy = (n) => renderer.heavy(n);
// do testów wyglądu: spacer bez blokady kursora (kamera z oczu chłopa)
(window as unknown as { __walk: (x: number, y: number, yaw?: number, pitch?: number) => void }).__walk = (x, y, yaw = 0, pitch = 0.2) => { renderer.startWalk(x, y, yaw); renderer.setWalkPitch(pitch); };

// podpowiedź podczas spaceru oczami chłopa
const walkHint = document.createElement('p');
walkHint.className = 'walk-hint';
walkHint.hidden = true;
walkHint.textContent = tx('W A S D — idź · mysz — rozglądaj się · Shift — biegnij · Spacja — skok · F — pochodnia · portal kopalni — wejście do sztolni (wyjście: wrota na końcu korytarza; szyb z drabiną w hali prowadzi niżej) · Esc — wróć do widoku z góry (kliknij, jeśli kursor się zwolnił)', 'W A S D — walk · mouse — look around · Shift — run · Space — jump · F — torch · mine portal — enter the adit (way out: the door at the end of the tunnel; the ladder shaft in the hall leads deeper) · Esc — back to the overhead view (click if the cursor got released)');
document.body.append(walkHint);
renderer.onWalkAlert = (kind) => {
  if (kind === 'seen') hud.toast(tx('Straż wroga Cię zauważyła — uciekaj z ich ziem!', 'The enemy guards have spotted you — flee their lands!'));
  else if (kind === 'safe') hud.toast(tx('Zgubili Cię. Na razie jesteś bezpieczny.', 'They have lost your trail. You are safe for now.'));
  else if (kind === 'killed') hud.toast(tx('Strażnicy wroga dopadli Twojego chłopa. Wracasz nad mapę.', 'The enemy guards caught your peasant. You are back above the map.'));
  else if (kind === 'mineRaid') hud.toast(tx('Wróg u wrót kopalni! Górnicy rzucili kilofy i uciekają.', 'The enemy is at the mine gates! The miners have dropped their picks and fled.'));
  else if (kind === 'mineLost') hud.toast(tx('Kopalnia padła — wychodzisz na powierzchnię.', 'The mine has fallen — you climb back to the surface.'));
  else hud.toast(tx('To cudza kopalnia — jej wrota są dla Ciebie zamknięte.', 'This mine belongs to another lord — its gates are shut to you.'));
};
renderer.onWalkEnd = () => { document.body.classList.remove('walking'); walkHint.hidden = true; };
