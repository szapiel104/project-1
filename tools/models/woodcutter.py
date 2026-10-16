"""Chata drwala (2×2 pola): mała chata z bali na kamiennej podmurówce z dachem z gontu i kamiennym kominem,
po lewej otwarta wiata na słupach z kozłem do cięcia, piłą i stosem desek, przed chatą pieniek z wbitą siekierą,
pod ścianą sągi porąbanego drewna. W środku: pieniek do rąbania (tu stoi drwal przy pracy), ława z narzędziami,
siekiery i piła na ścianie, sterta polan, mały piec przy tylnej ścianie.

Przyciągnięty z lasu pień (grupa 'yardlog') dokłada gra — skraca się z każdą partią desek.
Dach (grupa 'shell') znika przy podglądzie wnętrza, gdy drwal pracuje w środku.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/woodcutter.py
Układ: środek działki = (0, 0), działka ±1, przód (drzwi) = +z. Wejście: pole przed prawą połową przodu.
Robotnik przy pracy stoi w środku działki (0, 0,12), więc to miejsce jest w izbie.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
chimneys, flames = [], []

P = 0.1                               # podłoga izby
X0, X1, Z0, Z1 = -0.5, 0.8, -0.72, 0.48
H1 = P + 0.72                         # okap
RISE = 0.5
DOOR = (0.2, 0.5, 0.58)               # x0, x1, wysokość
LOG = 0.05                            # promień bala
solid, open_ = [], []


def hlog(group, x0, x1, y, z, r=LOG, mat='bark', seg=7, ends='wood'):
    """Poziomy bal wzdłuż x (walec z jaśniejszymi przekrojami na końcach)"""
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        pts = [(x0, y + math.cos(a0) * r, z + math.sin(a0) * r), (x1, y + math.cos(a0) * r, z + math.sin(a0) * r),
               (x1, y + math.cos(a1) * r, z + math.sin(a1) * r), (x0, y + math.cos(a1) * r, z + math.sin(a1) * r)]
        b.poly(group, mat, pts, away=((x0 + x1) / 2, y, z))
    for xx, s in ((x0, -1), (x1, 1)):
        ring = [(xx, y + math.cos(2 * math.pi * k / seg) * r, z + math.sin(2 * math.pi * k / seg) * r) for k in range(seg)]
        b.poly(group, ends, ring, away=(xx - s, y, z))


def zlog(group, z0, z1, y, x, r=LOG, mat='bark', seg=7, ends='wood'):
    """Poziomy bal wzdłuż z"""
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        pts = [(x + math.sin(a0) * r, y + math.cos(a0) * r, z0), (x + math.sin(a0) * r, y + math.cos(a0) * r, z1),
               (x + math.sin(a1) * r, y + math.cos(a1) * r, z1), (x + math.sin(a1) * r, y + math.cos(a1) * r, z0)]
        b.poly(group, mat, pts, away=(x, y, (z0 + z1) / 2))
    for zz, s in ((z0, -1), (z1, 1)):
        ring = [(x + math.sin(2 * math.pi * k / seg) * r, y + math.cos(2 * math.pi * k / seg) * r, zz) for k in range(seg)]
        b.poly(group, ends, ring, away=(x, y, zz - s))


# ---------------- podmurówka i podłoga ----------------
b.box('base', 'stone', X1 - X0 + 0.1, P, Z1 - Z0 + 0.1, (X0 + X1) / 2, 0, (Z0 + Z1) / 2)
b.box('base', 'stoneDark', X1 - X0 + 0.16, 0.035, Z1 - Z0 + 0.16, (X0 + X1) / 2, 0, (Z0 + Z1) / 2)
b.box('interior', 'plank', X1 - X0 - 0.1, 0.01, Z1 - Z0 - 0.1, (X0 + X1) / 2, P, (Z0 + Z1) / 2)

# ---------------- ściany z bali (węgły z wystającymi końcami), drzwi z przodu, okienko z boku ----------------
rows = int((H1 - P) / (2 * LOG * 0.92))
for i in range(rows):
    y = P + LOG + i * 2 * LOG * 0.92            # bale przodu i tyłu
    if y < P + DOOR[2]:
        hlog('base', X0 - 0.08, DOOR[0], y, Z1)
        hlog('base', DOOR[1], X1 + 0.08, y, Z1)
    else:
        hlog('base', X0 - 0.08, X1 + 0.08, y, Z1)
    hlog('base', X0 - 0.08, X1 + 0.08, y, Z0)
    ys = y + LOG * 0.92                          # bale boków leżą między nimi (węgieł na zakładkę)
    if ys + LOG > H1:
        continue
    if 0.24 < ys - P < 0.46:                     # okienko w prawej ścianie
        zlog('base', Z0 - 0.08, -0.25, ys, X1)
        zlog('base', 0.0, Z1 + 0.08, ys, X1)
    else:
        zlog('base', Z0 - 0.08, Z1 + 0.08, ys, X1)
    zlog('base', Z0 - 0.08, Z1 + 0.08, ys, X0)
# okienko: rama i okiennica
b.box('base', 'woodDark', 0.04, 0.2, 0.3, X1 + 0.03, P + 0.29, -0.125)
b.box('base', 'dark', 0.02, 0.14, 0.2, X1 + 0.045, P + 0.32, -0.125)
b.box('base', 'wood', 0.02, 0.16, 0.12, X1 + 0.07, P + 0.31, 0.05, rot=0.6)
# ościeżnica i nadproże drzwi, uchylone drzwi z desek
b.box('base', 'woodDark', 0.05, DOOR[2], 0.13, DOOR[0] - 0.02, P, Z1)
b.box('base', 'woodDark', 0.05, DOOR[2], 0.13, DOOR[1] + 0.02, P, Z1)
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.12, 0.06, 0.13, (DOOR[0] + DOOR[1]) / 2, P + DOOR[2], Z1)
b.box('base', 'stoneDark', DOOR[1] - DOOR[0] + 0.06, 0.03, 0.14, (DOOR[0] + DOOR[1]) / 2, 0.0, Z1 + 0.12)
b.box('interior', 'plank', DOOR[1] - DOOR[0] - 0.02, DOOR[2] - 0.02, 0.025, DOOR[1] - 0.02, P, Z1 - 0.18, -(math.pi / 2 - 0.35))
for yy in (P + 0.1, P + 0.42):
    b.box('interior', 'iron', 0.02, 0.02, 0.2, DOOR[1] - 0.05, yy, Z1 - 0.17, 0.35)
solid += [[X0 - 0.06, DOOR[0], Z1 - LOG, Z1 + LOG], [DOOR[1], X1 + 0.06, Z1 - LOG, Z1 + LOG],
          [X0 - 0.06, X1 + 0.06, Z0 - LOG, Z0 + LOG], [X0 - LOG, X0 + LOG, Z0, Z1], [X1 - LOG, X1 + LOG, Z0, Z1]]
open_ += [[X0 + LOG, X1 - LOG, Z0 + LOG, Z1 - LOG], [DOOR[0], DOOR[1], Z1 - LOG - 0.02, Z1 + 0.1]]

# ---------------- dach z gontu, szczyty z desek, komin ----------------
b.gable('shell', 'wood', X0 - 0.12, X1 + 0.12, Z0 - 0.02, Z1 + 0.02, H1, RISE, along_x=True, over=0.16, end_mat='woodDark')
b.gable('shell', 'woodDark', X0 - 0.12, X1 + 0.12, Z0 - 0.02, Z1 + 0.02, H1 - 0.03, RISE, along_x=True, over=0.19)
for x, s in ((X0, -1), (X1, 1)):
    # szczyt z pionowych desek, odrobinę cofnięty względem bali
    n = 7
    for k in range(n):
        z0 = Z0 + (Z1 - Z0) * k / n
        z1 = Z0 + (Z1 - Z0) * (k + 1) / n
        zm = (z0 + z1) / 2
        hh = RISE * (1 - abs(zm - (Z0 + Z1) / 2) / ((Z1 - Z0) / 2)) - 0.02
        if hh > 0.03:
            b.box('shell', 'plank', 0.025, hh, (z1 - z0) - 0.006, x + s * 0.0, H1, zm)
b.box('shell', 'woodDark', X1 - X0 + 0.32, 0.05, 0.09, (X0 + X1) / 2, H1 + RISE - 0.02, (Z0 + Z1) / 2)   # kalenica
CX, CZ = X1 - 0.22, Z0 + 0.14
b.box('shell', 'stone', 0.2, RISE + 0.36, 0.2, CX, H1 - 0.05, CZ)
b.box('shell', 'stoneDark', 0.25, 0.05, 0.25, CX, H1 + RISE + 0.31, CZ)
b.box('shell', 'dark', 0.13, 0.005, 0.13, CX, H1 + RISE + 0.36, CZ)
chimneys.append([CX, round(H1 + RISE + 0.38, 3), CZ])

# ---------------- izba: pieniek do rąbania (miejsce drwala), ława z narzędziami, polana, piecyk ----------------
b.prism('interior', 'bark', 0.12, 0.11, 0.2, 0.05, P, -0.12, seg=9)                   # pieniek
b.prism('interior', 'wood', 0.11, 0.11, 0.004, 0.05, P + 0.2, -0.12, seg=9)            # słoje na wierzchu
b.box('interior', 'woodDark', 0.03, 0.3, 0.03, 0.08, P + 0.19, -0.12, roll=-0.5)       # siekiera wbita w pieniek
b.box('interior', 'iron', 0.1, 0.07, 0.022, 0.035, P + 0.2, -0.12, roll=-0.5)
for k, (x, z, a) in enumerate(((-0.12, -0.05, 0.3), (-0.05, 0.1, 1.4), (0.2, 0.0, 2.2))):   # rozłupane polana na podłodze
    b.box('interior', 'wood', 0.05, 0.04, 0.16, x, P, z, rot=a)
# ława z narzędziami pod tylną ścianą
b.box('interior', 'wood', 0.5, 0.03, 0.16, -0.15, P + 0.24, Z0 + 0.14)
for x in (-0.36, 0.06):
    b.box('interior', 'woodDark', 0.04, 0.24, 0.12, x, P, Z0 + 0.14)
b.box('interior', 'iron', 0.22, 0.012, 0.06, -0.22, P + 0.27, Z0 + 0.13)              # piła ręczna
b.box('interior', 'woodDark', 0.06, 0.03, 0.03, -0.35, P + 0.27, Z0 + 0.13)
b.box('interior', 'iron', 0.07, 0.03, 0.03, 0.0, P + 0.27, Z0 + 0.15)                 # klin i młot
b.box('interior', 'woodDark', 0.025, 0.025, 0.16, 0.0, P + 0.27, Z0 + 0.22, rot=0.3)
solid.append([-0.42, 0.12, Z0 + 0.05, Z0 + 0.23])
# siekiery i piła ramowa na lewej ścianie
for k, z in enumerate((-0.4, -0.2)):
    b.box('interior', 'woodDark', 0.022, 0.32, 0.022, X0 + LOG + 0.03, P + 0.2, z)
    b.box('interior', 'iron', 0.02, 0.06, 0.09, X0 + LOG + 0.03, P + 0.47, z + 0.03)
b.box('interior', 'woodDark', 0.02, 0.03, 0.4, X0 + LOG + 0.03, P + 0.52, 0.15)
b.box('interior', 'woodDark', 0.02, 0.03, 0.4, X0 + LOG + 0.03, P + 0.3, 0.15)
b.box('interior', 'iron', 0.012, 0.22, 0.01, X0 + LOG + 0.03, P + 0.31, 0.15)
# sterta polan w prawym rogu przy przodzie
for row in range(3):
    for k in range(4 - row):
        zlog('interior', Z1 - 0.38, Z1 - 0.1, P + 0.04 + row * 0.07, X1 - 0.12 - k * 0.08 - row * 0.04, r=0.035, mat='wood', ends='plank')
solid.append([X1 - 0.45, X1, Z1 - 0.4, Z1 - 0.08])
# piecyk z kamienia pod kominem
b.box('interior', 'stone', 0.26, 0.3, 0.2, CX, P, CZ + 0.02)
b.box('interior', 'dark', 0.14, 0.12, 0.02, CX, P + 0.04, CZ + 0.12)
flames.append([CX, round(P + 0.03, 3), round(CZ + 0.1, 3)])
solid.append([CX - 0.14, CX + 0.14, Z0, CZ + 0.13])

# ---------------- wiata po lewej: słupy, daszek z desek, kozioł z kłodą i piłą, stos desek ----------------
WX0, WX1, WZ0, WZ1 = -0.98, -0.56, -0.86, 0.3
for x, z, hh in ((WX0, WZ0, 0.82), (WX1, WZ0, 0.86), (WX0, WZ1, 0.62), (WX1, WZ1, 0.66)):
    b.prism('base', 'bark', 0.035, 0.032, hh, x, 0.0, z, seg=6)
    solid.append([x - 0.04, x + 0.04, z - 0.04, z + 0.04])
for x in (WX0, WX1):
    zlog('base', WZ0 - 0.05, WZ1 + 0.05, 0.64 + (0.2 if x == WX1 else 0.16) - 0.02, x, r=0.03, mat='woodDark', ends='wood')
# daszek pochylony do przodu: dwie warstwy desek (z grubością)
pts = [(WX0 - 0.08, 0.84, WZ0 - 0.1), (WX1 + 0.05, 0.88, WZ0 - 0.1), (WX1 + 0.05, 0.66, WZ1 + 0.14), (WX0 - 0.08, 0.62, WZ1 + 0.14)]
b.slope('shell', 'wood', pts, away=(-0.77, 0.0, -0.3), t=0.03)
for k in range(6):   # listwy na daszku
    f = (k + 0.5) / 6
    z = WZ0 - 0.1 + (WZ1 + 0.24 - WZ0) * f
    y = 0.86 - 0.22 * f + 0.035
    b.box('shell', 'woodDark', WX1 - WX0 + 0.1, 0.015, 0.03, (WX0 + WX1) / 2 - 0.015, y, z)
# kozioł: dwa krzyżaki, kłoda i piła
for z in (-0.5, -0.12):
    for r in (0.45, -0.45):
        b.box('base', 'woodDark', 0.035, 0.4, 0.035, -0.77, 0.0, z, roll=r)
zlog('base', -0.72, 0.1, 0.36, -0.77, r=0.07)
b.box('base', 'iron', 0.012, 0.18, 0.3, -0.77, 0.3, -0.3)
b.box('base', 'woodDark', 0.03, 0.05, 0.07, -0.77, 0.47, -0.17)
solid.append([-0.9, -0.64, -0.62, 0.0])
# stos desek przy tylnej krawędzi wiaty
for i in range(5):
    b.box('base', 'plank', 0.34, 0.035, 0.6 - (i % 2) * 0.04, -0.77, 0.02 + i * 0.04, -0.78 + 0.3, rot=0.0)
b.box('base', 'woodDark', 0.36, 0.02, 0.05, -0.77, 0.0, -0.75)
b.box('base', 'woodDark', 0.36, 0.02, 0.05, -0.77, 0.0, -0.2)
# trociny pod kozłem
b.box('base', 'sawdust', 0.36, 0.008, 0.5, -0.77, 0.004, -0.3)

# ---------------- przed chatą: pieniek z siekierą w prawym rogu (lewy przód zajmuje przyciągnięty pień), sągi pod prawą ścianą ----------------
b.prism('base', 'bark', 0.11, 0.1, 0.18, 0.74, 0.0, 0.74, seg=9)
b.prism('base', 'wood', 0.1, 0.1, 0.004, 0.74, 0.18, 0.74, seg=9)
b.box('base', 'woodDark', 0.03, 0.32, 0.03, 0.77, 0.17, 0.74, roll=-0.45)
b.box('base', 'iron', 0.11, 0.08, 0.022, 0.72, 0.18, 0.74, roll=-0.45)
solid.append([0.62, 0.86, 0.62, 0.86])
for row in range(3):
    for k in range(6 - row):
        z = Z0 + 0.1 + k * 0.09 + row * 0.045
        hlog('base', X1 + 0.08, X1 + 0.32, 0.04 + row * 0.07, z, r=0.035, mat='wood', ends='plank')
solid.append([X1 + 0.06, X1 + 0.34, Z0 + 0.04, Z0 + 0.6])

E = P + 0.42
OUT, ROOM = ['base', 'shell'], ['base', 'interior']
VIEWS = [
    ['chata drwala z przodu', [0.2, 0.5, 2.4], [0, 0.45, 0], OUT, 22],
    ['izba od drzwi', [0.35, E, 0.4], [-0.2, 0.25, -0.4], ROOM, 16],
    ['wiata z kozłem', [-0.5, 0.45, 1.2], [-0.77, 0.4, -0.3], OUT, 18],
]
b.save('woodcutter', maxe=0.22, rays=16, reach=0.3, extra={
    'solid': solid, 'open': open_, 'floorY': P, 'chimneys': chimneys, 'flames': flames,
    'pennant': [round(X0 - 0.1, 3), round(H1 + RISE - 0.1, 3), round((Z0 + Z1) / 2, 3)], 'views': VIEWS})
