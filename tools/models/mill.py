"""Młyn (2×2 pola): wiatrak wieżowy. Kamienna podmurówka, zbieżna wieża z tynku przepasana belkami, małe okna,
drzwi ze schodkiem, obiegowa galeria z balustradą, kopulasta czapa ze strzechy z wałem, cztery kratowe skrzydła
z płótnem (dwa rozwinięte, dwa zrefowane). Przy drzwiach worki mąki i zapasowy kamień młyński.

Grupy: 'base' (podmurówka i dół wieży do wysokości izby, z grubością ściany — przy podglądzie wnętrza wieża jest
ucięta nisko), 'shell' (reszta wieży, galeria, czapa), 'interior' (żarna, lej, worki), 'spin' (skrzydła, oś obrotu
w punkcie spinAt, obrót wokół osi z), 'runner' (górny kamień żaren, oś pionowa w punkcie runnerAt).

Uruchomienie (z katalogu repo):  python tools/models/mill.py  →  src/render/models/mill.json
Układ: środek działki = (0, 0), 1 = jedno pole, przód (drzwi i skrzydła) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
windows = []

PL = 0.24                 # wysokość podmurówki
H = 1.55                  # wysokość wieży nad podmurówką
R0, R1 = 0.64, 0.46       # promień wieży u dołu i u góry (zewnętrzny)
W = 0.08                  # grubość ściany
LOW = PL + 0.42           # do tej wysokości ściana jest w 'base' (reszta w 'shell')
SEG = 20
DOOR_HALF = 0.2           # połowa kąta otworu drzwi (rad)
DOOR_H = 0.5
TOP = PL + H


def rad(y):
    return R0 + (R1 - R0) * min(1.0, max(0.0, (y - PL) / H))


def ring(group, mat, y0, y1, gap=None, inner=True, seg=SEG):
    """Wycinek zbieżnej ściany wieży od y0 do y1: lico zewnętrzne, wewnętrzne, wierzch i spód; gap = (a0, a1) otwór"""
    P = lambda a, y, r: (math.sin(a) * r, y, math.cos(a) * r)
    angs = [(2 * math.pi * k / seg - math.pi, 2 * math.pi * (k + 1) / seg - math.pi) for k in range(seg)]
    hole = [bool(gap) and gap[0] <= (a0 + a1) / 2 <= gap[1] for a0, a1 in angs]
    ro0, ro1 = rad(y0), rad(y1)
    ri0, ri1 = ro0 - W, ro1 - W
    for k, (a0, a1) in enumerate(angs):
        if hole[k]:
            continue
        am = (a0 + a1) / 2
        b.poly(group, mat, [P(a0, y0, ro0), P(a1, y0, ro0), P(a1, y1, ro1), P(a0, y1, ro1)], away=(0, (y0 + y1) / 2, 0))
        if not inner:
            continue
        out = (math.sin(am) * 9, (y0 + y1) / 2, math.cos(am) * 9)
        b.poly(group, mat, [P(a0, y0, ri0), P(a1, y0, ri0), P(a1, y1, ri1), P(a0, y1, ri1)], away=out)
        b.poly(group, mat, [P(a0, y1, ro1), P(a1, y1, ro1), P(a1, y1, ri1), P(a0, y1, ri1)], away=(0, y0 - 5, 0))
        b.poly(group, mat, [P(a0, y0, ro0), P(a1, y0, ro0), P(a1, y0, ri0), P(a0, y0, ri0)], away=(0, y1 + 5, 0))
        for a, nb in ((a0, hole[k - 1]), (a1, hole[(k + 1) % seg])):   # ościeże przy otworze
            if nb:
                b.poly(group, 'stoneDark', [P(a, y0, ri0), P(a, y0, ro0), P(a, y1, ro1), P(a, y1, ri1)], away=P(am, (y0 + y1) / 2, (ri0 + ro0) / 2))


# ---------------- podmurówka z polnego kamienia, podłoga ----------------
b.prism('base', 'stoneDark', R0 + 0.1, R0 + 0.06, PL, 0, 0, 0, seg=SEG)
b.box('base', 'stone', 0.46, 0.08, 0.22, 0, 0, R0 + 0.14)                    # schodek przed drzwiami
b.prism('floor', 'plank', R0 - W - 0.005, R0 - W - 0.005, 0.01, 0, PL, 0, seg=SEG)

# ---------------- wieża: dół (izba, z otworem drzwi) w 'base', reszta w 'shell' ----------------
gap = (-DOOR_HALF, DOOR_HALF)
# drzwi sięgają DOOR_H nad podmurówkę; dół do LOW z otworem, nad drzwiami pełne wycinki
ring('base', 'plaster', PL, LOW, gap=gap)
ring('shell', 'plaster', LOW, PL + DOOR_H, gap=gap)
ring('shell', 'plaster', PL + DOOR_H, TOP)
# nadproże drzwi, deski drzwi otwartych do środka, okucia
dz = rad(PL) - W / 2
b.box('shell', 'woodDark', 2 * math.sin(DOOR_HALF) * rad(PL + DOOR_H) + 0.08, 0.06, W + 0.04, 0, PL + DOOR_H - 0.01, rad(PL + DOOR_H) - W / 2)
DW = 2 * math.sin(DOOR_HALF) * (R0 - W) - 0.02
b.box('base', 'woodDark', DW, DOOR_H - 0.03, 0.035, math.sin(DOOR_HALF) * (R0 - W) - 0.02, PL, dz - W / 2 - DW / 2 + 0.02, math.pi / 2 - 0.25)
# belki opasujące wieżę
for y in (PL + 0.18, PL + 0.75, PL + 1.32):
    rr = rad(y) + 0.012
    for k in range(SEG):
        a0, a1 = 2 * math.pi * k / SEG, 2 * math.pi * (k + 1) / SEG
        if y < PL + DOOR_H + 0.05 and -DOOR_HALF - 0.05 <= ((a0 + a1) / 2 + math.pi) % (2 * math.pi) - math.pi <= DOOR_HALF + 0.05:
            continue
        g = 'base' if y < LOW else 'shell'
        b.box(g, 'woodDark', 2 * math.sin(math.pi / SEG) * rr + 0.01, 0.045, 0.025, math.sin((a0 + a1) / 2) * rr, y, math.cos((a0 + a1) / 2) * rr, (a0 + a1) / 2)
# okna w drewnianych ramach (spiralnie)
for ang, y in ((0.95, PL + 0.5), (-1.05, PL + 0.55), (2.4, PL + 1.0), (-2.2, PL + 1.05), (0.25, PL + 1.15)):
    rr = rad(y) + 0.005
    x, z = math.sin(ang) * rr, math.cos(ang) * rr
    g = 'shell'
    b.box(g, 'woodDark', 0.16, 0.2, 0.03, x, y - 0.1, z, ang)
    b.box(g, 'dark', 0.11, 0.14, 0.032, x + math.sin(ang) * 0.004, y - 0.07, z + math.cos(ang) * 0.004, ang)
    b.box(g, 'woodDark', 0.015, 0.14, 0.036, x + math.sin(ang) * 0.006, y - 0.07, z + math.cos(ang) * 0.006, ang)

# ---------------- galeria w połowie wysokości: pomost, wsporniki, balustrada ----------------
GY = PL + 0.78
GR = rad(GY) + 0.2
b.prism('shell', 'plank', GR, GR, 0.04, 0, GY, 0, seg=24)
b.poly('shell', 'plank', [(math.sin(2 * math.pi * k / 24) * GR, GY, math.cos(2 * math.pi * k / 24) * GR) for k in range(24)], away=(0, GY + 1, 0))
for k in range(12):
    a = 2 * math.pi * k / 12
    b.box('shell', 'woodDark', 0.025, 0.2, 0.025, math.sin(a) * (GR - 0.015), GY + 0.04, math.cos(a) * (GR - 0.015), a)
    if k % 2 == 0:   # zastrzały pod pomostem
        b.box('shell', 'woodDark', 0.03, 0.28, 0.03, math.sin(a) * (rad(GY - 0.25) + 0.02), GY - 0.25, math.cos(a) * (rad(GY - 0.25) + 0.02), a, tilt=0.62, bottom=True)
for k in range(24):
    a0, a1 = 2 * math.pi * k / 24, 2 * math.pi * (k + 1) / 24
    am = (a0 + a1) / 2
    b.box('shell', 'woodDark', 2 * math.sin(math.pi / 24) * GR + 0.01, 0.025, 0.025, math.sin(am) * (GR - 0.015), GY + 0.22, math.cos(am) * (GR - 0.015), am)

# ---------------- czapa: wieniec, kopuła ze strzechy, gałka, wał skrzydeł ----------------
b.prism('shell', 'woodDark', R1 + 0.07, R1 + 0.07, 0.08, 0, TOP, 0, seg=SEG)
b.poly('shell', 'woodDark', [(math.sin(2 * math.pi * k / SEG) * (R1 + 0.07), TOP, math.cos(2 * math.pi * k / SEG) * (R1 + 0.07)) for k in range(SEG)], away=(0, TOP + 1, 0))
y = TOP + 0.06
prof = [(0.56, 0.0), (0.55, 0.1), (0.5, 0.2), (0.42, 0.3), (0.3, 0.39), (0.15, 0.45), (0.0, 0.47)]
for (ra, ya), (rb, yb) in zip(prof, prof[1:]):
    b.prism('shell', 'thatchDark' if ya < 0.05 else 'thatch', ra, rb, yb - ya, 0, y + ya, 0, seg=SEG)
b.poly('shell', 'thatchDark', [(math.sin(2 * math.pi * k / SEG) * 0.56, y, math.cos(2 * math.pi * k / SEG) * 0.56) for k in range(SEG)], away=(0, y + 1, 0))
b.prism('shell', 'woodDark', 0.05, 0.0, 0.1, 0, y + 0.46, 0, seg=8)
SHAFT_Y = TOP + 0.26
b.box('shell', 'woodDark', 0.1, 0.1, 0.42, 0, SHAFT_Y - 0.05, 0.62, bottom=True)
SPIN_AT = (0.0, SHAFT_Y, 0.86)

# ---------------- wnętrze: żarna na skrzyni, lej z ziarnem, wał, worki mąki, skrzynia z ziarnem ----------------
MZ = -0.2
b.box('interior', 'woodDark', 0.5, 0.16, 0.5, 0, PL, MZ)
b.prism('interior', 'stoneDark', 0.21, 0.21, 0.08, 0, PL + 0.16, MZ, seg=16)
RUN_AT = (0.0, PL + 0.245, MZ)
b.box('interior', 'wood', 0.2, 0.16, 0.2, 0, PL + 0.36, MZ, math.pi / 4)                  # lej
b.box('interior', 'wheat', 0.17, 0.01, 0.17, 0, PL + 0.52, MZ, math.pi / 4)
b.box('interior', 'woodDark', 0.05, 0.7, 0.05, 0, PL + 0.3, MZ + 0.14)                  # wał z góry
for x, z, s in ((0.36, 0.14, 1.0), (0.4, -0.1, 0.85), (0.22, 0.3, 0.9)):
    b.sack('interior', x, PL, z, w=0.15 * s, rot=x * 7 + z)   # worek mąki (tools/models/sack.py)
b.box('interior', 'wood', 0.28, 0.2, 0.2, -0.33, PL, 0.18)
b.box('interior', 'wheat', 0.24, 0.02, 0.16, -0.33, PL + 0.2, 0.18)

# ---------------- górny kamień żaren ('runner', oś w RUN_AT): z otworem i rowkami ----------------
b.prism('runner', 'stone', 0.2, 0.2, 0.075, 0, 0, 0, seg=16)
b.prism('runner', 'dark', 0.045, 0.045, 0.078, 0, 0.0, 0, seg=8)
for k in range(4):
    a = k * math.pi / 2
    b.box('runner', 'stoneDark', 0.16, 0.012, 0.02, math.sin(a) * 0.1, 0.075, math.cos(a) * 0.1, a + math.pi / 2)

# ---------------- skrzydła ('spin', oś w SPIN_AT, obrót wokół z): piasta, cztery kratowe ramiona ----------------
for k in range(8):   # piasta: ośmiokąt w płaszczyźnie xy
    a0, a1 = 2 * math.pi * k / 8, 2 * math.pi * (k + 1) / 8
    r = 0.1
    for zz in (-0.07, 0.07):
        b.poly('spin', 'woodDark', [(0, 0, zz), (math.cos(a0) * r, math.sin(a0) * r, zz), (math.cos(a1) * r, math.sin(a1) * r, zz)], away=(0, 0, -zz * 10))
    b.poly('spin', 'woodDark', [(math.cos(a0) * r, math.sin(a0) * r, -0.07), (math.cos(a1) * r, math.sin(a1) * r, -0.07),
                                (math.cos(a1) * r, math.sin(a1) * r, 0.07), (math.cos(a0) * r, math.sin(a0) * r, 0.07)], away=(0, 0, 0))


def arm_box(ang, lx, ly, w, h, d, z, mat):
    """Pudło w układzie ramienia: (lx, ly) = spód w ramieniu, ramię wychodzi w górę osi y i jest obrócone o ang wokół z"""
    c, s = math.cos(ang), math.sin(ang)
    x, yy = lx * c - ly * s, lx * s + ly * c
    b.box('spin', mat, w, h, d, x, yy, z, roll=ang)


for i in range(4):
    ang = (math.pi / 2) * i + math.pi / 4
    arm_box(ang, 0, 0.0, 0.06, 1.3, 0.06, 0.0, 'woodDark')                       # główne ramię
    arm_box(ang, 0.25, 0.3, 0.025, 1.0, 0.025, 0.0, 'wood')                      # listwa krawędzi kraty
    for k in range(9):                                                           # poprzeczki
        c, s = math.cos(ang), math.sin(ang)
        lx, ly = 0.0, 0.33 + k * 0.115
        cx, cy = lx * c - ly * s, lx * s + ly * c
        # poprzeczka leży w poprzek ramienia: od osi ramienia do listwy krawędzi (+lx)
        b.box('spin', 'wood', 0.018, 0.25, 0.018, cx, cy, 0.0, roll=ang - math.pi / 2)
    for k in range(2):
        arm_box(ang, 0.08 + k * 0.085, 0.3, 0.016, 1.0, 0.016, -0.012, 'wood')
    if i % 2 == 0:   # płótno rozwinięte (dwie warstwy)
        arm_box(ang, 0.13, 0.33, 0.22, 0.93, 0.008, -0.026, 'white')
    else:            # płótno zwinięte wzdłuż ramienia
        c, s = math.cos(ang), math.sin(ang)
        lx, ly = 0.05, 0.32
        x, yy = lx * c - ly * s, lx * s + ly * c
        b.box('spin', 'white', 0.05, 0.9, 0.05, x, yy, -0.03, roll=ang)

# ---------------- przy drzwiach: worki mąki, zapasowy kamień młyński, taczka ----------------
for x, z, s in ((0.42, 0.72, 1.0), (0.56, 0.6, 0.85), (0.5, 0.86, 0.8)):
    b.sack('base', x, 0.0, z, w=0.14 * s, rot=x * 7 + z)   # worek mąki (tools/models/sack.py)
# kamień oparty o podmurówkę (stoi na krawędzi): walec w płaszczyźnie yz
SX, SZ, SR = -0.7, 0.62, 0.19
for k in range(16):
    a0, a1 = 2 * math.pi * k / 16, 2 * math.pi * (k + 1) / 16
    P = lambda a, dx: (SX + dx, SR + math.cos(a) * SR, SZ + math.sin(a) * SR)
    b.poly('base', 'stone', [P(a0, -0.035), P(a1, -0.035), P(a1, 0.035), P(a0, 0.035)], away=(SX, SR, SZ))
for dx in (-0.035, 0.035):
    b.poly('base', 'stone', [(SX + dx, SR + math.cos(2 * math.pi * k / 16) * SR, SZ + math.sin(2 * math.pi * k / 16) * SR) for k in range(16)], away=(SX - dx * 10, SR, SZ))
    b.poly('base', 'dark', [(SX + dx * 1.05, SR + math.cos(2 * math.pi * k / 8) * 0.04, SZ + math.sin(2 * math.pi * k / 8) * 0.04) for k in range(8)], away=(SX - dx * 10, SR, SZ))

# skrzydła i kamień zbudowane wokół (0, 0, 0): przesuwamy je na miejsce (gra obraca je wokół spinAt / runnerAt)
for (grp, mat), polys in b.parts.items():
    off = SPIN_AT if grp == 'spin' else RUN_AT if grp == 'runner' else None
    if off:
        for i, pts in enumerate(polys):
            polys[i] = [(x + off[0], y + off[1], z + off[2]) for x, y, z in pts]

E = PL + 0.42
VIEWS = [
    ['młyn z przodu', [0.6, 0.9, 3.4], [0, 1.0, 0], ['base', 'shell', 'spin'], 26],
    ['skrzydła z boku', [3.0, 1.6, 0.6], [0, 1.4, 0.4], ['base', 'shell', 'spin'], 26],
    ['wnętrze z góry (młynarz przy pracy)', [0.3, 2.0, 1.2], [0, 0.3, -0.1], ['base', 'interior', 'floor', 'runner'], 24],
    ['od drzwi', [0.0, E, 0.5], [0, PL + 0.2, -0.4], ['base', 'interior', 'floor', 'runner'], 16],
]
b.save('mill', maxe=0.3, rays=16, reach=0.4, extra={
    'windows': windows, 'chimneys': [], 'flames': [], 'floorY': PL,
    'spinAt': [round(v, 3) for v in SPIN_AT], 'runnerAt': [round(v, 3) for v in RUN_AT],
    'pennant': [0.0, round(TOP + 0.6, 3), 0.0], 'views': VIEWS})
