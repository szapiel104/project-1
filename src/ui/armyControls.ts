import { tx } from '../i18n';

/**
 * Rozkazy dla zaznaczonego wojska jako rząd ikon (Michał 28.10.2026: okno z napisami zasłaniało pół ekranu).
 * Szyk, marsz, postawa i rozkazy to przyciski z ikoną; nazwa i opis wyskakują w dymku po najechaniu albo przejściu
 * klawiszem Tab. Opis zaznaczonych i podpowiedź ze skrótami są zwinięte pod przyciskiem „Skróty”: można je rozwinąć,
 * ale przy każdym nowym zaznaczeniu (okno wojska znika i pojawia się znowu) zwijają się z powrotem.
 */

export interface ArmyCtl { form: number; stance: number; march: number; patrol?: number }

interface Item { name: string; tip: string; icon: string }

// ikony 24×24 rysowane kreską w kolorze tekstu (currentColor), więc wciśnięty przycisk ma je jasne na czerwieni
const svg = (body: string): string => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const dots = (pts: [number, number][], r = 1.7): string => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`).join('');
const grid = (xs: number[], ys: number[]): [number, number][] => ys.flatMap((y) => xs.map((x) => [x, y] as [number, number]));

const ICON = {
  // szyk: ludzie z góry jako kropki
  line: svg(dots(grid([3, 7.5, 12, 16.5, 21], [9, 15]))),
  block: svg(dots(grid([6, 12, 18], [6, 12, 18]))),
  loose: svg(dots([[4, 5], [14, 5], [9, 12], [19, 12], [4, 19], [14, 19]])),
  packed: svg(dots(grid([5, 9.7, 14.3, 19], [5, 9.7, 14.3, 19]), 1.6)),
  // marsz: strzałka; z walką — strzałka przez skrzyżowane miecze
  plain: svg('<path d="M3 12h16M14 7l5 5-5 5"/>'),
  fighting: svg('<path d="M4 4l9 9M20 4l-9 9M7 13l-2 2M17 13l2 2M3 21l3-3M21 21l-3-3"/><path d="M9 21h6" />'),
  // postawa: miecz do przodu, tarcza, stopa wbita w ziemię (stój)
  attack: svg('<path d="M14.5 3.5L20.5 3.5 20.5 9.5 9 21 3 15z"/><path d="M6.5 13.5l4 4M3 21l2.5-2.5"/>'),
  defend: svg('<path d="M12 3l8 3v6c0 4.5-3.4 7.8-8 9-4.6-1.2-8-4.5-8-9V6z"/><path d="M12 7v10M8 11h8"/>'),
  hold: svg('<path d="M12 3v13"/><path d="M12 4h7l-2 3 2 3h-7"/><path d="M6 20h12M8.5 16.5h7"/>'),
  // patrol: dwie strzałki w kółko
  patrol: svg('<path d="M20 9a8 8 0 0 0-14.5-2M4 15a8 8 0 0 0 14.5 2"/><path d="M5 3v4h4M19 21v-4h-4"/>'),
  more: svg('<path d="M8 10l4 4 4-4"/>'),
};

let tipEl: HTMLDivElement | null = null;
/** Jeden dymek na cały ekran (w body, nad oknem): nazwa pogrubiona, pod nią opis */
function tip(): HTMLDivElement {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'army-tip';
  tipEl.id = 'army-tip';
  tipEl.setAttribute('role', 'tooltip');
  tipEl.hidden = true;
  document.body.append(tipEl);
  return tipEl;
}
function showTip(b: HTMLElement, group: string, it: Item): void {
  const t = tip();
  t.replaceChildren();
  const head = document.createElement('strong');
  head.textContent = `${group}: ${it.name}`;
  const p = document.createElement('span');
  p.textContent = it.tip;
  t.append(head, p);
  t.hidden = false;
  const r = b.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight;
  const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  const y = r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8;
  t.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}
const hideTip = (): void => { if (tipEl) tipEl.hidden = true; };

export function createArmyControls(on: { form(i: number): void; march(i: number): void; stance(i: number): void; patrol(): void }): {
  root: HTMLElement; help: HTMLElement; update(ctl: ArmyCtl | undefined): void; setHelp(desc: string, hint: string): void; collapse(): void;
} {
  const root = document.createElement('div');
  root.className = 'army-icons';
  const seg = (group: string, items: Item[], pick: (i: number) => void): HTMLButtonElement[] => {
    const wrap = document.createElement('div');
    wrap.className = 'army-iseg';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', group);
    const out = items.map((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'army-ibtn';
      b.innerHTML = it.icon;
      b.setAttribute('aria-label', `${group}: ${it.name}`);
      b.setAttribute('aria-describedby', 'army-tip');
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => { pick(i); hideTip(); });
      b.addEventListener('pointerenter', () => showTip(b, group, it));
      b.addEventListener('focus', () => { if (b.matches(':focus-visible')) showTip(b, group, it); });
      b.addEventListener('pointerleave', hideTip);
      b.addEventListener('blur', hideTip);
      wrap.append(b);
      return b;
    });
    root.append(wrap);
    return out;
  };
  const form = seg(tx('Szyk', 'Formation'), [
    { name: tx('Linia', 'Line'), tip: tx('Szeroki front, 1–3 szeregi. Łucznicy z tyłu.', 'Wide front, 1–3 ranks. Archers at the rear.'), icon: ICON.line },
    { name: tx('Blok', 'Block'), tip: tx('Zwarty kwadrat: trudny do obejścia.', 'A tight square: hard to outflank.'), icon: ICON.block },
    { name: tx('Luźno', 'Loose'), tip: tx('Co drugie pole: mniej ofiar od strzał.', 'Every other tile: fewer losses to arrows.'), icon: ICON.loose },
    { name: tx('Ścisk', 'Packed'), tip: tx('Ramię w ramię: zbity kwadrat, gdy oddział stoi.', 'Shoulder to shoulder: a dense square while the troop stands.'), icon: ICON.packed },
  ], on.form);
  const march = seg(tx('Marsz', 'March'), [
    { name: tx('Zwykły', 'Plain'), tip: tx('Idą na miejsce, nie zatrzymując się na wroga.', 'They march to the spot without stopping for the enemy.'), icon: ICON.plain },
    { name: tx('Z walką', 'Fighting'), tip: tx('Idą na miejsce, ale biją każdego wroga, którego spotkają. Ctrl + prawy klik odwraca wybór dla jednego rozkazu.', 'They march to the spot but strike any enemy they meet. Ctrl + right-click flips the choice for a single order.'), icon: ICON.fighting },
  ], on.march);
  const stance = seg(tx('Postawa', 'Stance'), [
    { name: tx('Atak', 'Attack'), tip: tx('Goni każdego wroga, którego zobaczy.', 'Chases every enemy in sight.'), icon: ICON.attack },
    { name: tx('Obrona', 'Defend'), tip: tx('Walczy w pobliżu swojego miejsca i do niego wraca.', 'Fights near its post and returns to it.'), icon: ICON.defend },
    { name: tx('Stój', 'Hold'), tip: tx('Nie rusza się z miejsca. Bije tylko tych, których sięgnie.', 'Does not budge. Strikes only those within reach.'), icon: ICON.hold },
  ], on.stance);
  const patrolItem: Item = { name: tx('Patrol (P)', 'Patrol (P)'), tip: tx('Kliknij, potem prawy klik na mapie: oddział chodzi tam i z powrotem i bije wrogów po drodze (Shift + prawy klik: więcej punktów). Kolejka marszu: Shift + prawy klik bez patrolu dopisuje kolejny punkt trasy.', 'Click, then right-click on the map: the troop walks there and back, striking foes on the way (Shift + right-click: more waypoints). Marching queue: Shift + right-click without patrol adds another stop to the route.'), icon: ICON.patrol };
  const [patrol] = seg(tx('Rozkazy', 'Orders'), [patrolItem], on.patrol);

  // zwijany opis: liczby zaznaczonych i skróty myszy/klawiatury
  const help = document.createElement('div');
  help.className = 'army-help';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'army-help-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'army-help-body');
  const label = document.createElement('span');
  label.textContent = tx('Skróty i opis', 'Shortcuts and details');
  const chev = document.createElement('span');
  chev.className = 'army-help-chev';
  chev.innerHTML = ICON.more;
  toggle.append(label, chev);
  const body = document.createElement('div');
  body.className = 'army-help-body';
  body.id = 'army-help-body';
  body.hidden = true;
  const desc = document.createElement('p');
  desc.className = 'army-help-desc';
  const hint = document.createElement('p');
  hint.className = 'army-help-hint';
  body.append(desc, hint);
  help.append(toggle, body);
  const setOpen = (open: boolean): void => { body.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => setOpen(body.hidden === true));

  return {
    root, help,
    update(ctl) {
      form.forEach((b, i) => b.setAttribute('aria-pressed', String(i === (ctl?.form ?? 0))));
      stance.forEach((b, i) => b.setAttribute('aria-pressed', String(i === (ctl?.stance ?? -1))));
      march.forEach((b, i) => b.setAttribute('aria-pressed', String(i === (ctl?.march ?? 0))));
      const p = ctl?.patrol ?? 0;
      patrol!.setAttribute('aria-pressed', String(p > 0));
      patrol!.classList.toggle('waiting', p === 2);
      const state = p === 2 ? tx('wskaż punkt…', 'mark a point…') : p === 1 ? tx('na patrolu', 'on patrol') : '';
      patrol!.setAttribute('aria-label', `${tx('Rozkazy', 'Orders')}: ${patrolItem.name}${state ? ` — ${state}` : ''}`);
    },
    setHelp(d, h) {
      if (desc.textContent !== d) desc.textContent = d;
      if (hint.textContent !== h) hint.textContent = h;
    },
    collapse() { setOpen(false); hideTip(); },
  };
}
