"""Podwórko przy chacie z Blendera: balia, słupek do sznura, pranie (koszula, prześcieradło, chusta, portki),
stos polan z pniakiem i siekierą, ława, kosz z praniem, wiadro, grządka z kapustą.
Jednostka = jedno pole mapy (człowiek ma ok. 0,42 wysokości). Każdy przedmiot stoi na ziemi w (0, 0, 0), plecami
do ściany w -z (przód w +z), więc w grze obraca się go przodem od chaty.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/yard.py
Wynik: src/render/models/yard.json — dla każdego przedmiotu lista siatek z polem `mat`:
  wood (deski, tekstura słojów), cloth (płótno, tekstura juty), soil (ziemia), plain (żelazo, woda, liście — bez tekstury).
Pranie (cloth_*) wisi od y = 0 w dół, szerokość wzdłuż x; kolor tkaniny nadaje gra (tu biel z cieniem w fałdach).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, bake_ao, evaluated, lathe, reset, skin, sphere  # noqa: E402

reset()
from body import pack  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402


def noise(x, y, z):
    v = math.sin(round(x * 1e4) * 0.01271 + round(y * 1e4) * 0.03117 + round(z * 1e4) * 0.00747) * 43758.5453
    return v - math.floor(v)


def speck(c, x, y, z, k=0.1):
    f = 1 + (noise(x * 3.1, y * 2.7, z * 3.3) - 0.5) * 2 * k
    return tuple(min(1, ch * f) for ch in c)


def hexc(h):
    return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)


def xf(bm, rx=0.0, ry=0.0, rz=0.0, move=(0, 0, 0)):
    """Obrót w układzie gry (rx wokół x, ry wokół pionu, rz wokół z) i przesunięcie; bm w układzie Blendera"""
    if rz:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(rz, 3, 'Y'))
    if rx:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-rx, 3, 'X'))
    if ry:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(ry, 3, 'Z'))
    x, y, z = move
    bmesh.ops.translate(bm, verts=bm.verts, vec=(x, -z, y))
    return bm


def box(sx, sy, sz, rx=0.0, ry=0.0, rz=0.0, move=(0, 0, 0), bevel=0.0):
    """Prostopadłościan o wymiarach (x, y, z) w układzie gry, środek w move"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sz, sy), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect='EDGES')
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return xf(bm, rx, ry, rz, move)


def cyl(r1, r2, h, seg=10, rx=0.0, ry=0.0, rz=0.0, move=(0, 0, 0), cap=True):
    """Walec/stożek wzdłuż pionu gry, od y = 0 do h (przed obrotem)"""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=h)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, h / 2))
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return xf(bm, rx, ry, rz, move)


def ev(ob, rx=0.0, ry=0.0, rz=0.0, move=(0, 0, 0)):
    return xf(evaluated(ob), rx, ry, rz, move)


def merged(meshes, mat):
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


out = {}


def finish(name, parts, reach=0.05):
    """parts: lista Mesh z polem mat; cień w zagłębieniach z całego przedmiotu, potem siatki łączone po materiale"""
    for m in parts:  # wieloboki na trójkąty (wachlarz)
        m.idx = [t for f in m.idx for t in ([f] if len(f) == 3 else [(f[0], f[k], f[k + 1]) for k in range(1, len(f) - 1)])]
    bake_ao([(m, (0, 0, 0)) for m in parts], reach=reach)
    groups = {}
    for m in parts:
        groups.setdefault(m.mat, []).append(m)
    out[name] = [pack(merged(v, k)) for k, v in groups.items()]


WOOD = hexc(0x8a6a46)
WOOD_D = hexc(0x6a4a2c)
WOOD_L = hexc(0xb89a70)
IRON = hexc(0x3a3836)
BARK = hexc(0x4a3222)

wood = lambda c=WOOD, k=0.12: (lambda x, y, z: speck(c, x, y, z, k))

