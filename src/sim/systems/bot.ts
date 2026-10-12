import { BUILDINGS, buildingIndex } from '../../data/buildings';
import { resIndex, type ResourceId } from '../../data/resources';
import { UNITS } from '../../data/units';
import { playerKeep, type GameState, type PlayerState } from '../state';
import { orderGarrison, orderMove, train } from './army';
import { canPlace, placeBuilding } from './placement';

/**
 * Bot przeciwnik. Działa wewnątrz symulacji, więc jest w pełni deterministyczny i może grać także w meczach sieciowych.
 * Buduje osadę według listy, szkoli włóczników i co jakiś czas wysyła coraz większą falę na najbliższy wrogi zamek.
 */
const ORDER = ['woodcutter', 'orchard', 'woodcutter', 'house', 'stockpile', 'orchard', 'house', 'poleturner', 'barracks', 'quarry', 'house', 'farm', 'orchard', 'fletcher', 'house', 'tavern', 'woodcutter', 'cemetery', 'engineers', 'house', 'fletcher', 'house'];
/** Promień palisady wokół twierdzy (budynki stawia tylko w środku) */
const RING = 15;
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

function affordable(p: PlayerState, type: number): boolean {
  for (const [res, n] of Object.entries(BUILDINGS[type]!.cost)) if (p.res[resIndex(res as ResourceId)]! < n!) return false;
  return true;
}

/** Pierwsze wolne miejsce wokół twierdzy, szukane pierścieniami (stała kolejność = ten sam wynik u każdego) */
function spot(g: GameState, player: number, type: number): { x: number; y: number } | null {
  const keep = playerKeep(g, player);
  if (!keep) return null;
  for (let r = 4; r < RING - 2; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        // co drugi pierścień zostaje wolny, żeby osada miała przejścia
        if (r % 3 === 0) continue;
        const x = keep.x + dx, y = keep.y + dy;
        if (canPlace(g, player, type, x, y) === null) return { x, y };
      }
  return null;
}

export function botSystem(g: GameState): void {
  if (g.tick % THINK !== 0) return;
  for (const p of g.players) {
    if (!p.bot || p.defeated || !playerKeep(g, p.id)) continue;
    // budowa: następny budynek z listy, którego jeszcze brakuje (rzadziej, bo szukanie miejsca kosztuje)
    if (g.tick % (THINK * 5) === 0) {
    const have = new Map<string, number>();
    for (const b of g.buildings) if (b.owner === p.id) { const id = BUILDINGS[b.type]!.id; have.set(id, (have.get(id) ?? 0) + 1); }
    const want = new Map<string, number>();
    for (const id of ORDER) {
      want.set(id, (want.get(id) ?? 0) + 1);
      if ((have.get(id) ?? 0) >= want.get(id)!) continue;
      const type = buildingIndex(id);
      if (affordable(p, type)) { const at = spot(g, p.id, type); if (at) placeBuilding(g, p.id, type, at.x, at.y); }
      break;
    }
    }
    // umocnienia: gdy osada ma już kilkanaście budynków, otacza się palisadą z bramami i wieżami w narożnikach
    if (g.tick % (THINK * 3) === 0 && g.buildings.filter((b) => b.owner === p.id).length >= 12) fortify(g, p);
    // podatek, gdy osada jest zadowolona: złoto na żołd
    p.tax = p.popularity > 70 ? 2 : p.popularity > 55 ? 1 : 0;
    // wojsko: szkoli jednego włócznika naraz, gdy ma broń, złoto i wolnego chłopa
    const barracks = g.buildings.find((b) => b.owner === p.id && BUILDINGS[b.type]!.id === 'barracks');
    if (barracks) {
      // mieszane wojsko: mniej więcej co trzeci to łucznik, gdy są łuki
      const mine = g.soldiers.filter((s) => s.owner === p.id);
      const archers = mine.filter((s) => UNITS[s.kind]!.range).length;
      const wantArcher = archers * 3 < mine.length + 1;
      if (!(wantArcher && train(g, p.id, barracks.id, 'archer'))) train(g, p.id, barracks.id, UNITS[0]!.id);
      // łucznicy wchodzą na wolne wieże (po dwóch), reszta zostaje do ataku
      for (const t of g.buildings) {
        if (t.owner !== p.id || t.build || BUILDINGS[t.type]!.id !== 'watchtower') continue;
        const on = g.soldiers.filter((s) => s.post === t.id).length;
        if (on >= 2) continue;
        const free = mine.filter((s) => UNITS[s.kind]!.range && !s.post && s.goal < 0 && !s.target).slice(0, 2 - on);
        if (free.length) orderGarrison(g, p.id, free.map((s) => s.id), t.id);
      }
    }
    // atak falami: im później, tym większa fala; na poziomie pokojowym bot tylko się broni
    const wave = nextWave(g.tick, p.level);
    if (wave && wave.at - g.tick < THINK && g.tick >= (LEVELS[p.level] ?? LEVELS[2]!).first) {
      const army = g.soldiers.filter((s) => s.owner === p.id);
      const foe = g.players.filter((o) => o.team !== p.team && !o.defeated).map((o) => playerKeep(g, o.id)).find((k) => k);
      if (foe && army.length >= wave.size && foe.door >= 0) {
        // atak z dwóch stron: połowa idzie pod bramę, połowa obchodzi i uderza z boku; łucznicy z wież zostają
        const w = g.map.width, kx = foe.x + 1, ky = foe.y + 1;
        const field = army.filter((s) => !s.post);
        const half = Math.ceil(field.length / 2);
        const side = (g.tick / WAVE_EVERY) % 2 < 1 ? 1 : -1;
        const a = Math.min(g.map.height - 2, Math.max(1, ky + 7)) * w + kx;
        const b = ky * w + Math.min(w - 2, Math.max(1, kx + 7 * side));
        orderMove(g, p.id, field.slice(0, half).map((s) => s.id), a);
        orderMove(g, p.id, field.slice(half).map((s) => s.id), b);
      }
    }
    // wypady: między falami dwóch, trzech żołnierzy poluje na drwali i rybaków wroga poza murami
    if (wave && g.tick >= (LEVELS[p.level] ?? LEVELS[2]!).first / 2 && g.tick % (THINK * 30) === 0) {
      const idle = g.soldiers.filter((s) => s.owner === p.id && !s.post && s.goal < 0 && !s.target);
      if (idle.length >= 6) {
        const prey = g.units.find((u) => g.players[u.owner]?.team !== p.team && u.job && g.buildings.some((b) => b.id === u.job && ['woodcutter', 'fisher', 'quarry', 'mine'].includes(BUILDINGS[b.type]!.id)));
        if (prey) orderMove(g, p.id, idle.slice(0, 3).map((s) => s.id), (prey.py >> 8) * g.map.width + (prey.px >> 8));
      }
    }
  }
}

