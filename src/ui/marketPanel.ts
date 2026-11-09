import { BUILDINGS } from '../data/buildings';
import { buyPrice, MARKET_GOODS, MARKET_LOTS, sellPrice } from '../data/market';
import { RESOURCE_DEFS, resIndex, type ResourceId } from '../data/resources';
import { t, tx } from '../i18n';
import type { GameState } from '../sim/state';
import { canTrade } from '../sim/systems/market';
import { ICONS, short } from './hud';

/**
 * Okno rynku (Michał 30.10.2026): po kliknięciu własnego, gotowego rynku. Duże okno na środku ekranu (druga wersja:
 * „nieczytelny widok, większe okno”) — towary w kafelkach pogrupowanych jak magazyny (budulec, jedzenie, broń, skarby),
 * w kafelku duża ikonka, nazwa, ile masz, a pod spodem dwa rzędy dużych przycisków: Sprzedaj 5 / 20 (zielona cena)
 * i Kup 5 / 20 (czerwona cena). Handel od ręki (rozkaz 'trade', sim/systems/market.ts). Przycisk jest wyszarzony,
 * gdy się nie da (brak towaru, rudy albo miejsca w magazynach) — powód w podpowiedzi.
 */
export interface MarketPanel { sync(g: GameState, me: number, selected: number): void }

const GOLD = resIndex('gold');

const GROUPS: { kind: string | null; pl: string; en: string }[] = [
  { kind: 'stockpile', pl: 'Budulec i towary', en: 'Materials and wares' },
  { kind: 'granary', pl: 'Jedzenie', en: 'Food' },
  { kind: 'armory', pl: 'Broń i zbroje', en: 'Arms and armour' },
  { kind: null, pl: 'Skarby', en: 'Treasures' },
];

const icon = (id: string, size: number): string => (ICONS[id] ? `<svg viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true">${ICONS[id]}</svg>` : '');

