export const pl = {
  'app.title': 'Project‑1',
  'app.subtitle': 'Etap 1: mapa i kamera',
  'hud.seed': 'Ziarno mapy',
  'hud.mode': 'Tryb',
  'hud.newMap': 'Losuj mapę',
  'hud.generate': 'Generuj',
  'hud.help': 'Sterowanie',
  'hud.hash': 'Skrót stanu',
  'hud.tile': 'Pole',
  'help.move': 'Przesuwanie: W A S D, strzałki albo przeciąganie',
  'help.rotate': 'Obrót: Q i E albo prawy przycisk myszy',
  'help.zoom': 'Zbliżenie: kółko myszy albo dwa palce',
  'terrain.grass': 'łąka',
  'terrain.forest': 'las',
  'terrain.stone': 'kamień',
  'terrain.iron': 'żelazo',
  'terrain.water': 'woda',
  'team.0': 'Czerwoni',
  'team.1': 'Niebiescy',
} as const;

export type TextKey = keyof typeof pl;
