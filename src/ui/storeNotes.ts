import { BUILDINGS, footprint } from '../data/buildings';
import { RESOURCES, RESOURCE_DEFS, type ResourceId, type StoreKind } from '../data/resources';
import { t, tx } from '../i18n';
import type { GameState } from '../sim/state';
import type { Scribe, ScribeAction } from './scribe';

/**
 * Skryba o magazynach (storage.ts): gdy w magazynach jakiegoś rodzaju zabrakło miejsca i warsztaty stanęły, mówi,
 * kto czeka, co leży pod drzwiami i co postawić — z przyciskiem do magazynu. Gdy towar wniesiono i warsztaty ruszyły,
 * mówi i o tym. Jedna wiadomość na każde zapełnienie (nie co minutę).
 */
const STORE_NAME = (): Record<StoreKind, string> => ({
  stockpile: tx('Skład', 'The stockpile'), granary: tx('Spichlerz', 'The granary'), grain: tx('Stodoła', 'The barn'), armory: tx('Zbrojownia', 'The armoury'),
});
const BUILD_HINT = (): Record<StoreKind, string> => ({
  stockpile: tx('Postaw kolejny skład albo stodołę', 'Build another stockpile or a barn'),
  granary: tx('Postaw kolejny spichlerz albo podnieś racje', 'Build another granary or raise the rations'),
  grain: tx('Postaw kolejną stodołę albo młyn, który przerobi zboże', 'Build another barn, or a mill to work through the grain'),
  armory: tx('Postaw kolejną zbrojownię albo wyszkol wojsko', 'Build another armoury or train some troops'),
});

const seen = new WeakMap<GameState, Map<StoreKind, boolean>>();

export function storeNotes(g: GameState, me: number, scribe: Scribe, showAt: (x: number, y: number) => ScribeAction): void {
  let state = seen.get(g);
  if (!state) { state = new Map(); seen.set(g, state); }
  // kto stoi i na co czeka (rodzaj magazynu → warsztaty i towar)
  const stalled = new Map<StoreKind, { shops: string[]; res: Set<string> }>();
  for (const b of g.buildings) {
    if (b.owner !== me || !b.stall) continue;
    const id = RESOURCES[b.stall - 1]!;
    const kind = RESOURCE_DEFS[id].store;
    if (!kind) continue;
    const s = stalled.get(kind) ?? { shops: [], res: new Set<string>() };
    // w zdaniu po polsku nazwy budynków małą literą („a sad czeka”), po angielsku z przedimkiem dokleja go zdanie
    s.shops.push(t(BUILDINGS[b.type]!.name).toLowerCase());
    s.res.add(t(RESOURCE_DEFS[id as ResourceId].name).toLowerCase());
    stalled.set(kind, s);
  }
  for (const kind of ['stockpile', 'granary', 'grain', 'armory'] as StoreKind[]) {
    const now = stalled.get(kind);
    const was = state.get(kind) ?? false;
    if (now && !was) {
      // magazyn, pod którym leży najwięcej towaru tego rodzaju (tam pokaże przycisk)
      let at: { x: number; y: number } | undefined, most = 0;
      const sum = new Map<number, number>();
      for (const p of g.piles ?? []) if (p.owner === me && p.store && RESOURCE_DEFS[RESOURCES[p.res]!].store === kind) sum.set(p.store, (sum.get(p.store) ?? 0) + p.amt);
      for (const [id, n] of sum) {
        const b = g.buildings.find((x) => x.id === id);
        if (b && n > most) { most = n; const fp = footprint(BUILDINGS[b.type]!, b.rot); at = { x: b.x + fp.w / 2, y: b.y + fp.h / 2 }; }
      }
      const shops = [...new Set(now.shops)];
      const who = shops.length > 2 ? tx(`${shops.slice(0, 2).join(', ')} i inne`, `${shops.slice(0, 2).join(', ')} and others`) : shops.join(tx(' i ', ' and '));
      const what = [...now.res].join(', ');
      const many = shops.length > 1;
      const name = STORE_NAME()[kind];
      scribe.say(`storeFull-${kind}-${g.tick}`, tx(
        `Panie, ${name.toLowerCase()} ${kind === 'stockpile' || kind === 'granary' ? 'pełny' : 'pełna'}! Pod drzwiami leży: ${what}, a ${who} ${many ? 'czekają' : 'czeka'} bezczynnie. ${BUILD_HINT()[kind]} — magazynierzy wniosą towar, gdy tylko będzie miejsce.`,
        `My lord, ${name.toLowerCase()} is full! The ${what} lies at the door, and the ${who.toLowerCase()} ${many ? 'stand' : 'stands'} idle. ${BUILD_HINT()[kind]} — the storekeepers will carry the goods in as soon as there is room.`,
      ), true, 'scribe', at ? showAt(at.x, at.y) : undefined);
    } else if (!now && was) {
      scribe.say(`storeFree-${kind}-${g.tick}`, tx(
        `${STORE_NAME()[kind]} ma znowu miejsce — towar spod drzwi wniesiony, warsztaty wróciły do pracy.`,
        `${STORE_NAME()[kind]} has room again — the goods are carried in and the workshops are back at work.`,
      ));
    }
    state.set(kind, !!now);
  }
}
