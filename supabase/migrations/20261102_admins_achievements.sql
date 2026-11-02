-- Administratorzy kont i nowe liczniki do osiągnięć (2.11.2026, Michał: „dodaj administratorów konta, co mogą edytować
-- konto w menu, dodawać i usuwać poziomy; na razie administratorem szapiel104 i zabezpiecz to”).
--
-- Bezpieczeństwo: klient nie ma żadnych praw zapisu do tych tabel. Wszystko robią funkcje `admin_*` (security definer),
-- które na wejściu sprawdzają, czy wołający jest w tabeli `admins`; każda zmiana trafia do `admin_log`. Gość (anon)
-- nie może ich nawet wywołać. Gra działa także przed wykonaniem tej migracji (bez panelu i z odznakami z dotychczasowych liczników).

-- ---------------- liczniki do osiągnięć ----------------
alter table public.player_progress
  add column if not exists razed integer not null default 0,
  add column if not exists built integer not null default 0,
  add column if not exists minutes integer not null default 0,
  add column if not exists online_wins integer not null default 0,
  add column if not exists hard_wins integer not null default 0;

-- uzupełnienie z historii nagród (mecze sprzed migracji też się liczą)
update public.player_progress p set
  razed = s.r, built = s.b, minutes = s.m, online_wins = s.ow, hard_wins = s.hw
from (
  select user_id, sum(razed)::integer r, sum(built)::integer b, sum(minutes)::integer m,
         (count(*) filter (where won and mode = 'online'))::integer ow,
         (count(*) filter (where won and mode = 'bots3'))::integer hw
  from public.xp_awards group by user_id
) s where p.user_id = s.user_id;

-- award_match jak dotąd (20261016_progress.sql), plus nowe liczniki
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
  if prev is not null then m := least(m, floor(extract(epoch from now() - prev) / 60 * 5)::integer); end if;
  if m < 3 then g := 0;
  else
    g := least(m, 60) * 2 + case when p_won then 100 else 30 end + k * 2 + r * 5 + b;
    g := least(600, round(g * mult)::integer);
  end if;
  select coalesce(sum(a.xp), 0) into today from xp_awards a where a.user_id = uid and a.created_at > now() - interval '1 day';
  g := greatest(0, least(g, 3000 - today));
  insert into xp_awards (user_id, mode, won, minutes, kills, razed, built, xp) values (uid, coalesce(p_mode, '?'), coalesce(p_won, false), m, k, r, b, g);
  update player_progress p set xp = p.xp + g, matches = p.matches + 1, wins = p.wins + case when p_won then 1 else 0 end,
         kills = p.kills + k, razed = p.razed + r, built = p.built + b, minutes = p.minutes + m,
         online_wins = p.online_wins + case when p_won and p_mode = 'online' then 1 else 0 end,
         hard_wins = p.hard_wins + case when p_won and p_mode = 'bots3' then 1 else 0 end,
         last_award = now(), updated_at = now()
   where p.user_id = uid returning p.xp into total;
  lv := 1; left_xp := total;
  while left_xp >= xp_to_next(lv) and lv < 200 loop left_xp := left_xp - xp_to_next(lv); lv := lv + 1; end loop;
  update player_progress p set level = lv where p.user_id = uid;
  return query select g, total, lv;
end $$;
revoke all on function public.award_match(text, boolean, integer, integer, integer, integer) from public, anon;
grant execute on function public.award_match(text, boolean, integer, integer, integer, integer) to authenticated;

-- ---------------- administratorzy ----------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  added_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- każdy widzi tylko, czy sam jest administratorem (po tym gra pokazuje panel); zapisu z klienta nie ma
create policy "administrator widzi siebie" on public.admins for select to authenticated using (user_id = auth.uid());

-- pierwszy administrator: konto Michała (w grze nick RebaZius; szapiel104 to nazwa organizacji w Supabase)
insert into public.admins (user_id)
select id from public.profiles where lower(nick) in ('szapiel104', 'rebazius')
on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- dziennik działań administratorów (kto, komu, co, z jakimi wartościami)
create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  admin uuid not null references auth.users on delete cascade,
  target uuid references auth.users on delete set null,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_log enable row level security;
create policy "dziennik widzą administratorzy" on public.admin_log for select to authenticated using (public.is_admin());

-- poziom z łącznych PD (jak w award_match)
create or replace function public.level_of_xp(p_xp integer) returns integer
language plpgsql immutable as $$
declare lv integer := 1; left_xp integer := greatest(0, coalesce(p_xp, 0));
begin
  while left_xp >= xp_to_next(lv) and lv < 200 loop left_xp := left_xp - xp_to_next(lv); lv := lv + 1; end loop;
  return lv;
end $$;

