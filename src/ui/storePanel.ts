import { BUILDINGS } from '../data/buildings';
import { RESOURCES, RESOURCE_DEFS, type ResourceId, type StoreKind } from '../data/resources';
import { t, tx } from '../i18n';
import { Phase, type Building, type GameState } from '../sim/state';

/**
 * Okno magazynu: logistyka (storage.ts) — kto tu pracuje i co robi, co leży pod drzwiami, bo nie było miejsca,
 * i które warsztaty stoją, czekając na miejsce. Dane zbiera `storeLogistics`, rysuje `renderLogistics`.
 */
export interface StoreLogistics {
  /** Magazynierzy: imię i zajęcie */
  keepers: { name: string; doing: string }[];
  want: number;
  /** Towar pod drzwiami tego magazynu */
  here: { id: string; amount: number }[];
  /** Towar pod wszystkimi magazynami gracza tego samego rodzaju (gdy pod tym nic nie leży, ale gdzie indziej tak) */
  elsewhere: number;
  /** Warsztaty, które czekają na miejsce w magazynach tego rodzaju */
  waiting: { name: string; res: string }[];
}

const resName = (id: string): string => t(RESOURCE_DEFS[id as ResourceId].name).toLowerCase();

/** Co magazynier robi teraz, po ludzku */
function keeperDoing(g: GameState, u: GameState['units'][number]): string {
  if (u.phase === Phase.ToPile) {
    const p = g.piles?.find((x) => x.id === u.target);
    return p ? tx(`idzie po ${resName(RESOURCES[p.res]!)} spod drzwi`, `fetching ${resName(RESOURCES[p.res]!)} from the doorstep`) : tx('idzie po towar', 'fetching goods');
  }
  if (u.phase === Phase.ToStore && u.carryRes >= 0) return tx(`wnosi ${resName(RESOURCES[u.carryRes]!)} do środka`, `carrying ${resName(RESOURCES[u.carryRes]!)} inside`);
  if (u.phase === Phase.ToRubble) return tx('wynosi gruz z rozbiórki', 'clearing rubble from a demolition');
  if (u.phase === Phase.Sleeping || u.phase === Phase.ToSleep) return tx('śpi', 'asleep');
  if (u.phase === Phase.Evening || u.phase === Phase.ToEvening) return tx('fajrant przy ogniu', 'off duty by the fire');
  if (u.phase === Phase.Resting || u.phase === Phase.ToRest) return tx('odpoczywa', 'resting');
  if (u.phase === Phase.Returning) return tx('wraca do magazynu', 'heading back to the store');
  return tx('czeka przy drzwiach na robotę', 'waiting at the door for work');
}

export function storeLogistics(g: GameState, b: Building, nameOf: (unitId: number) => string): StoreLogistics | undefined {
  const def = BUILDINGS[b.type]!;
  if (!def.keepers || b.build) return undefined;
  const ids = [b.worker, ...(b.crew ?? [])].filter((id) => id);
  const keepers = ids.map((id) => {
    const u = g.units.find((x) => x.id === id);
    return { name: nameOf(id), doing: u ? keeperDoing(g, u) : '' };
  });
  const kinds = new Set<StoreKind>(def.stores ?? []);
  const sum = new Map<string, number>();
  let elsewhere = 0;
  for (const p of g.piles ?? []) {
    if (p.owner !== b.owner) continue;
    const id = RESOURCES[p.res]!;
    const kind = RESOURCE_DEFS[id].store;
    if (!kind || !kinds.has(kind)) continue;
    if (p.store === b.id) sum.set(id, (sum.get(id) ?? 0) + p.amt);
    else elsewhere += p.amt;
  }
  const waiting: { name: string; res: string }[] = [];
  for (const o of g.buildings) {
    if (o.owner !== b.owner || !o.stall) continue;
    const id = RESOURCES[o.stall - 1]!;
    const kind = RESOURCE_DEFS[id].store;
    if (kind && kinds.has(kind)) waiting.push({ name: t(BUILDINGS[o.type]!.name), res: resName(id) });
  }
  return { keepers, want: def.keepers, here: [...sum].map(([id, amount]) => ({ id, amount })), elsewhere, waiting };
}

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** Sekcja logistyki pod zapasami w oknie magazynu */
export function renderLogistics(s: StoreLogistics, icon: (id: string) => HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  // magazynierzy
  const crew = node('div', 'logi-block');
  const head = node('p', 'logi-head');
  head.append(icon('store'), node('strong', '', tx(`Magazynierzy: ${s.keepers.length} / ${s.want}`, `Storekeepers: ${s.keepers.length} / ${s.want}`)));
  crew.append(head);
  if (s.keepers.length) {
    const list = node('ul', 'logi-list');
    for (const k of s.keepers) { const li = node('li'); li.append(node('strong', '', k.name), ` — ${k.doing}`); list.append(li); }
    crew.append(list);
  } else crew.append(node('p', 'logi-note', tx('Nikt tu teraz nie pracuje: magazynier przyjdzie, gdy przy ognisku będzie wolny chłop. Bez niego robotnicy sami wnoszą swój towar.', 'Nobody works here just now: a storekeeper will come once an idle peasant is free by the fire. Until then the workers carry their own goods in.')));
  out.push(crew);
  // towar pod drzwiami
  if (s.here.length || s.waiting.length || s.elsewhere) {
    const box = node('div', 'logi-block logi-alert');
    const h = node('p', 'logi-head');
    h.append(icon('alert'), node('strong', '', s.here.length ? tx('Pełno — towar czeka pod drzwiami', 'Full — goods are waiting at the door') : tx('Magazyny tego rodzaju są pełne', 'Stores of this kind are full')));
    box.append(h);
    if (s.here.length) {
      const grid = node('div', 'stock-grid');
      for (const it of s.here) {
        const cell = node('div', 'stock-item logi-pile');
        cell.title = t(RESOURCE_DEFS[it.id as ResourceId].name);
        cell.append(icon(it.id), node('strong', '', String(it.amount)), node('span', '', t(RESOURCE_DEFS[it.id as ResourceId].name)));
        grid.append(cell);
      }
      box.append(grid);
    }
    if (s.elsewhere) box.append(node('p', 'logi-note', tx(`Pod innymi magazynami leży jeszcze ${s.elsewhere} sztuk.`, `Another ${s.elsewhere} lie at the doors of other stores.`)));
    if (s.waiting.length) {
      const p = node('p', 'logi-note');
      // te same warsztaty razem: „Sad ×2 (jabłka)”
      const groups = new Map<string, number>();
      for (const w of s.waiting) { const k = `${w.name}|${w.res}`; groups.set(k, (groups.get(k) ?? 0) + 1); }
      p.append(node('strong', '', tx('Czekają na miejsce: ', 'Waiting for room: ')), [...groups].map(([k, n]) => { const [name, res] = k.split('|'); return `${name}${n > 1 ? ` ×${n}` : ''} (${res})`; }).join(', '));
      box.append(p);
    }
    box.append(node('p', 'logi-tip', tx('Postaw kolejny magazyn albo zużyj zapas. Gdy zwolni się miejsce, magazynierzy wniosą towar spod drzwi, a warsztaty same wrócą do pracy.', 'Build another store or use up the stock. As soon as there is room, the storekeepers carry the goods in and the workshops go back to work on their own.')));
    out.push(box);
  }
  return out;
}
