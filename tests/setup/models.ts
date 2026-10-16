// Testy w Node: modele z Blendera czytamy z dysku (w grze pobiera je loadModels na ekranie wczytywania)
import { setModel } from '../../src/render/modelstore';

const files = import.meta.glob('../../src/render/models/*.json', { import: 'default', eager: true }) as Record<string, unknown>;
for (const [key, data] of Object.entries(files)) setModel(key.slice(key.lastIndexOf('/') + 1, -'.json'.length), data);
