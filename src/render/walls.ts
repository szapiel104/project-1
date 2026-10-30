/**
 * Mury (wyniesione z scene.ts, 24.10.2026): częstokół z bali łączących się z sąsiednimi palisadami, bramami i wieżami,
 * mur kamienny z bloków, blank i drabin, mur pod wieżą strażniczą; brama obraca się w linii muru.
 * Bale stają jeden po drugim w czasie budowy. Wszystko w kilku wspólnych siatkach instancji.
 */
import * as THREE from 'three';
import { BUILDINGS, footprint, isStoneTower, isTower } from '../data/buildings';
import type { GameState } from '../sim/state';
import { buildWork, maxHp } from '../sim/systems/placement';
import { ladderSides, towerEntry } from '../sim/systems/stonewalls';
import { STONE_WALL_TOP, TOWER_TOP, palisadeLogs, stoneWallKit, towerDoorKit } from './buildings';
import { cat } from './cat';
import type { TerrainView } from './terrain';
import { normal, pattern } from './textures';
import { touch } from './touch';
import { ruinRebuilt, wearStage } from './wear';

const hash = (seed: number, i: number): number => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };

export class WallLayer {
  constructor(private scene: THREE.Scene) {}
  /** Nowa mapa: mury liczą się od nowa przy najbliższej klatce */
  invalidate(): void { this.key = '-'; }

