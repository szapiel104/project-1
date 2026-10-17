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
from common import Mesh, evaluated, hexrgb, keep_faces, lathe, reset, skin, sphere  # noqa: E402

reset()
from body import Head, finish, smooth  # noqa: E402
import bmesh as _bm  # noqa: E402

WHITE = (1.0, 1.0, 1.0)
LINEN, STRAW, SHOE, ROPE, POUCH, WRAP = hexrgb(0xd9ceb0), hexrgb(0xcfae55), hexrgb(0x2a201a), hexrgb(0x8a7350), hexrgb(0x6a4a2e), hexrgb(0x9a8462)
BELT, BUCKLE = hexrgb(0x2e231b), hexrgb(0x8c8a84)

def noise3(x, y, z):
    return (math.sin(x * 129.898 + y * 782.33 + z * 377.19) * 43758.5453) % 1.0


def lining(bm, dist=0.0025):
    """Spodnia warstwa tkaniny: kopia z odwróconymi ścianami, cofnięta o włos do środka. Gra nie rysuje tylnych
    stron, więc bez niej przez dekolt, rękaw czy postrzępiony dół widać było na wylot (dziury w koszuli)."""
    back = bm.copy()
    back.normal_update()
    for v in back.verts:
        v.co -= v.normal * dist
    _bm.ops.reverse_faces(back, faces=back.faces[:])
    return back


HIP = (0.052, 0.235, 0.0)
SHOULDER = (0.135, 0.45, 0.0)
HAND = (0.0, -0.185, 0.004)

# ---------- noga: workowate portki do pół łydki (barwa z gry) z ciemnymi pasami, owijacze, ciężki but ----------
leg = skin('leg', [(0, 0.01, 0), (0, -0.04, 0.005), (0, -0.08, 0.008), (0, -0.115, 0.008), (0, -0.135, 0.004)],
           [(0, 1), (1, 2), (2, 3), (3, 4)],
           [(0.052, 0.052), (0.052, 0.053), (0.049, 0.05), (0.045, 0.046), (0.04, 0.041)], subsurf=2)
def leg_col(x, y, z):
    a = math.atan2(x, z)
    seam = abs(((y + 0.2) * 90) % 3 - 1.5) < 0.12                # poziome przeszycia workowatych nogawic
    k = 0.86 + 0.09 * math.sin(a * 5 + y * 40) + 0.05 * math.sin(a * 13 - y * 70)   # fałdy i przetarcia
    if seam:
        k *= 0.72
    return (k * (0.88 + 0.12 * smooth(-0.14, 0.0, y)),) * 3
leg_m = Mesh(evaluated(leg), leg_col, 'cloth', dyn='trousers')
# opaska pod kolanem z ciemnej skóry obszyta łańcuszkiem (jak u kopaczy)
kband = lathe('kband', [(0.05, -0.1), (0.053, -0.093), (0.053, -0.078), (0.05, -0.071)], seg=16, subsurf=0)
kband_m = Mesh(evaluated(kband), hexrgb(0x2a221c), 'leather')
chain = lathe('chain', [(0.054, -0.088), (0.0555, -0.0855), (0.054, -0.083)], seg=24, subsurf=0)
def chain_col(x, y, z):
    k = 0.6 + 0.4 * abs(math.sin(math.atan2(x, z) * 24))
    return tuple(c * k for c in hexrgb(0x9a9ca0))
chain_m = Mesh(evaluated(chain), chain_col, 'metal')
shoe = skin('shoe', [(0, -0.17, 0), (0, -0.212, 0.0), (0, -0.218, 0.058)], [(0, 1), (1, 2)],
            [(0.039, 0.039), (0.04, 0.027), (0.032, 0.019)], subsurf=2)
def shoe_col(x, y, z):
    strap = -0.205 < y < -0.192 or (-0.2 < y < -0.19 and z > 0.02)   # szare paski zapięcia
    if strap:
        return hexrgb(0x6a6a6a)
    return tuple(c * (0.65 if y < -0.228 else 1) for c in SHOE)
