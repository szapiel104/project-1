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
from common import Mesh, bake_ao, evaluated, g2b, skin, sphere


def smooth(e0, e1, t):
    t = max(0.0, min(1.0, (t - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def bump(u, v, cu, cv, su, sv):
    return math.exp(-((u - cu) ** 2) / (2 * su * su) - ((v - cv) ** 2) / (2 * sv * sv))


def face(x, y, z, strong=1.0):
    """Twarz z kuli jednostkowej (y w górę, przód +z): spokojna, ludzka — lekka broda, wąski nos, płytkie oczodoły.
    Postacie w grze mają kilkadziesiąt pikseli, więc rysy muszą być delikatne (mocne wypukłości dają małpi pysk)."""
    u, v = math.atan2(x, z), y
    front = max(0.0, z)
    k = 1.0
    k -= 0.16 * max(0.0, -v - 0.35)                                 # zwężenie ku brodzie (owal twarzy)
    k += strong * 0.035 * bump(u, v, 0, -0.78, 0.28, 0.12)           # broda
    k += 0.15 * bump(u, v, 0, -0.17, 0.075, 0.14) * front          # grzbiet nosa
    k += 0.05 * bump(u, v, 0, -0.29, 0.08, 0.06) * front            # czubek nosa
    k += 0.03 * bump(u, v, 0, 0.24, 0.5, 0.07) * front             # łuk brwiowy
    for su in (-0.36, 0.36):
        k -= 0.04 * bump(u, v, su, 0.06, 0.12, 0.08) * front       # płytkie oczodoły
    k += 0.04 * bump(u, v, math.pi, 0.25, 0.8, 0.5)                  # potylica
    return x * k * (0.94 if z < 0 else 1), y, z * k


class Head:
    """Głowa w punkcie C o półosiach R; powłoki włosów/brody chowają się gładko pod skórę"""

    def __init__(self, C, R, seg=26, rings=20, strong=1.0):
        self.C, self.R, self.seg, self.rings, self.strong = C, R, seg, rings, strong
        self.eye_y = C[1] + R[1] * 0.1
        self.eye_x = R[0] * 0.36
        ob = sphere('head', C, R, seg=seg, rings=rings, shape=lambda x, y, z: face(x, y, z, strong))
        self.skin = Mesh(evaluated(ob), self._skin_col, 'skin', dyn='skin')

    def _skin_col(self, x, y, z):
        ux, uy, uz = self.unit(x, y, z)
        # usta: cienka, ciemniejsza linia; lekko zaróżowione policzki dają twarzy ciepło
        k = 1.0
        if uz > 0.6:
            k -= 0.35 * math.exp(-((uy + 0.47) / 0.045) ** 2) * math.exp(-(ux / 0.2) ** 2)
        return (k, k * 0.97, k * 0.96)

    def point(self, ux, uy, front=True):
        """Punkt na powierzchni twarzy (jednostkowe x, y; przód) w układzie gry"""
        uz = math.sqrt(max(0.0, 1 - ux * ux - uy * uy)) * (1 if front else -1)
        x, y, z = face(ux, uy, uz, self.strong)
        return self.C[0] + x * self.R[0], self.C[1] + y * self.R[1], self.C[2] + z * self.R[2]

    def eyes(self, color=(0.12, 0.09, 0.07)):
        """Oczy: małe, ciemne, lekko wpuszczone w twarz — czytelne nawet z daleka"""
        out = []
        for sx in (-1, 1):
            x, y, z = self.point(sx * 0.34, 0.08)
            e = sphere(f'eye{sx}', (x, y, z - self.R[2] * 0.03), (self.R[0] * 0.1, self.R[1] * 0.075, self.R[2] * 0.06), seg=8, rings=6)
            out.append(Mesh(evaluated(e), color, 'leather'))
        return out

    def brows(self, dyn='hair'):
        """Brwi: wąskie łuki nad oczami w kolorze włosów"""
        out = []
        for sx in (-1, 1):
            pts = [self.point(sx * t, 0.27 - 0.05 * abs(t - 0.34) ** 1.5 * 4) for t in (0.18, 0.34, 0.5)]
            b = skin(f'brow{sx}', pts, [(0, 1), (1, 2)], [(0.004, 0.003), (0.0048, 0.0035), (0.0035, 0.0028)], subsurf=0)
            out.append(Mesh(evaluated(b), (0.8, 0.8, 0.8), 'cloth', dyn=dyn))
        return out

    def beard_mask(self):
        """Broda wokół szczęki i pod ustami, z bakami do uszu — twarz zostaje odsłonięta"""
        return lambda x, y, z: smooth(0.0, 0.1, -0.56 - y + 0.34 * (1 - max(0.0, z))) * smooth(-0.15, 0.3, z)

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
    """Stałe kolory tkaniny w jednej siatce, wyprawionej skóry (pasy, buty, sakwy) w drugiej — każda ze swoją teksturą
    z bliska (splot wełny, ziarno skóry); metal i skóra ciała osobno"""
    return m.mat


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
