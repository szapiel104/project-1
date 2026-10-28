// Wcześniejsze pobieranie tekstur (src/render/prefetch.ts): lista ma się zgadzać z tym, o co prosi gra
import { describe, expect, it } from 'vitest';
import { TERRAIN_FILES, terrainUrl } from '../src/render/prefetch';
import { photoUrls } from '../src/render/textures';

const groundSrc = Object.values(import.meta.glob('../src/render/ground.ts', { query: '?raw', import: 'default', eager: true }))[0] as string;
const terrainOnDisk = Object.keys(import.meta.glob('../public/textures/terrain/*.ktx2', { query: '?url', import: 'default', eager: true })).map((k) => k.slice(k.lastIndexOf('/') + 1, -5));
const cc0OnDisk = new Set(Object.keys(import.meta.glob('../public/textures/cc0/*.ktx2', { query: '?url', import: 'default', eager: true })).map((k) => k.slice(k.lastIndexOf('/') + 1, -5)));

describe('wcześniejsze pobieranie tekstur', () => {
  it('lista terenu = wszystkie tekstury, o które prosi ground.ts', () => {
    const used = new Set([...groundSrc.matchAll(/\btex\('([\w-]+)'/g)].map((m) => m[1]!));
    expect(new Set(TERRAIN_FILES)).toEqual(used);
  });
  it('każda tekstura terenu z listy ma plik .ktx2', () => {
    for (const f of TERRAIN_FILES) expect(terrainOnDisk).toContain(f);
  });
  it('adres terenu jest ten sam co w grze (z numerem wersji)', () => {
    expect(terrainUrl('grass1')).toMatch(/textures\/terrain\/grass1\.jpg\?v=\d+$/);
  });
  it('każda zdjęciowa tekstura ma plik .ktx2', () => {
    for (const u of photoUrls()) expect(cc0OnDisk.has(u.slice(u.lastIndexOf('/') + 1, -4))).toBe(true);
  });
});