# ================= BALIA =================
# klepki dookoła (każda trochę innej barwy, lekko wybrzuszone), dwie żelazne obręcze, dno, woda z mydlinami,
# tara oparta o brzeg
parts = []
R, H, N = 0.12, 0.09, 16
for k in range(N):
    a = k / N * math.tau
    c = [WOOD, WOOD_D, hexc(0x7a5a3a), hexc(0x94724c)][k % 4]
    st = box(0.048, H, 0.012, move=(0, H / 2, 0))
    # klepka węższa u dołu: balia rozszerza się ku górze
    for v in st.verts:
        y = v.co.z
        v.co.x *= 0.85 + 0.15 * (y / H)
    xf(st, ry=a, move=(math.sin(a) * (R - 0.012 + 0.0), 0, math.cos(a) * (R - 0.012)))
    for v in st.verts:  # rozchylenie ku górze
        y = v.co.z
        d = Vector((v.co.x, v.co.y, 0))
        if d.length > 1e-6:
            d.normalize()
            v.co.x += d.x * 0.018 * (y / H)
            v.co.y += d.y * 0.018 * (y / H)
    parts.append(Mesh(st, wood(c), 'wood'))
parts.append(Mesh(cyl(R - 0.008, R - 0.008, 0.012, seg=16), wood(WOOD_D), 'wood'))
for hy, hr in ((0.02, R + 0.003), (0.07, R + 0.012)):
    t = bmesh.new()
    bmesh.ops.create_cone(t, cap_ends=False, segments=20, radius1=hr, radius2=hr + 0.002, depth=0.008)
    bmesh.ops.triangulate(t, faces=t.faces)
    parts.append(Mesh(xf(t, move=(0, hy, 0)), lambda x, y, z: speck(IRON, x, y, z), 'plain'))
water = cyl(R + 0.004, R + 0.004, 0.003, seg=20, move=(0, 0.072, 0))
parts.append(Mesh(water, lambda x, y, z: speck(hexc(0x7a9aa4), x, y, z, 0.05), 'plain'))
for i in range(9):
    a, r = i * 2.4, 0.03 + (i % 3) * 0.025
    s = sphere(f'suds{i}', (math.sin(a) * r, 0.075, math.cos(a) * r), (0.014 + (i % 2) * 0.006, 0.006, 0.014), seg=8, rings=5)
    parts.append(Mesh(evaluated(s), (0.93, 0.93, 0.9), 'plain'))
# mokra koszula przewieszona przez brzeg
lip = skin('lip', [(-0.04, 0.074, R - 0.03), (0, 0.09, R + 0.005), (0.035, 0.05, R + 0.03)], [(0, 1), (1, 2)],
           [(0.02, 0.006), (0.024, 0.006), (0.02, 0.006)], subsurf=1)
parts.append(Mesh(evaluated(lip), (0.86, 0.84, 0.78), 'cloth'))
# tara: deska z poprzecznymi żeberkami, oparta skośnie
board = [box(0.07, 0.17, 0.008, move=(0, 0.085, 0))]
for j in range(7):
    board.append(box(0.06, 0.006, 0.006, move=(0, 0.04 + j * 0.016, 0.006)))
for b in board:
    # tara oparta z zewnątrz o tylną klepkę (pochylona ku balii), nie wbita w środek
    xf(b, rx=0.35, ry=0.5, move=(-0.04, 0.0, -R - 0.05))
    parts.append(Mesh(b, wood(WOOD_L), 'wood'))
finish('tub', parts)

# ================= SŁUPEK DO SZNURA =================
# krzywy kij z widełkami na górze, wbity w ziemię z kopczykiem
pole = skin('pole', [(0, -0.02, 0), (0.008, 0.2, 0.004), (-0.004, 0.42, 0), (-0.02, 0.5, 0), (0.02, 0.5, 0.004)],
            [(0, 1), (1, 2), (2, 3), (2, 4)], [(0.016, 0.016), (0.014, 0.014), (0.012, 0.012), (0.007, 0.007), (0.007, 0.007)], subsurf=1)
