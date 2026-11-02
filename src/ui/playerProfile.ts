import { befriend, friendLists, playerById, playerMatches, statsOf, type Player, type Stats } from '../net/social';
import { me, onlinePlayers } from '../net/supa';
import { BADGES, levelOf, titleOf } from '../data/progress';
import { modeText } from './noticeText';
import { ago, whereText } from './friendsView';
import { avatarSvg } from './avatars';
import { lang, tx } from '../i18n';

/**
 * Profil gracza (Michał 2.11.2026): herb, tytuł, poziom z paskiem PD, statystyki, odznaki i ostatnie bitwy.
 * Ten sam profil w panelu znajomych i jako okno nad rankingiem albo pokojem gry (klik w nick).
 */
export interface ProfileDeps {
  el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K];
  button(text: string, onClick: () => void, cls?: string): HTMLButtonElement;
  shield(avatar: number, size: number): HTMLElement;
}

export function profileCard(id: string, d: ProfileDeps, actions: (p: Player) => HTMLElement[], known?: Player): HTMLElement {
  const { el } = d;
  const box = el('div', 'fr-profile');
  box.append(el('p', 'net-msg', tx('Wczytuję profil…', 'Loading the profile…')));
  void (async () => {
    const p = known ?? await playerById(id);
    const st = (await statsOf([id])).get(id);
    if (!p) { box.replaceChildren(el('p', 'net-msg bad', tx('Nie ma takiego gracza.', 'No such player.'))); return; }
    const s: Stats = st ?? { xp: 0, level: 1, matches: 0, wins: 0, kills: 0 };
    const lv = levelOf(s.xp);
    const o = onlinePlayers().find((x) => x.id === id);
    const hero = el('div', 'fr-hero');
    const crest = el('div', 'fr-hero-crest'); crest.append(d.shield(o?.avatar ?? p.avatar, 132));
    const info = el('div', 'fr-hero-id');
    const bar = el('div', 'house-xp'); const fill = el('span', 'house-xp-fill'); fill.style.width = `${Math.round((lv.into / lv.need) * 100)}%`; bar.append(fill);
    const dot = el('span', `fr-status ${o ? (o.where === 'menu' ? 'on' : 'busy') : 'off'}`);
    dot.append(el('span', 'fr-dot'), el('span', '', o ? (o.where === 'menu' ? tx('dostępny', 'online') : tx('w grze', 'in game')) : tx('offline', 'offline')));
    info.append(el('h3', 'fr-hero-name', p.nick), el('p', 'fr-hero-title', `${titleOf(lv.level)} · ${tx('poziom', 'level')} ${lv.level}`), bar,
      el('p', 'fr-hero-xp', `${lv.into} / ${lv.need} ${tx('PD do następnego poziomu', 'XP to the next level')}`), dot, el('p', 'fr-where', whereText(p, o)));
    const acts = el('div', 'fr-acts');
    if (id !== me()?.id) acts.append(...actions(p));
    info.append(acts);
    hero.append(crest, info);
    const dl = el('dl', 'house-stats fr-stats');
    const rate = s.matches ? `${Math.round((s.wins / s.matches) * 100)}%` : '—';
    const hours = s.minutes ? `${Math.floor(s.minutes / 60)} h ${s.minutes % 60} min` : '—';
    for (const [k, v] of [[tx('Bitwy', 'Battles'), String(s.matches)], [tx('Zwycięstwa', 'Victories'), String(s.wins)], [tx('Skuteczność', 'Win rate'), rate],
      [tx('Wygrane przez sieć', 'Online wins'), String(s.online_wins ?? 0)], [tx('Pokonani wrogowie', 'Foes slain'), String(s.kills)], [tx('Zburzone budynki', 'Buildings razed'), String(s.razed ?? 0)],
      [tx('Postawione budynki', 'Buildings raised'), String(s.built ?? 0)], [tx('Czas w bitwach', 'Time in battle'), hours]] as const) {
      const c = el('div', 'house-stat'); c.append(el('dt', '', k), el('dd', '', v)); dl.append(c);
    }
    const bs = { ...s, level: lv.level };
    const got = BADGES.filter((b) => b.of(bs) >= b.goal);
    const badges = el('ul', 'fr-badges');
    for (const b of BADGES) {
      const li = el('li', b.of(bs) >= b.goal ? 'fr-badge got' : 'fr-badge', lang() === 'en' ? b.en[0] : b.pl[0]);
      li.title = lang() === 'en' ? b.en[1] : b.pl[1];
      badges.append(li);
    }
    const matchBox = el('div', 'fr-matches');
    matchBox.append(el('p', 'net-msg', tx('Wczytuję bitwy…', 'Loading battles…')));
    box.replaceChildren(hero, el('h4', 'house-h', tx('Statystyki', 'Statistics')), dl,
      el('h4', 'house-h', tx(`Odznaki · ${got.length} z ${BADGES.length}`, `Badges · ${got.length} of ${BADGES.length}`)), badges,
      el('h4', 'house-h', tx('Ostatnie bitwy', 'Recent battles')), matchBox);
    const ms = await playerMatches(id, 15);
    if (typeof ms === 'string') { matchBox.replaceChildren(el('p', 'net-msg', ms)); return; }
    if (!ms.length) { matchBox.replaceChildren(el('p', 'net-msg', tx('Jeszcze bez bitew.', 'No battles yet.'))); return; }
    const table = el('table', 'house-table');
    const tr0 = el('tr');
    for (const h of [tx('Kiedy', 'When'), tx('Rodzaj', 'Type'), tx('Wynik', 'Result'), tx('Czas', 'Time'), tx('Wrogowie', 'Foes'), tx('Zburzone', 'Razed'), tx('PD', 'XP')]) { const th = el('th', '', h); th.scope = 'col'; tr0.append(th); }
    const th0 = el('thead'); th0.append(tr0);
    const tb = el('tbody');
    for (const m of ms) {
      const tr = el('tr');
      tr.append(el('td', '', ago(m.created_at)), el('td', '', modeText(m.mode)), el('td', m.won ? 'won' : 'lost', m.won ? tx('Zwycięstwo', 'Victory') : tx('Porażka', 'Defeat')),
        el('td', '', `${m.minutes} min`), el('td', '', String(m.kills)), el('td', '', String(m.razed)), el('td', 'xp', `+${m.xp}`));
      tb.append(tr);
    }
    table.append(th0, tb);
    matchBox.replaceChildren(table);
  })();
  return box;
}

