"""Chata rybaka (2×2 pola): mała chata z pionowych desek na krótkich palach (nad mokrym brzegiem), z gankiem
i schodkami, strzechą i okienkiem. Obok: suszarnia z rybami na żerdzi, sieci rozpięte na tyczkach do suszenia,
łódka wyciągnięta na brzeg z wiosłami, beczka do solenia ryb, kosz z rybami, kotwica-kamień na linie.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/fisher.py
Układ: środek działki = (0, 0), działka ±1, przód (drzwi) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
solid = []

F = 0.2                                   # podłoga chaty (na palach)
X0, X1, Z0, Z1 = -0.85, 0.15, -0.85, 0.05
H1 = F + 0.62
RISE = 0.5
DOOR = (-0.45, -0.17, 0.52)

# ---------------- pale i podłoga ----------------
for x in (X0 + 0.04, (X0 + X1) / 2, X1 - 0.04):
    for z in (Z0 + 0.04, Z1 - 0.04, Z1 + 0.3):
        b.prism('base', 'bark', 0.04, 0.035, F, x, 0.0, z, seg=6)
for z in (Z0 + 0.04, Z1 - 0.04, Z1 + 0.3):
    b.box('base', 'woodDark', X1 - X0, 0.04, 0.06, (X0 + X1) / 2, F - 0.045, z)
b.box('base', 'plank', X1 - X0 + 0.02, 0.025, Z1 - Z0, (X0 + X1) / 2, F - 0.005, (Z0 + Z1) / 2)
# ganek przed drzwiami i schodki
GZ1 = Z1 + 0.34
for k in range(7):
    x = X0 + 0.07 + k * (X1 - X0 - 0.14) / 6
    b.box('base', 'plank', (X1 - X0) / 7 - 0.012, 0.022, GZ1 - Z1, x, F - 0.005, (Z1 + GZ1) / 2)
for k in range(2):
    b.box('base', 'plank', 0.32, 0.025, 0.1, (DOOR[0] + DOOR[1]) / 2, F * (1 - (k + 1) / 3) - 0.0, GZ1 + 0.06 + k * 0.1)
    b.box('base', 'woodDark', 0.03, F * (1 - (k + 1) / 3), 0.03, (DOOR[0] + DOOR[1]) / 2 - 0.15, 0.0, GZ1 + 0.06 + k * 0.1)
    b.box('base', 'woodDark', 0.03, F * (1 - (k + 1) / 3), 0.03, (DOOR[0] + DOOR[1]) / 2 + 0.15, 0.0, GZ1 + 0.06 + k * 0.1)
# poręcz ganku po prawej
for z in (Z1 + 0.05, GZ1 - 0.03):
    b.box('base', 'woodDark', 0.03, 0.32, 0.03, X1 - 0.03, F + 0.02, z)
b.box('base', 'woodDark', 0.03, 0.03, GZ1 - Z1, X1 - 0.03, F + 0.32, (Z1 + GZ1) / 2)


# ---------------- ściany z pionowych desek (z grubością), drzwi, okienko ----------------
def boards_x(z, x0, x1, holes, out):
    n = max(2, int((x1 - x0) / 0.1))
    wd = (x1 - x0) / n
    for k in range(n):
        xa = x0 + k * wd
        xm = xa + wd / 2
        hole = [h for h in holes if h[0] <= xm <= h[1]]
        zz = z + out * (0.004 if k % 2 else 0.0)
        if hole:
            u0, u1, v0, v1 = hole[0]
            if v0 > F: b.box('base', 'plank', wd - 0.006, v0 - F, 0.03, xm, F, zz)
            if v1 < H1: b.box('base', 'plank', wd - 0.006, H1 - v1, 0.03, xm, v1, zz)
        else:
            b.box('base', 'plank', wd - 0.006, H1 - F, 0.03, xm, F, zz)


def boards_z(x, z0, z1, holes, out):
    n = max(2, int((z1 - z0) / 0.1))
    wd = (z1 - z0) / n
    for k in range(n):
        zm = z0 + k * wd + wd / 2
        hole = [h for h in holes if h[0] <= zm <= h[1]]
        xx = x + out * (0.004 if k % 2 else 0.0)
        if hole:
            u0, u1, v0, v1 = hole[0]
            if v0 > F: b.box('base', 'plank', 0.03, v0 - F, wd - 0.006, xx, F, zm)
            if v1 < H1: b.box('base', 'plank', 0.03, H1 - v1, wd - 0.006, xx, v1, zm)
        else:
            b.box('base', 'plank', 0.03, H1 - F, wd - 0.006, xx, F, zm)


boards_x(Z1 - 0.015, X0, X1, [(DOOR[0], DOOR[1], F, F + DOOR[2])], 1)
boards_x(Z0 + 0.015, X0, X1, [], -1)
boards_z(X0 + 0.015, Z0 + 0.03, Z1 - 0.03, [(-0.5, -0.3, F + 0.28, F + 0.46)], -1)
boards_z(X1 - 0.015, Z0 + 0.03, Z1 - 0.03, [], 1)
# słupy narożne, belki pod okapem i nad drzwiami
for x in (X0, X1):
    for z in (Z0, Z1):
        b.box('base', 'woodDark', 0.05, H1 - F, 0.05, x, F, z)
for z in (Z0, Z1):
    b.box('base', 'woodDark', X1 - X0 + 0.06, 0.045, 0.05, (X0 + X1) / 2, H1 - 0.045, z + (0.012 if z == Z1 else -0.012))
for x in (X0, X1):
    b.box('base', 'woodDark', 0.05, 0.045, Z1 - Z0 + 0.06, x + (-0.012 if x == X0 else 0.012), H1 - 0.045, (Z0 + Z1) / 2)
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.06, 0.04, 0.06, (DOOR[0] + DOOR[1]) / 2, F + DOOR[2], Z1 + 0.01)
b.box('base', 'wood', DOOR[1] - DOOR[0] - 0.01, DOOR[2] - 0.01, 0.025, DOOR[0] + 0.02, F, Z1 + 0.13, rot=-1.2)   # drzwi otwarte na ganek
b.box('base', 'woodDark', 0.04, 0.2, 0.05, X0 - 0.02, F + 0.27, -0.4)       # okienko: rama
b.box('base', 'dark', 0.01, 0.16, 0.18, X0 - 0.005, F + 0.29, -0.4)
b.box('base', 'wood', 0.02, 0.2, 0.1, X0 - 0.06, F + 0.27, -0.27, rot=0.7)   # okiennica
solid.append([X0 - 0.05, X1 + 0.05, Z0 - 0.05, Z1 + 0.05])
# w środku (widać przez drzwi): ława, sieć na kołku, kociołek
b.box('base', 'woodDark', 0.4, 0.03, 0.14, -0.3, F + 0.18, Z0 + 0.12)
b.box('base', 'dark', 0.4, 0.01, 0.6, (X0 + X1) / 2, F + 0.026, (Z0 + Z1) / 2)

# ---------------- strzecha i szczyty z desek ----------------
b.gable('shell', 'thatch', X0 - 0.03, X1 + 0.03, Z0 - 0.03, Z1 + 0.03, H1, RISE, along_x=False, over=0.15)
b.gable('shell', 'thatchDark', X0 - 0.03, X1 + 0.03, Z0 - 0.03, Z1 + 0.03, H1 - 0.035, RISE, along_x=False, over=0.18)
for z, s in ((Z0, -1), (Z1, 1)):
    b.gable_boards('shell', 'plank', 'x', z + s * 0.012, X0, X1, H1, RISE - 0.01, out=s)   # pełny trójkąt z listwami
b.box('shell', 'thatchDark', 0.13, 0.07, Z1 - Z0 + 0.4, (X0 + X1) / 2, H1 + RISE - 0.035, (Z0 + Z1) / 2)
# rybacki szyld: drewniana ryba nad drzwiami
b.box('shell', 'wood', 0.22, 0.07, 0.02, (X0 + X1) / 2, H1 + 0.12, Z1 + 0.04)
b.pyramid('shell', 'wood', 0.08, 0.02, 0.07, (X0 + X1) / 2 + 0.14, H1 + 0.11, Z1 + 0.04)

# ---------------- ryba: wrzecionowate ciało spłaszczone z boków, płetwy, oko ----------------
def fish(group, x, y, z, L=0.17, H=0.05, Wd=0.022, hang=True, yaw=0.0):
    """Ryba długości L. hang=True: wisi pyskiem w górę (pysk w (x, y, z)), ogon w dół; inaczej leży na boku wzdłuż x.
    Ciało to pierścienie (elipsy) od pyska do nasady ogona; ogon rozwidlony, płetwa grzbietowa, ciemne oko z obu stron."""
    cy, sy = math.cos(yaw), math.sin(yaw)

    def P(u, h, w):
        # u: wzdłuż ryby od pyska (0) do ogona (L); h: grzbiet(+)/brzuch(-); w: na boki
        if hang:
            return (x + h * cy - w * sy, y - u, z + h * sy + w * cy)
        return (x + u * cy - w * sy, y + 0.0 + (H / 2 + 0.005) + h, z + u * sy + w * cy)
    rings, n = [], 8
    prof = [(0.0, 0.18), (0.06, 0.62), (0.18, 0.92), (0.34, 1.0), (0.55, 0.82), (0.74, 0.5), (0.86, 0.26), (0.9, 0.2)]
    for f, r in prof:
        u = f * L
        rings.append([P(u, math.cos(2 * math.pi * k / n) * H / 2 * r + (0.004 if math.cos(2 * math.pi * k / n) > 0 else 0),
                        math.sin(2 * math.pi * k / n) * Wd / 2 * r) for k in range(n)])
    axis = [P(f * L, 0, 0) for f, _ in prof]
    for i in range(len(rings) - 1):
        for k in range(n):
            j = (k + 1) % n
            mid = ((axis[i][0] + axis[i + 1][0]) / 2, (axis[i][1] + axis[i + 1][1]) / 2, (axis[i][2] + axis[i + 1][2]) / 2)
            b.poly(group, 'fish', [rings[i][k], rings[i][j], rings[i + 1][j], rings[i + 1][k]], away=mid)
    b.poly(group, 'fish', rings[0], away=P(L * 0.3, 0, 0))                    # pysk
    b.poly(group, 'fish', list(reversed(rings[-1])), away=P(L * 0.3, 0, 0))    # nasada ogona (zamknięta)
    # ogon: dwa płaty w kształt litery V, każdy z dwóch warstw (widać z obu stron)
    for sgn in (1, -1):
        q = [P(0.88 * L, 0, 0), P(1.0 * L + 0.01, sgn * H * 0.55, 0), P(1.06 * L, sgn * H * 0.3, 0), P(0.95 * L, 0, 0)]
        for d in (0.002, -0.002):
            qq = [(p[0] + (-sy * d if True else 0), p[1], p[2] + cy * d) for p in q]
            if not hang:
                qq = [(p[0] - sy * d, p[1], p[2] + cy * d) for p in q]
            b.poly(group, 'fish', qq, away=P(0.9 * L, 0, -d * 100))
    # płetwa grzbietowa
    for d in (0.0015, -0.0015):
        q = [P(0.3 * L, H * 0.48, d), P(0.58 * L, H * 0.42, d), P(0.52 * L, H * 0.72, d)]
        b.poly(group, 'fish', q, away=P(0.45 * L, H * 0.5, -d * 100))
    # oko po obu stronach
    for side in (1, -1):
        b.box(group, 'dark', 0.008, 0.008, 0.004, *P(0.07 * L, H * 0.1, side * (Wd / 2 * 0.62 + 0.002)), rot=yaw)


# ---------------- suszarnia ryb (prawy przód) ----------------
DX0, DX1, DZ = 0.38, 0.9, 0.72
for x in (DX0, DX1):
    b.box('base', 'woodDark', 0.04, 0.62, 0.04, x, 0.0, DZ, roll=0.06 if x == DX0 else -0.06)
b.box('base', 'woodDark', DX1 - DX0 + 0.08, 0.035, 0.035, (DX0 + DX1) / 2, 0.6, DZ)
for k in range(5):
    x = DX0 + 0.07 + k * (DX1 - DX0 - 0.14) / 4
    b.box('base', 'rope', 0.006, 0.06, 0.006, x, 0.54, DZ)                 # sznurek przez skrzela
    fish('base', x, 0.545, DZ, L=0.16 + (k % 2) * 0.02, H=0.045 + (k % 3) * 0.004, yaw=(k % 2) * 0.25 - 0.1)
solid.append([DX0 - 0.04, DX1 + 0.04, DZ - 0.04, DZ + 0.04])

# ---------------- sieci na tyczkach (prawy tył) ----------------
NX, NZ0, NZ1 = 0.75, -0.85, -0.05
for z in (NZ0, (NZ0 + NZ1) / 2, NZ1):
    b.box('base', 'bark', 0.035, 0.7, 0.035, NX, 0.0, z)
b.box('base', 'woodDark', 0.03, 0.03, NZ1 - NZ0 + 0.06, NX, 0.68, (NZ0 + NZ1) / 2)
# sieć: zwisająca płachta z oczek (sznurki w kratkę), dwie strony pozwalają patrzeć z obu stron
for k in range(9):
    z = NZ0 + 0.03 + k * (NZ1 - NZ0 - 0.06) / 8
    sag = 0.05 * math.sin(math.pi * k / 8)
    b.box('base', 'rope', 0.004, 0.5 - sag, 0.004, NX + 0.025, 0.18 + sag, z)
for j in range(6):
    y = 0.2 + j * 0.08
    b.box('base', 'rope', 0.004, 0.004, NZ1 - NZ0 - 0.06, NX + 0.025, y + 0.04 * (1 - j / 5) * 0.4, (NZ0 + NZ1) / 2)
for k in range(5):   # pływaki z kory na górnej krawędzi
    b.prism('base', 'wood', 0.018, 0.018, 0.03, NX + 0.025, 0.64, NZ0 + 0.08 + k * 0.16, seg=6)
solid.append([NX - 0.04, NX + 0.06, NZ0 - 0.04, NZ1 + 0.04])

# ---------------- łódka wyciągnięta na brzeg (lewy przód), wiosła ----------------
BX, BZ, BROT = -0.55, 0.78, 0.0
L, Wd, Hd = 0.9, 0.28, 0.16


def hull_pt(u, v, s):
    """u = -1..1 wzdłuż łodzi, v = 0 (dno) .. 1 (burta), s = -1/1 burta; dziób i rufa zwężone"""
    half = Wd / 2 * (1 - abs(u) ** 2.2) * (0.55 + 0.45 * v)
    y = 0.02 + Hd * v + 0.05 * abs(u) ** 2 * v
    return (BX + u * L / 2, y, BZ + s * half)


NU = 10
for i in range(NU):
    u0, u1 = -1 + 2 * i / NU, -1 + 2 * (i + 1) / NU
    for s in (-1, 1):
        for v0, v1 in ((0.0, 0.5), (0.5, 1.0)):
            q = [hull_pt(u0, v0, s), hull_pt(u1, v0, s), hull_pt(u1, v1, s), hull_pt(u0, v1, s)]
            b.poly('base', 'woodDark', q, away=(BX, 0.5, BZ))                    # zewnątrz (od środka łodzi)
            b.poly('base', 'wood', list(reversed(q)), away=(BX, 0.5, BZ + s * 9))  # wnętrze: druga warstwa
    # dno
    b.poly('base', 'woodDark', [hull_pt(u0, 0, -1), hull_pt(u1, 0, -1), hull_pt(u1, 0, 1), hull_pt(u0, 0, 1)], away=(BX, 1, BZ))
    b.poly('base', 'wood', [hull_pt(u0, 0, -1), hull_pt(u1, 0, -1), hull_pt(u1, 0, 1), hull_pt(u0, 0, 1)], away=(BX, -1, BZ))
    # listwa na burcie
    for s in (-1, 1):
        a, c = hull_pt(u0, 1, s), hull_pt(u1, 1, s)
        b.box('base', 'woodDark', abs(c[0] - a[0]) + 0.005, 0.015, 0.025, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2 - 0.005, (a[2] + c[2]) / 2)
b.box('base', 'wood', 0.06, 0.02, Wd * 0.9, BX, 0.11, BZ)                            # ławka
for s, a in ((-1, 0.15), (1, -0.1)):                                                  # wiosła w łodzi
    b.box('base', 'woodDark', 0.7, 0.018, 0.018, BX, 0.13 + (s + 1) * 0.01, BZ + s * 0.05, rot=a)
    b.box('base', 'wood', 0.14, 0.012, 0.06, BX + 0.33 * math.cos(a), 0.13 + (s + 1) * 0.01, BZ + s * 0.05 - 0.33 * math.sin(a), rot=a)
solid.append([BX - L / 2, BX + L / 2, BZ - Wd / 2, BZ + Wd / 2])

# ---------------- beczka do solenia, kosz z rybami, kamień-kotwica ----------------
b.prism('base', 'wood', 0.11, 0.12, 0.28, 0.42, 0.0, -0.05, seg=10)
for y in (0.06, 0.22):
    b.prism('base', 'iron', 0.122, 0.122, 0.015, 0.42, y, -0.05, seg=10, top=False)
b.prism('base', 'dark', 0.1, 0.1, 0.004, 0.42, 0.281, -0.05, seg=10)
b.prism('base', 'basket', 0.09, 0.11, 0.1, 0.3, 0.0, 0.32, seg=10)
for k in range(4):
    fish('base', 0.22 + (k % 2) * 0.05, 0.075 + k * 0.012, 0.28 + (k // 2) * 0.05, L=0.14, H=0.04, hang=False, yaw=0.3 * k)
b.prism('base', 'rock', 0.07, 0.05, 0.08, -0.05, 0.0, 0.88, seg=7)
b.box('base', 'rope', 0.012, 0.012, 0.3, -0.18, 0.04, 0.88, rot=1.2)
solid.append([0.3, 0.54, -0.18, 0.08])

VIEWS = [
    ['chata rybaka z przodu', [0.2, 0.5, 2.4], [0, 0.4, 0], ['base', 'shell'], 22],
    ['łódka i suszarnia', [0.4, 0.4, 1.8], [0, 0.3, 0.6], ['base', 'shell'], 20],
    ['ryby z bliska', [0.62, 0.45, 1.15], [0.64, 0.42, 0.72], ['base', 'shell'], 14],
    ['szczyt od boku', [-0.35, 1.0, 1.3], [-0.35, 0.95, 0.0], ['base', 'shell'], 18],
]
b.save('fisher', maxe=0.22, rays=16, reach=0.3, extra={'solid': solid, 'floorY': F, 'views': VIEWS,
       'pennant': [round(X0 - 0.05, 3), round(H1 + RISE - 0.12, 3), round((Z0 + Z1) / 2, 3)]})
