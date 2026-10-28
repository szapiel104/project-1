"""Wspólne części rudery (shack.py) i rudery narożnej (shackl.py): wejście ze skórą zwiniętą nad otworem, czapa kalenicy
z dwóch desek leżących na połaciach i ciemne deskowanie od środka ścian (przez szpary nie widać nieba).
"""
from logs import lash, log


def door_hide(b, x0, x1, top, z):
    """Wejście bez skrzydła: skóra zwinięta w rulon pod belką nad otworem (od x0 do x1, w płaszczyźnie z), przewiązana
    dwoma sznurami, z krótkim, nierównym fartuchem zwisającym spod rulonu — przejście zostaje wolne."""
    y = top - 0.045
    log(b, 'base', 'hide', (x0 + 0.015, y, z), (x1 - 0.015, y + 0.004, z), r=0.032, seg=9, ends='hideDark')
    for f in (0.22, 0.78):
        x = x0 + (x1 - x0) * f
        lash(b, 'base', (x, y + 0.001, z), (1, 0, 0), r=0.037, w=0.016, seg=9)
        # sznur od rulonu do kołka w belce nad wejściem
        log(b, 'base', 'rope', (x, y + 0.03, z - 0.004), (x, top + 0.012, z - 0.012), r=0.005, seg=5, ends='rope')
    # fartuch: niski pas skóry spod rulonu, z dwoma wcięciami (dwie warstwy — gra nie rysuje tylnych stron)
    for k, (a, c, h) in enumerate(((0.0, 0.34, 0.07), (0.36, 0.7, 0.055), (0.72, 1.0, 0.075))):
        xa, xc = x0 + 0.02 + (x1 - x0 - 0.04) * a, x0 + 0.02 + (x1 - x0 - 0.04) * c
        b.box('base', 'hideDark' if k % 2 else 'hide', xc - xa, h, 0.008, (xa + xc) / 2, y - 0.02 - h, z + 0.016, roll=0.03 * (k - 1))


def ridge_cap(b, along, a0, a1, em, y, rise, half):
    """Czapa kalenicy: dwie deski przybite na styk wzdłuż kalenicy, każda leży na swojej połaci (a nie płaska deska
    nad dachem, która z boku wisiała w powietrzu). along 'x' = kalenica wzdłuż x w z=em; 'z' = wzdłuż z w x=em.
    y = wierzch desek przy kalenicy, rise / half = spadek połaci (wzniesienie na połowę szerokości dachu)."""
    w = 0.075                      # szerokość deski w dół połaci
    drop = rise * w / half
    mid = ((a0 + a1) / 2, y - rise, em) if along == 'x' else (em, y - rise, (a0 + a1) / 2)

    def P(a, e, yy):
        return (a, yy, e) if along == 'x' else (e, yy, a)
    for side in (-1, 1):
        e1 = em + side * w
        pts = [P(a0, em, y + 0.012), P(a1, em, y + 0.012), P(a1, e1, y + 0.012 - drop), P(a0, e1, y + 0.012 - drop)]
        b.slope('shell', 'woodDark', pts, mid, t=0.016)


def backing(b, axis, at, a0, a1, h, holes=()):
    """Ciemne deski od środka ściany, tuż za licem desek: przez szpary widać ciemne drewno, a nie niebo.
    axis 'x' = ściana wzdłuż x w płaszczyźnie z=at, 'z' = wzdłuż z w płaszczyźnie x=at. holes = [(od, do, wysokość)]"""
    segs = [(a0, a1, 0.0, h)]
    for h0, h1, hh in holes:
        out = []
        for s0, s1, y0, y1 in segs:
            if y0 >= hh:
                out.append((s0, s1, y0, y1))
                continue
            if h0 - s0 > 0.02:
                out.append((s0, h0, y0, y1))
            if s1 - h1 > 0.02:
                out.append((h1, s1, y0, y1))
            out.append((max(s0, h0), min(s1, h1), hh, y1))   # nad otworem
        segs = out
    for s0, s1, y0, y1 in segs:
        if s1 - s0 < 0.01 or y1 - y0 < 0.01:
            continue
        if axis == 'x':
            b.box('base', 'woodDark', s1 - s0, y1 - y0, 0.008, (s0 + s1) / 2, y0, at)
        else:
            b.box('base', 'woodDark', 0.008, y1 - y0, s1 - s0, at, y0, (s0 + s1) / 2)
