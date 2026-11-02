-- „Kiedy był, kiedy grał” także dla kont sprzed 20261102c (Michał 2.11.2026: „nie widzę, kiedy grał”) i uwagi testera
-- w dzwoneczku także, gdy administrator sam ją dodał (żeby mógł sprawdzić, jak to wygląda).

-- ostatnie wejście: ostatnie logowanie z auth.users; ostatnia gra: ostatni mecz z historii nagród albo wyników
update public.profiles p set last_seen = greatest(p.last_seen, u.last_sign_in_at)
  from auth.users u where u.id = p.id and u.last_sign_in_at is not null;
update public.profiles p set last_played = greatest(p.last_played, s.at)
  from (select user_id, max(created_at) at from (
          select user_id, created_at from public.xp_awards
          union all select user_id, created_at from public.results) x group by user_id) s
 where s.user_id = p.id;
-- herb do kafelków znajomych, zanim gracz znów wejdzie do gry
update public.profiles p set avatar = coalesce((u.raw_user_meta_data->>'avatar')::integer, p.avatar)
  from auth.users u where u.id = p.id and p.avatar = 0;

-- nowa uwaga: powiadomienie dostaje każdy administrator, także autor
create or replace function public.note_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare av integer;
begin
  select avatar into av from profiles where id = new.author;
  insert into notifications (user_id, kind, from_id, from_nick, from_avatar, payload)
  select a.user_id, 'note', new.author, new.nick, coalesce(av, 0),
         jsonb_build_object('note', new.id, 'text', left(btrim(regexp_replace(regexp_replace(new.body, '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')), 120))
    from admins a;
  return new;
end $$;

-- zrobiona uwaga: autor dostaje powiadomienie zawsze (także gdy sam ją odhaczył)
create or replace function public.admin_note(p_id bigint, p_done boolean, p_reply text) returns void
language plpgsql security definer set search_path = public as $$
declare who uuid; body_ text; was text; n text; av integer;
begin
  if not is_admin() then raise exception 'brak uprawnień'; end if;
  select author, body, status into who, body_, was from tester_notes where id = p_id;
  if not found then raise exception 'nie ma takiej uwagi'; end if;
  update tester_notes set status = case when p_done then 'done' else 'open' end,
         done_at = case when p_done then now() else null end,
         reply = nullif(left(btrim(coalesce(p_reply, '')), 1000), '')
   where id = p_id;
  if p_done and was <> 'done' then
    select nick, avatar into n, av from profiles where id = auth.uid();
    insert into notifications (user_id, kind, from_id, from_nick, from_avatar, payload)
    values (who, 'note_done', auth.uid(), coalesce(n, ''), coalesce(av, 0),
            jsonb_build_object('note', p_id, 'text', left(btrim(regexp_replace(regexp_replace(body_, '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')), 120)));
  end if;
end $$;
revoke all on function public.admin_note(bigint, boolean, text) from public, anon;
grant execute on function public.admin_note(bigint, boolean, text) to authenticated;
