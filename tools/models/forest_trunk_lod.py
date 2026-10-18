"""Dalsza wersja pni drzew z forest.json (Poly Haven): ten sam pień odchudzony Decimate do kilkuset trójkątów.

Z bliska gra rysuje pełny pień, w średniej odległości (aż do mgły, gdzie drzewo zamienia się w obrazek) ten lżejszy,
więc zamiana na obrazek dzieje się dopiero w mgle i nic nie mruga przed oczami.

    /tmp/bpyenv/bin/python tools/models/forest_trunk_lod.py

Czyta i zapisuje src/render/models/forest.json (dopisuje klucz trunkFar każdej odmiany). Uruchamiać po
forest_polyhaven.py.
"""
import base64
import json
import os
import struct

import bpy
import bmesh

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'render', 'models', 'forest.json')
TARGET = {'conifer': 160, 'leaf': 360, 'sapling': 90}


def unpack(m):
    raw = lambda k: base64.b64decode(m[k])
    P = raw('pos')
    n = len(P) // 12
    pos = [struct.unpack_from('<3f', P, i * 12) for i in range(n)]
    nrm = [struct.unpack_from('<3b', raw('nrm'), i * 3) for i in range(n)]
    col = [struct.unpack_from('<3B', raw('col'), i * 3) for i in range(n)]
    uv = [struct.unpack_from('<2f', raw('uv'), i * 8) for i in range(n)]
    I = raw('idx')
    idx = [struct.unpack_from('<3H', I, i * 6) for i in range(len(I) // 6)]
    return pos, nrm, col, uv, idx


def pack(pos, nrm, uv, idx, col):
    e = lambda b: base64.b64encode(b).decode()
    return {
        'pos': e(b''.join(struct.pack('<3f', *p) for p in pos)),
        'nrm': e(b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in nrm)),
        'col': e(b''.join(struct.pack('<3B', *[max(0, min(255, round(c))) for c in cc]) for cc in col)),
        'uv': e(b''.join(struct.pack('<2f', *u) for u in uv)),
        'idx': e(b''.join(struct.pack('<3H', *f) for f in idx)),
    }


data = json.load(open(OUT))
for name, v in data.items():
    pos, nrm, col, uv, idx = unpack(v['trunk'])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    me = bpy.data.meshes.new('t')
    me.from_pydata(pos, [], idx)
    ul = me.uv_layers.new()
    cl = me.color_attributes.new('c', 'BYTE_COLOR', 'POINT')
    for l in me.loops:
        ul.data[l.index].uv = uv[l.vertex_index]
    for i, c in enumerate(col):
        cl.data[i].color = (c[0] / 255, c[1] / 255, c[2] / 255, 1)
    ob = bpy.data.objects.new('t', me)
    bpy.context.scene.collection.objects.link(ob)
    # zszycie wierzchołków rozdzielonych po UV, żeby Decimate widział jedną bryłę
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    bpy.context.view_layer.objects.active = ob
    target = TARGET[v['role']]
    n = len(me.polygons)
    if n > target:
        mod = ob.modifiers.new('dec', 'DECIMATE')
        mod.ratio = target / n
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    uvl = bm.loops.layers.uv.active
    cll = bm.verts.layers.color.active if hasattr(bm.verts.layers, 'color') else None
    P, N, U, C, T, seen = [], [], [], [], [], {}
    for f in bm.faces:
        tri = []
        for lp in f.loops:
            u = tuple(round(c, 4) for c in lp[uvl].uv)
            key = (lp.vert.index, u)
            if key not in seen:
                seen[key] = len(P)
                P.append(tuple(lp.vert.co))
                N.append(tuple(lp.vert.normal))
                U.append(u)
                k = 0.6 + 0.4 * min(1.0, lp.vert.co.y / 2.5)  # jak w pełnym pniu: ciemniej przy ziemi
                C.append((k * 255,) * 3)
            tri.append(seen[key])
        T.append(tri)
    bm.free()
    v['trunkFar'] = pack(P, N, U, T, C)
    print(name, 'pień', len(idx), '→', len(T), 'trójkątów')

with open(OUT, 'w') as f:
    json.dump(data, f, separators=(',', ':'))
print('forest', os.path.getsize(OUT) // 1024, 'KB')
