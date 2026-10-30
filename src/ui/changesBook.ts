import { CHANGES, type ChangeEntry } from '../data/changelog';
import { lang, tx } from '../i18n';

/**
 * Okno „Co nowego” w menu (Michał 30.10.2026): spis dni po lewej, po prawej wersje z danego dnia, a pod każdą wypunktowane
 * zmiany. Wygląd jak „Jak grać” (help-book), żeby nie było nowego stylu.
 */
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const dayLabel = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(lang() === 'en' ? 'en-GB' : 'pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
};

/** Księga zmian: zwraca nawigację (spis dni) i stronę; przyciski powrotu dokłada menu */
export function changesBook(): { book: HTMLElement; nav: HTMLElement; focusFirst: () => void } {
  const days = new Map<string, ChangeEntry[]>();
  for (const c of CHANGES) { let l = days.get(c.date); if (!l) { l = []; days.set(c.date, l); } l.push(c); }
  const keys = [...days.keys()];
  const book = el('div', 'help-book changes-book');
  const nav = el('nav', 'help-nav');
  nav.setAttribute('aria-label', tx('Dni', 'Days'));
  const list = el('div', 'help-toc'); list.setAttribute('role', 'tablist'); list.setAttribute('aria-orientation', 'vertical');
  const pane = el('div', 'help-pane'); pane.setAttribute('role', 'tabpanel'); pane.id = 'changes-pane'; pane.tabIndex = -1;
  const btns: HTMLButtonElement[] = [];
  const show = (i: number): void => {
    btns.forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
    const day = keys[i]!;
    const sheet = el('article', 'help-text');
    sheet.append(el('h2', 'help-title', dayLabel(day)));
    for (const c of days.get(day)!) {
      sheet.append(el('h3', 'help-h changes-v', `${tx('Wersja', 'Version')} ${c.v}`));
      const ul = el('ul', 'changes-list');
      for (const line of lang() === 'en' ? c.en : c.pl) ul.append(el('li', '', line));
      sheet.append(ul);
    }
    pane.replaceChildren(sheet);
    pane.scrollTop = 0;
  };
  list.append(el('p', 'help-toc-group', tx('Co nowego', 'What’s new')));
  keys.forEach((day, i) => {
    const b = el('button', 'help-toc-item');
    b.type = 'button';
    b.addEventListener('click', () => show(i));
    b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', pane.id);
    const n = days.get(day)!.length;
    b.append(el('span', 'help-toc-n', String(n)), el('span', 'help-toc-t', dayLabel(day)));
    b.title = tx(`${n} wersji`, `${n} versions`);
    btns.push(b); list.append(b);
  });
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const k = (Math.max(0, i) + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length;
    show(k); btns[k]!.focus();
  });
  nav.append(list);
  book.append(nav, pane);
  if (keys.length) show(0);
  return { book, nav, focusFirst: () => btns[0]?.focus() };
}
