import { BUILDINGS } from '../data/buildings';
import { buyPrice, MARKET_GOODS, MARKET_LOTS, sellPrice } from '../data/market';
import { RESOURCE_DEFS, resIndex, type ResourceId } from '../data/resources';
import { t, tx } from '../i18n';
import type { GameState } from '../sim/state';
import { canTrade } from '../sim/systems/market';
import { ICONS } from './hud';

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
  root.append(head, note, infoSlot, body);
  document.getElementById('ui')?.append(root) ?? document.body.append(root);

  type Tile = { have: HTMLElement; btns: { el: HTMLButtonElement; amount: number }[] };
  const tiles = new Map<ResourceId, Tile>();
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
      top.append(ic, name, have);
      const btns: Tile['btns'] = [];
      const line = (sell: boolean): HTMLElement => {
        const row = document.createElement('div');
        row.className = `market-line ${sell ? 'sell' : 'buy'}`;
        const lab = document.createElement('span');
        lab.className = 'market-line-label';
        lab.textContent = sell ? tx('Sprzedaj', 'Sell') : tx('Kup', 'Buy');
        row.append(lab);
        for (const n of MARKET_LOTS) {
          const amount = sell ? -n : n;
          const price = sell ? sellPrice(id, n) : buyPrice(id, n);
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'market-btn';
          b.innerHTML = `<span class="mb-n">${n} ${tx('szt.', 'pcs')}</span><span class="mb-price">${sell ? '+' : '−'}${price}${icon('gold', 18)}</span>`;
          b.setAttribute('aria-label', sell ? tx(`Sprzedaj ${n} za ${price} rudy`, `Sell ${n} for ${price} ore`) : tx(`Kup ${n} za ${price} rudy`, `Buy ${n} for ${price} ore`));
          b.addEventListener('click', () => { if (!b.disabled) onTrade(resIndex(id), amount); });
          btns.push({ el: b, amount });
          row.append(b);
        }
        return row;
      };
      tile.append(top, line(true), line(false));
      grid.append(tile);
      tiles.set(id, { have, btns });
    }
    body.append(h, grid);
  }

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
  close.addEventListener('click', () => { dismissed = shownFor; root.hidden = true; releaseInfo(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) { dismissed = shownFor; root.hidden = true; releaseInfo(); } });
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
      purse.innerHTML = `${icon('gold', 26)}<b>${p.res[GOLD]}</b>`;
      for (const [id, r] of tiles) {
        const i = resIndex(id);
        r.have.innerHTML = `<small>${tx('masz', 'you have')}</small> ${p.res[i]}`;
        for (const { el, amount } of r.btns) {
          const err = canTrade(g, me, i, amount);
          el.disabled = !!err;
          el.title = err === 'trade.have' ? tx('Nie masz tyle tego towaru', 'You haven’t that much of it')
            : err === 'trade.gold' ? tx('Za mało rudy', 'Not enough ore')
            : err === 'trade.room' ? tx('Nie zmieści się w magazynach', 'No room left in your stores') : '';
        }
      }
    },
  };
}
