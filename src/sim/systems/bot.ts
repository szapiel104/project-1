import { dole, quell } from './unrest';
import { canQuarantine, setQuarantine } from './plague';
import { BUILDINGS, buildingIndex, footprint, isTower } from '../../data/buildings';
import { RESOURCES, RESOURCE_DEFS, resIndex } from '../../data/resources';
import { MAGE_CAP, SAPPER, UNITS } from '../../data/units';
import { KEEP_SIZE } from '../../data/keep';
import { FP, Phase, housing, idleCount, keepCenter, keepFront, playerKeep, population, type Building, type GameState, type PlayerState, type Soldier } from '../state';
import { battleMages, orderAttack, orderGarrison, orderMove, train } from './army';
import { canAfford, canPlace, missingRequirement, placeBuilding, placementBatch } from './placement';
import { Terrain } from '../../data/terrain';
import { enemyRoad, orderWreck } from './roadwreck';

/**
 * Bot przeciwnik. Działa wewnątrz symulacji, więc jest w pełni deterministyczny i może grać także w meczach sieciowych.
 * Buduje osadę według listy, szkoli włóczników i co jakiś czas wysyła coraz większą falę na najbliższy wrogi zamek.
 */
// kolejność pod koszty z data/buildings.ts: najpierw drewno i jedzenie, kamieniołom zanim cokolwiek z kamienia
// kolejność pod koszty z data/buildings.ts: najpierw drewno i jedzenie, kopalnia pod górami zanim cokolwiek z kamienia
// 'well' przy polach: latem w suszy sad i pole bez studni obok rodzą o połowę mniej (storms.ts), a studnia przydaje się też do gaszenia pożarów od piorunów
// 'camp' dwa razy: pierwsze obozowisko stoi od startu, drugie daje miejsca na nowych przybyszów (bez wolnego miejsca przy ognisku nikt nie przychodzi)
// rudera i namiot nie są na liście: bot stawia je tylko na szybko, gdy brak łóżek, a na chatę nie ma drewna (urgent niżej)
const ORDER = ['woodcutter', 'orchard', 'woodcutter', 'house', 'oremine', 'woodcutter', 'orchard', 'woodcutter', 'house', 'stockpile', 'armory', 'poleturner', 'barracks', 'camp', 'camp', 'house', 'farm', 'well', 'mill', 'orchard', 'bakery', 'fletcher', 'house', 'brewery', 'tavern', 'minecamp', 'woodcutter', 'forester', 'cemetery', 'mageHut', 'engineers', 'shrine', 'house', 'camp', 'fletcher', 'house', 'house', 'woodcutter', 'smithy', 'farm', 'bakery', 'armorer', 'mageSeat', 'oremine'];
// druga kopalnia na samym końcu: kosztuje fortunę (BuildingDef.nextCost), więc bot stawia ją dopiero, gdy wszystko inne już stoi
/** `mageSeat` na liście: siedziba zakonu magów — boty o parzystym numerze stawiają Sanktuarium Źródła, o nieparzystym Wieżę Płomienia;
 *  dopiero w grodzie (etap osady jak u gracza, BuildingDef.tier). Stoją w niej uzdrowiciele i szkolą się magowie bojowi.
 *  Budynki z wyższego etapu osady bot pomija (missingRequirement), dopóki nie urośnie, i buduje dalej wg listy */
/** Ilu magów bojowych trzyma bot (limit gracza to MAGE_CAP; bot na trudnym bierze pełny limit) */
const botMages = (level: number): number => (level >= 3 ? MAGE_CAP : 6);
/** Jak daleko od bramy bot szuka skały pod kopalnię i ile miejsc najwyżej sprawdza w jednym myśleniu */
const ROCK_REACH = 60;
const ROCK_TRIES = 400;
/** Gracz → do którego ticku bot nie szuka miejsca pod kopalnię (ostatnio nie znalazł); poza stanem gry, ale liczy się tak samo u wszystkich */
/** Promień palisady wokół twierdzy (budynki stawia tylko w środku) */
const RING = 16;
const THINK = 40;
/** Pierwszy atak po ok. 25 minutach gry, kolejne co ok. 8 minut */
export const FIRST_WAVE = 15000;
export const WAVE_EVERY = 4800;
/** Kiedy wyruszy następna fala i jak duża ma być (do paska ostrzeżeń w interfejsie) */
/** Poziomy trudności: kiedy pierwsza fala, co ile kolejne, ile żołnierzy najwyżej. Poziom 0 nie atakuje wcale. */
const LEVELS = [
  { first: Infinity, every: Infinity, base: 0, grow: 0, cap: 0 },
  { first: 21000, every: 6000, base: 3, grow: 1, cap: 6 },
  { first: FIRST_WAVE, every: WAVE_EVERY, base: 4, grow: 2, cap: 12 },
  { first: 9000, every: 3600, base: 6, grow: 3, cap: 20 },
];

