"""Las z gotowych drzew Poly Haven (CC0, modele zrobione przez grafików) — Blender robi z nich wersję do gry.

Paczki glTF 1K z Poly Haven rozpakowane do jednego katalogu (podkatalog na drzewo, nazwa = id z Poly Haven):

    /tmp/bpyenv/bin/python tools/models/forest_polyhaven.py /ścieżka/do/paczek [id ...]

Bez listy id przerabia wszystkie drzewa z SPECIES, które leżą w katalogu (pozostałe odmiany w forest.json zostają).

Jak: oryginały mają od 0,4 do kilku mln trójkątów (każda igła i każdy liść to siatka), więc:
  - pień (gruba kora) zostaje bryłą, odchudzoną Decimate do kilkuset trójkątów;
  - koronę (gałązki, igły, liście) Blender fotografuje warstwami: kilka pionowych plastrów z trzech stron
    i kilka poziomych plastrów od góry (kamera ortograficzna z obcięciem bliży i dali do grubości plastra).
    Każdy plaster to jedna karta w miejscu, z którego pochodzi, więc korona ma głębię i wygląda dobrze także
    z góry (kamera strategii). Kilkadziesiąt trójkątów zamiast milionów, a rysunek igieł i liści jest prawdziwy;
  - z daleka: 8 zdjęć całego drzewa dookoła (obrazek zwracany do kamery, jak dotychczasowe impostory w grze).
Zdjęcia są robione w miękkim świetle dnia pochmurnego (cień we wnętrzu korony jest w obrazku), kolor + maska.

Wynik:
  src/render/models/forest.json — odmiany: trunk (bryła), cards (karty korony), far (wymiary obrazka z daleka)
  public/textures/cc0/pv_<odmiana>_{cards,far}.jpg (+ _a.jpg maska) — zdjęcia korony i z daleka
  public/textures/cc0/pv_<odmiana>_bark{,_n}.jpg — kora z paczki, 512 px
Układ jak w grze: y w górę, podstawa pnia w (0, 0, 0), wysokość ROLE[..]['height'] w polach.
"""
import base64
import json
import math
import os
import struct
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(ROOT, 'src', 'render', 'models', 'forest.json')
TEX = os.path.join(ROOT, 'public', 'textures', 'cc0')
TMP = '/tmp/forest_bake'

# rola → wysokość modelu w polach, budżet trójkątów pnia
ROLE = {
    'conifer': {'height': 4.6, 'radius': 1.25, 'trunk': 220},
    'leaf': {'height': 3.6, 'radius': 1.6, 'trunk': 420},
    'sapling': {'height': 2.2, 'radius': 0.8, 'trunk': 160},
}
# id paczki → rola i materiał kory (pień jako bryła); wszystko inne idzie na karty korony
SPECIES = {
    'fir_tree_01': {'role': 'conifer'},
    # 'pine_tree_01' (17 mln trójkątów) nie mieści się w pamięci przy 7 GB nawet po jednej odmianie
    'island_tree_01': {'role': 'leaf'},
    'island_tree_02': {'role': 'leaf'},
    'fir_sapling_medium': {'role': 'sapling'},
}
# plastry: pionowe (kąty w stopniach × liczba plastrów w głąb) i poziome
V_ANGLES, V_SLABS, H_SLABS = (0, 60, 120), 3, 4
TILE = 256  # wysokość zdjęcia pionowego plastra w pikselach
FAR_H = 160  # wysokość klatki obrazka z daleka

args = [a for a in sys.argv[1:] if not a.startswith('-')]
SRC, ONLY = args[0], args[1:]


# ------------------------------------------------------------------ pakowanie siatek (jak trees.py)
def pack(pos, nrm, uv, idx, col):
    e = lambda b: base64.b64encode(b).decode()
    assert len(pos) < 65536, len(pos)
    return {
        'pos': e(b''.join(struct.pack('<3f', *p) for p in pos)),
        'nrm': e(b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in nrm)),
        'col': e(b''.join(struct.pack('<3B', *[max(0, min(255, round(c * 255))) for c in cc]) for cc in col)),
        'uv': e(b''.join(struct.pack('<2f', *u) for u in uv)),
        'idx': e(b''.join(struct.pack('<3H', *f) for f in idx)),
    }


def norm(v):
    l = math.sqrt(sum(c * c for c in v)) or 1
    return tuple(c / l for c in v)


