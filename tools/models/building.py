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

    def poly(self, group, mat, pts, away=None):
        """Wielokąt; z `away` (punkt) przód ściany odwraca się od tego punktu (gra rysuje tylko przednią stronę)"""
        pts = [tuple(p) for p in pts]
        if away is not None:
            a, b2, c = (Vector(q) for q in pts[:3])
            n = (b2 - a).cross(c - a)
            mid = sum((Vector(q) for q in pts), Vector()) / len(pts)
            if n.dot(mid - Vector(away)) < 0:
                pts = list(reversed(pts))
        self.parts.setdefault((group, mat), []).append(pts)
        return pts

    def slope(self, group, mat, pts, away, t=0.025):
        """Połać dachu z grubością: wierzch odwrócony od `away` i spód tuż pod nim (widać go spod okapu)"""
        top = self.poly(group, mat, pts, away=away)
        low = [(x, y - t, z) for x, y, z in top]
        self.poly(group, mat, list(reversed(low)))
        n = len(top)
        cen = tuple(sum(q[i] for q in top) / n - (t / 2 if i == 1 else 0) for i in range(3))
        for k in range(n):  # boki płyty: dach to bryła, nie kartka — od krawędzi nic nie prześwituje
            j = (k + 1) % n
            self.poly(group, mat, [top[j], top[k], low[k], low[j]], away=cen)

    def gable_boards(self, group, mat, along, plane, a0, a1, y, rise, out, t=0.025, step=0.1, batten='woodDark'):
        """Szczyt z desek: pełny trójkąt z grubością (bez schodków) i pionowe listwy na licu, przycięte pod połacią.
        along = 'x': trójkąt w płaszczyźnie z = plane, rozpięty na x od a0 do a1; 'z': w płaszczyźnie x = plane.
        out = +1/-1: w którą stronę patrzy lico (na zewnątrz budynku)."""
        am = (a0 + a1) / 2

        def P(a, yy, d):
            return (a, yy, plane + d) if along == 'x' else (plane + d, yy, a)
        o = [P(a0, y, 0), P(a1, y, 0), P(am, y + rise, 0)]
        i = [P(a0, y, -out * t), P(a1, y, -out * t), P(am, y + rise, -out * t)]
        cen = P(am, y + rise / 3, -out * t / 2)
        far = P(am, y + rise / 3, out * 5)
        self.poly(group, mat, o, away=P(am, y + rise / 3, -out * 5))     # lico
        self.poly(group, mat, i, away=far)                               # strona wewnętrzna
        for k in range(3):                                               # brzegi trójkąta
            j = (k + 1) % 3
            self.poly(group, mat, [o[k], o[j], i[j], i[k]], away=cen)
        # listwy: od podstawy do połaci, wierzch na wysokości dachu przy zewnętrznej krawędzi listwy (nie wystaje)
        n = max(2, int(round((a1 - a0) / step)))
        half = (a1 - a0) / 2
        for k in range(1, n):
            a = a0 + (a1 - a0) * k / n
            edge = abs(a - am) + 0.012
            hh = rise * (1 - edge / half) - 0.015
            if hh < 0.03:
                continue
            if along == 'x':
                self.box(group, batten, 0.022, hh, 0.012, a, y, plane + out * 0.006)
            else:
                self.box(group, batten, 0.012, hh, 0.022, plane + out * 0.006, y, a)

    # ---------- bryły (y = spód, jak box() w grze) ----------
    def box(self, group, mat, w, h, d, x=0.0, y=0.0, z=0.0, rot=0.0, top=True, bottom=None, tilt=0.0, roll=0.0):
        """Pudło stojące na (x, y, z); rot = obrót wokół pionu, tilt = pochylenie wokół osi x, roll = wokół osi z (przy spodzie)"""
        c, s = math.cos(rot), math.sin(rot)
        ct, st = math.cos(tilt), math.sin(tilt)
        cr, sr = math.cos(roll), math.sin(roll)
        def P(px, py, pz):
            px, py = px * cr - py * sr, px * sr + py * cr
            py, pz = py * ct - pz * st, py * st + pz * ct
            return (x + px * c + pz * s, y + py, z - px * s + pz * c)
        a, b, e = w / 2, d / 2, h
        v = [P(-a, 0, -b), P(a, 0, -b), P(a, 0, b), P(-a, 0, b), P(-a, e, -b), P(a, e, -b), P(a, e, b), P(-a, e, b)]
        faces = [(3, 2, 6, 7), (1, 0, 4, 5), (2, 1, 5, 6), (0, 3, 7, 4)]
        if top:
            faces.append((7, 6, 5, 4))
        if bottom is None:  # spód dostaje wszystko, co nie leży na ziemi (okiennice, belki, daszki — widać je od dołu w spacerze)
            bottom = y > 0.005 or bool(tilt) or bool(roll)
        if bottom:
            faces.append((0, 1, 2, 3))
        for f in faces:
            self.poly(group, mat, [v[i] for i in f])

    def crystal(self, group, mat, x, y, z, r, seed=0.0, sx=1.0, sy=1.0, sz=1.0, seg=7):
        """Bryła rudy jak w Gothicu: nieregularny, zamknięty wielościan z płaskimi ściankami (same trójkąty).
        Środek w (x, y, z), promień r, rozciągnięcie sx/sy/sz; seed zmienia kształt."""
        def j(a, b, k):
            return math.sin(a * 12.9898 + b * 78.233 + seed * 3.17) * k
        rings = [(-0.55, 0.72), (0.05, 1.0), (0.58, 0.62)]
        pts = []
        for ri, (hy, rr) in enumerate(rings):
            ring = []
            for k in range(seg):
                a = 2 * math.pi * (k + 0.5 * ri + j(k, ri, 0.18)) / seg
                q = r * rr * (1 + j(ri, k, 0.22))
                ring.append((x + math.sin(a) * q * sx, y + (hy + j(k + 3, ri, 0.12)) * r * sy, z + math.cos(a) * q * sz))
            pts.append(ring)
        bot = (x + j(1, 2, 0.15) * r, y - 0.95 * r * sy, z + j(2, 1, 0.15) * r)
        top = (x + j(3, 4, 0.2) * r, y + 0.95 * r * sy, z + j(4, 3, 0.2) * r)
        c = (x, y, z)
        for k in range(seg):
            k2 = (k + 1) % seg
            self.poly(group, mat, [bot, pts[0][k2], pts[0][k]], away=c)
            for ri in range(len(pts) - 1):
                a, b2 = pts[ri], pts[ri + 1]
                self.poly(group, mat, [a[k], a[k2], b2[k2]], away=c)
                self.poly(group, mat, [a[k], b2[k2], b2[k]], away=c)
            self.poly(group, mat, [pts[-1][k], pts[-1][k2], top], away=c)

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
        if y > 0.005 and r0 > 1e-6:
            self.poly(group, mat, list(reversed(lo)))  # spód, gdy nie stoi na ziemi

    def pyramid(self, group, mat, w, d, h, x=0.0, y=0.0, z=0.0):
        a, b = w / 2, d / 2
        base = [(x - a, y, z + b), (x + a, y, z + b), (x + a, y, z - b), (x - a, y, z - b)]
        apex = (x, y + h, z)
        for k in range(4):
            self.poly(group, mat, [base[k], base[(k + 1) % 4], apex])

    def gable(self, group, mat, x0, x1, z0, z1, y, h, along_x=True, over=0.12, end_mat=None):
        """Dach dwuspadowy nad prostokątem (kalenica wzdłuż x albo z), z okapem; szczyty z materiału end_mat"""
        mid = ((x0 + x1) / 2, y + h * 0.3, (z0 + z1) / 2)
        if along_x:
            zm = (z0 + z1) / 2
            a, b = (x0 - over, z0 - over), (x1 + over, z1 + over)
            r0, r1 = (a[0], y, a[1]), (b[0], y, a[1])
            q0, q1 = (a[0], y, b[1]), (b[0], y, b[1])
            k0, k1 = (a[0], y + h, zm), (b[0], y + h, zm)
            self.slope(group, mat, [r0, r1, k1, k0], mid)
            self.slope(group, mat, [q1, q0, k0, k1], mid)
            if end_mat:
                f = self.poly(group, end_mat, [(x0, y, z1), (x0, y, z0), (x0, y + h, zm)], away=mid)
                self.poly(group, end_mat, list(reversed(f)))  # od środka też ściana
                f = self.poly(group, end_mat, [(x1, y, z0), (x1, y, z1), (x1, y + h, zm)], away=mid)
                self.poly(group, end_mat, list(reversed(f)))  # od środka też ściana
        else:
            xm = (x0 + x1) / 2
            a, b = (x0 - over, z0 - over), (x1 + over, z1 + over)
            self.slope(group, mat, [(a[0], y, b[1]), (a[0], y, a[1]), (xm, y + h, a[1]), (xm, y + h, b[1])], mid)
            self.slope(group, mat, [(b[0], y, a[1]), (b[0], y, b[1]), (xm, y + h, b[1]), (xm, y + h, a[1])], mid)
            if end_mat:
                f = self.poly(group, end_mat, [(x0, y, z0), (x1, y, z0), (xm, y + h, z0)], away=mid)
                self.poly(group, end_mat, list(reversed(f)))  # od środka też ściana
                f = self.poly(group, end_mat, [(x1, y, z1), (x0, y, z1), (xm, y + h, z1)], away=mid)
                self.poly(group, end_mat, list(reversed(f)))  # od środka też ściana
        # spód połaci, żeby od środka (spacer) dach nie był przezroczysty
        self.poly(group, mat, [(x0 - over, y - 0.001, z0 - over), (x1 + over, y - 0.001, z0 - over), (x1 + over, y - 0.001, z1 + over), (x0 - over, y - 0.001, z1 + over)], away=((x0 + x1) / 2, y + 1, (z0 + z1) / 2))

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

    def save(self, name, maxe=0.22, rays=20, reach=0.35, extra=None, grime=True):
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
                    k = 0.32 + 0.68 * (1 - hit / max(tot, 1e-6))
                    if grime:
                        # brud i zacieki: ciemniej przy ziemi i w plamach (szum z położenia), żeby kamień nie był jednolity
                        spot = math.sin(p.x * 1.7 + p.z * 0.9) * math.sin(p.z * 1.3 - p.x * 0.6 + p.y * 2.1)
                        k *= (0.86 + 0.14 * min(1.0, p.y / 0.7)) * (0.9 + 0.1 * spot)
                    pos += struct.pack('<3h', *[max(-32767, min(32767, round(q * Q))) for q in p])
                    ao.append(max(0, min(255, round(k * 255))))
                ntri += 1
            out.setdefault(g, []).append({'mat': m, 'pos': base64.b64encode(bytes(pos)).decode(), 'ao': base64.b64encode(bytes(ao)).decode()})
        dst = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', f'{name}.json')
        with open(dst, 'w') as f:
            json.dump({'q': Q, **(extra or {}), **out}, f, separators=(',', ':'))
        draws = sum(len(v) for v in out.values())
        print(f'{name}: {ntri} trójkątów, {draws} siatek ({", ".join(f"{g} {len(v)}" for g, v in out.items())}), plik {os.path.getsize(dst) // 1024} KB')
