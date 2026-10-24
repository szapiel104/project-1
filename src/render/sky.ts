/**
 * Niebo (wyniesione z scene.ts, 24.10.2026): kopuła z gradientem zależnym od wysokości i słońca, łuna o świcie
 * i zmierzchu, gwiazdy mrugające nocą, księżyc z kraterami i poświatą, tarcza słońca. W deszczu i mgle niebo szarzeje.
 */
import * as THREE from 'three';

/** Stan pogody i pory potrzebny do narysowania nieba w tej klatce */
export interface SkyFrame {
  camera: THREE.PerspectiveCamera;
  /** Deszcz, zachmurzenie, mglistość dnia, noc: 0..1 */
  rain: number; cover: number; dayMist: number; night: number;
  /** Czas sceny (mruganie gwiazd) */
  time: number;
  /** Kierunek światła: w dzień słońce, nocą droga księżyca */
  sunDir: THREE.Vector3;
  /** Godzina na zegarze gry (prawdziwe położenie słońca) */
  hour: number;
}

export class SkyDome {
  private sky: { group: THREE.Group; stars: THREE.Points; moon: THREE.Sprite; dome: THREE.Mesh; sunDisc: THREE.Sprite } | null = null;
  constructor(private scene: THREE.Scene) {}

  // --- niebo nocą: gwiazdy, księżyc z poświatą; w deszczu ciemne chmury zasłaniają niebo ---
  update(p: SkyFrame): void {
    if (!this.sky) {
      const group = new THREE.Group();
      const n = 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        // tylko górna półkula, gęściej nad horyzontem nie trzeba
        const u = Math.random(), v = Math.random() * 0.95;
        const th = u * Math.PI * 2, ph = Math.acos(v);
        pos.set([Math.sin(ph) * Math.cos(th) * 380, Math.cos(ph) * 380, Math.sin(ph) * Math.sin(th) * 380], i * 3);
        const b = 0.6 + Math.random() * 0.4, warm = Math.random() < 0.2;
        col.set([b, b * (warm ? 0.9 : 1), b * (warm ? 0.75 : 1.05)], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      // każda gwiazda mruga we własnym rytmie (faza i tempo w atrybucie), jasne bywają większe
      const ph = new Float32Array(n), sz = new Float32Array(n);
      for (let i = 0; i < n; i++) { ph[i] = Math.random() * 6.28; sz[i] = Math.random() < 0.08 ? 3.2 : 1.4 + Math.random() * 1.2; }
      geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
      geo.setAttribute('size', new THREE.BufferAttribute(sz, 1));
      const stars = new THREE.Points(geo, new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, opacity: { value: 0 } },
        vertexShader: 'attribute float phase; attribute float size; attribute vec3 color; uniform float time; varying vec3 vC; varying float vA; void main() { vC = color; float tw = 0.55 + 0.45 * sin(time * (1.5 + fract(phase * 7.1) * 3.0) + phase); vA = tw; gl_PointSize = size * (0.7 + tw * 0.5); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float opacity; varying vec3 vC; varying float vA; void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vC, a * vA * opacity); }',
        transparent: true, depthWrite: false, fog: false,
      }));
      // księżyc jak prawdziwy: tarcza z ciemnymi „morzami”, drobnymi kraterami, ciemniejszym brzegiem i szeroką, słabą poświatą
      const cv = document.createElement('canvas'); cv.width = cv.height = 512;
      const x = cv.getContext('2d')!;
      const glow = x.createRadialGradient(256, 256, 40, 256, 256, 256);
      glow.addColorStop(0, 'rgba(200,215,255,0.35)'); glow.addColorStop(0.3, 'rgba(160,180,230,0.10)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = glow; x.fillRect(0, 0, 512, 512);
      const R = 46;
      x.save(); x.beginPath(); x.arc(256, 256, R, 0, Math.PI * 2); x.clip();
      x.fillStyle = '#e6e4dc'; x.fillRect(256 - R, 256 - R, R * 2, R * 2);
      const rnd = (k: number): number => { const v = Math.sin(k * 91.7) * 43758.5; return v - Math.floor(v); };
      // morza: duże, nieregularne, szarawe plamy
      for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(120,124,132,${0.18 + rnd(i) * 0.2})`; x.beginPath(); x.ellipse(232 + rnd(i + 3) * 40, 236 + rnd(i + 7) * 36, 4 + rnd(i + 11) * 13, 3 + rnd(i + 13) * 10, rnd(i + 17) * 3, 0, Math.PI * 2); x.fill(); }
      // kratery: jasny brzeg, ciemny środek
      for (let i = 0; i < 40; i++) { const cx = 214 + rnd(i + 50) * 84, cy = 214 + rnd(i + 70) * 84, cr = 0.8 + rnd(i + 90) * 3.2; x.fillStyle = 'rgba(95,98,106,0.45)'; x.beginPath(); x.arc(cx, cy, cr, 0, Math.PI * 2); x.fill(); x.strokeStyle = 'rgba(250,250,245,0.35)'; x.lineWidth = 0.7; x.stroke(); }
      // ciemniejszy brzeg tarczy (kula, nie płaski krążek)
      const limb = x.createRadialGradient(250, 250, R * 0.2, 256, 256, R);
      limb.addColorStop(0, 'rgba(0,0,0,0)'); limb.addColorStop(0.85, 'rgba(0,0,10,0.12)'); limb.addColorStop(1, 'rgba(0,0,20,0.35)');
      x.fillStyle = limb; x.fillRect(256 - R, 256 - R, R * 2, R * 2);
      x.restore();
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, fog: false, depthWrite: false }));
      moon.scale.setScalar(110);
      // kopuła nieba: u góry głęboki błękit, przy horyzoncie kolor mgły (płynne przejście w krajobraz)
      const domeGeo = new THREE.SphereGeometry(420, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.15);
      // Niebo jak w nowoczesnych grach: barwa zależna od wysokości nad horyzontem i od położenia słońca,
      // rozświetlony pas przy horyzoncie, poświata wokół słońca (szeroka i wąska), ciepła łuna o świcie i zmierzchu,
      // nocą granat z jaśniejszym horyzontem i poświatą księżyca; drobny szum usuwa pasy w gradiencie
      const dome = new THREE.Mesh(domeGeo, new THREE.ShaderMaterial({
        uniforms: {
          zenith: { value: new THREE.Color(0x3d6fb4) }, horizon: { value: new THREE.Color(0xc9d6e2) }, fogCol: { value: new THREE.Color(0xb4b7ae) },
          glow: { value: new THREE.Color(0xffd9a0) }, sun: { value: new THREE.Vector3(0, 1, 0) }, moon: { value: new THREE.Vector3(0, 1, 0) },
          night: { value: 0 }, dusk: { value: 0 }, haze: { value: 0 },
        },
        vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          uniform vec3 zenith; uniform vec3 horizon; uniform vec3 fogCol; uniform vec3 glow; uniform vec3 sun; uniform vec3 moon;
          uniform float night; uniform float dusk; uniform float haze;
          varying vec3 vDir;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          void main() {
            vec3 d = normalize(vDir);
            float h = max(d.y, 0.0);
            // gradient: przy horyzoncie jaśniej (gruba warstwa powietrza), w zenicie głęboki kolor
            vec3 col = mix(horizon, zenith, pow(h, 0.45));
            // łuna o wschodzie/zachodzie: ciepły pas nad horyzontem, najmocniej od strony słońca
            float sunSide = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sun.x, 0.0, sun.z))), 0.0);
            col += glow * dusk * pow(1.0 - h, 6.0) * (0.35 + 0.65 * sunSide);
            // poświata słońca: szeroka mgiełka i jaśniejszy środek (słabnie w zachmurzeniu)
            float cs = max(dot(d, normalize(sun)), 0.0);
            float above = smoothstep(-0.15, 0.05, sun.y);
            col += glow * above * (1.0 - haze * 0.7) * (pow(cs, 6.0) * 0.35 + pow(cs, 64.0) * 0.6);
            // poświata księżyca nocą
            float cm = max(dot(d, normalize(moon)), 0.0);
            col += vec3(0.35, 0.42, 0.6) * night * pow(cm, 24.0) * 0.5;
            // poniżej horyzontu i tuż przy nim niebo przechodzi w kolor mgły nad ziemią
            col = mix(col, fogCol, smoothstep(0.08, -0.02, d.y));
            col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
            gl_FragColor = vec4(col, 1.0);
          }`,
        side: THREE.BackSide, depthWrite: true, fog: false, // kopuła zapisuje głębię, inaczej efekt cieni (AO) traktuje niebo jak puste tło i je zamalowuje
      }));
      dome.renderOrder = -20;
      // słońce jak prawdziwe: mała, oślepiająca tarcza, wokół szeroka mgiełka; kolor ociepla się przy horyzoncie
      const sc = document.createElement('canvas'); sc.width = sc.height = 256;
      const sx2 = sc.getContext('2d')!;
      const sg = sx2.createRadialGradient(128, 128, 0, 128, 128, 128);
      sg.addColorStop(0, 'rgba(255,255,250,1)'); sg.addColorStop(0.07, 'rgba(255,253,240,1)'); sg.addColorStop(0.1, 'rgba(255,240,210,0.65)');
      sg.addColorStop(0.25, 'rgba(255,225,180,0.22)'); sg.addColorStop(0.6, 'rgba(255,215,170,0.06)'); sg.addColorStop(1, 'rgba(255,215,170,0)');
      sx2.fillStyle = sg; sx2.fillRect(0, 0, 256, 256);
      const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
      const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: stex, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      sunDisc.scale.setScalar(160);
      group.add(dome, stars, moon, sunDisc);
      for (const o of [stars, moon, sunDisc]) o.renderOrder = -10;
      this.scene.add(group);
      this.sky = { group, stars, moon, dome, sunDisc };
    }
    const sk = this.sky;
    const clear = 1 - p.rain;
    sk.group.position.copy(p.camera.position);
    // niebo zawsze tuż przed granicą widzenia kamery (kopuła ma promień 420)
    sk.group.scale.setScalar(Math.min(1, (p.camera.far * 0.92) / 420));
    const su = (sk.stars.material as THREE.ShaderMaterial).uniforms;
    su.opacity!.value = Math.max(0, (p.night - 0.2) / 0.8) * (1 - p.cover * 0.8);
    su.time!.value = p.time;
    // księżyc idzie łukiem po nocnym niebie
    const d = p.sunDir.clone().normalize();
    sk.moon.position.set(d.x * 340, Math.max(60, d.y * 340), d.z * 340); // nocą kierunek „słońca” to droga księżyca
    (sk.moon.material as THREE.SpriteMaterial).opacity = Math.max(0, (p.night - 0.15) / 0.85) * (0.3 + 0.7 * clear);
    // kolory kopuły: zenit zależny od pory (dzień błękit, świt/zmierzch cieplej, noc granat), horyzont = mgła
    const bg = this.scene.background as THREE.Color;
    const u = (this.sky.dome.material as THREE.ShaderMaterial).uniforms;
    const grey = Math.max(p.rain * 0.9, p.cover * 0.55, p.dayMist * 0.7);
    // prawdziwe położenie słońca z godziny (nocą pod horyzontem); „sunDir” nocą prowadzi księżyc
    const hour = p.hour;
    const ang = ((hour - 6) / 24) * Math.PI * 2;
    const realSun = new THREE.Vector3(-Math.cos(ang), Math.sin(ang) * 0.85, 0.4).normalize();
    const duskK = Math.max(0, 1 - Math.abs(realSun.y) * 4.5) * (1 - grey * 0.6); // tylko nisko przy horyzoncie
    (u.sun!.value as THREE.Vector3).copy(realSun);
    (u.moon!.value as THREE.Vector3).copy(p.sunDir).normalize();
    u.night!.value = p.night; u.dusk!.value = duskK; u.haze!.value = grey;
    (u.fogCol!.value as THREE.Color).copy(bg);
    // zenit: dzień błękit (szary w niepogodę), o zmierzchu głębszy fiolet, nocą granat
    const zen = new THREE.Color(0x2f62ad).lerp(new THREE.Color(0x737a84), grey).lerp(new THREE.Color(0x3b3f73), duskK * 0.5).lerp(new THREE.Color(0x050914), p.night);
    (u.zenith!.value as THREE.Color).copy(zen);
    // horyzont: dzień jasny, lekko mleczny; o zmierzchu pomarańczowo-różowy; nocą przygaszony granat
    const hor = new THREE.Color(0xd2dde8).lerp(new THREE.Color(0xa9adb2), grey).lerp(new THREE.Color(0xe7a27a), duskK * 0.8).lerp(new THREE.Color(0x141c30), p.night);
    (u.horizon!.value as THREE.Color).copy(hor);
    (u.glow!.value as THREE.Color).set(0xffe2b0).lerp(new THREE.Color(0xff8a40), duskK);
    // słońce widać tylko w dzień i bez deszczu
    const sd = p.sunDir.clone().normalize();
    sk.sunDisc.position.set(sd.x * 360, Math.max(30, sd.y * 360), sd.z * 360);
    const sm2 = sk.sunDisc.material as THREE.SpriteMaterial;
    sm2.opacity = (1 - p.night) * (1 - Math.max(p.rain * 0.9, p.cover * 0.6)) * Math.min(1, Math.max(0, (sd.y - 0.02) * 6));
    sm2.color.set(0xffffff).lerp(new THREE.Color(0xff9a50), Math.max(0, 1 - sd.y * 2.5)); // nisko nad horyzontem pomarańczowe
  }
}
