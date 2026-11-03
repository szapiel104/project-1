# Przejście na WebGPU (Michał 3.11.2026: „robimy WebGPU, potem efekty”)

Cel: nowoczesny obraz i wydajność — trawa i roślinność liczone na karcie graficznej (compute), tysiące cząstek
(dym, pył, deszcz, śnieg), tablice tekstur zamiast limitu 16 tekstur w shaderze ziemi, porządne cienie, mgła
z promieniami słońca, TAA. Silnik: `three/webgpu` (`WebGPURenderer`) + TSL (język węzłów shaderów). Ten sam kod działa
też w trybie zgodności WebGL2 (`forceWebGL`), więc gracz bez WebGPU nadal zagra.

## Jak przechodzimy — flaga, nie długa gałąź
Nad grą pracuje kilka czatów naraz, więc długa gałąź rozjechałaby się z `main` po jednym dniu. Zamiast tego:
- **Od 0.91.0 WebGPU jest domyślne na produkcji** (Michał 3.11.2026: „rób od razu na produkcji, nikt w to nie gra jeszcze”). Stary WebGL: `?webgl=1` (zapas, porównania, narzędzia w `tools/check`). Rzeczy bez bliźniaka w TSL są do czasu przeniesienia schowane albo uboższe.
- Każdy własny shader dostaje **bliźniaka w TSL** obok wersji GLSL (wspólny moduł, wybór przy tworzeniu materiału).
  Shader jeszcze nieprzeniesiony na WebGPU rysuje się zwykłym `MeshStandardNodeMaterial` (brzydziej, ale gra działa).
- Gdy wszystkie bliźniaki są gotowe i FPS na WebGPU ≥ WebGL — przełączamy domyślnie na WebGPU, potem usuwamy GLSL.
- **Zasada dla wszystkich czatów na czas przejścia:** zmiana w shaderze GLSL = ta sama zmiana w jego bliźniaku TSL
  (albo wpis w „Rozjazdy” niżej, żeby czat od WebGPU go dociągnął).

## Zasada (Michał 3.11.2026): wszystko nowe, pełna moc WebGPU
Nie przepisujemy starego GLSL 1:1. Każdą rzecz robimy od nowa tak, jak robi się ją dziś na WebGPU: bufor głębokości
i obraz sceny w materiałach (woda, mgła, miękkie cząstki), cząstki i trawa liczone na karcie (compute), jedno wywołanie
rysowania na cały efekt, bez czekania na kompilację przy wczytywaniu.

## Inwentarz (3.11.2026): 46 shaderów i wstawek w 22 plikach
| Obszar | Pliki | Co jest | Bliźniak TSL |
|---|---|---|---|
| Efekty obrazu | `scene.ts` (EffectComposer, N8AOPass, ShaderPass ×7), `postfx.ts` | AO, grading, wyostrzenie, wygładzanie | [ ] `PostProcessing` + `ao()`/GTAO, `fxaa`/TAA |
| Ziemia | `ground.ts` (5×) | warstwy, triplanar, normalne, chmury, piach, śnieg | [ ] + tablica tekstur |
| Pory roku, wiatr, chmury | `season.ts` (5×), `terrain.ts` (wiatr ×6), `ground.ts` `cloudShade` | śnieg, szron, jesień, kołysanie koron | [ ] funkcje węzłów doklejane do materiałów |
| Woda | `ground.ts` `waterMaterial`, `waterReflect.ts`, `streams.ts` (3×), `puddles.ts` | odbicia, fale, przejrzystość | [ ] `reflector()` |
| Cząstki i niebo | `ambience.ts`, `snowfall.ts`, `spellsmoke.ts`, `flames.ts` (2×), `blaze.ts`, `sky.ts` (2×), `clouds.ts`, `highmist.ts` (3×) | dym, iskry, śnieg, ogień, mgła | [ ] instancje + compute |
| Postacie i drobne | `skinned.ts` (2×), `banners.ts` (2×), `impostors.ts`, `footprints.ts`, `parallax.ts`, `grass.ts`, `normalpack.ts` | szkielety, flagi, obrazki drzew, ślady | [ ] |
| Narzędzia | `precompile.ts`, `glcontext.ts`, `debug/errlog.ts` (gl.getError), `autoquality.ts`, `tools/check/*` | kompilacja z góry, utrata kontekstu, dziennik, pomiary | [ ] |
| Tekstury | `ktx.ts` (KTX2Loader) | KTX2/Basis | [ ] `detectSupport` z WebGPURenderer |

