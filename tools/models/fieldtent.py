"""Namiot polowy z medykiem (3×3 pola): duży namiot z płótna (pionowe ściany, dach dwuspadowy na kalenicy z dwóch
masztów), z przodu wejście z podwiniętą płachtą. W środku trzy posłania ze słomy z kocami, stół medyka z misą wody,
bandażami i słojami ziół, skrzynia. Przed namiotem ognisko z kociołkiem na trójnogu, kłoda do siedzenia, beczka
z wodą i sznur z suszącymi się bandażami między dwoma kołkami. Odciągi z liny do śledzi po bokach.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/fieldtent.py
Układ: środek działki = (0, 0), działka ±1,5, przód (wejście) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
fires = []
# spacer (Michał 29.10.2026: „dziwna kolizja” — namiot nie miał przeszkód z modelu i cała działka była ścianą):
# po działce chodzi się wszędzie, przeszkody to ściany namiotu, sprzęty i to, co stoi przed nim
OPEN, SOLID = [[-1.5, 1.5, -1.5, 1.5]], []


def block(x0, x1, z0, z1, y0=0.0, y1=9.0):
    SOLID.append([round(min(x0, x1), 3), round(max(x0, x1), 3), round(min(z0, z1), 3), round(max(z0, z1), 3), y0, y1])


def jit(k, a, s=1.0):
    """Stały „przypadek” z liczby (bez random: model wychodzi zawsze taki sam)"""
    return math.sin(k * 12.9898 + a * 78.233) * s


def stick(group, mat, p0, p1, r, seg=6, ends=None):
    """Kij / maszt / lina od p0 do p1: zamknięty walec z oboma denkami"""
    ends = ends or mat
    ax = [p1[i] - p0[i] for i in range(3)]
    L = math.sqrt(sum(a * a for a in ax))
    d = [a / L for a in ax]
    up = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)
    u = (d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0])
    ul = math.sqrt(sum(a * a for a in u))
    u = [a / ul for a in u]
    v = (d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0])

    def ring(c):
        return [tuple(c[i] + (u[i] * math.cos(2 * math.pi * k / seg) + v[i] * math.sin(2 * math.pi * k / seg)) * r for i in range(3)) for k in range(seg)]
    lo, hi = ring(p0), ring(p1)
    mid = [(p0[i] + p1[i]) / 2 for i in range(3)]
    for k in range(seg):
        k2 = (k + 1) % seg
        b.poly(group, mat, [lo[k], lo[k2], hi[k2], hi[k]], away=mid)
    b.poly(group, ends, lo, away=tuple(p1))
    b.poly(group, ends, hi, away=tuple(p0))


def vslab(group, mat, pts, z, t, out):
    """Pionowy płat płótna o kształcie wielokąta (x, y) w płaszczyźnie z, z grubością t; lico patrzy w stronę out (+1/-1)"""
    o = [(x, y, z) for x, y in pts]
    i = [(x, y, z - out * t) for x, y in pts]
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    b.poly(group, mat, o, away=(cx, cy, z - out * 5))
    b.poly(group, mat, i, away=(cx, cy, z + out * 5))
    n = len(pts)
    cen = (cx, cy, z - out * t / 2)
    for k in range(n):
        j = (k + 1) % n
        b.poly(group, mat, [o[k], o[j], i[j], i[k]], away=cen)


# ---------------- udeptana ziemia tylko pod namiotem (bez prostokąta na trawie przed wejściem) ----------------
b.box('base', 'soil', 2.0, 0.01, 1.71, 0, 0, -0.425)

# ---------------- namiot ----------------
X = 1.02            # ściany boczne
ZB, ZF = -1.3, 0.45  # tył i przód
WH, RH = 0.55, 1.22  # wysokość ścian i kalenicy
T = 0.014           # grubość płótna
OV = 0.07           # okap


def roof_y(x):
    return WH + (RH - WH) * (1 - abs(x) / X)


# ściany boczne
for s in (-1, 1):
    b.box('base', 'canvas', T, WH, ZF - ZB, s * (X - T / 2), 0.0, (ZF + ZB) / 2)
    # dolny brzeg ściany obłożony ciemniejszym, zabłoconym pasem płótna (o włos na zewnątrz)
    b.box('base', 'canvasDark', 0.006, 0.07, ZF - ZB, s * (X + 0.003), 0.0, (ZF + ZB) / 2)
# dach: dwie połacie z grubością, z okapem nad ścianami i nad szczytami
for s in (-1, 1):
    away = (0, 0.2, (ZF + ZB) / 2)
    b.slope('base', 'canvas', [(0, RH, ZB - OV), (0, RH, ZF + OV), (s * (X + OV), WH - 0.035, ZF + OV), (s * (X + OV), WH - 0.035, ZB - OV)], away, t=T)
    # szwy na połaci: ciemniejsze pasy płótna od kalenicy do okapu (o włos nad połacią)
    for k in (1, 2, 3):
        z = ZB + (ZF - ZB) * k / 4
        b.slope('base', 'canvasDark', [(0.02 * s, RH + 0.007, z - 0.018), (0.02 * s, RH + 0.007, z + 0.018), (s * (X + OV - 0.01), WH - 0.028, z + 0.018), (s * (X + OV - 0.01), WH - 0.028, z - 0.018)], away, t=0.004)
# szczyt tylny: zamknięty
vslab('base', 'canvas', [(-X, 0.0), (X, 0.0), (X, WH), (0, RH), (-X, WH)], ZB, T, -1)
# szczyt przedni: wejście w środku, nad nim trójkąt płótna
DO, DH = 0.5, 0.78   # pół szerokości i wysokość wejścia
for s in (-1, 1):
    pts = [(s * X, 0.0), (s * DO, 0.0), (s * DO, roof_y(DO)), (s * X, WH)]
    if s > 0:
        pts = list(reversed(pts))
    vslab('base', 'canvas', pts, ZF, T, 1)
vslab('base', 'canvas', [(-DO, DH), (DO, DH), (DO, roof_y(DO)), (0, RH), (-DO, roof_y(DO))], ZF, T, 1)
# podwinięta płachta wejścia: wałek płótna nad wejściem przewiązany sznurem
stick('base', 'canvasDark', (-DO + 0.02, DH - 0.03, ZF + 0.04), (DO - 0.02, DH - 0.03, ZF + 0.04), 0.035, seg=8)
for x in (-0.3, 0.3):
    stick('base', 'rope', (x, DH - 0.075, ZF + 0.04), (x, DH + 0.015, ZF + 0.04), 0.039, seg=8)
# maszty i kalenica (maszt przedni wystaje nad dach z proporcem)
for z, top in ((ZB + 0.06, RH + 0.04), (ZF - 0.06, RH + 0.32)):
    stick('base', 'woodDark', (0, 0.0, z), (0, top, z), 0.025)
stick('base', 'woodDark', (0, RH - 0.035, ZB + 0.02), (0, RH - 0.035, ZF - 0.02), 0.018)
PENNANT = [0.0, RH + 0.3, ZF - 0.06]

# odciągi z liny do śledzi wbitych w ziemię
for z in (ZB + 0.15, (ZB + ZF) / 2, ZF - 0.15):
    for s in (-1, 1):
        stick('base', 'rope', (s * (X + OV - 0.02), WH - 0.04, z), (s * 1.38, 0.05, z), 0.006, seg=4)
        b.box('base', 'woodDark', 0.025, 0.08, 0.025, s * 1.4, 0.0, z, roll=-s * 0.25)
for s in (-1, 1):
    stick('base', 'rope', (s * 0.4, roof_y(0.4) - 0.02, ZB - OV + 0.01), (s * 0.4, 0.05, -1.46), 0.006, seg=4)
    b.box('base', 'woodDark', 0.025, 0.08, 0.025, s * 0.4, 0.0, -1.47, tilt=-0.25)

# ---------------- wnętrze: posłania, stół medyka, skrzynia ----------------
def pallet(x, z, k):
    """Posłanie: siennik ze słomy, wałek pod głowę z płótna, koc zarzucony na dolną część"""
    b.box('base', 'hay', 0.5, 0.05, 0.24, x, 0.0, z, rot=jit(k, 1, 0.04))
    b.box('base', 'sack', 0.09, 0.045, 0.18, x - 0.18, 0.05, z, rot=jit(k, 1, 0.04))
    b.box('base', 'canvasDark', 0.3, 0.014, 0.27, x + 0.07, 0.05, z, rot=jit(k, 2, 0.1))


for k, (x, z) in enumerate(((-0.68, -1.0), (-0.68, -0.48), (0.68, -1.0))):
    pallet(x if x < 0 else x, z, k)
# miska i dzban przy posłaniach
b.prism('base', 'woodDark', 0.04, 0.055, 0.035, -0.32, 0.0, -0.75, seg=10)
b.prism('base', 'stoneDark', 0.045, 0.03, 0.12, -0.3, 0.0, -0.32, seg=10)

# stół medyka (prawy przód wnętrza)
TX, TZ, TY = 0.66, -0.42, 0.22
b.box('base', 'wood', 0.42, 0.03, 0.24, TX, TY, TZ)
for sx in (-1, 1):
    for sz in (-1, 1):
        b.box('base', 'woodDark', 0.028, TY, 0.028, TX + sx * 0.17, 0.0, TZ + sz * 0.09)
b.box('base', 'woodDark', 0.34, 0.02, 0.02, TX, 0.06, TZ + 0.09)
TOP = TY + 0.03
# misa z wodą
b.prism('base', 'woodDark', 0.05, 0.07, 0.04, TX - 0.1, TOP, TZ, seg=12)
b.prism('base', 'water', 0.062, 0.062, 0.03, TX - 0.1, TOP + 0.006, TZ, seg=12)
# zwoje bandaży, słoje z ziołami, butelka, nóż
for k, (dx, dz) in enumerate(((0.04, -0.06), (0.07, 0.03))):
    b.prism('base', 'canvas', 0.022, 0.022, 0.035, TX + dx, TOP, TZ + dz, seg=8)
for k, (dx, dz, h) in enumerate(((0.14, -0.06, 0.06), (0.16, 0.05, 0.05))):
    b.prism('base', 'stoneDark', 0.022, 0.018, h, TX + dx, TOP, TZ + dz, seg=8)
    b.prism('base', 'leaf', 0.016, 0.01, 0.014, TX + dx, TOP + h, TZ + dz, seg=6)
b.prism('base', 'woodDark', 0.016, 0.006, 0.07, TX - 0.03, TOP, TZ + 0.07, seg=6)
b.box('base', 'iron', 0.08, 0.006, 0.014, TX + 0.02, TOP, TZ - 0.08, rot=0.4)
# wiązki ziół zawieszone na kalenicy
for k, z in enumerate((-0.95, -0.7, -0.45)):
    stick('base', 'rope', (0, RH - 0.05, z), (0, RH - 0.17, z), 0.004, seg=4)
    b.prism('base', 'leaf', 0.012, 0.03, 0.09, jit(k, 3, 0.01), RH - 0.27, z, seg=6)
# skrzynia z okuciami przy tylnej ścianie
CX, CZ = 0.0, -1.12
b.box('base', 'woodDark', 0.34, 0.16, 0.18, CX + 0.15, 0.0, CZ)
for dx in (-0.12, 0.12):
    b.box('base', 'iron', 0.02, 0.166, 0.186, CX + 0.15 + dx, 0.0, CZ)
# wiadro przy wejściu
b.prism('base', 'wood', 0.05, 0.06, 0.1, -0.38, 0.0, 0.25, seg=10)
b.prism('base', 'iron', 0.066, 0.066, 0.015, -0.38, 0.07, 0.25, seg=10)

# ---------------- przed namiotem: ognisko z kociołkiem, kłoda, beczka, sznur z bandażami ----------------
FX, FZ = 0.72, 1.02
for k in range(8):
    a = 2 * math.pi * k / 8
    b.box('base', 'rockDark', 0.08, 0.05, 0.06, FX + math.cos(a) * 0.15, 0.0, FZ + math.sin(a) * 0.15, rot=a)
b.box('base', 'ash', 0.22, 0.01, 0.22, FX, 0.0, FZ)
for k in range(3):
    a = 2 * math.pi * k / 3 + 0.4
    stick('base', 'bark', (FX + math.cos(a) * 0.08, 0.012, FZ + math.sin(a) * 0.08), (FX - math.cos(a) * 0.08, 0.05, FZ - math.sin(a) * 0.08), 0.015)
fires.append([FX, 0.04, FZ])
# trójnóg i kociołek
for k in range(3):
    a = 2 * math.pi * k / 3
    stick('base', 'woodDark', (FX + math.cos(a) * 0.2, 0.0, FZ + math.sin(a) * 0.2), (FX, 0.5, FZ), 0.012)
stick('base', 'iron', (FX, 0.5, FZ), (FX, 0.32, FZ), 0.004, seg=4)
b.prism('base', 'iron', 0.05, 0.065, 0.05, FX, 0.22, FZ, seg=12)
b.prism('base', 'iron', 0.065, 0.055, 0.04, FX, 0.27, FZ, seg=12)
# kłoda do siedzenia
stick('base', 'bark', (0.42, 0.06, 1.34), (0.95, 0.06, 1.38), 0.06, seg=8, ends='wood')
# beczka z wodą (obręcze o włos szersze od klepek)
BX, BZ = -1.12, 0.78
b.prism('base', 'woodDark', 0.12, 0.14, 0.15, BX, 0.0, BZ, seg=12)
b.prism('base', 'woodDark', 0.14, 0.12, 0.15, BX, 0.15, BZ, seg=12)
for y in (0.04, 0.24):
    b.prism('base', 'iron', 0.135 + (0.01 if y < 0.1 else 0.006), 0.141 + (0.006 if y < 0.1 else 0.0), 0.028, BX, y, BZ, seg=12)
b.prism('base', 'water', 0.118, 0.118, 0.005, BX, 0.286, BZ, seg=12)
# sznur z bandażami między dwoma kołkami
P0, P1 = (-0.95, 1.36), (-0.12, 1.36)
for x, z in (P0, P1):
    stick('base', 'woodDark', (x, 0.0, z), (x, 0.5, z), 0.018)
stick('base', 'rope', (P0[0], 0.47, P0[1]), (P1[0], 0.47, P1[1]), 0.005, seg=4)
for k in range(6):
    f = (k + 0.7) / 6.6
    x = P0[0] + (P1[0] - P0[0]) * f
    h = 0.13 + abs(jit(k, 5, 0.06))
    b.box('base', 'canvas' if k % 2 else 'white', 0.045 + abs(jit(k, 6, 0.015)), h, 0.006, x, 0.465 - h, P0[1] + 0.008 * (1 if k % 2 else -1))

# przeszkody: ściany (wejście w środku przodu wolne), posłania, stół, skrzynia, wiadro, ognisko, kłoda, beczka, kołki
for sx in (-1, 1):
    block(sx * X - 0.04, sx * X + 0.04, ZB, ZF)
    block(sx * DO, sx * X, ZF - 0.04, ZF + 0.04)
block(-X, X, ZB - 0.04, ZB + 0.04)
for (x, z) in ((-0.68, -1.0), (-0.68, -0.48), (0.68, -1.0)):
    block(x - 0.26, x + 0.26, z - 0.14, z + 0.14, 0.0, 0.1)
block(TX - 0.22, TX + 0.22, TZ - 0.13, TZ + 0.13)
block(CX - 0.03, CX + 0.33, CZ - 0.1, CZ + 0.1)
block(-0.44, -0.32, 0.19, 0.31)
block(FX - 0.22, FX + 0.22, FZ - 0.22, FZ + 0.22)
block(0.4, 0.97, 1.28, 1.44, 0.0, 0.12)
block(BX - 0.15, BX + 0.15, BZ - 0.15, BZ + 0.15)
for x, z in (P0, P1):
    block(x - 0.04, x + 0.04, z - 0.04, z + 0.04)

VIEWS = [
    ['namiot od wejścia', [0.4, 0.9, 3.4], [0, 0.4, -0.3], ['base'], 24],
    ['wnętrze przez wejście', [0.0, 0.42, 1.2], [0, 0.25, -0.8], ['base'], 20],
    ['z tyłu', [-0.8, 1.0, -3.4], [0, 0.4, -0.4], ['base'], 24],
    ['przy ognisku', [1.5, 0.45, 1.8], [0.6, 0.3, 0.8], ['base'], 20],
]
b.save('fieldtent', maxe=0.22, rays=14, reach=0.3, extra={'floorY': 0.0, 'open': OPEN, 'solid': SOLID, 'campfires': fires, 'flames': [], 'pennant': PENNANT, 'views': VIEWS})
