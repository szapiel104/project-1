/**
 * Karta szczegółów po najechaniu (Michał 3.11.2026: „w koszarach widać same jednostki, a dopiero jak najadę, mam
 * informacje, ile kosztuje”). Jedna pływająca karta na całą grę: pojawia się nad kafelkiem po najechaniu myszą albo
 * przejściu klawiszem Tab, znika po zjechaniu. Szanuje ustawienie „Podpowiedzi po najechaniu” (body.tips-off /
 * body.tips-delay). Treść buduje wywołujący — za każdym razem od nowa, więc liczby są zawsze aktualne.
 */
let card: HTMLElement | null = null;
let owner: HTMLElement | null = null;
let timer = 0;

const ensure = (): HTMLElement => {
  if (card) return card;
  card = document.createElement('div');
  card.className = 'hover-card';
  card.id = 'hover-card';
  card.setAttribute('role', 'tooltip');
  card.hidden = true;
  document.body.append(card);
  return card;
};

const place = (el: HTMLElement): void => {
  const c = ensure();
  const r = el.getBoundingClientRect();
  const w = c.offsetWidth, h = c.offsetHeight;
  const gap = 10;
  let x = r.left + r.width / 2 - w / 2;
  x = Math.max(8, Math.min(innerWidth - w - 8, x));
  // nad kafelkiem, a gdy brak miejsca — pod nim
  let y = r.top - h - gap;
  if (y < 8) y = Math.min(innerHeight - h - 8, r.bottom + gap);
  c.style.left = `${Math.round(x)}px`;
  c.style.top = `${Math.round(y)}px`;
};

export function hideHoverCard(): void {
  clearTimeout(timer);
  if (card) card.hidden = true;
  owner?.removeAttribute('aria-describedby');
  owner = null;
}

const show = (el: HTMLElement, build: () => Node[]): void => {
  if (document.body.classList.contains('tips-off')) return;
  clearTimeout(timer);
  const go = (): void => {
    if (!el.isConnected) return;
    const c = ensure();
    c.replaceChildren(...build());
    c.hidden = false;
    owner = el;
    el.setAttribute('aria-describedby', c.id);
    place(el);
  };
  // z opóźnieniem tylko pierwsza karta; przy przejeżdżaniu po kolejnych kafelkach od razu
  const visible = !!card && !card.hidden;
  if (document.body.classList.contains('tips-delay') && !visible) timer = window.setTimeout(go, 450);
  else go();
};

/** Podpina kartę do elementu. `build` zwraca treść (wołane przy każdym pokazaniu). */
export function hoverCard(el: HTMLElement, build: () => Node[]): void {
  el.addEventListener('pointerenter', () => show(el, build));
  el.addEventListener('focus', () => show(el, build));
  el.addEventListener('pointerleave', hideHoverCard);
  el.addEventListener('blur', hideHoverCard);
  el.addEventListener('pointerdown', () => { if (owner === el && card && !card.hidden) setTimeout(() => { if (owner === el) { card!.replaceChildren(...build()); place(el); } }, 60); });
}

/** Odświeża treść otwartej karty (np. po zmianie zapasów), jeśli należy do tego elementu */
export function refreshHoverCard(el: HTMLElement, build: () => Node[]): void {
  if (owner !== el || !card || card.hidden) return;
  card.replaceChildren(...build());
  place(el);
}
