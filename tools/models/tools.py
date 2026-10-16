"""Broń i narzędzia chłopa: kilof i maczuga — w dłoni (układ ręki) i schowane na ciele (układ postaci).

Uruchomienie (z katalogu repo):  python tools/models/tools.py   →  src/render/models/tools.json
Grupy w pliku: 'pick', 'club' (w dłoni), 'backPick' (kilof płasko na plecach), 'beltClub' (maczuga za sznurem u biodra).
Każda grupa ma siatki 'wood' i 'iron'; gra kładzie na drewno teksturę, żelazo zostaje metaliczne.

Układ ręki (jak w peasant.py): początek w barku, dłoń 0,19 niżej (y = -0,19), stylisko wychodzi z pięści w przód (+z).
Układ postaci: stopy w (0, 0, 0), twarz w +z; tułów ma ok. 0,1 promienia w barkach i 0,074 w głąb (tunika),
sznur w pasie na wysokości 0,3, dół tuniki ok. 0,12 promienia na wysokości 0,16.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

b = Building()
GRIP = Vector((0.0, -0.19, 0.0))


def tube(path, radii, seg=8, caps=True):
    """Bryła toczona wzdłuż łamanej `path` (punkty) o promieniach `radii`; zwraca listę wielokątów"""
    polys = []
    rings = []
    for i, p in enumerate(path):
        p = Vector(p)
        d = (Vector(path[min(i + 1, len(path) - 1)]) - Vector(path[max(i - 1, 0)])).normalized()
        up = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
        u = d.cross(up).normalized()
        v = d.cross(u).normalized()
        r = radii[i]
        rings.append([p + (u * math.cos(2 * math.pi * k / seg) + v * math.sin(2 * math.pi * k / seg)) * r for k in range(seg)])
    for i in range(len(rings) - 1):
        c = (Vector(path[i]) + Vector(path[i + 1])) / 2
        for k in range(seg):
            k2 = (k + 1) % seg
            polys.append(([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]], c))
    if caps:
        a, z = Vector(path[0]), Vector(path[-1])
        polys.append((list(rings[0]), a + (a - z).normalized() * -1))
        polys.append((list(rings[-1]), z + (z - a).normalized() * -1))
    return polys


def box(cx, cy, cz, w, h, d):
    x0, x1, y0, y1, z0, z1 = cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, cz - d / 2, cz + d / 2
    v = [Vector(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    c = Vector((cx, cy, cz))
    f = [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (3, 2, 6, 7), (0, 3, 7, 4), (1, 2, 6, 5)]
    return [([v[i] for i in q], c) for q in f]


def spike(base, tip, r, seg=6):
    """Szpic: od podstawy o promieniu r do ostrza"""
    base, tip = Vector(base), Vector(tip)
    d = (tip - base).normalized()
    up = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 1, 0))
    u = d.cross(up).normalized(); v = d.cross(u).normalized()
    ring = [base + (u * math.cos(2 * math.pi * k / seg) + v * math.sin(2 * math.pi * k / seg)) * r for k in range(seg)]
    c = base + (tip - base) * 0.3
    return [([ring[k], ring[(k + 1) % seg], tip], c) for k in range(seg)] + [(list(ring), base + (base - tip))]


# ---------------- kształty w układzie ręki ----------------
def pick_parts():
    g = GRIP
    haft = tube([g + Vector((0, 0, -0.05)), g + Vector((0, 0, 0.12)), g + Vector((0, 0, 0.36))], [0.013, 0.014, 0.017], seg=8)
    head = Vector((0, -0.19, 0.375))
    iron = box(head.x, head.y, head.z, 0.03, 0.05, 0.04)   # oko grotu nasadzone na stylisko
    # dwa ramiona grotu, lekko wygięte do przodu (w stronę uderzenia)
    for s in (1, -1):
        mid = head + Vector((0, s * 0.07, 0.012))
        iron += tube([head + Vector((0, s * 0.02, 0)), mid], [0.016, 0.013], seg=6, caps=False)
        iron += spike(mid, head + Vector((0, s * (0.15 if s > 0 else 0.12), 0.04)), 0.013)
    wood = haft + box(g.x, g.y, g.z + 0.355, 0.026, 0.026, 0.02)  # klin w oku
    return wood, iron


def club_parts():
    g = GRIP
    haft = tube([g + Vector((0, 0, -0.04)), g + Vector((0, 0, 0.1)), g + Vector((0, 0, 0.2))], [0.015, 0.016, 0.02], seg=8)
    # sękata głowica: zgrubienie z kilkoma sękami
    head = tube([g + Vector((0, 0, 0.19)), g + Vector((0, 0, 0.25)), g + Vector((0, 0.003, 0.31)), g + Vector((0, 0.002, 0.355))],
                [0.022, 0.04, 0.044, 0.026], seg=9)
    for ang, z in ((0.3, 0.27), (2.4, 0.3), (4.2, 0.25), (5.4, 0.33)):
        base = g + Vector((math.cos(ang) * 0.038, math.sin(ang) * 0.038, z))
        head += spike(base, base + Vector((math.cos(ang) * 0.02, math.sin(ang) * 0.02, 0.004)), 0.011, seg=5)
    # skórzany rzemień na dole styliska i żelazne ćwieki w głowicy
    iron = []
    for ang, z in ((1.2, 0.29), (3.4, 0.27), (5.0, 0.31)):
        p = g + Vector((math.cos(ang) * 0.043, math.sin(ang) * 0.043, z))
        iron += box(p.x, p.y, p.z, 0.012, 0.012, 0.012)
    return haft + head, iron


def add(group, parts, M=None):
    wood, iron = parts
    for mat, polys in (('wood', wood), ('iron', iron)):
        for pts, inside in polys:
            if M is not None:
                pts = [M @ Vector(p) for p in pts]
                inside = M @ Vector(inside)
            b.poly(group, mat, [tuple(p) for p in pts], away=tuple(inside))


add('pick', pick_parts())
# maczuga krótsza i lżejsza niż kilof: cała bryła zmniejszona wokół chwytu
CLUB = Matrix.Translation(GRIP) @ Matrix.Scale(0.66, 4) @ Matrix.Translation(-GRIP)
add('club', club_parts(), CLUB)

# ---------------- schowane na ciele (układ postaci) ----------------
def place(origin, z_axis, y_axis):
    """Macierz: początek układu ręki → `origin`, oś styliska (+z) → `z_axis`, oś grotu (+y) → `y_axis` (prostopadle)"""
    zf = Vector(z_axis).normalized()
    yf = (Vector(y_axis) - zf * Vector(y_axis).dot(zf)).normalized()
    xf = yf.cross(zf)
    R = Matrix(((xf.x, yf.x, zf.x, 0), (xf.y, yf.y, zf.y, 0), (xf.z, yf.z, zf.z, 0), (0, 0, 0, 1)))
    # punkt chwytu (dłoń) ma trafić w origin
    return Matrix.Translation(Vector(origin)) @ R @ Matrix.Translation(-GRIP)

# kilof na plecach: stylisko skośnie od prawego biodra do lewego barku, grot płasko przy plecach za lewym barkiem
backM = place((0.11, 0.155, -0.106), (-0.5, 0.866, 0.04), (0.866, 0.5, 0.0))
add('backPick', pick_parts(), backM)
# maczuga za sznurem u prawego biodra: rękojeść w górze przy pasie, głowica w dół i lekko na zewnątrz od tuniki
beltM = place((0.108, 0.37, 0.0), (0.22, -1.0, 0.0), (0.0, 0.0, 1.0))
add('beltClub', club_parts(), beltM @ CLUB)

# ---------------- siekiera, młotek (układ ręki), pochodnia, wiadro, wędka (układ postaci) ----------------
def wedge(x, ytop, ybot, zc, dtop, dbot, ttop, tbot, zoff=0.0):
    """Zamknięta bryła o 8 wierzchołkach: u góry (ytop) głębokość dtop i grubość ttop, u dołu dbot i tbot (np. ostrze)"""
    v = []
    for y, d, t, zo in ((ytop, dtop, ttop, 0.0), (ybot, dbot, tbot, zoff)):
        v += [Vector((x - t / 2, y, zc + zo - d / 2)), Vector((x + t / 2, y, zc + zo - d / 2)),
              Vector((x + t / 2, y, zc + zo + d / 2)), Vector((x - t / 2, y, zc + zo + d / 2))]
    c = Vector((x, (ytop + ybot) / 2, zc + zoff / 2))
    f = [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return [([v[i] for i in q], c) for q in f]


def axe_parts(far=False):
    g = GRIP
    seg = 4 if far else 8
    wood = tube([g + Vector((0, 0, -0.05)), g + Vector((0, 0, 0.15)), g + Vector((0, 0, 0.39))], [0.013, 0.014, 0.016], seg=seg)
    # żeleźce: oko na stylisku i ostrze rozszerzające się w dół (krawędź tnąca wysunięta do przodu)
    iron = box(0, -0.19, 0.37, 0.03, 0.035, 0.045)
    iron += wedge(0, -0.2, -0.29, 0.36, 0.045, 0.085, 0.022, 0.006, zoff=0.01)
    if not far:
        iron += box(0, -0.19, 0.398, 0.034, 0.02, 0.012)   # obuch z tyłu oka
    return wood, iron


def hammer_parts(far=False):
    g = GRIP
    seg = 4 if far else 8
    wood = tube([g + Vector((0, 0, -0.03)), g + Vector((0, 0, 0.12)), g + Vector((0, 0, 0.25))], [0.014, 0.015, 0.017], seg=seg)
    iron = box(0, -0.19, 0.25, 0.05, 0.1, 0.05)
    if not far:
        iron += box(0, -0.245, 0.25, 0.058, 0.014, 0.058)   # twarz uderzająca (szersza)
        iron += box(0, -0.13, 0.25, 0.04, 0.025, 0.04)      # klin z drugiej strony
    return wood, iron


TORCH_ARM = -0.55   # ręka z pochodnią uniesiona w przód (scene.ts: TORCH_ARM); pochodnia wtedy stoi pionowo
TORCH_DIR = Vector((0, math.cos(-TORCH_ARM), math.sin(-TORCH_ARM)))


def torch_parts(far=False):
    """Pochodnia w dłoni (układ ręki): kij z pięści skośnie w górę i w przód, przy ręce uniesionej o TORCH_ARM pionowo"""
    seg = 4 if far else 7
    g, d = GRIP, TORCH_DIR
    wood = tube([g - d * 0.03, g + d * 0.1, g + d * 0.25], [0.018, 0.02, 0.022], seg=seg)
    # głowica z nasączonych szmat (płomień dokłada gra nad końcem: g + d * 0.33)
    iron = tube([g + d * 0.24, g + d * 0.275, g + d * 0.32], [0.024, 0.031, 0.026], seg=seg)
    return wood, iron


def ring_polys(cx, cz, y0, y1, r_in, r_out, seg):
    """Zamknięty pierścień (obręcz, ścianka wiadra): ściany zewnętrzna, wewnętrzna, góra, dół"""
    polys = []
    pt = lambda r, y, k: Vector((cx + math.cos(2 * math.pi * k / seg) * r, y, cz + math.sin(2 * math.pi * k / seg) * r))
    for k in range(seg):
        k2 = (k + 1) % seg
        mid_out = Vector((cx, (y0 + y1) / 2, cz))
        o = [pt(r_out[0], y0, k), pt(r_out[0], y0, k2), pt(r_out[1], y1, k2), pt(r_out[1], y1, k)]
        i = [pt(r_in[0], y0, k), pt(r_in[0], y0, k2), pt(r_in[1], y1, k2), pt(r_in[1], y1, k)]
        polys.append((o, mid_out))                                   # zewnątrz: odwrócone od osi
        dirk = (o[0] + o[1]) / 2 - mid_out
        polys.append((i, (i[0] + i[1]) / 2 + dirk.normalized() * 0.5))  # wewnątrz: patrzy do osi
        polys.append(([o[3], o[2], i[2], i[3]], Vector((cx, y1 - 1, cz)) + dirk * 0))
        polys.append(([o[0], o[1], i[1], i[0]], Vector((cx, y0 + 1, cz))))
    return polys


def disc(cx, cz, y0, y1, r, seg):
    """Zamknięty płaski walec (dno, tafla wody)"""
    return tube([(cx, y0, cz), (cx, y1, cz)], [r, r], seg=seg)


# wiadro wisi z dłoni opuszczonej ręki (dłoń ok. 0,26 nad ziemią): kabłąk w dłoni, wiadro pod nią
BX, BZ = 0.15, 0.02
BY0, BY1 = 0.1, 0.195


def bucket_parts(far=False):
    seg = 8 if far else 12
    wood = ring_polys(BX, BZ, BY0, BY1, (0.047, 0.062), (0.055, 0.07), seg)
    wood += disc(BX, BZ, BY0, BY0 + 0.01, 0.05, seg)
    iron = []
    if not far:
        for y, r in ((BY0 + 0.01, 0.058), (BY1 - 0.015, 0.069)):
            iron += ring_polys(BX, BZ, y - 0.006, y + 0.006, (r - 0.004, r - 0.004), (r + 0.004, r + 0.004), seg)
    # kabłąk: półkole nad wiadrem
    arc = [(BX + math.cos(a) * 0.068, BY1 + math.sin(a) * 0.065, BZ) for a in [math.pi * k / (4 if far else 8) for k in range((4 if far else 8) + 1)]]
    iron += tube(arc, [0.005] * len(arc), seg=4)
    return wood, iron


def water_parts(far=False):
    return [], disc(BX, BZ, BY1 - 0.024, BY1 - 0.019, 0.06, 8 if far else 12)


def rod_parts(far=False):
    seg = 4 if far else 6
    base, tip = Vector((0.12, 0.446, 0.123)), Vector((0.12, 0.994, 1.077))
    wood = tube([base, base + (tip - base) * 0.5, tip], [0.02, 0.016, 0.011], seg=seg)
    iron = tube([tip, Vector((0.12, 0.27, 1.077))], [0.0035, 0.0035], seg=3)            # żyłka
    if not far:
        iron += tube([(0.12, 0.27, 1.077), (0.12, 0.24, 1.077), (0.12, 0.21, 1.077)], [0.012, 0.03, 0.01], seg=6)  # spławik
    return wood, iron


for name, fn in (('axe', axe_parts), ('hammer', hammer_parts), ('torch', torch_parts), ('bucket', bucket_parts),
                 ('bucketWater', water_parts), ('rod', rod_parts)):
    add(name, fn())
    add(name + 'Far', fn(True))

# wersje z daleka kilofa i maczugi: te same kształty z mniejszej liczby ścian (stylisko czworokątne, bez sęków)
def pick_far():
    g = GRIP
    haft = tube([g + Vector((0, 0, -0.05)), g + Vector((0, 0, 0.36))], [0.013, 0.017], seg=4)
    head = Vector((0, -0.19, 0.375))
    iron = box(head.x, head.y, head.z, 0.03, 0.05, 0.04)
    for sx in (1, -1):
        iron += spike(head + Vector((0, sx * 0.02, 0)), head + Vector((0, sx * (0.15 if sx > 0 else 0.12), 0.04)), 0.015, seg=4)
    return haft, iron


def club_far():
    g = GRIP
    return tube([g + Vector((0, 0, -0.04)), g + Vector((0, 0, 0.2)), g + Vector((0, 0, 0.28)), g + Vector((0, 0, 0.355))], [0.015, 0.02, 0.042, 0.026], seg=5), []


add('pickFar', pick_far())
add('clubFar', club_far(), CLUB)
add('backPickFar', pick_far(), backM)
add('beltClubFar', club_far(), beltM @ CLUB)

b.save('tools', maxe=0.5, rays=8, reach=0.05, grime=False, extra={'grip': list(GRIP)})
