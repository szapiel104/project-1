/**
 * Chorągwie z herbem gracza: płachta w barwie drużyny z obszyciem, rękawem na drzewce i jaskółczym
 * ogonem, a na środku tarcza z herbem wybranym w „Mój ród” (boty dostają stały herb z numeru gracza).
 * Obraz płachty rysujemy raz na płótnie (canvas) na parę barwa + herb; płótno faluje w shaderze,
 * więc każda flaga łopocze miękko, a nie obraca się sztywno jak deska.
 */
import * as THREE from 'three';
import { avatarSvg, CREST_CHARGES, DIVISIONS, encodeCrest } from '../ui/avatars';
import { normal, texturesReady } from './textures';

/** Wspólny zegar falowania (sekundy) — ustawia go scena co klatkę */
export const flagTime = { value: 0 };

/** Wymiary płachty (jednostki mapy): długość od drzewca i wysokość */
export const FLAG_LEN = 0.32, FLAG_H = 0.2;

let clothGeo: THREE.BufferGeometry | null = null;
/** Płachta przyczepiona lewym brzegiem do drzewca (x = 0), gęsta siatka pod falowanie, koniec lekko opada */
export function bannerGeometry(): THREE.BufferGeometry {
  if (clothGeo) return clothGeo;
  const geo = new THREE.PlaneGeometry(FLAG_LEN, FLAG_H, 22, 7).translate(FLAG_LEN / 2, 0, 0);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), k = x / FLAG_LEN;
    // stały, lekki zwis: dolny róg dalej od drzewca opada bardziej niż górny
    p.setXYZ(i, x, y - k * k * 0.018 - k * (0.5 - y / FLAG_H) * 0.006, 0);
  }
  geo.computeVertexNormals();
  clothGeo = geo;
  return geo;
}

/** Stały herb bota (albo gracza bez herbu) liczony z numeru gracza — u wszystkich wychodzi ten sam */
export function defaultCrest(player: number): number {
  const i = Math.abs(player) + 3;
  const field = (i * 3) % 8, field2 = (i * 5 + 2) % 8;
  return encodeCrest({ field, field2, division: (i * 7) % DIVISIONS.length, charge: (i * 5 + 1) % CREST_CHARGES, tincture: 8 + (i % 2) });
}

const css = (hex: number): string => '#' + hex.toString(16).padStart(6, '0');
const shade = (hex: number, k: number): string => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return '#' + c.getHexString();
};