export function nextWave(tick: number, level = 2): { at: number; size: number } | null {
  const L = LEVELS[level] ?? LEVELS[2]!;
  if (!Number.isFinite(L.first)) return null;
  const at = tick < L.first ? L.first : L.first + Math.ceil((tick - L.first) / L.every) * L.every;
  return { at, size: Math.min(L.base + Math.floor((at - L.first) / L.every) * L.grow, L.cap) };
}

function affordable(g: GameState, p: PlayerState, type: number): boolean {
  return canAfford(g, p.id, BUILDINGS[type]!); // z dopłatą za kolejny taki sam budynek, jak u gracza
}

/** Pierwsze wolne miejsce wokół twierdzy, szukane pierścieniami (stała kolejność = ten sam wynik u każdego) */
function spot(g: GameState, player: number, type: number): { x: number; y: number } | null {
  const keep = playerKeep(g, player);
  if (!keep) return null;
  // osada rośnie przed bramą zamku (krótsze drogi ze składu do pracy), dookoła coraz dalej
  const [fx, fy] = keepFront(keep), kx = fx, ky = fy + 3;
  for (let r = 2; r < RING; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        // co drugi pierścień zostaje wolny, żeby osada miała przejścia
        if (r % 3 === 0) continue;
        const x = kx + dx, y = ky + dy;
        if (canPlace(g, player, type, x, y) === null) return { x, y };
      }
  return null;
}

/** Pierwsze wolne miejsce w pierścieniach wokół punktu (barak przy kopalni) */
function spotNear(g: GameState, player: number, type: number, cx: number, cy: number): { x: number; y: number } | null {
  for (let r = 2; r <= 8; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (canPlace(g, player, type, cx + dx, cy + dy) === null) return { x: cx + dx, y: cy + dy };
      }
  return null;
}

/**
 * Miejsce pod kopalnię: stoi tyłem do skały, więc szukamy pól gór najbliżej bramy i próbujemy postawić budynek
 * przed każdym z nich, drzwiami od gór (cztery obroty). Stała kolejność (odległość, potem numer pola) = ten sam wynik u każdego.
 */
function spotRock(g: GameState, player: number, type: number): { x: number; y: number; rot: number } | null {
  const keep = playerKeep(g, player);
  if (!keep) return null;
  const def = BUILDINGS[type]!;
  const [fx, fy] = keepFront(keep);
  const { width, height, tiles } = g.map;
  const rocks: { t: number; d: number }[] = [];
  for (let y = Math.max(0, fy - ROCK_REACH); y <= Math.min(height - 1, fy + ROCK_REACH); y++)
    for (let x = Math.max(0, fx - ROCK_REACH); x <= Math.min(width - 1, fx + ROCK_REACH); x++) {
      const t = y * width + x;
      if (tiles[t] !== Terrain.Mountain) continue;
      // tylko skraj masywu (sąsiad nie jest górą) — w głębi i tak nic nie postawimy
      const edge = (x > 0 && tiles[t - 1] !== Terrain.Mountain) || (x < width - 1 && tiles[t + 1] !== Terrain.Mountain) || (y > 0 && tiles[t - width] !== Terrain.Mountain) || (y < height - 1 && tiles[t + width] !== Terrain.Mountain);
      if (edge) rocks.push({ t, d: (x - fx) ** 2 + (y - fy) ** 2 });
    }
  rocks.sort((a, b) => a.d - b.d || a.t - b.t);
  let tries = 0;
  for (const { t } of rocks) {
    const tx = t % width, ty = (t - tx) / width;
    // obrót: 0 = wejście od +y (tył -y, skała nad budynkiem), 1 = wejście od +x, 2 = od -y, 3 = od -x
    for (const rot of [0, 2, 1, 3]) {
      const w = rot % 2 ? def.h : def.w, h = rot % 2 ? def.w : def.h;
      const half = Math.floor((rot % 2 ? h : w) / 2);
      const x = rot === 0 ? tx - half : rot === 2 ? tx - half : rot === 1 ? tx + 1 : tx - w;
      const y = rot === 0 ? ty + 1 : rot === 2 ? ty - h : ty - half;
      if (++tries > ROCK_TRIES) return null;
      if (canPlace(g, player, type, x, y, true, rot) === null) return { x, y, rot };
    }
  }
  return null;
}

