// Odcisk symulacji: kilka długich gier z botami → skrót całego stanu (zapis) i czas. Używa tools/check/simprint.mjs.
import { createGame } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { serialize } from '../../src/sim/save';
for (const [seed, preset, ticks] of [[33, '4v4', 15000], [44, '4v4', 12000], [55, '2v2', 15000], [66, '1v1', 15000]] as const) {
  const g = createGame(seed, preset, 3, false, undefined, true, 'mix');
  const t0 = performance.now();
  for (let i = 0; i < ticks; i++) step(g, []);
  const s = JSON.stringify(serialize(g, preset));
  let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  console.log(seed, preset, ticks, (h >>> 0).toString(16), 'kills', g.players.map((p) => p.stats.kills).join(','), 'ms', Math.round(performance.now() - t0));
}
