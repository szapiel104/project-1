import { BUILDINGS } from '../data/buildings';
import { buyPrice, MARKET_GOODS, MARKET_LOTS, sellPrice } from '../data/market';
import { RESOURCE_DEFS, resIndex, type ResourceId } from '../data/resources';
import { t, tx } from '../i18n';
import type { GameState } from '../sim/state';
import { canTrade } from '../sim/systems/market';
import { ICONS } from './hud';

/**
 * Okno rynku (Michał 30.10.2026): po kliknięciu własnego, gotowego rynku. Każdy towar w wierszu: ile masz, przyciski
 * „Sprzedaj 5 / 20” (z ceną w rudzie) i „Kup 5 / 20”. Handel od ręki (rozkaz 'trade', sim/systems/market.ts).
 * Przycisk jest wyszarzony, gdy się nie da (brak towaru, rudy albo miejsca w magazynach) — powód w podpowiedzi.
 */
export interface MarketPanel { sync(g: GameState, me: number, selected: number): void }

const GOLD = resIndex('gold');

export function createMarketPanel(onTrade: (res: number, amount: number) => void): MarketPanel {
  const root = document.createElement('section');
  root.className = 'panel market-panel';
  root.setAttribute('aria-label', t('b.market'));
  root.hidden = true;
  const head = document.createElement('div');
  head.className = 'market-head';
  const title = document.createElement('p');
  title.className = 'info-name';
  title.textContent = t('b.market');
  const purse = document.createElement('span');
  purse.className = 'market-purse';
  head.append(title, purse);
  const note = document.createElement('p');
  note.className = 'market-note';
  note.textContent = tx('Sprzedaż i kupno od ręki, za rudę. Kupno kosztuje dwa razy tyle co sprzedaż.', 'Sell and buy on the spot, for ore. Buying costs twice what selling fetches.');
  const table = document.createElement('div');
  table.className = 'market-rows';
  table.setAttribute('role', 'table');
  root.append(head, note, table);
  document.getElementById('ui')?.append(root) ?? document.body.append(root);

  type Row = { have: HTMLElement; btns: { el: HTMLButtonElement; amount: number }[] };
  const rows = new Map<ResourceId, Row>();
  const icon = (id: string): string => (ICONS[id] ? `<svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">${ICONS[id]}</svg>` : '');
  purse.innerHTML = '';
  for (const id of MARKET_GOODS) {
    const row = document.createElement('div');
    row.className = 'market-row';
    row.setAttribute('role', 'row');
    const name = document.createElement('span');
    name.className = 'market-name';
    name.innerHTML = `${icon(id)}<span>${t(RESOURCE_DEFS[id].name)}</span>`;
    const have = document.createElement('span');
    have.className = 'market-have';
    const btns: Row['btns'] = [];
    const mk = (amount: number): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = amount < 0 ? 'market-btn sell' : 'market-btn buy';
      const n = Math.abs(amount);
      const price = amount < 0 ? sellPrice(id, n) : buyPrice(id, n);
      b.innerHTML = `<span class="mb-act">${amount < 0 ? tx('Sprzedaj', 'Sell') : tx('Kup', 'Buy')} ${n}</span><span class="mb-price">${amount < 0 ? '+' : '−'}${price}${icon('gold')}</span>`;
      b.setAttribute('aria-label', amount < 0 ? tx(`Sprzedaj ${n} za ${price} rudy`, `Sell ${n} for ${price} ore`) : tx(`Kup ${n} za ${price} rudy`, `Buy ${n} for ${price} ore`));
      b.addEventListener('click', () => { if (!b.disabled) onTrade(resIndex(id), amount); });
      btns.push({ el: b, amount });
      return b;
    };
    const sells = document.createElement('span'); sells.className = 'market-group';
    const buys = document.createElement('span'); buys.className = 'market-group';
    for (const n of MARKET_LOTS) sells.append(mk(-n));
    for (const n of MARKET_LOTS) buys.append(mk(n));
    row.append(name, have, sells, buys);
    table.append(row);
    rows.set(id, { have, btns });
  }
  let key = '';
  return {
    sync(g, me, selected) {
      const b = selected ? g.buildings.find((x) => x.id === selected) : undefined;
      const open = !!b && b.owner === me && !b.build && !b.ruined && BUILDINGS[b.type]!.id === 'market';
      root.hidden = !open;
      if (!open) { key = ''; return; }
      const p = g.players[me]!;
      const k = p.res.join(',');
      if (k === key) return;
      key = k;
      purse.innerHTML = `${icon('gold')}<b>${p.res[GOLD]}</b>`;
      purse.title = tx('Twoja ruda', 'Your ore');
      for (const [id, r] of rows) {
        const i = resIndex(id);
        r.have.textContent = String(p.res[i]);
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
