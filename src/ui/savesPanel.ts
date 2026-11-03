import { deleteSave, exportSave, importSave, listSaves, MAX_AUTO, MAX_MANUAL, renameSave, uploadSave, cloudReady, type SaveMeta } from '../saves/store';
import { me } from '../net/supa';
import { SAVE_VERSION } from '../sim/save';
import { confirmDialog } from './confirmDialog';
import { lang, tx } from '../i18n';

/**
 * Okno zapisów (Michał 2.11.2026): kafelki z miniaturą miejsca, nazwą, datą, mapą, poziomem botów, dniem gry,
 * ludźmi, wojskiem, budynkami i złotem; wczytaj, nadpisz, zmień nazwę, pobierz plik, wyślij do chmury, usuń.
 * Tryb „save” (w grze): pole na nazwę i „Zapisz”; tryb „load”: tylko wczytywanie. Filtr: wszystkie / ręczne / autozapisy.
 */
export interface SavesActions {
  canSave(): boolean;
  save(name: string, replace?: string): Promise<SaveMeta | string>;
  load(id: string): Promise<string | null>;
  /** login, gdy gość chce zapisów w chmurze */
  login(): void;
  /** po usunięciu albo dodaniu zapisu (np. „Kontynuuj” w menu) */
  changed?(): void;
}
const PER_PAGE = 8;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const btn = (text: string, run: () => void, cls = 'menu-btn sv-btn'): HTMLButtonElement => {
  const b = el('button', cls, text); b.type = 'button';
  b.addEventListener('click', run);
  return b;
};
const when = (t: number): string => new Date(t).toLocaleString(lang() === 'en' ? 'en-GB' : 'pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const kb = (n?: number): string => (n ? (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`) : '');
const LEVELS = (): string[] => lang() === 'en' ? ['peaceful', 'easy', 'medium', 'hard'] : ['pokojowe', 'łatwe', 'średnie', 'trudne'];
const MODE = (p: string): string => ({ '1v1': tx('1 na 1', '1 vs 1'), '2v2': tx('2 na 2', '2 vs 2'), '4v4': tx('4 na 4', '4 vs 4') } as Record<string, string>)[p] ?? p;
const KIND = (k: SaveMeta['kind']): string => k === 'auto' ? tx('autozapis', 'autosave') : k === 'quick' ? tx('szybki zapis', 'quick save') : tx('zapis', 'save');

export function savesPanel(mode: 'save' | 'load', go: SavesActions): HTMLElement {
  const wrap = el('div', 'saves');
  const info = el('p', 'net-msg sv-info'); info.setAttribute('role', 'status');
  const say = (t: string, bad = false): void => { info.textContent = t; info.classList.toggle('bad', bad); };

  // --- pasek: nowy zapis, filtr, import, stan chmury ---
  const top = el('div', 'sv-top');
  if (mode === 'save') {
    const form = el('form', 'sv-new');
    const id = `sv-name-${Math.random().toString(36).slice(2, 6)}`;
    const lab = el('label', 'sr-only', tx('Nazwa zapisu', 'Save name')); lab.htmlFor = id;
    const name = el('input'); name.id = id; name.maxLength = 40; name.autocomplete = 'off';
    name.placeholder = tx('Nazwa zapisu, np. „Przed oblężeniem”', 'Save name, e.g. “Before the siege”');
    name.addEventListener('keydown', (e) => e.stopPropagation());
    const ok = el('button', 'menu-btn btn-ok sv-btn', tx('Zapisz nową grę', 'Save as new')); ok.type = 'submit';
    form.append(lab, name, ok);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!go.canSave()) { say(tx('Teraz nie można zapisać — zapisuje się tylko gra z botami w trakcie.', 'You cannot save now — only a game against bots in progress can be saved.'), true); return; }
      const def = name.value.trim() || tx(`Zapis ${new Date().toLocaleDateString('pl-PL')}`, `Save ${new Date().toLocaleDateString('en-GB')}`);
      void confirmDialog({ title: tx('Zapisać grę?', 'Save the game?'), text: tx('Powstanie nowy zapis z miniaturą obecnego widoku.', 'A new save with a thumbnail of the current view will be created.'), ok: tx('Zapisz', 'Save'), input: { label: tx('Nazwa zapisu', 'Save name'), value: def } }).then((nm) => {
      if (nm === null) return;
      ok.disabled = true; say(tx('Zapisuję…', 'Saving…'));
      void go.save(nm).then((r) => {
        ok.disabled = false;
        if (typeof r === 'string') { say(r, true); return; }
        name.value = '';
        say(tx(`Zapisano „${r.name}”.`, `Saved “${r.name}”.`));
        go.changed?.();
        void refresh();
      });
      });
    });
    top.append(form);
    setTimeout(() => name.focus(), 0);
  }
  const bar = el('div', 'sv-bar');
  const seg = el('div', 'notes-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', tx('Pokaż', 'Show'));
  let filter = 'all' as 'all' | 'manual' | 'auto';
  const segBtns: ['all' | 'manual' | 'auto', HTMLButtonElement][] = [];
  for (const [k, pl, en] of [['all', 'Wszystkie', 'All'], ['manual', 'Ręczne', 'Manual'], ['auto', 'Autozapisy', 'Autosaves']] as const) {
    const b = btn(tx(pl, en), () => { filter = k; page = 0; paint(); }); segBtns.push([k, b]); seg.append(b);
  }
  const count = el('span', 'sv-count');
  const file = el('input'); file.type = 'file'; file.accept = '.p1save'; file.hidden = true;
  file.addEventListener('change', () => {
    const f = file.files?.[0]; file.value = '';
    if (!f) return;
    say(tx('Wczytuję plik…', 'Reading the file…'));
    void importSave(f).then((r) => { if (typeof r === 'string') say(r, true); else { say(tx(`Dodano zapis „${r.name}” z pliku.`, `Added the save “${r.name}” from the file.`)); void refresh(); } });
  });
  const imp = btn(tx('Wczytaj z pliku', 'Import a file'), () => file.click());
  bar.append(seg, count, imp, file);
  const cloud = el('p', 'sv-cloud');
  top.append(bar, cloud);
  const grid = el('div', 'sv-grid');
  const pager = el('nav', 'notes-pager'); pager.setAttribute('aria-label', tx('Strony zapisów', 'Save pages'));
  wrap.append(top, info, grid, pager);

  let saves: SaveMeta[] = [];
  let page = 0;
  const paintCloud = (): void => {
    cloud.replaceChildren();
    if (!me()) {
      cloud.append(el('span', '', tx('Zapisy są tylko w tej przeglądarce — wyczyszczenie danych witryny je usunie. ', 'Saves are only in this browser — clearing site data deletes them. ')));
      cloud.append(btn(tx('Zaloguj się, żeby trzymać je w chmurze', 'Sign in to keep them in the cloud'), go.login, 'link-btn'));
      cloud.classList.add('warn');
    } else {
      cloud.classList.toggle('warn', !cloudReady());
      cloud.textContent = cloudReady()
        ? tx('Zapisy są w tej przeglądarce i w chmurze Twojego konta — po wyczyszczeniu przeglądarki albo na innym komputerze wystarczy się zalogować.', 'Saves are in this browser and in your account’s cloud — after clearing the browser or on another computer just sign in.')
        : tx('Chmura zapisów jest chwilowo niedostępna — zapisy są tylko w tej przeglądarce.', 'Cloud saves are unavailable right now — saves are only in this browser.');
    }
  };
  const card = (m: SaveMeta): HTMLElement => {
    const c = el('article', `sv-card ${m.kind}`);
    const shot = el('div', 'sv-shot');
    if (m.thumb) { const img = el('img'); img.src = m.thumb; img.alt = ''; img.loading = 'lazy'; shot.append(img); }
    else shot.append(el('span', 'sv-noshot', tx('bez podglądu', 'no preview')));
    const tag = el('span', `sv-kind ${m.kind}`, KIND(m.kind)); shot.append(tag);
    const where = el('span', `sv-where ${m.where ?? 'local'}`, m.where === 'both' ? tx('☁ chmura + przeglądarka', '☁ cloud + browser') : m.where === 'cloud' ? tx('☁ w chmurze', '☁ in the cloud') : tx('tylko ta przeglądarka', 'this browser only'));
    shot.append(where);
    const body = el('div', 'sv-body');
    const title = el('strong', 'sv-name', m.name);
    const facts = el('ul', 'sv-facts');
    const lv = m.level !== undefined ? `${tx('boty', 'bots')}: ${LEVELS()[m.level] ?? m.level}` : '';
    for (const f of [
      `${when(m.created)}`,
      `${MODE(m.preset)}${lv ? ' · ' + lv : ''}${m.dev ? tx(' · deweloperski', ' · developer') : ''}`,
      tx(`dzień ${m.day}, godz. ${m.hour}:00`, `day ${m.day}, ${m.hour}:00`),
      tx(`ludzie ${m.people} · wojsko ${m.soldiers} · budynki ${m.buildings} · złoto ${m.gold}`, `people ${m.people} · soldiers ${m.soldiers} · buildings ${m.buildings} · gold ${m.gold}`),
    ]) facts.append(el('li', '', f));
    if (m.v !== SAVE_VERSION) facts.append(el('li', 'sv-old', tx('ze starszej wersji gry — może się nie wczytać', 'from an older version — may not load')));
    const meta = el('span', 'sv-meta', `${tx('wersja', 'version')} ${m.build}${m.size ? ' · ' + kb(m.size) : ''}`);
    const acts = el('div', 'sv-acts');
    const load = btn(tx('Wczytaj', 'Load'), () => {
      void confirmDialog({
        title: tx(`Wczytać „${m.name}”?`, `Load “${m.name}”?`), image: m.thumb || undefined,
        text: go.canSave() ? tx('Obecna gra zostanie zamknięta — to, czego nie zapisałeś, przepadnie.', 'The current game will close — anything you have not saved will be lost.') : tx(`Dzień ${m.day}, ${MODE(m.preset)}, zapisano ${when(m.created)}.`, `Day ${m.day}, ${MODE(m.preset)}, saved ${when(m.created)}.`),
        ok: tx('Wczytaj', 'Load'),
      }).then((yes) => {
        if (!yes) return;
        load.disabled = true; say(tx('Wczytuję zapis…', 'Loading the save…'));
        void go.load(m.id).then((e) => { load.disabled = false; if (e) say(e, true); });
      });
    }, 'menu-btn btn-ok sv-btn');
    acts.append(load);
    if (mode === 'save' && m.kind === 'manual') acts.append(btn(tx('Nadpisz', 'Overwrite'), () => {
      void confirmDialog({ title: tx(`Nadpisać „${m.name}”?`, `Overwrite “${m.name}”?`), image: m.thumb || undefined, text: tx('Ten zapis zostanie zastąpiony obecną grą. Tego nie da się cofnąć.', 'This save will be replaced with the current game. This cannot be undone.'), ok: tx('Nadpisz', 'Overwrite'), tone: 'danger' }).then((yes) => {
        if (!yes) return;
        say(tx('Zapisuję…', 'Saving…'));
        void go.save(m.name, m.id).then((r) => { if (typeof r === 'string') say(r, true); else { say(tx(`Nadpisano „${r.name}”.`, `Overwrote “${r.name}”.`)); go.changed?.(); void refresh(); } });
      });
    }));
    acts.append(btn(tx('Zmień nazwę', 'Rename'), () => {
      const input = el('input', 'sv-rename'); input.value = m.name; input.maxLength = 40; input.setAttribute('aria-label', tx('Nowa nazwa', 'New name'));
      const done = (): void => { const v = input.value.trim(); if (v && v !== m.name) void renameSave(m.id, v).then((e) => { if (e) say(e, true); void refresh(); }); else input.replaceWith(title); };
      input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); done(); } if (e.key === 'Escape') { e.preventDefault(); input.replaceWith(title); } });
      input.addEventListener('blur', done);
      title.replaceWith(input); input.focus(); input.select();
    }));
    acts.append(btn(tx('Pobierz plik', 'Download'), () => void exportSave(m.id).then((e) => { if (e) say(e, true); })));
    if (me() && m.where === 'local') acts.append(btn(tx('Wyślij do chmury', 'Upload to cloud'), () => void uploadSave(m.id).then((ok) => { say(ok ? tx('Zapis jest w chmurze.', 'The save is in the cloud.') : tx('Nie udało się wysłać — sprawdź internet.', 'Upload failed — check your connection.'), !ok); void refresh(); })));
    acts.append(btn(tx('Usuń', 'Delete'), () => {
      void confirmDialog({ title: tx(`Usunąć „${m.name}”?`, `Delete “${m.name}”?`), image: m.thumb || undefined, text: m.where !== 'local' ? tx('Zapis zniknie z tej przeglądarki i z chmury. Tego nie da się cofnąć.', 'The save will be removed from this browser and the cloud. This cannot be undone.') : tx('Zapis zniknie z tej przeglądarki. Tego nie da się cofnąć.', 'The save will be removed from this browser. This cannot be undone.'), ok: tx('Usuń', 'Delete'), tone: 'danger' }).then((yes) => {
        if (!yes) return;
        void deleteSave(m.id).then(() => { say(tx(`Usunięto „${m.name}”.`, `Deleted “${m.name}”.`)); go.changed?.(); void refresh(); });
      });
    }, 'menu-btn btn-danger sv-btn'));
    body.append(title, facts, meta, acts);
    c.append(shot, body);
    return c;
  };
  const paint = (): void => {
    for (const [k, b] of segBtns) b.setAttribute('aria-pressed', String(k === filter));
    const manual = saves.filter((m) => m.kind === 'manual').length, autos = saves.filter((m) => m.kind === 'auto').length;
    count.textContent = tx(`zapisy ${manual} z ${MAX_MANUAL} · autozapisy ${autos} z ${MAX_AUTO}`, `saves ${manual} of ${MAX_MANUAL} · autosaves ${autos} of ${MAX_AUTO}`);
    const shown = saves.filter((m) => filter === 'all' || (filter === 'auto' ? m.kind !== 'manual' : m.kind === 'manual'));
    const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
    page = Math.min(page, pages - 1);
    grid.replaceChildren(...(shown.length ? shown.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map(card)
      : [el('p', 'net-msg sv-empty', mode === 'save' ? tx('Jeszcze nie masz zapisów — wpisz nazwę wyżej i kliknij „Zapisz nową grę”.', 'No saves yet — type a name above and click “Save as new”.') : tx('Nie masz jeszcze zapisów. W grze: Esc → „Zapisz grę” albo Ctrl+S; autozapis robi się sam co 3 minuty.', 'No saves yet. In a game: Esc → “Save game” or Ctrl+S; an autosave happens every 3 minutes.'))]));
    pager.replaceChildren();
    if (pages > 1) {
      const prev = btn(tx('← Poprzednia', '← Previous'), () => { page--; paint(); }); prev.disabled = page === 0;
      const next = btn(tx('Następna →', 'Next →'), () => { page++; paint(); }); next.disabled = page >= pages - 1;
      pager.append(prev, el('span', 'notes-page', tx(`strona ${page + 1} z ${pages}`, `page ${page + 1} of ${pages}`)), next);
    }
  };
  const refresh = async (): Promise<void> => {
    saves = await listSaves();
    paintCloud();
    paint();
  };
  grid.append(el('p', 'net-msg', tx('Wczytuję zapisy…', 'Loading saves…')));
  void refresh();
  return wrap;
}
