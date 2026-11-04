import { tx } from '../i18n';

/**
 * Edytor uwag testera (Michał 2.11.2026: „bold widać od razu, a nie znaczniki; H nie działa — rozbuduj”).
 * Pisze się jak w Wordzie: pogrubienie, kursywa, podkreślenie, przekreślenie, nagłówek, cytat, listy, kolory tekstu
 * i zakreślacz widać od razu w polu (contenteditable). Do bazy idzie HTML, ale tylko z białej listy znaczników i kolorów:
 * `cleanRich()` czyści go przed wysłaniem, a `renderRich()` jeszcze raz przy wyświetlaniu — uwaga od testera nie
 * może wstrzyknąć niczego na stronę administratora. Starsze uwagi ze znacznikami (**pogrubienie**, [czerwony]…)
 * dalej wyświetlają się poprawnie.
 */
export const COLORS: { id: string; css: string; pl: string; en: string }[] = [
  { id: 'czerwony', css: '#ff8a7a', pl: 'czerwony', en: 'red' },
  { id: 'zielony', css: '#8fe39a', pl: 'zielony', en: 'green' },
  { id: 'niebieski', css: '#8cc4ff', pl: 'niebieski', en: 'blue' },
  { id: 'zloty', css: '#ffd76a', pl: 'złoty', en: 'gold' },
  { id: 'fiolet', css: '#d6a8ff', pl: 'fioletowy', en: 'purple' },
];
const MARKS = ['#7a5a12', '#5a2a24'];   // zakreślacz: złoty i czerwony (ciemne tła, jasny tekst zostaje czytelny)

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H3', 'H4', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'P', 'DIV', 'BR', 'SPAN', 'FONT', 'MARK']);
const toHex = (c: string): string => {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c.trim());
  if (m) return '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
  return c.trim().toLowerCase();
};
const okColor = (c: string): string | null => { const h = toHex(c); return COLORS.some((k) => k.css === h) ? h : null; };
const okMark = (c: string): string | null => { const h = toHex(c); return MARKS.includes(h) ? h : null; };

/** Kopia węzła tylko z dozwolonych znaczników i kolorów (reszta: sam tekst) */
function clean(src: Node, into: Node): void {
  for (const n of Array.from(src.childNodes)) {
    if (n.nodeType === 3) { into.appendChild(document.createTextNode(n.textContent ?? '')); continue; }
    if (n.nodeType !== 1) continue;
    const e = n as HTMLElement;
    const tag = e.tagName;
    if (!ALLOWED.has(tag)) { clean(e, into); continue; }
    let out: HTMLElement;
    if (tag === 'SPAN' || tag === 'FONT' || tag === 'MARK') {
      const color = okColor(e.getAttribute('color') ?? e.style.color ?? '');
      const mark = okMark(e.style.backgroundColor ?? '') ?? (tag === 'MARK' ? MARKS[0]! : null);
      if (!color && !mark) { clean(e, into); continue; }
      out = document.createElement(mark ? 'mark' : 'span');
      if (color) out.style.color = color;
      if (mark) out.style.backgroundColor = mark;
    } else {
      out = document.createElement(tag === 'STRONG' ? 'b' : tag === 'EM' ? 'i' : tag === 'STRIKE' ? 's' : tag === 'H4' ? 'h3' : tag.toLowerCase());
    }
    clean(e, out);
    into.appendChild(out);
  }
}

/** HTML z edytora → bezpieczny HTML do zapisania (pusty tekst, gdy w środku nic nie ma) */
export function cleanRich(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const box = document.createElement('div');
  clean(doc.body.firstChild ?? doc.body, box);
  return box.textContent?.trim() ? box.innerHTML : '';
}

