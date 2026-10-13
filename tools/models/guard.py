"""Strażnik miejski w stylu Starego Obozu: gładkie bryły z Blendera (Skin + Subdivision), cień w zagłębieniach.

Uruchomienie (z katalogu repo):  python tools/models/guard.py   (Python z modułem bpy, patrz tools/models/README.md)
Wynik: src/render/models/guard.json — części ciała dla Figures('guard').
"""
import base64
import json
import math
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, bake_ao, evaluated, hexrgb, keep_faces, lathe, reset, skin, sphere  # noqa: E402

reset()
RED, RED_DK, DARK, LEATHER, BOOT, GLOVE = hexrgb(0x8a2d1c), hexrgb(0x5a1d13), hexrgb(0x3a2219), hexrgb(0x5a3720), hexrgb(0x2a1c12), hexrgb(0x33241a)
IRON, STEEL, BRASS, WHITE = hexrgb(0x8e939b), hexrgb(0xb8bdc4), hexrgb(0xb48c3c), (1.0, 1.0, 1.0)

HIP = (0.055, 0.30, 0.0)      # środek obrotu nogi (lewa: -x)
SHOULDER = (0.112, 0.478, 0.0)  # środek obrotu ręki
HAND = (0.0, -0.245, 0.012)    # dłoń w układzie ręki (tu siedzi rękojeść miecza)

# ---------- noga (środek obrotu w biodrze) ----------
leg = skin('leg', [(0, 0, 0), (0, -0.07, 0.006), (0, -0.145, 0.009), (0, -0.2, -0.004), (0, -0.262, 0.0), (0, -0.287, 0.012), (0, -0.292, 0.066)],
           [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6)],
           [(0.05, 0.05), (0.044, 0.045), (0.031, 0.032), (0.034, 0.035), (0.025, 0.026), (0.03, 0.02), (0.026, 0.013)], subsurf=1)
def leg_col(x, y, z):
    if y < -0.158:
        return tuple(c * (0.75 if y > -0.172 else 1.0) for c in BOOT)  # wywinięta cholewa ciemniej
    return DARK
leg_m = Mesh(evaluated(leg), leg_col, 'leather')
greave = lathe('greave', [(0.039, -0.168), (0.041, -0.2), (0.036, -0.232), (0.031, -0.25)], seg=6, phi0=-0.95, phi=1.9, subsurf=0)
greave_m = Mesh(evaluated(greave), IRON, 'leather')  # w siatce nogi; stal daje kolor wierzchołków

# ---------- ręka (środek obrotu w barku, wisi w dół) ----------
arm = skin('arm', [(0, 0, 0), (0, -0.06, 0), (0, -0.118, 0.002), (0, -0.17, 0.006), (0, -0.214, 0.008), (0, -0.238, 0.012), (0, -0.262, 0.016)],
           [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6)],
           [(0.037, 0.037), (0.033, 0.034), (0.026, 0.027), (0.028, 0.026), (0.021, 0.019), (0.025, 0.015), (0.02, 0.012)], subsurf=1)
def arm_col(x, y, z):
    if y > -0.128:
        return RED
    if y > -0.206:
        return LEATHER  # karwasz
    return GLOVE
arm_m = Mesh(evaluated(arm), arm_col, 'leather')

# ---------- tułów: kaftan z czerwonej skóry ----------
torso = skin('torso', [(0, 0.3, 0), (0, 0.355, 0), (0, 0.42, 0.005), (0, 0.472, 0), (0, 0.5, 0), (-0.082, 0.482, 0), (0.082, 0.482, 0)],
             [(0, 1), (1, 2), (2, 3), (3, 4), (3, 5), (3, 6)],
             [(0.075, 0.055), (0.068, 0.05), (0.086, 0.06), (0.085, 0.054), (0.034, 0.032), (0.04, 0.038), (0.04, 0.038)], subsurf=1)
def torso_col(x, y, z):
    if 0.324 < y < 0.352:
        return LEATHER  # pas
    if y > 0.49:
        return RED_DK   # kołnierz
    return RED