# ------------------------------------------------------------------ scena do zdjęć
def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 24
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 4
    sc.render.film_transparent = True
    sc.render.use_persistent_data = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('sky')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.78, 0.82, 0.86, 1)
    bg.inputs[1].default_value = 1.1
    sc.world = w
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 2.2
    sun.angle = 0.5
    so = bpy.data.objects.new('sun', sun)
    so.rotation_euler = (0.55, 0.15, 0.9)
    sc.collection.objects.link(so)
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    sc.camera = co
    return co


def shoot(co, loc, look, up, scale, rx, ry, clip0, clip1, path):
    sc = bpy.context.scene
    co.location = loc
    co.rotation_euler = Vector(look).to_track_quat('-Z', 'Y' if up == 'z' else 'Y').to_euler()
    if up == 'y':  # z góry: obraz w prawo = +x, w górę = +y
        co.rotation_euler = (0, 0, 0)
    co.data.ortho_scale = scale
    co.data.clip_start, co.data.clip_end = max(0.001, clip0), clip1
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    a = np.array(img.pixels[:], dtype=np.float32).reshape(ry, rx, 4)  # wiersz 0 = dół obrazka
    bpy.data.images.remove(img)
    return a


def save_rgba(arr, name):
    """Kolor (z rozlanym kolorem w przezroczystych miejscach, żeby mipmapy nie ciemniały na brzegach) i maska."""
    h, w, _ = arr.shape
    a = arr[:, :, 3:4]
    solid = a > 0.35  # kolor bierzemy tylko z pełnych pikseli (brzegi z małą maską mają kolor tła)
    rgb = np.where(solid, arr[:, :, :3], 0)
    # rozlewanie koloru w puste miejsca (kilka przejść rozmycia tylko po pustych)
    filled, wsum = rgb, solid.astype(np.float32)
    for _ in range(12):
        k = lambda x: (np.roll(x, 1, 0) + np.roll(x, -1, 0) + np.roll(x, 1, 1) + np.roll(x, -1, 1) + x)
        fs, ws = k(filled), k(wsum)
        grow = (wsum == 0) & (ws > 0)
        filled = np.where(grow, fs / np.maximum(ws, 1e-4), filled)
        wsum = np.where(grow, 1.0, wsum)
    avg = rgb.reshape(-1, 3).sum(0) / max(1, solid.sum())
    filled = np.where(wsum > 0, filled, avg)
    for data, suffix, ch in ((filled, '', 3), (np.repeat(a, 3, 2), '_a', 3)):
        img = bpy.data.images.new(name + suffix, w, h, alpha=False)
        px = np.concatenate([np.clip(data, 0, 1), np.ones((h, w, 1), np.float32)], 2)
        img.pixels[:] = px.ravel()
        img.filepath_raw = os.path.join(TEX, name + suffix + '.jpg')
        img.file_format = 'JPEG'
        bpy.context.scene.render.image_settings.quality = 90
        img.save()
        bpy.data.images.remove(img)
    return avg


def save_tex(src, dst, size=512):
    img = bpy.data.images.load(src)
    img.scale(size, size)
    img.file_format = 'JPEG'
    img.filepath_raw = os.path.join(TEX, dst + '.jpg')
    bpy.context.scene.render.image_settings.quality = 88
    img.save()
    bpy.data.images.remove(img)


def decimate(o, target):
    n = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if n <= target:
        return
    bpy.context.view_layer.objects.active = o
    m = o.modifiers.new('dec', 'DECIMATE')
    m.ratio = target / n
    m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=m.name)


