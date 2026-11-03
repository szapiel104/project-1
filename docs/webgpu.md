# Przejście na WebGPU (Michał 3.11.2026: „robimy WebGPU, potem efekty”)

Cel: nowoczesny obraz i wydajność — trawa i roślinność liczone na karcie graficznej (compute), tysiące cząstek
(dym, pył, deszcz, śnieg), tablice tekstur zamiast limitu 16 tekstur w shaderze ziemi, porządne cienie, mgła
z promieniami słońca, TAA. Silnik: `three/webgpu` (`WebGPURenderer`) + TSL (język węzłów shaderów). Ten sam kod działa
też w trybie zgodności WebGL2 (`forceWebGL`), więc gracz bez WebGPU nadal zagra.

## Jak przechodzimy — flaga, nie długa gałąź
Nad grą pracuje kilka czatów naraz, więc długa gałąź rozjechałaby się z `main` po jednym dniu. Zamiast tego:
- `?webgpu=1` (tylko w adresie, na razie dla testów) uruchamia grę na `WebGPURenderer`. Bez flagi gra działa jak dziś (WebGL).
- Każdy własny shader dostaje **bliźniaka w TSL** obok wersji GLSL (wspólny moduł, wybór przy tworzeniu materiału).
  Shader jeszcze nieprzeniesiony na WebGPU rysuje się zwykłym `MeshStandardNodeMaterial` (brzydziej, ale gra działa).
- Gdy wszystkie bliźniaki są gotowe i FPS na WebGPU ≥ WebGL — przełączamy domyślnie na WebGPU, potem usuwamy GLSL.
- **Zasada dla wszystkich czatów na czas przejścia:** zmiana w shaderze GLSL = ta sama zmiana w jego bliźniaku TSL
  (albo wpis w „Rozjazdy” niżej, żeby czat od WebGPU go dociągnął).

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
1. [ ] Efekty obrazu w TSL (AO, grading jak w `scene.ts`, wyostrzenie, wygładzanie).
2. [~] Ziemia w TSL (najważniejsza dla wyglądu) — `src/render/gpu/groundNode.ts` (0.90.1: warstwy, skała z trzech rzutów, normalne, półki, śnieg w górach, mokry brzeg, dno, plamy). Brakuje: cienie chmur, łatka pór roku; tablica tekstur zamiast osobnych — później.
3. [ ] Pory roku, wiatr, cienie chmur (wspólne funkcje węzłów).
4. [ ] Woda, strumienie, kałuże.
5. [ ] Cząstki, niebo, mgła (od razu jako instancje/compute).
6. [ ] Postacie, flagi, obrazki drzew, ślady, trawa.
7. [ ] Narzędzia (kompilacja z góry, dziennik błędów, autojakość, sprawdzanie wywołań rysowania).
8. [ ] Przełączenie domyślne na WebGPU (WebGL2 jako zapas), usunięcie GLSL.
9. [ ] Nowe możliwości: trawa liczona na karcie, gęsta siatka terenu przy kamerze, mgła z promieniami słońca, TAA, dym i pył jako cząstki na karcie.

## Potem: szybkie efekty (docs/teren.md, „Zaległe”)
Trawa i krzewy, gęstsza siatka terenu, roślinność pustyni (palmy, suche krzewy, trawy — 0 A.D.), krawędź mapy bez
kwadratu, większa mapa 1 na 1.

## Rozjazdy (zmiany w GLSL, których jeszcze nie ma w TSL)
- Ziemia: cienie chmur (`cloudShadow` w ground.ts) i łatka pór roku (śnieg na ziemi, ślady) — jeszcze tylko w GLSL.
