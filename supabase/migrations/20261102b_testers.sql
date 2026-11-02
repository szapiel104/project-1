-- Rola testera (2.11.2026, Michał: „zrób rolę tester — może w trakcie gry włączyć sobie tryb deweloperski i testować
-- nawet w grze solo; SzyMi jest testerem i mu się to w menu wyświetla”).
-- Tester (i każdy administrator) widzi w menu przełącznik „Tryb deweloperski” i może otworzyć panel dewelopera (F9)
-- w każdej grze solo z botami. Gra przez sieć zostaje bez panelu dla wszystkich. Rolę nadaje i odbiera administrator.

create table if not exists public.testers (
  user_id uuid primary key references auth.users on delete cascade,
  added_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.testers enable row level security;
create policy "tester widzi siebie" on public.testers for select to authenticated using (user_id = auth.uid());

-- pierwszy tester: SzyMi
insert into public.testers (user_id) select id from public.profiles where lower(nick) = 'szymi' on conflict do nothing;

create or replace function public.admin_tester(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'brak uprawnień'; end if;
  if p_on then
    if not exists (select 1 from profiles where id = p_user) then raise exception 'nie ma takiego konta'; end if;
    insert into testers (user_id, added_by) values (p_user, auth.uid()) on conflict do nothing;
  else
    delete from testers where user_id = p_user;
  end if;
  insert into admin_log (admin, target, action, detail) values (auth.uid(), p_user, case when p_on then 'tester+' else 'tester-' end, null);
end $$;
revoke all on function public.admin_tester(uuid, boolean) from public, anon;
grant execute on function public.admin_tester(uuid, boolean) to authenticated;

-- ---------------- twórca gry: administrator, któremu nie da się odebrać praw (Michał 2.11.2026: „twórca RebaZius
-- i mu nie można zabrać uprawnień”) ----------------
alter table public.admins add column if not exists owner boolean not null default false;
insert into public.admins (user_id, owner) select id, true from public.profiles where lower(nick) = 'rebazius'
on conflict (user_id) do update set owner = true;
-- nawet bezpośrednie usunięcie wiersza (np. z SQL Editora przez pomyłkę) jest zablokowane
create or replace function public.keep_owner() returns trigger language plpgsql as $$
begin
  if old.owner then raise exception 'twórcy gry nie można odebrać praw administratora'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists admins_keep_owner on public.admins;
create trigger admins_keep_owner before delete or update of owner on public.admins for each row execute function public.keep_owner();

create or replace function public.admin_grant(p_user uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'brak uprawnień'; end if;
  if p_on then
    if not exists (select 1 from profiles where id = p_user) then raise exception 'nie ma takiego konta'; end if;
    insert into admins (user_id, added_by) values (p_user, auth.uid()) on conflict do nothing;
  else
    if p_user = auth.uid() then raise exception 'nie można odebrać praw samemu sobie'; end if;
    if exists (select 1 from admins where user_id = p_user and owner) then raise exception 'twórcy gry nie można odebrać praw administratora'; end if;
    delete from admins where user_id = p_user;
  end if;
  insert into admin_log (admin, target, action, detail) values (auth.uid(), p_user, case when p_on then 'grant' else 'revoke' end, null);
end $$;
revoke all on function public.admin_grant(uuid, boolean) from public, anon;
grant execute on function public.admin_grant(uuid, boolean) to authenticated;

-- wyszukiwanie kont: dochodzi kolumna „tester” (zmiana zwracanych kolumn wymaga usunięcia starej wersji)
drop function if exists public.admin_find(text);
create function public.admin_find(p_nick text)
returns table (id uuid, nick text, avatar integer, xp integer, level integer, matches integer, wins integer, kills integer,
               razed integer, built integer, minutes integer, online_wins integer, hard_wins integer, admin boolean, tester boolean, owner boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'brak uprawnień'; end if;
  return query
    select pr.id, pr.nick::text, coalesce((u.raw_user_meta_data->>'avatar')::integer, 0),
           coalesce(p.xp, 0), coalesce(p.level, 1), coalesce(p.matches, 0), coalesce(p.wins, 0), coalesce(p.kills, 0),
           coalesce(p.razed, 0), coalesce(p.built, 0), coalesce(p.minutes, 0), coalesce(p.online_wins, 0), coalesce(p.hard_wins, 0),
           exists (select 1 from admins a where a.user_id = pr.id),
           exists (select 1 from testers t where t.user_id = pr.id),
           exists (select 1 from admins a where a.user_id = pr.id and a.owner)
      from profiles pr
      left join player_progress p on p.user_id = pr.id
      left join auth.users u on u.id = pr.id
     where pr.nick ilike '%' || replace(replace(coalesce(p_nick, ''), '%', ''), '_', '\_') || '%'
     order by lower(pr.nick)
     limit 500;   -- pusty tekst = lista wszystkich graczy
end $$;
revoke all on function public.admin_find(text) from public, anon;
grant execute on function public.admin_find(text) to authenticated;

-- ---------------- uwagi testerów (Michał 2.11.2026: tester wpisuje w grze albo w menu, co dodać i zmienić; administrator
-- widzi je w „Moim rodzie”, oznacza jako zrobione, a tester widzi, co już zrobione) ----------------
create table if not exists public.tester_notes (
  id bigint generated always as identity primary key,
  author uuid not null default auth.uid() references auth.users on delete cascade,
  nick text not null default '',
  body text not null check (char_length(body) between 3 and 2000),
  place text not null default '',
  version text not null default '',
  status text not null default 'open' check (status in ('open', 'done')),
  reply text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.tester_notes enable row level security;
create or replace function public.is_tester() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from testers where user_id = auth.uid()) or exists (select 1 from admins where user_id = auth.uid())
$$;
revoke all on function public.is_tester() from public, anon;
grant execute on function public.is_tester() to authenticated;
-- tester dodaje tylko swoje uwagi (status zawsze „otwarta”), widzi swoje; administrator widzi wszystkie
create policy "tester dodaje uwagę" on public.tester_notes for insert to authenticated
  with check (author = auth.uid() and public.is_tester() and status = 'open' and reply is null and done_at is null);
create policy "uwagi widzi autor i administrator" on public.tester_notes for select to authenticated
  using (author = auth.uid() or public.is_admin());
create index if not exists tester_notes_status on public.tester_notes (status, created_at desc);

-- administrator oznacza uwagę jako zrobioną (albo z powrotem otwartą) i może krótko odpisać
create or replace function public.admin_note(p_id bigint, p_done boolean, p_reply text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'brak uprawnień'; end if;
  update tester_notes set status = case when p_done then 'done' else 'open' end,
         done_at = case when p_done then now() else null end,
         reply = nullif(left(btrim(coalesce(p_reply, '')), 1000), '')
   where id = p_id;
  if not found then raise exception 'nie ma takiej uwagi'; end if;
end $$;
revoke all on function public.admin_note(bigint, boolean, text) from public, anon;
grant execute on function public.admin_note(bigint, boolean, text) to authenticated;
