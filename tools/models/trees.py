"""Drzewa z Blendera: świerk i drzewo liściaste (dąb/lipa) w skali gry — pień z korą, gałęzie i korona
z kart z teksturą igliwia albo liści (przezroczystość robi gra: alphaTest), jak w grach RPG.

  świerk:     pień zwężający się do czubka, suche kikuty gałęzi nisko, 11 pięter gałęzi-kart opadających na boki
              (każda gałąź to dwie skrzyżowane karty, żeby z boku i z góry była pełna), czubek z krzyżaka kart
  liściaste:  pień z lekkim skrętem, 4 konary i drobniejsze gałęzie, korona z ok. 36 kęp liści (każda z trzech
              skrzyżowanych kart) rozłożonych po nierównej elipsoidzie, gęściej u góry

Kolory wierzchołków: cień wewnątrz korony i u dołu (bake_ao na pniu, ręcznie w koronie), jaśniejsze końce gałęzi.
Normalne kart odchylone na zewnątrz korony: światło układa się na całej koronie jak na bryle, a nie na płaskich kartach.
Pień i gałęzie to zamknięte bryły (gra nie rysuje tylnych stron); karty korony mają materiał dwustronny.

Wymiary w polach (1 pole ≈ 3 m, chłop ≈ 0,6): świerk 2,45 wysokości, korona od 0,85; liściaste 2,1, korona od 1,05.
Gra skaluje instancje (×1,6 w pionie), więc dorosłe drzewo ma ok. 11 m.

Uruchomienie (z katalogu repo):  /tmp/claude-0/bpyenv/bin/python tools/models/trees.py  →  src/render/models/trees.json
"""
import base64
import json
import math
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import bake_ao, reset  # noqa: E402

reset()
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', 'trees.json')


class Geo:
    """Siatka w układzie gry (y w górę): pozycje, normalne, uv, kolory, trójkąty"""

    def __init__(self):
        self.pos, self.nrm, self.uv, self.col, self.idx = [], [], [], [], []

    def v(self, p, n, uv, c):
        self.pos.append(tuple(p)); self.nrm.append(norm(n)); self.uv.append(tuple(uv)); self.col.append(tuple(c))
        return len(self.pos) - 1

    def add(self, other):
        b = len(self.pos)
        self.pos += other.pos; self.nrm += other.nrm; self.uv += other.uv; self.col += other.col
        self.idx += [tuple(b + i for i in f) for f in other.idx]


def norm(v):
    l = math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) or 1
    return (v[0] / l, v[1] / l, v[2] / l)