export function botSystem(g: GameState): void {
  for (const p of g.players) {
    // każdy bot myśli w innym ticku (przy 4 na 4 osiem botów naraz zacinało grę co 20 s)
    const tk = g.tick - p.id * 5;
    if (tk % THINK !== 0) continue;
    if (!p.bot || p.defeated || !playerKeep(g, p.id)) continue;
    // bunt głodowy: bot rozdaje chleb, gdy ma z czego, a bez jedzenia każe straży rozpędzić tłum
    if (p.revolt && !dole(g, p.id)) quell(g, p.id);
    // zaraza: bot zamyka chaty, w których ktoś leży w gorączce (kwarantanna jak u gracza; po zarazie otwierają się same)
    if (p.plague) for (const u of g.units) if (u.owner === p.id && u.sick && u.home && u.phase === Phase.Sleeping && g.tick >= (u.sickFrom ?? 0)) { const h = g.buildings.find((b) => b.id === u.home); if (h && !h.quarantine && canQuarantine(h)) setQuarantine(g, p.id, h.id, true); }
    // budowa: następny budynek z listy, którego jeszcze brakuje (rzadziej, bo szukanie miejsca kosztuje)
    if (tk % (THINK * 5) === 0) {
    const have = new Map<string, number>();
    for (const b of g.buildings) if (b.owner === p.id) { const id = BUILDINGS[b.type]!.id; have.set(id, (have.get(id) ?? 0) + 1); }
    const want = new Map<string, number>();
    // najpierw to, czego osada pilnie potrzebuje: jedzenie dla wszystkich (sad karmi ok. 6 ludzi) i drwale,
    // gdy wolni ludzie czekają, a drewna brak na nowe warsztaty (drwal jest tani, a drewno to wąskie gardło)
    const pop = population(g, p.id);
    const feeders = (have.get('orchard') ?? 0) + (have.get('fisher') ?? 0) + (have.get('bakery') ?? 0) * 2;
    // pierwszy drwal przed wszystkim: bez niego drewno się kończy i osada staje (zapas chleba starcza na start)
    // bez żadnego składu na drewno (stodoła i składy zburzone) najpierw skład, potem drwal: drwal bez składu tylko zrzuca deski
    // pod chatą i staje (storage.ts). Drewno na skład zbiera w razie biedy wolny chłop (emergencywood.ts)
    const woodStore = (have.get('stockpile') ?? 0) + (have.get('barn') ?? 0) > 0;
    const urgent0 = !woodStore ? 'stockpile' : !(have.get('woodcutter') ?? 0) ? 'woodcutter' : feeders * 6 < pop + 3 ? 'orchard' : idleCount(g, p.id) >= 4 && p.res[resIndex('wood')]! < 40 && (have.get('woodcutter') ?? 0) < 4 + Math.floor(pop / 8) ? 'woodcutter' : null;
    // brak łóżek, a na chatę nie starcza drewna: na szybko rudera (najwyżej 3), a w biedzie namiot (najwyżej 2) — jak gracz,
    // który łata osadę tanimi mieszkaniami, zanim stać go na porządne chaty
    const roofless = !urgent0 && pop >= housing(g, p.id) && !affordable(g, p, buildingIndex('house'));
    const urgent = urgent0 ?? (!roofless ? null
      : (have.get('shackL') ?? 0) < 2 && affordable(g, p, buildingIndex('shackL')) ? 'shackL'
      : (have.get('shack') ?? 0) < 3 && affordable(g, p, buildingIndex('shack')) ? 'shack'
      : (have.get('tent') ?? 0) < 2 ? 'tent' : null);
    // pełny magazyn (storage.ts): warsztaty stoją, a towar leży pod drzwiami — bot stawia kolejny magazyn tego rodzaju
    // (spichlerza nie: pełny spichlerz to po prostu dużo jedzenia, a sady same ruszą, gdy ludzie zjedzą zapas)
    const storeNeed = fullStoreNeed(g, p.id);
    const urgentStore = storeNeed && (have.get(storeNeed) ?? 0) < 6 ? storeNeed : null;
    if (urgentStore) {
      // oszczędza na magazyn, dopóki go nie postawi (bez niego warsztaty i tak stoją)
      if (affordable(g, p, buildingIndex(urgentStore))) {
        const at = placementBatch(() => spot(g, p.id, buildingIndex(urgentStore)));
        if (at && placeBuilding(g, p.id, buildingIndex(urgentStore), at.x, at.y)) have.set(urgentStore, (have.get(urgentStore) ?? 0) + 1);
      }
    } else if (urgent && affordable(g, p, buildingIndex(urgent))) {
      const at = placementBatch(() => spot(g, p.id, buildingIndex(urgent)));
      if (at && placeBuilding(g, p.id, buildingIndex(urgent), at.x, at.y)) have.set(urgent, (have.get(urgent) ?? 0) + 1);
    } else for (const raw of ORDER) {
      const id = raw === 'mageSeat' ? (p.id % 2 ? 'mageFire' : 'mageWater') : raw;
      want.set(id, (want.get(id) ?? 0) + 1);
      if ((have.get(id) ?? 0) >= want.get(id)!) continue;
      const type = buildingIndex(id);
      // drzewko budowy: bez gotowego wymaganego budynku (np. karczma bez browaru) bot buduje dalej wg listy i wraca tu później
      if (missingRequirement(g, p.id, BUILDINGS[type]!)) continue;
      if (id === 'minecamp') {
        // barak: przy własnej kopalni (pierścienie wokół niej); bez kopalni bot go pomija
        const mine = g.buildings.find((b) => b.owner === p.id && BUILDINGS[b.type]!.id === 'oremine' && !b.ruined);
        if (!mine) continue;
        if (affordable(g, p, type)) {
          const at = placementBatch(() => spotNear(g, p.id, type, mine.x + 1, mine.y + 1));
          if (at) placeBuilding(g, p.id, type, at.x, at.y); else continue;
        }
        break;
      }
      if (BUILDINGS[type]!.needsRock) {
        // kopalnia: gdy w zasięgu nie ma skały (albo wszystko zastawione), bot nie czeka na nią — buduje dalej wg listy
        if ((p.noRock ?? 0) > g.tick) continue;
        if (affordable(g, p, type)) {
          const at = placementBatch(() => spotRock(g, p.id, type));
          if (at) placeBuilding(g, p.id, type, at.x, at.y, at.rot); else { p.noRock = g.tick + 3000; continue; }
        }
        break;
      }
      if (affordable(g, p, type)) { const at = placementBatch(() => spot(g, p.id, type)); if (at) placeBuilding(g, p.id, type, at.x, at.y); }
      break;
    }
    }
    // umocnienia: gdy osada ma już kilkanaście budynków, otacza się palisadą z bramami i wieżami w narożnikach
    // (dopiero gdy stoją koszary: najpierw gospodarka i wojsko, potem drewno na palisadę)
    // (palisada nie zjada drewna potrzebnego na sady, gdy jedzenia zaczyna brakować)
    const fed = g.buildings.filter((b) => b.owner === p.id && ['orchard', 'fisher'].includes(BUILDINGS[b.type]!.id)).length * 6 >= population(g, p.id) + 3;
    if (fed && tk % (THINK * 3) === 0 && g.buildings.filter((b) => b.owner === p.id).length >= 12
      && g.buildings.some((b) => b.owner === p.id && BUILDINGS[b.type]!.id === 'barracks')) placementBatch(() => fortify(g, p));
    // kooperacja: wzmocniony bot co ok. 2 minuty dostaje dostawę broni i rudy (więcej wojska na fale)
    if (p.boost && tk % (THINK * 60) === 0) {
      p.res[resIndex('spear')]! += Math.round(2 * p.boost);
      p.res[resIndex('bow')]! += Math.round(p.boost);
      p.res[resIndex('gold')]! += Math.round(15 * p.boost);
    }
    // wrogie drogi w pobliżu: dwóch wolnych żołnierzy idzie je rozkopać (jak gracz prawym klikiem)
    if (tk % (THINK * 15) === 0) wreckNearby(g, p);
    // podatek, gdy osada jest zadowolona: złoto na żołd
    p.tax = p.popularity > 70 ? 2 : p.popularity > 55 ? 1 : 0;
    // wojsko: szkoli jednego włócznika naraz, gdy ma broń, rudę i wolnego chłopa
    const barracks = g.buildings.find((b) => b.owner === p.id && BUILDINGS[b.type]!.id === 'barracks');
    if (barracks) {
      // mieszane wojsko: mniej więcej co trzeci to łucznik, gdy są łuki
      const mine = g.soldiers.filter((s) => !UNITS[s.kind]!.guard && s.owner === p.id);
      const archers = mine.filter((s) => UNITS[s.kind]!.range).length;
      const wantArcher = archers * 3 < mine.length + 1;
      // przy większym wojsku jeden taran na bramy i mury wroga (gdy starcza drewna i rudy na resztę)
      const rams = mine.filter((s) => UNITS[s.kind]!.ram).length;
      const wantRam = rams === 0 && mine.length >= 6 && p.res[resIndex('wood')]! >= 90 && p.res[resIndex('gold')]! >= 60;
      // saperzy: przy większym wojsku dwóch (trzech, gdy u wroga leżą ruiny) — rozbierają ruiny wroga po atakach;
      // tylko gdy po ich wyszkoleniu zostaje ruda na żołnierzy
      // liczą się też ci w drodze do koszar i w środku (inaczej bot szkolił sapera co chwilę, zanim pierwszy wyszedł)
      const sappers = mine.filter((s) => UNITS[s.kind]!.sapper).length + g.units.filter((u) => u.owner === p.id && u.enlist === SAPPER + 1).length
        + g.buildings.reduce((n, b) => n + (b.owner === p.id ? (b.enlistQ ?? []).filter((q) => q.k === SAPPER).length : 0), 0);
      const wantSapper = mine.length - sappers >= SAPPER_ARMY && sappers < (foeRuins(g, p).length ? SAPPERS_MAX : SAPPERS_MAX - 1) && p.res[resIndex('gold')]! >= SAPPER_GOLD;
      // zbrojny, gdy w zbrojowni leży miecz i kolczuga (bot stawia kuźnię i płatnerza pod koniec listy budowy)
      if (!(wantRam && train(g, p.id, barracks.id, 'ram')) && !(wantSapper && train(g, p.id, barracks.id, 'sapper')) && !train(g, p.id, barracks.id, 'manatarms') && !(wantArcher && train(g, p.id, barracks.id, 'archer'))) train(g, p.id, barracks.id, UNITS[0]!.id);
      // magowie bojowi: gdy stoi siedziba zakonu i jest już trochę wojska, po jednym naraz, aż do limitu bota;
      // ruda musi zostać jeszcze na zwykłych żołnierzy
      const hall = g.buildings.find((b) => b.owner === p.id && !b.build && !b.ruined && (BUILDINGS[b.type]!.id === 'mageFire' || BUILDINGS[b.type]!.id === 'mageWater'));
      if (hall && mine.length >= 6 && battleMages(g, p.id) < botMages(p.level) && p.res[resIndex('gold')]! >= 90) train(g, p.id, hall.id, BUILDINGS[hall.type]!.id);
      // łucznicy wchodzą na wolne wieże (po dwóch), reszta zostaje do ataku
      for (const t of g.buildings) {
        if (t.owner !== p.id || t.build || !isTower(BUILDINGS[t.type]!.id)) continue;
        const on = g.soldiers.filter((s) => s.post === t.id).length;
        if (on >= 2) continue;
        const free = mine.filter((s) => UNITS[s.kind]!.range && !s.post && s.goal < 0 && !s.target).slice(0, 2 - on);
        if (free.length) orderGarrison(g, p.id, free.map((s) => s.id), t.id);
      }
    }
    // sygnał od sojusznika (znacznik na mapie): atak i zbiórka — całe wolne wojsko, pomoc — połowa; potem sygnał gaśnie
    if (p.call) {
      const c = p.call;
      p.call = undefined;
      const field = g.soldiers.filter((s) => fighter(s) && s.owner === p.id && !s.post);
      const n = c.kind === 1 ? Math.ceil(field.length / 2) : field.length;
      if (n && g.tick - c.tick < 2400) orderMove(g, p.id, field.slice(0, n).map((s) => s.id), c.tile, { amove: c.kind !== 2 });
    }
    // atak falami: im później, tym większa fala; na poziomie pokojowym bot tylko się broni
    // kooperacja: wzmocniony bot rusza przy tej samej liczebności co zwykły, ale ma więcej wojska (zapasy, dostawy broni)
    const wave = nextWave(g.tick, p.level);
    // nextWave nigdy nie daje terminu przed pierwszą falą, więc wystarczy okno THINK przed terminem
    // (dawny warunek tick >= first sprawiał, że boty myślące w ticku przesuniętym o id pomijały pierwszą falę)
    if (wave && wave.at - g.tick < THINK) {
      const army = g.soldiers.filter((s) => fighter(s) && s.owner === p.id);
      const foes = g.players.filter((o) => o.team !== p.team && !o.defeated).map((o) => playerKeep(g, o.id)).filter((k) => !!k);
      // kooperacja: boty rozkładają fale na wszystkich ludzi po kolei (zwykle cała drużyna szła na pierwszego)
      const foe = p.boost ? foes[(p.id + Math.floor(g.tick / WAVE_EVERY)) % Math.max(1, foes.length)] : foes[0];
      if (foe && army.length >= wave.size && foe.door >= 0) {
        // atak z dwóch stron: połowa idzie pod bramę, połowa obchodzi i uderza z boku; łucznicy z wież zostają
        const w = g.map.width, [kx, ky] = keepCenter(foe), R = (KEEP_SIZE >> 1) + 3;
        const field = army.filter((s) => !s.post);
        const half = Math.ceil(field.length / 2);
        const side = (g.tick / WAVE_EVERY) % 2 < 1 ? 1 : -1;
        const a = Math.min(g.map.height - 2, Math.max(1, ky + R)) * w + kx;
        const b = ky * w + Math.min(w - 2, Math.max(1, kx + R * side));
        orderMove(g, p.id, field.slice(0, half).map((s) => s.id), a);
        orderMove(g, p.id, field.slice(half).map((s) => s.id), b);
      }
    }
    // wypady: między falami dwóch, trzech żołnierzy poluje na drwali i rybaków wroga poza murami
    if (wave && g.tick >= (LEVELS[p.level] ?? LEVELS[2]!).first / 2 && tk % (THINK * 30) === 0) {
      const idle = g.soldiers.filter((s) => fighter(s) && s.owner === p.id && !s.post && s.goal < 0 && !s.target);
      if (idle.length >= 6) {
        const prey = g.units.find((u) => g.players[u.owner]?.team !== p.team && u.job && g.buildings.some((b) => b.id === u.job && ['woodcutter', 'fisher', 'quarry', 'mine', 'oremine'].includes(BUILDINGS[b.type]!.id)));
        if (prey) orderMove(g, p.id, idle.slice(0, 3).map((s) => s.id), (prey.py >> 8) * g.map.width + (prey.px >> 8));
      }
    }
    // saperzy: wolni idą rozbierać bezpieczne ruiny wroga (najbliższe twierdzy), dalekie z eskortą
    if (tk % (THINK * 2) === 0) sendSappers(g, p);
  }
}

