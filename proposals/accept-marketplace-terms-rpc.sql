-- STAGING ONLY: use after the consent table proposal and before enabling publishing.
-- Do not deploy until a restorable backup and legal terms version are approved.
create or replace function public.accept_marketplace_terms(
 p_role text, p_authority boolean, p_accuracy boolean, p_safety boolean,
 p_insurance boolean, p_screening boolean, p_direct_terms boolean,
 p_not_party boolean, p_terms boolean
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid := auth.uid();
 v_id uuid;
begin
 if v_user is null or not exists (
  select 1 from auth.users u where u.id=v_user and u.email_confirmed_at is not null
 ) then raise exception 'Verified login required'; end if;
 if p_role not in ('owner','renter') or p_role is null then
  raise exception 'Invalid agreement role'; end if;
 if not (coalesce(p_safety,false) and coalesce(p_insurance,false)
   and coalesce(p_direct_terms,false) and coalesce(p_not_party,false)
   and coalesce(p_terms,false)) then
  raise exception 'Required acknowledgments missing'; end if;
 if p_role='owner' and not (coalesce(p_authority,false)
   and coalesce(p_accuracy,false) and coalesce(p_screening,false)) then
  raise exception 'Owner certifications incomplete'; end if;
 insert into public.marketplace_consents(
  user_id,role,policy_version,authority,accuracy,safety,insurance,
  screening,direct_terms,not_party,terms
 ) values (
  v_user,p_role,'REPLACE_WITH_APPROVED_VERSION',
  coalesce(p_authority,false),coalesce(p_accuracy,false),
  p_safety,p_insurance,coalesce(p_screening,false),
  p_direct_terms,p_not_party,p_terms
 ) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.accept_marketplace_terms(text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.accept_marketplace_terms(text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
-- Caller cannot choose user_id, timestamp or policy_version.
-- Production must replace placeholder version with approved version before activation.
