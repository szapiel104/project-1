/** Start podglądu modeli: najpierw pliki modeli (jak w grze), potem właściwy podgląd */
import './debug/errlog'; // dziennik błędów (window.__errors())
import { fetchLiveFixes, loadModels } from './render/modelstore';

// poprawki z edytora (baza + ta przeglądarka) nakładane przy wczytaniu, jak w grze (modelstore.ts)
await fetchLiveFixes(true);
await loadModels(undefined, { all: true });
await import('./viewer');