/** Saperów bot szkoli dopiero przy co najmniej tylu żołnierzach i trzyma ich najwyżej tylu */
const SAPPER_ARMY = 6;
const SAPPERS_MAX = 3;
/** Ruda, którą bot musi mieć, żeby wyszkolić sapera (10 na sapera + zapas na zwykłe wojsko) */
const SAPPER_GOLD = 40;
/** Ruina jest bezpieczna, gdy w tym promieniu (pola) wróg nie ma więcej wojska niż bot */
const SAFE_R = 8;
/** Dalsza ruina (od twierdzy bota) dostaje eskortę: tylu wolnych żołnierzy idzie z saperami */
const ESCORT_FROM = 20;
const ESCORT = 3;

/** Żołnierz do walki: bez straży i saperów (saperzy nie walczą — nie idą w fale ani na wypady) */
const fighter = (s: Soldier): boolean => !UNITS[s.kind]!.guard && !UNITS[s.kind]!.sapper;
const ruinCenter = (b: Building): [number, number] => { const fp = footprint(BUILDINGS[b.type]!, b.rot); return [b.x + fp.w / 2, b.y + fp.h / 2]; };

/** Ruiny wrogich drużyn, które saper może rozebrać (bez dróg i twierdz) */
/** Jaki magazyn bot powinien dostawić: rodzaj, przy którym warsztaty czekają na miejsce (storage.ts), albo null */
function fullStoreNeed(g: GameState, owner: number): string | null {
  const STORE_FOR: Record<string, string> = { stockpile: 'stockpile', grain: 'barn', armory: 'armory' };
  for (const b of g.buildings) {
    if (b.owner !== owner || !b.stall) continue;
    const kind = RESOURCE_DEFS[RESOURCES[b.stall - 1]!]?.store;
    if (!kind || !STORE_FOR[kind]) continue;
    // plac budowy takiego magazynu już stoi: czekamy, aż go skończą
    const id = STORE_FOR[kind]!;
    if (g.buildings.some((x) => x.owner === owner && x.build && BUILDINGS[x.type]!.id === id)) continue;
    return id;
  }
  return null;
}

