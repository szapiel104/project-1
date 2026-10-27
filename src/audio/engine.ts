/**
 * Silnik dźwięku przestrzennego (27.10.2026): wszystkie odgłosy świata grają z miejsca na mapie, tak jak w grach RTS.
 *
 * Słuchacz:
 *  - w widoku strategicznym stoi w punkcie, na który patrzy kamera (środek ekranu), a oddalenie kamery dokłada
 *    „wysokość ucha” — przy zbliżeniu słychać wyraźnie to, co pod kursorem, przy oddaleniu całość robi się cichsza
 *    i bardziej równa (jak w Twierdzy/AoE), ale nic z drugiego końca mapy nie krzyczy do ucha;
 *  - w spacerze i w sztolni stoi w oczach postaci.
 *
 * Każdy głos (jedno odtworzenie): źródło → głośność z odległości → filtr dolnoprzepustowy (daleko = głucho, bez
 * syczących wysokich tonów) → panorama → szyna świata; do tego wysyłka do wspólnego pogłosu, większa z daleka.
 * Krzywe odległości, głośność, rozrzut wysokości i limity są osobne dla każdego rodzaju dźwięku (bank.ts).
 *
 * Porządek w miksie:
 *  - limit naraz na rodzaj i na cały świat: przy tłoku cichszy głos ustępuje głośniejszemu (bliższemu), więc bitwa
 *    nie zlewa się w szum, a blisko kamery zawsze słychać to, co ważne;
 *  - ten sam rodzaj w tym samym miejscu nie startuje dwa razy w ciągu kilkudziesięciu ms (bez „flangera”);
 *  - głośność nagrań jest wyrównywana przy wczytaniu (najgłośniejsze 50 ms każdego pliku na jednym poziomie),
 *    więc warianty jednego dźwięku nie skaczą raz cicho, raz głośno.
 */
import { DEFS, type Kind, type Def, fileUrl } from './bank';

interface Voice { kind: Kind; src: AudioBufferSourceNode; gain: GainNode; lp: BiquadFilterNode; pan: StereoPannerNode; send: GainNode; level: number; end: number; x: number; z: number; started: number }
interface Loop { kind: Kind; src: AudioBufferSourceNode | null; gain: GainNode; lp: BiquadFilterNode; pan: StereoPannerNode; send: GainNode; x: number; y: number; z: number; level: number; seen: number; next: number }

let ctx: AudioContext | null = null;
let worldOut: AudioNode | null = null, ambOut: AudioNode | null = null;
let reverb: ConvolverNode | null = null;
let onDuck: ((level: number) => void) | null = null;
const buffers = new Map<string, AudioBuffer>();
/** Wyrównanie głośności pliku (mnożnik liczony przy wczytaniu) */
const norm = new Map<string, number>();
const loading = new Set<string>();
const voices: Voice[] = [];
const loops = new Map<string, Loop>();
const lastStart = new Map<Kind, { t: number; x: number; z: number }[]>();
/** Ostatnio zagrany wariant każdego rodzaju — ten sam plik nie leci dwa razy z rzędu */
const lastPick = new Map<Kind, number>();

/** Najwięcej głosów świata naraz (wszystkie rodzaje razem) */
const MAX_VOICES = 48;

// --- słuchacz ---
const L = { x: 0, y: 0, z: 0, rx: 1, rz: 0, lift: 12, fp: false };

/**
 * Położenie słuchacza (co klatkę ze sceny): `fx,fy,fz` punkt, na który patrzy kamera, `zoom` odległość kamery od niego,
 * `rx,rz` kierunek „w prawo” ekranu na ziemi; `firstPerson` = spacer (ucho w oczach postaci, bez dokładania wysokości).
 */
export function setListener(fx: number, fy: number, fz: number, zoom: number, rx: number, rz: number, firstPerson: boolean): void {
  L.x = fx; L.y = fy; L.z = fz; L.fp = firstPerson;
  const n = Math.hypot(rx, rz) || 1; L.rx = rx / n; L.rz = rz / n;
  // wysokość ucha: część oddalenia kamery (przy zbliżeniu prawie zero, przy pełnym oddaleniu ok. 24 pola)
  L.lift = firstPerson ? 0.4 : Math.max(1.5, zoom * 0.42);
}

