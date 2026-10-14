"""Gospodyni: suknia do ziemi z fałdami i ciemniejszym obrąbkiem, gorset sznurowany z przodu, lniany fartuch z troczkami,
koszula z rękawami do nadgarstka, chusta zawiązana na karku albo włosy w kok z warkoczem.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/woman.py
Wynik: src/render/models/woman.json — części ciała dla Figures('woman').
Kolory z gry: suknia = 'trousers' (ziemiste barwy), gorset i rękawy = 'tunic' (przygaszona barwa pana), chusta = 'hat'.
Warianty (show): 'wkerchief' — chusta, 'wbun' — odkryte włosy w koku.
Kotwice: biodro (±0,045; 0,2), bark (±0,118; 0,445), dłoń 0,18 pod barkiem — miotła i pochodnia w dłoni jak u chłopa.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, evaluated, hexrgb, lathe, reset, skin, sphere  # noqa: E402

reset()
from body import Head, finish, smooth  # noqa: E402

WHITE = (1.0, 1.0, 1.0)
LINEN, SHOE, LACE = hexrgb(0xddd2b6), hexrgb(0x3a2a1c), hexrgb(0x5a3e26)

HIP = (0.045, 0.2, 0.0)
SHOULDER = (0.118, 0.445, 0.0)
HAND = (0.0, -0.18, 0.004)

# ---------- noga: pod suknią widać tylko trzewik; nogawka ciemna (w cieniu sukni) ----------
leg = skin('wleg', [(0, 0, 0), (0, -0.1, 0.004), (0, -0.17, 0.0)], [(0, 1), (1, 2)],
           [(0.034, 0.034), (0.026, 0.027), (0.022, 0.022)], subsurf=1)
leg_m = Mesh(evaluated(leg), (0.35, 0.3, 0.26), 'cloth')
shoe = skin('wshoe', [(0, -0.16, 0), (0, -0.192, 0.0), (0, -0.196, 0.04)], [(0, 1), (1, 2)],
            [(0.026, 0.026), (0.027, 0.018), (0.021, 0.013)], subsurf=1)
shoe_m = Mesh(evaluated(shoe), lambda x, y, z: tuple(c * (0.75 if y < -0.205 else 1) for c in SHOE), 'leather')

# ---------- ręka: rękaw (barwa gorsetu) z mankietem z lnu, dłoń ----------
arm = lathe('warm', [(0.001, 0.03), (0.02, 0.026), (0.029, 0.008), (0.028, -0.02), (0.025, -0.06), (0.021, -0.11), (0.022, -0.14), (0.023, -0.152), (0.016, -0.156)], seg=12, subsurf=0)
arm_m = Mesh(evaluated(arm), lambda x, y, z: (0.92 + 0.05 * math.sin(y * 70),) * 3, 'cloth', dyn='tunic')
cuff = lathe('wcuff', [(0.0225, -0.135), (0.025, -0.142), (0.025, -0.154), (0.02, -0.158)], seg=12, subsurf=0)
cuff_m = Mesh(evaluated(cuff), LINEN, 'cloth')
hand = skin('whand', [(0, -0.152, 0.002), (0, -0.178, 0.005), (0, -0.194, 0.008)], [(0, 1), (1, 2)],
            [(0.018, 0.016), (0.021, 0.014), (0.016, 0.011)], subsurf=1)
hand_m = Mesh(evaluated(hand), WHITE, 'skin', dyn='skin')

# ---------- suknia: od pasa do ziemi, fałdy, przetarty obrąbek ----------
FOLDS = 9


def dress_profile():
    # promień, wysokość: wcięcie w talii, biodra, rozszerzenie ku dołowi
    return [(0.0, 0.004), (0.152, 0.004), (0.158, 0.03), (0.145, 0.09), (0.125, 0.17), (0.105, 0.24), (0.088, 0.29), (0.082, 0.31)]


dress = lathe('dress', dress_profile(), seg=36, depth=0.84, subsurf=0)
bm = evaluated(dress)
# fałdy: promień faluje wokół, mocniej przy ziemi (materiał opada swobodnie), przy pasie gładko
for v in bm.verts:
    x, y, z = v.co.x, v.co.z, -v.co.y
    r = math.hypot(x, z)
    if r < 1e-4:
        continue
    a = math.atan2(x, z)
    k = 1 + 0.07 * math.sin(a * FOLDS + 0.6 * math.sin(a * 3)) * smooth(0.3, 0.05, y)
    v.co.x, v.co.y = x * k, -(z * k)


def dress_col(x, y, z):
    a = math.atan2(x, z)
    fold = 0.9 + 0.1 * math.sin(a * FOLDS + 0.6 * math.sin(a * 3))
    hem = 0.62 if y < 0.03 else 0.8 if y < 0.045 else 1.0
    return (fold * hem,) * 3


dress_m = Mesh(bm, dress_col, 'cloth', dyn='trousers')

# ---------- gorset i koszula: wąskie barki, wcięta talia; sznurowanie z przodu; biały dekolt koszuli ----------
torso = lathe('wtorso', [(0.084, 0.29), (0.078, 0.32), (0.088, 0.37), (0.094, 0.405), (0.09, 0.44), (0.072, 0.464), (0.046, 0.48), (0.03, 0.486)], seg=22, depth=0.72, subsurf=0)


torso_m = Mesh(evaluated(torso), lambda x, y, z: (0.86 + 0.3 * (y - 0.29),) * 3, 'cloth', dyn='tunic')
blouse = lathe('blouse', [(0.075, 0.425), (0.073, 0.45), (0.058, 0.47), (0.04, 0.483), (0.031, 0.488)], seg=16, depth=0.76, phi0=-0.9, phi=1.8, subsurf=0)
blouse_m = Mesh(evaluated(blouse), lambda x, y, z: tuple(c * (0.9 + 0.1 * math.sin(math.atan2(x, z) * 20)) for c in LINEN), 'cloth')
lace = []
for i in range(4):
    y = 0.33 + i * 0.024
    s = skin(f'lace{i}', [(-0.014, y, 0.072), (0.014, y + 0.012, 0.072)], [(0, 1)], [(0.0022, 0.0022)] * 2, subsurf=0)
    lace.append(Mesh(evaluated(s), LACE, 'cloth'))
    s = skin(f'lacb{i}', [(0.014, y, 0.072), (-0.014, y + 0.012, 0.072)], [(0, 1)], [(0.0022, 0.0022)] * 2, subsurf=0)
    lace.append(Mesh(evaluated(s), LACE, 'cloth'))

# ---------- fartuch: lniany płat z przodu sukni, troczki zawiązane z tyłu ----------
apron = lathe('wapron', [(0.09, 0.305), (0.1, 0.25), (0.118, 0.17), (0.135, 0.09), (0.146, 0.05)], seg=10, depth=0.86, phi0=-0.75, phi=1.5, subsurf=0)
abm = evaluated(apron)
for v in abm.verts:
    x, y, z = v.co.x, v.co.z, -v.co.y
    a = math.atan2(x, z)
    k = 1.12 + 0.015 * math.sin(a * 5) * smooth(0.3, 0.1, y)
    v.co.x, v.co.y = x * k, -(z * k)
apron_m = Mesh(abm, lambda x, y, z: tuple(min(1.0, c * (1.3 + (y - 0.05) * 0.4)) for c in LINEN), 'cloth')
band = lathe('wband', [(0.088, 0.298), (0.09, 0.304), (0.09, 0.314), (0.087, 0.318)], seg=20, depth=0.76, subsurf=0)
band_m = Mesh(evaluated(band), LINEN, 'cloth')
bow = [Mesh(evaluated(sphere('bowk', (0, 0.31, -0.07), (0.014, 0.01, 0.008), seg=8, rings=5)), LINEN, 'cloth')]
for sx in (-1, 1):
    t = skin(f'tie{sx}', [(sx * 0.005, 0.306, -0.072), (sx * 0.018, 0.27, -0.08), (sx * 0.022, 0.24, -0.082)], [(0, 1), (1, 2)], [(0.006, 0.002)] * 3, subsurf=0)
    bow.append(Mesh(evaluated(t), LINEN, 'cloth'))

# ---------- głowa: łagodne rysy, bez brody ----------
head = Head((0.0, 0.54, 0.004), (0.05, 0.061, 0.054), strong=0.35)
neck = lathe('wneck', [(0.023, 0.465), (0.023, 0.495), (0.025, 0.515)], seg=10, subsurf=0)
neck_m = Mesh(evaluated(neck), WHITE, 'skin', dyn='skin')
# włosy gładko zaczesane do tyłu; kok i warkocz tylko w wariancie bez chusty
hair = head.shell('whair', 1.08, lambda x, y, z: smooth(0.0, 0.12, y - (0.05 + 0.55 * z)), show='wbun')
bun = sphere('bun', (0, 0.556, -0.06), (0.027, 0.024, 0.022), seg=12, rings=8)
bun_m = Mesh(evaluated(bun), lambda x, y, z: (0.85 + 0.15 * math.sin((x + y) * 400),) * 3, 'cloth', dyn='hair', show='wbun')
braid = skin('braid', [(0, 0.535, -0.072), (0.006, 0.5, -0.07), (0, 0.465, -0.065), (0.004, 0.44, -0.07)], [(0, 1), (1, 2), (2, 3)],
             [(0.011, 0.009), (0.01, 0.008), (0.009, 0.007), (0.005, 0.004)], subsurf=1)
braid_m = Mesh(evaluated(braid), lambda x, y, z: (0.8 + 0.2 * math.sin(y * 300),) * 3, 'cloth', dyn='hair', show='wbun')


def face_hole(x, y, z, w=0.68, h=0.62):
    return smooth(0.15, 0.4, z) * smooth(-0.05, 0.1, h - abs(y + 0.08)) * smooth(-0.05, 0.1, w - abs(x))


# chusta: zakrywa włosy i czoło, odsłania twarz; węzeł i rogi zwisają na karku
kerchief = head.shell('wkerch', 1.12, lambda x, y, z: (1 - face_hole(x, y, z)) * smooth(-0.55, -0.25, y), dyn='hat', show='wkerchief',
                      shade=lambda x, y, z: (0.88 + 0.12 * y,) * 3)
knot = [Mesh(evaluated(sphere('knot', (0, 0.505, -0.052), (0.016, 0.012, 0.012), seg=8, rings=6)), (0.85, 0.85, 0.85), 'cloth', dyn='hat', show='wkerchief')]
for sx in (-1, 1):
    t = skin(f'kend{sx}', [(sx * 0.004, 0.5, -0.056), (sx * 0.014, 0.47, -0.064), (sx * 0.016, 0.45, -0.066)], [(0, 1), (1, 2)], [(0.01, 0.003), (0.009, 0.003), (0.004, 0.002)], subsurf=0)
    knot.append(Mesh(evaluated(t), (0.8, 0.8, 0.8), 'cloth', dyn='hat', show='wkerchief'))

static = [dress_m, torso_m, blouse_m, *lace, apron_m, band_m, *bow, head.skin, neck_m, *head.ears(0.85), *head.eyes(), *head.brows(),
          hair, bun_m, braid_m, kerchief, *knot]
finish('woman', static, [leg_m, shoe_m], [arm_m, cuff_m, hand_m], HIP, SHOULDER, HAND)
