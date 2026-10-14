"""Wspólne narzędzia do budynków: bryły (pudło, walec, stożek, ostrosłup), cień w zagłębieniach, zapis.

Budynek ma grupy: 'base' (widać zawsze), 'shell' (dachy i piętra — znikają przy podglądzie wnętrza),
'interior' (wnętrze widoczne po zdjęciu dachu), 'floor' (podłoga sypialni: na niej śpią mieszkańcy).
Każda grupa dzieli się na materiały gry (castle, slate, woodDark…); gra nakłada na nie swoje tekstury
(współrzędne tekstury liczy z położenia, tak jak dla brył z kodu), a kolor wierzchołka niesie cień.
Zapis: pozycje int16 (1/2048 pola), cień uint8, bez indeksów (płaskie cieniowanie i tak rozdziela wierzchołki).
"""
import base64
import json
import math
import os
import struct

import bpy  # noqa: F401
from mathutils import Vector
from mathutils.bvhtree import BVHTree

Q = 2048.0


class Building:
    def __init__(self):
        self.parts = {}   # (grupa, materiał) -> lista wielokątów [(x, y, z), ...]

    def poly(self, group, mat, pts):
        self.parts.setdefault((group, mat), []).append([tuple(p) for p in pts])

    # ---------- bryły (y = spód, jak box() w grze) ----------
    def box(self, group, mat, w, h, d, x=0.0, y=0.0, z=0.0, rot=0.0, top=True, bottom=False, tilt=0.0):
        """Pudło stojące na (x, y, z); rot = obrót wokół pionu, tilt = pochylenie wokół osi x (przy spodzie)"""
        c, s = math.cos(rot), math.sin(rot)
        ct, st = math.cos(tilt), math.sin(tilt)
        def P(px, py, pz):
            py, pz = py * ct - pz * st, py * st + pz * ct
            return (x + px * c + pz * s, y + py, z - px * s + pz * c)
        a, b, e = w / 2, d / 2, h
        v = [P(-a, 0, -b), P(a, 0, -b), P(a, 0, b), P(-a, 0, b), P(-a, e, -b), P(a, e, -b), P(a, e, b), P(-a, e, b)]
        faces = [(3, 2, 6, 7), (1, 0, 4, 5), (2, 1, 5, 6), (0, 3, 7, 4)]
        if top:
            faces.append((7, 6, 5, 4))
        if bottom:
            faces.append((0, 1, 2, 3))
        for f in faces:
            self.poly(group, mat, [v[i] for i in f])

    def prism(self, group, mat, r0, r1, h, x=0.0, y=0.0, z=0.0, seg=12, top=True, phase=0.0):
        """Walec / ścięty stożek o seg bokach (r1 = 0: stożek)"""
        ring = lambda r, yy: [(x + math.sin(phase + 2 * math.pi * k / seg) * r, yy, z + math.cos(phase + 2 * math.pi * k / seg) * r) for k in range(seg)]
        lo, hi = ring(r0, y), ring(r1, y + h)
        for k in range(seg):
            k2 = (k + 1) % seg
            if r1 > 1e-6:
                self.poly(group, mat, [lo[k], lo[k2], hi[k2], hi[k]])
            else:
                self.poly(group, mat, [lo[k], lo[k2], (x, y + h, z)])
        if top and r1 > 1e-6:
            self.poly(group, mat, list(hi))  # wierzch walca patrzy w górę

    def pyramid(self, group, mat, w, d, h, x=0.0, y=0.0, z=0.0):
        a, b = w / 2, d / 2
        base = [(x - a, y, z + b), (x + a, y, z + b), (x + a, y, z - b), (x - a, y, z - b)]
        apex = (x, y + h, z)
        for k in range(4):
            self.poly(group, mat, [base[k], base[(k + 1) % 4], apex])

    def gable(self, group, mat, x0, x1, z0, z1, y, h, along_x=True, over=0.12, end_mat=None):
        """Dach dwuspadowy nad prostokątem (kalenica wzdłuż x albo z), z okapem; szczyty z materiału end_mat"""
        if along_x:
            zm = (z0 + z1) / 2
            a, b = (x0 - over, z0 - over), (x1 + over, z1 + over)
            r0, r1 = (a[0], y, a[1]), (b[0], y, a[1])
            q0, q1 = (a[0], y, b[1]), (b[0], y, b[1])
            k0, k1 = (a[0], y + h, zm), (b[0], y + h, zm)
            self.poly(group, mat, [r0, r1, k1, k0])
            self.poly(group, mat, [q1, q0, k0, k1])
            if end_mat:
                self.poly(group, end_mat, [(x0, y, z1), (x0, y, z0), (x0, y + h, zm)])
                self.poly(group, end_mat, [(x1, y, z0), (x1, y, z1), (x1, y + h, zm)])
        else:
            xm = (x0 + x1) / 2
            a, b = (x0 - over, z0 - over), (x1 + over, z1 + over)
            self.poly(group, mat, [(a[0], y, b[1]), (a[0], y, a[1]), (xm, y + h, a[1]), (xm, y + h, b[1])])
            self.poly(group, mat, [(b[0], y, a[1]), (b[0], y, b[1]), (xm, y + h, b[1]), (xm, y + h, a[1])])
            if end_mat:
                self.poly(group, end_mat, [(x0, y, z0), (x1, y, z0), (xm, y + h, z0)])
                self.poly(group, end_mat, [(x1, y, z1), (x0, y, z1), (xm, y + h, z1)])
        # spód połaci, żeby od środka (spacer) dach nie był przezroczysty
        self.poly(group, mat, [(x0 - over, y - 0.001, z0 - over), (x1 + over, y - 0.001, z0 - over), (x1 + over, y - 0.001, z1 + over), (x0 - over, y - 0.001, z1 + over)])

    def merlons_line(self, group, mat, x0, z0, x1, z1, y, step=0.24, w=0.1, h=0.13, t=0.07):
        L = math.hypot(x1 - x0, z1 - z0)
        n = max(1, int(L / step))
        rot = -math.atan2(z1 - z0, x1 - x0)
        for i in range(n):
            f = (i + 0.5) / n
            self.box(group, mat, w, h, t, x0 + (x1 - x0) * f, y, z0 + (z1 - z0) * f, rot)

    def merlons_ring(self, group, mat, cx, cz, r, y, n=8, w=0.09, h=0.12, t=0.07):
        for i in range(n):
            a = 2 * math.pi * i / n
            self.box(group, mat, w, h, t, cx + math.sin(a) * r, y, cz + math.cos(a) * r, a)

    # ---------- cień i zapis ----------
    def _tris(self, keys, maxe):
        """Wielokąty -> trójkąty, duże ściany dzielone na siatkę (cień w zagłębieniach potrzebuje wierzchołków)"""
        out = {}
        for key in keys:
            tris = []
            for p in self.parts[key]:
                if len(p) == 4:
                    A, B, C, D = (Vector(q) for q in p)
                    nu = max(1, math.ceil(max((B - A).length, (C - D).length) / maxe))
                    nv = max(1, math.ceil(max((D - A).length, (C - B).length) / maxe))
                    at = lambda u, v: A.lerp(B, u).lerp(D.lerp(C, u), v)
                    for i in range(nu):
                        for j in range(nv):
                            a, b = at(i / nu, j / nv), at((i + 1) / nu, j / nv)
                            c, d = at((i + 1) / nu, (j + 1) / nv), at(i / nu, (j + 1) / nv)
                            tris += [(a, b, c), (a, c, d)]
                else:
                    P = [Vector(q) for q in p]
                    for k in range(1, len(P) - 1):
                        tris.append((P[0], P[k], P[k + 1]))
            out[key] = tris
        return out

    def save(self, name, maxe=0.22, rays=20, reach=0.35, extra=None):
        groups = sorted({g for g, _ in self.parts})
        tris = self._tris(list(self.parts), maxe)
        # dwa widoki: z dachem (base + shell) i z odkrytym wnętrzem (base + interior + floor)
        views = {'outside': ('base', 'shell'), 'inside': ('base', 'interior', 'floor', 'ceiling')}
        trees = {}
        for v, gs in views.items():
            verts, polys = [], []
            for (g, _m), ts in tris.items():
                if g in gs:
                    for t in ts:
                        polys.append((len(verts), len(verts) + 1, len(verts) + 2))
                        verts += list(t)
            trees[v] = BVHTree.FromPolygons(verts, polys, epsilon=0.0)
        golden = math.pi * (3 - math.sqrt(5))
        dirs = []
        for i in range(rays):
            yy = 1 - (i + 0.5) / rays
            r = math.sqrt(1 - yy * yy)
            dirs.append(Vector((math.cos(golden * i) * r, yy, math.sin(golden * i) * r)))
        out, ntri = {}, 0
        for (g, m), ts in tris.items():
            tree = trees['inside' if g in ('interior', 'floor', 'ceiling') else 'outside']
            pos, ao = bytearray(), bytearray()
            for a, b, c in ts:
                n = (b - a).cross(c - a)
                if n.length < 1e-9:
                    continue
                n.normalize()
                for p in (a, b, c):
                    hit = tot = 0.0
                    for d in dirs:
                        dd = d if d.dot(n) > 0 else -d
                        w = dd.dot(n)
                        tot += w
                        h = tree.ray_cast(p + n * 0.003, dd, reach)
                        if h[0] is not None:
                            hit += w * (1 - (h[3] / reach) * 0.6)
                    k = 0.42 + 0.58 * (1 - hit / max(tot, 1e-6))
                    pos += struct.pack('<3h', *[max(-32767, min(32767, round(q * Q))) for q in p])
                    ao.append(max(0, min(255, round(k * 255))))
                ntri += 1
            out.setdefault(g, []).append({'mat': m, 'pos': base64.b64encode(bytes(pos)).decode(), 'ao': base64.b64encode(bytes(ao)).decode()})
        dst = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', f'{name}.json')
        with open(dst, 'w') as f:
            json.dump({'q': Q, **(extra or {}), **out}, f, separators=(',', ':'))
        draws = sum(len(v) for v in out.values())
        print(f'{name}: {ntri} trójkątów, {draws} siatek ({", ".join(f"{g} {len(v)}" for g, v in out.items())}), plik {os.path.getsize(dst) // 1024} KB')
