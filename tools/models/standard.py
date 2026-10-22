"""Drzewce chorążego: proporzec w barwach pana niesiony na plecach, jak u chorążych w drużynie rycerskiej.
Ociosane jesionowe drzewce zatknięte w skórzany kubek przy pasie i przypięte rzemieniem na wysokości łopatek,
lekko odchylone do tyłu; u góry kuty grot-liść z tuleją i krótka poprzeczka, pod którą wisi płachta.
Płachtę (barwa drużyny, herb, łopotanie w shaderze) dokłada gra (src/render/banners.ts) w punkcie 'flag'.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/standard.py  →  src/render/models/standard.json
Układ jak postać: stopy w (0, 0, 0), twarz w +z, plecy w -z; wysokość postaci ok. 0,65 (czubek głowy).
Materiały siatek: wood (drzewce, poprzeczka), iron (grot, tuleja, okucia), leather (kubek, rzemienie).
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
from mathutils import Vector  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', 'standard.json')


def noise(x, y, z):
    return (math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1.0


def g2b(x, y, z):
    return (x, -z, y)   # układ gry (y w górę) → Blender (z w górę)


def tube(path, radii, seg=8, squash=1.0):
    """Zamknięta bryła wzdłuż łamanej (układ gry): pierścienie, ścianki i denka; squash spłaszcza przekrój w osi v"""
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(path):
        p = Vector(p)
        d = (Vector(path[min(i + 1, len(path) - 1)]) - Vector(path[max(i - 1, 0)])).normalized()
        up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
        u = d.cross(up).normalized(); v = d.cross(u).normalized()
        rings.append([bm.verts.new(g2b(*(p + (u * math.cos(2 * math.pi * k / seg) + v * math.sin(2 * math.pi * k / seg) * squash) * radii[i]))) for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((a[k], a[k2], b[k2], b[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return bm


speck = lambda base, k=0.1: (lambda x, y, z: tuple(min(1.0, c * (1 + (noise(x * 31, y * 31, z * 31) - 0.5) * k)) for c in base))
WOOD, IRON, LEATHER = (0.6, 0.46, 0.31), (0.36, 0.37, 0.39), (0.3, 0.2, 0.13)
parts = []

# drzewce: od kubka przy pasie (y 0,24) za plecami w górę, odchylone do tyłu o ok. 6°; grot ok. półtora wzrostu postaci
TILT = 0.1
X0, Z0, Y0, Y1 = 0.03, -0.062, 0.24, 1.0


def on_pole(y):
    """Punkt na osi drzewca na wysokości y"""
    return (X0, y, Z0 - (y - Y0) * TILT)


pole = [on_pole(y) for y in (Y0, 0.45, 0.65, 0.85, Y1)]
parts.append(Mesh(tube(pole, [0.0115, 0.0112, 0.0106, 0.0101, 0.0096], seg=8), speck(WOOD, 0.14), 'wood'))
# skórzany kubek przy pasie (w nim stoi drzewce) i rzemień przez plecy na wysokości łopatek
parts.append(Mesh(tube([on_pole(Y0 - 0.012), on_pole(Y0 + 0.06)], [0.019, 0.018], seg=10), speck(LEATHER, 0.12), 'leather'))
for y in (0.43,):
    cx, _, cz = on_pole(y)
    strap = [(cx - 0.09, y - 0.035, cz + 0.035), (cx - 0.03, y - 0.004, cz - 0.004), (cx + 0.03, y + 0.004, cz - 0.004), (cx + 0.07, y + 0.03, cz + 0.035)]
    parts.append(Mesh(tube(strap, [0.006, 0.006, 0.006, 0.006], seg=4, squash=0.45), speck(LEATHER, 0.1), 'leather'))
# żelazne okucie pod poprzeczką i tuleja grotu
for y, r, h in ((0.88, 0.0135, 0.016), (Y1 - 0.01, 0.0125, 0.03)):
    parts.append(Mesh(tube([on_pole(y), on_pole(y + h)], [r, r], seg=8), speck(IRON, 0.1), 'iron'))
# grot w kształcie liścia (spłaszczony, z grzbietem)
tip = [on_pole(Y1 + 0.02), on_pole(Y1 + 0.045), on_pole(Y1 + 0.08), on_pole(Y1 + 0.1)]
parts.append(Mesh(tube(tip, [0.006, 0.017, 0.012, 0.0015], seg=6, squash=0.3), speck((0.55, 0.57, 0.6), 0.08), 'iron'))
# poprzeczka nad płachtą (płachta wisi od niej do tyłu), z gałkami na końcach
FY = 0.935
cx, _, cz = on_pole(FY)
parts.append(Mesh(tube([(cx, FY, cz + 0.012), (cx, FY, cz - 0.3)], [0.0065, 0.0065], seg=6), speck(WOOD, 0.12), 'wood'))
parts.append(Mesh(tube([(cx, FY, cz - 0.296), (cx, FY, cz - 0.316)], [0.0095, 0.0095], seg=6), speck(IRON, 0.1), 'iron'))

bake_ao([(m, (0, 0, 0)) for m in parts], reach=0.05)
groups = {}
for m in parts:
    groups.setdefault(m.mat, []).append(m)
# płachta: lewy brzeg przy drzewcu tuż pod poprzeczką, płachta idzie do tyłu (-z); środek wysokości 0,1 pod poprzeczką
out = {'flag': [round(cx, 4), round(FY - 0.105, 4), round(cz - 0.012, 4)], 'tilt': TILT, 'parts': []}
tris = 0
for mat, ms in groups.items():
    m0 = ms[0]
    for m in ms[1:]:
        base = len(m0.pos)
        m0.pos += m.pos; m0.nrm += m.nrm; m0.col += m.col
        m0.idx += [tuple(base + i for i in f) for f in m.idx]
    m0.idx = [t for f in m0.idx for t in ([f] if len(f) == 3 else [(f[0], f[k], f[k + 1]) for k in range(1, len(f) - 1)])]
    tris += len(m0.idx)
    p = pack(m0)
    p['mat'] = mat
    out['parts'].append(p)
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('standard:', tris, 'trójkątów,', os.path.getsize(OUT) // 1024, 'KB')
