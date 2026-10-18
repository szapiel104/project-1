"""Kamienna brama w murze (1 pole): dwie kwadratowe baszty z ciosów po bokach przejazdu, łukowy przejazd przez całą
grubość muru z obramieniem z ciemniejszych klińców, nad nim korona na wysokości muru kamiennego (chodnik łączy się
z chodnikiem muru) z przedpiersiem i blankami od zewnątrz i od środka, baszty wyższe z własnymi blankami,
w przejeździe dwuskrzydłowe okute wrota (do wysokości wezgłowia łuku), nad nimi stała drewniana płycina
w łuku, pochodnie po bokach od zewnątrz, chorągiew na lewej baszcie.

Skrzydła wrót w grupach 'leafL' i 'leafR' (zapisane zamknięte); gra obraca je wokół zawiasów (HINGE).

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/stonegate.py
Układ: środek pola = (0, 0), mur biegnie wzdłuż x, przód (na zewnątrz) = +z, mur ma grubość całego pola (z = ±0,5).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()

WALL_TOP = 1.14      # wierzch muru kamiennego (STONE_WALL_TOP w grze)
D = 0.5              # połowa grubości muru
TX = 0.5             # oś baszt (na granicy pola, jak w drewnianej bramie)
TS = 0.22            # połowa boku baszty
TD = 0.6             # połowa głębokości baszty (wystaje przed lico muru)
T_TOP = 1.9          # wierzch baszty (płyta)
OW = TX - TS         # połowa szerokości przejazdu (0,28)
SPRING = 0.62        # wezgłowie łuku
HINGE = OW - 0.01    # zawiasy wrót
SEG = 10             # odcinki łuku

# ---------------- baszty ----------------
for sx in (-1, 1):
    cx = sx * TX
    b.box('base', 'castleDark', 2 * TS + 0.08, 0.16, 2 * TD + 0.08, cx, 0, 0, bottom=False)          # cokół
    b.box('base', 'castle', 2 * TS, T_TOP - 0.16, 2 * TD, cx, 0.16, 0, top=False)                       # trzon
    b.box('base', 'castleDark', 2 * TS + 0.06, 0.06, 2 * TD + 0.06, cx, 0.98, 0)                       # gzyms
    b.box('base', 'castleDark', 2 * TS + 0.04, 0.05, 2 * TD + 0.04, cx, T_TOP, 0)                      # płyta na wierzchu
    # przedpiersie z blankami na koronie baszty (od zewnątrz i od środka oraz od boku z dala od przejazdu)
    for sz in (-1, 1):
        b.box('base', 'castle', 2 * TS + 0.04, 0.12, 0.08, cx, T_TOP + 0.05, sz * (TD - 0.02))
        b.merlons_line('base', 'castle', cx - TS + 0.06, sz * (TD - 0.02), cx + TS - 0.06, sz * (TD - 0.02), T_TOP + 0.17, step=0.15, w=0.1, h=0.14, t=0.08)
    ox = cx + sx * (TS - 0.02)
    b.box('base', 'castle', 0.08, 0.12, 2 * TD - 0.12, ox, T_TOP + 0.05, 0)
    b.merlons_line('base', 'castle', ox, -TD + 0.1, ox, TD - 0.1, T_TOP + 0.17, step=0.24, w=0.1, h=0.14, t=0.08)
    # narożne ciosy (jaśniejsze, na przemian długie i krótkie), wystają odrobinę z lica
    for ex in (-1, 1):
        for ez in (-1, 1):
            for k in range(6):
                y = 0.2 + k * 0.28
                if 0.94 < y + 0.2 and y < 1.06:
                    continue  # gzyms
                long = k % 2 == 0
                w, d = (0.16, 0.1) if long else (0.1, 0.16)
                b.box('base', 'stoneDark', w, 0.2, d, cx + ex * (TS - w / 2 + 0.012), y, ez * (TD - d / 2 + 0.012))
    # strzelnice na czołach baszt (od zewnątrz i od środka)
    for sz in (-1, 1):
        z = sz * TD
        b.box('base', 'castleDark', 0.11, 0.32, 0.03, cx, 1.25, z + sz * 0.012)
        b.box('base', 'dark', 0.04, 0.24, 0.03, cx, 1.29, z + sz * 0.022)

# ---------------- przejazd: korona nad łukiem ----------------
b.box('base', 'castle', 2 * OW + 0.02, WALL_TOP - (SPRING + OW), 2 * D, 0, SPRING + OW, 0, top=False)   # mur nad łukiem
b.box('base', 'castleDark', 2 * OW + 0.02, 0.02, 2 * D, 0, WALL_TOP - 0.02, 0)                          # chodnik
# przedpiersie i blanki od zewnątrz i od środka (jak na murze kamiennym: 0,14 + blanki)
for sz in (-1, 1):
    z = sz * (D - 0.055)
    b.box('base', 'castle', 2 * OW + 0.02, 0.14, 0.11, 0, WALL_TOP, z)
    b.box('base', 'castleDark', 2 * OW + 0.04, 0.025, 0.13, 0, WALL_TOP + 0.14, z)
    for x in (-0.14, 0.14):
        b.box('base', 'castle', 0.15, 0.19, 0.11, x, WALL_TOP + 0.165, z)
        b.box('base', 'castleDark', 0.17, 0.025, 0.13, x, WALL_TOP + 0.355, z)

# ---------------- łuk: wypełnienie nad półkolem, podniebienie łuku, klińce ----------------
arc = [(OW * math.cos(math.pi * i / SEG), SPRING + OW * math.sin(math.pi * i / SEG)) for i in range(SEG + 1)]
TOPY = SPRING + OW
for i in range(SEG):
    (x0, y0), (x1, y1) = arc[i], arc[i + 1]
    for sz in (-1, 1):
        z = sz * D
        # trójkąty-wypełnienia między łukiem a poziomem wezgłowia korony (lico zewnętrzne i wewnętrzne)
        b.poly('base', 'castle', [(x0, y0, z), (x1, y1, z), (x1, TOPY, z), (x0, TOPY, z)], away=(0, (y0 + TOPY) / 2, -sz))
    # podniebienie łuku (od spodu, przez całą grubość muru)
    am = math.pi * (i + 0.5) / SEG
    b.poly('base', 'castleDark', [(x0, y0, D), (x1, y1, D), (x1, y1, -D), (x0, y0, -D)], away=(3 * OW * math.cos(am), SPRING + 3 * OW * math.sin(am), 0))
# boczne ściany przejazdu (lica baszt od środka) są ścianami baszt; podłoga przejazdu z płyt
b.box('base', 'stoneDark', 2 * OW, 0.02, 2 * D, 0, 0, 0)
# klińce wokół łuku na obu licach (wystają 1,2 cm)
for sz in (-1, 1):
    for i in range(SEG + 1):
        a = math.pi * i / SEG
        r = OW + 0.005
        x, y = r * math.cos(a), SPRING + r * math.sin(a)
        b.box('base', 'stoneDark' if i % 2 else 'castleDark', 0.075, 0.1, 0.03, x, y, sz * (D + 0.012), roll=a - math.pi / 2)
    b.box('base', 'castleDark', 0.11, 0.1, 0.03, 0, TOPY - 0.01, sz * (D + 0.014))           # zwornik

# ---------------- drewniana płycina w łuku nad wrotami (stała) ----------------
for i in range(SEG):
    (x0, y0), (x1, y1) = arc[i], arc[i + 1]
    for zz, s in ((0.02, 1), (-0.02, -1)):
        b.poly('base', 'plank', [(x0 * 0.97, SPRING, zz), (x1 * 0.97, SPRING, zz), (x1 * 0.97, SPRING + (y1 - SPRING) * 0.97, zz), (x0 * 0.97, SPRING + (y0 - SPRING) * 0.97, zz)], away=(0, SPRING + 0.1, -s))
b.box('base', 'woodDark', 2 * OW, 0.05, 0.06, 0, SPRING - 0.02, 0)   # belka nad wrotami

# ---------------- pochodnie w uchwytach na basztach od zewnątrz ----------------
flames = []
for sx in (-1, 1):
    x, y, z = sx * (TX - TS + 0.07), 0.78, TD + 0.01
    b.box('base', 'iron', 0.03, 0.03, 0.1, x, y, z + 0.03)
    b.prism('base', 'woodDark', 0.02, 0.026, 0.22, x, y - 0.05, z + 0.08, seg=6)
    b.prism('base', 'rope', 0.03, 0.03, 0.04, x, y + 0.15, z + 0.08, seg=6)
    flames.append([round(x, 3), round(y + 0.19, 3), round(z + 0.08, 3)])

# ---------------- chorągiew na lewej baszcie ----------------
PX, PZ = -TX, -TD + 0.12
b.box('base', 'woodDark', 0.04, 0.8, 0.04, PX, T_TOP + 0.05, PZ)
b.prism('base', 'gold', 0.03, 0.0, 0.06, PX, T_TOP + 0.85, PZ, seg=6)
# chorągiew z herbem rysuje gra (src/render/banners.ts): brzeg przy drzewcu, środek wysokości
BANNERS = [[round(PX + 0.022, 3), round(T_TOP + 0.68, 3), round(PZ, 3), 0, 0.28, 0.2, 0, 'base']]


# ---------------- skrzydła wrót (zamknięte; gra obraca je wokół zawiasów) ----------------
def leaf(group, side):
    hx = side * HINGE
    W = HINGE - 0.006
    H = SPRING - 0.05
    n = 4
    for i in range(n):
        x0 = hx - side * (W * i / n)
        x1 = hx - side * (W * (i + 1) / n - 0.005)
        b.box(group, 'plank', abs(x1 - x0), H, 0.05, (x0 + x1) / 2, 0.03, 0.0)
    mid = hx - side * W / 2
    for y in (0.14, 0.44):   # rygle od środka
        b.box(group, 'woodDark', W - 0.02, 0.07, 0.035, mid, y, -0.042)
    for y in (0.12, 0.47):   # okucia od zewnątrz
        b.box(group, 'iron', W - 0.02, 0.045, 0.012, hx - side * (W - 0.02) / 2, y, 0.03)
        for k in range(4):
            b.box(group, 'iron', 0.016, 0.016, 0.01, hx - side * (0.04 + k * (W - 0.08) / 3), y + 0.014, 0.04)
    b.prism(group, 'iron', 0.03, 0.03, 0.012, hx - side * (W - 0.06), 0.31, 0.035, seg=8, top=False)


leaf('leafL', -1)
leaf('leafR', 1)

VIEWS = [
    ['brama z zewnątrz (oczy chłopa)', [0.25, 0.5, 2.2], [0, 0.9, 0], ['base', 'leafL', 'leafR'], 22],
    ['brama od środka', [-0.4, 0.5, -2.1], [0, 0.9, 0], ['base', 'leafL', 'leafR'], 22],
    ['przejazd (wrota otwarte)', [0.0, 0.35, 1.2], [0, 0.7, -0.4], ['base'], 18],
]
b.save('stonegate', maxe=0.2, rays=16, reach=0.3, extra={'hinge': HINGE, 'flames': flames, 'views': VIEWS, 'banners': BANNERS})
