"""Wieża magów ognia (3×3 pola): ośmioboczna baszta z ciosów na szerszym cokole, pasy ciemniejszego kamienia,
wąskie ostrołukowe okna, okute drzwi pod ostrołukiem na kamiennych schodkach, dach ośmiospadowy z czerwonej
dachówki na wysuniętym okapie, na szczycie żelazny grot z tarczą słońca. Przy wieży niższa przybudówka z kominem
(pracownia — tu warzą mikstury), przed wejściem brukowany krąg z wielkim kamiennym zniczem (ogień płonie cały czas),
po bokach drzwi żelazne kosze z żarem na słupach, czerwone płachty pod oknami, ława z ciosu, stos polan i kosz z węglem.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/magefire.py  →  src/render/models/magefire.json
Układ: środek działki = (0, 0), działka ±1,5, przód (drzwi) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from logs import log  # noqa: E402

b = Building()
flames, lights, chimneys, windows = [], [], [], []

CX, CZ = 0.25, -0.25     # oś wieży (lekko w tył i w prawo — z przodu krąg ze zniczem, z lewej przybudówka)
R = 0.78                 # promień trzonu (do wierzchołka ośmioboku)
TOP = 2.75               # wierzch muru wieży
PH = math.pi / 8         # ośmiobok ścianą do przodu
AP = R * math.cos(PH)    # odległość ściany od osi


def face(k):
    """Środek k-tej ściany ośmioboku (0 = przód, dalej w lewo) i kąt obrotu ściany"""
    a = k * math.pi / 4
    return CX + math.sin(a) * AP, CZ + math.cos(a) * AP, a


# ---------------- cokół, trzon, pasy ----------------
b.prism('base', 'castleDark', R + 0.16, R + 0.14, 0.2, CX, 0.0, CZ, seg=8, phase=PH)
b.prism('base', 'castleDark', R + 0.08, R + 0.07, 0.08, CX, 0.2, CZ, seg=8, phase=PH)
b.prism('base', 'castle', R, R, TOP - 0.28, CX, 0.28, CZ, seg=8, phase=PH)
for y in (1.05, 1.95):
    b.prism('base', 'castleDark', R + 0.035, R + 0.035, 0.07, CX, y, CZ, seg=8, phase=PH)
# gzyms pod okapem: wysunięte wsporniki na każdym rogu
b.prism('base', 'castleDark', R + 0.07, R + 0.07, 0.1, CX, TOP - 0.1, CZ, seg=8, phase=PH)
for k in range(8):
    a = PH + k * math.pi / 4
    x, z = CX + math.sin(a) * (R + 0.02), CZ + math.cos(a) * (R + 0.02)
    b.box('base', 'castleDark', 0.12, 0.16, 0.12, x, TOP - 0.26, z, rot=a)
# ---------------- okna: wąskie, ostrołukowe, w trzech kondygnacjach ----------------
def lancet(k, y0, h, w=0.13):
    x, z, a = face(k)
    nx, nz = math.sin(a), math.cos(a)
    ox, oz = x + nx * 0.006, z + nz * 0.006
    # obramienie z ciemniejszego kamienia (wystaje z lica) i ciemna wnęka
    b.box('base', 'castleDark', w + 0.08, 0.05, 0.05, ox, y0 - 0.05, oz, rot=a)
    for s in (-1, 1):
        b.box('base', 'castleDark', 0.04, h + 0.02, 0.045, ox + math.cos(a) * s * (w / 2 + 0.02), y0, oz - math.sin(a) * s * (w / 2 + 0.02), rot=a)
    b.box('base', 'dark', w, h, 0.02, ox, y0, oz, rot=a)
    # ostrołuk: dwa skośne ciosy nad wnęką
    for s in (-1, 1):
        b.box('base', 'castleDark', w * 0.62, 0.045, 0.045, ox + math.cos(a) * s * w * 0.24, y0 + h + 0.035, oz - math.sin(a) * s * w * 0.24, rot=a, roll=-s * 0.62)
    windows.append([round(ox + nx * 0.012, 4), round(y0 + h, 4), round(oz + nz * 0.012, 4), round(nx, 3), round(nz, 3), round(w * 0.8, 3), round(h * 0.85, 3), 'base'])


for k in (1, 3, 5, 7):
    lancet(k, 0.55, 0.36)
for k in (0, 2, 4, 6):
    lancet(k, 1.35, 0.4)
for k in range(8):
    lancet(k, 2.17, 0.32, w=0.11)

# ---------------- drzwi: okute wrota pod ostrołukiem, schodki ----------------
DX, DZ, DA = face(0)
DW, DH = 0.36, 0.62
for s in range(3):
    b.box('base', 'castleDark', DW + 0.34 - s * 0.08, 0.08, 0.2 - s * 0.04, DX, 0.0 + s * 0.08 if s else 0.0, DZ + 0.2 - s * 0.05)
DY = 0.24
b.box('base', 'woodDark', DW, DH, 0.03, DX, DY, DZ + 0.01)
for y in (DY + 0.12, DY + 0.42):
    b.box('base', 'iron', DW + 0.01, 0.03, 0.04, DX, y, DZ + 0.012)
b.box('base', 'iron', 0.035, 0.035, 0.05, DX + 0.1, DY + 0.3, DZ + 0.03)
for s in (-1, 1):
    b.box('base', 'castleDark', 0.09, DH + 0.04, 0.09, DX + s * (DW / 2 + 0.045), DY, DZ + 0.015)
    b.box('base', 'castleDark', DW * 0.66, 0.08, 0.08, DX + s * DW * 0.24, DY + DH + 0.07, DZ + 0.015, roll=-s * 0.6)
b.box('base', 'gold', 0.07, 0.07, 0.03, DX, DY + DH + 0.17, DZ + 0.03)

# ---------------- dach ośmiospadowy z dachówki, grot z tarczą słońca ----------------
RY = TOP
b.prism('shell', 'roofTile', R + 0.2, 0.0, 1.05, CX, RY, CZ, seg=8, phase=PH)
b.prism('shell', 'castleDark', R + 0.2, R + 0.2, 0.025, CX, RY - 0.025, CZ, seg=8, phase=PH, top=False)  # spód okapu
log(b, 'shell', 'iron', (CX, RY + 1.0, CZ), (CX, RY + 1.45, CZ), r=0.018, seg=6, ends='iron')
b.prism('shell', 'gold', 0.07, 0.07, 0.012, CX, RY + 1.32, CZ - 0.006, seg=12)
for k in range(8):
    a = k * math.pi / 4
    log(b, 'shell', 'gold', (CX + math.sin(a) * 0.07, RY + 1.326 + math.cos(a) * 0.07, CZ), (CX + math.sin(a) * 0.12, RY + 1.326 + math.cos(a) * 0.12, CZ), r=0.008, seg=4, ends='gold')
# lukarna z oknem na dachu, od przodu
b.box('shell', 'castle', 0.2, 0.26, 0.16, CX, RY + 0.1, CZ + R * 0.62)
b.box('shell', 'dark', 0.1, 0.16, 0.01, CX, RY + 0.14, CZ + R * 0.62 + 0.08)
b.gable('shell', 'roofTile', CX - 0.13, CX + 0.13, CZ + R * 0.62 - 0.1, CZ + R * 0.62 + 0.12, RY + 0.36, 0.12, along_x=False, over=0.03)

# ---------------- przybudówka (pracownia) z lewej, z kominem ----------------
AX0, AX1, AZ0, AZ1 = -1.38, CX - R + 0.15, -0.85, 0.15
AH = 0.95
b.box('base', 'castleDark', AX1 - AX0 + 0.06, 0.12, AZ1 - AZ0 + 0.06, (AX0 + AX1) / 2, 0.0, (AZ0 + AZ1) / 2, bottom=False)
b.box('base', 'castle', AX1 - AX0, AH - 0.12, AZ1 - AZ0, (AX0 + AX1) / 2, 0.12, (AZ0 + AZ1) / 2, top=False)
b.gable('shell', 'roofTile', AX0, AX1, AZ0, AZ1, AH, 0.42, along_x=True, over=0.1, end_mat='castle')
# okno przybudówki z przodu i drzwiczki z boku
ox = (AX0 + AX1) / 2
b.box('base', 'castleDark', 0.3, 0.05, 0.05, ox, 0.42, AZ1 + 0.005)
b.box('base', 'dark', 0.22, 0.24, 0.02, ox, 0.47, AZ1 + 0.006)
windows.append([round(ox, 4), 0.71, round(AZ1 + 0.02, 4), 0, 1, 0.2, 0.22, 'base'])
for s in (-1, 1):
    b.box('base', 'woodDark', 0.03, 0.26, 0.04, ox + s * 0.125, 0.45, AZ1 + 0.012)
b.box('base', 'woodDark', 0.03, 0.55, 0.24, AX0 - 0.005, 0.12, -0.35)
# komin z ciosów, z czapką
KX, KZ = AX0 + 0.28, AZ0 + 0.22
b.box('base', 'castleDark', 0.24, AH + 0.95, 0.24, KX, 0.0, KZ)
b.box('base', 'castleDark', 0.3, 0.06, 0.3, KX, AH + 0.95, KZ)
chimneys.append([round(KX, 4), round(AH + 1.02, 4), round(KZ, 4)])

# ---------------- brukowany krąg i wielki znicz przed wieżą ----------------
FX, FZ = -0.6, 0.95
b.prism('base', 'castleDark', 0.48, 0.48, 0.03, FX, 0.0, FZ, seg=16)
for k in range(16):
    a = 2 * math.pi * (k + 0.5) / 16
    b.box('base', 'castle', 0.1, 0.035, 0.07, FX + math.sin(a) * 0.43, 0.0, FZ + math.cos(a) * 0.43, rot=a)
# kamienna kolumna, na niej szeroka misa z brązu z żarem
b.prism('base', 'castleDark', 0.15, 0.13, 0.1, FX, 0.03, FZ, seg=8)
b.prism('base', 'castle', 0.09, 0.08, 0.42, FX, 0.13, FZ, seg=8)
b.prism('base', 'castleDark', 0.12, 0.14, 0.06, FX, 0.55, FZ, seg=8)
b.prism('base', 'gold', 0.1, 0.2, 0.12, FX, 0.61, FZ, seg=12, top=False)
b.prism('base', 'ember', 0.185, 0.185, 0.005, FX, 0.715, FZ, seg=12)
b.prism('base', 'gold', 0.205, 0.205, 0.025, FX, 0.715, FZ, seg=12, top=False)
for (dx, dz) in ((0, 0), (0.08, 0.04), (-0.07, 0.05), (0.03, -0.08), (-0.05, -0.06)):
    flames.append([round(FX + dx, 4), 0.72, round(FZ + dz, 4)])
lights.append([FX, 0.95, FZ])

# ---------------- żelazne kosze z żarem na słupach po bokach drzwi ----------------
for s in (-1, 1):
    bx, bz = DX + s * 0.46, DZ + 0.34
    b.box('base', 'castleDark', 0.12, 0.06, 0.12, bx, 0.0, bz)
    log(b, 'base', 'iron', (bx, 0.06, bz), (bx, 0.62, bz), r=0.018, seg=6, ends='iron')
    b.prism('base', 'iron', 0.035, 0.08, 0.08, bx, 0.62, bz, seg=8, top=False)
    b.prism('base', 'ember', 0.07, 0.07, 0.004, bx, 0.69, bz, seg=8)
    flames.append([round(bx, 4), 0.69, round(bz, 4)])
    lights.append([bx, 0.85, bz])

# ---------------- czerwone płachty pod oknami (na drzewcach z żelaznymi uchwytami) ----------------
for k in (2, 6):
    x, z, a = face(k)
    nx, nz = math.sin(a), math.cos(a)
    px, pz = x + nx * 0.05, z + nz * 0.05
    log(b, 'base', 'iron', (px - math.cos(a) * 0.16, 1.88, pz + math.sin(a) * 0.16), (px + math.cos(a) * 0.16, 1.88, pz - math.sin(a) * 0.16), r=0.01, seg=5, ends='iron')
    b.box('base', 'robeRed', 0.28, 0.62, 0.012, px, 1.25, pz, rot=a)
    b.box('base', 'gold', 0.28, 0.035, 0.016, px, 1.27, pz, rot=a)
    b.box('base', 'gold', 0.07, 0.07, 0.016, px, 1.6, pz, rot=a)

# ---------------- ława z ciosu, stos polan, kosz z węglem ----------------
b.box('base', 'castleDark', 0.5, 0.18, 0.16, -0.65, 0.0, 0.42)
b.box('base', 'castle', 0.56, 0.05, 0.2, -0.65, 0.18, 0.42)
for k in range(3):
    for j in range(4 - k):
        z = 1.12 - 0.11 * j - 0.055 * k
        log(b, 'base', 'bark', (1.05, 0.055 + k * 0.095, z), (1.42, 0.055 + k * 0.095, z), r=0.05, seg=7, ends='wood')
b.prism('base', 'basket', 0.1, 0.12, 0.17, 1.2, 0.0, 0.62)
for (dx, dz, r) in ((0.0, 0.0, 0.04), (0.04, 0.02, 0.03), (-0.035, 0.03, 0.032)):
    b.crystal('base', 'dark', 1.2 + dx, 0.17, 0.62 + dz, r, seed=dx * 13 + dz)

VIEWS = [
    ['wieża z przodu (oczy chłopa)', [0.0, 0.5, 2.9], [0.1, 1.2, -0.2], ['base', 'shell'], 34],
    ['znicz i drzwi', [-0.9, 0.55, 2.1], [-0.2, 0.6, 0.6], ['base', 'shell'], 30],
    ['przybudówka z boku', [-2.6, 0.6, 0.4], [-0.6, 0.6, -0.3], ['base', 'shell'], 30],
    ['spod okapu', [CX + 0.95, 0.3, CZ + 0.9], [CX, TOP, CZ], ['base', 'shell'], 40],
]
b.save('magefire', maxe=0.18, rays=16, reach=0.3, extra={'views': VIEWS, 'flames': flames, 'lights': lights, 'chimneys': chimneys, 'windows': windows})
