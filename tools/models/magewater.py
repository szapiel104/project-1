"""Sanktuarium magów wody (3×3 pola): jasna, kamienna sala z ciosanego kamienia pod wysokim dachem z łupka,
z przodu portyk na dwóch kolumnach z trójkątnym szczytem, nad drzwiami okrągłe okno-rozeta. Po bokach smukłe,
wąskie okna, granatowe płachty z srebrnym obrąbkiem. Z prawej przed salą okrągła sadzawka w kamiennej cembrowinie
z fontanną (kolumienka z misą, woda spływa do sadzawki), wokół trzciny i kamienne ławy; z lewej dzbany na wodę i
żelazne latarnie. Tył: niższa, okrągła cysterna z kopulastym daszkiem.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/magewater.py  →  src/render/models/magewater.json
Układ: środek działki = (0, 0), działka ±1,5, przód (drzwi) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from logs import log  # noqa: E402

b = Building()
lights, windows = [], []

HX0, HX1, HZ0, HZ1 = -0.95, 0.75, -1.05, 0.35   # sala (drzwi w przedniej ścianie, z = HZ1)
WH = 1.35                                       # wysokość murów
HXC = (HX0 + HX1) / 2

# ---------------- cokół i mury sali ----------------
b.box('base', 'castleDark', HX1 - HX0 + 0.12, 0.16, HZ1 - HZ0 + 0.12, HXC, 0.0, (HZ0 + HZ1) / 2, bottom=False)
b.box('base', 'cut', HX1 - HX0, WH - 0.16, HZ1 - HZ0, HXC, 0.16, (HZ0 + HZ1) / 2, top=False)
# pilastry na narożnikach i w połowie ścian bocznych (wystają z lica)
for x in (HX0, HX1):
    for z in (HZ0, (HZ0 + HZ1) / 2, HZ1):
        b.box('base', 'cutDark', 0.12, WH - 0.16, 0.12, x, 0.16, z)
# gzyms pod okapem
b.box('base', 'cutDark', HX1 - HX0 + 0.1, 0.07, HZ1 - HZ0 + 0.1, HXC, WH - 0.07, (HZ0 + HZ1) / 2)

# ---------------- dach z łupka (kalenica wzdłuż z), szczyty z kamienia ----------------
b.gable('shell', 'slate', HX0, HX1, HZ0, HZ1, WH, 0.85, along_x=False, over=0.12)
# szczyty sali: trójkąt z kamienia na zewnątrz i drugi, cofnięty o 1 cm do środka (od środka też ściana). Nie w jednym
# miejscu — inaczej cień w zagłębieniach liczy jeden trójkąt jako zasłonięty przez drugi i szczyt wychodzi czarny
def gable_ends(x0, x1, z0, z1, y, h, inset=0.012, rows=6):
    """Szczyt z drobnych trójkątów: cień w zagłębieniach liczy się w wierzchołkach, a wielki trójkąt ma je tylko
    w rogach pod dachem (tam zawsze ciemno) — bez podziału cały szczyt wychodził czarny"""
    xm = (x0 + x1) / 2
    for z, d in ((z0, inset), (z1, -inset)):
        def P(i, j):  # wiersz i (0 = dół), kolumna j w wierszu
            t = i / rows
            xa, xb = x0 + (xm - x0) * t, x1 + (xm - x1) * t
            n = rows - i
            return (xa + (xb - xa) * (j / n) if n else xm, y + h * t, z)
        for i in range(rows):
            n = rows - i
            for j in range(n):
                tri = [P(i, j), P(i, j + 1), P(i + 1, j) if n > 1 else (xm, y + h, z)]
                b.poly('shell', 'cut', tri, away=(xm, y + h * 0.3, z - (1 if z == z1 else -1)))
                if j < n - 1:
                    b.poly('shell', 'cut', [P(i, j + 1), P(i + 1, j + 1), P(i + 1, j)], away=(xm, y + h * 0.3, z - (1 if z == z1 else -1)))
        zz = z + d
        b.poly('shell', 'cutDark', [(x0, y, zz), (x1, y, zz), (xm, y + h, zz)], away=(xm, y + h * 0.3, zz + (1 if z == z1 else -1)))


gable_ends(HX0, HX1, HZ0, HZ1, WH, 0.85)
# srebrzysta kula na kalenicy z przodu (znak kręgu)
b.prism('shell', 'cutDark', 0.04, 0.03, 0.06, HXC, WH + 0.83, HZ1 + 0.08, seg=8)
b.crystal('shell', 'white', HXC, WH + 0.89, HZ1 + 0.08, 0.045, seed=3.0, seg=9)

# ---------------- okna boczne: smukłe, z półkolistym nadprożem ----------------
def side_window(x, z, side):
    nx = side
    ox = x + side * 0.006
    b.box('base', 'cutDark', 0.05, 0.62, 0.2, ox, 0.48, z)
    b.box('base', 'dark', 0.03, 0.5, 0.13, ox + side * 0.012, 0.52, z)
    b.box('base', 'cutDark', 0.055, 0.06, 0.22, ox, 1.1, z)
    windows.append([round(ox + side * 0.03, 4), 1.0, round(z, 4), nx, 0, 0.11, 0.45, 'base'])


for z in (HZ0 + 0.35, HZ1 - 0.45):
    side_window(HX0 - 0.0, z, -1)
    side_window(HX1 + 0.0, z, 1)

# dwa okna w tylnej ścianie (żeby tył nie był gładką płytą)
for x in (HXC - 0.4, HXC + 0.4):
    b.box('base', 'cutDark', 0.2, 0.62, 0.05, x, 0.48, HZ0 - 0.006)
    b.box('base', 'dark', 0.13, 0.5, 0.03, x, 0.52, HZ0 - 0.018)
    b.box('base', 'cutDark', 0.22, 0.06, 0.055, x, 1.1, HZ0 - 0.006)
    windows.append([round(x, 4), 1.0, round(HZ0 - 0.035, 4), 0, -1, 0.11, 0.45, 'base'])

# granatowe płachty między oknami po bokach
for x, side in ((HX0, -1), (HX1, 1)):
    zc = (HZ0 + HZ1) / 2
    log(b, 'base', 'iron', (x + side * 0.08, 1.12, zc - 0.13), (x + side * 0.08, 1.12, zc + 0.13), r=0.009, seg=5, ends='iron')
    b.box('base', 'robeBlue', 0.012, 0.6, 0.24, x + side * 0.085, 0.52, zc)
    b.box('base', 'white', 0.016, 0.03, 0.24, x + side * 0.086, 0.54, zc)

# ---------------- portyk: dwie kolumny, belkowanie i trójkątny szczyt ----------------
PZ = HZ1 + 0.42
for s in (-1, 1):
    x = HXC + s * 0.36
    b.prism('base', 'cutDark', 0.085, 0.085, 0.06, x, 0.12, PZ, seg=10)
    b.prism('base', 'cut', 0.06, 0.055, 0.98, x, 0.18, PZ, seg=12)
    b.prism('base', 'cutDark', 0.065, 0.085, 0.07, x, 1.16, PZ, seg=10)
b.box('base', 'cutDark', 0.96, 0.1, 0.5, HXC, 1.23, HZ1 + 0.2)          # belkowanie na kolumnach i murze
b.gable('shell', 'slate', HXC - 0.5, HXC + 0.5, HZ1, PZ + 0.1, 1.33, 0.32, along_x=False, over=0.03)
gable_ends(HXC - 0.5, HXC + 0.5, HZ1, PZ + 0.1, 1.33, 0.32)
# posadzka portyku: płyta i dwa stopnie
b.box('base', 'cutDark', 1.04, 0.06, 0.62, HXC, 0.0, HZ1 + 0.3, bottom=False)
b.box('base', 'cut', 0.96, 0.06, 0.56, HXC, 0.06, HZ1 + 0.28)
b.box('base', 'castleDark', 0.7, 0.06, 0.12, HXC, 0.0, PZ + 0.2, bottom=False)

# ---------------- drzwi i rozeta ----------------
DW, DH = 0.36, 0.66
b.box('base', 'woodDark', DW, DH, 0.03, HXC, 0.12, HZ1 + 0.01)
for y in (0.24, 0.6):
    b.box('base', 'iron', DW + 0.01, 0.025, 0.04, HXC, y, HZ1 + 0.012)
b.box('base', 'iron', 0.03, 0.03, 0.05, HXC + 0.11, 0.44, HZ1 + 0.03)
for s in (-1, 1):
    b.box('base', 'cutDark', 0.08, DH + 0.04, 0.06, HXC + s * (DW / 2 + 0.04), 0.12, HZ1 + 0.01)
b.box('base', 'cutDark', DW + 0.16, 0.07, 0.06, HXC, 0.12 + DH + 0.02, HZ1 + 0.01)
# rozeta nad drzwiami: pierścień z ośmiu ciosów w płaszczyźnie ściany, w środku ciemna szyba z krzyżem
RY = 1.0
for k in range(8):
    a = k * math.pi / 4
    b.box('base', 'cutDark', 0.085, 0.05, 0.05, HXC + math.sin(a) * 0.105, RY - 0.025 + math.cos(a) * 0.105, HZ1 + 0.012, roll=-a)
b.box('base', 'dark', 0.17, 0.17, 0.01, HXC, RY - 0.085, HZ1 + 0.008)
b.box('base', 'cutDark', 0.18, 0.02, 0.02, HXC, RY - 0.01, HZ1 + 0.018)
b.box('base', 'cutDark', 0.02, 0.18, 0.02, HXC, RY - 0.09, HZ1 + 0.018)
windows.append([round(HXC, 4), round(RY + 0.075, 4), round(HZ1 + 0.02, 4), 0, 1, 0.15, 0.15, 'base'])

# ---------------- sadzawka z fontanną (prawy przód) ----------------
SX, SZ, SR = 0.9, 1.0, 0.42
seg = 16
for k in range(seg):
    a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
    am = (a0 + a1) / 2
    b.box('base', 'cut', SR * 2 * math.sin(math.pi / seg) + 0.01, 0.16, 0.08, SX + math.sin(am) * (SR + 0.04), 0.0, SZ + math.cos(am) * (SR + 0.04), rot=am)
b.prism('base', 'castleDark', SR + 0.01, SR + 0.01, 0.02, SX, 0.0, SZ, seg=seg)       # dno
b.prism('base', 'water', SR, SR, 0.005, SX, 0.12, SZ, seg=seg)                         # tafla
# kolumienka z misą, z misy cieknie woda
b.prism('base', 'cutDark', 0.07, 0.06, 0.08, SX, 0.12, SZ, seg=8)
b.prism('base', 'cut', 0.04, 0.035, 0.32, SX, 0.2, SZ, seg=8)
b.prism('base', 'cut', 0.04, 0.15, 0.06, SX, 0.52, SZ, seg=12, top=False)
b.prism('base', 'water', 0.135, 0.135, 0.004, SX, 0.565, SZ, seg=12)
# trzciny przy sadzawce i kamienna ława
for k, a in enumerate((2.2, 2.5, 2.8, 3.9, 4.2)):
    x, z = SX + math.sin(a) * (SR + 0.16), SZ + math.cos(a) * (SR + 0.16)
    for j in range(3):
        log(b, 'base', 'leaf', (x + j * 0.015, 0.0, z), (x + j * 0.02 + 0.02 * math.sin(j + k), 0.32 + 0.06 * j, z + 0.015 * j), r=0.008, r1=0.003, seg=4)
b.box('base', 'cutDark', 0.12, 0.16, 0.12, 1.15, 0.0, 0.25)
b.box('base', 'cutDark', 0.12, 0.16, 0.12, 1.15, 0.0, -0.2)
b.box('base', 'cut', 0.18, 0.05, 0.6, 1.15, 0.16, 0.02)

# ---------------- dzbany na wodę i latarnie (lewy przód) ----------------
for k, (x, z, r, h) in enumerate(((-1.2, 0.75, 0.07, 0.2), (-1.05, 0.88, 0.06, 0.17), (-1.3, 0.95, 0.055, 0.15))):
    b.prism('base', 'castlePlain', r * 0.7, r, h * 0.55, x, 0.0, z, seg=9, top=False)
    b.prism('base', 'castlePlain', r, r * 0.55, h * 0.45, x, h * 0.55, z, seg=9, top=False)
    b.prism('base', 'castlePlain', r * 0.55, r * 0.6, 0.02, x, h, z, seg=9, top=False)
    b.prism('base', 'water', r * 0.5, r * 0.5, 0.003, x, h + 0.005, z, seg=9)
for x in (HXC - 0.62, HXC + 0.62):
    z = HZ1 + 0.72
    b.box('base', 'castleDark', 0.1, 0.06, 0.1, x, 0.0, z)
    log(b, 'base', 'iron', (x, 0.06, z), (x, 0.68, z), r=0.015, seg=6, ends='iron')
    b.box('base', 'iron', 0.09, 0.015, 0.09, x, 0.68, z)
    b.box('base', 'window', 0.07, 0.1, 0.07, x, 0.695, z)
    b.pyramid('base', 'iron', 0.1, 0.1, 0.06, x, 0.795, z)
    lights.append([x, 0.75, z])

# ---------------- okrągła cysterna z tyłu z kopulastym daszkiem ----------------
TX, TZ, TR = 0.95, -0.95, 0.36
b.prism('base', 'castleDark', TR + 0.05, TR + 0.04, 0.12, TX, 0.0, TZ, seg=12)
b.prism('base', 'cut', TR, TR, 0.7, TX, 0.12, TZ, seg=12, top=False)
for k in range(5):
    y0 = 0.82 + k * 0.06
    b.prism('shell', 'slate', TR + 0.06 - k * 0.085, max(0.0, TR - 0.03 - k * 0.085), 0.06, TX, y0, TZ, seg=12, top=k == 4)
b.box('base', 'woodDark', 0.24, 0.36, 0.03, TX, 0.12, TZ + TR - 0.01)

VIEWS = [
    ['sanktuarium z przodu (oczy chłopa)', [0.0, 0.5, 3.0], [0, 0.8, -0.2], ['base', 'shell'], 34],
    ['portyk z bliska', [-0.4, 0.5, 1.8], [HXC, 0.8, HZ1], ['base', 'shell'], 30],
    ['sadzawka', [1.9, 0.6, 1.9], [SX, 0.3, SZ], ['base', 'shell'], 28],
    ['spod okapu portyku', [HXC + 0.3, 0.3, PZ + 0.25], [HXC, 1.4, HZ1], ['base', 'shell'], 40],
]
b.save('magewater', maxe=0.18, rays=16, reach=0.3, extra={'views': VIEWS, 'lights': lights, 'windows': windows})
