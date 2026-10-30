"""Czatownia (1×1 pole): najtańsza, licha wieżyczka dla jednego łucznika, sklecona naprędce z żerdzi.

Cztery krzywe, okorowane żerdzie na płaskich kamieniach, rozstawione u dołu i zbiegające się ku górze, jeden rząd
zastrzałów na krzyż przywiązanych łykiem. Na dwóch legarach ciasny pomost z nierównych desek (miejsce dla jednego
człowieka), dookoła niskie przedpiersie z plecionki z wikliny, z przodu przerwa na wejście. Drabina z dwóch żerdzi
i szczebli przywiązanych sznurkiem. Nad pomostem mały daszek ze strzechy (grupa 'roof' — gra zdejmuje go po
kliknięciu, openTop), na pomoście kołczan wbity w deski i dzban na wodę.

Łucznik stoi na pomoście (gra czyta 'deck'). Bez chorągwi (to nie budynek, którym się ktoś chwali).
Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/lookout.py
Układ: środek działki = (0, 0), działka ±0,5, przód (drabina) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from logs import lash, log  # noqa: E402

b = Building()

DECK = 1.35      # wierzch desek pomostu
G0 = 0.36        # rozstaw żerdzi przy ziemi (połowa)
G1 = 0.27        # rozstaw pod pomostem
OUT = 0.33       # połowa boku pomostu
EAVE = DECK + 0.64
POLE = 0.04

# każda żerdź trochę inna: krzywizna (środek odsunięty w bok) i grubość
BEND = {(-1, -1): (0.025, -0.01), (1, -1): (-0.015, 0.02), (1, 1): (0.02, 0.015), (-1, 1): (-0.02, -0.02)}


def at(sx, sz, y):
    """Punkt na osi żerdzi na wysokości y (zbiega się do pomostu, wyżej prosto pod daszek)"""
    f = min(1.0, y / DECK)
    h = G0 + (G1 - G0) * f
    bx, bz = BEND[(sx, sz)]
    w = math.sin(min(1.0, y / DECK) * math.pi)   # wygięcie największe w połowie wysokości
    return (sx * h + bx * w, y, sz * h + bz * w)


# ---------------- kamienie i żerdzie ----------------
for sx in (-1, 1):
    for sz in (-1, 1):
        x, _, z = at(sx, sz, 0)
        b.box('base', 'stoneDark', 0.15, 0.05, 0.13, x, 0.0, z, rot=0.3 * sx * sz, bottom=False)
        pts = [at(sx, sz, y) for y in (0.04, DECK * 0.5, DECK)]
        r = POLE + 0.006 * (sx + 1)
        log(b, 'base', 'bark', pts[0], pts[1], r=r + 0.006, r1=r, seg=7)
        log(b, 'base', 'bark', pts[1], pts[2], r=r, r1=r - 0.004, seg=7)
        # nad pomostem cieńsza żerdź pod daszek (przywiązana do nogi)
        top = (sx * (G1 - 0.005), EAVE + 0.02, sz * (G1 - 0.005))
        log(b, 'base', 'bark', (sx * G1, DECK - 0.04, sz * G1), top, r=r - 0.01, r1=r - 0.014, seg=6)

# ---------------- zastrzały na krzyż (jeden rząd, przód zostaje wolny pod drabinę) ----------------
Y0, Y1 = 0.25, DECK - 0.22
for side in ('back', 'left', 'right'):
    if side == 'back':
        a0, a1, b0, b1 = at(-1, -1, Y0), at(1, -1, Y1), at(1, -1, Y0), at(-1, -1, Y1)
    elif side == 'left':
        a0, a1, b0, b1 = at(-1, -1, Y0), at(-1, 1, Y1), at(-1, 1, Y0), at(-1, -1, Y1)
    else:
        a0, a1, b0, b1 = at(1, 1, Y0), at(1, -1, Y1), at(1, -1, Y0), at(1, 1, Y1)
    # zastrzał leży po zewnętrznej stronie żerdzi (nie przechodzi przez nie)
    nx, nz = {'back': (0, -1), 'left': (-1, 0), 'right': (1, 0)}[side]
    off = POLE + 0.022
    for p0, p1 in ((a0, a1), (b0, b1)):
        q0 = (p0[0] + nx * off, p0[1], p0[2] + nz * off)
        q1 = (p1[0] + nx * off, p1[1], p1[2] + nz * off)
        log(b, 'base', 'woodDark', q0, q1, r=0.017, seg=5)
        for q in (q0, q1):
            lash(b, 'base', q, (0, 1, 0), r=0.03, w=0.026, seg=7)

# ---------------- legary i deski pomostu ----------------
for sz in (-1, 1):
    y = DECK - 0.075
    log(b, 'base', 'bark', (-OUT - 0.02, y, sz * (G1 + POLE + 0.012)), (OUT + 0.02, y, sz * (G1 + POLE + 0.012)), r=0.03, seg=6)
    for sx in (-1, 1):
        lash(b, 'base', (sx * G1, y, sz * (G1 + POLE * 0.5)), (0, 0, 1), r=0.045, w=0.03, seg=7)
# deski w poprzek legarów: nierówne, jedna krótsza, z przerwami
n = 6
w = 2 * OUT / n
for i in range(n):
    x = -OUT + (i + 0.5) * w
    d0 = -OUT - (0.02 if i % 2 else 0.0)
    d1 = OUT + (0.03 if i in (1, 4) else 0.0) - (0.04 if i == 3 else 0.0)
    b.box('base', 'plank' if i % 3 else 'wood', w - 0.012, 0.03, d1 - d0, x, DECK - 0.03, (d0 + d1) / 2, rot=0.02 * ((i % 3) - 1))

# ---------------- przedpiersie z plecionki (tył i boki, z przodu tylko krótkie kawałki przy żerdziach) ----------------
PAR = 0.26
T = 0.03
IN = OUT - 0.02
for x0, z0, x1, z1 in ((-IN, -IN, IN, -IN), (-IN, -IN, -IN, IN), (IN, -IN, IN, IN), (-IN, IN, -0.14, IN), (0.14, IN, IN, IN)):
    L = math.hypot(x1 - x0, z1 - z0)
    rot = -math.atan2(z1 - z0, x1 - x0)
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    b.box('base', 'wattle', L + T, PAR, T, cx, DECK - 0.005, cz, rot=rot)
    # wierzchnia witka (grubszy pręt na koronie plecionki)
    log(b, 'base', 'woodDark', (x0, DECK + PAR + 0.008, z0), (x1, DECK + PAR + 0.008, z1), r=0.012, seg=5)
# słupki wejścia (wyższe, za nie łapie się wchodzący)
for sx in (-1, 1):
    log(b, 'base', 'bark', (sx * 0.15, DECK - 0.02, IN), (sx * 0.15, DECK + PAR + 0.12, IN), r=0.018, seg=6)

# ---------------- drabina ----------------
# osobna grupa 'ladder': gra chowa ją, gdy wieża stoi w murze kamiennym (wchodzi się wtedy z korony muru)
FOOTZ = 0.66
TOPY = DECK + 0.3
EDGE = OUT + 0.02
TOPZ = FOOTZ - (FOOTZ - EDGE) * TOPY / (DECK - 0.03)
for sx in (-1, 1):
    b.box('ladder', 'stoneDark', 0.08, 0.03, 0.08, sx * 0.12, 0.0, FOOTZ, bottom=False)
    log(b, 'ladder', 'bark', (sx * 0.12, 0.03, FOOTZ), (sx * 0.12, TOPY, TOPZ), r=0.017, seg=6)
for k in range(6):
    y = 0.2 + k * (DECK - 0.28) / 5
    z = FOOTZ - (FOOTZ - EDGE) * y / (DECK - 0.03)
    log(b, 'ladder', 'wood', (-0.14, y, z), (0.14, y, z), r=0.012, seg=5)
    for sx in (-1, 1):
        lash(b, 'ladder', (sx * 0.12, y, z), (0, 1, -0.3), r=0.024, w=0.018, seg=6)

# ---------------- na pomoście: kołczan i dzban ----------------
QX, QZ = 0.2, -0.2
b.prism('base', 'hide', 0.035, 0.04, 0.2, QX, DECK - 0.005, QZ, seg=8)
b.prism('base', 'hideDark', 0.041, 0.041, 0.02, QX, DECK + 0.17, QZ, seg=8, top=False)
for k in range(5):
    a = k * 2.4
    rr = 0.008 + (k % 2) * 0.014
    b.box('base', 'plank', 0.006, 0.12, 0.006, QX + math.cos(a) * rr, DECK + 0.15, QZ + math.sin(a) * rr, roll=0.05 * math.cos(a))
    b.box('base', 'white', 0.003, 0.03, 0.012, QX + math.cos(a) * rr, DECK + 0.25, QZ + math.sin(a) * rr, rot=a)
JX, JZ = -0.21, -0.19
b.prism('base', 'soil', 0.04, 0.055, 0.08, JX, DECK - 0.005, JZ, seg=10, top=False)
b.prism('base', 'soil', 0.055, 0.03, 0.06, JX, DECK + 0.075, JZ, seg=10, top=False)
b.prism('base', 'soil', 0.03, 0.034, 0.03, JX, DECK + 0.135, JZ, seg=10, top=False)
b.prism('base', 'dark', 0.026, 0.026, 0.003, JX, DECK + 0.163, JZ, seg=10)

# ---------------- daszek ze strzechy (zdejmowany po kliknięciu) ----------------
R0 = 0.46
APEX = EAVE + 0.4
mid = (0, EAVE + 0.1, 0)
for mat, dy, rr in (('thatch', 0.0, R0), ('thatchDark', -0.04, R0 + 0.03)):
    c = [(-rr, EAVE + dy, -rr), (rr, EAVE + dy, -rr), (rr, EAVE + dy, rr), (-rr, EAVE + dy, rr)]
    top = (0, APEX + dy, 0)
    for k in range(4):
        b.slope('roof', mat, [c[k], c[(k + 1) % 4], top], away=mid, t=0.035)
# wieniec z żerdzi i krokwie (widać od dołu z pomostu)
for z in (-G1, G1):
    log(b, 'roof', 'bark', (-G1 - 0.06, EAVE - 0.03, z), (G1 + 0.06, EAVE - 0.03, z), r=0.018, seg=5)
for x in (-G1, G1):
    log(b, 'roof', 'bark', (x, EAVE - 0.065, -G1 + 0.03), (x, EAVE - 0.065, G1 - 0.03), r=0.017, seg=5)
for sx in (-1, 1):
    for sz in (-1, 1):
        log(b, 'roof', 'woodDark', (sx * G1, EAVE - 0.02, sz * G1), (0, APEX - 0.08, 0), r=0.015, seg=5)
b.prism('roof', 'thatchDark', 0.06, 0.02, 0.09, 0, APEX - 0.07, 0, seg=8)
lash(b, 'roof', (0, APEX - 0.04, 0), (0, 1, 0), r=0.05, w=0.03, seg=8)

VIEWS = [
    ['czatownia od drabiny (oczy chłopa)', [0.3, 0.5, 2.0], [0, 1.0, 0], ['base', 'shell'], 24],
    ['pod pomostem', [0.1, 0.3, 0.6], [0.0, DECK, -0.1], ['base', 'shell'], 18],
    ['na pomoście', [0.05, DECK + 0.45, 0.2], [-0.1, DECK + 0.05, -0.3], ['base', 'shell'], 18],
    ['pomost bez daszka (po kliknięciu)', [1.0, DECK + 1.3, 1.0], [0.0, DECK, 0.0], ['base'], 26],
]
b.save('lookout', maxe=0.2, rays=16, reach=0.3, extra={'deck': DECK, 'views': VIEWS, 'openTop': True})
