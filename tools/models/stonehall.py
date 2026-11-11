"""Wspólne klocki kamiennych budynków wojskowych (zbrojownia, koszary) — w duchu murów obronnych gry:
mur z łupanego kamienia (ten sam materiał 'castle' co mur kamienny i wieże), narożniki z dużych ciosów, płaski dach
z kamiennych płyt na belkach (grupa 'shell' — gra zdejmuje go przy podglądzie wnętrza), przedpiersie z blankami
na wysokości korony muru (STONE_WALL_TOP = 1,14), kamienne schody przy boku na dach, łukowe wejście z okutymi wrotami.

Michał 10.11.2026: „mur, ta jakość, dostawić do muru i łączyło się z murem, schody do wejścia, szczegółowe wnętrze,
prawdziwy kamień” — na wzór dawnych gier o zamkach, ale własny układ (nie kopia).
"""
import math

TOP = 1.14          # korona muru kamiennego w grze = poziom dachu
PAR = 0.2           # wysokość przedpiersia nad dachem (do wcięć blank)
WALL = 0.1          # grubość muru budynku


def walls(t, x0, x1, z0, z1, y0, y1, holes):
    """Cztery ściany z łupanego kamienia; holes = {'front': [...], 'back': [...], 'left': [...], 'right': [...]}"""
    T = t.T
    t.wall_x('base', 'castle', z1 - T / 2, x0, x1, y0, y1, holes.get('front', []))
    t.wall_x('base', 'castle', z0 + T / 2, x0, x1, y0, y1, holes.get('back', []))
    t.wall_z('base', 'castle', x0 + T / 2, z0 + T, z1 - T, y0, y1, holes.get('left', []))
    t.wall_z('base', 'castle', x1 - T / 2, z0 + T, z1 - T, y0, y1, holes.get('right', []))


def plinth(b, x0, x1, z0, z1, h=0.12):
    """Cokół z ciemniejszego kamienia, wystający kilka cm z lica (od spodu otwarty — stoi na ziemi)"""
    b.box('base', 'castleDark', x1 - x0 + 0.08, h, z1 - z0 + 0.08, (x0 + x1) / 2, 0.0, (z0 + z1) / 2, bottom=False)


def quoins(b, x0, x1, z0, z1, y0, y1):
    """Narożniki z dużych, jaśniejszych ciosów na przemian długich i krótkich — wystają 1,5 cm z lica"""
    n = max(3, int((y1 - y0) / 0.21))
    hh = (y1 - y0) / n
    for x in (x0, x1):
        for z in (z0, z1):
            for k in range(n):
                big = k % 2 == 0
                w, d = (0.15, 0.1) if big else (0.1, 0.15)
                b.box('base', 'castleDark', w, hh - 0.012, d, x - math.copysign(w / 2 - 0.008, x - (x0 + x1) / 2), y0 + k * hh + 0.006,
                      z - math.copysign(d / 2 - 0.008, z - (z0 + z1) / 2))


PARAPET_GROUP = {'front': 'parF', 'back': 'parB', 'left': 'parL', 'right': 'parR'}


