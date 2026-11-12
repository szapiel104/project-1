"""Zwierzęta z glTF (Sketchfab, CC BY 4.0) — jeleń szlachetny, wielbłąd, prosiak. Te same pozy co w fauna_0ad.py
(10 klatek chodu, 8 klatek spoczynku, skubanie), skórowanie szkieletu policzone tutaj w numpy, bez Blendera.

    python3 -I tools/models/fauna_gltf.py <katalog z rozpakowanymi paczkami> [id...]

Paczka <katalog>/<folder>/scene.gltf (+ scene.bin, textures/). Kilka materiałów (np. łeb, tułów, poroże) składamy
w jedną teksturę (atlas), żeby zwierzę dalej było jedną siatką z jednym materiałem; mapy normalnych tak samo.
Nic nie jest odchudzane — siatki i tekstury z paczki w pełnej rozdzielczości (najwyżej przycięte do 2048 px na kafel).
Wynik: src/render/models/fauna_<id>.json, public/textures/cc0/fauna_<id>.jpg i fauna_<id>_n.jpg.
"""
import base64
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from fauna_0ad import IDLE, ROOT, TEX, WALK  # noqa: E402
from horse_0ad import smooth  # noqa: E402

ANIMALS = {
    # jeleń szlachetny (WildMesh 3D): ok. 1,4 m w kłębie
    'deer': {'dir': 'realistic_animated_elk_3d_model', 'walk': 'Walk', 'idle': 'Stand_Breathing_01', 'graze': 'Stand_Eating_01',
             'height': 0.46, 'skip': [], 'credit': 'Realistic Animated Elk — WildMesh 3D (Sketchfab), CC BY 4.0'},
    # wielbłąd z derką (eb78): grzywa i frędzle (przezroczyste karty włosów) pominięte — gra rysuje sierść bez przezroczystości
    'camel': {'dir': 'camel', 'walk': 'Armature|WalkCycle', 'idle': 'Armature|Idle_01', 'graze': 'Armature|Idle_02',
              'height': 0.68, 'skip': ['CamelHair'], 'credit': 'Camel — eb78 (Sketchfab), CC BY 4.0'},
    # prosiak (grs): w paczce jest tylko chód, więc spoczynek i rycie to klatki chodu bez ruchu nóg
    # wilk (Roo, „Animated Wolf Scene”): chód, bieg, spoczynek, skradanie — druga poza to przyczajenie do skoku;
    # sierść z kart przezroczystych pominięta jak grzywa wielbłąda (gra rysuje zwierzęta bez przezroczystości)
    'wolf': {'dir': 'animated_wolf_scene', 'walk': 'Wolf_Walk_cycle_', 'idle': 'Wolf_Idle_', 'graze': 'Wolf_creep_cycle',
             'height': 0.3, 'skip': ['Wolf_Fur'], 'credit': 'Animated Wolf Scene — Roo (Sketchfab), CC BY 4.0'},
    'pig': {'dir': 'piglet', 'walk': 'PigletWalk', 'idle': None, 'graze': None,
            'height': 0.27, 'skip': [], 'credit': 'Piglet — grs (Sketchfab), CC BY 4.0'},
}
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class Gltf:
    def __init__(self, folder):
        self.dir = folder
        self.d = json.load(open(os.path.join(folder, 'scene.gltf')))
        self.bin = open(os.path.join(folder, self.d['buffers'][0]['uri']), 'rb').read()
        self.parent = {}
        for i, n in enumerate(self.d['nodes']):
            for c in n.get('children', []):
                self.parent[c] = i

    def acc(self, i):
        a = self.d['accessors'][i]
        bv = self.d['bufferViews'][a['bufferView']]
        dt, nc = CT[a['componentType']], NC[a['type']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = bv.get('byteStride', 0) or np.dtype(dt).itemsize * nc
        raw = np.frombuffer(self.bin, dtype=np.uint8, count=stride * (a['count'] - 1) + np.dtype(dt).itemsize * nc, offset=off)
        out = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], np.dtype(dt).itemsize * nc), strides=(stride, 1)).copy()
        out = out.view(dt).reshape(a['count'], nc).astype(np.float64)
        if a.get('normalized'):
            out /= np.iinfo(dt).max
        return out

    def anim(self, name):
        if name is None:
            return None
        a = next(x for x in self.d['animations'] if x.get('name') == name)
        ch = {}
        for c in a['channels']:
            s = a['samplers'][c['sampler']]
            ch[(c['target']['node'], c['target']['path'])] = (self.acc(s['input']).ravel(), self.acc(s['output']))
        dur = max(t[-1] for t, _ in ch.values())
        return ch, dur

    def local(self, i, anim, t):
        n = self.d['nodes'][i]
        if 'matrix' in n:
            return np.array(n['matrix']).reshape(4, 4).T
        T = np.array(n.get('translation', [0, 0, 0]), float)
        R = np.array(n.get('rotation', [0, 0, 0, 1]), float)
        S = np.array(n.get('scale', [1, 1, 1]), float)
        if anim:
            for path in ('translation', 'rotation', 'scale'):
                k = anim[0].get((i, path))
                if not k:
                    continue
                ts, vs = k
                j = int(np.clip(np.searchsorted(ts, t) - 1, 0, len(ts) - 1))
                j2 = min(j + 1, len(ts) - 1)
                w = 0.0 if j2 == j else float(np.clip((t - ts[j]) / (ts[j2] - ts[j]), 0, 1))
                if path == 'rotation':
                    a, b = vs[j], vs[j2]
                    if np.dot(a, b) < 0:
                        b = -b
                    v = a * (1 - w) + b * w
                    v /= np.linalg.norm(v)
                else:
                    v = vs[j] * (1 - w) + vs[j2] * w
                {'translation': lambda: T.__setitem__(slice(None), v), 'rotation': lambda: R.__setitem__(slice(None), v),
                 'scale': lambda: S.__setitem__(slice(None), v)}[path]()
        x, y, z, w_ = R
        M = np.eye(4)
        M[:3, :3] = np.array([
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w_), 2 * (x * z + y * w_)],
            [2 * (x * y + z * w_), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w_)],
            [2 * (x * z - y * w_), 2 * (y * z + x * w_), 1 - 2 * (x * x + y * y)]]) * S
        M[:3, 3] = T
        return M

    def world(self, anim, t):
        W = {}

        def get(i):
            if i in W:
                return W[i]
            L = self.local(i, anim, t)
            W[i] = (get(self.parent[i]) @ L) if i in self.parent else L
            return W[i]
        for i in range(len(self.d['nodes'])):
            get(i)
        return W