## Kolejność partii
0. [~] **Szkielet** (0.90.0: flaga `?webgpu=1`/`?webgpu=gl`, `src/render/gpu/webgpu.ts`, renderer przed sceną w boot.ts, GLSL chowany, bez efektów obrazu, bez odbić wody i mapy otoczenia; do sprawdzenia w Chrome): `?webgpu=1` → `WebGPURenderer` (await `init()`), mapa materiałów: każdy materiał bez bliźniaka →
   `MeshStandardNodeMaterial` z tą samą teksturą i kolorem. Gra ma się uruchomić i dać grać (brzydziej). Pomiar FPS
   (`__perf`) WebGL vs WebGPU na tej samej scenie. Lista tego, co się sypie.
1. [~] Efekty obrazu w TSL (AO, grading jak w `scene.ts`, wyostrzenie, wygładzanie) — `src/render/gpu/postNode.ts` (0.91.1). Brakuje: mapa otoczenia (PMREM), odbicia wody.
2. [~] Ziemia w TSL (najważniejsza dla wyglądu) — `src/render/gpu/groundNode.ts` (0.90.1: warstwy, skała z trzech rzutów, normalne, półki, śnieg w górach, mokry brzeg, dno, plamy). Brakuje: cienie chmur, łatka pór roku; tablica tekstur zamiast osobnych — później.
3. [~] Pory roku, wiatr, cienie chmur — 0.93.1 wiatr i flagi (`gpu/deformNode.ts`), 0.93.4 pory roku (`gpu/seasonNode.ts`, śnieg w ziemi i trawie). Brakuje: cienie chmur, ślady na śniegu, jesienne łaty na ziemi.
4. [~] Woda, strumienie, kałuże — 0.92.0: nowa woda `gpu/waterNode.ts` (grubość z bufora głębokości, załamanie dna, lustro `reflector`, Beer–Lambert, fale, odblask). Strumienie i kałuże — dalej.
5. [~] Cząstki, niebo, mgła (od razu jako instancje/compute) — 0.92.0: niebo i gwiazdy `gpu/skyNode.ts`; 0.92.1: mgła w dolinach, opar i kłęby przy szczytach `gpu/mistNode.ts` (miękkie przecięcie ze sceną z bufora głębokości). 0.92.2: dym z kominów, iskry, blask okien jako czworokąty z instancji (`gpu/pointsNode.ts`), ogień pochodni/ognisk i pożary (`gpu/fireNode.ts`, szum 3D z tekstury zamiast haszy). 0.92.7 chmury i śnieg, 0.93.6 dym czarów. Strumienie/wodospady wyłączone (Michał).
6. [x] Postacie (0.92.3), trawa (0.92.4), drzewa z daleka (0.92.5), flagi i wiatr (0.93.1), ślady i kałuże (0.93.5).
7. [ ] Narzędzia (kompilacja z góry, dziennik błędów, autojakość, sprawdzanie wywołań rysowania).
8. [ ] Przełączenie domyślne na WebGPU (WebGL2 jako zapas), usunięcie GLSL.
9. [ ] Nowe możliwości: trawa liczona na karcie, gęsta siatka terenu przy kamerze, mgła z promieniami słońca, TAA, dym i pył jako cząstki na karcie.

## Potem: szybkie efekty (docs/teren.md, „Zaległe”)
Trawa i krzewy, gęstsza siatka terenu, roślinność pustyni (palmy, suche krzewy, trawy — 0 A.D.), krawędź mapy bez
kwadratu, większa mapa 1 na 1.

## Wydajność i wczytywanie na WebGPU (3.11.2026)
- Potoki karty zawsze asynchronicznie (`Pipelines.updateForRender` z obietnicą) — synchroniczne zawieszały cały Chrome.
- Budżet składania materiałów na klatkę (`gpuFrameBudget`, 45 ms przy wczytywaniu, 6 ms w grze) — obiekt czeka klatkę zamiast blokować.
- Wspólny klucz programu dla zwykłych materiałów (stare łatki GLSL nie mnożą wariantów); węzły dopinane do zwykłych materiałów niosą `userData.gpuKey`.
- Oświetlenie klastrowe (ClusteredLighting) dla pochodni; pełne limity karty (`requiredLimits`).
- Macierz instancji w własnych węzłach: `instanceMatrixNode()` (atrybut mat4 nie istnieje w WebGPU).
- Do zrobienia: mniej pul instancji (każda InstancedMesh = osobne składanie w three.js), koszt rysowania na procesorze (~800–1000 wywołań, odbicie wody rysuje scenę drugi raz).

## Rozjazdy (zmiany w GLSL, których jeszcze nie ma w TSL)
- Cienie chmur: na WebGPU jedno przejście w postNode.ts (0.93.8), na WebGL dalej cloudShade.
- Ślady na śniegu w ziemi (uTrail) i jesienne łaty na ziemi — tylko GLSL.
- Parallax: gpu/pomNode.ts gotowe, ale włączone tylko pod ?pom=1 (0.94.9 wywróciło grę: materialReference przy cieniach).
- Mapa otoczenia: na WebGPU od 0.94.4 (gpu/envNode.ts).
