import { expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { CHANGES } from '../src/data/changelog';

it('dziennik zmian dla graczy: najnowszy wpis to bieżąca wersja, punkty w obu językach (30.10.2026)', () => {
  const version = (pkg as { version: string }).version;
  expect(CHANGES[0]!.v).toBe(version);
  const seen = new Set<string>();
  for (const c of CHANGES) {
    expect(seen.has(c.v)).toBe(false); seen.add(c.v);
    expect(c.date).toMatch(/^\d{4}-\d\d-\d\d$/);
    expect(c.pl.length).toBeGreaterThan(0);
    expect(c.en.length).toBe(c.pl.length);
    for (const s of [...c.pl, ...c.en]) expect(s.trim().length).toBeGreaterThan(5);
  }
});
