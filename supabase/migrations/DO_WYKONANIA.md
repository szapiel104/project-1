# Migracje do wykonania w Supabase

Michał wykonuje migracje ręcznie: Supabase → projekt „project-1” → SQL Editor → wklej plik → Run.
Każdy czat, który dodaje nową migrację, dopisuje ją tutaj. Po wykonaniu: przenieść do „Wykonane” i dopisać „wykonane DATA” w pierwszej linijce pliku.

## Czekają (stan 24.10.2026)
- `20261024_results_pending.sql` — ucieczka z meczu przez sieć to porażka w rankingu (0.46.1). Bez niej gra zapisuje wyniki po staremu.

## Wykonane
- `20261012_rooms_cleanup.sql`
- `20261013_friends.sql`
- `20261013_results.sql`
- `20261016_progress.sql`

Sprawdzenie, czy migracja weszła (bez logowania, kluczem publicznym z `src/net/supa.ts`): zapytanie REST o nową tabelę albo kolumnę — błąd `PGRST205` / `42703` znaczy, że jej jeszcze nie ma.
