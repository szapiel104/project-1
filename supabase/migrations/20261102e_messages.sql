-- Wiadomości między znajomymi (2.11.2026, Michał: czat ze znajomym w panelu znajomych, z licznikiem nieprzeczytanych
-- i okienkiem w rogu ekranu). Pisać można tylko do znajomego (obie strony się dodały); czytają nadawca i odbiorca.

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  from_id uuid not null default auth.uid() references auth.users on delete cascade,
  to_id uuid not null references auth.users on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
alter table public.messages enable row level security;
create policy "rozmowy widzą nadawca i odbiorca" on public.messages for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
create policy "piszę tylko do znajomych" on public.messages for insert to authenticated
  with check (from_id = auth.uid() and read = false and to_id in (select public.mutual_friends(auth.uid())));
-- odbiorca oznacza jako przeczytane (zmienić może tylko pole read — reszta zostaje taka sama)
create policy "odbiorca oznacza przeczytane" on public.messages for update to authenticated
  using (to_id = auth.uid()) with check (to_id = auth.uid());
create or replace function public.messages_lock() returns trigger language plpgsql as $$
begin
  if new.body <> old.body or new.from_id <> old.from_id or new.to_id <> old.to_id or new.created_at <> old.created_at then
    raise exception 'wiadomości nie można zmieniać';
  end if;
  return new;
end $$;
drop trigger if exists messages_lock on public.messages;
create trigger messages_lock before update on public.messages for each row execute function public.messages_lock();
create index if not exists messages_pair on public.messages (least(from_id, to_id), greatest(from_id, to_id), created_at desc);
create index if not exists messages_unread on public.messages (to_id) where not read;
-- mutual_friends wolno wołać w zasadzie zapisu
grant execute on function public.mutual_friends(uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
