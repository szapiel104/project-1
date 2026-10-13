"""Wspólne części postaci: głowa z twarzą, powłoki włosów i brody, łączenie siatek, cień, wersja z daleka i zapis.

Każda postać (guard.py, peasant.py, spearman.py, archer.py) składa się z trzech grup:
  static — tułów i głowa (stoją), leg — noga (obrót w biodrze), arm — ręka (obrót w barku).
Siatka = (materiał, kolor dynamiczny, warunek wyglądu); te same klucze łączymy w jedną siatkę.
"""
import base64
import json
import math
import os
import struct

import bpy  # noqa: F401
import bmesh
from common import Mesh, bake_ao, evaluated, g2b, sphere


def smooth(e0, e1, t):
    t = max(0.0, min(1.0, (t - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def bump(u, v, cu, cv, su, sv):
    return math.exp(-((u - cu) ** 2) / (2 * su * su) - ((v - cv) ** 2) / (2 * sv * sv))


def face(x, y, z, strong=1.0):
    """Twarz z kuli jednostkowej (y w górę, przód +z): szczęka, broda, nos, łuk brwiowy, oczodoły, kości policzkowe"""
    u, v = math.atan2(x, z), y
    front = max(0.0, z)
    k = 1.0
    k -= 0.2 * max(0.0, -v - 0.25)
    k += strong * 0.09 * bump(u, v, 0, -0.8, 0.32, 0.14)
    k += strong * (0.07 * bump(u, v, 0.55, -0.62, 0.22, 0.14) + 0.07 * bump(u, v, -0.55, -0.62, 0.22, 0.14))
    k += 0.3 * bump(u, v, 0, -0.14, 0.075, 0.17) * front
    k += 0.09 * bump(u, v, 0, -0.33, 0.1, 0.05) * front
    k += 0.09 * bump(u, v, 0, 0.2, 0.55, 0.07) * front
    k -= 0.05 * bump(u, v, 0, -0.5, 0.25, 0.05) * front
    for su in (-0.36, 0.36):
        k -= 0.13 * bump(u, v, su, 0.04, 0.13, 0.09) * front
        k += 0.05 * bump(u, v, su * 1.4, -0.18, 0.15, 0.1) * front
    k += 0.04 * bump(u, v, math.pi, 0.25, 0.8, 0.5)
    return x * k * (0.92 if z < 0 else 1), y, z * k


class Head:
    """Głowa w punkcie C o półosiach R; powłoki włosów/brody chowają się gładko pod skórę"""

    def __init__(self, C, R, seg=22, rings=16, strong=1.0):
        self.C, self.R, self.seg, self.rings, self.strong = C, R, seg, rings, strong
        self.eye_y = C[1] + R[1] * 0.1
        self.eye_x = R[0] * 0.36
        ob = sphere('head', C, R, seg=seg, rings=rings, shape=lambda x, y, z: face(x, y, z, strong))
        self.skin = Mesh(evaluated(ob), self._skin_col, 'skin', dyn='skin')

    def _skin_col(self, x, y, z):
        k = 1.0
        if z > self.C[2] + self.R[2] * 0.6:
            for sx in (-1, 1):
                d = math.sqrt(((x - sx * self.eye_x) / (self.R[0] * 0.18)) ** 2 + ((y - self.eye_y) / (self.R[1] * 0.095)) ** 2)
                k = min(k, 0.22 + 0.78 * min(1.0, d))
        return (k, k, k)

    def unit(self, x, y, z):
        C, R = self.C, self.R
        return (x - C[0]) / R[0], (y - C[1]) / R[1], (z - C[2]) / R[2]

    def shell(self, name, grow, mask, dyn='hair', mat='cloth', show=None, shade=None):
        C, R = self.C, self.R
        def shp(x, y, z):
            x, y, z = face(x, y, z, self.strong)
            k = 0.985 + (grow - 0.985) * max(0.0, min(1.0, mask(x, y, z)))
            return x * k, y * k, z * k
        ob = sphere(name, C, R, seg=self.seg, rings=self.rings, shape=shp)
        bm = evaluated(ob)
        dead = [f for f in bm.faces if all(mask(*self.unit(v.co.x, v.co.z, -v.co.y)) < 0.02 for v in f.verts)]
        bmesh.ops.delete(bm, geom=dead, context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        col = (lambda x, y, z: shade(*self.unit(x, y, z))) if shade else (1.0, 1.0, 1.0)
        return Mesh(bm, col, mat, dyn=dyn, show=show)

    def ears(self, scale=1.0):
        out = []
        for sx in (-1, 1):
            e = sphere(f'ear{sx}', (sx * self.R[0] * 0.96, self.C[1] - self.R[1] * 0.07, self.C[2] - 0.006), (0.006 * scale, 0.013 * scale, 0.009 * scale), seg=8, rings=6)
            out.append(Mesh(evaluated(e), (1, 1, 1), 'skin', dyn='skin'))
        return out


def join(meshes, mat=None):
    out = Mesh.__new__(Mesh)
    out.pos, out.nrm, out.col, out.idx = [], [], [], []
    out.mat, out.dyn, out.show = mat or meshes[0].mat, meshes[0].dyn, meshes[0].show
    for m in meshes:
        base = len(out.pos)
        out.pos += m.pos
        out.nrm += m.nrm
        out.col += m.col
        out.idx += [tuple(base + i for i in f) for f in m.idx]
    return out


def groups(meshes, mat_of=lambda m: m.mat):
    by = {}
    for m in meshes:
        by.setdefault((mat_of(m), m.dyn, m.show), []).append(m)
    return [join(v, k[0]) for k, v in by.items()]


def fixed_cloth(m):
    """Stałe kolory skóry i tkaniny razem w jednej (dwustronnej) siatce; metal i skóra ciała osobno"""
    return 'cloth' if m.mat in ('leather', 'cloth') and m.dyn is None else m.mat


def decimated(m, ratio):
    """Uproszczona kopia siatki (Blender Decimate), z kolorami wierzchołków — do wersji z daleka"""
    me = bpy.data.meshes.new('far')
    me.from_pydata([g2b(*p) for p in m.pos], [], m.idx)
    ca = me.color_attributes.new('c', 'FLOAT_COLOR', 'POINT')
    for i, c in enumerate(m.col):
        ca.data[i].color = (c[0], c[1], c[2], 1.0)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new('far', me)
    bpy.context.scene.collection.objects.link(ob)
    d = ob.modifiers.new('dec', 'DECIMATE')
    d.ratio = ratio
    d.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg).to_mesh()
    out = Mesh.__new__(Mesh)
    out.mat, out.dyn, out.show = m.mat, m.dyn, m.show
    out.pos = [(v.co.x, v.co.z, -v.co.y) for v in ev.vertices]
    out.nrm = [(v.normal.x, v.normal.z, -v.normal.y) for v in ev.vertices]
    cc = ev.color_attributes.get('c')
    out.col = [tuple(cc.data[i].color[:3]) for i in range(len(ev.vertices))] if cc else [(1, 1, 1)] * len(ev.vertices)
    ev.calc_loop_triangles()
    out.idx = [tuple(t.vertices) for t in ev.loop_triangles]
    ob.evaluated_get(dg).to_mesh_clear()
    return out


def pack(m):
    pos = b''.join(struct.pack('<3f', *p) for p in m.pos)
    nrm = b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in m.nrm)
    col = b''.join(struct.pack('<3B', *[max(0, min(255, round(c * 255))) for c in cc]) for cc in m.col)
    idx = b''.join(struct.pack('<3H', *f) for f in m.idx)
    e = lambda b: base64.b64encode(b).decode()
    return {'mat': m.mat, 'dyn': m.dyn, 'show': m.show, 'pos': e(pos), 'nrm': e(nrm), 'col': e(col), 'idx': e(idx)}


def finish(name, static, leg, arm, hip, shoulder, hand, extra=None, far_ratio=0.22):
    """Cień w zagłębieniach (cała postać w pozie spoczynkowej), łączenie siatek, wersja z daleka, zapis JSON"""
    pose = [(m, (0, 0, 0)) for m in static]
    for sx in (-1, 1):
        pose += [(m, (sx * hip[0], hip[1], hip[2])) for m in leg]
        pose += [(m, (sx * shoulder[0], shoulder[1], shoulder[2])) for m in arm]
    seen, uniq = set(), []
    for m, o in pose:
        if id(m) not in seen:
            seen.add(id(m))
            uniq.append((m, o))
    bake_ao(pose, sample=uniq)
    near = {'static': groups(static, fixed_cloth), 'leg': groups(leg, fixed_cloth), 'arm': groups(arm, fixed_cloth)}
    # z daleka: metal i tkanina w jednej siatce, wszystko kilka razy rzadsze
    far_of = lambda m: 'leather' if m.dyn is None else m.mat
    far = {k: [decimated(m, far_ratio) for m in groups(v, far_of)] for k, v in near.items()}
    out = {'hip': hip, 'shoulder': shoulder, 'hand': hand, **(extra or {})}
    for k in ('static', 'leg', 'arm'):
        out[k] = [pack(m) for m in near[k]]
        out['far_' + k] = [pack(m) for m in far[k]]
    dst = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', f'{name}.json')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    tri = lambda d: sum(len(m.idx) for m in d['static']) + 2 * sum(len(m.idx) for m in d['leg'] + d['arm'])
    draws = lambda d: len(d['static']) + 2 * (len(d['leg']) + len(d['arm']))
    print(f'{name}: blisko {tri(near)} trójkątów / {draws(near)} siatek, z daleka {tri(far)} / {draws(far)}, plik {os.path.getsize(dst) // 1024} KB')
