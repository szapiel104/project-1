"""Generator tekstur kamienia i łupka do zamku (Michał 2.11.2026: „nie czuć kamienia, tekstura 2D, jasna, płaska”).

Wzór: mury z Twierdzy 3 / Krzyżowca 2 — nieregularne ciosy różnej wielkości w warstwach, wypukłe lica z zaokrąglonymi
krawędziami, głębokie, ciemne fugi, każdy kamień trochę innej jasności, drobna faktura skały na licu.
Dachy: łupek w zachodzących na siebie rzędach, każda płytka z nieregularnym dolnym brzegiem i cieniem pod spodem.

Wynik jak reszta zdjęciowych tekstur gry: kolor w odcieniach szarości (barwę nadaje materiał, kolor wierzchołków)
plus mapa normalnych OpenGL (Y w górę). Tekstury są bezszwowe (wszystko liczone z zawijaniem).

Uruchomienie z katalogu repo:
  python3 tools/textures/gen_stone.py            # oba
  python3 tools/textures/gen_stone.py ashlar     # tylko kamień
Potem KTX2: node tools/textures/ktx2.mjs public/textures/cc0/ashlar.jpg public/textures/cc0/ashlar_n.jpg ...
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

N = 2048
OUT = 'public/textures/cc0/'
rng = np.random.default_rng(1102)


def periodic_noise(n, scale, seed):
    """Bezszwowy szum: biały szum przefiltrowany w dziedzinie Fouriera (z natury okresowy), znormalizowany do 0..1"""
    r = np.random.default_rng(seed)
    w = r.standard_normal((n, n))
    f = np.fft.fft2(w)
    ky = np.fft.fftfreq(n)[:, None]
    kx = np.fft.fftfreq(n)[None, :]
    k = np.sqrt(kx * kx + ky * ky)
    filt = np.exp(-(k * scale) ** 2)
    out = np.real(np.fft.ifft2(f * filt))
    out -= out.min()
    out /= out.max()
    return out


def fbm(n, base, seed, octaves=5):
    acc = np.zeros((n, n))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        acc += amp * periodic_noise(n, base / (2 ** o), seed + o)
        tot += amp
        amp *= 0.5
    return acc / tot


def normal_map(height, strength):
    """Mapa normalnych OpenGL z wysokości (zawijanie na brzegach)"""
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5
    nx, ny, nz = -dx * strength, dy * strength, np.ones_like(height)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx / ln, ny / ln, nz / ln], -1) * 0.5 + 0.5
    return (np.clip(rgb, 0, 1) * 255).astype(np.uint8)


def wrap_dist(mask):
    """Odległość od brzegu kamienia z zawijaniem (pole 3×3, środek)"""
    big = np.tile(mask, (3, 3))
    d = ndimage.distance_transform_edt(big)
    return d[N:2 * N, N:2 * N]


def photo(name):
    """Szare zdjęcie skały z gry (1024, bezszwowe) jako drobna faktura lica: 0..1, średnio ok. 1"""
    im = np.asarray(Image.open(OUT + name + '.jpg').convert('L')).astype(np.float64) / 255
    return im / im.mean()


def ashlar():
    """Ciosy, wersja 2 (Michał 3.11.2026: „tekstury kamienia murów — żeby czuć kamień”, wzór Twierdza 3 / Krzyżowiec 2).
    W v1 fugi były czarnymi, falującymi kreskami (jak rysunek), a lico — rozciągniętym zdjęciem skały w paski.
    Teraz: prostokątne ciosy różnej długości w warstwach różnej wysokości, krawędzie tylko lekko nierówne i obtłuczone,
    fuga wgłębiona i jaśniejsza (piaskowa zaprawa), lico z drobną fakturą kamienia, wgłębieniami i śladami obróbki,
    każdy kamień innej jasności, z lekkim spadkiem światła po licu."""
    labels = np.zeros((N, N), np.int32)
    rows, y = [], 0
    while y < N:
        h = int(rng.integers(130, 250))
        if N - y < 250:
            h = N - y
        rows.append((y, h))
        y += h
    sid = 1
    for (y0, h) in rows:
        x = int(rng.integers(0, 400))
        tot = 0
        while tot < N:
            w = int(rng.integers(int(h * 1.0), int(h * 2.8)))
            if N - tot < h * 1.1:
                w = N - tot
            xs = np.arange(x, x + w) % N
            labels[y0:y0 + h][:, xs] = sid
            sid += 1
            x += w
            tot += w
    yy, xx = np.mgrid[0:N, 0:N]
    # krawędzie: drobne, poszarpane nierówności (obtłuczone kamienie), bez długich fal
    jx = (fbm(N, 7, 11, 3) - 0.5) * 20 + (fbm(N, 30, 12, 2) - 0.5) * 14
    jy = (fbm(N, 7, 23, 3) - 0.5) * 20 + (fbm(N, 30, 24, 2) - 0.5) * 14
    lab = labels[((yy + jy).astype(int)) % N, ((xx + jx).astype(int)) % N]
    edge = np.zeros((N, N), bool)
    for sh in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        edge |= lab != np.roll(lab, sh, (0, 1))
    # szerokość fugi zmienna 3..7 px
    wvar = fbm(N, 60, 31, 2)
    grown = np.tile(edge, (3, 3))
    inside = np.ones((N, N), bool)
    for it in range(1, 8):
        grown = ndimage.binary_dilation(grown)
        core = grown[N:2 * N, N:2 * N]
        thr = 3 + 4 * wvar
        inside &= ~(core & (it <= thr))
    d = wrap_dist(inside)
    # lico: wąskie zaokrąglenie krawędzi (ok. 10 px), lekko wypukłe, nierówne
    bevel = np.clip(d / 10.0, 0, 1) ** 0.6
    nlab = lab.max() + 1
    bulge = rng.uniform(0.0, 0.25, nlab)
    gx = rng.uniform(-1, 1, nlab)
    gy = rng.uniform(-1, 1, nlab)
    # współrzędne wewnątrz kamienia (0..1) z pola odległości — wypukłość ku środkowi
    dn = d / (ndimage.maximum(d, lab, index=np.arange(nlab))[lab] + 1e-6)
    pits = np.clip((fbm(N, 3, 41, 2) - 0.6) * 3, 0, 1)                        # drobne wgłębienia
    grain = fbm(N, 2.2, 43, 2)                                                # ziarno kamienia
    mid = fbm(N, 22, 45, 3)                                                   # nierówności lica
    chips = np.clip((fbm(N, 14, 59, 3) - 0.6) * 5, 0, 1) * (1 - np.clip(d / 24, 0, 1))   # odpryski przy krawędziach
    height = bevel * (0.75 + bulge[lab] * np.sqrt(np.clip(dn, 0, 1)) + 0.18 * mid) + grain * 0.05 - pits * 0.08 - chips * 0.4
    mortar = fbm(N, 3, 71, 3)
    height = np.where(inside, height, 0.05 + 0.06 * mortar)
    # kolor: jasność kamienia 0,55..1, lekki spadek po licu (jak kamień z innej partii), plamy, ziarno, wgłębienia
    # Michał 3.11.2026: „raz jasny, raz ciemny to źle” — kamienie z jednej partii, różnice jasności tylko lekkie
    tone = rng.uniform(0.88, 1.0, nlab)
    gxy = (gx[lab] * (xx % 400) / 400 + gy[lab] * (yy % 400) / 400) * 0.04
    stain = fbm(N, 120, 83, 4)
    rock = photo('rock')
    R = rock.shape[0]
    offx = rng.integers(0, R, nlab)
    offy = rng.integers(0, R, nlab)
    det = rock[(yy + offy[lab]) % R, (xx + offx[lab]) % R]
    det = 1 + (det - 1) * 0.4
    blotch = fbm(N, 45, 87, 4)
    col = tone[lab] * det * (0.9 + 0.1 * mid) * (0.86 + 0.14 * stain) * (0.9 + 0.1 * blotch) * (0.9 + 0.1 * grain) * (1 - pits * 0.25) + gxy * 0.5
    # krawędzie lekko wytarte (jaśniejsze) tuż przy fazie, odpryski jaśniejsze (świeży kamień), zagłębienia ciemne
    # bryła: środek lica jaśniejszy, ku krawędziom ciemnieje (kamień wypukły, światło z góry); odpryski jaśniejsze
    pillow = np.clip(d / 45.0, 0, 1) ** 0.7
    col = col * (0.8 + 0.2 * pillow) + chips * 0.04
    ao = ndimage.gaussian_filter(height, 7, mode='wrap')
    col *= 0.78 + 0.22 * np.clip(height * 1.2 + 0.1, 0, 1)
    col *= 0.82 + 0.18 * np.clip(ao * 1.6, 0, 1)
    col = col * (0.56 / col[inside].mean())                          # średnia jasność lica jak w v1 (barwę daje materiał)
    # zaprawa: piaskowa, wgłębiona, w cieniu krawędzi kamieni (nie czarna)
    shadow = np.clip(1 - ndimage.gaussian_filter(inside.astype(float), 2.5, mode='wrap') * 0.6, 0.4, 1)
    col = np.where(inside, col, (0.36 + 0.08 * mortar) * shadow)
    col = np.clip(col, 0, 1)
    Image.fromarray((col * 255).astype(np.uint8)).convert('RGB').save(OUT + 'ashlar.jpg', quality=92)
    Image.fromarray(normal_map(ndimage.gaussian_filter(height, 0.7, mode='wrap') + 0.6 * np.sqrt(np.clip(d / 45.0, 0, 1)), 11.0)).save(OUT + 'ashlar_n.jpg', quality=92)
    hh = ndimage.gaussian_filter(height, 1.0, mode='wrap')
    hh = (hh - hh.min()) / (hh.max() - hh.min())
    Image.fromarray((hh * 255).astype(np.uint8)).save(OUT + 'ashlar_h.jpg', quality=92)
    print('ashlar', N, 'stones', nlab, 'mean', round(float(col.mean()), 3))


def slate():
    """Łupek, wersja 2 (Michał: „dachy bez lustrzanych łusek”): prostokątne płytki różnej szerokości w rzędach
    mijających się na zakładkę, dolny brzeg lekko nierówny i obtłuczony, pod nim cień; każda płytka innej jasności
    i lekko przekrzywiona (spadek światła w poprzek), drobna łupliwa faktura wzdłuż."""
    row_h = 128
    rows = N // row_h
    height = np.zeros((N, N))
    col = np.zeros((N, N))
    rag = fbm(N, 5, 101, 3) - 0.5
    flake = aniso_noise(N, 40, 3, 113)          # warstwy łupka (poziome smugi)
    big = fbm(N, 200, 127, 3)
    fine = fbm(N, 2.5, 131, 2)
    for r in list(range(rows - 1, -1, -1)) + [rows - 1]:
        y0 = r * row_h
        again = r == rows - 1 and col[y0 + 5].any()
        x = int(rng.integers(0, 200))
        tot = 0
        while tot < N:
            w = int(rng.integers(80, 160))
            if N - tot < 110:
                w = N - tot
            xs = np.arange(x, x + w) % N
            ys = np.arange(y0, y0 + row_h + 30) % N
            sub_y = np.arange(row_h + 30)[:, None]
            # dolny brzeg: prosty z drobnymi wyszczerbieniami, rogi lekko ścięte
            bottom = row_h + 22 + rag[np.ix_(ys, xs)] * 10
            u = np.abs((np.arange(w) - (w - 1) / 2) / (w / 2))
            cut = np.clip((u - 0.9) * 10, 0, 1) * 8
            mask = sub_y < (bottom - cut[None, :])
            gap = np.zeros(w, bool)
            gap[:2] = True
            m2 = mask & ~gap[None, :]
            if again:
                m2 = m2 & (sub_y >= row_h)
            t = rng.uniform(0.55, 1.0)
            tilt = rng.uniform(-0.08, 0.08)
            lr = tilt * (np.arange(w) - w / 2) / (w / 2)
            hgt = 0.3 + 0.7 * (sub_y / (row_h + 30)) + lr[None, :] * 0.3
            hb = height[np.ix_(ys, xs)]
            cb = col[np.ix_(ys, xs)]
            hb = np.where(m2, hgt + fine[np.ix_(ys, xs)] * 0.04 + flake[np.ix_(ys, xs)] * 0.05, hb)
            shade = 0.6 + 0.4 * (sub_y / (row_h + 30))
            c = t * (0.82 + 0.18 * flake[np.ix_(ys, xs)]) * (0.88 + 0.12 * big[np.ix_(ys, xs)]) * (0.92 + 0.08 * fine[np.ix_(ys, xs)]) * shade + lr[None, :] * 0.25
            cb = np.where(m2, c, cb)
            height[np.ix_(ys, xs)] = hb
            col[np.ix_(ys, xs)] = cb
            x += w
            tot += w
    ao = ndimage.gaussian_filter(height, 5, mode='wrap')
    col = col * (0.62 + 0.38 * np.clip(height, 0, 1)) * (0.82 + 0.18 * np.clip(ao * 1.5, 0, 1))
    col = np.where(col <= 0.01, 0.1, col)
    col = np.clip(col, 0, 1)
    Image.fromarray((col * 255).astype(np.uint8)).convert('RGB').save(OUT + 'slate.jpg', quality=92)
    Image.fromarray(normal_map(ndimage.gaussian_filter(height, 1.0, mode='wrap'), 6.0)).save(OUT + 'slate_n.jpg', quality=92)
    hh = ndimage.gaussian_filter(height, 1.0, mode='wrap')
    hh = (hh - hh.min()) / (hh.max() - hh.min())
    Image.fromarray((hh * 255).astype(np.uint8)).save(OUT + 'slate_h.jpg', quality=92)
    print('slate', N, 'mean', round(float(col.mean()), 3))


def aniso_noise(n, sx, sy, seed):
    """Bezszwowy szum wydłużony: sx, sy — skale w poprzek i wzdłuż (źdźbła: wąskie w x, długie w y)"""
    r = np.random.default_rng(seed)
    f = np.fft.fft2(r.standard_normal((n, n)))
    ky = np.fft.fftfreq(n)[:, None]
    kx = np.fft.fftfreq(n)[None, :]
    out = np.real(np.fft.ifft2(f * np.exp(-(kx * sx) ** 2 - (ky * sy) ** 2)))
    out -= out.min()
    return out / out.max()


def thatch():
    """Strzecha (Michał 2.11.2026: „strzecha nie wygląda dobrze”): nie jednolita słoma, tylko warstwy pęczków jak na
    prawdziwym dachu — każdy rząd zwisa nad następnym, dolny brzeg strzępiasty i w cieniu, w rzędzie widać osobne
    wiązki (jaśniejsze i ciemniejsze), źdźbła wzdłuż spadku dachu (pion tekstury) i lekko pochylone."""
    row_h = 256                                   # 8 warstw na teksturę
    rows = N // row_h
    yy, xx = np.mgrid[0:N, 0:N]
    straw = aniso_noise(N, 1.6, 60, 301) ** 1.6          # pojedyncze źdźbła
    straw2 = aniso_noise(N, 3.0, 90, 302)
    clump = aniso_noise(N, 40, 300, 303)          # wiązki
    rag = aniso_noise(N, 5.0, 8, 304)             # strzępiasty brzeg
    big = fbm(N, 260, 305, 3)                     # plamy wyblaknięcia i mchu
    height = np.zeros((N, N))
    col = np.zeros((N, N))
    for k, r in enumerate(list(range(rows - 1, -1, -1)) + [rows - 1]):   # od dołu: wyższa warstwa przykrywa niższą
        y0 = r * row_h
        sub = (yy - y0) % N                       # 0 u góry warstwy
        # dolny brzeg warstwy: nierówny i postrzępiony, zwisa ok. 40 px nad następną
        edge = row_h + 40 + (rag - 0.5) * 70 + (clump - 0.5) * 50
        inside = (sub < edge) & (sub >= 0)
        t = sub / edge
        h = 0.25 + 0.75 * t                       # warstwa narasta ku dolnemu brzegowi
        layer = inside & (sub >= row_h) if k == rows else inside   # na koniec zwis ostatniej warstwy na pierwszą
        height = np.where(layer, h + (straw - 0.5) * 0.12, height)
        c = (0.3 + 0.7 * straw) * (0.65 + 0.5 * clump) * (0.75 + 0.25 * straw2)
        c = c * (0.3 + 0.7 * np.clip(t * 1.5, 0, 1) ** 0.8)         # góra warstwy w cieniu poprzedniej
        col = np.where(layer, c, col)
    # cień pod zwisającym brzegiem (spadek wysokości), plamy wieku
    ao = ndimage.gaussian_filter(height, (10, 3), mode='wrap')
    col = col * (0.7 + 0.3 * np.clip(1 - (ao - height) * 4, 0, 1))
    col = col * (0.8 + 0.3 * big)
    col = col / col.mean() * 0.7
    col = np.clip(col, 0, 1)
    Image.fromarray((col * 255).astype(np.uint8)).save(OUT + 'thatch.jpg', quality=90)
    Image.fromarray(normal_map(ndimage.gaussian_filter(height, 1.0, mode='wrap'), 5.0)).save(OUT + 'thatch_n.jpg', quality=92)
    hh = ndimage.gaussian_filter(height, 1.0, mode='wrap')
    hh = (hh - hh.min()) / (hh.max() - hh.min())
    Image.fromarray((hh * 255).astype(np.uint8)).save(OUT + 'thatch_h.jpg', quality=92)
    print('thatch', N, 'mean', round(float(col.mean()), 3))


if __name__ == '__main__':
    which = sys.argv[1:] or ['ashlar', 'slate']
    if 'ashlar' in which:
        ashlar()
    if 'slate' in which:
        slate()
    if 'thatch' in which:
        thatch()
