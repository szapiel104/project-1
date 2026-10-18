import { BUILDINGS, footprint } from '../data/buildings';
import { BANDIT_COLOR, TEAM_COLORS } from '../data/teams';
import { t, tx } from '../i18n';
import { TERRAIN, Terrain } from '../data/terrain';
import { FP, type GameState } from '../sim/state';

/**
 * Minimapa w prawym górnym rogu: cała mapa z góry (teren w barwach podłoża, cieniowany wysokością), budynki
 * i wojsko w barwach drużyn, wozy z surowcami, wilki, znaczniki sojuszników i obrys tego, co widać na ekranie.
 * Klik albo przeciąganie lewym — kamera tam (bez zmiany przybliżenia); prawy przy zaznaczonym wojsku — marsz;
 * Alt + klik — znacznik dla drużyny. N chowa i pokazuje minimapę.
 */
export interface MinimapHost {
  centerOn(x: number, y: number): void;
  /** Prawy klik: rozkaz marszu dla zaznaczonego wojska (false = nikt nie jest zaznaczony) */
  order(x: number, y: number): boolean;
  /** Alt + klik: menu znaczników w tym miejscu (pozycja kursora na ekranie i pole mapy) */
  ping(cx: number, cy: number, x: number, y: number): void;
  viewQuad(): { x: number; y: number }[];
  pings(): { x: number; y: number; color: number; age: number }[];
}

const SIZE = 210;
const rgb = (n: number): [number, number, number] => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const css = (n: number, k = 1): string => { const [r, g, b] = rgb(n); return `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`; };
const WOLF = '#2a2622';