/** Głośność, panorama, odcięcie wysokich tonów i ilość pogłosu dla źródła w (x, y, z) */
function place(def: Def, x: number, y: number, z: number): { g: number; pan: number; cut: number; wet: number } {
  return spatialMix(def, x - L.x, L.fp ? y - L.y : 0, z - L.z, L.lift, L.rx, L.rz);
}
/** Czysta matematyka miksu przestrzennego (testy w tests/audio.test.ts): przesunięcie źródła od słuchacza, „wysokość ucha”, kierunek w prawo */
export function spatialMix(def: Def, dx: number, dy: number, dz: number, lift: number, rx: number, rz: number): { g: number; pan: number; cut: number; wet: number } {
  const h = Math.hypot(dx, dz);
  const d = Math.hypot(h, dy, lift);
  const ref = def.ref, max = def.max;
  if (d >= max) return { g: 0, pan: 0, cut: 0, wet: 0 };
  // odwrotność odległości (jak w prawdziwym świecie, z łagodniejszym spadkiem), a przy samej granicy słyszalności miękkie wyciszenie do zera
  let g = d <= ref ? 1 : ref / (ref + def.roll * (d - ref));
  const edge = (d - max * 0.65) / (max * 0.35);
  if (edge > 0) g *= Math.max(0, 1 - edge) ** 2;
  // panorama: z boku ekranu słychać z boku, ale nigdy całkiem w jednym uchu; przy oddaleniu panorama węższa
  const side = (dx * rx + dz * rz) / (h + lift * 0.8 + 1);
  const pan = Math.max(-0.85, Math.min(0.85, side * 1.25));
  // powietrze tłumi wysokie tony: z bliska pełne pasmo, z daleka głucho
  const far = Math.max(0, (d - ref) / Math.max(1, max - ref));
  const cut = Math.max(def.dull ?? 900, 20000 * Math.pow(1 - far, 2.2));
  const wet = (def.wet ?? 0.25) * (0.25 + 0.75 * far);
  return { g, pan, cut, wet };
}

// --- pogłos: krótkie odbicia od ścian osady i las w tle (wygenerowana odpowiedź impulsowa) ---
function makeReverb(c: AudioContext): ConvolverNode {
  const len = Math.floor(c.sampleRate * 1.8), ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / c.sampleRate;
      // ogon gaśnie wykładniczo, wysokie tony szybciej (filtr jednobiegunowy przesuwający się w dół)
      const k = 0.35 + 0.6 * Math.min(1, t / 1.2);
      lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
      d[i] = lp * Math.exp(-t * 3.2) * (t < 0.012 ? t / 0.012 : 1);
    }
    // kilka wczesnych odbić (ściany chat i palisady)
    for (const [ms, a] of [[17, 0.5], [29, 0.35], [41, 0.28], [63, 0.2]] as const) d[Math.floor(((ms + ch * 3) / 1000) * c.sampleRate)]! += a * (ch ? -1 : 1);
  }
  const r = c.createConvolver(); r.buffer = ir;
  return r;
}

/** Podpięcie do kontekstu dźwięku z sfx.ts: `world` = szyna odgłosów świata (z pauzą), `amb` = szyna otoczenia */
export function initEngine(c: AudioContext, world: AudioNode, amb: AudioNode, duck: (level: number) => void): void {
  ctx = c; worldOut = world; ambOut = amb; onDuck = duck;
  reverb = makeReverb(c);
  const rg = c.createGain(); rg.gain.value = 0.55;
  reverb.connect(rg).connect(world);
  // wczytywanie w tle po kolei (najwyżej 4 pliki naraz, żeby nie zatkać sieci przy starcie gry):
  // najpierw najczęstsze rodzaje (praca, walka), potem cała reszta — pierwszy pies czy rozmowa nie milczą
  const kinds = Object.keys(DEFS) as Kind[];
  for (const k of kinds) if (DEFS[k].preload) queue.push(...DEFS[k].files);
  for (const k of kinds) if (!DEFS[k].preload) queue.push(...DEFS[k].files);
  pump();
}
const queue: string[] = [];
let inFlight = 0;
function pump(): void {
  while (inFlight < 4 && queue.length) {
    const f = queue.shift()!;
    if (buffers.has(f) || loading.has(f)) continue;
    inFlight++;
    load(f, () => { inFlight--; pump(); });
  }
}

