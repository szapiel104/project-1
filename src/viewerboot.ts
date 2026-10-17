/** Start podglądu modeli: najpierw pliki modeli (jak w grze), potem właściwy podgląd */
import './debug/errlog'; // dziennik błędów (window.__errors())
import { loadModels } from './render/modelstore';

await loadModels();
await import('./viewer');