def trunk_mesh(parts, mat_name):
    bm = bmesh.new()
    for o in parts:
        want = {i for i, m in enumerate(o.data.materials) if m and m.name == mat_name}
        if not want:
            continue
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        tmp.transform(o.matrix_world)
        bmesh.ops.delete(tmp, geom=[f for f in tmp.faces if f.material_index not in want], context='FACES')
        me = bpy.data.meshes.new('t')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new('trunk')
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new('trunk', me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def tri_geo(o, xf):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    uvl = bm.loops.layers.uv.active
    pos, nrm, uv, idx, seen = [], [], [], [], {}
    for f in bm.faces:
        tri = []
        for lp in f.loops:
            v = lp.vert
            u = tuple(round(c, 4) for c in lp[uvl].uv) if uvl else (0.0, 0.0)
            key = (v.index, u)
            if key not in seen:
                seen[key] = len(pos)
                pos.append(xf(v.co))
                n = v.normal
                nrm.append((n.x, n.z, -n.y))
                uv.append(u)  # jak w Blenderze: tekstury gry (KTX2) mają odwróconą oś Y
            tri.append(seen[key])
        idx.append(tri)
    bm.free()
    return pos, nrm, uv, idx


def verts_np(o, skip=None):
    """Wierzchołki obiektu w układzie świata (numpy); skip — pomija wierzchołki ścian z tym materiałem"""
    me = o.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    if skip is not None:
        mi = np.empty(len(me.polygons), np.int32)
        me.polygons.foreach_get('material_index', mi)
        keep_mats = np.array([m != skip for m in me.materials] or [True])
        first = np.empty(len(me.polygons), np.int32)
        me.polygons.foreach_get('loop_start', first)
        lv = np.empty(len(me.loops), np.int32)
        me.loops.foreach_get('vertex_index', lv)
        co = co[np.unique(lv[first[keep_mats[mi]]])]
    M = np.array(o.matrix_world, np.float32)
    return co @ M[:3, :3].T + M[:3, 3]


def bark_of(mats):
    """Materiał pnia: bez przyrostka liści/igieł/gałązek; w młodych iglakach pień to „branches”."""
    plain = [m for m in mats if not any(k in m.lower() for k in ('leaves', 'leaf', 'twig', 'needle', 'branches', 'dead'))]
    if plain:
        return plain[0]
    return [m for m in mats if 'branches' in m.lower() and 'dead' not in m.lower()][0]


# ------------------------------------------------------------------ przebieg
out = json.load(open(OUT)) if os.path.exists(OUT) else {}
os.makedirs(TEX, exist_ok=True)
os.makedirs(TMP, exist_ok=True)
for sid, spec in SPECIES.items():
    d = os.path.join(SRC, sid)
    gl = os.path.join(d, f'{sid}_1k.gltf')
    if (ONLY and sid not in ONLY) or not os.path.exists(gl):
        continue
    role = ROLE[spec['role']]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=gl)
    mats = [m.name for m in bpy.data.materials]
    print(sid, '| materiały:', mats)
    tops = sorted([o for o in bpy.data.objects if o.parent is None and o.type in ('MESH', 'EMPTY')
                   and not ('LOD' in o.name and not o.name.endswith('LOD0'))], key=lambda o: o.name)
    # VARIANT=a|b|c: tylko jedna odmiana na przebieg (duże paczki, np. sosna 17 mln trójkątów, nie mieszczą się
    # w pamięci razem z Cycles) — pozostałe usuwamy zaraz po wczytaniu
    one = os.environ.get('VARIANT')
    if one:
        for vi, top in enumerate(list(tops)):
            if chr(97 + vi) != one:
                for o in [top, *top.children_recursive]:
                    me = o.data if o.type == 'MESH' else None
                    bpy.data.objects.remove(o, do_unlink=True)
                    if me is not None and me.users == 0:
                        bpy.data.meshes.remove(me)
        bpy.ops.outliner.orphans_purge(do_recursive=True) if hasattr(bpy.ops.outliner, 'orphans_purge') else None
    co = setup_scene()
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.hide_render = True
    for k in [k for k in out if out[k].get('species') == sid and (not one or k.endswith('_' + one))]:
        del out[k]
    for vi, top in enumerate(tops):
        if one and chr(97 + vi) != one:
            continue
        parts = [o for o in [top, *top.children_recursive] if o.type == 'MESH']
        if not parts:
            continue
        name = f'{sid}_{chr(97 + vi)}'
        # dorosłe iglaki z Poly Haven mają pień każdej odmiany w osobnym materiale (trunk_a, trunk_b…)
        bark = spec.get('bark') or (f'{sid}_trunk_{chr(97 + vi)}' if f'{sid}_trunk_{chr(97 + vi)}' in mats else bark_of(mats))
        for o in parts:
            o.hide_render = False
        # granice: podstawa pnia, wysokość, promień korony
        world = np.concatenate([verts_np(o) for o in parts])
        z0, z1 = float(world[:, 2].min()), float(world[:, 2].max())
        low = world[world[:, 2] < z0 + (z1 - z0) * 0.02]
        cx, cy = float(low[:, 0].mean()), float(low[:, 1].mean())
        R = float(np.hypot(world[:, 0] - cx, world[:, 1] - cy).max()) * 1.02
        del world, low
        k = role['height'] / (z1 - z0)
        # szerokie korony ściśnięte w poziomie do promienia roli (jedno drzewo na pole lasu)
        kx = min(k, role['radius'] / R)
        xf = lambda c: ((c.x - cx) * kx, (c.z - z0) * k, -(c.y - cy) * kx)
        H = z1 - z0
        print(' ', name, f'wys. {H:.1f} m, promień {R:.1f} m, skala {k:.3f} / w poziomie {kx:.3f}, kora {bark}')

        # --- karty korony: pień chowamy, bo jest bryłą
        bark_mat = bpy.data.materials.get(bark)
        trunk_hidden = []
        for o in parts:
            for i, m in enumerate(o.data.materials):
                if m == bark_mat:
                    trunk_hidden.append((o, i))
        hole = bpy.data.materials.new('hole')
        hole.use_nodes = True
        nt = hole.node_tree
        nt.nodes.clear()
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mo = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(tr.outputs[0], mo.inputs[0])
        for o, i in trunk_hidden:
            o.data.materials[i] = hole
        crown_np = np.concatenate([verts_np(o, skip=hole) for o in parts])
        cz0 = float(crown_np[:, 2].min()) if len(crown_np) else z0
        crown = [Vector(c) for c in crown_np[:: max(1, len(crown_np) // 20000)]]
        del crown_np
        ch = z1 - cz0
        zm = (cz0 + z1) / 2
        tw = max(4, round(TILE * 2 * R / ch / 4) * 4) if ch >= 2 * R else TILE
        th = TILE if ch >= 2 * R else max(4, round(TILE * ch / (2 * R) / 4) * 4)
        sc_v = max(2 * R, ch)
        tiles, quads = [], []
        D = R + 3
        for ang in V_ANGLES:
            a = math.radians(ang)
            dv = Vector((math.cos(a), math.sin(a), 0))
            rv = Vector((dv.y, -dv.x, 0))
            C = Vector((cx, cy, zm))
            for s in range(V_SLABS):
                t0, t1 = -R + s * 2 * R / V_SLABS, -R + (s + 1) * 2 * R / V_SLABS
                img = shoot(co, C - dv * D, dv, 'z', sc_v, tw, th, D + t0, D + t1, f'{TMP}/v.png')
                if img[:, :, 3].max() < 0.05:
                    continue
                M = C + dv * ((t0 + t1) / 2)
                hw, hh = sc_v / 2 * tw / max(tw, th), sc_v / 2 * th / max(tw, th)
                quads.append(([M - rv * hw - Vector((0, 0, hh)), M + rv * hw - Vector((0, 0, hh)), M + rv * hw + Vector((0, 0, hh)), M - rv * hw + Vector((0, 0, hh))], dv, len(tiles)))
                tiles.append(img)
        hs = max(4, round(TILE * 0.75 / 4) * 4)
        for s in range(H_SLABS):
            za, zb = cz0 + s * ch / H_SLABS, cz0 + (s + 1) * ch / H_SLABS
            top_z = z1 + 3
            img = shoot(co, Vector((cx, cy, top_z)), Vector((0, 0, -1)), 'y', 2 * R, hs, hs, top_z - zb, top_z - za, f'{TMP}/h.png')
            if img[:, :, 3].max() < 0.05:
                continue
            zc = (za + zb) / 2
            quads.append(([Vector((cx - R, cy - R, zc)), Vector((cx + R, cy - R, zc)), Vector((cx + R, cy + R, zc)), Vector((cx - R, cy + R, zc))], Vector((0, 0, -1)), len(tiles)))
            tiles.append(img)
        # atlas: pionowe w pierwszym rzędzie, poziome w drugim
        nv = sum(1 for t in tiles if t.shape[:2] == (th, tw))
        rowv = [t for t in tiles if t.shape[:2] == (th, tw)]
        rowh = [t for t in tiles if t.shape[:2] != (th, tw)]
        AW = max(len(rowv) * tw, len(rowh) * hs)
        AW = (AW + 3) // 4 * 4
        AH = th + (hs if rowh else 0)
        atlas = np.zeros((AH, AW, 4), np.float32)
        rects = []
        iv = ih = 0
        for t in tiles:
            if t.shape[:2] == (th, tw):
                x0, y0 = iv * tw, hs if rowh else 0  # pionowe na górze (wiersz 0 = dół)
                iv += 1
            else:
                x0, y0 = ih * hs, 0
                ih += 1
            h_, w_ = t.shape[:2]
            atlas[y0:y0 + h_, x0:x0 + w_] = t
            rects.append((x0 / AW, y0 / AH, (x0 + w_) / AW, (y0 + h_) / AH))
        save_rgba(atlas, f'pv_{name}_cards')
        # karty: każda dwa razy (przód i tył z odwróconą kolejnością), normalne od osi pnia w górę — światło gry
        # oświetla koronę jak bryłę, a nie jak płaskie deski
        pos, nrm, uv, idx = [], [], [], []
        for corners, view, ti in quads:
            u0, v0, u1, v1 = rects[ti]
            uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
            for back in (False, True):
                base = len(pos)
                for c, u in zip(corners, uvs):
                    p = xf(c)
                    out_v = norm((p[0], 0.0, p[2])) if math.hypot(p[0], p[2]) > 1e-3 else (0, 0, 0)
                    nrm.append(norm((out_v[0] * 0.75, 0.65, out_v[2] * 0.75)))
                    pos.append(p)
                    uv.append(u)
                f = [(base, base + 1, base + 2), (base, base + 2, base + 3)]
                idx += [(a, c, b) for a, b, c in f] if back else f
        cards = pack(pos, nrm, uv, idx, [(1, 1, 1)] * len(pos))
        # zamknięta bryła cienia: ośmiokąt w obrysie korony
        cr = [xf(c) for c in crown] or pos
        y0c, y1c = min(p[1] for p in cr), max(p[1] for p in cr)
        Rg = max(math.hypot(p[0], p[2]) for p in cr) * 0.75
        yb = y0c + (y1c - y0c) * (0.3 if spec['role'] != 'leaf' else 0.5)
        sp, si = [(0, y1c, 0), (0, y0c, 0)], []
        for i in range(8):
            a = i / 8 * math.tau
            sp.append((math.cos(a) * Rg, yb, math.sin(a) * Rg))
        for i in range(8):
            a, b = 2 + i, 2 + (i + 1) % 8
            si += [(0, b, a), (1, a, b)]
        shadow = pack(sp, [(0, 1, 0)] * len(sp), [(0, 0)] * len(sp), si, [(1, 1, 1)] * len(sp))
        for o, i in trunk_hidden:
            o.data.materials[i] = bark_mat

        # --- z daleka: 8 klatek całego drzewa (jak treeImpostor w grze: kamera na (sin a, cos a) w x/z gry)
        W, Hf = 2 * R * 1.04, H * 1.03
        fw = max(8, round(FAR_H * W / Hf / 4) * 4)
        strip = np.zeros((FAR_H, fw * 8, 4), np.float32)
        for f in range(8):
            a = f / 8 * math.tau
            dv = Vector((-math.sin(a), math.cos(a), 0))  # kierunek patrzenia kamery (w Blenderze)
            C = Vector((cx, cy, z0 + Hf / 2))
            img = shoot(co, C - dv * D, dv, 'z', max(W, Hf), fw, FAR_H, 0.01, 2 * D, f'{TMP}/f.png')
            strip[:, f * fw:(f + 1) * fw] = img
        avg = save_rgba(strip, f'pv_{name}_far')

        # --- pień
        tr_ob = trunk_mesh(parts, bark)
        decimate(tr_ob, role['trunk'])
        tp, tn, tu, ti = tri_geo(tr_ob, xf)
        hh = role['height']
        tcol = [(0.6 + 0.4 * min(1, p[1] / hh * 1.8),) * 3 for p in tp]
        bpy.data.objects.remove(tr_ob, do_unlink=True)
        tdir = os.path.join(d, 'textures')
        files = os.listdir(tdir)
        # odmiany mogą dzielić teksturę kory (np. trunk_c korzysta z trunk_b): wtedy bierzemy pierwszą pasującą
        pick = lambda kind: next((os.path.join(tdir, f) for f in sorted(files) if f.startswith(bark + '_' + kind)),
                                 next((os.path.join(tdir, f) for f in sorted(files) if bark.rsplit('_', 1)[0] in f and '_' + kind + '_' in f), None))
        save_tex(pick('diff'), f'pv_{name}_bark')
        if pick('nor_gl'):
            save_tex(pick('nor_gl'), f'pv_{name}_bark_n')
        out[name] = {
            'species': sid, 'role': spec['role'],
            'trunk': pack(tp, tn, tu, ti, tcol), 'cards': cards, 'shadow': shadow,
            'far': {'w': W * kx, 'h': Hf * k}, 'avg': [round(float(c), 3) for c in avg],
        }
        print('   pień', len(ti), 'karty', len(idx), 'trójkątów, atlas', AW, 'x', AH, flush=True)
        # gotowa odmiana: usuwamy jej siatki, żeby następna (i Cycles) miała pamięć (sosna ma 17 mln trójkątów)
        for o in parts:
            me = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if me.users == 0:
                bpy.data.meshes.remove(me)

with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('forest', len(out), 'odmian,', os.path.getsize(OUT) // 1024, 'KB')
