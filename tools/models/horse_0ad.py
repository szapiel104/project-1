"""Koń z gry 0 A.D. (Wildfire Games, CC BY-SA 3.0) w wersji do naszej gry — model zrobiony przez grafików,
nie składany z brył.

    python3 tools/models/horse_0ad.py <katalog 0 A.D.: binaries/data/mods/public/art> [--preview /tmp/kon.png]

Bez Blendera: COLLADA z 0 A.D. (ciało horse_breed, grzywa i ogon hair_*_01_breed, ruch horse_breed_idle_*) czytamy
tutaj i skórujemy szkielet w numpy, dokładnie tak jak robi to silnik 0 A.D. (bind_shape × odwrotność wiązania × poza
kości). Importer COLLADA w Blenderze 4.x gubi zagnieżdżone klipy ruchu, a w 5.x już go nie ma. Siatki idą do gry
bez odchudzania (1666 + 204 trójkątów): oryginalne UV, oryginalne tekstury z paczki.

Pozy (gra miesza je na karcie graficznej, osobno dla każdego konia — morph targets w InstancedMesh):
  base   — stoi spokojnie (idle_01, pierwsza klatka),
  graze  — łeb przy ziemi, skubie trawę (kości szyi i łba zgięte ręcznie z pozy base; „feeding” z paczki to grzebanie
           kopytem z łbem przy piersi, nie skubanie),
  half   — w pół drogi do skubania (gra przechodzi base → half → graze),
  look   — łeb uniesiony i odwrócony, czujny (idle_02, klatka z łbem najbardziej w bok),
  swish  — ogon odrzucony w bok (kości ogona obrócone ręcznie; ruch w obie strony = waga ze znakiem).

Wynik:
  src/render/models/horse.json — body (sierść), hair (grzywa + ogon, z przezroczystością); w każdej: pos, nrm, uv, idx
    oraz pozy jako różnice pozycji i normalnych względem base (morph targets), wysokość w kłębie `withers`
  public/textures/cc0/horse_coat.jpg (+ _n), horse_hair.jpg (+ _a maska) — potem `node tools/textures/ktx2.mjs ...`

Układ jak w grze: y w górę, łeb w +z, kopyta na y = 0, środek tułowia w (0, 0); skala: kłąb na wysokości WITHERS pól.
"""
import base64
import json
import os
import struct
import sys
import xml.etree.ElementTree as ET

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(ROOT, 'src', 'render', 'models', 'horse.json')
TEX = os.path.join(ROOT, 'public', 'textures', 'cc0')
NS = {'c': 'http://www.collada.org/2005/11/COLLADASchema'}
WITHERS = 0.47     # wysokość w kłębie w polach (bark człowieka ok. 0,45 pola, kłąb konia ok. 1,55 m)
COAT = 'horse_bay_01'   # gniady: brązowa sierść, czarne nogi, grzywa i ogon
HAIR = 'hair_black'
MORPHS = ('half', 'graze', 'look', 'swish')   # kolejność = kolejność morph targets w grze
# skubanie trawy: zgięcie kości szyi i łba (radiany, oś poprzeczna kości)
GRAZE = {'Horse_Spine_2': 0.8, 'Horse_Neck': -0.8, 'Horse_Neck_1': 0.0, 'Horse_Neck_2': 0.2, 'Horse_Head': 0.6}


def floats(el):
    return np.array(el.text.split(), dtype=np.float64)


def mat(a):
    return np.array(a, dtype=np.float64).reshape(4, 4)


