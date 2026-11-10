/**
 * Edytor poprawek w podglądzie modeli (Michał 10.11.2026: „przesuwać niektóre rzeczy, poprawiać model i zapisać” —
 * skrócony Blender bez modelowania). Przycisk „Edytuj”: kliknięcie części budynku (beczka, belka, deska, stojak)
 * zaznacza ją (Ctrl — kilka), strzałki przesuwają (1), łuki obracają (2), kwadraty skalują (3); Del usuwa, Ctrl+Z cofa,
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
  const undo: { mesh: THREE.Mesh; isl: Island; P: Float32Array; N: Float32Array | null; fix: Fix }[][] = [];
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
  const modeBtns = ([['translate', tx('Przesuń (1)', 'Move (1)')], ['rotate', tx('Obróć (2)', 'Rotate (2)')], ['scale', tx('Skaluj (3)', 'Scale (3)')]] as const)
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
  // podświetlenie zaznaczonych części: półprzezroczysta żółć na wierzchu (siatka drutowa na WebGPU bywa niewidoczna)
  const hiMat = new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.38, depthTest: false, depthWrite: false });
  interface Piece { mesh: THREE.Mesh; isl: Island; P: Float32Array; N: Float32Array | null; c: [number, number, number]; hi: THREE.Mesh }
  let sel: Piece[] = [];
  let start = new THREE.Matrix4();
  tc.addEventListener('dragging-changed', (e) => {
    const v = (e as unknown as { value: boolean }).value;
    ctx.orbit.enabled = !v;
    if (!v) commit();
  });
  tc.addEventListener('objectChange', () => live());

  function setOn(v: boolean): void {
    on = v;
    editBtn.setAttribute('aria-pressed', String(on));
    for (const t of tools) (t as HTMLElement).hidden = !on;
    panel.hidden = !on;
    if (!on) deselect();
    setMode((tc.mode as 'translate' | 'rotate' | 'scale') ?? 'translate');
    say(on ? tx('Kliknij część (Ctrl — kilka naraz)', 'Click a part (Ctrl — several at once)') : '');
    if (on) buildPanel();
  }
  function setMode(m: 'translate' | 'rotate' | 'scale'): void {
    tc.setMode(m);
    for (const b of modeBtns) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
  }
  function say(t: string): void { status.textContent = t; }

  /** Macierz zmiany w układzie modelu (siatki leżą w grupach bez przesunięć, więc ich układ = układ modelu) */
  function deltaFor(mesh: THREE.Mesh): THREE.Matrix4 {
    proxy.updateMatrixWorld();
    const D = proxy.matrixWorld.clone().multiply(start.clone().invert());
    mesh.updateMatrixWorld();
    const W = mesh.matrixWorld;
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
  function islandGeo(mesh: THREE.Mesh, island: Island): THREE.BufferGeometry {
    const src = mesh.geometry.getAttribute('position') as THREE.BufferAttribute, out = new Float32Array(island.tris.length * 9);
    let k = 0;
    for (const t of island.tris) for (let j = 0; j < 3; j++, k++) { const vi = t * 3 + j; out[k * 3] = src.getX(vi); out[k * 3 + 1] = src.getY(vi); out[k * 3 + 2] = src.getZ(vi); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(out, 3)); return g;
  }
  function refreshHi(p: Piece): void { p.hi.geometry.dispose(); p.hi.geometry = islandGeo(p.mesh, p.isl); }
  function live(): void {
    for (const p of sel) { writeIsland(p.mesh, p.isl, p.P, p.N, deltaFor(p.mesh)); refreshHi(p); }
  }
  /** Uchwyt w środku zaznaczenia, bez obrotu */
  function placeProxy(): void {
    if (!sel.length) { tc.detach(); return; }
    const c = new THREE.Vector3(), w = new THREE.Vector3();
    for (const p of sel) { p.mesh.updateMatrixWorld(); c.add(w.set(...p.c).applyMatrix4(p.mesh.matrixWorld)); }
    proxy.position.copy(c.divideScalar(sel.length));
    proxy.rotation.set(0, 0, 0); proxy.scale.set(1, 1, 1);
    proxy.updateMatrixWorld();
    start = proxy.matrixWorld.clone();
    tc.attach(proxy);
  }
  /** Koniec ruchu: po jednej poprawce na część (macierz od stanu z chwili zaznaczenia), nowy punkt startu */
  function commit(): void {
    if (!sel.length) return;
    const step: { p: Piece; P: Float32Array; N: Float32Array | null; fix: Fix }[] = [];
    for (const p of sel) {
      const L = deltaFor(p.mesh);
      if (L.equals(new THREE.Matrix4())) continue;
      const [g, i] = p.mesh.userData.fx as [string, number];
      const fix: Fix = { g, i, c: p.c.map(r4) as [number, number, number], n: p.isl.tris.length, m: L.elements.map(r4) };
      edits.push(fix);
      step.push({ p, P: p.P, N: p.N, fix });
      const snap = snapshot(p.mesh, p.isl);
      p.P = snap.P; p.N = snap.N; p.c = centerOf(snap.P);
    }
    if (step.length) undo.push(step.map((u) => ({ mesh: u.p.mesh, isl: u.p.isl, P: u.P, N: u.N, fix: u.fix })));
    placeProxy();
    say(tx(`Zmiany do zapisania: ${edits.length}`, `Unsaved changes: ${edits.length}`));
  }
  function addPiece(mesh: THREE.Mesh, island: Island): void {
    const snap = snapshot(mesh, island);
    const hi = new THREE.Mesh(islandGeo(mesh, island), hiMat);
    hi.renderOrder = 999;
    mesh.add(hi);
    sel.push({ mesh, isl: island, P: snap.P, N: snap.N, c: centerOf(snap.P), hi });
  }
  function toggle(mesh: THREE.Mesh, island: Island, multi: boolean): void {
    const k = sel.findIndex((p) => p.mesh === mesh && p.isl === island);
    if (!multi) { deselect(); addPiece(mesh, island); }
    else if (k >= 0) { const [p] = sel.splice(k, 1); p!.hi.removeFromParent(); p!.hi.geometry.dispose(); }
    else addPiece(mesh, island);
    placeProxy();
    const tris = sel.reduce((a, p) => a + p.isl.tris.length, 0);
    say(sel.length ? tx(`Zaznaczone części: ${sel.length} (${tris} trójkątów)`, `Selected parts: ${sel.length} (${tris} triangles)`) : tx('Kliknij część (Ctrl — kilka naraz)', 'Click a part (Ctrl — several at once)'));
    markPanel();
  }
  function selectMesh(mesh: THREE.Mesh, multi: boolean): void {
    if (!multi) deselect();
    for (const island of isl(mesh.geometry).list) if (!sel.some((p) => p.mesh === mesh && p.isl === island)) addPiece(mesh, island);
    placeProxy();
    say(tx(`Zaznaczone części: ${sel.length}`, `Selected parts: ${sel.length}`));
    markPanel();
  }
  function deselect(): void {
    tc.detach();
    for (const p of sel) { p.hi.removeFromParent(); p.hi.geometry.dispose(); }
    sel = [];
    markPanel();
  }
  function removeSel(): void {
    if (!sel.length) return;
    // usunięcie = zgniecenie części w punkt (liczba trójkątów zostaje, więc poprawki dalej trafiają w wyspy)
    const step: { mesh: THREE.Mesh; isl: Island; P: Float32Array; N: Float32Array | null; fix: Fix }[] = [];
    for (const p of sel) {
      const c = new THREE.Vector3(...p.c);
      const L = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
      const [g, i] = p.mesh.userData.fx as [string, number];
      const fix: Fix = { g, i, c: p.c.map(r4) as [number, number, number], n: p.isl.tris.length, m: L.elements.map((v) => Math.round(v * 1e6) / 1e6) };
      writeIsland(p.mesh, p.isl, p.P, p.N, L);
      edits.push(fix);
      step.push({ mesh: p.mesh, isl: p.isl, P: p.P, N: p.N, fix });
    }
    undo.push(step);
    deselect();
    say(tx(`Usunięto. Zmiany do zapisania: ${edits.length}`, `Removed. Unsaved changes: ${edits.length}`));
  }
  function undoLast(): void {
    const step = undo.pop();
    if (!step) return;
    deselect();
    for (const u of step.reverse()) {
      writeIsland(u.mesh, u.isl, u.P, u.N, new THREE.Matrix4());
      const k = edits.lastIndexOf(u.fix);
      if (k >= 0) edits.splice(k, 1);
    }
    say(tx(`Cofnięto. Zmiany do zapisania: ${edits.length}`, `Undone. Unsaved changes: ${edits.length}`));
  }

  // ---------- lista warstw po prawej: grupy (pokaż/ukryj) i siatki po materiale (klik zaznacza całą siatkę) ----------
  const panel = document.createElement('div');
  panel.className = 'edit-layers';
  panel.style.cssText = 'position:fixed;right:12px;top:96px;bottom:44px;width:230px;overflow:auto;background:rgba(24,21,17,.92);border:1px solid #5a4a2c;padding:8px;font-size:12px;color:#e6d6b4;z-index:5';
  document.body.append(panel);
  const GROUP_NAME: Record<string, string> = { base: tx('Bryła', 'Body'), shell: tx('Dach i mury', 'Roof and walls'), interior: tx('Wnętrze', 'Interior'), floor: tx('Posadzka', 'Floor'), ceiling: tx('Sufit sali', 'Hall ceiling') };
  const rows = new Map<THREE.Mesh, HTMLButtonElement>();
  function buildPanel(): void {
    panel.textContent = '';
    rows.clear();
    const cur = ctx.current();
    if (!cur) return;
    const h = document.createElement('div');
    h.textContent = tx('Warstwy (klik — zaznacz całą, Ctrl — dodaj)', 'Layers (click — select all, Ctrl — add)');
    h.style.cssText = 'font-weight:600;margin-bottom:6px';
    panel.append(h);
    const byGroup = new Map<string, THREE.Mesh[]>();
    cur.traverse((o) => { const m = o as THREE.Mesh; const fx = m.userData?.fx as [string, number, string] | undefined; if (m.isMesh && fx) { if (!byGroup.has(fx[0])) byGroup.set(fx[0], []); byGroup.get(fx[0])!.push(m); } });
    for (const [g, meshes] of byGroup) {
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;gap:6px;margin:8px 0 3px;border-bottom:1px solid #4a3e22;padding-bottom:2px';
      const eye = document.createElement('input');
      eye.type = 'checkbox'; eye.checked = meshes[0]!.parent?.visible !== false && meshes.every((m) => m.visible);
      eye.title = tx('Pokaż / ukryj', 'Show / hide');
      eye.onchange = () => { for (const m of meshes) m.visible = eye.checked; };
      const name = document.createElement('span'); name.textContent = `${GROUP_NAME[g] ?? g} (${meshes.length})`;
      head.append(eye, name);
      panel.append(head);
      for (const m of meshes) {
        const fx = m.userData.fx as [string, number, string];
        const b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = 'display:block;width:100%;text-align:left;margin:1px 0;padding:3px 6px;min-height:24px;font:inherit;color:inherit;background:#2e2b24;border:1px solid #3e3626;cursor:pointer';
        b.textContent = `${fx[2] ?? '?'} · ${isl(m.geometry).list.length} ${tx('części', 'parts')}`;
        b.onclick = (e) => selectMesh(m, e.ctrlKey || e.metaKey || e.shiftKey);
        rows.set(m, b);
        panel.append(b);
      }
    }
    markPanel();
  }
  function markPanel(): void {
    for (const [m, b] of rows) b.style.borderColor = sel.some((p) => p.mesh === m) ? '#e9c766' : '#3e3626';
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
    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    const hits = ray.intersectObject(cur, true).filter((h) => (h.object as THREE.Mesh).isMesh && h.object.userData.fx && h.faceIndex != null);
    const h = hits.find((x) => { for (let o: THREE.Object3D | null = x.object; o; o = o.parent) if (!o.visible) return false; return true; });
    if (!h) { if (!multi) { deselect(); say(tx('Kliknij część (Ctrl — kilka naraz)', 'Click a part (Ctrl — several at once)')); } return; }
    const mesh = h.object as THREE.Mesh;
    const { of, list } = isl(mesh.geometry);
    toggle(mesh, list[of[h.faceIndex!]!]!, multi);
  });
  window.addEventListener('keydown', (e) => {
    if (!on || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) { if (k === 'z') { e.preventDefault(); undoLast(); } return; }
    // 1/2/3 zamiast W/E/R: WASD lata kamerą (viewer.ts)
    if (k === '1') setMode('translate');
    else if (k === '2') setMode('rotate');
    else if (k === '3') setMode('scale');
    else if (k === 'delete' || k === 'backspace') removeSel();
    else if (k === 'escape') deselect();
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

  // do sprawdzania z konsoli / testów
  (window as unknown as { __modelEditor: unknown }).__modelEditor = { info: () => ({ on, sel: sel.map((p) => ({ n: p.isl.tris.length, c: p.c, g: p.mesh.userData.fx })), edits: edits.length }) };
  // kto może edytować (Michał 10.11.2026): lokalnie (localhost) każdy, na stronie gry tylko twórca (admins.owner)
  const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  editBtn.hidden = !LOCAL;
  if (!LOCAL) void (async () => {
    try {
      const { supa } = await import('../net/supa');
      const { data: s } = await supa.auth.getSession();
      if (!s.session) return;
      const { data } = await supa.from('admins').select('owner').eq('user_id', s.session.user.id).maybeSingle();
      editBtn.hidden = !(data as { owner?: boolean } | null)?.owner;
    } catch { /* bez bazy: bez edycji na stronie */ }
  })();
  setOn(false);
  return {
    onModel: () => { deselect(); edits = []; undo.length = 0; void applyPending(); if (on) buildPanel(); },
  };
}
