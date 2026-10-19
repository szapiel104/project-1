"""Worek z płótna (mąka, ziarno) — model z Blendera z symulacją tkaniny.

Gotowego worka z płótna na wolnej licencji nie ma (Poly Haven: tylko papierowe i plastikowe worki z nadrukami,
na GitHubie modele bez licencji albo generowane przez AI), więc robimy go tu, tak jak robi się worki do gier:
  1. bryła worka: zaokrąglone dno, brzuch, szyjka ściągnięta sznurem, nad nią zebrany kołnierz płótna;
  2. symulacja tkaniny (Cloth z ciśnieniem w środku, ziemia jako przeszkoda): napełniony worek siada pod własnym
     ciężarem, rozpłaszcza się na dole i marszczy; szyjka przypięta, żeby nie opadła;
  3. sznur: zamknięta obręcz z grubością wokół szyjki;
  4. tekstura juty z gry (public/textures/cc0/burlap.jpg, ambientCG Fabric 011, CC0) powtarzana wokół worka
     (UV walcowe w metrach), cień w fałdach liczony promieniami i zapisany w kolorach wierzchołków.

    /tmp/bpyenv/bin/python tools/models/sack.py

Wynik: klucz `sack` (i `sackFar` — ta sama siatka) w src/render/models/props.json, obok modeli z paczek.
Układ gry: dno w y = 0, środek podstawy w (0, 0), największa szerokość 1, wysokość `sackH`.
"""
import base64
import json
import math
import os
import random
import struct

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'src', 'render', 'models', 'props.json')

# wymiary w metrach (worek mąki ok. 50 kg): szerokość ok. 0,5, wysokość z kołnierzem ok. 0,8
R, H = 0.25, 0.72
SEG, RINGS = 48, 40
TILE = 0.3          # jedno powtórzenie tekstury juty na tyle metrów płótna
random.seed(7)


def profile(t):
    """Promień worka na wysokości t (0 = dno, 1 = wierzch kołnierza) przed symulacją: pełny worek mąki —
    okrągłe dno, pękaty brzuch, zaokrąglone ramiona tuż pod sznurem, krótka szyjka, pognieciony kołnierz"""
    if t < 0.1:                                    # zaokrąglone dno
        return R * math.sqrt(max(0.0, 1 - ((0.1 - t) / 0.1) ** 2)) * 0.95 + R * 0.05
    if t < 0.62:                                   # pękaty brzuch
        return R * (1.0 + 0.07 * math.sin((t - 0.1) / 0.52 * math.pi))
    if t < 0.84:                                   # zaokrąglone ramiona (ćwiartka elipsy) do szyjki
        k = (t - 0.62) / 0.22
        return R * (0.09 + 0.91 * math.sqrt(max(0.0, 1 - k ** 2.2)))
    k = (t - 0.84) / 0.16                          # kołnierz zebranego płótna nad sznurem (niski, pognieciony)
    return R * (0.09 + 0.1 * math.sin(k * math.pi * 0.85))


