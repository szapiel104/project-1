"""Rudera narożna (2×2 pola, 6 łóżek) — większa buda z desek w kształcie litery L, pośrednia między ruderą a chatą:
długie skrzydło pod tylną krawędzią działki i krótsze skrzydło z lewej, na przód. W kącie między nimi mały, udeptany
podwórzec, a z niego wejście (skóra zamiast drzwi) do długiego skrzydła. Ściany z krzywych, poszarzałych desek na
okorowanych słupach, ze szparami; dwa płaskie dachy z desek (kalenica wzdłuż każdego skrzydła), na nich kamienie.
W środku ciemne klepisko i sześć posłań: trzy pod tylną ścianą długiego skrzydła, trzy pod lewą ścianą krótkiego
(miejsca zapisane w kluczu `beds`, gra kładzie tam śpiących). Skrzynka, pieniek, garnek i kupka słomy.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/shackl.py
Układ: środek działki = (0, 0), działka ±1, przód (pole wejścia) = +z, przed prawą połową przodu — tam prowadzi podwórzec.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from shackparts import backing, door_hide, ridge_cap  # noqa: E402
from timber import Timber  # noqa: E402

b = Building()
t = Timber(b, T=0.05)


def jit(k, a, s=1.0):
    """Stały „przypadek” z liczby (bez random: model wychodzi zawsze taki sam)"""
    return math.sin(k * 12.9898 + a * 78.233) * s


XL, XR, ZB = -0.88, 0.88, -0.86   # lewa i prawa ściana, tył
ZM = -0.1                         # przód długiego skrzydła (od podwórca)
XI = -0.12                        # prawa ściana krótkiego skrzydła (od podwórca)
ZF = 0.82                         # przód krótkiego skrzydła
H1, RISE = 0.66, 0.2              # okap, wysokość dachu nad okapem
PT, BH, GAP = 0.022, 0.082, 0.016  # deska: grubość, wysokość, szpara
DOOR = (0.24, 0.62, 0.6)          # wejście w przedniej ścianie długiego skrzydła (x od, x do, wysokość)
DM = (DOOR[0] + DOOR[1]) / 2
P = 0.012                         # klepisko


def wall(axis, at, a0, a1, out, k0, holes=(), skip=(), patch=None):
    """Ściana z poziomych desek: axis 'x' = wzdłuż x w płaszczyźnie z=at, 'z' = wzdłuż z w płaszczyźnie x=at.
    out = +1/-1 (lico na zewnątrz), holes = [(od, do, wysokość)], skip = rzędy bez deski, patch = (miejsce, wysokość) łaty"""
    off = at + out * (0.035 + PT / 2)
    y, row = 0.03, 0
    while y + BH <= H1 + 0.01:
        segs = [(a0, a1)]
        for h0, h1, hh in holes:
            if y < hh:
                segs = [s for seg in segs for s in ((seg[0], min(seg[1], h0 - 0.035)), (max(seg[0], h1 + 0.035), seg[1])) if s[1] - s[0] > 0.04]
        for a, c in segs:
            if row in skip:
                continue
            a2 = a - 0.03 + jit(row + k0, a * 3, 0.02)
            c2 = c + 0.03 + jit(row + k0, c * 5, 0.02)
            if (row * 7 + int(a * 10) + k0) % 9 == 0:
                c2 -= 0.12 + abs(jit(row, 3 + k0, 0.05))   # krótsza deska: dziura na końcu
            tilt = jit(row + k0, a + 2, 0.022)
            mat = 'wood' if (row + int(a * 4) + k0) % 3 else 'woodDark'
            hgt = BH - abs(jit(row + k0, 9, 0.008))
            wob = jit(row + k0, a, 0.004)
            if axis == 'x':
                b.box('base', mat, c2 - a2, hgt, PT, (a2 + c2) / 2, y, off + wob, roll=tilt)
            else:
                b.box('base', mat, c2 - a2, hgt, PT, off + wob, y, (a2 + c2) / 2, rot=math.pi / 2, roll=tilt)
        y += BH + GAP + jit(row + k0, 4, 0.004)
        row += 1
    # od środka ciemne deski: przez szpary nie prześwituje niebo
    backing(b, axis, at + out * (0.035 - 0.006), a0 - 0.02, a1 + 0.02, H1, holes=holes)
    if patch:   # łata z pionowej deski, o włos przed licem
        pa, ph = patch
        d = off + out * (PT + 0.006)
        if axis == 'x':
            b.box('base', 'woodDark', 0.075, ph, PT, pa, 0.08, d, roll=jit(3, pa, 0.06))
        else:
            b.box('base', 'woodDark', 0.075, ph, PT, d, 0.08, pa, rot=math.pi / 2, roll=jit(5, pa, 0.06))


# ---------------- klepisko, ubita ziemia pod budą i na podwórcu ----------------
b.box('base', 'soil', XR - XL + 0.2, 0.006, ZM - ZB + 0.2, 0, 0, (ZB + ZM) / 2)
b.box('base', 'soil', XI - XL + 0.2, 0.0055, ZF - ZM + 0.1, (XL + XI) / 2, 0, (ZM + ZF) / 2 + 0.05)
b.box('base', 'soil', 0.95, 0.004, 1.0, 0.45, 0, 0.45)   # podwórzec
b.box('floor', 'soil', XR - XL - 0.12, 0.008, ZM - ZB - 0.08, 0, P - 0.006, (ZB + ZM) / 2)
b.box('floor', 'soil', XI - XL - 0.1, 0.0085, ZF - ZM, (XL + XI) / 2, P - 0.006, (ZM + ZF) / 2 - 0.02)

# ---------------- słupy z okorowanych pni ----------------
posts = [(XL, ZB), (XR, ZB), (XR, ZM), (XI, ZM), (XI, ZF), (XL, ZF), (0.0, ZB), (XL, ZM), (DOOR[0] - 0.03, ZM), (DOOR[1] + 0.03, ZM)]
for k, (x, z) in enumerate(posts):
    b.prism('base', 'bark', 0.035, 0.03, H1 + 0.03, x + jit(k, 1, 0.012), 0.0, z, seg=7, phase=k * 0.4)

# ---------------- ściany ----------------
wall('x', ZB, XL, XR, -1, 0, skip={3}, patch=(0.45, 0.48))                   # tył: jednej deski brak
wall('z', XR, ZB, ZM, 1, 5, patch=(-0.5, 0.4))                               # prawy koniec długiego skrzydła
wall('x', ZM, XI, XR, 1, 9, holes=[(DOOR[0], DOOR[1], DOOR[2])])             # przód długiego skrzydła z wejściem
wall('z', XI, ZM, ZF, 1, 13, skip={4}, patch=(0.4, 0.36))                    # bok krótkiego skrzydła od podwórca
wall('x', ZF, XL, XI, 1, 17, patch=(-0.62, 0.44))                            # przód krótkiego skrzydła
wall('z', XL, ZB, ZF, -1, 21, skip={5}, patch=(-0.3, 0.5))                   # lewa ściana, cała długość

# belka nad wejściem, płaski kamień progu, skóra zamiast drzwi (odgięta, przewiązana sznurem)
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.14, 0.05, 0.06, DM, DOOR[2], ZM + 0.035)
b.box('base', 'rockDark', DOOR[1] - DOOR[0] + 0.02, 0.022, 0.12, DM, 0.0, ZM + 0.1)
door_hide(b, DOOR[0], DOOR[1], DOOR[2], ZM + 0.075)

# ---------------- dachy z desek: długie skrzydło (kalenica wzdłuż x), krótkie (kalenica wzdłuż z) ----------------
OV, W = 0.1, 0.13


def roof(along, a0, a1, e0, e1, kseed):
    """Dach z desek z kalenicy na okap nad prostokątem: along 'x' — deski ułożone w poprzek osi x (kalenica wzdłuż x,
    okapy po bokach z = e0/e1), 'z' — kalenica wzdłuż z (okapy x = e0/e1). a0..a1 = długość dachu wzdłuż kalenicy."""
    em = (e0 + e1) / 2
    mid = (em, H1 + RISE * 0.3, (a0 + a1) / 2) if along == 'z' else ((a0 + a1) / 2, H1 + RISE * 0.3, em)

    def Pt(a, e, y):
        return (a, y, e) if along == 'x' else (e, y, a)
    # podbitek: ciemna płyta 3 cm pod deskami
    for ee in (e0 - OV, e1 + OV):
        pts = [Pt(a0, ee, H1 - 0.03), Pt(a1, ee, H1 - 0.03), Pt(a1, em, H1 + RISE - 0.03), Pt(a0, em, H1 + RISE - 0.03)]
        b.slope('shell', 'woodDark', pts, mid, t=0.015)
    n = int((a1 - a0) / (W + 0.012))
    for side, ee in ((-1, e0 - OV), (1, e1 + OV)):
        for k in range(n):
            a = a0 + (k + 0.5) * (a1 - a0) / n
            w = W - abs(jit(k + kseed, side, 0.015))
            drop = abs(jit(k + kseed, side + 3, 0.04))
            lift = jit(k + kseed, side + 5, 0.006)
            e2 = ee - side * drop
            f = (e2 - em) / (ee - em)
            ye = H1 + RISE - RISE * f + lift
            pts = [Pt(a - w / 2, e2, ye), Pt(a + w / 2, e2, ye), Pt(a + w / 2, em, H1 + RISE + 0.012 + lift), Pt(a - w / 2, em, H1 + RISE + 0.012 + lift)]
            b.slope('shell', 'wood' if (k + kseed) % 4 else 'woodDark', pts, mid, t=PT)
    # czapa kalenicy z dwóch desek leżących na połaciach
    ridge_cap(b, along, a0 - 0.02, a1 + 0.02, em, H1 + RISE + 0.012, RISE, (e1 + OV) - em)


roof('x', XL - OV, XR + OV, ZB, ZM, 0)
# krótkie skrzydło: od kalenicy długiego (tam deski chowają się pod jego dachem) do przodu z okapem
roof('z', (ZB + ZM) / 2 + 0.06, ZF + OV, XL, XI, 7)
# szczyty z desek: prawy i lewy koniec długiego skrzydła, przód krótkiego
b.gable_boards('shell', 'wood', 'z', XR + 0.04, ZB, ZM, H1 - 0.01, RISE, 1, t=PT, step=0.11)
b.gable_boards('shell', 'wood', 'z', XL - 0.04, ZB, ZM, H1 - 0.01, RISE, -1, t=PT, step=0.11)
b.gable_boards('shell', 'wood', 'x', ZF + 0.04, XL, XI, H1 - 0.01, RISE, 1, t=PT, step=0.11)
# kamienie przyciskające deski
for x, y, z in ((0.45, H1 + RISE * 0.5, ZB + 0.14), (-0.3, H1 + RISE * 0.55, ZM - 0.1), (-0.72, H1 + RISE * 0.5, 0.5)):
    b.crystal('shell', 'rock', x, y, z, 0.05, seed=x + z, sy=0.6)

# ---------------- izba: sześć posłań (głowa, nogi) i sprzęty między nimi ----------------
L = 0.48
BEDS = [[x, ZB + 0.08, x, ZB + 0.08 + L] for x in (0.02, 0.3, 0.58)]           # pod tylną ścianą długiego skrzydła
BEDS += [[XL + 0.06, z, XL + 0.06 + L, z] for z in (0.08, 0.33, 0.58)]        # pod lewą ścianą krótkiego
t.boxs('interior', 'woodDark', 0.2, 0.12, 0.13, 0.78, P, -0.25)               # skrzynka przy prawym końcu
b.box('interior', 'iron', 0.21, 0.012, 0.02, 0.78, P + 0.09, -0.32)
b.prism('interior', 'wood', 0.055, 0.055, 0.11, -0.42, P, -0.55, seg=9)       # pieniek
b.prism('interior', 'rockDark', 0.032, 0.042, 0.06, 0.8, P, -0.66, seg=9)     # garnek
b.pyramid('interior', 'hay', 0.18, 0.14, 0.07, -0.28, P, 0.68)                # kupka słomy w kącie

# ---------------- spacer: przeszkody (ściany) i podłoga (izba, wejście, podwórzec) ----------------
t.block(XL - 0.05, XR + 0.05, ZB - 0.06, ZB + 0.02)
t.block(XR - 0.02, XR + 0.06, ZB, ZM)
t.block(XI - 0.02, DOOR[0], ZM - 0.02, ZM + 0.06)
t.block(DOOR[1], XR + 0.05, ZM - 0.02, ZM + 0.06)
t.block(XI - 0.02, XI + 0.06, ZM, ZF + 0.05)
t.block(XL - 0.05, XI + 0.05, ZF - 0.02, ZF + 0.06)
t.block(XL - 0.06, XL + 0.02, ZB, ZF)
t.open.append([XL + 0.04, XR - 0.04, ZB + 0.04, ZM - 0.04])
t.open.append([XL + 0.04, XI - 0.04, ZM - 0.06, ZF - 0.04])
t.open.append([DOOR[0], DOOR[1], ZM - 0.05, ZM + 0.1])
t.open.append([XI + 0.06, 1.0, ZM + 0.06, 1.0])          # podwórzec aż do pola wejścia

# ---------------- na podwórcu: polana pod ścianą krótkiego skrzydła, wiadro ----------------
for k, (dz, y) in enumerate(((0.0, 0.004), (0.065, 0.004), (0.032, 0.06))):
    b.box('base', 'bark', 0.34 + jit(k, 2, 0.03), 0.056, 0.058, XI + 0.27, y, 0.62 + dz, rot=jit(k, 6, 0.05))
b.prism('base', 'woodDark', 0.05, 0.06, 0.1, 0.78, 0.0, 0.18, seg=10)
b.prism('base', 'iron', 0.062, 0.062, 0.012, 0.78, 0.075, 0.18, seg=10)

E = 0.4
OUT, ROOM = ['base', 'shell'], ['base', 'interior', 'floor']
VIEWS = [
    ['buda z podwórca', [0.9, 0.55, 1.9], [-0.1, 0.3, -0.2], OUT, 24],
    ['z lewego boku', [-2.0, 0.45, 0.3], [0, 0.3, 0], OUT, 22],
    ['izba od wejścia', [DM, E, -0.05], [-0.5, 0.15, -0.6], ROOM, 16],
    ['krótkie skrzydło', [0.2, E, -0.4], [-0.6, 0.12, 0.5], ROOM, 16],
]
b.save('shackl', maxe=0.24, rays=14, reach=0.3, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': [], 'chimneys': [], 'flames': [], 'beds': BEDS,
    'pennant': [round(XR + 0.06, 3), round(H1 + RISE - 0.05, 3), (ZB + ZM) / 2], 'views': VIEWS})
