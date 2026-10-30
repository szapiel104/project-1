/**
 * Liczby wyskakujące nad miejscem na mapie (Michał 30.10.2026: „+30 z ikonką nad rynkiem, jak przy obrażeniach”).
 * Ten sam wygląd i animacja co „−N” nad trafionym żołnierzem (.hpdmg), ale przypięte do punktu świata, więc przy ruchu
 * kamery zostają nad budynkiem. `update()` co klatkę.
 */
export interface WorldPops {
  add(tx: number, ty: number, html: string, kind: string): void;
  update(): void;
}

export function createWorldPops(project: (x: number, y: number, lift: number) => { sx: number; sy: number; front: boolean }): WorldPops {
  const layer = document.createElement('div');
  layer.className = 'hpbars world-pops';
  document.body.append(layer);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live: { el: HTMLElement; x: number; y: number; dx: number }[] = [];
  return {
    add(tx, ty, html, kind) {
      if (live.length > 20) return;
      const el = document.createElement('span');
      el.className = `hpdmg pop-trade ${kind}`;
      el.innerHTML = html;
      layer.append(el);
      const it = { el, x: tx, y: ty, dx: (live.length % 3) * 18 - 18 };
      live.push(it);
      setTimeout(() => { el.remove(); const i = live.indexOf(it); if (i >= 0) live.splice(i, 1); }, reduced ? 900 : 1600);
    },
    update() {
      for (const it of live) {
        const s = project(it.x, it.y, 2.2);
        it.el.style.visibility = s.front ? '' : 'hidden';
        it.el.style.translate = `${Math.round(s.sx + it.dx - 30)}px ${Math.round(s.sy)}px`;
      }
    },
  };
}
