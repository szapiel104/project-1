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
      void confirmDialog({ title: tx('Zapisać grę?', 'Save the game?'), text: tx('Powstanie nowy zapis z miniaturą Twojej osady.', 'A new save with a thumbnail of your settlement.'), ok: tx('Zapisz', 'Save'), input: { label: tx('Nazwa zapisu', 'Save name'), value: def } }).then((nm) => {
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
  /** Ikonki w statystykach kafelka (rysowane, bez emoji) */
  const ICO: Record<string, string> = {
    day: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.7-3.4 3.1-5.2 6-5.2s5.3 1.8 6 5.2"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.4c2.6 0 4.4 1.5 5 4.6"/>',
    army: '<path d="M14.5 3.5l6 6-9 9-2 0 0-2z M5 14l5 5 M3 17l4 4"/>',
    houses: '<path d="M3 20V10l6-5 6 5v10z M15 20v-7l3-2.5 3 2.5v7 M7 20v-5h4v5"/>',
    gold: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7 M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
    more: '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18z"/>',
    device: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>',
  };
  const svg = (k: string, size = 18): string => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
  /** Menu „⋯” z rzadszymi działaniami (przycisk z aria-expanded, Esc zamyka, strzałki przechodzą po pozycjach) */
  const moreMenu = (items: [string, () => void, boolean?][], label: string): HTMLElement => {
    const wrap = el('div', 'sv-more');
    const open = el('button', 'sv-more-btn'); open.type = 'button';
    open.innerHTML = svg('more', 20);
    open.setAttribute('aria-haspopup', 'menu'); open.setAttribute('aria-expanded', 'false'); open.setAttribute('aria-label', label);
    const list = el('div', 'sv-menu'); list.setAttribute('role', 'menu'); list.hidden = true;
    const close = (focus = false): void => { list.hidden = true; open.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', outside, true); if (focus) open.focus(); };
    const outside = (e: Event): void => { if (!wrap.contains(e.target as Node)) close(); };
    const btns = items.map(([text, run, danger]) => {
      const b = el('button', danger ? 'sv-mi danger' : 'sv-mi', text); b.type = 'button'; b.setAttribute('role', 'menuitem');
      b.addEventListener('click', () => { close(); run(); });
      return b;
    });
    list.append(...btns);
    open.addEventListener('click', () => {
      const show = list.hidden;
      list.hidden = !show; open.setAttribute('aria-expanded', String(show));
      if (show) { document.addEventListener('click', outside, true); btns[0]?.focus(); }
    });
    wrap.addEventListener('keydown', (e) => {
      if (list.hidden) return;
      const i = btns.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); btns[(i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length]!.focus(); }
    });
    wrap.append(open, list);
    return wrap;
  };
  const card = (m: SaveMeta): HTMLElement => {
    const c = el('article', `sv-card ${m.kind}`);
    c.setAttribute('aria-label', m.name);
    const doLoad = (): void => {
      void confirmDialog({
        title: tx(`Wczytać „${m.name}”?`, `Load “${m.name}”?`), image: m.thumb || undefined, icon: 'load',
        caption: `${tx('zapisano', 'saved')} ${when(m.created)} · ${MODE(m.preset)}${m.level !== undefined ? ` · ${tx('boty', 'bots')} ${LEVELS()[m.level] ?? m.level}` : ''}`,
        facts: [[tx('dzień', 'day'), String(m.day)], [tx('ludzie', 'people'), String(m.people)], [tx('wojsko', 'army'), String(m.soldiers)], [tx('budynki', 'buildings'), String(m.buildings)], [tx('złoto', 'gold'), String(m.gold)]],
        text: go.canSave() ? tx('Obecna gra zostanie zamknięta — to, czego nie zapisałeś, przepadnie.', 'The current game will close — anything you have not saved will be lost.') : undefined,
        ok: tx('Wczytaj grę', 'Load game'),
      }).then((yes) => {
        if (!yes) return;
        load.disabled = true; say(tx('Wczytuję zapis…', 'Loading the save…'));
        void go.load(m.id).then((e) => { load.disabled = false; if (e) say(e, true); });
      });
    };
    // kadr: klik w obrazek też wczytuje; na obrazku rodzaj zapisu i gdzie leży, na dole nazwa i data
    const shot = el('button', 'sv-shot'); shot.type = 'button';
    shot.setAttribute('aria-label', tx(`Wczytaj „${m.name}”`, `Load “${m.name}”`));
    if (m.thumb) { const img = el('img'); img.src = m.thumb; img.alt = ''; img.loading = 'lazy'; shot.append(img); }
    else shot.append(el('span', 'sv-noshot', tx('bez podglądu', 'no preview')));
    shot.append(el('span', `sv-kind ${m.kind}`, KIND(m.kind)));
    const where = el('span', `sv-where ${m.where ?? 'local'}`);
    where.innerHTML = svg(m.where === 'local' || !m.where ? 'device' : 'cloud', 15);
    where.append(m.where === 'both' ? tx('chmura', 'cloud') : m.where === 'cloud' ? tx('tylko chmura', 'cloud only') : tx('ta przeglądarka', 'this browser'));
    where.title = m.where === 'both' ? tx('W chmurze konta i w tej przeglądarce', 'In your account’s cloud and in this browser') : m.where === 'cloud' ? tx('Tylko w chmurze konta', 'Only in your account’s cloud') : tx('Tylko w tej przeglądarce', 'Only in this browser');
    shot.append(where);
    const cap = el('span', 'sv-cap');
    const title = el('strong', 'sv-name', m.name);
    cap.append(title, el('span', 'sv-when', when(m.created)));
    shot.append(cap);
    shot.addEventListener('click', doLoad);
    // opis: tryb i boty jednym wierszem, a liczby w równym rzędzie z ikonkami
    const body = el('div', 'sv-body');
    const lv = m.level !== undefined ? `${tx('boty', 'bots')} ${LEVELS()[m.level] ?? m.level}` : '';
    const sub = el('p', 'sv-sub', [MODE(m.preset), lv, m.dev ? tx('deweloperski', 'developer') : ''].filter(Boolean).join(' · '));
    const stats = el('dl', 'sv-stats');
    for (const [k, v, label] of [
      ['day', `${m.day}`, tx(`dzień · ${m.hour}:00`, `day · ${m.hour}:00`)], ['people', `${m.people}`, tx('ludzie', 'people')], ['army', `${m.soldiers}`, tx('wojsko', 'army')],
      ['houses', `${m.buildings}`, tx('budynki', 'buildings')], ['gold', `${m.gold}`, tx('złoto', 'gold')],
    ] as const) {
      const d = el('div', 'sv-stat');
      const dt = el('dt'); dt.innerHTML = svg(k); dt.append(el('span', '', label));
      d.append(dt, el('dd', '', v));
      stats.append(d);
    }
    body.append(sub, stats);
    if (m.v !== SAVE_VERSION) body.append(el('p', 'sv-old', tx('Ze starszej wersji gry — może się nie wczytać.', 'From an older version of the game — may not load.')));
    // działania: duże „Wczytaj”, reszta w menu „⋯”
    const acts = el('div', 'sv-acts');
    const load = btn(tx('Wczytaj', 'Load'), doLoad, 'menu-btn btn-ok sv-btn sv-load');
    const overwrite = (): void => {
      void confirmDialog({ title: tx(`Nadpisać „${m.name}”?`, `Overwrite “${m.name}”?`), image: m.thumb || undefined, text: tx('Ten zapis zostanie zastąpiony obecną grą. Tego nie da się cofnąć.', 'This save will be replaced with the current game. This cannot be undone.'), ok: tx('Nadpisz', 'Overwrite'), tone: 'danger', icon: 'save', caption: `${tx('zapisano', 'saved')} ${when(m.created)}` }).then((yes) => {
        if (!yes) return;
        say(tx('Zapisuję…', 'Saving…'));
        void go.save(m.name, m.id).then((r) => { if (typeof r === 'string') say(r, true); else { say(tx(`Nadpisano „${r.name}”.`, `Overwrote “${r.name}”.`)); go.changed?.(); void refresh(); } });
      });
    };
    const rename = (): void => {
      void confirmDialog({ title: tx('Zmień nazwę zapisu', 'Rename the save'), ok: tx('Zapisz nazwę', 'Save name'), icon: 'edit', input: { label: tx('Nowa nazwa', 'New name'), value: m.name } }).then((v) => {
        if (v === null || v === m.name) return;
        void renameSave(m.id, v).then((e) => { if (e) say(e, true); else say(tx(`Nowa nazwa: „${v}”.`, `New name: “${v}”.`)); void refresh(); });
      });
    };
    const del = (): void => {
      void confirmDialog({ title: tx(`Usunąć „${m.name}”?`, `Delete “${m.name}”?`), image: m.thumb || undefined, text: m.where !== 'local' ? tx('Zapis zniknie z tej przeglądarki i z chmury. Tego nie da się cofnąć.', 'The save will be removed from this browser and the cloud. This cannot be undone.') : tx('Zapis zniknie z tej przeglądarki. Tego nie da się cofnąć.', 'The save will be removed from this browser. This cannot be undone.'), ok: tx('Usuń zapis', 'Delete save'), tone: 'danger', icon: 'delete', caption: `${tx('zapisano', 'saved')} ${when(m.created)}` }).then((yes) => {
        if (!yes) return;
        void deleteSave(m.id).then(() => { say(tx(`Usunięto „${m.name}”.`, `Deleted “${m.name}”.`)); go.changed?.(); void refresh(); });
      });
    };
    const items: [string, () => void, boolean?][] = [];
    if (mode === 'save' && m.kind === 'manual' && go.canSave()) items.push([tx('Nadpisz obecną grą', 'Overwrite with this game'), overwrite]);
    items.push([tx('Zmień nazwę', 'Rename'), rename]);
    items.push([tx('Pobierz plik .p1save', 'Download .p1save file'), () => void exportSave(m.id).then((e) => { if (e) say(e, true); })]);
    if (me() && m.where === 'local') items.push([tx('Wyślij do chmury', 'Upload to cloud'), () => void uploadSave(m.id).then((ok) => { say(ok ? tx('Zapis jest w chmurze.', 'The save is in the cloud.') : tx('Nie udało się wysłać — sprawdź internet.', 'Upload failed — check your connection.'), !ok); void refresh(); })]);
    items.push([tx('Usuń zapis', 'Delete save'), del, true]);
    acts.append(load, moreMenu(items, tx(`Więcej działań: ${m.name}`, `More actions: ${m.name}`)));
    body.append(acts, el('span', 'sv-meta', `${tx('wersja gry', 'game version')} ${m.build}${m.size ? ' · ' + kb(m.size) : ''}`));
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
