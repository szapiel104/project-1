-- Znajomi jak na Steamie (2.11.2026, Michał: „dodaję znajomych w grze, wyszukuję, wysyłam zaproszenie, jest panel
-- powiadomień z dzwoneczkiem, akceptuję, widzę, kiedy jest online, kiedy gra, kiedy grał ostatnio; mogę zaprosić do gry
-- albo dołączyć; szukam nowych znajomych”).
--
-- Znajomość = dwa wiersze w `friends` (A→B i B→A). Jeden wiersz A→B = zaproszenie od A czekające na B.
-- Powiadomienia zapisuje baza (wyzwalacz przy zaproszeniu i akceptacji, funkcja przy zaproszeniu do gry) — przeglądarka
-- nie może wpisać nikomu powiadomienia sama.

-- ---------------- ostatnio widziany / ostatnio grał ----------------
alter table public.profiles add column if not exists last_seen timestamptz;
alter table public.profiles add column if not exists last_played timestamptz;
alter table public.profiles add column if not exists avatar integer not null default 0;

-- gracz zgłasza się co minutę (i przy zmianie miejsca): czas wejścia i, gdy gra, czas gry; herb do list znajomych
create or replace function public.seen(p_playing boolean, p_avatar integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update profiles set last_seen = now(),
         last_played = case when p_playing then now() else last_played end,
         avatar = coalesce(p_avatar, avatar)
   where id = auth.uid();
end $$;
revoke all on function public.seen(boolean, integer) from public, anon;
grant execute on function public.seen(boolean, integer) to authenticated;

-- ---------------- odrzucenie zaproszenia: zaproszony może usunąć wiersz skierowany do niego ----------------
drop policy if exists "odrzucam zaproszenie do znajomych" on public.friends;
create policy "odrzucam zaproszenie do znajomych" on public.friends for delete to authenticated using (friend_id = auth.uid());

-- ---------------- powiadomienia ----------------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('friend_request', 'friend_accept', 'invite', 'note', 'note_done')),
  from_id uuid references auth.users on delete cascade,
  from_nick text not null default '',
  from_avatar integer not null default 0,
  payload jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "swoje powiadomienia widzę" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "swoje powiadomienia oznaczam" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "swoje powiadomienia usuwam" on public.notifications for delete to authenticated using (user_id = auth.uid());
create index if not exists notifications_user on public.notifications (user_id, created_at desc);

-- zaproszenie i akceptacja znajomości same tworzą powiadomienie (A→B: zaproszenie albo, gdy B→A już było, akceptacja)
create or replace function public.friend_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare n text; av integer; back boolean;
begin
  select nick, avatar into n, av from profiles where id = new.user_id;
  back := exists (select 1 from friends where user_id = new.friend_id and friend_id = new.user_id);
  -- przy akceptacji stare zaproszenie znika z dzwoneczka akceptującego
  if back then delete from notifications where user_id = new.user_id and from_id = new.friend_id and kind = 'friend_request'; end if;
  insert into notifications (user_id, kind, from_id, from_nick, from_avatar)
  values (new.friend_id, case when back then 'friend_accept' else 'friend_request' end, new.user_id, coalesce(n, ''), coalesce(av, 0));
  return new;
end $$;
drop trigger if exists friends_notify on public.friends;
create trigger friends_notify after insert on public.friends for each row execute function public.friend_notify();

-- zaproszenie do gry: tylko do znajomego (obie strony się dodały); powiadomienie zostaje też, gdy był poza grą
create or replace function public.notify_invite(p_to uuid, p_room text, p_room_name text) returns void
language plpgsql security definer set search_path = public as $$
declare n text; av integer;
begin
  if auth.uid() is null then raise exception 'nie zalogowano'; end if;
  if not (exists (select 1 from friends where user_id = auth.uid() and friend_id = p_to)
      and exists (select 1 from friends where user_id = p_to and friend_id = auth.uid())) then
    raise exception 'zapraszać można tylko znajomych';
  end if;
  select nick, avatar into n, av from profiles where id = auth.uid();
  delete from notifications where user_id = p_to and from_id = auth.uid() and kind = 'invite';
  insert into notifications (user_id, kind, from_id, from_nick, from_avatar, payload)
  values (p_to, 'invite', auth.uid(), coalesce(n, ''), coalesce(av, 0), jsonb_build_object('room', p_room, 'name', left(coalesce(p_room_name, ''), 60)));
end $$;
revoke all on function public.notify_invite(uuid, text, text) from public, anon;
grant execute on function public.notify_invite(uuid, text, text) to authenticated;

-- ---------------- uwagi testerów w dzwoneczku (Michał 2.11.2026: „widzę w powiadomieniach, że tester dodał uwagę,
-- i mogę stamtąd przejść do uwag”); tester dostaje powiadomienie, gdy jego uwaga jest zrobiona ----------------
create or replace function public.note_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare av integer;
begin
  select avatar into av from profiles where id = new.author;
  insert into notifications (user_id, kind, from_id, from_nick, from_avatar, payload)
  select a.user_id, 'note', new.author, new.nick, coalesce(av, 0), jsonb_build_object('note', new.id, 'text', left(new.body, 120))
    from admins a where a.user_id <> new.author;
  return new;
end $$;
drop trigger if exists tester_notes_notify on public.tester_notes;
create trigger tester_notes_notify after insert on public.tester_notes for each row execute function public.note_notify();

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
  if p_done and was <> 'done' and who <> auth.uid() then
    select nick, avatar into n, av from profiles where id = auth.uid();
    insert into notifications (user_id, kind, from_id, from_nick, from_avatar, payload)
    values (who, 'note_done', auth.uid(), coalesce(n, ''), coalesce(av, 0), jsonb_build_object('note', p_id, 'text', left(body_, 120)));
  end if;
end $$;
revoke all on function public.admin_note(bigint, boolean, text) from public, anon;
grant execute on function public.admin_note(bigint, boolean, text) to authenticated;

-- dzwoneczek odświeża się na żywo
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
