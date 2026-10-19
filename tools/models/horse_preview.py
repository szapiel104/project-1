"""Podgląd konia z horse.json w Blenderze (Cycles, CPU): wszystkie pozy obok siebie, z teksturami z paczki.

    /tmp/bpyenv/bin/python tools/models/horse_preview.py src/render/models/horse.json public/textures/cc0 /tmp/kon.png [ujęcie]

ujęcie: side (z boku, domyślnie), front (z przodu pod kątem), high (z góry jak kamera strategii), back (od tyłu)
"""
import base64
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

src, tex, out = sys.argv[1:4]
shot = sys.argv[4] if len(sys.argv) > 4 else 'side'
d = json.load(open(src))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def arr(s, dt, n):
    return np.frombuffer(base64.b64decode(s), dtype=dt).reshape(-1, n)


def material(name, img, alpha=None, normal=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(tex, img))
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.75
    if alpha:
        a = nt.nodes.new('ShaderNodeTexImage'); a.image = bpy.data.images.load(os.path.join(tex, alpha))
        a.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(a.outputs['Color'], b.inputs['Alpha'])
    if normal:
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(os.path.join(tex, normal))
        n.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m


MATS = {'body': material('coat', 'horse_coat.jpg', normal='horse_coat_n.jpg'), 'hair': material('hair', 'horse_hair.jpg', alpha='horse_hair_a.jpg')}
POSES = ['base', 'half', 'graze', 'look', 'swish']
for k, pn in enumerate(POSES):
    for part in ('body', 'hair'):
        m = d[part]
        pos = arr(m['pos'], '<f4', 3).astype(float)
        if pn != 'base':
            pos = pos + arr(m['morph'][pn]['pos'], '<f4', 3)
        uv = arr(m['uv'], '<f4', 2); idx = arr(m['idx'], '<u2', 3)
        verts = [(x, -z + (k - 2) * 0.95, y) for x, y, z in pos]
        me = bpy.data.meshes.new(pn + part); me.from_pydata(verts, [], idx.tolist())
        nrm = arr(m['nrm'], 'i1', 3).astype(float) / 127
        if pn != 'base':
            nrm = nrm + arr(m['morph'][pn]['nrm'], 'i1', 3).astype(float) / 127
        uvl = me.uv_layers.new()
        for p in me.polygons:
            p.use_smooth = True
            for li in p.loop_indices:
                uvl.data[li].uv = uv[me.loops[li].vertex_index]
        me.normals_split_custom_set_from_vertices([(x, -z, y) for x, y, z in nrm])
        me.materials.append(MATS[part])
        ob = bpy.data.objects.new(pn + part, me); sc.collection.objects.link(ob)
# ziemia i światło
bpy.ops.mesh.primitive_plane_add(size=20); g = bpy.context.object
gm = bpy.data.materials.new('g'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.35, 0.33, 0.3, 1); g.data.materials.append(gm)
sun = bpy.data.lights.new('s', 'SUN'); sun.energy = 3.5; so = bpy.data.objects.new('s', sun); so.rotation_euler = (math.radians(50), 0, math.radians(35)); sc.collection.objects.link(so)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.62, 0.72, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 5.0
co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
eye = {'side': (8, 0, 0.35), 'front': (6, -4, 1.6), 'high': (5, -2.5, 6), 'back': (-6, 4, 1.4)}[shot]
co.location = Vector(eye); target = Vector((0, 0, 0.3))
co.rotation_euler = (target - co.location).to_track_quat('-Z', 'Y').to_euler()
if shot == 'side':
    co.location = Vector((8, 0, 0.35)); co.rotation_euler = (math.radians(90), 0, math.radians(90))
sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.device = 'CPU'
sc.render.resolution_x, sc.render.resolution_y = 1600, 520
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
