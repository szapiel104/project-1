-- Poziomy gracza i doświadczenie (PD) za mecze (16.10.2026, wykonane — sprawdzone 24.10.2026). Wzór jak w src/data/progress.ts.
-- Postęp zmienia wyłącznie funkcja award_match (security definer); klient może tylko czytać.

create table public.player_progress (
  user_id uuid primary key references auth.users on delete cascade,
  xp integer not null default 0,
  level integer not null default 1,
  matches integer not null default 0,
  wins integer not null default 0,
  kills integer not null default 0,
  last_award timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.player_progress enable row level security;
-- poziomy widać w pokojach i rankingu, więc czytać mogą wszyscy zalogowani; zapisu z klienta nie ma (brak polityk insert/update)
create policy "postęp widzą zalogowani" on public.player_progress for select to authenticated using (true);

-- historia nagród (do dziennego limitu i do wglądu)
create table public.xp_awards (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  mode text not null,
  won boolean not null,
  minutes integer not null,
  kills integer not null,
  razed integer not null,
  built integer not null,
  xp integer not null,
  created_at timestamptz not null default now()
);
alter table public.xp_awards enable row level security;
create policy "swoje nagrody widzi gracz" on public.xp_awards for select to authenticated using (user_id = auth.uid());
create index xp_awards_user on public.xp_awards (user_id, created_at desc);

-- PD potrzebne z poziomu L na następny: round(100 * L^1.5)
create or replace function public.xp_to_next(l integer) returns integer language sql immutable as $$
  select round(100 * power(l, 1.5))::integer
$$;

create or replace function public.award_match(p_mode text, p_won boolean, p_minutes integer, p_kills integer, p_razed integer, p_built integer)
returns table (gained integer, xp integer, level integer)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mult numeric;
  m integer := greatest(0, least(coalesce(p_minutes, 0), 180));
  k integer := greatest(0, least(coalesce(p_kills, 0), 300));
  r integer := greatest(0, least(coalesce(p_razed, 0), 60));
  b integer := greatest(0, least(coalesce(p_built, 0), 100));
  g integer;
  prev timestamptz;
  today integer;
  total integer;
  lv integer;
  left_xp integer;
begin
  if uid is null then raise exception 'nie zalogowano'; end if;
  mult := case p_mode when 'online' then 1 when 'coop' then 0.7 when 'bots0' then 0.2 when 'bots1' then 0.4
                      when 'bots2' then 0.6 when 'bots3' then 0.8 else 0 end;
  insert into player_progress (user_id) values (uid) on conflict (user_id) do nothing;
  select last_award into prev from player_progress where user_id = uid for update;
  -- mecz nie mógł trwać dłużej niż czas od poprzedniej nagrody (tempo gry najwyżej 5×): dwa mecze naraz się nie liczą
  if prev is not null then m := least(m, floor(extract(epoch from now() - prev) / 60 * 5)::integer); end if;
  if m < 3 then g := 0;
  else
    g := least(m, 60) * 2 + case when p_won then 100 else 30 end + k * 2 + r * 5 + b;
    g := least(600, round(g * mult)::integer);
  end if;
  -- dzienny limit: najwyżej 3000 PD na dobę
  select coalesce(sum(a.xp), 0) into today from xp_awards a where a.user_id = uid and a.created_at > now() - interval '1 day';
  g := greatest(0, least(g, 3000 - today));
  insert into xp_awards (user_id, mode, won, minutes, kills, razed, built, xp) values (uid, coalesce(p_mode, '?'), coalesce(p_won, false), m, k, r, b, g);
  update player_progress p set xp = p.xp + g, matches = p.matches + 1, wins = p.wins + case when p_won then 1 else 0 end,
         kills = p.kills + k, last_award = now(), updated_at = now()
   where p.user_id = uid returning p.xp into total;
  -- poziom z łącznych PD
  lv := 1; left_xp := total;
  while left_xp >= xp_to_next(lv) and lv < 200 loop left_xp := left_xp - xp_to_next(lv); lv := lv + 1; end loop;
  update player_progress p set level = lv where p.user_id = uid;
  return query select g, total, lv;
end $$;

revoke all on function public.award_match(text, boolean, integer, integer, integer, integer) from public, anon;
grant execute on function public.award_match(text, boolean, integer, integer, integer, integer) to authenticated;
