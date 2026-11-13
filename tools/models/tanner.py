"""Garbarnia — kaletnik (2×2 pola, Michał 13.11.2026): skóry od myśliwego wyprawia na skórzane kaftany dla łuczników
i włóczników. Ta sama niska chata z bali pod strzechą co u myśliwego, a obok: dwie kadzie garbarskie przykryte skórami
(zamiast lustra cieczy — woda nigdy nie jest bryłą), ława do mizdrowania (pochyła kłoda z rozłożoną skórą i skrobakiem),
rama ze skórą do suszenia, kopczyk kory dębowej (garbnik) i ława z gotowymi kaftanami. W izbie: stół kaletnika
z kaftanem, szydłem i nićmi, kaftany na kołkach, prycza, piecyk.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/tanner.py
Układ: środek działki = (0, 0), działka ±1, przód (drzwi) = +z. Wejście: pole przed prawą połową przodu.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
chimneys, flames = [], []
solid, open_ = [], []

P = 0.1                               # podłoga izby
X0, X1, Z0, Z1 = -0.22, 0.86, -0.84, 0.2
H1 = P + 0.62                         # okap (niższa niż u drwala: chata przysadzista, strzecha nisko)
RISE = 0.52
DOOR = (0.2, 0.48, 0.52)              # x0, x1, wysokość
LOG = 0.048


def hlog(group, x0, x1, y, z, r=LOG, mat='bark', seg=7, ends='wood'):
    """Poziomy bal wzdłuż x (walec z jaśniejszymi przekrojami na końcach)"""
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        pts = [(x0, y + math.cos(a0) * r, z + math.sin(a0) * r), (x1, y + math.cos(a0) * r, z + math.sin(a0) * r),
               (x1, y + math.cos(a1) * r, z + math.sin(a1) * r), (x0, y + math.cos(a1) * r, z + math.sin(a1) * r)]
        b.poly(group, mat, pts, away=((x0 + x1) / 2, y, z))
    for xx, s in ((x0, -1), (x1, 1)):
        ring = [(xx, y + math.cos(2 * math.pi * k / seg) * r, z + math.sin(2 * math.pi * k / seg) * r) for k in range(seg)]
        b.poly(group, ends, ring, away=(xx - s, y, z))


def zlog(group, z0, z1, y, x, r=LOG, mat='bark', seg=7, ends='wood'):
    """Poziomy bal wzdłuż z"""
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        pts = [(x + math.sin(a0) * r, y + math.cos(a0) * r, z0), (x + math.sin(a0) * r, y + math.cos(a0) * r, z1),
               (x + math.sin(a1) * r, y + math.cos(a1) * r, z1), (x + math.sin(a1) * r, y + math.cos(a1) * r, z0)]
        b.poly(group, mat, pts, away=(x, y, (z0 + z1) / 2))
    for zz, s in ((z0, -1), (z1, 1)):
        ring = [(x + math.sin(2 * math.pi * k / seg) * r, y + math.cos(2 * math.pi * k / seg) * r, zz) for k in range(seg)]
        b.poly(group, ends, ring, away=(x, y, zz - s))


def spruce(group, x, z, h, y=0.0, lean=0.0):
    """Młody świerk: cienki pień i trzy stożki igliwia jeden nad drugim (pełne bryły z denkiem)"""
    b.prism(group, 'bark', 0.012 * h / 0.3 + 0.004, 0.008, h * 0.35, x, y, z, seg=5)
    for k, (r, hh, yy) in enumerate(((0.36, 0.42, 0.18), (0.27, 0.36, 0.42), (0.17, 0.32, 0.64))):
        b.prism(group, 'needle', r * h, 0.004, hh * h, x + lean * yy * h, y + yy * h, z, seg=7, phase=k * 0.4)


def beech(group, x, z, h, y=0.0, seed=0.0):
    """Młody buk albo dąb: pręt pnia i dwie, trzy kępy liści"""
    b.prism(group, 'bark', 0.012, 0.008, h * 0.6, x, y, z, seg=5)
    for k in range(3):
        a = seed + k * 2.1
        r = h * (0.2 - k * 0.03)
        b.crystal(group, 'leaf' if k % 2 == 0 else 'leafLight', x + math.cos(a) * h * 0.08, y + h * (0.55 + k * 0.13), z + math.sin(a) * h * 0.08,
                  r, seed=seed + k, sx=1.0, sy=0.8, sz=1.0)


# ---------------- podmurówka i podłoga ----------------
b.box('base', 'stone', X1 - X0 + 0.1, P, Z1 - Z0 + 0.1, (X0 + X1) / 2, 0, (Z0 + Z1) / 2)
b.box('base', 'stoneDark', X1 - X0 + 0.16, 0.035, Z1 - Z0 + 0.16, (X0 + X1) / 2, 0, (Z0 + Z1) / 2)
b.box('interior', 'plank', X1 - X0 - 0.1, 0.01, Z1 - Z0 - 0.1, (X0 + X1) / 2, P, (Z0 + Z1) / 2)

# ---------------- ściany z bali (węgły z wystającymi końcami), drzwi z przodu, okienko w lewej ścianie (na ramy ze skórami) ----------------
rows = int((H1 - P) / (2 * LOG * 0.92))
for i in range(rows):
    y = P + LOG + i * 2 * LOG * 0.92
    if y < P + DOOR[2]:
        hlog('base', X0 - 0.08, DOOR[0], y, Z1)
        hlog('base', DOOR[1], X1 + 0.08, y, Z1)
    else:
        hlog('base', X0 - 0.08, X1 + 0.08, y, Z1)
    hlog('base', X0 - 0.08, X1 + 0.08, y, Z0)
    ys = y + LOG * 0.92
    if ys + LOG > H1:
        continue
    if 0.22 < ys - P < 0.42:                     # okienko w lewej ścianie
        zlog('base', Z0 - 0.08, -0.5, ys, X0)
        zlog('base', -0.24, Z1 + 0.08, ys, X0)
    else:
        zlog('base', Z0 - 0.08, Z1 + 0.08, ys, X0)
    zlog('base', Z0 - 0.08, Z1 + 0.08, ys, X1)
# okienko: rama, ciemna szyba z błony i uchylona okiennica
b.box('base', 'woodDark', 0.04, 0.2, 0.3, X0 - 0.03, P + 0.27, -0.37)
b.box('base', 'dark', 0.02, 0.14, 0.2, X0 - 0.045, P + 0.3, -0.37)
b.box('base', 'wood', 0.02, 0.16, 0.12, X0 - 0.075, P + 0.29, -0.2, rot=-0.6)
# ościeżnica, nadproże, próg i uchylone drzwi z desek
b.box('base', 'woodDark', 0.05, DOOR[2], 0.13, DOOR[0] - 0.02, P, Z1)
b.box('base', 'woodDark', 0.05, DOOR[2], 0.13, DOOR[1] + 0.02, P, Z1)
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.12, 0.06, 0.13, (DOOR[0] + DOOR[1]) / 2, P + DOOR[2], Z1)
b.box('base', 'stoneDark', DOOR[1] - DOOR[0] + 0.06, 0.03, 0.14, (DOOR[0] + DOOR[1]) / 2, 0.0, Z1 + 0.12)
b.box('interior', 'plank', DOOR[1] - DOOR[0] - 0.02, DOOR[2] - 0.02, 0.025, DOOR[1] - 0.02, P, Z1 - 0.16, -(math.pi / 2 - 0.4))
for yy in (P + 0.09, P + 0.38):
    b.box('interior', 'iron', 0.02, 0.02, 0.18, DOOR[1] - 0.05, yy, Z1 - 0.15, 0.4)
# ---------------- strzecha (dwie warstwy, gruba i nisko opuszczona), szczyty z desek, kalenica z darni, komin ----------------
b.gable('shell', 'thatch', X0 - 0.14, X1 + 0.14, Z0 - 0.04, Z1 + 0.04, H1, RISE, along_x=True, over=0.2, end_mat='thatchDark')
b.gable('shell', 'thatchDark', X0 - 0.14, X1 + 0.14, Z0 - 0.04, Z1 + 0.04, H1 - 0.04, RISE, along_x=True, over=0.23)
for x, s in ((X0, -1), (X1, 1)):
    b.gable_boards('shell', 'plank', 'z', x, Z0, Z1, H1, RISE - 0.01, out=s)
# kalenica: gruby wałek ze słomy związany powrósłami, przykrywa styk połaci (bez płaskiego pasa)
RY, RZ = H1 + RISE - 0.005, (Z0 + Z1) / 2
hlog('shell', X0 - 0.17, X1 + 0.17, RY, RZ, r=0.06, mat='thatchDark', seg=9, ends='thatchDark')
for k in range(7):
    x = X0 - 0.08 + k * (X1 - X0 + 0.16) / 6
    hlog('shell', x - 0.012, x + 0.012, RY, RZ, r=0.066, mat='rope', seg=9, ends='rope')
CX, CZ = X1 - 0.2, Z0 + 0.16
b.box('shell', 'stone', 0.19, RISE + 0.34, 0.19, CX, H1 - 0.05, CZ)
b.box('shell', 'stoneDark', 0.24, 0.05, 0.24, CX, H1 + RISE + 0.29, CZ)
b.box('shell', 'dark', 0.12, 0.005, 0.12, CX, H1 + RISE + 0.34, CZ)
chimneys.append([CX, round(H1 + RISE + 0.36, 3), CZ])




def jerkin(group, x, y, z, s=1.0, yaw=0.0, mat='hide'):
    """Skórzany kaftan wiszący na kołku: tułów z dwóch warstw, rękawy, ciemniejszy pas"""
    c, sn = math.cos(yaw), math.sin(yaw)
    b.box(group, mat, 0.16 * s, 0.2 * s, 0.03 * s, x, y, z, rot=yaw)
    b.box(group, 'hideDark', 0.165 * s, 0.025 * s, 0.035 * s, x, y + 0.05 * s, z, rot=yaw)          # pas
    for side in (-1, 1):
        ox = side * 0.1 * s
        b.box(group, mat, 0.045 * s, 0.13 * s, 0.028 * s, x + ox * c, y + 0.06 * s, z - ox * sn, rot=yaw, roll=side * 0.25)
    b.box(group, 'hideDark', 0.06 * s, 0.03 * s, 0.034 * s, x, y + 0.19 * s, z, rot=yaw)            # kołnierz


# ---------------- izba: stół kaletnika z kaftanem, kaftany na kołkach, prycza, piecyk ----------------
TX, TZ = 0.12, -0.5
b.box('interior', 'wood', 0.42, 0.03, 0.2, TX, P + 0.24, TZ)
for x in (TX - 0.17, TX + 0.17):
    for z in (TZ - 0.07, TZ + 0.07):
        b.box('interior', 'woodDark', 0.03, 0.24, 0.03, x, P, z)
b.box('interior', 'hide', 0.2, 0.012, 0.14, TX - 0.04, P + 0.27, TZ, rot=0.15)               # rozłożona skóra do krojenia
b.box('interior', 'iron', 0.05, 0.005, 0.008, TX + 0.12, P + 0.272, TZ + 0.03, rot=0.6)       # szydło
b.prism('interior', 'rope', 0.014, 0.014, 0.02, TX + 0.14, P + 0.27, TZ - 0.05, seg=8)        # kłębek dratwy
solid.append([TX - 0.22, TX + 0.22, TZ - 0.11, TZ + 0.11])
for k, x in enumerate((0.05, 0.3)):                                                           # kaftany na kołkach (tylna ściana)
    b.box('interior', 'woodDark', 0.015, 0.015, 0.05, x, P + 0.5, Z0 + LOG + 0.03)
    jerkin('interior', x, P + 0.28, Z0 + LOG + 0.04, s=0.95, mat='hide' if k else 'hideLight')
b.box('interior', 'woodDark', 0.24, 0.12, 0.5, X0 + 0.17, P, -0.45)                           # prycza
b.box('interior', 'hay', 0.2, 0.04, 0.46, X0 + 0.17, P + 0.12, -0.45)
solid.append([X0 + 0.04, X0 + 0.3, -0.71, -0.19])
b.box('interior', 'stone', 0.24, 0.28, 0.2, CX, P, CZ + 0.02)                                 # piecyk pod kominem
b.box('interior', 'dark', 0.13, 0.11, 0.02, CX, P + 0.04, CZ + 0.12)
flames.append([CX, round(P + 0.03, 3), round(CZ + 0.1, 3)])
solid.append([CX - 0.13, CX + 0.13, Z0, CZ + 0.13])


def pole(x, z, h, r=0.016):
    b.prism('base', 'bark', r, r * 0.8, h, x, 0.0, z, seg=6)


def hide(x, z, w, h, y0, yaw=0.0, mat='hide'):
    """Skóra rozpięta na ramie: dwie warstwy (gra nie rysuje tylnych ścian)"""
    b.box('base', mat, w, h, 0.006, x, y0, z, rot=yaw)
    b.box('base', mat, w * 0.92, h * 0.94, 0.006, x + math.sin(yaw) * 0.008, y0 + h * 0.03, z + math.cos(yaw) * 0.008, rot=yaw)


# ---------------- po lewej: dwie kadzie garbarskie przykryte skórami ----------------
for k, (vx, vz) in enumerate(((-0.62, -0.55), (-0.62, -0.08))):
    b.tube('base', 'woodDark', 0.17, 0.15, 0.24, vx, 0.0, vz, seg=14)                         # klepki kadzi (z grubością)
    b.prism('base', 'dark', 0.152, 0.152, 0.19, vx, 0.0, vz, seg=14)                          # ciemne wnętrze (garbnik pod skórą)
    for y in (0.04, 0.19):                                                                    # obręcze, odsunięte od klepek
        b.tube('base', 'iron', 0.176, 0.168, 0.025, vx, y, vz, seg=14)
    # skóra przerzucona przez brzeg kadzi: płat na wierzchu i zwis po boku (dwie warstwy)
    b.box('base', 'hideLight' if k else 'hide', 0.3, 0.008, 0.26, vx + 0.02, 0.245, vz, rot=0.3 + k)
    b.box('base', 'hideLight' if k else 'hide', 0.2, 0.14, 0.008, vx + 0.02, 0.11, vz + 0.18, rot=0.3 + k)
    solid.append([vx - 0.19, vx + 0.19, vz - 0.19, vz + 0.19])
# kopczyk kory dębowej (garbnik) przy kadziach
for k in range(9):
    a = k * 0.7
    b.crystal('base', 'bark', -0.36 + math.cos(a) * 0.05 * (k % 3), 0.02 + (k % 3) * 0.025, -0.82 + math.sin(a) * 0.05, 0.045, seed=k * 1.9, sx=1.6, sy=0.5, sz=0.9)
solid.append([-0.45, -0.27, -0.9, -0.74])

# ---------------- rama ze skórą do suszenia (z tyłu po prawej, za chatą widać ją z boku) ----------------
for dz in (-0.17, 0.17):
    pole(-0.8, 0.45 + dz, 0.62)
b.box('base', 'bark', 0.03, 0.03, 0.4, -0.8, 0.56, 0.45, top=True)
b.box('base', 'bark', 0.026, 0.026, 0.38, -0.8, 0.12, 0.45, top=True)
hide(-0.8, 0.45, 0.3, 0.36, 0.17, yaw=math.pi / 2, mat='hideLight')
solid.append([-0.85, -0.75, 0.25, 0.65])

# ---------------- przed chatą: ława do mizdrowania i ława z gotowymi kaftanami ----------------
# pochyła kłoda na dwóch nogach, na niej skóra i skrobak (dwuręczny nóż z rączkami)
b.box('base', 'bark', 0.07, 0.07, 0.62, -0.3, 0.12, 0.6, tilt=-0.38)
for z in (0.42,):
    b.box('base', 'bark', 0.03, 0.26, 0.03, -0.3, 0.0, z)
b.box('base', 'hide', 0.12, 0.008, 0.4, -0.3, 0.165, 0.62, tilt=-0.38)
b.box('base', 'iron', 0.13, 0.008, 0.02, -0.3, 0.2, 0.56, tilt=-0.38)
for side in (-1, 1):
    b.box('base', 'woodDark', 0.02, 0.06, 0.02, -0.3 + side * 0.07, 0.19, 0.56)
solid.append([-0.38, -0.22, 0.32, 0.88])
# ława z kaftanami gotowymi do zbrojowni
b.box('base', 'wood', 0.36, 0.03, 0.14, 0.55, 0.2, 0.62)
for x in (0.4, 0.7):
    b.box('base', 'woodDark', 0.03, 0.2, 0.12, x, 0.0, 0.62)
for k in range(3):
    b.box('base', 'hide' if k % 2 else 'hideLight', 0.16, 0.025, 0.11, 0.55 + (k - 1) * 0.005, 0.23 + k * 0.026, 0.62, rot=(k - 1) * 0.12)
solid.append([0.35, 0.75, 0.53, 0.71])

E = P + 0.38
OUT, ROOM = ['base', 'shell'], ['base', 'interior']
VIEWS = [
    ['garbarnia z przodu', [0.1, 0.5, 2.4], [0, 0.4, 0], OUT, 22],
    ['kadzie', [-0.1, 0.6, 1.2], [-0.6, 0.2, -0.3], OUT, 20],
    ['izba od drzwi', [0.35, E, 0.1], [0.0, 0.25, -0.6], ROOM, 16],
    ['z ziemi przy ławie', [0.1, 0.18, 1.4], [-0.2, 0.25, 0.5], OUT, 24],
]
b.save('tanner', maxe=0.22, rays=16, reach=0.3, extra={
    'solid': solid, 'open': open_, 'floorY': P, 'chimneys': chimneys, 'flames': flames,
    'pennant': [round(X1 + 0.12, 3), round(H1 + RISE - 0.1, 3), round((Z0 + Z1) / 2, 3)], 'views': VIEWS})
