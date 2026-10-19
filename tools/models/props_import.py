"""Gotowe modele z sieci (robione przez grafików) w wersji do gry: ryba i pochodnia w ręce chłopa.

    /tmp/bpyenv/bin/python tools/models/props_import.py <katalog z paczkami>

W katalogu: BarramundiFish.glb (Khronos glTF-Sample-Assets, CC0, Microsoft), torch.glb (Secret Histories, CC-BY-SA 4.0)
i wicker_basket_02/, food_apple_01/, hamburger_buns/, wine_barrel_01/ (Poly Haven, CC0, paczki glTF 1K).

Zasada: model ma wyglądać w grze dokładnie jak w Blenderze, więc wersja z bliska NIE jest odchudzana ani przerabiana:
  - oryginalne trójkąty, oryginalne UV i oryginalne normalne (gładkie cieniowanie, ostre krawędzie tam, gdzie były),
  - pozycje w pełnej precyzji (float32, bez zaokrąglania do int16 jak w budynkach),
  - tekstury z paczki (kolor + mapa normalnych) zmniejszone tylko do 1024 px.
Odchudzana jest wyłącznie wersja z daleka (ryby w wodzie, pochodnia daleko od kamery) — sprawdzana porównaniem obok oryginału.
Płetwy i część szmat to pojedyncze płaszczyzny, więc gra rysuje te modele z obu stron (materiał dwustronny).

Wynik:
  src/render/models/props.json — fish, fishFar, torch, torchFar w formacie jak las (pos/nrm/col/uv/idx)
  public/textures/cc0/prop_{fish,torch}{,_n}.jpg — potem `node tools/textures/ktx2.mjs public/textures/cc0/prop_*.jpg`

Układy:
  ryba — długość 1 wzdłuż osi z (pysk w +z), grzbiet w +y, środek bryły w (0, 0, 0); gra skaluje do rozmiaru;
  pochodnia — układ ręki jak w tools.py: dłoń w GRIP = (0, -0.19, 0), ręka uniesiona o TORCH_ARM = -0.55, więc pochodnia
  stoi pionowo; trzonek od GRIP - d*0.09 do głowicy GRIP + d*0.31 (płomień gry: GRIP + d*0.34, scene.ts TORCH_TIP).
"""
import base64
import math
import os
import struct
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(ROOT, 'src', 'render', 'models', 'props.json')
TEX = os.path.join(ROOT, 'public', 'textures', 'cc0')
TEX_SIZE = 1024

GRIP = Vector((0.0, -0.19, 0.0))
TORCH_ARM = -0.55
TORCH_DIR = Vector((0.0, math.cos(-TORCH_ARM), math.sin(-TORCH_ARM)))


def pack(pos, nrm, uv, idx):
    e = lambda b: base64.b64encode(b).decode()
    assert len(pos) < 65536, len(pos)
    return {
        'pos': e(b''.join(struct.pack('<3f', *p) for p in pos)),
        'nrm': e(b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in nrm)),
        'col': e(bytes([255]) * (3 * len(pos))),   # barwa jest w teksturze z paczki
        'uv': e(b''.join(struct.pack('<2f', *u) for u in uv)),
        'idx': e(b''.join(struct.pack('<3H', *f) for f in idx)),
    }


