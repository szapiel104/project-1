"""Trawa z gotowych kęp Poly Haven (CC0, modele zrobione przez grafików) — Blender robi z nich atlas kart do gry.

Paczki glTF 1K rozpakowane do jednego katalogu (podkatalog na paczkę, nazwa = id z Poly Haven):

    /tmp/bpyenv/bin/python tools/models/grass_polyhaven.py /ścieżka/do/paczek

Oryginalne kępy mają od kilkuset do kilkudziesięciu tysięcy trójkątów (każde źdźbło to siatka), a dywan trawy
w grze to kilkadziesiąt tysięcy kęp, więc gra nie rysuje siatek, tylko zdjęcia: każda kępa jest sfotografowana
z boku kamerą ortograficzną (kolor + maska) w jedno pole atlasu 4×2. Wszystkie pola mają tę samą skalę
(FRAME m na bok, podstawa kępy przy dolnej krawędzi), więc niska trawa zostaje niska, a wysoka wysoka.
Światło miękkie jak w dzień pochmurny: cień w głębi kępy jest w zdjęciu, kierunek słońca dokłada gra.

Wynik: public/textures/cc0/pv_grass.jpg + pv_grass_a.jpg (maska) i pv_grass_dry.jpg (suche źdźbła, jesień). Kolejność pól = TILES (grass.ts zna ją po numerach).
"""
import math
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, '..', '..', 'public', 'textures', 'cc0')
TMP = '/tmp/grass_bake'
SRC = sys.argv[-1]

FRAME = 0.42  # bok pola atlasu w metrach (najwyższa kępa ma ok. 0,4 m)
TILE = 512
COLS, ROWS = 4, 2
# pola atlasu: (paczka, siatki złożone w jedną kępę [(nazwa, przesunięcie x, y, obrót°)])
TILES = [
    ('grass_medium_02', [('grass_medium_02_d', 0, 0, 0)]),                 # 0 gęsta łąka
    ('grass_medium_02', [('grass_medium_02_e', 0, 0, 0)]),                 # 1 wysoka łąka
    ('grass_medium_01', [('grass_medium_01_large_b_LOD0', 0, 0, 0)]),      # 2 gęsta, niska
    ('grass_medium_01', [('grass_medium_01_mid_a_LOD0', 0, 0, 0)]),        # 3 średnia
    ('grass_medium_01', [('grass_medium_01_tall_a_LOD0', -0.04, 0, 0), ('grass_medium_01_tall_b_LOD0', 0.05, 0.03, 70)]),  # 4 wysokie źdźbła
    ('grass_medium_01', [('grass_medium_01_large_a_LOD0', 0, 0, 0)]),      # 5 szeroka, niska
    ('grass_bermuda_01', [('grass_bermuda_01_seedling_a', -0.1, 0, 0), ('grass_bermuda_01_seedling_b', 0.0, 0.03, 50),
                          ('grass_bermuda_01_seedling_c', 0.09, -0.02, 120), ('grass_bermuda_01_medium_f', -0.04, -0.03, 0),
                          ('grass_bermuda_01_medium_a', 0.05, 0.04, 200), ('grass_bermuda_01_dead_b', 0.12, 0.02, 30)]),  # 6 niska, rzadka
    ('dandelion_01', [('dandelion_01_a_LOD0', 0, 0, 0)]),                  # 7 mniszek
]


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 6
    sc.cycles.transparent_max_bounces = 16
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.render.resolution_x = sc.render.resolution_y = TILE
    w = bpy.data.worlds.new('sky')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.8, 0.84, 0.88, 1)
    bg.inputs[1].default_value = 1.25
    sc.world = w
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 1.2
    sun.angle = 0.6
    so = bpy.data.objects.new('sun', sun)
    so.rotation_euler = (0.7, 0.0, 0.4)
    sc.collection.objects.link(so)
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = FRAME
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    sc.camera = co
    co.location = (0, -3, FRAME / 2 - 0.004)
    co.rotation_euler = (math.pi / 2, 0, 0)
    cam.clip_start, cam.clip_end = 0.5, 6
    return sc


