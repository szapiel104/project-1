# Uszkodzenia murów i rusztowania przy naprawie

Sama grafika — symulacja się nie zmienia (wytrzymałość `hp`, naprawa w `sim/systems/army.ts` → `repairSystem`).

## Stopnie zużycia (`src/render/wear.ts`)
Ubytek = 1 − hp / maxHp.
- 0: < 10% — budowla cała
- 1: od 10% — rysy
- 2: od 35% — pęknięcia z odpryskami, okruchy/drzazgi pod co drugim pęknięciem
- 3: od 65% — długie pęknięcia, wyrwy, kupki gruzu (po 4 kawałki)

Dotyczy budynków z kategorii obrony (bez drabiny) i twierdzy. Drewno: częstokół, brama, wieża strażnicza; reszta to kamień.

## Rysowanie (`src/render/damage.ts`)
- Tekstury pęknięć i drzazg rysowane na płótnie (3 na kamień, 3 na drewno), nakładane jako płaskie naklejki 12 mm przed licem.
- Miejsca na ścianie: mur kamienny — odsłonięte boki bloku między cokołem a gzymsem; wieże, bramy, twierdza — promienie z zewnątrz przez `boundsTree` (BVH), tylko pionowe ściany zwrócone na zewnątrz, w dolnych 2/3 wysokości. Liczone raz na budynek.
- Częstokół: złamane i przekrzywione bale w `src/render/walls.ts` (klucz przeliczenia ma stopień zużycia).
- Wszystko w 8 siatkach instancji, przeliczane tylko przy zmianie stopnia którejś budowli.

## Rusztowania (`src/render/repairs.ts`)
- Staje, gdy jakiś pracownik ma fazę `Repairing` na budynku bez budowy i z hp < max; stoi, dopóki ktoś ma ten budynek za cel (`ToRepair`, `ToFetch`, `Repairing`) i hp < max.
- Rośnie 2,2 s (słupy po kolei, poprzeczki, pomost od 80%, zastrzał na końcu), rozbiórka 1,8 s; powrót do roboty w trakcie rozbiórki — rośnie dalej od tego, co zostało.
- Odcinek muru: jedna ściana rusztowania po stronie inżyniera. Do 3 pól: dookoła. Większe: odcinek 3 pól przy ścianie, przy której stoi inżynier (do 3,2 wysokości).
