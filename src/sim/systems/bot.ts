import { BUILDINGS, buildingIndex } from '../../data/buildings';
import { resIndex, type ResourceId } from '../../data/resources';
import { UNITS } from '../../data/units';
import { playerKeep, type GameState, type PlayerState } from '../state';
import { orderMove, train } from './army';
import { canPlace, placeBuilding } from './placement';

/**
 * Bot przeciwnik. Działa wewnątrz symulacji, więc jest w pełni deterministyczny i może grać także w meczach sieciowych.
 * Buduje osadę według listy, szkoli włóczników i co jakiś czas wysyła coraz większą falę na najbliższy wrogi zamek.
 */
const ORDER = ['woodcutter', 'orchard', 'woodcutter', 'house', 'stockpile', 'orchard', 'house', 'poleturner', 'barracks', 'quarry', 'house', 'granary', 'orchard', 'poleturner', 'house', 'cemetery', 'house'];
const THINK = 40;
/** Pierwszy atak po ok. 12 minutach gry, kolejne co ok. 6 minut */
const FIRST_WAVE = 7200;
const WAVE_EVERY = 3600;

function affordable(p: PlayerState, type: number): boolean {
  for (const [res, n] of Object.entries(BUILDINGS[type]!.cost)) if (p.res[resIndex(res as ResourceId)]! < n!) return false;
  return true;
}

/** Pierwsze wolne miejsce wokół twierdzy, szukane pierścieniami (stała kolejność = ten sam wynik u każdego) */
function spot(g: GameState, player: number, type: number): { x: number; y: number } | null {
  const keep = playerKeep(g, player);
  if (!keep) return null;
  for (let r = 4; r < 22; r++)
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
    // podatek, gdy osada jest zadowolona: złoto na żołd
    p.tax = p.popularity > 70 ? 2 : p.popularity > 55 ? 1 : 0;
    // wojsko: szkoli jednego włócznika naraz, gdy ma broń, złoto i wolnego chłopa
    const barracks = g.buildings.find((b) => b.owner === p.id && BUILDINGS[b.type]!.id === 'barracks');
    if (barracks) train(g, p.id, barracks.id, UNITS[0]!.id);
    // atak falami: im później, tym większa fala
    if (g.tick >= FIRST_WAVE && (g.tick - FIRST_WAVE) % WAVE_EVERY < THINK) {
      const army = g.soldiers.filter((s) => s.owner === p.id);
      const wave = 4 + Math.floor((g.tick - FIRST_WAVE) / WAVE_EVERY) * 2;
      const foe = g.players.filter((o) => o.team !== p.team && !o.defeated).map((o) => playerKeep(g, o.id)).find((k) => k);
      if (foe && army.length >= Math.min(wave, 12) && foe.door >= 0) {
        const w = g.map.width;
        orderMove(g, p.id, army.map((s) => s.id), foe.door + 2 * w);
      }
    }
  }
}
