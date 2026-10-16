"""Pochodnia na słupie (wolnostojąca i przy wejściach budynków): ociosany słup z dwiema żelaznymi opaskami, wbity
w kopczyk ziemi obłożony kamieniami, na górze kuty kosz ogniowy z prętów, w nim szczapy nasączone smołą.
Płomień dokłada gra (punkt 'torchflame' nad koszem); w dzień kosz stoi pusty i zgaszony.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/torch.py  →  src/render/models/torch.json
Układ: słup stoi w (0, 0, 0), wysokość kosza jak w dawnej pochodni (ok. 0,92–1,05), płomień ok. 1,1.
Materiały siatek: wood (słup, szczapy — tekstura kory), iron (opaski, kosz), stone (kamienie), soil (kopczyk), pitch (smoła).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, bake_ao, reset  # noqa: E402

reset()
from body import pack  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', 'torch.json')


def noise(x, y, z):
    return (math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1.0


def g2b(x, y, z):
    return (x, -z, y)   # układ gry (y w górę) → Blender (z w górę)


def tube(path, radii, seg=8):
    """Zamknięta bryła wzdłuż łamanej (układ gry): pierścienie wierzchołków, ścianki boczne i denka"""
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(path):
        p = Vector(p)
        d = (Vector(path[min(i + 1, len(path) - 1)]) - Vector(path[max(i - 1, 0)])).normalized()
        up = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
        u = d.cross(up).normalized(); v = d.cross(u).normalized()
        rings.append([bm.verts.new(g2b(*(p + (u * math.cos(2 * math.pi * k / seg) + v * math.sin(2 * math.pi * k / seg)) * radii[i]))) for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((a[k], a[k2], b[k2], b[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return bm


def ring(y, r_in, r_out, h, seg=12):
    """Zamknięta obręcz (opaska na słupie, obręcz kosza)"""
    bm = bmesh.new()
    o, i = [], []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        c, s = math.cos(a), math.sin(a)
        o.append((bm.verts.new(g2b(c * r_out, y, s * r_out)), bm.verts.new(g2b(c * r_out, y + h, s * r_out))))
        i.append((bm.verts.new(g2b(c * r_in, y, s * r_in)), bm.verts.new(g2b(c * r_in, y + h, s * r_in))))
    for k in range(seg):
        j = (k + 1) % seg
        bm.faces.new((o[k][0], o[j][0], o[j][1], o[k][1]))
        bm.faces.new((i[k][0], i[k][1], i[j][1], i[j][0]))
        bm.faces.new((o[k][1], o[j][1], i[j][1], i[k][1]))
        bm.faces.new((o[k][0], i[k][0], i[j][0], o[j][0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return bm


def rock(cx, cz, r, seed):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
    for v in bm.verts:
        k = 1 + (noise(v.co.x * 40 + seed, v.co.y * 40, v.co.z * 40) - 0.5) * 0.5
        v.co.x *= k; v.co.y *= k; v.co.z *= k * 0.6
        v.co.z = max(v.co.z, -r * 0.2)
    bmesh.ops.translate(bm, verts=bm.verts, vec=g2b(cx, r * 0.35, cz))
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return bm


speck = lambda base, k=0.1: (lambda x, y, z: tuple(min(1.0, c * (1 + (noise(x * 31, y * 31, z * 31) - 0.5) * k)) for c in base))
parts = []

# kopczyk ziemi u stopy słupa i kilka kamieni dookoła (klinują słup)
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
for v in bm.verts:
    v.co.x *= 0.12; v.co.y *= 0.12; v.co.z = max(v.co.z, 0.0) * 0.05
bmesh.ops.triangulate(bm, faces=bm.faces)
parts.append(Mesh(bm, speck((0.62, 0.55, 0.45), 0.25), 'soil'))
for k, (a, r) in enumerate(((0.3, 0.04), (1.9, 0.035), (3.4, 0.045), (4.9, 0.032))):
    parts.append(Mesh(rock(math.cos(a) * 0.1, math.sin(a) * 0.1, r, k * 7), speck((0.74, 0.72, 0.68), 0.2), 'stone'))

# słup: ociosany (ośmiokąt), lekko zwężający się, z nieregularnościami
pole = [(0, -0.02, 0), (0.002, 0.3, 0.001), (-0.002, 0.6, 0.002), (0.001, 0.9, 0)]
parts.append(Mesh(tube(pole, [0.036, 0.034, 0.031, 0.029], seg=8), speck((0.55, 0.42, 0.3), 0.15), 'wood'))
for y in (0.28, 0.62):
    parts.append(Mesh(ring(y, 0.03, 0.039, 0.022), speck((0.36, 0.35, 0.34), 0.1), 'iron'))

# kosz ogniowy: obręcz u dołu, sześć wygiętych prętów rozchylonych ku górze, obręcz u góry, dno z dwóch krzyżujących się sztab
Y0, Y1 = 0.9, 1.04
parts.append(Mesh(ring(Y0, 0.026, 0.05, 0.02), speck((0.33, 0.32, 0.31), 0.1), 'iron'))
parts.append(Mesh(ring(Y1, 0.084, 0.094, 0.014), speck((0.33, 0.32, 0.31), 0.1), 'iron'))
for k in range(6):
    a = 2 * math.pi * k / 6
    c, s = math.cos(a), math.sin(a)
    bar = [(c * 0.045, Y0 + 0.01, s * 0.045), (c * 0.07, Y0 + 0.06, s * 0.07), (c * 0.089, Y1 + 0.012, s * 0.089), (c * 0.095, Y1 + 0.03, s * 0.095)]
    parts.append(Mesh(tube(bar, [0.007, 0.007, 0.007, 0.004], seg=4), speck((0.33, 0.32, 0.31), 0.1), 'iron'))
for a in (0.0, math.pi / 2):
    c, s = math.cos(a), math.sin(a)
    parts.append(Mesh(tube([(-c * 0.06, Y0 + 0.025, -s * 0.06), (c * 0.06, Y0 + 0.025, s * 0.06)], [0.007, 0.007], seg=4), speck((0.33, 0.32, 0.31), 0.1), 'iron'))

# szczapy nasączone smołą, ułożone w koszu w stożek (zwęglone końce u góry)
for k in range(7):
    a = 2 * math.pi * k / 7 + 0.3
    c, s = math.cos(a), math.sin(a)
    st = [(c * 0.05, Y0 + 0.03, s * 0.05), (c * 0.02, Y1 + 0.03 + (k % 3) * 0.008, s * 0.02)]
    parts.append(Mesh(tube(st, [0.014, 0.011], seg=5), speck((0.42, 0.3, 0.2), 0.2), 'wood'))
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
for v in bm.verts:
    v.co.x *= 0.055; v.co.y *= 0.055; v.co.z = v.co.z * 0.03
bmesh.ops.translate(bm, verts=bm.verts, vec=g2b(0, Y0 + 0.05, 0))
bmesh.ops.triangulate(bm, faces=bm.faces)
parts.append(Mesh(bm, speck((0.12, 0.1, 0.09), 0.2), 'pitch'))

bake_ao([(m, (0, 0, 0)) for m in parts], reach=0.06)
groups = {}
for m in parts:
    groups.setdefault(m.mat, []).append(m)
out = {'flame': [0, 1.13, 0], 'parts': []}
tris = 0
for mat, ms in groups.items():
    m0 = ms[0]
    for m in ms[1:]:
        base = len(m0.pos)
        m0.pos += m.pos; m0.nrm += m.nrm; m0.col += m.col
        m0.idx += [tuple(base + i for i in f) for f in m.idx]
    m0.idx = [t for f in m0.idx for t in ([f] if len(f) == 3 else [(f[0], f[k], f[k + 1]) for k in range(1, len(f) - 1)])]
    tris += len(m0.idx)
    out['parts'].append(pack(m0))
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('torch:', tris, 'trójkątów,', os.path.getsize(OUT) // 1024, 'KB')
