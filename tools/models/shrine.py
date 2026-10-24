"""Kapliczka (2×2 pola): kamienny posąg Ojca Płomienia w ostrołukowej niszy.
Na brukowanej płycie dwustopniowy cokół z ciosów, za nim dwa filary z ostrołukiem i tylną płytą, na zworniku
złota tarcza słońca z promieniami. Posąg: brodaty starzec w kapturze i długiej szacie, w obu dłoniach przed piersią
trzyma kamienną czarę z wiecznym ogniem (płomień rysuje gra). Po bokach żelazne świeczniki z grubymi świecami,
na dolnym stopniu kilka małych świec z zaciekami wosku i złota misa z ofiarną rudą; przed kapliczką klęcznik z desek.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/shrine.py
Układ: środek działki = (0, 0), 1 = jedno pole, przód (klęcznik, tu ludzie się modlą) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from common import evaluated, lathe, reset, skin, sphere  # noqa: E402
from logs import log  # noqa: E402

reset()
b = Building()
lights, flames = [], []

SZ = -0.42          # oś posągu (głębiej w działce, z przodu miejsce na modlących)
P = 0.06            # wierzch płyty
S1, S2 = P + 0.1, P + 0.22   # wierzchy stopni cokołu


def slab(group, mat, pts, z0, z1):
    """Płyta z grubością: wielokąt wypukły w płaszczyźnie xy, wyciągnięty od z0 do z1 (wszystkie ściany zamknięte)"""
    n = len(pts)
    f = [(x, y, z1) for x, y in pts]
    k = [(x, y, z0) for x, y in pts]
    cx = sum(x for x, _ in pts) / n
    cy = sum(y for _, y in pts) / n
    cen = (cx, cy, (z0 + z1) / 2)
    b.poly(group, mat, f, away=cen)
    b.poly(group, mat, k, away=cen)
    for i in range(n):
        j = (i + 1) % n
        b.poly(group, mat, [f[i], f[j], k[j], k[i]], away=cen)


# ---------------- płyta z bruku i cokół ----------------
b.box('base', 'castleDark', 1.62, P, 1.5, 0, 0, -0.1)
# obramowanie płyty: krawężniki z ciosów (lekko wyżej niż płyta)
for x0, x1 in ((-0.81, -0.27), (-0.27, 0.27), (0.27, 0.81)):
    b.box('base', 'cutDark', x1 - x0 - 0.01, P + 0.02, 0.09, (x0 + x1) / 2, 0, 0.62)
b.box('base', 'cut', 1.0, S1 - P, 0.72, 0, P, SZ + 0.02)
b.box('base', 'castle', 0.76, S2 - S1, 0.5, 0, S1, SZ - 0.03)
# gzyms na górnym stopniu (wystaje o kilka milimetrów)
b.box('base', 'cutDark', 0.8, 0.025, 0.54, 0, S2 - 0.012, SZ - 0.03)

# ---------------- filary, ostrołuk i tylna płyta ----------------
PX, PW = 0.44, 0.15          # oś filara, szerokość
PZ0, PZ1 = SZ - 0.36, SZ - 0.16
SPRING = 1.12                # linia wezgłowia łuku
IN = PX - PW / 2             # lico wewnętrzne filara
for sx in (-1, 1):
    b.box('base', 'castleDark', PW + 0.05, 0.09, PZ1 - PZ0 + 0.05, sx * PX, P, (PZ0 + PZ1) / 2)      # cokół filara
    b.box('base', 'castle', PW, SPRING - P - 0.09, PZ1 - PZ0, sx * PX, P + 0.09, (PZ0 + PZ1) / 2)
    b.box('base', 'cutDark', PW + 0.04, 0.05, PZ1 - PZ0 + 0.04, sx * PX, SPRING - 0.05, (PZ0 + PZ1) / 2)  # głowica

R_IN = 0.55
R_OUT = R_IN + 0.13
NSEG = 7


def arc_pt(side, r, t):
    """Punkt łuku: side = -1 lewa połowa, +1 prawa; t = 0 przy wezgłowiu, 1 w kluczu"""
    cx = -side * (R_IN - IN)                     # środek łuku leży po przeciwnej stronie osi (łuk ostry)
    a0 = math.pi if side < 0 else 0.0
    a1 = math.acos(-cx / R_IN)                   # kąt, przy którym łuk dochodzi do osi (klucz)
    a = a0 + (a1 - a0) * t
    return (cx + math.cos(a) * r, SPRING + math.sin(a) * r)


for side in (-1, 1):
    for k in range(NSEG):
        t0, t1 = k / NSEG, (k + 1) / NSEG
        q = [arc_pt(side, R_IN, t0), arc_pt(side, R_IN, t1), arc_pt(side, R_OUT, t1), arc_pt(side, R_OUT, t0)]
        if side > 0:
            q = list(reversed(q))
        slab('base', 'castle' if k % 2 else 'castleDark', q, PZ0, PZ1)
# zwornik: klin w kluczu łuku
apex_in = arc_pt(-1, R_IN, 1.0)
apex_out = arc_pt(-1, R_OUT, 1.0)
slab('base', 'cut', [(0, apex_in[1] - 0.04), (0.07, apex_in[1] + 0.05), (0, apex_out[1] + 0.06), (-0.07, apex_in[1] + 0.05)], PZ0 - 0.01, PZ1 + 0.012)
# tylna płyta niszy: wypełnia łuk od cokołu do ostrołuku (za posągiem, cofnięta)
back = [(-IN, P), (IN, P)] + [arc_pt(1, R_IN - 0.005, k / 10) for k in range(11)] + [arc_pt(-1, R_IN - 0.005, 1 - k / 10) for k in range(1, 11)]
slab('base', 'stoneDark', back, PZ0 + 0.04, PZ0 + 0.07)      # lico niszy: ciemny kamień
slab('base', 'castle', back, PZ0 + 0.01, PZ0 + 0.039)      # tył niszy: zwykłe ciosy jak filary
# ramy niszy w tylnej płycie: dwa wąskie pilastry
for sx in (-1, 1):
    b.box('base', 'cutDark', 0.05, SPRING - S2, 0.03, sx * (IN - 0.04), S2, PZ0 + 0.085)

# tarcza słońca na tylnej płycie nad głową posągu: złoty krąg i promienie (zamknięte bryły)
SUN = (0, 1.47, PZ0 + 0.075)       # wysoko pod kluczem łuku, wyraźnie nad głową posągu
SR = 0.08
ring_f = [(SUN[0] + math.cos(2 * math.pi * k / 16) * SR, SUN[1] + math.sin(2 * math.pi * k / 16) * SR) for k in range(16)]
slab('base', 'gold', ring_f, SUN[2], SUN[2] + 0.025)
for k in range(12):
    a = 2 * math.pi * k / 12 + math.pi / 12
    L = 0.17 if k % 2 else 0.13
    w = 0.022
    ca, sa = math.cos(a), math.sin(a)
    ray = [(SR * 0.9 * ca - w * sa, SUN[1] + SR * 0.9 * sa + w * ca), (L * ca, SUN[1] + L * sa),
           (SR * 0.9 * ca + w * sa, SUN[1] + SR * 0.9 * sa - w * ca)]
    slab('base', 'gold', ray, SUN[2] + 0.003, SUN[2] + 0.018)

# ---------------- posąg (rzeźba z Blendera: Skin + wygładzenie) ----------------
Y0 = S2                        # stopy posągu na górnym stopniu
def V(x, y, z):
    return (x, Y0 + y, SZ + z)


# szkielet: szata od ziemi do barków, szyja, głowa w kapturze; ręce od barków do dłoni przy czarze
verts = [V(0, 0.0, 0), V(0, 0.16, 0), V(0, 0.36, 0), V(0, 0.55, 0), V(0, 0.62, 0), V(0, 0.68, 0), V(0, 0.76, -0.01),
         V(-0.14, 0.6, 0), V(-0.16, 0.47, 0.04), V(-0.06, 0.43, 0.11),
         V(0.14, 0.6, 0), V(0.16, 0.47, 0.04), V(0.06, 0.43, 0.11)]
edges = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (3, 7), (7, 8), (8, 9), (3, 10), (10, 11), (11, 12)]
radii = [(0.15, 0.12), (0.14, 0.11), (0.13, 0.1), (0.15, 0.09), (0.065, 0.055), (0.04, 0.04), (0.07, 0.075),
         (0.06, 0.055), (0.05, 0.05), (0.032, 0.036), (0.06, 0.055), (0.05, 0.05), (0.032, 0.036)]
body = skin('statue', verts, edges, radii, subsurf=2)
# kaptur: większa, wydłużona do tyłu powłoka na głowie, z przodu otwarta na twarz (twarz to osobna bryła wpuszczona w głąb)
def hood_shape(x, y, z):
    # kaptur mnisi: z tyłu zakończony szpicem opadającym na kark, z przodu ścięty (otwór na twarz)
    if y > 0.2 and z < 0:
        z -= (y - 0.2) * 0.35 * -z
    return (x, y + max(0.0, y - 0.6) * 0.5, min(z, 0.45))


hood = sphere('hood', V(0, 0.78, -0.02), (0.085, 0.092, 0.088), shape=hood_shape)
face = sphere('face', V(0, 0.765, 0.045), (0.05, 0.062, 0.045))
nose = skin('nose', [V(0, 0.78, 0.085), V(0, 0.755, 0.098)], [(0, 1)], [(0.01, 0.01), (0.013, 0.012)], subsurf=1)
# broda: stożek z twarzy na pierś
beard = skin('beard', [V(0, 0.735, 0.07), V(0, 0.68, 0.085), V(0, 0.6, 0.09), V(0, 0.54, 0.085)], [(0, 1), (1, 2), (2, 3)],
             [(0.045, 0.025), (0.045, 0.025), (0.035, 0.02), (0.01, 0.01)], subsurf=1)
# czara z wiecznym ogniem w dłoniach
bowl = lathe('bowl', [(0.0, 0.0), (0.035, 0.0), (0.06, 0.035), (0.075, 0.07), (0.062, 0.07), (0.045, 0.04), (0.0, 0.04)], seg=16, subsurf=0)
# pas szaty: wałek w talii
belt = skin('belt', [V(-0.1, 0.4, 0.0), V(0, 0.4, 0.09), V(0.1, 0.4, 0.0)], [(0, 1), (1, 2)], [(0.016, 0.016)] * 3, subsurf=1)


def push(ob, mat, off=(0.0, 0.0, 0.0)):
    bm = evaluated(ob)
    for f in bm.faces:
        pts = []
        for v in f.verts:
            c = v.co
            pts.append((c.x + off[0], c.z + off[1], -c.y + off[2]))
        b.poly('base', mat, pts)
    bm.free()


push(body, 'cut')
push(hood, 'cut')
push(face, 'cutDark')
push(nose, 'cutDark')
push(beard, 'cutDark')
push(belt, 'cutDark')
push(bowl, 'castleDark', (0, Y0 + 0.43, SZ + 0.15))
flames.append([0, Y0 + 0.48, SZ + 0.15])
lights.append([0, Y0 + 0.55, SZ + 0.15])

# ---------------- świeczniki i świece ----------------


def candle(x, y, z, h, r=0.02, lit=True):
    b.prism('base', 'white', r, r * 0.95, h, x, y, z, seg=8)
    # zacieki wosku: krople przy brzegu i wosk rozlany u stóp
    b.prism('base', 'white', r * 1.6, r * 1.2, 0.008, x, y, z, seg=8)
    for k in range(2):
        a = k * 2.4 + x * 9
        b.prism('base', 'white', 0.006, 0.003, h * 0.5, x + math.sin(a) * r * 0.95, y + h * 0.45, z + math.cos(a) * r * 0.95, seg=5)
    b.prism('base', 'dark', 0.003, 0.003, 0.012, x, y + h, z, seg=4)          # knot
    if lit:
        b.prism('base', 'flameLight', 0.011, 0.0, 0.04, x, y + h + 0.008, z, seg=6)
        b.prism('base', 'flameCore', 0.006, 0.0, 0.022, x, y + h + 0.009, z, seg=6)


for sx in (-1, 1):
    x, z = sx * 0.4, SZ + 0.26
    b.prism('base', 'iron', 0.06, 0.05, 0.02, x, P, z, seg=8)                 # stopa
    log(b, 'base', 'iron', (x, P + 0.02, z), (x, P + 0.36, z), r=0.012, seg=6, ends='iron')
    for k in range(3):                                                          # skręcany pręt: zgrubienia
        b.prism('base', 'iron', 0.018, 0.018, 0.02, x, P + 0.1 + k * 0.08, z, seg=6)
    b.prism('base', 'iron', 0.05, 0.055, 0.015, x, P + 0.36, z, seg=10)        # talerz
    candle(x, P + 0.375, z, 0.11, r=0.024)
    lights.append([x, P + 0.52, z])
# małe świece na dolnym stopniu
for (x, z, h) in ((-0.3, SZ + 0.3, 0.05), (-0.22, SZ + 0.33, 0.035), (0.24, SZ + 0.32, 0.06), (0.31, SZ + 0.29, 0.03), (-0.12, SZ + 0.34, 0.025)):
    candle(x, S1, z, h, r=0.014, lit=h > 0.03)

# złota misa z ofiarną rudą na dolnym stopniu, przed posągiem
OX, OZ = 0.0, SZ + 0.3
b.prism('base', 'gold', 0.03, 0.06, 0.035, OX, S1, OZ, seg=12, top=False)
b.prism('base', 'dark', 0.055, 0.055, 0.003, OX, S1 + 0.028, OZ, seg=12)
for k, (dx, dz, r) in enumerate(((0.0, 0.0, 0.022), (0.025, 0.012, 0.016), (-0.022, 0.015, 0.015), (0.008, -0.022, 0.014))):
    b.crystal('base', 'magicOre', OX + dx, S1 + 0.03, OZ + dz, r, seed=k * 1.7)

# ---------------- klęcznik z desek przed kapliczką ----------------
KZ = 0.38
b.box('base', 'woodDark', 0.62, 0.06, 0.14, 0, 0, KZ)                            # poduszka do klęczenia (deska na legarach)
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.04, 0.24, 0.04, sx * 0.27, 0, KZ - 0.1)             # słupki
b.box('base', 'wood', 0.66, 0.035, 0.08, 0, 0.24, KZ - 0.1)                      # poręcz
# zeschnięte wieńce i kępka ziół położone na stopniu (płaskie bryły)
for (x, z) in ((-0.36, SZ + 0.18), (0.36, SZ + 0.16)):
    b.crystal('base', 'leaf', x, S1, z, 0.03, seed=x * 5, sy=0.4)

VIEWS = [
    ['kapliczka (oczy chłopa)', [0.0, 0.5, 1.6], [0, 0.6, SZ], ['base'], 30],
    ['przy klęczniku', [0.15, 0.35, 0.55], [0, 0.75, SZ], ['base'], 26],
    ['z boku', [1.4, 0.6, 0.2], [0, 0.6, SZ], ['base'], 28],
]
b.save('shrine', maxe=0.12, rays=16, reach=0.2, extra={'views': VIEWS, 'flames': flames, 'lights': lights})
