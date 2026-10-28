import { cloneMaterial } from './matclone';
/**
 * Place budowy (wyniesione z scene.ts, 24.10.2026). Budynek nie rośnie ani się nie rozciąga — wznosi się warstwa
 * po warstwie: model przycięty poziomą płaszczyzną na wysokości postępu, najpierw wykop, potem fundament, mury i dach.
 * Dookoła rusztowania z pomostem, obok skład przyniesionego materiału, nad placem kurz. Przy odbudowie ruiny
 * gruzowisko maleje w miarę postępu.
 */
import * as THREE from 'three';
import { BUILDINGS, footprint } from '../data/buildings';
import { Phase, type GameState } from '../sim/state';
import { buildWork } from '../sim/systems/placement';
import { rubbleModel, setRubble } from './buildings';
import { cat } from './cat';
import type { TerrainView } from './terrain';
import { pattern } from './textures';
import { touch } from './touch';
import { fallHeight, rubbleFalls } from './rubblefall';
import { PLANK } from './plank';

/** Przycięty materiał placu budowy → materiał, z którego powstał (do puli kopii) */
const siteSrc = new WeakMap<THREE.Material, THREE.Material>();

const tmpColor = new THREE.Color();

export class SiteLayer {
  /** layer: warstwa budynków (tam stoją gruzowiska i rusztowania); dust: kłąb kurzu nad polem mapy */
  /** warm: obiekt z nowymi materiałami — scena zleca ich shadery w tle (precompile.ts), zanim plac się pokaże */
  constructor(private layer: THREE.Group, private dust: (x: number, y: number, stone: boolean, soft?: boolean) => void, private warm: (o: THREE.Object3D) => void = () => undefined) {}

  /**
   * Przycięte kopie materiałów wracają tu po skończonej budowie i służą następnym placom. Dawniej były zwalniane
   * (dispose), a z nimi program shadera — każda kolejna budowa kompilowała go od nowa i gra przycinała przy stawianiu.
   */
  private static clipPool = new Map<THREE.Material, THREE.Material[]>();

  /** Nowa mapa: bez pokazowych budów, gruzowisk; rusztowania liczą się od nowa */
  reset(): void {
    this.fresh = true;
    this.quickBuild.clear();
    for (const p of this.ruinPiles.values()) this.layer.remove(p);
    this.ruinPiles.clear();
    this.siteKey = '-';
  }