def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def addv(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def mul(a, k): return (a[0] * k, a[1] * k, a[2] * k)
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


class Rnd:
    def __init__(self, s): self.s = s
    def __call__(self):
        self.s = (self.s * 16807) % 2147483647
        return self.s / 2147483647


def tube(path, seg, bark_col, uv_wrap=2.0):
    """Zamknięta rura wzdłuż ścieżki [(x, y, z, r)]: pierścienie prostopadłe do kierunku, denka na obu końcach"""
    g = Geo()
    rings = []
    length = 0.0
    for i, (x, y, z, r) in enumerate(path):
        p = (x, y, z)
        if i < len(path) - 1:
            d = norm(sub(path[i + 1][:3], p))
        else:
            d = norm(sub(p, path[i - 1][:3]))
        if i > 0:
            length += math.dist(p, path[i - 1][:3])
        ref = (1, 0, 0) if abs(d[0]) < 0.9 else (0, 0, 1)
        a = norm(cross(d, ref)); b = cross(d, a)
        ring = []
        for k in range(seg + 1):
            t = 2 * math.pi * k / seg
            n = addv(mul(a, math.cos(t)), mul(b, math.sin(t)))
            ring.append(g.v(addv(p, mul(n, r)), n, (k / seg * uv_wrap, length * 2.2), bark_col(p)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(seg):
            a0, a1, b0, b1 = rings[i][k], rings[i][k + 1], rings[i + 1][k], rings[i + 1][k + 1]
            g.idx += [(a0, b0, a1), (a1, b0, b1)]
    for end, sign in ((0, -1), (len(path) - 1, 1)):
        x, y, z, r = path[end]
        d = norm(sub(path[1][:3], path[0][:3])) if end == 0 else norm(sub(path[-1][:3], path[-2][:3]))
        d = mul(d, sign)
        c = g.v((x, y, z), d, (0.5, 0.5), bark_col((x, y, z)))
        ring = rings[end]
        cap = [g.v(g.pos[ring[k]], d, (0.5 + 0.5 * math.cos(2 * math.pi * k / seg), 0.5 + 0.5 * math.sin(2 * math.pi * k / seg)), g.col[ring[k]]) for k in range(seg)]
        for k in range(seg):
            a0, a1 = cap[k], cap[(k + 1) % seg]
            g.idx.append((c, a1, a0) if sign > 0 else (c, a0, a1))
    return g


def card(g, p0, p1, side, w0, w1, n_of, c0, c1, uv=(0, 0, 1, 1)):
    """Karta (prostokąt zwężający się) od p0 do p1, szerokość w kierunku `side`; u wzdłuż, v w poprzek"""
    u0, v0, u1, v1 = uv
    s0, s1 = mul(side, w0 / 2), mul(side, w1 / 2)
    a = g.v(sub(p0, s0), n_of(p0), (u0, v0), c0)
    b = g.v(addv(p0, s0), n_of(p0), (u0, v1), c0)
    c = g.v(addv(p1, s1), n_of(p1), (u1, v1), c1)
    d = g.v(sub(p1, s1), n_of(p1), (u1, v0), c1)
    g.idx += [(a, b, c), (a, c, d)]


def grey(k):
    return (k, k, k)


# ------------------------------------------------------------------ świerk
def spruce():
    rnd = Rnd(11)
    H, C0 = 2.45, 0.85
    lean = (0.02, 0, -0.015)

    def axis(y):
        f = y / H
        return (lean[0] * f * f, y, lean[2] * f * f)

    bark = lambda p: grey(0.62 + min(0.3, p[1] * 0.25))
    trunk = tube([(*axis(y), 0.12 * (1 - y / H) ** 0.85 + 0.012) for y in [0, 0.2, 0.8, 1.5, 2.3]], 6, bark)
    # suche kikuty gałęzi pod koroną (stary świerk gubi dolne gałęzie)
    for k in range(3):
        y = 0.42 + k * 0.14
        a = k * 2.4 + 0.3
        base = axis(y)
        d = (math.cos(a), -0.15, math.sin(a))
        L = 0.1 + rnd() * 0.08
        trunk.add(tube([(*addv(base, mul(d, 0.05)), 0.012), (*addv(base, mul(d, 0.05 + L)), 0.004)], 4, lambda p: grey(0.5)))
    crown = Geo()
    TIERS = 9
    for t in range(TIERS):
        f = t / (TIERS - 1)
        y = C0 + f * (H - 0.3 - C0)
        R = 0.6 * (1 - f) ** 0.95 + 0.07
        B = 7 if t < 6 else 6 if t < 9 else 5
        for j in range(B):
            a = 2 * math.pi * j / B + t * 0.83 + (rnd() - 0.5) * 0.4
            out = (math.cos(a), 0, math.sin(a))
            side = (-math.sin(a), 0, math.cos(a))
            r = R * (0.85 + rnd() * 0.3)
            root = addv(axis(y), mul(out, 0.03))
            droop = 0.1 + 0.16 * r + rnd() * 0.05
            tip = addv(addv(axis(y), mul(out, r)), (0, -droop, 0))
            mid = addv(addv(axis(y), mul(out, r * 0.55)), (0, -droop * 0.25, 0))
            n_of = lambda p, o=out: norm(addv(mul(o, 0.85), (0, 0.55, 0)))
            dark = 0.5 + f * 0.25
            w = 0.16 + r * 0.42
            # gałąź w dwóch odcinkach (łuk opadający ku końcowi) i druga karta skrzyżowana pod kątem (pełna z boku)
            card(crown, root, mid, side, w * 0.55, w, n_of, grey(dark), grey(dark + 0.2), (0, 0, 0.55, 1))
            card(crown, mid, tip, side, w, w * 0.55, n_of, grey(dark + 0.2), grey(dark + 0.42), (0.55, 0, 1, 1))
            up = norm(addv(mul(side, 0.35), (0, 1, 0)))
            card(crown, root, tip, up, w * 0.35, w * 0.6, n_of, grey(dark - 0.05), grey(dark + 0.3))
    # czubek: dwie skrzyżowane pionowe karty
    top0, top1 = axis(H - 0.42), axis(H)
    for a in (0.3, 0.3 + math.pi / 2):
        side = (math.cos(a), 0, math.sin(a))
        card(crown, top0, top1, side, 0.26, 0.04, lambda p: (0, 1, 0), grey(0.8), grey(1.0))
    # cień: trzy zamknięte stożki (bryła cienia bez dziur, tańsza niż karty)
    shadow = Geo()
    for y0, y1, r in ((C0 - 0.15, C0 + 0.75, 0.62), (C0 + 0.45, C0 + 1.2, 0.45), (C0 + 0.95, H, 0.28)):
        shadow.add(cone(y0, y1, r, 7))
    return trunk, crown, shadow


def cone(y0, y1, r, seg):
    g = Geo()
    tip = g.v((0, y1, 0), (0, 1, 0), (0, 0), grey(1))
    bottom = g.v((0, y0, 0), (0, -1, 0), (0, 0), grey(1))
    ring = [g.v((math.cos(2 * math.pi * k / seg) * r, y0, math.sin(2 * math.pi * k / seg) * r), (math.cos(2 * math.pi * k / seg), 0.5, math.sin(2 * math.pi * k / seg)), (0, 0), grey(1)) for k in range(seg)]
    for k in range(seg):
        a, b = ring[k], ring[(k + 1) % seg]
        g.idx += [(tip, b, a), (bottom, a, b)]
    return g


# ------------------------------------------------------------------ drzewo liściaste
def broadleaf():
    rnd = Rnd(7)
    CY, RX, RY = 1.55, 0.68, 0.56   # środek i promienie korony
    bark = lambda p: grey(0.6 + min(0.3, p[1] * 0.22))
    wood = tube([(0, 0, 0, 0.15), (0.0, 0.08, 0.0, 0.13), (0.02, 0.5, 0.01, 0.11), (0.03, 0.95, -0.01, 0.095), (0.0, 1.25, 0.0, 0.07)], 7, bark)
    ends = []
    for k in range(4):
        a = k * 2 * math.pi / 4 + 0.6 + (rnd() - 0.5) * 0.5
        d = (math.cos(a), 0, math.sin(a))
        y0 = 0.95 + k * 0.07
        p0 = (0.03, y0, 0)
        p1 = addv(p0, addv(mul(d, 0.22), (0, 0.28, 0)))
        p2 = addv(p0, addv(mul(d, 0.45), (0, 0.62 + rnd() * 0.12, 0)))
        wood.add(tube([(*p0, 0.06), (*p1, 0.045), (*p2, 0.022)], 5, bark))
        ends.append(p2)
        # gałązka boczna
        side = (-d[2], 0, d[0])
        q2 = addv(p1, addv(mul(side, 0.25 * (1 if k % 2 else -1)), (0, 0.3, 0)))
        wood.add(tube([(*p1, 0.025), (*q2, 0.012)], 3, bark))
        ends.append(q2)
    crown = Geo()
    N = 52
    golden = math.pi * (3 - math.sqrt(5))
    center = (0, CY, 0)
    for i in range(N):
        yy = 1 - (i + 0.5) / N * 1.85        # więcej kęp u góry, spód korony rzadszy
        yy = max(-0.9, yy)
        rr = math.sqrt(max(0, 1 - yy * yy))
        a = golden * i
        k = 0.6 + rnd() * 0.42
        c = (math.cos(a) * rr * RX * k, CY + yy * RY * k, math.sin(a) * rr * RX * k)
        s = 0.42 + rnd() * 0.16
        light = 0.55 + 0.35 * (yy * 0.5 + 0.5) + (rnd() - 0.5) * 0.08
        n_of = lambda p: norm(addv(sub(p, center), (0, 0.25, 0)))
        for m in range(3):
            # trzy karty pod różnymi kątami (losowy obrót kępy)
            th = rnd() * math.pi
            ph = (rnd() - 0.5) * 1.2
            dirv = (math.cos(th) * math.cos(ph), math.sin(ph), math.sin(th) * math.cos(ph))
            side = norm(cross(dirv, (rnd() - 0.5, 1, rnd() - 0.5)))
            p0 = sub(c, mul(dirv, s / 2)); p1 = addv(c, mul(dirv, s / 2))
            card(crown, p0, p1, side, s, s, n_of, grey(light - 0.08), grey(light + 0.08))
    shadow = Geo()
    shadow.add(ellipsoid(center, (RX * 0.92, RY * 0.95, RX * 0.92), 8, 5))
    return wood, crown, shadow


def ellipsoid(c, r, seg, rings):
    g = Geo()
    rows = []
    for i in range(rings + 1):
        phi = math.pi * i / rings
        row = []
        for k in range(seg):
            th = 2 * math.pi * k / seg
            n = (math.sin(phi) * math.cos(th), math.cos(phi), math.sin(phi) * math.sin(th))
            row.append(g.v((c[0] + n[0] * r[0], c[1] + n[1] * r[1], c[2] + n[2] * r[2]), n, (0, 0), grey(1)))
        rows.append(row)
    for i in range(rings):
        for k in range(seg):
            a, b = rows[i][k], rows[i][(k + 1) % seg]
            c2, d = rows[i + 1][k], rows[i + 1][(k + 1) % seg]
            g.idx += [(a, b, c2), (b, d, c2)]
    return g


def pack(g):
    pos = b''.join(struct.pack('<3f', *p) for p in g.pos)
    nrm = b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in g.nrm)
    col = b''.join(struct.pack('<3B', *[max(0, min(255, round(c * 255))) for c in cc]) for cc in g.col)
    uv = b''.join(struct.pack('<2f', *u) for u in g.uv)
    idx = b''.join(struct.pack('<3H', *f) for f in g.idx)
    e = lambda b: base64.b64encode(b).decode()
    return {'pos': e(pos), 'nrm': e(nrm), 'col': e(col), 'uv': e(uv), 'idx': e(idx)}


# ------------------------------------------------------------------ podszyt: paproć i opadła gałąź
def fern():
    g = Geo()
    for k in range(3):
        a = k * math.pi / 3 + 0.2
        side = (math.cos(a), 0, math.sin(a))
        # karta stojąca, lekko odchylona od pionu (kępa rozkłada się na boki)
        card(g, (0, 0, 0), (math.sin(a) * 0.05, 0.42, -math.cos(a) * 0.05), side, 0.5, 0.5, lambda p: (0, 1, 0), grey(0.55), grey(1.0), (0, 1, 1, 0))
    # karty od dołu do góry: u = wysokość; tekstura paproci ma nasadę na dole (v obrócone w grze)
    return g


def deadwood():
    rnd = Rnd(4)
    bark = lambda p: grey(0.55 + rnd() * 0.1)
    g = tube([(-0.32, 0.03, 0.0, 0.035), (-0.05, 0.035, 0.02, 0.03), (0.3, 0.03, -0.01, 0.02)], 6, bark)
    g.add(tube([(-0.05, 0.035, 0.02, 0.014), (0.08, 0.06, 0.16, 0.006)], 4, bark))
    g.add(tube([(0.12, 0.033, 0.0, 0.012), (0.22, 0.05, -0.13, 0.005)], 4, bark))
    return g


out = {}
for name, geo in (('fern', fern()), ('deadwood', deadwood())):
    out[name] = pack(geo)
    print(name, len(geo.idx), 'trójkątów')
for name, (trunk, crown, shadow) in (('pine', spruce()), ('leaf', broadleaf())):
    # cień w zagłębieniach pnia: zasłania go też korona (bryła cienia korony), więc pień pod koroną ciemnieje
    bake_ao([(trunk, (0, 0, 0)), (shadow, (0, 0, 0))], rays=16, reach=0.35, sample=[(trunk, (0, 0, 0))])
    out[name + 'Trunk'] = pack(trunk)
    out[name + 'Crown'] = pack(crown)
    out[name + 'Shadow'] = pack(shadow)
    print(name, 'pień', len(trunk.idx), 'korona', len(crown.idx), 'cień', len(shadow.idx), 'trójkątów')
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('trees', os.path.getsize(OUT) // 1024, 'KB')