/** Rysuje płachtę: barwa drużyny, wełniane pasma, złote obszycie, ciemny rękaw, wycięty jaskółczy ogon, herb */
function paintBanner(ctx: CanvasRenderingContext2D, W: number, H: number, team: number, crestImg: HTMLImageElement | null): void {
  ctx.clearRect(0, 0, W, H);
  const notch = W * 0.16;      // głębokość jaskółczego ogona
  const sleeve = W * 0.065;    // rękaw nawinięty na drzewce
  const shape = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W - notch, H / 2); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  };
  ctx.save();
  shape();
  ctx.clip();
  // płótno w barwie drużyny
  ctx.fillStyle = css(team);
  ctx.fillRect(0, 0, W, H);
  // nierówno farbowana wełna: poziome pasma i drobne smugi (stałe ziarno — każda flaga tej barwy taka sama)
  let r = 7;
  const rnd = (): number => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  for (let y = 0; y < H; y += 2) {
    const v = rnd();
    ctx.fillStyle = v < 0.5 ? `rgba(0,0,0,${(0.5 - v) * 0.12})` : `rgba(255,240,220,${(v - 0.5) * 0.06})`;
    ctx.fillRect(0, y, W, 2);
  }
  for (let n = 0; n < 160; n++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`;
    ctx.fillRect(rnd() * W, rnd() * H, 6 + rnd() * 40, 1 + rnd() * 2);
  }
  // przyciemnienie przy brzegach (płótno grubsze przy obszyciu, wytarte od wiatru)
  const edge = ctx.createLinearGradient(0, 0, 0, H);
  edge.addColorStop(0, 'rgba(0,0,0,0.22)'); edge.addColorStop(0.12, 'rgba(0,0,0,0)');
  edge.addColorStop(0.88, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);
  // złote obszycie wzdłuż górnej i dolnej krawędzi oraz przy jaskółczym ogonie (cienka lamówka z ciemnym szwem)
  const band = H * 0.055;
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = '#3a2a12'; ctx.lineWidth = band * 1.5;
  shape(); ctx.stroke();
  ctx.strokeStyle = '#c9a23e'; ctx.lineWidth = band;
  shape(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,236,170,0.45)'; ctx.lineWidth = Math.max(1, band * 0.18);
  ctx.beginPath(); ctx.moveTo(0, band * 0.25); ctx.lineTo(W, band * 0.25); ctx.stroke();
  // rękaw na drzewce: ciemniejszy, z szwem
  ctx.fillStyle = shade(team, 0.55);
  ctx.fillRect(0, 0, sleeve, H);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(sleeve - 2, 0, 2, H);
  ctx.fillStyle = 'rgba(233,193,69,0.55)';
  for (let y = H * 0.06; y < H; y += H * 0.09) ctx.fillRect(sleeve + 3, y, 3, H * 0.035);
  // herb: tarcza na środku płachty (bliżej drzewca, bo koniec ma wycięcie), z cieniem pod spodem
  if (crestImg) {
    const ch = H * 0.7, cw = ch / 1.1;
    const cx = sleeve + (W - sleeve - notch * 0.6) / 2 - cw / 2, cy = (H - ch) / 2;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.filter = 'blur(3px)';
    ctx.drawImage(crestImg, cx + 3, cy + 4, cw, ch);
    ctx.restore();
    ctx.drawImage(crestImg, cx, cy, cw, ch);
  }
  ctx.restore();
}

/** Falowanie w shaderze: fala biegnie od drzewca do końca, rośnie z odległością; wierzchołki przy drzewcu stoją */
function addWave(m: THREE.MeshStandardMaterial): void {
  const L = FLAG_LEN.toFixed(4);
  const wave = `
    float fk = clamp(position.x / ${L}, 0.0, 1.0);
    float ph = uFlagTime * 4.0;
    #ifdef USE_INSTANCING
      ph += instanceMatrix[3][0] * 3.1 + instanceMatrix[3][2] * 1.7;
    #else
      ph += modelMatrix[3][0] * 3.1 + modelMatrix[3][2] * 1.7;
    #endif
    float wa = 0.026 * fk * (0.75 + 0.25 * sin(ph * 0.37));
    float wArg = fk * 8.5 - ph + position.y * 6.0;`;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlagTime = flagTime;
    sh.vertexShader = 'uniform float uFlagTime;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      {${wave}
        float dz = cos(wArg) * wa * 8.5 / ${L} + sin(wArg) * 0.026 / ${L};
        objectNormal = normalize(objectNormal + vec3(-dz * 0.6, 0.0, 0.0));
      }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {${wave}
        transformed.z += sin(wArg) * wa + sin(fk * 19.0 - ph * 1.7 + position.y * 24.0) * 0.004 * fk;
        transformed.x -= abs(sin(wArg)) * wa * 0.35;
        transformed.y -= fk * fk * 0.01 * (0.6 + 0.4 * sin(ph * 0.5));
      }`);
  };
  m.customProgramCacheKey = (): string => 'flagwave1';
}

const mats = new Map<string, THREE.MeshStandardMaterial>();
let weave: THREE.Texture | null | undefined;
function addWeave(m: THREE.MeshStandardMaterial): void {
  if (!weave || m.normalMap === weave) return;
  m.normalMap = weave;
  m.normalScale = new THREE.Vector2(0.55, 0.55);
  m.needsUpdate = true;
}

/** Materiał chorągwi dla barwy drużyny i herbu (null = bez herbu, sama płachta z obszyciem) */
export function bannerMaterial(team: number, crest: number | null): THREE.MeshStandardMaterial {
  const key = `${team}:${crest ?? '-'}`;
  const hit = mats.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5 });
  if (typeof document !== 'undefined') {
    const W = 512, H = 320;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    m.map = tex;
    if (ctx) {
      paintBanner(ctx, W, H, team, null);
      if (crest !== null) {
        const svg = avatarSvg(crest, 220).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
        const img = new Image();
        img.onload = (): void => { paintBanner(ctx, W, H, team, img); tex.needsUpdate = true; };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      }
    }
    // splot płótna z mapy normalnych (gęsto: kilka powtórzeń na płachtę); kopię robimy dopiero po wczytaniu
    // zdjęcia, bo kopia pustej jeszcze tekstury zostaje bez obrazka
    if (weave === undefined) {
      weave = null;
      const n = normal('burlap');
      if (n) void texturesReady().then(() => {
        if (!n.image && !(n as THREE.Texture & { mipmaps?: unknown[] }).mipmaps?.length) return;
        weave = n.clone();
        weave.repeat.set(3, 2);
        weave.needsUpdate = true;
        for (const x of mats.values()) addWeave(x);
      });
    }
    addWeave(m);
  } else m.color.setHex(team);
  addWave(m);
  mats.set(key, m);
  return m;
}

/** Podmienia płachty chorągwi w gotowym budynku na wersję z herbem właściciela */
export function applyCrest(root: THREE.Object3D, team: number, crest: number | null): void {
  const m = bannerMaterial(team, crest);
  root.traverse((o) => {
    if (o.name !== 'flagcloth') return;
    for (const c of o.children) if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = m;
  });
}
