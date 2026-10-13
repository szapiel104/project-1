-- Wyniki meczów przez sieć i ranking (wykonane 13.10.2026)
create table public.results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  nick text not null,
  avatar int not null default 0,
  preset text not null,
  won boolean not null,
  minutes int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.results enable row level security;
create policy "wyniki widzą zalogowani" on public.results for select to authenticated using (true);
create policy "każdy zapisuje tylko swój wynik" on public.results for insert to authenticated with check (user_id = auth.uid());
create index results_user on public.results (user_id, created_at desc);

create view public.ranking with (security_invoker = true) as
  select user_id, (array_agg(nick order by created_at desc))[1] as nick, (array_agg(avatar order by created_at desc))[1] as avatar,
         count(*) filter (where won) as wins, count(*) filter (where not won) as losses, count(*) as games
  from public.results group by user_id;
