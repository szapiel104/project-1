import { TERRAIN } from './data/terrain';
import { MAP_PRESETS, type MapPresetId } from './data/maps';
import { t } from './i18n';
import { GameRenderer } from './render/scene';
import { tileAt } from './sim/map';
import { seedFromText } from './sim/rng';
import { createGame, stateHash, type GameState } from './sim/state';
import { createHud } from './ui/hud';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new GameRenderer(canvas);
let game: GameState;

const WORDS = ['wilk', 'dab', 'orzel', 'kruk', 'zubr', 'miecz', 'baszta', 'wrota', 'las', 'skala', 'rzeka', 'brod'];

const hud = createHud(document.getElementById('ui')!, {
  onGenerate: (seedText, preset) => start(seedText || 'project-1', preset),
  // losowanie nazwy mapy to interfejs, nie symulacja, więc Math.random jest tu w porządku
  onRandom: (preset) => start(`${WORDS[Math.floor(Math.random() * WORDS.length)]}-${Math.floor(Math.random() * 900 + 100)}`, preset),
});

function start(seedText: string, preset: MapPresetId): void {
  game = createGame(seedFromText(seedText), preset);
  renderer.setState(game, MAP_PRESETS[preset].waterLevel);
  hud.setSeed(seedText);
  hud.setHash(stateHash(game));
  hud.setTile('');
}

renderer.onHover = (tile) => {
  if (!tile) { hud.setTile(''); return; }
  hud.setTile(`${tile.x}, ${tile.y} · ${t(TERRAIN[tileAt(game.map, tile.x, tile.y)].name as Parameters<typeof t>[0])}`);
};

start('project-1', '1v1');
