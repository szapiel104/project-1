/**
 * Edytor poprawek w podglądzie modeli (Michał 10.11.2026: „przesuwać niektóre rzeczy, poprawiać model i zapisać” —
 * skrócony Blender bez modelowania). Przycisk „Edytuj”: kliknięcie części budynku (beczka, belka, deska, stojak)
 * zaznacza ją, strzałki przesuwają (W), łuki obracają (E), kwadraty skalują (R); Del usuwa część, Ctrl+Z cofa,
 * Esc odznacza. „Zapisz” wysyła listę poprawek do bazy (tabela model_fixes; bez niej zostają w przeglądarce)
 * i daje plik do pobrania. W grze poprawki działają po przeniesieniu do src/data/modelFixes.json
 * (node tools/models/pull_fixes.mjs) — modelfix.ts stosuje je przy wczytaniu modelu.
 */
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { findIsland, islands, transformIsland, type Fix, type Island } from '../render/modelfix';
import REPO_FIXES from '../data/modelFixes.json';
import { tx } from '../i18n';

interface Ctx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  orbit: OrbitControls;
  bar: HTMLElement;
  current: () => THREE.Object3D | null;
  id: () => string;
}

const LS = (id: string): string => `p1-model-fixes:${id}`;
const repo = (id: string): Fix[] => (REPO_FIXES as Record<string, Fix[]>)[id] ?? [];
const r4 = (v: number): number => Math.round(v * 1e4) / 1e4;

