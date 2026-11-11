"""Dzikie zwierzęta z gry 0 A.D. (Wildfire Games, CC BY-SA 3.0): wielbłąd (pustynia) i jeleń (zielone krainy) —
modele zrobione przez grafików, przeniesione bez odchudzania tym samym sposobem co koń (horse_0ad.py: COLLADA czytana
tutaj, skórowanie szkieletu w numpy, pozy wypieczone jako morph targets).

    python3 tools/models/fauna_0ad.py <katalog 0 A.D.: binaries/data/mods/public/art>

Pozy (morph targets, różnice względem pozy stojącej):
  walk0..walk9 — dziesięć klatek chodu z animacji „walk” (gra przechodzi płynnie z klatki na klatkę, osobno każde zwierzę),
  idle0..idle7 — osiem klatek ruchu spoczynkowego (łeb, uszy, ogon),
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
IDLE = 8     # klatki ruchu spoczynkowego (łeb, uszy, ogon) — gra zapętla je, gdy zwierzę stoi

ANIMALS = {
    # wielbłąd jednogarbny: ok. 1,9 m w kłębie (0,36 pola na metr)
    'camel': {'mesh': 'camel.dae', 'idle': 'camel_idle_01', 'graze': 'camel_idle_01', 'walk': 'camel_walk', 'tex': 'animal_camel_b', 'height': 0.68, 'subdiv': 0},   # 2,3 tys. trójkątów — dość gęsty
    # jeleń: ok. 1,1 m w kłębie
    'deer': {'mesh': 'deer_mesh.dae', 'idle': 'deer_idle_01', 'graze': 'deer_idle_04', 'walk': 'deer_walk_01', 'tex': 'animal_deer_02', 'height': 0.4},
    # zwierzęta w osadzie (Michał 11.11.2026: „kura, pies, świnia wyglądają tragicznie”); `graze` = druga poza:
    # świnia ryje (feeding), kura dziobie (idle_02), pies siedzi (idle_sit)
    'pig': {'mesh': 'pig.dae', 'idle': 'animal_pig_idle_01', 'graze': 'animal_pig_feeding_01', 'walk': 'animal_pig_walk_01', 'tex': 'animal_pig_01', 'height': 0.27},
    'hen': {'mesh': 'chicken.dae', 'idle': 'chicken_idle_01', 'graze': 'chicken_idle_02', 'walk': 'chicken_walk', 'tex': 'animal_chicken.dds', 'height': 0.1, 'up': 4},
    'dog': {'mesh': 'wolfhound.dae', 'idle': 'wolfhound_idle1', 'graze': 'wolfhound_idle_sit', 'walk': 'wolfhound_walk', 'tex': 'brit/wolfhound', 'height': 0.27},
}


def frames(anim):
    return max(len(v) for v in anim.values())


def to_game(p):
    return np.c_[p[:, 0], p[:, 2], -p[:, 1]]


def loop_subdivide(res, idx, uv):
    """Jeden poziom wygładzenia Loopa (Michał 11.11.2026: „z bliska mają być piękne”): siatki z paczki to kilkaset trójkątów,
    po podziale sylwetka jest okrągła zamiast kanciastej. Nic nie jest obcinane — każdy trójkąt dzieli się na cztery,
    wierzchołki przesuwają się wagami Loopa liczonymi raz na topologii (spawanej po położeniu, więc szwy UV się nie
    rozchodzą), te same wagi dla każdej klatki animacji. UV nowych wierzchołków: średnia z końców krawędzi."""
    import scipy.sparse as sp
    base = res['base'][0]
    key = np.round(np.hstack([res[pn][0] for pn in res]) / 1e-6).astype(np.int64)
    _, weld = np.unique(key, axis=0, return_inverse=True)
    weld = weld.ravel(); W = weld.max() + 1
    tw = weld[idx]
    # krawędzie spawanej siatki i ich przeciwległe wierzchołki
    opp = {}
    for t in tw:
        for k in range(3):
            a, b, c = t[k], t[(k + 1) % 3], t[(k + 2) % 3]
            if a == b or b == c or a == c:
                continue
            opp.setdefault((min(a, b), max(a, b)), []).append(c)
    nb = [set() for _ in range(W)]
    bnd = [set() for _ in range(W)]
    for (a, b), cs in opp.items():
        nb[a].add(b); nb[b].add(a)
        if len(cs) == 1:
            bnd[a].add(b); bnd[b].add(a)
    rows, cols, vals = [], [], []
    def even_row(r, v):
        if len(bnd[v]) == 2:
            rows.extend([r, r, r]); cols.extend([v, *bnd[v]]); vals.extend([0.75, 0.125, 0.125]); return
        n = len(nb[v])
        if n < 3:
            rows.append(r); cols.append(v); vals.append(1.0); return
        beta = 3 / (8 * n) if n > 3 else 3 / 16
        rows.append(r); cols.append(v); vals.append(1 - n * beta)
        for u in nb[v]:
            rows.append(r); cols.append(u); vals.append(beta)
    def odd_row(r, a, b):
        cs = opp.get((min(a, b), max(a, b)), [])
        if len(cs) == 2:
            rows.extend([r] * 4); cols.extend([a, b, cs[0], cs[1]]); vals.extend([0.375, 0.375, 0.125, 0.125])
        else:
            rows.extend([r, r]); cols.extend([a, b]); vals.extend([0.5, 0.5])
    nv = len(weld)
    for v in range(nv):
        even_row(v, weld[v])
    mid = {}
    new_uv = [uv[:, :2]]
    tris = []
    def edge_v(a, b):
        k = (min(a, b), max(a, b))
        if k not in mid:
            r = nv + len(mid)
            mid[k] = r
            odd_row(r, weld[a], weld[b])
            new_uv.append(((uv[a, :2] + uv[b, :2]) / 2)[None])
        return mid[k]
    for a, b, c in idx:
        ab, bc, ca = edge_v(a, b), edge_v(b, c), edge_v(c, a)
        tris += [(a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)]
    S = sp.csr_matrix((vals, (rows, cols)), shape=(nv + len(mid), W))
    first = np.zeros(W, dtype=np.int64); first[weld] = np.arange(nv)
    out_idx = np.array(tris, dtype=np.int64)
    out = {}
    for pn, (p, _) in res.items():
        q = S @ p[first]
        out[pn] = (q, smooth(q, out_idx))
    return out, out_idx, np.vstack(new_uv)


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
    ni = frames(idle)
    for k in range(IDLE):
        poses[f'idle{k}'] = pose(joints, arm, idle, int(round(k * ni / IDLE)) % ni)
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
    if cfg.get('subdiv', 1):
        res, idx, uv = loop_subdivide(res, idx, uv)
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
    for pn in [f'walk{k}' for k in range(WALK)] + [f'idle{k}' for k in range(IDLE)] + ['graze']:
        p, n = res[pn]
        body['morph'][pn] = {'pos': e((((p + shift) * scale) - bpos).astype('<f4').tobytes()), 'nrm': q8(n - bnrm)}
    out = {'height': cfg['height'], 'length': float((zmax - zmin) * scale), 'credit': '0 A.D. (Wildfire Games), CC BY-SA 3.0', 'body': body}
    with open(os.path.join(ROOT, 'src', 'render', 'models', f'fauna_{aid}.json'), 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'{aid}: {len(bpos)} wierzchołków, {len(idx)} trójkątów, długość {out["length"]:.2f} pola, klatka skubania {gf}/{nf}, chód {nw} klatek')
    from PIL import Image
    tn = cfg['tex'] if '.' in cfg['tex'] else cfg['tex'] + '.png'
    im = Image.open(os.path.join(art, 'textures/skins/skeletal', tn)).convert('RGB')
    up = cfg.get('up', 2)      # mała tekstura z paczki (kura: 64 px) powiększona, żeby z bliska nie było pikseli
    im = im.resize((im.width * up, im.height * up), Image.LANCZOS)
    im.save(os.path.join(TEX, f'fauna_{aid}.jpg'), quality=95)


if __name__ == '__main__':
    art = sys.argv[1]
    only = sys.argv[2:]
    for aid, cfg in ANIMALS.items():
        if not only or aid in only:
            build(art, aid, cfg)
