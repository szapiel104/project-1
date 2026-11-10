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


def parapet(b, x0, x1, z0, z1, y, skip=None, step=0.27):
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
        for px0, pz0, px1, pz1 in parts:
            L = math.hypot(px1 - px0, pz1 - pz0)
            if L < 0.06:
                continue
            cx, cz = (px0 + px1) / 2, (pz0 + pz1) / 2
            if px0 == px1:
                b.box('base', 'castle', W, PAR, L, cx, y, cz)
                b.box('base', 'castleDark', W + 0.025, 0.03, L + 0.02, cx, y + PAR - 0.025, cz)
            else:
                b.box('base', 'castle', L, PAR, W, cx, y, cz)
                b.box('base', 'castleDark', L + 0.02, 0.03, W + 0.025, cx, y + PAR - 0.025, cz)
            if L > 0.3:
                b.merlons_line('base', 'castle', px0 + (0.1 if px0 != px1 else 0), pz0 + (0.1 if pz0 != pz1 else 0),
                               px1 - (0.1 if px0 != px1 else 0), pz1 - (0.1 if pz0 != pz1 else 0), y + PAR, step=step, w=0.15, h=0.15, t=W)
    # gzyms pod przedpiersiem (rama z czterech pasów, nie płyta — wnętrze widać, gdy dach zdjęty)
    for z, s in ((z1, 1), (z0, -1)):
        b.box('base', 'castleDark', x1 - x0 + 0.06, 0.05, 0.05, (x0 + x1) / 2, y - 0.07, z + s * 0.02)
    for x, s in ((x0, -1), (x1, 1)):
        b.box('base', 'castleDark', 0.05, 0.05, z1 - z0 - 0.02, x + s * 0.02, y - 0.07, (z0 + z1) / 2)


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
        b.box('base', 'cutDark', w + 0.01, 0.03, abs(run) + 0.012, x, top - 0.03, zc + 0.004)
        t.block(x - w / 2, x + w / 2, zc - abs(run) / 2, zc + abs(run) / 2, 0.0, top - 0.02)
    # przedpiersie schodów od strony zewnętrznej: pochyły murek z blankami co kilka stopni
    ex = x + side * (w / 2 + 0.035)
    for k in range(n):
        top = (k + 1) * rise
        zc = z_from - (k + 0.5) * run
        b.box('base', 'castle', 0.07, top + 0.12, abs(run) + 0.003, ex, 0.0, zc, bottom=False)
    return rise, run
