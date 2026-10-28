"""Namiot z płachty (1×1 pole) — najtańsze schronienie, na dwie osoby: zgrzebna, połatana płachta przerzucona przez
żerdź na dwóch rozwidlonych kijach, rozpięta na kołkach przy ziemi (połacie opadają prawie do ziemi), z tyłu
zamknięta trójkątem płótna, z przodu wejście z jedną połą odrzuconą na bok. W środku słoma (na niej gra kładzie
dwa posłania, wzdłuż namiotu), przy wejściu kamienie paleniska z popiołem i tobołek.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/tent.py
Układ: środek działki = (0, 0), działka ±0,5, przód (wejście) = +z. Kalenica wzdłuż z (od tyłu do wejścia).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from timber import Timber  # noqa: E402

b = Building()
t = Timber(b, T=0.03)


def jit(k, a, s=1.0):
    """Stały „przypadek” z liczby (bez random: model wychodzi zawsze taki sam)"""
    return math.sin(k * 12.9898 + a * 78.233) * s


def stick(group, mat, p0, p1, r, seg=6, ends=None):
    """Kij / żerdź / lina od p0 do p1: zamknięty walec z oboma denkami"""
    ends = ends or mat
    ax = [p1[i] - p0[i] for i in range(3)]
    L = math.sqrt(sum(a * a for a in ax))
    d = [a / L for a in ax]
    up = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)
    u = (d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0])
    ul = math.sqrt(sum(a * a for a in u))
    u = [a / ul for a in u]
    v = (d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0])

    def ring(c):
        return [tuple(c[i] + (u[i] * math.cos(2 * math.pi * k / seg) + v[i] * math.sin(2 * math.pi * k / seg)) * r for i in range(3)) for k in range(seg)]
    lo, hi = ring(p0), ring(p1)
    mid = [(p0[i] + p1[i]) / 2 for i in range(3)]
    for k in range(seg):
        k2 = (k + 1) % seg
        b.poly(group, mat, [lo[k], lo[k2], hi[k2], hi[k]], away=mid)
    b.poly(group, ends, lo, away=tuple(p1))
    b.poly(group, ends, hi, away=tuple(p0))


XS = 0.36            # połacie przy ziemi (x)
ZB, ZF = -0.4, 0.34  # tył i przód płachty
RH = 0.5             # wysokość żerdzi
FOOT = 0.04          # płachta kończy się tuż nad ziemią (kołki ją trzymają)
CT = 0.012           # grubość płótna
P = 0.012            # słoma na ziemi

# ---------------- ziemia: udeptane klepisko pod i przed namiotem ----------------
b.box('base', 'soil', 0.86, 0.005, 0.92, 0, 0, -0.02)
b.box('floor', 'hay', 0.5, 0.012, 0.66, 0, 0.002, -0.05)

# ---------------- dwa rozwidlone kije i żerdź ----------------
for z in (ZB - 0.02, ZF + 0.03):
    stick('base', 'bark', (0.0, 0.0, z), (0.0, RH - 0.01, z), 0.016, seg=6)
    for s in (-1, 1):   # widełki
        stick('base', 'bark', (0.0, RH - 0.05, z), (s * 0.035, RH + 0.04, z), 0.009, seg=5)
stick('base', 'woodDark', (0.0, RH + 0.016, ZB - 0.09), (0.0, RH + 0.016, ZF + 0.1), 0.014, seg=6)

# ---------------- płachta: dwie połacie z grubością (dach to bryła, nie kartka) ----------------
mid = (0.0, RH * 0.35, (ZB + ZF) / 2)
top = RH + 0.032
for s in (-1, 1):
    pts = [(s * XS, FOOT, ZB), (s * XS, FOOT, ZF), (0.0, top, ZF + 0.02), (0.0, top, ZB)]
    b.slope('base', 'canvas', pts, mid, t=CT)
    # łaty z ciemniejszego płótna, o włos nad połacią
    for k in range(2):
        f0 = 0.25 + k * 0.35 + jit(k, s, 0.06)
        zc = ZB + (ZF - ZB) * (0.3 + k * 0.4) + jit(k, s + 2, 0.05)
        w, h = 0.11 + abs(jit(k, s + 4, 0.03)), 0.09
        def on(f, z):
            return (s * XS * (1 - f), FOOT + (top - FOOT) * f + 0.006, z)
        b.slope('base', 'canvasDark', [on(f0, zc - w / 2), on(f0, zc + w / 2), on(f0 + h * 2, zc + w / 2), on(f0 + h * 2, zc - w / 2)], mid, t=0.006)
# tył: trójkąt płótna zamyka namiot (dwie warstwy, z grubością)
back = [(-XS, FOOT, ZB + 0.005), (XS, FOOT, ZB + 0.005), (0.0, top - 0.01, ZB + 0.005)]
inner = [(x, y, z + CT) for x, y, z in back]
cen = (0.0, RH * 0.3, ZB + CT / 2)
b.poly('base', 'canvas', back, away=(0, 0.2, 1))
b.poly('base', 'canvas', inner, away=(0, 0.2, -1))
for k in range(3):
    j = (k + 1) % 3
    b.poly('base', 'canvas', [back[k], back[j], inner[j], inner[k]], away=cen)
# przód: lewa poła zawinięta i przywiązana do kija, prawa wisi luźno do połowy wejścia
for s, reach in ((-1, 0.38), (1, 0.62)):
    x0 = s * XS
    xi = x0 * (1 - reach)
    yi = FOOT + (top - FOOT) * reach
    fz = ZF + 0.004
    pts = [(x0, FOOT, fz), (x0 * (1 - reach * 0.4), FOOT, fz + 0.03), (xi, yi, fz + 0.015), (0.0, top - 0.01, fz)]
    o = pts
    i = [(x, y, z - CT) for x, y, z in pts]
    c = (sum(p[0] for p in pts) / 4, sum(p[1] for p in pts) / 4, fz - CT / 2)
    b.poly('base', 'canvasDark' if s < 0 else 'canvas', o, away=(c[0], c[1], c[2] - 1))
    b.poly('base', 'canvasDark' if s < 0 else 'canvas', list(reversed(i)), away=(c[0], c[1], c[2] + 1))
    for k in range(4):
        j = (k + 1) % 4
        b.poly('base', 'canvas', [o[k], o[j], i[j], i[k]], away=c)
b.box('base', 'rope', 0.05, 0.016, 0.03, -0.06, 0.3, ZF + 0.03)

# ---------------- kołki i odciągi z liny ----------------
for s in (-1, 1):
    for z in (ZB + 0.05, ZF - 0.05):
        px = s * (XS + 0.09)
        stick('base', 'woodDark', (px, -0.01, z), (px - s * 0.012, 0.075, z), 0.008, seg=5)
        stick('base', 'rope', (s * XS, FOOT + 0.004, z), (px - s * 0.01, 0.06, z), 0.003, seg=4)
for z, dz in ((ZB - 0.02, -1), (ZF + 0.03, 1)):   # odciąg żerdzi do kołka przed i za namiotem
    stick('base', 'rope', (0.0, RH + 0.01, z), (0.0, 0.06, z + dz * 0.12), 0.003, seg=4)
    stick('base', 'woodDark', (0.0, -0.01, z + dz * 0.13), (0.0, 0.075, z + dz * 0.125), 0.008, seg=5)

# ---------------- w środku i przy wejściu ----------------
# tobołek w nogach posłań (pod tylną ścianą, środek) i kamienie paleniska przed wejściem z popiołem
b.box('interior', 'sack', 0.12, 0.07, 0.08, 0.0, P, ZB + 0.09, rot=0.3)
b.box('interior', 'rope', 0.13, 0.012, 0.018, 0.0, P + 0.045, ZB + 0.09, rot=0.3)
FX, FZ = 0.16, ZF + 0.12
for k in range(6):
    a = 2 * math.pi * k / 6
    b.crystal('base', 'rockDark', FX + math.cos(a) * 0.07, 0.0, FZ + math.sin(a) * 0.055, 0.026, seed=k, sy=0.7)
b.box('base', 'ash', 0.09, 0.006, 0.07, FX, 0.0, FZ)
for k in range(2):
    b.box('base', 'woodDark', 0.1, 0.018, 0.018, FX, 0.008, FZ + (k - 0.5) * 0.03, rot=0.6 - k * 1.2)
t.open.append([-0.25, 0.25, ZB + 0.05, ZF + 0.12])
# spacerem do namiotu wchodzi się tylko od przodu: połacie po bokach i tylna ściana zatrzymują
for s in (-1, 1):
    t.block(s * 0.27, s * 0.46, ZB - 0.05, ZF + 0.02)
t.block(-0.46, 0.46, ZB - 0.1, ZB + 0.03)

VIEWS = [
    ['namiot od wejścia', [0.25, 0.45, 1.5], [0, 0.25, 0], ['base'], 22],
    ['z tyłu', [-0.4, 0.5, -1.6], [0, 0.22, 0], ['base'], 22],
    ['wnętrze przez wejście', [0.0, 0.25, 0.75], [0, 0.12, -0.3], ['base', 'interior', 'floor'], 18],
]
b.save('tent', maxe=0.2, rays=14, reach=0.25, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': [], 'flames': [],
    # dym z ogniska przed wejściem (gra puszcza go zimą, gdy ktoś jest w środku — jak komin chaty)
    'chimneys': [[FX, 0.05, FZ]],
    'pennant': [0.0, round(RH + 0.04, 3), round(ZF + 0.1, 3)], 'views': VIEWS})
