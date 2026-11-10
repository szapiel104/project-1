-- Poprawki modeli z edytora w podglądzie modeli (Michał 10.11.2026: „przesuwać w podglądzie modeli niektóre rzeczy,
-- poprawiać model i zapisać”). Jeden wiersz na model: lista poprawek (src/render/modelfix.ts, typ Fix).
-- Czytać może każdy (podgląd modeli pokazuje poprawki od razu), zapisywać tylko administrator albo tester.
-- Do repozytorium (src/data/modelFixes.json) przenosi je skrypt: node tools/models/pull_fixes.mjs

create table if not exists public.model_fixes (
  model text primary key,
  fixes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);
alter table public.model_fixes enable row level security;

drop policy if exists "poprawki czyta każdy" on public.model_fixes;
create policy "poprawki czyta każdy" on public.model_fixes for select using (true);

drop policy if exists "poprawki zapisuje twórca" on public.model_fixes;
create policy "poprawki zapisuje twórca" on public.model_fixes for insert to authenticated
  with check (is_admin() or exists (select 1 from testers where user_id = auth.uid()));

drop policy if exists "poprawki zmienia twórca" on public.model_fixes;
create policy "poprawki zmienia twórca" on public.model_fixes for update to authenticated
  using (is_admin() or exists (select 1 from testers where user_id = auth.uid()))
  with check (is_admin() or exists (select 1 from testers where user_id = auth.uid()));
