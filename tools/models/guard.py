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
greave_m = Mesh(evaluated(greave), IRON, 'metal')

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

# ---------- głowa: twarz modelowana przesunięciami kuli ----------
def bump(u, v, cu, cv, su, sv):
    return math.exp(-((u - cu) ** 2) / (2 * su * su) - ((v - cv) ** 2) / (2 * sv * sv))
def face(x, y, z):
    # u: kąt wokół osi (0 = przód), v: wysokość -1..1
    u, v = math.atan2(x, z), y
    front = max(0.0, z)
    k = 1.0
    k -= 0.2 * max(0.0, -v - 0.25)                 # węższa żuchwa
    k += 0.09 * bump(u, v, 0, -0.8, 0.32, 0.14)    # broda, mocna szczęka
    k += 0.07 * bump(u, v, 0.55, -0.62, 0.22, 0.14) + 0.07 * bump(u, v, -0.55, -0.62, 0.22, 0.14)  # kąty żuchwy
    k += 0.3 * bump(u, v, 0, -0.14, 0.075, 0.17) * front   # nos
    k += 0.09 * bump(u, v, 0, -0.33, 0.1, 0.05) * front    # czubek nosa
    k += 0.09 * bump(u, v, 0, 0.2, 0.55, 0.07) * front     # łuk brwiowy
    k -= 0.05 * bump(u, v, 0, -0.5, 0.25, 0.05) * front    # bruzda ust
    for su in (-0.36, 0.36):
        k -= 0.13 * bump(u, v, su, 0.04, 0.13, 0.09) * front  # oczodoły
        k += 0.05 * bump(u, v, su * 1.4, -0.18, 0.15, 0.1) * front  # kości policzkowe
    k += 0.04 * bump(u, v, math.pi, 0.25, 0.8, 0.5)  # pełna potylica
    return x * k * (0.92 if z < 0 else 1), y, z * k
HEAD_C, HEAD_R = (0.0, 0.578, 0.004), (0.046, 0.058, 0.05)
head = sphere('head', HEAD_C, HEAD_R, seg=22, rings=16, shape=face)
# oczy: ciemne zagłębienia wprost w kolorze skóry (bez osobnych siatek gałek)
def head_col(x, y, z):
    k = 1.0
    for sx in (-1, 1):
        d = math.sqrt(((x - sx * 0.0165) / 0.0085) ** 2 + ((y - 0.5835) / 0.0055) ** 2)
        if z > 0.03:
            k = min(k, 0.22 + 0.78 * min(1.0, d))
    return (k, k, k)
head_m = Mesh(evaluated(head), head_col, 'skin', dyn='skin')
neck = lathe('neck', [(0.024, 0.488), (0.025, 0.53), (0.026, 0.545)], seg=10, subsurf=0)
neck_m = Mesh(evaluated(neck), WHITE, 'skin', dyn='skin')
ears = []
for sx in (-1, 1):
    e = sphere(f'ear{sx}', (sx * 0.044, 0.574, -0.006), (0.006, 0.013, 0.009), seg=8, rings=6)
    ears.append(Mesh(evaluated(e), WHITE, 'skin', dyn='skin'))
# włosy, brwi i broda: powłoki nad skórą, które łagodnie chowają się pod nią tam, gdzie ich nie ma (gładki brzeg, bez cięcia)
def shell(name, grow, mask, seg=22, rings=16):
    def shp(x, y, z):
        x, y, z = face(x, y, z)
        k = 0.985 + (grow - 0.985) * max(0.0, min(1.0, mask(x, y, z)))
        return x * k, (y - 0.0) * k, z * k
    ob = sphere(name, HEAD_C, HEAD_R, seg=seg, rings=rings, shape=shp)
    bm = evaluated(ob)
    # ściany całkiem schowane pod skórą nie są potrzebne (mniej trójkątów, brzeg zostaje gładki)
    unit = lambda x, y, z: ((x - HEAD_C[0]) / HEAD_R[0], (y - HEAD_C[1]) / HEAD_R[1], (z - HEAD_C[2]) / HEAD_R[2])
    dead = [f for f in bm.faces if all(mask(*unit(v.co.x, v.co.z, -v.co.y)) < 0.02 for v in f.verts)]
    import bmesh as _b
    _b.ops.delete(bm, geom=dead, context='FACES')
    _b.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    return bm
