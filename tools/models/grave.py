"""Leśny grób chłopa (osada bez cmentarza, 0.58.3): podłużny kopczyk świeżej ziemi z grudami i krzyż z dwóch
nieokorowanych kijów związanych łykiem, wbity w głowach. Jednostka = jedno pole mapy (człowiek ma ok. 0,42 wysokości).
Kopczyk leży wzdłuż osi z (głowy w -z), środek w (0, 0, 0); gra obraca go losowo w miejscu pochówku.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/grave.py
Wynik: src/render/models/grave.json — klucz `grave`, lista siatek z polem `mat`:
  soil (ziemia, tekstura gleby), bark (kora, tekstura kory), plain (łyko, bez tekstury).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, bake_ao, evaluated, reset, skin, sphere  # noqa: E402

reset()
from body import pack  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix  # noqa: E402


def noise(x, y, z):
    v = math.sin(round(x * 1e4) * 0.01271 + round(y * 1e4) * 0.03117 + round(z * 1e4) * 0.00747) * 43758.5453
    return v - math.floor(v)


def speck(c, x, y, z, k=0.1):
    f = 1 + (noise(x * 3.1, y * 2.7, z * 3.3) - 0.5) * 2 * k
    return tuple(min(1, ch * f) for ch in c)


def hexc(h):
    return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)


def merged(meshes, mat):
    m0 = Mesh.__new__(Mesh)
    m0.pos, m0.nrm, m0.col, m0.idx = [], [], [], []
    m0.mat, m0.dyn, m0.show = mat, None, None
    for m in meshes:
        base = len(m0.pos)
        m0.pos += m.pos
        m0.nrm += m.nrm
        m0.col += m.col
        m0.idx += [tuple(base + i for i in f) for f in m.idx]
    return m0


out = {}


def finish(name, parts, reach=0.05):
    for m in parts:
        m.idx = [t for f in m.idx for t in ([f] if len(f) == 3 else [(f[0], f[k], f[k + 1]) for k in range(1, len(f) - 1)])]
    bake_ao([(m, (0, 0, 0)) for m in parts], reach=reach)
    groups = {}
    for m in parts:
        groups.setdefault(m.mat, []).append(m)
    out[name] = [pack(merged(v, k)) for k, v in groups.items()]


SOIL = hexc(0x4a3524)
SOIL_D = hexc(0x3a281a)
BARK = hexc(0x5a4230)
BARK_L = hexc(0x7a5e44)
BAST = hexc(0xa88a5a)

parts = []
# ---- kopczyk: podłużny, ubity od góry, nierówny; dolna połowa siedzi w ziemi (spód zamknięty, jest kulą) ----
L, W, H = 0.2, 0.1, 0.055       # połowa długości, połowa szerokości, wysokość nad ziemią


def mound_shape(x, y, z):
    # bieguny kuli na końcach kopczyka (oś z), nie na grzbiecie: bez gwiazdy z trójkątów na wierzchu
    y, z = z, -y  # obrót (nie lustro), żeby ściany nie wywróciły się na lewą stronę
    # spłaszczony grzbiet, lekko zwężony w nogach, grudy i bruzdy po łopacie
    bump = (noise(x * 7 + 1, y * 7, z * 7) - 0.5) * 0.16 + math.sin(z * 11 + x * 3) * 0.03
    w = 1 - 0.12 * max(0.0, z)  # nogi (+z) węższe
    yy = y if y < 0 else min(y, 0.82) * 1.12
    return x * w * (1 + bump), yy * (1 + bump * 0.6), z * (1 + bump * 0.3)


mound = sphere('mound', (0, 0, 0), (W, H, L), seg=36, rings=22, shape=mound_shape)
parts.append(Mesh(evaluated(mound), lambda x, y, z: speck(SOIL if y > 0.02 else SOIL_D, x, y, z, 0.22), 'soil'))
# grudy ziemi rozrzucone po kopczyku i obok (zakopywał w pośpiechu)
for i in range(9):
    a = noise(i, 2, 3) * math.tau
    r = 0.6 + noise(i, 5, 1) * 0.55
    gx, gz = math.cos(a) * W * r * 1.1, math.sin(a) * L * r
    on = r < 1.0
    gy = (H * 0.75 * math.sqrt(max(0.0, 1 - r * r)) if on else 0.004)
    s = 0.012 + noise(i, 9, 4) * 0.012
    j = i
    clod = sphere(f'clod{i}', (gx, gy - s * 0.25, gz), (s, s * 0.55, s * 0.85), seg=9, rings=6,
                  shape=lambda a_, b_, c_: (a_ * (1 + 0.35 * (noise(a_ * 3 + j, b_ * 3, c_ * 3) - 0.5)),
                                            b_ * (1 + 0.4 * (noise(c_ * 3, a_ * 3 + j, b_) - 0.5)), c_ * (1 + 0.3 * (noise(b_, c_ * 3, a_ + j) - 0.5))))
    parts.append(Mesh(evaluated(clod), lambda x, y, z: speck(SOIL_D, x, y, z, 0.2), 'soil'))

# ---- krzyż z dwóch kijów w głowach (-z), wbity w ziemię i lekko przekrzywiony ----
CZ = -L - 0.01
tilt = 0.07
post = skin('post', [(0, -0.03, CZ), (0.003, 0.09, CZ - 0.002), (0.006, 0.2, CZ - 0.004)], [(0, 1), (1, 2)],
            [(0.0085, 0.0085), (0.008, 0.008), (0.0065, 0.0065)], subsurf=1)
bm = evaluated(post)
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, -CZ, 0), matrix=Matrix.Rotation(tilt, 3, 'Y'))
parts.append(Mesh(bm, lambda x, y, z: speck(BARK if noise(x * 40, y * 40, z * 40) > 0.3 else BARK_L, x, y, z, 0.15), 'bark'))
ARM_Y = 0.145
arm = skin('arm', [(-0.058, ARM_Y + 0.004, CZ + 0.012), (0.0, ARM_Y, CZ + 0.012), (0.056, ARM_Y - 0.003, CZ + 0.012)], [(0, 1), (1, 2)],
           [(0.0065, 0.0065), (0.007, 0.007), (0.006, 0.006)], subsurf=1)
bm = evaluated(arm)
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, -CZ, 0), matrix=Matrix.Rotation(tilt, 3, 'Y'))
parts.append(Mesh(bm, lambda x, y, z: speck(BARK_L if noise(x * 40, y * 40, z * 40) > 0.4 else BARK, x, y, z, 0.15), 'bark'))
# łyko owinięte na skrzyżowaniu: dwie zamknięte obręcze na ukos (na krzyż), przez które przechodzą oba kije
def ring(r_in, r_out, h, seg=14):
    bm = bmesh.new()
    outer, inner = [], []
    for k in range(seg):
        a = k / seg * math.tau
        c, s_ = math.cos(a), math.sin(a)
        outer.append((bm.verts.new((c * r_out, s_ * r_out, -h / 2)), bm.verts.new((c * r_out, s_ * r_out, h / 2))))
        inner.append((bm.verts.new((c * r_in, s_ * r_in, -h / 2)), bm.verts.new((c * r_in, s_ * r_in, h / 2))))
    for k in range(seg):
        j = (k + 1) % seg
        (o0, o1), (p0, p1) = outer[k], outer[j]
        (i0, i1), (q0, q1) = inner[k], inner[j]
        bm.faces.new((o0, p0, p1, o1))
        bm.faces.new((i0, i1, q1, q0))
        bm.faces.new((o1, p1, q1, i1))
        bm.faces.new((o0, i0, q0, p0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return bm


for k, ang in enumerate((math.pi / 4, -math.pi / 4)):
    loop = ring(0.0105, 0.0135, 0.005 + 0.001 * k)
    # oś obręczy z pionu (z Blendera) kładziemy na ukos w płaszczyźnie krzyża (x–y gry = x–z Blendera)
    bmesh.ops.rotate(loop, verts=loop.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(ang, 3, 'Y'))
    bmesh.ops.translate(loop, verts=loop.verts, vec=(0.0035, -(CZ + 0.006), ARM_Y + 0.0002))
    bmesh.ops.rotate(loop, verts=loop.verts, cent=(0, -CZ, 0), matrix=Matrix.Rotation(tilt, 3, 'Y'))
    parts.append(Mesh(loop, lambda x, y, z: speck(BAST, x, y, z, 0.12), 'plain'))
finish('grave', parts, reach=0.05)

dst = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', 'grave.json')
with open(dst, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('grave', {k: sum(len(m['idx']) for m in v) * 3 // 4 // 6 for k, v in out.items()}, os.path.getsize(dst) // 1024, 'KB')