parts = [Mesh(evaluated(pole), wood(BARK, 0.18), 'wood')]
mound = sphere('mound', (0, 0, 0), (0.04, 0.012, 0.04), seg=10, rings=6)
parts.append(Mesh(evaluated(mound), lambda x, y, z: speck(hexc(0x5a4632), x, y, z, 0.2), 'soil'))
finish('post', parts)
out['post_top'] = 0.46


# ================= PRANIE =================
def cloth(name, w, h, mask=None, folds=4, sag=0.0):
    """Płachta z siatki: wisi od y = 0 w dół, fałdy pionowe (od klamerek), dół lekko faluje; mask(u, v) wycina kształt"""
    nx, ny = 14, 12
    bm = bmesh.new()
    vs = {}
    for j in range(ny + 1):
        for i in range(nx + 1):
            u, v = i / nx, j / ny
            if mask and not mask(u, v):
                continue
            x = (u - 0.5) * w
            y = -v * h - sag * math.sin(u * math.pi)
            z = math.sin(u * math.pi * folds) * 0.008 * (0.3 + v) + (noise(u * 5, v * 5, 1) - 0.5) * 0.006 * v
            vs[(i, j)] = bm.verts.new((x, -z, y))
    for j in range(ny):
        for i in range(nx):
            q = [vs.get((i, j)), vs.get((i + 1, j)), vs.get((i + 1, j + 1)), vs.get((i, j + 1))]
            if all(q):
                bm.faces.new(q)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    # obie strony płachty: druga warstwa z odwróconymi ścianami, minimalnie z tyłu
    back = bm.copy()
    bmesh.ops.reverse_faces(back, faces=back.faces)
    bmesh.ops.translate(back, verts=back.verts, vec=(0, 0.0015, 0))
    shade = lambda x, y, z: speck((0.97, 0.96, 0.92), x, y, z, 0.05)
    parts = [Mesh(bm, shade, 'cloth'), Mesh(back, shade, 'cloth')]
    finish(name, parts, reach=0.03)


def shirt(u, v):
    # koszula: rękawy na górze (cała szerokość do 35% wysokości), niżej sam korpus
    return v < 0.35 or 0.22 <= u <= 0.78


def pants(u, v):
    # portki: pas na górze, niżej dwie nogawki z przerwą
    return v < 0.35 or u <= 0.44 or u >= 0.56


cloth('cloth_shirt', 0.2, 0.17, shirt, folds=3)
cloth('cloth_sheet', 0.28, 0.2, None, folds=5, sag=0.006)
cloth('cloth_small', 0.11, 0.1, None, folds=2)
cloth('cloth_pants', 0.13, 0.2, pants, folds=2)

# ================= STOS POLAN, PNIAK I SIEKIERA =================
parts = []
for row in range(3):
    n = 6 - row
    for i in range(n):
        x = (i - (n - 1) / 2) * 0.062
        y = 0.028 + row * 0.05
        rot = noise(i, row, 3) * math.tau
        # połówka pnia: klin z korą na zewnątrz i jasnym drewnem w przekroju
        lg = cyl(0.03, 0.03, 0.16, seg=7, rx=math.pi / 2, move=(0, 0, -0.08))
        xf(lg, rz=rot)
        xf(lg, move=(x, y, 0))
        cx, cy = x, y

        def logc(px, py, pz, cx=cx, cy=cy):
            r = math.hypot(px - cx, py - cy)
            c = BARK if r > 0.024 else WOOD_L
            if abs(pz) > 0.078:
                c = (hexc(0xd8b880) if (r * 260) % 2 < 1.4 else hexc(0xb08a58)) if r < 0.026 else BARK  # słoje na czole
            return speck(c, px, py, pz, 0.12)
        parts.append(Mesh(lg, logc, 'wood'))
