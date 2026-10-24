/**
 * Znaki nad głowami i budynkami (wyniesione z scene.ts, 24.10.2026): smutna minka chłopa, który odchodzi,
 * znak zarazy i „brak pracownika”. Każdy rysowany raz na płótnie i potem współdzielony.
 */
import * as THREE from 'three';

let sadMat: THREE.SpriteMaterial | null = null;
/** Smutna minka nad głową chłopa, który opuszcza osadę */
export function sadMaterial(): THREE.SpriteMaterial {
  if (sadMat) return sadMat;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(30,18,8,0.85)'; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill();
  x.lineWidth = 7; x.strokeStyle = '#e9c145'; x.stroke();
  x.fillStyle = '#f2d27a'; x.beginPath(); x.arc(64, 64, 44, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#3a2410';
  x.beginPath(); x.arc(48, 54, 6, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(80, 54, 6, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#3a2410'; x.lineWidth = 6; x.lineCap = 'round';
  x.beginPath(); x.arc(64, 96, 20, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); // usta w podkówkę
  x.fillStyle = '#6fb6ff'; x.beginPath(); x.ellipse(84, 70, 4, 7, 0, 0, Math.PI * 2); x.fill(); // łza
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  sadMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  return sadMat;
}

let sickMat: THREE.SpriteMaterial | null = null;
/** Znak zarazy: blada, zielonkawa twarz w gorączce (krople potu, krzywe usta) w złotym kole, rysowana raz na płótnie */
export function sickMaterial(): THREE.SpriteMaterial {
  if (sickMat) return sickMat;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(30,18,8,0.85)'; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill();
  x.lineWidth = 7; x.strokeStyle = '#e9c145'; x.stroke();
  x.fillStyle = '#b9c77e'; x.beginPath(); x.arc(64, 64, 44, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(150,40,30,0.35)'; x.beginPath(); x.ellipse(42, 72, 9, 6, 0, 0, Math.PI * 2); x.ellipse(86, 72, 9, 6, 0, 0, Math.PI * 2); x.fill(); // rozpalone policzki
  x.strokeStyle = '#3a2410'; x.lineWidth = 6; x.lineCap = 'round';
  x.beginPath(); x.moveTo(40, 52); x.lineTo(54, 56); x.moveTo(88, 52); x.lineTo(74, 56); x.stroke(); // przymknięte oczy
  x.beginPath(); x.moveTo(46, 92); x.quadraticCurveTo(55, 84, 64, 92); x.quadraticCurveTo(73, 100, 82, 92); x.stroke(); // falujące usta
  x.fillStyle = '#6fb6ff';
  for (const [ex, ey] of [[30, 40], [98, 36], [104, 60]] as const) { x.beginPath(); x.moveTo(ex, ey - 9); x.quadraticCurveTo(ex + 6, ey, ex, ey + 4); x.quadraticCurveTo(ex - 6, ey, ex, ey - 9); x.fill(); } // pot
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  sickMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  return sickMat;
}

let noWorkerMat: THREE.SpriteMaterial | null = null;
/** Znak „brak pracownika”: ludzik w złotym kole przekreślony na czerwono, rysowany raz na płótnie */
export function noWorkerMaterial(): THREE.SpriteMaterial {
  if (noWorkerMat) return noWorkerMat;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(30,18,8,0.85)'; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill();
  x.lineWidth = 8; x.strokeStyle = '#e9c145'; x.stroke();
  x.fillStyle = '#f6ecd0';
  x.beginPath(); x.arc(64, 40, 13, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(40, 98); x.quadraticCurveTo(42, 60, 64, 58); x.quadraticCurveTo(86, 60, 88, 98); x.closePath(); x.fill();
  x.strokeStyle = '#d6372b'; x.lineWidth = 12; x.lineCap = 'round';
  x.beginPath(); x.moveTo(26, 26); x.lineTo(102, 102); x.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  noWorkerMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  return noWorkerMat;
}
