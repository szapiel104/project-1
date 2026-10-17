"""Barak górników (2×2 pola) przy kopalni: niska chata z bali na kamiennej podmurówce, dach z gontu, wejście od frontu.
W środku prycze ze słomą pod obiema bocznymi ścianami (po cztery: tam gra kładzie śpiących górników), stół z ławą,
kilofy i latarnia na ścianie, piecyk. Przed barakiem ognisko z kłodami do siedzenia (wieczór załogi) i stos koszy
z urobkiem czekającym na wóz. Klimat Starego Obozu: surowo, brudno, ciasno.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/minecamp.py
Układ: środek działki = (0, 0), działka ±1, przód (drzwi) = +z.
Podłoga sypialni to pierwsza siatka grupy 'floor' (gra liczy z jej obrysu miejsca dla śpiących: dwie kolumny po 4).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
chimneys, flames, solid, open_ = [], [], [], []

P = 0.1
X0, X1, Z0, Z1 = -0.78, 0.78, -0.82, 0.42
H1 = P + 0.7
RISE = 0.46
DOOR = (-0.15, 0.15, 0.58)
LOG = 0.05


def hlog(group, x0, x1, y, z, r=LOG, mat='bark', seg=7, ends='wood'):
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        pts = [(x0, y + math.cos(a0) * r, z + math.sin(a0) * r), (x1, y + math.cos(a0) * r, z + math.sin(a0) * r),
               (x1, y + math.cos(a1) * r, z + math.sin(a1) * r), (x0, y + math.cos(a1) * r, z + math.sin(a1) * r)]
        b.poly(group, mat, pts, away=((x0 + x1) / 2, y, z))
    for xx, s in ((x0, -1), (x1, 1)):
        ring = [(xx, y + math.cos(2 * math.pi * k / seg) * r, z + math.sin(2 * math.pi * k / seg) * r) for k in range(seg)]
        b.poly(group, ends, ring, away=(xx - s, y, z))


def zlog(group, z0, z1, y, x, r=LOG, mat='bark', seg=7, ends='wood'):
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        pts = [(x + math.sin(a0) * r, y + math.cos(a0) * r, z0), (x + math.sin(a0) * r, y + math.cos(a0) * r, z1),
               (x + math.sin(a1) * r, y + math.cos(a1) * r, z1), (x + math.sin(a1) * r, y + math.cos(a1) * r, z0)]
        b.poly(group, mat, pts, away=(x, y, (z0 + z1) / 2))
    for zz, s in ((z0, -1), (z1, 1)):
        ring = [(x + math.sin(2 * math.pi * k / seg) * r, y + math.cos(2 * math.pi * k / seg) * r, zz) for k in range(seg)]
        b.poly(group, ends, ring, away=(x, y, zz - s))


# ---------------- podmurówka i podłoga (pierwsza siatka 'floor' = posłania) ----------------
b.box('base', 'stone', X1 - X0 + 0.1, P, Z1 - Z0 + 0.1, (X0 + X1) / 2, 0, (Z0 + Z1) / 2)
b.box('base', 'stoneDark', X1 - X0 + 0.16, 0.035, Z1 - Z0 + 0.16, (X0 + X1) / 2, 0, (Z0 + Z1) / 2)
FX0, FX1 = X0 + LOG + 0.02, X1 - LOG - 0.02
b.box('floor', 'plank', FX1 - FX0, 0.01, Z1 - Z0 - 2 * LOG - 0.04, 0, P, (Z0 + Z1) / 2)

# ---------------- ściany z bali, drzwi z przodu, okienka po bokach ----------------
rows = int((H1 - P) / (2 * LOG * 0.92))
for i in range(rows):
    y = P + LOG + i * 2 * LOG * 0.92
    if y < P + DOOR[2]:
        hlog('base', X0 - 0.08, DOOR[0], y, Z1)
        hlog('base', DOOR[1], X1 + 0.08, y, Z1)
    else:
        hlog('base', X0 - 0.08, X1 + 0.08, y, Z1)
    hlog('base', X0 - 0.08, X1 + 0.08, y, Z0)
    ys = y + LOG * 0.92
    if ys + LOG > H1:
        continue
    for x in (X0, X1):
        if 0.26 < ys - P < 0.44:
            zlog('base', Z0 - 0.08, -0.42, ys, x)
            zlog('base', -0.18, Z1 + 0.08, ys, x)
        else:
            zlog('base', Z0 - 0.08, Z1 + 0.08, ys, x)
for x, s in ((X0, -1), (X1, 1)):   # okienka z okiennicą
    b.box('base', 'woodDark', 0.04, 0.2, 0.3, x + s * 0.03, P + 0.27, -0.3)
    b.box('base', 'dark', 0.02, 0.13, 0.2, x + s * 0.045, P + 0.3, -0.3)
b.box('base', 'woodDark', 0.05, DOOR[2], 0.13, DOOR[0] - 0.02, P, Z1)
b.box('base', 'woodDark', 0.05, DOOR[2], 0.13, DOOR[1] + 0.02, P, Z1)
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.12, 0.06, 0.13, 0, P + DOOR[2], Z1)
b.box('base', 'stoneDark', DOOR[1] - DOOR[0] + 0.06, 0.03, 0.14, 0, 0.0, Z1 + 0.12)
# uchylone drzwi z desek (do środka, przy lewym węgarze)
b.box('interior', 'plank', DOOR[1] - DOOR[0] - 0.02, DOOR[2] - 0.02, 0.025, DOOR[0] + 0.02, P, Z1 - 0.16, (math.pi / 2 - 0.4))
solid += [[X0 - 0.06, DOOR[0], Z1 - LOG, Z1 + LOG], [DOOR[1], X1 + 0.06, Z1 - LOG, Z1 + LOG],
          [X0 - 0.06, X1 + 0.06, Z0 - LOG, Z0 + LOG], [X0 - LOG, X0 + LOG, Z0, Z1], [X1 - LOG, X1 + LOG, Z0, Z1]]
open_ += [[X0 + LOG, X1 - LOG, Z0 + LOG, Z1 - LOG], [DOOR[0], DOOR[1], Z1 - LOG - 0.02, Z1 + 0.1]]

# ---------------- dach z gontu, szczyty z desek, komin ----------------
b.gable('shell', 'wood', X0 - 0.12, X1 + 0.12, Z0 - 0.02, Z1 + 0.02, H1, RISE, along_x=False, over=0.16, end_mat='woodDark')
b.gable('shell', 'woodDark', X0 - 0.12, X1 + 0.12, Z0 - 0.02, Z1 + 0.02, H1 - 0.03, RISE, along_x=False, over=0.19)
for z, s in ((Z0, -1), (Z1, 1)):
    b.gable_boards('shell', 'plank', 'x', z, X0, X1, H1, RISE - 0.01, out=s)
b.box('shell', 'woodDark', 0.09, 0.05, Z1 - Z0 + 0.32, 0, H1 + RISE - 0.02, (Z0 + Z1) / 2)
CX, CZ = X0 + 0.2, Z0 + 0.15
b.box('shell', 'stone', 0.2, RISE + 0.34, 0.2, CX, H1 - 0.05, CZ)
b.box('shell', 'stoneDark', 0.25, 0.05, 0.25, CX, H1 + RISE + 0.29, CZ)
b.box('shell', 'dark', 0.13, 0.005, 0.13, CX, H1 + RISE + 0.34, CZ)
chimneys.append([CX, round(H1 + RISE + 0.36, 3), CZ])

# ---------------- izba: prycze ze słomą pod bocznymi ścianami (po 4), stół z ławą, kilofy, piecyk ----------------
BED_L, BED_W = 0.5, 0.2
z_rows = [Z0 + LOG + 0.06 + (Z1 - Z0 - 2 * LOG - 0.16) * (k + 0.5) / 4 for k in range(4)]
for x, s in ((FX0, 1), (FX1, -1)):
    cx = x + s * BED_L / 2
    for z in z_rows:
        b.box('interior', 'woodDark', BED_L, 0.06, BED_W, cx, P, z)             # rama pryczy
        b.box('interior', 'hay', BED_L - 0.04, 0.025, BED_W - 0.03, cx, P + 0.06, z)   # siennik
    solid.append([min(x, x + s * BED_L), max(x, x + s * BED_L), Z0, Z1 - 0.12, 0, 0.12])
# stół i ława na środku, kubki i latarnia
b.box('interior', 'wood', 0.22, 0.03, 0.46, 0, P + 0.22, -0.22)
for z in (-0.4, -0.04):
    b.box('interior', 'woodDark', 0.16, 0.22, 0.04, 0, P, z)
b.box('interior', 'iron', 0.05, 0.08, 0.05, 0.04, P + 0.25, -0.3)
b.box('interior', 'wood', 0.04, 0.05, 0.04, -0.05, P + 0.25, -0.12)
solid.append([-0.13, 0.13, -0.47, 0.03, 0, 0.3])
# kilofy oparte o tylną ścianę, latarnia na haku
for k, x in enumerate((0.15, 0.27, 0.39)):
    b.box('interior', 'woodDark', 0.025, 0.42, 0.025, x, P, Z0 + LOG + 0.04, tilt=-0.15)
    b.box('interior', 'iron', 0.16, 0.025, 0.03, x, P + 0.4, Z0 + LOG + 0.1)
b.box('interior', 'iron', 0.06, 0.09, 0.06, 0.5, P + 0.5, Z0 + LOG + 0.04)
flames.append([0.5, round(P + 0.52, 3), round(Z0 + LOG + 0.04, 3)])
# piecyk pod kominem
b.box('interior', 'stone', 0.24, 0.28, 0.2, CX, P, CZ + 0.02)
b.box('interior', 'dark', 0.13, 0.11, 0.02, CX, P + 0.04, CZ + 0.12)
solid.append([CX - 0.13, CX + 0.13, Z0, CZ + 0.13, 0, 0.3])

# ---------------- przed barakiem: ognisko z kłodami do siedzenia, kosze z urobkiem, kozioł z kilofem ----------------
FX, FZ = -0.55, 0.78
for k in range(8):   # krąg kamieni
    a = 2 * math.pi * k / 8
    b.box('base', 'stoneDark', 0.07, 0.05, 0.06, FX + math.sin(a) * 0.16, 0, FZ + math.cos(a) * 0.16, rot=a)
b.box('base', 'ash', 0.24, 0.006, 0.24, FX, 0.002, FZ)
for a in (0.4, 2.0, 3.5):   # polana w ognisku
    b.box('base', 'woodDark', 0.03, 0.03, 0.18, FX, 0.012, FZ, rot=a)
flames.append([FX, 0.03, FZ])
for (x, z, a) in ((FX - 0.36, FZ - 0.05, 0.2), (FX + 0.05, FZ + 0.34, 1.5)):   # kłody do siedzenia
    b.box('base', 'bark', 0.38, 0.1, 0.11, x, 0, z, rot=a)
solid.append([FX - 0.5, FX + 0.25, FZ - 0.22, FZ + 0.45])
# kosze z urobkiem pod prawą ścianą od frontu (czekają na wóz)
for (x, z, m) in ((0.55, 0.62, 'ore'), (0.75, 0.62, 'stone'), (0.65, 0.82, 'stone'), (0.86, 0.82, 'ore')):
    b.prism('base', 'sack', 0.085, 0.075, 0.1, x, 0, z, seg=9)
    b.prism('base', m, 0.07, 0.025, 0.05, x, 0.1, z, seg=7)
solid.append([0.45, 0.96, 0.52, 0.92])

E = P + 0.4
OUT, ROOM = ['base', 'shell'], ['base', 'interior', 'floor']
VIEWS = [
    ['barak z przodu', [0.3, 0.55, 2.4], [0, 0.4, 0], OUT, 22],
    ['izba od drzwi', [0.0, E, 0.32], [0, 0.22, -0.6], ROOM, 16],
    ['ognisko', [-0.1, 0.4, 1.5], [-0.55, 0.1, 0.78], OUT, 18],
]
b.save('minecamp', maxe=0.22, rays=16, reach=0.3, extra={
    'solid': solid, 'open': open_, 'floorY': P, 'chimneys': chimneys, 'flames': flames,
    'pennant': [round(X1 - 0.05, 3), round(H1 + RISE - 0.1, 3), round(Z0 + 0.1, 3)], 'views': VIEWS})
