create index if not exists subscriptions_teacher_id_idx on public.subscriptions(teacher_id);
create index if not exists teacher_assignment_history_student_idx on public.teacher_assignment_history(student_id);
create index if not exists teacher_assignment_history_previous_teacher_idx on public.teacher_assignment_history(previous_teacher_id);
create index if not exists teacher_assignment_history_new_teacher_idx on public.teacher_assignment_history(new_teacher_id);
create index if not exists teacher_assignment_history_changed_by_idx on public.teacher_assignment_history(changed_by_user_id);
create index if not exists teacher_payouts_student_idx on public.teacher_payouts(student_id);
create index if not exists teacher_payouts_guardian_idx on public.teacher_payouts(guardian_id);
create index if not exists teacher_payouts_plan_idx on public.teacher_payouts(plan_id);
create index if not exists teacher_payouts_family_payment_idx on public.teacher_payouts(family_payment_id);
create index if not exists teacher_payouts_approved_by_idx on public.teacher_payouts(approved_by_user_id);
create index if not exists teacher_payouts_paid_by_idx on public.teacher_payouts(paid_by_user_id);
create index if not exists teacher_payout_audit_changed_by_idx on public.teacher_payout_audit(changed_by_user_id);

drop policy if exists teacher_payouts_admin_all on public.teacher_payouts;
drop policy if exists teacher_payouts_teacher_read on public.teacher_payouts;
drop policy if exists teacher_payouts_select on public.teacher_payouts;
drop policy if exists teacher_payouts_admin_insert on public.teacher_payouts;
drop policy if exists teacher_payouts_admin_update on public.teacher_payouts;
drop policy if exists teacher_payouts_admin_delete on public.teacher_payouts;

create policy teacher_payouts_select on public.teacher_payouts
for select to authenticated
using (private.has_role('admin'::app_role) or teacher_id = private.teacher_id_for_user());

create policy teacher_payouts_admin_insert on public.teacher_payouts
for insert to authenticated
with check (private.has_role('admin'::app_role));

create policy teacher_payouts_admin_update on public.teacher_payouts
for update to authenticated
using (private.has_role('admin'::app_role))
with check (private.has_role('admin'::app_role));

create policy teacher_payouts_admin_delete on public.teacher_payouts
for delete to authenticated
using (private.has_role('admin'::app_role));
