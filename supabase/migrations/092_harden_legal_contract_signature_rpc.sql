-- Desativa a assinatura legada sem snapshot/hash e restringe os dados privados do contrato ao próprio responsável.

revoke all on function public.sign_guardian_contract(uuid) from public, anon, authenticated;

create or replace function public.guardian_contract_party_data(p_subscription_id uuid)
returns table(
  guardian_name text,
  guardian_cpf text,
  guardian_address text,
  guardian_relationship text,
  student_name text,
  student_birth_date date,
  student_grade text
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    gp.full_name,
    gpd.cpf,
    gpd.address,
    coalesce(gs.relationship,'responsável legal'),
    coalesce(st.full_name,st.preferred_name,'Aluno(a)'),
    spd.birth_date,
    gr.name
  from public.subscriptions sub
  join public.guardians g on g.id=sub.guardian_id
  join public.profiles gp on gp.id=g.profile_id
  join public.students st on st.id=sub.student_id
  left join public.guardian_students gs on gs.guardian_id=g.id and gs.student_id=st.id
  left join public.guardian_private_details gpd on gpd.guardian_id=g.id
  left join public.student_private_details spd on spd.student_id=st.id
  left join public.grades gr on gr.id=st.grade_id
  where sub.id=p_subscription_id
    and private.has_role('guardian'::public.app_role)
    and g.id=private.guardian_id_for_user()
  limit 1;
$$;

revoke all on function public.guardian_contract_party_data(uuid) from public, anon;
grant execute on function public.guardian_contract_party_data(uuid) to authenticated;
