import { describe, expect, it } from 'vitest';
import data from '../src/render/models/bandit.json';

describe('model zbója (tools/models/bandit.py)', () => {
  const m = data as unknown as Record<string, unknown[]>;
  it('ma ciało z bliska i z daleka oraz topór w obu wersjach', () => {
    for (const k of ['static', 'leg', 'arm', 'far_static', 'far_leg', 'far_arm', 'axe', 'axeFar']) expect(m[k]?.length, k).toBeGreaterThan(0);
    expect(m.hand).toHaveLength(3);
    expect(m.shoulder).toHaveLength(3);
  });
});