class Dae:
    def __init__(self, path):
        self.root = ET.parse(path).getroot()
        self.byid = {e.get('id'): e for e in self.root.iter() if e.get('id')}

    def src(self, ref):
        s = self.byid[ref.lstrip('#')]
        if s.tag.endswith('vertices'):
            s = self.byid[s.find('c:input', NS).get('source').lstrip('#')]
        arr = s.find('c:float_array', NS)
        if arr is not None:
            stride = int(s.find('.//c:accessor', NS).get('stride', 1))
            return floats(arr).reshape(-1, stride)
        return s.find('c:Name_array', NS).text.split()

    def joints(self):
        """Szkielet z visual_scene: sid → (rodzic sid albo None, macierz lokalna), plus macierz węzła szkieletu"""
        out = {}

        def walk(node, parent, acc):
            m = node.find('c:matrix', NS)
            local = mat(floats(m)) if m is not None else np.eye(4)
            if node.get('type') == 'JOINT':
                out[node.get('sid')] = (parent, local, node.get('id'))
                parent, acc = node.get('sid'), None
            else:
                acc = (acc if acc is not None else np.eye(4)) @ local
                self.armature = acc
            for ch in node.findall('c:node', NS):
                walk(ch, parent, acc)
        self.armature = np.eye(4)
        for n in self.root.find('.//c:visual_scene', NS).findall('c:node', NS):
            if n.find('.//c:node[@type="JOINT"]', NS) is not None or n.get('type') == 'JOINT':
                walk(n, None, None)
        return out

    def mesh(self):
        """Siatka skórowana: wierzchołki (rozdzielone po UV i normalnych), wagi kości, UV, trójkąty"""
        skin = self.root.find('.//c:skin', NS)
        geom = self.byid[skin.get('source').lstrip('#')]
        pl = geom.find('.//c:polylist', NS)
        if pl is None:
            pl = geom.find('.//c:triangles', NS)
        inputs = {i.get('semantic'): (i.get('source'), int(i.get('offset'))) for i in pl.findall('c:input', NS)}
        stride = max(o for _, o in inputs.values()) + 1
        vc = pl.find('c:vcount', NS)
        assert vc is None or set(vc.text.split()) == {'3'}, 'tylko trójkąty'
        p = np.array(pl.find('c:p', NS).text.split(), dtype=np.int64).reshape(-1, stride)
        P = self.src(inputs['VERTEX'][0]); N = self.src(inputs['NORMAL'][0]); T = self.src(inputs['TEXCOORD'][0])
        key = {},
        verts, idx = {}, []
        for row in p:
            k = (row[inputs['VERTEX'][1]], row[inputs['NORMAL'][1]], row[inputs['TEXCOORD'][1]])
            if k not in verts:
                verts[k] = len(verts)
            idx.append(verts[k])
        keys = list(verts)
        vi = np.array([k[0] for k in keys]); ni = np.array([k[1] for k in keys]); ti = np.array([k[2] for k in keys])
        # wagi
        bsm = mat(floats(skin.find('c:bind_shape_matrix', NS)))
        jin = {i.get('semantic'): i.get('source') for i in skin.find('c:joints', NS).findall('c:input', NS)}
        names = self.src(jin['JOINT'])
        ibm = self.src(jin['INV_BIND_MATRIX']).reshape(-1, 4, 4)
        vw = skin.find('c:vertex_weights', NS)
        win = {i.get('semantic'): (i.get('source'), int(i.get('offset'))) for i in vw.findall('c:input', NS)}
        wsrc = self.src(win['WEIGHT'][0]).ravel()
        cnt = np.array(vw.find('c:vcount', NS).text.split(), dtype=np.int64)
        v = np.array(vw.find('c:v', NS).text.split(), dtype=np.int64).reshape(-1, 2)
        weights = []
        at = 0
        for c in cnt:
            ws = [(int(v[at + k, win['JOINT'][1]]), float(wsrc[v[at + k, win['WEIGHT'][1]]])) for k in range(c)]
            s = sum(w for _, w in ws) or 1.0
            weights.append([(j, w / s) for j, w in ws])
            at += c
        return {
            'pos': P[vi][:, :3], 'nrm': N[ni][:, :3], 'uv': T[ti][:, :2], 'idx': np.array(idx).reshape(-1, 3),
            'weights': [weights[i] for i in vi], 'names': names, 'ibm': ibm, 'bsm': bsm,
        }


def clip(path):
    """Ruch z pliku animacji: id węzła → tablica macierzy lokalnych na klatkę"""
    d = Dae(path)
    out = {}
    for ch in d.root.iter('{%s}channel' % NS['c']):
        node = ch.get('target').split('/')[0]
        smp = d.byid[ch.get('source').lstrip('#')]
        outp = [i for i in smp.findall('c:input', NS) if i.get('semantic') == 'OUTPUT'][0].get('source')
        out[node] = d.src(outp).reshape(-1, 4, 4)
    return out


def pose(joints, armature, anim=None, frame=0, extra=None, pin=()):
    """Macierze świata wszystkich kości w danej klatce (extra: sid → dodatkowy obrót lokalny 4×4;
    pin: kości, które zostają w świecie tam, gdzie bez `extra` — np. łopatki, gdy zginamy kręgosłup u nasady szyi)"""
    world = {}
    still = pose(joints, armature, anim, frame) if pin else None

    def get(sid):
        if sid in world:
            return world[sid]
        parent, local, nid = joints[sid]
        if anim is not None and nid in anim:
            a = anim[nid]
            local = a[min(frame, len(a) - 1)]
        if extra and sid in extra:
            local = local @ extra[sid]
        if sid in pin:
            world[sid] = still[sid]
            return still[sid]
        w = (get(parent) if parent else armature) @ local
        world[sid] = w
        return w
    for s in joints:
        get(s)
    return world