def parapet(b, x0, x1, z0, z1, y, skip=None, step=0.27, split=False):
    """Przedpiersie z blankami na koronie ścian (zostaje, gdy dach zdjęty). skip = bok bez przedpiersia (np. przy schodach
    zostaje przerwa na wejście): ('right', z_od, z_do)"""
    W = WALL
    sides = [
        ('front', x0, z1 - W / 2, x1, z1 - W / 2),
        ('back', x0, z0 + W / 2, x1, z0 + W / 2),
        ('left', x0 + W / 2, z0 + W, x0 + W / 2, z1 - W),
        ('right', x1 - W / 2, z0 + W, x1 - W / 2, z1 - W),
    ]
    for name, ax, az, bx, bz in sides:
        parts = [(ax, az, bx, bz)]
        if skip and skip[0] == name:
            # przerwa w przedpiersiu (wejście ze schodów na dach)
            if ax == bx:
                parts = [(ax, az, ax, skip[1]), (ax, skip[2], ax, bz)]
            else:
                parts = [(ax, az, skip[1], az), (skip[2], az, bx, bz)]
        # split: każdy bok w swojej grupie ('parF'…), gra chowa bok, do którego dochodzi mur obronny (walls.ts)
        grp = PARAPET_GROUP[name] if split else 'base'
        for px0, pz0, px1, pz1 in parts:
            L = math.hypot(px1 - px0, pz1 - pz0)
            if L < 0.06:
                continue
            cx, cz = (px0 + px1) / 2, (pz0 + pz1) / 2
            if px0 == px1:
                b.box(grp, 'castle', W, PAR, L, cx, y, cz)
                b.box(grp, 'castleDark', W + 0.025, 0.03, L + 0.02, cx, y + PAR - 0.025, cz)
            else:
                b.box(grp, 'castle', L, PAR, W, cx, y, cz)
                b.box(grp, 'castleDark', L + 0.02, 0.03, W + 0.025, cx, y + PAR - 0.025, cz)
            if L > 0.3:
                rough_merlons(b, px0 + (0.1 if px0 != px1 else 0), pz0 + (0.1 if pz0 != pz1 else 0),
                              px1 - (0.1 if px0 != px1 else 0), pz1 - (0.1 if pz0 != pz1 else 0), y + PAR, step, W, grp)
    # narożne wypusty (Michał 10.11.2026: „na rogach powinien być wypust”): masywny, wyższy słup z kamienia wysunięty
    # poza lico na trzech kamiennych wspornikach, z nakrywą — jak małe narożne baszty na murach
    C, CH = 0.24, PAR + 0.2
    for cx_, sx in ((x0, -1), (x1, 1)):
        for cz_, sz in ((z0, -1), (z1, 1)):
            px, pz = cx_ + sx * (0.035 - C / 2 + 0.02), cz_ + sz * (0.035 - C / 2 + 0.02)
            b.box('base', 'castle', C, CH + 0.1, C, px, y - 0.1, pz)
            b.box('base', 'castleDark', C + 0.03, 0.035, C + 0.03, px, y + CH, pz)
            b.box('base', 'castle', C * 0.55, 0.06, C * 0.55, px, y + CH + 0.035, pz)          # nakrywa z kamienia
            for j, (o, h) in enumerate(((0.012, 0.05), (0.024, 0.045), (0.036, 0.04))):     # wsporniki pod wypustem
                b.box('base', 'castleDark', C - 0.06 + 2 * o, h, C - 0.06 + 2 * o, px - sx * 0.02, y - 0.24 + j * 0.05, pz - sz * 0.02)
    # gzyms pod przedpiersiem (rama z czterech pasów, nie płyta — wnętrze widać, gdy dach zdjęty)
    for z, s in ((z1, 1), (z0, -1)):
        b.box('base', 'castleDark', x1 - x0 + 0.06, 0.05, 0.05, (x0 + x1) / 2, y - 0.07, z + s * 0.02)
    for x, s in ((x0, -1), (x1, 1)):
        b.box('base', 'castleDark', 0.05, 0.05, z1 - z0 - 0.02, x + s * 0.02, y - 0.07, (z0 + z1) / 2)


def _rnd(k):
    """Powtarzalny „los” 0..1 (bez random — model ma wychodzić zawsze taki sam)"""
    v = math.sin(k * 12.9898 + 78.233) * 43758.5453
    return v - math.floor(v)


def rough_merlons(b, x0, z0, x1, z1, y, step, W, grp='base'):
    """Blanki jak z ręcznie kładzionego kamienia (Michał 10.11.2026: równe klocki = ulep): każda trochę innej szerokości
    i wysokości, lekko przechylona, z ciemniejszą, obtłuczoną nakrywą z kamienia wystającą kilka mm"""
    L = math.hypot(x1 - x0, z1 - z0)
    n = max(1, int(L / step))
    rot = -math.atan2(z1 - z0, x1 - x0)
    seed = x0 * 7.1 + z0 * 3.3 + x1 * 1.7 + z1 * 5.9
    for i in range(n):
        f = (i + 0.5) / n
        cx, cz = x0 + (x1 - x0) * f, z0 + (z1 - z0) * f
        r1, r2, r3 = _rnd(seed + i), _rnd(seed + i + 0.37), _rnd(seed + i + 0.71)
        w, h = 0.14 + 0.03 * r1, 0.13 + 0.035 * r2
        b.box(grp, 'castle', w, h, W, cx, y, cz, rot, tilt=(r3 - 0.5) * 0.05, roll=(r1 - 0.5) * 0.04)
        b.box(grp, 'castleDark', w + 0.012, 0.028, W + 0.014, cx, y + h - 0.012, cz, rot + (r2 - 0.5) * 0.08, tilt=(r3 - 0.5) * 0.06)