export function createMinimap(host: MinimapHost): { update(g: GameState, me: number, now: number): void; toggle(): void; mount(el: HTMLElement): void; hide(): void; readonly shown: boolean } {
  const box = document.createElement('div');
  box.className = 'minimap';
  box.hidden = true;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', tx('Minimapa — kliknij, żeby przenieść tam kamerę', 'Minimap — click to move the camera there'));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = canvas.height = Math.round(SIZE * dpr);
  canvas.style.width = canvas.style.height = `${SIZE}px`;
  // pasek nad mapą: nazwa, miejsce na przycisk „Sojusznicy” i chowanie
  const bar = document.createElement('div');
  bar.className = 'minimap-bar';
  const title = document.createElement('span');
  title.className = 'minimap-title';
  title.textContent = t('hud.map');
  const slot = document.createElement('span');
  slot.className = 'minimap-slot';
  const hide = document.createElement('button');
  hide.type = 'button';
  hide.className = 'minimap-hide';
  hide.textContent = '–';
  hide.title = tx('Schowaj minimapę (N)', 'Hide minimap (N)');
  hide.setAttribute('aria-label', hide.title);
  bar.append(title, slot, hide);
  // schowana minimapa: mały pasek z przyciskiem „Mapa” (i przyciskiem z paska, żeby nie zniknął razem z mapą)
  const show = document.createElement('div');
  show.className = 'minimap-show';
  show.hidden = true;
  const showBtn = document.createElement('button');
  showBtn.type = 'button';
  showBtn.className = 'minimap-showbtn';
  showBtn.textContent = t('hud.map');
  showBtn.title = tx('Pokaż minimapę (N)', 'Show minimap (N)');
  const slot2 = document.createElement('span');
  slot2.className = 'minimap-slot';
  show.append(slot2, showBtn);
  box.append(bar, canvas);
  document.body.append(box, show);
  /** Prawy dolny róg tuż nad dolną belką (jej wysokość zależy od skali interfejsu i otwartej listy budynków) */
  const place = (): void => {
    let top = innerHeight;
    const dock = document.querySelector('.bottom .dock');
    if (dock) top = Math.min(top, dock.getBoundingClientRect().top);
    const bb = document.querySelector('.bottom .buildbar') as HTMLElement | null;
    if (bb && bb.offsetParent) { const r = bb.getBoundingClientRect(); if (r.height > 0 && r.right > innerWidth - SIZE - 40) top = Math.min(top, r.top); }
    const bottom = Math.max(8, innerHeight - top + 8);
    box.style.bottom = show.style.bottom = `${bottom}px`;
    document.documentElement.style.setProperty('--mini-bottom', `${bottom}px`);
    document.documentElement.style.setProperty('--mini-left', `${(box.hidden ? show : box).offsetWidth + 22}px`);
    document.documentElement.style.setProperty('--mini-top', `${innerHeight - bottom - (box.hidden ? show.offsetHeight : box.offsetHeight)}px`);
  };
  const ctx = canvas.getContext('2d')!;

  let on = true;
  try { on = localStorage.getItem('minimap') !== '0'; } catch { /* bez pamięci przeglądarki */ }
  const setOn = (v: boolean): void => { on = v; try { localStorage.setItem('minimap', v ? '1' : '0'); } catch { /* jw. */ } };
  hide.addEventListener('click', () => setOn(false));
  showBtn.addEventListener('click', () => setOn(true));

  // teren: obrazek w rozdzielczości mapy, przerysowywany rzadko (wycięty las zmienia się na łąkę)
  const terrain = document.createElement('canvas');
  const tctx = terrain.getContext('2d')!;
  let terrainKey = '';
  let terrainAt = 0;
  const paintTerrain = (g: GameState): void => {
    const { width: w, height: h, tiles, elevation, trails } = g.map;
    if (terrain.width !== w || terrain.height !== h) { terrain.width = w; terrain.height = h; }
    const img = tctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < w * h; i++) {
      const t = tiles[i] as Terrain;
      let [r, gg, b] = rgb(TERRAIN[t]?.color ?? 0x6f8f3c);
      // wysokość: wyżej jaśniej, niżej ciemniej; las ciemniejszy niż łąka, ścieżki brązowe
      const k = t === Terrain.Water ? 1 : 0.78 + (elevation[i]! / 255) * 0.42;
      if (trails[i] && t !== Terrain.Water) { r = 120; gg = 100; b = 70; }
      if (t === Terrain.Forest) { r *= 0.72; gg *= 0.8; b *= 0.7; }
      if (g.roads[i]) { r = 150; gg = 135; b = 110; }
      d[i * 4] = Math.min(255, r * k); d[i * 4 + 1] = Math.min(255, gg * k); d[i * 4 + 2] = Math.min(255, b * k); d[i * 4 + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
  };

  let drag = false;
  let state: GameState | null = null;
  const tileAt = (e: PointerEvent): { x: number; y: number } | null => {
    if (!state) return null;
    const r = canvas.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (fx < 0 || fy < 0 || fx > 1 || fy > 1) return null;
    return { x: fx * state.map.width, y: fy * state.map.height };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const t = tileAt(e);
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.button === 0 && e.altKey) { host.ping(e.clientX, e.clientY, Math.floor(t.x), Math.floor(t.y)); return; }
    if (e.button === 2) { host.order(Math.floor(t.x), Math.floor(t.y)); return; }
    if (e.button !== 0) return;
    drag = true;
    canvas.setPointerCapture(e.pointerId);
    host.centerOn(t.x, t.y);
  });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const t = tileAt(e); if (t) host.centerOn(t.x, t.y); });
  const stop = (): void => { drag = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

  let last = 0;
  return {
    update(g, me, now) {
      const visible = on && !document.body.classList.contains('menu-open') && !document.body.classList.contains('walking');
      box.hidden = !visible;
      show.hidden = on || document.body.classList.contains('menu-open') || document.body.classList.contains('walking');
      // obcy przycisk (Sojusznicy) jedzie tam, gdzie widać pasek
      const holder = visible ? slot : slot2;
      for (const el of [...slot.children, ...slot2.children]) if (el.parentElement !== holder) holder.append(el);
      place();
      if (!visible || now - last < 150) return;
      last = now;
      state = g;
      const { width: w, height: h } = g.map;
      const key = `${g.map.seed}|${w}|${g.cut.length}`;
      if (key !== terrainKey || now - terrainAt > 5000) { terrainKey = key; terrainAt = now; paintTerrain(g); }
      const S = canvas.width, sx = S / w, sy = S / h;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(terrain, 0, 0, S, S);
      // budynki: prostokąt w barwie drużyny (moje jaśniej), zamki z ramką
      for (const b of g.buildings) {
        const def = BUILDINGS[b.type];
        if (!def) continue;
        const fp = footprint(def, b.rot);
        const team = g.players[b.owner]?.team ?? 0;
        const col = g.players[b.owner] ? TEAM_COLORS[team] ?? 0x888888 : BANDIT_COLOR;
        // obóz zbójów: znak w puszczy — ciemne koło z jasną obwódką i krzyżem (dwa skrzyżowane ostrza), widoczne z daleka
        if (!g.players[b.owner]) {
          const cx = (b.x + fp.w / 2) * sx, cy = (b.y + fp.h / 2) * sy, r = Math.max(4.5 * dpr, fp.w * sx * 0.9);
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = '#2a1608'; ctx.fill();
          ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = '#e8d9b4'; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy - r * 0.5); ctx.lineTo(cx + r * 0.5, cy + r * 0.5); ctx.moveTo(cx + r * 0.5, cy - r * 0.5); ctx.lineTo(cx - r * 0.5, cy + r * 0.5);
          ctx.strokeStyle = '#e0655a'; ctx.lineWidth = 1.3 * dpr; ctx.stroke();
          continue;
        }
        ctx.fillStyle = b.build ? css(col, 0.6) : css(col, b.owner === me ? 1.25 : 0.95);
        ctx.fillRect(b.x * sx, b.y * sy, Math.max(1.5, fp.w * sx), Math.max(1.5, fp.h * sy));
        if (def.id === 'keep') {
          ctx.strokeStyle = b.owner === me ? '#f3e6c6' : '#1a0f06';
          ctx.lineWidth = 1.5 * dpr;
          ctx.strokeRect(b.x * sx, b.y * sy, fp.w * sx, fp.h * sy);
        }
      }
      // wilki
      ctx.fillStyle = WOLF;
      for (const wf of g.wolves) ctx.fillRect((wf.px / FP) * sx - dpr, (wf.py / FP) * sy - dpr, 2 * dpr, 2 * dpr);
      // wojsko: kropki w barwach drużyn z ciemną obwódką (widać je na każdym tle)
      for (const s of g.soldiers) {
        const team = g.players[s.owner]?.team ?? 0;
        const x = (s.px / FP) * sx, y = (s.py / FP) * sy, r = 1.6 * dpr;
        ctx.fillStyle = '#0d0804';
        ctx.fillRect(x - r - dpr * 0.6, y - r - dpr * 0.6, 2 * r + dpr * 1.2, 2 * r + dpr * 1.2);
        ctx.fillStyle = css(g.players[s.owner] ? TEAM_COLORS[team] ?? 0x888888 : BANDIT_COLOR, s.owner === me ? 1.35 : 1.05);
        ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      // wozy z surowcami
      for (const c of g.caravans ?? []) {
        const x = (c.px / FP) * sx, y = (c.py / FP) * sy, r = 2.4 * dpr;
        ctx.fillStyle = '#f3e6c6';
        ctx.strokeStyle = '#1a0f06';
        ctx.lineWidth = dpr;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // znaczniki sojuszników: pulsujące kręgi
      for (const p of host.pings()) {
        const x = p.x * sx, y = p.y * sy, k = (p.age * 1.4) % 1;
        ctx.strokeStyle = css(p.color);
        ctx.lineWidth = 2 * dpr;
        ctx.globalAlpha = 1 - k;
        ctx.beginPath(); ctx.arc(x, y, (4 + k * 10) * dpr, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = css(p.color);
        ctx.beginPath(); ctx.arc(x, y, 2.5 * dpr, 0, Math.PI * 2); ctx.fill();
      }
      // co widać na ekranie
      const q = host.viewQuad();
      if (q.length === 4) {
        ctx.strokeStyle = 'rgba(255, 246, 214, .9)';
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        q.forEach((p, i) => { const x = Math.max(-20, Math.min(S + 20, p.x * sx)), y = Math.max(-20, Math.min(S + 20, p.y * sy)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.closePath();
        ctx.stroke();
      }
    },
    toggle() { setOn(!on); },
    /** Miejsce w pasku minimapy na obcy przycisk (np. „Sojusznicy”) */
    mount(el: HTMLElement) { slot.append(el); },
    hide() { box.hidden = true; show.hidden = true; },
    get shown() { return on; },
  };
}
