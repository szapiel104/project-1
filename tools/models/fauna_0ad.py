"""Dzikie zwierzęta z gry 0 A.D. (Wildfire Games, CC BY-SA 3.0): wielbłąd (pustynia) i jeleń (zielone krainy) —
modele zrobione przez grafików, przeniesione bez odchudzania tym samym sposobem co koń (horse_0ad.py: COLLADA czytana
tutaj, skórowanie szkieletu w numpy, pozy wypieczone jako morph targets).

    python3 tools/models/fauna_0ad.py <katalog 0 A.D.: binaries/data/mods/public/art>

Pozy (morph targets, różnice względem pozy stojącej):
  walk0..walk9 — dziesięć klatek chodu z animacji „walk” (gra przechodzi płynnie z klatki na klatkę, osobno każde zwierzę),
  graze        — łeb przy ziemi (klatka animacji spoczynkowej z łbem najniżej).
Wynik: src/render/models/fauna_<id>.json (body: pos, nrm, uv, idx, morph) i public/textures/cc0/fauna_<id>.jpg.
Układ gry: y w górę, łeb w +z, kopyta na y = 0, środek tułowia w (0, 0); `height` = wysokość w kłębie w polach.
"""
import base64
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from horse_0ad import Dae, clip, pose, skin, smooth  # noqa: E402

ROOT = os.path.join(HERE, '..', '..')
TEX = os.path.join(ROOT, 'public', 'textures', 'cc0')
WALK = 10

ANIMALS = {
    # wielbłąd jednogarbny: ok. 1,9 m w kłębie (0,36 pola na metr)
    'camel': {'mesh': 'camel.dae', 'idle': 'camel_idle_01', 'graze': 'camel_idle_01', 'walk': 'camel_walk', 'tex': 'animal_camel_b', 'height': 0.68},
    # jeleń: ok. 1,1 m w kłębie
    'deer': {'mesh': 'deer_mesh.dae', 'idle': 'deer_idle_01', 'graze': 'deer_idle_04', 'walk': 'deer_walk_01', 'tex': 'animal_deer_02', 'height': 0.4},
}


def frames(anim):
    return max(len(v) for v in anim.values())


def to_game(p):
    return np.c_[p[:, 0], p[:, 2], -p[:, 1]]


def build(art, aid, cfg):
    d = Dae(os.path.join(art, 'meshes/skeletal', cfg['mesh']))
    joints = d.joints(); arm = d.armature
    m = d.mesh()
    idle = clip(os.path.join(art, 'animation/quadraped', cfg['idle'] + '.dae'))
    walk = clip(os.path.join(art, 'animation/quadraped', cfg['walk'] + '.dae'))
    gra = clip(os.path.join(art, 'animation/quadraped', cfg['graze'] + '.dae'))
    base_p, base_n = skin(m, pose(joints, arm, idle, 0))
    bp = to_game(base_p)
    # kierunek łba: przód to strona osi z, po której jest wyżej (łeb na szyi) — gdyby model patrzył w −z, obracamy o 180°
    zmin, zmax = bp[:, 2].min(), bp[:, 2].max()
    front = bp[bp[:, 2] > zmax - (zmax - zmin) * 0.15][:, 1].max()
    back = bp[bp[:, 2] < zmin + (zmax - zmin) * 0.15][:, 1].max()
    flip = back > front
    fix = (lambda p: np.c_[-p[:, 0], p[:, 1], -p[:, 2]]) if flip else (lambda p: p)
    print(f'{aid}: {"obrócony o 180°" if flip else "łeb w +z"}')
    # klatka z łbem najniżej (skubanie)
    def head_y(f):
        p = fix(to_game(skin(m, pose(joints, arm, gra, f))[0]))
        z0, z1 = p[:, 2].min(), p[:, 2].max()
        return p[p[:, 2] > z1 - (z1 - z0) * 0.12][:, 1].min()
    nf = frames(gra)
    gf = min(range(0, nf, max(1, nf // 24)), key=head_y)
    nw = frames(walk)
    poses = {'base': pose(joints, arm, idle, 0)}
    for k in range(WALK):
        poses[f'walk{k}'] = pose(joints, arm, walk, int(round(k * nw / WALK)) % nw)
    poses['graze'] = pose(joints, arm, gra, gf)
    res = {}
    for pn, w in poses.items():
        p, _ = skin(m, w)
        p = fix(to_game(p))
        res[pn] = (p, smooth(p, m['idx']))
    idx = m['idx']; uv = m['uv']
    sig = np.hstack([np.round(res[pn][0] / 1e-5) for pn in res] + [np.round(uv[:, :2] * 1e5)])
    _, first, inv = np.unique(sig, axis=0, return_index=True, return_inverse=True)
    res = {pn: (p[first], n[first]) for pn, (p, n) in res.items()}
    idx = inv.ravel()[idx]
    uv = uv[first]
    bp = res['base'][0]
    ground = bp[:, 1].min()
    zmin, zmax = bp[:, 2].min(), bp[:, 2].max()
    band = bp[(bp[:, 2] > zmin + (zmax - zmin) * 0.45) & (bp[:, 2] < zmin + (zmax - zmin) * 0.65)]
    scale = cfg['height'] / (band[:, 1].max() - ground)
    shift = np.array([-(bp[:, 0].min() + bp[:, 0].max()) / 2, -ground, -(zmin + zmax) / 2])
    e = lambda b: base64.b64encode(b).decode()
    q8 = lambda n: e(np.clip(np.round(n * 127), -127, 127).astype(np.int8).tobytes())
    bpos, bnrm = res['base']
    bpos = (bpos + shift) * scale
    assert len(bpos) < 65536
    body = {'pos': e(bpos.astype('<f4').tobytes()), 'nrm': q8(bnrm), 'uv': e(uv[:, :2].astype('<f4').tobytes()),
            'idx': e(idx.astype('<u2').tobytes()), 'morph': {}}
    for pn in [f'walk{k}' for k in range(WALK)] + ['graze']:
        p, n = res[pn]
        body['morph'][pn] = {'pos': e((((p + shift) * scale) - bpos).astype('<f4').tobytes()), 'nrm': q8(n - bnrm)}
    out = {'height': cfg['height'], 'length': float((zmax - zmin) * scale), 'credit': '0 A.D. (Wildfire Games), CC BY-SA 3.0', 'body': body}
    with open(os.path.join(ROOT, 'src', 'render', 'models', f'fauna_{aid}.json'), 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'{aid}: {len(bpos)} wierzchołków, {len(idx)} trójkątów, długość {out["length"]:.2f} pola, klatka skubania {gf}/{nf}, chód {nw} klatek')
    from PIL import Image
    im = Image.open(os.path.join(art, 'textures/skins/skeletal', cfg['tex'] + '.png')).convert('RGB')
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    im.save(os.path.join(TEX, f'fauna_{aid}.jpg'), quality=95)


if __name__ == '__main__':
    art = sys.argv[1]
    for aid, cfg in ANIMALS.items():
        build(art, aid, cfg)
