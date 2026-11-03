-- Administrator usuwa uwagę testera na zawsze (Michał 3.11.2026), razem z powiadomieniami o niej w dzwoneczkach.
create or replace function public.admin_note_delete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'brak uprawnień'; end if;
  delete from notifications where kind in ('note', 'note_done') and (payload->>'note')::bigint = p_id;
  delete from tester_notes where id = p_id;
  if not found then raise exception 'nie ma takiej uwagi'; end if;
end $$;
revoke all on function public.admin_note_delete(bigint) from public, anon;
grant execute on function public.admin_note_delete(bigint) to authenticated;