/**
 * Palisada bota: kwadrat wokół twierdzy, bramy pośrodku boków, wieże w narożnikach w środku.
 * Stawia po kilka odcinków naraz, gdy ma drewno; pola zajęte albo nieprzechodnie pomija (wyłomy zamykają woda i góry).
 */
function fortify(g: GameState, p: PlayerState): void {
  const keep = playerKeep(g, p.id);
  if (!keep) return;
  const cx = keep.x + 1, cy = keep.y + 1, w = g.map.width;
  const pal = buildingIndex('palisade'), gate = buildingIndex('gate'), tower = buildingIndex('watchtower');
  const wood = p.res[resIndex('wood')]!;
  if (wood < 25) return;
  let placed = 0;
  const x0 = cx - RING, x1 = cx + RING, y0 = cy - RING, y1 = cy + RING;
  const ring: [number, number][] = [];
  for (let x = x0; x <= x1; x++) ring.push([x, y0], [x, y1]);
  for (let y = y0 + 1; y < y1; y++) ring.push([x0, y], [x1, y]);
  // najpierw bramy (żeby mur nie zamknął przejść), potem reszta muru
  const isG = ([x, y]: [number, number]): boolean => (x === cx && (y === y0 || y === y1)) || (y === cy && (x === x0 || x === x1));
  ring.sort((a, b) => Number(isG(b)) - Number(isG(a)));
  for (const [x, y] of ring) {
    if (placed >= 8 || x < 1 || y < 1 || x >= w - 1 || y >= g.map.height - 1) continue;
    const t = y * w + x;
    if (g.occupancy[t] !== 0) continue;
    const isGate = (x === cx && (y === y0 || y === y1)) || (y === cy && (x === x0 || x === x1));
    const type = isGate ? gate : pal;
    if (canPlace(g, p.id, type, x, y) === null && placeBuilding(g, p.id, type, x, y)) placed++;
  }
  if (placed) return;
  // gdy mur stoi, wieże w narożnikach (w środku muru)
  for (const [x, y] of [[x0 + 1, y0 + 1], [x1 - 2, y0 + 1], [x0 + 1, y1 - 2], [x1 - 2, y1 - 2]] as const) {
    if (g.occupancy[y * w + x] !== 0) continue;
    if (canPlace(g, p.id, tower, x, y) === null) { placeBuilding(g, p.id, tower, x, y); return; }
  }
}
