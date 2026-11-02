import { adminFind, adminGrant, adminTester, adminLog, adminSetNick, adminSetProgress, type AdminAccount, type Counters } from '../net/admin';
import { me } from '../net/supa';
import { levelOf, TITLES, titleOf, xpAtLevel } from '../data/progress';
import { lang, tx } from '../i18n';

/**
 * Zakładka „Administracja” w „Moim rodzie” (Michał 2.11.2026: administratorzy mogą edytować konta — dodawać i odbierać
 * poziomy, poprawiać liczniki, nick i prawa administratora). Widać ją tylko administratorom; każdą zmianę i tak sprawdza
 * baza (funkcje admin_* z migracji 20261102), a dziennik pokazuje, kto co zmienił.
 */
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const btn = (text: string, onClick: () => void, cls = 'menu-btn'): HTMLButtonElement => {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
};
const status = (): HTMLParagraphElement => { const p = el('p', 'net-msg'); p.setAttribute('role', 'status'); return p; };
const say = (p: HTMLElement, text: string, bad = false): void => { p.textContent = text; p.classList.toggle('bad', bad); };

const FIELDS: [keyof Counters, string, string][] = [
  ['xp', 'Doświadczenie (PD)', 'Experience (XP)'],
  ['matches', 'Bitwy', 'Battles'],
  ['wins', 'Zwycięstwa', 'Victories'],
  ['online_wins', 'Zwycięstwa przez sieć', 'Online victories'],
  ['hard_wins', 'Wygrane z trudnym botem', 'Wins vs the hardest bot'],
  ['kills', 'Pokonani wrogowie', 'Foes slain'],
  ['razed', 'Zburzone budynki wroga', 'Enemy buildings razed'],
  ['built', 'Postawione budynki', 'Buildings raised'],
  ['minutes', 'Minuty w bitwach', 'Minutes in battle'],
];