# dwa paliki trzymające stos z boków
for sx in (-0.2, 0.2):
    parts.append(Mesh(cyl(0.008, 0.007, 0.17, seg=6, move=(sx, 0, 0.05)), wood(BARK), 'wood'))
    parts.append(Mesh(cyl(0.008, 0.007, 0.17, seg=6, move=(sx, 0, -0.05)), wood(BARK), 'wood'))
# pniak z siekierą wbitą w górę, obok
stump = cyl(0.05, 0.045, 0.07, seg=12, move=(0.3, 0, 0.06))
parts.append(Mesh(stump, lambda x, y, z: speck(hexc(0xc0a070) if y > 0.068 else BARK, x, y, z, 0.12), 'wood'))
handle = cyl(0.006, 0.006, 0.14, seg=6, rz=0.9, move=(0.31, 0.07, 0.06))
parts.append(Mesh(handle, wood(WOOD_L), 'wood'))
head = box(0.035, 0.03, 0.01, rz=0.9, move=(0.305, 0.075, 0.06))
parts.append(Mesh(head, lambda x, y, z: speck(IRON, x, y, z), 'plain'))
for i in range(5):
    ch = box(0.025, 0.006, 0.012, ry=i * 1.3, move=(0.25 + (i % 3) * 0.04, 0.003, 0.12 - (i % 2) * 0.05))
    parts.append(Mesh(ch, wood(hexc(0xc8a878)), 'wood'))
finish('woodpile', parts)

# ================= ŁAWA =================
parts = []
for k, dz in enumerate((-0.022, 0.022)):
    parts.append(Mesh(box(0.42, 0.014, 0.042, move=(0, 0.11, dz), bevel=0.003), wood([WOOD, WOOD_D][k]), 'wood'))
for sx in (-0.16, 0.16):
    for dz in (-0.025, 0.025):
        parts.append(Mesh(box(0.016, 0.11, 0.016, rx=dz * 3, move=(sx, 0.054, dz * 1.3)), wood(WOOD_D), 'wood'))
    parts.append(Mesh(box(0.014, 0.014, 0.08, move=(sx, 0.04, 0)), wood(WOOD_D), 'wood'))
# dzbanek i miska na ławie
jug = lathe('jug', [(0.0, 0.0), (0.018, 0.0), (0.024, 0.02), (0.016, 0.045), (0.012, 0.055), (0.015, 0.06), (0.0, 0.058)], seg=12)
parts.append(Mesh(ev(jug, move=(-0.12, 0.117, 0)), lambda x, y, z: speck(hexc(0x9a5a38), x, y, z, 0.06), 'plain'))
bowl = lathe('bowl', [(0.0, 0.0), (0.02, 0.0), (0.032, 0.018), (0.028, 0.02), (0.0, 0.006)], seg=12)
parts.append(Mesh(ev(bowl, move=(0.1, 0.117, 0.005)), wood(WOOD_L), 'wood'))
finish('bench', parts)

# ================= KOSZ Z PRANIEM =================
parts = []
basket = lathe('basket', [(0.0, 0.0), (0.075, 0.0), (0.09, 0.05), (0.095, 0.07), (0.088, 0.072), (0.08, 0.05), (0.0, 0.008)], seg=16, depth=0.7)
bm = evaluated(basket)
parts.append(Mesh(bm, lambda x, y, z: speck(hexc(0xa88850) if (int(y * 160) + int(math.atan2(x, z) * 8)) % 2 else hexc(0x8a6a3a), x, y, z, 0.1), 'wood'))
for i in range(6):
    a = i * 1.1
    s = sphere(f'heap{i}', (math.sin(a) * 0.035, 0.07, math.cos(a) * 0.02), (0.04, 0.022, 0.03), seg=10, rings=6)
    col = [(0.92, 0.9, 0.84), (0.7, 0.72, 0.76), (0.8, 0.66, 0.56)][i % 3]
    parts.append(Mesh(evaluated(s), lambda x, y, z, c=col: speck(c, x, y, z, 0.06), 'cloth'))
finish('basket', parts)

