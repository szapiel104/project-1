"""Gotowe modele z Sketchfab do składu: blok granitu, snopki zboża, sztaby żelaza.

    /tmp/bpyenv/bin/python tools/models/stock_import.py <katalog z paczkami>

W katalogu (pobrane z Sketchfab jako GLB, licencja CC BY 4.0 — autorzy w CREDITS.md):
  granite_block.glb                      — „Granite block”, matousekfoto (skan, tekstury 4K, 3 części z własną teksturą)
  kcisa-sheafofrice.glb                  — „KCISA-볏단(SheafOfRice)”, Korea Culture Information Service Agency
                                            (w paczce trzy wersje snopka obok siebie; bierzemy pełną, Sheaf.001)
  blacksmith_ingots_game_ready_asset.glb — „Blacksmith Ingots”, Aparicio Silva 3D (9 sztab; bierzemy trzy żelazne)

Zasada Michała (19.10.2026, CLAUDE.md): bez odchudzania i docinania — oryginalne trójkąty, UV, normalne i tekstury
w rozdzielczości paczki (JPG). Wersja z daleka (klucz <nazwa>Far) = ta sama siatka.

Wynik (dopisywany do src/render/models/props.json, jak w props_import.py):
  granite1..3 — trzy części jednego bloku (każda z własną teksturą), wspólny układ: dno bloku w y = 0, środek podstawy
                w (0, 0), największa szerokość bloku = 1; graniteH = wysokość bloku;
  sheaf       — snopek leży wzdłuż x (kłosy w +x), dno w y = 0, środek podstawy w (0, 0), długość = 1; sheafW, sheafH;
  ingots      — trzy sztaby jak w paczce (dwie na dole, jedna na nich), sztaby wzdłuż z, dno w 0, długość = 1; ingotsW, ingotsH.
  public/textures/cc0/prop_{granite1,granite2,granite3,sheaf,ingots}{,_n}.jpg
Skan granitu ma światło wypalone w kolorze i nie ma mapy normalnych (gra rysuje go bez niej, props.ts NO_NORMAL).
"""
import base64
import json
import os
import struct
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(ROOT, 'src', 'render', 'models', 'props.json')
TEX = os.path.join(ROOT, 'public', 'textures', 'cc0')
B2G = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))   # (x, y, z) Blendera → (x, z, -y) gry, wyznacznik +1


def pack(pos, nrm, uv, idx):
    e = lambda b: base64.b64encode(b).decode()
    assert len(pos) < 65536, len(pos)
    return {
        'pos': e(b''.join(struct.pack('<3f', *p) for p in pos)),
        'nrm': e(b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in nrm)),
        'col': e(bytes([255]) * (3 * len(pos))),
        'uv': e(b''.join(struct.pack('<2f', *u) for u in uv)),
        'idx': e(b''.join(struct.pack('<3H', *f) for f in idx)),
    }


def export(o, M):
    """Siatka → bufory gry (jak w props_import.py): wierzchołek na każdą parę (pozycja, normalna narożnika, UV)."""
    me = o.data
    me.calc_loop_triangles()
    uvl = me.uv_layers.active.data
    N = M.to_3x3().inverted().transposed()
    W = o.matrix_world
    NW = W.to_3x3().inverted().transposed()
    pos, nrm, uv, idx, seen = [], [], [], [], {}
    for tri in me.loop_triangles:
        face = []
        for li, vi, cn in zip(tri.loops, tri.vertices, tri.split_normals):
            p = M @ (W @ me.vertices[vi].co)
            n = (N @ (NW @ Vector(cn))).normalized()
            u = tuple(uvl[li].uv)
            key = (vi, round(n.x, 3), round(n.y, 3), round(n.z, 3), round(u[0], 5), round(u[1], 5))
            k = seen.get(key)
            if k is None:
                k = seen[key] = len(pos)
                pos.append(tuple(p)); nrm.append(tuple(n)); uv.append(u)
            face.append(k)
        idx.append(tuple(face))
    return pack(pos, nrm, uv, idx), len(idx)


def bounds(obs):
    pts = [o.matrix_world @ v.co for o in obs for v in o.data.vertices]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


def save(img, name, quality=88):
    """Zapis obrazu z paczki jako JPG w jego rozdzielczości (save_render: zwykłe save() zostawiało PNG z nazwą .jpg)."""
    st = bpy.context.scene.render.image_settings
    st.file_format = 'JPEG'
    st.quality = quality
    st.color_mode = 'RGB'
    bpy.context.scene.view_settings.view_transform = 'Standard'   # bez Filmic/AgX: kolory 1:1 z paczki
    bpy.context.scene.view_settings.look = 'None'
    if name.endswith('_n'):
        img.colorspace_settings.name = 'Non-Color'
    img.save_render(filepath=os.path.join(TEX, f'prop_{name}.jpg'))