def skin(m, world):
    pos = np.zeros_like(m['pos']); nrm = np.zeros_like(m['nrm'])
    mats = np.array([world[n] @ m['ibm'][i] @ m['bsm'] for i, n in enumerate(m['names'])])
    P = np.c_[m['pos'], np.ones(len(m['pos']))]
    for i, ws in enumerate(m['weights']):
        M = sum(w * mats[j] for j, w in ws)
        pos[i] = (M @ P[i])[:3]
        nrm[i] = M[:3, :3] @ m['nrm'][i]
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    return pos, nrm


def smooth(pos, idx):
    """Gładkie normalne: paczka ma normalne płaskie (osobna na każdy róg trójkąta), więc sierść wyglądała jak
    z kanciastych płatów. Uśredniamy normalne ścian (ważone kątem) po wierzchołkach w tym samym miejscu."""
    key = np.round(pos / 1e-4).astype(np.int64)
    _, weld = np.unique(key, axis=0, return_inverse=True)
    weld = weld.ravel()
    acc = np.zeros((weld.max() + 1, 3))
    a, b, c = pos[idx[:, 0]], pos[idx[:, 1]], pos[idx[:, 2]]
    fn = np.cross(b - a, c - a)
    fn /= np.linalg.norm(fn, axis=1, keepdims=True) + 1e-12
    for k, (p0, p1, p2) in enumerate(((a, b, c), (b, c, a), (c, a, b))):
        e1, e2 = p1 - p0, p2 - p0
        ang = np.arccos(np.clip((e1 * e2).sum(1) / (np.linalg.norm(e1, axis=1) * np.linalg.norm(e2, axis=1) + 1e-12), -1, 1))
        np.add.at(acc, weld[idx[:, k]], fn * ang[:, None])
    n = acc[weld]
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


def rot_z(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]])


def rot_x(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[1, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1]])


