/**
 * Wspólne kawałki shadera prawdziwego, objętościowego ognia (28.10.2026).
 * Płomień nie jest już płaskim obrazkiem zwróconym do kamery: promień z oka przechodzi przez bryłę
 * i zbiera światło z trójwymiarowego, unoszącego się w górę szumu — z każdej strony i z każdej wysokości
 * widać ten sam ogień, a nie obracającą się kartkę.
 */
export const FIRE_NOISE = /* glsl */ `
float fHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fHash(i), fHash(i + vec3(1, 0, 0)), f.x), mix(fHash(i + vec3(0, 1, 0)), fHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(fHash(i + vec3(0, 0, 1)), fHash(i + vec3(1, 0, 1)), f.x), mix(fHash(i + vec3(0, 1, 1)), fHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// turbulencja: drobne języki na większych kłębach, każda oktawa lekko skręcona, żeby nie było widać siatki
float fFbm(vec3 p, int oct) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 5; k++) {
    if (k >= oct) break;
    v += a * fNoise(p);
    p = vec3(p.x * 1.6 + p.z * 1.2, p.y * 2.03, p.z * 1.6 - p.x * 1.2) + 3.1;
    a *= 0.5;
  }
  return v;
}
// barwa ognia od temperatury: ciemna czerwień przy brzegach, pomarańcz, żółć, prawie biały rdzeń
vec3 fRamp(float t) {
  vec3 c = mix(vec3(0.35, 0.02, 0.0), vec3(1.0, 0.22, 0.02), smoothstep(0.05, 0.35, t));
  c = mix(c, vec3(1.0, 0.58, 0.1), smoothstep(0.3, 0.6, t));
  c = mix(c, vec3(1.0, 0.8, 0.35), smoothstep(0.62, 0.9, t));
  c = mix(c, vec3(1.0, 0.93, 0.7), smoothstep(0.9, 1.0, t));
  // bez przepalenia: najgorętszy rdzeń tylko trochę ponad biel ekranu (wcześniej ×2,7 — płomienie świeciły na biało i raziły)
  return c * (0.55 + 0.7 * t * t);
}
// przecięcie promienia z prostopadłościanem: (wejście, wyjście)
vec2 fBox(vec3 o, vec3 d, vec3 lo, vec3 hi) {
  vec3 inv = 1.0 / d;
  vec3 t0 = (lo - o) * inv, t1 = (hi - o) * inv;
  vec3 mn = min(t0, t1), mx = max(t0, t1);
  return vec2(max(max(mn.x, mn.y), mn.z), min(min(mx.x, mx.y), mx.z));
}
`;
