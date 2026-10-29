/**
 * Ruch ludzi tylko w wyglądzie (symulacja się nie zmienia, więc gra przez sieć zostaje zgodna):
 * - figura idzie za pozycją z symulacji z lekkim opóźnieniem, więc zakręty na rogach pól są łukami, a nie załamaniami;
 * - patrzy tam, dokąd naprawdę idzie (kierunek ruchu figury), i obraca się płynnie;
 * - mijając kogoś, odbija lekko w bok (każdy w prawo), zamiast przez niego przenikać;
 * - stojąc, nie zamiera: przestępuje, rozgląda się, drapie się, przeciąga, przenosi ciężar z nogi na nogę.
 * Wszystko w polach mapy (x, y z symulacji); wynik w tych samych jednostkach.
 */

interface Vis {
  /** Położenie wygładzone (bez odbicia w bok) */
  x: number; y: number;
  /** Położenie pokazane (z odbiciem w bok) */
  sx: number; sy: number;
  heading: number;
  /** Odbicie w bok w polach (+ = w prawo od kierunku marszu) */
  side: number;
  /** Odsunięcie od sąsiadów stojących albo idących w tym samym miejscu (pola) — żeby nikt nie wchodził w drugiego */
  ox: number; oy: number;
  speed: number;
  frame: number;
  solid: boolean;
  id: number;
  /** Najbliższy inny przechodzień w odległości do 0,7 pola (do pozdrowienia w przejściu), 0 = nikt */
  near: number;
}

const CELL = 0.5;
/** Odległość, przy której mijający się zaczynają się omijać (w polach) */
const NEAR = 0.32;
const MAX_SIDE = 0.2;
/** Bliżej niż tyle (pola) dwie postacie się rozsuwają (Michał 29.10.2026: „10 chłopów jak idzie, to są w sobie”) */
const SEP = 0.2;
/** Najdalej tyle odsunięcia od miejsca z symulacji */
const MAX_PUSH = 0.22;

export class Crowd {
  private vis = new Map<number, Vis>();
  private grid = new Map<number, Vis[]>();
  private frame = 0;
  private dt = 1 / 60;

  /** Początek klatki: siatka sąsiedztwa z położeń z poprzedniej klatki */
  begin(dt: number): void {
    this.dt = Math.min(0.1, Math.max(0.001, dt));
    this.frame++;
    this.grid.clear();
    for (const [id, v] of this.vis) {
      if (this.frame - v.frame > 30) { this.vis.delete(id); continue; }
      if (this.frame - v.frame > 2) continue;
      const k = Math.floor(v.sx / CELL) * 4096 + Math.floor(v.sy / CELL);
      let l = this.grid.get(k); if (!l) { l = []; this.grid.set(k, l); } l.push(v);
    }
  }

  /**
   * Figura `id` ma być w (tx, ty). Zwraca, gdzie ją narysować, dokąd patrzy i jak szybko idzie (pola/s).
   * `solid` = inni ją omijają (stojący też są przeszkodą); `still` = nie odbija w bok.
   */
  /** Postać od razu w (x, y) (np. wychodzi z klatki schodowej wieży); dalej `move` prowadzi ją płynnie do celu */
  place(id: number, x: number, y: number, heading: number): void {
    this.vis.set(id, { x, y, sx: x, sy: y, heading, side: 0, ox: 0, oy: 0, speed: 0, frame: this.frame, solid: true, id, near: 0 });
  }

