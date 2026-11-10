"""Koszary (3×3 pola), kamienne jak mury obronne (Michał 10.11.2026, na wzór dawnych gier o zamkach, własny układ):
długi dom straży z łupanego kamienia (ten sam kamień co mur i wieże), płaski dach z kamiennych płyt na wysokości korony
muru z blankami, z lewej szerokie kamienne schody na dach (przerwa w przedpiersiu), w przodzie wysoki łuk wejścia
z okutymi wrotami, po bokach pochodnie, nad łukiem sztandar pana; z przodu wąski majdan z kukłą i stojakiem włóczni.
W środku: prycze piętrowe pod tylną ścianą, długi stół z ławami, kamienny kominek z ogniem, stojak z bronią, tarcze
na ścianie, skrzynie i beczka z wodą, pochodnie w uchwytach. Dach (grupa 'shell') gra zdejmuje przy podglądzie wnętrza.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/barracks.py  →  src/render/models/barracks.json
Układ: środek działki = (0, 0), działka ±1,5, przód (wejście) = +z. Wejście: pole przed środkiem przodu.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from timber import Timber  # noqa: E402
from logs import log  # noqa: E402
from strawdummy import straw_dummy  # noqa: E402
from stonehall import TOP, WALL, arch_door, arch_hole, flat_roof, parapet, plinth, stairs, walls  # noqa: E402

b = Building()
t = Timber(b, T=WALL)
T = WALL

P = 0.1
X0, X1, Z0, Z1 = -0.98, 1.44, -1.44, 0.72
ZM = (Z0 + Z1) / 2
DX, DW, DH = 0.0, 0.4, 0.72           # wejście w osi działki (pole wejścia przed środkiem)
SX, SW = -1.22, 0.4                   # schody po lewej, poza bryłą
FY = P + 0.028

# ---------------- cokół, posadzka ----------------
plinth(b, X0, X1, Z0, Z1, P + 0.02)
b.box('floor', 'cut', X1 - X0 - 2 * T, 0.008, Z1 - Z0 - 2 * T, (X0 + X1) / 2, P + 0.02, ZM)

# ---------------- ściany: łuk wejścia, strzelnice ----------------
SL = 0.06
SY0, SY1 = FY + 0.44, FY + 0.76
walls(t, X0, X1, Z0, Z1, P, TOP, {
    'front': [arch_hole(DX, DW, DH, FY), (-0.6 - SL / 2, -0.6 + SL / 2, SY0, SY1), (0.75 - SL / 2, 0.75 + SL / 2, SY0, SY1)],
    'back': [(-0.5 - SL / 2, -0.5 + SL / 2, SY0, SY1), (0.3 - SL / 2, 0.3 + SL / 2, SY0, SY1), (1.05 - SL / 2, 1.05 + SL / 2, SY0, SY1)],
    'right': [(-0.9 - SL / 2, -0.9 + SL / 2, SY0, SY1), (0.1 - SL / 2, 0.1 + SL / 2, SY0, SY1)],
    'left': [(-0.2 - SL / 2, -0.2 + SL / 2, SY0, SY1)],
})


def slit(x, z, nx, nz):
    if nz:
        for s in (-1, 1):
            b.box('base', 'castleDark', 0.035, SY1 - SY0 + 0.04, T + 0.02, x + s * (SL / 2 + 0.017), SY0 - 0.02, z)
        b.box('base', 'castleDark', SL + 0.1, 0.04, T + 0.03, x, SY0 - 0.05, z + nz * 0.006)
        b.box('base', 'castleDark', SL + 0.1, 0.04, T + 0.02, x, SY1, z)
        b.box('base', 'iron', 0.012, SY1 - SY0, 0.012, x, SY0, z)
        b.box('base', 'dark', SL, SY1 - SY0, 0.004, x, SY0, z - nz * (T / 2 - 0.006))
    else:
        for s in (-1, 1):
            b.box('base', 'castleDark', T + 0.02, SY1 - SY0 + 0.04, 0.035, x, SY0 - 0.02, z + s * (SL / 2 + 0.017))
        b.box('base', 'castleDark', T + 0.03, 0.04, SL + 0.1, x + nx * 0.006, SY0 - 0.05, z)
        b.box('base', 'castleDark', T + 0.02, 0.04, SL + 0.1, x, SY1, z)
        b.box('base', 'iron', 0.012, SY1 - SY0, 0.012, x, SY0, z)
        b.box('base', 'dark', 0.004, SY1 - SY0, SL, x - nx * (T / 2 - 0.006), SY0, z)


for x in (-0.6, 0.75):
    slit(x, Z1 - T / 2, 0, 1)
for x in (-0.5, 0.3, 1.05):
    slit(x, Z0 + T / 2, 0, -1)
for z in (-0.9, 0.1):
    slit(X1 - T / 2, z, 1, 0)
slit(X0 + T / 2, -0.2, -1, 0)
t.block(X0, DX - DW / 2, Z1 - T, Z1); t.block(DX + DW / 2, X1, Z1 - T, Z1)
t.block(X0, X1, Z0, Z0 + T); t.block(X0, X0 + T, Z0, Z1); t.block(X1 - T, X1, Z0, Z1)
# przypory przy rogach i w połowie długich ścian (masyw domu straży), z pochyłą nakrywą
for x, z, w, d in ((X1 - 0.02, Z1 - 0.3, 0.12, 0.2), (X1 - 0.02, Z0 + 0.3, 0.12, 0.2), (0.62, Z0 - 0.02, 0.2, 0.12), (-0.38, Z0 - 0.02, 0.2, 0.12)):
    b.box('base', 'castle', w, 0.62, d, x + (0.05 if w < d else 0), P, z - (0.05 if d < w else 0))
    b.box('base', 'castleDark', w + 0.02, 0.05, d + 0.02, x + (0.05 if w < d else 0), P + 0.62, z - (0.05 if d < w else 0), tilt=0.25 if d < w else 0, roll=-0.25 if w < d else 0)

# ---------------- wejście, pochodnie, sztandar ----------------
arch_door(b, t, DX, Z1 - T / 2, DW, DH, FY)
b.box('base', 'castleDark', DW + 0.22, P + 0.02, 0.2, DX, 0.0, Z1 + 0.1, bottom=False)
LAMPS = []
for s in (-1, 1):
    x = DX + s * (DW / 2 + 0.15)
    b.box('base', 'iron', 0.02, 0.02, 0.07, x, FY + 0.56, Z1 + 0.035)
    b.prism('base', 'iron', 0.022, 0.026, 0.035, x, FY + 0.56, Z1 + 0.075, seg=8)
    b.prism('base', 'woodDark', 0.012, 0.014, 0.17, x, FY + 0.52, Z1 + 0.075, seg=6)
    b.crystal('base', 'dark', x, FY + 0.69, Z1 + 0.075, 0.018, seed=s + 5, sy=0.9, seg=6)
    LAMPS.append([round(x, 3), round(FY + 0.73, 3), round(Z1 + 0.075, 3)])
# sztandar pana na drzewcu wystającym ze ściany nad łukiem (płachtę rysuje gra: banners.ts, rodzaj 1)
FPY = TOP - 0.03
log(b, 'base', 'woodDark', (DX - 0.22, FPY, Z1 + 0.01), (DX + 0.22, FPY, Z1 + 0.01), r=0.012, seg=6, ends='wood')
for s in (-1, 1):
    b.box('base', 'iron', 0.02, 0.05, 0.03, DX + s * 0.2, FPY - 0.025, Z1 - 0.005)
BANNERS = [[round(DX, 3), round(FPY - 0.01, 3), round(Z1 + 0.03, 3), 0, 0.42, 0.17, 1, 'base']]   # krótka płachta nad łukiem (dłuższa zasłaniała wejście)

# ---------------- schody na dach (po lewej, szerokie) i podest ----------------
stairs(b, t, SX, SW, Z1 + 0.66, Z0 + 0.48, TOP, side=-1, steps=13)
b.box('base', 'castle', SW, TOP - 0.03, 0.4, SX, 0.0, Z0 + 0.28, bottom=False)
b.box('base', 'castleDark', SW + 0.01, 0.03, 0.41, SX, TOP - 0.03, Z0 + 0.28)
b.box('base', 'castle', 0.07, TOP + 0.2, 0.4, SX - SW / 2 - 0.035, 0.0, Z0 + 0.28, bottom=False)
b.box('base', 'castle', SW + 0.07, TOP + 0.2, 0.07, SX - 0.035, 0.0, Z0 + 0.045, bottom=False)
t.block(SX - SW / 2, SX + SW / 2, Z0 + 0.08, Z0 + 0.48, 0.0, TOP - 0.02)

# ---------------- dach, przedpiersie, komin ----------------
flat_roof(b, X0, X1, Z0, Z1, TOP, beams_along_x=False, nbeams=5)
parapet(b, X0, X1, Z0, Z1, TOP, skip=('left', Z0 + 0.1, Z0 + 0.48))
CX, CZ = X1 - 0.32, Z0 + 0.16
b.box('base', 'castle', 0.26, 0.5, 0.22, CX, TOP, CZ)
b.box('base', 'castleDark', 0.31, 0.05, 0.27, CX, TOP + 0.5, CZ)
for s in (-1, 1):
    b.box('base', 'castleDark', 0.04, 0.08, 0.27, CX + s * 0.11, TOP + 0.55, CZ)

# ---------------- wnętrze ----------------
IX0, IX1, IZ0, IZ1 = X0 + T, X1 - T, Z0 + T, Z1 - T
# kominek pod tylną ścianą (prawa strona): kamienny okap, palenisko z polanami, żar, płomień rysuje gra ('flames')
FX, FZ = CX, IZ0 + 0.14
b.box('interior', 'castle', 0.5, 0.06, 0.26, FX, FY, FZ)                                    # trzon paleniska
for s in (-1, 1):
    b.box('interior', 'castle', 0.08, 0.5, 0.24, FX + s * 0.22, FY + 0.06, FZ)                  # boki
b.box('interior', 'castleDark', 0.56, 0.08, 0.3, FX, FY + 0.56, FZ + 0.02)                   # gzyms okapu
b.box('interior', 'castle', 0.44, 0.4, 0.16, FX, FY + 0.64, FZ - 0.04)                       # komin nad okapem do sufitu
b.box('interior', 'dark', 0.36, 0.48, 0.006, FX, FY + 0.06, IZ0 + 0.012)                     # osmolona tylna ściana
b.crystal('interior', 'ash', FX, FY + 0.06, FZ, 0.14, seed=2.2, sx=1.0, sy=0.08, sz=0.6, seg=9)
for k in range(3):
    a = k * 1.1 - 1.1
    log(b, 'interior', 'bark', (FX - 0.12 * math.cos(a), FY + 0.08, FZ - 0.05), (FX + 0.12 * math.cos(a), FY + 0.1, FZ + 0.04 * math.sin(a)), r=0.022, seg=6, ends='wood')
for k in range(6):
    b.crystal('interior', 'ember' if k % 2 else 'dark', FX - 0.1 + k * 0.04, FY + 0.075, FZ + (k % 3 - 1) * 0.03, 0.014, seed=k + 21, sy=0.6, seg=6)
flames = [[round(FX, 3), round(FY + 0.1, 3), round(FZ + 0.02, 3)]]
t.block(FX - 0.28, FX + 0.28, IZ0, IZ0 + 0.3, 0, 2)
# prycze piętrowe pod tylną ścianą (lewa i środkowa część): rama z belek, dwa poziomy z siennikiem i kocem
for k in range(3):
    x = IX0 + 0.3 + k * 0.5
    z = IZ0 + 0.17
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box('interior', 'woodDark', 0.04, 0.62, 0.04, x + sx * 0.2, FY, z + sz * 0.13)
    for y in (FY + 0.1, FY + 0.42):
        b.box('interior', 'wood', 0.44, 0.04, 0.3, x, y, z)
        b.box('interior', 'sack', 0.4, 0.035, 0.26, x, y + 0.04, z)                           # siennik
        b.box('interior', 'canvasRed' if (k + int(y * 10)) % 2 else 'hideDark', 0.24, 0.02, 0.27, x + 0.07, y + 0.075, z, roll=0.03)   # koc
        b.box('interior', 'canvas', 0.09, 0.03, 0.18, x - 0.15, y + 0.075, z)                   # wałek pod głowę
    b.box('interior', 'woodDark', 0.04, 0.04, 0.3, x, FY + 0.6, z)                              # drabinka
    t.block(x - 0.23, x + 0.23, z - 0.16, z + 0.16, 0, FY + 0.64)
# długi stół z ławami w środku izby
TX, TZ = 0.0, -0.32
b.box('interior', 'wood', 1.0, 0.035, 0.26, TX, FY + 0.26, TZ)
for sx in (-1, 1):
    for sz in (-1, 1):
        b.box('interior', 'woodDark', 0.04, 0.26, 0.04, TX + sx * 0.44, FY, TZ + sz * 0.09)
    b.box('interior', 'woodDark', 0.04, 0.04, 0.2, TX + sx * 0.44, FY + 0.06, TZ)
for sz in (-1, 1):
    b.box('interior', 'wood', 0.96, 0.03, 0.1, TX, FY + 0.16, TZ + sz * 0.24)
    for sx in (-1, 1):
        b.box('interior', 'woodDark', 0.04, 0.16, 0.08, TX + sx * 0.4, FY, TZ + sz * 0.24)
t.block(TX - 0.5, TX + 0.5, TZ - 0.3, TZ + 0.3, 0, FY + 0.3)
# na stole: kubki, misa z chlebem, kości do gry, hełm
for k, x in enumerate((-0.35, -0.12, 0.18, 0.38)):
    b.prism('interior', 'wood', 0.022, 0.025, 0.05, TX + x, FY + 0.295, TZ + (0.06 if k % 2 else -0.05), seg=8)
b.prism('interior', 'woodDark', 0.07, 0.05, 0.035, TX + 0.02, FY + 0.295, TZ, seg=10)
for k in range(3):
    b.crystal('interior', 'bread', TX + k * 0.035 - 0.02, FY + 0.33, TZ + 0.01, 0.022, seed=k + 31, sy=0.6, seg=7)
b.crystal('interior', 'iron', TX - 0.25, FY + 0.33, TZ + 0.02, 0.045, seed=4.4, sx=1.0, sy=0.85, sz=1.1, seg=9)   # hełm
# stojak z bronią pod prawą ścianą: włócznie i miecze
RZ0, RZ1, RX = -0.25, 0.45, IX1 - 0.07
for z in (RZ0, RZ1):
    b.box('interior', 'woodDark', 0.045, 0.7, 0.045, RX, FY, z)
for y in (FY + 0.06, FY + 0.48):
    b.box('interior', 'wood', 0.06, 0.04, RZ1 - RZ0 + 0.06, RX - 0.01, y, (RZ0 + RZ1) / 2)
for k in range(8):
    z = RZ0 + 0.05 + k * (RZ1 - RZ0 - 0.1) / 7
    log(b, 'interior', 'wood', (RX - 0.04, FY + 0.06, z), (RX - 0.02, FY + 0.86, z + 0.004), r=0.009, seg=5, ends='wood')
    b.prism('interior', 'iron', 0.016, 0.0, 0.07, RX - 0.02, FY + 0.86, z + 0.004, seg=4)
t.block(RX - 0.09, IX1, RZ0 - 0.03, RZ1 + 0.03, 0, FY + 0.9)


# tarcze na lewej ścianie (krążki z grubością, umbo)
def disc_x(x, y, z, r, th, mat, n=14):
    ring = [(y + math.sin(2 * math.pi * j / n) * r, z + math.cos(2 * math.pi * j / n) * r) for j in range(n)]
    b.poly('interior', mat, [(x + th, yy, zz) for yy, zz in ring], away=(x - 1, y, z))
    b.poly('interior', mat, [(x, yy, zz) for yy, zz in ring], away=(x + 1, y, z))
    for j in range(n):
        (y0, z0), (y1, z1) = ring[j], ring[(j + 1) % n]
        b.poly('interior', mat, [(x, y0, z0), (x, y1, z1), (x + th, y1, z1), (x + th, y0, z0)], away=(x + th / 2, y, z))


for k in range(4):
    z = -0.75 + k * 0.32
    if abs(z + 0.2) < 0.12:
        continue                       # strzelnica
    disc_x(IX0 + 0.006, FY + 0.66, z, 0.11, 0.02, 'wood' if k % 2 else 'woodDark')
    b.crystal('interior', 'iron', IX0 + 0.036, FY + 0.66, z, 0.026, seed=k + 11, sx=0.55, sy=1.0, sz=1.0, seg=8)
    b.box('interior', 'iron', 0.01, 0.2, 0.014, IX0 + 0.03, FY + 0.56, z)
# skrzynie pod lewą ścianą przy wejściu, beczka z wodą przy kominku
t.boxs('interior', 'woodDark', 0.3, 0.16, 0.2, IX0 + 0.13, FY, 0.35, rot=math.pi / 2)
b.box('interior', 'iron', 0.04, 0.17, 0.205, IX0 + 0.13, FY, 0.35)
t.boxs('interior', 'wood', 0.24, 0.14, 0.18, IX0 + 0.13, FY + 0.16, 0.35, rot=math.pi / 2 + 0.1)
BX, BZ = FX - 0.45, IZ0 + 0.16
b.prism('interior', 'wood', 0.09, 0.1, 0.26, BX, FY, BZ, seg=12)
for y in (FY + 0.03, FY + 0.21):
    b.prism('interior', 'iron', 0.102, 0.102, 0.016, BX, y, BZ, seg=12)
b.prism('interior', 'water', 0.085, 0.085, 0.004, BX, FY + 0.235, BZ, seg=12)
t.block(BX - 0.11, BX + 0.11, BZ - 0.11, BZ + 0.11, 0, FY + 0.27)
# pochodnie w uchwytach (świecą zawsze)
for x, z, nx in ((IX0 + 0.03, -0.55, 1), (IX1 - 0.03, -0.6, -1), (IX0 + 0.03, 0.15, 1)):
    b.box('interior', 'iron', 0.06, 0.016, 0.016, x + nx * 0.03, FY + 0.76, z)
    b.prism('interior', 'woodDark', 0.01, 0.012, 0.13, x + nx * 0.06, FY + 0.74, z, seg=6)
    b.crystal('interior', 'dark', x + nx * 0.06, FY + 0.88, z, 0.014, seed=x + z, sy=0.9, seg=6)
    LAMPS.append([round(x + nx * 0.06, 3), round(FY + 0.91, 3), round(z, 3), 'interior'])
t.open.append([IX0, IX1, IZ0, IZ1])
t.open.append([DX - DW / 2, DX + DW / 2, Z1 - T - 0.02, Z1 + 0.05])

# ---------------- majdan przed koszarami: ubita ziemia, kukła, stojak z włóczniami ----------------
b.box('base', 'soil', 2.2, 0.012, 0.66, 0.35, 0, 1.08)
straw_dummy(b, 'base', 0.95, 0.012, 1.1, rot=0.3)
RX2, RZ2 = -0.62, 1.2
for x in (RX2 - 0.2, RX2 + 0.2):
    b.box('base', 'woodDark', 0.04, 0.32, 0.04, x, 0.0, RZ2)
b.box('base', 'woodDark', 0.46, 0.035, 0.05, RX2, 0.3, RZ2)
for k in range(4):
    x = RX2 - 0.14 + k * 0.09
    b.box('base', 'wood', 0.016, 0.62, 0.016, x, 0.05, RZ2 + 0.05, tilt=-0.18)
    b.prism('base', 'iron', 0.018, 0.0, 0.06, x, 0.65, RZ2 - 0.06, seg=4)

E = FY + 0.46
OUT = ['base', 'shell']
VIEWS = [
    ['koszary z przodu', [0.6, 1.4, 4.2], [0.2, 0.6, -0.2], OUT, 26],
    ['bez dachu', [1.2, 3.6, 2.4], [0.2, 0.2, -0.3], ['base', 'interior', 'floor'], 32],
    ['przez wejście', [DX, E, 1.6], [0.0, FY + 0.25, -0.8], ['base', 'shell', 'interior', 'floor'], 20],
    ['w środku', [0.9, E, 0.4], [-0.3, FY + 0.3, -0.9], ['base', 'shell', 'interior', 'floor'], 18],
    ['ze schodów', [SX, TOP + 0.45, Z1 + 0.9], [0.4, TOP, -0.4], OUT, 24],
]
b.save('barracks', maxe=0.3, rays=16, reach=0.4, extra={'banners': BANNERS,
    'solid': t.solid, 'open': t.open, 'floorY': FY, 'windows': [], 'chimneys': [[round(CX, 3), round(TOP + 0.6, 3), round(CZ, 3)]],
    'flames': flames, 'lamps': LAMPS, 'views': VIEWS})
