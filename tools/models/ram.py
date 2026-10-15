"""Taran (machina oblężnicza): wóz na czterech kołach z daszkiem obitym skórami, pod nim belka z kutą głowicą
zawieszona na łańcuchach. Przód (głowica) = +z. Dwie grupy: 'body' (wóz, koła, daszek) i 'beam' (belka) —
gra przesuwa belkę wzdłuż z przy uderzeniu.

Uruchomienie (z katalogu repo):  python tools/models/ram.py   →  src/render/models/ram.json
Skala jak w grze: 1 = jedno pole, chłop ma ok. 0,5 wzrostu.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from mathutils import Vector  # noqa: E402

b = Building()

W, L = 0.58, 1.05          # szerokość i długość wozu
AX = 0.11                  # wysokość osi kół
WR = 0.11                  # promień koła


def tube(group, mat, path, radii, seg=10):
    rings = []
    for i, p in enumerate(path):
        p = Vector(p)
        d = (Vector(path[min(i + 1, len(path) - 1)]) - Vector(path[max(i - 1, 0)])).normalized()
        up = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
        u = d.cross(up).normalized(); v = d.cross(u).normalized()
        rings.append([p + (u * math.cos(2 * math.pi * k / seg) + v * math.sin(2 * math.pi * k / seg)) * radii[i] for k in range(seg)])
    for i in range(len(rings) - 1):
        c = (Vector(path[i]) + Vector(path[i + 1])) / 2
        for k in range(seg):
            k2 = (k + 1) % seg
            b.poly(group, mat, [tuple(rings[i][k]), tuple(rings[i][k2]), tuple(rings[i + 1][k2]), tuple(rings[i + 1][k])], away=tuple(c))
    a, z = Vector(path[0]), Vector(path[-1])
    b.poly(group, mat, [tuple(p) for p in rings[0]], away=tuple(a + (z - a).normalized()))
    b.poly(group, mat, [tuple(p) for p in rings[-1]], away=tuple(z - (z - a).normalized()))


# ---------------- wóz: dwie podłużnice, poprzeczki, osie i koła ----------------
for sx in (-1, 1):
    b.box('body', 'woodDark', 0.07, 0.07, L, sx * (W / 2 - 0.04), AX + 0.02, 0)
for z in (-L / 2 + 0.06, 0.0, L / 2 - 0.06):
    b.box('body', 'woodDark', W, 0.05, 0.07, 0, AX + 0.04, z)
for z in (-0.32, 0.32):
    tube('body', 'iron', [(-W / 2 - 0.05, AX, z), (W / 2 + 0.05, AX, z)], [0.018, 0.018], seg=8)
    for sx in (-1, 1):
        x = sx * (W / 2 + 0.06)
        tube('body', 'wood', [(x - 0.025, AX, z), (x + 0.025, AX, z)], [WR, WR], seg=14)      # tarcza koła
        tube('body', 'iron', [(x - 0.03, AX, z), (x + 0.03, AX, z)], [0.03, 0.03], seg=8)     # piasta
        for k in range(14):                                                                   # okucie obręczy
            a0, a1 = 2 * math.pi * k / 14, 2 * math.pi * (k + 1) / 14
            pts = [(x + s * 0.028, AX + math.cos(a) * (WR + 0.008), z + math.sin(a) * (WR + 0.008)) for s, a in ((-1, a0), (1, a0), (1, a1), (-1, a1))]
            b.poly('body', 'iron', pts, away=(x, AX, z))

# ---------------- słupy i daszek obity skórami (chroni obsługę przed strzałami) ----------------
H = AX + 0.5
for sx in (-1, 1):
    for z in (-L / 2 + 0.06, L / 2 - 0.06):
        b.box('body', 'woodDark', 0.06, H - AX - 0.04, 0.06, sx * (W / 2 - 0.04), AX + 0.05, z)
    b.box('body', 'woodDark', 0.06, 0.06, L, sx * (W / 2 - 0.04), H - 0.04, 0)
b.gable('body', 'sack', -W / 2, W / 2, -L / 2, L / 2, H, 0.22, along_x=False, over=0.06)
b.gable('body', 'woodDark', -W / 2, W / 2, -L / 2, L / 2, H - 0.02, 0.22, along_x=False, over=0.04)
# łańcuchy, na których wisi belka
for z in (-0.25, 0.25):
    for sx in (-1, 1):
        b.box('body', 'iron', 0.012, 0.18, 0.012, sx * 0.06, H - 0.2, z)

# ---------------- belka: pień z korą i kuta głowica (barani łeb) ----------------
BY = H - 0.22
tube('beam', 'wood', [(0, BY, -L / 2 - 0.05), (0, BY, 0.0), (0, BY, L / 2 + 0.08)], [0.055, 0.06, 0.058], seg=10)
for z in (-0.25, 0.25):
    tube('beam', 'iron', [(0, BY, z - 0.02), (0, BY, z + 0.02)], [0.064, 0.064], seg=10)
tube('beam', 'iron', [(0, BY, L / 2 + 0.06), (0, BY, L / 2 + 0.16), (0, BY, L / 2 + 0.22)], [0.075, 0.07, 0.04], seg=10)

b.save('ram', maxe=0.4, rays=10, reach=0.15, grime=False)
