/**
 * Mury (wyniesione z scene.ts, 24.10.2026): częstokół z bali łączących się z sąsiednimi palisadami, bramami i wieżami,
 * mur kamienny z bloków, blank i drabin, mur pod wieżą strażniczą; brama obraca się w linii muru.
 * Bale stają jeden po drugim w czasie budowy. Wszystko w kilku wspólnych siatkach instancji.
 */
import * as THREE from 'three';
import { BUILDINGS, footprint } from '../data/buildings';
import type { GameState } from '../sim/state';
import { buildWork, maxHp } from '../sim/systems/placement';
import { ladderSides } from '../sim/systems/stonewalls';
import { palisadeLogs, stoneWallKit } from './buildings';
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
  /** Częstokół: bale łączą się z sąsiednimi palisadami, bramami i wieżami; brama obraca się w linii muru */
  sync(g: GameState, view: TerrainView, buildingMeshes: Map<number, THREE.Group>): void {
    const { width, height } = g.map;
    const walls = g.buildings.filter((b) => { const d = BUILDINGS[b.type]!; return d.wall || d.gate; });
    // w kluczu też to, czy model już jest: na nowej mapie mur liczy się czasem przed modelami bram, a brama bez obrotu
    // stała wzdłuż muru (po odświeżeniu kolejność była inna i wszystko wracało)
    // stopień zużycia też w kluczu: rozbity częstokół ma złamane i przekrzywione bale
    const key = walls.map((b) => `${b.id}:${b.build ? Math.ceil((1 - b.build / buildWork(b.type)) * 16) : 99}:${buildingMeshes.has(b.id) ? 1 : 0}:${b.build ? 0 : wearStage(b.hp, maxHp(b.type))}`).join(',');
    if (key === this.key) return;
    this.key = key;
    const solid = new Map<number, GameState['buildings'][number]>();
    for (const b of walls) { const fp = footprint(BUILDINGS[b.type]!, b.rot); for (let y = b.y; y < b.y + fp.h; y++) for (let x = b.x; x < b.x + fp.w; x++) solid.set(y * width + x, b); }
    const at = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && solid.has(y * width + x);
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
          const rowIn = at(b.x - 1, ty) || at(b.x + fp.w, ty), colIn = at(tx, b.y - 1) || at(tx, b.y + fp.h);
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
        const y0 = view.heightAt(cx, cz) - 0.06, hk = Math.max(0.08, built);
        const put = (mesh: THREE.InstancedMesh, rotY: number, cnt: number): number => {
          e.set(0, rotY, 0); q.setFromEuler(e);
          M4.compose(p.set(cx - width / 2, y0, cz - height / 2), q, sc.set(1, hk, 1));
          mesh.setMatrixAt(cnt, M4);
          return cnt + 1;
        };
        if (sn.block < 8192) sn.block = put(kit.block, 0, sn.block);
        // drabiny postawione przez gracza przy tym polu muru (te same, którymi symulacja wpuszcza na mur)
        const ls = built >= 1 ? ladderSides(g, b) : 0;
        for (const [bit, dx, dz, rot] of [[1, 0, -1, Math.PI], [2, 1, 0, Math.PI / 2], [4, 0, 1, 0], [8, -1, 0, -Math.PI / 2]] as const) {
          if (!(ls & bit)) continue;
          this.ladderFeet.set((b.y + dz) * width + b.x + dx, [-dx, -dz]);
          if (sn.ladder < 2048) sn.ladder = put(kit.ladder, rot, sn.ladder);
        }
        for (const [dx, dz, rot] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]] as const) {
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
    touch(this.wallShafts); touch(this.wallTips!);
  }
}