torso_m = Mesh(evaluated(torso), torso_col, 'leather')
# spódnica kaftana: cztery poły rozcięte z przodu, z tyłu i po bokach
skirt = lathe('skirt', [(0.074, 0.335), (0.084, 0.3), (0.096, 0.24), (0.108, 0.17)], seg=18, depth=0.78, subsurf=0)
sb = evaluated(skirt)
keep_faces(sb, lambda x, y, z: not (y < 0.255 and min(abs(math.atan2(x, z) - a) for a in (-math.pi, -math.pi / 2, 0, math.pi / 2, math.pi)) < 0.09))
skirt_m = Mesh(sb, lambda x, y, z: tuple(c * (0.7 if y < 0.185 else 1) for c in RED), 'cloth')
# napierśnik z czterech nachodzących na siebie płyt
plates = []
for k in range(4):
    y0 = 0.36 + k * 0.027
    plates += [(0.097 - k * 0.002, y0), (0.101 - k * 0.002, y0 + 0.006)]
plates += [(0.088, 0.475), (0.062, 0.494)]
chest = lathe('chest', plates, seg=14, depth=0.74, subsurf=0)
chest_m = Mesh(evaluated(chest), lambda x, y, z: tuple(c * (0.85 + 0.15 * ((y - 0.36) % 0.027) / 0.027) for c in IRON), 'metal')
# naramienniki: dwie warstwy wypukłych płyt
paul = []
for sx in (-1, 1):
    for i, (cy, r) in enumerate(((0.494, (0.052, 0.03, 0.054)), (0.472, (0.05, 0.024, 0.051)))):
        p = sphere(f'paul{sx}{i}', (sx * (0.096 + i * 0.01), cy, 0.0), r, seg=12, rings=8)
        b = evaluated(p)
        keep_faces(b, lambda x, y, z, cy=cy: y > cy + 1e-5)
        paul.append(Mesh(b, STEEL if i else IRON, 'metal'))
buckle = sphere('buckle', (0.0, 0.338, 0.053), (0.016, 0.013, 0.006), seg=8, rings=4)
buckle_m = Mesh(evaluated(buckle), BRASS, 'metal')
# pochwa miecza u lewego biodra
sheath = lathe('sheath', [(0.011, 0.13), (0.013, 0.155), (0.013, 0.315), (0.016, 0.325)], seg=6, depth=0.55, subsurf=0)
sh = evaluated(sheath)
import bmesh as _bm  # noqa: E402
from mathutils import Matrix as _M  # noqa: E402
# przechył wokół górnego końca (przy pasie), potem na lewe biodro, lekko z tyłu
_bm.ops.rotate(sh, verts=sh.verts, cent=(0, 0, 0.325), matrix=_M.Rotation(-0.35, 3, 'Y'))
_bm.ops.translate(sh, verts=sh.verts, vec=(-0.088, 0.012, 0))
sheath_m = Mesh(sh, hexrgb(0x1f1611), 'leather')
# szarfa w barwach pana przez pierś (kolor nadaje gra)
sash = lathe('sash', [(0.103, -0.012), (0.106, 0.0), (0.103, 0.012)], seg=20, depth=0.78, subsurf=0)
sa = evaluated(sash)
_bm.ops.rotate(sa, verts=sa.verts, cent=(0, 0, 0), matrix=_M.Rotation(0.62, 3, 'Y'))
_bm.ops.translate(sa, verts=sa.verts, vec=(0, 0, 0.415))
sash_m = Mesh(sa, WHITE, 'cloth', dyn='tunic')

# ---------- głowa ----------
from body import Head, finish, smooth  # noqa: E402
head = Head((0.0, 0.578, 0.004), (0.046, 0.058, 0.05))
neck = lathe('neck', [(0.024, 0.488), (0.025, 0.53), (0.026, 0.545)], seg=10, subsurf=0)
neck_m = Mesh(evaluated(neck), WHITE, 'skin', dyn='skin')
hair = head.shell('hair', 1.075, lambda x, y, z: smooth(0.0, 0.1, y - (0.16 + 0.48 * z)))
beard = head.shell('beard', 1.085, lambda x, y, z: smooth(0.0, 0.12, -0.46 - y + 0.12 * (1 - z)) * smooth(-0.1, 0.35, z), show='beard')
brow = head.shell('brow', 1.045, lambda x, y, z: smooth(0.0, 0.06, 0.12 - abs(y - 0.33)) * smooth(0.6, 0.85, z) * smooth(0.04, 0.12, abs(x)) * smooth(0.0, 0.1, 0.55 - abs(x)))

static = [torso_m, skirt_m, chest_m, *paul, buckle_m, sheath_m, sash_m, head.skin, neck_m, *head.ears(), hair, brow, beard]
finish('guard', static, [leg_m, greave_m], [arm_m], HIP, SHOULDER, HAND)