  move(id: number, tx: number, ty: number, heading: number, calm: boolean, solid = true): Vis {
    let v = this.vis.get(id);
    if (!v || calm || Math.abs(v.x - tx) > 1.5 || Math.abs(v.y - ty) > 1.5) {
      // pierwszy raz, skok (np. wyjście z chaty) albo wyłączone animacje: od razu na miejscu
      v = { x: tx, y: ty, sx: tx, sy: ty, heading, side: 0, ox: v?.ox ?? 0, oy: v?.oy ?? 0, speed: 0, frame: this.frame, solid, id, near: 0 };
      v.sx += v.ox; v.sy += v.oy;
      this.vis.set(id, v);
      return v;
    }
    const k = 1 - Math.exp(-this.dt * 9);
    const nx = v.x + (tx - v.x) * k, ny = v.y + (ty - v.y) * k;
    const vx = (nx - v.x) / this.dt, vy = (ny - v.y) / this.dt;
    const sp = Math.hypot(vx, vy);
    v.speed += (sp - v.speed) * (1 - Math.exp(-this.dt * 10));
    v.x = nx; v.y = ny;
    // kierunek z ruchu figury (łuk na zakręcie), obrót płynny
    if (sp > 0.25) {
      const want = Math.atan2(vx, vy);
      let d = want - v.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      v.heading += d * (1 - Math.exp(-this.dt * 11));
    } else v.heading = heading;
    // omijanie: kto idzie, odbija w bok od tego, kto jest przed nim (każdy w swoją prawą stronę)
    let want = 0, best = 0.7;
    v.near = 0;
    if (v.speed > 0.3) {
      const fx = Math.sin(v.heading), fy = Math.cos(v.heading);
      const cx = Math.floor(v.sx / CELL), cy = Math.floor(v.sy / CELL);
      for (let gx = cx - 1; gx <= cx + 1; gx++)
        for (let gy = cy - 1; gy <= cy + 1; gy++)
          for (const o of this.grid.get(gx * 4096 + gy) ?? []) {
            if (o === v || !o.solid) continue;
            const dx = o.sx - v.sx, dy = o.sy - v.sy, d = Math.hypot(dx, dy);
            if (d < best && d > 1e-4) { best = d; v.near = o.id; }
            if (d >= NEAR || d < 1e-4) continue;
            const ahead = dx * fx + dy * fy;
            if (ahead < -0.1) continue; // ten za plecami nie przeszkadza
            // po której stronie jest tamten: odbijamy na drugą; wprost przed nami — w prawo
            const lateral = dx * fy - dy * fx; // + = tamten po prawej
            const dir = Math.abs(lateral) < 0.04 ? 1 : lateral > 0 ? -1 : 1;
            want += dir * (1 - d / NEAR);
          }
    }
    want = Math.max(-MAX_SIDE, Math.min(MAX_SIDE, want * 0.35));
    v.side += (want - v.side) * (1 - Math.exp(-this.dt * 6));
    const rx = Math.cos(v.heading), ry = -Math.sin(v.heading); // prawa strona
    // rozsuwanie: każdy, kto stoi albo idzie bliżej niż SEP, odpycha (także dwóch w tym samym punkcie, gdy idą
    // jeden za drugim tą samą drogą z symulacji — wtedy kierunek wybiera para numerów, każdy w swoją stronę)
    let px = 0, py = 0;
    if (solid) {
      const cx = Math.floor(v.sx / CELL), cy = Math.floor(v.sy / CELL);
      for (let gx = cx - 1; gx <= cx + 1; gx++)
        for (let gy = cy - 1; gy <= cy + 1; gy++)
          for (const o of this.grid.get(gx * 4096 + gy) ?? []) {
            if (o === v || !o.solid) continue;
            let dx = v.sx - o.sx, dy = v.sy - o.sy;
            const d = Math.hypot(dx, dy);
            if (d >= SEP) continue;
            if (d < 1e-3) {
              const a = rnd(Math.min(v.id, o.id), Math.max(v.id, o.id)) * Math.PI * 2, sg = v.id > o.id ? 1 : -1;
              dx = Math.cos(a) * sg; dy = Math.sin(a) * sg;
            } else { dx /= d; dy /= d; }
            const f = 1 - d / SEP;
            px += dx * f; py += dy * f;
          }
    }
    const k2 = 1 - Math.exp(-this.dt * 4);
    let wx = v.ox + px * 0.06, wy = v.oy + py * 0.06;
    // bez sąsiadów odsunięcie powoli wraca do zera (stoi tam, gdzie w symulacji)
    if (!px && !py) { wx = v.ox * (1 - k2 * 0.5); wy = v.oy * (1 - k2 * 0.5); }
    const L = Math.hypot(wx, wy);
    if (L > MAX_PUSH) { wx *= MAX_PUSH / L; wy *= MAX_PUSH / L; }
    v.ox += (wx - v.ox) * Math.min(1, k2 * 3);
    v.oy += (wy - v.oy) * Math.min(1, k2 * 3);
    v.sx = v.x + rx * v.side + v.ox; v.sy = v.y + ry * v.side + v.oy;
    v.frame = this.frame;
    v.solid = solid;
    return v;
  }
}

