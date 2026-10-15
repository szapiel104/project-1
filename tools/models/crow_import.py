"""Kruk z gotowego modelu CC0 („Raven”, OpenGameArt, licencja CC0 — tools/models/src/raven.blend):
siatka ze szkieletem, tekstura piór i animacja lotu. Tu wyciągamy pozę „stoi” i kilka klatek machania skrzydłami
do zwykłych siatek dla gry (instancjonowane jak reszta zwierząt), z UV pod teksturę public/textures/crow.png.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/crow_import.py
Wynik: src/render/models/crow2.json — { stand: siatka, fly: [siatki klatek lotu], len, height }
       public/textures/crow.png — tekstura (przyciemniona do kruczej czerni, nogi i dziób ciemnoszare)
Układ gry: przód (dziób) w +z, stopy na y = 0, długość od dzioba do końca ogona LEN pól.
"""
import base64
import json
import os
import struct

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src', 'raven.blend')
OUT = os.path.join(HERE, '..', '..', 'src', 'render', 'models', 'crow2.json')
TEX = os.path.join(HERE, '..', '..', 'public', 'textures', 'crow.png')
LEN = 0.24  # kruk ok. 0,6 m przy człowieku ok. 1,7 m (0,42 pola) — trochę większy, żeby było go widać z góry
FLY = [0, 4, 8, 12, 17, 21, 25, 29]  # klatki cyklu machania (akcja „fly” ma 0–34)

bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False, use_scripts=False)
arm = bpy.data.objects['raven_armature']
mesh_ob = bpy.data.objects['raven_mesh']


KEYS: dict = {}


def grab(action, frame):
    """Siatka po modyfikatorach (lustro, szkielet) w danej pozie. Wierzchołek = róg (wierzchołek siatki + UV);
    kolejność wierzchołków taka sama w każdej pozie, więc klatki lotu dzielą UV i trójkąty z pozą „stoi”."""
    arm.animation_data.action = bpy.data.actions[action]
    bpy.context.scene.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh_ob.evaluated_get(dg)
    m = ev.to_mesh()
    m.calc_loop_triangles()
    uv = m.uv_layers.active.data
    mw = mesh_ob.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    first = not KEYS
    pos, nrm = {}, {}
    idx = []
    for tri in m.loop_triangles:
        for k, li in enumerate(tri.loops):
            vi = m.loops[li].vertex_index
            key = (vi, round(uv[li].uv[0], 4), round(uv[li].uv[1], 4))
            if key not in KEYS:
                if not first:
                    continue
                KEYS[key] = len(KEYS)
            j = KEYS[key]
            p = mw @ m.vertices[vi].co
            n = (nm @ Vector(tri.split_normals[k] if tri.use_smooth else tri.normal)).normalized()
            pos[j] = (p.x, p.y, p.z)
            nrm[j] = (n.x, n.y, n.z)
            if first:
                idx.append(j)
    ev.to_mesh_clear()
    n = len(KEYS)
    uvs = [None] * n
    if first:
        for key, j in KEYS.items():
            uvs[j] = (key[1], key[2])
    return [pos[j] for j in range(n)], [nrm[j] for j in range(n)], uvs, idx


stand = grab('stand', 0)
ys = [p[1] for p in stand[0]]
zs = [p[2] for p in stand[0]]
s = LEN / (max(ys) - min(ys))
foot = min(zs)
yc = (max(ys) + min(ys)) / 2


def to_game(data):
    pos, nrm, uvs = data[0], data[1], data[2]
    # Blender: dziób w +y, góra w +z  →  gra: dziób w +z, góra w +y (obrót o 180° wokół pionu względem zwykłej zamiany osi)
    P = [(-x * s, (z - foot) * s, (y - yc) * s) for x, y, z in pos]
    N = [(-x, z, y) for x, y, z in nrm]
    return P, N, uvs


def pack(data, full=False):
    P, N, U = to_game(data)
    e = lambda b: base64.b64encode(b).decode()
    o = {
        'pos': e(b''.join(struct.pack('<3f', *p) for p in P)),
        'nrm': e(b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in N)),
    }
    if full:
        o['uv'] = e(b''.join(struct.pack('<2f', *u) for u in U))
        o['idx'] = e(b''.join(struct.pack('<H', i) for i in data[3]))
    return o


out = {'stand': pack(stand, True), 'fly': [pack(grab('fly', f)) for f in FLY], 'len': LEN, 'height': (max(zs) - foot) * s}
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))

# tekstura: oryginał jest szaroniebieski, a nogi i dziób różowawe — kruk jest czarny z granatowym połyskiem,
# nogi i dziób ma ciemnoszare; zmniejszona do 512 px (z góry i tak widać kilkanaście pikseli kruka)
img = bpy.data.images['raven']
w, h = img.size
px = list(img.pixels)
outpx = [0.0] * (w * h * 4)
for i in range(w * h):
    r, g, b, a = px[i * 4:i * 4 + 4]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    pink = (r > b + 0.08 and lum > 0.35) or lum > 0.42  # nogi, palce i dziób (jasne na oryginale)
    if pink:
        v = 0.16 + lum * 0.12
        r2, g2, b2 = v, v, v * 1.05
    else:
        k = min(1.0, lum * 1.15)
        r2, g2, b2 = 0.035 + k * 0.42, 0.04 + k * 0.45, 0.06 + k * 0.55
    outpx[i * 4:i * 4 + 4] = [r2, g2, b2, 1.0]
tex = bpy.data.images.new('crow_out', w, h)
tex.pixels = outpx
tex.scale(512, 512)
tex.filepath_raw = TEX
tex.file_format = 'PNG'
tex.save()
tri = len(stand[3]) // 3
print('crow2:', tri, 'trójkątów (stoi),', len(out['fly']), 'klatek lotu,', os.path.getsize(OUT) // 1024, 'KB; tekstura', os.path.getsize(TEX) // 1024, 'KB')
