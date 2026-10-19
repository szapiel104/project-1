"""Krzaki z gotowych krzewów Poly Haven (CC0, modele zrobione przez grafików) — Blender robi z nich wersję do gry.

Paczki glTF 1K (+ osobne maski `<id>_alpha_1k.jpg`, bo JPG w paczce glTF nie ma przezroczystości) rozpakowane do
jednego katalogu, podkatalog na paczkę (nazwa = id z Poly Haven):

    /tmp/bpyenv/bin/python tools/models/bushes_polyhaven.py /ścieżka/do/paczek

Pojedyncze krzewy z paczki są rzadkie i wysokie (Searsia lucida, 1–2,3 m), więc każda odmiana krzaka to kilka
krzewów zsuniętych w jedną gęstą kępę (BUSHES), z liśćmi przyciemnionymi do soczystej, leśnej zieleni. Kępa
(setki tysięcy trójkątów) jest fotografowana jak korony drzew w forest_polyhaven.py: pionowe plastry z trzech
stron i poziome od góry, każdy plaster to karta w miejscu, z którego pochodzi — ok. 44 trójkąty na krzak, a liście
i gałązki są prawdziwe. Do tego obrazek z daleka z 8 stron i prosta bryła cienia.

Wynik:
  src/render/models/bushes.json — odmiany: cards (karty), shadow (bryła cienia), far (wymiary obrazka z daleka)
  public/textures/cc0/pv_bush_<odmiana>_{cards,far}.jpg (+ _a.jpg maska)
Układ jak w grze: y w górę, środek podstawy w (0, 0, 0), wysokość HEIGHT pola (skalę dokłada gra).
"""
import base64
import json
import math
import os
import struct
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(ROOT, 'src', 'render', 'models', 'bushes.json')
TEX = os.path.join(ROOT, 'public', 'textures', 'cc0')
TMP = '/tmp/bush_bake'
SRC = [a for a in sys.argv[1:] if not a.startswith('-')][0]

# wymiary krzaka w polach (jak dawna bryła z plants.py: ok. 0,6 × 0,45, gra skaluje instancje 0,6–1,9)
HEIGHT, RADIUS = 0.48, 0.38
PACK = 'searsia_lucida'
# odmiany: krzewy z paczki (nazwa siatki, przesunięcie x, y w metrach, obrót°, skala) zsunięte w jedną kępę
BUSHES = {
    # kopulasta, gęsta: duży krzew w środku (przycięty), wokół niższe — kępa szersza niż wysoka
    'a': [('searsia_lucida_b_LOD0', 0, 0, 0, 0.55), ('searsia_lucida_d_LOD0', 0.3, 0.2, 70, 0.7),
          ('searsia_lucida_e_LOD0', -0.35, 0.1, 140, 1.0), ('searsia_lucida_f_LOD0', 0.1, -0.4, 60, 1.3),
          ('searsia_lucida_g_LOD0', -0.2, 0.4, 250, 1.3), ('searsia_lucida_f_LOD0', 0.45, -0.15, 200, 1.1),
          ('searsia_lucida_g_LOD0', -0.45, -0.3, 20, 1.1), ('searsia_lucida_e_LOD0', 0.15, 0.45, 300, 0.9)],
    # niska i rozłożysta
    'b': [('searsia_lucida_d_LOD0', 0, 0, 0, 0.6), ('searsia_lucida_e_LOD0', -0.45, 0.15, 200, 0.9),
          ('searsia_lucida_e_LOD0', 0.45, -0.1, 20, 0.85), ('searsia_lucida_g_LOD0', 0.3, 0.4, 90, 1.2),
          ('searsia_lucida_f_LOD0', 0.1, -0.5, 300, 1.1), ('searsia_lucida_g_LOD0', -0.35, -0.4, 160, 1.0),
          ('searsia_lucida_f_LOD0', -0.15, 0.5, 240, 1.0)],
    # wyższa, z jednym wybijającym się krzewem
    'c': [('searsia_lucida_c_LOD0', 0, 0, 0, 0.62), ('searsia_lucida_a_LOD0', 0.25, -0.15, 120, 0.4),
          ('searsia_lucida_f_LOD0', 0.4, 0.25, 30, 1.2), ('searsia_lucida_e_LOD0', -0.35, -0.3, 110, 1.0),
          ('searsia_lucida_g_LOD0', 0.2, -0.45, 200, 1.2), ('searsia_lucida_g_LOD0', -0.4, 0.3, 300, 1.1)],
}
V_ANGLES, V_SLABS, H_SLABS = (0, 45, 90, 135), 3, 2
TILE = 320       # wysokość zdjęcia pionowego plastra (krzak na ekranie ma rzadko ponad 150 px)
FAR_H = 160      # wysokość klatki obrazka z daleka
ATLAS_W = 4096   # szerokość atlasu kart (plastry w rzędach)
# barwa liści: olivkowo-szare liście z RPA przesunięte w soczystą zieleń europejskiego krzaka
HUE, SAT, VAL = 0.56, 1.7, 0.68


