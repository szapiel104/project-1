import { RESOURCES, RESOURCE_DEFS } from '../data/resources';
import { TEAM_COLORS } from '../data/teams';
import { t } from '../i18n';
import type { GameState } from '../sim/state';
import { CARAVAN_MAX, CARAVANS_PER_PLAYER } from '../sim/systems/caravans';
import { resIcon } from './hud';

/**
 * Okno „Sojusznicy” (gra drużynowa): wysyłanie surowców sojusznikowi wozem (polecenie `send` w symulacji)
 * i ściągawka znaczników (Alt + klik). Przycisk widać tylko wtedy, gdy gracz ma sojusznika w grze.
 */
export interface AlliesHost {
  /** Nazwa gracza (nick człowieka albo „Bot …”) */
  name(player: number): string;
  send(to: number, res: number, amount: number): void;
}

const AMOUNTS = [10, 25, 50, 100];
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export function createAllies(host: AlliesHost): { update(g: GameState, me: number): void; close(): void; isOpen(): boolean; readonly button: HTMLButtonElement } {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'allies-btn';
  btn.hidden = true;
  btn.innerHTML = '<span aria-hidden="true">⚑</span> Sojusznicy';
  btn.title = 'Wyślij surowce sojusznikowi';
  document.body.append(btn);
  const panel = document.createElement('div');
  panel.className = 'allies-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Sojusznicy');
  document.body.append(panel);
  btn.setAttribute('aria-expanded', 'false');
  const open = (on: boolean): void => { panel.hidden = !on; btn.setAttribute('aria-expanded', String(on)); if (on) paint(); };
  btn.addEventListener('click', () => open(panel.hidden === true));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { e.stopImmediatePropagation(); open(false); } }, true);

  let g: GameState | null = null, me = 0;
  let to = -1, res = RESOURCES.indexOf('wood'), amount = 25;
  let lastKey = '';

  function paint(): void {
    if (!g) return;
    const mine = g.players[me]!;
    const allies = g.players.filter((p) => p.team === mine.team && p.id !== me && !p.defeated && !p.left);
    if (!allies.some((p) => p.id === to)) to = allies[0]?.id ?? -1;
    panel.replaceChildren();
    const head = document.createElement('div');
    head.className = 'allies-head';
    const h = document.createElement('strong'); h.textContent = 'Sojusznicy';
    const x = document.createElement('button'); x.type = 'button'; x.className = 'allies-x'; x.textContent = '×'; x.setAttribute('aria-label', 'Zamknij'); x.addEventListener('click', () => open(false));
    head.append(h, x);
    panel.append(head);

    const sec = (title: string): HTMLElement => { const d = document.createElement('div'); d.className = 'allies-sec'; const p = document.createElement('p'); p.className = 'allies-label'; p.textContent = title; d.append(p); panel.append(d); return d; };
    // komu
    const who = sec('Komu wysłać');
    const row = document.createElement('div'); row.className = 'allies-row';
    for (const a of allies) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'allies-chip';
      b.setAttribute('aria-pressed', String(a.id === to));
      b.style.setProperty('--team', hex(TEAM_COLORS[a.team] ?? 0x888888));
      b.textContent = host.name(a.id);
      b.addEventListener('click', () => { to = a.id; paint(); });
      row.append(b);
    }
    who.append(row);
    // co
    const what = sec('Co');
    const grid = document.createElement('div'); grid.className = 'allies-res';
    RESOURCES.forEach((id, i) => {
      const have = mine.res[i]!;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'allies-resbtn';
      b.setAttribute('aria-pressed', String(i === res));
      b.disabled = have <= 0;
      b.title = `${t(RESOURCE_DEFS[id].name)}: ${have}`;
      b.setAttribute('aria-label', b.title);
      const n = document.createElement('span'); n.textContent = String(have);
      b.append(resIcon(id), n);
      b.addEventListener('click', () => { res = i; paint(); });
      grid.append(b);
    });
    what.append(grid);
    // ile
    const how = sec('Ile');
    const r2 = document.createElement('div'); r2.className = 'allies-row';
    for (const a of AMOUNTS) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'allies-chip';
      b.setAttribute('aria-pressed', String(a === amount));
      b.textContent = String(a);
      b.addEventListener('click', () => { amount = a; paint(); });
      r2.append(b);
    }
    how.append(r2);
    // wysyłka
    const going = (g.caravans ?? []).filter((c) => c.owner === me);
    const have = mine.res[res]!;
    const n = Math.min(amount, CARAVAN_MAX, have);
    const go = document.createElement('button'); go.type = 'button'; go.className = 'menu-btn allies-go';
    const full = going.length >= CARAVANS_PER_PLAYER;
    go.disabled = to < 0 || n < 1 || full;
    go.textContent = to < 0 ? 'Brak sojusznika w grze' : full ? `Najwyżej ${CARAVANS_PER_PLAYER} wozy naraz` : n < 1 ? 'Nie masz tego surowca' : `Wyślij wóz: ${n} × ${t(RESOURCE_DEFS[RESOURCES[res]!].name).toLowerCase()}`;
    go.addEventListener('click', () => { host.send(to, res, n); go.disabled = true; go.textContent = 'Wóz wyrusza…'; });
    panel.append(go);
    const hint = document.createElement('p'); hint.className = 'allies-hint';
    hint.textContent = 'Wóz jedzie przez mapę do zamku sojusznika — wrogi żołnierz, który go dopadnie, zabiera towar. Pilnuj drogi.';
    panel.append(hint);
    if (going.length) {
      const list = sec('W drodze');
      for (const c of going) {
        const p = document.createElement('p'); p.className = 'allies-going';
        p.textContent = `${c.amount} × ${t(RESOURCE_DEFS[RESOURCES[c.res]!].name).toLowerCase()} → ${host.name(c.to)} (zostało ok. ${c.path.length} pól)`;
        list.append(p);
      }
    }
    const tip = document.createElement('p'); tip.className = 'allies-hint';
    tip.innerHTML = '<kbd>Alt</kbd> + klik w mapę: znacznik dla drużyny (atak, pomocy, zbiórka). <kbd>Spacja</kbd>: do ostatniego znacznika.';
    panel.append(tip);
  }

  return {
    isOpen: () => !panel.hidden,
    update(state, who) {
      g = state; me = who;
      const mine = state.players[me];
      const any = !!mine && state.players.some((p) => p.team === mine.team && p.id !== me && !p.defeated && !p.left);
      btn.hidden = !any;
      if (!any && !panel.hidden) open(false);
      if (panel.hidden) return;
      // odświeżamy tylko, gdy zmieniło się coś widocznego (zapasy, wozy), żeby nie przerywać klikania
      const key = `${[...mine!.res].join(',')}|${(state.caravans ?? []).filter((c) => c.owner === me).map((c) => `${c.id}:${c.path.length >> 3}`).join(',')}`;
      if (key !== lastKey) { lastKey = key; paint(); }
    },
    close() { open(false); btn.hidden = true; },
    button: btn,
  };
}
