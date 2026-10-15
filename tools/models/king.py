"""Pan zamku (król): długa szata do ziemi ze złotym obszyciem, płaszcz w barwach pana spływający z ramion,
gronostajowy kołnierz (biały z czarnymi ogonkami), złoty pas, siwa broda i złota korona z zębami i kamieniami.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/king.py
Wynik: src/render/models/king.json — części ciała dla Figures('king').
Kolory z gry: płaszcz i rękawy = 'tunic' (czysta barwa pana), reszta stała (szata, złoto, gronostaj).
Kotwice jak u chłopa: biodro (±0,05; 0,22), bark (±0,13; 0,45), dłoń 0,185 pod barkiem.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, evaluated, hexrgb, lathe, reset, skin, sphere  # noqa: E402

reset()
from body import Head, finish, smooth  # noqa: E402

WHITE = (1.0, 1.0, 1.0)
ROBE, GOLD, ERMINE, SHOE, GEM, BEARD = hexrgb(0x3a2a24), hexrgb(0xd9a93a), hexrgb(0xf0ece2), hexrgb(0x2a1d14), hexrgb(0xb01c1c), hexrgb(0xb8b2a8)

HIP = (0.05, 0.22, 0.0)
SHOULDER = (0.13, 0.45, 0.0)
HAND = (0.0, -0.185, 0.004)

# ---------- noga: pod szatą tylko trzewik ----------
leg = skin('kleg', [(0, 0, 0), (0, -0.11, 0.004), (0, -0.19, 0.0)], [(0, 1), (1, 2)], [(0.04, 0.04), (0.03, 0.031), (0.027, 0.027)], subsurf=1)
leg_m = Mesh(evaluated(leg), (0.3, 0.24, 0.2), 'cloth')
shoe = skin('kshoe', [(0, -0.18, 0), (0, -0.214, 0.0), (0, -0.218, 0.05)], [(0, 1), (1, 2)], [(0.031, 0.031), (0.031, 0.02), (0.024, 0.014)], subsurf=1)
shoe_m = Mesh(evaluated(shoe), lambda x, y, z: tuple(c * (0.75 if y < -0.228 else 1) for c in SHOE), 'leather')

# ---------- ręka: szeroki rękaw w barwie pana ze złotym mankietem, dłoń ----------
arm = lathe('karm', [(0.001, 0.034), (0.024, 0.03), (0.035, 0.01), (0.035, -0.02), (0.034, -0.07), (0.035, -0.12), (0.038, -0.15), (0.034, -0.158)], seg=12, subsurf=0)
arm_m = Mesh(evaluated(arm), lambda x, y, z: (0.85 + 0.08 * math.sin(y * 60),) * 3, 'cloth', dyn='tunic')
cuff = lathe('kcuff', [(0.036, -0.14), (0.039, -0.146), (0.039, -0.158), (0.033, -0.162)], seg=12, subsurf=0)
cuff_m = Mesh(evaluated(cuff), GOLD, 'metal')
hand = skin('khand', [(0, -0.158, 0.002), (0, -0.188, 0.005), (0, -0.205, 0.008)], [(0, 1), (1, 2)], [(0.02, 0.018), (0.024, 0.016), (0.018, 0.012)], subsurf=1)
hand_m = Mesh(evaluated(hand), WHITE, 'skin', dyn='skin')

# ---------- szata do ziemi z fałdami, złoty obrąbek ----------
FOLDS = 11
robe = lathe('krobe', [(0.0, 0.004), (0.148, 0.004), (0.152, 0.03), (0.14, 0.1), (0.122, 0.18), (0.104, 0.25), (0.094, 0.3), (0.09, 0.32)], seg=36, depth=0.82, subsurf=0)
bm = evaluated(robe)
for v in bm.verts:
    x, y, z = v.co.x, v.co.z, -v.co.y
    r = math.hypot(x, z)
    if r < 1e-4:
        continue
    a = math.atan2(x, z)
    k = 1 + 0.06 * math.sin(a * FOLDS) * smooth(0.32, 0.05, y)
    v.co.x, v.co.y = x * k, -(z * k)
robe_m = Mesh(bm, lambda x, y, z: GOLD if y < 0.04 else tuple(c * (0.9 + 0.1 * math.sin(math.atan2(x, z) * FOLDS)) for c in ROBE), 'cloth')
# złoty pas ze sprzączką
belt = lathe('kbelt', [(0.094, 0.29), (0.098, 0.297), (0.098, 0.31), (0.094, 0.316)], seg=24, depth=0.8, subsurf=0)
belt_m = Mesh(evaluated(belt), GOLD, 'metal')
buckle = Mesh(evaluated(sphere('kbuckle', (0, 0.303, 0.08), (0.016, 0.014, 0.006), seg=8, rings=5)), GOLD, 'metal')

# ---------- tułów w szacie, płaszcz w barwach pana z ramion do ziemi ----------
torso = lathe('ktorso', [(0.09, 0.3), (0.088, 0.33), (0.098, 0.38), (0.105, 0.42), (0.102, 0.448), (0.08, 0.472), (0.05, 0.488), (0.032, 0.494)], seg=22, depth=0.76, subsurf=0)
torso_m = Mesh(evaluated(torso), lambda x, y, z: tuple(c * (0.9 + 0.3 * (y - 0.3)) for c in ROBE), 'cloth')
# płaszcz: półkole z tyłu i po bokach (z przodu rozchylony), szerszy ku dołowi
cloak = lathe('kcloak', [(0.162, 0.006), (0.156, 0.08), (0.14, 0.2), (0.125, 0.32), (0.118, 0.4), (0.112, 0.445), (0.09, 0.47)], seg=26, depth=0.86, phi0=0.55, phi=2 * math.pi - 1.1, subsurf=0)
cbm = evaluated(cloak)
for v in cbm.verts:
    x, y, z = v.co.x, v.co.z, -v.co.y
    a = math.atan2(x, z)
    k = 1 + 0.05 * math.sin(a * 7) * smooth(0.4, 0.05, y)
    v.co.x, v.co.y = x * k, -(z * k)
cloak_m = Mesh(cbm, lambda x, y, z: (0.62 if y < 0.03 else 0.85 + 0.15 * math.sin(math.atan2(x, z) * 7),) * 3, 'cloth', dyn='tunic')
# gronostajowy kołnierz: biały wałek z czarnymi ogonkami
collar = lathe('kcollar', [(0.12, 0.43), (0.128, 0.445), (0.118, 0.465), (0.09, 0.482), (0.06, 0.49)], seg=24, depth=0.86, subsurf=0)


def ermine(x, y, z):
    a = math.atan2(x, z)
    spot = math.sin(a * 9) > 0.86 and math.sin(y * 260) > 0.3
    return (0.08, 0.07, 0.07) if spot else ERMINE


collar_m = Mesh(evaluated(collar), ermine, 'cloth')

# ---------- głowa: siwa broda, złota korona z zębami i kamieniami ----------
head = Head((0.0, 0.548, 0.004), (0.054, 0.065, 0.058))
neck = lathe('kneck', [(0.027, 0.47), (0.027, 0.5), (0.029, 0.52)], seg=10, subsurf=0)
neck_m = Mesh(evaluated(neck), WHITE, 'skin', dyn='skin')
hair = head.shell('khair', 1.09, lambda x, y, z: smooth(0.0, 0.12, y - (0.12 + 0.5 * z)), dyn=None, shade=lambda x, y, z: BEARD)
beard = head.shell('kbeard', 1.08, head.beard_mask(), dyn=None, shade=lambda x, y, z: BEARD)
crown = lathe('kcrown', [(0.056, 0.588), (0.06, 0.592), (0.061, 0.614), (0.058, 0.618)], seg=24, subsurf=0)
crown_m = Mesh(evaluated(crown), GOLD, 'metal')
teeth = []
for k in range(8):
    a = 2 * math.pi * k / 8
    x, z = math.sin(a) * 0.059, math.cos(a) * 0.059
    t = skin(f'ktooth{k}', [(x, 0.614, z), (x * 1.02, 0.646, z * 1.02)], [(0, 1)], [(0.011, 0.005), (0.002, 0.002)], subsurf=0)
    teeth.append(Mesh(evaluated(t), GOLD, 'metal'))
    teeth.append(Mesh(evaluated(sphere(f'kball{k}', (x * 1.03, 0.649, z * 1.03), (0.005, 0.005, 0.005), seg=6, rings=4)), GOLD, 'metal'))
    if k % 2 == 0:
        teeth.append(Mesh(evaluated(sphere(f'kgem{k}', (x * 1.06, 0.603, z * 1.06), (0.007, 0.007, 0.004), seg=6, rings=4)), GEM, 'metal'))

static = [robe_m, belt_m, buckle, torso_m, cloak_m, collar_m, head.skin, neck_m, *head.ears(), *head.eyes(), *head.brows(dyn=None),
          hair, beard, crown_m, *teeth]
finish('king', static, [leg_m, shoe_m], [arm_m, cuff_m, hand_m], HIP, SHOULDER, HAND)
