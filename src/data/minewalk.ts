/**
 * Kopalnia: ile ticków kopacz idzie sztolnią od wrót do swojego przodka (zwykłym krokiem, z drabiną na dolny poziom).
 * Kolejność jak miejsca w sztolni (render/scene.ts, MINE_LEVEL_SPOTS: przodki górne i dolne na przemian) i jak załoga
 * (`crewOf`: brygadzista, potem górnicy). Liczby są wpisane na stałe, żeby symulacja u obu graczy liczyła identycznie;
 * po zmianie modelu sztolni (tools/models/minelevel) test tests/minepath.test.ts poda nowe wartości.
 */
export const MINE_SLOT_WALK = [103, 151, 103, 155, 100, 160, 99, 140, 75, 152, 72, 137, 68, 84];

/** Droga w jedną stronę dla kopacza z danego miejsca w załodze */
export const mineWalkTicks = (slot: number): number => MINE_SLOT_WALK[slot % MINE_SLOT_WALK.length]!;
