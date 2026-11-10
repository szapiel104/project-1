/** Start podglądu modeli: najpierw pliki modeli (jak w grze), potem właściwy podgląd */
import './debug/errlog'; // dziennik błędów (window.__errors())
import { loadModels, setLiveFixes } from './render/modelstore';
import type { Fix } from './render/modelfix';

/**
 * Poprawki z edytora (baza model_fixes + zapis w tej przeglądarce) nakładamy na modele od razu przy wczytaniu,
 * tak jak gra robi to z src/data/modelFixes.json — dzięki temu po odświeżeniu widać wszystkie rodzaje zmian
 * (przesunięcie, kopia, tekstura, nowe bryły, widoczne z obu stron, zasoby). Dłuższa lista wygrywa.
 */
async function liveFixes(): Promise<void> {
  const map: Record<string, Fix[]> = {};
  try {
    const { supa } = await import('./net/supa');
    const res = await Promise.race([supa.from('model_fixes').select('model,fixes'), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
    for (const row of ((res as { data?: { model: string; fixes: Fix[] }[] } | null)?.data ?? [])) if (Array.isArray(row.fixes)) map[row.model] = row.fixes;
  } catch { /* bez bazy */ }
  try {
    for (let k = 0; k < localStorage.length; k++) {
      const key = localStorage.key(k);
      if (!key?.startsWith('p1-model-fixes:')) continue;
      const v = JSON.parse(localStorage.getItem(key) ?? 'null') as Fix[] | null, id = key.slice('p1-model-fixes:'.length);
      if (Array.isArray(v) && v.length > (map[id]?.length ?? 0)) map[id] = v;
    }
  } catch { /* prywatne okno */ }
  setLiveFixes(map);
}

await liveFixes();
await loadModels();
await import('./viewer');
