"""Zwierzęta w osadzie z Blendera: kura (trzy umaszczenia), świnia, pies (koń: horse_0ad.py) — gładkie bryły (Skin + Subdivision),
sierść i pióra w kolorach wierzchołków, cień w zagłębieniach.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/animals.py
Wynik: src/render/models/animals.json
  hen_white, hen_brown, hen_black — kura w jednej siatce (stoi na ziemi, przód +z)
  pig — świnia w jednej siatce
  dog_body, dog_leg, dog_hind (oś w barku/biodrze: dog_hips), dog_tail (oś u nasady: dog_tail_at, zwisa w dół)
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, bake_ao, evaluated, hexrgb, lathe, reset, skin, sphere  # noqa: E402

reset()
from body import pack  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix  # noqa: E402


def noise(x, y, z):
    v = math.sin(round(x * 1e4) * 0.01271 + round(y * 1e4) * 0.03117 + round(z * 1e4) * 0.00747) * 43758.5453
    return v - math.floor(v)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(p + (q - p) * t for p, q in zip(a, b))


def speck(c, x, y, z, k=0.08):
    f = 1 + (noise(x * 3.1, y * 2.7, z * 3.3) - 0.5) * 2 * k
    return tuple(min(1, ch * f) for ch in c)


def merged(meshes, mat='fur'):
    out = Mesh.__new__(Mesh)
    out.pos, out.nrm, out.col, out.idx = [], [], [], []
    out.mat, out.dyn, out.show = mat, None, None
    for m in meshes:
        base = len(out.pos)
        out.pos += m.pos
        out.nrm += m.nrm
        out.col += m.col
        out.idx += [tuple(base + i for i in f) for f in m.idx]
    return out


def fluff(m, amp, where=lambda x, y, z: True):
    """Sierść/pióra: wierzchołki wypchnięte losowo wzdłuż normalnej"""
    for i, ((x, y, z), n) in enumerate(zip(m.pos, m.nrm)):
        if where(x, y, z):
            d = (noise(x, y, z) - 0.35) * amp
            m.pos[i] = (x + n[0] * d, y + n[1] * d, z + n[2] * d)
    return m


def rotated(ob, rx=0.0, ry=0.0, rz=0.0, move=(0, 0, 0)):
    """Siatka obiektu obrócona (w układzie gry: rx wokół x, ry wokół y) i przesunięta"""
    bm = evaluated(ob)
    # oś y gry to z Blendera, oś z gry to -y Blendera
    if rx:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-rx, 3, 'X'))
    if ry:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(ry, 3, 'Z'))
    if rz:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(rz, 3, 'Y'))
    x, y, z = move
    bmesh.ops.translate(bm, verts=bm.verts, vec=(x, -z, y))
    return bm


out = {}


def save():
    dst = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', 'animals.json')
    with open(dst, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    tri = {k: sum(len(m['idx']) for m in v) * 3 // 4 // 6 for k, v in out.items() if isinstance(v, list) and v and isinstance(v[0], dict)}
    print('animals', tri, os.path.getsize(dst) // 1024, 'KB')


# ================= KURA =================
def hen(name, body_c, neck_c, tail_c, wing_c):
    reset()
    COMB, BEAKC, LEGC, EYE = hexrgb(0xc0281e), hexrgb(0xe0a530), hexrgb(0xd99a2a), (0.03, 0.03, 0.03)
    col = lambda x, y, z: speck(mix(mix(body_c, neck_c, (y - 0.095) / 0.02) if z > 0.02 else body_c, tuple(c * 0.8 for c in body_c), (0.05 - y) / 0.03), x, y, z)
    b = skin('hen', [(0, 0.095, -0.055), (0, 0.072, -0.01), (0, 0.072, 0.03), (0, 0.1, 0.048), (0, 0.124, 0.056)],
             [(0, 1), (1, 2), (2, 3), (3, 4)],
             [(0.022, 0.018), (0.046, 0.042), (0.04, 0.04), (0.019, 0.019), (0.021, 0.021)], subsurf=1)  # kur bywa sto: lżejsza siatka
    parts = [fluff(Mesh(evaluated(b), col, 'fur'), 0.004)]
    head = sphere('hhead', (0, 0.127, 0.057), (0.0165, 0.0175, 0.019), seg=12, rings=9)
    parts.append(Mesh(evaluated(head), col, 'fur'))
    tail = skin('htail', [(0, 0.09, -0.05), (0, 0.118, -0.07), (0, 0.14, -0.072)], [(0, 1), (1, 2)],
                [(0.008, 0.02), (0.006, 0.024), (0.003, 0.014)], subsurf=1)
    parts.append(fluff(Mesh(evaluated(tail), lambda x, y, z: speck(tail_c, x, y, z, 0.12), 'fur'), 0.004))
    for sx in (-1, 1):
        wing = skin(f'hwing{sx}', [(sx * 0.036, 0.085, 0.025), (sx * 0.042, 0.08, -0.015), (sx * 0.03, 0.082, -0.05)], [(0, 1), (1, 2)],
                    [(0.01, 0.026), (0.011, 0.028), (0.004, 0.012)], subsurf=1)
        parts.append(Mesh(evaluated(wing), lambda x, y, z: speck(wing_c, x, y, z, 0.1), 'fur'))
        eye = sphere(f'heye{sx}', (sx * 0.0135, 0.131, 0.066), 0.0034, seg=6, rings=4)
        parts.append(Mesh(evaluated(eye), EYE, 'fur'))
        leg = skin(f'hleg{sx}', [(sx * 0.012, 0.05, 0.0), (sx * 0.013, 0.004, 0.004), (sx * 0.013, 0.002, 0.024)], [(0, 1), (1, 2)],
                   [(0.0045, 0.0045), (0.0035, 0.0035), (0.0025, 0.002)], subsurf=0)
        parts.append(Mesh(evaluated(leg), LEGC, 'fur'))
        for a in (-0.6, 0.6):
            toe = skin(f'htoe{sx}{a}', [(sx * 0.013, 0.003, 0.004), (sx * 0.013 + math.sin(a) * 0.016, 0.002, 0.004 + math.cos(a) * 0.016)], [(0, 1)],
                       [(0.0025, 0.002), (0.0018, 0.0015)], subsurf=0)
            parts.append(Mesh(evaluated(toe), LEGC, 'fur'))
    comb = skin('comb', [(0, 0.136, 0.046), (0, 0.143, 0.056), (0, 0.139, 0.064)], [(0, 1), (1, 2)], [(0.004, 0.006), (0.005, 0.008), (0.004, 0.005)], subsurf=1)
    parts.append(Mesh(evaluated(comb), COMB, 'fur'))
    wattle = sphere('wattle', (0, 0.113, 0.066), (0.004, 0.008, 0.004), seg=8, rings=6)
    parts.append(Mesh(evaluated(wattle), COMB, 'fur'))
    beak = skin('hbeak', [(0, 0.124, 0.068), (0, 0.119, 0.084)], [(0, 1)], [(0.006, 0.005), (0.001, 0.001)], subsurf=1)
    parts.append(Mesh(evaluated(beak), BEAKC, 'fur'))
    bake_ao([(m, (0, 0, 0)) for m in parts], reach=0.03)
    out[name] = [pack(merged(parts))]


hen('hen_white', hexrgb(0xf0ece2), hexrgb(0xf6f2ea), hexrgb(0xe0dccf), hexrgb(0xe6e1d5))
hen('hen_brown', hexrgb(0xa8673a), hexrgb(0xd0903f), hexrgb(0x3a2416), hexrgb(0x8a5530))
hen('hen_black', hexrgb(0x2e2925), hexrgb(0x3a3a2e), hexrgb(0x1e2420), hexrgb(0x262a26))

# ================= ŚWINIA =================
reset()
PINK, BACK, BELLY, SNOUT, HOOF, MUD = hexrgb(0xd9a08c), hexrgb(0xc98e7a), hexrgb(0xe8b8a6), hexrgb(0xe8aa98), hexrgb(0x4a3a30), hexrgb(0x6a5040)


SPOT = hexrgb(0x5e4338)


def pigcol(x, y, z):
    c = mix(PINK, BACK, (y - 0.15) / 0.05) if y > 0.12 else mix(PINK, BELLY, (0.1 - y) / 0.04)
    # łaciata świnia (Michał 29.10.2026: „świnie trochę podrasuj”): duże ciemne łaty na grzbiecie i zadzie
    if y > 0.09 and z < 0.13 and math.sin(x * 24 + 1.1) * math.cos(z * 17 - 0.4) + 0.6 * math.sin(z * 31 + y * 20) > 0.35:
        c = mix(c, SPOT, 0.85)
    if y < 0.045:
        c = mix(c, MUD, 0.7)  # ubłocone racice i nogi
    return speck(c, x, y, z, 0.07)


# tułów: pękaty, beczkowaty, szerszy w zadzie; głowa osobno (masywna, z podgardlem), ryj na przedzie
b = skin('pig', [(0, 0.125, -0.15), (0, 0.135, -0.07), (0, 0.135, 0.03), (0, 0.128, 0.1), (0, 0.122, 0.135)],
         [(0, 1), (1, 2), (2, 3), (3, 4)],
         [(0.062, 0.062), (0.09, 0.084), (0.088, 0.082), (0.068, 0.064), (0.05, 0.05)], subsurf=2)
parts = [Mesh(evaluated(b), pigcol, 'fur')]
head = sphere('phead', (0, 0.128, 0.165), (0.05, 0.052, 0.058), seg=14, rings=10)
parts.append(Mesh(evaluated(head), pigcol, 'fur'))
jowl = sphere('pjowl', (0, 0.1, 0.165), (0.045, 0.03, 0.045), seg=12, rings=8)
parts.append(Mesh(evaluated(jowl), lambda x, y, z: mix(PINK, BELLY, 0.5), 'fur'))
# ryj: krótki walec z płaskim, wilgotnym talerzem i nozdrzami
snout = lathe('psnout', [(0.0, 0.0), (0.024, 0.0), (0.026, 0.035), (0.0, 0.036)], seg=12, subsurf=0)
parts.append(Mesh(rotated(snout, rx=-math.pi / 2, rz=0.0, move=(0.0, 0.118, 0.198)), SNOUT, 'fur'))
for sx in (-1, 1):
    n = sphere(f'nostril{sx}', (sx * 0.009, 0.118, 0.2345), (0.005, 0.006, 0.002), seg=6, rings=4)
    parts.append(Mesh(evaluated(n), (0.25, 0.14, 0.12), 'fur'))
    # uszy: duże, trójkątne, opadające do przodu na oczy
    ear = lathe(f'pear{sx}', [(0.026, 0.0), (0.018, 0.03), (0.003, 0.052)], seg=6, depth=0.3, subsurf=0)
    parts.append(Mesh(rotated(ear, rx=-1.8, rz=sx * 0.45, move=(sx * 0.034, 0.168, 0.168)), BACK, 'fur'))
    eye = sphere(f'peye{sx}', (sx * 0.03, 0.142, 0.198), 0.0045, seg=6, rings=4)
    parts.append(Mesh(evaluated(eye), (0.06, 0.04, 0.03), 'fur'))
    for z in (0.085, -0.095):
        leg = skin(f'pleg{sx}{z}', [(sx * 0.045, 0.09, z), (sx * 0.047, 0.03, z), (sx * 0.047, 0.004, z + 0.004)], [(0, 1), (1, 2)],
                   [(0.022, 0.024), (0.016, 0.016), (0.015, 0.014)], subsurf=1)
        parts.append(Mesh(evaluated(leg), lambda x, y, z: HOOF if y < 0.014 else pigcol(x, y, z), 'fur'))
# ogonek zakręcony w sprężynkę
tail = skin('ptail', [(0, 0.14, -0.185), (0.014, 0.152, -0.205), (0.0, 0.168, -0.212), (-0.012, 0.16, -0.2), (0.0, 0.152, -0.193), (0.008, 0.166, -0.192)],
            [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)],
            [(0.0055, 0.0055), (0.0048, 0.0048), (0.0042, 0.0042), (0.0036, 0.0036), (0.003, 0.003), (0.002, 0.002)], subsurf=1)
parts.append(Mesh(evaluated(tail), PINK, 'fur'))
bake_ao([(m, (0, 0, 0)) for m in parts], reach=0.05)
out['pig'] = [pack(merged(parts))]

# koń: gotowy model z 0 A.D. — tools/models/horse_0ad.py → horse.json

# ================= PIES (płowy kundel) =================
reset()
TANC, BACKC, CREAM, MUZD = hexrgb(0xb07a3c), hexrgb(0x7a5228), hexrgb(0xe0c79a), hexrgb(0x3a2a1c)


def dogcol(x, y, z):
    c = mix(TANC, BACKC, (y - 0.22) / 0.04) if y > 0.19 else mix(TANC, CREAM, (0.19 - y) / 0.03)
    if z > 0.06 and y < 0.24:
        c = mix(c, CREAM, 0.7)  # jasna pierś
    if z > 0.19:
        c = mix(c, MUZD, (z - 0.19) / 0.03)  # ciemny pyszczek
    return speck(c, x, y, z, 0.07)


b = skin('dog', [(0, 0.205, -0.13), (0, 0.205, -0.05), (0, 0.2, 0.05), (0, 0.24, 0.1), (0, 0.28, 0.14), (0, 0.272, 0.195), (0, 0.268, 0.222)],
         [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6)],
         [(0.038, 0.042), (0.042, 0.046), (0.048, 0.054), (0.034, 0.04), (0.036, 0.034), (0.018, 0.016), (0.01, 0.009)], subsurf=2)
parts = [fluff(Mesh(evaluated(b), dogcol, 'fur'), 0.005)]
nose = sphere('dnose', (0, 0.272, 0.226), (0.009, 0.008, 0.007), seg=8, rings=6)
parts.append(Mesh(evaluated(nose), (0.06, 0.05, 0.04), 'fur'))
for sx in (-1, 1):
    # klapnięte uszy: płaskie płaty zwisające po bokach łba
    ear = sphere(f'dear{sx}', (0, 0, 0), (0.006, 0.026, 0.018), seg=8, rings=6)
    parts.append(Mesh(rotated(ear, rz=sx * 0.35, rx=0.2, move=(sx * 0.034, 0.285, 0.13)), lambda x, y, z: speck(BACKC, x, y, z), 'fur'))
    eye = sphere(f'deye{sx}', (sx * 0.02, 0.292, 0.168), 0.0045, seg=6, rings=4)
    parts.append(Mesh(evaluated(eye), (0.04, 0.03, 0.02), 'fur'))
HIPS = [(-0.03, 0.19, 0.06), (0.03, 0.19, 0.06), (-0.03, 0.2, -0.1), (0.03, 0.2, -0.1)]
legcol = lambda x, y, z: speck(CREAM if y < -0.15 else mix(TANC, BACKC, 0.2), x, y, z)
leg = skin('dleg', [(0, 0.02, 0), (0, -0.1, 0.005), (0, -0.18, 0.0), (0, -0.188, 0.016)], [(0, 1), (1, 2), (2, 3)],
           [(0.022, 0.024), (0.013, 0.014), (0.011, 0.011), (0.012, 0.008)], subsurf=1)
leg_m = Mesh(evaluated(leg), legcol, 'fur')
hind = skin('dhind', [(0, 0.02, 0), (0, -0.06, 0.01), (0, -0.12, -0.025), (0, -0.192, -0.006), (0, -0.198, 0.012)], [(0, 1), (1, 2), (2, 3), (3, 4)],
            [(0.028, 0.032), (0.022, 0.026), (0.011, 0.012), (0.01, 0.01), (0.012, 0.008)], subsurf=1)
hind_m = Mesh(evaluated(hind), legcol, 'fur')
tail = skin('dtail', [(0, 0, 0), (0, -0.07, -0.012), (0, -0.12, 0.0)], [(0, 1), (1, 2)], [(0.011, 0.011), (0.013, 0.013), (0.004, 0.004)], subsurf=1)
tail_m = fluff(Mesh(evaluated(tail), lambda x, y, z: speck(CREAM if y < -0.1 else TANC, x, y, z), 'fur'), 0.006)
pose = [(m, (0, 0, 0)) for m in parts] + [(leg_m, HIPS[0]), (leg_m, HIPS[1]), (hind_m, HIPS[2]), (hind_m, HIPS[3])]
bake_ao(pose, reach=0.05, sample=[(m, (0, 0, 0)) for m in parts] + [(leg_m, HIPS[0]), (hind_m, HIPS[2])])
out['dog_body'] = [pack(merged(parts))]
out['dog_leg'] = [pack(leg_m)]
out['dog_hind'] = [pack(hind_m)]
out['dog_tail'] = [pack(tail_m)]
out['dog_hips'] = HIPS
out['dog_tail_at'] = (0, 0.215, -0.15)
save()