/** Głośność nagrania liczona z najgłośniejszych 50 ms (szczytowa moc, nie szczyt próbki) */
function measure(b: AudioBuffer): number {
  const d = b.getChannelData(0), w = Math.max(1, Math.floor(b.sampleRate * 0.05));
  let sum = 0, best = 0;
  for (let i = 0; i < d.length; i++) { sum += d[i]! * d[i]!; if (i >= w) sum -= d[i - w]! * d[i - w]!; if (sum > best) best = sum; }
  const rms = Math.sqrt(best / Math.min(w, d.length));
  return rms > 1e-5 ? 0.16 / rms : 1; // -16 dBFS
}

function load(file: string, done?: () => void): void {
  if (!ctx || buffers.has(file) || loading.has(file)) { done?.(); return; }
  loading.add(file);
  const c = ctx;
  fetch(fileUrl(file))
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(file))))
    .then((data) => c.decodeAudioData(data))
    .then((buf) => { buffers.set(file, buf); norm.set(file, Math.min(4, measure(buf))); })
    .catch(() => { /* brak pliku: ten wariant po prostu nie zagra */ })
    .finally(() => { loading.delete(file); done?.(); });
}
function loadKind(k: Kind): void { for (const f of DEFS[k].files) load(f); }

/** Losowy wczytany wariant, inny niż poprzedni */
function choose(k: Kind): string | undefined {
  const files = DEFS[k].files;
  let ok = 0;
  for (const f of files) if (buffers.has(f)) ok++;
  if (!ok) { loadKind(k); return undefined; }
  const prev = lastPick.get(k) ?? -1;
  for (let tries = 0; tries < 6; tries++) {
    const i = Math.floor(Math.random() * files.length);
    if (buffers.has(files[i]!) && (i !== prev || ok === 1)) { lastPick.set(k, i); return files[i]; }
  }
  const f = files.find((x) => buffers.has(x));
  return f;
}

function stopVoice(v: Voice, fade = 0.03): void {
  const c = ctx!;
  const now = c.currentTime;
  v.gain.gain.cancelScheduledValues(now);
  v.gain.gain.setValueAtTime(v.gain.gain.value, now);
  v.gain.gain.linearRampToValueAtTime(0, now + fade);
  try { v.src.stop(now + fade + 0.01); } catch { /* już stoi */ }
  v.end = now;
}

/** Sprzątanie skończonych głosów */
function sweep(now: number): void {
  for (let i = voices.length - 1; i >= 0; i--) if (voices[i]!.end <= now) voices.splice(i, 1);
}

/** Czy można zagrać kolejny głos tego rodzaju o poziomie `level` (ew. zwalnia najcichszy) */
function admit(def: Def, k: Kind, level: number, now: number): boolean {
  sweep(now);
  let same = 0, quietest: Voice | null = null;
  for (const v of voices) if (v.kind === k) { same++; if (!quietest || v.level < quietest.level) quietest = v; }
  if (same >= def.voices) {
    if (!quietest || quietest.level >= level * 0.9) return false;
    stopVoice(quietest);
  }
  if (voices.length >= MAX_VOICES) {
    // cały świat pełny: ustępuje najcichszy głos o niższym priorytecie
    let worst: Voice | null = null, ws = Infinity;
    for (const v of voices) { const s = v.level * (DEFS[v.kind].prio ?? 1); if (s < ws) { ws = s; worst = v; } }
    if (!worst || ws >= level * (def.prio ?? 1)) return false;
    stopVoice(worst);
  }
  return true;
}

