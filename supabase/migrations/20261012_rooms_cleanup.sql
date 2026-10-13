-- Sprzątanie: każde założenie pokoju usuwa pokoje starsze niż doba (wykonane 12.10.2026)
create or replace function public.cleanup_old_rooms() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.rooms where created_at < now() - interval '1 day';
  return null;
end $$;

drop trigger if exists rooms_cleanup on public.rooms;
create trigger rooms_cleanup after insert on public.rooms
for each statement execute function public.cleanup_old_rooms();
