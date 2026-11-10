/**
 * Pasek menu jak w programach graficznych (Plik, Edycja, Widok…) z rozwijanymi listami (Michał 10.11.2026).
 * Każda pozycja może mieć skrót (tylko napis), zaznaczenie (✓) i stan wyłączenia; listy obsługują klawiaturę
 * (strzałki, Enter, Esc) i zamykają się po kliknięciu obok. Po otwarciu jednej listy najechanie na sąsiednie menu je przełącza.
 */
export interface MenuItem {
  label?: string;
  key?: string;
  act?: () => void;
  checked?: () => boolean;
  enabled?: () => boolean;
  sep?: boolean;
  /** podmenu (np. lista brył) */
  sub?: () => MenuItem[];
}
export interface Menu { label: string; items: () => MenuItem[] }

export function createMenuBar(host: HTMLElement, menus: Menu[]): { close: () => void } {
  let open: { btn: HTMLButtonElement; list: HTMLElement } | null = null;
  const close = (): void => {
    if (!open) return;
    open.btn.setAttribute('aria-expanded', 'false');
    open.list.remove();
    open = null;
  };
  const build = (items: MenuItem[], parent: HTMLElement, level: number): HTMLElement => {
    const list = document.createElement('div');
    list.className = 'menu-list';
    list.setAttribute('role', 'menu');
    if (level > 0) list.classList.add('menu-sub');
    for (const it of items) {
      if (it.sep) { const s = document.createElement('div'); s.className = 'menu-sep'; s.setAttribute('role', 'separator'); list.append(s); continue; }
      const b = document.createElement('button');
      b.type = 'button';
      const ck = it.checked?.();
      b.setAttribute('role', ck === undefined ? 'menuitem' : 'menuitemcheckbox');
      if (ck !== undefined) b.setAttribute('aria-checked', String(ck));
      const off = it.enabled ? !it.enabled() : false;
      b.disabled = off;
      const mark = document.createElement('span'); mark.className = 'menu-check'; mark.textContent = ck ? '✓' : '';
      const lab = document.createElement('span'); lab.className = 'menu-label'; lab.textContent = it.label ?? '';
      const key = document.createElement('span'); key.className = 'menu-key'; key.textContent = it.sub ? '▸' : it.key ?? '';
      b.append(mark, lab, key);
      if (it.sub) {
        b.setAttribute('aria-haspopup', 'menu');
        let subEl: HTMLElement | null = null;
        const openSub = (): void => {
          for (const o of list.querySelectorAll(':scope > .menu-sub')) o.remove();
          subEl = build(it.sub!(), b, level + 1);
          const wrap = b.parentElement as HTMLElement;
          const r = b.getBoundingClientRect(), pr = wrap.getBoundingClientRect();
          subEl.style.top = `${r.top - pr.top}px`;
          wrap.append(subEl);
        };
        b.addEventListener('mouseenter', openSub);
        b.addEventListener('click', openSub);
        list.classList.add('menu-sub-wrap');
        void subEl;
      } else {
        b.addEventListener('mouseenter', () => { for (const o of list.querySelectorAll(':scope > .menu-sub')) o.remove(); });
        b.addEventListener('click', () => { close(); it.act?.(); });
      }
      list.append(b);
    }
    list.addEventListener('keydown', (e) => {
      const btns = [...list.querySelectorAll<HTMLButtonElement>(':scope > button:not(:disabled)')];
      const k = btns.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); btns[(k + 1) % btns.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(k - 1 + btns.length) % btns.length]?.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); const b = open?.btn; close(); b?.focus(); }
      e.stopPropagation();
    });
    void parent;
    return list;
  };
  const show = (btn: HTMLButtonElement, m: Menu): void => {
    close();
    const list = build(m.items(), btn, 0);
    list.classList.add('menu-sub-wrap');
    const r = btn.getBoundingClientRect();
    list.style.left = `${r.left}px`;
    list.style.top = `${r.bottom}px`;
    document.body.append(list);
    btn.setAttribute('aria-expanded', 'true');
    open = { btn, list };
  };
  for (const m of menus) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'menu-top';
    b.textContent = m.label;
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => { if (open?.btn === b) close(); else show(b, m); });
    b.addEventListener('mouseenter', () => { if (open && open.btn !== b) show(b, m); });
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); show(b, m); open?.list.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }
    });
    host.append(b);
  }
  document.addEventListener('pointerdown', (e) => {
    if (open && !open.list.contains(e.target as Node) && e.target !== open.btn) close();
  }, true);
  return { close };
}
