"""Słomiana kukła do ćwiczeń (Michał 29.10.2026: „manekiny bardziej okrągłe i widać prawdziwe zboże”): okrągły,
pękaty snop słomy na palu, przewiązany w dwóch miejscach sznurem, z wystającymi na dole źdźbłami; ramiona z poprzeczki
owiniętej słomą, okrągła głowa ze słomy związana pod szyją, z czubkiem źdźbeł. Używają jej koszary i dziedziniec zamku.
"""
import math

from logs import lash, log


def _round(b, group, mat, x, z, prof, seg=14):
    """Bryła obrotowa z profilu [(y, r), ...] od dołu do góry: kolejne ścięte stożki, z dnem i wierzchem."""
    for i in range(len(prof) - 1):
        (y0, r0), (y1, r1) = prof[i], prof[i + 1]
        b.prism(group, mat, r0, r1, y1 - y0, x, y0, z, seg=seg, top=i == len(prof) - 2, phase=0.15 * i)


def straw_dummy(b, group, x, y0, z, rot=0.0):
    """Kukła stoi w (x, z) na ziemi y0; `rot` obraca poprzeczkę (ramiona) wokół pionu."""
    c, s = math.cos(rot), math.sin(rot)
    # pal i poprzeczka (ramiona) z okorowanego drewna
    log(b, group, 'woodDark', (x, y0 - 0.01, z), (x, y0 + 0.76, z), r=0.024, r1=0.02, seg=7)
    ax, az = c * 0.24, -s * 0.24
    log(b, group, 'woodDark', (x - ax, y0 + 0.5, z - az), (x + ax, y0 + 0.5, z + az), r=0.016, seg=6)
    # snop tułowia: pękaty, szerszy w połowie
    prof = [(y0 + 0.19, 0.075), (y0 + 0.23, 0.105), (y0 + 0.3, 0.125), (y0 + 0.38, 0.128), (y0 + 0.46, 0.115), (y0 + 0.52, 0.085), (y0 + 0.545, 0.05)]
    _round(b, group, 'hay', x, z, prof)
    for y, r in ((y0 + 0.265, 0.12), (y0 + 0.47, 0.112)):
        lash(b, group, (x, y, z), (0, 1, 0), r=r + 0.006, w=0.018, seg=14)
    # źdźbła wystające spod snopa, rozchylone na boki
    for k in range(18):
        a = k * 2 * math.pi / 18 + 0.13 * (k % 3)
        r0 = 0.07 + (k % 2) * 0.01
        p0 = (x + math.cos(a) * r0, y0 + 0.2, z + math.sin(a) * r0)
        ln = 0.06 + (k % 4) * 0.012
        p1 = (x + math.cos(a) * (r0 + 0.035), y0 + 0.2 - ln, z + math.sin(a) * (r0 + 0.035))
        log(b, group, 'hay', p0, p1, r=0.0045, seg=4, ends='hay')
    # ramiona: słoma owinięta na poprzeczce, związana na końcach
    for sg in (-1, 1):
        p0 = (x + sg * c * 0.1, y0 + 0.5, z - sg * s * 0.1)
        p1 = (x + sg * c * 0.22, y0 + 0.5, z - sg * s * 0.22)
        log(b, group, 'hay', p0, p1, r=0.034, r1=0.028, seg=8, ends='hay')
        lash(b, group, (x + sg * c * 0.2, y0 + 0.5, z - sg * s * 0.2), (c, 0, -s), r=0.031, w=0.012, seg=8)
    # głowa: okrągła kula słomy, związana sznurem pod szyją, na czubku kilka źdźbeł
    hy, hr = y0 + 0.65, 0.07
    head = [(hy + hr * math.sin(t), hr * math.cos(t)) for t in [-1.25 + 0.5 * k for k in range(6)]]
    head = [(y, max(0.012, r)) for y, r in head]
    _round(b, group, 'hay', x, z, [(y0 + 0.56, 0.035)] + head, seg=12)
    lash(b, group, (x, y0 + 0.575, z), (0, 1, 0), r=0.038, w=0.014, seg=10)
    for k in range(7):
        a = k * 0.9
        log(b, group, 'hay', (x + math.cos(a) * 0.012, hy + hr * 0.92, z + math.sin(a) * 0.012),
            (x + math.cos(a) * 0.04, hy + hr + 0.05 + (k % 3) * 0.01, z + math.sin(a) * 0.04), r=0.004, seg=4, ends='hay')
