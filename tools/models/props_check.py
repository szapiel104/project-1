"""Porównanie: oryginał z paczki obok tego, co dostaje gra (props.json + tekstury prop_*.jpg).

    /tmp/bpyenv/bin/python tools/models/props_check.py <katalog z paczkami> <wynik.png>

Arkusz: w każdym rzędzie jeden model (ryba, pochodnia), kolumny: oryginał | gra z bliska | gra z daleka, z dwóch stron.
Siatki gry są składane z tych samych buforów co w przeglądarce (pozycje, normalne narożników, UV, indeksy), więc
każda dziura, pocięty szew UV albo odwrócona ściana wyjdzie tutaj, zanim model trafi do gry.
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
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
SRC, OUTPNG = args[0], args[1]
D = json.load(open(os.path.join(ROOT, 'src', 'render', 'models', 'props.json')))
TEX = os.path.join(ROOT, 'public', 'textures', 'cc0')
G2B = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # gra (y w górę) → Blender (z w górę)


def unpack(p):
    b = lambda k: base64.b64decode(p[k])
    pos = np.frombuffer(b('pos'), '<f4').reshape(-1, 3)
    nrm = np.frombuffer(b('nrm'), 'i1').reshape(-1, 3) / 127.0
    uv = np.frombuffer(b('uv'), '<f4').reshape(-1, 2)
    idx = np.frombuffer(b('idx'), '<u2').reshape(-1, 3)
    return pos, nrm, uv, idx


def game_mesh(name, key):
    pos, nrm, uv, idx = unpack(D[key])
    me = bpy.data.meshes.new(key)
    me.from_pydata([tuple(G2B @ Vector(p)) for p in pos], [], [tuple(int(i) for i in f) for f in idx])
    lay = me.uv_layers.new()
    for poly in me.polygons:
        for li in poly.loop_indices:
            lay.data[li].uv = uv[me.loops[li].vertex_index]
    me.normals_split_custom_set([tuple((G2B.to_3x3() @ Vector(nrm[l.vertex_index])).normalized()) for l in me.loops])
    o = bpy.data.objects.new(key, me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(game_mat(name))
    return o


_mats = {}


def game_mat(name):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new('game_' + name)
    m.use_nodes = True
    m.use_backface_culling = False   # gra rysuje te modele dwustronnie (płetwy to pojedyncze płaszczyzny)
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    col = nt.nodes.new('ShaderNodeTexImage'); col.image = bpy.data.images.load(os.path.join(TEX, f'prop_{name}.jpg'))
    nm = nt.nodes.new('ShaderNodeTexImage'); nm.image = bpy.data.images.load(os.path.join(TEX, f'prop_{name}_n.jpg'))
    nm.image.colorspace_settings.name = 'Non-Color'
    nmap = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(col.outputs[0], bsdf.inputs['Base Color'])
    nt.links.new(nm.outputs[0], nmap.inputs['Color'])
    nt.links.new(nmap.outputs[0], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = 0.45 if name == 'fish' else 0.85
    _mats[name] = m
    return m


def frame(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
    return (mn + mx) / 2, (mx - mn).length


def shot(objs, path, side):
    sc = bpy.context.scene
    for o in sc.objects:
        if o.type == 'MESH':
            o.hide_render = o not in objs
    c, r = frame(objs)
    cam = sc.camera
    a = math.radians(35 + side * 180)
    cam.location = c + Vector((math.cos(a) * r * 1.9, math.sin(a) * r * 1.9, r * 0.8))
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def scene():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 32; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = False
    sc.render.resolution_x = sc.render.resolution_y = 420
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.72, 0.74, 0.77, 1)
    l = bpy.data.lights.new('s', 'SUN'); l.energy = 3; lo = bpy.data.objects.new('s', l); lo.rotation_euler = (0.7, 0.2, 0.5)
    sc.collection.objects.link(lo)
    co = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); co.data.lens = 70; sc.collection.objects.link(co); sc.camera = co


tiles = []
TMP = '/tmp/props_check'
os.makedirs(TMP, exist_ok=True)
for name, pack_file, M in (('fish', 'BarramundiFish.glb', None), ('torch', 'torch.glb', None)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene()
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, pack_file))
    orig = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
    near = game_mesh(name, name)
    far = game_mesh(name, name + 'Far')
    # oryginał obok w tej samej skali i ustawieniu: dopasowany do ramki siatki gry
    oc, orr = frame([orig]); nc, nr = frame([near])
    orig.matrix_world = Matrix.Translation(nc) @ Matrix.Scale(nr / orr, 4) @ Matrix.Translation(-oc) @ orig.matrix_world
    if name == 'torch':   # pochodnia w grze jest pochylona w układzie ręki; oryginał pochylamy tak samo
        orig.matrix_world = Matrix.Translation(nc) @ Matrix.Rotation(0.55, 4, 'X') @ Matrix.Translation(-nc) @ orig.matrix_world
    row = []
    for side in (0, 1):
        for tag, o in (('orig', orig), ('near', near), ('far', far)):
            p = f'{TMP}/{name}_{tag}_{side}.png'
            shot([o], p, side)
            row.append(p)
    tiles.append(row)

# arkusz z kafelków
imgs = [[bpy.data.images.load(p) for p in row] for row in tiles]
W = imgs[0][0].size[0]
H = imgs[0][0].size[1]
cols, rows = len(imgs[0]), len(imgs)
sheet = np.ones((rows * H, cols * W, 4), dtype=np.float32)
for r, row in enumerate(imgs):
    for c, im in enumerate(row):
        px = np.array(im.pixels[:], dtype=np.float32).reshape(H, W, 4)
        sheet[(rows - 1 - r) * H:(rows - r) * H, c * W:(c + 1) * W] = px
out = bpy.data.images.new('sheet', cols * W, rows * H)
out.pixels[:] = sheet.ravel()
out.filepath_raw = OUTPNG; out.file_format = 'PNG'; out.save()
print('arkusz:', OUTPNG, '| kolumny: oryginał, gra z bliska, gra z daleka (strona A), to samo ze strony B')
