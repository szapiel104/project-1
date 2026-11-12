"""Chata myśliwego (2×2 pola): niska chata z bali pod strzechą z kamiennym kominem i porożem nad drzwiami (ta sama
ciesielka co chata leśniczego), a obok ramy do suszenia skór: rozpięte skóry na tyczkach i wędzidło z mięsem na
żerdzi, przed chatą pieniek z toporkiem, kosz na strzały i łuk oparty o ścianę. W izbie: stół do oprawiania, prycza,
półka, piecyk. (Michał 12.11.2026: myśliwy poluje na dziką zwierzynę i przynosi mięso.)

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/hunter.py
Układ: środek działki = (0, 0), działka ±1, przód (drzwi) = +z. Wejście: pole przed prawą połową przodu.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
chimneys, flames = [], []
solid, open_ = [], []

P = 0.1                               # podłoga izby
X0, X1, Z0, Z1 = -0.22, 0.86, -0.84, 0.2
H1 = P + 0.62                         # okap (niższa niż u drwala: chata przysadzista, strzecha nisko)
RISE = 0.52
DOOR = (0.2, 0.48, 0.52)              # x0, x1, wysokość
LOG = 0.048


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


def spruce(group, x, z, h, y=0.0, lean=0.0):
    """Młody świerk: cienki pień i trzy stożki igliwia jeden nad drugim (pełne bryły z denkiem)"""
    b.prism(group, 'bark', 0.012 * h / 0.3 + 0.004, 0.008, h * 0.35, x, y, z, seg=5)
    for k, (r, hh, yy) in enumerate(((0.36, 0.42, 0.18), (0.27, 0.36, 0.42), (0.17, 0.32, 0.64))):
        b.prism(group, 'needle', r * h, 0.004, hh * h, x + lean * yy * h, y + yy * h, z, seg=7, phase=k * 0.4)


def beech(group, x, z, h, y=0.0, seed=0.0):
    """Młody buk albo dąb: pręt pnia i dwie, trzy kępy liści"""
    b.prism(group, 'bark', 0.012, 0.008, h * 0.6, x, y, z, seg=5)
    for k in range(3):
        a = seed + k * 2.1
        r = h * (0.2 - k * 0.03)
        b.crystal(group, 'leaf' if k % 2 == 0 else 'leafLight', x + math.cos(a) * h * 0.08, y + h * (0.55 + k * 0.13), z + math.sin(a) * h * 0.08,
                  r, seed=seed + k, sx=1.0, sy=0.8, sz=1.0)


# ---------------- podmurówka i podłoga ----------------
b.box('base', 'stone', X1 - X0 + 0.1, P, Z1 - Z0 + 0.1, (X0 + X1) / 2, 0, (Z0 + Z1) / 2)
b.box('base', 'stoneDark', X1 - X0 + 0.16, 0.035, Z1 - Z0 + 0.16, (X0 + X1) / 2, 0, (Z0 + Z1) / 2)
b.box('interior', 'plank', X1 - X0 - 0.1, 0.01, Z1 - Z0 - 0.1, (X0 + X1) / 2, P, (Z0 + Z1) / 2)

# ---------------- ściany z bali (węgły z wystającymi końcami), drzwi z przodu, okienko w lewej ścianie (na ramy ze skórami) ----------------
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
    if 0.22 < ys - P < 0.42:                     # okienko w lewej ścianie
        zlog('base', Z0 - 0.08, -0.5, ys, X0)
        zlog('base', -0.24, Z1 + 0.08, ys, X0)
    else:
        zlog('base', Z0 - 0.08, Z1 + 0.08, ys, X0)
    zlog('base', Z0 - 0.08, Z1 + 0.08, ys, X1)
# okienko: rama, ciemna szyba z błony i uchylona okiennica
b.box('base', 'woodDark', 0.04, 0.2, 0.3, X0 - 0.03, P + 0.27, -0.37)
b.box('base', 'dark', 0.02, 0.14, 0.2, X0 - 0.045, P + 0.3, -0.37)
b.box('base', 'wood', 0.02, 0.16, 0.12, X0 - 0.075, P + 0.29, -0.2, rot=-0.6)
# ościeżnica, nadproże, próg i uchylone drzwi z desek
b.box('base', 'woodDark', 0.05, DOOR[2], 0.13, DOOR[0] - 0.02, P, Z1)
b.box('base', 'woodDark', 0.05, DOOR[2], 0.13, DOOR[1] + 0.02, P, Z1)
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.12, 0.06, 0.13, (DOOR[0] + DOOR[1]) / 2, P + DOOR[2], Z1)
b.box('base', 'stoneDark', DOOR[1] - DOOR[0] + 0.06, 0.03, 0.14, (DOOR[0] + DOOR[1]) / 2, 0.0, Z1 + 0.12)
b.box('interior', 'plank', DOOR[1] - DOOR[0] - 0.02, DOOR[2] - 0.02, 0.025, DOOR[1] - 0.02, P, Z1 - 0.16, -(math.pi / 2 - 0.4))
for yy in (P + 0.09, P + 0.38):
    b.box('interior', 'iron', 0.02, 0.02, 0.18, DOOR[1] - 0.05, yy, Z1 - 0.15, 0.4)
# poroże jelenia na przedniej ścianie obok drzwi: deseczka i rozgałęzione tyki (trofeum myśliwego)
AX, AY, AZ = 0.68, P + 0.4, Z1 + LOG + 0.012
b.box('base', 'woodDark', 0.12, 0.08, 0.025, AX, AY - 0.04, AZ)
for s in (-1, 1):
    b.box('base', 'white', 0.016, 0.15, 0.016, AX + s * 0.04, AY, AZ + 0.022, roll=s * 0.55)
    b.box('base', 'white', 0.014, 0.08, 0.014, AX + s * 0.09, AY + 0.09, AZ + 0.022, roll=-s * 0.2)
    b.box('base', 'white', 0.012, 0.06, 0.012, AX + s * 0.065, AY + 0.06, AZ + 0.022, roll=s * 1.0)
solid += [[X0 - 0.06, DOOR[0], Z1 - LOG, Z1 + LOG], [DOOR[1], X1 + 0.06, Z1 - LOG, Z1 + LOG],
          [X0 - 0.06, X1 + 0.06, Z0 - LOG, Z0 + LOG], [X0 - LOG, X0 + LOG, Z0, Z1], [X1 - LOG, X1 + LOG, Z0, Z1]]
open_ += [[X0 + LOG, X1 - LOG, Z0 + LOG, Z1 - LOG], [DOOR[0], DOOR[1], Z1 - LOG - 0.02, Z1 + 0.1]]

# ---------------- strzecha (dwie warstwy, gruba i nisko opuszczona), szczyty z desek, kalenica z darni, komin ----------------
b.gable('shell', 'thatch', X0 - 0.14, X1 + 0.14, Z0 - 0.04, Z1 + 0.04, H1, RISE, along_x=True, over=0.2, end_mat='thatchDark')
b.gable('shell', 'thatchDark', X0 - 0.14, X1 + 0.14, Z0 - 0.04, Z1 + 0.04, H1 - 0.04, RISE, along_x=True, over=0.23)
for x, s in ((X0, -1), (X1, 1)):
    b.gable_boards('shell', 'plank', 'z', x, Z0, Z1, H1, RISE - 0.01, out=s)
# kalenica: gruby wałek ze słomy związany powrósłami, przykrywa styk połaci (bez płaskiego pasa)
RY, RZ = H1 + RISE - 0.005, (Z0 + Z1) / 2
hlog('shell', X0 - 0.17, X1 + 0.17, RY, RZ, r=0.06, mat='thatchDark', seg=9, ends='thatchDark')
for k in range(7):
    x = X0 - 0.08 + k * (X1 - X0 + 0.16) / 6
    hlog('shell', x - 0.012, x + 0.012, RY, RZ, r=0.066, mat='rope', seg=9, ends='rope')
CX, CZ = X1 - 0.2, Z0 + 0.16
b.box('shell', 'stone', 0.19, RISE + 0.34, 0.19, CX, H1 - 0.05, CZ)
b.box('shell', 'stoneDark', 0.24, 0.05, 0.24, CX, H1 + RISE + 0.29, CZ)
b.box('shell', 'dark', 0.12, 0.005, 0.12, CX, H1 + RISE + 0.34, CZ)
chimneys.append([CX, round(H1 + RISE + 0.36, 3), CZ])


# ---------------- izba: stół do oprawiania z deską i nożem, prycza, półka, piecyk ----------------
TX, TZ = 0.12, -0.5
b.box('interior', 'wood', 0.42, 0.03, 0.2, TX, P + 0.24, TZ)
for x in (TX - 0.17, TX + 0.17):
    for z in (TZ - 0.07, TZ + 0.07):
        b.box('interior', 'woodDark', 0.03, 0.24, 0.03, x, P, z)
b.box('interior', 'woodDark', 0.16, 0.012, 0.1, TX - 0.05, P + 0.27, TZ)          # deska do krojenia
b.box('interior', 'iron', 0.08, 0.006, 0.015, TX - 0.03, P + 0.282, TZ + 0.02, rot=0.4)   # nóż
b.box('interior', 'meat', 0.08, 0.035, 0.06, TX + 0.1, P + 0.27, TZ, rot=0.3)       # kawał mięsa
solid.append([TX - 0.22, TX + 0.22, TZ - 0.11, TZ + 0.11])
# prycza ze słomą pod tylną ścianą po lewej
b.box('interior', 'woodDark', 0.24, 0.12, 0.5, X0 + 0.17, P, -0.45)
b.box('interior', 'hay', 0.2, 0.04, 0.46, X0 + 0.17, P + 0.12, -0.45)
b.box('interior', 'sack', 0.2, 0.025, 0.2, X0 + 0.17, P + 0.16, -0.32)
solid.append([X0 + 0.04, X0 + 0.3, -0.71, -0.19])
# półka na tylnej ścianie: woreczki z nasionami i szyszki
b.box('interior', 'wood', 0.36, 0.02, 0.1, 0.2, P + 0.42, Z0 + LOG + 0.06)
for k, x in enumerate((0.07, 0.17, 0.29)):
    b.prism('interior', 'sack', 0.035, 0.025, 0.07, x, P + 0.44, Z0 + LOG + 0.06, seg=7, phase=k)
b.crystal('interior', 'bark', 0.36, P + 0.47, Z0 + LOG + 0.06, 0.025, seed=1.0, sy=1.4)
# piecyk pod kominem
b.box('interior', 'stone', 0.24, 0.28, 0.2, CX, P, CZ + 0.02)
b.box('interior', 'dark', 0.13, 0.11, 0.02, CX, P + 0.04, CZ + 0.12)
flames.append([CX, round(P + 0.03, 3), round(CZ + 0.1, 3)])
solid.append([CX - 0.13, CX + 0.13, Z0, CZ + 0.13])


# ---------------- po lewej: ramy do suszenia skór i żerdź z mięsem ----------------
def pole(x, z, h, r=0.016):
    b.prism('base', 'bark', r, r * 0.8, h, x, 0.0, z, seg=6)


def hide(x, z, w, h, y0, yaw=0.0):
    """Skóra rozpięta na ramie: dwie warstwy (gra nie rysuje tylnych ścian), lekko nieregularna"""
    b.box('base', 'hide', w, h, 0.006, x, y0, z, rot=yaw)
    b.box('base', 'hide', w * 0.92, h * 0.94, 0.006, x + math.sin(yaw) * 0.008, y0 + h * 0.03, z + math.cos(yaw) * 0.008, rot=yaw)


for k, (fx, fz) in enumerate(((-0.78, -0.45), (-0.78, 0.05))):     # dwie ramy z tyczek, skóry przywiązane rzemieniem
    for dz in (-0.17, 0.17):
        pole(fx, fz + dz, 0.62)
    b.box('base', 'bark', 0.03, 0.03, 0.4, fx, 0.56, fz, top=True)
    b.box('base', 'bark', 0.026, 0.026, 0.38, fx, 0.12, fz, top=True)
    hide(fx, fz, 0.3 - k * 0.04, 0.36, 0.17, yaw=math.pi / 2)
    solid.append([fx - 0.05, fx + 0.05, fz - 0.2, fz + 0.2])
# żerdź na dwóch kozłach z wiszącymi kawałami mięsa nad wygasłym dymnym paleniskiem
for z in (-0.82, -0.82 + 0.5):
    for dx in (-0.05, 0.05):
        b.box('base', 'bark', 0.022, 0.5, 0.022, -0.45 + dx, 0.0, z, roll=(0.18 if dx > 0 else -0.18))
b.box('base', 'bark', 0.025, 0.025, 0.58, -0.45, 0.46, -0.57)
for k in range(3):
    z = -0.75 + k * 0.17
    b.box('base', 'rope', 0.006, 0.08, 0.006, -0.45, 0.39, z)
    b.crystal('base', 'meat', -0.45, 0.31, z, 0.045, seed=k * 1.3, sx=0.8, sy=1.5, sz=0.8)
b.coals('base', -0.45, 0.004, -0.57, 0.09, seed=0.4, bed='ash')
solid.append([-0.55, -0.35, -0.86, -0.28])

# ---------------- przed chatą: pieniek z toporkiem, kosz ze strzałami, łuk o ścianę ----------------
b.prism('base', 'bark', 0.09, 0.085, 0.14, 0.62, 0.0, 0.6, seg=10)
b.prism('base', 'wood', 0.084, 0.084, 0.006, 0.62, 0.14, 0.6, seg=10)
b.box('base', 'woodDark', 0.022, 0.2, 0.022, 0.64, 0.14, 0.6, roll=0.5)                # toporek wbity w pieniek
b.box('base', 'iron', 0.07, 0.05, 0.012, 0.6, 0.15, 0.6, roll=0.5)
b.prism('base', 'basket', 0.05, 0.055, 0.16, 0.12, 0.0, 0.38, seg=9)                    # kosz na strzały
for k in range(5):
    a = k * 1.26
    b.box('base', 'wood', 0.006, 0.18, 0.006, 0.12 + math.cos(a) * 0.022, 0.12, 0.38 + math.sin(a) * 0.022, roll=0.08 * math.cos(a), tilt=0.08 * math.sin(a))
for k in range(9):                                                                       # łuk: łukowato gięte drewno
    t0 = -0.5 + k / 8
    y = 0.05 + (k / 8) * 0.48
    b.box('base', 'woodDark', 0.014, 0.065, 0.016, X1 + 0.03 + 0.05 * (1 - (2 * t0) ** 2), y, 0.05, roll=-0.6 * t0)
solid.append([0.5, 0.75, 0.48, 0.72])
solid.append([0.22, 0.95, 0.27, 0.56])

E = P + 0.38
OUT, ROOM = ['base', 'shell'], ['base', 'interior']
VIEWS = [
    ['chata myśliwego z przodu', [0.1, 0.5, 2.4], [0, 0.4, 0], OUT, 22],
    ['ramy ze skórami', [-0.2, 0.6, 1.3], [-0.7, 0.25, -0.2], OUT, 20],
    ['izba od drzwi', [0.35, E, 0.1], [0.0, 0.25, -0.6], ROOM, 16],
    ['z ziemi przy pieńku', [0.6, 0.18, 1.3], [0.3, 0.3, 0.2], OUT, 24],
]
b.save('hunter', maxe=0.22, rays=16, reach=0.3, extra={
    'solid': solid, 'open': open_, 'floorY': P, 'chimneys': chimneys, 'flames': flames,
    'pennant': [round(X1 + 0.12, 3), round(H1 + RISE - 0.1, 3), round((Z0 + Z1) / 2, 3)], 'views': VIEWS})