function foeRuins(g: GameState, p: PlayerState): Building[] {
  return g.buildings.filter((b) => b.ruined && g.players[b.owner]?.team !== p.team && !BUILDINGS[b.type]!.road && BUILDINGS[b.type]!.id !== 'keep');
}

/** Ile wojska do walki drużyny `team` (albo poza nią) stoi w promieniu `r` pól od punktu */
function armyNear(g: GameState, team: number, mine: boolean, cx: number, cy: number, r: number): number {
  let n = 0;
  for (const s of g.soldiers) {
    if (!fighter(s) || s.hp <= 0) continue;
    if ((g.players[s.owner]?.team === team) !== mine) continue;
    if (Math.abs(s.px / FP - cx) <= r && Math.abs(s.py / FP - cy) <= r) n++;
  }
  return n;
}

/**
 * Wolni saperzy bota (bez celu, łupu i rozkazu marszu) idą do najbliższej twierdzy bota ruiny wroga, przy której
 * wróg nie ma przewagi. Każdy saper bierze inną ruinę; do ruiny daleko od twierdzy idzie też eskorta z wolnych żołnierzy.
 * Wszystko w stałej kolejności (odległość, potem numer), więc u każdego gracza tak samo.
 */
function sendSappers(g: GameState, p: PlayerState): void {
  const free = g.soldiers.filter((s) => s.owner === p.id && UNITS[s.kind]!.sapper && s.hp > 0 && !s.target && !s.loot && s.goal < 0 && !s.path.length);
  if (!free.length) return;
  const keep = playerKeep(g, p.id);
  if (!keep) return;
  const [kx, ky] = keepCenter(keep);
  const busy = new Set(g.soldiers.filter((s) => s.owner === p.id && UNITS[s.kind]!.sapper && s.target).map((s) => s.target));
  const ruins = foeRuins(g, p)
    .filter((b) => !busy.has(b.id))
    .map((b) => { const [x, y] = ruinCenter(b); return { b, x, y, d: Math.abs(x - kx) + Math.abs(y - ky) }; })
    .filter((r) => armyNear(g, p.team, false, r.x, r.y, SAFE_R) <= armyNear(g, p.team, true, r.x, r.y, SAFE_R))
    .sort((a, b) => a.d - b.d || a.b.id - b.b.id);
  for (const s of free.sort((a, b) => a.id - b.id)) {
    const r = ruins.shift();
    if (!r) break;
    orderAttack(g, p.id, [s.id], r.b.id);
    if (r.d >= ESCORT_FROM && armyNear(g, p.team, true, r.x, r.y, SAFE_R) < ESCORT) {
      const guard = g.soldiers.filter((o) => o.owner === p.id && fighter(o) && !o.post && o.goal < 0 && !o.target).sort((a, b) => a.id - b.id).slice(0, ESCORT);
      if (guard.length) orderMove(g, p.id, guard.map((o) => o.id), Math.floor(r.y) * g.map.width + Math.floor(r.x), { amove: true });
    }
  }
}

