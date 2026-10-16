"""Chłop jak kopacz z Gothica: krótka, postrzępiona koszula z krótkimi rękawami (przygaszone barwy pana), gołe
przedramiona, szeroki skórzany pas z sakiewką, workowate portki do pół łydki z ciemnymi pasami, owijacze i ciężkie buty.

Uruchomienie (z katalogu repo):  python tools/models/peasant.py   (Python z modułem bpy, patrz tools/models/README.md)
Wynik: src/render/models/peasant.json — części ciała dla Figures('peasant').
Kotwice jak dawniej (narzędzia w dłoni): biodro (±0,052; 0,235), bark (±0,135; 0,45), dłoń 0,185 pod barkiem.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, evaluated, hexrgb, lathe, reset, skin, sphere  # noqa: E402

reset()
from body import Head, finish, smooth  # noqa: E402

WHITE = (1.0, 1.0, 1.0)
LINEN, STRAW, SHOE, ROPE, POUCH, WRAP = hexrgb(0xd9ceb0), hexrgb(0xcfae55), hexrgb(0x2a201a), hexrgb(0x8a7350), hexrgb(0x6a4a2e), hexrgb(0x9a8462)
BELT, BUCKLE = hexrgb(0x2e231b), hexrgb(0x8c8a84)

HIP = (0.052, 0.235, 0.0)
SHOULDER = (0.135, 0.45, 0.0)
HAND = (0.0, -0.185, 0.004)

# ---------- noga: workowate portki do pół łydki (barwa z gry) z ciemnymi pasami, owijacze, ciężki but ----------
leg = skin('leg', [(0, 0.01, 0), (0, -0.06, 0.006), (0, -0.115, 0.008), (0, -0.135, 0.004)],
           [(0, 1), (1, 2), (2, 3)],
           [(0.052, 0.052), (0.05, 0.051), (0.045, 0.046), (0.04, 0.041)], subsurf=1)
def leg_col(x, y, z):
    band = -0.105 < y < -0.085 or -0.06 < y < -0.05   # ciemne obszyte pasy pod kolanem
    k = 0.55 if band else 0.86 + 0.08 * math.sin(math.atan2(x, z) * 5 + y * 40)   # fałdy szerokich nogawic
    return (k * (0.9 + 0.1 * smooth(-0.14, 0.0, y)),) * 3
leg_m = Mesh(evaluated(leg), leg_col, 'cloth', dyn='trousers')
shoe = skin('shoe', [(0, -0.172, 0), (0, -0.212, 0.0), (0, -0.216, 0.055)], [(0, 1), (1, 2)],
            [(0.037, 0.037), (0.038, 0.025), (0.03, 0.018)], subsurf=1)
shoe_m = Mesh(evaluated(shoe), lambda x, y, z: tuple(c * (0.7 if y < -0.226 else 1) for c in SHOE), 'leather')
# owijacze z jasnej skóry od buta do nogawicy, przewiązane rzemieniem na krzyż
wraps = lathe('wraps', [(0.031, -0.125), (0.034, -0.14), (0.033, -0.16), (0.036, -0.178)], seg=10, subsurf=0)
wraps_m = Mesh(evaluated(wraps), lambda x, y, z: tuple(c * (0.72 if (y * 70 + math.atan2(x, z) * 1.6) % 2 < 0.35 else 1.0) for c in WRAP), 'leather')

# ---------- ręka: krótki, postrzępiony rękaw koszuli i gołe, umięśnione przedramię ----------
arm = lathe('arm', [(0.001, 0.034), (0.022, 0.029), (0.034, 0.01), (0.035, -0.015), (0.034, -0.05), (0.03, -0.062)], seg=12, subsurf=0)
arm_m = Mesh(evaluated(arm), lambda x, y, z: (0.6 if y < -0.052 else 0.9 + 0.06 * math.sin(y * 60),) * 3, 'cloth', dyn='tunic')
fore = lathe('fore', [(0.0255, -0.048), (0.026, -0.075), (0.027, -0.105), (0.023, -0.14), (0.02, -0.165), (0.001, -0.168)], seg=12, subsurf=0)
fore_m = Mesh(evaluated(fore), WHITE, 'skin', dyn='skin')
hand = skin('hand', [(0, -0.162, 0.002), (0, -0.19, 0.005), (0, -0.207, 0.008)], [(0, 1), (1, 2)],
            [(0.022, 0.02), (0.026, 0.018), (0.02, 0.014)], subsurf=1)
hand_m = Mesh(evaluated(hand), WHITE, 'skin', dyn='skin')

# ---------- tułów: krótka koszula z wycięciem w serek, postrzępiony dół; portki od pasa; szeroki skórzany pas ----------
torso = lathe('torso', [(0.09, 0.262), (0.084, 0.31), (0.095, 0.37), (0.104, 0.415), (0.1, 0.448), (0.08, 0.472), (0.05, 0.488), (0.032, 0.494)], seg=20, depth=0.74, subsurf=0)
def shirt_col(x, y, z):
    # rozdarte wycięcie pod szyją (ciemne, widać skórę) i wytarte, postrzępione brzegi
    front = z > 0 and abs(x) < 0.04 and y > 0.44 - abs(x) * 1.5
    if front:
        return (0.35,) * 3
    tear = y < 0.272 and (math.atan2(x, z) * 7) % 2 < 0.9
    return ((0.55 if tear else 0.82) + 0.25 * (y - 0.27) + 0.05 * math.sin(math.atan2(x, z) * 9 + y * 50),) * 3
torso_m = Mesh(evaluated(torso), shirt_col, 'cloth', dyn='tunic')
# skóra w wycięciu koszuli (pod spodem, tuż za tkaniną)
chest = sphere('chest', (0.0, 0.452, 0.052), (0.035, 0.03, 0.012), seg=10, rings=6)
chest_m = Mesh(evaluated(chest), WHITE, 'skin', dyn='skin')
hips = lathe('hips', [(0.088, 0.29), (0.094, 0.255), (0.098, 0.215), (0.09, 0.19)], seg=20, depth=0.8, subsurf=0)
hips_m = Mesh(evaluated(hips), lambda x, y, z: (0.82 + 0.1 * math.cos(math.atan2(x, z) * 6),) * 3, 'cloth', dyn='trousers')
belt = lathe('belt', [(0.093, 0.262), (0.097, 0.268), (0.097, 0.296), (0.093, 0.302)], seg=20, depth=0.78, subsurf=0)
belt_m = Mesh(evaluated(belt), BELT, 'leather')
buckle = sphere('buckle', (0.0, 0.282, 0.075), (0.018, 0.017, 0.007), seg=8, rings=4)
buckle_m = Mesh(evaluated(buckle), BUCKLE, 'metal')
pouch = sphere('pouch', (-0.075, 0.25, 0.05), (0.026, 0.032, 0.018), seg=10, rings=6)
pouch_m = Mesh(evaluated(pouch), POUCH, 'leather')

# ---------- głowa ----------
head = Head((0.0, 0.546, 0.004), (0.054, 0.065, 0.058))
neck = lathe('neck', [(0.027, 0.47), (0.027, 0.5), (0.029, 0.52)], seg=10, subsurf=0)
neck_m = Mesh(evaluated(neck), WHITE, 'skin', dyn='skin')
hair = head.shell('hair', 1.09, lambda x, y, z: smooth(0.0, 0.12, y - (0.12 + 0.5 * z)), show='hairOn')
beard = head.shell('beard', 1.07, head.beard_mask(), show='beardP')
# otwór na twarz w kapturze i chuście
def face_hole(x, y, z, w=0.62, h=0.6):
    return smooth(0.15, 0.4, z) * smooth(-0.05, 0.1, h - abs(y + 0.08)) * smooth(-0.05, 0.1, w - abs(x))
hood = head.shell('hood', 1.16, lambda x, y, z: 1 - face_hole(x, y, z) if y > -0.85 else 0, dyn='hat', show='hood',
                  shade=lambda x, y, z: (0.9 if z > 0.3 else 0.8,) * 3)
cape = lathe('cape', [(0.128, 0.4), (0.124, 0.428), (0.104, 0.456), (0.074, 0.484), (0.05, 0.505)], seg=18, depth=0.86, subsurf=1)
cape_m = Mesh(evaluated(cape), lambda x, y, z: (0.6 if y < 0.407 else 0.85,) * 3, 'cloth', dyn='hat', show='hood')
kerchief = head.shell('kerchief', 1.11, lambda x, y, z: (1 - face_hole(x, y, z, 0.7, 0.62)) * smooth(-0.6, -0.3, y), dyn=None, show='kerchief',
                      shade=lambda x, y, z: tuple(c * (0.9 + 0.1 * y) for c in LINEN))
# słomkowy kapelusz z szerokim rondem i czerwoną taśmą
hat_cr = lathe('straw', [(0.063, 0.585), (0.062, 0.614), (0.05, 0.634), (0.0, 0.64)], seg=18, subsurf=0)
hat_br = lathe('brim', [(0.063, 0.581), (0.118, 0.566), (0.122, 0.562), (0.063, 0.576)], seg=22, subsurf=0)
straw_col = lambda x, y, z: tuple(c * (0.86 + 0.14 * math.cos(math.hypot(x, z) * 300)) for c in STRAW)
straw_m = [Mesh(evaluated(hat_cr), lambda x, y, z: hexrgb(0x7a3a2a) if 0.588 < y < 0.6 else straw_col(x, y, z), 'cloth', show='straw'),
           Mesh(evaluated(hat_br), straw_col, 'cloth', show='straw')]
# filcowa czapka z ciemnym otokiem
cap = lathe('cap', [(0.061, 0.586), (0.064, 0.603), (0.057, 0.624), (0.034, 0.636), (0.0, 0.639)], seg=16, subsurf=0)
cap_m = Mesh(evaluated(cap), lambda x, y, z: (0.55 if y < 0.596 else 1.0,) * 3, 'cloth', dyn='hat', show='cap')

static = [torso_m, chest_m, hips_m, belt_m, buckle_m, pouch_m, head.skin, neck_m, *head.ears(), *head.eyes(), *head.brows(), hair, beard, hood, cape_m, kerchief, *straw_m, cap_m]
finish('peasant', static, [leg_m, shoe_m, wraps_m], [arm_m, fore_m, hand_m], HIP, SHOULDER, HAND)
