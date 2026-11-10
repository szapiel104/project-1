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
import { applyFix, islands, unitShape, type Fix, type Island } from '../render/modelfix';
import { SHAPES, shapeLabel, type Shape } from '../render/shapes';
import { icon } from './editorIcons';
import type { MenuItem } from './menuBar';
import { buildingMaterialInfo, partMesh } from '../render/buildings';
import { photoUrlFor } from '../render/textures';
import { propGeometry, propMaterial, type PropName } from '../render/props';
import REPO_FIXES from '../data/modelFixes.json';
import { tx } from '../i18n';

interface Ctx {
  renderer: { render: (s: THREE.Object3D, c: THREE.Camera) => void; domElement: HTMLCanvasElement };
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

export function createModelEditor(ctx: Ctx): { onModel: () => void; guard: (go: () => void) => void; menus: () => Record<'file' | 'edit' | 'tools' | 'add', MenuItem[]> } {
  let on = false;
  /** Poprawki tej sesji (dla bieżącego modelu), po poprawkach z repozytorium */
  let edits: Fix[] = [];
  /** cofanie: każdy krok to lista funkcji przywracających stan sprzed niego */
  const undo: (() => void)[][] = [];
  const savedNow = new Set<string>();   // modele zapisane w tej sesji (ich wczytane dane są sprzed zapisu)
  const islandCache = new WeakMap<THREE.BufferGeometry, { of: Int32Array; list: Island[] }>();
  const isl = (g: THREE.BufferGeometry): { of: Int32Array; list: Island[] } => {
    let v = islandCache.get(g);
    if (!v) { v = islands((g.getAttribute('position') as THREE.BufferAttribute).array as Float32Array); islandCache.set(g, v); }
    return v;
  };

  // ---------- przyciski ----------
  const wrap = document.createElement('div');
  wrap.className = 'edit-tools';
  wrap.style.cssText = 'display:flex;gap:4px;align-items:center';
  const btn = (label: string, f: () => void, title = ''): HTMLButtonElement => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.onclick = f; return b;
  };
  /** przycisk z ikoną i podpowiedzią (pasek narzędzi jak w programach graficznych) */
  const ib = (ico: string, label: string, f: () => void): HTMLButtonElement => {
    const b = btn('', f, label);
    b.innerHTML = icon(ico);
    b.setAttribute('aria-label', label);
    b.classList.add('ico');
    return b;
  };
  const sep = (): HTMLElement => { const d = document.createElement('span'); d.className = 'ico-sep'; d.setAttribute('aria-hidden', 'true'); return d; };
  const editBtn = btn(tx('Edytuj', 'Edit'), () => setOn(!on), tx('Kliknij część modelu, żeby ją przesunąć, obrócić albo usunąć', 'Click a part of the model to move, rotate or remove it'));
  const modeBtns = ([['translate', 'move', tx('Przesuń (1)', 'Move (1)')], ['rotate', 'rotate', tx('Obróć (2)', 'Rotate (2)')], ['scale', 'scale', tx('Skaluj (3)', 'Scale (3)')]] as const)
    .map(([m, ico, l]) => { const b = ib(ico, l, () => setMode(m)); b.dataset.mode = m; return b; });
  const delBtn = ib('del', tx('Usuń część (Del)', 'Remove part (Del)'), () => removeSel());
  const undoBtn = ib('undo', tx('Cofnij (Ctrl+Z)', 'Undo (Ctrl+Z)'), () => undoLast());
  const saveBtn = ib('save', tx('Zapisz (Ctrl+S)', 'Save (Ctrl+S)'), () => void save());
  const fileBtn = ib('file', tx('Pobierz plik poprawek', 'Download fixes file'), () => download());
  const mirXBtn = ib('mirrorX', tx('Odbij lustrzanie w osi X', 'Mirror along X'), () => mirror(0));
  const mirZBtn = ib('mirrorZ', tx('Odbij lustrzanie w osi Z', 'Mirror along Z'), () => mirror(2));
  const dropBtn = ib('drop', tx('Postaw na ziemi (spód na wysokości 0)', 'Drop to the ground (bottom at height 0)'), () => dropToGround());
  const focusBtn = ib('focus', tx('Pokaż zaznaczenie (F)', 'Frame selection (F)'), () => focusSel());
  const status = document.createElement('span');
  status.style.cssText = 'align-self:center;font-size:12px;color:#e6d6b4;padding:0 6px';
  const dupBtn = ib('copy', tx('Kopiuj (Ctrl+D)', 'Duplicate (Ctrl+D)'), () => duplicateSel());
  const dblBtn = ib('both', tx('Widać z obu stron — ściana lub płachta widoczna też od tyłu', 'Visible from both sides — a wall or sheet seen from behind too'), () => doubleSel());
  // ---------- inspektor na dole (jak w silnikach gier): położenie i obrót liczbami, paleta tekstur, nowe bryły ----------
  const insp = document.createElement('div');
  insp.className = 'edit-inspector';
  insp.style.cssText = 'position:fixed;left:var(--insp-left,260px);right:0;bottom:0;height:var(--insp-h,230px);grid-template-rows:minmax(0,1fr);background:rgba(24,21,17,.95);border-top:1px solid #5a4a2c;z-index:6;display:grid;grid-template-columns:auto 1fr;gap:12px;padding:8px 10px;font-size:12px;color:#e6d6b4';
  document.body.append(insp);
  const selCss = 'font:inherit;font-size:12px;color:#e8e0cc;background:#2e2b24;border:1px solid #3a362d;min-height:28px;padding:2px 4px';
  const title = (t: string): HTMLElement => { const h = document.createElement('div'); h.textContent = t; h.style.cssText = 'font-weight:600;margin-bottom:4px;color:#e9c766'; return h; };
  // 1) przekształcenie liczbami, jak w inspektorze silników gier: położenie środka (cm), obrót (°) i skala (%) osobno w osiach
  const tr = document.createElement('div');
  tr.style.cssText = 'overflow-y:auto;min-height:0;padding-right:4px';
  const num = (ttl: string, step: number): HTMLInputElement => { const i = document.createElement('input'); i.type = 'number'; i.step = String(step); i.title = ttl; i.setAttribute('aria-label', ttl); i.style.cssText = selCss + ';width:66px'; return i; };
  const axisLab = (a: string, col: string): HTMLElement => { const l = document.createElement('span'); l.textContent = a; l.style.cssText = `color:${col};font-weight:600;width:10px;text-align:right`; return l; };
  const AX = [['X', '#e8746a'], ['Y', '#8fd16a'], ['Z', '#6aa8e8']] as const;
  const posIn = AX.map(([a]) => num(tx(`Położenie ${a} (cm)`, `Position ${a} (cm)`), 1));
  const rotIn = AX.map(([a]) => num(tx(`Obrót ${a} (°)`, `Rotation ${a} (°)`), 5));
  const sclIn = AX.map(([a]) => num(tx(`Skala ${a} (%)`, `Scale ${a} (%)`), 5));
  const row3 = (label: string, ins: HTMLInputElement[], extra?: HTMLElement): HTMLElement => {
    const d = document.createElement('div'); d.style.cssText = 'display:flex;gap:3px;align-items:center;margin:3px 0';
    const l = document.createElement('span'); l.textContent = label; l.style.cssText = 'width:58px';
    d.append(l); ins.forEach((inp, k) => d.append(axisLab(AX[k]![0], AX[k]![1]), inp));
    if (extra) d.append(extra);
    return d;
  };
  const uniLab = document.createElement('label');
  uniLab.title = tx('Skaluj jednakowo we wszystkich osiach', 'Scale uniformly on all axes');
  uniLab.style.cssText = 'display:flex;gap:3px;align-items:center;margin-left:4px';
  const uni = document.createElement('input'); uni.type = 'checkbox'; uni.checked = true;
  uniLab.append(uni, document.createTextNode('🔗'));
  const info = document.createElement('div');
  info.style.cssText = 'color:#bfb294;margin:2px 0 4px;font-size:11.5px';
  const cur = (): THREE.Object3D | null => ctx.current();
  /** inspektor ← uchwyt */
  function syncFields(): void {
    const c = cur();
    const dis = !sel.length || !c;
    for (const i of [...posIn, ...rotIn, ...sclIn]) i.disabled = dis;
    if (dis) { for (const i of [...posIn, ...rotIn, ...sclIn]) i.value = ''; info.textContent = tx('Nic nie zaznaczono', 'Nothing selected'); return; }
    const lp = c!.worldToLocal(proxy.position.clone());
    [lp.x, lp.y, lp.z].forEach((v, k) => { if (document.activeElement !== posIn[k]) posIn[k]!.value = String(Math.round(v * 1000) / 10); });
    const r = proxy.rotation;
    [r.x, r.y, r.z].forEach((v, k) => { if (document.activeElement !== rotIn[k]) rotIn[k]!.value = String(Math.round(THREE.MathUtils.radToDeg(v) * 10) / 10); });
    const sc = proxy.scale;
    [sc.x, sc.y, sc.z].forEach((v, k) => { if (document.activeElement !== sclIn[k]) sclIn[k]!.value = String(Math.round(v * 1000) / 10); });
    const b = selBox();
    const sz = b.getSize(new THREE.Vector3());
    const tris = sel.reduce((a, p) => a + p.isl.tris.length, 0);
    info.textContent = tx(`Zaznaczone: ${sel.length} · ${tris} trójkątów · wymiary ${Math.round(sz.x * 100)} × ${Math.round(sz.y * 100)} × ${Math.round(sz.z * 100)} cm`,
      `Selected: ${sel.length} · ${tris} triangles · size ${Math.round(sz.x * 100)} × ${Math.round(sz.y * 100)} × ${Math.round(sz.z * 100)} cm`);
  }
  /** uchwyt ← inspektor (po Enterze albo zmianie pola) */
  function fromFields(changed?: HTMLInputElement): void {
    const c = cur();
    if (!sel.length || !c) return;
    const n = (i: HTMLInputElement, d: number): number => { const v = Number(i.value); return i.value === '' || !Number.isFinite(v) ? d : v; };
    const lp = c.worldToLocal(proxy.position.clone());
    proxy.position.copy(c.localToWorld(new THREE.Vector3(n(posIn[0]!, lp.x * 100) / 100, n(posIn[1]!, lp.y * 100) / 100, n(posIn[2]!, lp.z * 100) / 100)));
    proxy.rotation.set(...rotIn.map((i) => THREE.MathUtils.degToRad(n(i, 0))) as [number, number, number]);
    if (uni.checked && changed && sclIn.includes(changed)) { const v = n(changed, 100); for (const i of sclIn) i.value = String(v); }
    const sv = sclIn.map((i) => { const v = n(i, 100) / 100; return Math.abs(v) < 0.001 ? 0.001 : v; });
    proxy.scale.set(sv[0]!, sv[1]!, sv[2]!);
    proxy.updateMatrixWorld();
    live(); commit();
  }
  for (const i of [...posIn, ...rotIn, ...sclIn]) {
    i.addEventListener('change', () => fromFields(i));
    i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') i.blur(); });   // bez skrótów edytora i lotu WASD przy pisaniu
  }
  const stepSel = (opts: [string, string][], f: (v: number) => void): HTMLSelectElement => {
    const s = document.createElement('select'); s.style.cssText = selCss;
    for (const [v, l] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = l; s.append(o); }
    s.onchange = () => f(Number(s.value));
    return s;
  };
  let snapMove = 0.01, snapRot = 5;
  const snapLab = document.createElement('label');
  snapLab.style.cssText = 'display:flex;gap:4px;align-items:center';
  const snap = document.createElement('input'); snap.type = 'checkbox';
  const applySnap = (): void => {
    tc.setTranslationSnap(snap.checked ? snapMove : null);
    tc.setRotationSnap(snap.checked ? THREE.MathUtils.degToRad(snapRot) : null);
    tc.setScaleSnap(snap.checked ? 0.05 : null);
    for (const i of posIn) i.step = String(snap.checked ? snapMove * 100 : 1);
    for (const i of rotIn) i.step = String(snap.checked ? snapRot : 5);
  };
  snap.onchange = applySnap;
  snapLab.append(snap, document.createTextNode(tx('przyciąganie', 'snap')));
  const moveStep = stepSel([['0.01', '1 cm'], ['0.05', '5 cm'], ['0.1', '10 cm'], ['0.25', '25 cm'], ['0.5', '50 cm']], (v) => { snapMove = v; applySnap(); });
  const rotStep = stepSel([['5', '5°'], ['15', '15°'], ['45', '45°'], ['90', '90°']], (v) => { snapRot = v; applySnap(); });
  moveStep.title = tx('Krok przesuwania', 'Move step'); rotStep.title = tx('Krok obrotu', 'Rotation step');
  const spaceLab = document.createElement('label');
  spaceLab.style.cssText = 'display:flex;gap:4px;align-items:center';
  const space = document.createElement('input'); space.type = 'checkbox';
  space.onchange = () => tc.setSpace(space.checked ? 'local' : 'world');
  spaceLab.append(space, document.createTextNode(tx('osie części', 'part axes')));
  const opts = document.createElement('div'); opts.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px';
  opts.append(snapLab, moveStep, rotStep, spaceLab);
  tr.append(title(tx('Przekształcenie', 'Transform')), info, row3(tx('Położenie', 'Position'), posIn), row3(tx('Obrót', 'Rotation'), rotIn), row3(tx('Skala %', 'Scale %'), sclIn, uniLab), opts);
  // 2) paleta tekstur: podgląd zdjęcia w barwie materiału; klik — nadaj zaznaczonym, przeciągnij na model — nadaj temu, na co upuścisz
  const pal = document.createElement('div');
  pal.style.cssText = 'display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden';
  const palHead = document.createElement('div');
  palHead.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:4px';
  const find = document.createElement('input'); find.type = 'search'; find.placeholder = tx('szukaj tekstury…', 'search textures…'); find.style.cssText = selCss + ';width:150px';
  const palTitle = title(tx('Tekstury — klik: zaznaczonym, przeciągnij: na część', 'Textures — click: selected, drag: onto a part'));
  palTitle.style.cssText += ';margin:0;font-weight:400;color:#bfb294;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1';
  // zakładki: Tekstury | Zasoby (bryły i gotowe modele z paczek, jak okno zasobów w silnikach gier)
  const tabBtn = (label: string, f: () => void): HTMLButtonElement => { const b = btn(label, f); b.style.cssText = 'font:inherit;font-size:12px;padding:3px 10px;min-height:26px;color:#e8e0cc;background:#2e2b24;border:1px solid #3a362d;cursor:pointer'; return b; };
  const tabTex = tabBtn(tx('Tekstury', 'Textures'), () => showTab('tex'));
  const tabAssets = tabBtn(tx('Zasoby', 'Assets'), () => showTab('assets'));
  palHead.append(tabTex, tabAssets, palTitle, find);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:5px;overflow-y:auto;padding-right:4px;flex:1;min-height:0;align-content:start';
  let picked = 'castle';
  const swatches: HTMLElement[] = [];
  for (const m of buildingMaterialInfo()) {
    const url = m.pattern ? photoUrlFor(m.pattern) : null;
    const sw = document.createElement('button');
    sw.type = 'button'; sw.draggable = true; sw.title = `${m.name}${m.pattern ? ` (${m.pattern})` : ''}`;
    sw.dataset.name = m.name;
    sw.style.cssText = `display:flex;flex-direction:column;align-items:stretch;padding:0;border:1px solid #3e3626;background:#2e2b24;color:inherit;font:inherit;font-size:10.5px;cursor:grab`;
    const img = document.createElement('span');
    img.style.cssText = `display:block;height:44px;background-color:${m.color};${url ? `background-image:url(${url});background-size:cover;background-blend-mode:multiply;` : ''}`;
    const cap = document.createElement('span'); cap.textContent = m.name; cap.style.cssText = 'padding:2px 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    sw.append(img, cap);
    sw.onclick = () => { picked = m.name; markSwatch(); if (sel.length) retexture(m.name); else say(tx(`Wybrana tekstura: ${m.name} (dla nowych brył)`, `Texture picked: ${m.name} (for new shapes)`)); };
    sw.ondragstart = (e) => { e.dataTransfer?.setData('text/plain', m.name); picked = m.name; markSwatch(); };
    swatches.push(sw);
    grid.append(sw);
  }
  const markSwatch = (): void => { for (const sw of swatches) sw.style.borderColor = sw.dataset.name === picked ? '#e9c766' : '#3e3626'; };
  markSwatch();
  find.oninput = () => { const q = find.value.trim().toLowerCase(); for (const sw of swatches) sw.hidden = !!q && !sw.title.toLowerCase().includes(q); };
  const assets = document.createElement('div');
  assets.style.cssText = grid.style.cssText + ';grid-template-columns:repeat(auto-fill,minmax(84px,1fr));padding-bottom:6px';
  assets.style.display = 'none';
  pal.append(palHead, grid, assets);
  function showTab(t: 'tex' | 'assets'): void {
    // style.display, nie hidden — inline display:grid przykrywa atrybut hidden (obie siatki naraz, Michał 10.11.2026)
    grid.style.display = t === 'tex' ? 'grid' : 'none'; assets.style.display = t === 'assets' ? 'grid' : 'none'; find.style.display = t === 'tex' ? '' : 'none'; grpSel.style.display = t === 'assets' ? '' : 'none';
    palTitle.textContent = t === 'tex' ? tx('klik: zaznaczonym, przeciągnij: na część', 'click: selected, drag: onto a part') : tx('klik albo przeciągnij na model — dodaje w środku widoku / w miejscu upuszczenia', 'click or drag onto the model — adds at the view centre / where dropped');
    for (const [b, on] of [[tabTex, t === 'tex'], [tabAssets, t === 'assets']] as const) { b.style.borderColor = on ? '#e9c766' : '#3a362d'; b.style.background = on ? '#4a3e22' : '#2e2b24'; }
    if (t === 'assets') buildAssets();
  }
  // zasoby: bryły (w wybranej teksturze) i gotowe modele z paczek; miniatury rysuje ta sama karta (jedna klatka na model)
  const ASSET_PROPS: [PropName, string][] = [['barrel', tx('beczka', 'barrel')], ['sack', tx('worek', 'sack')], ['basket', tx('kosz', 'basket')], ['apple', tx('jabłko', 'apple')], ['bun1', tx('chleb', 'bread')], ['bun2', tx('bułka', 'bun')], ['bun3', tx('bochenek', 'loaf')], ['fish', tx('ryba', 'fish')], ['torch', tx('pochodnia', 'torch')], ['sheaf', tx('snopek', 'sheaf')], ['ingots', tx('sztaby', 'ingots')], ['granite1', tx('głaz 1', 'boulder 1')], ['granite2', tx('głaz 2', 'boulder 2')], ['granite3', tx('głaz 3', 'boulder 3')]];
  /** rozmiar gotowego modelu w grze (modele z paczek mają szerokość 1) */
  const PROP_SIZE: Partial<Record<PropName, number>> = { barrel: 0.2, sack: 0.14, basket: 0.14, apple: 0.03, bun1: 0.06, bun2: 0.06, bun3: 0.06, fish: 0.12, torch: 0.4, sheaf: 0.3, ingots: 0.12, granite1: 0.3, granite2: 0.3, granite3: 0.3 };
  let assetsBuilt = false;
  function thumb(obj: THREE.Object3D): string {
    // jedna klatka modelu na pustej scenie, zrzut z płótna w tym samym zadaniu i przycięcie do kwadratu
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x2e2b24);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x554433, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 3, 2); sc.add(sun);
    sc.add(obj);
    const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() * 0.5 || 0.5;
    const cv = ctx.renderer.domElement, cam = new THREE.PerspectiveCamera(30, cv.width / Math.max(1, cv.height), r * 0.05, r * 20);
    cam.position.copy(c).add(new THREE.Vector3(1, 0.8, 1.2).normalize().multiplyScalar(r * 3.4)); cam.lookAt(c);
    ctx.renderer.render(sc, cam);
    const out = document.createElement('canvas'); out.width = out.height = 96;
    const side = Math.min(cv.width, cv.height);
    out.getContext('2d')!.drawImage(cv, (cv.width - side) / 2, (cv.height - side) / 2, side, side, 0, 0, 96, 96);
    sc.remove(obj);
    return out.toDataURL('image/jpeg', 0.85);
  }
  /** miniatury modeli z paczek: tekstury wczytują się w tle, więc rysujemy je jeszcze raz, gdy dojdą (inaczej czarne sylwetki) */
  const redraw: (() => void)[] = [];
  function assetTile(label: string, img: string, add: (at?: THREE.Vector3) => void, make?: () => THREE.Object3D): HTMLElement {
    const b = document.createElement('button');
    b.type = 'button'; b.draggable = true; b.title = label;
    b.style.cssText = 'display:flex;flex-direction:column;padding:0;border:1px solid #3e3626;background:#2e2b24;color:inherit;font:inherit;font-size:11px;cursor:grab';
    const im = document.createElement('img'); im.src = img; im.alt = ''; im.style.cssText = 'width:100%;aspect-ratio:1;object-fit:cover;display:block';
    const cap = document.createElement('span'); cap.textContent = label; cap.style.cssText = 'padding:2px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    b.append(im, cap);
    if (make) redraw.push(() => { try { im.src = thumb(make()); } catch { /* bez miniatury */ } });
    b.onclick = () => add();
    b.ondragstart = (e) => { e.dataTransfer?.setData('application/x-asset', label); dragAsset = add; };
    return b;
  }
  let dragAsset: ((at?: THREE.Vector3) => void) | null = null;
  function buildAssets(): void {
    if (assetsBuilt) return;
    assetsBuilt = true;
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb8ad96, roughness: 0.9 });
    for (const sh of SHAPES) {
      const label = shapeLabel(sh, tx);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(unitShape(sh)), 3)); geo.computeVertexNormals();
      assets.append(assetTile(label, thumb(new THREE.Mesh(geo, stoneMat)), (at) => addShape(sh, picked, grpSel.value, at)));
    }
    const maps: THREE.Texture[] = [];
    for (const [p, label] of ASSET_PROPS) {
      const make = (): THREE.Object3D => new THREE.Mesh(propGeometry(p), propMaterial(p));
      const m = propMaterial(p);
      if (m.map) maps.push(m.map);
      assets.append(assetTile(label, '', (at) => addProp(p, grpSel.value, at), make));
    }
    // czekamy na zdjęcia tekstur (do 8 s), potem rysujemy wszystkie miniatury
    const t0 = performance.now();
    const wait = (): void => {
      const ready = maps.every((t) => (t.image as HTMLImageElement | undefined)?.complete && (t.image as HTMLImageElement).naturalWidth > 0);
      if (ready || performance.now() - t0 > 8000) { requestAnimationFrame(() => { for (const r of redraw) r(); }); return; }
      setTimeout(wait, 150);
    };
    wait();
  }
  // 3) nowa bryła w wybranej teksturze
  // bryły i modele wybiera się w zakładce Zasoby (Michał 10.11.2026: „te wybory niech będą już w obiektach”);
  // tu tylko, do której części budynku trafia nowa rzecz
  const grpSel = document.createElement('select');
  grpSel.style.cssText = selCss;
  grpSel.title = tx('Gdzie dodać: bryła, wnętrze albo dach i mury (dach znika w widoku „Bez dachu”)', 'Where to add: body, interior or roof & walls');
  for (const [v, l] of [['base', tx('dodaj do: bryły', 'add to: body')], ['interior', tx('dodaj do: wnętrza', 'add to: interior')], ['shell', tx('dodaj do: dachu i murów', 'add to: roof & walls')]] as const) { const o = document.createElement('option'); o.value = v; o.textContent = l; grpSel.append(o); }
  palHead.append(grpSel);
  insp.append(tr, pal);
  // upuszczenie tekstury na model: część pod kursorem (cały przedmiot) dostaje teksturę
  ctx.canvas.addEventListener('dragover', (e) => { if (on) e.preventDefault(); });
  ctx.canvas.addEventListener('drop', (e) => {
    if (!on) return;
    e.preventDefault();
    if (e.dataTransfer?.types.includes('application/x-asset') && dragAsset) {
      // zasób upuszczony na model: stawiamy go w punkcie trafienia (albo w środku widoku)
      const r = ctx.canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), ctx.camera);
      const cur = ctx.current();
      const h = cur ? ray.intersectObject(cur, true).find((x) => (x.object as THREE.Mesh).isMesh && x.object.visible) : undefined;
      dragAsset(h ? cur!.worldToLocal(h.point.clone()) : undefined);
      dragAsset = null;
      return;
    }
    const mat = e.dataTransfer?.getData('text/plain');
    if (!mat) return;
    const hit = pick(e.clientX, e.clientY);
    if (!hit) { say(tx('Upuść teksturę na część modelu', 'Drop the texture onto a part of the model')); return; }
    const o = !hit.mesh.userData.temp ? objOf.get(nodeKey(hit.mesh, hit.island)) : undefined;
    if (o) selectObj(o, false); else toggle(hit.mesh, hit.island, false);
    retexture(mat);
  });
  const tools = [...modeBtns, sep(), dupBtn, mirXBtn, mirZBtn, dropBtn, dblBtn, delBtn, sep(), focusBtn, undoBtn, sep(), saveBtn, fileBtn, status];
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
  tc.addEventListener('objectChange', () => { live(); syncFields(); });

  function setOn(v: boolean): void {
    on = v;
    editBtn.setAttribute('aria-pressed', String(on));
    for (const t of tools) (t as HTMLElement).hidden = !on;
    panel.hidden = !on;
    insp.hidden = !on;
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
    // odbicie lustrzane: 2. i 3. wierzchołek zamieniają się miejscami, żeby przód trójkąta został na zewnątrz
    const ord = L.determinant() < 0 ? [0, 2, 1] : [0, 1, 2];
    let k = 0;
    for (const t of island.tris) for (let j = 0; j < 3; j++, k++) {
      const vi = t * 3 + ord[j]!, x = P0[k * 3]!, y = P0[k * 3 + 1]!, z = P0[k * 3 + 2]!;
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
    syncFields();
  }
  /** pudełko zaznaczenia w świecie */
  function selBox(): THREE.Box3 {
    const b = new THREE.Box3();
    for (const p of sel) { p.mesh.updateMatrixWorld(); p.hi.geometry.computeBoundingBox(); b.union(p.hi.geometry.boundingBox!.clone().applyMatrix4(p.mesh.matrixWorld)); }
    return b;
  }
  function mirror(axis: 0 | 1 | 2): void {
    if (!sel.length) { say(tx('Najpierw zaznacz część', 'Select a part first')); return; }
    proxy.scale.setComponent(axis, -proxy.scale.getComponent(axis));
    proxy.updateMatrixWorld();
    live(); commit();
    say(tx('Odbito lustrzanie', 'Mirrored'));
  }
  function dropToGround(): void {
    const c = cur();
    if (!sel.length || !c) { say(tx('Najpierw zaznacz część', 'Select a part first')); return; }
    const ground = c.localToWorld(new THREE.Vector3()).y;
    proxy.position.y -= selBox().min.y - ground;
    proxy.updateMatrixWorld();
    live(); commit();
  }
  function focusSel(): void {
    if (!sel.length) return;
    const b = selBox(), c = b.getCenter(new THREE.Vector3()), r = Math.max(0.15, b.getSize(new THREE.Vector3()).length());
    const dir = ctx.camera.position.clone().sub(ctx.orbit.target).normalize();
    ctx.orbit.target.copy(c);
    ctx.camera.position.copy(c).addScaledVector(dir, r * 1.8);
    ctx.orbit.update();
  }
  /** Koniec ruchu: po jednej poprawce na część (macierz od stanu z chwili zaznaczenia), nowy punkt startu */
  function commit(): void {
    if (!sel.length) return;
    const step: (() => void)[] = [];
    for (const p of sel) {
      const L = deltaFor(p.mesh);
      if (L.equals(new THREE.Matrix4())) continue;
      const P0 = p.P, N0 = p.N, mesh = p.mesh, island = p.isl;
      const temp = mesh.userData.temp as Fix | undefined;
      if (temp) {
        // dodana / skopiowana / przetekstur. część: zmiana trafia do jej własnej macierzy
        const prev = temp.m;
        temp.m = L.clone().multiply(new THREE.Matrix4().fromArray(prev)).elements.map(r4);
        step.push(() => { writeIsland(mesh, island, P0, N0, new THREE.Matrix4()); temp.m = prev; });
      } else {
        const [g, i] = mesh.userData.fx as [string, number];
        const fix: Fix = { g, i, c: p.c.map(r4) as [number, number, number], n: island.tris.length, m: L.elements.map(r4) };
        edits.push(fix);
        step.push(() => { writeIsland(mesh, island, P0, N0, new THREE.Matrix4()); dropEdit(fix); });
      }
      const snap = snapshot(mesh, island);
      p.P = snap.P; p.N = snap.N; p.c = centerOf(snap.P);
    }
    if (step.length) undo.push(step);
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
    if (mesh.userData.temp) island = wholeOf(mesh);
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
    syncFields();
  }
  function removeSel(): void {
    if (!sel.length) return;
    // usunięcie = zgniecenie części w punkt (liczba trójkątów zostaje, więc poprawki dalej trafiają w wyspy)
    const step: (() => void)[] = [];
    for (const p of sel) {
      if (p.mesh.userData.temp) { step.push(dropTemp(p.mesh)); continue; }
      const c = new THREE.Vector3(...p.c);
      const L = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
      const [g, i] = p.mesh.userData.fx as [string, number];
      const fix: Fix = { g, i, c: p.c.map(r4) as [number, number, number], n: p.isl.tris.length, m: L.elements.map((v) => Math.round(v * 1e6) / 1e6) };
      writeIsland(p.mesh, p.isl, p.P, p.N, L);
      edits.push(fix);
      const mesh = p.mesh, island = p.isl, P0 = p.P, N0 = p.N;
      step.push(() => { writeIsland(mesh, island, P0, N0, new THREE.Matrix4()); dropEdit(fix); });
    }
    undo.push(step);
    deselect();
    say(tx(`Usunięto. Zmiany do zapisania: ${edits.length}`, `Removed. Unsaved changes: ${edits.length}`));
  }
  function undoLast(): void {
    const step = undo.pop();
    if (!step) return;
    deselect();
    for (const f of step.reverse()) f();
    say(tx(`Cofnięto. Zmiany do zapisania: ${edits.length}`, `Undone. Unsaved changes: ${edits.length}`));
  }

  function dropEdit(fix: Fix): void { const k = edits.lastIndexOf(fix); if (k >= 0) edits.splice(k, 1); }
  /** cała siatka jako jedna część (dodane i skopiowane bryły chwyta się w całości) */
  const wholeCache = new WeakMap<THREE.BufferGeometry, Island>();
  function wholeOf(mesh: THREE.Mesh): Island {
    let w = wholeCache.get(mesh.geometry);
    if (!w) {
      const n = (mesh.geometry.getAttribute('position') as THREE.BufferAttribute).count / 3;
      w = { tris: Array.from({ length: n }, (_, k) => k), c: [0, 0, 0] };
      wholeCache.set(mesh.geometry, w);
    }
    return w;
  }

  // ---------- nowe części: kopie, zmiana tekstury, dodane bryły (tymczasowe siatki aż do zapisu i przeładowania) ----------
  const Q = 2000;
  /** siatka z gotowymi wierzchołkami (układ modelu) i materiałem gry; trzyma swoją poprawkę w userData.temp */
  function makeTemp(fix: Fix, P: Float32Array, mat: string): THREE.Mesh {
    const p16 = new Int16Array(P.length);
    for (let k = 0; k < P.length; k++) p16[k] = Math.max(-32768, Math.min(32767, Math.round(P[k]! * Q)));
    const mesh = partMesh(mat, new Uint8Array(p16.buffer), new Uint8Array(P.length / 3).fill(230), Q);
    // własna kopia geometrii (pamięć podręczna gry dzieli bryły o tym samym początku danych)
    mesh.geometry = mesh.geometry.clone();
    mesh.userData.temp = fix;
    mesh.userData.tempMat = mat;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    groupFor(fix.g).add(mesh);
    return mesh;
  }
  function groupFor(g: string): THREE.Object3D {
    const cur = ctx.current()!;
    let found: THREE.Object3D | null = null;
    cur.traverse((o) => { const fx = o.userData?.fx as [string] | undefined; if (!found && fx && fx[0] === g && o.parent) found = o.parent; });
    return found ?? cur;
  }
  /** usuwa tymczasową część i jej poprawkę; zwraca cofnięcie */
  function dropTemp(mesh: THREE.Mesh): () => void {
    const fix = mesh.userData.temp as Fix, parent = mesh.parent!, k = edits.indexOf(fix);
    const src = mesh.userData.src as (() => void) | undefined;
    mesh.removeFromParent();
    if (k >= 0) edits.splice(k, 1);
    src?.();
    return () => { parent.add(mesh); if (k >= 0) edits.splice(Math.min(k, edits.length), 0, fix); else edits.push(fix); mesh.userData.unsrc?.(); };
  }
  const offset = (): THREE.Matrix4 => new THREE.Matrix4().makeTranslation(0.06, 0, 0.06);
  function duplicateSel(): void {
    const made: THREE.Mesh[] = [], step: (() => void)[] = [];
    for (const p of sel) {
      const temp = p.mesh.userData.temp as Fix | undefined;
      if (temp && temp.k !== 'add') continue;      // kopia kopii: zapisz i przeładuj, potem kopiuj
      let fix: Fix, P: Float32Array;
      const m = offset();
      if (temp) {
        fix = { ...temp, m: m.clone().multiply(new THREE.Matrix4().fromArray(temp.m)).elements.map(r4) };
        P = new Float32Array(unitShape(temp.shape ?? 'box'));
        applyM(P, fix.m);
      } else {
        const [g, i, mat] = p.mesh.userData.fx as [string, number, string];
        fix = { k: 'dup', g, i, c: p.c.map(r4) as [number, number, number], n: p.isl.tris.length, m: m.elements.map(r4) };
        P = p.P.slice(); applyM(P, fix.m);
        fix.to = mat;
      }
      edits.push(fix);
      const mesh = makeTemp(fix, P, fix.to ?? 'wood');
      made.push(mesh);
      step.push(() => { mesh.removeFromParent(); dropEdit(fix); });
    }
    if (!made.length) { say(tx('Zaznacz część do skopiowania', 'Select a part to copy')); return; }
    undo.push(step);
    deselect();
    for (const mesh of made) addPiece(mesh, wholeOf(mesh));
    placeProxy(); markPanel();
    say(tx(`Skopiowano: ${made.length}. Przesuń kopię uchwytem.`, `Copied: ${made.length}. Move the copy with the gizmo.`));
  }
  /** Część widoczna z obu stron: kopia z odwróconymi trójkątami (tył staje się przodem) */
  function doubleSel(): void {
    const step: (() => void)[] = [];
    for (const p of sel) {
      if (p.mesh.userData.temp) continue;
      const [g, i, mat] = p.mesh.userData.fx as [string, number, string];
      const fix: Fix = { k: 'dbl', g, i, c: p.c.map(r4) as [number, number, number], n: p.isl.tris.length, m: new THREE.Matrix4().elements };
      edits.push(fix);
      const P = p.P.slice();
      for (let t = 0; t < P.length / 9; t++) for (let j = 0; j < 3; j++) { const a = t * 9 + 3 + j, b = t * 9 + 6 + j; const v = P[a]!; P[a] = P[b]!; P[b] = v; }
      const mesh = makeTemp(fix, P, mat);
      mesh.userData.locked = true;          // tył idzie za częścią — nie chwyta się go osobno
      step.push(() => { mesh.removeFromParent(); dropEdit(fix); });
    }
    if (!step.length) { say(tx('Zaznacz ścianę lub płachtę', 'Select a wall or a sheet')); return; }
    undo.push(step);
    say(tx(`Widać z obu stron: ${step.length}`, `Visible from both sides: ${step.length}`));
  }
  /** przekształcenie wierzchołków z naprawą kolejności przy odbiciu (tak samo jak w grze) */
  function applyM(P: Float32Array, m: number[]): void { applyFix(m, P); }
  function retexture(mat: string): void {
    if (!sel.length) { say(tx('Zaznacz części, którym zmienić teksturę', 'Select parts to retexture')); return; }
    const step: (() => void)[] = [], made: THREE.Mesh[] = [];
    for (const p of sel) {
      const temp = p.mesh.userData.temp as Fix | undefined;
      if (temp?.k === 'prop') continue;               // gotowe modele z paczek mają własną teksturę
      if (temp) {
        // tymczasowa część: nowa siatka z tym samym kształtem i nowym materiałem
        const old = p.mesh, parent = old.parent!, prevTo = temp.to;
        temp.to = mat;
        const P = new Float32Array((old.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array);
        old.removeFromParent();
        const mesh = makeTemp(temp, P, mat);
        mesh.userData.src = old.userData.src; mesh.userData.unsrc = old.userData.unsrc;
        made.push(mesh);
        step.push(() => { mesh.removeFromParent(); parent.add(old); temp.to = prevTo; });
        continue;
      }
      const [g, i, from] = p.mesh.userData.fx as [string, number, string];
      if (from === mat) continue;
      const fix: Fix = { k: 'mat', g, i, c: p.c.map(r4) as [number, number, number], n: p.isl.tris.length, to: mat, m: new THREE.Matrix4().elements };
      edits.push(fix);
      // źródło: część zgnieciona w punkt (w danych zostanie wycięta), nowa siatka z nowym materiałem w tym samym miejscu
      const src = p.mesh, island = p.isl, P0 = p.P, N0 = p.N, c = new THREE.Vector3(...p.c);
      const hide = (): void => writeIsland(src, island, P0, N0, new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z)));
      const show = (): void => writeIsland(src, island, P0, N0, new THREE.Matrix4());
      hide();
      const mesh = makeTemp(fix, P0.slice(), mat);
      mesh.userData.src = show; mesh.userData.unsrc = hide;
      made.push(mesh);
      step.push(() => { mesh.removeFromParent(); show(); dropEdit(fix); });
    }
    if (!step.length) return;
    undo.push(step);
    deselect();
    for (const mesh of made) addPiece(mesh, wholeOf(mesh));
    placeProxy(); markPanel();
    say(tx(`Nowa tekstura: ${mat} (${made.length})`, `New texture: ${mat} (${made.length})`));
  }
  function addShape(shape: Shape, mat: string, g: string, where?: THREE.Vector3): void {
    const cur = ctx.current();
    if (!cur) return;
    const at = where ?? cur.worldToLocal(ctx.orbit.target.clone());
    const m = new THREE.Matrix4().makeTranslation(at.x, where ? at.y + 0.1 : Math.max(0.1, at.y), at.z).multiply(new THREE.Matrix4().makeScale(0.2, 0.2, 0.2));
    const fix: Fix = { k: 'add', g, to: mat, shape, m: m.elements.map(r4) };
    edits.push(fix);
    const P = new Float32Array(unitShape(shape)); applyM(P, fix.m);
    const mesh = makeTemp(fix, P, mat);
    undo.push([() => { mesh.removeFromParent(); dropEdit(fix); }]);
    deselect();
    addPiece(mesh, wholeOf(mesh)); placeProxy(); markPanel();
    say(tx('Dodano bryłę — ustaw ją uchwytem (1/2/3)', 'Shape added — place it with the gizmo (1/2/3)'));
  }

  /** gotowy model z paczki (beczka, worek…): w podglądzie osobna siatka z kopią bryły, w grze dopisany do rekwizytów modelu */
  function addProp(name: PropName, g: string, where?: THREE.Vector3): void {
    const cur = ctx.current();
    if (!cur) return;
    const at = where ?? cur.worldToLocal(ctx.orbit.target.clone());
    const s = PROP_SIZE[name] ?? 0.2;
    const m = new THREE.Matrix4().makeTranslation(at.x, where ? at.y : Math.max(0, at.y - 0.2), at.z).multiply(new THREE.Matrix4().makeScale(s, s, s));
    const fix: Fix = { k: 'prop', g, prop: name, m: m.elements.map(r4) };
    edits.push(fix);
    const geo = propGeometry(name).clone().toNonIndexed();
    geo.applyMatrix4(m);
    const mesh = new THREE.Mesh(geo, propMaterial(name));
    mesh.userData.temp = fix;
    mesh.castShadow = mesh.receiveShadow = true;
    groupFor(g).add(mesh);
    undo.push([() => { mesh.removeFromParent(); dropEdit(fix); }]);
    deselect();
    addPiece(mesh, wholeOf(mesh)); placeProxy(); markPanel();
    say(tx('Dodano — ustaw uchwytem (1/2/3)', 'Added — place it with the gizmo (1/2/3)'));
  }

  // ---------- przedmioty: części z różnych materiałów, które się stykają (kłoda = kora + dwa czoła), chwytane razem ----------
  interface Obj { nodes: { mesh: THREE.Mesh; island: Island }[]; c: THREE.Vector3; size: THREE.Vector3; mat: string; g: string }
  let objs: Obj[] = [];
  const objOf = new Map<string, Obj>();
  const nodeKey = (mesh: THREE.Mesh, island: Island): string => `${mesh.uuid}:${isl(mesh.geometry).list.indexOf(island)}`;
  function computeObjects(): void {
    objs = []; objOf.clear();
    const cur = ctx.current();
    if (!cur) return;
    const nodes: { mesh: THREE.Mesh; island: Island; box: THREE.Box3 }[] = [];
    cur.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.userData?.fx) return;
      const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute, v = new THREE.Vector3();
      for (const island of isl(m.geometry).list) {
        const box = new THREE.Box3();
        for (const t of island.tris) for (let j = 0; j < 3; j++) box.expandByPoint(v.fromBufferAttribute(pos, t * 3 + j));
        nodes.push({ mesh: m, island, box });
      }
    });
    const parent = nodes.map((_, k) => k);
    const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]!]!; a = parent[a]!; } return a; };
    // łączymy tylko drobne rzeczy (do ok. 0,9 pola) — ściany i dachy dotykają wszystkiego i zlałyby budynek w jedno
    const small = nodes.map((n) => n.box.getSize(new THREE.Vector3()).length() < 0.9);
    const seen = new Map<string, number>();
    nodes.forEach((n, k) => {
      if (!small[k]) return;
      const pos = n.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (const t of n.island.tris) for (let j = 0; j < 3; j++) {
        const vi = t * 3 + j;
        const key = `${Math.round(pos.getX(vi) * 1000)},${Math.round(pos.getY(vi) * 1000)},${Math.round(pos.getZ(vi) * 1000)}`;
        const o = seen.get(key);
        if (o === undefined) seen.set(key, k); else if (nodes[o]!.mesh !== n.mesh) { const a = find(o), b = find(k); if (a !== b) parent[a] = b; }
      }
    });
    const by = new Map<number, Obj>();
    nodes.forEach((n, k) => {
      const r = find(k);
      let o = by.get(r);
      if (!o) { o = { nodes: [], c: new THREE.Vector3(), size: new THREE.Vector3(), mat: '', g: (n.mesh.userData.fx as [string])[0] }; by.set(r, o); objs.push(o); }
      o.nodes.push({ mesh: n.mesh, island: n.island });
      objOf.set(nodeKey(n.mesh, n.island), o);
    });
    for (const o of objs) {
      const box = new THREE.Box3();
      let best = -1;
      for (const nd of o.nodes) {
        const k = nodes.find((n) => n.mesh === nd.mesh && n.island === nd.island)!;
        box.union(k.box);
        if (nd.island.tris.length > best) { best = nd.island.tris.length; o.mat = (nd.mesh.userData.fx as [string, number, string])[2]; }
      }
      box.getCenter(o.c); box.getSize(o.size);
    }
    // obok siebie na liście to, co obok siebie w modelu: od tyłu do przodu, od lewej do prawej
    objs.sort((a, b) => (Math.round(a.c.z * 5) - Math.round(b.c.z * 5)) || (a.c.x - b.c.x));
  }
  function selectObj(o: Obj, multi: boolean): void {
    const all = o.nodes.every((nd) => sel.some((p) => p.mesh === nd.mesh && p.isl === nd.island));
    if (!multi) deselect();
    if (multi && all) {
      for (const nd of o.nodes) { const k = sel.findIndex((p) => p.mesh === nd.mesh && p.isl === nd.island); if (k >= 0) { const [p] = sel.splice(k, 1); p!.hi.removeFromParent(); p!.hi.geometry.dispose(); } }
    } else for (const nd of o.nodes) if (!sel.some((p) => p.mesh === nd.mesh && p.isl === nd.island)) addPiece(nd.mesh, nd.island);
    placeProxy();
    say(sel.length ? tx(`Zaznaczone: ${sel.length} części (Alt+klik — pojedyncza część)`, `Selected: ${sel.length} parts (Alt+click — a single part)`) : tx('Kliknij część (Ctrl — kilka naraz)', 'Click a part (Ctrl — several at once)'));
    markPanel();
  }

  // ---------- lista warstw po prawej: grupy (pokaż/ukryj) i siatki po materiale (klik zaznacza całą siatkę) ----------
  const panel = document.createElement('div');
  panel.className = 'edit-layers';
  panel.style.cssText = 'position:fixed;right:12px;top:calc(var(--top, 0px) + 10px);bottom:calc(var(--insp-h, 230px) + 8px);width:230px;overflow:auto;background:rgba(24,21,17,.92);border:1px solid #5a4a2c;padding:8px;font-size:12px;color:#e6d6b4;z-index:5';
  document.body.append(panel);
  const GROUP_NAME: Record<string, string> = { base: tx('Bryła', 'Body'), shell: tx('Dach i mury', 'Roof and walls'), interior: tx('Wnętrze', 'Interior'), floor: tx('Posadzka', 'Floor'), ceiling: tx('Sufit sali', 'Hall ceiling') };
  const rows = new Map<THREE.Mesh, HTMLButtonElement>();
  let partRows: { m: THREE.Mesh; island: Island; b: HTMLButtonElement }[] = [];
  let objRows: { o: Obj; b: HTMLButtonElement }[] = [];
  const ROW = 'text-align:left;padding:3px 6px;min-height:24px;font:inherit;color:inherit;background:#2e2b24;border:1px solid #3e3626;cursor:pointer';
  function buildPanel(): void {
    panel.textContent = '';
    rows.clear();
    partRows = [];
    objRows = [];
    const cur = ctx.current();
    if (!cur) return;
    const h = document.createElement('div');
    h.textContent = tx('Przedmioty i warstwy (klik — zaznacz, Ctrl — dodaj)', 'Objects and layers (click — select, Ctrl — add)');
    h.style.cssText = 'font-weight:600;margin-bottom:6px';
    panel.append(h);
    computeObjects();
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
      // przedmioty tej grupy, posortowane miejscem w modelu (sąsiednie rzeczy obok siebie na liście)
      const list0 = objs.filter((o) => o.g === g);
      const objBox = document.createElement('div');
      list0.forEach((o, k) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = ROW + ';display:block;width:100%;font-size:11.5px';
        b.textContent = `${k + 1}. ${o.mat} · ${(o.size.x * 100).toFixed(0)}×${(o.size.y * 100).toFixed(0)}×${(o.size.z * 100).toFixed(0)} cm${o.nodes.length > 1 ? ` · ${o.nodes.length} ${tx('części', 'parts')}` : ''}`;
        b.onclick = (e) => selectObj(o, e.ctrlKey || e.metaKey || e.shiftKey);
        objRows.push({ o, b });
        objBox.append(b);
      });
      panel.append(objBox);
      const matHead = document.createElement('div');
      matHead.textContent = tx('według materiału', 'by material');
      matHead.style.cssText = 'margin:6px 0 2px;color:#a89e86;font-size:11px';
      panel.append(matHead);
      for (const m of meshes) {
        const fx = m.userData.fx as [string, number, string];
        const list = isl(m.geometry).list;
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;gap:2px;margin:1px 0';
        const open = document.createElement('button');
        open.type = 'button'; open.textContent = '▸'; open.setAttribute('aria-expanded', 'false');
        open.title = tx('Pokaż części', 'Show parts');
        open.style.cssText = ROW + ';width:24px;flex:none;text-align:center;padding:0';
        const b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = ROW + ';flex:1';
        b.textContent = `${fx[2] ?? '?'} · ${list.length} ${tx('części', 'parts')}`;
        b.title = tx('Zaznacz wszystkie części tej warstwy (Ctrl — dodaj)', 'Select all parts of this layer (Ctrl — add)');
        b.onclick = (e) => selectMesh(m, e.ctrlKey || e.metaKey || e.shiftKey);
        rows.set(m, b);
        line.append(open, b);
        panel.append(line);
        // rozwijana lista części: każda osobno (klik — zaznacz, Ctrl — dodaj); wymiary, żeby rozpoznać, co to jest
        const sub = document.createElement('div');
        sub.hidden = true;
        sub.style.cssText = 'margin:0 0 4px 26px';
        open.onclick = () => {
          const v = sub.hidden;
          sub.hidden = !v; open.textContent = v ? '▾' : '▸'; open.setAttribute('aria-expanded', String(v));
          if (v && !sub.childElementCount) {
            const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
            list.forEach((island, k) => {
              const bb = new THREE.Box3(), v3 = new THREE.Vector3();
              for (const t of island.tris) for (let j = 0; j < 3; j++) bb.expandByPoint(v3.fromBufferAttribute(pos, t * 3 + j));
              const sz = bb.getSize(new THREE.Vector3());
              const pb = document.createElement('button');
              pb.type = 'button';
              pb.style.cssText = ROW + ';display:block;width:100%;font-size:11px';
              pb.textContent = `${tx('część', 'part')} ${k + 1} · ${(sz.x * 100).toFixed(0)}×${(sz.y * 100).toFixed(0)}×${(sz.z * 100).toFixed(0)} cm`;
              pb.onclick = (e) => toggle(m, island, e.ctrlKey || e.metaKey || e.shiftKey);
              pb.dataset.k = String(k);
              partRows.push({ m, island, b: pb });
              sub.append(pb);
            });
            markPanel();
          }
        };
        panel.append(sub);
      }
    }
    markPanel();
  }
  function markPanel(): void {
    for (const [m, b] of rows) b.style.borderColor = sel.some((p) => p.mesh === m) ? '#e9c766' : '#3e3626';
    for (const r of objRows) {
      const on = r.o.nodes.every((nd) => sel.some((p) => p.mesh === nd.mesh && p.isl === nd.island));
      r.b.style.borderColor = on ? '#e9c766' : '#3e3626';
      r.b.style.background = on ? '#4a3e22' : '#2e2b24';
    }
    for (const r of partRows) {
      const on = sel.some((p) => p.mesh === r.m && p.isl === r.island);
      r.b.style.borderColor = on ? '#e9c766' : '#3e3626';
      r.b.style.background = on ? '#4a3e22' : '#2e2b24';
    }
  }

  // ---------- klikanie w część ----------
  const ray = new THREE.Raycaster();
  /** część modelu pod punktem ekranu (widoczna, zwykła albo dodana) */
  function pick(cx: number, cy: number): { mesh: THREE.Mesh; island: Island } | null {
    const r = ctx.canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), ctx.camera);
    const cur = ctx.current();
    if (!cur) return null;
    const hits = ray.intersectObject(cur, true).filter((h) => (h.object as THREE.Mesh).isMesh && (h.object.userData.fx || (h.object.userData.temp && !h.object.userData.locked)) && h.faceIndex != null);
    const h = hits.find((x) => { for (let o: THREE.Object3D | null = x.object; o; o = o.parent) if (!o.visible) return false; return true; });
    if (!h) return null;
    const mesh = h.object as THREE.Mesh;
    const { of, list } = isl(mesh.geometry);
    return { mesh, island: list[of[h.faceIndex!]!]! };
  }
  let down: [number, number] | null = null;
  ctx.canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  ctx.canvas.addEventListener('pointerup', (e) => {
    if (!on || !down || (tc as unknown as { dragging: boolean }).dragging) return;
    if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    const hit = pick(e.clientX, e.clientY);
    if (!hit) { if (!multi) { deselect(); say(tx('Kliknij część (Ctrl — kilka naraz)', 'Click a part (Ctrl — several at once)')); } return; }
    const { mesh, island } = hit;
    // klik chwyta cały przedmiot (np. kłodę z korą i czołami), Alt+klik — tylko kliknięty kawałek
    const o = !e.altKey && !mesh.userData.temp ? objOf.get(nodeKey(mesh, island)) : undefined;
    if (o) selectObj(o, multi); else toggle(mesh, island, multi);
  });
  window.addEventListener('keydown', (e) => {
    if (!on || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) { if (k === 'z') { e.preventDefault(); undoLast(); } else if (k === 'd') { e.preventDefault(); duplicateSel(); } else if (k === 's') { e.preventDefault(); void save(); } return; }
    // 1/2/3 zamiast W/E/R: WASD lata kamerą (viewer.ts)
    if (k === '1') setMode('translate');
    else if (k === '2') setMode('rotate');
    else if (k === '3') setMode('scale');
    else if (k === 'delete' || k === 'backspace') removeSel();
    else if (k === 'escape') deselect();
    else if (k === 'f') focusSel();
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
    savedNow.add(id);
    edits = [];
    undo.length = 0;
    say(tx('Zapisano w przeglądarce, wysyłam do bazy…', 'Saved in the browser, sending to the database…'));
    try {
      const { supa } = await import('../net/supa');
      const { data: s } = await supa.auth.getSession();
      if (!s.session) { say(tx('⚠ Zapisano TYLKO w tej przeglądarce — zaloguj się w grze (RebaZius), wtedy poprawki same polecą do bazy i trafią na produkcję', '⚠ Saved ONLY in this browser — log in to the game (owner account); the fixes will then go to the database and reach production')); status.style.color = '#ffb070'; return; }
      status.style.color = '#e6d6b4';
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
      // zapis z przeglądarki, którego nie ma w bazie (np. zapisany przed zalogowaniem albo przed założeniem tabeli):
      // twórca zalogowany → wysyłamy go teraz, żeby nic z lokalnej pracy nie przepadło w drodze na produkcję
      else if (list.length > (Array.isArray(remote) ? remote.length : 0) && list.length > base) {
        const { data: s } = await supa.auth.getSession();
        if (s.session) {
          const { error } = await supa.from('model_fixes').upsert({ model: id, fixes: list, updated_at: new Date().toISOString(), updated_by: s.session.user.id });
          if (!error) say(tx('Wysłano do bazy poprawki zapisane wcześniej w przeglądarce', 'Sent fixes saved earlier in the browser to the database'));
        }
      }
    } catch { /* bez bazy: tylko przeglądarka */ }
    // poprawki z bazy i przeglądarki są już w modelu (viewerboot.ts → setLiveFixes); zapisane w tej sesji pokażą się po odświeżeniu
    if (savedNow.has(id)) say(tx('Zapisane zmiany tego modelu pokażą się po odświeżeniu strony (F5)', 'Saved changes to this model will show after a page refresh (F5)'));
  }

  // do sprawdzania z konsoli / testów
  (window as unknown as { __modelEditor: unknown }).__modelEditor = { info: () => ({ on, sel: sel.map((p) => ({ n: p.isl.tris.length, c: p.c, g: p.mesh.userData.fx })), edits: edits.length }) };
  // kto może edytować (Michał 10.11.2026): tylko twórca gry (admins.owner), także lokalnie — inne konta i niezalogowani
  // w ogóle nie widzą przycisku „Edytuj”
  editBtn.hidden = true;
  void (async () => {
    try {
      const { supa } = await import('../net/supa');
      const check = async (): Promise<void> => {
        const { data: s } = await supa.auth.getSession();
        let owner = false;
        if (s.session) {
          const { data } = await supa.from('admins').select('owner').eq('user_id', s.session.user.id).maybeSingle();
          owner = !!(data as { owner?: boolean } | null)?.owner;
        }
        editBtn.hidden = !owner;
        if (!owner && on) setOn(false);
      };
      await check();
      supa.auth.onAuthStateChange(() => { void check(); });
    } catch { /* bez bazy: bez edycji */ }
  })();
  // niezapisane zmiany: ostrzeżenie przy przejściu na inny model i przy zamykaniu karty (Michał 10.11.2026)
  window.addEventListener('beforeunload', (e) => { if (edits.length) { e.preventDefault(); e.returnValue = ''; } });
  function guard(go: () => void): void {
    if (!edits.length) { go(); return; }
    const back = document.createElement('div');
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:20;display:grid;place-items:center';
    const box = document.createElement('div');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.style.cssText = 'background:#24221d;border:1px solid #d8b25a;padding:18px 20px;max-width:420px;color:#e8e0cc;font-size:14px';
    const p = document.createElement('p'); p.style.margin = '0 0 14px';
    p.textContent = tx(`Masz niezapisane zmiany (${edits.length}). Jeśli wyjdziesz bez zapisu, przepadną.`, `You have unsaved changes (${edits.length}). If you leave without saving, they will be lost.`);
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end';
    const close = (): void => back.remove();
    const b1 = btn(tx('Zapisz i przejdź', 'Save and continue'), () => { close(); void save().then(go); });
    const b2 = btn(tx('Porzuć zmiany', 'Discard changes'), () => { close(); edits = []; undo.length = 0; go(); });
    const b3 = btn(tx('Zostań', 'Stay'), close);
    for (const b of [b1, b2, b3]) b.style.cssText = 'font:inherit;font-size:13px;padding:6px 10px;color:#e8e0cc;background:#2e2b24;border:1px solid #3a362d;cursor:pointer';
    b1.style.borderColor = '#d8b25a';
    row.append(b1, b2, b3); box.append(p, row); back.append(box); document.body.append(back);
    b3.focus();
  }
  // uchwyt do zmiany wysokości inspektora (przeciągnij górną krawędź)
  const grip = document.createElement('div');
  grip.title = tx('Przeciągnij, żeby zmienić wysokość', 'Drag to resize');
  grip.style.cssText = 'position:absolute;left:0;right:0;top:-5px;height:9px;cursor:ns-resize';
  insp.append(grip);
  try { const h = Number(localStorage.getItem('p1-insp-h')); if (h > 100) document.body.style.setProperty('--insp-h', `${h}px`); } catch { /* bez pamięci */ }
  grip.addEventListener('pointerdown', (e) => {
    grip.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent): void => { const h = Math.max(120, Math.min(window.innerHeight - 160, window.innerHeight - ev.clientY)); document.body.style.setProperty('--insp-h', `${h}px`); };
    const up = (): void => { grip.removeEventListener('pointermove', move); try { localStorage.setItem('p1-insp-h', String(parseInt(getComputedStyle(document.body).getPropertyValue('--insp-h')) || 230)); } catch { /* bez pamięci */ } };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up, { once: true });
  });
  showTab('tex');
  setOn(false);
  /** pozycje górnego menu (viewer.ts składa z nich pasek Plik / Edycja / Narzędzia / Dodaj) */
  const isOn = (): boolean => on, hasSel = (): boolean => on && sel.length > 0;
  function menus(): Record<'file' | 'edit' | 'tools' | 'add', MenuItem[]> {
    return {
      file: [
        { label: tx('Zapisz', 'Save'), key: 'Ctrl+S', act: () => void save(), enabled: isOn },
        { label: tx('Pobierz plik poprawek', 'Download fixes file'), act: download, enabled: isOn },
      ],
      edit: [
        { label: tx('Cofnij', 'Undo'), key: 'Ctrl+Z', act: undoLast, enabled: () => on && undo.length > 0 },
        { sep: true },
        { label: tx('Kopiuj', 'Duplicate'), key: 'Ctrl+D', act: duplicateSel, enabled: hasSel },
        { label: tx('Usuń', 'Delete'), key: 'Del', act: removeSel, enabled: hasSel },
        { label: tx('Odznacz', 'Deselect'), key: 'Esc', act: deselect, enabled: hasSel },
        { sep: true },
        { label: tx('Odbij lustrzanie w osi X', 'Mirror along X'), act: () => mirror(0), enabled: hasSel },
        { label: tx('Odbij lustrzanie w osi Z', 'Mirror along Z'), act: () => mirror(2), enabled: hasSel },
        { label: tx('Postaw na ziemi', 'Drop to the ground'), act: dropToGround, enabled: hasSel },
        { label: tx('Widać z obu stron', 'Visible from both sides'), act: doubleSel, enabled: hasSel },
      ],
      tools: [
        { label: tx('Tryb edycji', 'Edit mode'), checked: isOn, act: () => setOn(!on), enabled: () => !editBtn.hidden },
        { sep: true },
        { label: tx('Przesuń', 'Move'), key: '1', checked: () => on && tc.mode === 'translate', act: () => setMode('translate'), enabled: isOn },
        { label: tx('Obróć', 'Rotate'), key: '2', checked: () => on && tc.mode === 'rotate', act: () => setMode('rotate'), enabled: isOn },
        { label: tx('Skaluj', 'Scale'), key: '3', checked: () => on && tc.mode === 'scale', act: () => setMode('scale'), enabled: isOn },
        { sep: true },
        { label: tx('Przyciąganie', 'Snap'), checked: () => snap.checked, act: () => { snap.checked = !snap.checked; applySnap(); }, enabled: isOn },
        { label: tx('Osie części (lokalnie)', 'Part axes (local)'), checked: () => space.checked, act: () => { space.checked = !space.checked; tc.setSpace(space.checked ? 'local' : 'world'); }, enabled: isOn },
        { label: tx('Pokaż zaznaczenie', 'Frame selection'), key: 'F', act: focusSel, enabled: hasSel },
      ],
      add: [
        { label: tx('Bryła', 'Shape'), enabled: isOn, sub: () => SHAPES.map((sh) => ({ label: shapeLabel(sh, tx), act: () => addShape(sh, picked, grpSel.value) })) },
        { label: tx('Gotowy model z paczki', 'Ready-made model'), enabled: isOn, sub: () => ASSET_PROPS.map(([p, l]) => ({ label: l, act: () => addProp(p, grpSel.value) })) },
        { sep: true },
        { label: tx('Okno zasobów', 'Assets window'), act: () => showTab('assets'), enabled: isOn },
        { label: tx('Okno tekstur', 'Textures window'), act: () => showTab('tex'), enabled: isOn },
      ],
    };
  }
  return {
    menus,
    guard,
    onModel: () => { deselect(); edits = []; undo.length = 0; void applyPending(); if (on) buildPanel(); },
  };
}
