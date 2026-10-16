/** Start podglądu modeli: najpierw pliki modeli (jak w grze), potem właściwy podgląd */
import { loadModels } from './render/modelstore';

await loadModels();
await import('./viewer');