def main():
    art = sys.argv[1]
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    body_d = Dae(os.path.join(art, 'meshes/skeletal/horse_breed.dae'))
    joints = body_d.joints(); arm = body_d.armature
    parts = {
        'body': [body_d.mesh()],
        'hair': [Dae(os.path.join(art, f'meshes/props/horse/{n}.dae')).mesh() for n in ('hair_mane_01_breed', 'hair_tail_01_breed')],
    }
    anims = {n: clip(os.path.join(art, f'animation/quadraped/horse_breed_{n}.dae')) for n in ('idle_01', 'idle_02', 'idle_04')}
    head = lambda w: w['Horse_Head'][:3, 3]

    # klatki: łeb najniżej (skubanie) i najbardziej w bok (czujny)
    def frames(name):
        a = anims[name]
        return max(len(v) for v in a.values())
    look_f = max(range(frames('idle_02')), key=lambda f: abs(head(pose(joints, arm, anims['idle_02'], f))[0]))
    # ogon w bok: obrót kości ogona wokół osi pionowej kości (w układzie lokalnym; kość biegnie wzdłuż y)
    tail = {s: rot_z(0.22) for s in joints if s.startswith('Horse_Tail')}
    poses = {
        'base': pose(joints, arm, anims['idle_01'], 0),
        'graze': pose(joints, arm, anims['idle_01'], 0, {k: rot_x(a) for k, a in GRAZE.items()}, ('Horse_shoulder_R', 'Horse_shoulder_L')),
        'look': pose(joints, arm, anims['idle_02'], look_f),
    }
    # połowa drogi do skubania: gra przechodzi base → half → graze, żeby szyja po drodze nie skracała się
    # (liniowe przejście między pozami ścina łuk obrotu)
    poses['half'] = pose(joints, arm, anims['idle_01'], 0, {k: rot_x(a / 2) for k, a in GRAZE.items()}, ('Horse_shoulder_R', 'Horse_shoulder_L'))
    poses['swish'] = pose(joints, arm, anims['idle_01'], 0, tail)
    print(f'klatka pozy czujnej: {look_f}')

    # układ gry: z (0 A.D. w górę) → y, łeb (0 A.D. −y) → +z
    def to_game(p):
        return np.c_[-p[:, 0], p[:, 2], -p[:, 1]]

    baked = {}
    for part, meshes in parts.items():
        res = {}
        uv = np.vstack([m['uv'] for m in meshes])
        idx, off = [], 0
        for m in meshes:
            idx.append(m['idx'] + off); off += len(m['pos'])
        for pn, w in poses.items():
            ps, ns = zip(*(skin(m, w) for m in meshes))
            p = to_game(np.vstack(ps))
            res[pn] = (p, smooth(p, np.vstack(idx)) if part == 'body' else to_game(np.vstack(ns)))
        # spawanie: ten sam punkt, UV i normalna we wszystkich pozach = jeden wierzchołek (paczka ma osobny na każdy róg)
        idx = np.vstack(idx)
        sig = np.hstack([np.round(res[pn][0] / 1e-5) for pn in res] + [np.round(res[pn][1] * 1e3) for pn in res] + [np.round(uv[:, :2] * 1e5)])
        _, first, inv = np.unique(sig, axis=0, return_index=True, return_inverse=True)
        res = {pn: (p[first], n[first]) for pn, (p, n) in res.items()}
        baked[part] = (res, uv[first], inv.ravel()[idx])
    # skala i ustawienie: kopyta na 0, środek tułowia w (0, 0), kłąb na WITHERS
    bp = baked['body'][0]['base'][0]
    ground = bp[:, 1].min()
    # kłąb: najwyższy punkt grzbietu między łopatkami (pas nad przednimi nogami)
    zmin, zmax = bp[:, 2].min(), bp[:, 2].max()
    band = bp[(bp[:, 2] > zmin + (zmax - zmin) * 0.5) & (bp[:, 2] < zmin + (zmax - zmin) * 0.65)]
    scale = WITHERS / (band[:, 1].max() - ground)
    cz = (zmin + zmax) / 2
    shift = np.array([0.0, -ground, -cz])
    out = {'withers': WITHERS, 'credit': '0 A.D. (Wildfire Games), CC BY-SA 3.0'}
    e = lambda b: base64.b64encode(b).decode()
    q8 = lambda n: e(np.clip(np.round(n * 127), -127, 127).astype(np.int8).tobytes())
    for part, (res, uv, idx) in baked.items():
        bpos, bnrm = res['base']
        bpos = (bpos + shift) * scale
        assert len(bpos) < 65536
        o = {'pos': e(bpos.astype('<f4').tobytes()), 'nrm': q8(bnrm),
             'uv': e(uv[:, :2].astype('<f4').tobytes()),
             'idx': e(idx.astype('<u2').tobytes()), 'morph': {}}
        for pn in MORPHS:
            p, n = res[pn]
            o['morph'][pn] = {'pos': e((((p + shift) * scale) - bpos).astype('<f4').tobytes()), 'nrm': q8(n - bnrm)}
        out[part] = o
        print(f'{part}: {len(bpos)} wierzchołków, {len(idx)} trójkątów')
    l = (bp[:, 2].max() - bp[:, 2].min()) * scale
    print(f'długość {l:.3f} pola, kłąb {WITHERS}, łeb w pozie base na {(baked["body"][0]["base"][0][:, 1].max() - ground) * scale:.3f}')
    with open(OUT, 'w') as f:
        json.dump(out, f, separators=(',', ':'))

    # tekstury: sierść (kolor + normalne z paczki), grzywa i ogon (kolor + maska)
    from PIL import Image
    tx = os.path.join(art, 'textures/skins')
    coat = Image.open(os.path.join(tx, f'skeletal/{COAT}.png')).convert('RGB')
    coat.save(os.path.join(TEX, 'horse_coat.jpg'), quality=92)
    Image.open(os.path.join(tx, 'skeletal/horse_norm.png')).convert('RGB').save(os.path.join(TEX, 'horse_coat_n.jpg'), quality=92)
    hair = Image.open(os.path.join(tx, f'props/horse/{HAIR}.png')).convert('RGBA')
    hair.convert('RGB').save(os.path.join(TEX, 'horse_hair.jpg'), quality=92)
    hair.getchannel('A').convert('RGB').save(os.path.join(TEX, 'horse_hair_a.jpg'), quality=95)

    if preview:
        render_preview(out, preview)


def render_preview(out, path):
    """Szybki podgląd w Blenderze (bpy): wszystkie pozy obok siebie, z teksturami"""
    import subprocess
    py = os.environ.get('BPY', '/tmp/bpyenv/bin/python')
    subprocess.run([py, os.path.join(HERE, 'horse_preview.py'), OUT, TEX, path], check=True)


if __name__ == '__main__':
    main()