export function createModelEditor(ctx: Ctx): { onModel: () => void } {
  let on = false;
  /** Poprawki tej sesji (dla bieżącego modelu), po poprawkach z repozytorium */
  let edits: Fix[] = [];
  const undo: { mesh: THREE.Mesh; isl: Island; P: Float32Array; N: Float32Array | null; fix: Fix }[] = [];
  const pendingDone = new WeakSet<THREE.BufferGeometry>();
  const islandCache = new WeakMap<THREE.BufferGeometry, { of: Int32Array; list: Island[] }>();
  const isl = (g: THREE.BufferGeometry): { of: Int32Array; list: Island[] } => {
    let v = islandCache.get(g);
    if (!v) { v = islands((g.getAttribute('position') as THREE.BufferAttribute).array as Float32Array); islandCache.set(g, v); }
    return v;
  };

  // ---------- przyciski ----------
  const wrap = document.createElement('div');
  wrap.className = 'edit-tools';
  wrap.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;width:100%;justify-content:flex-end';
  const btn = (label: string, f: () => void, title = ''): HTMLButtonElement => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.onclick = f; return b;
  };
  const editBtn = btn(tx('Edytuj', 'Edit'), () => setOn(!on), tx('Kliknij część modelu, żeby ją przesunąć, obrócić albo usunąć', 'Click a part of the model to move, rotate or remove it'));
  const modeBtns = ([['translate', tx('Przesuń (W)', 'Move (W)')], ['rotate', tx('Obróć (E)', 'Rotate (E)')], ['scale', tx('Skaluj (R)', 'Scale (R)')]] as const)
    .map(([m, l]) => { const b = btn(l, () => setMode(m)); b.dataset.mode = m; return b; });
  const delBtn = btn(tx('Usuń część (Del)', 'Remove part (Del)'), () => removeSel());
  const undoBtn = btn(tx('Cofnij (Ctrl+Z)', 'Undo (Ctrl+Z)'), () => undoLast());
  const saveBtn = btn(tx('Zapisz', 'Save'), () => void save());
  const fileBtn = btn(tx('Pobierz plik poprawek', 'Download fixes file'), () => download());
  const status = document.createElement('span');
  status.style.cssText = 'align-self:center;font-size:12px;color:#e6d6b4;padding:0 6px';
  const tools = [...modeBtns, delBtn, undoBtn, saveBtn, fileBtn, status];
  wrap.append(editBtn, ...tools);
  ctx.bar.append(wrap);

  // ---------- uchwyt (TransformControls) i podświetlenie ----------
  const tc = new TransformControls(ctx.camera, ctx.canvas);
  tc.setSize(0.8);
  const helper = (tc as unknown as { getHelper?: () => THREE.Object3D }).getHelper?.() ?? (tc as unknown as THREE.Object3D);
  ctx.scene.add(helper);
  const proxy = new THREE.Object3D();
  ctx.scene.add(proxy);
  const hiMat = new THREE.MeshBasicMaterial({ color: 0xffd34a, wireframe: true, transparent: true, opacity: 0.55, depthTest: false });
  let hi: THREE.Mesh | null = null;
  let sel: { mesh: THREE.Mesh; isl: Island; P: Float32Array; N: Float32Array | null; start: THREE.Matrix4; c: [number, number, number] } | null = null;
  tc.addEventListener('dragging-changed', (e) => {
    ctx.orbit.enabled = !(e as unknown as { value: boolean }).value;
    if (!(e as unknown as { value: boolean }).value) commit();
  });
  tc.addEventListener('objectChange', () => live());

  function setOn(v: boolean): void {
    on = v;
    editBtn.setAttribute('aria-pressed', String(on));
    for (const t of tools) (t as HTMLElement).hidden = !on;
    if (!on) deselect();
    setMode((tc.mode as 'translate' | 'rotate' | 'scale') ?? 'translate');
    say(on ? tx('Kliknij część modelu', 'Click a part of the model') : '');
  }
  function setMode(m: 'translate' | 'rotate' | 'scale'): void {
    tc.setMode(m);
    for (const b of modeBtns) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
  }
  function say(t: string): void { status.textContent = t; }

  /** Macierz zmiany w układzie siatki (= układ modelu) z ruchu uchwytu */
  function localDelta(): THREE.Matrix4 {
    if (!sel) return new THREE.Matrix4();
    proxy.updateMatrixWorld();
    const D = proxy.matrixWorld.clone().multiply(sel.start.clone().invert());
    sel.mesh.updateMatrixWorld();
    const W = sel.mesh.matrixWorld;
    return W.clone().invert().multiply(D).multiply(W);
  }
  function writeIsland(mesh: THREE.Mesh, island: Island, P0: Float32Array, N0: Float32Array | null, L: THREE.Matrix4): void {
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const nor = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const e = L.elements, nm = new THREE.Matrix3().getNormalMatrix(L), v = new THREE.Vector3();
    let k = 0;
    for (const t of island.tris) for (let j = 0; j < 3; j++, k++) {
      const vi = t * 3 + j, x = P0[k * 3]!, y = P0[k * 3 + 1]!, z = P0[k * 3 + 2]!;
      pos.setXYZ(vi, e[0]! * x + e[4]! * y + e[8]! * z + e[12]!, e[1]! * x + e[5]! * y + e[9]! * z + e[13]!, e[2]! * x + e[6]! * y + e[10]! * z + e[14]!);
      if (nor && N0) { v.set(N0[k * 3]!, N0[k * 3 + 1]!, N0[k * 3 + 2]!).applyMatrix3(nm).normalize(); nor.setXYZ(vi, v.x, v.y, v.z); }
    }
    pos.needsUpdate = true;
    if (nor) nor.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.computeBoundingBox();
  }
  function snapshot(mesh: THREE.Mesh, island: Island): { P: Float32Array; N: Float32Array | null } {
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const nor = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const P = new Float32Array(island.tris.length * 9), N = nor ? new Float32Array(island.tris.length * 9) : null;
    let k = 0;
    for (const t of island.tris) for (let j = 0; j < 3; j++, k++) {
      const vi = t * 3 + j;
      P[k * 3] = pos.getX(vi); P[k * 3 + 1] = pos.getY(vi); P[k * 3 + 2] = pos.getZ(vi);
      if (N && nor) { N[k * 3] = nor.getX(vi); N[k * 3 + 1] = nor.getY(vi); N[k * 3 + 2] = nor.getZ(vi); }
    }
    return { P, N };
  }
  function centerOf(P: Float32Array): [number, number, number] {
    let x = 0, y = 0, z = 0;
    const n = P.length / 3;
    for (let k = 0; k < n; k++) { x += P[k * 3]!; y += P[k * 3 + 1]!; z += P[k * 3 + 2]!; }
    return [x / n, y / n, z / n];
  }
  function live(): void {
    if (!sel) return;
    writeIsland(sel.mesh, sel.isl, sel.P, sel.N, localDelta());
    if (hi) { hi.geometry.dispose(); hi.geometry = islandGeo(sel.mesh, sel.isl); }
  }
  function islandGeo(mesh: THREE.Mesh, island: Island): THREE.BufferGeometry {
    const src = mesh.geometry.getAttribute('position') as THREE.BufferAttribute, out = new Float32Array(island.tris.length * 9);
    let k = 0;
    for (const t of island.tris) for (let j = 0; j < 3; j++, k++) { const vi = t * 3 + j; out[k * 3] = src.getX(vi); out[k * 3 + 1] = src.getY(vi); out[k * 3 + 2] = src.getZ(vi); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(out, 3)); return g;
  }
  /** Koniec ruchu: zapis poprawki (macierz od stanu z chwili zaznaczenia) i nowy punkt startu */
  function commit(): void {
    if (!sel) return;
    const L = localDelta();
    if (L.equals(new THREE.Matrix4())) return;
    const [g, i] = sel.mesh.userData.fx as [string, number];
    const fix: Fix = { g, i, c: sel.c.map(r4) as [number, number, number], n: sel.isl.tris.length, m: L.elements.map(r4) };
    edits.push(fix);
    undo.push({ mesh: sel.mesh, isl: sel.isl, P: sel.P, N: sel.N, fix });
    // następny ruch liczy się od nowego położenia
    const snap = snapshot(sel.mesh, sel.isl);
    sel.P = snap.P; sel.N = snap.N; sel.c = centerOf(snap.P);
    proxy.updateMatrixWorld(); sel.start = proxy.matrixWorld.clone();
    say(tx(`Zmiany do zapisania: ${edits.length}`, `Unsaved changes: ${edits.length}`));
  }
  function select(mesh: THREE.Mesh, island: Island): void {
    deselect();
    const snap = snapshot(mesh, island), c = centerOf(snap.P);
    mesh.updateMatrixWorld();
    proxy.position.copy(new THREE.Vector3(...c).applyMatrix4(mesh.matrixWorld));
    proxy.rotation.set(0, 0, 0); proxy.scale.set(1, 1, 1);
    proxy.updateMatrixWorld();
    sel = { mesh, isl: island, P: snap.P, N: snap.N, start: proxy.matrixWorld.clone(), c };
    hi = new THREE.Mesh(islandGeo(mesh, island), hiMat);
    hi.renderOrder = 999;
    mesh.add(hi);
    tc.attach(proxy);
    say(tx(`Część: ${island.tris.length} trójkątów`, `Part: ${island.tris.length} triangles`));
  }
  function deselect(): void {
    tc.detach();
    if (hi) { hi.removeFromParent(); hi.geometry.dispose(); hi = null; }
    sel = null;
  }
  function removeSel(): void {
    if (!sel) return;
    // usunięcie = zgniecenie części w punkt (ta sama poprawka co skala, liczba trójkątów zostaje)
    const c = new THREE.Vector3(...sel.c);
    const L = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
    const [g, i] = sel.mesh.userData.fx as [string, number];
    const fix: Fix = { g, i, c: sel.c.map(r4) as [number, number, number], n: sel.isl.tris.length, m: L.elements.map((v) => Math.round(v * 1e6) / 1e6) };
    writeIsland(sel.mesh, sel.isl, sel.P, sel.N, L);
    edits.push(fix);
    undo.push({ mesh: sel.mesh, isl: sel.isl, P: sel.P, N: sel.N, fix });
    deselect();
    say(tx(`Usunięto. Zmiany do zapisania: ${edits.length}`, `Removed. Unsaved changes: ${edits.length}`));
  }
  function undoLast(): void {
    const u = undo.pop();
    if (!u) return;
    deselect();
    writeIsland(u.mesh, u.isl, u.P, u.N, new THREE.Matrix4());
    const k = edits.lastIndexOf(u.fix);
    if (k >= 0) edits.splice(k, 1);
    say(tx(`Cofnięto. Zmiany do zapisania: ${edits.length}`, `Undone. Unsaved changes: ${edits.length}`));
  }

  // ---------- klikanie w część ----------
  const ray = new THREE.Raycaster();
  let down: [number, number] | null = null;
  ctx.canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  ctx.canvas.addEventListener('pointerup', (e) => {
    if (!on || !down || (tc as unknown as { dragging: boolean }).dragging) return;
    if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = ctx.canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), ctx.camera);
    const cur = ctx.current();
    if (!cur) return;
    const hits = ray.intersectObject(cur, true).filter((h) => (h.object as THREE.Mesh).isMesh && h.object.userData.fx && h.object.visible && h.faceIndex != null);
    const h = hits.find((x) => { for (let o: THREE.Object3D | null = x.object; o; o = o.parent) if (!o.visible) return false; return true; });
    if (!h) { deselect(); say(tx('Kliknij część modelu', 'Click a part of the model')); return; }
    const mesh = h.object as THREE.Mesh;
    const { of, list } = isl(mesh.geometry);
    select(mesh, list[of[h.faceIndex!]!]!);
  });
  window.addEventListener('keydown', (e) => {
    if (!on || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'w') setMode('translate');
    else if (k === 'e') setMode('rotate');
    else if (k === 'r') setMode('scale');
    else if (k === 'delete' || k === 'backspace') removeSel();
    else if (k === 'escape') deselect();
    else if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undoLast(); }
  });

  // ---------- zapis ----------
  const all = (): Fix[] => [...repo(ctx.id()), ...stored(ctx.id()).slice(repo(ctx.id()).length), ...edits];
  function stored(id: string): Fix[] {
    try { const v = JSON.parse(localStorage.getItem(LS(id)) ?? 'null') as Fix[] | null; return Array.isArray(v) ? v : repo(id); } catch { return repo(id); }
  }
  async function save(): Promise<void> {
    if (!edits.length) { say(tx('Nie ma zmian do zapisania', 'Nothing to save')); return; }
    const id = ctx.id(), list = all();
    try { localStorage.setItem(LS(id), JSON.stringify(list)); } catch { /* prywatne okno */ }
    edits = [];
    undo.length = 0;
    say(tx('Zapisano w przeglądarce, wysyłam do bazy…', 'Saved in the browser, sending to the database…'));
    try {
      const { supa } = await import('../net/supa');
      const { data: s } = await supa.auth.getSession();
      if (!s.session) { say(tx('Zapisano w przeglądarce (zaloguj się w grze, żeby wysłać do bazy)', 'Saved in the browser (log in to the game to send it to the database)')); return; }
      const { error } = await supa.from('model_fixes').upsert({ model: id, fixes: list, updated_at: new Date().toISOString(), updated_by: s.session.user.id });
      say(error ? tx(`Zapisano w przeglądarce; baza: ${error.message}`, `Saved in the browser; database: ${error.message}`) : tx(`Zapisano (${list.length} poprawek) — trafią do gry przy następnej wersji`, `Saved (${list.length} fixes) — they reach the game in the next version`));
    } catch (e) { say(tx(`Zapisano w przeglądarce; baza niedostępna (${String(e)})`, `Saved in the browser; database unavailable (${String(e)})`)); }
  }
  function download(): void {
    const id = ctx.id();
    const blob = new Blob([JSON.stringify({ [id]: all() }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `poprawki-${id}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /** Po pokazaniu modelu: zapisane w przeglądarce (albo w bazie) poprawki ponad te z repozytorium — od razu widać je w podglądzie */
  async function applyPending(): Promise<void> {
    const id = ctx.id(), base = repo(id).length;
    let list = stored(id);
    try {
      const { supa } = await import('../net/supa');
      const { data } = await supa.from('model_fixes').select('fixes').eq('model', id).maybeSingle();
      const remote = (data as { fixes?: Fix[] } | null)?.fixes;
      if (Array.isArray(remote) && remote.length > list.length) list = remote;
    } catch { /* bez bazy: tylko przeglądarka */ }
    const extra = list.slice(base);
    const cur = ctx.current();
    if (!extra.length || !cur || id !== ctx.id()) return;
    const byKey = new Map<string, THREE.Mesh>();
    cur.traverse((o) => { const m = o as THREE.Mesh; const fx = m.userData?.fx as [string, number] | undefined; if (m.isMesh && fx) byKey.set(`${fx[0]}:${fx[1]}`, m); });
    let miss = 0;
    const touched: THREE.BufferGeometry[] = [];
    for (const f of extra) {
      const mesh = byKey.get(`${f.g}:${f.i}`);
      if (!mesh) { miss++; continue; }
      if (pendingDone.has(mesh.geometry)) continue; // ten model był już pokazany w tej sesji — poprawki już są
      if (!touched.includes(mesh.geometry)) touched.push(mesh.geometry);
      const P = (mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      const { list: isls } = islands(P);
      const island = findIsland(isls, f);
      if (!island) { miss++; continue; }
      transformIsland(P, island, f.m);
      (mesh.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      islandCache.delete(mesh.geometry);
    }
    for (const g of touched) pendingDone.add(g);
    say(tx(`Poprawki spoza gry: ${extra.length - miss}${miss ? `, nie pasuje: ${miss}` : ''}`, `Fixes not yet in the game: ${extra.length - miss}${miss ? `, not matching: ${miss}` : ''}`));
  }

  setOn(false);
  return {
    onModel: () => { deselect(); edits = []; undo.length = 0; void applyPending(); },
  };
}
