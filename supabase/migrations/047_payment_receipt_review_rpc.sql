-- CURIÓ · revisão atômica de comprovante e confirmação de pagamento

create or replace function public.review_payment_receipt(
  p_receipt_id uuid,
  p_approved boolean,
  p_note text default null
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment_id uuid;
begin
  if not private.has_role('admin'::app_role) then
    raise exception 'admin role required';
  end if;

  select payment_id into v_payment_id
  from public.payment_receipts
  where id = p_receipt_id and status = 'pending'
  for update;

  if v_payment_id is null then
    raise exception 'pending receipt not found';
  end if;

  update public.payment_receipts
  set status = case when p_approved then 'approved' else 'rejected' end,
      review_note = nullif(trim(coalesce(p_note,'')),''),
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_receipt_id;

  if p_approved then
    update public.payments
    set status = 'paid',
        paid_at = coalesce(paid_at, now()),
        provider = coalesce(provider, 'manual_receipt'),
        updated_at = now()
    where id = v_payment_id;
  end if;

  return true;
end;
$$;

revoke all on function public.review_payment_receipt(uuid,boolean,text) from public;
revoke all on function public.review_payment_receipt(uuid,boolean,text) from anon;
grant execute on function public.review_payment_receipt(uuid,boolean,text) to authenticated;