def load(pack, dry):
    """Paczka glTF 1K ma kolor w JPG bez przezroczystości: maskę źdźbeł (`_alpha_1k.jpg`, osobny plik z Poly Haven)
    podpinamy do wejścia Alpha. dry=True: kolor ze „suchej” wersji tekstury (`_dry_diff_1k.jpg`), gdy paczka ją ma."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, pack, pack + '_1k.gltf'))
    objs = {o.name: o for o in set(bpy.data.objects) - before if o.type == 'MESH'}
    tdir = os.path.join(SRC, pack, 'textures')
    for m in {s.material for o in objs.values() for s in o.material_slots if s.material}:
        nt = m.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        link = bsdf.inputs['Base Color'].links
        if not link:
            continue
        diff = link[0].from_node
        while diff.type != 'TEX_IMAGE':  # glTF wstawia czasem mnożenie przez kolor wierzchołków
            diff = next(i.links[0].from_node for i in diff.inputs if i.links)
        if dry and os.path.exists(os.path.join(tdir, pack + '_dry_diff_1k.jpg')):
            diff.image = bpy.data.images.load(os.path.join(tdir, pack + '_dry_diff_1k.jpg'))
        apath = os.path.join(tdir, pack + '_alpha_1k.jpg')
        if os.path.exists(apath):
            an = nt.nodes.new('ShaderNodeTexImage')
            an.image = bpy.data.images.load(apath)
            an.image.colorspace_settings.name = 'Non-Color'
            if diff.inputs['Vector'].links:
                nt.links.new(diff.inputs['Vector'].links[0].from_socket, an.inputs['Vector'])
            for l in list(bsdf.inputs['Alpha'].links):
                nt.links.remove(l)
            nt.links.new(an.outputs['Color'], bsdf.inputs['Alpha'])
    return objs


def place(o, dx, dy, rot):
    """Kępa na środek: podstawa w z=0, środek podstawy w (dx, dy), obrót wokół pionu."""
    M = np.array(o.matrix_world)
    v = np.array([[*c.co, 1.0] for c in o.data.vertices]) @ M.T
    low = v[v[:, 2] < v[:, 2].min() + 0.02]
    cx, cy, z0 = low[:, 0].mean(), low[:, 1].mean(), v[:, 2].min()
    o.location.x -= cx
    o.location.y -= cy
    o.location.z -= z0
    bpy.context.view_layer.update()
    o.rotation_mode = 'XYZ'
    # obrót wokół podstawy: najpierw przesuwamy pivot do środka podstawy
    o.matrix_world = __import__('mathutils').Matrix.Translation((dx, dy, 0)) @ __import__('mathutils').Matrix.Rotation(math.radians(rot), 4, 'Z') @ o.matrix_world


def main(dry, name):
    os.makedirs(TMP, exist_ok=True)
    sc = setup()
    cache = {}
    atlas = np.zeros((ROWS * TILE, COLS * TILE, 4), np.float32)
    for k, (pack, parts) in enumerate(TILES):
        if pack not in cache:
            cache[pack] = load(pack, dry)
        objs = cache[pack]
        for o in [o for p in cache.values() for o in p.values()]:
            o.hide_render = True
        for part, dx, dy, rot in parts:
            src = objs[part]
            o = src.copy()
            o.data = src.data.copy()
            sc.collection.objects.link(o)
            o.hide_render = False
            place(o, dx, dy, rot)
        path = os.path.join(TMP, f'tile{k}.png')
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(path)
        a = np.array(img.pixels[:], np.float32).reshape(TILE, TILE, 4)  # wiersz 0 = dół
        bpy.data.images.remove(img)
        for o in list(sc.collection.objects):
            if o.type == 'MESH' and not o.hide_render:
                bpy.data.objects.remove(o)
        r, c = k // COLS, k % COLS
        y0 = (ROWS - 1 - r) * TILE  # pole 0 w lewym górnym rogu obrazka
        atlas[y0:y0 + TILE, c * TILE:(c + 1) * TILE] = a
        print('pole', k, pack, 'pokrycie', round(float((a[:, :, 3] > 0.5).mean()), 3), flush=True)
    save(atlas, name, mask=not dry)


def save(arr, name, mask=True):
    """Kolor rozlany w przezroczyste miejsca (mipmapy nie ciemnieją na brzegach źdźbeł) + maska osobnym plikiem."""
    h, w, _ = arr.shape
    a = arr[:, :, 3:4]
    solid = a > 0.35
    rgb = np.where(solid, arr[:, :, :3] / np.maximum(a, 1e-3), 0)  # kolor bez domieszki tła (alfa przemnożona)
    filled, wsum = rgb, solid.astype(np.float32)
    for _ in range(24):
        kk = lambda x: (np.roll(x, 1, 0) + np.roll(x, -1, 0) + np.roll(x, 1, 1) + np.roll(x, -1, 1) + x)
        fs, ws = kk(filled), kk(wsum)
        grow = (wsum == 0) & (ws > 0)
        filled = np.where(grow, fs / np.maximum(ws, 1e-4), filled)
        wsum = np.where(grow, 1.0, wsum)
    avg = rgb.reshape(-1, 3).sum(0) / max(1, solid.sum())
    filled = np.where(wsum > 0, filled, avg)
    for data, suffix in ((filled, ''), (np.repeat(a, 3, 2), '_a'))[:2 if mask else 1]:
        img = bpy.data.images.new(name + suffix, w, h, alpha=False)
        px = np.concatenate([np.clip(data, 0, 1), np.ones((h, w, 1), np.float32)], 2)
        img.pixels[:] = px.ravel()
        img.filepath_raw = os.path.join(TEX, name + suffix + '.jpg')
        img.file_format = 'JPEG'
        bpy.context.scene.render.image_settings.quality = 90
        img.save()
        bpy.data.images.remove(img)
    print('średni kolor', [round(float(x), 3) for x in avg])


main(False, 'pv_grass')
main(True, 'pv_grass_dry')  # ta sama maska co pv_grass (te same kępy, inny kolor)
