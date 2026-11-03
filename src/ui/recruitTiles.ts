import { hoverCard, refreshHoverCard } from './hoverCard';
import { lang, tx } from '../i18n';
import type { RecruitUnit } from './hud';

/**
 * Koszary jak w grach o zamkach (Michał 3.11.2026): rząd wysokich kafelków z całą postacią żołnierza, bez tabelek.
 * Koszt, zapasy, siła i sterowanie pokazuje karta po najechaniu (hoverCard). Klik szkoli jednego, Shift+klik pięciu,
 * Ctrl+klik wszystkich, na ilu starczy; prawy klik stawia flagę zbiórki tego rodzaju (Shift+prawy zdejmuje).
 * Liczba w rogu: ilu można wyszkolić teraz.
 */
export interface RecruitDeps {
  train(count: number, unit: string): void;
  rally(unit: string, clear: boolean): void;
  /** Obrazek: pełna postać (`uf:`), popiersie (`u:`) albo rysunek SVG */
  full(id: string): string | undefined;
  bust(id: string): string | undefined;
  svg(id: string): string;
  /** Ikony surowców (te same co na pasku) */
  icons: Record<string, string>;
}

const DESC: Record<string, [string, string]> = {
  spearman: ['Podstawowa piechota z włócznią. Tani i szybko gotowy do walki — trzon każdej armii.', 'Basic foot soldier with a spear. Cheap and quickly ready — the backbone of any host.'],
  archer: ['Strzela z łuku z daleka. Najlepszy na murach i wieżach, w zwarciu słaby.', 'Looses arrows from afar. Best on walls and towers, weak in close combat.'],
  ram: ['Wóz z belką do rozbijania bram i murów. Ludzi nie atakuje — osłaniaj go wojskiem.', 'A covered cart with a beam for breaking gates and walls. It does not fight men — guard it well.'],
  manatarms: ['Wojownik w ciężkiej zbroi. Droższy i wolniejszy, ale wytrzymuje wiele ciosów.', 'A warrior in heavy armour. Costlier and slower, but he weathers many blows.'],
  sapper: ['Nie walczy. Rozbiera wrogie ruiny i zabiera z nich surowce.', 'Does not fight. Strips enemy ruins and carries off what is left.'],
  ladderman: ['Nie walczy. Niesie drabinę pod wrogi mur, żeby twoje wojsko mogło na niego wejść.', 'Does not fight. Carries a ladder to the enemy wall so your soldiers can climb it.'],
  levy: ['Chłop z kilofem — najtańszy żołnierz. Słaby w walce, ale można ich wystawić wielu.', 'A peasant with a pick — the cheapest soldier. Weak in a fight, but you can raise many.'],
  mageFire: ['Mag bojowy władający ogniem. Rzuca ogniste czary na wrogie oddziały i budynki.', 'A battle mage of fire. Hurls fiery spells at enemy troops and buildings.'],
  mageWater: ['Mag bojowy władający wodą. Jego czary mrożą i spowalniają wrogów.', 'A battle mage of water. His spells freeze and slow the enemy.'],
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export function createRecruitTiles(d: RecruitDeps): { node: HTMLElement; draw(list: RecruitUnit[]): void } {
  const node = el('div', 'rt-row');
  node.setAttribute('role', 'group');
  node.setAttribute('aria-label', tx('Szkolenie wojska', 'Train troops'));
  const tiles = new Map<string, { tile: HTMLButtonElement; max: HTMLElement; flag: HTMLElement }>();
  let now: RecruitUnit[] = [];
  const unit = (id: string): RecruitUnit | undefined => now.find((r) => r.id === id);

  const need = (icon: string, have: number, n: number, label: string): HTMLElement => {
    const s = el('span', `rt-need${have < n ? ' short' : ''}`);
    s.title = label;
    s.innerHTML = `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">${d.icons[icon] ?? ''}</svg>`;
    s.append(el('strong', '', String(n)), el('em', '', `(${have})`));
    return s;
  };
  /** Treść karty po najechaniu: nazwa z popiersiem, opis, koszt (czerwone = brakuje), siła i sterowanie */
  const tip = (id: string): Node[] => {
    const r = unit(id);
    if (!r) return [];
    const head = el('div', 'hc-head');
    const pic = el('span', 'hc-pic');
    const b = d.bust(id);
    if (b) { const i = el('img'); i.src = b; i.alt = ''; pic.append(i); } else pic.innerHTML = d.svg(id);
    head.append(pic, el('strong', 'hc-name', r.name));
    const desc = DESC[id];
    const cost = el('div', 'hc-cost');
    if (r.magic) {
      cost.append(need('gold', r.gold, r.cost, tx('Ruda', 'Ore')));
      if (r.gear) cost.append(need(r.gear.res, r.gear.have, 1, tx('Wyposażenie', 'Gear')));
      cost.append(need('idle', r.idle, 1, tx('Wolny człowiek', 'Idle villager')));
      cost.append(el('span', `rt-need${r.magic.have >= r.magic.cap ? ' short' : ''}`, tx(`magów ${r.magic.have} / ${r.magic.cap}`, `mages ${r.magic.have} / ${r.magic.cap}`)));
    } else {
      cost.append(need(r.weapon, r.have, r.need ?? 1, tx('Broń', 'Weapon')));
      if (r.gear) cost.append(need(r.gear.res, r.gear.have, 1, tx('Wyposażenie', 'Gear')));
      cost.append(need('gold', r.gold, r.cost, tx('Ruda', 'Ore')), need('idle', r.idle, 1, tx('Wolny człowiek', 'Idle villager')));
    }
    const stats = el('p', 'hc-stats');
    const parts = [tx(`Wytrzymałość ${r.hp}`, `Health ${r.hp}`), r.attack ? tx(`atak ${r.attack}`, `attack ${r.attack}`) : tx('nie walczy', 'does not fight')];
    if (r.range) parts.push(tx(`zasięg ${r.range}`, `range ${r.range}`));
    if (r.armor) parts.push(tx(`zbroja ${r.armor}%`, `armour ${r.armor}%`));
    stats.textContent = parts.join(' · ');
    const can = el('p', `hc-can${r.max < 1 ? ' no' : ''}`, r.max < 1 ? tx('Teraz nie da się wyszkolić — brakuje tego, co na czerwono.', 'Cannot train now — you lack what is shown in red.') : tx(`Możesz wyszkolić teraz: ${r.max}`, `You can train now: ${r.max}`));
    const keys = el('p', 'hc-keys', tx('Klik: 1 · Shift+klik: 5 · Ctrl+klik: wszyscy · prawy klik: flaga zbiórki', 'Click: 1 · Shift+click: 5 · Ctrl+click: all · right-click: rally flag'));
    const out: Node[] = [head];
    if (desc) out.push(el('p', 'hc-desc', lang() === 'en' ? desc[1] : desc[0]));
    out.push(cost, stats, can);
    if (r.rally) out.push(el('p', 'hc-flag', tx('⚑ Flaga zbiórki ustawiona — Shift+prawy klik ją zdejmuje.', '⚑ Rally flag set — Shift+right-click removes it.')));
    out.push(keys);
    return out;
  };

  const make = (r: RecruitUnit): { tile: HTMLButtonElement; max: HTMLElement; flag: HTMLElement } => {
    const tile = el('button', 'rt-tile');
    tile.type = 'button';
    tile.dataset.unit = r.id;
    const pic = el('span', 'rt-pic');
    const full = d.full(r.id);
    if (full) { const i = el('img'); i.src = full; i.alt = ''; i.draggable = false; pic.append(i); pic.classList.add('full'); }
    else pic.innerHTML = d.svg(r.id);
    const max = el('span', 'rt-max');
    const flag = el('span', 'rt-flag', '⚑'); flag.hidden = true;
    tile.append(pic, el('span', 'rt-name', r.name), max, flag);
    tile.addEventListener('click', (e) => d.train(e.ctrlKey || e.metaKey ? 999 : e.shiftKey ? 5 : 1, r.id));
    tile.addEventListener('contextmenu', (e) => { e.preventDefault(); d.rally(r.id, e.shiftKey); });
    hoverCard(tile, () => tip(r.id));
    return { tile, max, flag };
  };

  const draw = (list: RecruitUnit[]): void => {
    now = list;
    for (const [id, t] of tiles) t.tile.hidden = !list.some((r) => r.id === id);
    for (const r of list) {
      let t = tiles.get(r.id);
      if (!t) { t = make(r); tiles.set(r.id, t); node.append(t.tile); }
      t.max.textContent = String(r.max);
      t.tile.classList.toggle('cant', r.max < 1);
      t.flag.hidden = !r.rally;
      t.tile.setAttribute('aria-label', tx(`${r.name}: wyszkol jednego (Shift — pięciu, Ctrl — wszystkich, teraz ${r.max}). Prawy klik — flaga zbiórki.`, `${r.name}: train one (Shift — five, Ctrl — all, now ${r.max}). Right-click — rally flag.`));
      refreshHoverCard(t.tile, () => tip(r.id));
    }
  };
  return { node, draw };
}
