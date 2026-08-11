-- CURIÓ · convites não devem permanecer utilizáveis quando o aluno vai para a Lixeira.
-- O histórico é preservado; somente convites ainda pending/sent passam para cancelled.

create or replace function private.cancel_student_pending_invitations_on_trash()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    update public.access_invitations
    set status = 'cancelled',
        updated_at = now()
    where student_id = new.id
      and deleted_at is null
      and status in ('pending', 'sent');
  end if;
  return new;
end;
$$;

revoke all on function private.cancel_student_pending_invitations_on_trash() from public, anon, authenticated;

drop trigger if exists students_cancel_pending_invitations_on_trash on public.students;
create trigger students_cancel_pending_invitations_on_trash
after update of deleted_at on public.students
for each row
when (old.deleted_at is null and new.deleted_at is not null)
execute function private.cancel_student_pending_invitations_on_trash();

update public.access_invitations ai
set status = 'cancelled',
    updated_at = now()
from public.students s
where s.id = ai.student_id
  and s.deleted_at is not null
  and ai.deleted_at is null
  and ai.status in ('pending', 'sent');

comment on function private.cancel_student_pending_invitations_on_trash() is
'Cancels only pending/sent access invitations when a student is moved to trash; preserves invitation and enrollment history for safe restoration.';
