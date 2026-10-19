/**
 * Podsumowanie doświadczenia na końcu meczu (jak w grach sieciowych): pozycje wpadają po kolei i nabijają liczby,
 * potem suma, a na końcu pasek poziomu ładuje się od starego stanu do nowego — przy awansie błysk, dźwięk i nowy tytuł.
 * PD liczy baza (award_match); dopóki nie odpowie, suma to podgląd z gry. Gdy PD nie ma (tryb deweloperski, testowy,
 * brak konta, za krótki mecz), okno mówi wprost dlaczego.
 */
import { levelOf, titleOf } from '../data/progress';
import { tx } from '../i18n';

export interface XpAward { gained: number; xp: number; level: number }
export interface XpReportOpts {
  parts: { label: string; xp: number }[];
  /** Mnożnik rodzaju meczu (<1 dla botów i kooperacji) z opisem */
  mult?: { label: string; value: number };
  /** Ile PD policzyła gra (podgląd przed odpowiedzią bazy) */
  preview: number;
  /** Odpowiedź bazy; null = PD nie będzie (wtedy `reason`) */
  award: Promise<XpAward | null> | null;
  /** Dlaczego bez PD (gdy award = null albo baza nie odpowiedziała) */
  reason?: string;
  /** Przycisk pod powodem (np. logowanie) */
  action?: { label: string; run: () => void };
  /** Dźwięki: krótki stuk przy pozycji, fanfara przy awansie */
  sound?: (kind: 'tick' | 'level') => void;
}

