// Kompresja tekstur do KTX2 (Basis Universal) — karta graficzna trzyma je skompresowane (4–6× mniej pamięci niż JPG
// rozpakowany do RGBA), a przeglądarka nie dekoduje obrazków w wątku gry (mniej zacięć przy obracaniu kamerą).
// Uruchomienie: node tools/textures/ktx2.mjs [plik.jpg ...]   (bez argumentów: wszystkie tekstury z public/textures/{terrain,cc0})
// Wynik: obok każdego .jpg plik .ktx2. Gra bierze .ktx2, a gdy go brak albo się nie wczyta — .jpg.
//  - ETC1S w najwyższej jakości (255): plik mniejszy niż JPG (UASTC wychodził 4× większy — za dużo do pobrania),
//    na karcie BC1/BC7/ETC zależnie od sprzętu, mipmapy policzone tu
//  - kolor w sRGB; mapy normalnych (*_n.jpg) w trybie normal map, liniowo
//  - kodowanie trwa ok. 25 s na teksturę 2K (wasm, jeden wątek); pliki można podać jako argumenty
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { encodeToKTX2 } from 'ktx2-encoder';

const ROOTS = ['public/textures/terrain', 'public/textures/cc0'];
const files = process.argv.slice(2).length ? process.argv.slice(2) : ROOTS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.jpg')).map((f) => join(d, f)));
const imageDecoder = async (buf) => {
  const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  return { width: img.width, height: img.height, data: new Uint8Array(img.data) };
};
for (const f of files) {
  const normal = /_n\.jpg$/.test(f);
  const t0 = Date.now();
  const out = await encodeToKTX2(new Uint8Array(readFileSync(f)), {
    isUASTC: false, qualityLevel: 255, compressionLevel: 2, generateMipmap: true, isYFlip: true,
    isNormalMap: normal, isPerceptual: !normal, imageDecoder,
  });
  const dst = f.replace(/\.jpg$/, '.ktx2');
  writeFileSync(dst, out);
  console.log(dst, Math.round(statSync(f).size / 1024) + ' KB jpg →', Math.round(out.length / 1024) + ' KB ktx2', (Date.now() - t0) / 1000 + ' s');
}