// ---- starsze uwagi: znaczniki tekstowe ----
const INLINE = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|\[(czerwony|zielony|niebieski|zloty)\]([\s\S]+?)\[\/\4\]/;
function inline(text: string, into: Node): void {
  let rest = text;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) { into.appendChild(document.createTextNode(rest)); return; }
    if (m.index) into.appendChild(document.createTextNode(rest.slice(0, m.index)));
    let node: HTMLElement;
    let inner: string;
    if (m[1] !== undefined) { node = document.createElement('b'); inner = m[1]; }
    else if (m[2] !== undefined) { node = document.createElement('u'); inner = m[2]; }
    else if (m[3] !== undefined) { node = document.createElement('i'); inner = m[3]; }
    else { node = document.createElement('span'); node.style.color = COLORS.find((c) => c.id === m[4])!.css; inner = m[5]!; }
    inline(inner, node);
    into.appendChild(node);
    rest = rest.slice(m.index + m[0].length);
  }
}
function legacy(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  let list: HTMLElement | null = null;
  let kind = '';
  for (const line of text.split(/\r?\n/)) {
    const bullet = /^\s*[-•]\s+(.*)$/.exec(line), num = /^\s*\d+[.)]\s+(.*)$/.exec(line), head = /^#\s*(.*)$/.exec(line);
    const want = bullet ? 'ul' : num ? 'ol' : '';
    if (want !== kind) { list = want ? document.createElement(want) : null; if (list) frag.appendChild(list); kind = want; }
    if (list && (bullet || num)) { const li = document.createElement('li'); inline((bullet ?? num)![1]!, li); list.appendChild(li); continue; }
    const p = document.createElement(head ? 'h3' : 'p');
    if (line.trim()) inline(head ? head[1]! : line, p); else p.className = 'rich-gap';
    frag.appendChild(p);
  }
  return frag;
}

/** Treść uwagi do wyświetlenia: HTML z edytora (oczyszczony jeszcze raz) albo starsze znaczniki tekstowe */
export function renderRich(text: string): DocumentFragment {
  if (!/<[a-z][\s\S]*>/i.test(text)) return legacy(text);
  const frag = document.createDocumentFragment();
  const doc = new DOMParser().parseFromString(`<div>${text}</div>`, 'text/html');
  const box = document.createElement('div');
  clean(doc.body.firstChild ?? doc.body, box);
  while (box.firstChild) frag.appendChild(box.firstChild);
  return frag;
}