def image_into(mat, kind):
    """Obraz podpięty w materiale paczki: 'color' (Base Color albo emisja skanu) lub 'normal' (Normal Map)."""
    for l in mat.node_tree.links:
        if l.from_node.type != 'TEX_IMAGE':
            continue
        if kind == 'color' and ((l.to_node.type == 'BSDF_PRINCIPLED' and l.to_socket.name == 'Base Color') or l.to_node.type == 'EMISSION'):
            return l.from_node.image
        if kind == 'normal' and l.to_node.type == 'NORMAL_MAP':
            return l.from_node.image
    return None


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']


src = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else sys.argv[1]
out, info = {}, []

# ---------------- granit: trzy części skanu, wspólne przekształcenie ----------------
parts = sorted(load(os.path.join(src, 'granite_block.glb')), key=lambda o: o.name)
mn, mx = bounds(parts)
D = max(mx.x - mn.x, mx.y - mn.y)
GM = Matrix.Scale(1 / D, 4) @ B2G @ Matrix.Translation(-Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z)))
tris = 0
for k, o in enumerate(parts, 1):
    out[f'granite{k}'], t = export(o, GM)
    out[f'granite{k}Far'] = out[f'granite{k}']
    tris += t
    save(image_into(o.material_slots[0].material, 'color'), f'granite{k}', 90)
out['graniteH'] = round((mx.z - mn.z) / D, 4)
info.append(f'granit: {tris} trójkątów w 3 częściach, wysokość {out["graniteH"]} szerokości')

# ---------------- snopek: pełna wersja z paczki ----------------
obs = load(os.path.join(src, 'kcisa-sheafofrice.glb'))
sheaf = next(o for o in obs if o.name.startswith('Sheaf.001'))
mn, mx = bounds([sheaf])
L = mx.y - mn.y
# w paczce snopek leży wzdłuż y Blendera; w grze wzdłuż x: obrót o 90° wokół pionu (bez lustra)
SM = (Matrix.Scale(1 / L, 4) @ Matrix.Rotation(-1.5707963, 4, 'Y') @ B2G
      @ Matrix.Translation(-Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))))
out['sheaf'], t = export(sheaf, SM)
out['sheafFar'] = out['sheaf']
out['sheafW'] = round((mx.x - mn.x) / L, 4)
out['sheafH'] = round((mx.z - mn.z) / L, 4)
m = sheaf.material_slots[0].material
save(image_into(m, 'color'), 'sheaf'); save(image_into(m, 'normal'), 'sheaf_n')
info.append(f'snopek: {t} trójkątów, szerokość {out["sheafW"]}, wysokość {out["sheafH"]} długości')

# ---------------- sztaby żelaza: trzy żelazne z paczki, w swoim ułożeniu ----------------
obs = load(os.path.join(src, 'blacksmith_ingots_game_ready_asset.glb'))
iron = [o for o in obs if o.material_slots[0].material.name == 'Iron']
assert len(iron) == 3, [o.name for o in iron]
bpy.ops.object.select_all(action='DESELECT')
for o in iron:
    o.select_set(True)
bpy.context.view_layer.objects.active = iron[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.join()
bar = bpy.context.view_layer.objects.active
mn, mx = bounds([bar])
L = mx.y - mn.y
IM = Matrix.Scale(1 / L, 4) @ B2G @ Matrix.Translation(-Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z)))
out['ingots'], t = export(bar, IM)
out['ingotsFar'] = out['ingots']
out['ingotsW'] = round((mx.x - mn.x) / L, 4)
out['ingotsH'] = round((mx.z - mn.z) / L, 4)
m = bar.material_slots[0].material
save(image_into(m, 'color'), 'ingots'); save(image_into(m, 'normal'), 'ingots_n')
info.append(f'sztaby: {t} trójkątów, szerokość {out["ingotsW"]}, wysokość {out["ingotsH"]} długości')

prev = json.load(open(OUT)) if os.path.exists(OUT) else {}
with open(OUT, 'w') as f:
    json.dump({**prev, **out}, f, separators=(',', ':'))
print('\n'.join(info))
print(OUT, os.path.getsize(OUT) // 1024, 'KB')
