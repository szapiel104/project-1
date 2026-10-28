/**
 * Tworzenie okna grafiki (kontekstu WebGL) z zapasowymi próbami.
 *
 * Na części komputerów przeglądarka odmawia kontekstu przy wymaganiach gry (mocniejsza karta, wygładzanie krawędzi
 * MSAA): „WebGL creation failed … FEATURE_FAILURE_EGL_NO_CONFIG / EXHAUSTED_DRIVERS” i gra w ogóle nie startowała
 * (zgłoszenie znajomego Michała, 28.10.2026). Tu próbujemy po kolei coraz prostszych ustawień: bez prośby o mocniejszą
 * kartę, bez wygładzania, na końcu z prośbą o każdą kartę (także programową). Gdy nic nie wyjdzie — rzuca błąd
 * `NoWebGLError`, a boot.ts pokazuje graczowi, co zrobić (włączyć przyspieszanie sprzętowe w przeglądarce).
 */
import * as THREE from 'three';

export class NoWebGLError extends Error {
  constructor(reason: string) { super(`Brak WebGL: ${reason}`); this.name = 'NoWebGLError'; }
}

/** Ustawienia, z którymi udało się utworzyć kontekst gry (do F3 i dziennika błędów) */
export let glFallback = '';

export function createRenderer(params: THREE.WebGLRendererParameters, label = 'gra'): THREE.WebGLRenderer {
  const tries: [string, THREE.WebGLRendererParameters][] = [
    ['', { ...params, powerPreference: 'high-performance' }],
    ['bez prośby o mocniejszą kartę', { ...params, powerPreference: 'default' }],
    ['bez wygładzania krawędzi', { ...params, powerPreference: 'default', antialias: false }],
    ['tryb awaryjny (dowolna karta)', { ...params, powerPreference: 'low-power', antialias: false, failIfMajorPerformanceCaveat: false, stencil: false }],
  ];
  let last: unknown = null;
  for (const [name, p] of tries) {
    try {
      const r = new THREE.WebGLRenderer(p);
      if (name && label === 'gra') { glFallback = name; console.warn(`[${label}] WebGL utworzony dopiero z ustawieniami: ${name}`); }
      return r;
    } catch (e) {
      last = e;
    }
  }
  throw new NoWebGLError(last instanceof Error ? last.message : String(last));
}