/** Liczba pseudolosowa 0..1 z numeru i kroku (stała dla tej samej pary) */
function rnd(id: number, k: number): number {
  let h = (id * 2654435761 + k * 40503 + 0x9e37) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

export interface Idle {
  /** Obrót ciała (rozgląda się) */
  yaw: number;
  /** Przechył na bok (ciężar na jednej nodze, oparcie o włócznię) */
  roll: number;
  /** Prawa ręka: kąt albo brak (zwykła poza) */
  arm?: number;
  /** Lewa ręka */
  armL?: number;
  /** Obie ręce w górę (przeciąganie się) */
  up?: boolean;
  /** Przestępowanie: wymach nóg */
  legs: number;
  /** Oddech: drobne uniesienie */
  dy: number;
}

/**
 * Co robi stojący człowiek. Co kilka sekund wybiera jedną czynność (stałą dla danej osoby i chwili):
 * rozgląda się, drapie się w głowę, przestępuje z nogi na nogę, przeciąga się, ociera czoło albo po prostu stoi.
 * Żołnierz nie drapie się i nie przeciąga: rozgląda się krócej, przestępuje i opiera o włócznię.
 */
export function idle(id: number, time: number, soldier = false): Idle {
  const period = 6 + (id % 5) * 0.9;
  const tt = time + (id % 97) * 1.37;
  const slot = Math.floor(tt / period), ph = tt - slot * period;
  const act = Math.floor(rnd(id, slot) * (soldier ? 4 : 6));
  // ciężar ciała przenosi się powoli z nogi na nogę, oddech
  const out: Idle = { yaw: 0, roll: Math.sin(tt * 0.55) * 0.022, legs: 0, dy: Math.sin(tt * 1.9) * 0.0025 };
  // czynność trwa od 0,8 s do ~3,5 s okresu, z płynnym wejściem i wyjściem
  const env = ph < 0.8 ? 0 : ph < 1.4 ? (ph - 0.8) / 0.6 : ph < 3.0 ? 1 : ph < 3.6 ? 1 - (ph - 3.0) / 0.6 : 0;
  const ease = env * env * (3 - 2 * env);
  if (!ease) return out;
  switch (act) {
    case 1: // rozgląda się: w lewo, potem w prawo
      out.yaw = Math.sin((ph - 0.8) * 1.6) * (soldier ? 0.35 : 0.6) * ease;
      break;
    case 2: // przestępuje z nogi na nogę i trochę się obraca
      out.legs = Math.sin(tt * 8) * 0.18 * ease;
      out.yaw = (rnd(id, slot + 7) - 0.5) * 0.5 * ease;
      break;
    case 3:
      if (soldier) { out.roll += 0.06 * ease; break; } // oparty o włócznię, ciężar na jedną stronę
      // drapie się w głowę
      out.arm = -2.75 + Math.sin(tt * 15) * 0.12 * ease;
      out.arm = -0.1 + (out.arm + 0.1) * ease;
      break;
    case 4: // przeciąga się
      out.up = ease > 0.5;
      out.roll -= 0.03 * ease;
      break;
    case 5: // ociera czoło
      out.arm = -0.1 + (-2.25 + Math.sin(tt * 3) * 0.1 + 0.1) * ease;
      break;
    default:
      break;
  }
  return out;
}
