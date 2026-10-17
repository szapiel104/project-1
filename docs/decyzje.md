# Decyzje architektoniczne

## Etap 1

- **Trzy warstwy.** `sim/` nie importuje nic z `render/`, `ui/`, `net/` ani z Three.js. Renderer i interfejs tylko czytają stan i wysyłają komendy.
- **Determinizm.** Symulacja używa wyłącznie liczb całkowitych, własnego generatora (`sim/rng.ts`, mulberry32) i szumu w stałym przecinku. `Math.random` wolno wołać tylko poza `sim/` (np. losowanie nazwy mapy w interfejsie).
- **Symetria map.** Mapa jest symetryczna środkowo (obrót o 180°): druga połowa to odbicie pierwszej, więc drużyny mają identyczny teren i surowce. Sprawdza to test.
- **Tryby jako dane.** Rozmiar mapy i pozycje startowe trybów 1v1, 2v2, 4v4 leżą w `data/maps.ts`.
- **Skrót stanu.** `stateHash` (FNV‑1a) z ticka, stanu generatora i mapy. Będzie rozszerzany o każdy nowy element stanu; to podstawa wykrywania rozjazdu w multiplayerze.
- **Modele.** `render/models.ts` to fabryka z interfejsem `ModelFactory`. Podmiana na glTF = nowa implementacja fabryki.
- **Ścieżki względne** (`base: './'` w Vite), żeby ten sam build działał na GitHub Pages, Cloudflare Pages i własnej domenie.
- **Krok symulacji:** 10 ticków na sekundę (`TICKS_PER_SECOND`).
- **Brak licencji** w repo celowo: kod jest publiczny do wglądu, ale bez prawa do użycia.

## Etap 2

- **Komendy.** Gracz wpływa na grę wyłącznie przez `Command` (`sim/step.ts`). Symulacja sama sprawdza każdą komendę (właściciel, koszt, miejsce), bo w grze sieciowej nie wolno ufać klientowi.
- **Budynki jako dane.** `data/buildings.ts`: rozmiar, koszt, miejsca dla ludności, produkcja. Indeks budynku trafia do stanu i skrótu, więc nowe wpisy dopisujemy tylko na końcu listy.
- **Zasady gospodarki** (racje, podatki, tempo) w `data/rules.ts`. Balans zmienia się tam, nie w systemach.
- **Budowa natychmiastowa**, jak w Twierdzy. Koszt znika od razu.
- **Zasoby są wspólne dla gracza**, nie leżą fizycznie w konkretnym składzie. Skład i spichlerz to bliższe punkty odbioru; twierdza przyjmuje wszystko.
- **Lasy się wyczerpują (ścięte drzewo = polana), złoża już nie mają znaczenia:** kamień, żelazo i rudę daje jedna kopalnia pod górami (17.10), stare pola złóż zostały na mapie tylko jako wygląd; dawne wyczerpywanie złóż (`depositYields`) dotyczy już tylko starych kamieniołomów z zapisów.
- **Droga:** Dijkstra po siatce, 8 kierunków, remisy rozstrzyga numer pola. Wystarcza na dziesiątki chłopów; przy wojsku (etap 4) dojdą pola przepływu albo wspólne ścieżki dla grup.
- **Góry na krańcach** to osobny typ terenu (nie do przejścia). Kamera nie wyjeżdża poza grywalny środek, a za mapą stoją ozdobne szczyty we mgle.

## Zapis gry

- `sim/save.ts` zamienia stan na zwykłe dane i z powrotem. Mapy nie zapisujemy, odtwarza się z ziarna.
- Na razie zapis leży w pamięci przeglądarki (`localStorage`). Ten sam format pójdzie później do Supabase i do powtórek.
- **Przy każdej zmianie kształtu stanu trzeba podbić `SAVE_VERSION`**, inaczej stary zapis wczyta się błędnie. Dopisanie budynku albo surowca unieważnia zapis samo.

## Platforma: komputer (12.10.2026)

Gra powstaje na komputery (mysz i klawiatura, duży ekran). Telefonów i dotyku nie wspieramy ani nie testujemy; nie dokładamy osobnych układów i wariantów graficznych pod telefon.

## Modele z kodu zostają (12.10.2026)

Próba gotowych modeli KayKit odrzucona (styl zbyt bajkowy). Budynki dalej składamy w kodzie. Pomocnicze biblioteki: n8ao (cieniowanie zagłębień), three-bvh-csg (wycinanie otworów: okna, drzwi, łuki), simplex-noise (naturalne nierówności brył). Wersja z próbą KayKit: gałąź kaykit-przekroje.

## Testy w przeglądarce (12.10.2026)

- `?test=1` w adresie: tekstury 256 px, bez cieni, bez cieniowania zagłębień, bez miniatur, mała puszcza, bez menu. Start w ~1,5 s zamiast minut w przeglądarce bez karty graficznej.
- `window.__test`: `build(id)` stawia budynek na pierwszym wolnym miejscu, `give(n)` dodaje surowce, `train(n)` szkoli włóczników, `run(ticks)` przewija symulację, `look(id)` ustawia kamerę, `state()` zwraca stan.
- Wygląd sprawdzamy w Chrome Michała (rozszerzenie Claude in Chrome, prawdziwa karta graficzna) albo na stronie podglad.html (jeden model, serwer deweloperski Vite).
