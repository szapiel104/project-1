"""Wnętrze kopalni jako osobna lokacja (jak Stara Kopalnia w Gothic): do niej przenosi spacer po wejściu w portal kopalni.
Układ (jednostka = pole mapy, podłoga y = 0, wejście od +z):
  R1 korytarz wejściowy z obudową z belek i torami  (x -0.7..0.7,  z 2.0..7.0), wyjście na końcu (+z)
  R2 hala z wózkami, hałdami i rusztowaniem        (x -4.5..4.5,  z -3.5..2.0)
  R3 lewy chodnik z przodkiem (żyły rudy)          (x -9.0..-4.5, z -1.8..-0.4)
  R4 prawy chodnik z przodkiem                      (x 4.5..9.0,   z 0.0..1.4)
Ściany, strop i posadzka są zwrócone przodem DO ŚRODKA (oglądamy je tylko od wewnątrz). Górnicy kopią w miejscach `spots`,
latarnie (`lamps`) płoną zawsze, `rooms` to prostokąty, po których się chodzi, `solid` — przeszkody, `exit` — strefa wyjścia.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/minelevel.py
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
lamps, solid, spots = [], [], []
G = 'base'

ROOMS = {
    'R1': (-0.7, 0.7, 2.0, 7.0, 1.55),
    'R2': (-4.5, 4.5, -3.5, 2.0, 2.6),
    'R3': (-9.0, -4.5, -1.8, -0.4, 1.6),
    'R4': (4.5, 9.0, 0.0, 1.4, 1.6),
}
# przejścia między salami: (sala, bok, od, do) — w tych odcinkach ściany nie ma
GAPS = {
    ('R2', 'z1'): [(-0.7, 0.7)], ('R1', 'z0'): [(-0.7, 0.7)],
    ('R2', 'x0'): [(-1.8, -0.4)], ('R3', 'x1'): [(-1.8, -0.4)],
    ('R2', 'x1'): [(0.0, 1.4)], ('R4', 'x0'): [(0.0, 1.4)],
}


def jit(a, c, k):
    return math.sin(a * 12.9898 + c * 78.233) * k


def face_wall(x0, z0, x1, z1, h, out, step=0.45, amp=0.07, seed=0.0):
    """Ściana skały od (x0,z0) do (x1,z1), wysoka na h; `out` = punkt za ścianą (przód ściany patrzy w przeciwną stronę)"""
    L = math.hypot(x1 - x0, z1 - z0)
    n = max(1, int(L / step))
    rows = [0.0, 0.35, 0.7, 1.0]
    for i in range(n):
        for r in range(len(rows) - 1):
            pts = []
            for (ti, rr) in ((i, r), (i + 1, r), (i + 1, r + 1), (i, r + 1)):
                t = ti / n
                x, z = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
                edge = ti in (0, n) or rr in (0, len(rows) - 1)
                j = 0 if edge else jit(x + seed, z + rr, amp)
                # wgłębienie/wybrzuszenie wzdłuż normalnej ściany (w stronę `out` albo od niej)
                dx, dz = out[0] - x, out[1] - z
                d = math.hypot(dx, dz) or 1
                pts.append((x + dx / d * j, h * rows[rr] + (0 if edge else jit(z, x + rr, 0.05)), z + dz / d * j))
            m = 'rockDark' if (i + r) % 3 else 'rock'
            b.poly(G, m, pts, away=(out[0], h * 0.5, out[1]))


def room_walls(name):
    x0, x1, z0, z1, h = ROOMS[name]
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    sides = {
        'z0': ((x0, z0), (x1, z0), (cx, z0 - 5)),
        'z1': ((x1, z1), (x0, z1), (cx, z1 + 5)),
        'x0': ((x0, z1), (x0, z0), (x0 - 5, cz)),
        'x1': ((x1, z0), (x1, z1), (x1 + 5, cz)),
    }
    for key, ((ax, az), (bx, bz), out) in sides.items():
        gaps = sorted(GAPS.get((name, key), []))
        horiz = key in ('z0', 'z1')
        a, bnd = (ax, bx) if horiz else (az, bz)
        lo, hi = min(a, bnd), max(a, bnd)
        segs, cur = [], lo
        for g0, g1 in gaps:
            if g0 > cur:
                segs.append((cur, g0))
            cur = max(cur, g1)
        if cur < hi:
            segs.append((cur, hi))
        for s0, s1 in segs:
            if horiz:
                face_wall(s0, az, s1, az, h, out, seed=len(name) + s0)
            else:
                face_wall(ax, s0, ax, s1, h, out, seed=len(name) + s0)
        # nad przejściem (sala wyższa niż sąsiednia): pas skały od stropu przejścia do stropu sali
        for g0, g1 in gaps:
            top = 1.55
            if h > top + 0.05:
                if horiz:
                    b.poly(G, 'rockDark', [(g0, top, az), (g1, top, az), (g1, h, az), (g0, h, az)], away=(out[0], h, out[1]))
                else:
                    b.poly(G, 'rockDark', [(ax, top, g0), (ax, top, g1), (ax, h, g1), (ax, h, g0)], away=(out[0], h, out[1]))
    # posadzka (ubita ziemia) i strop (fasetowany, przodem w dół)
    b.box(G, 'soil', x1 - x0, 0.02, z1 - z0, cx, -0.02, cz, top=True, bottom=False)
    nx, nz = max(1, int((x1 - x0) / 0.9)), max(1, int((z1 - z0) / 0.9))
    for i in range(nx):
        for j in range(nz):
            xa, xb = x0 + (x1 - x0) * i / nx, x0 + (x1 - x0) * (i + 1) / nx
            za, zb = z0 + (z1 - z0) * j / nz, z0 + (z1 - z0) * (j + 1) / nz
            def yy(x, z):
                inner = 0 < (x - x0) < (x1 - x0) and 0 < (z - z0) < (z1 - z0)
                return h + (0.18 + jit(x * 3, z * 5, 0.12) if inner else 0)
            b.poly(G, 'rockDark' if (i + j) % 2 else 'rock', [(xa, yy(xa, za), za), (xb, yy(xb, za), za), (xb, yy(xb, zb), zb), (xa, yy(xa, zb), zb)], away=(cx, h + 5, cz))


for name in ROOMS:
    room_walls(name)
# strop nad przejściami (krótkie belki skały, żeby nie było dziury między salami)
for (x0, x1, z0, z1) in ((-0.7, 0.7, 1.9, 2.1), (-4.6, -4.4, -1.8, -0.4), (4.4, 4.6, 0.0, 1.4)):
    b.poly(G, 'rockDark', [(x0, 1.55, z0), (x1, 1.55, z0), (x1, 1.55, z1), (x0, 1.55, z1)], away=((x0 + x1) / 2, 6, (z0 + z1) / 2))

# ---------------- korytarz wejściowy: obudowa z belek co 0.8, tory, drzwi wyjścia ----------------
for z in [2.4 + 0.8 * k for k in range(6)]:
    for sx in (-1, 1):
        b.box(G, 'woodDark', 0.12, 1.45, 0.12, sx * 0.55, 0, z)
        solid.append([sx * 0.55 - 0.08, sx * 0.55 + 0.08, z - 0.08, z + 0.08])
    b.box(G, 'woodDark', 1.3, 0.12, 0.14, 0, 1.4, z)
for z in [2.1 + 0.32 * k for k in range(16)]:
    b.box(G, 'woodDark', 0.62, 0.03, 0.08, 0, 0, z)
for sx in (-1, 1):
    b.box(G, 'iron', 0.03, 0.035, 5.0, sx * 0.2, 0.03, 4.6)
    b.box(G, 'iron', 0.03, 0.035, 4.2, sx * 0.2 + (-0.6 if sx < 0 else -0.6), 0.03, -0.3, rot=0.0) if False else None
# tory dalej przez halę aż do lewego chodnika
for z in [-0.9 + 0.32 * k for k in range(9)]:
    b.box(G, 'woodDark', 0.62, 0.03, 0.08, 0, 0, z)
for sx in (-1, 1):
    b.box(G, 'iron', 0.03, 0.035, 3.0, sx * 0.2, 0.03, 0.55)
# wrota wyjścia na końcu korytarza: deski z jasną szczeliną (światło dnia z zewnątrz)
b.box(G, 'plank', 1.3, 1.4, 0.06, 0, 0, 6.95)
b.box(G, 'white', 0.9, 0.05, 0.01, 0, 1.1, 6.915)
b.box(G, 'white', 0.04, 1.0, 0.01, 0.0, 0.1, 6.915)
lamps.append([0.42, 1.15, 6.6])
lamps.append([-0.42, 1.15, 3.6])

# ---------------- hala: filar skalny, wózki, hałdy, rusztowanie pod tylną ścianą ----------------
def boulder(x, z, r, h, seed):
    seg = 9
    ring0 = [(x + math.sin(2 * math.pi * k / seg) * r * (1 + jit(k, seed, 0.15)), 0, z + math.cos(2 * math.pi * k / seg) * r * (1 + jit(seed, k, 0.15))) for k in range(seg)]
    ring1 = [(x + (p[0] - x) * 0.7, h * 0.65, z + (p[2] - z) * 0.7) for p in ring0]
    top = (x, h, z)
    for k in range(seg):
        k2 = (k + 1) % seg
        b.poly(G, 'rock' if k % 2 else 'rockDark', [ring0[k], ring0[k2], ring1[k2], ring1[k]], away=(x, h * 0.3, z))
        b.poly(G, 'rockDark', [ring1[k], ring1[k2], top], away=(x, h * 0.3, z))
    solid.append([x - r, x + r, z - r, z + r])


# filar od posadzki do stropu (kopacze zostawili go, żeby strop nie runął)
boulder(2.2, -1.2, 0.7, 2.7, 1.0)
# hałdy urobku i rudy
for (x, z, r, h, m) in ((-3.4, 1.2, 0.5, 0.45, 'stone'), (-3.8, 0.4, 0.35, 0.3, 'ore'), (3.6, -2.6, 0.55, 0.5, 'stone'), (3.0, 1.5, 0.35, 0.28, 'ore')):
    b.prism(G, m, r, r * 0.3, h, x, 0, z, seg=9, phase=x)
    solid.append([x - r, x + r, z - r, z + r])
# wózki na torach i obok
for (x, z, a) in ((0.0, 0.2, 0.0), (-2.4, -2.4, 0.4)):
    b.box(G, 'woodDark', 0.42, 0.3, 0.6, x, 0.1, z, rot=a)
    for sx in (-1, 1):
        for sz in (-1, 1):
            c, s = math.cos(a), math.sin(a)
            wx, wz = sx * 0.22, sz * 0.2
            b.prism(G, 'iron', 0.08, 0.08, 0.04, x + wx * c + wz * s, 0.04, z - wx * s + wz * c, seg=8)
    b.box(G, 'ore', 0.32, 0.1, 0.46, x, 0.4, z, rot=a)
    solid.append([x - 0.36, x + 0.36, z - 0.36, z + 0.36])
# rusztowanie z belek pod tylną ścianą (pomost dla kopiących wyżej)
for x in (-3.0, -1.6, -0.2, 1.2):
    b.box(G, 'woodDark', 0.1, 1.3, 0.1, x, 0, -3.0)
    b.box(G, 'woodDark', 0.1, 1.3, 0.1, x, 0, -3.4)
b.box(G, 'plank', 4.5, 0.05, 0.6, -0.9, 1.3, -3.2)
b.box(G, 'woodDark', 4.5, 0.08, 0.08, -0.9, 0.6, -3.0)
solid.append([-3.1, 1.3, -3.5, -2.92])
# skrzynia z narzędziami, beczka, kilofy oparte o ścianę
b.box(G, 'wood', 0.5, 0.35, 0.35, -4.0, 0, -2.8)
b.prism(G, 'woodDark', 0.2, 0.2, 0.42, -3.5, 0, -3.1, seg=10)
solid.append([-4.3, -3.25, -3.4, -2.55])
for k in range(3):
    b.box(G, 'woodDark', 0.03, 0.5, 0.03, 4.3, 0, -1.6 + k * 0.15, roll=0.18)
    b.box(G, 'iron', 0.03, 0.03, 0.2, 4.25, 0.48, -1.6 + k * 0.15)
# latarnie na słupkach i na stemplach
for (x, z) in ((-2.8, 0.9), (1.0, 1.4), (3.6, -0.6), (-1.2, -2.6), (0.0, -1.6)):
    b.box(G, 'woodDark', 0.07, 1.1, 0.07, x, 0, z)
    b.box(G, 'iron', 0.1, 0.14, 0.1, x, 1.1, z)
    lamps.append([x, 1.2, z])
    solid.append([x - 0.06, x + 0.06, z - 0.06, z + 0.06])

# ---------------- chodniki z przodkami: obudowa, żyły rudy na czołach ----------------
for x in (-5.4, -6.6, -7.8):
    for z in (-1.7, -0.5):
        b.box(G, 'woodDark', 0.1, 1.5, 0.1, x, 0, z)
    b.box(G, 'woodDark', 0.1, 0.1, 1.4, x, 1.45, -1.1)
for x in (5.4, 6.6, 7.8):
    for z in (0.1, 1.3):
        b.box(G, 'woodDark', 0.1, 1.5, 0.1, x, 0, z)
    b.box(G, 'woodDark', 0.1, 0.1, 1.4, x, 1.45, 0.7)
lamps.append([-6.0, 1.2, -1.65])
lamps.append([6.0, 1.2, 1.25])
# żyły rudy (połyskujące, wystają 1 cm) na czołach chodników i na ścianach hali
for (x, y, z, w, h, d) in ((-8.985, 0.6, -1.1, 0.012, 0.5, 0.7), (-8.985, 1.05, -0.8, 0.012, 0.25, 0.4), (8.985, 0.5, 0.7, 0.012, 0.55, 0.8),
                           (8.985, 1.0, 0.5, 0.012, 0.3, 0.4), (-2.0, 0.8, -3.49, 0.8, 0.3, 0.012), (1.0, 1.2, -3.49, 0.6, 0.25, 0.012),
                           (-4.49, 0.7, 1.2, 0.012, 0.35, 0.6), (4.49, 1.1, -2.4, 0.012, 0.3, 0.7)):
    b.box(G, 'crust', w, h, d, x, y, z)

# ---------------- miejsca pracy górników (x, z, kierunek twarzy: 0 = +z, π/2 = +x) ----------------
HPI = math.pi / 2
spots = [[-8.55, -1.2, -HPI], [-8.55, -0.75, -HPI], [8.55, 0.45, HPI], [8.55, 0.95, HPI],
         [-2.0, -2.75, math.pi], [1.0, -2.75, math.pi], [-4.05, 1.2, -HPI], [4.05, -2.4, HPI]]

rooms = [[x0, x1, z0, z1] for (x0, x1, z0, z1, _h) in ROOMS.values()]
VIEWS = [
    ['korytarz od wyjścia', [0.0, 0.46, 6.5], [0.0, 0.5, 2.0], ['base'], 18],
    ['hala od wejścia', [0.0, 0.46, 1.8], [0.0, 0.8, -3.0], ['base'], 18],
    ['lewy chodnik', [-4.0, 0.46, -1.1], [-9.0, 0.7, -1.1], ['base'], 18],
    ['prawy chodnik', [4.0, 0.46, 0.7], [9.0, 0.7, 0.7], ['base'], 18],
]
b.save('minelevel', maxe=0.3, rays=12, reach=0.6, extra={
    'rooms': rooms, 'solid': solid, 'lamps': lamps, 'spots': spots, 'entry': [0.0, 6.4, math.pi], 'exit': [-0.7, 0.7, 6.65, 7.0], 'views': VIEWS})