/**
 * Profil jako okno nad tym, co jest pod spodem (ranking, pokój gry) — bez wychodzenia z pokoju.
 * Działania: dodaj do znajomych / przyjmij, a u znajomego „Napisz” (otwiera czat w panelu znajomych).
 */
export function openProfileModal(id: string, d: ProfileDeps, chat: (id: string) => void): void {
  document.querySelector('.fr-modal')?.remove();
  const back = document.createElement('div');
  back.className = 'fr-modal';
  back.setAttribute('role', 'dialog');
  back.setAttribute('aria-modal', 'true');
  back.setAttribute('aria-label', tx('Profil gracza', 'Player profile'));
  const panel = d.el('div', 'fr-modal-panel panel');
  const close = (): void => { back.remove(); document.removeEventListener('keydown', esc, true); };
  const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  const x = d.button('✕', close, 'fr-modal-x'); x.setAttribute('aria-label', tx('Zamknij', 'Close'));
  const card = profileCard(id, d, (p) => {
    const acts: HTMLElement[] = [];
    void friendLists().then((l) => {
      const friend = l.friends.some((f) => f.id === p.id), out = l.outgoing.some((f) => f.id === p.id), inc = l.incoming.some((f) => f.id === p.id);
      const row = card.querySelector('.fr-acts');
      if (!row) return;
      if (friend) row.append(d.button(tx('Napisz', 'Message'), () => { close(); chat(p.id); }, 'menu-btn btn-ok fr-btn'), d.el('span', 'net-tag', tx('znajomy', 'friend')));
      else if (out) row.append(d.el('span', 'net-tag off', tx('zaproszenie wysłane', 'request sent')));
      else {
        const b = d.button(inc ? tx('Przyjmij', 'Accept') : tx('Dodaj do znajomych', 'Add friend'), () => {
          b.disabled = true; b.textContent = inc ? tx('Znajomy ✓', 'Friend ✓') : tx('Wysłano ✓', 'Sent ✓'); b.classList.add('fr-done');
          void befriend(p.id).then((e) => { if (e) { b.disabled = false; b.textContent = e; } });
        }, 'menu-btn btn-ok fr-btn');
        row.append(b);
      }
    });
    return acts;
  });
  panel.append(x, card);
  back.append(panel);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', esc, true);
  (document.querySelector('.menu') ?? document.body).append(back);
  x.focus();
}

/** Mały herb do list (gdy nie ma pod ręką `shield` z online.ts) */
export const crestEl = (avatar: number, size: number): HTMLElement => { const s = document.createElement('span'); s.className = 'net-shield'; s.innerHTML = avatarSvg(avatar, size); return s; };