/**
 * Palisada bota: kwadrat wokół twierdzy, bramy pośrodku boków, wieże w narożnikach w środku.
 * Stawia po kilka odcinków naraz, gdy ma drewno; pola zajęte albo nieprzechodnie pomija (wyłomy zamykają woda i góry).
 */
/**
 * Budynek z listy, na który bot teraz czeka (te same pominięcia co w budowie): mur nie może zjadać na niego drewna.
 * Bez tego palisada (1 drewna za odcinek, 8 naraz) brała każde drewno ponad 25 i bot latami nie miał na młyn ani piekarnię.
 */
function waitingFor(g: GameState, p: PlayerState): number | null {
  const have = new Map<string, number>();
  for (const b of g.buildings) if (b.owner === p.id) { const id = BUILDINGS[b.type]!.id; have.set(id, (have.get(id) ?? 0) + 1); }
  const want = new Map<string, number>();
  for (const id of ORDER) {
    want.set(id, (want.get(id) ?? 0) + 1);
    if ((have.get(id) ?? 0) >= want.get(id)!) continue;
    const type = buildingIndex(id);
    if (missingRequirement(g, p.id, BUILDINGS[type]!)) continue;
    if (id === 'minecamp' && !g.buildings.some((b) => b.owner === p.id && BUILDINGS[b.type]!.id === 'oremine' && !b.ruined)) continue;
    if (BUILDINGS[type]!.needsRock && (p.noRock ?? 0) > g.tick) continue;
    return type;
  }
  return null;
}

