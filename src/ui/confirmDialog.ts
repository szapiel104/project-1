import { tx } from '../i18n';

/**
 * Okienko z pytaniem nad oknem (Michał 3.11.2026: „wczytaj, usuń, nadpisz, zapisz — popup z pytaniem”).
 * Zwraca true/false, a z polem tekstowym — wpisany tekst albo null po anulowaniu. Esc i klik obok = anuluj,
 * Enter = potwierdź; fokus wraca na przycisk, który otworzył okienko.
 */
export interface ConfirmOpts {
  title: string;
  text?: string;
  ok: string;
  /** kolor przycisku potwierdzenia: zielony (zapis, wczytanie) albo czerwony (usuwanie, nadpisanie) */
  tone?: 'ok' | 'danger';
  /** miniatura nad tekstem (np. kadr zapisu) */
  image?: string;
  /** krótkie fakty pod obrazkiem (np. dzień, tryb, ludzie) jako etykieta + wartość */
  facts?: [string, string][];
  /** ikonka w nagłówku */
  icon?: 'load' | 'save' | 'delete' | 'edit';
  /** podpis na obrazku (np. data zapisu) */
  caption?: string;
  /** pole tekstowe (np. nazwa zapisu) z tą wartością na start */
  input?: { label: string; value: string; placeholder?: string; max?: number };
}
const ICONS: Record<NonNullable<ConfirmOpts['icon']>, string> = {
  load: '<path d="M4 14v5h16v-5"/><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3"/><path d="M8 21v-7h8v7"/>',
  delete: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
};
export function confirmDialog(o: ConfirmOpts & { input: NonNullable<ConfirmOpts['input']> }): Promise<string | null>;
export function confirmDialog(o: ConfirmOpts): Promise<boolean>;
export function confirmDialog(o: ConfirmOpts): Promise<boolean | string | null> {
  const back = document.activeElement as HTMLElement | null;
  return new Promise((done) => {
    const wrap = document.createElement('div');
    wrap.className = 'cd-back';
    const box = document.createElement('div');
    box.className = 'cd-box panel';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    const id = `cd-${Math.random().toString(36).slice(2, 7)}`;
    box.setAttribute('aria-labelledby', `${id}-t`);
    // nagłówek: ikonka w kolorze działania, tytuł i krzyżyk
    const head = document.createElement('div'); head.className = 'cd-head';
    const ico = document.createElement('span'); ico.className = `cd-ico ${o.tone === 'danger' ? 'danger' : 'ok'}`; ico.setAttribute('aria-hidden', 'true');
    ico.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[o.icon ?? (o.tone === 'danger' ? 'delete' : o.input ? 'save' : 'load')]}</svg>`;
    const h = document.createElement('h3'); h.className = 'cd-title'; h.id = `${id}-t`; h.textContent = o.title;
    const x = document.createElement('button'); x.type = 'button'; x.className = 'cd-x'; x.textContent = '✕'; x.setAttribute('aria-label', tx('Zamknij', 'Close'));
    head.append(ico, h, x);
    box.append(head);
    if (o.image) {
      const fig = document.createElement('figure'); fig.className = 'cd-fig';
      const img = document.createElement('img'); img.className = 'cd-img'; img.src = o.image; img.alt = '';
      fig.append(img);
      if (o.caption) { const c = document.createElement('figcaption'); c.textContent = o.caption; fig.append(c); }
      box.append(fig);
    }
    if (o.facts?.length) {
      const dl = document.createElement('dl'); dl.className = 'cd-facts';
      for (const [k, v] of o.facts) { const d = document.createElement('div'); const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; d.append(dd, dt); dl.append(d); }
      box.append(dl);
    }
    if (o.text) { const p = document.createElement('p'); p.className = `cd-text${o.tone === 'danger' ? ' warn' : ''}`; p.id = `${id}-d`; p.textContent = o.text; box.append(p); box.setAttribute('aria-describedby', p.id); }
    let input: HTMLInputElement | null = null;
    if (o.input) {
      const lab = document.createElement('label'); lab.className = 'cd-label'; lab.htmlFor = `${id}-i`; lab.textContent = o.input.label;
      input = document.createElement('input'); input.id = `${id}-i`; input.className = 'cd-input'; input.value = o.input.value; input.maxLength = o.input.max ?? 40;
      if (o.input.placeholder) input.placeholder = o.input.placeholder;
      box.append(lab, input);
    }
    const acts = document.createElement('div'); acts.className = 'cd-acts';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn-plain cd-btn'; cancel.textContent = tx('Anuluj', 'Cancel');
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = `${o.tone === 'danger' ? 'btn-danger' : 'btn-ok'} cd-btn`; ok.textContent = o.ok;
    // kolejność jak w Windowsie i w Steamie: działanie po lewej, „Anuluj” po prawej
    acts.append(ok, cancel);
    box.append(acts);
    wrap.append(box);
    const finish = (v: boolean): void => {
      document.removeEventListener('keydown', key, true);
      wrap.remove();
      back?.focus?.();
      done(o.input ? (v ? (input!.value.trim() || o.input.value) : null) : v);
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(false); }
      // Enter działa na przycisk z fokusem (przy usuwaniu fokus stoi na „Anuluj”, więc Enter niczego nie skasuje)
      else if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); finish(document.activeElement === cancel ? false : document.activeElement === input ? true : document.activeElement === ok); }
      else if (e.key === 'Tab') { // fokus nie wychodzi z okienka
        const f = [x, input, ok, cancel].filter(Boolean) as HTMLElement[];
        const i = f.indexOf(document.activeElement as HTMLElement);
        e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length]!.focus();
      } else e.stopPropagation();
    };
    cancel.addEventListener('click', () => finish(false));
    x.addEventListener('click', () => finish(false));
    ok.addEventListener('click', () => finish(true));
    wrap.addEventListener('click', (e) => { if (e.target === wrap) finish(false); });
    document.addEventListener('keydown', key, true);
    document.body.append(wrap);
    // przy działaniu nieodwracalnym (usuń, nadpisz) fokus na bezpiecznym „Anuluj”
    if (input) { input.focus(); input.select(); } else if (o.tone === 'danger') cancel.focus(); else ok.focus();
  });
}
