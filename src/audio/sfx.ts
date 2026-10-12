/**
 * Dźwięki gry: nagrania Kenney (public/sounds, licencja w docs/zasoby.md), a gdy plik się jeszcze nie wczytał,
 * zastępczy dźwięk syntezowany w przeglądarce. Do tego tło: szum otoczenia w pętli.
 * Przeglądarka pozwala grać dopiero po pierwszym kliknięciu, więc kontekst powstaje leniwie.
 */
export type Sound = 'babble' | 'click' | 'build' | 'demolish' | 'collapse' | 'error' | 'road' | 'rotate' | 'select';

/** Nagrania dla każdego dźwięku; przy kilku wariantach losujemy jeden, żeby się nie powtarzało. */
const FILES: Partial<Record<Sound | 'ambience', string[]>> = {
  click: ['toggle'],
  build: ['placement-a', 'placement-b', 'placement-c', 'placement-d'],
  road: ['placement-a', 'placement-c'],
  demolish: ['removal-a', 'removal-b', 'removal-c', 'removal-d'],
  collapse: ['break'],
  rotate: ['rotate'],
  select: ['placement-b', 'placement-d'],
  ambience: ['ambience'],
};
const buffers = new Map<string, AudioBuffer>();
let ambienceOn = false;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** Osobne suwaki: efekty (budowa, burzenie), interfejs (kliknięcia), otoczenie (szum w tle) */
export type Bus = 'sfx' | 'ui' | 'amb';
const busGain: Partial<Record<Bus, GainNode>> = {};
const busLevel: Record<Bus, number> = { sfx: 1, ui: 1, amb: 1 };
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;
let volume = 0.6;
let muted = false;

try {
  const v = localStorage.getItem('project1.volume');
  if (v !== null) volume = Number(v);
  muted = localStorage.getItem('project1.muted') === '1';
} catch { /* brak dostępu do pamięci przeglądarki */ }

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : volume;
  master.connect(ctx.destination);
  for (const b of ['sfx', 'ui', 'amb'] as Bus[]) { const gn = ctx.createGain(); gn.gain.value = busLevel[b]; gn.connect(master); busGain[b] = gn; }
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const c = ctx;
  const names = new Set(Object.values(FILES).flat());
  for (const name of names) {
    fetch(`sounds/${name}.ogg`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(name))))
      .then((data) => c.decodeAudioData(data))
      .then((buf) => { buffers.set(name, buf); if (name === 'ambience') startAmbience(); })
      .catch(() => { /* zostaje dźwięk syntezowany */ });
  }
  return ctx;
}

/** Uruchamia dźwięk po pierwszym geście użytkownika (wymóg przeglądarek). */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume();
}

export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  if (master && !muted) master.gain.value = volume;
  try { localStorage.setItem('project1.volume', String(volume)); } catch { /* nic */ }
}

/** Głośność jednej grupy dźwięków (0..1) */
export function setBusVolume(bus: Bus, v: number): void {
  busLevel[bus] = Math.max(0, Math.min(1, v));
  const gn = busGain[bus];
  if (gn) gn.gain.value = busLevel[bus];
}

export function toggleMute(): boolean {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : volume;
  try { localStorage.setItem('project1.muted', muted ? '1' : '0'); } catch { /* nic */ }
  return muted;
}

export const isMuted = (): boolean => muted;
export const getVolume = (): number => volume;

/** Uderzenie: krótki ton, który szybko opada (drewno, młotek). */
function knock(c: AudioContext, at: number, freq: number, len: number, gain: number, type: OscillatorType = 'triangle'): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.frequency.exponentialRampToValueAtTime(freq * 0.55, at + len);
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + len);
  o.connect(g).connect(out ?? master!);
  o.start(at);
  o.stop(at + len + 0.02);
}