export function adminPane(onSelfChanged: () => void): Node[] {
  const wrap = el('div', 'admin');
  wrap.append(el('p', 'house-note', tx(
    'Panel administratora kont. Zmiany zapisuje baza tylko dla kont z prawami administratora, każda trafia do dziennika na dole.',
    'Account administration. The database accepts changes only from accounts with admin rights; each one is logged below.')));

  // --- wyszukiwanie ---
  const form = el('form', 'admin-search');
  const id = `admin-q-${Math.random().toString(36).slice(2, 6)}`;
  const lab = el('label', '', tx('Nick gracza (fragment)', 'Player nickname (part of it)')); lab.htmlFor = id;
  const q = el('input'); q.id = id; q.type = 'search'; q.autocomplete = 'off'; q.maxLength = 20;
  const go = el('button', 'menu-btn admin-btn', tx('Szukaj', 'Search')); go.type = 'submit';
  form.append(lab, q, go);
  const note = status();
  const list = el('ul', 'admin-list');
  const edit = el('div', 'admin-edit');
  const logBox = el('div', 'admin-log');
  wrap.append(form, note, list, edit, el('h4', 'house-h', tx('Dziennik zmian', 'Change log')), logBox);

  const search = async (): Promise<void> => {
    say(note, tx('Szukam…', 'Searching…'));
    const rows = await adminFind(q.value);
    if (typeof rows === 'string') { say(note, rows, true); return; }
    say(note, rows.length ? tx(`Znaleziono kont: ${rows.length}`, `Accounts found: ${rows.length}`) : tx('Brak kont o takim nicku.', 'No account with that nickname.'));
    list.replaceChildren(...rows.map((a) => {
      const li = el('li');
      const b = btn(`${a.nick} · ${tx('poziom', 'level')} ${a.level}${a.admin ? ' · ' + tx('administrator', 'admin') : ''}${a.tester ? ' · ' + tx('tester', 'tester') : ''}`, () => open(a), 'admin-pick');
      li.append(b);
      return li;
    }));
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); void search(); });

  // --- edycja jednego konta ---
  const open = (a: AdminAccount): void => {
    const self = a.id === me()?.id;
    const box = el('section', 'admin-card');
    box.setAttribute('aria-label', a.nick);
    const head = el('h4', 'house-h', '');
    const msgP = status();
    // zmiana w polach to dopiero szkic: do bazy idzie po „Zapisz postęp” (Michał 2.11.2026: „nie zmieniło się”)
    let dirty = false;
    const paintHead = (): void => {
      const lv = levelOf(Number(inputs.xp.value) || 0);
      head.textContent = `${a.nick} — ${tx('poziom', 'level')} ${lv.level} · ${titleOf(lv.level)}`;
      if (dirty) say(msgP, tx('Zmiany nie są jeszcze zapisane — kliknij „Zapisz postęp”.', 'Changes are not saved yet — click “Save progress”.'));
    };
    const touch = (): void => { dirty = true; save.textContent = tx('Zapisz postęp *', 'Save progress *'); paintHead(); };

    // poziom: −1 / +1 / wpisany — ustawia PD na początek tego poziomu
    const lvRow = el('div', 'admin-level');
    const lvId = `admin-lv-${a.id.slice(0, 6)}`;
    const lvLab = el('label', '', tx('Poziom', 'Level')); lvLab.htmlFor = lvId;
    const lvIn = el('input'); lvIn.id = lvId; lvIn.type = 'number'; lvIn.min = '1'; lvIn.max = '200'; lvIn.value = String(levelOf(a.xp).level);
    const setLevel = (l: number): void => {
      const lv = Math.max(1, Math.min(200, Math.round(l) || 1));
      lvIn.value = String(lv); inputs.xp.value = String(xpAtLevel(lv)); touch();
    };
    lvIn.addEventListener('change', () => setLevel(Number(lvIn.value)));
    lvRow.append(lvLab, btn(tx('− poziom', '− level'), () => setLevel(Number(lvIn.value) - 1), 'menu-btn admin-btn'), lvIn, btn(tx('+ poziom', '+ level'), () => setLevel(Number(lvIn.value) + 1), 'menu-btn admin-btn'));

    // liczniki
    const grid = el('div', 'admin-grid');
    const inputs = {} as Record<keyof Counters, HTMLInputElement>;
    for (const [k, pl, en] of FIELDS) {
      const f = el('div', 'field');
      const fid = `admin-${k}-${a.id.slice(0, 6)}`;
      const l = el('label', '', tx(pl, en)); l.htmlFor = fid;
      const i = el('input'); i.id = fid; i.type = 'number'; i.min = '0'; i.step = '1'; i.value = String(a[k] ?? 0);
      i.addEventListener('input', () => { if (k === 'xp') lvIn.value = String(levelOf(Number(i.value) || 0).level); touch(); });
      inputs[k] = i;
      f.append(l, i); grid.append(f);
    }
    const read = (): Counters => Object.fromEntries(FIELDS.map(([k]) => [k, Math.max(0, Math.floor(Number(inputs[k].value) || 0))])) as unknown as Counters;

    const save = btn(tx('Zapisz postęp', 'Save progress'), async () => {
      save.disabled = true;
      const r = await adminSetProgress(a.id, read());
      save.disabled = false;
      if (typeof r === 'string') { say(msgP, r, true); return; }
      a.xp = r.xp; a.level = r.level; dirty = false; save.textContent = tx('Zapisz postęp', 'Save progress');
      say(msgP, tx(`Zapisano: poziom ${r.level}, ${r.xp} PD.`, `Saved: level ${r.level}, ${r.xp} XP.`));
      paintHead(); void refreshLog();
      if (self) onSelfChanged();
    }, 'menu-btn admin-btn btn-ok');
    // zerowanie: dwa kliknięcia (pierwsze tylko pyta)
    let armed = false;
    const reset = btn(tx('Wyzeruj postęp', 'Reset progress'), async () => {
      if (!armed) { armed = true; reset.textContent = tx('Na pewno? Kliknij jeszcze raz', 'Sure? Click again'); setTimeout(() => { armed = false; reset.textContent = tx('Wyzeruj postęp', 'Reset progress'); }, 4000); return; }
      armed = false; reset.textContent = tx('Wyzeruj postęp', 'Reset progress');
      for (const [k] of FIELDS) inputs[k].value = '0';
      lvIn.value = '1';
      save.click();
    }, 'menu-btn admin-btn btn-danger');

    // nick
    const nickRow = el('div', 'admin-nick');
    const nid = `admin-nick-${a.id.slice(0, 6)}`;
    const nl = el('label', '', tx('Nick', 'Nickname')); nl.htmlFor = nid;
    const ni = el('input'); ni.id = nid; ni.type = 'text'; ni.value = a.nick; ni.minLength = 3; ni.maxLength = 20; ni.autocomplete = 'off';
    const nb = btn(tx('Zmień nick', 'Rename'), async () => {
      const err = await adminSetNick(a.id, ni.value);
      if (err) { say(msgP, err, true); return; }
      a.nick = ni.value.trim(); paintHead(); say(msgP, tx('Nick zmieniony.', 'Nickname changed.')); void refreshLog();
      if (self) onSelfChanged();
    }, 'menu-btn admin-btn');
    nickRow.append(nl, ni, nb);

    // prawa administratora (siebie odebrać nie można — pilnuje też baza)
    const grant = btn(a.admin ? tx('Odbierz prawa administratora', 'Revoke admin rights') : tx('Nadaj prawa administratora', 'Grant admin rights'), async () => {
      const err = await adminGrant(a.id, !a.admin);
      if (err) { say(msgP, err, true); return; }
      a.admin = !a.admin;
      grant.textContent = a.admin ? tx('Odbierz prawa administratora', 'Revoke admin rights') : tx('Nadaj prawa administratora', 'Grant admin rights');
      say(msgP, a.admin ? tx('Konto jest teraz administratorem.', 'The account is now an admin.') : tx('Prawa administratora odebrane.', 'Admin rights revoked.'));
      void refreshLog();
      grant.className = a.admin ? 'menu-btn admin-btn btn-danger' : 'menu-btn admin-btn';
    }, a.admin ? 'menu-btn admin-btn btn-danger' : 'menu-btn admin-btn');
    grant.disabled = self && a.admin;
    if (grant.disabled) grant.title = tx('Własnych praw nie można odebrać.', 'You cannot revoke your own rights.');

    // rola testera: tryb deweloperski w menu i panel F9 w grze solo
    const tLabel = (): string => (a.tester ? tx('Odbierz rolę testera', 'Remove tester role') : tx('Nadaj rolę testera', 'Make tester'));
    const tester = btn(tLabel(), async () => {
      const err = await adminTester(a.id, !a.tester);
      if (err) { say(msgP, err, true); return; }
      a.tester = !a.tester;
      tester.textContent = tLabel();
      tester.className = a.tester ? 'menu-btn admin-btn btn-danger' : 'menu-btn admin-btn';
      say(msgP, a.tester ? tx('Konto jest testerem: po ponownym zalogowaniu zobaczy tryb deweloperski.', 'The account is a tester: after signing in again it sees developer mode.') : tx('Rola testera odebrana.', 'Tester role removed.'));
      void refreshLog();
      if (self) onSelfChanged();
    }, a.tester ? 'menu-btn admin-btn btn-danger' : 'menu-btn admin-btn');

    const actions = el('div', 'admin-actions');
    actions.append(save, reset, grant, tester);
    // tytuły zależą od poziomu: giermek do 5., rycerz od 6. itd. — żeby było widać, czemu tytuł się nie zmienia
    const ranks = el('p', 'house-note', tx('Tytuły: ', 'Ranks: ') + TITLES.map((t) => `${tx(t.pl, t.en)} ${t.from}+`).join(' · '));
    box.append(head, lvRow, ranks, grid, actions, nickRow, msgP);
    paintHead();
    edit.replaceChildren(box);
    lvIn.focus();
  };

  // --- dziennik ---
  const refreshLog = async (): Promise<void> => {
    const rows = await adminLog(15);
    if (typeof rows === 'string') { logBox.replaceChildren(el('p', 'net-msg bad', rows)); return; }
    if (!rows.length) { logBox.replaceChildren(el('p', 'house-note', tx('Na razie bez zmian.', 'No changes yet.'))); return; }
    const ul = el('ul', 'admin-loglist');
    const names: Record<string, [string, string]> = { 'tester+': ['nadanie roli testera', 'tester role granted'], 'tester-': ['odebranie roli testera', 'tester role removed'], progress: ['postęp', 'progress'], nick: ['nick', 'nickname'], grant: ['nadanie praw', 'rights granted'], revoke: ['odebranie praw', 'rights revoked'] };
    for (const r of rows) {
      const d = new Date(r.created_at).toLocaleString(lang() === 'en' ? 'en-GB' : 'pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const what = names[r.action] ? tx(names[r.action]![0], names[r.action]![1]) : r.action;
      const det = r.detail ? Object.entries(r.detail).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${String(v)}`).join(', ') : '';
      ul.append(el('li', '', `${d} — ${what}${det ? ' (' + det + ')' : ''}`));
    }
    logBox.replaceChildren(ul);
  };
  void refreshLog();
  setTimeout(() => q.focus(), 0);
  return [wrap];
}
