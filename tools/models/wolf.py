"""Wilk i kruk z Blendera: gładkie bryły (Skin + Subdivision), futro w kolorach wierzchołków, cień w zagłębieniach.

Uruchomienie (z katalogu repo):  python tools/models/wolf.py
Wynik: src/render/models/wolf.json (tułów z łbem, łapa przednia, łapa tylna, kita) i crow.json (kruk w jednej siatce).
Kotwice łap i ogona jak dawniej (src/render/creatures.ts: WOLF_HIPS, WOLF_TAIL).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, bake_ao, evaluated, hexrgb, lathe, reset, skin, sphere  # noqa: E402

reset()
from body import pack, smooth  # noqa: E402


def noise(x, y, z):
    v = math.sin(round(x * 1e4) * 0.01271 + round(y * 1e4) * 0.03117 + round(z * 1e4) * 0.00747) * 43758.5453
    return v - math.floor(v)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(p + (q - p) * t for p, q in zip(a, b))


def speck(c, x, y, z, k=0.1):
    f = 1 + (noise(x * 3.1, y * 2.7, z * 3.3) - 0.5) * 2 * k
    return tuple(min(1, ch * f) for ch in c)


def save(name, data):
    dst = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', f'{name}.json')
    with open(dst, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    print(name, {k: (sum(len(m['idx']) for m in v) * 3 // 4 // 6 if isinstance(v, list) else v) for k, v in data.items()}, os.path.getsize(dst) // 1024, 'KB')


def merged(meshes):
    out = Mesh.__new__(Mesh)
    out.pos, out.nrm, out.col, out.idx = [], [], [], []
    out.mat, out.dyn, out.show = 'fur', None, None
    for m in meshes:
        base = len(out.pos)
        out.pos += m.pos
        out.nrm += m.nrm
        out.col += m.col
        out.idx += [tuple(base + i for i in f) for f in m.idx]
    return out


# ================= WILK =================
SADDLE, SIDE, BELLY, DARK, TAN, NOSE = hexrgb(0x37342f), hexrgb(0x6a655c), hexrgb(0xa9a08e), hexrgb(0x26231f), hexrgb(0x7a6e5e), hexrgb(0x151311)
SPINE = lambda z: 0.37 + 0.03 * smooth(-0.05, 0.2, z) + 0.1 * smooth(0.2, 0.32, z)  # wysokość grzbietu wzdłuż ciała


def coat(x, y, z):
    """Ciemne siodło na grzbiecie, płowe boki, jasny brzuch i gardło"""
    h = y - SPINE(min(z, 0.25)) + 0.02
    c = mix(SIDE, SADDLE, (h + 0.01) / 0.07) if h > -0.01 else mix(SIDE, BELLY, (-h - 0.05) / 0.07)
    if z > 0.2 and y < 0.44:
        c = mix(c, BELLY, 0.6)  # jasne gardło
    return speck(c, x, y, z)


body = skin('wolf', [
    (0, 0.385, -0.245), (0, 0.375, -0.175), (0, 0.365, -0.06), (0, 0.355, 0.07), (0, 0.395, 0.17),
    (0, 0.45, 0.245), (0, 0.495, 0.3), (0, 0.48, 0.375), (0, 0.47, 0.43), (0, 0.3, 0.1),
], [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 7), (7, 8), (3, 9)],
    [(0.04, 0.045), (0.07, 0.08), (0.056, 0.064), (0.068, 0.08), (0.066, 0.075), (0.05, 0.055), (0.052, 0.046), (0.03, 0.026), (0.017, 0.014), (0.05, 0.04)], subsurf=2)
body_m = Mesh(evaluated(body), coat, 'fur')
# futro: kudły na karku i bokach, wypchnięte wzdłuż normalnej
for i, ((x, y, z), n) in enumerate(zip(body_m.pos, body_m.nrm)):
    amp = 0.012 if 0.1 < z < 0.25 and y > 0.38 else 0.006 if z < 0.27 else 0.002
    d = (noise(x, y, z) - 0.35) * amp
    body_m.pos[i] = (x + n[0] * d, y + n[1] * d, z + n[2] * d)
parts = [body_m]
for sx in (-1, 1):
    ear = lathe(f'ear{sx}', [(0.026, 0.0), (0.016, 0.035), (0.002, 0.07)], seg=5, depth=0.5, subsurf=0)
    from common import evaluated as ev  # noqa: E402
    import bmesh  # noqa: E402
    from mathutils import Matrix  # noqa: E402
    bm = ev(ear)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(sx * 0.2, 3, 'Y'))
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-0.25, 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(sx * 0.03, -0.285, 0.525))
    parts.append(Mesh(bm, lambda x, y, z: mix(SADDLE, DARK, (y - 0.53) / 0.05), 'fur'))
    cheek = sphere(f'cheek{sx}', (sx * 0.034, 0.468, 0.31), (0.024, 0.026, 0.03), seg=8, rings=6)
    parts.append(Mesh(evaluated(cheek), lambda x, y, z: speck(BELLY, x, y, z), 'fur'))
nose = sphere('nose', (0, 0.476, 0.442), (0.013, 0.011, 0.012), seg=8, rings=6)
parts.append(Mesh(evaluated(nose), NOSE, 'fur'))
jaw = skin('jaw', [(0, 0.46, 0.33), (0, 0.452, 0.415)], [(0, 1)], [(0.025, 0.02), (0.013, 0.01)], subsurf=1)
parts.append(Mesh(evaluated(jaw), BELLY, 'fur'))

leg = skin('leg', [(0, 0.03, 0), (0, -0.08, 0.008), (0, -0.17, 0.012), (0, -0.31, 0), (0, -0.338, 0.008), (0, -0.345, 0.035)],
           [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)],
           [(0.036, 0.04), (0.03, 0.033), (0.019, 0.02), (0.014, 0.014), (0.016, 0.014), (0.016, 0.01)], subsurf=1)
legcol = lambda x, y, z: speck(DARK if y < -0.33 else mix(SIDE, TAN, (-0.1 - y) / 0.15), x, y, z)
leg_m = Mesh(evaluated(leg), legcol, 'fur')
hind = skin('hind', [(0, 0.02, 0), (0, -0.07, 0.012), (0, -0.2, -0.05), (0, -0.335, -0.012), (0, -0.35, 0.02)],
            [(0, 1), (1, 2), (2, 3), (3, 4)],
            [(0.045, 0.055), (0.038, 0.045), (0.018, 0.02), (0.014, 0.014), (0.016, 0.01)], subsurf=1)
hind_m = Mesh(evaluated(hind), legcol, 'fur')
tail = lathe('tail', [(0.001, 0.0), (0.018, -0.014), (0.036, -0.05), (0.045, -0.12), (0.04, -0.2), (0.028, -0.26), (0.012, -0.3), (0.001, -0.305)], seg=10, subsurf=1)
tail_m = Mesh(evaluated(tail), lambda x, y, z: speck(DARK if y < -0.24 else mix(SIDE, SADDLE, 0.3 + 0.5 * max(0, z)), x, y, z, 0.15), 'fur')
for i, ((x, y, z), n) in enumerate(zip(tail_m.pos, tail_m.nrm)):
    d = (noise(x, y, z) - 0.35) * 0.014
    tail_m.pos[i] = (x + n[0] * d, y + n[1] * d, z + n[2] * d)

HIPS = [(-0.048, 0.35, 0.12), (0.048, 0.35, 0.12), (-0.05, 0.36, -0.19), (0.05, 0.36, -0.19)]
pose = [(m, (0, 0, 0)) for m in parts] + [(leg_m, HIPS[0]), (leg_m, HIPS[1]), (hind_m, HIPS[2]), (hind_m, HIPS[3])]
bake_ao(pose, reach=0.08, sample=[(m, (0, 0, 0)) for m in parts] + [(leg_m, HIPS[0]), (hind_m, HIPS[2])])
bake_ao([(tail_m, (0, 0, 0))], reach=0.04)
save('wolf', {'body': [pack(merged(parts))], 'leg': [pack(leg_m)], 'hindLeg': [pack(hind_m)], 'tail': [pack(tail_m)]})

# ================= KRUK =================
reset()
BLACK, SHEEN, BEAK, LEGC = hexrgb(0x111116), hexrgb(0x2a2d44), hexrgb(0x1d1d20), hexrgb(0x26262a)
plum = lambda x, y, z: speck(mix(BLACK, SHEEN, (y - 0.09) / 0.07), x, y, z, 0.05)
crow = skin('crow', [(0, 0.085, -0.075), (0, 0.095, -0.01), (0, 0.11, 0.05), (0, 0.155, 0.095), (0, 0.16, 0.12)],
            [(0, 1), (1, 2), (2, 3), (3, 4)],
            [(0.028, 0.025), (0.045, 0.042), (0.042, 0.042), (0.034, 0.034), (0.026, 0.026)], subsurf=2)
cp = [Mesh(evaluated(crow), plum, 'fur')]
beak = skin('beak', [(0, 0.155, 0.135), (0, 0.15, 0.175), (0, 0.142, 0.198)], [(0, 1), (1, 2)], [(0.013, 0.013), (0.008, 0.008), (0.002, 0.002)], subsurf=1)
cp.append(Mesh(evaluated(beak), BEAK, 'fur'))
for sx in (-1, 1):
    wing = skin(f'wing{sx}', [(sx * 0.035, 0.115, 0.04), (sx * 0.042, 0.105, -0.03), (sx * 0.03, 0.095, -0.12)], [(0, 1), (1, 2)],
                [(0.012, 0.03), (0.012, 0.032), (0.004, 0.012)], subsurf=1)
    cp.append(Mesh(evaluated(wing), lambda x, y, z: speck(mix(BLACK, SHEEN, 0.5 + (y - 0.1) * 6), x, y, z, 0.04), 'fur'))
    eye = sphere(f'ceye{sx}', (sx * 0.024, 0.165, 0.112), 0.0055, seg=6, rings=4)
    cp.append(Mesh(evaluated(eye), (0.02, 0.02, 0.02), 'fur'))
    lg = skin(f'cleg{sx}', [(sx * 0.016, 0.07, 0.0), (sx * 0.018, 0.004, 0.008), (sx * 0.018, 0.002, 0.03)], [(0, 1), (1, 2)],
              [(0.006, 0.006), (0.004, 0.004), (0.003, 0.002)], subsurf=0)
    cp.append(Mesh(evaluated(lg), LEGC, 'fur'))
tailc = skin('ctail', [(0, 0.088, -0.08), (0, 0.075, -0.17)], [(0, 1)], [(0.02, 0.006), (0.032, 0.004)], subsurf=1)
cp.append(Mesh(evaluated(tailc), plum, 'fur'))
bake_ao([(m, (0, 0, 0)) for m in cp], reach=0.03)
save('crow', {'body': [pack(merged(cp))]})
