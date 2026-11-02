# Migracje do wykonania w Supabase

Michał wykonuje migracje ręcznie: Supabase → projekt „project-1” → SQL Editor → wklej plik → Run.
Każdy czat, który dodaje nową migrację, dopisuje ją tutaj. Po wykonaniu: przenieść do „Wykonane” i dopisać „wykonane DATA” w pierwszej linijce pliku.

## Czekają (stan 2.11.2026)
- `20261102_admins_achievements.sql` — administratorzy kont (pierwszy: nick `szapiel104`), panel „Administracja” w Moim rodzie i nowe liczniki do osiągnięć (zburzone, postawione, minuty, wygrane przez sieć i z trudnym botem; uzupełniane z historii meczów). Bez niej: brak panelu, nowe odznaki stoją na 0. Po wykonaniu sprawdź: `select * from admins;` — jeśli pusto, Twoje konto ma inny nick niż szapiel104: `insert into admins (user_id) select id from profiles where nick = 'TWÓJ_NICK';`
- `20261024_results_pending.sql` — ucieczka z meczu przez sieć to porażka w rankingu (0.46.1). Bez niej gra zapisuje wyniki po staremu.

## Wykonane
- `20261012_rooms_cleanup.sql`
- `20261013_friends.sql`
- `20261013_results.sql`
- `20261016_progress.sql`

Sprawdzenie, czy migracja weszła (bez logowania, kluczem publicznym z `src/net/supa.ts`): zapytanie REST o nową tabelę albo kolumnę — błąd `PGRST205` / `42703` znaczy, że jej jeszcze nie ma.
