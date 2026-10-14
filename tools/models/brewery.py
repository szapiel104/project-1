"""Browar (2×2 pola): kamienny dom z wysokim dachem z gontu, ceglany komin nad piecem warzelnym.
W środku: piec z ogniem i miedzianym kotłem, kadź zacierna z wiosłem, kadzie fermentacyjne, worki pszenicy,
regał z beczkami. Przed domem beczki gotowe do wywózki i szyld ze snopkiem i kuflem.
Dach (grupa 'shell') znika przy podglądzie wnętrza, gdy piwowar pracuje.

Uruchomienie (z katalogu repo):  python tools/models/brewery.py
Układ: środek działki = (0, 0), 1 = jedno pole, przód (drzwi) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
windows, chimneys, flames = [], [], []

P = 0.1                    # posadzka
X0, X1, Z0, Z1 = -0.82, 0.82, -0.78, 0.5
H = P + 0.72               # okap
T = 0.09
RISE = 0.78
DOOR = (-0.17, 0.17, 0.6)


def wall_x(group, mat, z, x0, x1, y0, y1, holes, depth=T):
    xs = sorted({x0, x1, *[h[0] for h in holes], *[h[1] for h in holes]})
    for a, c in zip(xs, xs[1:]):
        hs = [h for h in holes if h[0] <= a and h[1] >= c]
        if not hs:
            b.box(group, mat, c - a, y1 - y0, depth, (a + c) / 2, y0, z)
            continue
        _, _, v0, v1 = hs[0]
        if v0 > y0: b.box(group, mat, c - a, v0 - y0, depth, (a + c) / 2, y0, z)
        if v1 < y1: b.box(group, mat, c - a, y1 - v1, depth, (a + c) / 2, v1, z)


def wall_z(group, mat, x, z0, z1, y0, y1, holes, depth=T):
    zs = sorted({z0, z1, *[h[0] for h in holes], *[h[1] for h in holes]})
    for a, c in zip(zs, zs[1:]):
        hs = [h for h in holes if h[0] <= a and h[1] >= c]
        if not hs:
            b.box(group, mat, depth, y1 - y0, c - a, x, y0, (a + c) / 2)
            continue
        _, _, v0, v1 = hs[0]
        if v0 > y0: b.box(group, mat, depth, v0 - y0, c - a, x, y0, (a + c) / 2)
        if v1 < y1: b.box(group, mat, depth, y1 - v1, c - a, x, v1, (a + c) / 2)


def window(x, y0, y1, z, w, nx, nz):
    h = y1 - y0
    if nz:
        zz = z + nz * T / 2
        b.box('base', 'woodDark', w + 0.06, 0.035, 0.06, x, y0 - 0.035, zz)
        b.box('base', 'stoneDark', w + 0.08, 0.04, 0.05, x, y1, zz)
        b.box('base', 'woodDark', 0.02, h, 0.02, x, y0, zz - nz * 0.03)
        windows.append([round(x, 3), round(y0 + h / 2, 3), round(z, 3), 0, nz, round(w, 3), round(h, 3), 'base'])
    else:
        xx = x + nx * T / 2
        b.box('base', 'woodDark', 0.06, 0.035, w + 0.06, xx, y0 - 0.035, z)
        b.box('base', 'stoneDark', 0.05, 0.04, w + 0.08, xx, y1, z)
        b.box('base', 'woodDark', 0.02, h, 0.02, xx - nx * 0.03, y0, z)
        windows.append([round(x, 3), round(y0 + h / 2, 3), round(z, 3), nx, 0, round(w, 3), round(h, 3), 'base'])


# ---------------- podmurówka, posadzka z kamienia ----------------
b.box('base', 'stoneDark', X1 - X0 + 0.12, P, Z1 - Z0 + 0.12, 0, 0, (Z0 + Z1) / 2)
b.box('floor', 'pathCobble', X1 - X0 - 2 * T, 0.01, Z1 - Z0 - 2 * T, 0, P, (Z0 + Z1) / 2)

# ---------------- ściany z kamienia, narożniki z ciosów ----------------
FW = [(0.38, 0.62, P + 0.3, P + 0.55)]
wall_x('base', 'stone', Z1 - T / 2, X0, X1, P, H, [(DOOR[0], DOOR[1], P, P + DOOR[2])] + FW)
wall_x('base', 'stone', Z0 + T / 2, X0, X1, P, H, [(-0.2, 0.05, P + 0.32, P + 0.55)])
wall_z('base', 'stone', X0 + T / 2, Z0 + T, Z1 - T, P, H, [(-0.25, 0.0, P + 0.32, P + 0.55)])
wall_z('base', 'stone', X1 - T / 2, Z0 + T, Z1 - T, P, H, [])
for u0, u1, v0, v1 in FW:
    window((u0 + u1) / 2, v0, v1, Z1 - T / 2, u1 - u0, 0, 1)
window(-0.075, P + 0.32, P + 0.55, Z0 + T / 2, 0.25, 0, -1)
window(X0 + T / 2, P + 0.32, P + 0.55, -0.125, 0.25, -1, 0)
for sx in (-1, 1):
    for sz, zc in ((-1, Z0), (1, Z1)):
        for k in range(4):   # ciosy na przemian dłuższe i krótsze
            L = 0.16 if k % 2 else 0.1
            b.box('base', 'cutDark', 0.02, 0.14, L, sx * (X1 + 0.005), P + 0.03 + k * 0.17, zc - sz * L / 2)
            b.box('base', 'cutDark', 0.26 - L, 0.14, 0.02, sx * X1 - sx * (0.26 - L) / 2, P + 0.03 + k * 0.17, zc + sz * 0.005)
# drzwi: dębowe, uchylone do środka, nadproże, próg
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.1, 0.06, T + 0.03, 0, P + DOOR[2], Z1 - T / 2)
b.box('base', 'stoneDark', DOOR[1] - DOOR[0] + 0.06, 0.025, 0.14, 0, P, Z1 - 0.0)
b.box('interior', 'wood', DOOR[1] - DOOR[0] - 0.02, DOOR[2] - 0.02, 0.03, DOOR[0] + 0.02, P, Z1 - T - 0.15, math.pi / 2 - 0.35)

# ---------------- dach z gontu i ceglany komin pieca ----------------
b.gable('shell', 'wood', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H, RISE, along_x=False, over=0.14, end_mat='plaster')
b.gable('shell', 'woodDark', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H - 0.035, RISE, along_x=False, over=0.17)
b.box('shell', 'woodDark', 0.07, 0.05, Z1 - Z0 + 0.4, 0, H + RISE - 0.01, (Z0 + Z1) / 2)
for sz, zc in ((-1, Z0), (1, Z1)):   # szczyty: deskowanie w pionie z belką
    b.box('shell', 'woodDark', 0.04, RISE - 0.06, 0.025, 0, H, zc + sz * 0.02)
    b.box('shell', 'woodDark', X1 - X0, 0.04, 0.03, 0, H, zc + sz * 0.02)
# świetlik pod kalenicą (para z warzenia uchodzi przez dach)
b.box('shell', 'woodDark', 0.16, 0.14, 0.32, 0, H + RISE - 0.04, -0.1)
b.gable('shell', 'wood', -0.12, 0.12, -0.3, 0.1, H + RISE + 0.09, 0.09, along_x=False, over=0.04)
CX, CZ = 0.55, -0.5
b.box('shell', 'stone', 0.26, H + RISE * 0.6 + 0.5 - H, 0.26, CX, H, CZ)
b.box('shell', 'stoneDark', 0.3, 0.05, 0.3, CX, H + RISE * 0.6 + 0.5, CZ)
b.box('shell', 'dark', 0.18, 0.005, 0.18, CX, H + RISE * 0.6 + 0.55, CZ)
chimneys.append([CX, round(H + RISE * 0.6 + 0.57, 3), CZ])

# ---------------- warzelnia ----------------
# piec z cegły pod kotłem (w rogu przy kominie), palenisko od przodu
PX, PZ = 0.5, -0.45
b.box('interior', 'stoneDark', 0.5, 0.26, 0.48, PX, P, PZ)
b.box('interior', 'dark', 0.16, 0.12, 0.02, PX, P + 0.03, PZ + 0.245)
b.prism('interior', 'ember', 0.05, 0.0, 0.05, PX, P + 0.03, PZ + 0.2, seg=6)
flames.append([PX, round(P + 0.03, 3), round(PZ + 0.19, 3)])
b.box('interior', 'stoneDark', 0.26, 0.48, 0.2, PX, P + 0.26, PZ - 0.17)   # przewód do komina przy ścianie
# kocioł z miedzi: brzuchaty, z obręczą i pokrywą uchyloną
b.prism('interior', 'ore', 0.17, 0.2, 0.14, PX, P + 0.26, PZ + 0.04, seg=14)
b.prism('interior', 'ore', 0.2, 0.18, 0.06, PX, P + 0.4, PZ + 0.04, seg=14)
b.prism('interior', 'iron', 0.205, 0.205, 0.015, PX, P + 0.455, PZ + 0.04, seg=14)
b.prism('interior', 'crust', 0.17, 0.17, 0.004, PX, P + 0.44, PZ + 0.04, seg=14)   # piana na wierzchu
# kadź zacierna z klepek, z obręczami i drewnianym wiosłem
MX, MZ = -0.45, -0.4
b.prism('interior', 'wood', 0.2, 0.22, 0.32, MX, P, MZ, seg=14)
for y in (0.06, 0.24):
    b.prism('interior', 'iron', 0.215 + y * 0.03, 0.215 + y * 0.03, 0.018, MX, P + y, MZ, seg=14)
b.prism('interior', 'bread', 0.2, 0.2, 0.004, MX, P + 0.29, MZ, seg=14)   # zacier
b.box('interior', 'woodDark', 0.025, 0.5, 0.025, MX + 0.06, P + 0.12, MZ, roll=0.45)
b.box('interior', 'woodDark', 0.08, 0.1, 0.015, MX + 0.12, P + 0.14, MZ, roll=0.45)
# podest z deską przy kadzi (piwowar miesza z góry)
b.box('interior', 'woodDark', 0.24, 0.12, 0.16, MX + 0.3, P, MZ + 0.05)
# dwie niskie kadzie fermentacyjne pod lewą ścianą, przykryte płótnem
for z in (0.0, 0.26):
    b.prism('interior', 'wood', 0.12, 0.13, 0.2, X0 + T + 0.14, P, z, seg=12)
    b.prism('interior', 'iron', 0.135, 0.135, 0.014, X0 + T + 0.14, P + 0.15, z, seg=12)
    b.prism('interior', 'sack', 0.13, 0.11, 0.025, X0 + T + 0.14, P + 0.2, z, seg=12)
# regał z beczkami przy prawej ścianie: dwie leżą na legarach, jedna stoi
for z in (0.05, 0.3):
    b.box('interior', 'woodDark', 0.24, 0.03, 0.03, X1 - T - 0.14, P, z - 0.11)
    b.box('interior', 'woodDark', 0.24, 0.03, 0.03, X1 - T - 0.14, P, z + 0.11)
# leżące beczki: walce wzdłuż x
for z in (0.05, 0.27):
    cx, cy = X1 - T - 0.14, P + 0.12
    for k in range(10):
        a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
        r = 0.095
        pts = [(cx - 0.12, cy + math.cos(a0) * r, z + math.sin(a0) * r), (cx + 0.12, cy + math.cos(a0) * r, z + math.sin(a0) * r),
               (cx + 0.12, cy + math.cos(a1) * r, z + math.sin(a1) * r), (cx - 0.12, cy + math.cos(a1) * r, z + math.sin(a1) * r)]
        b.poly('interior', 'wood', pts, away=(cx, cy, z))
    for sx in (-1, 1):
        ring = [(cx + sx * 0.12, cy + math.cos(2 * math.pi * k / 10) * 0.095, z + math.sin(2 * math.pi * k / 10) * 0.095) for k in range(10)]
        b.poly('interior', 'woodDark', ring, away=(cx, cy, z))
        b.poly('interior', 'iron', [(cx + sx * 0.08, cy + 0.1, z - 0.03), (cx + sx * 0.08 + 0.015, cy + 0.1, z - 0.03), (cx + sx * 0.08 + 0.015, cy + 0.1, z + 0.03), (cx + sx * 0.08, cy + 0.1, z + 0.03)])
b.prism('interior', 'wood', 0.08, 0.08, 0.22, X1 - T - 0.14, P + 0.22, 0.16, seg=10)
b.prism('interior', 'iron', 0.084, 0.084, 0.015, X1 - T - 0.14, P + 0.38, 0.16, seg=10)
# worki pszenicy przy drzwiach, snopek oparty o ścianę
for x, z, s in ((-0.45, 0.25, 1.0), (-0.3, 0.32, 0.85)):
    b.prism('interior', 'sack', 0.07 * s, 0.05 * s, 0.17 * s, x, P, z, seg=8)
    b.prism('interior', 'rope', 0.035 * s, 0.03 * s, 0.03 * s, x, P + 0.17 * s, z, seg=6)
b.prism('interior', 'hay', 0.06, 0.04, 0.3, -0.62, P, Z1 - T - 0.08, seg=8)
# półka z kuflami i chochlą nad kadzią
b.box('interior', 'woodDark', 0.4, 0.02, 0.08, -0.45, P + 0.5, Z0 + T + 0.04)
for i in range(4):
    b.prism('interior', 'woodDark', 0.02, 0.018, 0.05, -0.6 + i * 0.1, P + 0.52, Z0 + T + 0.04, seg=6)

# ---------------- przed domem ----------------
# beczki do wywózki: dwie stoją, jedna na nich
for x, z in ((0.55, 0.72), (0.75, 0.68)):
    b.prism('base', 'wood', 0.09, 0.085, 0.24, x, 0.0, z, seg=10)
    b.prism('base', 'iron', 0.092, 0.092, 0.015, x, 0.18, z, seg=10)
    b.prism('base', 'iron', 0.092, 0.092, 0.015, x, 0.05, z, seg=10)
b.prism('base', 'wood', 0.08, 0.075, 0.2, 0.65, 0.24, 0.7, seg=10)
# kozioł z deską i dwa kufle (piwowar próbuje warki)
b.box('base', 'wood', 0.36, 0.03, 0.14, -0.55, 0.22, 0.78)
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.03, 0.22, 0.12, -0.55 + sx * 0.14, 0.0, 0.78)
for x in (-0.62, -0.5):
    b.prism('base', 'woodDark', 0.022, 0.02, 0.06, x, 0.25, 0.78, seg=6)
# szyld na wysięgniku przy drzwiach: deska ze snopkiem i kuflem
b.box('base', 'iron', 0.02, 0.02, 0.3, -0.32, P + 0.62, Z1 + 0.15)
b.box('base', 'woodDark', 0.02, 0.2, 0.26, -0.32, P + 0.38, Z1 + 0.18)
b.box('base', 'plank', 0.025, 0.15, 0.21, -0.32, P + 0.405, Z1 + 0.18)
b.prism('base', 'hay', 0.02, 0.035, 0.1, -0.335, P + 0.43, Z1 + 0.13, seg=6)
b.prism('base', 'woodDark', 0.03, 0.026, 0.07, -0.335, P + 0.43, Z1 + 0.23, seg=8)

E = P + 0.46
VIEWS = [
    ['browar z przodu', [0.6, 0.6, 2.2], [0, 0.5, 0], ['base', 'shell'], 22],
    ['wnętrze z góry (piwowar przy pracy)', [0.2, 1.8, 1.2], [0, 0.2, -0.2], ['base', 'interior', 'floor'], 22],
    ['od drzwi', [0.0, E, 0.35], [0.1, 0.3, -0.7], ['base', 'interior', 'floor'], 16],
]
b.save('brewery', maxe=0.28, rays=16, reach=0.4, extra={
    'windows': windows, 'chimneys': chimneys, 'flames': flames, 'views': VIEWS})
