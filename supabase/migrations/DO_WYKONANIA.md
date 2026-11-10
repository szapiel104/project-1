# Migracje do wykonania w Supabase

Michał wykonuje migracje ręcznie: Supabase → projekt „project-1” → SQL Editor → wklej plik → Run.
Każdy czat, który dodaje nową migrację, dopisuje ją tutaj. Po wykonaniu: przenieść do „Wykonane” i dopisać „wykonane DATA” w pierwszej linijce pliku.

## Czekają (stan 10.11.2026)
- (nic)

## Wykonane
- `20261110_model_fixes.sql` — wykonane 10.11.2026 (przez czat, Supabase MCP, na prośbę Michała)
- `20261103_note_delete.sql` — wykonane 3.11.2026
- `20261102g_award_once.sql` — wykonane 3.11.2026
- `20261102f_saves_storage.sql` — wykonane 3.11.2026
- `20261102e_messages.sql` — wykonane 2.11.2026
- `20261102d_seen_backfill.sql` — wykonane 2.11.2026
- `20261102c_social.sql` — wykonane 2.11.2026
- `20261102b_testers.sql` — wykonane 2.11.2026 (RebaZius: administrator i twórca, SzyMi: tester)
- `20261024_results_pending.sql` — wykonane 2.11.2026
- `20261102_admins_achievements.sql` — wykonane 2.11.2026. Konto Michała w grze to `RebaZius` (nie szapiel104); administratora dopisuje Michał ręcznie: `insert into public.admins (user_id) select id from public.profiles where nick = 'RebaZius' on conflict do nothing;`
- `20261012_rooms_cleanup.sql`
- `20261013_friends.sql`
- `20261013_results.sql`
- `20261016_progress.sql`

Sprawdzenie, czy migracja weszła (bez logowania, kluczem publicznym z `src/net/supa.ts`): zapytanie REST o nową tabelę albo kolumnę — błąd `PGRST205` / `42703` znaczy, że jej jeszcze nie ma.
