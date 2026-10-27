import * as THREE from 'three';

/**
 * Światła punktowe (pula pochodni i ognisk, `scene.ts`) liczą się w KAŻDYM oświetlonym shaderze, dla każdego piksela:
 * three.js wkleja do shadera pętlę po wszystkich światłach i dla każdego liczy pełne odbicie (BRDF), także gdy
 * światło jest zgaszone (dzień: moc 0) albo piksel leży daleko poza jego zasięgiem (tłumienie daje wtedy dokładnie 0).
 *
 * Tu pętla pomija takie światło (`directLight.visible` three.js ustawia na „kolor po tłumieniu ≠ 0”), więc obraz
 * jest identyczny, a karta nie liczy odbić, które i tak wychodzą zerem. W dzień wszystkie lampy są zgaszone, więc
 * warunek jest ten sam dla całego ekranu i karta przeskakuje całą pracę; nocą — poza kręgiem kilku kroków od lampy.
 *
 * Liczba świateł w scenie się nie zmienia (zmiana = przebudowa wszystkich shaderów = przycięcie), zmienia się
 * tylko ich moc, więc ta łatka niczego nie przekompilowuje w trakcie gry.
 *
 * Wyłączenie do porównania wydajności: `?lampy=stare` w adresie.
 */
const OLD = typeof location !== 'undefined' && new URLSearchParams(location.search).get('lampy') === 'stare';

const CALL = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';

/** Wstawia pominięcie zgaszonych świateł punktowych do kawałka shadera (zwraca bez zmian, gdy nie pasuje) */
export function skipDarkPointLights(chunk: string): string {
  const start = chunk.indexOf('for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ )');
  if (start < 0) return chunk;
  const end = chunk.indexOf('#pragma unroll_loop_end', start);
  const at = chunk.indexOf(CALL, start);
  if (at < 0 || end < 0 || at > end) return chunk;
  return chunk.slice(0, at) + 'if ( directLight.visible ) ' + chunk.slice(at);
}

export const LIGHT_SKIP = !OLD;

const chunks = THREE.ShaderChunk as unknown as Record<string, string>;
if (LIGHT_SKIP) {
  const before = chunks.lights_fragment_begin!;
  const after = skipDarkPointLights(before);
  if (after === before) console.warn('[lightskip] nie znaleziono pętli świateł punktowych w three.js — łatka nieaktywna');
  chunks.lights_fragment_begin = after;
}
