"""Chłop: wełniana tunika do pół uda w przygaszonych barwach pana, sznurek z sakiewką, owijacze, nakrycia głowy.

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
LINEN, STRAW, SHOE, ROPE, POUCH, WRAP = hexrgb(0xd9ceb0), hexrgb(0xcfae55), hexrgb(0x33251a), hexrgb(0x8a7350), hexrgb(0x6a4a2e), hexrgb(0x857659)

HIP = (0.052, 0.235, 0.0)
SHOULDER = (0.135, 0.45, 0.0)
HAND = (0.0, -0.185, 0.004)

# ---------- noga: nogawica (barwa z gry), but, owijacze ----------
leg = skin('leg', [(0, 0, 0), (0, -0.07, 0.004), (0, -0.14, 0.006), (0, -0.19, 0.0)],
           [(0, 1), (1, 2), (2, 3)],
           [(0.047, 0.047), (0.041, 0.042), (0.031, 0.032), (0.03, 0.03)], subsurf=1)
leg_m = Mesh(evaluated(leg), lambda x, y, z: (0.9 + 0.1 * smooth(-0.19, 0.0, y),) * 3, 'cloth', dyn='trousers')
shoe = skin('shoe', [(0, -0.175, 0), (0, -0.212, 0.0), (0, -0.216, 0.05)], [(0, 1), (1, 2)],
            [(0.034, 0.034), (0.034, 0.022), (0.027, 0.016)], subsurf=1)
shoe_m = Mesh(evaluated(shoe), lambda x, y, z: tuple(c * (0.75 if y < -0.228 else 1) for c in SHOE), 'leather')
wraps = lathe('wraps', [(0.033, -0.105), (0.036, -0.125), (0.035, -0.15), (0.034, -0.175)], seg=10, subsurf=0)
wraps_m = Mesh(evaluated(wraps), lambda x, y, z: tuple(c * (0.85 + 0.15 * math.cos(y * math.pi * 2 / 0.016)) for c in WRAP), 'cloth', show='wraps')

# ---------- ręka: rękaw tuniki i goła dłoń ----------
arm = lathe('arm', [(0.001, 0.034), (0.022, 0.029), (0.033, 0.01), (0.033, -0.015), (0.03, -0.05), (0.025, -0.1), (0.027, -0.15), (0.027, -0.165), (0.019, -0.167)], seg=12, subsurf=0)
arm_m = Mesh(evaluated(arm), lambda x, y, z: (0.82 if y < -0.15 else 0.92 + 0.06 * math.sin(y * 60),) * 3, 'cloth', dyn='tunic')
hand = skin('hand', [(0, -0.162, 0.002), (0, -0.19, 0.005), (0, -0.207, 0.008)], [(0, 1), (1, 2)],
            [(0.021, 0.019), (0.025, 0.017), (0.019, 0.013)], subsurf=1)
hand_m = Mesh(evaluated(hand), WHITE, 'skin', dyn='skin')

# ---------- tułów: tunika z fałdami pod pasem, wytarty dół ----------
# tułów toczony z profilu: pas, pierś, zaokrąglone barki, wcięcie pod szyją
torso = lathe('torso', [(0.086, 0.27), (0.082, 0.31), (0.094, 0.37), (0.103, 0.415), (0.1, 0.448), (0.08, 0.472), (0.05, 0.488), (0.032, 0.494)], seg=20, depth=0.74, subsurf=0)
torso_m = Mesh(evaluated(torso), lambda x, y, z: (0.86 + 0.3 * (y - 0.27),) * 3, 'cloth', dyn='tunic')
skirt = lathe('skirt', [(0.092, 0.305), (0.1, 0.27), (0.112, 0.21), (0.122, 0.158)], seg=20, depth=0.8, subsurf=0)
def skirt_col(x, y, z):
    if y < 0.172:
        return (0.6,) * 3
    return (0.86 + 0.12 * math.cos(math.atan2(x, z) * 6 + y * 30),) * 3
skirt_m = Mesh(evaluated(skirt), skirt_col, 'cloth', dyn='tunic')
apron = lathe('apron', [(0.104, 0.33), (0.103, 0.28), (0.116, 0.21), (0.126, 0.15)], seg=8, depth=0.82, phi0=-0.85, phi=1.7, subsurf=0)
# fartuch leży tuż na tunice, więc cień w zagłębieniach mocno go szarzy: barwa bazowa jaśniejsza, żeby len był lnem
apron_m = Mesh(evaluated(apron), lambda x, y, z: tuple(min(1.0, c * (1.6 + (y - 0.15) * 0.6)) for c in LINEN), 'cloth', show='apron')
rope = lathe('rope', [(0.092, 0.29), (0.096, 0.297), (0.096, 0.305), (0.092, 0.311)], seg=18, depth=0.78, subsurf=0)
rope_m = Mesh(evaluated(rope), ROPE, 'cloth')
pouch = sphere('pouch', (-0.07, 0.262, 0.056), (0.026, 0.032, 0.018), seg=10, rings=6)
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

static = [torso_m, skirt_m, apron_m, rope_m, pouch_m, head.skin, neck_m, *head.ears(), *head.eyes(), *head.brows(), hair, beard, hood, cape_m, kerchief, *straw_m, cap_m]
finish('peasant', static, [leg_m, shoe_m, wraps_m], [arm_m, hand_m], HIP, SHOULDER, HAND)
