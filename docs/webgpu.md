# Przejście na WebGPU (Michał 3.11.2026: „robimy WebGPU, potem efekty”)

Cel: nowoczesny obraz i wydajność — trawa i roślinność liczone na karcie graficznej (compute), tysiące cząstek
(dym, pył, deszcz, śnieg), tablice tekstur zamiast limitu 16 tekstur w shaderze ziemi, porządne cienie, mgła
z promieniami słońca, TAA. Silnik: `three/webgpu` (`WebGPURenderer`) + TSL (język węzłów shaderów). Ten sam kod działa
też w trybie zgodności WebGL2 (`forceWebGL`), więc gracz bez WebGPU nadal zagra.

## Jak przechodzimy — flaga, nie długa gałąź
Nad grą pracuje kilka czatów naraz, więc długa gałąź rozjechałaby się z `main` po jednym dniu. Zamiast tego:
- **Od 0.91.0 WebGPU jest domyślne na produkcji** (Michał 3.11.2026: „rób od razu na produkcji, nikt w to nie gra jeszcze”). Stary WebGL: `?webgl=1` (zapas, porównania, narzędzia w `tools/check`). Rzeczy bez bliźniaka w TSL są do czasu przeniesienia schowane albo uboższe.
- **Od 0.94.43 tylko WebGPU** (Michał 6.11.2026: „WebGL już niepotrzebny, zostawiamy tylko WebGPU. Tam to skasuj”). `?webgl=1` usunięte (`GPU_MODE` zawsze prawda w przeglądarce). Dalej partiami: usuwać gałęzie `gpuMods ? … : <GLSL>` i same shadery GLSL plik po pliku (ok. 22 pliki z `ShaderMaterial`/`onBeforeCompile`), po każdym `tsc` + `build`. Gdzie bliźniak TSL jeszcze nie istnieje, najpierw go dopisać, potem kasować GLSL.
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
- Światła w tablicach (DynamicLighting; klastry były ok. 50× droższe przy składaniu, zostały pod `?swiatla=klastry`); pełne limity karty (`requiredLimits`).
- Macierz instancji w własnych węzłach: `instanceMatrixNode()` (atrybut mat4 nie istnieje w WebGPU).
- 0.94.5: pule instancji zawsze z macierzami w atrybucie (`getUniformBufferLimit = 0` dla InstancedMesh) — wcześniej każda mała pula miała własny kod shadera (374 programy wierzchołków → ok. 100).
- 0.94.8: `Bindings.deleteForRender` nie zwalnia wiązań RenderObjectu, który nigdy się nie narysował (odłożony przez budżet) — inaczej wspólny bufor uniformów był niszczony i obraz padał (mleczny ekran).
- 0.94.11: place budowy bez płaszczyzn przycinania (każda kopia = osobny ClippingContext w kluczu = składanie na każdą budowę); wspólna kopia na materiał z `maskNode` i `userData.siteCut`.
- **Pułapki three.js r186 (dla wszystkich czatów):**
  - złożony shader jest wspólny dla materiałów o tym samym kluczu (właściwości materiału + `customProgramCacheKey`), a węzły (`uniform(...)`, `texture(...)`) niesie tylko pierwszy z nich — węzeł z teksturą albo barwą konkretnego materiału wymaga własnego `userData.gpuKey` (np. z `m.uuid`), a wartości różne dla obiektów: `userData('nazwa', 'float')` (czyta z rysowanego obiektu);
  - `materialReference(...)` w węzłach dopinanych do zwykłych materiałów wywrócił grę (0.94.9, cienie) — zamiast niego `uniform(m.color)` itp.;
  - `renderOutput` w przejściach obrazu z jawnym tone mappingiem i przestrzenią barw (FXAA/SMAA liczą podgraf bez kontekstu);
  - kamera cienia z samą warstwą 0 przejmuje warstwy rysującej kamery (lustro wody) — `sun.shadow.camera.layers` ma mieć też warstwę odbicia;
  - zmiana AO (MRT z normalnymi) albo MSAA = nowy kontekst rysowania = składanie wszystkich materiałów od nowa.