/** Szum przepuszczony przez filtr: chrzęst, sypanie, łoskot. */
function rumble(c: AudioContext, at: number, len: number, gain: number, freq: number, q = 0.8, attack = 0.01): void {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.6 + Math.random() * 0.6;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.001, at + len);
  src.connect(f).connect(g).connect(out ?? master!);
  src.start(at, Math.random() * 0.5);
  src.stop(at + len + 0.05);
}

/** Szum otoczenia w pętli, cicho pod resztą dźwięków. */
function startAmbience(): void {
  const buf = buffers.get('ambience');
  if (!ctx || !master || !buf || ambienceOn) return;
  ambienceOn = true;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = 0.35;
  src.connect(g).connect(busGain.amb ?? master);
  src.start();
}

function sample(c: AudioContext, sound: Sound, t: number): boolean {
  const list = FILES[sound];
  const name = list?.[Math.floor(Math.random() * list.length)];
  const buf = name ? buffers.get(name) : undefined;
  if (!buf) return false;
  const src = c.createBufferSource();
  src.buffer = buf;
  // lekko zmieniona wysokość przy każdym odtworzeniu; droga brzmi niżej i ciszej niż budynek
  src.playbackRate.value = (sound === 'road' ? 0.8 : sound === 'select' ? 1.35 : 1) * (0.94 + Math.random() * 0.12);
  const g = c.createGain();
  g.gain.value = sound === 'road' ? 0.5 : sound === 'click' ? 0.6 : sound === 'select' ? 0.45 : 1;
  src.connect(g).connect(out ?? master!);
  src.start(t);
  return true;
}

export function play(sound: Sound): void {
  const c = audio();
  if (!c || !master || muted || c.state !== 'running') return;
  const t = c.currentTime + 0.01;
  out = (sound === 'click' || sound === 'select' || sound === 'rotate' || sound === 'error' ? busGain.ui : busGain.sfx) ?? master;
  if (sample(c, sound, t)) return;
  if (sound === 'babble') {
    // skryba „mówi”: seria krótkich sylab o skaczącej wysokości, jak bełkot w starych strategiach
    const n = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const at = t + i * 0.085 + Math.random() * 0.02;
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(150 + Math.random() * 90, at);
      f.type = 'bandpass'; f.frequency.value = 700 + Math.random() * 900; f.Q.value = 5;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.28, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.07);
      o.connect(f).connect(g).connect(busGain.ui ?? master!);
      o.start(at); o.stop(at + 0.09);
    }
    return;
  }
  switch (sound) {
    case 'click':
    case 'rotate':
    case 'select':
      knock(c, t, 900, 0.05, 0.12);
      break;
    case 'build':
      // deski kładzione na ziemię, potem trzy uderzenia młotkiem
      rumble(c, t, 0.25, 0.5, 300, 1.2);
      knock(c, t, 140, 0.18, 0.5);
      for (let i = 0; i < 3; i++) { knock(c, t + 0.22 + i * 0.16, 520 + Math.random() * 80, 0.07, 0.35, 'square'); rumble(c, t + 0.22 + i * 0.16, 0.06, 0.25, 2500, 2); }
      break;
    case 'road':
      rumble(c, t, 0.12, 0.25, 900, 1);
      break;
    case 'demolish':
      // uderzenia kilofa w ścianę
      for (let i = 0; i < 2; i++) { knock(c, t + i * 0.2, 260, 0.1, 0.4, 'square'); rumble(c, t + i * 0.2, 0.15, 0.35, 1800, 1.5); }
      break;
    case 'collapse':
      // łoskot walącego się budynku i sypiący się gruz
      rumble(c, t, 1.4, 0.9, 120, 0.7, 0.05);
      knock(c, t, 70, 0.6, 0.7, 'sine');
      for (let i = 0; i < 9; i++) rumble(c, t + 0.15 + Math.random() * 1.1, 0.12, 0.3, 1200 + Math.random() * 2500, 2);
      break;
    case 'error':
      knock(c, t, 200, 0.12, 0.25, 'sawtooth');
      knock(c, t + 0.13, 150, 0.16, 0.25, 'sawtooth');
      break;
  }
}
