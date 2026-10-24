-- Ucieczka z meczu przez sieć to porażka (24.10.2026, do wykonania w Supabase → SQL Editor).
-- Na starcie meczu każdy gracz dostaje w wynikach wpis „w toku” (porażka). Gdy dogra mecz do końca (także po powrocie
-- po zerwanym połączeniu), wpis zmienia się na prawdziwy wynik. Kto uciekł i nie wrócił, zostaje z porażką.
-- Ranking liczy wpisy „w toku” dopiero po 3 godzinach, więc trwający mecz nie psuje nikomu bilansu.

alter table public.results add column if not exists room text;
alter table public.results add column if not exists pending boolean not null default false;
create unique index if not exists results_user_room on public.results (user_id, room) where room is not null;

-- start meczu: wpis „w toku” (drugi raz dla tego samego pokoju, np. po powrocie do meczu, nic nie robi)
create or replace function public.match_begin(p_room text, p_preset text, p_nick text, p_avatar integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(p_room, '') = '' then return; end if;
  insert into public.results (user_id, nick, avatar, preset, won, minutes, room, pending)
  values (auth.uid(), left(coalesce(p_nick, ''), 20), coalesce(p_avatar, 0), left(coalesce(p_preset, ''), 10), false, 0, p_room, true)
  on conflict (user_id, room) where room is not null do nothing;
end $$;

-- koniec meczu: prawdziwy wynik w miejsce wpisu „w toku” (bez wpisu — np. mecz zaczęty przed tą zmianą — dopisuje nowy)
create or replace function public.match_end(p_room text, p_preset text, p_nick text, p_avatar integer, p_won boolean, p_minutes integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.results set won = coalesce(p_won, false), minutes = greatest(0, least(coalesce(p_minutes, 0), 600)), pending = false
    where user_id = auth.uid() and room = p_room and pending;
  if not found and not exists (select 1 from public.results where user_id = auth.uid() and room = p_room) then
    insert into public.results (user_id, nick, avatar, preset, won, minutes, room, pending)
    values (auth.uid(), left(coalesce(p_nick, ''), 20), coalesce(p_avatar, 0), left(coalesce(p_preset, ''), 10), coalesce(p_won, false), greatest(0, least(coalesce(p_minutes, 0), 600)), p_room, false);
  end if;
end $$;

grant execute on function public.match_begin(text, text, text, integer) to authenticated;
grant execute on function public.match_end(text, text, text, integer, boolean, integer) to authenticated;

-- ranking: mecz w toku liczy się jako porażka dopiero, gdy minęły 3 godziny (gracz uciekł i nie wrócił)
create or replace view public.ranking with (security_invoker = true) as
  select user_id, (array_agg(nick order by created_at desc))[1] as nick, (array_agg(avatar order by created_at desc))[1] as avatar,
         count(*) filter (where won) as wins, count(*) filter (where not won) as losses, count(*) as games
  from public.results
  where not pending or created_at < now() - interval '3 hours'
  group by user_id;
