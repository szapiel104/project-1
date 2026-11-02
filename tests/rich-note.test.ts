import { describe, expect, it } from 'vitest';
import { plainRich } from '../src/ui/richNote';

describe('uwagi testera: znaczniki formatowania', () => {
  it('skrót bez znaczników', () => {
    expect(plainRich('**Drwal** stoi\n- [czerwony]las[/czerwony] daleko\n# Tytuł')).toBe('Drwal stoi las daleko Tytuł');
  });
});
