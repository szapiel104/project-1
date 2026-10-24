/**
 * Animacje ciosów i strzałów żołnierzy (wyniesione z scene.ts, 24.10.2026): klatki kluczowe sprawdzone w Blenderze
 * i funkcje, które dla fazy ciosu u (0 = trafienie, 1 = następne trafienie) zwracają kąty ręki, broni i ciała.
 */
/** Cios toporem zbója: [kąt ręki, kąt topora w dłoni] dla fazy u (0 = chwila trafienia, 1 = następne trafienie).
 *  Klatki kluczowe sprawdzone w Blenderze (tools/models/render_preview.py, POSE="ręka,broń"). */
export const AXE_KEYS: [number, number, number][] = [
  [0, -1.25, -0.15],   // cięcie dociągnięte: topór przed sobą, ostrzem w dół
  [0.25, -0.7, -1.5],  // garda: topór uniesiony skośnie przed piersią
  [0.6, -0.7, -1.5],
  [0.86, -3.25, -1.3], // zamach: ręka w górze, topór za głową
  [0.94, -2.2, -0.9],  // w pół cięcia
  [1, -1.25, -0.15],
];
/** Pchnięcie włócznią: [kąt ręki, kąt włóczni, wysunięcie] dla fazy u (0 = trafienie, 1 = następne trafienie).
 *  Włócznia przez całą walkę opuszczona poziomo na wroga (1,57 = poziomo); cios to cofnięcie i wypad w przód. */
export const SPEAR_KEYS: [number, number, number, number][] = [
  [0, -1.4, 1.6, 0.05],     // pchnięcie: ręka wyprostowana w przód, grot w przeciwniku
  [0.22, -0.85, 1.54, 0],   // wycofanie po ciosie
  [0.62, -0.8, 1.52, 0],    // garda: włócznia w dłoni poziomo na wysokości pasa, grotem we wroga
  [0.84, -0.4, 1.48, -0.03], // cofnięcie ręki do pchnięcia
  [1, -1.4, 1.6, 0.05],
];
export function spearThrust(u: number): [number, number, number] {
  u = Math.min(1, Math.max(0, u));
  for (let k = 1; k < SPEAR_KEYS.length; k++) {
    const a = SPEAR_KEYS[k - 1]!, b = SPEAR_KEYS[k]!;
    if (u <= b[0]) {
      const t = (u - a[0]) / Math.max(1e-6, b[0] - a[0]);
      // wypad jest szybki (zaczyna się ostro), reszta płynna
      const e = k === SPEAR_KEYS.length - 1 ? 1 - (1 - t) ** 3 : t * t * (3 - 2 * t);
      return [a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e, a[3] + (b[3] - a[3]) * e];
    }
  }
  return [SPEAR_KEYS[0]![1], SPEAR_KEYS[0]![2], SPEAR_KEYS[0]![3]];
}
/** Kombinacja mieczem (strażnik miejski, zbrojny): cięcie z góry, z lewej na prawą, z prawej na lewą i cięcie z obrotem.
 *  Każdy cios: [kąt ręki, kąt miecza w dłoni, obrót ciała]. Faza u: 0 = chwila trafienia, 1 = następne trafienie.
 *  Do u = 0,25 wraca do gardy po poprzednim ciosie, potem szykuje i zadaje następny. Klatki sprawdzone w Blenderze. */
export type SwordKey = [number, number, number, number];
export const GARDA: [number, number, number] = [-0.6, -1.6, 0];
export const SWORD_BLOWS: { keys: SwordKey[]; end: [number, number, number] }[] = [
  // z góry: zamach za głowę i cięcie w dół
  { keys: [[0.6, ...GARDA], [0.86, -3.1, -1.4, 0], [0.94, -2.0, -0.9, 0], [1, -1.2, -0.1, 0]], end: [-1.2, -0.1, 0] },
  // z lewej na prawą: ciało skręcone w lewo (miecz po lewej stronie), klinga poziomo, zamaszyste cięcie w poprzek
  { keys: [[0.55, ...GARDA], [0.8, -1.45, -0.2, 1.25], [1, -1.45, -0.05, -0.95]], end: [-1.45, -0.05, -0.95] },
  // z prawej na lewą: skręt w prawo i cięcie w drugą stronę
  { keys: [[0.55, ...GARDA], [0.8, -1.5, -0.2, -1.25], [1, -1.45, -0.05, 0.95]], end: [-1.45, -0.05, 0.95] },
  // z obrotem: krótki skręt, pełny obrót z wyciągniętym mieczem i cięcie na końcu obrotu
  { keys: [[0.5, ...GARDA], [0.68, -1.5, -0.15, 0.7], [1, -1.45, -0.05, 0.7 - Math.PI * 2]], end: [-1.45, -0.05, 0.7] },
];
/** Strzał z łuku. Ręka cięciwy ma pełny obrót w barku [x, y, z] (Euler 'YXZ') i zgięcie łokcia — kąty policzone
 *  odwrotną kinematyką tak, żeby dłoń trafiała w miejsca: przy naciągu do policzka, przy kołczanie nad prawy bark itd.
 *  (sprawdzone w Blenderze: render_preview.py archer z POSE, ARMYZ, ELBOW, LARM).
 *  Klatka: [u, x, y, z, łokieć, ręka z łukiem, skręt ciała]; u: 0 = chwila strzału, 1 = następny strzał. */
