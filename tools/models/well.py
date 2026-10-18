"""Studnia (1×1 pole): cembrowina z ciosanych kamieni układanych w dwóch warstwach na mijankę, z grubą koroną;
w środku ciemna woda głęboko w dole. Nad nią dwa słupy na kamiennych podkładach z mieczami podpierającymi wał,
na wale nawinięta lina z korbą, wiadro okute żelazem zawieszone nad otworem, drugie wiadro stoi na koronie.
Daszek dwuspadowy z desek z grubością (widać go też od spodu). Obok koryto dla zwierząt i mokre kamienie.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/well.py
Układ: środek pola = (0, 0), pole ±0,5, korba po stronie +z, koryto po stronie -x.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from logs import lash, log  # noqa: E402

b = Building()

R_OUT, R_IN = 0.3, 0.215
RIM = 0.34      # wierzch korony cembrowiny
WATER = 0.06    # tafla wody (głęboko w dole)
SEG = 11

# ---------------- cembrowina: dwie warstwy ciosów na mijankę i korona ----------------
# Każdy cios to wycinek pierścienia (zamknięta bryła: lico, wnętrze, wierzch, spód, boki), z małą szczeliną między ciosami.
def stone_seg(group, mat, a0, a1, r0, r1, y0, y1, bulge=0.0):
    def P(a, r, y):
        return (math.sin(a) * r, y, math.cos(a) * r)
    g = 0.012 / ((r0 + r1) / 2)
    a0, a1 = a0 + g, a1 - g
    am = (a0 + a1) / 2
    c = P(am, (r0 + r1) / 2, (y0 + y1) / 2)
    o0, o1 = r1 + bulge, r1 + bulge
    b.poly(group, mat, [P(a0, o0, y0), P(a1, o1, y0), P(a1, o1, y1), P(a0, o0, y1)], away=c)    # lico
    b.poly(group, mat, [P(a0, r0, y0), P(a1, r0, y0), P(a1, r0, y1), P(a0, r0, y1)], away=c)    # od strony wody
    b.poly(group, mat, [P(a0, r0, y1), P(a1, r0, y1), P(a1, o1, y1), P(a0, o0, y1)], away=c)    # wierzch
    b.poly(group, mat, [P(a0, r0, y0), P(a1, r0, y0), P(a1, o1, y0), P(a0, o0, y0)], away=c)    # spód
    b.poly(group, mat, [P(a0, r0, y0), P(a0, o0, y0), P(a0, o0, y1), P(a0, r0, y1)], away=c)    # boki
    b.poly(group, mat, [P(a1, r0, y0), P(a1, o1, y0), P(a1, o1, y1), P(a1, r0, y1)], away=c)


ROWS = ((-0.02, 0.12, 0.0, 'stoneDark'), (0.12, 0.27, 0.5, 'stone'))
for y0, y1, shift, mat in ROWS:
    for k in range(SEG):
        a0 = 2 * math.pi * (k + shift) / SEG
        a1 = 2 * math.pi * (k + 1 + shift) / SEG
        bul = 0.008 * math.sin(k * 2.7 + shift * 5)
        stone_seg('base', mat if k % 4 else ('stone' if mat == 'stoneDark' else 'stoneDark'), a0, a1, R_IN, R_OUT, y0, y1, bul)
# korona: szersze, płaskie płyty wystające poza lico
for k in range(8):
    a0, a1 = 2 * math.pi * (k + 0.25) / 8, 2 * math.pi * (k + 1.25) / 8
    stone_seg('base', 'castleDark', a0, a1, R_IN - 0.01, R_OUT + 0.025, 0.27, RIM)
# ciemny szyb i woda w dole
for k in range(SEG):
    a0, a1 = 2 * math.pi * k / SEG, 2 * math.pi * (k + 1) / SEG
    r = R_IN - 0.002
    b.poly('base', 'dark', [(math.sin(a0) * r, WATER, math.cos(a0) * r), (math.sin(a1) * r, WATER, math.cos(a1) * r),
                            (math.sin(a1) * r, RIM - 0.02, math.cos(a1) * r), (math.sin(a0) * r, RIM - 0.02, math.cos(a0) * r)],
           away=(math.sin((a0 + a1) / 2) * 2, 0.2, math.cos((a0 + a1) / 2) * 2))
b.poly('base', 'water', [(math.sin(2 * math.pi * k / SEG) * R_IN, WATER + 0.002, math.cos(2 * math.pi * k / SEG) * R_IN) for k in range(SEG)],
       away=(0, -1, 0))

# ---------------- słupy, miecze, wał z liną i korbą ----------------
PZ = 0.36       # słupy stoją po bokach w osi z
TOP = 0.86
AX = 0.62       # oś wału
for sz in (-1, 1):
    b.prism('base', 'stoneDark', 0.07, 0.06, 0.05, 0, 0.0, sz * PZ, seg=6, phase=0.4)
    log(b, 'base', 'bark', (0, 0.04, sz * PZ), (0.005, TOP, sz * PZ), r=0.04, r1=0.036, seg=7)
    # widełki na wał: wcięcie w słupie zrobione dwiema okładzinami
    for dx in (-1, 1):
        b.box('base', 'woodDark', 0.02, 0.1, 0.06, dx * 0.045, AX - 0.05, sz * PZ)
    # miecze od słupa do cembrowiny
    log(b, 'base', 'woodDark', (0, 0.42, sz * (PZ - 0.02)), (0, 0.3, sz * (R_OUT + 0.06)), r=0.018, seg=5)
    lash(b, 'base', (0, 0.43, sz * PZ), (0, 1, 0), r=0.048, w=0.03)
# wał: gruby walec między słupami, na nim nawinięta lina (kilka zwojów), korba po stronie +z wysunięta do przodu
log(b, 'base', 'wood', (0, AX, -PZ - 0.05), (0, AX, PZ + 0.07), r=0.045, seg=10, twist=0.2)
for k in range(5):
    z = -0.1 + k * 0.045
    log(b, 'base', 'rope', (0, AX, z - 0.017), (0, AX, z + 0.017), r=0.056, seg=10)
# korba: ramię i rękojeść
log(b, 'base', 'iron', (0, AX, PZ + 0.07), (0, AX, PZ + 0.1), r=0.012, seg=6)
log(b, 'base', 'woodDark', (0, AX, PZ + 0.1), (0.13, AX - 0.08, PZ + 0.1), r=0.016, seg=6)
log(b, 'base', 'woodDark', (0.13, AX - 0.08, PZ + 0.1), (0.13, AX - 0.08, PZ + 0.2), r=0.018, seg=6)
# lina z wału do wiadra wiszącego nad otworem
BY = 0.4
log(b, 'base', 'rope', (0, AX - 0.05, 0.0), (0, BY + 0.13, 0.0), r=0.006, seg=5, ends='rope')


def bucket(group, x, y, z, r=0.07, h=0.11, handle=True):
    """Wiadro z klepek: pękate, z dwiema żelaznymi obręczami, pałąkiem i ciemnym wnętrzem"""
    b.prism(group, 'wood', r * 0.85, r, h, x, y, z, seg=10, top=False)
    b.prism(group, 'dark', r * 0.92, r * 0.92, 0.004, x, y + h - 0.025, z, seg=10)
    for yy in (y + 0.015, y + h - 0.035):
        b.prism(group, 'iron', r * 0.9 + 0.006, r * 0.93 + 0.006, 0.014, x, yy, z, seg=10, top=False)
    # brzeg wiadra z grubością (wierzch klepek)
    b.prism(group, 'wood', r + 0.004, r + 0.004, 0.012, x, y + h - 0.012, z, seg=10, top=True)
    if handle:
        for k in range(6):
            a0, a1 = math.pi * k / 6, math.pi * (k + 1) / 6
            log(b, group, 'iron', (x + math.cos(a0) * r * 0.95, y + h + math.sin(a0) * 0.06, z),
                (x + math.cos(a1) * r * 0.95, y + h + math.sin(a1) * 0.06, z), r=0.005, seg=4, ends='iron')


bucket('base', 0, BY, 0.0)
bucket('base', 0.2, RIM, -0.16, r=0.062, h=0.1, handle=False)

# ---------------- daszek dwuspadowy z desek ----------------
RY, RH = TOP - 0.02, 0.22
b.gable('base', 'wood', -0.2, 0.2, -PZ - 0.06, PZ + 0.06, RY, RH, along_x=False, over=0.08)
# listwy kryjące na połaciach (deski na zakładkę)
for side in (-1, 1):
    for k in range(4):
        z = -PZ - 0.08 + (k + 0.5) * (2 * PZ + 0.16) / 4
        f0, f1 = -0.28, 0.0
        y0 = RY + RH * (1 - abs(f0) / 0.28) + 0.008
        b.box('base', 'woodDark', 0.29, 0.012, 0.03, side * 0.14, RY + RH * 0.5 - 0.005, z, roll=-side * math.atan2(RH, 0.28))
# kalenica
log(b, 'base', 'woodDark', (0, RY + RH + 0.012, -PZ - 0.16), (0, RY + RH + 0.012, PZ + 0.16), r=0.022, seg=6)
# płatwie pod daszkiem na słupach
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.04, 0.04, 2 * PZ + 0.16, sx * 0.17, RY - 0.03, 0)
b.box('base', 'woodDark', 0.4, 0.05, 0.06, 0, TOP - 0.04, -PZ)
b.box('base', 'woodDark', 0.4, 0.05, 0.06, 0, TOP - 0.04, PZ)

# ---------------- koryto i mokre kamienie ----------------
TX, TZ = 0.0, -0.0
# koryto wydrążone z pnia przy krawędzi pola (-x)
CX = -0.4
b.box('base', 'woodDark', 0.13, 0.11, 0.5, CX, 0.0, 0.05)
b.box('base', 'water', 0.09, 0.005, 0.44, CX, 0.105, 0.05)
for z in (-0.17, 0.27):
    b.box('base', 'iron', 0.135, 0.02, 0.02, CX, 0.07, z)
for (x, z, r) in ((0.3, 0.22, 0.04), (0.34, -0.12, 0.035), (-0.18, 0.36, 0.03), (0.15, 0.4, 0.028)):
    b.prism('base', 'stoneDark', r, r * 0.7, r * 0.6, x, 0.0, z, seg=6, phase=x * 7)

VIEWS = [
    ['studnia (oczy chłopa)', [1.2, 0.55, 0.6], [0, 0.4, 0], ['base'], 26],
    ['w szyb', [0.25, 0.75, 0.15], [0, 0.05, 0], ['base'], 22],
    ['pod daszkiem', [0.55, 0.25, 0.25], [0, RY + 0.1, 0], ['base'], 20],
]
b.save('well', maxe=0.12, rays=16, reach=0.2, extra={'views': VIEWS})