def pack(pos, nrm, uv, idx, col):
    e = lambda b: base64.b64encode(b).decode()
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


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 6
    sc.cycles.transparent_max_bounces = 96
    sc.render.film_transparent = True
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
    sun.energy = 2.0
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


def load():
    """Paczka z maską liści podpiętą do Alpha i liśćmi przyciemnionymi do zieleni (Hue/Saturation za kolorem)."""
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, PACK, PACK + '_1k.gltf'))
    tdir = os.path.join(SRC, PACK, 'textures')
    apath = os.path.join(tdir, PACK + '_alpha_1k.jpg')
    if not os.path.exists(apath):
        apath = os.path.join(SRC, PACK, PACK + '_alpha_1k.jpg')
    for m in bpy.data.materials:
        if not m.node_tree:
            continue
        nt = m.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf or not bsdf.inputs['Base Color'].links:
            continue
        diff = bsdf.inputs['Base Color'].links[0].from_node
        while diff.type != 'TEX_IMAGE':
            diff = next(i.links[0].from_node for i in diff.inputs if i.links)
        if os.path.exists(apath):
            an = nt.nodes.new('ShaderNodeTexImage')
            an.image = bpy.data.images.load(apath, check_existing=True)
            an.image.colorspace_settings.name = 'Non-Color'
            if diff.inputs['Vector'].links:
                nt.links.new(diff.inputs['Vector'].links[0].from_socket, an.inputs['Vector'])
            for l in list(bsdf.inputs['Alpha'].links):
                nt.links.remove(l)
            nt.links.new(an.outputs['Color'], bsdf.inputs['Alpha'])
        if 'leaves' in m.name.lower():
            hs = nt.nodes.new('ShaderNodeHueSaturation')
            hs.inputs['Hue'].default_value = HUE
            hs.inputs['Saturation'].default_value = SAT
            hs.inputs['Value'].default_value = VAL
            src = bsdf.inputs['Base Color'].links[0].from_socket
            nt.links.new(src, hs.inputs['Color'])
            nt.links.new(hs.outputs['Color'], bsdf.inputs['Base Color'])
        elif 'twig' in m.name.lower():
            # szare gałązki z RPA przyciemnione do brązu kory w cieniu krzaka
            hs = nt.nodes.new('ShaderNodeHueSaturation')
            hs.inputs['Value'].default_value = 0.5
            src = bsdf.inputs['Base Color'].links[0].from_socket
            nt.links.new(src, hs.inputs['Color'])
            nt.links.new(hs.outputs['Color'], bsdf.inputs['Base Color'])
        # liście prześwitują w słońcu (jak żywy krzak), bez połysku
        if 'Roughness' in bsdf.inputs and not bsdf.inputs['Roughness'].links:
            bsdf.inputs['Roughness'].default_value = 0.85
    return {o.name: o for o in bpy.data.objects if o.type == 'MESH'}


def place(o, dx, dy, rot, s):
    """Krzew na swoje miejsce w kępie: środek podstawy w (dx, dy), obrót wokół pionu, skala."""
    v = verts_np(o)
    low = v[v[:, 2] < v[:, 2].min() + 0.05]
    cx, cy, z0 = float(low[:, 0].mean()), float(low[:, 1].mean()), float(v[:, 2].min())
    o.matrix_world = (Matrix.Translation((dx, dy, 0)) @ Matrix.Rotation(math.radians(rot), 4, 'Z') @ Matrix.Scale(s, 4)
                      @ Matrix.Translation((-cx, -cy, -z0)) @ o.matrix_world)


def verts_np(o):
    me = o.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    M = np.array(o.matrix_world, np.float32)
    return co @ M[:3, :3].T + M[:3, 3]