function fortify(g: GameState, p: PlayerState): void {
  const keep = playerKeep(g, p.id);
  if (!keep) return;
  const [cx, cy] = keepCenter(keep), w = g.map.width;
  const pal = buildingIndex('palisade'), gate = buildingIndex('gate'), tower = buildingIndex('watchtower');
  // zapas na następny budynek z listy (np. młyn, piekarnia) — mur stawia dopiero z nadwyżki
  const next = waitingFor(g, p);
  const reserve = next === null ? 0 : BUILDINGS[next]!.cost.wood ?? 0;
  const wood = p.res[resIndex('wood')]! - reserve;
  if (wood < 25) return;
  let placed = 0;
  const x0 = cx - RING, x1 = cx + RING, y0 = cy - RING, y1 = cy + RING;
  const ring: [number, number][] = [];
  for (let x = x0; x <= x1; x++) ring.push([x, y0], [x, y1]);
  for (let y = y0 + 1; y < y1; y++) ring.push([x0, y], [x1, y]);
  // najpierw bramy (żeby mur nie zamknął przejść), potem reszta muru
  const isG = ([x, y]: [number, number]): boolean => (x === cx && (y === y0 || y === y1)) || (y === cy && (x === x0 || x === x1));
  ring.sort((a, b) => Number(isG(b)) - Number(isG(a)));
  // sprawdzenie miejsca pod mur jest drogie (czy nie odetnie przejść): najwyżej 40 odcinków na raz, za każdym razem
  // od innego miejsca obwodu (bramy zawsze pierwsze) — zamiast kilkuset sprawdzeń w jednym ticku
  const gates = ring.filter(isG), rest = ring.filter((c) => !isG(c));
  const off = rest.length ? Math.floor(g.tick / (THINK * 3)) * 40 % rest.length : 0;
  const order = [...gates, ...rest.slice(off), ...rest.slice(0, off)];
  let tries = 0;
  for (const [x, y] of order) {
    if (placed >= 8 || x < 1 || y < 1 || x >= w - 1 || y >= g.map.height - 1) continue;
    const t = y * w + x;
    if (g.occupancy[t] !== 0) continue;
    if (++tries > 44) break;
    const isGate = (x === cx && (y === y0 || y === y1)) || (y === cy && (x === x0 || x === x1));
    const type = isGate ? gate : pal;
    if (p.res[resIndex('wood')]! - reserve < (BUILDINGS[type]!.cost.wood ?? 0)) break;
    if (canPlace(g, p.id, type, x, y) === null && placeBuilding(g, p.id, type, x, y)) placed++;
  }
  if (placed) return;
  // gdy mur stoi, wieże w narożnikach (w środku muru)
  for (const [x, y] of [[x0 + 1, y0 + 1], [x1 - 2, y0 + 1], [x0 + 1, y1 - 2], [x1 - 2, y1 - 2]] as const) {
    if (g.occupancy[y * w + x] !== 0) continue;
    if (p.res[resIndex('wood')]! - reserve < (BUILDINGS[tower]!.cost.wood ?? 0)) return;
    if (canPlace(g, p.id, tower, x, y) === null) { placeBuilding(g, p.id, tower, x, y); return; }
  }
  // na koniec tania czatownia przy każdej bramie, od środka (jeden łucznik pilnuje wejścia)
  const lookout = buildingIndex('lookout');
  for (const [x, y] of [[cx + 1, y0 + 1], [cx - 1, y1 - 1], [x0 + 1, cy + 1], [x1 - 1, cy - 1]] as const) {
    if (g.occupancy[y * w + x] !== 0) continue;
    if (p.res[resIndex('wood')]! - reserve < (BUILDINGS[lookout]!.cost.wood ?? 0)) return;
    if (canPlace(g, p.id, lookout, x, y) === null) { placeBuilding(g, p.id, lookout, x, y); return; }
  }
}