/** Ten sam rodzaj z tego samego miejsca przed chwilą — pomijamy (dwa identyczne uderzenia naraz brzmią jak jedno, tylko metalicznie) */
function tooSoon(def: Def, k: Kind, x: number, z: number, now: number): boolean {
  const list = lastStart.get(k) ?? [];
  const gap = def.gap ?? 0.05;
  const fresh = list.filter((s) => now - s.t < Math.max(gap, 0.25));
  if (fresh.some((s) => now - s.t < gap && (s.x - x) ** 2 + (s.z - z) ** 2 < 4)) return true;
  fresh.push({ t: now, x, z });
  lastStart.set(k, fresh.slice(-16));
  return false;
}

export interface PlayOpts { gain?: number; rate?: number; delay?: number; y?: number }

/** Dźwięk z miejsca w świecie. Zwraca false, gdy nie zagrał (za daleko, tłok, plik jeszcze się wczytuje). */
export function play3d(k: Kind, x: number, z: number, o: PlayOpts = {}): boolean {
  const c = ctx;
  if (!c || !worldOut || c.state !== 'running') return false;
  const def = DEFS[k];
  const p = place(def, x, o.y ?? L.y, z);
  const level = p.g * def.vol * (o.gain ?? 1);
  if (level < 0.012) return false;
  const now = c.currentTime;
  if (tooSoon(def, k, x, z, now)) return false;
  if (!admit(def, k, level, now)) return false;
  const file = choose(k);
  if (!file) return false;
  const buf = buffers.get(file)!;
  const src = c.createBufferSource(); src.buffer = buf;
  const [lo, hi] = def.pitch;
  src.playbackRate.value = (o.rate ?? 1) * (lo + Math.random() * (hi - lo));
  const gain = c.createGain(); gain.gain.value = level * (norm.get(file) ?? 1) * (0.9 + Math.random() * 0.2);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.cut; lp.Q.value = 0.5;
  const pan = c.createStereoPanner(); pan.pan.value = p.pan;
  const send = c.createGain(); send.gain.value = p.wet;
  src.connect(gain).connect(lp).connect(pan).connect(def.bus === 'amb' ? ambOut! : worldOut);
  lp.connect(send).connect(reverb!);
  const at = now + (o.delay ?? 0) + 0.005;
  src.start(at);
  const dur = buf.duration / src.playbackRate.value;
  const v: Voice = { kind: k, src, gain, lp, pan, send, level, end: at + dur + 0.05, x, z, started: at };
  voices.push(v);
  src.onended = () => { src.disconnect(); send.disconnect(); };
  if (def.duck) onDuck?.(level * def.duck);
  return true;
}

/** Dźwięk „przy uchu” (spacer: własne kroki, pochodnia w ręce) — bez odległości, tylko lekka panorama */
export function play2d(k: Kind, gain = 1, pan = 0, rate = 1): boolean {
  const c = ctx;
  if (!c || !worldOut || c.state !== 'running') return false;
  const def = DEFS[k];
  const level = def.vol * gain;
  const now = c.currentTime;
  if (!admit(def, k, level, now)) return false;
  const file = choose(k);
  if (!file) return false;
  const buf = buffers.get(file)!;
  const src = c.createBufferSource(); src.buffer = buf;
  src.playbackRate.value = rate * (def.pitch[0] + Math.random() * (def.pitch[1] - def.pitch[0]));
  const g = c.createGain(); g.gain.value = level * (norm.get(file) ?? 1) * (0.9 + Math.random() * 0.2);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000;
  const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
  const send = c.createGain(); send.gain.value = (def.wet ?? 0.25) * 0.3;
  src.connect(g).connect(lp).connect(p).connect(def.bus === 'amb' ? ambOut! : worldOut);
  lp.connect(send).connect(reverb!);
  src.start(now + 0.005);
  voices.push({ kind: k, src, gain: g, lp, pan: p, send, level, end: now + buf.duration / src.playbackRate.value + 0.05, x: L.x, z: L.z, started: now });
  src.onended = () => { src.disconnect(); send.disconnect(); };
  if (def.duck) onDuck?.(level * def.duck);
  return true;
}

/**
 * Dźwięk ciągły z miejsca (płonący budynek, ognisko, gwar): woła się co klatkę, póki źródło istnieje;
 * gdy przestanie być wołany, płynnie cichnie i znika. Kolejne warianty przenikają się bez szwu.
 */
