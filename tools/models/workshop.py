"""Wspólny szkielet małego warsztatu z szachulca (łuczarz, włóczniarz): kamienna podmurówka, podłoga z desek,
ściany z belkami na licu, drzwi z przodu po prawej, okna z okiennicami, strzecha z kalenicą i kamienny komin
nad paleniskiem. Wnętrze i obejście dokłada skrypt budynku.

    from workshop import workshop
    w = workshop(b, t)          # b = Building(), t = Timber(b)
    w['P'], w['H1'], w['chimneys'], w['flames'] ...

Układ: środek działki = (0, 0), działka ±1, przód (drzwi) = +z. Robotnik przy pracy stoi w (0, 0,12) — w izbie.
"""
import math

X0, X1, Z0, Z1 = -0.7, 0.7, -0.62, 0.42
P = 0.1
H1 = P + 0.78
RISE = 0.6
DOOR = (0.2, 0.5, 0.6)


def workshop(b, t, wall='plaster', roof='thatch', roof_dark='thatchDark', chimney=(0.42, None)):
    T = t.T
    chimneys, flames = [], []
    DM = (DOOR[0] + DOOR[1]) / 2
    # podmurówka i podłoga
    b.box('base', 'stone', X1 - X0 + 0.08, P, Z1 - Z0 + 0.08, 0, 0, (Z0 + Z1) / 2)
    b.box('base', 'stoneDark', X1 - X0 + 0.14, 0.035, Z1 - Z0 + 0.14, 0, 0, (Z0 + Z1) / 2)
    b.box('interior', 'plank', X1 - X0 - 2 * T, 0.01, Z1 - Z0 - 2 * T, 0, P, (Z0 + Z1) / 2)
    # ściany: drzwi i okno z przodu, okna z boków, okienko z tyłu
    FW = (-0.5, -0.18, P + 0.34, P + 0.6)
    t.wall_x('base', wall, Z1 - T / 2, X0, X1, P, H1, [(DOOR[0], DOOR[1], P, P + DOOR[2]), FW])
    t.wall_x('base', wall, Z0 + T / 2, X0, X1, P, H1, [(-0.45, -0.25, P + 0.38, P + 0.56)])
    t.wall_z('base', wall, X0 + T / 2, Z0 + T, Z1 - T, P, H1, [(-0.22, 0.02, P + 0.36, P + 0.58)])
    t.wall_z('base', wall, X1 - T / 2, Z0 + T, Z1 - T, P, H1, [(-0.22, 0.02, P + 0.36, P + 0.58)])
    t.window('base', (FW[0] + FW[1]) / 2, FW[2], FW[3], Z1 - T / 2, FW[1] - FW[0], 0, 1)
    t.window('base', -0.35, P + 0.38, P + 0.56, Z0 + T / 2, 0.2, 0, -1, shutters=False)
    t.window('base', X0 + T / 2, P + 0.36, P + 0.58, -0.1, 0.24, -1, 0)
    t.window('base', X1 - T / 2, P + 0.36, P + 0.58, -0.1, 0.24, 1, 0)
    t.frame_x('base', Z1 - T / 2, X0, X1, P, H1, [X0 + 0.03, FW[0] - 0.03, FW[1] + 0.03, DOOR[0] - 0.03, DOOR[1] + 0.03, X1 - 0.03], braces=False)
    t.frame_x('base', Z0 + T / 2, X0, X1, P, H1, [X0 + 0.03, -0.55, -0.15, 0.25, X1 - 0.03], out=-1)
    t.frame_z('base', X0 + T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.27, 0.07, Z1 - 0.03], out=-1)
    t.frame_z('base', X1 - T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.27, 0.07, Z1 - 0.03])
    # drzwi uchylone do środka, nadproże i próg
    b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.08, 0.05, T + 0.03, DM, P + DOOR[2], Z1 - T / 2)
    b.box('base', 'stoneDark', DOOR[1] - DOOR[0] + 0.06, 0.03, 0.14, DM, 0.0, Z1 + 0.1)
    b.box('interior', 'wood', DOOR[1] - DOOR[0] - 0.02, DOOR[2] - 0.02, 0.025, DOOR[1] - 0.02, P, Z1 - T - 0.14, -(math.pi / 2 - 0.3))
    for yy in (P + 0.1, P + 0.46):
        b.box('interior', 'iron', 0.02, 0.02, 0.22, DOOR[1] - 0.04, yy, Z1 - T - 0.13, 0.3)
    t.block(X0, DOOR[0], Z1 - T, Z1); t.block(DOOR[1], X1, Z1 - T, Z1)
    t.block(X0, X1, Z0, Z0 + T); t.block(X0, X0 + T, Z0, Z1); t.block(X1 - T, X1, Z0, Z1)
    t.open.append([X0 + T, X1 - T, Z0 + T, Z1 - T])
    t.open.append([DOOR[0], DOOR[1], Z1 - T - 0.02, Z1 + 0.05])
    # strzecha (dwie warstwy), szczyty, kalenica
    b.gable('shell', roof, X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1, RISE, along_x=True, over=0.17)
    b.gable('shell', roof_dark, X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1 - 0.04, RISE, along_x=True, over=0.21)
    for sx, x in ((-1, X0), (1, X1)):
        t.gable_end('shell', wall, x, Z0, Z1, H1, RISE, out=sx)
    b.box('shell', roof_dark, X1 - X0 + 0.42, 0.07, 0.13, 0, H1 + RISE - 0.035, (Z0 + Z1) / 2)
    # komin nad paleniskiem przy tylnej ścianie
    CX = chimney[0]
    CZ = Z0 + T + 0.08 if chimney[1] is None else chimney[1]
    b.box('shell', 'stone', 0.22, RISE + 0.4, 0.22, CX, H1 - 0.05, CZ)
    b.box('shell', 'stoneDark', 0.27, 0.05, 0.27, CX, H1 + RISE + 0.35, CZ)
    b.box('shell', 'dark', 0.15, 0.005, 0.15, CX, H1 + RISE + 0.4, CZ)
    chimneys.append([CX, round(H1 + RISE + 0.42, 3), CZ])
    # palenisko pod kominem
    t.boxs('interior', 'stone', 0.3, 0.42, 0.14, CX, P, Z0 + T + 0.07)
    b.box('interior', 'dark', 0.18, 0.2, 0.02, CX, P + 0.03, Z0 + T + 0.145)
    b.box('interior', 'stoneDark', 0.36, 0.05, 0.2, CX, P + 0.42, Z0 + T + 0.09)
    flames.append([CX, round(P + 0.02, 3), round(Z0 + T + 0.18, 3)])
    # sufit (tylko w spacerze)
    b.box('ceiling', 'wood', X1 - X0 - 2 * T, 0.02, Z1 - Z0 - 2 * T, 0, H1 - 0.02, (Z0 + Z1) / 2, bottom=True)
    return {'P': P, 'H1': H1, 'RISE': RISE, 'X0': X0, 'X1': X1, 'Z0': Z0, 'Z1': Z1, 'DOOR': DOOR, 'T': T,
            'chimneys': chimneys, 'flames': flames, 'CX': CX, 'CZ': CZ,
            'pennant': [round(X1 + 0.05, 3), round(H1 + RISE - 0.1, 3), round((Z0 + Z1) / 2, 3)]}