def smooth(e0, e1, t):
    t = max(0.0, min(1.0, (t - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
# czupryna: na czubku i z tyłu, linia włosów nad czołem i nad uszami
hair = shell('hair', 1.075, lambda x, y, z: smooth(0.0, 0.1, y - (0.16 + 0.48 * z)))  # linia włosów: wysoko nad czołem, nad uszami, nisko na karku
hair_m = Mesh(hair, WHITE, 'cloth', dyn='hair')
# broda: żuchwa i podbródek, wąsy nad ustami, bez policzków pod oczami
beard = shell('beard', 1.085, lambda x, y, z: smooth(0.0, 0.12, -0.46 - y + 0.12 * (1 - z)) * smooth(-0.1, 0.35, z))  # tylko żuchwa i podbródek
beard_m = Mesh(beard, WHITE, 'cloth', dyn='hair', show='beard')
# brwi: dwa krzaczaste łuki nad oczami
brow = shell('brow', 1.045, lambda x, y, z: smooth(0.0, 0.06, 0.12 - abs(y - 0.33)) * smooth(0.6, 0.85, z) * smooth(0.04, 0.12, abs(x)) * smooth(0.0, 0.1, 0.55 - abs(x)))
brow_m = Mesh(brow, WHITE, 'cloth', dyn='hair')

# ---------- cień w zagłębieniach liczony na całej postaci w pozie spoczynkowej ----------
static = [torso_m, skirt_m, chest_m, *paul, buckle_m, sheath_m, sash_m, head_m, neck_m, *ears, hair_m, brow_m, beard_m]
pose = [(m, (0, 0, 0)) for m in static]
for sx in (-1, 1):
    pose += [(leg_m, (sx * HIP[0], HIP[1], HIP[2])), (greave_m, (sx * HIP[0], HIP[1], HIP[2]))]
    pose += [(arm_m, (sx * SHOULDER[0], SHOULDER[1], SHOULDER[2]))]
# każdą siatkę liczymy raz (noga i ręka są wspólne dla obu stron), a cień bierzemy z prawej strony
seen, uniq = set(), []
for m, o in pose:
    if id(m) in seen:
        continue
    seen.add(id(m))
    uniq.append((m, o))
# bryła do zasłaniania z całej postaci, przyciemniamy każdą siatkę raz
bake_ao(pose, sample=uniq)

# ---------- łączenie siatek: jedna siatka na materiał i kolor (mniej wywołań rysowania) ----------
def join(meshes, mat=None):
    out = Mesh.__new__(Mesh)
    out.pos, out.nrm, out.col, out.idx = [], [], [], []
    out.mat, out.dyn, out.show = mat or meshes[0].mat, meshes[0].dyn, meshes[0].show
    for m in meshes:
        base = len(out.pos)
        out.pos += m.pos; out.nrm += m.nrm; out.col += m.col
        out.idx += [tuple(base + i for i in f) for f in m.idx]
    return out
def groups(meshes, mat_of=lambda m: m.mat):
    by = {}
    for m in meshes:
        by.setdefault((mat_of(m), m.dyn, m.show), []).append(m)
    return [join(v, k[0]) for k, v in by.items()]
# stałe kolory skóry i tkaniny w jedną (dwustronną) siatkę; metal osobno, bo inaczej błyszczy
static = groups(static, lambda m: 'cloth' if m.mat in ('leather', 'cloth') and m.dyn is None else m.mat)
leg_all = [join([leg_m, greave_m], 'leather')]  # nagolennik w tej samej siatce co noga (kolor stali z wierzchołków)

# ---------- zapis ----------
def pack(m):
    pos = b''.join(struct.pack('<3f', *p) for p in m.pos)
    nrm = b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in m.nrm)
    col = b''.join(struct.pack('<3B', *[max(0, min(255, round(c * 255))) for c in cc]) for cc in m.col)
    idx = b''.join(struct.pack('<3H', *f) for f in m.idx)
    e = lambda b: base64.b64encode(b).decode()
    return {'mat': m.mat, 'dyn': m.dyn, 'show': m.show, 'pos': e(pos), 'nrm': e(nrm), 'col': e(col), 'idx': e(idx)}

out = {
    'hip': HIP, 'shoulder': SHOULDER, 'hand': HAND,
    'static': [pack(m) for m in static],
    'leg': [pack(m) for m in leg_all],
    'arm': [pack(arm_m)],
}
dst = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', 'guard.json')
os.makedirs(os.path.dirname(dst), exist_ok=True)
with open(dst, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
for nm, m in [('torso', torso_m), ('skirt', skirt_m), ('chest', chest_m), ('paul', paul[0]), ('head', head_m), ('hair', hair_m), ('beard', beard_m), ('brow', brow_m), ('sash', sash_m), ('leg', leg_m), ('greave', greave_m), ('arm', arm_m)]:
    print(' ', nm, len(m.idx))
tris = sum(len(m.idx) for m in static) + 2 * (sum(len(m.idx) for m in leg_all) + len(arm_m.idx))
print('siatki: tułów', len(static), 'noga', len(leg_all), 'ręka 1')
print('zapisano', os.path.relpath(dst), 'trójkątów na postać:', tris, 'rozmiar:', os.path.getsize(dst) // 1024, 'KB')
