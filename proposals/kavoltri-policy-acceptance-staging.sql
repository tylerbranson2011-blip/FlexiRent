-- KAVOLTRI agreement receipts and automatic owner activation
-- STAGING PROPOSAL ONLY: not executed against shared production database.
-- Activate only after attorney-approved documents replace draft 0.2.
-- Update policy_versions using privileged SQL, never browser/user input.
create table if not exists public.policy_versions (
  policy_key text primary key check (policy_key in ('marketplace','owner','renter','privacy')),
  version text not null,
  published_at timestamptz not null default now()
);
create table if not exists public.policy_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_key text not null references public.policy_versions(policy_key),
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key(user_id,policy_key,version)
);
alter table public.policy_versions enable row level security;
alter table public.policy_acceptances enable row level security;
revoke all on public.policy_versions from anon,authenticated;
revoke all on public.policy_acceptances from anon,authenticated;
grant select on public.policy_versions to authenticated;
grant select on public.policy_acceptances to authenticated;
create policy "Current policies visible to signed-in users" on public.policy_versions
  for select to authenticated using (true);
create policy "Users read their own acceptance receipts" on public.policy_acceptances
  for select to authenticated using (user_id=(select auth.uid()));

-- Do not trust client-supplied versions or owner roles.
-- Caller accepts exactly the current version(s) stored server-side.
create or replace function public.accept_kavoltri_policies(p_owner boolean default false)
returns table(policy_key text, version text, accepted_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare v_user uuid := (select auth.uid());
declare v_missing int;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  select count(*) into v_missing from public.policy_versions v
    where v.policy_key in ('marketplace','privacy') or (p_owner and v.policy_key='owner');
  if v_missing <> case when p_owner then 3 else 2 end then
    raise exception 'Required legal policies are not published';
  end if;
  insert into public.policy_acceptances(user_id,policy_key,version)
  select v_user,v.policy_key,v.version from public.policy_versions v
  where v.policy_key in ('marketplace','privacy') or (p_owner and v.policy_key='owner')
  on conflict do nothing;
  if p_owner then
    insert into public.account_roles(user_id,account_type) values(v_user,'owner')
    on conflict(user_id) do update set account_type='owner';
  end if;
  return query select a.policy_key,a.version,a.accepted_at
    from public.policy_acceptances a join public.policy_versions v
      on v.policy_key=a.policy_key and v.version=a.version
    where a.user_id=v_user;
end $$;
revoke all on function public.accept_kavoltri_policies(boolean) from public,anon;
grant execute on function public.accept_kavoltri_policies(boolean) to authenticated;

-- Check before owner publishing; an old receipt is insufficient.
create or replace function public.kavoltri_has_current_terms(p_user uuid, p_owner boolean)
returns boolean language sql stable security definer set search_path=''
as $$
select (select count(*) from public.policy_versions v
  where (v.policy_key in ('marketplace','privacy') or (p_owner and v.policy_key='owner'))
    and exists(select 1 from public.policy_acceptances a
      where a.user_id=p_user and a.policy_key=v.policy_key and a.version=v.version))
 = case when p_owner then 3 else 2 end
and (select count(*) from public.policy_versions v
  where v.policy_key in ('marketplace','privacy') or (p_owner and v.policy_key='owner'))
 = case when p_owner then 3 else 2 end
$$;
revoke all on function public.kavoltri_has_current_terms(uuid,boolean) from public,anon,authenticated;

-- Replace owner listing policies with server-verified, current agreement requirements.
drop policy if exists "Owners create listings" on public.listings;
create policy "Owners create listings" on public.listings
  for insert to authenticated with check (
    owner_id=(select auth.uid())
    and exists(select 1 from public.account_roles r where r.user_id=(select auth.uid()) and r.account_type='owner')
    and public.kavoltri_has_current_terms((select auth.uid()),true)
  );
drop policy if exists "Owners update listings" on public.listings;
create policy "Owners update listings" on public.listings
  for update to authenticated using (
    owner_id=(select auth.uid()) and public.kavoltri_has_current_terms((select auth.uid()),true)
  ) with check (
    owner_id=(select auth.uid()) and public.kavoltri_has_current_terms((select auth.uid()),true)
  );

-- Before deployment: revise initialize_account_role trigger to always default to renter,
-- rather than trusting signup metadata. Confirm no other role-changing paths.
-- Do not seed draft policy_versions. Until attorney approval, no owner activation.
-- Existing accounts and records are preserved.