def build(base, aid, cfg):
    g = Gltf(os.path.join(base, cfg['dir']))
    d = g.d
    mats = d['materials']
    skin = d['skins'][0]
    joints = skin['joints']
    ibm = g.acc(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    mesh_node = {n['mesh']: i for i, n in enumerate(d['nodes']) if 'mesh' in n}
    prims = []
    for mi, m in enumerate(d['meshes']):
        for p in m['primitives']:
            mat = mats[p['material']]
            if mat.get('name') in cfg['skip']:
                continue
            at = p['attributes']
            prims.append({
                'node': mesh_node[mi], 'mat': p['material'],
                'pos': g.acc(at['POSITION']), 'uv': g.acc(at['TEXCOORD_0']), 'idx': g.acc(p['indices']).astype(np.int64).reshape(-1, 3),
                'j': g.acc(at['JOINTS_0']).astype(np.int64) if 'JOINTS_0' in at else None,
                'w': g.acc(at['WEIGHTS_0']) if 'WEIGHTS_0' in at else None,
            })

    def posed(anim, t):
        W = g.world(anim, t)
        J = np.stack([W[j] for j in joints]) @ ibm
        out = []
        for p in prims:
            P = np.c_[p['pos'], np.ones(len(p['pos']))]
            if p['j'] is not None:
                M = np.einsum('vk,vkij->vij', p['w'], J[p['j']])
                q = np.einsum('vij,vj->vi', M, P)[:, :3]
            else:
                q = (W[p['node']] @ P.T).T[:, :3]   # część nieskórowana (poroże) — wisi na swoim węźle
            out.append(q)
        return np.vstack(out)

    walk, idle, gra = g.anim(cfg['walk']), g.anim(cfg['idle']), g.anim(cfg['graze'])
    base_p = posed(idle or walk, 0)  # tylko do kierunku łba
    # przód tam, gdzie łeb (wyżej): glTF ma y w górę jak gra; łeb kierujemy w +z
    ext = base_p.max(0) - base_p.min(0)
    ax = 0 if ext[0] > ext[2] else 2
    lo, hi = base_p[:, ax].min(), base_p[:, ax].max()
    front = base_p[base_p[:, ax] > hi - (hi - lo) * 0.15][:, 1].max()
    back = base_p[base_p[:, ax] < lo + (hi - lo) * 0.15][:, 1].max()
    sgn = 1 if front >= back else -1
    if ax == 0:
        fix = lambda p: np.c_[-sgn * p[:, 2], p[:, 1], sgn * p[:, 0]]
    else:
        fix = lambda p: np.c_[sgn * p[:, 0], p[:, 1], sgn * p[:, 2]]

    def head_y(t):
        p = fix(posed(gra, t))
        z0, z1 = p[:, 2].min(), p[:, 2].max()
        return p[p[:, 2] > z1 - (z1 - z0) * 0.12][:, 1].min()
    # bez animacji spoczynku: stoi w klatce chodu, w której wszystkie racice są przy ziemi (najwięcej wierzchołków tuż
    # nad ziemią — uniesiona noga je zabiera), a przy remisie z najkrótszym rozkrokiem
    def stance(t):
        p = fix(posed(walk, t))
        y0, h = p[:, 1].min(), p[:, 1].max() - p[:, 1].min()
        low = p[p[:, 1] < y0 + h * 0.04]
        return (-len(low), low[:, 2].max() - low[:, 2].min())
    still = 0.0 if idle else min(np.linspace(0, walk[1], 40, endpoint=False), key=stance)
    poses = {'base': (idle, 0.0) if idle else (walk, still)}
    for k in range(WALK):
        poses[f'walk{k}'] = (walk, walk[1] * k / WALK)
    for k in range(IDLE):
        poses[f'idle{k}'] = (idle, idle[1] * k / IDLE) if idle else (walk, still)
    if gra:
        gt = min(np.linspace(0, gra[1], 40), key=head_y)
        poses['graze'] = (gra, gt)
    else:
        poses['graze'] = (walk, still)
    offs = np.cumsum([0] + [len(p['pos']) for p in prims])
    idx = np.vstack([p['idx'] + offs[k] for k, p in enumerate(prims)])
    res = {}
    # ruch z korzenia (jeleń: chód przesuwa całe ciało do przodu, a pętla wraca na początek) — gra przesuwa zwierzę sama,
    # więc każdą klatkę cofamy w poziomie do środka pozy stojącej; inaczej szło do przodu i co krok skakało do tyłu
    c0 = fix(posed(*poses['base'])).mean(0)
    for pn, (an, t) in poses.items():
        p = fix(posed(an, t))
        c = p.mean(0)
        p = p - np.array([c[0] - c0[0], 0, c[2] - c0[2]])
        res[pn] = (p, smooth(p, idx))

    # atlas: kafle po materiałach (każdy z jednym zdjęciem), UV przesunięte do swojego kafla
    used = sorted({p['mat'] for p in prims})
    tex = {}
    for mi in used:
        m = mats[mi]
        sg = m.get('extensions', {}).get('KHR_materials_pbrSpecularGlossiness')
        bc = (sg or {}).get('diffuseTexture') or m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        nm = m.get('normalTexture')
        img = lambda t: os.path.join(g.dir, d['images'][d['textures'][t['index']]['source']]['uri']) if t else None
        tex[mi] = (img(bc), img(nm))
    n = len(used)
    cols = 1 if n == 1 else 2
    rows = (n + cols - 1) // cols
    big = max((Image.open(tex[mi][0]).width for mi in used if tex[mi][0]), default=512)
    cell = min(2048, big)
    atlas = Image.new('RGB', (cols * cell, rows * cell), (128, 110, 90))
    natlas = Image.new('RGB', (cols * cell, rows * cell), (128, 128, 255))
    place = {}
    for k, mi in enumerate(used):
        cx, cy = k % cols, k // cols
        place[mi] = (cx, cy)
        if tex[mi][0]:
            atlas.paste(Image.open(tex[mi][0]).convert('RGB').resize((cell, cell), Image.LANCZOS), (cx * cell, cy * cell))
        else:   # materiał bez zdjęcia (zęby, pazury): jednolity kolor z paczki
            f = mats[mi].get('pbrMetallicRoughness', {}).get('baseColorFactor', [0.8, 0.8, 0.8, 1])
            atlas.paste(tuple(int(min(1, c) ** (1 / 2.2) * 255) for c in f[:3]), (cx * cell, cy * cell, (cx + 1) * cell, (cy + 1) * cell))
        if tex[mi][1]:
            natlas.paste(Image.open(tex[mi][1]).convert('RGB').resize((cell, cell), Image.LANCZOS), (cx * cell, cy * cell))
    uvs = []
    for p in prims:
        cx, cy = place[p['mat']]
        u = (cx + np.clip(p['uv'][:, 0], 0, 1)) / cols
        v = (cy + np.clip(p['uv'][:, 1], 0, 1)) / rows          # glTF: v od góry obrazka
        uvs.append(np.c_[u, 1 - v])                              # gra (TextureLoader, flipY): v od dołu
    uv = np.vstack(uvs)

    # wspólne wierzchołki (te same położenia we wszystkich pozach i to samo UV) — jak w fauna_0ad.py
    sig = np.hstack([np.round(res[pn][0] / 1e-5) for pn in res] + [np.round(uv * 1e5)])
    _, first, inv = np.unique(sig, axis=0, return_index=True, return_inverse=True)
    res = {pn: (p[first], nn[first]) for pn, (p, nn) in res.items()}
    idx = inv.ravel()[idx]
    uv = uv[first]
    bp = res['base'][0]
    ground = bp[:, 1].min()
    zmin, zmax = bp[:, 2].min(), bp[:, 2].max()
    band = bp[(bp[:, 2] > zmin + (zmax - zmin) * 0.45) & (bp[:, 2] < zmin + (zmax - zmin) * 0.65)]
    scale = cfg['height'] / (band[:, 1].max() - ground)
    shift = np.array([-(bp[:, 0].min() + bp[:, 0].max()) / 2, -ground, -(zmin + zmax) / 2])
    e = lambda b: base64.b64encode(b).decode()
    q8 = lambda v: e(np.clip(np.round(v * 127), -127, 127).astype(np.int8).tobytes())
    bpos, bnrm = res['base']
    bpos = (bpos + shift) * scale
    assert len(bpos) < 65536, len(bpos)
    body = {'pos': e(bpos.astype('<f4').tobytes()), 'nrm': q8(bnrm), 'uv': e(uv.astype('<f4').tobytes()),
            'idx': e(idx.astype('<u2').tobytes()), 'morph': {}}
    for pn in [f'walk{k}' for k in range(WALK)] + [f'idle{k}' for k in range(IDLE)] + ['graze']:
        p, nn = res[pn]
        d = ((p + shift) * scale) - bpos
        sc = float(np.abs(d).max()) / 32767 or 1e-9   # różnica klatki w int16 ze skalą (połowa rozmiaru float32)
        body['morph'][pn] = {'pq': e(np.round(d / sc).astype('<i2').tobytes()), 's': sc, 'nrm': q8(nn - bnrm)}
    out = {'walkN': WALK, 'idleN': IDLE, 'height': cfg['height'], 'length': float((zmax - zmin) * scale), 'credit': cfg['credit'], 'normalMap': True, 'body': body}
    with open(os.path.join(ROOT, 'src', 'render', 'models', f'fauna_{aid}.json'), 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    atlas.save(os.path.join(TEX, f'fauna_{aid}.jpg'), quality=92)
    natlas.save(os.path.join(TEX, f'fauna_{aid}_n.jpg'), quality=92)
    print(f'{aid}: {len(bpos)} wierzchołków, {len(idx)} trójkątów, długość {out["length"]:.2f} pola, atlas {atlas.size}, '
          f'chód {walk[1]:.2f} s')


if __name__ == '__main__':
    base = sys.argv[1]
    only = sys.argv[2:]
    for aid, cfg in ANIMALS.items():
        if not only or aid in only:
            build(base, aid, cfg)