shoe_m = Mesh(evaluated(shoe), shoe_col, 'leather')
# owijacze z jasnej skóry od buta do nogawicy, przewiązane rzemieniem na krzyż
wraps = lathe('wraps', [(0.031, -0.125), (0.034, -0.14), (0.033, -0.16), (0.037, -0.176)], seg=14, subsurf=0)
wraps_m = Mesh(evaluated(wraps), lambda x, y, z: tuple(c * (0.68 if (y * 70 + math.atan2(x, z) * 1.6) % 2 < 0.35 or (y * 70 - math.atan2(x, z) * 1.6) % 2 < 0.3 else 1.0) for c in WRAP), 'leather')

# ---------- ręka: krótki, postrzępiony rękaw koszuli i gołe, umięśnione przedramię ----------
arm = lathe('arm', [(0.001, 0.034), (0.022, 0.03), (0.035, 0.01), (0.036, -0.015), (0.035, -0.045), (0.033, -0.058)], seg=16, subsurf=0)
ab = evaluated(arm)
# postrzępiony brzeg rękawa: wycięte zęby materiału
keep_faces(ab, lambda x, y, z: not (y < -0.05 and (math.atan2(x, z) * 5) % 2 < 0.8))
arm_in = lining(ab)
arm_m = Mesh(ab, lambda x, y, z: (0.55 if y < -0.048 else 0.9 + 0.06 * math.sin(y * 60),) * 3, 'cloth', dyn='tunic')
arm_in_m = Mesh(arm_in, (0.42,) * 3, 'cloth', dyn='tunic')
# goła ręka: biceps pod rękawem, mocne przedramię zwężające się do nadgarstka
fore = lathe('fore', [(0.028, -0.02), (0.03, -0.05), (0.0275, -0.075), (0.029, -0.095), (0.027, -0.12), (0.022, -0.148), (0.02, -0.165), (0.001, -0.168)], seg=14, subsurf=0)
fore_m = Mesh(evaluated(fore), lambda x, y, z: (1.0 - 0.06 * max(0.0, math.cos(math.atan2(x, z) * 2)) * (y > -0.12),) * 3, 'skin', dyn='skin')
hand = skin('hand', [(0, -0.162, 0.002), (0, -0.19, 0.005), (0, -0.207, 0.008)], [(0, 1), (1, 2)],
            [(0.022, 0.02), (0.026, 0.018), (0.02, 0.014)], subsurf=1)
hand_m = Mesh(evaluated(hand), WHITE, 'skin', dyn='skin')

# ---------- tułów: krótka koszula z wycięciem w serek, postrzępiony dół; portki od pasa; szeroki skórzany pas ----------
torso = lathe('torso', [(0.09, 0.262), (0.086, 0.29), (0.084, 0.31), (0.095, 0.37), (0.104, 0.415), (0.1, 0.448), (0.08, 0.472), (0.05, 0.488), (0.032, 0.494)], seg=28, depth=0.74, subsurf=0)
tb = evaluated(torso)
# dekolt w serek: siatka przecięta dwiema płaszczyznami (równe brzegi zamiast schodków z całych ścian), potem wycięty
V0, VK = 0.405, 1.6
for sx in (-1, 1):
    _bm.ops.bisect_plane(tb, geom=tb.verts[:] + tb.edges[:] + tb.faces[:], plane_co=(0, 0, V0), plane_no=(-sx * VK, 0, 1))
def torn(x, y, z):
    a = math.atan2(x, z)
    if z > 0.02 and y > V0 + abs(x) * VK + 1e-4:   # dekolt w serek
        return True
    if y < 0.272 and (a * 6) % 2 < 0.7:      # postrzępiony dół koszuli (zęby nad pasem)
        return True
    return False
keep_faces(tb, lambda x, y, z: not torn(x, y, z))
_bm.ops.triangulate(tb, faces=tb.faces[:])
# obszycie dekoltu: zgrubiały brzeg tkaniny wzdłuż wycięcia (zamknięta bryła, zakrywa styk z piersią)
_hem = {}
for e in tb.edges:
    if e.is_boundary:
        ps = [(v.co.x, v.co.z, -v.co.y) for v in e.verts]
        if all(p[2] > 0.01 and V0 - 0.002 < p[1] < 0.486 for p in ps):
            _hem[e] = ps