/**
 * Bot rozkopuje wrogie drogi, które sięgają w okolice jego zamku (do 30 pól): bierze dwóch żołnierzy bez rozkazu
 * (nie z wieży, nie tarany), najbliższych tej drodze. Gdy cała jego armia jest zajęta, nic nie robi.
 */
function wreckNearby(g: GameState, p: PlayerState): void {
  const keep = playerKeep(g, p.id);
  if (!keep) return;
  const [cx, cy] = keepCenter(keep), W = g.map.width;
  const free = g.soldiers.filter((s) => s.owner === p.id && s.hp > 0 && !s.post && s.goal < 0 && !s.path.length && !s.target && !s.prey && s.wreck === undefined && !UNITS[s.kind]!.ram && !UNITS[s.kind]!.guard);
  if (free.length < 3) return;
  let best = -1, bd = 30 * 30 + 1;
  for (let y = Math.max(0, cy - 30); y <= Math.min(g.map.height - 1, cy + 30); y++)
    for (let x = Math.max(0, cx - 30); x <= Math.min(W - 1, cx + 30); x++) {
      const t = y * W + x, d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bd && (g.roads[t] || g.roadPlan[t]) && enemyRoad(g, p.id, t)) { bd = d; best = t; }
    }
  if (best < 0) return;
  const bx = best % W, by = (best - bx) / W;
  const crew = free.sort((a, b) => ((a.px >> 8) - bx) ** 2 + ((a.py >> 8) - by) ** 2 - (((b.px >> 8) - bx) ** 2 + ((b.py >> 8) - by) ** 2) || a.id - b.id).slice(0, 2);
  orderWreck(g, p.id, crew.map((s) => s.id), bx, by);
}