def load(path, skip=()):
    """Wczytuje paczkę i zwraca jedną siatkę z zastosowanymi przekształceniami (układ Blendera, z w górę).
    `skip`: części paczki pominięte (np. wieko kosza)"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and any(k in o.name for k in skip)]:
        bpy.data.objects.remove(o)
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    assert len(obs) == 1, [o.name for o in obs]
    o = obs[0]
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


def load_all(path, only=None):
    """Jak load, ale paczka z kilku części: `only` = nazwa jednej części, inaczej wszystkie sklejone w jedną siatkę"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    keep = [o for o in obs if only is None or o.name == only]
    for o in obs:
        if o not in keep:
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep:
        o.select_set(True)
    bpy.context.view_layer.objects.active = keep[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(keep) > 1:
        bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


def bounds(o):
    pts = [o.matrix_world @ v.co for v in o.data.vertices]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


def bake_low(hi, name, seg=20, levels=14):
    """Prosta bryła o obrysie `hi` (bryła obrotowa wokół osi z: pierścienie na `levels` wysokościach, denka), na którą
    Cycles wypala kolor i mapę normalnych pełnego modelu → prop_<name>.jpg / _n.jpg. Klepki, obręcze i czop zostają
    w teksturze, bryła ma kilkaset trójkątów. Zwraca obiekt niskiej bryły (UV: bok w dolnych 70%, denka nad nim)."""
    mn, mx = bounds(hi)
    cx, cy = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2
    H = mx.z - mn.z
    # obrys mierzony promieniami z zewnątrz w stronę osi (wierzchołków na danej wysokości może nie być: długie klepki
    # przechodzą jednym kawałkiem), największy promień z 36 kierunków; na samym dnie i wieku o włos do środka
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(hi, dg)
    R = max(mx.x - mn.x, mx.y - mn.y)
    zs = [mn.z + H * (0.002 + 0.996 * k / (levels - 1)) for k in range(levels)]
    rad = []
    for z in zs:
        best = 0.0
        for j in range(36):
            a = 2 * math.pi * j / 36
            o = Vector((cx + math.cos(a) * R, cy + math.sin(a) * R, z))
            hit = tree.ray_cast(o, Vector((-math.cos(a), -math.sin(a), 0)))
            if hit[0] is not None:
                best = max(best, math.hypot(hit[0].x - cx, hit[0].y - cy))
        rad.append(best)
    assert all(r > 0 for r in rad), rad
    me = bpy.data.meshes.new(name + '_low')
    verts, faces, uvs = [], [], []
    ring = lambda k, a: (cx + math.cos(a) * rad[k], cy + math.sin(a) * rad[k], zs[k])
    for k in range(levels):
        for j in range(seg + 1):
            verts.append(ring(k, 2 * math.pi * j / seg))
    for k in range(levels - 1):
        for j in range(seg):
            a, b = k * (seg + 1) + j, k * (seg + 1) + j + 1
            c2, d = a + seg + 1, b + seg + 1
            faces.append((a, b, d, c2)); uvs.append([(j / seg, 0.7 * k / (levels - 1)), ((j + 1) / seg, 0.7 * k / (levels - 1)),
                                                      ((j + 1) / seg, 0.7 * (k + 1) / (levels - 1)), (j / seg, 0.7 * (k + 1) / (levels - 1))])
    # denka: wachlarz z punktu środka; UV w kółkach nad bokiem (dół z lewej, góra z prawej)
    for k, u0, flip in ((0, 0.18, True), (levels - 1, 0.62, False)):
        ci = len(verts); verts.append((cx, cy, zs[k]))
        for j in range(seg):
            a = k * (seg + 1) + j; b = a + 1
            ang0, ang1 = 2 * math.pi * j / seg, 2 * math.pi * (j + 1) / seg
            f = (ci, b, a) if flip else (ci, a, b)
            uv_of = {ci: (u0, 0.85), a: (u0 + math.cos(ang0) * 0.14, 0.85 + math.sin(ang0) * 0.14), b: (u0 + math.cos(ang1) * 0.14, 0.85 + math.sin(ang1) * 0.14)}
            faces.append(f); uvs.append([uv_of[i] for i in f])
    me.from_pydata(verts, [], faces)
    lay = me.uv_layers.new()
    for poly, fu in zip(me.polygons, uvs):
        for li, u in zip(poly.loop_indices, fu):
            lay.data[li].uv = u
    me.shade_smooth() if hasattr(me, 'shade_smooth') else None
    for p in me.polygons:
        p.use_smooth = True
    low = bpy.data.objects.new(name + '_low', me)
    bpy.context.scene.collection.objects.link(low)
    # wypalanie z pełnego modelu na prostą bryłę (Cycles, z wybranego na aktywny)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 16
    mat = bpy.data.materials.new(name + '_bake'); mat.use_nodes = True; me.materials.append(mat)
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    mat.node_tree.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT')
    hi.select_set(True); low.select_set(True); bpy.context.view_layer.objects.active = low
    sc.render.bake.use_selected_to_active = True
    sc.render.bake.cage_extrusion = H * 0.1
    sc.render.bake.max_ray_distance = 0.0
    sc.render.bake.margin = 8
    # kolor wypalamy wprost z tekstury barwy (podpiętej pod emisję): wypalanie „koloru rozproszonego” daje czerń
    # na metalu (obręcze), bo metal nie ma barwy rozproszonej
    for m in {s.material for s in hi.material_slots if s.material}:
        nt = m.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        src_link = next((l for l in nt.links if l.to_node == bsdf and l.to_socket.name == 'Base Color'), None)
        em = nt.nodes.new('ShaderNodeEmission')
        out_node = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        m['_surface'] = 1
        if src_link:
            nt.links.new(src_link.from_socket, em.inputs['Color'])
        else:
            em.inputs['Color'].default_value = bsdf.inputs['Base Color'].default_value
        m['_emit'] = em.name
        m['_bsdf'] = bsdf.name
    def surface(emit):
        for m in {s.material for s in hi.material_slots if s.material}:
            nt = m.node_tree
            out_node = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
            nt.links.new(nt.nodes[m['_emit'] if emit else m['_bsdf']].outputs[0], out_node.inputs['Surface'])
    for suf, typ in (('', 'EMIT'), ('_n', 'NORMAL')):
        img = bpy.data.images.new(f'{name}{suf}', TEX_SIZE, TEX_SIZE)
        if suf:
            img.colorspace_settings.name = 'Non-Color'
        node.image = img
        if typ == 'EMIT':
            surface(True)
            bpy.ops.object.bake(type='EMIT')
        else:
            surface(False)
            sc.render.bake.normal_space = 'TANGENT'
            bpy.ops.object.bake(type='NORMAL')
        img.filepath_raw = os.path.join(TEX, f'prop_{name}{suf}.jpg'); img.file_format = 'JPEG'
        img.save(filepath=img.filepath_raw, quality=92)
    return low


def pad(images, passes=24):
    """Rozlanie barwy poza kawałki tekstury (tło skanów jest czarne): każdy piksel tła bierze średnią z sąsiadów,
    którzy już mają barwę, `passes` razy. Bez tego po odchudzeniu brzegi trójkątów łapią czerń (czarne kropki).
    Maska z pierwszego obrazka (kolor); te same piksele uzupełniamy w mapie normalnych."""
    import numpy as np
    W, H = images[0].size
    px = [np.array(im.pixels[:], dtype=np.float32).reshape(H, W, 4) for im in images]
    filled = px[0][..., :3].sum(-1) > 0.04
    for _ in range(passes):
        acc = [np.zeros_like(p[..., :3]) for p in px]
        cnt = np.zeros((H, W), np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            m = np.roll(filled, (dy, dx), (0, 1)).astype(np.float32)
            cnt += m
            for a, p in zip(acc, px):
                a += np.roll(p[..., :3], (dy, dx), (0, 1)) * m[..., None]
        grow = (~filled) & (cnt > 0)
        for a, p in zip(acc, px):
            p[..., :3][grow] = a[grow] / cnt[grow][:, None]
        filled |= grow
    for im, p in zip(images, px):
        im.pixels[:] = p.ravel()


def textures(o, name, padding=False):
    """Kolor i mapa normalnych z materiału paczki → prop_<name>.jpg, prop_<name>_n.jpg (1024 px);
    padding=True: rozlanie barwy poza kawałki tekstury (skany na czarnym tle, odchudzane)"""
    found = {}
    for n in o.active_material.node_tree.nodes:
        if n.type != 'TEX_IMAGE':
            continue
        for l in n.outputs[0].links:
            if l.to_node.type == 'BSDF_PRINCIPLED' and l.to_socket.name == 'Base Color':
                found[''] = n.image
            if l.to_node.type == 'NORMAL_MAP':
                found['_n'] = n.image
    assert set(found) == {'', '_n'}, found
    copies = {}
    for suf, img in found.items():
        im = img.copy()
        if im.size[0] > TEX_SIZE:
            im.scale(TEX_SIZE, TEX_SIZE)
        copies[suf] = im
    if padding:
        pad([copies[''], copies['_n']])
    for suf, im in copies.items():
        im.filepath_raw = os.path.join(TEX, f'prop_{name}{suf}.jpg')
        im.file_format = 'JPEG'
        bpy.context.scene.render.image_settings.quality = 92
        im.save(filepath=im.filepath_raw, quality=92)


def export(o, M):
    """Siatka → bufory gry. M: macierz z układu Blendera do układu gry (y w górę). Wierzchołek na każdą parę
    (pozycja, normalna narożnika, UV) — szwy UV i ostre krawędzie zostają dokładnie jak w modelu."""
    me = o.data
    me.calc_loop_triangles()
    uvl = me.uv_layers.active.data
    N = M.to_3x3().inverted().transposed()
    pos, nrm, uv, idx, seen = [], [], [], [], {}
    for tri in me.loop_triangles:
        face = []
        for li, vi, cn in zip(tri.loops, tri.vertices, tri.split_normals):
            p = M @ me.vertices[vi].co
            n = (N @ Vector(cn)).normalized()
            u = tuple(uvl[li].uv)
            key = (vi, round(n.x, 3), round(n.y, 3), round(n.z, 3), round(u[0], 5), round(u[1], 5))
            k = seen.get(key)
            if k is None:
                k = seen[key] = len(pos)
                pos.append(tuple(p)); nrm.append(tuple(n)); uv.append(u)
            face.append(k)
        # zamiana osi (Blender z w górę → gra y w górę) zachowuje kierunek obiegu, więc ściany patrzą tak samo
        idx.append(tuple(face))
    return pack(pos, nrm, uv, idx), len(idx)


def lighter(o, ratio, weld=False):
    """Kopia odchudzona Decimate (szwy UV zostają w narożnikach ścian).
    weld=True: najpierw skleja wierzchołki w tym samym miejscu — skany (jabłko, chleb) są pocięte na kawałki wzdłuż
    szwów tekstury i bez sklejenia odchudzanie rozsuwa te kawałki (czarne rysy na skórce)."""
    c = o.copy()
    c.data = o.data.copy()
    bpy.context.scene.collection.objects.link(c)
    if weld:
        bm = bmesh.new(); bm.from_mesh(c.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bm.to_mesh(c.data); bm.free()
    d = c.modifiers.new('d', 'DECIMATE')
    d.decimate_type = 'COLLAPSE'
    d.ratio = ratio
    d.use_collapse_triangulate = True
    d.use_symmetry = False
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(c.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    c.modifiers.clear()
    c.data = me
    return c


B2G = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))   # (x, y, z) Blendera → (x, z, -y) gry

out = {}
src = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else sys.argv[1]
info = []

# ---------------- ryba ----------------
fish = load(os.path.join(src, 'BarramundiFish.glb'))
textures(fish, 'fish')
pts = [fish.matrix_world @ v.co for v in fish.data.vertices]
mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
L = mx.y - mn.y
c = (mn + mx) / 2
# w paczce ryba leży wzdłuż osi y Blendera pyskiem w -y; w grze pysk w +z: (x, y, z) → (x, z, -y)
FM = Matrix.Scale(1 / L, 4) @ B2G @ Matrix.Translation(-c)
out['fish'], t1 = export(fish, FM)
out['fishFar'], t2 = export(lighter(fish, 0.3), FM)
info.append(f'ryba: {t1} / {t2} trójkątów, wymiary {round((mx.x - mn.x) / L, 3)} × {round((mx.z - mn.z) / L, 3)} × 1')

# ---------------- pochodnia w dłoni ----------------
torch = load(os.path.join(src, 'torch.glb'))
textures(torch, 'torch')
pts = [torch.matrix_world @ v.co for v in torch.data.vertices]
mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
H = mx.z - mn.z
s = 0.40 / H
c = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
# trzonek pionowo w y gry, potem obrót wokół x o -TORCH_ARM (pochodnia pochylona tak, by przy uniesionej ręce stała pionowo)
TM = (Matrix.Translation(GRIP - TORCH_DIR * 0.09) @ Matrix.Rotation(-TORCH_ARM, 4, 'X')
      @ Matrix.Scale(s, 4) @ B2G @ Matrix.Translation(-c))
out['torch'], t1 = export(torch, TM)
out['torchFar'], t2 = export(lighter(torch, 0.4), TM)
info.append(f'pochodnia: {t1} / {t2} trójkątów, długość 0.4, szerokość {round((mx.x - mn.x) * s, 3)}')

# ---------------- kosz z wikliny (Poly Haven wicker_basket_02, CC0), bez wieka ----------------
# Splot jest w teksturze, a bryła to pełna powłoka, więc odchudzanie jej nie psuje: próba z oryginałem obok wersji
# 30/15/8% nie pokazała różnicy ani z bliska, ani z odległości gry (wicker_basket_01 z prętów z geometrii rozpadał się
# już przy 30%, a w pełnej wersji ma 22 tys. trójkątów — dlatego nie jest używany).
# Układ gry: dno w y = 0, środek podstawy w (0, 0), największa szerokość = 1; wysokość w proporcji (klucz basketH).
basket = load(os.path.join(src, 'wicker_basket_02', 'wicker_basket_02_1k.gltf'), skip=('lid',))
textures(basket, 'basket')
pts = [basket.matrix_world @ v.co for v in basket.data.vertices]
mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
D = max(mx.x - mn.x, mx.y - mn.y)
c = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
BM = Matrix.Scale(1 / D, 4) @ B2G @ Matrix.Translation(-c)
out['basket'], t1 = export(lighter(basket, 0.15), BM)
out['basketFar'], t2 = export(lighter(basket, 0.08), BM)
out['basketH'] = round((mx.z - mn.z) / D, 4)
info.append(f'kosz: {t1} / {t2} trójkątów, wysokość {out["basketH"]} szerokości')

# ---------------- jabłko, chleb, beczka (Poly Haven, CC0; skany prawdziwych przedmiotów) ----------------
# Próba z oryginałem obok: skany pękały na szwach tekstury przy odchudzaniu, po sklejeniu wierzchołków (weld) już nie.
# Wszystkie w układzie gry: dno w y = 0, środek podstawy w (0, 0), największa szerokość = 1 (beczka: wysokość = 1).
def upright(o, by_height=False):
    mn, mx = bounds(o)
    k = 1 / (mx.z - mn.z) if by_height else 1 / max(mx.x - mn.x, mx.y - mn.y)
    return Matrix.Scale(k, 4) @ B2G @ Matrix.Translation(-Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))), (mn, mx)