  private key = '';
  private wallShafts: THREE.InstancedMesh | null = null;
  private wallTips: THREE.InstancedMesh | null = null;
  /** Pola u stóp drabin na mur kamienny → kierunek do muru (wspinaczka w wyglądzie) */
  readonly ladderFeet = new Map<number, [number, number]>();
  private stoneKit: { block: THREE.InstancedMesh; edge: THREE.InstancedMesh; ladder: THREE.InstancedMesh } | null = null;
  /** Mur kamienny dochodzący do kamiennej wieży: przedłużenie korony aż do ściany wieży i ciemne wejście w tej ścianie */
  private doorKit: { bridge: THREE.InstancedMesh; door: THREE.InstancedMesh[]; steps: THREE.InstancedMesh[] } | null = null;
  /**
   * Łączniki muru z wieżą w prawdziwej długości (klucz: długość w setnych, co 5 cm): tekstura w tej samej skali co mur.
   * Wcześniej jeden blok 1×1 rozciągany do długości szczeliny — kamień był rozmazany (Michał 30.10.2026).
   */
  private bridges = new Map<number, { mesh: THREE.InstancedMesh; n: number }>();
  /** Wyrównany poziom terenu pod polami muru kamiennego (pole → wysokość), zob. wallLevel w sync */
  private levels = new Map<number, number>();
  /** O ile korona muru na polu t leży niżej (ujemne) od terenu pod środkiem pola — postacie i ciała na murze */
  levelDelta(view: TerrainView, t: number, width: number): number {
    const lv = this.levels.get(t);
    if (lv === undefined) return 0;
    const tx = t % width, ty = (t - tx) / width;
    return lv - view.heightAt(tx + 0.5, ty + 0.5);
  }
  private bridgeGeo: ((len: number) => THREE.BufferGeometry) | null = null;
  private bridgeMat: THREE.Material | null = null;
  /** Częstokół: bale łączą się z sąsiednimi palisadami, bramami i wieżami; brama obraca się w linii muru */
  sync(g: GameState, view: TerrainView, buildingMeshes: Map<number, THREE.Group>): void {
    const { width, height } = g.map;
    const walls = g.buildings.filter((b) => { const d = BUILDINGS[b.type]!; return d.wall || d.gate; });
    // w kluczu też to, czy model już jest: na nowej mapie mur liczy się czasem przed modelami bram, a brama bez obrotu
    // stała wzdłuż muru (po odświeżeniu kolejność była inna i wszystko wracało)
    // stopień zużycia też w kluczu: rozbity częstokół ma złamane i przekrzywione bale
    // w kluczu także drabiny oblężnicze i wejścia na wieże (wejście przechodzi na inny bok, gdy przed frontem coś stanie)
    const key = walls.map((b) => `${b.id}:${b.build ? Math.ceil((1 - b.build / buildWork(b.type)) * 16) : 99}:${buildingMeshes.has(b.id) ? 1 : 0}:${b.build ? 0 : wearStage(b.hp, maxHp(b.type))}${isTower(BUILDINGS[b.type]!.id) && !b.build ? `:${towerEntry(g, b)[0]}` : ''}`).join(',')
      + '|' + (g.siegeLadders ?? []).map((l) => `${l.id}`).join(',');
    if (key === this.key) return;
    this.key = key;
    const solid = new Map<number, GameState['buildings'][number]>();
    for (const b of walls) { const fp = footprint(BUILDINGS[b.type]!, b.rot); for (let y = b.y; y < b.y + fp.h; y++) for (let x = b.x; x < b.x + fp.w; x++) solid.set(y * width + x, b); }
    const at = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && solid.has(y * width + x);
    // teren pod środkiem każdego pola muru kamiennego (do pochylenia korony między sąsiednimi polami, ramp niżej)
    const ladderWall = (lx: number, ly: number): number => {
      for (const [ox, oy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
        const o = solid.get((ly + oy) * width + lx + ox);
        if (o && BUILDINGS[o.type]!.id === 'stoneWall' && !o.build && !o.ruined && o.x === lx + ox && o.y === ly + oy) return (ly + oy) * width + lx + ox;
      }
      return -1;
    };
    let levels: Map<number, number> | null = null;
    const SH = new THREE.Matrix4();
    this.levels = new Map();
    const wallLevel = (x: number, y: number, cx: number, cz: number): number => {
      if (!levels) {
        levels = new Map();
        const ground = new Map<number, number>();
        for (const [t, o] of solid) if (BUILDINGS[o.type]!.id === 'stoneWall') { const tx = t % width, ty = (t - tx) / width; const h = view.heightAt(tx + 0.5, ty + 0.5); ground.set(t, h); levels.set(t, h); }
      }
      this.levels = levels;
      return levels.get(y * width + x) ?? view.heightAt(cx, cz);
    };
    if (!this.wallShafts) {
      const bark = (new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95, map: pattern('bark'), normalMap: normal('bark') }));
      this.wallShafts = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.1, 1, 7).translate(0, 0.5, 0), bark, 4096);
      this.wallTips = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), bark, 4096);
      for (const m of [this.wallShafts, this.wallTips]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.scene.add(cat(m, 'palisada')); }
    }
    const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    let n = 0;
    const sn = { block: 0, edge: 0, ladder: 0 };
    this.ladderFeet.clear();
    const stoneAt = (x: number, y: number): boolean => { const o = solid.get(y * width + x); return !!o && BUILDINGS[o.type]!.id === 'stoneWall'; };
    if (!this.stoneKit) {
      const k = stoneWallKit();
      const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, max: number): THREE.InstancedMesh => {
        const m = new THREE.InstancedMesh(geo, mat, max);
        m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; this.scene.add(cat(m, 'mury kamienne'));
        return m;
      };
      this.stoneKit = { block: mk(k.block, k.mat, 8192), edge: mk(k.edge, k.mat, 16384), ladder: mk(k.ladder, k.wood, 2048) };
    }
    if (!this.doorKit) {
      const k = stoneWallKit();
      const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, label: string): THREE.InstancedMesh => {
        const m = new THREE.InstancedMesh(geo, mat, 1024);
        m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; this.scene.add(cat(m, label));
        return m;
      };
      this.bridgeGeo = k.bridgeOf; this.bridgeMat = k.mat;
      const tdk = towerDoorKit();
      // geometrie w układzie „wejście w ścianie +z”: z = 0 to krawędź pola muru, wieża leży w stronę +z
      this.doorKit = {
        bridge: mk(k.bridge, k.mat, 'mur do wieży'),
        // drzwi jak od frontu kamiennej wieży (tools/models/towerdoor.py), obrócone tak, by patrzyły w -z (na mur)
        door: tdk.door.map((d) => mk(d.geo.clone().rotateY(Math.PI), d.mat, 'drzwi wieży z muru')),
        steps: tdk.steps.map((d) => mk(d.geo.clone().rotateY(Math.PI), d.mat, 'schodki drzwi wieży')),
      };
    }
    const dn = { bridge: 0, door: 0, steps: 0 };
    for (const b of this.bridges.values()) b.n = 0;
    /** Drzwi wieży (i schodki przy ziemi) w macierzy M4 */
    const putDoor = (steps: boolean): void => {
      if (!this.doorKit || dn.door >= 1024) return;
      for (const m of this.doorKit.door) m.setMatrixAt(dn.door, M4);
      dn.door++;
      if (steps) { for (const m of this.doorKit.steps) m.setMatrixAt(dn.steps, M4); dn.steps++; }
    };
    /** Wejścia z korony muru do kamiennych wież: wieża i bok → położenie lica i wysokości korony przyległych pól */
    const doors = new Map<string, { tw: GameState['buildings'][number]; dx: number; dz: number; rot: number; face: number; ys: number[]; along: number[] }>();
    /** Gotowa kamienna wieża na polu (x, y): odległość od krawędzi jej działki do lica trzonu (pole muru → ściana wieży) */
    const towerGap = (x: number, y: number): number => {
      const o = solid.get(y * width + x);
      if (!o || o.build || o.ruined || !isStoneTower(BUILDINGS[o.type]!.id)) return -1;
      const id = BUILDINGS[o.type]!.id;
      return id === 'stoneTower' ? 0.26 : id === 'stoneTowerBig' ? 0.35 : 0.45;
    };
    /** Obrót drabiny z zestawu muru: drabina stoi od strony (dx, dz) pola, o które się opiera */
    const ladderRot = (dx: number, dz: number): number => (dz > 0 ? 0 : dz < 0 ? Math.PI : dx > 0 ? Math.PI / 2 : -Math.PI / 2);
    /** Drabina z zestawu muru oparta o pole (tx, tz) od strony (dx, dz): stopa na wysokości `base`, sięga `h` w górę */
    const ladderAt = (tx: number, tz: number, dx: number, dz: number, base: number, h: number): void => {
      if (!this.stoneKit || sn.ladder >= 2048) return;
      e.set(0, ladderRot(dx, dz), 0); q.setFromEuler(e);
      M4.compose(p.set(tx + 0.5 - width / 2, base, tz + 0.5 - height / 2), q, sc.set(1, h / STONE_WALL_TOP, 1));
      this.stoneKit.ladder.setMatrixAt(sn.ladder++, M4);
    };
    // drabiny oblężnicze wroga przystawione do muru (sim/systems/siegeladders.ts)
    for (const l of g.siegeLadders ?? []) {
      const wx = l.wall % width, wz = Math.floor(l.wall / width);
      ladderAt(wx, wz, l.dx, l.dy, view.heightAt(wx + 0.5, wz + 0.5) - 0.06, STONE_WALL_TOP);
      this.ladderFeet.set(l.wall + l.dy * width + l.dx, [-l.dx, -l.dy]);
    }
    // wieże z wejściem przeniesionym na inny bok (przed frontem stoi mur albo budynek): tam druga drabina (drewniane)
    // albo drzwi w trzonie (kamienne)
    // drewniana wieża wbudowana w mur kamienny (mur przechodzi przez nią): stoi na kamiennym bloku, wchodzi się z korony
    // muru krótką drabiną — własna drabina wieży do ziemi (w modelu grupa 'ladder') i drabina z boku znikają, bo wbijały
    // się krzywo w mur (Michał 30.10.2026)
    const inStone = (b: GameState['buildings'][number]): boolean => {
      const fp = footprint(BUILDINGS[b.type]!, b.rot);
      for (let ty = b.y; ty < b.y + fp.h; ty++) if (at(b.x - 1, ty) && at(b.x + fp.w, ty) && (stoneAt(b.x - 1, ty) || stoneAt(b.x + fp.w, ty))) return true;
      for (let tx = b.x; tx < b.x + fp.w; tx++) if (at(tx, b.y - 1) && at(tx, b.y + fp.h) && (stoneAt(tx, b.y - 1) || stoneAt(tx, b.y + fp.h))) return true;
      return false;
    };
    for (const b of walls) {
      const id = BUILDINGS[b.type]!.id;
      if (id !== 'watchtower' && id !== 'lookout') continue;
      const lad = buildingMeshes.get(b.id)?.getObjectByName('ladder');
      if (lad) lad.visible = b.build > 0 || b.ruined || !inStone(b);
    }
    for (const b of walls) {
      const id = BUILDINGS[b.type]!.id;
      if (!isTower(id) || b.build || b.ruined) continue;
      if (!isStoneTower(id) && inStone(b)) continue;
      const [out, inner] = towerEntry(g, b);
      if (out < 0) continue;
      const ix = inner % width, iz = Math.floor(inner / width), ddx = (out % width) - ix, ddz = Math.floor(out / width) - iz;
      const r = ((b.rot % 4) + 4) % 4, front = [[0, 1], [1, 0], [0, -1], [-1, 0]][r]!;
      if (front[0] === ddx && front[1] === ddz) continue;
      const base = view.heightAt(ix + 0.5 + ddx * 0.5, iz + 0.5 + ddz * 0.5);
      if (!isStoneTower(id)) { ladderAt(ix, iz, ddx, ddz, base - 0.04, TOWER_TOP[id] ?? 1.9); continue; }
      if (!this.doorKit || dn.door >= 1024) continue;
      const gap = id === 'stoneTower' ? 0.26 : id === 'stoneTowerBig' ? 0.35 : 0.45;
      // takie same drzwi ze schodkami jak od frontu (próg 0,28 nad ziemią), na licu trzonu
      e.set(0, ladderRot(-ddx, -ddz), 0); q.setFromEuler(e);
      const fx = ix + 0.5 + ddx * (0.5 - gap), fz = iz + 0.5 + ddz * (0.5 - gap);
      M4.compose(p.set(fx - width / 2, base + 0.28, fz - height / 2), q, sc.set(1, 1, 1));
      putDoor(true);
    }
    const keeps = new Map<number, [number, number]>();
    for (const b of g.buildings) if (b.type === 0) { const fp = footprint(BUILDINGS[0]!, b.rot); keeps.set(b.owner, [b.x + fp.w / 2, b.y + fp.h / 2]); }
    for (const b of walls) {
      const def = BUILDINGS[b.type]!;
      if (def.gate) {
        // brama staje w poprzek muru: gdy sąsiedzi są po bokach w osi x, wrota idą wzdłuż x
        const mesh = buildingMeshes.get(b.id);
        // liczą się przede wszystkim przęsła muru (palisada, mur kamienny), a nie stojąca obok wieża czy budynek:
        // wygrywa oś, na której mur jest po obu stronach, potem ta z większą liczbą przęseł
        const line = (x: number, y: number): number => { const o = solid.get(y * width + x); return !o ? 0 : BUILDINGS[o.type]!.line ? 2 : 1; };
        const ax = line(b.x - 1, b.y) + line(b.x + 1, b.y) + (line(b.x - 1, b.y) && line(b.x + 1, b.y) ? 3 : 0);
        const az = line(b.x, b.y - 1) + line(b.x, b.y + 1) + (line(b.x, b.y - 1) && line(b.x, b.y + 1) ? 3 : 0);
        if (mesh) mesh.rotation.y = ax >= az ? 0 : Math.PI / 2;
        continue;
      }
      if ((def.id === 'watchtower' || def.id === 'lookout') && !b.build) {
        // mur przechodzi pod wieżą: między nogami wieży stoją bale (albo kamień), żeby było widać, że tędy nie ma przejścia
        const fp = footprint(def, b.rot);
        const inside = (x: number, y: number): boolean => x >= b.x && y >= b.y && x < b.x + fp.w && y < b.y + fp.h;
        for (let ty = b.y; ty < b.y + fp.h; ty++) for (let tx = b.x; tx < b.x + fp.w; tx++) {
          // rząd albo kolumna wieży, do której z zewnątrz dochodzi mur
          // tylko gdy mur przechodzi PRZEZ wieżę (dochodzi z obu przeciwnych stron); wieża postawiona obok, na końcu muru,
          // stoi na swoich nogach bez kamiennego bloku pod spodem (Michał 30.10.2026)
          const rowIn = at(b.x - 1, ty) && at(b.x + fp.w, ty), colIn = at(tx, b.y - 1) && at(tx, b.y + fp.h);
          const lk: [boolean, boolean, boolean, boolean] = [
            rowIn && (inside(tx + 1, ty) || at(tx + 1, ty)), rowIn && (inside(tx - 1, ty) || at(tx - 1, ty)),
            colIn && (inside(tx, ty + 1) || at(tx, ty + 1)), colIn && (inside(tx, ty - 1) || at(tx, ty - 1)),
          ];
          if (!lk.some(Boolean)) continue;
          const stone = stoneAt(b.x - 1, ty) || stoneAt(b.x + fp.w, ty) || stoneAt(tx, b.y - 1) || stoneAt(tx, b.y + fp.h);
          const lx0 = tx + 0.5, lz0 = ty + 0.5;
          if (stone && this.stoneKit) {
            // pod wieżą pełny blok muru kamiennego (bez blanek — przykrywa go pomost wieży)
            e.set(0, 0, 0); q.setFromEuler(e);
            M4.compose(p.set(lx0 - width / 2, view.heightAt(lx0, lz0) - 0.06, lz0 - height / 2), q, sc.set(1, 1, 1));
            this.stoneKit.block.setMatrixAt(sn.block++, M4);
            continue;
          }
          for (const log of palisadeLogs(lk, b.id + tx * 3 + ty)) {
            if (n >= 4096) break;
            const lx = lx0 + log.x, lz = lz0 + log.z, y = view.heightAt(lx, lz) - 0.05, h = log.h * 0.92;
            M4.compose(p.set(lx - width / 2, y, lz - height / 2), q.identity(), sc.set(log.r, h, log.r));
            this.wallShafts.setMatrixAt(n, M4);
            M4.compose(p.set(lx - width / 2, y + h, lz - height / 2), q, sc.set(log.r, log.r * 2.2, log.r));
            this.wallTips!.setMatrixAt(n, M4);
            n++;
          }
        }
        continue;
      }
      if (!def.line) continue;
      // budowa częstokołu: bale stają jeden po drugim (pełnej wysokości), a nie rosną z ziemi
      const built = b.build ? 1 - b.build / buildWork(b.type) : 1;
      const links: [boolean, boolean, boolean, boolean] = [at(b.x + 1, b.y), at(b.x - 1, b.y), at(b.x, b.y + 1), at(b.x, b.y - 1)];
      const cx = b.x + 0.5, cz = b.y + 0.5;
      if (def.id === 'stoneWall') {
        // mur kamienny jak w Twierdzy: pełny blok na polu, sąsiednie bloki zlewają się w gruby mur; blanki tylko na
        // krawędziach bez sąsiedniego muru kamiennego; co kilka pól drabina od strony twierdzy; w budowie rośnie od ziemi
        const kit = this.stoneKit!;
        // drobne różnice terenu między sąsiednimi polami muru (do 15 cm) wyrównane do najniższego sąsiada: bez cienkich
        // „schodków” na koronie (Michał 30.10.2026); na stromym zboczu stopnie zostają (pole wchodzi w ziemię najwyżej 15 cm)
        const gy = wallLevel(b.x, b.y, cx, cz);
        // pochylnia zamiast schodków (Michał 30.10.2026): krawędź między dwoma polami muru leży w połowie ich wysokości,
        // a pole pochyla się wzdłuż biegu muru (ściany i blanki zostają pionowe, przesuwa się tylko wysokość)
        const lvAt = (x: number, y: number): number | undefined => levels?.get(y * width + x);
        const edge = (dx: number, dz: number): number => { const n = lvAt(b.x + dx, b.y + dz); return n === undefined ? gy : (gy + n) / 2; };
        const hasX = lvAt(b.x + 1, b.y) !== undefined || lvAt(b.x - 1, b.y) !== undefined, hasZ = lvAt(b.x, b.y + 1) !== undefined || lvAt(b.x, b.y - 1) !== undefined;
        let kx = 0, kz = 0, mid = gy;
        if (hasX && !hasZ) { const a = edge(-1, 0), c = edge(1, 0); kx = c - a; mid = (a + c) / 2; }
        else if (hasZ && !hasX) { const a = edge(0, -1), c = edge(0, 1); kz = c - a; mid = (a + c) / 2; }
        const wxc = cx - width / 2, wzc = cz - height / 2;
        SH.set(1, 0, 0, 0, kx, 1, kz, -kx * wxc - kz * wzc, 0, 0, 1, 0, 0, 0, 0, 1);
        const y0 = mid - 0.06, hk = Math.max(0.08, built);
        const put = (mesh: THREE.InstancedMesh, rotY: number, cnt: number): number => {
          e.set(0, rotY, 0); q.setFromEuler(e);
          M4.compose(p.set(cx - width / 2, y0, cz - height / 2), q, sc.set(1, hk, 1));
          if (kx || kz) M4.premultiply(SH);
          mesh.setMatrixAt(cnt, M4);
          return cnt + 1;
        };
        // ruina muru kamiennego: bez płaskiego „chodnika” z kamieni (blok 8% wysokości) — leży sam gruz; mur rośnie od nowa
        // dopiero przy odbudowie (Michał 30.10.2026: „rozwalony mur niech nie ma takiego podłoża”)
        if (sn.block < 8192 && !(b.ruined && built < 0.1)) sn.block = put(kit.block, 0, sn.block);
        // drabiny postawione przez gracza przy tym polu muru (te same, którymi symulacja wpuszcza na mur)
        const ls = built >= 1 ? ladderSides(g, b) : 0;
        for (const [bit, dx, dz, rot] of [[1, 0, -1, Math.PI], [2, 1, 0, Math.PI / 2], [4, 0, 1, 0], [8, -1, 0, -Math.PI / 2]] as const) {
          if (!(ls & bit)) continue;
          // drabina w narożniku dotyka dwóch pól muru: rysujemy ją tylko przy jednym (pierwszym w stałej kolejności:
          // północ, wschód, południe, zachód), bez dwóch drabin z jednej (Michał 30.10.2026); wejście działa z obu
          if (ladderWall(b.x + dx, b.y + dz) !== b.y * width + b.x) continue;
          this.ladderFeet.set((b.y + dz) * width + b.x + dx, [-dx, -dz]);
          if (sn.ladder < 2048) sn.ladder = put(kit.ladder, rot, sn.ladder);
        }
        for (const [dx, dz, rot] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
          // obok kamienna wieża: mur łączy się z nią (korona aż do ściany), a w ścianie wieży ciemne wejście na wysokości korony
          const gap = built >= 1 && !b.ruined ? towerGap(b.x + dx, b.y + dz) : -1;
          if (gap >= 0 && this.doorKit && dn.bridge < 1024) {
            const ex = cx + dx * 0.5, ez = cz + dz * 0.5;
            e.set(0, rot, 0); q.setFromEuler(e);
            const len = Math.round((gap + 0.02) * 20) * 5;
            let br = this.bridges.get(len);
            if (!br && this.bridgeGeo && this.bridgeMat) {
              const m = new THREE.InstancedMesh(this.bridgeGeo(len / 100), this.bridgeMat, 1024);
              m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; this.scene.add(cat(m, 'mur do wieży'));
              br = { mesh: m, n: 0 };
              this.bridges.set(len, br);
            }
            M4.compose(p.set(ex - width / 2, y0, ez - height / 2), q, sc.set(1, 1, 1));
            if (br && br.n < 1024) br.mesh.setMatrixAt(br.n++, M4);
            dn.bridge++;
            // wejście: jedno na każdy bok wieży, na środku boku (gruby mur dochodzi do wieży kilkoma polami naraz)
            const tw = solid.get((b.y + dz) * width + b.x + dx)!, side = `${tw.id}:${dx}:${dz}`;
            const d = doors.get(side);
            if (d) { d.ys.push(y0); d.along.push(dx ? cz : cx); }
            else doors.set(side, { tw, dx, dz, rot, face: dx ? ex + dx * gap : ez + dz * gap, ys: [y0], along: [dx ? cz : cx] });
            continue;
          }
          // obok drewniana strażnica albo czatownia: z korony prowadzi na jej pomost krótka drabina, blanek w poprzek nie ma
          const nb = solid.get((b.y + dz) * width + b.x + dx), nid = nb ? BUILDINGS[nb.type]!.id : '';
          if (nb && !nb.build && !nb.ruined && (nid === 'watchtower' || nid === 'lookout') && built >= 1) {
            ladderAt(b.x + dx, b.y + dz, -dx, -dz, y0 + STONE_WALL_TOP, Math.max(0.3, (TOWER_TOP[nid] ?? 1.9) - STONE_WALL_TOP));
            continue;
          }
          if (stoneAt(b.x + dx, b.y + dz) || sn.edge >= 16384) continue;
          // ruina: przedpiersie i blanki strącone (leżą w gruzie, damage.ts), wracają dopiero pod koniec odbudowy
          if (b.ruined && ruinRebuilt(b.build, buildWork(b.type)) < 0.95) continue;
          sn.edge = put(kit.edge, rot, sn.edge);
        }
        continue;
      }
      const logs = palisadeLogs(links, b.id);
      const wear = b.build ? 0 : wearStage(b.hp, maxHp(b.type));
      // ruina częstokołu: same połamane kikuty, rosną w czasie odbudowy; połamane bale leżą obok, dopóki ich nie zabiorą
      const kr = b.ruined ? ruinRebuilt(b.build, buildWork(b.type)) : -1;
      const shown = kr >= 0 ? logs.length : Math.floor(logs.length * built + 0.001);
      // bale padają w poprzek muru (na zewnątrz albo do środka), nie wzdłuż
      const alongX = links[0] || links[1] || !(links[2] || links[3]);
      const [px, pz] = alongX ? [0, 1] : [1, 0];
      /** bal (albo jego odłamana część) leżący na ziemi przy murze, z czubkiem albo bez */
      const lying = (lx: number, lz: number, len: number, r: number, side: number, seed: number, tip: boolean): void => {
        if (n >= 4096) return;
        const d = 0.18 + hash(seed, 3) * 0.4, sl = (hash(seed, 4) - 0.5) * 0.5;
        const gx = lx + px * side * d + pz * sl, gz = lz + pz * side * d + px * sl;
        // leży mniej więcej wzdłuż muru, trochę krzywo
        const yaw = (alongX ? 0 : Math.PI / 2) + (hash(seed, 5) - 0.5) * 1.1;
        e.set(0, yaw, Math.PI / 2 - 0.04 + hash(seed, 6) * 0.08); q.setFromEuler(e);
        const gy = view.heightAt(gx, gz) + r * 0.8;
        M4.compose(p.set(gx - width / 2, gy, gz - height / 2), q, sc.set(r, len, r));
        this.wallShafts!.setMatrixAt(n, M4);
        const end = new THREE.Vector3(0, len, 0).applyQuaternion(q);
        M4.compose(p.set(gx - width / 2 + end.x, gy + end.y, gz - height / 2 + end.z), q, tip ? sc.set(r, r * 2.2, r) : sc.set(r * 0.9, r * 0.5, r * 0.9));
        this.wallTips!.setMatrixAt(n, M4);
        n++;
      };
      for (let li = 0; li < logs.length; li++) {
        const log = logs[li]!;
        if (n >= 4096) break;
        if (li >= shown) {
          // miejsce na kolejny bal: wbity kołek znacznikowy
          if (li === shown) {
            const lx = cx + log.x, lz = cz + log.z, y = view.heightAt(lx, lz) - 0.05;
            M4.compose(p.set(lx - width / 2, y, lz - height / 2), q.identity(), sc.set(log.r * 0.4, 0.18, log.r * 0.4));
            this.wallShafts.setMatrixAt(n, M4);
            this.wallTips!.setMatrixAt(n, M4.makeScale(0, 0, 0));
            n++;
          }
          continue;
        }
        const lx = cx + log.x, lz = cz + log.z;
        const y = view.heightAt(lx, lz) - 0.05;
        // rozbity częstokół: im mniej wytrzymałości, tym więcej bali złamanych (odłamany kawał leży pod murem),
        // przy najgorszym stopniu część bali wyrwana w całości i leży na ziemi; po naprawie wszystko wraca na miejsce
        const r1 = hash(b.id, li), r2 = hash(b.id, li + 17), r3 = hash(b.id, li + 31);
        const side = r3 < 0.5 ? 1 : -1;
        if (kr >= 0) {
          // ruina: kikut 25–45% wysokości, w odbudowie rośnie do pełnego bala
          const stump = log.h * (0.25 + r2 * 0.2);
          const h = stump + (log.h - stump) * kr;
          e.set((r2 - 0.5) * 0.22 * (1 - kr), 0, (r3 - 0.5) * 0.22 * (1 - kr)); q.setFromEuler(e);
          M4.compose(p.set(lx - width / 2, y, lz - height / 2), q, sc.set(log.r, h, log.r));
          this.wallShafts.setMatrixAt(n, M4);
          const top = new THREE.Vector3(0, h, 0).applyQuaternion(q);
          M4.compose(p.set(lx - width / 2 + top.x, y + top.y, lz - height / 2 + top.z), q, kr > 0.97 ? sc.set(log.r, log.r * 2.2, log.r) : sc.set(log.r * 0.9, log.r * 0.5, log.r * 0.9));
          this.wallTips!.setMatrixAt(n, M4);
          n++;
          // odłamane części leżą obok, ubywa ich w miarę odbudowy
          if (hash(b.id, li + 50) < 1 - kr) lying(lx, lz, log.h - stump, log.r, side, b.id * 13 + li, true);
          continue;
        }
        const knocked = wear === 3 && r1 < 0.22;
        if (knocked) { lying(lx, lz, log.h, log.r, side, b.id * 7 + li, true); continue; }
        const broken = wear > 0 && r1 < [0, 0.15, 0.35, 0.6][wear]!;
        const h = broken ? log.h * (0.5 + r2 * 0.3) : log.h;
        const lean = [0, 0.03, 0.08, 0.16][wear]!;
        e.set((log.x * 7 % 1) * 0.05 + (r2 - 0.5) * 2 * lean, 0, (log.z * 5 % 1) * 0.05 + (r3 - 0.5) * 2 * lean);
        q.setFromEuler(e);
        M4.compose(p.set(lx - width / 2, y, lz - height / 2), q, sc.set(log.r, h, log.r));
        this.wallShafts.setMatrixAt(n, M4);
        // czubek idzie za przechylonym balem; złamany bal nie ma czubka (zostaje poszarpany kikut)
        const top = new THREE.Vector3(0, h, 0).applyQuaternion(q);
        M4.compose(p.set(lx - width / 2 + top.x, y + top.y, lz - height / 2 + top.z), q, broken ? sc.set(log.r * 0.9, log.r * 0.5, log.r * 0.9) : sc.set(log.r, log.r * 2.2, log.r));
        this.wallTips!.setMatrixAt(n, M4);
        n++;
        // odłamany kawał z czubkiem leży pod murem, dopóki inżynier nie wstawi nowego bala
        if (broken) lying(lx, lz, log.h - h, log.r * 0.95, side, b.id * 5 + li, true);
      }
    }
    this.wallShafts.count = n; this.wallTips!.count = n;
    for (const key of ['block', 'edge', 'ladder'] as const) { const m = this.stoneKit[key]; m.count = sn[key]; touch(m); }
    for (const d of doors.values()) {
      if (!this.doorKit || dn.door >= 1024) break;
      // na środku odcinka, którym mur dochodzi do tego boku wieży (gruby mur na środku boku = wejście na środku boku)
      const avg = (a: number[]): number => a.reduce((m, v) => m + v, 0) / a.length;
      const y = avg(d.ys) + STONE_WALL_TOP, mid = avg(d.along);
      const fx = d.dx ? d.face : mid, fz = d.dz ? d.face : mid;
      // drzwi jak od frontu (bez schodków: podłogą jest korona muru), trochę mniejsze — nad nimi zaczynają się wsporniki
      e.set(0, d.rot, 0); q.setFromEuler(e);
      M4.compose(p.set(fx - width / 2, y, fz - height / 2), q, sc.setScalar(0.85));
      putDoor(false);
    }
    this.doorKit.bridge.count = 0;
    for (const b of this.bridges.values()) { b.mesh.count = b.n; b.mesh.visible = b.n > 0; touch(b.mesh); }
    for (const m of this.doorKit.door) { m.count = dn.door; touch(m); }
    for (const m of this.doorKit.steps) { m.count = dn.steps; touch(m); }
    touch(this.wallShafts); touch(this.wallTips!);
  }
}