def flat_roof(b, x0, x1, z0, z1, y, beams_along_x=False, nbeams=4):
    """Płaski dach: belki stropowe i na nich kamienne płyty (grupa 'shell'), zamknięta bryła (od spodu widać deski)"""
    W = WALL
    ix0, ix1, iz0, iz1 = x0 + W, x1 - W, z0 + W, z1 - W
    # deski stropu od spodu (widać z izby) i płyty z bruku na wierzchu, z lekkim spadkiem nie trzeba — płasko
    b.box('shell', 'woodDark', ix1 - ix0 + 0.01, 0.03, iz1 - iz0 + 0.01, (ix0 + ix1) / 2, y - 0.075, (iz0 + iz1) / 2)
    b.box('shell', 'pathCobble', ix1 - ix0 + 0.012, 0.045, iz1 - iz0 + 0.012, (ix0 + ix1) / 2, y - 0.045, (iz0 + iz1) / 2)
    # belki pod stropem (z izby widać je przy suficie)
    for k in range(nbeams):
        f = (k + 1) / (nbeams + 1)
        if beams_along_x:
            z = iz0 + (iz1 - iz0) * f
            b.box('shell', 'bark', ix1 - ix0, 0.08, 0.08, (ix0 + ix1) / 2, y - 0.155, z)
        else:
            x = ix0 + (ix1 - ix0) * f
            b.box('shell', 'bark', 0.08, 0.08, iz1 - iz0, x, y - 0.155, (iz0 + iz1) / 2)


RING = 0.065        # szerokość łuku i ościeża z kamienia


def arch_hole(cx, w, h, y0):
    """Otwór w murze pod łukowe wejście (prostokąt obejmujący ościeża i łuk; resztę zakrywają naroża — arch_door)"""
    ro = w / 2 + RING
    spring = y0 + h - w / 2
    return (cx - ro, cx + ro, 0.0, spring + ro)


