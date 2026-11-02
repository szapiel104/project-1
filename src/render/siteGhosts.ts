import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import { TEAM_COLORS } from '../data/teams';
import type { GameState } from '../sim/state';
import { cloneMaterial } from './matclone';
import type { ModelFactory } from './models';

/**
 * Podgląd zamówionych budów (Michał 2.11.2026): gdy gracz ma otwartą listę budowy albo stawia budynek, każdy jego
 * plac budowy pokazuje gotową budowlę jak duch — półprzezroczystą (OPACITY), żeby było widać, jak będą wyglądać mury
 * i wieże już zlecone, i dało się do nich dociągnąć następne. Po zamknięciu budowy duchy znikają.
 *
 * Duch to kopia wzoru (wspólne siatki i materiały wszystkich duchów danego rodzaju), ustawiona tak jak prawdziwa
 * siatka budynku w scenie (pozycja i obrót). Drogi i ruiny w odbudowie nie dostają ducha; mury liniowe (mur kamienny,
 * częstokół) rysuje walls.ts ze swoich klocków (`ghostOwner`), bo pojedynczy model odcinka stał inaczej niż mur w grze.
 */
const OPACITY = 0.2;
/** Najwięcej duchów naraz (długie zlecenia murów): dalsze po prostu się nie pokazują */
const MAX_GHOSTS = 600;

export class SiteGhosts {
  private group = new THREE.Group();
  private templates = new Map<string, THREE.Group>();
  private ghosts = new Map<number, THREE.Object3D>();
  private key = '';
  private game: GameState | null = null;

  constructor(scene: THREE.Scene, private models: ModelFactory) {
    this.group.name = 'siteGhosts';
    scene.add(this.group);
  }

  private template(id: string, team: number): THREE.Group {
    const k = `${id}:${team}`;
    let t = this.templates.get(k);
    if (t) return t;
    t = this.models.building(id, TEAM_COLORS[team] ?? 0x888888);
    const done = new Map<THREE.Material, THREE.Material>();
    t.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.name === 'base') { mesh.visible = false; return; }
      const swap = (m: THREE.Material): THREE.Material => {
        let c = done.get(m);
        if (!c) {
          c = cloneMaterial(m as THREE.MeshLambertMaterial);
          c.transparent = true; c.opacity = OPACITY; c.depthWrite = false;
          done.set(m, c);
        }
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
      mesh.castShadow = mesh.receiveShadow = false;
      mesh.renderOrder = 20;
    });
    this.templates.set(k, t);
    return t;
  }

  /** `owner` < 0 chowa duchy; inaczej pokazuje place budowy tego gracza */
  sync(g: GameState, owner: number, meshes: Map<number, THREE.Object3D>): void {
    if (g !== this.game) {
      // inna gra (wczytanie zapisu): te same numery budynków to inne budowy
      this.game = g; this.key = '';
      for (const o of this.ghosts.values()) this.group.remove(o);
      this.ghosts.clear();
    }
    if (owner < 0) { this.group.visible = false; return; }
    this.group.visible = true;
    const sites = g.buildings.filter((b) => b.owner === owner && b.build > 0 && !b.ruined && !BUILDINGS[b.type]!.road && !BUILDINGS[b.type]!.line && meshes.has(b.id)).slice(0, MAX_GHOSTS);
    const key = sites.map((b) => b.id).join(',');
    if (key === this.key) return;
    this.key = key;
    const keep = new Set(sites.map((b) => b.id));
    for (const [id, o] of this.ghosts) if (!keep.has(id)) { this.group.remove(o); this.ghosts.delete(id); }
    const team = g.players[owner]?.team ?? 0;
    for (const b of sites) {
      if (this.ghosts.has(b.id)) continue;
      const real = meshes.get(b.id)!;
      const o = this.template(BUILDINGS[b.type]!.id, team).clone();
      o.position.copy(real.position);
      o.quaternion.copy(real.quaternion);
      o.scale.copy(real.scale);
      this.group.add(o);
      this.ghosts.set(b.id, o);
    }
  }
}