export function loop3d(key: string, k: Kind, x: number, y: number, z: number, level = 1): void {
  const c = ctx;
  if (!c || !worldOut || c.state !== 'running') return;
  let l = loops.get(key);
  const def = DEFS[k];
  if (!l) {
    const gain = c.createGain(); gain.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000;
    const pan = c.createStereoPanner();
    const send = c.createGain(); send.gain.value = 0;
    gain.connect(lp).connect(pan).connect(def.bus === 'amb' ? ambOut! : worldOut);
    lp.connect(send).connect(reverb!);
    l = { kind: k, src: null, gain, lp, pan, send, x, y, z, level, seen: 0, next: 0 };
    loops.set(key, l);
  }
  l.x = x; l.y = y; l.z = z; l.level = level; l.seen = c.currentTime;
}

/** Odświeżenie ciągłych dźwięków (co klatkę, raz): położenie względem słuchacza, przenikanie wariantów, wygaszanie zapomnianych */
export function updateLoops(paused: boolean): void {
  const c = ctx;
  if (!c || c.state !== 'running') return;
  const now = c.currentTime;
  for (const [key, l] of loops) {
    const def = DEFS[l.kind];
    const gone = now - l.seen > 0.4;
    const p = place(def, l.x, l.y, l.z);
    const target = gone || paused ? 0 : p.g * def.vol * l.level;
    l.gain.gain.setTargetAtTime(target, now, gone ? 0.6 : 0.25);
    l.lp.frequency.setTargetAtTime(Math.max(200, p.cut), now, 0.2);
    l.pan.pan.setTargetAtTime(p.pan, now, 0.2);
    l.send.gain.setTargetAtTime(p.wet, now, 0.3);
    if (gone && now - l.seen > 3) {
      try { l.src?.stop(); } catch { /* nic */ }
      l.gain.disconnect(); l.send.disconnect(); loops.delete(key);
      continue;
    }
    // następny wariant 1,5 s przed końcem poprzedniego, z przenikaniem; cicho daleko — nie odtwarzamy w ogóle
    if (now > l.next - 1.5 && target > 0.004) {
      const file = choose(l.kind);
      if (!file) continue;
      const buf = buffers.get(file)!;
      const src = c.createBufferSource(); src.buffer = buf;
      src.playbackRate.value = def.pitch[0] + Math.random() * (def.pitch[1] - def.pitch[0]);
      // tło startuje w losowym miejscu nagrania, żeby kilka pożarów nie grało tego samego trzasku naraz
      const off = l.next ? 0 : Math.random() * Math.max(0, buf.duration - 4);
      const x = c.createGain(); const t = Math.max(now, l.next - 1.5), len = (buf.duration - off) / src.playbackRate.value;
      const n = norm.get(file) ?? 1;
      x.gain.setValueAtTime(0.0001, t); x.gain.exponentialRampToValueAtTime(n, t + 1.5);
      x.gain.setValueAtTime(n, t + len - 1.5); x.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(x).connect(l.gain); src.start(t, off); src.stop(t + len + 0.05);
      src.onended = () => x.disconnect();
      l.src = src; l.next = t + len;
    }
  }
}

/** Wyciszenie wszystkich głosów świata (np. przy wyjściu do menu nowej gry) */
export function stopAll(): void {
  if (!ctx) return;
  for (const v of voices) stopVoice(v, 0.1);
  voices.length = 0;
}

/** Czy rodzaj ma wczytany choć jeden plik (dla dźwięków zastępczych w sfx.ts) */
export const hasKind = (k: Kind): boolean => DEFS[k].files.some((f) => buffers.has(f));
/** Wczytaj z wyprzedzeniem (np. walka zaraz się zacznie) */
export const preload = (k: Kind): void => loadKind(k);
/** Do okna wydajności (F3): ile głosów i pętli gra */
export const audioStats = (): { voices: number; loops: number; buffers: number } => ({ voices: voices.length, loops: loops.size, buffers: buffers.size });
/** Do testów: gdzie stoi słuchacz (pola świata) i jak wysoko ma „ucho” */
export const listenerPos = (): { x: number; y: number; z: number; lift: number } => ({ x: L.x, y: L.y, z: L.z, lift: L.lift });
