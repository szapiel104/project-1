"""Gotowe modele z sieci (robione przez grafików) w wersji do gry: ryba i pochodnia w ręce chłopa.

    /tmp/bpyenv/bin/python tools/models/props_import.py <katalog z paczkami>

W katalogu: BarramundiFish.glb (Khronos glTF-Sample-Assets, CC0, Microsoft), torch.glb (Secret Histories, CC-BY-SA 4.0)
i wicker_basket_02/ (Poly Haven, CC0, paczka glTF 1K).

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


def textures(o, name):
    """Kolor i mapa normalnych z materiału paczki → prop_<name>.jpg, prop_<name>_n.jpg (1024 px)"""
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
    for suf, img in found.items():
        im = img.copy()
        if im.size[0] > TEX_SIZE:
            im.scale(TEX_SIZE, TEX_SIZE)
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


def lighter(o, ratio):
    """Kopia odchudzona tylko do wersji z daleka: Decimate z zachowaniem szwów UV i brzegów (płetwy nie znikają)"""
    c = o.copy()
    c.data = o.data.copy()
    bpy.context.scene.collection.objects.link(c)
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

import json  # noqa: E402
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('\n'.join(info))
print(OUT, os.path.getsize(OUT) // 1024, 'KB')
