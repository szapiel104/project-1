"""Włócznik i łucznik: gładkie bryły z Blendera, cień w zagłębieniach, wersja z daleka.

Uruchomienie (z katalogu repo):  python tools/models/soldier.py spearman|archer
Wynik: src/render/models/{spearman,archer}.json. Tarcza, włócznia i łuk zostają w grze (src/render/peasants.ts):
wiszą na kotwicach ręki i obracają się osobno.
Kotwice jak dawniej: biodro (±0,052; 0,27), bark (±0,128; 0,485), dłoń 0,195 pod barkiem.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import bpy  # noqa: E402,F401
import bmesh  # noqa: E402
from mathutils import Matrix  # noqa: E402
from common import Mesh, evaluated, hexrgb, keep_faces, lathe, reset, skin, sphere  # noqa: E402

kind = sys.argv[1] if len(sys.argv) > 1 else 'spearman'
archer = kind == 'archer'
reset()
from body import Head, finish, smooth  # noqa: E402

WHITE = (1.0, 1.0, 1.0)
BOOT, LEATHER, GLOVE, STEEL, IRON, BRASS = hexrgb(0x2a1d13), hexrgb(0x5a3b22), hexrgb(0x3b2a1b), hexrgb(0xa6abb2), hexrgb(0x767b83), hexrgb(0xb38a3a)
CROSS = hexrgb(0xd8cca8)
TROUSERS = hexrgb(0x4a3f2c if archer else 0x3b3226)

HIP = (0.052, 0.27, 0.0)
SHOULDER = (0.128, 0.485, 0.0)
HAND = (0.0, -0.195, 0.005)


def turned(ob, rx=0.0, rz=0.0, at=(0, 0, 0)):
    """Obrót bryły (w układzie gry: najpierw wokół x, potem wokół z) i przesunięcie"""
    bm = evaluated(ob)
    if rx:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(rx, 3, 'X'))
    if rz:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-rz, 3, 'Y'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(at[0], -at[2], at[1]))
    return bm


def mail(base):
    """Kolczuga: drobne poziome prążki"""
    return lambda x, y, z: tuple(c * (0.84 + 0.16 * math.cos(y * math.pi * 2 / 0.012) * math.cos(math.atan2(x, z) * 14)) for c in base)


# ---------- noga: nogawica i wysoki but ----------
leg = skin('leg', [(0, 0, 0), (0, -0.075, 0.005), (0, -0.14, 0.008), (0, -0.19, -0.004), (0, -0.236, 0.0), (0, -0.252, 0.011), (0, -0.256, 0.06)],
           [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6)],
           [(0.048, 0.048), (0.042, 0.043), (0.03, 0.031), (0.033, 0.034), (0.026, 0.027), (0.03, 0.018), (0.025, 0.012)], subsurf=1)
def leg_col(x, y, z):
    if y < -0.15:
        cuff = archer and y > -0.168
        return tuple(c * (1.25 if cuff else 1.0) for c in BOOT)
    return TROUSERS
leg_m = Mesh(evaluated(leg), leg_col, 'leather')

# ---------- ręka: rękaw (kolczy albo pikowany) i rękawica ----------
arm = lathe('arm', [(0.001, 0.034), (0.022, 0.029), (0.034, 0.01), (0.034, -0.015), (0.03, -0.05), (0.026, -0.1), (0.028, -0.15), (0.028, -0.168), (0.02, -0.17)], seg=12, subsurf=0)
if archer:
    arm_m = Mesh(evaluated(arm), lambda x, y, z: (0.8 + 0.12 * math.cos(y * math.pi * 2 / 0.034),) * 3, 'cloth', dyn='tunic')
else:
    arm_m = Mesh(evaluated(arm), mail(STEEL), 'mail')
glove = skin('glove', [(0, -0.162, 0.003), (0, -0.198, 0.006), (0, -0.217, 0.009)], [(0, 1), (1, 2)],
             [(0.024, 0.022), (0.027, 0.018), (0.02, 0.013)], subsurf=1)
glove_m = Mesh(evaluated(glove), lambda x, y, z: tuple(c * (1.2 if y > -0.17 else 1) for c in GLOVE), 'leather')
arms = [arm_m, glove_m]
if archer:
    bracer = lathe('bracer', [(0.03, -0.125), (0.032, -0.14), (0.031, -0.16)], seg=10, subsurf=0)
    arms.append(Mesh(evaluated(bracer), LEATHER, 'leather'))

# ---------- głowa (jak u strażnika) ----------
head = Head((0.0, 0.579, 0.004), (0.046, 0.058, 0.05))
neck = lathe('neck', [(0.024, 0.49), (0.025, 0.53), (0.026, 0.545)], seg=10, subsurf=0)
neck_m = Mesh(evaluated(neck), WHITE, 'skin', dyn='skin')
def face_hole(x, y, z, w=0.6, h=0.62):
    return smooth(0.15, 0.4, z) * smooth(-0.05, 0.1, h - abs(y + 0.1)) * smooth(-0.05, 0.1, w - abs(x))
beard = head.shell('beard', 1.07, head.beard_mask(), show='beard')
static = [head.skin, neck_m, *head.ears(), *head.eyes(), *head.brows(), beard]

# ---------- tułów ----------
belt = lathe('belt', [(0.084, 0.322), (0.088, 0.33), (0.088, 0.344), (0.084, 0.352)], seg=18, depth=0.78, subsurf=0)
static.append(Mesh(evaluated(belt), LEATHER, 'leather'))
buckle = sphere('buckle', (0.0, 0.337, 0.068), (0.014, 0.011, 0.005), seg=8, rings=4)
static.append(Mesh(evaluated(buckle), BRASS, 'metal'))
torso_prof = [(0.082, 0.3), (0.079, 0.33), (0.09, 0.39), (0.098, 0.43), (0.096, 0.463), (0.077, 0.486), (0.05, 0.502), (0.032, 0.508)]

if not archer:
    # waffenrock w barwach pana na kolczudze, biały krzyż z przodu i z tyłu
    torso = lathe('torso', torso_prof, seg=20, depth=0.74, subsurf=0)
    static.append(Mesh(evaluated(torso), lambda x, y, z: (0.86 + 0.4 * (y - 0.3),) * 3, 'cloth', dyn='tunic'))
    skirt = lathe('skirt', [(0.084, 0.335), (0.094, 0.29), (0.106, 0.22), (0.114, 0.165)], seg=20, depth=0.8, subsurf=0)
    sb = evaluated(skirt)
    keep_faces(sb, lambda x, y, z: not (y < 0.25 and min(abs(math.atan2(x, z) - a) for a in (-math.pi, 0, math.pi)) < 0.12))
    static.append(Mesh(sb, lambda x, y, z: (0.55 if y < 0.18 else 0.88 + 0.1 * math.cos(math.atan2(x, z) * 7),) * 3, 'cloth', dyn='tunic'))
    hem = lathe('hem', [(0.1, 0.24), (0.108, 0.19), (0.113, 0.14)], seg=18, depth=0.8, subsurf=0)
    static.append(Mesh(evaluated(hem), mail(STEEL), 'mail'))
    for a in (0.0, math.pi):
        v = lathe('crossv', [(r + 0.003, y) for r, y in ((0.09, 0.39), (0.097, 0.42), (0.098, 0.44))] + [(0.0975, 0.45)], seg=2, depth=0.74, phi0=a - 0.13, phi=0.26, subsurf=0)
        static.append(Mesh(evaluated(v), CROSS, 'cloth'))
        hb = lathe('crossh', [(0.0975, 0.418), (0.0985, 0.434)], seg=6, depth=0.74, phi0=a - 0.42, phi=0.84, subsurf=0)
        static.append(Mesh(evaluated(hb), CROSS, 'cloth'))
        vl = lathe('crossl', [(0.079, 0.335), (0.084, 0.36), (0.09, 0.39)], seg=2, depth=0.74, phi0=a - 0.15, phi=0.3, subsurf=0)
        bm = evaluated(vl)
        bmesh.ops.scale(bm, verts=bm.verts, vec=(1.035, 1.035, 1.0))
        static.append(Mesh(bm, CROSS, 'cloth'))
    # czepiec kolczy: na głowie (otwarty na twarz) i pelerynka na barkach
    coif = head.shell('coif', 1.1, lambda x, y, z: (1 - face_hole(x, y, z, 0.74, 0.72)) if y > -0.95 else 0, dyn=None, mat='mail',
                      shade=lambda x, y, z: mail(STEEL)(x, y * 0.06, z))
    static.append(coif)
    cape = lathe('mantle', [(0.106, 0.448), (0.103, 0.468), (0.086, 0.488), (0.058, 0.508), (0.043, 0.528), (0.04, 0.545)], seg=18, depth=0.82, subsurf=0)
    static.append(Mesh(evaluated(cape), mail(STEEL), 'mail'))
    # kapalin z szerokim rondem albo stożkowy hełm z nosalem
    kettle = lathe('kettle', [(0.058, 0.602), (0.058, 0.617), (0.053, 0.636), (0.036, 0.652), (0.0, 0.658)], seg=16, subsurf=0)
    brim = lathe('kbrim', [(0.058, 0.6), (0.104, 0.579), (0.102, 0.584), (0.06, 0.607)], seg=20, subsurf=0)
    static += [Mesh(evaluated(kettle), lambda x, y, z: tuple(c * (0.7 if y < 0.61 else 1) for c in IRON), 'metal', show='kettle'),
               Mesh(evaluated(brim), IRON, 'metal', show='kettle')]
    nasal = lathe('nasal', [(0.057, 0.598), (0.056, 0.62), (0.043, 0.643), (0.02, 0.663), (0.0, 0.676)], seg=16, subsurf=0)
    band = lathe('nband', [(0.0575, 0.594), (0.06, 0.6), (0.06, 0.61), (0.0575, 0.614)], seg=16, subsurf=0)
    bar = sphere('nbar', (0.0, 0.578, 0.058), (0.006, 0.024, 0.004), seg=6, rings=6)
    static += [Mesh(evaluated(nasal), IRON, 'metal', show='nasal'), Mesh(evaluated(band), hexrgb(0x4a4d52), 'metal', show='nasal'),
               Mesh(evaluated(bar), IRON, 'metal', show='nasal')]
else:
    # przeszywanica (poziome pikowanie) w barwach pana
    quilt = lambda x, y, z: (0.55 if y < 0.172 else (0.86 + 0.14 * math.cos(y * math.pi * 2 / 0.034)) * (0.9 + (y - 0.14) * 0.3),) * 3
    torso = lathe('torso', torso_prof, seg=20, depth=0.74, subsurf=0)
    static.append(Mesh(evaluated(torso), quilt, 'cloth', dyn='tunic'))
    skirt = lathe('skirt', [(0.084, 0.335), (0.094, 0.29), (0.106, 0.22), (0.116, 0.16)], seg=20, depth=0.8, subsurf=0)
    static.append(Mesh(evaluated(skirt), quilt, 'cloth', dyn='tunic'))
    pouch = sphere('pouch', (-0.06, 0.3, 0.064), (0.022, 0.026, 0.014), seg=8, rings=6)
    static.append(Mesh(evaluated(pouch), LEATHER, 'leather'))
    # kaptur otwarty na twarz, pelerynka na barkach, ogon kaptura na plecach
    hood = head.shell('hood', 1.15, lambda x, y, z: (1 - face_hole(x, y, z, 0.72, 0.7)) if y > -0.9 else 0, dyn='tunic',
                      shade=lambda x, y, z: (0.74,) * 3)
    static.append(hood)
    cape = lathe('cape', [(0.135, 0.418), (0.13, 0.442), (0.11, 0.468), (0.078, 0.495), (0.05, 0.52), (0.042, 0.54)], seg=18, depth=0.84, subsurf=0)
    static.append(Mesh(evaluated(cape), lambda x, y, z: (0.5 if y < 0.424 else 0.72,) * 3, 'cloth', dyn='tunic'))
    tail = skin('tail', [(0, 0.62, -0.05), (0, 0.58, -0.09), (0, 0.52, -0.105)], [(0, 1), (1, 2)], [(0.026, 0.022), (0.016, 0.013), (0.006, 0.006)], subsurf=1)
    static.append(Mesh(evaluated(tail), (0.66,) * 3, 'cloth', dyn='tunic'))
    # kord w pochwie na prawym biodrze
    sheath = lathe('kord', [(0.008, 0.17), (0.011, 0.19), (0.011, 0.3), (0.013, 0.31)], seg=6, depth=0.55, subsurf=0)
    bm = evaluated(sheath)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0.3), matrix=Matrix.Rotation(-0.35, 3, 'Y'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0.09, -0.02, 0))
    static.append(Mesh(bm, BOOT, 'leather'))
    hilt = lathe('hilt', [(0.006, 0.31), (0.006, 0.345), (0.009, 0.35)], seg=6, subsurf=0)
    bm = evaluated(hilt)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0.3), matrix=Matrix.Rotation(-0.35, 3, 'Y'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0.09, -0.02, 0))
    static.append(Mesh(bm, IRON, 'metal'))
    # kołczan na plecach wylotem nad prawym ramieniem, pas przez pierś, strzały z białymi i czerwonymi lotkami
    QR, QZ, QAT = -0.18, -0.38, (0.055, 0.36, -0.105)
    quiver = lathe('quiver', [(0.03, -0.15), (0.036, -0.13), (0.04, 0.0), (0.043, 0.13), (0.046, 0.15), (0.042, 0.155)], seg=12, depth=1.0, subsurf=0)
    static.append(Mesh(turned(quiver, QR, QZ, QAT), lambda x, y, z: hexrgb(0x8a5c34), 'leather'))
    strap = lathe('strap', [(0.108, -0.01), (0.111, 0.0), (0.108, 0.01)], seg=20, depth=0.78, subsurf=0)
    static.append(Mesh(turned(strap, 0.0, -0.62, (0.0, 0.392, 0.0)), hexrgb(0x4a3020), 'leather'))
    for i, (dx, dz) in enumerate(((0.0, 0.0), (0.016, 0.01), (-0.014, 0.012), (0.008, -0.016), (-0.016, -0.008))):
        f = sphere(f'flet{i}', (dx, 0.2, dz), (0.007, 0.026, 0.007), seg=6, rings=5)
        static.append(Mesh(turned(f, QR, QZ, QAT), hexrgb(0xeae3d0) if i % 2 == 0 else hexrgb(0x9a2a20), 'cloth'))

finish(kind, static, [leg_m], arms, HIP, SHOULDER, HAND)
