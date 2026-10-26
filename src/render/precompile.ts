import * as THREE from 'three';

/**
 * Nowe obiekty w trakcie gry (pierwsza wieża, brama, plac budowy, podgląd stawiania) potrzebują czasem shaderów,
 * których jeszcze nie ma. Bez tej warstwy karta kompilowała je w chwili pierwszego rysowania i gra stawała na
 * 0,1–1 s przy każdym takim shaderze.
 *
 * Tu: każdy obiekt dodany do sceny po rozgrzewce trafia na listę. Przed klatką jego shadery są zlecane karcie
 * (`renderer.compile` przy równoległej kompilacji nie blokuje), a sam obiekt nie jest rysowany, dopóki nie są gotowe —
 * zwykle kilka klatek. Obiekty z gotowymi shaderami schodzą z listy od razu.
 *
 * Koszt pilnujemy: materiały obiektu zbieramy raz, kompilacja najwyżej kilku obiektów na klatkę, a po pełnej
 * rozgrzewce (nowa mapa) lista jest czyszczona — wszystko w scenie jest wtedy już skompilowane.
 */

/** Najdłużej tyle czekamy na shadery (wolna karta): potem obiekt i tak się pokazuje */
const MAX_WAIT_MS = 1500;
/** Tyle obiektów na klatkę może zlecić kompilację (compile przegląda światła całej sceny) */
const COMPILES_PER_FRAME = 4;

let sink: ((o: THREE.Object3D) => void) | null = null;
let patched = false;

/** Raz: każde `add` w całym three.js zgłasza dodawane obiekty, gdy ktoś słucha */
function patchAdd(): void {
  if (patched) return;
  patched = true;
  const add = THREE.Object3D.prototype.add;
  THREE.Object3D.prototype.add = function (this: THREE.Object3D, ...objects: THREE.Object3D[]) {
    const r = add.apply(this, objects);
    if (sink) for (const o of objects) sink(o);
    return r;
  } as typeof add;
}

interface Entry { since: number; mats: THREE.Material[] | null; compiled: boolean }

export class Precompiler {
  private pending = new Map<THREE.Object3D, Entry>();
  private on = false;
  /** Obiekty już sprawdzone (przeniesione do innej grupy nie wracają na listę) */
  private done = new WeakSet<THREE.Object3D>();

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene) {
    patchAdd();
  }

  /** Po pełnej rozgrzewce: wszystko w scenie skompilowane, lista od zera; od teraz pilnujemy nowych obiektów */
  start(): void {
    this.pending.clear();
    this.on = true;
    sink = (o) => { if (this.on && !this.done.has(o) && !this.pending.has(o)) this.pending.set(o, { since: performance.now(), mats: null, compiled: false }); };
  }

  /** Obiekt, któremu zmieniły się materiały (np. łatka pór roku): znowu pilnujemy jego shaderów */
  watch(o: THREE.Object3D): void {
    if (!this.on) return;
    this.done.delete(o);
    this.pending.set(o, { since: performance.now(), mats: null, compiled: false });
  }

  /** Są nowe obiekty jeszcze nie sprawdzone (przed nimi warto dołożyć łatki materiałów, żeby kompilować raz) */
  hasFresh(): boolean {
    for (const e of this.pending.values()) if (!e.mats) return true;
    return false;
  }

  /** Ile obiektów czeka (do okna wydajności) */
  get size(): number { return this.pending.size; }

  private inScene(o: THREE.Object3D): boolean {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === this.scene) return true;
    return false;
  }

  /** `strict`: materiał bez programu albo zmieniony od ostatniego rysowania też liczy się jako niegotowy */
  private ready(mats: THREE.Material[], strict: boolean): boolean {
    for (const m of mats) {
      const p = this.renderer.properties.get(m) as { currentProgram?: { isReady(): boolean }; __version?: number };
      const prog = p.currentProgram;
      if (!prog) { if (strict) return false; continue; }
      if (strict && p.__version !== m.version) return false;
      if (!prog.isReady()) return false;
    }
    return true;
  }

  /**
   * Przed rysowaniem: zleca shadery nowych obiektów i chowa te, których shadery jeszcze się kompilują.
   * Zwraca funkcję przywracającą widoczność (po narysowaniu klatki).
   */
  beforeRender(camera: THREE.Camera): () => void {
    if (!this.pending.size) return noop;
    const hidden: THREE.Object3D[] = [];
    const now = performance.now();
    let compiles = 0;
    for (const [o, e] of this.pending) {
      // obiekt składany dopiero w grupie, która trafi do sceny później (jej dodanie i tak się zgłosi), albo już usunięty
      if (!this.inScene(o)) { this.pending.delete(o); continue; }
      // zgłoszony też przodek: wystarczy pilnować przodka
      let covered = false;
      for (let p = o.parent; p && !covered; p = p.parent) if (this.pending.has(p)) covered = true;
      if (covered) { this.pending.delete(o); continue; }
      e.mats ??= materialsOf(o);
      if (this.ready(e.mats, !e.compiled) || now - e.since > MAX_WAIT_MS) { this.pending.delete(o); this.done.add(o); continue; }
      if (!e.compiled && compiles < COMPILES_PER_FRAME) {
        compiles++;
        e.compiled = true;
        e.mats = [...(this.renderer.compile(o, camera, this.scene) as Set<THREE.Material>)];
        if (this.ready(e.mats, false)) { this.pending.delete(o); this.done.add(o); continue; }
      }
      if (o.visible) { o.visible = false; hidden.push(o); }
    }
    return hidden.length ? () => { for (const o of hidden) o.visible = true; } : noop;
  }
}

const noop = (): void => undefined;

function materialsOf(root: THREE.Object3D): THREE.Material[] {
  const out = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    if (Array.isArray(m)) for (const x of m) out.add(x); else out.add(m);
  });
  return [...out];
}