def shoot(co, loc, look, top, scale, rx, ry, clip0, clip1, path):
    sc = bpy.context.scene
    co.location = loc
    co.rotation_euler = (0, 0, 0) if top else Vector(look).to_track_quat('-Z', 'Y').to_euler()
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
    """Kolor bez domieszki tła (rozlany w przezroczyste miejsca, żeby mipmapy nie ciemniały na brzegach) + maska."""
    h, w, _ = arr.shape
    a = arr[:, :, 3:4]
    solid = a > 0.35
    rgb = np.where(solid, arr[:, :, :3] / np.maximum(a, 1e-3), 0)
    filled, wsum = rgb, solid.astype(np.float32)
    for _ in range(16):
        k = lambda x: (np.roll(x, 1, 0) + np.roll(x, -1, 0) + np.roll(x, 1, 1) + np.roll(x, -1, 1) + x)
        fs, ws = k(filled), k(wsum)
        grow = (wsum == 0) & (ws > 0)
        filled = np.where(grow, fs / np.maximum(ws, 1e-4), filled)
        wsum = np.where(grow, 1.0, wsum)
    avg = rgb.reshape(-1, 3).sum(0) / max(1, solid.sum())
    filled = np.where(wsum > 0, filled, avg)
    for data, suffix in ((filled, ''), (np.repeat(a, 3, 2), '_a')):
        img = bpy.data.images.new(name + suffix, w, h, alpha=False)
        img.pixels[:] = np.concatenate([np.clip(data, 0, 1), np.ones((h, w, 1), np.float32)], 2).ravel()
        img.filepath_raw = os.path.join(TEX, name + suffix + '.jpg')
        img.file_format = 'JPEG'
        bpy.context.scene.render.image_settings.quality = 90
        img.save()
        bpy.data.images.remove(img)
    return avg


def compare(co, objs, pos, nrm, uv, idx, name, cx, cy, z0, kx, k):
    """Sprawdzenie: oryginalna kępa i jej wersja na kartach, z tych samych kamer (z góry jak w strategii, z boku jak
    w spacerze), w tym samym świetle — zapis /tmp/bush_cmp_<nazwa>.png (rząd górny: oryginał, dolny: karty)."""
    sc = bpy.context.scene
    me = bpy.data.meshes.new('cards')
    # karty z powrotem w układ Blendera (odwrotność xf), żeby stały dokładnie w miejscu oryginału
    me.from_pydata([(p[0] / kx + cx, -p[2] / kx + cy, p[1] / k + z0) for p in pos], [], [tuple(f) for f in idx])
    uvl = me.uv_layers.new()
    for poly in me.polygons:
        for li in poly.loop_indices:
            uvl.data[li].uv = uv[me.loops[li].vertex_index]
    mat = bpy.data.materials.new('cardmat')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    ti = nt.nodes.new('ShaderNodeTexImage')
    ti.image = bpy.data.images.load(os.path.join(TEX, name + '_cards.jpg'))
    ta = nt.nodes.new('ShaderNodeTexImage')
    ta.image = bpy.data.images.load(os.path.join(TEX, name + '_cards_a.jpg'))
    ta.image.colorspace_settings.name = 'Non-Color'
    for n in (ti, ta):
        n.interpolation = 'Closest'
    mt = nt.nodes.new('ShaderNodeMath')
    mt.operation = 'GREATER_THAN'
    mt.inputs[1].default_value = 0.5  # jak alphaTest w grze
    nt.links.new(ti.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(ta.outputs['Color'], mt.inputs[0])
    nt.links.new(mt.outputs[0], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.9
    me.materials.append(mat)
    # normalne jak w grze (kulą od środka kępy), karty nie rzucają cienia (w grze cień rzuca osobna bryła)
    me.normals_split_custom_set_from_vertices([(n[0], -n[2], n[1]) for n in nrm])
    ob = bpy.data.objects.new('cards', me)
    ob.visible_shadow = False
    sc.collection.objects.link(ob)
    cam = co.data
    cam.type = 'PERSP'
    cam.lens = 50
    cam.clip_start, cam.clip_end = 0.05, 100
    views = [(55, 30), (55, 150), (25, 260), (8, 80)]  # (nachylenie°, obrót°)
    R = 1.0
    sc.render.film_transparent = False
    rows = []
    for show_cards in (False, True):
        ob.hide_render = not show_cards
        for o in objs:
            o.hide_render = show_cards
        row = []
        for el, az in views:
            e, a = math.radians(el), math.radians(az)
            d = 4.2 * R
            tgt = Vector((cx, cy, z0 + 0.5))
            co.location = tgt + Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e))) * d
            co.rotation_euler = (tgt - co.location).to_track_quat('-Z', 'Y').to_euler()
            sc.render.resolution_x = sc.render.resolution_y = 360
            sc.render.filepath = f'{TMP}/c.png'
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(f'{TMP}/c.png')
            row.append(np.array(img.pixels[:], np.float32).reshape(360, 360, 4))
            bpy.data.images.remove(img)
        rows.append(np.concatenate(row, 1))
    sheet = np.concatenate(rows[::-1], 0)  # wiersz 0 = dół: karty na dole, oryginał na górze
    img = bpy.data.images.new('cmp', sheet.shape[1], sheet.shape[0], alpha=False)
    img.pixels[:] = sheet.ravel()
    img.filepath_raw = f'/tmp/bush_cmp_{name}.png'
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
    bpy.data.objects.remove(ob, do_unlink=True)
    for o in objs:
        o.hide_render = False
    cam.type = 'ORTHO'
    sc.render.film_transparent = True