def arch_door(b, t, cx, z, w, h, y0, door=True, swing=1.45):
    """Łukowe wejście w ścianie przedniej (lico na z), otwór z arch_hole: ościeża i ciągły łuk z łupanego kamienia
    (jedna zamknięta bryła — wcześniej osobne kliny z przerwami i gładkie ciosy jak beton, Michał 10.11.2026),
    naroża nad łukiem z kamienia muru, wrota z dwóch skrzydeł otwarte do środka, próg"""
    T = t.T
    ri, ro = w / 2, w / 2 + RING
    spring = y0 + h - w / 2
    zf, zb = z + T / 2 + 0.018, z - T / 2 - 0.018      # łuk i ościeża wystają 1,8 cm z obu lic
    # ościeża: od progu do nasady łuku, lekko szersze niż otwór (wchodzą w mur)
    for sx in (-1, 1):
        b.box('base', 'castleDark', RING + 0.008, spring - 0.0, zf - zb, cx + sx * (ri + (RING + 0.008) / 2), 0.0, (zf + zb) / 2)
    # łuk: pierścień z 16 odcinków, każdy zamknięty (przód, tył, podniebienie, grzbiet)
    n = 16
    arc = [(math.cos(math.pi * k / n), math.sin(math.pi * k / n)) for k in range(n + 1)]
    for k in range(n):
        (c0, s0), (c1, s1) = arc[k], arc[k + 1]
        i0, i1 = (cx + c0 * ri, spring + s0 * ri), (cx + c1 * ri, spring + s1 * ri)
        o0, o1 = (cx + c0 * ro, spring + s0 * ro), (cx + c1 * ro, spring + s1 * ro)
        mid = (cx + (c0 + c1) / 2 * (ri + ro) / 2, spring + (s0 + s1) / 2 * (ri + ro) / 2)
        b.poly('base', 'castleDark', [(i0[0], i0[1], zf), (o0[0], o0[1], zf), (o1[0], o1[1], zf), (i1[0], i1[1], zf)], away=(mid[0], mid[1], zf - 1))
        b.poly('base', 'castleDark', [(i0[0], i0[1], zb), (o0[0], o0[1], zb), (o1[0], o1[1], zb), (i1[0], i1[1], zb)], away=(mid[0], mid[1], zb + 1))
        b.poly('base', 'castleDark', [(i0[0], i0[1], zf), (i1[0], i1[1], zf), (i1[0], i1[1], zb), (i0[0], i0[1], zb)], away=(mid[0], mid[1], (zf + zb) / 2))
        b.poly('base', 'castleDark', [(o0[0], o0[1], zf), (o1[0], o1[1], zf), (o1[0], o1[1], zb), (o0[0], o0[1], zb)], away=(cx, spring, (zf + zb) / 2))
    # naroża nad łukiem (między grzbietem łuku a prostokątem otworu): kamień muru, od przodu i od tyłu w licu muru
    for sx in (-1, 1):
        corner = (cx + sx * ro, spring + ro)
        pts = [(cx + sx * c * ro, spring + sn * ro) for c, sn in arc[: n // 2 + 1]]
        for a, c in zip(pts, pts[1:]):
            for zz, aw in ((z + T / 2, -1), (z - T / 2, 1)):
                b.poly('base', 'castle', [(corner[0], corner[1], zz), (a[0], a[1], zz), (c[0], c[1], zz)], away=((corner[0] + a[0] + c[0]) / 3, (corner[1] + a[1] + c[1]) / 3, zz + aw))
    # wrota: dwa skrzydła z desek okute żelazem, otwarte do środka niemal pod ścianę
    if door:
        hw = w / 2 - 0.006
        hh = spring - y0 + ri * 0.55
        for sx in (-1, 1):
            a = swing * sx
            px, pz = cx + sx * hw, z - T / 2 - 0.01             # zawias przy wewnętrznym licu
            lx = px - sx * math.cos(swing) * hw / 2
            lz = pz - math.sin(swing) * hw / 2
            b.box('base', 'woodDark', hw, hh, 0.035, lx, y0 + 0.005, lz, rot=a)
            for yy in (y0 + 0.08, y0 + hh * 0.6):
                b.box('base', 'iron', hw - 0.01, 0.03, 0.045, lx, yy, lz, rot=a)
    b.box('base', 'castleDark', w + 0.16, 0.03, 0.2, cx, 0.0, z + T / 2 + 0.08)      # próg


def stairs(b, t, x, w, z_from, z_to, y_top, side=1, steps=None):
    """Kamienne schody wzdłuż boku budynku: stopnie z pełnym murem pod spodem (masyw jak przy murach), od strony
    zewnętrznej niskie przedpiersie. Biegną od z_from (dół, przód) do z_to (góra). side: +1 = przedpiersie od +x"""
    n = steps or max(6, int(y_top / 0.1))
    run = (z_from - z_to) / n
    rise = y_top / n
    for k in range(n):
        top = (k + 1) * rise
        zc = z_from - (k + 0.5) * run
        # masyw stopnia od ziemi do jego wierzchu (od spodu otwarty — stoi na ziemi)
        b.box('base', 'castle', w, top - 0.03, abs(run) + 0.002, x, 0.0, zc, bottom=False)
        # nakrywa stopnia z ciemniejszego ciosu, wystaje odrobinę do przodu
        b.box('base', 'castleDark', w + 0.01, 0.03, abs(run) + 0.012, x, top - 0.03, zc + 0.004)
        t.block(x - w / 2, x + w / 2, zc - abs(run) / 2, zc + abs(run) / 2, 0.0, top - 0.02)
    # przedpiersie schodów od strony zewnętrznej: pochyły murek z blankami co kilka stopni
    ex = x + side * (w / 2 + 0.035)
    for k in range(n):
        top = (k + 1) * rise
        zc = z_from - (k + 0.5) * run
        b.box('base', 'castle', 0.07, top + 0.12, abs(run) + 0.003, ex, 0.0, zc, bottom=False)
    return rise, run


def chimney(b, x, z, y, w=0.28, d=0.24, h=0.62):
    """Komin z kamienia (Michał 10.11.2026: „komin słaby”): szerszy trzon z odsadzką, wyżej węższy, gzyms ze wspornikami,
    na szczycie dwie kamienne płyty na słupkach (daszek nad wylotem), osmolony wylot. Dym rysuje gra (chimneys)."""
    b.box('base', 'castle', w + 0.06, 0.18, d + 0.06, x, y, z)                                 # stopa komina
    b.box('base', 'castleDark', w + 0.08, 0.03, d + 0.08, x, y + 0.18, z, tilt=0.02)           # odsadzka
    b.box('base', 'castle', w, h - 0.18, d, x, y + 0.21, z)                                    # trzon
    top = y + h + 0.03
    b.box('base', 'castleDark', w + 0.06, 0.045, d + 0.06, x, top - 0.045, z)                   # gzyms
    for sx in (-1, 1):                                                                         # wsporniki gzymsu
        b.box('base', 'castleDark', 0.05, 0.035, d + 0.04, x + sx * (w / 2 - 0.01), top - 0.08, z)
    b.box('base', 'dark', w - 0.08, 0.004, d - 0.08, x, top + 0.0005, z)                      # osmolony wylot
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box('base', 'castle', 0.04, 0.09, 0.04, x + sx * (w / 2 - 0.03), top, z + sz * (d / 2 - 0.03))   # słupki
    b.box('base', 'castleDark', w + 0.04, 0.03, d + 0.04, x, top + 0.09, z, tilt=0.03)          # płyta daszku
    return top + 0.06
