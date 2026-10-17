"""Kopalnia pod górami (3×3 pola), jak w Gothic: skalny garb u stóp masywu z drewnianym portalem sztolni od frontu.
W środku grota: ściany ze skały z żyłami rudy, stemple i belki, wózek na szynach, latarnie, hałda rudy i kamienia
przed wejściem. Górnicy (do 8) kopią przy ścianach w miejscach z klucza `spots` (x, z, kierunek twarzy).
Grota jest zamknięta własnymi ścianami od środka, więc w spacerze (po zdjęciu garbu) nie widać przez nią świata.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/mine.py
Układ: środek działki = (0, 0), działka ±1.5, przód (wejście) = +z, tył (-z) przylega do gór.
Garb ('shell') znika przy podglądzie wnętrza; 'interior' = grota, 'ceiling' = strop groty (tylko w spacerze w środku).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
flames, solid, open_, spots = [], [], [], []

P = 0.05                                   # posadzka groty
CX0, CX1, CZ0, CZ1 = -1.15, 1.15, -0.5, 0.75   # grota
KX = 0.4                                   # półszerokość korytarza do wyjścia
KZ1 = 1.18                                 # czoło skały (tu kończy się korytarz, dalej przedsionek)
H = 1.38                                   # strop groty przy ścianach
HK = 1.05                                  # strop korytarza i wysokość otworu portalu


def jit(a, bb, k=0.05):
    """Powtarzalne „losowe” przesunięcie (bez modułu random: ten sam model za każdym razem)"""
    return math.sin(a * 12.9898 + bb * 78.233) * k


# ---------------- garb skalny (shell): fasetowane kopce ----------------
def mound(group, cx, cz, rx, rz, h, seg=12, seed=0.0, mat='rock', dark='rockDark'):
    levels = [(1.0, 0.0), (0.96, 0.3), (0.84, 0.62), (0.6, 0.86), (0.3, 0.97)]
    rings = []
    for li, (rk, hk) in enumerate(levels):
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg + li * 0.17
            rr = rk * (1 + jit(k + seed, li, 0.09))
            ring.append((cx + math.sin(a) * rx * rr, h * hk + jit(k, li + seed, 0.04) * h, cz + math.cos(a) * rz * rr))
        rings.append(ring)
    top = (cx + jit(seed, 1, 0.1), h, cz + jit(seed, 2, 0.1))
    away = (cx, h * 0.35, cz)
    for li in range(len(rings) - 1):
        lo, hi = rings[li], rings[li + 1]
        for k in range(seg):
            k2 = (k + 1) % seg
            m = dark if (k + li) % 3 == 0 else mat
            b.poly(group, m, [lo[k], lo[k2], hi[k2], hi[k]], away=away)
    last = rings[-1]
    for k in range(seg):
        b.poly(group, mat, [last[k], last[(k + 1) % seg], top], away=away)


mound('shell', 0.0, -0.45, 1.62, 1.28, 2.35, seg=14, seed=1.0)
mound('shell', -1.12, 0.5, 0.58, 0.8, 1.55, seg=9, seed=2.0)
mound('shell', 1.15, 0.55, 0.56, 0.78, 1.45, seg=9, seed=3.0, mat='rockDark', dark='rock')
mound('shell', -1.3, -1.15, 0.5, 0.5, 1.0, seg=8, seed=4.0)
mound('shell', 1.25, -1.2, 0.55, 0.45, 1.1, seg=8, seed=5.0, mat='rockDark', dark='rock')

# czoło skały z otworem sztolni: pochylona płaszczyzna od (z=1.2, y=0) do (z=0.55, y=1.8)
FY, FX = 1.45, 0.9                                  # wysokość i półszerokość czoła (boki chowają się w kopcach po bokach)
fz = lambda y: 1.2 - 0.52 * (y / FY)
def fpt(x, y):
    return (x, y, fz(y))
AWAY_F = (0, 0.6, -0.5)
OX, OY = KX + 0.05, HK + 0.08                       # otwór trochę większy niż korytarz (rama portalu go obejmuje)
b.poly('shell', 'rock', [fpt(-FX, 0), fpt(-OX, 0), fpt(-OX, FY), fpt(-FX, FY)], away=AWAY_F)
b.poly('shell', 'rock', [fpt(OX, 0), fpt(FX, 0), fpt(FX, FY), fpt(OX, FY)], away=AWAY_F)
b.poly('shell', 'rockDark', [fpt(-OX, OY), fpt(OX, OY), fpt(OX, FY), fpt(-OX, FY)], away=AWAY_F)
# nawis nad czołem: skalny daszek od górnej krawędzi czoła w górę i w tył, aż schowa się w kopcu; boki domknięte
CAP = (0.05, 2.0)                                   # (z, y) tylnej krawędzi nawisu
b.poly('shell', 'rockDark', [fpt(-FX, FY), fpt(FX, FY), (FX, CAP[1], CAP[0]), (-FX, CAP[1], CAP[0])], away=(0, -1, 0.6))
b.poly('shell', 'rock', [fpt(-FX, FY), fpt(FX, FY), (FX * 0.9, CAP[1] + 0.06, CAP[0] + 0.02), (-FX * 0.9, CAP[1] + 0.06, CAP[0] + 0.02)], away=(0, 5, 0.6))
for sx in (-1, 1):
    b.poly('shell', 'rock', [(sx * FX, 0, fz(0)), fpt(sx * FX, FY), (sx * FX, CAP[1], CAP[0]), (sx * FX, 0, CAP[0])], away=(sx * 4, 0.8, 0.6))
# ościeża otworu w skale (żeby przez szczelinę między czołem a korytarzem nie było widać świata)
for sx in (-1, 1):
    b.poly('shell', 'rockDark', [fpt(sx * OX, 0), fpt(sx * OX, OY), (sx * OX, OY, KZ1 - 0.3), (sx * OX, 0, KZ1 - 0.3)], away=(sx * 3, 0.5, 1.0))
b.poly('shell', 'rockDark', [fpt(-OX, OY), fpt(OX, OY), (OX, OY, KZ1 - 0.3), (-OX, OY, KZ1 - 0.3)], away=(0, 4, 1.0))
# rama portalu: dwa grube słupy i oczep z belki, zastrzały
PX, PZ = KX + 0.1, 1.2
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.13, HK + 0.12, 0.14, sx * PX, 0, PZ)
    solid.append([sx * PX - 0.08, sx * PX + 0.08, PZ - 0.08, PZ + 0.08])
b.box('base', 'woodDark', 2 * PX + 0.3, 0.14, 0.17, 0, HK + 0.1, PZ)
b.box('base', 'woodDark', 2 * PX + 0.1, 0.08, 0.12, 0, HK + 0.24, PZ - 0.02)
# tabliczka nad wejściem (deska) i hak z latarnią
b.box('base', 'plank', 0.5, 0.14, 0.03, 0, HK + 0.33, PZ + 0.08)
b.box('base', 'iron', 0.02, 0.1, 0.02, PX + 0.02, HK - 0.02, PZ + 0.12)
b.box('base', 'iron', 0.07, 0.11, 0.07, PX + 0.02, HK - 0.14, PZ + 0.12)
flames.append([round(PX + 0.02, 3), round(HK - 0.12, 3), round(PZ + 0.12, 3)])

# ---------------- grota (interior): posadzka, fasetowane ściany skalne, żyły rudy ----------------
b.box('interior', 'soil', CX1 - CX0 + 0.1, P, CZ1 - CZ0 + 0.1, 0, 0, (CZ0 + CZ1) / 2)
b.box('interior', 'soil', 2 * KX + 0.1, P, KZ1 - CZ1 + 0.3, 0, 0, (CZ1 + KZ1) / 2 + 0.1)
INSIDE = (0, 0.6, 0.1)


def wall(x0, z0, x1, z1, y0, y1, n=4, mat='rockDark', alt='rock', amp=0.06):
    """Ściana groty od (x0,z0) do (x1,z1) w n fasetach z lekkim wgłębieniem (przód do środka groty)"""
    pts = []
    for i in range(n + 1):
        t = i / n
        x, z = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
        # normalna do ściany (w stronę środka): obrót odcinka o 90°
        dx, dz = (x1 - x0), (z1 - z0)
        L = math.hypot(dx, dz)
        nx, nz = -dz / L, dx / L
        j = 0 if i in (0, n) else jit(x * 3 + z, 1.0, amp)
        pts.append((x - nx * j, z - nz * j))
    for i in range(n):
        (ax, az), (bx, bz) = pts[i], pts[i + 1]
        m = alt if i % 2 else mat
        ym = y0 + (y1 - y0) * 0.55 + jit(i, 7.0, 0.08)
        xm0, zm0 = ax + jit(i, 3.0, 0.03), az + jit(i, 4.0, 0.03)
        xm1, zm1 = bx + jit(i + 1, 3.0, 0.03), bz + jit(i + 1, 4.0, 0.03)
        b.poly('interior', m, [(ax, y0, az), (bx, y0, bz), (xm1, ym, zm1), (xm0, ym, zm0)], away=INSIDE)
        b.poly('interior', mat if i % 2 else alt, [(xm0, ym, zm0), (xm1, ym, zm1), (bx, y1, bz), (ax, y1, az)], away=INSIDE)


wall(CX0, CZ1, CX0, CZ0, P, H, n=5)                       # lewa
wall(CX1, CZ0, CX1, CZ1, P, H, n=5)                       # prawa
wall(CX0, CZ0, CX1, CZ0, P, H, n=8)                       # tył
wall(CX1, CZ1, KX, CZ1, P, H, n=3)                        # przód: prawa część
wall(-KX, CZ1, CX0, CZ1, P, H, n=3)                       # przód: lewa część
# nad otworem do korytarza: pas ściany od stropu korytarza do stropu groty
b.poly('interior', 'rockDark', [(-KX, HK, CZ1), (KX, HK, CZ1), (KX, H, CZ1), (-KX, H, CZ1)], away=INSIDE)
# korytarz do wyjścia: ściany i próg skały po bokach otworu
wall(KX, CZ1, KX, KZ1, P, HK, n=2, amp=0.03)
wall(-KX, KZ1, -KX, CZ1, P, HK, n=2, amp=0.03)
# żyły rudy i kamienia w ścianach (wystają 1 cm, żeby nie migotały na licu skały)
for (x, y, z, w, h, m) in [(-1.14, 0.5, 0.15, 0.03, 0.4, 'ore'), (-1.14, 0.9, -0.3, 0.03, 0.25, 'ore'), (1.14, 0.45, -0.2, 0.03, 0.45, 'ore'),
                           (1.14, 0.75, 0.45, 0.03, 0.3, 'crust'), (-0.55, 0.55, -0.49, 0.3, 0.03, 'ore'), (0.5, 0.8, -0.49, 0.35, 0.03, 'crust'),
                           (0.05, 0.4, -0.49, 0.25, 0.03, 'ore')]:
    if abs(x) > 1.0:
        b.box('interior', m, 0.012, h, w if h > w else 0.25, x - 0.006 * (1 if x > 0 else -1), y, z)
    else:
        b.box('interior', m, w if w > h else 0.25, h if h > w else 0.03, 0.012, x, y, z + 0.006)

# ---------------- stemple, belki, sprzęt ----------------
for sx in (-1, 1):
    b.box('interior', 'woodDark', 0.1, H - P - 0.02, 0.1, sx * 0.72, P, 0.12)           # stemple
    solid.append([sx * 0.72 - 0.07, sx * 0.72 + 0.07, 0.05, 0.19])
b.box('interior', 'woodDark', 1.6, 0.1, 0.12, 0, H - 0.12, 0.12)                        # belka stropowa
for sx in (-1, 1):                                                                       # rama korytarza
    b.box('interior', 'woodDark', 0.08, HK - P - 0.02, 0.08, sx * (KX - 0.05), P, 0.98)
    solid.append([sx * (KX - 0.05) - 0.05, sx * (KX - 0.05) + 0.05, 0.93, 1.03])
b.box('interior', 'woodDark', 2 * KX + 0.02, 0.08, 0.1, 0, HK - 0.1, 0.98)
# szyny z podkładami: ze środka groty przez korytarz na przedsionek
for z in [x * 0.3 - 0.3 for x in range(7)]:
    b.box('interior' if z < KZ1 else 'base', 'woodDark', 0.46, 0.025, 0.07, 0, P if z < KZ1 else 0, z)
for sx in (-1, 1):
    b.box('interior', 'iron', 0.025, 0.03, KZ1 - (-0.45), sx * 0.17, P + 0.02, (KZ1 - 0.45) / 2)
    b.box('base', 'iron', 0.025, 0.03, 1.5 - KZ1 + 0.3, sx * 0.17, 0.02, (KZ1 + 1.5) / 2 - 0.15)
# wózek na szynach, na przedsionku przed portalem (nie zastawia przejścia do środka: stoi z boku toru? nie — tor jest w osi,
# więc wózek stoi w grocie pod lewą ścianą, zepchnięty z toru na bocznicę)
WX, WZ = -0.78, -0.22
b.box('interior', 'woodDark', 0.3, 0.22, 0.42, WX, P + 0.09, WZ)
for sx in (-1, 1):
    for sz in (-1, 1):
        b.prism('interior', 'iron', 0.06, 0.06, 0.03, WX + sx * 0.16, P + 0.03, WZ + sz * 0.14, seg=8)
b.box('interior', 'ore', 0.22, 0.08, 0.32, WX, P + 0.3, WZ)
solid.append([WX - 0.17, WX + 0.17, WZ - 0.23, WZ + 0.23])
# latarnie na słupkach w grocie
for (x, z) in ((0.95, 0.5), (-0.4, -0.35)):
    b.box('interior', 'woodDark', 0.05, 0.85, 0.05, x, P, z)
    b.box('interior', 'iron', 0.08, 0.12, 0.08, x, P + 0.85, z)
    flames.append([x, round(P + 0.9, 3), z])
    solid.append([x - 0.04, x + 0.04, z - 0.04, z + 0.04])
# półka z narzędziami przy prawej ścianie, kosze z urobkiem przy wejściu
b.box('interior', 'plank', 0.36, 0.03, 0.14, 0.95, P + 0.5, -0.05)
for k, z in enumerate((-0.12, -0.02, 0.06)):
    b.box('interior', 'woodDark', 0.025, 0.42, 0.025, 1.05 + k * 0.02, P + 0.53, z, tilt=0.25)
for (x, z, m) in ((0.55, 0.62, 'ore'), (0.82, 0.62, 'stone'), (-0.6, 0.62, 'stone')):
    b.prism('interior', 'sack', 0.11, 0.1, 0.12, x, P, z, seg=9)
    b.prism('interior', m, 0.09, 0.03, 0.06, x, P + 0.12, z, seg=7)
    solid.append([x - 0.12, x + 0.12, z - 0.12, z + 0.12])

# ---------------- strop groty i korytarza (ceiling): fasetowany, widać go tylko w spacerze w środku ----------------
def ceiling_patch(x0, x1, z0, z1, y, bulge, nx=3, nz=2):
    for i in range(nx):
        for j in range(nz):
            xa, xb = x0 + (x1 - x0) * i / nx, x0 + (x1 - x0) * (i + 1) / nx
            za, zb = z0 + (z1 - z0) * j / nz, z0 + (z1 - z0) * (j + 1) / nz
            def yy(x, z):
                return y + bulge * (1 - abs((x - (x0 + x1) / 2) / ((x1 - x0) / 2)) ** 2) + jit(x * 5, z * 7, 0.04)
            m = 'rockDark' if (i + j) % 2 else 'rock'
            b.poly('ceiling', m, [(xa, yy(xa, za), za), (xb, yy(xb, za), za), (xb, yy(xb, zb), zb), (xa, yy(xa, zb), zb)], away=(0, -5, 0.1))


ceiling_patch(CX0, CX1, CZ0, CZ1, H, 0.22, nx=4, nz=3)
ceiling_patch(-KX, KX, CZ1, KZ1, HK, 0.05, nx=2, nz=1)

# ---------------- hałda przed wejściem (na przedsionku, po bokach toru) ----------------
for (x, z, r, hh, m) in ((-1.05, 1.25, 0.32, 0.26, 'stone'), (-0.75, 1.38, 0.2, 0.16, 'rockDark'), (1.0, 1.28, 0.3, 0.22, 'ore'), (0.72, 1.4, 0.18, 0.13, 'rockDark')):
    b.prism('base', m, r, r * 0.35, hh, x, 0, z, seg=8, phase=x)
    solid.append([x - r, x + r, z - r, z + r])

# ---------------- chodzenie i miejsca pracy ----------------
open_ += [[CX0 + 0.08, CX1 - 0.08, CZ0 + 0.08, CZ1 - 0.04], [-KX + 0.06, KX - 0.06, CZ1 - 0.1, 1.55]]
# górnicy przy ścianach: (x, z, kierunek twarzy w radianach; 0 = +z, π/2 = +x, π = -z, -π/2 = -x)
HPI = math.pi / 2
spots = [[-1.0, 0.15, -HPI], [1.0, -0.2, HPI], [-0.55, -0.35, math.pi], [0.5, -0.35, math.pi],
         [-1.0, -0.3, -HPI], [1.0, 0.45, HPI], [0.05, -0.35, math.pi], [-0.6, 0.45, -HPI]]
VIEWS = [
    ['kopalnia z przodu', [0.6, 0.9, 3.4], [0, 0.7, 0], ['base', 'shell'], 24],
    ['portal z bliska', [0.3, 0.5, 2.3], [0, 0.6, 1.0], ['base', 'shell'], 20],
    ['grota od wejścia', [0.0, P + 0.42, 1.1], [-0.3, 0.5, -0.4], ['base', 'interior', 'ceiling'], 16],
    ['grota: lewa ściana', [0.6, P + 0.42, -0.1], [-1.1, 0.5, 0.1], ['base', 'interior', 'ceiling'], 16],
]
b.save('mine', maxe=0.24, rays=16, reach=0.35, extra={
    'solid': solid, 'open': open_, 'floorY': P, 'flames': flames, 'spots': spots, 'views': VIEWS})