- **Testy w chmurze bez karty:** Chromium bez okna gubi urządzenie WebGPU („Instance dropped”), więc węzły sprawdza się z `&webgpu=gl` (WebGPURenderer na WebGL2, te same węzły; wolno — ok. 25 s do startu). Skrypt: `/home/claude/scripts/gpushot.mjs <url> <png> [s] [js]` (lokalnie `npx vite preview --port 4173`).
- Do zrobienia: pula instancji = osobne składanie (three.js dokłada `object.uuid` do klucza InstancedMesh — TODO w RenderObject.js), osobne składanie na każde przejście (obraz, cień, odbicie wody), koszt rysowania na procesorze. (każda InstancedMesh = osobne składanie w three.js), koszt rysowania na procesorze (~800–1000 wywołań, odbicie wody rysuje scenę drugi raz).

## Rozjazdy (zmiany w GLSL, których jeszcze nie ma w TSL)
- Cienie chmur: na WebGPU jedno przejście w postNode.ts (0.93.8), na WebGL dalej cloudShade.
- Ślady na śniegu w ziemi (uTrail) i jesienne łaty na ziemi — tylko GLSL.
- Parallax: gpu/pomNode.ts gotowe, ale włączone tylko pod ?pom=1 (0.94.9 wywróciło grę: materialReference przy cieniach).
- Mapa otoczenia: na WebGPU od 0.94.4 (gpu/envNode.ts).
- Widok spod wody: tylko WebGPU (gpu/underwaterNode.ts), na WebGL brak.

- 0.94.25 (4.11.2026): wspólne shadery pul (`?pule`) domyślnie wyłączone. U Michała (dev 1v1, 194 budynki, zapis wczytany) każda klatka padała: `DrawIndexed(24, 118)` z buforem macierzy na 66 sztuk (4224 B) — pula dostawała cudzy bufor mimo podstawiania w `getAttributes` (0.94.24 rozszerzyło warunek, nie pomogło; przycięcie `count` się nie odpaliło, więc to nie za duży `count`). Nie odtworzone na SwiftShader (`npm run check:console -- --webgpu`). Przed ponownym włączeniem: znaleźć, która ścieżka rysuje pulę bez podmienionego bufora.
- 0.94.29 (5.11.2026): `?pule=1` domyślnie (wspólne shadery tylko dla pul ze zwykłymi materiałami). Sprawdzone w Chrome Michała na jego zapisie: `?pule=2` dalej daje `Instance range (count 477) requires a larger buffer (18560)` w przejściu cienia (`ShadowMaterial`, slot 6) — straż z 0.94.28 w `backend.draw` NIE widzi za małego bufora w `getVertexBuffers()` (ani w tablicy, ani w karcie), więc do karty idzie bufor spoza listy obiektu: podejrzenie — `currentSets.attributes[i] === vertexBuffer` w `_draw` pomija `setVertexBuffer`, a pod tym samym obiektem JS w karcie siedzi już inny bufor (albo wspólny stan węzła instancji dla cienia). `?pule=1` — 0 błędów. Pusty ekran z 0.94.24–0.94.26 to osobna sprawa: przejścia obrazu (QuadMesh) w kolejce potoków (naprawione w 0.94.27).


## Plan wydajności (Michał 7.11.2026: „inni robią w WebGPU gry 100 razy ładniejsze i mają 120 FPS”)
Hamuje procesor: tysiące osobnych obiektów, każdy przez ogólną ścieżkę three.js (dziesiątki µs na rysowanie). Etapy, po każdym gra działa, Michał mierzy:
1. [ ] Postacie: jeden rodzaj = jedno rysowanie na materiał — części postaci sklejone w jedną siatkę z numerem części w wierzchołku, macierze części wszystkich ludzi w teksturze, ruch w shaderze TSL (wzór: `gpu/skinNode.ts`).
2. [ ] Świat statyczny w dużych kawałkach: budynki z daleka, kamyki, płoty, graty sklejone po fragmentach mapy, tekstury w tablicy.
3. [ ] Cienie: nieruchome rzeczy w mapie cieni liczonej tylko po ruchu kamery/słońca; ruchome postacie osobno.
4. [ ] Las i krzaki wybierane na karcie (indirect draw), bez list na procesorze.