export function createMarketPanel(onTrade: (res: number, amount: number) => void): MarketPanel {
  const root = document.createElement('section');
  root.className = 'panel market-panel';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', t('b.market'));
  root.hidden = true;
  const head = document.createElement('header');
  head.className = 'market-head';
  const title = document.createElement('h2');
  title.className = 'market-title';
  title.textContent = t('b.market');
  const purse = document.createElement('span');
  purse.className = 'market-purse';
  purse.title = tx('Twoja ruda', 'Your ore');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'market-close';
  close.textContent = '✕';
  close.setAttribute('aria-label', tx('Zamknij rynek', 'Close the market'));
  head.append(title, purse, close);
  const note = document.createElement('p');
  note.className = 'market-note';
  note.textContent = tx('Sprzedajesz i kupujesz od ręki, za rudę. Kupno kosztuje dwa razy tyle co sprzedaż, a kupiony towar trafia prosto do magazynów.',
    'Sell and buy on the spot, for ore. Buying costs twice what selling fetches, and bought goods go straight into your stores.');
  const body = document.createElement('div');
  body.className = 'market-body';
  // okno budynku (pracownicy, wyłącz, przenieś, rozbierz) przenosimy do szuflady rynku, póki jest otwarta — jedno okno
  // zamiast dwóch (Michał 30.10.2026); po zamknięciu wraca na swoje miejsce
  const infoSlot = document.createElement('div');
  infoSlot.className = 'market-info';
  // towary na górze, pod nimi pracownicy i przyciski budynku (Michał 9.11.2026)
  // pracownicy i przyciski budynku na końcu listy towarów — przewijają się razem z nimi (Michał 9.11.2026)
  root.append(head, note, body);
  document.getElementById('ui')?.append(root) ?? document.body.append(root);

  // suwaki (Michał 9.11.2026): ile sprzedać — od 1 do tego, co masz; ile kupić — do tego, na co cię stać i co się zmieści
  type Side = { range: HTMLInputElement; btn: HTMLButtonElement; label: HTMLInputElement; sell: boolean };
  type Tile = { id: ResourceId; have: HTMLElement; sides: Side[] };
  const tiles = new Map<ResourceId, Tile>();
  let lastG: GameState | null = null, lastMe = 0;
  const paintSide = (tile: Tile, sd: Side): void => {
    const n = Number(sd.range.value) || 0;
    const price = n > 0 ? (sd.sell ? sellPrice(tile.id, n) : buyPrice(tile.id, n)) : 0;
    if (document.activeElement !== sd.label) sd.label.value = `${n}`;
    // mały przycisk-ikona: moneta ze strzałką (sprzedaż: ruda przychodzi, kupno: ruda odchodzi); cena obok, opis w dymku
    sd.btn.innerHTML = `${icon('gold', 16)}<b>${sd.sell ? '+' : '−'}${price}</b>`;
    const say = sd.sell ? tx(`Sprzedaj ${n} za ${price} rudy`, `Sell ${n} for ${price} ore`) : tx(`Kup ${n} za ${price} rudy`, `Buy ${n} for ${price} ore`);
    sd.btn.setAttribute('aria-label', say);
    const err = !lastG || n <= 0 ? 'trade.goods' : canTrade(lastG, lastMe, resIndex(tile.id), sd.sell ? -n : n);
    sd.btn.disabled = !!err;
    sd.btn.title = err === 'trade.have' ? tx('Nie masz tyle tego towaru', 'You haven’t that much of it')
      : err === 'trade.gold' ? tx('Za mało rudy', 'Not enough ore')
      : err === 'trade.room' ? tx('Nie zmieści się w magazynach', 'No room left in your stores') : say;
  };
  for (const grp of GROUPS) {
    const goods = MARKET_GOODS.filter((id) => (RESOURCE_DEFS[id].store ?? null) === grp.kind);
    if (!goods.length) continue;
    const h = document.createElement('h3');
    h.className = 'market-group-title';
    h.textContent = tx(grp.pl, grp.en);
    const grid = document.createElement('div');
    grid.className = 'market-grid';
    for (const id of goods) {
      const tile = document.createElement('div');
      tile.className = 'market-tile';
      const top = document.createElement('div');
      top.className = 'market-tile-top';
      const ic = document.createElement('span');
      ic.className = 'market-ico';
      ic.innerHTML = icon(id, 30);
      const name = document.createElement('span');
      name.className = 'market-name';
      name.textContent = t(RESOURCE_DEFS[id].name);
      const have = document.createElement('span');
      have.className = 'market-have';
      ic.append(have);
      top.append(ic, name);
      const rec: Tile = { id, have, sides: [] };
      const side = (sell: boolean): HTMLElement => {
        const box = document.createElement('div');
        box.className = `market-side ${sell ? 'sell' : 'buy'}`;
        const range = document.createElement('input');
        range.type = 'range'; range.min = '1'; range.max = '1'; range.step = '1'; range.value = String(MARKET_LOTS[0]);
        range.className = 'market-range';
        range.setAttribute('aria-label', sell ? tx(`Ile sprzedać: ${t(RESOURCE_DEFS[id].name)}`, `How much ${t(RESOURCE_DEFS[id].name)} to sell`) : tx(`Ile kupić: ${t(RESOURCE_DEFS[id].name)}`, `How much ${t(RESOURCE_DEFS[id].name)} to buy`));
        // pole z liczbą: można wpisać ilość z klawiatury — tylko cyfry, a za dużo zmienia się w największą możliwą
        const label = document.createElement('input');
        label.type = 'text'; label.inputMode = 'numeric'; label.autocomplete = 'off'; label.maxLength = 5;
        label.className = 'market-n';
        label.setAttribute('aria-label', range.getAttribute('aria-label') ?? '');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'market-btn';
        const sd: Side = { range, btn, label, sell };
        range.addEventListener('input', () => paintSide(rec, sd));
        label.addEventListener('input', () => {
          const digits = label.value.replace(/\D+/g, '');
          const max = Number(range.max) || 1;
          let n = digits ? Number(digits) : 0;
          if (n > max) n = max;
          label.value = digits ? String(n) : '';
          if (n >= 1) { range.value = String(n); paintSide(rec, sd); }
        });
        label.addEventListener('blur', () => { label.value = range.value; });
        label.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') btn.click(); });
        btn.addEventListener('click', () => { const n = Number(range.value) || 0; if (!btn.disabled && n > 0) onTrade(resIndex(id), sell ? -n : n); });
        rec.sides.push(sd);
        const ctl = document.createElement('div');
        ctl.className = 'market-ctl';
        ctl.append(range, label);
        box.append(ctl, btn);
        return box;
      };
      tile.append(top, side(true), side(false));
      grid.append(tile);
      tiles.set(id, rec);
    }
    body.append(h, grid);
  }

  body.append(infoSlot);

  let infoHome: { parent: Node; next: Node | null } | null = null;
  const adoptInfo = (): void => {
    const info = document.querySelector<HTMLElement>('.panel.info');
    if (!info || info.parentElement === infoSlot) return;
    infoHome = { parent: info.parentNode!, next: info.nextSibling };
    infoSlot.append(info);
  };
  const releaseInfo = (): void => {
    if (!infoHome) return;
    const info = infoSlot.querySelector<HTMLElement>('.panel.info');
    if (info) infoHome.parent.insertBefore(info, infoHome.next && infoHome.next.parentNode === infoHome.parent ? infoHome.next : null);
    infoHome = null;
  };
  let key = '';
  let dismissed = 0;
  let shownFor = 0;
  let lastSel = 0;
  // krzyżyk zamyka całe zaznaczenie rynku — bez tego wracało małe okno budynku (Michał 9.11.2026: „pojawiła się ta mniejsza”)
  const closeAll = (): void => { dismissed = shownFor; root.hidden = true; releaseInfo(); document.querySelector<HTMLButtonElement>('.panel.info .info-x')?.click(); };
  close.addEventListener('click', closeAll);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) closeAll(); });
  return {
    sync(g, me, selected) {
      // zamknięte krzyżykiem zostaje zamknięte, dopóki gracz nie kliknie rynku od nowa (inny wybór kasuje „zamknięte”)
      if (selected !== lastSel) { lastSel = selected; dismissed = 0; }
      const b = selected ? g.buildings.find((x) => x.id === selected) : undefined;
      const open = !!b && b.owner === me && !b.build && !b.ruined && BUILDINGS[b.type]!.id === 'market' && dismissed !== selected;
      if (open && root.hidden) { root.hidden = false; shownFor = selected; key = ''; close.focus(); }
      if (open) adoptInfo(); else releaseInfo();
      if (!open) { root.hidden = true; key = ''; return; }
      const p = g.players[me]!;
      const k = p.res.join(',');
      if (k === key) return;
      key = k;
      purse.innerHTML = `${icon('gold', 26)}<b>${short(p.res[GOLD]!)}</b>`;
      purse.title = tx(`Ruda: ${p.res[GOLD]}`, `Ore: ${p.res[GOLD]}`);
      lastG = g; lastMe = me;
      for (const [id, r] of tiles) {
        const i = resIndex(id);
        // krótko (85 mln, 14,3k) — długie liczby rozpychały kafel; dokładna liczba w dymku
        r.have.textContent = short(p.res[i]!);
        r.have.title = tx(`Masz ${p.res[i]}`, `You have ${p.res[i]}`);
        for (const sd of r.sides) {
          // największa partia: sprzedaż — tyle, ile masz; kupno — na ile starczy rudy i miejsca (szukanie połówkowe)
          let max = 0;
          if (sd.sell) max = Math.min(1000, p.res[i]!);
          else { let lo = 0, hi = 1000; while (lo < hi) { const m = Math.ceil((lo + hi) / 2); if (canTrade(g, me, i, m)) hi = m - 1; else lo = m; } max = lo; }
          sd.range.max = String(Math.max(1, max));
          sd.range.disabled = max <= 0;
          if (Number(sd.range.value) > max) sd.range.value = String(Math.max(1, max));
          paintSide(r, sd);
        }
      }
    },
  };
}
