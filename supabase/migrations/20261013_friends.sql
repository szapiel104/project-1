-- Znajomi (13.10.2026, wykonane — sprawdzone 24.10.2026)
create table public.friends (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  friend_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
alter table public.friends enable row level security;
create policy "widzę swoje znajomości i kto mnie dodał" on public.friends for select to authenticated using (user_id = auth.uid() or friend_id = auth.uid());
create policy "dodaję tylko do swojej listy" on public.friends for insert to authenticated with check (user_id = auth.uid());
create policy "usuwam tylko ze swojej listy" on public.friends for delete to authenticated using (user_id = auth.uid());