apple = load_all(os.path.join(src, 'food_apple_01', 'food_apple_01_1k.gltf'))
textures(apple, 'apple', padding=True)
AM, (mn, mx) = upright(apple)
# z bliska 30% bez sklejania (czyste na próbie; sklejone szwy przy 15% dawały ciemne trójkąty przy szypułce),
# z daleka 15% ze sklejeniem (bez rys, a drobiazgi przy szypułce z tej odległości znikają)
out['apple'], t1 = export(lighter(apple, 0.3), AM)
out['appleFar'], t2 = export(lighter(apple, 0.15, weld=True), AM)
info.append(f'jabłko: {t1} / {t2} trójkątów, wysokość {round((mx.z - mn.z) / max(mx.x - mn.x, mx.y - mn.y), 3)} szerokości')

for k in (1, 2, 3):
    bun = load_all(os.path.join(src, 'hamburger_buns', 'hamburger_buns_1k.gltf'), only=f'hamburger_buns_0{k}')
    if k == 1:
        textures(bun, 'bread', padding=True)
    BM2, (mn, mx) = upright(bun)
    out[f'bun{k}'], t1 = export(lighter(bun, 0.15, weld=True), BM2)
    out[f'bun{k}Far'], t2 = export(lighter(bun, 0.08, weld=True), BM2)
    out[f'bun{k}H'] = round((mx.z - mn.z) / max(mx.x - mn.x, mx.y - mn.y), 4)
    info.append(f'chleb {k}: {t1} / {t2} trójkątów, wysokość {out[f"bun{k}H"]} szerokości')

# beczka: obręcze i klepki to osobne bryły, każde odchudzenie je rwie — w ręce chłopa pełna (barrel), w stosach
# w składzie prosta bryła z wypalonym wyglądem pełnej (barrelLow, tools/models/props_import.py → bake_low)
barrel = load_all(os.path.join(src, 'wine_barrel_01', 'wine_barrel_01_1k.gltf'))
textures(barrel, 'barrel')
RM, (mn, mx) = upright(barrel, by_height=True)
out['barrel'], t1 = export(barrel, RM)
out['barrelFar'] = out['barrel']
low = bake_low(barrel, 'barrelLow')
out['barrelLow'], t2 = export(low, RM)
out['barrelLowFar'] = out['barrelLow']
out['barrelW'] = round(max(mx.x - mn.x, mx.y - mn.y) / (mx.z - mn.z), 4)
info.append(f'beczka: {t1} trójkątów pełna, {t2} wypalona, szerokość {out["barrelW"]} wysokości')

import json  # noqa: E402
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('\n'.join(info))
print(OUT, os.path.getsize(OUT) // 1024, 'KB')