# ================= WIADRO =================
parts = []
bucket = lathe('bucket', [(0.0, 0.0), (0.04, 0.0), (0.048, 0.075), (0.044, 0.075), (0.036, 0.008), (0.0, 0.008)], seg=14, subsurf=0)
parts.append(Mesh(evaluated(bucket), lambda x, y, z: speck([WOOD, WOOD_D][int((math.atan2(x, z) + 4) * 2.3) % 2], x, y, z), 'wood'))
for hy in (0.015, 0.06):
    t = bmesh.new()
    bmesh.ops.create_cone(t, cap_ends=False, segments=14, radius1=0.042 + hy * 0.1, radius2=0.043 + hy * 0.1, depth=0.006)
    parts.append(Mesh(xf(t, move=(0, hy, 0)), (0.22, 0.21, 0.2), 'plain'))
parts.append(Mesh(cyl(0.043, 0.043, 0.002, seg=14, move=(0, 0.06, 0)), (0.42, 0.52, 0.56), 'plain'))
arc = skin('arc', [(-0.046, 0.07, 0), (-0.03, 0.115, 0), (0.03, 0.115, 0), (0.046, 0.07, 0)], [(0, 1), (1, 2), (2, 3)], [(0.003, 0.003)] * 4, subsurf=1)
parts.append(Mesh(evaluated(arc), IRON, 'plain'))
finish('bucket', parts)

# ================= GRZĄDKA =================
# zagon ziemi w plecionym płotku, dwa rzędy kapusty i rząd cebuli
parts = []
bed = box(0.5, 0.03, 0.28, move=(0, 0.012, 0), bevel=0.01)
for v in bed.verts:  # nierówna, skopana ziemia
    if v.co.z > 0.02:
        v.co.z += (noise(v.co.x * 9, v.co.y * 9, 2) - 0.5) * 0.01
parts.append(Mesh(bed, lambda x, y, z: speck(hexc(0x4a3626), x, y, z, 0.25), 'soil'))
for i in range(13):
    t = i / 12
    for side in (-1, 1):
        px, pz = (t - 0.5) * 0.54, side * 0.15
        parts.append(Mesh(cyl(0.005, 0.004, 0.07, seg=5, move=(px, 0, pz)), wood(BARK), 'wood'))
    for zz in (-0.15, 0.15):
        pass
for side in (-1, 1):
    for yy in (0.025, 0.05):
        w = skin(f'wattle{side}{yy}', [(-0.27, yy, side * 0.15), (0, yy + 0.004, side * 0.153), (0.27, yy, side * 0.15)], [(0, 1), (1, 2)], [(0.005, 0.005)] * 3, subsurf=0)
        parts.append(Mesh(evaluated(w), wood(hexc(0x6a5034)), 'wood'))
for i in range(4):
    for row in (-0.07, 0.0):
        x = -0.18 + i * 0.12 + (0.06 if row else 0)
        cab = sphere(f'cab{i}{row}', (x, 0.045, row), (0.032, 0.026, 0.032), seg=10, rings=7,
                     shape=lambda a, b, c: (a * (1 + 0.08 * math.sin(c * 9)), b, c * (1 + 0.08 * math.sin(a * 9))))
        parts.append(Mesh(evaluated(cab), lambda x, y, z: speck(hexc(0x7a9a4a) if y > 0.05 else hexc(0x4f6e30), x, y, z, 0.12), 'plain'))
for i in range(8):
    x = -0.21 + i * 0.06
    sp = cyl(0.003, 0.0, 0.06, seg=4, rz=(noise(i, 1, 1) - 0.5) * 0.4, move=(x, 0.03, 0.08))
    parts.append(Mesh(sp, hexc(0x5a8a3a), 'plain'))
finish('garden', parts)


def save():
    dst = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', 'yard.json')
    with open(dst, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    tri = {k: sum(len(m['idx']) for m in v) * 3 // 4 // 6 for k, v in out.items() if isinstance(v, list)}
    print('yard', tri, os.path.getsize(dst) // 1024, 'KB')


save()
