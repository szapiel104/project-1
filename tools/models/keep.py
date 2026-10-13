"""Zamek (twierdza gracza, 3×3 pola): mury z dziedzińcem, cztery okrągłe baszty, brama z kratą,
donżon z wielką salą i komnatą pana, koszary straży przy lewym murze. Do środka da się zajrzeć:
przy podglądzie wnętrza znikają dachy i piętra donżonu, widać salę, komnatę, schody i sypialnię straży.

Uruchomienie (z katalogu repo):  python tools/models/keep.py
Wynik: src/render/models/keep.json (wczytuje go src/render/buildings.ts).
Układ: środek działki = (0, 0), 1 = jedno pole, przód (brama) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
G = 0.22                    # poziom dziedzińca (wierzch podmurówki)
WO, WT, WH = 1.22, 0.16, 1.0  # lico muru, grubość, wysokość nad dziedzińcem
WI = WO - WT
TOP = G + WH                # chodnik na murach
TR = 0.4                    # promień baszty

# ---------- podmurówka i dziedziniec ----------
b.box('base', 'castleDark', 2.86, 0.12, 2.86)
b.box('base', 'castleDark', 2.74, G - 0.12, 2.74, 0, 0.12, 0)
b.box('base', 'pathCobble', 2 * WI, 0.015, 2 * WI, 0, G, 0)

# ---------- mury kurtynowe ----------
for sz in (-1, 1):
    if sz < 0:
        b.box('base', 'castle', 2 * WO, WH, WT, 0, G, -WO + WT / 2)
    else:
        for sx in (-1, 1):  # przód: dwa odcinki po bokach bramy
            b.box('base', 'castle', WO - 0.2, WH, WT, sx * (0.2 + (WO - 0.2) / 2), G, WO - WT / 2)
        b.box('base', 'castle', 0.4, WH - 0.52, WT, 0, G + 0.52, WO - WT / 2)
for sx in (-1, 1):
    b.box('base', 'castle', WT, WH, 2 * WO, sx * (WO - WT / 2), G, 0)
# gzyms w połowie wysokości, korona muru, blanki po zewnętrznej stronie
for sz in (-1, 1):
    b.box('base', 'castleDark', 2 * WO + 0.04, 0.05, 0.04, 0, G + 0.42, sz * (WO + 0.01))
    b.box('base', 'castleDark', 2 * WO + 0.04, 0.05, WT + 0.06, 0, TOP, sz * (WO - WT / 2))
    b.merlons_line('base', 'castle', -WO + TR, sz * (WO - 0.03), WO - TR, sz * (WO - 0.03), TOP + 0.05)
for sx in (-1, 1):
    b.box('base', 'castleDark', 0.04, 0.05, 2 * WO + 0.04, sx * (WO + 0.01), G + 0.42, 0)
    b.box('base', 'castleDark', WT + 0.06, 0.05, 2 * WO + 0.04, sx * (WO - WT / 2), TOP, 0)
    b.merlons_line('base', 'castle', sx * (WO - 0.03), -WO + TR, sx * (WO - 0.03), WO - TR, TOP + 0.05)
# strzelnice
for k in (-0.55, 0.55):
    b.box('base', 'dark', 0.035, 0.17, 0.012, k, G + 0.55, -WO - 0.004)
    for sx in (-1, 1):
        b.box('base', 'dark', 0.012, 0.17, 0.035, sx * (WO + 0.004), G + 0.55, k)

# ---------- baszty w narożnikach: skarpa, walec, gzyms, blanki, stożkowy dach z łupka ----------
for sx in (-1, 1):
    for sz in (-1, 1):
        cx, cz = sx * (WO - 0.02), sz * (WO - 0.02)
        b.prism('base', 'castleDark', TR + 0.09, TR, 0.42, cx, 0.0, cz, seg=16, top=False)
        b.prism('base', 'castle', TR, TR - 0.02, 1.85 - 0.42, cx, 0.42, cz, seg=16, top=True)
        b.prism('base', 'castleDark', TR + 0.03, TR + 0.03, 0.06, cx, 1.85, cz, seg=16)
        b.merlons_ring('base', 'castle', cx, cz, TR - 0.01, 1.91, n=10, w=0.11)
        b.prism('base', 'castleDark', TR + 0.06, TR + 0.06, 0.03, cx, 2.0, cz, seg=16)
        b.prism('base', 'slate', TR + 0.06, 0.0, 0.9, cx, 2.03, cz, seg=16)
        b.box('base', 'gold', 0.04, 0.09, 0.04, cx, 2.9, cz)
        b.box('base', 'woodDark', 0.02, 0.32, 0.02, cx, 2.95, cz)
        b.box('base', 'flag', 0.2, 0.11, 0.012, cx + 0.1, 3.13, cz)
        for ang0 in (math.atan2(sx, sz) - 0.75, math.atan2(sx, sz) + 0.75):
            for y in (0.8, 1.4):
                b.box('base', 'dark', 0.035, 0.17, 0.012, cx + math.sin(ang0) * (TR + 0.003 - 0.01), y, cz + math.cos(ang0) * (TR - 0.007), ang0)

# ---------- brama: dwie wieżyczki, przejazd, krata, otwarte wrota ----------
GZ = WO + 0.04
for sx in (-1, 1):
    b.box('base', 'castle', 0.24, 1.42 - G, 0.36, sx * 0.32, G, GZ)
    b.box('base', 'castleDark', 0.28, 0.05, 0.4, sx * 0.32, 1.42, GZ)
    b.merlons_line('base', 'castle', sx * 0.32 - 0.1, GZ + 0.17, sx * 0.32 + 0.1, GZ + 0.17, 1.47, step=0.1, w=0.07)
    b.box('base', 'dark', 0.035, 0.15, 0.012, sx * 0.32, G + 0.7, GZ + 0.184)
b.box('base', 'castle', 0.4, 1.42 - (G + 0.52), 0.36, 0, G + 0.52, GZ)
b.box('base', 'castleDark', 0.44, 0.05, 0.4, 0, 1.42, GZ)
b.merlons_line('base', 'castle', -0.18, GZ + 0.17, 0.18, GZ + 0.17, 1.47, step=0.12, w=0.07)
# łuk nad przejazdem: półkole z ciosów od frontu
for k in range(7):
    a = math.pi * (k + 0.5) / 7
    b.box('base', 'castleDark', 0.075, 0.06, 0.04, -math.cos(a) * 0.2, G + 0.44 + math.sin(a) * 0.1, GZ + 0.185, -a + math.pi / 2)
b.box('base', 'dark', 0.4, 0.004, 0.36, 0, G + 0.515, GZ)  # sklepienie przejazdu
# krata uniesiona do połowy
for k in range(6):
    b.box('base', 'iron', 0.014, 0.3, 0.014, -0.17 + k * 0.068, G + 0.24, GZ + 0.15)
for y in (0.3, 0.42):
    b.box('base', 'iron', 0.36, 0.014, 0.014, 0, G + y, GZ + 0.15)
# otwarte wrota od strony dziedzińca
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.19, 0.48, 0.035, sx * (0.2 - 0.0), G, GZ - 0.18, sx * -1.35)
# droga przez bramę i zwodzony most opuszczony na ziemię przed bramą
b.box('base', 'pathCobble', 0.38, 0.012, 0.6, 0, G, GZ - 0.1)
ramp = math.atan2(G, 0.5)
b.box('base', 'roadWood', 0.42, 0.035, math.hypot(0.5, G), 0, G - 0.035, GZ + 0.18, tilt=ramp, bottom=True)
for k in range(4):
    f = (k + 0.5) / 4
    b.box('base', 'woodDark', 0.44, 0.015, 0.025, 0, G - G * f + 0.0, GZ + 0.18 + 0.5 * f)
for sx in (-1, 1):
    b.box('base', 'iron', 0.012, math.hypot(0.5, 0.75), 0.012, sx * 0.19, 0.03, GZ + 0.68, tilt=-math.atan2(0.5, 0.75))

# ---------- dziedziniec: studnia z daszkiem, beczki, siano, stojak z bronią ----------
b.prism('base', 'stone', 0.1, 0.1, 0.15, 0.7, G, 0.55, seg=10)
b.prism('base', 'dark', 0.075, 0.075, 0.002, 0.7, G + 0.15, 0.55, seg=10)
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.025, 0.32, 0.025, 0.7 + sx * 0.09, G + 0.12, 0.55)
b.box('base', 'woodDark', 0.24, 0.025, 0.025, 0.7, G + 0.4, 0.55)
for sz in (-1, 1):
    b.box('base', 'wood', 0.28, 0.02, 0.14, 0.7, G + 0.44 + 0.0, 0.55 + sz * 0.06, 0.0)
for x, z in ((0.92, 0.85), (0.8, 0.9), (0.92, 0.2)):
    b.prism('base', 'wood', 0.055, 0.05, 0.13, x, G, z, seg=9)
b.box('base', 'hay', 0.22, 0.12, 0.16, 0.85, G, -0.05)

# ---------- koszary straży przy lewym murze: ściany z desek, dach jednospadowy (zdejmowany) ----------
BX0, BX1, BZ0, BZ1, BH = -WI, -0.16, 0.06, 0.96, 0.44
b.box('base', 'woodDark', BX1 - BX0, BH, 0.05, (BX0 + BX1) / 2, G, BZ0)
b.box('base', 'woodDark', BX1 - BX0, BH, 0.05, (BX0 + BX1) / 2, G, BZ1)
for z0, z1 in ((BZ0, 0.4), (0.62, BZ1)):  # ściana od dziedzińca z drzwiami
    b.box('base', 'woodDark', 0.05, BH, z1 - z0, BX1, G, (z0 + z1) / 2)
b.box('base', 'woodDark', 0.05, BH - 0.34, 0.22, BX1, G + 0.34, 0.51)
for z in (BZ0, 0.4, 0.62, BZ1):
    b.box('base', 'wood', 0.06, BH + 0.02, 0.06, BX1, G, z)
b.box('floor', 'plank', BX1 - BX0 - 0.04, 0.012, BZ1 - BZ0 - 0.04, (BX0 + BX1) / 2, G, (BZ0 + BZ1) / 2)
# dach: deski od muru w dół ku dziedzińcowi
rise, run = 0.16, BX1 - BX0 + 0.12
roof = math.atan2(rise, run)
for k in range(4):
    z = BZ0 - 0.04 + (BZ1 - BZ0 + 0.08) * (k + 0.5) / 4
    b.box('shell', 'roadWood', math.hypot(run, rise), 0.03, (BZ1 - BZ0 + 0.08) / 4 - 0.005, (BX0 + BX1) / 2 + 0.03, G + BH + rise / 2 - 0.015, z, 0.0)
# (pochylenie dachu: obracamy deski wokół osi z)
for poly in b.parts[('shell', 'roadWood')]:
    for i, (x, y, z) in enumerate(poly):
        cx, cy = (BX0 + BX1) / 2 + 0.03, G + BH + rise / 2
        dx, dy = x - cx, y - cy
        c, s = math.cos(-roof), math.sin(-roof)
        poly[i] = (cx + dx * c - dy * s, cy + dx * s + dy * c, z)
# w środku: stojak z włóczniami, skrzynia, beczka z wodą (sypiają na podłodze, posłania kładzie gra)
for k in range(4):
    b.box('interior', 'wood', 0.015, 0.4, 0.015, BX0 + 0.05, G, BZ0 + 0.1 + k * 0.05)
b.box('interior', 'woodDark', 0.03, 0.03, 0.22, BX0 + 0.06, G + 0.25, BZ0 + 0.18)
b.box('interior', 'woodDark', 0.16, 0.1, 0.1, BX1 - 0.12, G, BZ1 - 0.09)

# ---------- donżon ----------
DX, DZ0, DZ1 = 0.62, -WO + 0.02, -0.22   # połowa szerokości, tył, przód
DZ = (DZ0 + DZ1) / 2
DW, DD = 2 * DX, DZ1 - DZ0
H1, H2, H3 = G + 0.7, G + 1.5, G + 2.4  # stropy: sala, komnaty, galeria
# bryła z zewnątrz (zdejmowana): ściany, okna z wnękami, gzymsy, hurdycja, dach z łupka, chorągiew
b.box('shell', 'castle', DW, H3 - G, DD, 0, G, DZ)
b.box('shell', 'castleDark', DW + 0.1, 0.12, DD + 0.1, 0, G, DZ)
for y in (H1, H2):
    b.box('shell', 'castleDark', DW + 0.05, 0.05, DD + 0.05, 0, y, DZ)
for x in (-0.3, 0.3):
    for y in (H1 + 0.2, H2 + 0.2):
        b.box('shell', 'dark', 0.15, 0.27, 0.02, x, y, DZ1 + 0.003)
        b.box('shell', 'castleDark', 0.21, 0.035, 0.05, x, y - 0.03, DZ1 + 0.02)
    b.box('shell', 'window', 0.14, 0.22, 0.02, x, G + 0.25, DZ1 + 0.003)
for sx in (-1, 1):
    for y in (H1 + 0.2, H2 + 0.2):
        b.box('shell', 'dark', 0.02, 0.27, 0.15, sx * (DX + 0.003), y, DZ)
b.box('shell', 'woodDark', 0.22, 0.34, 0.03, 0, G, DZ1 + 0.012)
# hurdycja: wysunięta drewniana galeria na belkach
for k in range(-2, 3):
    for sx in (-1, 1):
        b.box('shell', 'woodDark', 0.05, 0.05, 0.18, k * 0.28, H3 - 0.06, sx * 0.0 + (DZ1 + 0.06 if sx > 0 else DZ0 - 0.06))
b.box('shell', 'woodDark', DW + 0.26, 0.05, DD + 0.26, 0, H3, DZ)
b.box('shell', 'wood', DW + 0.22, 0.34, DD + 0.22, 0, H3 + 0.05, DZ)
for k in range(-2, 3):
    b.box('shell', 'dark', 0.08, 0.12, 0.012, k * 0.25, H3 + 0.18, DZ1 + 0.116)
    b.box('shell', 'dark', 0.08, 0.12, 0.012, k * 0.25, H3 + 0.18, DZ0 - 0.116)
for sx in (-1, 1):
    for sz in (DZ0 - 0.11, DZ1 + 0.11):
        b.box('shell', 'woodDark', 0.06, 0.36, 0.06, sx * (DX + 0.11), H3 + 0.05, sz)
b.pyramid('shell', 'slate', DW + 0.36, DD + 0.36, 1.15, 0, H3 + 0.39, DZ)
b.box('shell', 'castleDark', DW + 0.36, 0.03, DD + 0.36, 0, H3 + 0.38, DZ)
b.box('shell', 'gold', 0.05, 0.1, 0.05, 0, H3 + 1.52, DZ)
b.box('shell', 'woodDark', 0.035, 0.8, 0.035, 0, H3 + 1.5, DZ)
b.box('shell', 'flag', 0.5, 0.28, 0.015, 0.27, H3 + 1.98, DZ)

# wnętrze (po zdjęciu bryły): parter donżonu ze ścianami uciętymi nisko
LW = 0.5
b.box('interior', 'castleDark', DW, 0.03, DD, 0, G, DZ)
b.box('interior', 'plank', DW - 0.2, 0.012, DD - 0.2, 0, G + 0.03, DZ)
b.box('interior', 'castle', DW, LW, 0.1, 0, G, DZ0 + 0.05)
for sx in (-1, 1):
    b.box('interior', 'castle', 0.1, LW, DD, sx * (DX - 0.05), G, DZ)
    b.box('interior', 'castle', DX - 0.13, LW, 0.1, sx * (0.13 + (DX - 0.13) / 2), G, DZ1 - 0.05)
b.box('interior', 'castle', 0.26, LW - 0.36, 0.1, 0, G + 0.36, DZ1 - 0.05)
for x0, x1, z0, z1 in ((-DX, DX, DZ0, DZ0 + 0.1), (-DX, DX, DZ1 - 0.1, DZ1), (-DX, -DX + 0.1, DZ0, DZ1), (DX - 0.1, DX, DZ0, DZ1)):
    b.box('interior', 'castleDark', x1 - x0 + 0.02, 0.03, z1 - z0 + 0.02, (x0 + x1) / 2, G + LW, (z0 + z1) / 2)
for x in (-0.3, 0.3):
    b.box('interior', 'window', 0.14, 0.22, 0.02, x, G + 0.25, DZ1 + 0.003)
b.box('interior', 'woodDark', 0.22, 0.34, 0.03, 0, G, DZ1 + 0.012)
# ścianka działowa: wielka sala (lewa) i komnata pana (prawa), przejście między nimi
PX = 0.2
b.box('interior', 'plaster', 0.05, LW - 0.06, 0.32, PX, G + 0.03, DZ0 + 0.26)
b.box('interior', 'plaster', 0.05, LW - 0.06, 0.2, PX, G + 0.03, DZ1 - 0.2)
# sala: tron na podeście, chorągwie, kominek, długi stół z ławami, dywan
b.box('interior', 'stoneDark', 0.36, 0.05, 0.2, -0.22, G + 0.03, DZ0 + 0.2)
b.box('interior', 'woodDark', 0.16, 0.1, 0.14, -0.22, G + 0.08, DZ0 + 0.19)
b.box('interior', 'woodDark', 0.16, 0.3, 0.035, -0.22, G + 0.08, DZ0 + 0.12)
b.box('interior', 'flag', 0.12, 0.02, 0.12, -0.22, G + 0.18, DZ0 + 0.19)
for x in (-0.44, 0.0):
    b.box('interior', 'flag', 0.1, 0.24, 0.012, x, G + 0.2, DZ0 + 0.105)
b.box('interior', 'flag', 0.14, 0.008, 0.42, -0.22, G + 0.042, DZ + 0.12)
b.box('interior', 'stoneDark', 0.1, 0.26, 0.22, -DX + 0.14, G + 0.03, DZ + 0.12)
b.box('interior', 'ember', 0.012, 0.08, 0.12, -DX + 0.19, G + 0.04, DZ + 0.12)
b.box('interior', 'wood', 0.12, 0.025, 0.4, -0.04, G + 0.15, DZ + 0.1)
for sz in (-1, 1):
    b.box('interior', 'woodDark', 0.1, 0.12, 0.025, -0.04, G + 0.03, DZ + 0.1 + sz * 0.16)
for sx in (-1, 1):
    b.box('interior', 'woodDark', 0.04, 0.07, 0.36, -0.04 + sx * 0.11, G + 0.03, DZ + 0.1)
for k in range(3):
    b.box('interior', 'bread' if k % 2 else 'apple', 0.04, 0.025, 0.04, -0.04, G + 0.175, DZ - 0.02 + k * 0.12)
# komnata pana: łoże z kapą w barwach pana, skrzynia ze złotem, kręte schody na piętro
b.box('interior', 'woodDark', 0.22, 0.08, 0.34, DX - 0.22, G + 0.03, DZ0 + 0.3)
b.box('interior', 'flag', 0.2, 0.03, 0.26, DX - 0.22, G + 0.11, DZ0 + 0.34)
b.box('interior', 'white', 0.16, 0.03, 0.07, DX - 0.22, G + 0.11, DZ0 + 0.17)
b.box('interior', 'woodDark', 0.22, 0.2, 0.03, DX - 0.22, G + 0.03, DZ0 + 0.12)
b.box('interior', 'woodDark', 0.16, 0.09, 0.1, PX + 0.14, G + 0.03, DZ0 + 0.17)
b.box('interior', 'gold', 0.13, 0.025, 0.07, PX + 0.14, G + 0.12, DZ0 + 0.17)
for k in range(7):
    a = k * 0.85
    b.box('interior', 'stone', 0.14, 0.05, 0.06, DX - 0.2 + math.sin(a) * 0.06, G + 0.03 + k * 0.065, DZ1 - 0.2 + math.cos(a) * 0.06, a)
b.prism('interior', 'stoneDark', 0.025, 0.025, 0.5, DX - 0.2, G + 0.03, DZ1 - 0.2, seg=6)
# schodki przed drzwiami donżonu
b.box('base', 'castleDark', 0.34, 0.03, 0.12, 0, G, DZ1 + 0.06)
b.box('base', 'castleDark', 0.3, 0.015, 0.06, 0, G + 0.03, DZ1 + 0.04)

b.save('keep')
