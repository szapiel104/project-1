/**
 * Szczegóły pod paskiem wczytywania: co dokładnie się teraz wczytuje, jak długo trwa bieżący krok
 * i lista skończonych kroków z czasami. Gdy pasek stanie, od razu widać, na czym.
 * Licznik czasu tyka co 250 ms; jeśli stoi, to znaczy, że przeglądarka liczy ciężki krok w jednym kawałku
 * (wtedy opis kroku mówi o tym wprost).
 */
import { tx } from '../i18n';

export interface LoadInfo {
  /** Nowy krok: kończy poprzedni (trafia do listy z czasem) i pokazuje opis nowego */
  step(name: string, detail?: string): void;
  /** Zmiana opisu bieżącego kroku (np. licznik plików) */
  detail(text: string): void;
  /** Koniec wczytywania: zatrzymuje licznik i wypisuje czasy do konsoli */
  done(): void;
}

const sec = (ms: number): string => `${(ms / 1000).toFixed(1).replace('.', tx(',', '.'))} s`;

export function loadInfo(card: Element | null): LoadInfo {
  const det = document.createElement('p');
  det.className = 'loading-detail';
  const log = document.createElement('p');
  log.className = 'loading-log';
  card?.append(det, log);
  let name = '', text = '', since = performance.now();
  const doneSteps: string[] = [];
  const paint = (): void => {
    const took = performance.now() - since;
    det.textContent = text ? `${text} · ${tx('trwa', 'running for')} ${sec(took)}` : name ? `${tx('trwa', 'running for')} ${sec(took)}` : '';
  };
  const timer = setInterval(paint, 250);
  const close = (): void => {
    if (!name) return;
    doneSteps.push(`✓ ${name} ${sec(performance.now() - since)}`);
    log.textContent = doneSteps.join('   ');
  };
  return {
    step(n, d = '') { close(); name = n; text = d; since = performance.now(); paint(); },
    detail(d) { text = d; paint(); },
    done() {
      close();
      clearInterval(timer);
      det.textContent = '';
      console.info('[wczytywanie — kroki]', doneSteps.join(' | '));
    },
  };
}