def fold(t, a, i):
    """Mnożnik promienia: fałdy płótna rozchodzące się od sznura w dół i pognieciony kołnierz"""
    f = 1.0
    if 0.62 < t < 0.84:                            # fałdy zebranego płótna na ramionach, tym głębsze, im bliżej szyjki
        k = (t - 0.62) / 0.22
        f += k ** 1.5 * (0.16 * math.sin(a * 9 + 0.6 * math.sin(a * 3)) + 0.07 * math.sin(a * 17 + 1.3))
    if t >= 0.84:                                  # kołnierz: nieregularne płaty
        f += 0.28 * math.sin(a * 6 + i * 0.7) + 0.12 * math.sin(a * 13 + i)
    return f * (1 + random.uniform(-0.012, 0.012))


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bm = bmesh.new()
    rings = []
    for i in range(RINGS + 1):
        t = i / RINGS
        z = t * H
        r = profile(t)
        ring = []
        for j in range(SEG):
            a = 2 * math.pi * j / SEG
            # kołnierz: płótno zebrane w fałdy (promień faluje wokół)
            rr = r * fold(t, a, i)
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, z)))
        rings.append(ring)
    for i in range(RINGS):
        for j in range(SEG):
            j2 = (j + 1) % SEG
            bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
    bot = bm.verts.new((0, 0, 0.0))
    top = bm.verts.new((0, 0, H * 0.94))            # wierzch kołnierza zapadnięty do środka (zebrane płótno)
    for j in range(SEG):
        j2 = (j + 1) % SEG
        bm.faces.new((bot, rings[0][j2], rings[0][j]))
        bm.faces.new((top, rings[-1][j], rings[-1][j2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('sack')
    bm.to_mesh(me)
    ob = bpy.data.objects.new('sack', me)
    bpy.context.scene.collection.objects.link(ob)
    # szyjka i kołnierz przypięte (grupa wierzchołków), reszta płótna wisi i siada
    pin = ob.vertex_groups.new(name='pin')
    pin.add([v.index for v in me.vertices if v.co.z > H * 0.83], 1.0, 'REPLACE')
    return ob


def simulate(ob, frames=60):
    sc = bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, 0.0))
    ground = bpy.context.active_object
    ground.modifiers.new('c', 'COLLISION')
    cl = ob.modifiers.new('cloth', 'CLOTH')
    s = cl.settings
    s.quality = 10
    s.mass = 0.6
    s.tension_stiffness = s.compression_stiffness = 30
    s.bending_stiffness = 0.5
    s.use_pressure = True
    s.uniform_pressure_force = 7.0
    s.vertex_group_mass = 'pin'
    s.pin_stiffness = 1.0
    cl.collision_settings.distance_min = 0.004
    cl.collision_settings.use_self_collision = False
    sc.frame_start, sc.frame_end = 1, frames
    cl.point_cache.frame_start, cl.point_cache.frame_end = 1, frames
    for f in range(1, frames + 1):
        sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
    ob.modifiers.clear()
    ob.data = me
    bpy.data.objects.remove(ground)
    # dno dokładnie na ziemi
    mz = min(v.co.z for v in me.vertices)
    for v in me.vertices:
        v.co.z -= mz
    return ob


def rope(neck_z, neck_r):
    """Sznur wokół szyjki: zamknięta rura (torus) z grubością, lekko nierówna"""
    bm = bmesh.new()
    n, m, rr = 40, 8, 0.011
    rings = []
    for i in range(n):
        a = 2 * math.pi * i / n
        c = Vector((math.cos(a) * (neck_r + rr * 0.6), math.sin(a) * (neck_r + rr * 0.6), neck_z + 0.004 * math.sin(a * 3)))
        out = Vector((math.cos(a), math.sin(a), 0))
        up = Vector((0, 0, 1))
        rings.append([bm.verts.new(c + (out * math.cos(b) + up * math.sin(b)) * rr) for b in [2 * math.pi * k / m for k in range(m)]])
    for i in range(n):
        for k in range(m):
            i2, k2 = (i + 1) % n, (k + 1) % m
            bm.faces.new((rings[i][k], rings[i2][k], rings[i2][k2], rings[i][k2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('rope')
    bm.to_mesh(me)
    ob = bpy.data.objects.new('rope', me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def neck(ob):
    """Wysokość i promień najwęższego miejsca worka w górnej części (tam wiąże się sznur)"""
    me = ob.data
    zs = [v.co.z for v in me.vertices]
    top = max(zs)
    best = (None, 9.0)
    for k in range(40):
        z = top * (0.6 + 0.35 * k / 39)
        r = [math.hypot(v.co.x, v.co.y) for v in me.vertices if abs(v.co.z - z) < top * 0.012]
        if len(r) > 8 and max(r) < best[1]:
            best = (z, max(r))
    return best


def export(parts):
    """parts: [(obiekt, odcień rgb)] → bufory gry (układ: y w górę), UV walcowe w metrach / TILE, cień w zagłębieniach"""
    allpos, allnrm, alluv, allidx, allcol = [], [], [], [], []
    # cień w fałdach: promienie z każdego wierzchołka w półkulę nad nim (całość razem: sznur cieniuje płótno)
    bms = []
    for ob, _ in parts:
        bm = bmesh.new(); bm.from_mesh(ob.data); bms.append(bm)
    joined = bmesh.new()
    for bm in bms:
        tmp = bpy.data.meshes.new('t'); bm.to_mesh(tmp); joined.from_mesh(tmp)
    tree = BVHTree.FromBMesh(joined)
    dirs = []
    for k in range(24):
        z = (k + 0.5) / 24
        a = k * 2.399963
        rr = math.sqrt(1 - z * z)
        dirs.append(Vector((math.cos(a) * rr, math.sin(a) * rr, z)))
    for (ob, tint), bm in zip(parts, bms):
        me = ob.data
        me.calc_loop_triangles()
        bm.verts.ensure_lookup_table()
        ao = []
        for v in me.vertices:
            n = v.normal
            t = Vector((1, 0, 0)) if abs(n.x) < 0.9 else Vector((0, 1, 0))
            t = (t - n * t.dot(n)).normalized(); b2 = n.cross(t)
            hit = 0
            for d in dirs:
                w = t * d.x + b2 * d.y + n * d.z
                if tree.ray_cast(v.co + n * 0.002, w, 0.12)[0] is not None:
                    hit += 1
            ao.append(1 - 0.75 * hit / len(dirs))
        seen = {}
        base = len(allpos)
        for tri in me.loop_triangles:
            # UV walcowe: kąt wokół osi rozwinięty w metrach (obwód), wysokość w metrach; szew poprawiany w obrębie trójkąta
            angs = [math.atan2(me.vertices[i].co.y, me.vertices[i].co.x) for i in tri.vertices]
            a0 = angs[0]
            angs = [a + (2 * math.pi if a - a0 < -math.pi else -2 * math.pi if a - a0 > math.pi else 0) for a in angs]
            face = []
            for vi, cn, a in zip(tri.vertices, tri.split_normals, angs):
                co = me.vertices[vi].co
                r = max(0.02, math.hypot(co.x, co.y))
                u = a * max(r, R * 0.6) / TILE
                vv = co.z / TILE
                key = (vi, round(u, 4), round(vv, 4))
                k = seen.get(key)
                if k is None:
                    k = seen[key] = len(allpos)
                    allpos.append((co.x, co.z, -co.y))
                    nn = Vector(cn).normalized()
                    allnrm.append((nn.x, nn.z, -nn.y))
                    alluv.append((u, vv))
                    allcol.append(tuple(c * ao[vi] for c in tint))
                face.append(k)
            allidx.append(tuple(face))
    # normalizacja: dno w 0, środek w (0, 0), największa szerokość 1
    xs = [p[0] for p in allpos]; zs = [p[2] for p in allpos]; ys = [p[1] for p in allpos]
    cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
    W = max(max(xs) - min(xs), max(zs) - min(zs))
    y0 = min(ys)
    allpos = [((x - cx) / W, (y - y0) / W, (z - cz) / W) for x, y, z in allpos]
    e = lambda b: base64.b64encode(b).decode()
    pack = {
        'pos': e(b''.join(struct.pack('<3f', *p) for p in allpos)),
        'nrm': e(b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in allnrm)),
        'col': e(b''.join(struct.pack('<3B', *[max(0, min(255, round(c * 255))) for c in cc]) for cc in allcol)),
        'uv': e(b''.join(struct.pack('<2f', *u) for u in alluv)),
        'idx': e(b''.join(struct.pack('<3H', *f) for f in allidx)),
    }
    return pack, len(allidx), (max(ys) - y0) / W, len(allpos)


ob = simulate(build())
nz, nr = neck(ob)
rp = rope(nz, nr)
# tekstura juty jest szara: barwa surowego lnu jak dawny worek w grze (0xbfa77c), sznur ciemniejszy brąz
pack, tris, hgt, nv = export([(ob, (0.82, 0.72, 0.54)), (rp, (0.48, 0.37, 0.24))])
data = json.load(open(OUT)) if os.path.exists(OUT) else {}
data['sack'] = pack
data['sackFar'] = pack
data['sackH'] = round(hgt, 4)
with open(OUT, 'w') as f:
    json.dump(data, f, separators=(',', ':'))
print(f'worek: {tris} trójkątów, {nv} wierzchołków, wysokość {round(hgt, 3)} szerokości, szyjka na {round(nz, 3)} m')
