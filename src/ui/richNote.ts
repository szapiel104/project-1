import { tx } from '../i18n';

/**
 * Prosty edytor uwag testera (Michał 2.11.2026: „edytor — entery, pogrubienia, kolory”): pasek nad polem tekstowym
 * wstawia znaczniki wokół zaznaczenia, a podgląd i listy uwag rysują je bezpiecznie (budujemy węzły DOM, żadnego
 * wklejania HTML — uwaga od testera nie może podmienić strony administratora).
 *
 * Znaczniki: **pogrubienie**, *kursywa*, __podkreślenie__, [czerwony]…[/czerwony] (też zielony, niebieski, złoty),
 * linia zaczynająca się od „- ” to punkt listy, „1. ” — lista numerowana, „# ” — nagłówek. Enter = nowa linia.
 */
export const COLORS: Record<string, [string, string, string]> = {
  czerwony: ['#ff8a7a', 'red', 'Czerwony'],
  zielony: ['#8fe39a', 'green', 'Zielony'],
  niebieski: ['#8cc4ff', 'blue', 'Niebieski'],
  zloty: ['#ffd76a', 'gold', 'Złoty'],
};

const INLINE = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|\[(czerwony|zielony|niebieski|zloty)\]([\s\S]+?)\[\/\4\]/;

function inline(text: string, into: Node): void {
  let rest = text;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) { into.appendChild(document.createTextNode(rest)); return; }
    if (m.index) into.appendChild(document.createTextNode(rest.slice(0, m.index)));
    let node: HTMLElement;
    let inner: string;
    if (m[1] !== undefined) { node = document.createElement('strong'); inner = m[1]; }
    else if (m[2] !== undefined) { node = document.createElement('u'); inner = m[2]; }
    else if (m[3] !== undefined) { node = document.createElement('em'); inner = m[3]; }
    else { node = document.createElement('span'); node.style.color = COLORS[m[4]!]![0]; inner = m[5]!; }
    inline(inner, node);
    into.appendChild(node);
    rest = rest.slice(m.index + m[0].length);
  }
}

/** Tekst ze znacznikami → bezpieczne węzły (akapity, listy, nagłówki) */
export function renderRich(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  let list: HTMLElement | null = null;
  let kind = '';
  for (const line of text.split(/\r?\n/)) {
    const bullet = /^\s*[-•]\s+(.*)$/.exec(line), num = /^\s*\d+[.)]\s+(.*)$/.exec(line), head = /^#\s+(.*)$/.exec(line);
    const want = bullet ? 'ul' : num ? 'ol' : '';
    if (want !== kind) { list = want ? document.createElement(want) : null; if (list) frag.appendChild(list); kind = want; }
    if (list && (bullet || num)) { const li = document.createElement('li'); inline((bullet ?? num)![1]!, li); list.appendChild(li); continue; }
    if (head) { const h = document.createElement('strong'); h.className = 'rich-h'; inline(head[1]!, h); frag.appendChild(h); continue; }
    const p = document.createElement('p');
    if (line.trim()) inline(line, p); else p.className = 'rich-gap';
    frag.appendChild(p);
  }
  return frag;
}

/** Pasek narzędzi nad polem tekstowym + podgląd na żywo */
export function richToolbar(area: HTMLTextAreaElement): { bar: HTMLElement; preview: HTMLElement } {
  const bar = document.createElement('div');
  bar.className = 'rich-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', tx('Formatowanie uwagi', 'Note formatting'));
  const preview = document.createElement('div');
  preview.className = 'rich-preview';
  preview.setAttribute('aria-live', 'polite');
  const paint = (): void => {
    preview.replaceChildren();
    if (!area.value.trim()) { preview.hidden = true; return; }
    preview.hidden = false;
    const lab = document.createElement('span'); lab.className = 'rich-preview-label'; lab.textContent = tx('Podgląd', 'Preview');
    preview.append(lab, renderRich(area.value));
  };
  const wrap = (a: string, b: string): void => {
    const s = area.selectionStart, e = area.selectionEnd, v = area.value;
    const sel = v.slice(s, e) || tx('tekst', 'text');
    area.value = v.slice(0, s) + a + sel + b + v.slice(e);
    area.focus();
    area.setSelectionRange(s + a.length, s + a.length + sel.length);
    paint();
  };
  const lines = (prefix: (i: number) => string): void => {
    const v = area.value;
    const s = v.lastIndexOf('\n', area.selectionStart - 1) + 1;
    let e = v.indexOf('\n', area.selectionEnd); if (e < 0) e = v.length;
    const block = v.slice(s, e).split('\n').map((l, i) => prefix(i) + l.replace(/^\s*([-•]|\d+[.)]|#)\s+/, '')).join('\n');
    area.value = v.slice(0, s) + block + v.slice(e);
    area.focus();
    area.setSelectionRange(s, s + block.length);
    paint();
  };
  const tool = (label: string, title: string, run: () => void, cls = ''): void => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `rich-tool ${cls}`.trim();
    b.innerHTML = label;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.addEventListener('click', run);
    bar.append(b);
  };
  tool('<b>B</b>', tx('Pogrubienie (Ctrl+B)', 'Bold (Ctrl+B)'), () => wrap('**', '**'));
  tool('<i>I</i>', tx('Kursywa (Ctrl+I)', 'Italic (Ctrl+I)'), () => wrap('*', '*'));
  tool('<u>U</u>', tx('Podkreślenie (Ctrl+U)', 'Underline (Ctrl+U)'), () => wrap('__', '__'));
  tool('H', tx('Nagłówek', 'Heading'), () => lines(() => '# '));
  tool('•', tx('Lista punktowana', 'Bulleted list'), () => lines(() => '- '));
  tool('1.', tx('Lista numerowana', 'Numbered list'), () => lines((i) => `${i + 1}. `));
  for (const [k, [c, , pl]] of Object.entries(COLORS)) {
    const en = { czerwony: 'Red', zielony: 'Green', niebieski: 'Blue', zloty: 'Gold' }[k] ?? k;
    tool(`<span class="rich-swatch" style="background:${c}"></span>`, tx(`Kolor: ${pl.toLowerCase()}`, `Colour: ${en.toLowerCase()}`), () => wrap(`[${k}]`, `[/${k}]`), 'rich-color');
  }
  area.addEventListener('input', paint);
  area.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); wrap('**', '**'); }
    else if (k === 'i') { e.preventDefault(); wrap('*', '*'); }
    else if (k === 'u') { e.preventDefault(); wrap('__', '__'); }
  });
  paint();
  return { bar, preview };
}

/** Sam tekst bez znaczników (do skrótów w dzwoneczku) */
export const plainRich = (t: string): string => t.replace(/\*\*|__|\*|\[\/?(czerwony|zielony|niebieski|zloty)\]/g, '').replace(/^\s*([-•]|\d+[.)]|#)\s+/gm, '').replace(/\s+/g, ' ').trim();