  private dustAt = new Map<number, number>();
  /** Gruzowiska na miejscu zniszczonych budynków (do odbudowy) */
  private ruinPiles = new Map<number, THREE.Group>();
  /**
   * Plac budowy: budynek nie rośnie ani się nie rozciąga — wznosi się warstwa po warstwie. Model jest przycięty
   * poziomą płaszczyzną na wysokości postępu (widać mury do połowy, puste wnętrze, potem dach), dookoła stoją
   * rusztowania z pomostem na bieżącej wysokości, obok leży stos desek i kamieni, nad placem kurz.
   * Wydajność: osobne kopie materiałów tylko dla budynków właśnie w budowie (zwykle kilka), rusztowania i stosy
   * to dwie wspólne siatki instancji przeliczane tylko, gdy postęp przeskoczy o 1/20.
   */
  /** Czas, od kiedy trwa pokazowa budowa gotowego od razu budynku (sama grafika, ok. 3 s) */
  readonly quickBuild = new Map<number, number>();
  readonly sites = new Map<number, { plane: THREE.Plane; base: number; top: number; swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][]; clip: (m: THREE.Material) => THREE.Material; pit: THREE.Mesh; dug?: number; rect: [number, number, number, number] }>();
  private static pitMat: THREE.MeshStandardMaterial | undefined;
  /** Części modelu, których na placu budowy nie ma (wnętrze z ludźmi, zapasy, dym, ogień, życie) */
  private static SITE_HIDE = new Set(['interior', 'life', 'fill', 'foodfill', 'armsfill', 'smoke', 'flame', 'flagcloth', 'bannercloth', 'flagpole']);
  private siteKey = '';
  /** Pierwsza klatka po wczytaniu mapy: ruiny z zapisu leżą od razu, bez spadania gruzu */
  private fresh = true;
  /** Bieżąca klatka (ustawiane w sync) */
  private g!: GameState;
  private view: TerrainView | null = null;
  private meshes!: Map<number, THREE.Group>;
  private time = 0;
  private calm = false;
  private scaffold: THREE.InstancedMesh | null = null;
  private siteStones: THREE.InstancedMesh | null = null;
  private beginSite(id: number, mesh: THREE.Object3D): void {
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    const clones = new Map<THREE.Material, THREE.Material>();
    const clip = (m: THREE.Material): THREE.Material => {
      let c = clones.get(m);
      if (!c) {
        const pool = SiteLayer.clipPool.get(m);
        c = pool?.pop();
        // kopia sprzed zmiany oryginału (np. łatka pór roku) nie pasuje: zwalniamy i kopiujemy od nowa
        if (c && c.userData.siteOf !== m.version) { c.dispose(); c = undefined; }
        // źródło trzymamy poza userData (materiał w userData kopiował się z teksturami przez JSON przy każdym clone())
        if (!c) { c = cloneMaterial(m); c.clipShadows = true; c.side = THREE.DoubleSide; siteSrc.set(c, m); c.userData.siteOf = m.version; }
        c.clippingPlanes = [plane];
        clones.set(m, c);
      }
      return c;
    };
    // wykop pod fundament: ciemna, wilgotna ziemia z ciemniejszym dnem i jaśniejszym, rozkopanym brzegiem
    const def = BUILDINGS[this.g.buildings.find((b) => b.id === id)!.type]!;
    const b0 = this.g.buildings.find((b) => b.id === id)!;
    const fp = footprint(def, b0.rot);
    const pitGeo = new THREE.PlaneGeometry(fp.w - 0.1, fp.h - 0.1, 6, 6).rotateX(-Math.PI / 2);
    const pc = new Float32Array(pitGeo.attributes.position!.count * 3);
    for (let i = 0; i < pitGeo.attributes.position!.count; i++) {
      const x = pitGeo.attributes.position!.getX(i) / ((fp.w - 0.1) / 2), z = pitGeo.attributes.position!.getZ(i) / ((fp.h - 0.1) / 2);
      const edge = Math.max(Math.abs(x), Math.abs(z));
      const v = 0.32 + edge * edge * 0.55; // środek ciemny (głęboko), brzegi jaśniejsze
      pc[i * 3] = v; pc[i * 3 + 1] = v * 0.86; pc[i * 3 + 2] = v * 0.7;
    }
    pitGeo.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    const pit = new THREE.Mesh(pitGeo, SiteLayer.pitMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x5a4430, map: pattern('soil'), roughness: 1, polygonOffset: true, polygonOffsetFactor: -3 }));
    pit.position.set(mesh.position.x, mesh.position.y + 0.012, mesh.position.z);
    pit.receiveShadow = true;
    pit.visible = false; // dno wykopu robi teren (dig), a mokra ziemia przyciemnia się w shaderze sama
    const site = { plane, base: mesh.position.y, top: Math.max(box.max.y, mesh.position.y + 0.5), swapped, clip, pit, rect: [b0.x, b0.y, fp.w, fp.h] as [number, number, number, number] };
    this.sites.set(id, site);
    this.clipNew(mesh, site);
    this.warm(mesh);
  }
  /** Przycina części modelu, które jeszcze nie są przycięte (np. zapasy dodane później) */
  private clipNew(mesh: THREE.Object3D, site: { swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][]; clip: (m: THREE.Material) => THREE.Material }): void {
    mesh.traverse((o) => {
      const me = o as THREE.Mesh;
      if (!me.isMesh || !me.material || me.userData.siteClip) return;
      me.userData.siteClip = true;
      site.swapped.push([me, me.material]);
      me.material = Array.isArray(me.material) ? me.material.map(site.clip) : site.clip(me.material);
    });
  }
  private endSite(id: number): void {
    const s = this.sites.get(id);
    if (!s) return;
    const done = new Set<THREE.Material>();
    for (const [me, orig] of s.swapped) {
      for (const m of Array.isArray(me.material) ? me.material : [me.material]) if (!done.has(m)) {
        done.add(m);
        const src = siteSrc.get(m);
        if (!src) { m.dispose(); continue; }
        let pool = SiteLayer.clipPool.get(src);
        if (!pool) SiteLayer.clipPool.set(src, pool = []);
        if (pool.length < 4) pool.push(m); else m.dispose();
      }
      me.material = orig;
      me.userData.siteClip = false;
    }
    this.layer.remove(s.pit);
    s.pit.geometry.dispose();
    if (s.dug) this.view?.dig(s.rect[0], s.rect[1], s.rect[2], s.rect[3], 0);
    const mesh = this.meshes.get(id);
    if (mesh) for (const ch of mesh.children) if (SiteLayer.SITE_HIDE.has(ch.name)) ch.visible = true;
    this.sites.delete(id);
  }
  /** Place budowy w tej klatce: przycięte modele, wykopy, gruzowiska przy odbudowie, rusztowania i składy materiału */
  sync(g: GameState, view: TerrainView | null, meshes: Map<number, THREE.Group>, ctx: { time: number; calm: boolean; lodTick: number }): void {
    this.g = g; this.view = view; this.meshes = meshes; this.time = ctx.time; this.calm = ctx.calm;
    const live = new Set<number>();
    const crew = new Set<number>();
    for (const u of g.units) if (u.phase === Phase.Repairing || u.phase === Phase.ToRepair) crew.add(u.target);
    // kto akurat pracuje przy placu (kurz unosi się tylko wtedy — porzucona ruina czy pusty plac po prostu leżą)
    const working = new Set<number>();
    for (const u of g.units) if (u.phase === Phase.WorkingSite || u.phase === Phase.Repairing) working.add(u.target);
    const scaffolds: { b: GameState['buildings'][number]; k: number; cut: number; site: { base: number; top: number } }[] = [];
    for (const b of g.buildings) {
      const mesh = this.meshes.get(b.id);
      if (!mesh) continue;
      const def = BUILDINGS[b.type]!;
      // ruina po zniszczeniu: kupa gruzu i resztki ścian; dopiero odbudowa podnosi budynek z gruzowiska
      const pile = this.ruinPiles.get(b.id);
      const ruinShown = !!b.ruined && !def.wall && !def.gate;
      if (mesh.scale.y !== 1) mesh.scale.y = 1;
      if (b.build && def.line) {
        // ruina muru czeka na zapłatę albo na ludzi: bez rusztowania, sam gruz (damage.ts)
        if (b.ruined && !crew.has(b.id)) continue;
        // częstokół w budowie: niskie rusztowanie przy odcinku, bale stają jeden po drugim (syncWalls)
        const k = 1 - b.build / buildWork(b.type);
        scaffolds.push({ b, k: Math.max(0.1, k), cut: mesh.position.y + 0.7, site: { base: mesh.position.y, top: mesh.position.y + 0.9 } });
        continue;
      }
      // pokazowa budowa: gotowy w symulacji, ale na ekranie wznosi się przez kilka sekund
      const qb = this.quickBuild.get(b.id);
      let k = b.build ? 1 - b.build / buildWork(b.type) : 1;
      if (qb !== undefined && !b.build) {
        const t = (this.time - qb) / 3;
        if (t >= 1 || this.calm) this.quickBuild.delete(b.id); else k = t;
      }
      if (k >= 1 || def.line) {
        if (pile && !b.build) { this.layer.remove(pile); this.ruinPiles.delete(b.id); }
        if (this.sites.has(b.id)) { this.endSite(b.id); mesh.visible = true; this.dust(b.x, b.y, false); }
        continue;
      }
      live.add(b.id);
      if (!this.sites.has(b.id)) this.beginSite(b.id, mesh);
      const site = this.sites.get(b.id)!;
      if (ctx.lodTick % 30 === 0) this.clipNew(mesh, site);
      if (ruinShown) {
        if (!pile) {
          const fp = footprint(def, b.rot);
          const view = this.view, W = this.g.map.width, H = this.g.map.height;
          const cx = mesh.position.x + W / 2, cz = mesh.position.z + H / 2, y0 = view ? view.heightAt(cx, cz) : mesh.position.y;
          const ground = view ? (x: number, z: number): number => view.heightAt(cx + x, cz + z) - y0 : undefined;
          const p2 = rubbleModel(fp.w, fp.h, b.id, ground);
          p2.position.set(mesh.position.x, y0, mesh.position.z);
          this.layer.add(p2);
          this.ruinPiles.set(b.id, p2);
          // budynek właśnie runął: gruz spada z jego wysokości i każdy kawałek ląduje gdzie indziej
          if (!this.fresh && !this.calm) rubbleFalls.drop(p2, fp.w, fp.h, fallHeight(fp.w, fp.h), ground);
        }
        // gruz leży tak, jak spadł (rubbleModel układa go na ziemi) — bez rozciągania w pionie, które podnosiło
        // kawałki w powietrze; w miarę odbudowy robotnicy zbierają go od góry
        const pl = this.ruinPiles.get(b.id)!;
        pl.visible = k < 0.7;
        setRubble(pl, 1 - k / 0.7);
      } else if (pile) { this.layer.remove(pile); this.ruinPiles.delete(b.id); }
      // najpierw wykop (pierwsze 12% pracy: sama dziura w ziemi), potem fundament, mury i na końcu dach
      const cut = site.base + 0.03 + Math.max(0, (k - 0.12) / 0.88) * (site.top - site.base) * 1.01;
      site.plane.constant = cut;
      mesh.visible = k >= 0.12;
      // wykop: teren działki opada w miarę kopania, fundament go potem zasypuje
      // ruina: bez wykopu (teren pod gruzem zostaje na miejscu, inaczej gruz wisiał nad dołem)
      const want = ruinShown ? 0 : k < 0.12 ? 0.08 + (k / 0.12) * 0.3 : 0;
      if (Math.abs((site.dug ?? 0) - want) > 0.02) {
        site.dug = want;
        const fp2 = footprint(def, b.rot);
        this.view?.dig(b.x, b.y, fp2.w, fp2.h, want);
      }
      for (const ch of mesh.children) if (SiteLayer.SITE_HIDE.has(ch.name)) ch.visible = false;
      scaffolds.push({ b, k, cut, site });
      if (this.calm || (!working.has(b.id) && qb === undefined)) continue;
      const next = this.dustAt.get(b.id) ?? 0;
      if (this.time > next) {
        const fp = footprint(def, b.rot);
        this.dust(b.x + Math.floor(Math.random() * fp.w), b.y + Math.floor(Math.random() * fp.h), false, true);
        this.dustAt.set(b.id, this.time + 1.6 + Math.random() * 1.6);
      }
    }
    for (const id of [...this.sites.keys()]) if (!live.has(id)) this.endSite(id);
    // ruina, która się rozpadła albo została rozebrana, zabiera ze sobą gruzowisko
    for (const [id, p] of this.ruinPiles) if (!this.meshes.has(id) || !g.buildings.some((b) => b.id === id)) { this.layer.remove(p); this.ruinPiles.delete(id); }
    this.syncScaffolds(g, scaffolds);
    this.fresh = false;
  }

  /** Rusztowania, pomosty i stosy materiału przy wszystkich placach budowy (dwie siatki instancji) */
  private syncScaffolds(g: GameState, list: { b: GameState['buildings'][number]; k: number; cut: number; site: { base: number; top: number } }[]): void {
    const key = list.map((s) => `${s.b.id}:${Math.round(s.k * 20)}:${s.b.delivered ?? 0}`).join(',');
    if (key === this.siteKey) return;
    this.siteKey = key;
    if (!this.scaffold) {
      const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.95, map: pattern('planks') });
      this.scaffold = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), wood, 6000);
      this.siteStones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0).translate(0, 0.35, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, map: pattern('rock') }), 600);
      for (const m of [this.scaffold, this.siteStones]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.layer.add(cat(m, 'budowy (rusztowania)')); }
    }
    const { width, height } = g.map;
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    let n = 0, ns = 0;
    const put = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rot = 0): void => {
      if (n >= 6000) return;
      q.setFromAxisAngle(Y, rot);
      this.scaffold!.setMatrixAt(n++, M4.compose(p.set(x, y, z), q, sc.set(sx, sy, sz)));
    };
    for (const { b, k, cut, site } of list) {
      const def = BUILDINGS[b.type]!;
      const fp = footprint(def, b.rot);
      const x0 = b.x - width / 2 - 0.12, z0 = b.y - height / 2 - 0.12, x1 = x0 + fp.w + 0.24, z1 = z0 + fp.h + 0.24;
      const base = site.base;
      // Skład materiału przy placu (przed frontem działki, za rusztowaniem): każdy przyniesiony, a jeszcze niewbudowany
      // ładunek leży osobno — wiązka desek ułożonych na krzyż albo kupka ciosanych kamieni. Przy wykopie hałda ziemi.
      const L = b.loads ?? 0;
      const used = L ? Math.floor(Math.max(0, (k - 0.12) / 0.88) * L) : 0;
      const delivered = L ? (b.delivered ?? 0) : Math.ceil(4 * (1 - k));
      const cost = def.cost as Record<string, number>;
      const kinds = (['wood', 'stone', 'iron'] as const).filter((r) => (cost[r] ?? 0) > 0);
      let wi = 0, si = 0;
      const yardZ = z1 + 0.62, yardX = x0 + 0.35;
      for (let n = used; n < delivered; n++) {
        const kind = kinds.length ? kinds[n % kinds.length]! : 'wood';
        if (kind === 'wood') {
          // wiązka: dwie warstwy po trzy deski budulca (render/plank.ts), warstwy na krzyż
          const bx = yardX + (wi % 3) * 0.62, by = base + Math.floor(wi / 3) * (2 * PLANK.t + 0.01);
          for (let layer = 0; layer < 2; layer++)
            for (let j = 0; j < 3; j++) {
              const off = (j - 1) * (PLANK.w + 0.012);
              if (layer === 0) put(bx, by, yardZ + off, PLANK.l, PLANK.t, PLANK.w, 0);
              else put(bx + off, by + PLANK.t + 0.003, yardZ, PLANK.w, PLANK.t, PLANK.l, 0);
            }
          wi++;
        } else {
          // kupka: trzy ciosane kamienie
          const bx = x1 - 0.35 - (si % 3) * 0.45, bz = yardZ;
          for (let j = 0; j < 3 && ns < 600; j++) {
            q.setFromAxisAngle(Y, j * 1.3 + si);
            this.siteStones!.setColorAt(ns, tmpColor.setHex(0xa39c90));
            this.siteStones!.setMatrixAt(ns++, M4.compose(p.set(bx + (j - 1) * 0.15, base + (j === 2 ? 0.13 : 0) + Math.floor(si / 3) * 0.2, bz + (j === 1 ? 0.08 : -0.04)), q, sc.set(0.26, 0.2, 0.22)));
          }
          si++;
        }
      }
      // hałda ziemi z wykopu: rośnie przy kopaniu, potem ją rozgarniają
      const spoil = k < 0.12 ? 0.4 + k * 5 : Math.max(0, 1 - (k - 0.12) * 3);
      if (spoil > 0.05 && ns < 598) {
        q.setFromAxisAngle(Y, b.id);
        this.siteStones!.setColorAt(ns, tmpColor.setHex(0x4e3a28));
        this.siteStones!.setMatrixAt(ns++, M4.compose(p.set(x1 + 0.45, base - 0.05, z0 + 0.4), q, sc.set(0.9 * spoil, 0.45 * spoil, 0.7 * spoil)));
        this.siteStones!.setColorAt(ns, tmpColor.setHex(0x55402c));
        this.siteStones!.setMatrixAt(ns++, M4.compose(p.set(x1 + 0.4, base - 0.05, z0 + 0.95), q, sc.set(0.6 * spoil, 0.3 * spoil, 0.55 * spoil)));
      }
      if (k < 0.14) continue; // wykop i fundament: jeszcze bez rusztowań
      // słupy co ~0,8 pola po obwodzie, sięgają nieco ponad bieżącą wysokość
      const poleTop = Math.min(site.top + 0.2, cut + 0.45) - base;
      const posts: [number, number][] = [];
      const nx = Math.max(1, Math.round((x1 - x0) / 0.8)), nz = Math.max(1, Math.round((z1 - z0) / 0.8));
      for (let i = 0; i <= nx; i++) { posts.push([x0 + (x1 - x0) * i / nx, z0], [x0 + (x1 - x0) * i / nx, z1]); }
      for (let i = 1; i < nz; i++) { posts.push([x0, z0 + (z1 - z0) * i / nz], [x1, z0 + (z1 - z0) * i / nz]); }
      for (const [px, pz] of posts) put(px, base, pz, 0.045, poleTop, 0.045);
      // poprzeczki co 0,45 i pomost z desek na bieżącej wysokości (tam, gdzie pracują murarze)
      const levels: number[] = [];
      for (let y = 0.45; y < poleTop - 0.05; y += 0.45) levels.push(y);
      const deck = Math.max(0.3, cut - base - 0.1);
      for (const ly of levels) {
        put((x0 + x1) / 2, base + ly, z0, x1 - x0, 0.03, 0.03); put((x0 + x1) / 2, base + ly, z1, x1 - x0, 0.03, 0.03);
        put(x0, base + ly, (z0 + z1) / 2, 0.03, 0.03, z1 - z0); put(x1, base + ly, (z0 + z1) / 2, 0.03, 0.03, z1 - z0);
      }
      put((x0 + x1) / 2, base + deck, z0 - 0.12, x1 - x0 + 0.2, 0.035, 0.26); put((x0 + x1) / 2, base + deck, z1 + 0.12, x1 - x0 + 0.2, 0.035, 0.26);
      put(x0 - 0.12, base + deck, (z0 + z1) / 2, 0.26, 0.035, z1 - z0); put(x1 + 0.12, base + deck, (z0 + z1) / 2, 0.26, 0.035, z1 - z0);
      // ukośne zastrzały na dwóch bokach i drabina
      const diag = Math.hypot(x1 - x0, poleTop);
      put((x0 + x1) / 2, base, z0, 0.03, diag, 0.03); this.scaffold!.setMatrixAt(n - 1, M4.compose(p.set(x0, base, z0 - 0.02), q.setFromAxisAngle(new THREE.Vector3(0, 0, -1), Math.atan2(x1 - x0, poleTop)), sc.set(0.03, diag, 0.03)));
      put(x1 + 0.3, base, (z0 + z1) / 2, 0.05, poleTop + 0.2, 0.05); put(x1 + 0.3, base, (z0 + z1) / 2 + 0.22, 0.05, poleTop + 0.2, 0.05);
      for (let y = 0.15; y < poleTop; y += 0.18) put(x1 + 0.3, base + y, (z0 + z1) / 2 + 0.11, 0.025, 0.025, 0.24);
    }
    this.scaffold.count = n;
    this.siteStones!.count = ns;
    touch(this.scaffold);
    touch(this.siteStones!);
    if (this.siteStones!.instanceColor) touch(this.siteStones!);
  }
}
