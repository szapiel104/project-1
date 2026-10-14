"""Dziecko z osady: duża głowa i krótkie ręce i nogi (proporcje dziecka, a nie pomniejszony dorosły), lniana koszula
do kolan przewiązana sznurkiem, bose nogi albo owijacze, rozczochrane włosy albo filcowa czapeczka.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/child.py
Wynik: src/render/models/child.json — części ciała dla Figures('child'). Wysokość ok. 0,4 (dorosły ok. 0,64).
Kolory z gry: koszula = 'tunic' (przygaszona barwa pana), włosy = 'hair', czapka = 'hat'.
Warianty (show): 'hairOn' / 'cap' (nakrycie głowy), 'wraps' (owijacze zamiast bosych stóp).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, evaluated, hexrgb, lathe, reset, skin, sphere  # noqa: E402

reset()
from body import Head, finish, smooth  # noqa: E402

WHITE = (1.0, 1.0, 1.0)
ROPE, WRAP = hexrgb(0x8a7350), hexrgb(0x857659)

HIP = (0.032, 0.135, 0.0)
SHOULDER = (0.075, 0.262, 0.0)
HAND = (0.0, -0.118, 0.004)

# ---------- noga: goła łydka i stopa (skóra), czasem owijacze ----------
leg = skin('cleg', [(0, 0, 0), (0, -0.06, 0.003), (0, -0.115, 0.0), (0, -0.128, 0.022)], [(0, 1), (1, 2), (2, 3)],
           [(0.026, 0.026), (0.019, 0.02), (0.016, 0.016), (0.014, 0.009)], subsurf=1)
leg_m = Mesh(evaluated(leg), lambda x, y, z: (0.92 if y > -0.11 else 0.8,) * 3, 'skin', dyn='skin')
wraps = lathe('cwraps', [(0.019, -0.07), (0.021, -0.085), (0.02, -0.105), (0.019, -0.118)], seg=10, subsurf=0)
wraps_m = Mesh(evaluated(wraps), lambda x, y, z: tuple(c * (0.85 + 0.15 * math.cos(y * math.pi * 2 / 0.012)) for c in WRAP), 'cloth', show='wraps')

# ---------- ręka: krótki rękaw koszuli i dłoń ----------
arm = lathe('carm', [(0.001, 0.022), (0.016, 0.018), (0.021, 0.004), (0.02, -0.02), (0.017, -0.05), (0.015, -0.09), (0.012, -0.095)], seg=10, subsurf=0)
arm_m = Mesh(evaluated(arm), lambda x, y, z: (0.92 + 0.05 * math.sin(y * 80),) * 3, 'cloth', dyn='tunic')
hand = skin('chand', [(0, -0.088, 0.002), (0, -0.108, 0.004), (0, -0.12, 0.006)], [(0, 1), (1, 2)],
            [(0.013, 0.012), (0.015, 0.011), (0.011, 0.008)], subsurf=1)
hand_m = Mesh(evaluated(hand), WHITE, 'skin', dyn='skin')

# ---------- koszula do kolan z fałdami, sznurek w pasie ----------
shirt = lathe('cshirt', [(0.0, 0.072), (0.074, 0.072), (0.075, 0.09), (0.068, 0.13), (0.06, 0.16), (0.064, 0.2), (0.066, 0.235), (0.062, 0.262), (0.046, 0.28), (0.026, 0.288)], seg=24, depth=0.8, subsurf=0)
bm = evaluated(shirt)
for v in bm.verts:
    x, y, z = v.co.x, v.co.z, -v.co.y
    if math.hypot(x, z) < 1e-4:
        continue
    a = math.atan2(x, z)
    k = 1 + 0.06 * math.sin(a * 7) * smooth(0.16, 0.08, y)
    v.co.x, v.co.y = x * k, -(z * k)
shirt_m = Mesh(bm, lambda x, y, z: ((0.62 if y < 0.085 else 0.9 + 0.08 * math.sin(math.atan2(x, z) * 7)) * (0.9 + 0.3 * (y - 0.07)),) * 3, 'cloth', dyn='tunic')
rope = lathe('crope', [(0.06, 0.152), (0.064, 0.157), (0.064, 0.163), (0.06, 0.168)], seg=18, depth=0.8, subsurf=0)
rope_m = Mesh(evaluated(rope), ROPE, 'cloth')

# ---------- głowa: duża, okrągła, mały nos i broda ----------
head = Head((0.0, 0.336, 0.004), (0.046, 0.052, 0.048), strong=0.2)
neck = lathe('cneck', [(0.017, 0.275), (0.017, 0.295), (0.019, 0.305)], seg=10, subsurf=0)
neck_m = Mesh(evaluated(neck), WHITE, 'skin', dyn='skin')
# rozczochrane włosy: powłoka z nierównym brzegiem i kosmykami
hair = head.shell('chair', 1.1, lambda x, y, z: smooth(0.0, 0.1, y - (0.0 + 0.55 * z) + 0.08 * math.sin(math.atan2(x, z) * 9)), show='hairOn')
cap = lathe('ccap', [(0.049, 0.358), (0.052, 0.372), (0.046, 0.39), (0.026, 0.398), (0.0, 0.4)], seg=14, subsurf=0)
cap_m = Mesh(evaluated(cap), lambda x, y, z: (0.55 if y < 0.364 else 1.0,) * 3, 'cloth', dyn='hat', show='cap')
cap_hair = head.shell('chair2', 1.07, lambda x, y, z: smooth(0.0, 0.1, y + 0.2 - 0.5 * z) * smooth(0.5, 0.2, y), show='cap')

static = [shirt_m, rope_m, head.skin, neck_m, *head.ears(0.8), *head.eyes(), *head.brows(), hair, cap_m, cap_hair]
finish('child', static, [leg_m, wraps_m], [arm_m, hand_m], HIP, SHOULDER, HAND)