/** Sam tekst (do skrótów w dzwoneczku i liczenia znaków) */
export const plainRich = (t: string): string => {
  if (/<[a-z][\s\S]*>/i.test(t)) { const d = new DOMParser().parseFromString(t.replace(/<(br|\/p|\/div|\/li|\/h3)>/gi, ' $&'), 'text/html'); return (d.body.textContent ?? '').replace(/\s+/g, ' ').trim(); }
  return t.replace(/\*\*|__|\*|\[\/?(czerwony|zielony|niebieski|zloty)\]/g, '').replace(/^\s*([-•]|\d+[.)]|#)\s*/gm, '').replace(/\s+/g, ' ').trim();
};

export interface RichEditor { node: HTMLElement; html(): string; text(): string; clear(): void; focus(): void; onSubmit(f: () => void): void }

/** Edytor z paskiem narzędzi (formatowanie widać od razu) */
export function richEditor(id: string, placeholder: string, max = 4000): RichEditor {
  const node = document.createElement('div');
  node.className = 'rich-editor';
  const bar = document.createElement('div');
  bar.className = 'rich-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', tx('Formatowanie uwagi', 'Note formatting'));
  const area = document.createElement('div');
  area.id = id;
  area.className = 'rich-area rich';
  area.contentEditable = 'true';
  area.setAttribute('role', 'textbox');
  area.setAttribute('aria-multiline', 'true');
  area.dataset.placeholder = placeholder;
  const foot = document.createElement('div');
  foot.className = 'rich-foot';
  const count = document.createElement('span');
  foot.append(document.createTextNode(tx('Enter — nowa linia · Ctrl+Enter — wyślij · Ctrl+B / I / U', 'Enter — new line · Ctrl+Enter — send · Ctrl+B / I / U')), count);
  node.append(bar, area, foot);
  try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* starsze przeglądarki */ }

  const tools: { b: HTMLButtonElement; state?: string }[] = [];
  const cmd = (c: string, v?: string): void => { area.focus(); document.execCommand(c, false, v); paint(); };
  const block = (tag: string): void => {
    area.focus();
    const cur = (document.queryCommandValue('formatBlock') || '').toLowerCase();
    document.execCommand('formatBlock', false, cur === tag ? 'p' : tag);
    paint();
  };
  const tool = (label: string, title: string, run: () => void, state?: string, cls = ''): void => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `rich-tool ${cls}`.trim();
    b.innerHTML = label;
    b.title = title;
    b.setAttribute('aria-label', title);
    if (state) b.setAttribute('aria-pressed', 'false');
    b.addEventListener('mousedown', (e) => e.preventDefault()); // zaznaczenie w polu zostaje
    b.addEventListener('click', run);
    bar.append(b);
    tools.push({ b, state });
  };
  const sep = (): void => { const s = document.createElement('span'); s.className = 'rich-sep'; bar.append(s); };
  tool('<b>B</b>', tx('Pogrubienie (Ctrl+B)', 'Bold (Ctrl+B)'), () => cmd('bold'), 'bold');
  tool('<i>I</i>', tx('Kursywa (Ctrl+I)', 'Italic (Ctrl+I)'), () => cmd('italic'), 'italic');
  tool('<u>U</u>', tx('Podkreślenie (Ctrl+U)', 'Underline (Ctrl+U)'), () => cmd('underline'), 'underline');
  tool('<s>S</s>', tx('Przekreślenie', 'Strikethrough'), () => cmd('strikeThrough'), 'strikeThrough');
  sep();
  tool('H', tx('Nagłówek', 'Heading'), () => block('h3'), 'h3');
  tool('❝', tx('Cytat', 'Quote'), () => block('blockquote'), 'blockquote');
  tool('•', tx('Lista punktowana', 'Bulleted list'), () => cmd('insertUnorderedList'), 'insertUnorderedList');
  tool('1.', tx('Lista numerowana', 'Numbered list'), () => cmd('insertOrderedList'), 'insertOrderedList');
  sep();
  for (const c of COLORS) tool(`<span class="rich-swatch" style="background:${c.css}"></span>`, tx(`Kolor tekstu: ${c.pl}`, `Text colour: ${c.en}`), () => cmd('foreColor', c.css), undefined, 'rich-color');
  tool('<span class="rich-swatch rich-mark">A</span>', tx('Zakreślacz', 'Highlighter'), () => cmd('hiliteColor', MARKS[0]), undefined, 'rich-color');
  sep();
  tool('⌫', tx('Wyczyść formatowanie', 'Clear formatting'), () => { cmd('removeFormat'); block('p'); });
  tool('↶', tx('Cofnij (Ctrl+Z)', 'Undo (Ctrl+Z)'), () => cmd('undo'));
  tool('↷', tx('Ponów (Ctrl+Y)', 'Redo (Ctrl+Y)'), () => cmd('redo'));

  /** Podświetla przyciski stylu, który jest pod kursorem */
  const paint = (): void => {
    const blockNow = (document.queryCommandValue('formatBlock') || '').toLowerCase();
    for (const t of tools) {
      if (!t.state) continue;
      let on = false;
      try { on = t.state === 'h3' || t.state === 'blockquote' ? blockNow === t.state : document.queryCommandState(t.state); } catch { on = false; }
      t.b.setAttribute('aria-pressed', String(on && area.contains(document.getSelection()?.anchorNode ?? null)));
    }
    const n = (area.textContent ?? '').length;
    count.textContent = `${n} / ${max}`;
    count.classList.toggle('bad', n > max);
    area.classList.toggle('empty', !area.textContent?.trim() && !area.querySelector('li'));
  };
  let submit: () => void = () => {};
  area.addEventListener('input', paint);
  area.addEventListener('keyup', paint);
  area.addEventListener('mouseup', paint);
  // nasłuch zaznaczenia sam się zdejmuje, gdy edytora już nie ma na stronie (inaczej z każdym otwarciem uwag przybywał nowy)
  const onSel = (): void => {
    if (!node.isConnected) { if (seen) document.removeEventListener('selectionchange', onSel); return; }
    seen = true;
    if (area.contains(document.getSelection()?.anchorNode ?? null)) paint();
  };
  let seen = false;
  document.addEventListener('selectionchange', onSel);
  area.addEventListener('keydown', (e) => {
    e.stopPropagation(); // skróty gry (spacja, litery) nie działają w trakcie pisania
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
  });
  // wklejanie: sam tekst (bez cudzych stylów i obrazków)
  area.addEventListener('paste', (e) => {
    e.preventDefault();
    const t = e.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, t);
  });
  paint();
  return {
    node,
    html: () => cleanRich(area.innerHTML),
    text: () => (area.textContent ?? '').trim(),
    clear: () => { area.innerHTML = ''; paint(); },
    focus: () => area.focus(),
    onSubmit: (f) => { submit = f; },
  };
}