const reduced = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));
/** Płynne nabijanie liczby w elemencie */
function countUp(el: HTMLElement, from: number, to: number, ms: number, fmt: (n: number) => string): Promise<void> {
  if (reduced() || ms <= 0) { el.textContent = fmt(to); return Promise.resolve(); }
  return new Promise((res) => {
    const t0 = performance.now();
    const step = (now: number): void => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - (1 - k) ** 3;
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e;
};

export function xpReport(host: HTMLElement, o: XpReportOpts): void {
  const PD = tx('PD', 'XP');
  const box = h('section', 'xpr');
  box.setAttribute('aria-label', tx('Doświadczenie za mecz', 'Experience for the match'));
  const head = h('div', 'xpr-head');
  head.append(h('h3', '', tx('Doświadczenie', 'Experience')));
  const list = h('ul', 'xpr-list');
  const total = h('div', 'xpr-total');
  const sum = h('strong', 'xpr-sum', `+0 ${PD}`);
  total.append(h('span', '', tx('Razem', 'Total')), sum);
  total.hidden = true;
  // pasek poziomu
  const lvl = h('div', 'xpr-level');
  lvl.hidden = true;
  const gem = h('div', 'xpr-gem'); const gemN = h('span', 'xpr-gem-n'); gem.append(gemN, h('span', 'xpr-gem-t', tx('poziom', 'level')));
  const right = h('div', 'xpr-right');
  const title = h('strong', 'xpr-title');
  const bar = h('div', 'xpr-bar'); const fill = h('span', 'xpr-fill'); const gain = h('span', 'xpr-gain'); bar.append(gain, fill);
  bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0');
  const nums = h('span', 'xpr-nums');
  right.append(title, bar, nums);
  lvl.append(gem, right);
  const up = h('p', 'xpr-up'); up.hidden = true; up.setAttribute('role', 'status');
  const note = h('p', 'xpr-note'); note.hidden = true; note.setAttribute('role', 'status');
  box.append(head, list, total, lvl, up, note);
  host.append(box);

  const paintLevel = (xp: number, ghostFrom?: number): void => {
    const lv = levelOf(xp);
    gemN.textContent = String(lv.level);
    title.textContent = titleOf(lv.level);
    fill.style.width = `${(lv.into / lv.need) * 100}%`;
    // jaśniejszy pas: ile przybyło na tym poziomie
    if (ghostFrom !== undefined) {
      const b = levelOf(ghostFrom);
      const startPct = b.level === lv.level ? (b.into / lv.need) * 100 : 0;
      gain.style.left = `${startPct}%`; gain.style.width = `${Math.max(0, (lv.into / lv.need) * 100 - startPct)}%`;
    }
    nums.textContent = `${lv.into} / ${lv.need} ${PD}`;
    bar.setAttribute('aria-valuemax', String(lv.need)); bar.setAttribute('aria-valuenow', String(lv.into));
  };

  void (async () => {
    // 1. pozycje po kolei, każda nabija swoją liczbę
    for (const p of o.parts) {
      const li = h('li', 'xpr-row'); const v = h('strong', '', '+0');
      li.append(h('span', '', p.label), v); list.append(li);
      requestAnimationFrame(() => li.classList.add('in'));
      o.sound?.('tick');
      await countUp(v, 0, p.xp, 320, (n) => `+${n}`);
      await wait(140);
    }
    if (o.mult && o.mult.value !== 1) {
      const li = h('li', 'xpr-row mult'); li.append(h('span', '', o.mult.label), h('strong', '', `×${o.mult.value}`)); list.append(li);
      requestAnimationFrame(() => li.classList.add('in'));
      await wait(320);
    }
    // 2. suma: najpierw podgląd z gry
    total.hidden = false;
    requestAnimationFrame(() => total.classList.add('in'));
    await countUp(sum, 0, o.preview, 600, (n) => `+${n} ${PD}`);
    // 3. odpowiedź bazy
    const r = o.award ? await o.award.catch(() => null) : null;
    if (!r) {
      sum.textContent = o.award ? `+0 ${PD}` : `${o.preview} ${PD}`;
      box.classList.add('none');
      note.hidden = false;
      note.textContent = o.award ? tx('Doświadczenia nie udało się zapisać — brak połączenia z bazą. Spróbuj przy następnym meczu.', 'Experience could not be saved — no connection to the server. It will work next match.') : (o.reason ?? '');
      if (!o.award && o.preview > 0) sum.textContent = tx(`ok. ${o.preview} PD — nie liczone`, `about ${o.preview} XP — not counted`);
      if (o.action) { const b = h('button', 'menu-btn xpr-act', o.action.label) as HTMLButtonElement; b.type = 'button'; b.addEventListener('click', o.action.run); note.after(b); }
      return;
    }
    if (r.gained !== o.preview) await countUp(sum, o.preview, r.gained, 400, (n) => `+${n} ${PD}`);
    if (r.gained === 0 || r.gained < o.preview) {
      note.hidden = false;
      note.textContent = r.gained === 0 && o.preview === 0 ? tx('Mecz krótszy niż 3 minuty nie daje doświadczenia.', 'Matches under 3 minutes give no experience.')
        : tx('Część doświadczenia przepadła przez limit (najwyżej 600 PD za mecz i 3000 PD na dobę).', 'Some experience was lost to the cap (600 XP per match, 3000 XP a day).');
    }
    // 4. pasek poziomu od starego stanu do nowego, z awansami po drodze
    const start = Math.max(0, r.xp - r.gained);
    lvl.hidden = false;
    requestAnimationFrame(() => lvl.classList.add('in'));
    paintLevel(start, start);
    await wait(350);
    if (reduced()) { paintLevel(r.xp, start); }
    else {
      const dur = Math.min(2600, 900 + r.gained * 4);
      let shownLevel = levelOf(start).level;
      await new Promise<void>((res) => {
        const t0 = performance.now();
        const step = (now: number): void => {
          const k = Math.min(1, (now - t0) / dur);
          const e = 1 - (1 - k) ** 2.4;
          const xp = Math.round(start + (r.xp - start) * e);
          paintLevel(xp, start);
          const l = levelOf(xp).level;
          if (l > shownLevel) {
            shownLevel = l;
            gem.classList.remove('flash'); void gem.offsetWidth; gem.classList.add('flash');
            o.sound?.('level');
          }
          if (k < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
    }
    const was = levelOf(start).level, now = levelOf(r.xp).level;
    if (now > was) {
      up.hidden = false;
      box.classList.add('levelled');
      const newTitle = titleOf(now) !== titleOf(was);
      up.textContent = newTitle ? tx(`Awans! Poziom ${now} — nowy tytuł: ${titleOf(now)}`, `Level up! Level ${now} — new rank: ${titleOf(now)}`) : tx(`Awans! Poziom ${now}`, `Level up! Level ${now}`);
      if (reduced()) o.sound?.('level');
    }
  })();
}
