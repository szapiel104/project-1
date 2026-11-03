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
  /** pole tekstowe (np. nazwa zapisu) z tą wartością na start */
  input?: { label: string; value: string; placeholder?: string; max?: number };
}
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
    const h = document.createElement('h3'); h.className = 'cd-title'; h.id = `${id}-t`; h.textContent = o.title;
    box.append(h);
    if (o.image) { const img = document.createElement('img'); img.className = 'cd-img'; img.src = o.image; img.alt = ''; box.append(img); }
    if (o.text) { const p = document.createElement('p'); p.className = 'cd-text'; p.id = `${id}-d`; p.textContent = o.text; box.append(p); box.setAttribute('aria-describedby', p.id); }
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
    acts.append(cancel, ok);
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
      else if (e.key === 'Enter' && document.activeElement !== cancel) { e.preventDefault(); e.stopImmediatePropagation(); finish(true); }
      else if (e.key === 'Tab') { // fokus nie wychodzi z okienka
        const f = [input, cancel, ok].filter(Boolean) as HTMLElement[];
        const i = f.indexOf(document.activeElement as HTMLElement);
        e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length]!.focus();
      } else e.stopPropagation();
    };
    cancel.addEventListener('click', () => finish(false));
    ok.addEventListener('click', () => finish(true));
    wrap.addEventListener('click', (e) => { if (e.target === wrap) finish(false); });
    document.addEventListener('keydown', key, true);
    document.body.append(wrap);
    if (input) { input.focus(); input.select(); } else ok.focus();
  });
}
