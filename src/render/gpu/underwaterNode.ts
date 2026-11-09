import type * as THREE from 'three';
import { sharedNoise, WATER_Y } from '../ground';

/**
 * Widok spod wody na WebGPU (Michał 3.11.2026: „wrzucam kamerę pod wodę i widzę normalny ekran, a ma być jakbym
 * nurkował”). Jedno przejście na cały obraz, tak jak robią to gry z nurkowaniem (Subnautica, pakiety „Waterline”,
 * OpenMW): maska linii wody z bliskiej płaszczyzny kamery (kamera do połowy w wodzie = obraz przecięty linią),
 * załamanie (falujący obraz), pochłanianie światła po drodze (Beer–Lambert: czerwień gaśnie pierwsza) i rozproszenie
 * w toni (mgła w kolorze wody, gęstnieje z odległością, ciemnieje z głębokością), kaustyki na dnie i wszystkim pod
 * wodą (świetlna siatka z fal, słabnie w głąb, gaśnie nocą), promienie słońca w toni (krótki marsz wzdłuż promienia
 * widzenia: w każdym kroku światło przechodzące przez falującą taflę nad tym punktem) i ciemniejsze brzegi kadru.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UnderwaterIn {
  /** Tekstura obrazu sceny (węzeł z pass().getTextureNode('output')) */
  col: any;
  /** Tekstura głębi sceny */
  dep: any;
  /** Kolor obrazu po dotychczasowych efektach (AO, cienie chmur) */
  c: any;
  /** Pora nocy 0..1 */
  night: any;
  /** Kierunek do słońca (świat), znormalizowany */
  sun: any;
  /** Kamera sceny (w przejściu obrazu wbudowane węzły kamery dotyczą prostokąta na cały ekran) */
  cam: { pos: any; world: any; projInv: any };
  /** 1 = w środku (sztolnia kopalni leży 80 m pod mapą, poniżej tafli): bez efektu wody */
  indoor?: any;
}

export function underwater(T: any, i: UnderwaterIn): any {
  // liczone tylko, gdy kamera jest przy tafli albo pod nią (warunek wspólny dla całej klatki — karta pomija resztę)
  return T.Fn(() => {
    const out = T.vec3(i.c).toVar();
    // w sztolni kopalni (pod mapą, niżej niż tafla) bez wody: wcześniej całe wnętrze barwiło się na niebiesko-zielono,
    // a płomienie latarń wyglądały na niebieskie (Michał 9.11.2026: „świecą się lekko i na niebiesko”)
    const dry = i.indoor ?? T.float(0);
    T.If(i.cam.pos.y.lessThan(WATER_Y + 0.4).and(dry.lessThan(0.5)), () => { out.assign(underwaterBody(T, i)); });
    return out;
  })();
}

function underwaterBody(T: any, i: UnderwaterIn): any {
  const { vec2, vec3, vec4, float, mix, max, min, abs, pow, exp, sin, clamp, smoothstep, length, normalize, dot, texture,
    screenUV, getViewPosition, time, Loop } = T;
  const cameraPosition = i.cam.pos, cameraWorldMatrix = i.cam.world, cameraProjectionMatrixInverse = i.cam.projInv;
  const noise: THREE.Texture = sharedNoise();
  const W = float(WATER_Y);
  const t = time;
  // położenie w świecie z głębi (0 = bliska płaszczyzna kamery)
  const world = (uv: any, d: any): any => cameraWorldMatrix.mul(vec4(getViewPosition(uv, d, cameraProjectionMatrixInverse), 1)).xyz;
  // falująca tafla: drobne podniesienie linii wody, żeby przecięcie kadru nie było linijką
  const wave = (xz: any): any => sin(xz.x.mul(1.7).add(t.mul(1.3))).mul(0.018).add(sin(xz.y.mul(2.3).sub(t.mul(1.1))).mul(0.014));
  const near = world(screenUV, float(0));
  const underMask = smoothstep(0.004, -0.004, near.y.sub(W.add(wave(near.xz))));

  // załamanie: obraz faluje (mocniej przy brzegach kadru)
  const wob = vec2(sin(screenUV.y.mul(38).add(t.mul(2.1))), sin(screenUV.x.mul(31).sub(t.mul(1.7)))).mul(0.0022);
  const uvW = screenUV.add(wob);
  const d = i.dep.sample(uvW).r;
  const hit = world(uvW, d);
  const sky = d.greaterThanEqual(0.99999);
  const dist = select3(T, sky, float(60), length(hit.sub(cameraPosition)));
  const base = i.col.sample(uvW).rgb;

  // światło w toni: słabnie z głębokością kamery i nocą
  const camDeep = max(W.sub(cameraPosition.y), 0);
  const day = float(1).sub(i.night.mul(0.88));
  const sunUp = smoothstep(-0.05, 0.25, i.sun.y);
  const lightK = day.mul(exp(camDeep.mul(-0.18)));

  // kaustyki: dwie warstwy szumu płynące w różne strony, jasne tam, gdzie się „przecinają” (cienkie świetlne żyłki)
  const caustic = (xz: any): any => {
    const a = texture(noise, xz.mul(0.31).add(vec2(t.mul(0.021), t.mul(0.013)))).r;
    const b = texture(noise, xz.mul(0.37).add(vec2(t.mul(-0.017), t.mul(0.024)))).g;
    return pow(clamp(float(1).sub(abs(a.sub(b)).mul(5)), 0, 1), 4);
  };
  // punkt pod wodą: światło przeszło przez taflę nad nim (rzut wzdłuż promienia słońca)
  const hitDeep = max(W.sub(hit.y), 0);
  const sunXZ = i.sun.xz.div(max(i.sun.y, 0.25));
  const cHit = caustic(hit.xz.add(sunXZ.mul(hitDeep)));
  const causticLight = cHit.mul(exp(hitDeep.mul(-0.35))).mul(smoothstep(0, 0.15, hitDeep)).mul(sunUp).mul(day);
  let lit: any = base.mul(float(1).add(causticLight.mul(T.select(sky, float(0), float(1.6)))));

  // pochłanianie po drodze i rozproszenie w toni
  const tint = vec3(0.022, 0.105, 0.115).mul(lightK);
  const absorb = exp(vec3(0.85, 0.28, 0.22).mul(dist).negate());
  const fog = float(1).sub(exp(dist.mul(-0.3)));
  lit = mix(lit.mul(absorb), tint, fog);

  // promienie słońca: 6 kroków wzdłuż promienia widzenia (do 9 m), w każdym światło spod falującej tafli
  const dir = normalize(hit.sub(cameraPosition));
  const span = min(dist, 9);
  const shafts = float(0).toVar();
  Loop(6, ({ i: k }: any) => {
    const s = float(k).add(0.5).div(6).mul(span);
    const p = cameraPosition.add(dir.mul(s));
    const pd = max(W.sub(p.y), 0);
    shafts.addAssign(caustic(p.xz.add(sunXZ.mul(pd)).mul(0.35)).mul(exp(pd.mul(-0.3))).mul(exp(s.mul(-0.22))));
  });
  lit = lit.add(vec3(0.5, 0.75, 0.7).mul(shafts.div(6)).mul(span.div(9)).mul(sunUp).mul(lightK).mul(0.55));

  // ciemniejsze brzegi kadru (maska nurka)
  const v = screenUV.sub(0.5);
  lit = lit.mul(float(1).sub(dot(v, v).mul(0.9)));
  return mix(i.c, lit, underMask);
}

/** select na wektorach i liczbach (wspólna postać dla TSL) */
function select3(T: any, cond: any, a: any, b: any): any { return T.select(cond, a, b); }
