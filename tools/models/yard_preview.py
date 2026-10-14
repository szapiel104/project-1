"""Podgląd przedmiotów podwórka z yard.json w jednym rzędzie (Cycles, CPU):
/tmp/bpyenv/bin/python tools/models/yard_preview.py /tmp/yard.png"""
import base64, json, math, os, struct, sys
import bpy

out = sys.argv[1]
d = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', 'yard.json')))
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
TINT = {'cloth_shirt': (0.85, 0.82, 0.74), 'cloth_sheet': (0.95, 0.94, 0.9), 'cloth_small': (0.7, 0.3, 0.25), 'cloth_pants': (0.45, 0.4, 0.32)}


def unpack(m, off, tint=(1, 1, 1)):
    raw = lambda k: base64.b64decode(m[k])
    pos = [struct.unpack_from('<3f', raw('pos'), i * 12) for i in range(len(raw('pos')) // 12)]
    col = [struct.unpack_from('<3B', raw('col'), i * 3) for i in range(len(pos))]
    idx = [struct.unpack_from('<3H', raw('idx'), i * 6) for i in range(len(raw('idx')) // 6)]
    verts = [(x + off[0], -(z + off[2]), y + off[1]) for x, y, z in pos]
    me = bpy.data.meshes.new('m'); me.from_pydata(verts, [], idx)
    for p in me.polygons: p.use_smooth = True
    ca = me.color_attributes.new('c', 'FLOAT_COLOR', 'POINT')
    for i, c in enumerate(col): ca.data[i].color = (c[0] / 255 * tint[0], c[1] / 255 * tint[1], c[2] / 255 * tint[2], 1)
    ob = bpy.data.objects.new('o', me); bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.new('mat'); mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    attr = mat.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'c'
    mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.85
    me.materials.append(mat)


row = [('tub', 0), ('post', 0), ('woodpile', 0), ('bench', 0), ('basket', 0), ('bucket', 0), ('garden', 0)]
x = -1.4
for k, _ in row:
    for m in d[k]: unpack(m, (x, 0, 0))
    x += 0.45 if k != 'garden' else 0.6
for i, k in enumerate(['cloth_shirt', 'cloth_sheet', 'cloth_small', 'cloth_pants']):
    for m in d[k]: unpack(m, (-1.3 + i * 0.32, 0.5, -0.5), TINT[k])
sc = bpy.context.scene
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
pl = bpy.context.active_object
pm = bpy.data.materials.new('g'); pm.use_nodes = True; pm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.2, 0.28, 0.12, 1); pl.data.materials.append(pm)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'
sc.render.resolution_x, sc.render.resolution_y = 1200, 560
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (0.8, 0.2, 0.6); sc.collection.objects.link(sun)
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.3, 0.32, 0.36, 1); sc.world = w
sc.camera = cam; cam.data.lens = 40
cam.location = (0.05, 3.0, 1.5); cam.rotation_euler = (math.radians(64), 0, math.radians(180))
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('ok', out)
