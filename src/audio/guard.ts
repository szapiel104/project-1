/**
 * Bezpiecznik dźwięku (28.10.2026, zgłoszenie Michała: „gra się zawiesza, setTargetAtTime … non-finite”).
 *
 * Przeglądarka rzuca wyjątek, gdy do parametru dźwięku trafi NaN albo nieskończoność. Wyjątek leciał z pętli
 * klatki (main.ts → nature → bed), przerywał ją przed kolejnym `requestAnimationFrame` i obraz stawał na zawsze.
 * Tutaj, w jednym miejscu dla całego dźwięku, takie wywołanie jest po cichu pomijane (parametr zostaje na
 * poprzedniej wartości), a do dziennika błędów trafia jedno ostrzeżenie ze stosem, żeby dało się znaleźć źródło.
 */
let warned = 0;
function bad(what: string, args: ArrayLike<unknown>): void {
  if (warned++ < 3) console.warn(`[dźwięk] pominięte ${what} z niepoprawną liczbą`, Array.from(args), new Error().stack);
}
const ok = (v: unknown): boolean => typeof v !== 'number' || Number.isFinite(v);

let installed = false;
export function installAudioGuard(): void {
  if (installed || typeof AudioParam === 'undefined') return;
  installed = true;
  const P = AudioParam.prototype as unknown as Record<string, (...a: unknown[]) => AudioParam>;
  for (const m of ['setTargetAtTime', 'setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'cancelScheduledValues']) {
    const orig = P[m];
    if (typeof orig !== 'function') continue;
    P[m] = function (this: AudioParam, ...a: unknown[]): AudioParam {
      for (const v of a) if (!ok(v)) { bad(m, a); return this; }
      return orig.apply(this, a);
    };
  }
  const desc = Object.getOwnPropertyDescriptor(AudioParam.prototype, 'value');
  if (desc?.set && desc.get) {
    const set = desc.set;
    Object.defineProperty(AudioParam.prototype, 'value', {
      ...desc,
      set(this: AudioParam, v: number) { if (!Number.isFinite(v)) { bad('value', [v]); return; } set.call(this, v); },
    });
  }
}
