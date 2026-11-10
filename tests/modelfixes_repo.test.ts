import { describe, expect, it } from 'vitest';
import { applyModelFixes, missedFixes, type Fix } from '../src/render/modelfix';
import FIXES from '../src/data/modelFixes.json';

// poprawki z edytora (src/data/modelFixes.json) muszą trafiać w swoje modele: każda nietrafiona to zmiana Michała,
// której gracze by nie zobaczyli
const texts = import.meta.glob('../src/render/models/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const ALIAS: Record<string, string> = { oremine: 'mine' };
describe('poprawki modeli z repozytorium', () => {
  for (const [key, fixes] of Object.entries(FIXES as unknown as Record<string, Fix[]>)) {
    const name = ALIAS[key] ?? key.toLowerCase();
    const file = `../src/render/models/${name}.json`;
    it.skipIf(!texts[file])(`${key}: wszystkie trafiają (${fixes.length})`, () => {
      const data = JSON.parse(texts[file]!) as Record<string, unknown>;
      applyModelFixes(name, data, fixes);
      expect(missedFixes.get(name) ?? 0).toBe(0);
    });
  }
});
