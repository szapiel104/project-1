import { addNote, deleteNote, listNotes, markNote, type Note } from '../net/notes';
import { confirmDialog } from './confirmDialog';
import { lang, tx } from '../i18n';
import { plainRich, renderRich, richEditor } from './richNote';

/** Treść uwagi z formatowaniem (pogrubienia, kolory, listy) — bezpiecznie, bez wklejania HTML */
const body = (text: string): HTMLElement => { const d = document.createElement('div'); d.className = 'note-body rich'; d.append(renderRich(text)); return d; };

/**
 * Uwagi testerów (Michał 2.11.2026): tester wpisuje w menu (także w trakcie gry, przez Esc), co dodać albo zmienić;
 * administrator widzi wszystkie w „Moim rodzie” → „Uwagi testerów”, oznacza zrobione i może krótko odpisać,
 * a tester widzi przy swojej uwadze, że jest zrobiona.
 */
declare const __BUILD__: string;
const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : '';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const btn = (text: string, onClick: () => void, cls = 'menu-btn admin-btn'): HTMLButtonElement => {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
};
const status = (): HTMLParagraphElement => { const p = el('p', 'net-msg'); p.setAttribute('role', 'status'); return p; };
const say = (p: HTMLElement, text: string, bad = false): void => { p.textContent = text; p.classList.toggle('bad', bad); };
const when = (iso: string): string => new Date(iso).toLocaleString(lang() === 'en' ? 'en-GB' : 'pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const badge = (n: Note): HTMLElement => el('span', n.status === 'done' ? 'note-state done' : 'note-state', n.status === 'done' ? tx('zrobione', 'done') : tx('czeka', 'waiting'));

/**
 * Lista uwag z filtrowaniem (stan, autor, szukanie w treści) i stronicowaniem — wspólna dla testera i administratora
 * (Michał 2.11.2026: „lepsze okno listy, filtrowanie, paginacja”).
 */
const PER_PAGE = 8;
function notesList(load: () => Promise<Note[] | string>, item: (n: Note, refresh: () => void) => HTMLElement, admin: boolean, focusId?: number): { node: HTMLElement; refresh(): void } {
  const box = el('div', 'notes-browser');
  const bar = el('div', 'notes-bar');
  const sid = `notes-q-${Math.random().toString(36).slice(2, 6)}`;
  const sl = el('label', 'sr-only', tx('Szukaj w uwagach', 'Search notes')); sl.htmlFor = sid;
  const q = el('input'); q.id = sid; q.type = 'search'; q.placeholder = tx('Szukaj w treści…', 'Search the text…'); q.autocomplete = 'off';
  const seg = el('div', 'notes-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', tx('Stan uwag', 'Note state'));
  let state = (admin ? 'open' : 'all') as 'all' | 'open' | 'done';
  const segBtns: ['all' | 'open' | 'done', HTMLButtonElement][] = [];
  for (const [k, pl, en] of [['all', 'Wszystkie', 'All'], ['open', 'Czekają', 'Waiting'], ['done', 'Zrobione', 'Done']] as const) {
    const b = btn(tx(pl, en), () => { state = k; page = 0; paint(); });
    segBtns.push([k, b]); seg.append(b);
  }
  const who = el('select'); who.setAttribute('aria-label', tx('Autor', 'Author'));
  bar.append(sl, q, seg);
  if (admin) bar.append(who);
  const info = status();
  const list = el('ul', 'note-list');
  const pager = el('nav', 'notes-pager'); pager.setAttribute('aria-label', tx('Strony uwag', 'Note pages'));
  box.append(bar, info, list, pager);
  let rows: Note[] = [];
  let page = 0;
  q.addEventListener('input', () => { page = 0; paint(); });
  who.addEventListener('change', () => { page = 0; paint(); });
  const paint = (): void => {
    for (const [k, b] of segBtns) b.setAttribute('aria-pressed', String(k === state));
    const text = q.value.trim().toLowerCase();
    const shown = rows.filter((n) => (state === 'all' || n.status === state) && (!who.value || n.nick === who.value) && (!text || plainRich(n.body).toLowerCase().includes(text) || (n.reply ?? '').toLowerCase().includes(text)));
    const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
    page = Math.min(page, pages - 1);
    const open = rows.filter((n) => n.status === 'open').length;
    say(info, tx(`Pokazano ${shown.length} z ${rows.length} · czeka: ${open}`, `Showing ${shown.length} of ${rows.length} · waiting: ${open}`));
    list.replaceChildren(...(shown.length ? shown.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map((n) => item(n, refresh)) : [el('li', 'house-note', tx('Brak uwag dla tego filtra.', 'No notes match this filter.'))]));
    pager.replaceChildren();
    if (pages > 1) {
      const prev = btn(tx('← Poprzednia', '← Previous'), () => { page--; paint(); }); prev.disabled = page === 0;
      const next = btn(tx('Następna →', 'Next →'), () => { page++; paint(); }); next.disabled = page >= pages - 1;
      pager.append(prev, el('span', 'notes-page', tx(`strona ${page + 1} z ${pages}`, `page ${page + 1} of ${pages}`)), next);
    }
    const hit = focusId !== undefined ? list.querySelector<HTMLElement>(`[data-note="${focusId}"]`) : null;
    if (hit) { hit.classList.add('focus'); hit.scrollIntoView({ block: 'nearest' }); focusId = undefined; }
  };
  const refresh = (): void => {
    void load().then((r) => {
      if (typeof r === 'string') { say(info, r, true); list.replaceChildren(); return; }
      rows = r;
      // uwaga wskazana z dzwoneczka: pokaż ją bez względu na filtr i na jej stronie
      if (focusId !== undefined) {
        const f = rows.find((n) => n.id === focusId);
        if (f) { state = 'all'; page = Math.floor(rows.indexOf(f) / PER_PAGE); }
      }
      const authors = [...new Set(rows.map((n) => n.nick).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'));
      const cur = who.value;
      who.replaceChildren(el('option', '', tx('Wszyscy testerzy', 'All testers')), ...authors.map((a) => { const o = el('option', '', a); o.value = a; return o; }));
      (who.firstChild as HTMLOptionElement).value = '';
      who.value = authors.includes(cur) ? cur : '';
      paint();
    });
  };
  refresh();
  return { node: box, refresh };
}

const noteHead = (n: Note, withAuthor: boolean): HTMLElement => {
  const head = el('div', 'note-head');
  head.append(badge(n));
  if (withAuthor) head.append(el('strong', '', n.nick || '?'));
  head.append(el('span', 'note-when', `${when(n.created_at)} · ${n.place}${n.version ? ' · ' + tx('wersja', 'version') + ' ' + n.version : ''}`));
  return head;
};

/** Okno testera: nowa uwaga + lista własnych z ich stanem. `place` — skąd wysłana (menu / w trakcie gry). */
export function testerNotesPane(place: string, focusId?: number): HTMLElement {
  const wrap = el('div', 'admin notes');
  wrap.append(el('p', 'house-note', tx(
    'Napisz, co poprawić, dodać albo co nie działa. Uwaga trafia do administratora; gdy ją zrobi, zobaczysz tu „zrobione” i dostaniesz powiadomienie.',
    'Write what to fix, add, or what is broken. The note goes to the administrator; once it is done, you will see “done” here and get a notification.')));
  const id = `note-${Math.random().toString(36).slice(2, 6)}`;
  const lab = el('label', '', tx('Twoja uwaga', 'Your note')); lab.htmlFor = id;
  lab.addEventListener('click', () => ed.focus());
  const ed = richEditor(id, tx('Np. drwal stoi w miejscu, gdy las jest daleko…', 'E.g. the woodcutter stands idle when the forest is far…'), 2000);
  const msgP = status();
  const browser = notesList(() => listNotes(true, 500), (n) => {
    const li = el('li', n.status === 'done' ? 'note done' : 'note'); li.dataset.note = String(n.id);
    li.append(noteHead(n, false), body(n.body));
    if (n.reply) li.append(el('p', 'note-reply', `${tx('Odpowiedź', 'Reply')}: ${n.reply}`));
    return li;
  }, false, focusId);
  const send = btn(tx('Wyślij uwagę', 'Send note'), async () => {
    const html = ed.html();
    if (ed.text().length < 3) { say(msgP, tx('Napisz choć kilka słów.', 'Write at least a few words.'), true); ed.focus(); return; }
    if (ed.text().length > 2000 || html.length > 12000) { say(msgP, tx('Uwaga jest za długa — podziel ją na kilka.', 'The note is too long — split it into a few.'), true); return; }
    send.disabled = true;
    const err = await addNote(html, place, BUILD);
    send.disabled = false;
    if (err) { say(msgP, err, true); return; }
    ed.clear();
    say(msgP, tx('Wysłane — dzięki!', 'Sent — thank you!'));
    browser.refresh();
  }, 'menu-btn admin-btn btn-ok');
  const row = el('div', 'admin-actions'); row.append(send, msgP);
  ed.onSubmit(() => send.click());
  wrap.append(lab, ed.node, row, el('h4', 'house-h', tx('Twoje uwagi', 'Your notes')), browser.node);
  if (focusId === undefined) setTimeout(() => ed.focus(), 0);
  return wrap;
}

/** Zakładka administratora: wszystkie uwagi testerów z filtrami, „zrobione” i odpowiedzią */
export function adminNotesPane(focusId?: number): Node[] {
  const wrap = el('div', 'admin notes');
  const browser = notesList(() => listNotes(false, 1000), (n, refresh) => {
    const li = el('li', n.status === 'done' ? 'note done' : 'note'); li.dataset.note = String(n.id);
    const rid = `reply-${n.id}`;
    const rl = el('label', '', tx('Odpowiedź dla testera (opcjonalnie)', 'Reply to the tester (optional)')); rl.htmlFor = rid;
    const reply = el('input'); reply.id = rid; reply.type = 'text'; reply.maxLength = 1000; reply.value = n.reply ?? '';
    const done = n.status === 'done';
    const msgP = status();
    const act = btn(done ? tx('Otwórz ponownie', 'Reopen') : tx('Zrobione', 'Done'), async () => {
      act.disabled = true;
      const err = await markNote(n.id, !done, reply.value);
      act.disabled = false;
      if (err) { say(msgP, err, true); return; }
      refresh();
    }, done ? 'menu-btn admin-btn' : 'menu-btn admin-btn btn-ok');
    // usuń na zawsze (z pytaniem w okienku): uwaga znika też z dzwoneczków
    const del = btn(tx('Usuń', 'Delete'), () => {
      void confirmDialog({ title: tx('Usunąć uwagę na zawsze?', 'Delete the note for good?'), text: `${n.nick}: „${plainRich(n.body).slice(0, 160)}”`, ok: tx('Usuń na zawsze', 'Delete for good'), tone: 'danger' }).then((yes) => {
        if (!yes) return;
        del.disabled = true;
        void deleteNote(n.id).then((err) => { del.disabled = false; if (err) { say(msgP, err, true); return; } refresh(); });
      });
    }, 'menu-btn admin-btn btn-danger');
    del.setAttribute('aria-label', tx(`Usuń uwagę od ${n.nick}`, `Delete the note from ${n.nick}`));
    const row = el('div', 'admin-nick'); row.append(rl, reply, act, del);
    li.append(noteHead(n, true), body(n.body), row, msgP);
    return li;
  }, true, focusId);
  wrap.append(browser.node);
  return [wrap];
}
