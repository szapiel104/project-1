import { UNITS } from '../data/units';
import type { GameState } from '../sim/state';

/**
 * Paski zdrowia nad żołnierzami i wilkami (wydzielone z main.ts, 27.10.2026).
 *
 * Każdy cios widać: pasek schodzi płynnie do nowej wartości, a za nim przez chwilę zostaje jaśniejszy ślad utraconego
 * zdrowia (jak w grach akcji), nad paskiem wyskakuje „−N”. Płonący po ognistej strzale albo kuli ognia ma pasek
 * z pomarańczową poświatą, przymrożony czarem wody — z niebieską. Pasek jest przypisany do żołnierza (po id),
 * więc płynne schodzenie nie przeskakuje między ludźmi.
 */
interface ScreenUnit { id: number; x: number; y: number; owner?: number; hp: number; wx?: number; wy?: number; wz?: number }
export interface HpBarsDeps {
  game: () => GameState;
  me: () => number;
  /** Ustawienia → Interfejs → Paski zdrowia */
  mode: () => 'always' | 'combat' | 'selected' | 'never';
  marked: (id: number) => boolean;
  soldiers: () => ScreenUnit[];
  wolves: () => ScreenUnit[];
  wolfHp: number;
  /** Punkt świata na ekran (liczby obrażeń zostają nad trafionym także przy ruchu kamery i po jego śmierci) */
  project?: (x: number, y: number, z: number) => { sx: number; sy: number; front: boolean };
}

interface Shown { hp: number; trail: number; last: number; seen: number; el: HTMLElement; fill: HTMLElement; ghost: HTMLElement }

export function createHpBars(d: HpBarsDeps): () => void {
  const layer = document.createElement('div');
  layer.className = 'hpbars';
  document.body.append(layer);
  const shown = new Map<string, Shown>();
  const free: HTMLElement[] = [];
  let frame = 0;
  let pops = 0;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const barFor = (key: string, ratio: number, hp: number): Shown => {
    let s = shown.get(key);
    if (s) return s;
    const el = free.pop() ?? (() => {
      const b = document.createElement('div');
      b.className = 'hpbar';
      b.append(document.createElement('i'), document.createElement('span'));
      layer.append(b);
      return b;
    })();
    el.hidden = false;
    s = { hp: ratio, trail: ratio, last: hp, seen: frame, el, ghost: el.firstChild as HTMLElement, fill: el.lastChild as HTMLElement };
    shown.set(key, s);
    return s;
  };

  /**
   * „−N” nad paskiem: wyskakuje i blednie (bez ruchu przy ograniczonych animacjach). Liczba jest przypięta do trafionego
   * w świecie gry (Michał 30.10.2026: przy ruchu kamery latały za ekranem): co klatkę stoi nad nim, a gdy zniknie z listy
   * (padł, wyszedł z kadru) — nad ostatnim miejscem, w którym był.
   */
  interface Pop { el: HTMLElement; key: string; dx: number; wx?: number; wy?: number; wz?: number; x: number; y: number }
  const live: Pop[] = [];
  const pop = (key: string, u: ScreenUnit, n: number, kind: string): void => {
    if (pops > 40) return;
    const p = document.createElement('span');
    p.className = `hpdmg${kind ? ` ${kind}` : ''}`;
    p.textContent = `−${n}`;
    const it: Pop = { el: p, key, dx: 4 + ((n * 7) % 13) - 6, wx: u.wx, wy: u.wy, wz: u.wz, x: u.x, y: u.y };
    p.style.transform = `translate(${Math.round(u.x + it.dx)}px, ${Math.round(u.y - 30)}px)`;
    layer.append(p);
    live.push(it);
    pops++;
    setTimeout(() => { p.remove(); pops--; const i = live.indexOf(it); if (i >= 0) live.splice(i, 1); }, reduced ? 700 : 1200);
  };
  const where = new Map<string, ScreenUnit>();
  const follow = (): void => {
    for (const it of live) {
      const u = where.get(it.key);
      let x: number, y: number;
      if (u) { x = u.x; y = u.y; it.wx = u.wx; it.wy = u.wy; it.wz = u.wz; }
      else if (d.project && it.wx !== undefined) {
        const s = d.project(it.wx, it.wy!, it.wz!);
        if (!s.front) { it.el.style.visibility = 'hidden'; continue; }
        x = s.sx; y = s.sy;
      } else { x = it.x; y = it.y; }
      it.el.style.visibility = '';
      it.el.style.transform = `translate(${Math.round(x + it.dx)}px, ${Math.round(y - 30)}px)`;
    }
  };

  const place = (key: string, u: ScreenUnit, max: number, team: 'own' | 'foe', state: string): void => {
    const ratio = Math.max(0, Math.min(1, u.hp / max));
    const s = barFor(key, ratio, u.hp);
    s.seen = frame;
    if (u.hp < s.last) pop(key, u, Math.round(s.last - u.hp), state);
    s.last = u.hp;
    // pasek dochodzi do nowej wartości szybko, ale płynnie; jaśniejszy ślad zostaje i dopiero potem znika
    s.hp += (ratio - s.hp) * (reduced ? 1 : 0.3);
    if (s.trail < s.hp) s.trail = s.hp;
    else s.trail += (s.hp - s.trail) * (reduced ? 1 : 0.05);
    s.el.style.transform = `translate(${Math.round(u.x - 17)}px, ${Math.round(u.y - 4)}px)`;
    s.el.dataset.team = team;
    s.el.dataset.state = state;
    s.fill.style.width = `${(s.hp * 100).toFixed(1)}%`;
    s.ghost.style.width = `${(s.trail * 100).toFixed(1)}%`;
    s.fill.dataset.low = String(ratio < 0.35);
  };

  return () => {
    frame++;
    const g = d.game(), me = d.me(), mode = d.mode();
    const myTeam = g.players[me]?.team;
    const byId = new Map<number, GameState['soldiers'][number]>();
    for (const x of g.soldiers) byId.set(x.id, x);
    where.clear();
    if (mode !== 'never') {
      for (const u of d.soldiers()) {
        const s = byId.get(u.id);
        if (!s) continue;
        const max = UNITS[s.kind]!.hp;
        const marked = d.marked(u.id);
        const key = `s${u.id}`;
        where.set(key, u);
        // w trybie „w walce” pasek widać u rannych i zaznaczonych — a przy świeżym ciosie od razu (zanim zejdzie ślad)
        const was = shown.get(key);
        const hurt = u.hp < max || (!!was && was.trail < 0.995);
        if (mode === 'selected' ? !marked : mode === 'combat' ? !hurt && !marked : false) continue;
        const state = s.burn ? 'burn' : (s.slow ?? 0) > g.tick ? 'frost' : '';
        place(key, u, max, g.players[s.owner]?.team === myTeam ? 'own' : 'foe', state);
      }
      if (mode !== 'selected') for (const w of d.wolves()) { where.set(`w${w.id}`, w); place(`w${w.id}`, w, d.wolfHp, 'foe', ''); }
    }
    if (live.length) follow();
    // poza ekranem albo polegli: pasek wraca do puli
    for (const [key, s] of shown) if (s.seen !== frame) { s.el.hidden = true; free.push(s.el); shown.delete(key); }
  };
}