-- wyszukiwanie kont po nicku (fragment, bez wielkości liter)
create or replace function public.admin_find(p_nick text)
returns table (id uuid, nick text, avatar integer, xp integer, level integer, matches integer, wins integer, kills integer,
               razed integer, built integer, minutes integer, online_wins integer, hard_wins integer, admin boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'brak uprawnień'; end if;
  return query
    select pr.id, pr.nick::text, coalesce((u.raw_user_meta_data->>'avatar')::integer, 0),
           coalesce(p.xp, 0), coalesce(p.level, 1), coalesce(p.matches, 0), coalesce(p.wins, 0), coalesce(p.kills, 0),
           coalesce(p.razed, 0), coalesce(p.built, 0), coalesce(p.minutes, 0), coalesce(p.online_wins, 0), coalesce(p.hard_wins, 0),
           exists (select 1 from admins a where a.user_id = pr.id)
      from profiles pr
      left join player_progress p on p.user_id = pr.id
      left join auth.users u on u.id = pr.id
     where pr.nick ilike '%' || replace(replace(coalesce(p_nick, ''), '%', ''), '_', '\_') || '%'
     order by lower(pr.nick)
     limit 30;
end $$;

-- ustawienie postępu konta (poziom wynika z PD); wartości ujemne i wygrane ponad liczbę meczów są przycinane
create or replace function public.admin_set_progress(p_user uuid, p_xp integer, p_matches integer, p_wins integer, p_kills integer,
  p_razed integer, p_built integer, p_minutes integer, p_online_wins integer, p_hard_wins integer)
returns table (xp integer, level integer)
language plpgsql security definer set search_path = public as $$
declare
  x integer := greatest(0, least(coalesce(p_xp, 0), 50000000));
  mt integer := greatest(0, coalesce(p_matches, 0));
  w integer := greatest(0, least(coalesce(p_wins, 0), greatest(0, coalesce(p_matches, 0))));
  lv integer;
begin
  if not is_admin() then raise exception 'brak uprawnień'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'nie ma takiego konta'; end if;
  lv := level_of_xp(x);
  insert into player_progress (user_id) values (p_user) on conflict (user_id) do nothing;
  update player_progress p set xp = x, level = lv, matches = mt, wins = w,
         kills = greatest(0, coalesce(p_kills, 0)), razed = greatest(0, coalesce(p_razed, 0)), built = greatest(0, coalesce(p_built, 0)),
         minutes = greatest(0, coalesce(p_minutes, 0)), online_wins = greatest(0, least(coalesce(p_online_wins, 0), w)),
         hard_wins = greatest(0, least(coalesce(p_hard_wins, 0), w)), updated_at = now()
   where p.user_id = p_user;
  insert into admin_log (admin, target, action, detail) values (auth.uid(), p_user, 'progress',
    jsonb_build_object('xp', x, 'level', lv, 'matches', mt, 'wins', w, 'kills', p_kills, 'razed', p_razed, 'built', p_built,
                       'minutes', p_minutes, 'online_wins', p_online_wins, 'hard_wins', p_hard_wins));
  return query select x, lv;
end $$;

-- zmiana nicku innego konta (ten sam limit co w grze: 3–20 znaków, nick unikalny)
create or replace function public.admin_set_nick(p_user uuid, p_nick text) returns void
language plpgsql security definer set search_path = public as $$
declare n text := btrim(coalesce(p_nick, ''));
begin
  if not is_admin() then raise exception 'brak uprawnień'; end if;
  if char_length(n) < 3 or char_length(n) > 20 then raise exception 'nick musi mieć 3–20 znaków'; end if;
  update profiles set nick = n where id = p_user;
  if not found then raise exception 'nie ma takiego konta'; end if;
  insert into admin_log (admin, target, action, detail) values (auth.uid(), p_user, 'nick', jsonb_build_object('nick', n));
end $$;

-- nadanie i odebranie praw administratora (siebie odebrać nie można — żeby nie zostać bez administratora)
create or replace function public.admin_grant(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'brak uprawnień'; end if;
  if p_on then
    if not exists (select 1 from profiles where id = p_user) then raise exception 'nie ma takiego konta'; end if;
    insert into admins (user_id, added_by) values (p_user, auth.uid()) on conflict do nothing;
  else
    if p_user = auth.uid() then raise exception 'nie można odebrać praw samemu sobie'; end if;
    delete from admins where user_id = p_user;
  end if;
  insert into admin_log (admin, target, action, detail) values (auth.uid(), p_user, case when p_on then 'grant' else 'revoke' end, null);
end $$;

revoke all on function public.level_of_xp(integer) from public, anon;
revoke all on function public.admin_find(text) from public, anon;
revoke all on function public.admin_set_progress(uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer) from public, anon;
revoke all on function public.admin_set_nick(uuid, text) from public, anon;
revoke all on function public.admin_grant(uuid, boolean) from public, anon;
grant execute on function public.level_of_xp(integer) to authenticated;
grant execute on function public.admin_find(text) to authenticated;
grant execute on function public.admin_set_progress(uuid, integer, integer, integer, integer, integer, integer, integer, integer, integer) to authenticated;
grant execute on function public.admin_set_nick(uuid, text) to authenticated;
grant execute on function public.admin_grant(uuid, boolean) to authenticated;