out = {}
os.makedirs(TEX, exist_ok=True)
os.makedirs(TMP, exist_ok=True)
for vid, parts in BUSHES.items():
    co = setup_scene()
    src = load()
    for o in src.values():
        o.hide_render = True
    objs = []
    for nm, dx, dy, rot, s in parts:
        o = src[nm].copy()
        o.data = src[nm].data.copy()
        bpy.context.scene.collection.objects.link(o)
        o.hide_render = False
        place(o, dx, dy, rot, s)
        objs.append(o)
    bpy.context.view_layer.update()
    for o in src.values():  # oryginały nie są potrzebne (pamięć dla Cycles)
        me = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if me.users == 0:
            bpy.data.meshes.remove(me)
    world = np.concatenate([verts_np(o) for o in objs])
    z0, z1 = float(world[:, 2].min()), float(world[:, 2].max())
    cx, cy = float(world[:, 0].mean()), float(world[:, 1].mean())
    R = float(np.percentile(np.hypot(world[:, 0] - cx, world[:, 1] - cy), 99.5)) * 1.04
    H = z1 - z0
    k = HEIGHT / H
    kx = min(k * 1.15, RADIUS / R)
    xf = lambda c: ((c.x - cx) * kx, (c.z - z0) * k, -(c.y - cy) * kx)
    name = f'pv_bush_{vid}'
    print(name, f'wys. {H:.2f} m, promień {R:.2f} m, skala {k:.3f} / {kx:.3f}', flush=True)

    # --- karty: pionowe plastry z trzech stron + poziome od góry
    zm = (z0 + z1) / 2
    tw = max(4, round(TILE * 2 * R / H / 4) * 4) if H >= 2 * R else TILE
    th = TILE if H >= 2 * R else max(4, round(TILE * H / (2 * R) / 4) * 4)
    sc_v = max(2 * R, H)
    tiles, quads = [], []
    D = R + 3
    for ang in V_ANGLES:
        a = math.radians(ang)
        dv = Vector((math.cos(a), math.sin(a), 0))
        rv = Vector((dv.y, -dv.x, 0))
        C = Vector((cx, cy, zm))
        for s in range(V_SLABS):
            t0, t1 = -R + s * 2 * R / V_SLABS, -R + (s + 1) * 2 * R / V_SLABS
            img = shoot(co, C - dv * D, dv, False, sc_v, tw, th, D + t0, D + t1, f'{TMP}/v.png')
            if img[:, :, 3].max() < 0.05:
                continue
            M = C + dv * ((t0 + t1) / 2)
            hw, hh = sc_v / 2 * tw / max(tw, th), sc_v / 2 * th / max(tw, th)
            quads.append(([M - rv * hw - Vector((0, 0, hh)), M + rv * hw - Vector((0, 0, hh)), M + rv * hw + Vector((0, 0, hh)), M - rv * hw + Vector((0, 0, hh))], len(tiles), False))
            tiles.append(img)
    hs = TILE
    for s in range(H_SLABS):
        za, zb = z0 + H * (0.35 + s * 0.65 / H_SLABS), z0 + H * (0.35 + (s + 1) * 0.65 / H_SLABS)
        top_z = z1 + 3
        img = shoot(co, Vector((cx, cy, top_z)), Vector((0, 0, -1)), True, 2 * R, hs, hs, top_z - zb, top_z - za, f'{TMP}/h.png')
        if img[:, :, 3].max() < 0.05:
            continue
        zc = za + (zb - za) * 0.6
        quads.append(([Vector((cx - R, cy - R, zc)), Vector((cx + R, cy - R, zc)), Vector((cx + R, cy + R, zc)), Vector((cx - R, cy + R, zc))], len(tiles), True))
        tiles.append(img)
    # atlas: plastry w rzędach po ATLAS_W pikseli (pionowe, potem poziome)
    cells, x, y, rowh = [], 0, 0, 0
    for t in tiles:
        h_, w_ = t.shape[:2]
        if x + w_ > ATLAS_W:
            x, y, rowh = 0, y + rowh, 0
        cells.append((x, y))
        x += w_
        rowh = max(rowh, h_)
    AW = (max(cx_ + t.shape[1] for (cx_, _), t in zip(cells, tiles)) + 3) // 4 * 4
    AH = (y + rowh + 3) // 4 * 4
    atlas = np.zeros((AH, AW, 4), np.float32)
    rects = []
    for (x0, y0), t in zip(cells, tiles):
        h_, w_ = t.shape[:2]
        atlas[y0:y0 + h_, x0:x0 + w_] = t
        rects.append((x0 / AW, y0 / AH, (x0 + w_) / AW, (y0 + h_) / AH))
    save_rgba(atlas, f'{name}_cards')
    pos, nrm, uv, idx = [], [], [], []
    for corners, ti, flat in quads:
        u0, v0, u1, v1 = rects[ti]
        uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
        for back in (False, True):
            base = len(pos)
            for c, u in zip(corners, uvs):
                p = xf(c)
                # normalne kulą od środka kępy: światło gry oświetla krzak jak bryłę, a nie jak płaskie deski
                out_v = norm((p[0], 0.0, p[2])) if math.hypot(p[0], p[2]) > 1e-3 else (0, 0, 0)
                nrm.append(norm((out_v[0] * 0.8, 0.6 + 0.4 * p[1] / HEIGHT, out_v[2] * 0.8)))
                pos.append(p)
                uv.append(u)
            f = [(base, base + 1, base + 2), (base, base + 2, base + 3)]
            idx += [(a, c, b) for a, b, c in f] if back else f
    # cień w głębi kępy: dół kart ciemniejszy (w zdjęciu jest już cień z miękkiego światła, to tylko dociśnięcie)
    col = [((0.85 + 0.15 * min(1.0, p[1] / HEIGHT * 1.4)),) * 3 for p in pos]
    cards = pack(pos, nrm, uv, idx, col)
    # zamknięta bryła cienia: ośmiokąt w obrysie kępy (dwa stożki)
    Rg = RADIUS * 0.8
    yb = HEIGHT * 0.45
    sp, si = [(0, HEIGHT * 0.95, 0), (0, 0.02, 0)], []
    for i in range(8):
        a = i / 8 * math.tau
        sp.append((math.cos(a) * Rg, yb, math.sin(a) * Rg))
    for i in range(8):
        a, b = 2 + i, 2 + (i + 1) % 8
        si += [(0, b, a), (1, a, b)]
    shadow = pack(sp, [(0, 1, 0)] * len(sp), [(0, 0)] * len(sp), si, [(1, 1, 1)] * len(sp))

    if os.environ.get('COMPARE'):
        compare(co, objs, pos, nrm, uv, idx, name, cx, cy, z0, kx, k)
    # --- z daleka: 8 klatek całej kępy (kamera na (sin a, cos a) w x/z gry, jak obrazki drzew)
    W, Hf = 2 * R * 1.04, H * 1.04
    fw = max(8, round(FAR_H * W / Hf / 4) * 4)
    strip = np.zeros((FAR_H, fw * 8, 4), np.float32)
    for f in range(8):
        a = f / 8 * math.tau
        dv = Vector((-math.sin(a), math.cos(a), 0))
        C = Vector((cx, cy, z0 + Hf / 2))
        strip[:, f * fw:(f + 1) * fw] = shoot(co, C - dv * D, dv, False, max(W, Hf), fw, FAR_H, 0.01, 2 * D, f'{TMP}/f.png')
    avg = save_rgba(strip, f'{name}_far')
    out[vid] = {'cards': cards, 'shadow': shadow, 'far': {'w': W * kx, 'h': Hf * k}, 'avg': [round(float(c), 3) for c in avg]}
    print('  karty', len(idx), 'trójkątów, atlas', AW, 'x', AH, 'średni kolor', out[vid]['avg'], flush=True)

with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('bushes', len(out), 'odmian,', os.path.getsize(OUT) // 1024, 'KB')
