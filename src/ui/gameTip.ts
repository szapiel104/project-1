/**
 * Dymki w stylu gry zamiast szarych dymków przeglądarki (Michał 9.11.2026: „ładnie ostyluj tooltipa w grze”).
 * Każdy element z atrybutem `title` pokazuje po najechaniu pergaminową karteczkę przy kursorze. Systemowy dymek
 * gasimy, przenosząc treść do `data-gtip` na czas najechania (atrybut wraca po zjechaniu, więc kod, który czyta albo
 * podmienia `title`, działa jak dawniej). Czytniki ekranu i tak biorą `aria-label`.
 */
let tip: HTMLDivElement | null = null;
let owner: HTMLElement | null = null;

function show(el: HTMLElement, x: number, y: number): void {
  const text = el.getAttribute('title') || el.dataset.gtip || '';
  if (!text) return;
  if (el.hasAttribute('title')) { el.dataset.gtip = text; el.removeAttribute('title'); }
  owner = el;
  tip ??= Object.assign(document.createElement('div'), { className: 'game-tip' });
  tip.setAttribute('role', 'tooltip');
  if (!tip.isConnected) document.body.append(tip);
  tip.textContent = text;
  tip.hidden = false;
  move(x, y);
}

function move(x: number, y: number): void {
  if (!tip || tip.hidden) return;
  const r = tip.getBoundingClientRect();
  let left = x + 14, top = y + 18;
  if (left + r.width > innerWidth - 8) left = x - r.width - 10;
  if (top + r.height > innerHeight - 8) top = y - r.height - 12;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

function hide(): void {
  if (owner && owner.dataset.gtip && !owner.hasAttribute('title')) owner.setAttribute('title', owner.dataset.gtip);
  owner = null;
  if (tip) tip.hidden = true;
}

export function initGameTips(): void {
  document.addEventListener('pointerover', (e) => {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('[title], [data-gtip]');
    if (!el || el === owner) return;
    hide();
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
    show(el, e.clientX, e.clientY);
  });
  document.addEventListener('pointermove', (e) => { if (owner) move(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    if (!owner) return;
    const to = e.relatedTarget as Node | null;
    if (to && owner.contains(to)) return;
    hide();
  });
  document.addEventListener('pointerdown', () => { if (tip) tip.hidden = true; }, true);
}
