/**
 * Znaczniki dla sojuszników (gra drużynowa): Alt + klik w mapę otwiera trzy sygnały — „Atakuj tutaj”, „Pomocy!”,
 * „Zbiórka”. Znacznik widać w świecie (pulsujący krąg i słup światła), a gdy jest poza kadrem — strzałkę przy
 * krawędzi ekranu; kliknięcie strzałki przenosi tam kamerę. Spacja skacze do ostatniego znacznika.
 * Same znaczniki nie wchodzą do symulacji (idą kanałem pokoju jak czat), więc nie psują zgodności gry przez sieć.
 */
export const PINGS = [
  { label: 'Atakuj tutaj', short: 'Atak', icon: '⚔', color: 0xe0503c },
  { label: 'Pomocy!', short: 'Pomocy', icon: '!', color: 0xf0b83c },
  { label: 'Zbiórka', short: 'Zbiórka', icon: '⚑', color: 0x4c9ae6 },
] as const;

export interface PingHost {
  /** Pole pod kursorem (null poza mapą) */
  tileAt(): { x: number; y: number } | null;
  /** Gracz wybrał sygnał */
  pick(kind: number, x: number, y: number): void;
  screenOf(x: number, y: number): { x: number; y: number; on: boolean; behind: boolean };
  lookAt(x: number, y: number): void;
}

interface Live { kind: number; x: number; y: number; at: number; who: string; el: HTMLButtonElement }

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export function createPings(host: PingHost): { openMenu(cx: number, cy: number, tile?: { x: number; y: number }): boolean; active(): { x: number; y: number; color: number; age: number }[]; show(kind: number, x: number, y: number, who: string): void; update(now: number): void; jumpLast(): boolean; clear(): void } {
  const menu = document.createElement('div');
  menu.className = 'ping-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Sygnał dla sojuszników');
  document.body.append(menu);
  let at: { x: number; y: number } | null = null;
  const close = (): void => { menu.hidden = true; at = null; };
  PINGS.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ping-opt';
    b.setAttribute('role', 'menuitem');
    b.style.setProperty('--ping', hex(p.color));
    b.innerHTML = `<span class="ping-ico" aria-hidden="true"></span><span></span><kbd></kbd>`;
    (b.children[0] as HTMLElement).textContent = p.icon;
    (b.children[1] as HTMLElement).textContent = p.label;
    (b.children[2] as HTMLElement).textContent = String(i + 1);
    b.addEventListener('click', () => { if (at) host.pick(i, at.x, at.y); close(); });
    menu.append(b);
  });
  window.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target as Node)) close(); }, true);
  window.addEventListener('keydown', (e) => {
    if (menu.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= PINGS.length && at) { e.preventDefault(); e.stopImmediatePropagation(); host.pick(n - 1, at.x, at.y); close(); }
  }, true);

  const live: Live[] = [];
  const layer = document.createElement('div');
  layer.className = 'ping-layer';
  document.body.append(layer);

  return {
    openMenu(cx, cy, tile) {
      const t = tile ?? host.tileAt();
      if (!t) return false;
      at = { x: t.x + 0.5, y: t.y + 0.5 };
      menu.hidden = false;
      const w = menu.offsetWidth || 170, h = menu.offsetHeight || 120;
      menu.style.left = `${Math.min(innerWidth - w - 8, Math.max(8, cx + 10))}px`;
      menu.style.top = `${Math.min(innerHeight - h - 8, Math.max(8, cy - h / 2))}px`;
      (menu.firstElementChild as HTMLButtonElement | null)?.focus();
      return true;
    },
    show(kind, x, y, who) {
      const p = PINGS[kind];
      if (!p) return;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'ping-edge';
      el.style.setProperty('--ping', hex(p.color));
      el.title = `${who}: ${p.label} — kliknij, żeby tam spojrzeć`;
      el.setAttribute('aria-label', el.title);
      el.innerHTML = '<span class="ping-arrow" aria-hidden="true"></span><span class="ping-ico" aria-hidden="true"></span>';
      (el.children[1] as HTMLElement).textContent = p.icon;
      el.addEventListener('click', () => host.lookAt(x, y));
      layer.append(el);
      live.push({ kind, x, y, at: performance.now(), who, el });
      while (live.length > 6) live.shift()!.el.remove();
    },
    update(now) {
      for (let i = live.length - 1; i >= 0; i--) {
        const l = live[i]!;
        if (now - l.at > 10_000) { l.el.remove(); live.splice(i, 1); continue; }
        const s = host.screenOf(l.x, l.y);
        // w kadrze: sam słup światła w świecie wystarcza, strzałka znika
        if (s.on) { l.el.hidden = true; continue; }
        l.el.hidden = false;
        const cx = innerWidth / 2, cy = innerHeight / 2;
        let dx = s.x - cx, dy = s.y - cy;
        if (s.behind) { dx = -dx; dy = -dy; }
        const m = 34;
        const k = Math.min((cx - m) / Math.max(1e-3, Math.abs(dx)), (cy - m - 60) / Math.max(1e-3, Math.abs(dy)));
        l.el.style.left = `${cx + dx * k}px`;
        l.el.style.top = `${cy + dy * k}px`;
        l.el.style.setProperty('--ang', `${Math.atan2(dy, dx)}rad`);
      }
    },
    active() { const now = performance.now(); return live.map((l) => ({ x: l.x, y: l.y, color: PINGS[l.kind]!.color, age: (now - l.at) / 1000 })); },
    jumpLast() {
      const l = live[live.length - 1];
      if (!l) return false;
      host.lookAt(l.x, l.y);
      return true;
    },
    clear() { for (const l of live) l.el.remove(); live.length = 0; close(); },
  };
}