export const BOW_KEYS: number[][] = [
  [0, -2.099, 0.296, 0.456, -2.387, -1.5, -0.35],    // wypuszczenie: dłoń odskakuje od cięciwy za ucho
  [0.12, -2.064, 1.519, -0.911, -2.524, -1.45, -0.3],
  [0.3, -3.01, 0.989, 0.253, -0.944, -0.95, 0],      // sięga przez bark do kołczanu, łuk opuszczony
  [0.42, -2.659, 1.195, -0.137, -0.839, -1.0, 0],    // wyciąga strzałę
  [0.56, -2.927, 0.881, -1.566, -0.107, -1.45, -0.15], // nakłada strzałę: dłoń przy łuku
  [0.88, -2.806, 1.913, -1.512, -1.885, -1.55, -0.35], // pełny naciąg: łokieć w bok na wysokości barku, dłoń przy policzku
  [1, -2.806, 1.913, -1.512, -1.885, -1.55, -0.35],
];
/** [x, y, z, łokieć, ręka z łukiem, skręt ciała] */
export function bowShot(u: number): number[] {
  u = Math.min(1, Math.max(0, u));
  for (let k = 1; k < BOW_KEYS.length; k++) {
    const a = BOW_KEYS[k - 1]!, b = BOW_KEYS[k]!;
    if (u <= b[0]!) {
      const t = (u - a[0]!) / Math.max(1e-6, b[0]! - a[0]!), e = t * t * (3 - 2 * t);
      return a.slice(1).map((v, i) => v + (b[i + 1]! - v) * e);
    }
  }
  return BOW_KEYS[0]!.slice(1);
}
/** Jak pada poległy: 0 na plecy (40%), 1 na twarz (25%), 2 na bok (20%), 3 osuwa się i przewraca na plecy (15%) */
export function deathKind(id: number): 0 | 1 | 2 | 3 {
  const h = (Math.imul(id, 2654435761) >>> 0) % 100;
  return h < 40 ? 0 : h < 65 ? 1 : h < 85 ? 2 : 3;
}
export function swordCombo(hits: number, u: number): [number, number, number] {
  u = Math.min(1, Math.max(0, u));
  const prev = SWORD_BLOWS[(hits + SWORD_BLOWS.length - 1) % SWORD_BLOWS.length]!, next = SWORD_BLOWS[hits % SWORD_BLOWS.length]!;
  const ease = (t: number): number => t * t * (3 - 2 * t);
  const mix = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
  // powrót do gardy po poprzednim ciosie
  if (u < 0.25) return hits ? mix(prev.end, GARDA, ease(u / 0.25)) : GARDA;
  const k = next.keys;
  if (u <= k[0]![0]) return GARDA;
  for (let i = 1; i < k.length; i++) {
    const a = k[i - 1]!, b = k[i]!;
    if (u <= b[0]) return mix(a.slice(1), b.slice(1), ease((u - a[0]) / Math.max(1e-6, b[0] - a[0])));
  }
  return next.end;
}
export function axeChop(u: number): [number, number] {
  u = Math.min(1, Math.max(0, u));
  for (let k = 1; k < AXE_KEYS.length; k++) {
    const a = AXE_KEYS[k - 1]!, b = AXE_KEYS[k]!;
    if (u <= b[0]) {
      const t = (u - a[0]) / Math.max(1e-6, b[0] - a[0]), e = t * t * (3 - 2 * t);
      return [a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e];
    }
  }
  return [AXE_KEYS[0]![1], AXE_KEYS[0]![2]];
}
