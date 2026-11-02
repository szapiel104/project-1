-- Poziomy pod e-sport (przegląd 2.11.2026): jeden mecz = jedna nagroda.
-- Do tej pory dało się wczytać zapis tuż przed zwycięstwem i wygrywać ten sam mecz kilka razy (premia za wygraną
-- i wszystkie pokonane wrogi od początku meczu za każdym razem). Teraz każdy mecz ma swój numer (`p_match`:
-- losowy przy nowej grze, zapisywany w zapisie gry; w meczu przez sieć — numer pokoju) i baza przyznaje PD
-- za dany numer tylko raz. Powtórne zgłoszenie zwraca 0 PD i obecny stan (bezpieczne ponawianie po zerwaniu sieci).

alter table public.xp_awards add column if not exists match text;
create unique index if not exists xp_awards_user_match on public.xp_awards (user_id, match) where match is not null;

drop function if exists public.award_match(text, boolean, integer, integer, integer, integer);
create or replace function public.award_match(p_mode text, p_won boolean, p_minutes integer, p_kills integer, p_razed integer, p_built integer, p_match text default null)
returns table (gained integer, xp integer, level integer)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mult numeric;
  m integer := greatest(0, least(coalesce(p_minutes, 0), 180));
  k integer := greatest(0, least(coalesce(p_kills, 0), 300));
  r integer := greatest(0, least(coalesce(p_razed, 0), 60));
  b integer := greatest(0, least(coalesce(p_built, 0), 100));
  mid text := nullif(left(btrim(coalesce(p_match, '')), 64), '');
  g integer;
  prev timestamptz;
  today integer;
  total integer;
  lv integer;
  left_xp integer;
begin
  if uid is null then raise exception 'nie zalogowano'; end if;
  insert into player_progress (user_id) values (uid) on conflict (user_id) do nothing;
  select last_award into prev from player_progress where user_id = uid for update;
  -- ten mecz już nagrodzony: nic nie dodajemy, zwracamy obecny stan
  if mid is not null and exists (select 1 from xp_awards a where a.user_id = uid and a.match = mid) then
    return query select 0, p.xp, p.level from player_progress p where p.user_id = uid;
    return;
  end if;
  mult := case p_mode when 'online' then 1 when 'coop' then 0.7 when 'bots0' then 0.2 when 'bots1' then 0.4
                      when 'bots2' then 0.6 when 'bots3' then 0.8 else 0 end;
  if prev is not null then m := least(m, floor(extract(epoch from now() - prev) / 60 * 5)::integer); end if;
  if m < 3 then g := 0;
  else
    g := least(m, 60) * 2 + case when p_won then 100 else 30 end + k * 2 + r * 5 + b;
    g := least(600, round(g * mult)::integer);
  end if;
  select coalesce(sum(a.xp), 0) into today from xp_awards a where a.user_id = uid and a.created_at > now() - interval '1 day';
  g := greatest(0, least(g, 3000 - today));
  insert into xp_awards (user_id, mode, won, minutes, kills, razed, built, xp, match) values (uid, coalesce(p_mode, '?'), coalesce(p_won, false), m, k, r, b, g, mid);
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
revoke all on function public.award_match(text, boolean, integer, integer, integer, integer, text) from public, anon;
grant execute on function public.award_match(text, boolean, integer, integer, integer, integer, text) to authenticated;
