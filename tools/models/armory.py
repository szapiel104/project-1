"""Zbrojownia (2×2 pola), kamienna jak mury obronne (Michał 10.11.2026): bryła z łupanego kamienia (ten sam kamień co
mur i wieże), narożniki z ciosów, płaski dach z kamiennych płyt na belkach na wysokości korony muru, przedpiersie
z blankami; od lewej kamienne schody na dach (przerwa w przedpiersiu), z przodu łukowe wejście z okutymi wrotami
i dwie pochodnie w żelaznych uchwytach, nad wejściem tarcza w barwach pana. Wąskie strzelnice z kratą.
W środku: stojak z włóczniami pod tylną ścianą, tarcze i łuki na kołkach, beczka z mieczami, skrzynie z grotami,
kowadło do drobnych napraw; na posadzce gra układa włócznie i łuki według stanu zbrojowni (armsfill).
Dach (grupa 'shell') znika przy podglądzie wnętrza — przedpiersie zostaje jak rama.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/armory.py  →  src/render/models/armory.json
Układ: środek działki = (0, 0), działka ±1, przód (drzwi) = +z. Wejście: pole przed prawą połową przodu.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from timber import Timber  # noqa: E402
from logs import log  # noqa: E402
from stonehall import TOP, WALL, arch_door, arch_hole, flat_roof, parapet, plinth, quoins, stairs, walls  # noqa: E402

b = Building()
t = Timber(b, T=WALL)
T = WALL

P = 0.1                               # posadzka
X0, X1, Z0, Z1 = -0.5, 0.94, -0.9, 0.62
ZM = (Z0 + Z1) / 2
DX, DW, DH = 0.47, 0.34, 0.6          # wejście: środek, szerokość, wysokość (z łukiem)
SX = -0.73                            # oś schodów (po lewej, poza bryłą)
SW = 0.36

# ---------------- cokół, posadzka z płyt ----------------
plinth(b, X0, X1, Z0, Z1, P + 0.02)
b.box('floor', 'cut', X1 - X0 - 2 * T, 0.008, Z1 - Z0 - 2 * T, (X0 + X1) / 2, P + 0.02, ZM)
FY = P + 0.028                        # wierzch posadzki

# ---------------- ściany: wejście z przodu, strzelnice ----------------
SL = 0.06                             # szerokość strzelnicy
SY0, SY1 = FY + 0.42, FY + 0.72
walls(t, X0, X1, Z0, Z1, P, TOP, {
    'front': [arch_hole(DX, DW, DH, FY), (0.0 - SL / 2, 0.0 + SL / 2, SY0, SY1)],
    'back': [(-0.1 - SL / 2, -0.1 + SL / 2, SY0, SY1), (0.55 - SL / 2, 0.55 + SL / 2, SY0, SY1)],
    'right': [(-0.35 - SL / 2, -0.35 + SL / 2, SY0, SY1), (0.25 - SL / 2, 0.25 + SL / 2, SY0, SY1)],
})


def slit(x, z, nx, nz):
    """Strzelnica: ościeża z ciosu, żelazny pręt, ciemna wnęka (5 mm za licem)"""
    if nz:
        for s in (-1, 1):
            b.box('base', 'cutDark', 0.035, SY1 - SY0 + 0.04, T + 0.02, x + s * (SL / 2 + 0.017), SY0 - 0.02, z)
        b.box('base', 'cutDark', SL + 0.1, 0.04, T + 0.03, x, SY0 - 0.05, z + nz * 0.006)
        b.box('base', 'cutDark', SL + 0.1, 0.04, T + 0.02, x, SY1, z)
        b.box('base', 'iron', 0.012, SY1 - SY0, 0.012, x, SY0, z)
        b.box('base', 'dark', SL, SY1 - SY0, 0.004, x, SY0, z - nz * (T / 2 - 0.006))
    else:
        for s in (-1, 1):
            b.box('base', 'cutDark', T + 0.02, SY1 - SY0 + 0.04, 0.035, x, SY0 - 0.02, z + s * (SL / 2 + 0.017))
        b.box('base', 'cutDark', T + 0.03, 0.04, SL + 0.1, x + nx * 0.006, SY0 - 0.05, z)
        b.box('base', 'cutDark', T + 0.02, 0.04, SL + 0.1, x, SY1, z)
        b.box('base', 'iron', 0.012, SY1 - SY0, 0.012, x, SY0, z)
        b.box('base', 'dark', 0.004, SY1 - SY0, SL, x - nx * (T / 2 - 0.006), SY0, z)


slit(0.0, Z1 - T / 2, 0, 1)
slit(-0.1, Z0 + T / 2, 0, -1); slit(0.55, Z0 + T / 2, 0, -1)
slit(X1 - T / 2, -0.35, 1, 0); slit(X1 - T / 2, 0.25, 1, 0)
# bez narożnych ciosów: gładkie bloki wyglądały jak beton (Michał 10.11.2026) — narożniki z tego samego łupanego kamienia
t.block(X0, DX - DW / 2, Z1 - T, Z1); t.block(DX + DW / 2, X1, Z1 - T, Z1)  # ościeża łuku leżą w tych blokach
t.block(X0, X1, Z0, Z0 + T); t.block(X0, X0 + T, Z0, Z1); t.block(X1 - T, X1, Z0, Z1)

# ---------------- wejście: łuk z klińców, wrota uchylone do środka, schodek z płyty ----------------
arch_door(b, t, DX, Z1 - T / 2, DW, DH, FY)
b.box('base', 'castleDark', DW + 0.16, P + 0.02, 0.16, DX, 0.0, Z1 + 0.08, bottom=False)     # stopień przed progiem
# pochodnie po obu stronach łuku: żelazny uchwyt z kółkiem, płomień rysuje gra (znacznik 'lamps')
LAMPS = []
for s in (-1, 1):
    x = DX + s * (DW / 2 + 0.13)
    b.box('base', 'iron', 0.02, 0.02, 0.07, x, FY + 0.5, Z1 + 0.035)                    # ramię
    b.prism('base', 'iron', 0.022, 0.026, 0.035, x, FY + 0.5, Z1 + 0.075, seg=8)          # kosz uchwytu
    b.prism('base', 'woodDark', 0.012, 0.014, 0.17, x, FY + 0.46, Z1 + 0.075, seg=6)       # drzewce pochodni
    b.crystal('base', 'dark', x, FY + 0.63, Z1 + 0.075, 0.018, seed=s + 3, sy=0.9, seg=6)   # nasmołowana głowica
    LAMPS.append([round(x, 3), round(FY + 0.67, 3), round(Z1 + 0.075, 3)])
# tarcza z herbem nad łukiem (rysuje gra: banners.ts, rodzaj 2) na dębowej desce, skrzyżowane włócznie
SHY = FY + DH + 0.1
b.box('base', 'woodDark', 0.24, 0.24, 0.03, DX, SHY - 0.02, Z1 + 0.017)
BANNERS = [[round(DX, 3), round(SHY + 0.08, 3), round(Z1 + 0.037, 3), 0, 0.21, 0.231, 2, 'base']]
for sg in (-1, 1):
    L, a = 0.36, 0.72
    b.box('base', 'wood', 0.016, L, 0.016, DX + sg * math.sin(a) * L / 2, SHY - 0.06, Z1 + 0.025, roll=sg * a)
    b.prism('base', 'iron', 0.018, 0.0, 0.05, DX - sg * math.sin(a) * L / 2, SHY - 0.06 + math.cos(a) * L, Z1 + 0.025, seg=4)

# ---------------- schody na dach (po lewej, od przodu w tył) ----------------
stairs(b, t, SX, SW, Z1 + 0.32, Z0 + 0.42, TOP, side=-1, steps=11)
# podest u szczytu schodów, wsparty o lewą ścianę (tędy wchodzi się na dach przez przerwę w przedpiersiu)
b.box('base', 'castle', SW, TOP - 0.03, 0.34, SX, 0.0, Z0 + 0.25, bottom=False)
b.box('base', 'cutDark', SW + 0.01, 0.03, 0.35, SX, TOP - 0.03, Z0 + 0.25)
b.box('base', 'castle', 0.07, TOP + 0.2, 0.34, SX - SW / 2 - 0.035, 0.0, Z0 + 0.25, bottom=False)   # murek podestu z zewnątrz
b.box('base', 'castle', SW + 0.07, TOP + 0.2, 0.07, SX - 0.035, 0.0, Z0 + 0.045, bottom=False)       # i z tyłu
t.block(SX - SW / 2, SX + SW / 2, Z0 + 0.08, Z0 + 0.42, 0.0, TOP - 0.02)

# ---------------- dach z płyt, przedpiersie z blankami ----------------
flat_roof(b, X0, X1, Z0, Z1, TOP, beams_along_x=False, nbeams=3)
parapet(b, X0, X1, Z0, Z1, TOP, skip=('left', Z0 + 0.1, Z0 + 0.42))
# przysadzisty komin kuźniczki w tylnym prawym rogu (dym rysuje gra)
b.box('base', 'castle', 0.2, 0.42, 0.2, X1 - 0.2, TOP, Z0 + 0.2)
b.box('base', 'castleDark', 0.25, 0.05, 0.25, X1 - 0.2, TOP + 0.42, Z0 + 0.2)

# ---------------- wnętrze ----------------
IX0, IX1, IZ0, IZ1 = X0 + T, X1 - T, Z0 + T, Z1 - T
# stojak z włóczniami pod tylną ścianą: dwa słupki, belki z wycięciami i stojące w nim włócznie (groty u góry)
RX0, RX1, RZ = IX0 + 0.12, IX0 + 0.82, IZ0 + 0.07
for x in (RX0, RX1):
    b.box('interior', 'woodDark', 0.045, 0.7, 0.045, x, FY, RZ)
for y in (FY + 0.06, FY + 0.48):
    b.box('interior', 'wood', RX1 - RX0 + 0.06, 0.04, 0.06, (RX0 + RX1) / 2, y, RZ + 0.01)
for k in range(9):
    x = RX0 + 0.05 + k * (RX1 - RX0 - 0.1) / 8
    log(b, 'interior', 'wood', (x, FY + 0.06, RZ + 0.05), (x + 0.005, FY + 0.86, RZ + 0.02), r=0.009, seg=5, ends='wood')
    b.prism('interior', 'iron', 0.016, 0.0, 0.07, x + 0.005, FY + 0.86, RZ + 0.02, seg=4)
t.block(RX0 - 0.03, RX1 + 0.03, IZ0, RZ + 0.08, 0, FY + 0.9)
# łuki na kołkach na prawej ścianie: łęczysko z kilku odcinków (wygięte), cięciwa
for k in range(3):
    z = -0.55 + k * 0.28
    x = IX1 - 0.02
    b.box('interior', 'woodDark', 0.04, 0.025, 0.025, x - 0.02, FY + 0.82, z)               # kołek
    pts = [(x - 0.03 - 0.07 * math.sin(math.pi * j / 6), FY + 0.84 - 0.4 * j / 6, z) for j in range(7)]
    for a, c in zip(pts, pts[1:]):
        log(b, 'interior', 'wood', a, c, r=0.008, seg=5, ends='wood')
    log(b, 'interior', 'white', pts[0], pts[-1], r=0.0025, seg=4, ends='white')
# tarcze na lewej ścianie: okrągłe, z desek, z żelaznym umbem i pasem okucia (krążek z grubością, zamknięty)
def disc_x(x, y, z, r, th, mat, n=14):
    ring = [(y + math.sin(2 * math.pi * j / n) * r, z + math.cos(2 * math.pi * j / n) * r) for j in range(n)]
    b.poly('interior', mat, [(x + th, yy, zz) for yy, zz in ring], away=(x - 1, y, z))
    b.poly('interior', mat, [(x, yy, zz) for yy, zz in ring], away=(x + 1, y, z))
    for j in range(n):
        (y0, z0), (y1, z1) = ring[j], ring[(j + 1) % n]
        b.poly('interior', mat, [(x, y0, z0), (x, y1, z1), (x + th, y1, z1), (x + th, y0, z0)], away=(x + th / 2, y, z))


for k in range(3):
    z = -0.5 + k * 0.32
    x = IX0 + 0.006
    disc_x(x, FY + 0.62, z, 0.11, 0.02, 'wood' if k % 2 else 'woodDark')
    b.crystal('interior', 'iron', x + 0.03, FY + 0.62, z, 0.026, seed=k + 7, sx=0.55, sy=1.0, sz=1.0, seg=8)   # umbo
    b.box('interior', 'iron', 0.01, 0.2, 0.014, x + 0.024, FY + 0.52, z)                                      # pas okucia
# beczka z mieczami (rękojeści z jelcem do góry) w prawym przednim rogu
BX, BZ = IX1 - 0.16, IZ1 - 0.2
b.prism('interior', 'wood', 0.09, 0.1, 0.24, BX, FY, BZ, seg=12)
for y in (FY + 0.03, FY + 0.19):
    b.prism('interior', 'iron', 0.102, 0.102, 0.016, BX, y, BZ, seg=12)
for k in range(5):
    a = k * 1.25 + 0.3
    x, z = BX + math.cos(a) * 0.045, BZ + math.sin(a) * 0.045
    b.box('interior', 'iron', 0.014, 0.12, 0.006, x, FY + 0.2, z, rot=a)                   # głownia nad krawędzią
    b.box('interior', 'iron', 0.07, 0.012, 0.012, x, FY + 0.32, z, rot=a)                  # jelec
    b.box('interior', 'woodDark', 0.016, 0.08, 0.016, x, FY + 0.33, z, rot=a)              # rękojeść
    b.crystal('interior', 'iron', x, FY + 0.415, z, 0.012, seed=k + 1, seg=6)               # głowica
t.block(BX - 0.11, BX + 0.11, BZ - 0.11, BZ + 0.11, 0, FY + 0.42)
# skrzynie z grotami i strzałami pod prawą ścianą, kowadło na pniu przy kominie
t.boxs('interior', 'woodDark', 0.26, 0.16, 0.18, IX1 - 0.16, FY, -0.12, rot=math.pi / 2)
b.box('interior', 'iron', 0.15, 0.012, 0.22, IX1 - 0.16, FY + 0.16, -0.12)
for k in range(6):
    b.prism('interior', 'iron', 0.012, 0.0, 0.04, IX1 - 0.2 + (k % 3) * 0.04, FY + 0.172, -0.2 + (k // 3) * 0.12, seg=4)
b.prism('interior', 'bark', 0.08, 0.07, 0.2, IX1 - 0.25, FY, IZ0 + 0.26, seg=9)
b.box('interior', 'iron', 0.16, 0.06, 0.07, IX1 - 0.25, FY + 0.2, IZ0 + 0.26)
b.box('interior', 'iron', 0.07, 0.03, 0.05, IX1 - 0.14, FY + 0.23, IZ0 + 0.26)
t.block(IX1 - 0.36, IX1 - 0.14, IZ0 + 0.16, IZ0 + 0.36, 0, FY + 0.26)
# żelazne uchwyty z pochodniami w środku (świecą zawsze — w zbrojowni ciemno)
for x, z, nx in ((IX0 + 0.03, 0.1, 1), (IX1 - 0.03, IZ0 + 0.55, -1)):
    b.box('interior', 'iron', 0.06, 0.016, 0.016, x + nx * 0.03, FY + 0.72, z)
    b.prism('interior', 'woodDark', 0.01, 0.012, 0.13, x + nx * 0.06, FY + 0.7, z, seg=6)
    b.crystal('interior', 'dark', x + nx * 0.06, FY + 0.84, z, 0.014, seed=x, sy=0.9, seg=6)
    LAMPS.append([round(x + nx * 0.06, 3), round(FY + 0.87, 3), round(z, 3), 'interior'])
t.open.append([IX0, IX1, IZ0, IZ1])
t.open.append([DX - DW / 2, DX + DW / 2, Z1 - T - 0.02, Z1 + 0.05])

E = FY + 0.44
OUT = ['base', 'shell']
VIEWS = [
    ['zbrojownia z przodu', [0.4, 0.9, 3.0], [0, 0.6, 0], OUT, 24],
    ['bez dachu', [0.8, 2.6, 1.8], [0.2, 0.2, -0.1], ['base', 'interior', 'floor'], 30],
    ['przez wejście', [DX, E, 1.4], [0.2, FY + 0.2, -0.5], ['base', 'shell', 'interior', 'floor'], 18],
    ['w środku', [0.6, E, 0.35], [0.0, FY + 0.35, -0.6], ['base', 'shell', 'interior', 'floor'], 16],
    ['ze schodów', [SX, TOP + 0.45, Z1 + 0.6], [0.3, TOP, -0.3], OUT, 22],
]
b.save('armory', maxe=0.26, rays=16, reach=0.4, extra={
    'solid': t.solid, 'open': t.open, 'floorY': FY, 'windows': [], 'chimneys': [[round(X1 - 0.2, 3), round(TOP + 0.47, 3), round(Z0 + 0.2, 3)]],
    'flames': [], 'lamps': LAMPS,
    'pennant': [round(X1 - 0.05, 3), round(TOP + 0.35, 3), round(Z1 - 0.05, 3)], 'views': VIEWS, 'banners': BANNERS})
