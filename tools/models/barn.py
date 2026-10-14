"""Stodoła (3×2 pola): drewniana, z desek na słupach, na kamiennej podmurówce; wysoka strzecha, szerokie wrota
otwarte na oścież (skrzydła odchylone na zewnątrz), nad nimi okienko strychu z belką do wciągania siana.
W środku tylko puste klepisko: zapasy składu układa na nim gra, według tego, co leży w stodole. Przed wrotami bele siana, kopka z widłami i oparte koło od wozu.
Dach i szczyty (grupa 'shell') znikają przy podglądzie wnętrza.

Uruchomienie (z katalogu repo):  python tools/models/barn.py
Układ: środek działki = (0, 0), 1 = jedno pole, przód (wrota) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from timber import Timber  # noqa: E402

b = Building()
t = Timber(b, T=0.07)
T = t.T

P = 0.14                          # klepisko
X0, X1, Z0, Z1 = -1.3, 1.3, -0.82, 0.72
H1 = P + 0.95
RISE = 0.95
GATE = (-0.5, 0.5, 0.86)

# ---------------- podmurówka, klepisko ----------------
b.box('base', 'stone', X1 - X0 + 0.08, P, Z1 - Z0 + 0.08, 0, 0, (Z0 + Z1) / 2)
b.box('base', 'stoneDark', X1 - X0 + 0.14, 0.04, Z1 - Z0 + 0.14, 0, 0, (Z0 + Z1) / 2)
b.box('floor', 'soil', X1 - X0 - 2 * T, 0.01, Z1 - Z0 - 2 * T, 0, P, (Z0 + Z1) / 2)
# rampa z dyli przed wrotami (wjazd na podmurówkę)
b.box('base', 'roadWood', GATE[1] - GATE[0] + 0.1, 0.05, 0.3, 0, 0.0, Z1 + 0.14, tilt=-0.28)

# ---------------- ściany z desek na słupach ----------------
t.wall_x('base', 'plank', Z1 - T / 2, X0, X1, P, H1, [(GATE[0], GATE[1], P, P + GATE[2])])
t.wall_x('base', 'plank', Z0 + T / 2, X0, X1, P, H1, [])
t.wall_z('base', 'plank', X0 + T / 2, Z0 + T, Z1 - T, P, H1, [(-0.17, 0.07, P + 0.5, P + 0.72)])
t.wall_z('base', 'plank', X1 - T / 2, Z0 + T, Z1 - T, P, H1, [(-0.17, 0.07, P + 0.5, P + 0.72)])
for sx in (-1, 1):
    t.window('base', sx * (X1 - T / 2), P + 0.5, P + 0.72, -0.05, 0.24, sx, 0, shutters=False)
# słupy, podwaliny i oczepy z ciemnego drewna, zastrzały w narożnikach
t.frame_x('base', Z1 - T / 2, X0, X1, P, H1, [X0 + 0.03, -0.9, GATE[0] - 0.04, GATE[1] + 0.04, 0.9, X1 - 0.03], braces=False)
t.frame_x('base', Z0 + T / 2, X0, X1, P, H1, [X0 + 0.03, -0.45, 0.45, X1 - 0.03], out=-1)
t.frame_z('base', X0 + T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.25, 0.15, Z1 - 0.03], out=-1)
t.frame_z('base', X1 - T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.25, 0.15, Z1 - 0.03])
for sx in (-1, 1):   # pionowe listwy na deskach (rytm desek widać z daleka)
    for k in range(4):
        x = sx * (GATE[1] + 0.1 + k * 0.17)
        if abs(x) < X1 - 0.08 and abs(abs(x) - 0.9) > 0.05:
            b.box('base', 'woodDark', 0.025, H1 - P - 0.1, 0.014, x, P + 0.05, Z1 + 0.003)
# wrota: dwa skrzydła z desek, okute, z zastrzałem w kształcie Z, odchylone na zewnątrz
for sx in (-1, 1):
    hx, hz = sx * GATE[1], Z1 + 0.02          # zawias
    w2 = (GATE[1] - GATE[0]) / 2               # skrzydło = pół wrót
    th = math.radians(112)                     # odchylone na zewnątrz, trochę dalej niż prostopadle
    dx, dz = -sx * math.cos(th), math.sin(th)  # kierunek od zawiasu do krawędzi skrzydła
    rot = math.atan2(-dz, dx)
    mx, mz = hx + dx * w2 / 2, hz + dz * w2 / 2
    b.box('base', 'wood', w2, GATE[2] - 0.02, 0.035, mx, P, mz, rot)
    nx, nz = math.sin(rot), math.cos(rot)       # normalna skrzydła (do listew)
    for yy in (P + 0.12, P + GATE[2] - 0.16):
        b.box('base', 'woodDark', w2 - 0.03, 0.05, 0.02, mx + nx * 0.025, yy, mz + nz * 0.025, rot)
        b.box('base', 'woodDark', w2 - 0.03, 0.05, 0.02, mx - nx * 0.025, yy, mz - nz * 0.025, rot)
    ln = math.hypot(w2 - 0.08, GATE[2] - 0.36)
    b.box('base', 'woodDark', 0.045, ln, 0.02, mx + nx * 0.025 - dx * (w2 / 2 - 0.05), P + 0.15, mz + nz * 0.025 - dz * (w2 / 2 - 0.05), rot,
          roll=-math.atan2(w2 - 0.08, GATE[2] - 0.36))
    for yy in (P + 0.15, P + GATE[2] - 0.2):
        b.box('base', 'iron', 0.04, 0.05, 0.04, hx, yy, hz)
b.box('base', 'woodDark', GATE[1] - GATE[0] + 0.12, 0.07, T + 0.04, 0, P + GATE[2], Z1 - T / 2)
# pod wrotami: próg z bala
b.box('base', 'woodDark', GATE[1] - GATE[0], 0.03, 0.08, 0, P, Z1 - T / 2)
t.block(X0, GATE[0], Z1 - T, Z1); t.block(GATE[1], X1, Z1 - T, Z1)
t.block(X0, X1, Z0, Z0 + T); t.block(X0, X0 + T, Z0, Z1); t.block(X1 - T, X1, Z0, Z1)

# ---------------- dach: gruba strzecha, szczyty z desek, okienko strychu z belką i bloczkiem ----------------
b.gable('shell', 'thatch', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1, RISE, along_x=True, over=0.18)
b.gable('shell', 'thatchDark', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1 - 0.045, RISE, along_x=True, over=0.22)
for sx, x in ((-1, X0), (1, X1)):
    t.gable_end('shell', 'plank', x, Z0, Z1, H1, RISE, out=sx)
b.box('shell', 'thatchDark', X1 - X0 + 0.5, 0.08, 0.15, 0, H1 + RISE - 0.04, (Z0 + Z1) / 2)
for k in range(6):
    b.box('shell', 'woodDark', 0.025, 0.025, 0.22, X0 + 0.15 + k * (X1 - X0 - 0.3) / 5, H1 + RISE + 0.03, (Z0 + Z1) / 2)
# lukarna nad wrotami: daszek dwuspadowy prostopadle do strzechy, otwór strychu, belka z bloczkiem
LZ0, LZ1 = Z1 - 0.35, Z1 + 0.06
LY = H1 + 0.02
t.wall_x('shell', 'plank', LZ1 - 0.03, -0.27, 0.27, LY - 0.06, LY + 0.32, [(-0.14, 0.14, LY + 0.02, LY + 0.27)], depth=0.05)
b.box('shell', 'dark', 0.28, 0.25, 0.01, 0, LY + 0.02, LZ1 - 0.06)
for sx in (-1, 1):
    b.poly('shell', 'plank', [(sx * 0.27, LY - 0.06, LZ0), (sx * 0.27, LY - 0.06, LZ1), (sx * 0.27, LY + 0.32, LZ1), (sx * 0.27, LY + 0.32, LZ0)], away=(0, LY, (LZ0 + LZ1) / 2))
b.gable('shell', 'thatch', -0.3, 0.3, LZ0, LZ1 + 0.02, LY + 0.32, 0.22, along_x=False, over=0.06, end_mat='plank')
b.box('shell', 'woodDark', 0.06, 0.06, 0.35, 0, LY + 0.34, LZ1 + 0.12)
b.box('shell', 'iron', 0.012, 0.3, 0.012, 0, LY + 0.04, LZ1 + 0.26)
b.prism('shell', 'woodDark', 0.03, 0.03, 0.04, 0, LY + 0.3, LZ1 + 0.26, seg=8)

# ---------------- wnętrze: puste klepisko — zapasy składu układa na nim gra (dynamicznie, według stanu) ----------------
t.open.append([X0 + T, X1 - T, Z0 + T, Z1 - T])
t.open.append([GATE[0], GATE[1], Z1 - T - 0.02, Z1 + 0.05])

# ---------------- przed wrotami: bele siana, kopka z widłami, koło od wozu ----------------
def bale(x, z, r=0.17, ln=0.3, rot=0.0):
    seg = 12
    c, s = math.cos(rot), math.sin(rot)
    def P3(u, a):
        ax, ay, az = u, r + math.cos(a) * r, math.sin(a) * r
        return (x + ax * c + az * s, ay, z - ax * s + az * c)
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        b.poly('base', 'hay', [P3(-ln / 2, a0), P3(ln / 2, a0), P3(ln / 2, a1), P3(-ln / 2, a1)], away=(x, r, z))
    for u in (-ln / 2, ln / 2):
        b.poly('base', 'thatchDark', [P3(u, 2 * math.pi * k / seg) for k in range(seg)], away=(x - u * c * 4, r, z + u * s * 4))
bale(1.0, 1.05, rot=0.3)
bale(0.62, 1.12, rot=-0.2)
# kopka siana (stożek) z wbitymi widłami
b.prism('base', 'hay', 0.3, 0.16, 0.28, -0.98, 0.0, 1.08, seg=12)
b.prism('base', 'hay', 0.16, 0.0, 0.16, -0.98, 0.28, 1.08, seg=12)
b.box('base', 'woodDark', 0.022, 0.6, 0.022, -0.9, 0.2, 1.08, roll=-0.35)
# koło od wozu oparte o ścianę
WX, WZ, WR = X0 - 0.06, 0.25, 0.22
ring = []
for k in range(14):
    a = 2 * math.pi * k / 14
    ring.append((WX, WR + 0.02 + math.cos(a) * WR, WZ + math.sin(a) * WR))
for k in range(14):
    p0, p1 = ring[k], ring[(k + 1) % 14]
    b.poly('base', 'woodDark', [p0, p1, (p1[0] - 0.04, p1[1], p1[2]), (p0[0] - 0.04, p0[1], p0[2])], away=(WX, WR, WZ))
    b.poly('base', 'woodDark', [(p0[0] - 0.04, p0[1], p0[2]), (p1[0] - 0.04, p1[1], p1[2]), p1, p0], away=(WX, WR, WZ))
for k in range(4):
    a = math.pi * k / 4
    b.box('base', 'wood', 0.02, 0.02, WR * 2 - 0.02, WX - 0.02, WR + 0.02 - 0.01, WZ, a)

E = P + 0.46
OUT, ROOM = ['base', 'shell'], ['base', 'interior', 'floor', 'ceiling']
VIEWS = [
    ['stodoła z przodu', [0.3, 0.6, 3.0], [0, 0.6, 0], OUT, 22],
    ['przez wrota', [0.0, E, 1.4], [0, 0.4, -0.6], ['base', 'shell', 'interior', 'floor'], 18],
]
b.save('barn', maxe=0.28, rays=16, reach=0.4, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': t.windows, 'chimneys': [], 'flames': [],
    'pennant': [round(X0 - 0.05, 3), round(H1 + RISE - 0.1, 3), round((Z0 + Z1) / 2, 3)], 'views': VIEWS})
