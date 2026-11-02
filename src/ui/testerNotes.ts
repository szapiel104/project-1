import { addNote, listNotes, markNote, type Note } from '../net/notes';
import { lang, tx } from '../i18n';

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

/** Okno testera: nowa uwaga + lista własnych z ich stanem. `place` — skąd wysłana (menu / w trakcie gry). */
export function testerNotesPane(place: string): HTMLElement {
  const wrap = el('div', 'admin notes');
  wrap.append(el('p', 'house-note', tx(
    'Napisz, co poprawić, dodać albo co nie działa. Uwaga trafia do administratora; gdy ją zrobi, zobaczysz tu „zrobione”.',
    'Write what to fix, add, or what is broken. The note goes to the administrator; once it is done, you will see “done” here.')));
  const id = `note-${Math.random().toString(36).slice(2, 6)}`;
  const lab = el('label', '', tx('Twoja uwaga', 'Your note')); lab.htmlFor = id;
  const area = el('textarea', 'note-area'); area.id = id; area.rows = 4; area.maxLength = 2000;
  area.placeholder = tx('Np. drwal stoi w miejscu, gdy las jest daleko…', 'E.g. the woodcutter stands idle when the forest is far…');
  const msgP = status();
  const list = el('ul', 'note-list');
  const send = btn(tx('Wyślij uwagę', 'Send note'), async () => {
    const text = area.value.trim();
    if (text.length < 3) { say(msgP, tx('Napisz choć kilka słów.', 'Write at least a few words.'), true); area.focus(); return; }
    send.disabled = true;
    const err = await addNote(text, place, BUILD);
    send.disabled = false;
    if (err) { say(msgP, err, true); return; }
    area.value = '';
    say(msgP, tx('Wysłane — dzięki!', 'Sent — thank you!'));
    void refresh();
  }, 'menu-btn admin-btn btn-ok');
  const row = el('div', 'admin-actions'); row.append(send);
  wrap.append(lab, area, row, msgP, el('h4', 'house-h', tx('Twoje uwagi', 'Your notes')), list);

  const refresh = async (): Promise<void> => {
    const rows = await listNotes(true, 50);
    if (typeof rows === 'string') { list.replaceChildren(el('li', 'net-msg bad', rows)); return; }
    if (!rows.length) { list.replaceChildren(el('li', 'house-note', tx('Jeszcze nic nie wysłałeś.', 'You have not sent anything yet.'))); return; }
    list.replaceChildren(...rows.map((n) => {
      const li = el('li', n.status === 'done' ? 'note done' : 'note');
      const head = el('div', 'note-head'); head.append(badge(n), el('span', 'note-when', `${when(n.created_at)} · ${n.place}${n.version ? ' · ' + n.version : ''}`));
      li.append(head, el('p', 'note-body', n.body));
      if (n.reply) li.append(el('p', 'note-reply', `${tx('Odpowiedź', 'Reply')}: ${n.reply}`));
      return li;
    }));
  };
  void refresh();
  setTimeout(() => area.focus(), 0);
  return wrap;
}

/** Zakładka administratora: wszystkie uwagi testerów, filtr, „zrobione” i odpowiedź */
export function adminNotesPane(): Node[] {
  const wrap = el('div', 'admin notes');
  const filt = el('div', 'admin-actions');
  const list = el('ul', 'note-list');
  const msgP = status();
  let mode: 'open' | 'done' | 'all' = 'open';
  const fb: HTMLButtonElement[] = [];
  for (const [m, pl, en] of [['open', 'Czekają', 'Waiting'], ['done', 'Zrobione', 'Done'], ['all', 'Wszystkie', 'All']] as const) {
    const b = btn(tx(pl, en), () => { mode = m; mark(); void refresh(); });
    fb.push(b); filt.append(b);
  }
  const mark = (): void => fb.forEach((b, i) => b.setAttribute('aria-pressed', String(['open', 'done', 'all'][i] === mode)));
  mark();
  wrap.append(filt, msgP, list);

  const refresh = async (): Promise<void> => {
    const rows = await listNotes(false, 200);
    if (typeof rows === 'string') { say(msgP, rows, true); list.replaceChildren(); return; }
    const shown = rows.filter((n) => mode === 'all' || n.status === mode);
    const open = rows.filter((n) => n.status === 'open').length;
    say(msgP, tx(`Czeka na zrobienie: ${open}`, `Waiting to be done: ${open}`));
    if (!shown.length) { list.replaceChildren(el('li', 'house-note', tx('Brak uwag.', 'No notes.'))); return; }
    list.replaceChildren(...shown.map((n) => {
      const li = el('li', n.status === 'done' ? 'note done' : 'note');
      const head = el('div', 'note-head');
      head.append(badge(n), el('strong', '', n.nick || '?'), el('span', 'note-when', `${when(n.created_at)} · ${n.place}${n.version ? ' · ' + n.version : ''}`));
      const rid = `reply-${n.id}`;
      const rl = el('label', '', tx('Odpowiedź dla testera (opcjonalnie)', 'Reply to the tester (optional)')); rl.htmlFor = rid;
      const reply = el('input'); reply.id = rid; reply.type = 'text'; reply.maxLength = 1000; reply.value = n.reply ?? '';
      const done = n.status === 'done';
      const act = btn(done ? tx('Otwórz ponownie', 'Reopen') : tx('Zrobione', 'Done'), async () => {
        act.disabled = true;
        const err = await markNote(n.id, !done, reply.value);
        act.disabled = false;
        if (err) { say(msgP, err, true); return; }
        void refresh();
      }, done ? 'menu-btn admin-btn' : 'menu-btn admin-btn btn-ok');
      const row = el('div', 'admin-nick'); row.append(rl, reply, act);
      li.append(head, el('p', 'note-body', n.body), row);
      return li;
    }));
  };
  void refresh();
  return [wrap];
}
