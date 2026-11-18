-- REVIEWED STAGING CANDIDATE ONLY: DO NOT APPLY TO PRODUCTION WITHOUT BACKUP.
-- Replace policy version after legal approval. Test on a restored database.
create table if not exists public.marketplace_consents (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 role text not null check (role in ('owner','renter')),
 policy_version text not null check (length(policy_version) between 1 and 100),
 authority boolean not null default false,
 accuracy boolean not null default false,
 safety boolean not null default false,
 insurance boolean not null default false,
 screening boolean not null default false,
 direct_terms boolean not null default false,
 not_party boolean not null default false,
 terms boolean not null default false,
 accepted_at timestamptz not null default now(),
 constraint valid_owner_consent check (role <> 'owner' or
  (authority and accuracy and safety and insurance and screening and direct_terms and not_party and terms)),
 constraint valid_renter_consent check (role <> 'renter' or
  (safety and insurance and direct_terms and not_party and terms))
);
alter table public.marketplace_consents enable row level security;
revoke all on public.marketplace_consents from anon;
grant select on public.marketplace_consents to authenticated;
create policy "consent_select_self" on public.marketplace_consents
 for select to authenticated using (user_id = (select auth.uid()));
-- No UPDATE or DELETE policies/grants. Records are immutable to Data API users.
-- SECURITY REVIEW: direct inserts can spoof accepted_at and policy_version.
-- Consent writes are only permitted through the separately reviewed acceptance RPC.
-- The status guard below prevents publishing without consent even with legacy
-- permissive owner UPDATE policies. It also applies to inserts and RPC writes.
create or replace function public.connection_hub_publish_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
 if new.status = 'published' and (
    new.category not in ('trailer','rv','equipment')
    or not exists (
      select 1 from public.marketplace_consents c
      where c.user_id=new.owner_id and c.role='owner'
        and c.policy_version='REPLACE_WITH_APPROVED_VERSION'
    )
 ) then
  raise exception 'Owner consent and eligible category required before publication';
 end if;
 return new;
end;
$$;
revoke all on function public.connection_hub_publish_guard() from public,anon,authenticated;
drop trigger if exists connection_hub_publish_guard_trg on public.listings;
create trigger connection_hub_publish_guard_trg
 before insert or update on public.listings
 for each row execute function public.connection_hub_publish_guard();
-- This guard does NOT verify physical equipment type within 'rv'/'equipment',
-- nor enforce owner consent for existing published rows unless they are updated.
-- Separate moderation / review is mandatory before launch.
