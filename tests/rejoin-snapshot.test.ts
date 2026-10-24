import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../src/sim/save';
import { createGame, stateHash } from '../src/sim/state';
import { step } from '../src/sim/step';

describe('powrót do meczu: zapis w trakcie gry liczy się dalej tak samo', () => {
  it('2v2 z botami: po wczytaniu stan idzie krok w krok z oryginałem', () => {
    const g = createGame(77, '2v2', 2, false, [0, 1]);
    for (let i = 0; i < 6000; i++) step(g, []);
    const copy = deserialize(JSON.parse(JSON.stringify(serialize(g, '2v2'))))!;
    expect(stateHash(copy)).toBe(stateHash(g));
    for (let i = 0; i < 6000; i++) {
      step(g, []); step(copy, []);
      if (i % 50 === 0) expect(stateHash(copy), `tick ${g.tick}`).toBe(stateHash(g));
    }
    expect(JSON.stringify(serialize(copy, '2v2'))).toBe(JSON.stringify(serialize(g, '2v2')));
  }, 240_000);
});