_hv, _he, _idx = [], [], {}
for e, ps in _hem.items():
    ids = []
    for v, p in zip(e.verts, ps):
        if v.index not in _idx:
            _idx[v.index] = len(_hv)
            # brzeg odsunięty o włos na zewnątrz od osi tułowia (leży na tkaninie, nie w niej)
            r = math.hypot(p[0], p[2] / 0.74) or 1
            _hv.append((p[0] * (1 + 0.004 / r), p[1], p[2] * (1 + 0.004 / r)))
        ids.append(_idx[v.index])
    _he.append(tuple(ids))
neckhem = skin('neckhem', _hv, _he, [(0.0045, 0.0035)] * len(_hv), subsurf=1)
def shirt_col(x, y, z):
    a = math.atan2(x, z)
    k = 0.8 + 0.25 * (y - 0.27) + 0.05 * math.sin(a * 9 + y * 50) + (noise3(x, y, z) - 0.5) * 0.12
    if z > 0 and abs(x - 0.03) < 0.012 and abs(y - 0.33) < 0.012:   # przetarta dziura
        k *= 0.45
    if z > 0 and abs(x) < 0.07 and y > 0.4 + abs(x) * 1.6 - 0.012:  # brzeg dekoltu ciemniejszy
        k *= 0.7
    return (k,) * 3
torso_in = lining(tb)
torso_m = Mesh(tb, shirt_col, 'cloth', dyn='tunic')
torso_in_m = Mesh(torso_in, lambda x, y, z: (0.42 + (noise3(x, y, z) - 0.5) * 0.06,) * 3, 'cloth', dyn='tunic')
neckhem_m = Mesh(evaluated(neckhem), lambda x, y, z: (0.62 + (noise3(x, y, z) - 0.5) * 0.1,) * 3, 'cloth', dyn='tunic')
# naga pierś pod rozdartą koszulą (tuż za tkaniną)
chest = lathe('chest', [(0.083, 0.4), (0.094, 0.43), (0.088, 0.455), (0.07, 0.474), (0.045, 0.488)], seg=10, depth=0.72, phi0=-0.6, phi=1.2, subsurf=0)
chest_m = Mesh(evaluated(chest), lambda x, y, z: (0.95 - 0.1 * (abs(x) < 0.008),) * 3, 'skin', dyn='skin')
hips = lathe('hips', [(0.088, 0.29), (0.094, 0.255), (0.098, 0.215), (0.09, 0.19)], seg=20, depth=0.8, subsurf=0)
hips_m = Mesh(evaluated(hips), lambda x, y, z: (0.82 + 0.1 * math.cos(math.atan2(x, z) * 6),) * 3, 'cloth', dyn='trousers')
belt = lathe('belt', [(0.093, 0.262), (0.097, 0.268), (0.097, 0.296), (0.093, 0.302)], seg=20, depth=0.78, subsurf=0)
belt_m = Mesh(evaluated(belt), lambda x, y, z: tuple(c * (1.9 if abs(y - 0.282) < 0.004 and (math.atan2(x, z) * 12) % 2 < 0.5 else 1.0) for c in BELT), 'leather')  # rząd ćwieków
buckle = sphere('buckle', (0.0, 0.282, 0.075), (0.018, 0.017, 0.007), seg=8, rings=4)
buckle_m = Mesh(evaluated(buckle), BUCKLE, 'metal')
pouch = sphere('pouch', (-0.075, 0.25, 0.05), (0.026, 0.032, 0.018), seg=10, rings=6)
pouch_m = Mesh(evaluated(pouch), POUCH, 'leather')

# ---------- głowa ----------
head = Head((0.0, 0.546, 0.004), (0.054, 0.065, 0.058), seg=32, rings=24)
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
cape_b = evaluated(cape)
cape_in_m = Mesh(lining(cape_b), (0.45,) * 3, 'cloth', dyn='hat', show='hood')
cape_m = Mesh(cape_b, lambda x, y, z: (0.6 if y < 0.407 else 0.85,) * 3, 'cloth', dyn='hat', show='hood')
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

static = [torso_m, torso_in_m, neckhem_m, chest_m, hips_m, belt_m, buckle_m, pouch_m, head.skin, neck_m, *head.ears(), *head.eyes(), *head.brows(), hair, beard, hood, cape_m, cape_in_m, kerchief, *straw_m, cap_m]
finish('peasant', static, [leg_m, kband_m, chain_m, shoe_m, wraps_m], [arm_m, arm_in_m, fore_m, hand_m], HIP, SHOULDER, HAND)
