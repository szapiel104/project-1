"""Jodła z Poly Haven (fir_sapling, CC0) — gotowy model pobrany z sieci, w Blenderze tylko odchudzony do gry.

Źródło: https://polyhaven.com/a/fir_sapling (glTF 1K). Rozpakuj paczkę do katalogu i podaj go jako argument:

    /tmp/bpyenv/bin/python tools/models/fir_polyhaven.py /ścieżka/do/fir_sapling_1k

Wynik:
  src/render/models/fir.json          — firTrunk (gałęzie i pień), firCrown (igły), firShadow (bryła cienia)
  public/textures/cc0/fir_*.jpg       — tekstury z paczki zmniejszone do 512 px (kora i igły, kolor + normalne)

Model ma prawdziwe igły jako siatkę (ok. 150 tys. trójkątów), więc Decimate zbija je do budżetu gry (FIR_TRIS).
Układ jak w grze: y w górę, podstawa pnia w (0, 0, 0), wysokość ok. 2,35 (świerk z trees.py ma 2,45).
"""
import base64
import json
import os
import struct
import sys

import bpy
import bmesh

SRC = sys.argv[-1]
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(ROOT, 'src', 'render', 'models', 'fir.json')
TEX = os.path.join(ROOT, 'public', 'textures', 'cc0')
VARIANT = 'fir_sapling_a'
HEIGHT = 2.35
FIR_TRIS = int(os.environ.get('FIR_TRIS', '6000'))  # igły
TRUNK_TRIS = 300

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, 'fir_sapling_1k.gltf'))

root = bpy.data.objects[VARIANT]
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and (o == root or o.parent == root)]
for o in list(bpy.data.objects):
    if o not in meshes:
        bpy.data.objects.remove(o, do_unlink=True)
ob = meshes[0]
bpy.context.view_layer.objects.active = ob
ob.select_set(True)
ob.location = (0, 0, 0)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# rozdział na gałęzie (kora) i igły po materiale
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')
parts = {o.active_material.name: o for o in bpy.context.selected_objects}
trunk_ob, crown_ob = parts['fir_sapling_branches'], parts['fir_sapling_twigs']


def decimate(o, target):
    n = len(o.data.polygons)
    if n <= target:
        return
    bpy.context.view_layer.objects.active = o
    m = o.modifiers.new('dec', 'DECIMATE')
    m.ratio = target / n
    m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=m.name)


decimate(crown_ob, FIR_TRIS)
decimate(trunk_ob, TRUNK_TRIS)

# skala i środek: podstawa pnia w zerze
zs = [v.co.z for o in (trunk_ob, crown_ob) for v in o.data.vertices]
k = HEIGHT / (max(zs) - min(zs))
base = [v.co for v in trunk_ob.data.vertices if v.co.z < min(zs) + 0.02]
cx = sum(c.x for c in base) / len(base)
cy = sum(c.y for c in base) / len(base)
z0 = min(zs)


def tri_geo(o):
    """pos/nrm/uv na wierzchołek rogu (płaskie zszycie po UV), indeksy trójkątów; Blender z-up → gra y-up"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    uvl = bm.loops.layers.uv.active
    pos, nrm, uv, idx, seen = [], [], [], [], {}
    for f in bm.faces:
        tri = []
        for lp in f.loops:
            v = lp.vert
            u = tuple(round(c, 5) for c in lp[uvl].uv) if uvl else (0.0, 0.0)
            key = (v.index, u)
            if key not in seen:
                seen[key] = len(pos)
                x, y, z = (v.co.x - cx) * k, (v.co.y - cy) * k, (v.co.z - z0) * k
                pos.append((x, z, -y))
                n = v.normal
                nrm.append((n.x, n.z, -n.y))
                uv.append((u[0], u[1]))  # jak w Blenderze: tekstury gry (KTX2) są zapisane z odwróconą osią Y
            tri.append(seen[key])
        idx.append(tri)
    bm.free()
    return pos, nrm, uv, idx


def pack(pos, nrm, uv, idx, col):
    e = lambda b: base64.b64encode(b).decode()
    assert len(pos) < 65536, len(pos)
    return {
        'pos': e(b''.join(struct.pack('<3f', *p) for p in pos)),
        'nrm': e(b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in nrm)),
        'col': e(b''.join(struct.pack('<3B', *[max(0, min(255, round(c * 255))) for c in cc]) for cc in col)),
        'uv': e(b''.join(struct.pack('<2f', *u) for u in uv)),
        'idx': e(b''.join(struct.pack('<3H', *f) for f in idx)),
    }


out = {}
tp, tn, tu, ti = tri_geo(trunk_ob)
# kora: ciemniej u dołu pod koroną
out['firTrunk'] = pack(tp, tn, tu, ti, [(0.7 + min(0.3, p[1] * 0.15),) * 3 for p in tp])
cp, cn, cu, ci = tri_geo(crown_ob)
# igły: wnętrze korony ciemniejsze (cień), końce gałęzi jasne — odległość od osi pnia względem promienia na tej wysokości
rmax = {}
for p in cp:
    b = int(p[1] * 6)
    rmax[b] = max(rmax.get(b, 0.01), (p[0] ** 2 + p[2] ** 2) ** 0.5)
cc = []
for p in cp:
    r = (p[0] ** 2 + p[2] ** 2) ** 0.5 / rmax[int(p[1] * 6)]
    g = 0.45 + 0.55 * min(1, r ** 0.8) * (0.85 + 0.15 * p[1] / HEIGHT)
    cc.append((g, g, g))
out['firCrown'] = pack(cp, cn, cu, ci, cc)

# bryła cienia: stożek w obrysie korony (zamknięty, 8 boków)
import math
ys = [p[1] for p in cp]
y0, y1 = min(ys), max(ys)
R = max((p[0] ** 2 + p[2] ** 2) ** 0.5 for p in cp if p[1] < y0 + (y1 - y0) * 0.3) * 0.85
sp, si = [(0, y1, 0), (0, y0, 0)], []
for i in range(8):
    a = i / 8 * math.tau
    sp.append((math.cos(a) * R, y0, math.sin(a) * R))
for i in range(8):
    a, b = 2 + i, 2 + (i + 1) % 8
    si += [(0, b, a), (1, a, b)]
out['firShadow'] = pack(sp, [(0, 1, 0)] * len(sp), [(0, 0)] * len(sp), si, [(1, 1, 1)] * len(sp))

with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('fir: pień', len(ti), 'igły', len(ci), 'trójkątów;', os.path.getsize(OUT) // 1024, 'KB')

# tekstury z paczki, zmniejszone do 512 px (gra i tak oglądana z kilkunastu metrów)
os.makedirs(TEX, exist_ok=True)
for src, dst in (('branches_diff', 'fir_bark'), ('branches_nor_gl', 'fir_bark_n'), ('twigs_diff', 'fir_needles'), ('twigs_nor_gl', 'fir_needles_n')):
    img = bpy.data.images.load(os.path.join(SRC, 'textures', f'fir_sapling_{src}_1k.jpg'))
    img.scale(512, 512)
    img.file_format = 'JPEG'
    img.filepath_raw = os.path.join(TEX, dst + '.jpg')
    bpy.context.scene.render.image_settings.quality = 88
    img.save()
    print('tekstura', dst)
