"""Sad (3×3 pola): łąka ogrodzona płotem z plecionki na palikach, z wejściem od frontu; cztery jabłonie
(krzywy pień z korą, konary, korona z kilku kęp liści, jabłka czerwone i zielone), opadłe jabłka w trawie.
W tylnym rogu skład jabłek: otwarta od frontu szopa z desek pod strzechą, w środku regały ze skrzynkami jabłek,
kosze i beczka; obok ul słomiany, drabina oparta o jabłoń, przy wejściu stos skrzynek z jabłkami.

Do sadu wchodzi się spacerem: cała działka jest do chodzenia (open), przeszkody to pnie, płot, ściany szopy i sprzęty.
Wszystko stoi na tej samej wysokości (FLOOR), więc chodzenie po trawie i wejście do szopy nie skacze.
Dach szopy (grupa 'shell') znika przy podglądzie wnętrza.

Uruchomienie (z katalogu repo):  python tools/models/orchard.py  →  src/render/models/orchard.json
Układ: środek działki = (0, 0), 1 = jedno pole, przód (wejście) = +z. Wejście: pole przed środkiem przodu.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from timber import Timber  # noqa: E402
from mathutils import Vector  # noqa: E402

b = Building()
t = Timber(b, T=0.05)
T = t.T
rnd = random.Random(7)

FLOOR = 0.05                    # wierzch trawy i podłogi szopy
E = 1.44                        # płot (połowa boku)
GATE = 0.34                     # połowa szerokości wejścia

# ---------------- łąka ----------------
b.box('base', 'orchardGrass', 2.96, FLOOR, 2.96, 0, 0, 0)

# ---------------- płot z plecionki na palikach, wejście od frontu ----------------
def fence(x0, z0, x1, z1):
    L = math.hypot(x1 - x0, z1 - z0)
    n = max(1, round(L / 0.48))
    rot = -math.atan2(z1 - z0, x1 - x0)
    for i in range(n + 1):
        f = i / n
        x, z = x0 + (x1 - x0) * f, z0 + (z1 - z0) * f
        b.box('base', 'bark', 0.07, 0.5, 0.07, x, FLOOR, z, rot)
        b.prism('base', 'woodDark', 0.035, 0.0, 0.06, x, FLOOR + 0.5, z, seg=6)
    for i in range(n):   # przęsła plecionki między palikami (krótsze, żeby nie wchodziły w paliki licem)
        f = (i + 0.5) / n
        x, z = x0 + (x1 - x0) * f, z0 + (z1 - z0) * f
        b.box('base', 'wattle', L / n - 0.075, 0.3, 0.035, x, FLOOR + 0.06, z, rot)
        b.box('base', 'woodDark', L / n - 0.075, 0.025, 0.045, x, FLOOR + 0.36, z, rot)   # górny pręt
    w = 0.05
    if abs(z1 - z0) < 1e-6:
        t.block(min(x0, x1) - 0.04, max(x0, x1) + 0.04, z0 - w, z0 + w)
    else:
        t.block(x0 - w, x0 + w, min(z0, z1) - 0.04, max(z0, z1) + 0.04)
fence(-E, -E, E, -E)
fence(-E, -E, -E, E)
fence(E, -E, E, E)
fence(-E, E, -GATE, E)
fence(GATE, E, E, E)
# słupki bramki z daszkiem i otwarta furtka
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.09, 0.72, 0.09, sx * GATE, FLOOR, E)
b.box('base', 'woodDark', 2 * GATE + 0.16, 0.06, 0.1, 0, FLOOR + 0.72, E)
b.slope('base', 'thatch', [(-GATE - 0.14, FLOOR + 0.84, E - 0.12), (GATE + 0.14, FLOOR + 0.84, E - 0.12),
                           (GATE + 0.14, FLOOR + 0.78, E + 0.14), (-GATE - 0.14, FLOOR + 0.78, E + 0.14)], away=(0, 0, E), t=0.04)
b.box('base', 'wood', 0.3, 0.32, 0.03, GATE + 0.17, FLOOR + 0.05, E + 0.14, math.pi / 2 - 0.4)          # furtka otwarta na zewnątrz

# ---------------- jabłonie ----------------
LEAF = ('leaf', 'leafLight')


def blob(x, y, z, r, mat, seg=9):
    """Kępa liści: bryła obrotowa (zamknięta) lekko spłaszczona, z nierównym brzegiem"""
    prof = [(0.0, -0.75), (0.62, -0.62), (0.95, -0.2), (1.0, 0.15), (0.8, 0.55), (0.42, 0.85), (0.0, 0.92)]
    ph = rnd.random() * 6
    for (ra, ya), (rb, yb) in zip(prof, prof[1:]):
        b.prism('base', mat, ra * r, rb * r, (yb - ya) * r * 0.85, x, y + ya * r * 0.85, z, seg=seg, top=rb > 0.001, phase=ph)


def tube(mat, path, radii, seg=8, cap=True):
    """Gałąź / pień: rurka po krzywej, przekrój zwęża się wg radii; zamknięta na końcach (od środka nic nie prześwituje)"""
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
            b.poly('base', mat, [tuple(rings[i][k]), tuple(rings[i][k2]), tuple(rings[i + 1][k2]), tuple(rings[i + 1][k])], away=tuple(c))
    a0, a1 = Vector(path[0]), Vector(path[-1])
    if cap:
        b.poly('base', mat, [tuple(q) for q in rings[0]], away=tuple(a0 + (a1 - a0).normalized()))
    b.poly('base', mat, [tuple(q) for q in rings[-1]], away=tuple(a1 - (a1 - a0).normalized()))


def bough(r, start, d, length, r0, r1, n=4, rise=0.0, droop=0.0, wob=0.25):
    """Konar po łuku: z punktu start w kierunku d (wektor), na końcu podnosi się (rise) albo opada (droop); zwraca punkty osi"""
    d = Vector(d).normalized()
    side = d.cross(Vector((0, 1, 0)))
    if side.length < 1e-4:
        side = Vector((1, 0, 0))
    side.normalize()
    pts, rad = [], []
    for i in range(n + 1):
        f = i / n
        q = Vector(start) + d * length * f
        q.y += (rise - droop) * length * f * f
        q += side * math.sin(f * math.pi) * (r.random() - 0.5) * wob * length * 0.4
        pts.append(tuple(q))
        rad.append(r0 + (r1 - r0) * f)
    tube('bark', pts, rad, seg=7 if r0 > 0.03 else (6 if r0 > 0.012 else 4))
    return pts


def tree(x, z, h=0.62, lean=0.0, seed=0):
    """Jabłoń: krzywy pień rozszerzony u nasady, rozwidlony na 4 konary (korona otwarta jak w starym sadzie),
    z konarów boczne gałęzie i cienkie pędy na końcach — zimą, bez liści, wygląda jak prawdziwe drzewo, a nie kikuty"""
    r = random.Random(seed)
    FORK = FLOOR + 0.5
    # pień: jedna gładka bryła, lekko wygięta w stronę przechyłu, gruba nasada
    path, rad = [], []
    for k in range(7):
        f = k / 6
        path.append((x + lean * 0.05 * math.sin(f * 2.6), FLOOR - 0.02 + (FORK - FLOOR + 0.04) * f, z + lean * 0.02 * math.sin(f * 4.0 + seed)))
        rad.append(0.075 - 0.022 * f + 0.045 * (1 - f) ** 6)
    tube('bark', path, rad, seg=10, cap=False)
    t.block(x - 0.11, x + 0.11, z - 0.11, z + 0.11, 0, 0.9)
    top = path[-1]
    # nabiegi korzeniowe: krótkie, zwężające się, wchodzą w ziemię
    for k in range(5):
        a = k * 2 * math.pi / 5 + r.random() * 0.6
        c, sn = math.cos(a), math.sin(a)
        tube('bark', [(x + sn * 0.04, FLOOR + 0.07, z + c * 0.04), (x + sn * 0.1, FLOOR + 0.02, z + c * 0.1), (x + sn * 0.16, FLOOR - 0.02, z + c * 0.16)],
             [0.035, 0.026, 0.012], seg=5)
    # konary od rozwidlenia (zaczynają się w środku pnia — bez szpar), każdy z gałęziami i pędami
    tips = []
    for k in range(4):
        a = k * math.pi / 2 + r.random() * 0.8
        out = Vector((math.sin(a), 0.95 + r.random() * 0.35, math.cos(a)))
        L = 0.36 + r.random() * 0.08
        st = (top[0], top[1] - 0.07, top[2])
        axis = bough(r, st, out, L, 0.05, 0.016, n=5, rise=0.15, droop=0.12)
        tips.append(axis[-1])
        for j, fpos in enumerate((0.45, 0.72)):
            i0 = round(fpos * (len(axis) - 1))
            sa = a + (0.9 if j % 2 == 0 else -0.9) * (0.7 + r.random() * 0.5)
            bd = Vector((math.sin(sa), 0.8 + r.random() * 0.7, math.cos(sa)))
            sub = bough(r, axis[i0], bd, 0.16 + r.random() * 0.08, 0.02, 0.007, n=3, rise=0.2)
            for m in range(2):   # pędy (wilki) na końcu gałęzi, prosto w górę jak przycinane jabłonie
                ta = sa + (m - 0.5) * 1.6
                bough(r, sub[-1], (math.sin(ta) * 0.35, 1.0, math.cos(ta) * 0.35), 0.08 + r.random() * 0.05, 0.007, 0.0025, n=2, wob=0.6)
        for m in range(3):       # pędy na końcu konaru
            ta = a + (m - 1) * 1.1
            bough(r, axis[-1], (math.sin(ta) * 0.5, 1.0, math.cos(ta) * 0.5), 0.1 + r.random() * 0.06, 0.011, 0.003, n=2, wob=0.6)
    # krótki przewodnik w środku korony
    lead = bough(r, (top[0], top[1] - 0.05, top[2]), (0.1 * lean, 1.0, 0.05), 0.24, 0.035, 0.008, n=3)
    # korona: kępy liści nad końcami konarów i jedna duża w środku (gałęzie chowają się w kępach)
    blobs = [(lead[-1][0], lead[-1][1] + 0.02, lead[-1][2], 0.28)]
    blob(*blobs[0], LEAF[seed % 2])
    for i, (tx, ty, tz) in enumerate(tips):
        rr = 0.19 + r.random() * 0.05
        blobs.append((tx, ty + 0.03, tz, rr))
        blob(tx, ty + 0.03, tz, rr, LEAF[(seed + i) % 2])
    # jabłka wiszą na spodzie i bokach kęp (tuż pod powierzchnią liści, ogonek do góry), nie w powietrzu
    for k in range(14):
        bx, by, bz, br = blobs[1 + k % 4] if k % 3 else blobs[0]
        a = k * 2.39 + seed
        el = -0.15 - (k % 4) * 0.18                     # od boku w dół kępy
        ax = bx + math.sin(a) * math.cos(el) * br * 0.92
        az = bz + math.cos(a) * math.cos(el) * br * 0.92
        ay = by + math.sin(el) * br * 0.85 * 0.9 - 0.035
        b.apple('base', ax, ay - 0.028, az, w=0.062, rot=a)   # jabłko ze skanu na koronie
    return top


TREES = [(0.78, -0.72, 0), (0.85, 0.62, 1), (-0.72, 0.58, 2), (0.02, -0.08, 3)]
tops = [tree(x, z, seed=s, lean=(-1) ** s) for x, z, s in TREES]
# opadłe jabłka w trawie pod koronami
for x, z, s in TREES:
    for k in range(5):
        a = k * 1.7 + s
        ax, az = x + math.sin(a) * (0.22 + 0.06 * k % 3), z + math.cos(a) * (0.2 + 0.05 * (k % 2))
        b.apple('base', ax, FLOOR, az, w=0.056, rot=a * 1.3)

# ---------------- skład jabłek: szopa z desek w lewym tylnym rogu, otwarta od frontu ----------------
SX0, SX1, SZ0, SZ1 = -1.36, -0.42, -1.36, -0.68
SH = FLOOR + 0.8                 # okap z przodu (głowa chłopa mieści się pod belką)
SB = FLOOR + 1.0                 # okap z tyłu (dach jednospadowy ku frontowi)
b.box('floor', 'plank', SX1 - SX0 - 2 * T, 0.006, SZ1 - SZ0 - T, (SX0 + SX1) / 2, FLOOR, (SZ0 + SZ1) / 2 - T / 2)
t.wall_x('base', 'plank', SZ0 + T / 2, SX0, SX1, FLOOR, SB, [])
t.wall_z('base', 'plank', SX0 + T / 2, SZ0 + T, SZ1, FLOOR, SH, [])
t.wall_z('base', 'plank', SX1 - T / 2, SZ0 + T, SZ1, FLOOR, SH, [(-1.2, -1.0, FLOOR + 0.3, FLOOR + 0.48)])
for x, ztop in ((SX0 + T / 2, 1), (SX1 - T / 2, -1)):   # trójkąty ścian bocznych pod pochyłym dachem
    b.poly('base', 'plank', [(x, SH, SZ1), (x, SH, SZ0 + T), (x, SB, SZ0 + T)], away=(x + ztop, SH, (SZ0 + SZ1) / 2))
    b.poly('base', 'plank', [(x, SH, SZ1), (x, SB, SZ0 + T), (x, SH, SZ0 + T)], away=(x - ztop, SH, (SZ0 + SZ1) / 2))
# słupy z przodu i belka pod okapem
for x in (SX0 + 0.04, SX1 - 0.04):
    b.box('base', 'woodDark', 0.07, SH - FLOOR, 0.07, x, FLOOR, SZ1 - 0.04)
b.box('base', 'woodDark', SX1 - SX0 + 0.04, 0.06, 0.08, (SX0 + SX1) / 2, SH - 0.06, SZ1 - 0.035)
# pionowe listwy na deskach tylnej ściany (od zewnątrz, 6 mm nad licem)
for k in range(5):
    x = SX0 + 0.12 + k * (SX1 - SX0 - 0.24) / 4
    b.box('base', 'woodDark', 0.03, SB - FLOOR - 0.06, 0.012, x, FLOOR + 0.03, SZ0 - 0.006)
t.block(SX0, SX1, SZ0, SZ0 + T); t.block(SX0, SX0 + T, SZ0, SZ1); t.block(SX1 - T, SX1, SZ0, SZ1)
t.block(SX0, SX0 + 0.08, SZ1 - 0.08, SZ1); t.block(SX1 - 0.08, SX1, SZ1 - 0.08, SZ1)
# dach jednospadowy ze strzechy (dwie warstwy), okap nad wejściem
OV = 0.14
b.slope('shell', 'thatch', [(SX0 - OV, SB + 0.06, SZ0 - OV), (SX1 + OV, SB + 0.06, SZ0 - OV),
                            (SX1 + OV, SH, SZ1 + OV), (SX0 - OV, SH, SZ1 + OV)], away=((SX0 + SX1) / 2, FLOOR, (SZ0 + SZ1) / 2), t=0.05)
b.box('shell', 'thatchDark', SX1 - SX0 + 2 * OV + 0.02, 0.05, 0.08, (SX0 + SX1) / 2, SB + 0.04, SZ0 - OV + 0.02)

# wnętrze szopy (widać je przez otwarty front): regały ze skrzynkami jabłek, kosze, beczka
def crate(x, y, z, rot=0.0, full=True, s=1.0):
    """Skrzynka z listew (bryła) z jabłkami na wierzchu"""
    w, d, h = 0.22 * s, 0.15 * s, 0.1 * s
    b.box('base', 'wood', w, h, d, x, y, z, rot)
    c, si = math.cos(rot), math.sin(rot)
    for dy in (0.03, 0.07):   # ciemne szpary między listwami (3 mm nad licem)
        for sgn in (-1, 1):
            b.box('base', 'woodDark', w + 0.006, 0.008, 0.004, x + si * sgn * (d / 2 + 0.002), y + dy * s, z + c * sgn * (d / 2 + 0.002), rot)
    if full:
        for i in range(3):
            for j in range(2):
                ax, az = (i - 1) * 0.065 * s, (j - 0.5) * 0.065 * s
                px, pz = x + ax * c + az * si, z - ax * si + az * c
                b.apple('base', px, y + h - 0.012 * s, pz, w=0.058 * s, rot=(i * 3 + j) * 1.1)
# regał pod tylną ścianą: dwie półki, na nich skrzynki
RX0, RX1 = SX0 + T + 0.04, SX1 - T - 0.04
for x in (RX0, RX1):
    b.box('base', 'woodDark', 0.04, 0.62, 0.04, x, FLOOR, SZ0 + T + 0.13)
    b.box('base', 'woodDark', 0.04, 0.62, 0.04, x, FLOOR, SZ0 + T + 0.03)
for y in (FLOOR + 0.18, FLOOR + 0.42):
    b.box('base', 'plank', RX1 - RX0 + 0.04, 0.025, 0.18, (RX0 + RX1) / 2, y, SZ0 + T + 0.08)
    for k in range(3):
        crate(RX0 + 0.14 + k * 0.25, y + 0.026, SZ0 + T + 0.085, 0.0, full=(k + int(y * 10)) % 4 != 0)
t.block(RX0 - 0.03, RX1 + 0.03, SZ0, SZ0 + T + 0.19, 0, FLOOR + 0.66)
# kosze z jabłkami i beczka przy ścianie bocznej
for x, z in ((SX1 - 0.18, SZ1 - 0.14), (SX1 - 0.34, SZ1 - 0.12)):
    b.prism('base', 'basket', 0.07, 0.09, 0.1, x, FLOOR, z, seg=10)
    for k in range(5):
        a = k * 1.26
        b.apple('base', x + math.cos(a) * 0.035, FLOOR + 0.06, z + math.sin(a) * 0.035, w=0.05, rot=a * 2.3)
t.block(SX1 - 0.43, SX1 - 0.1, SZ1 - 0.23, SZ1 - 0.04, 0, FLOOR + 0.14)
b.prism('base', 'wood', 0.08, 0.085, 0.22, SX0 + T + 0.12, FLOOR, SZ1 - 0.15, seg=10)
for y in (0.03, 0.17):
    b.prism('base', 'iron', 0.089, 0.089, 0.014, SX0 + T + 0.12, FLOOR + y, SZ1 - 0.15, seg=10)
t.block(SX0 + T + 0.03, SX0 + T + 0.21, SZ1 - 0.24, SZ1 - 0.06, 0, FLOOR + 0.22)

# ---------------- przy wejściu: stos skrzynek z jabłkami, ul słomiany, drabina przy jabłoni ----------------
crate(0.62, FLOOR, 1.05, 0.2)
crate(0.84, FLOOR, 1.1, -0.15)
crate(0.72, FLOOR + 0.1, 1.07, 0.05)
t.block(0.48, 0.98, 0.95, 1.2, 0, FLOOR + 0.22)
# ul słomiany na pieńku przy szopie
HX, HZ = -0.2, -1.12
b.prism('base', 'bark', 0.09, 0.09, 0.12, HX, FLOOR, HZ, seg=9)
prof = [(0.12, 0.0), (0.13, 0.06), (0.12, 0.12), (0.09, 0.18), (0.05, 0.22), (0.0, 0.24)]
for (ra, ya), (rb, yb) in zip(prof, prof[1:]):
    b.prism('base', 'thatch', ra, rb, yb - ya, HX, FLOOR + 0.12 + ya, HZ, seg=12, top=rb > 0.001)
for k in range(3):
    b.prism('base', 'rope', 0.123 + 0.005 - k * 0.012, 0.123 + 0.005 - k * 0.012, 0.01, HX, FLOOR + 0.15 + k * 0.045, HZ, seg=12)
b.box('base', 'dark', 0.05, 0.025, 0.012, HX, FLOOR + 0.125, HZ + 0.128)
t.block(HX - 0.14, HX + 0.14, HZ - 0.14, HZ + 0.14, 0, FLOOR + 0.38)
# drabina oparta o konar jabłoni z przodu po prawej
LX, LZ = 0.85 - 0.06, 0.62 + 0.36
for sx in (-1, 1):
    b.box('base', 'wood', 0.025, 0.9, 0.025, LX + sx * 0.09, FLOOR, LZ, tilt=-0.38, bottom=True)
for k in range(5):
    yy = 0.12 + k * 0.16
    b.box('base', 'wood', 0.2, 0.02, 0.02, LX, FLOOR + yy * math.cos(0.38), LZ - yy * math.sin(0.38))
t.block(LX - 0.12, LX + 0.12, LZ - 0.12, LZ + 0.04, 0, 0.6)

# ---------------- spacer: cała działka do chodzenia ----------------
t.open.append([-1.5, 1.5, -1.5, 1.5])

OUT = ['base', 'shell']
VIEWS = [
    ['sad od wejścia', [0.3, 0.9, 3.4], [0, 0.4, 0], OUT, 26],
    ['skład jabłek', [-0.4, 0.6, 0.6], [-0.9, 0.35, -1.0], OUT, 20],
    ['pod jabłonią (oczy chłopa)', [0.4, FLOOR + 0.46, 0.4], [0.02, 0.8, -0.08], OUT + ['floor'], 18],
]
b.save('orchard', maxe=0.3, rays=16, reach=0.4, extra={
    'solid': t.solid, 'open': t.open, 'floorY': FLOOR, 'windows': [], 'chimneys': [], 'flames': [], 'views': VIEWS})
