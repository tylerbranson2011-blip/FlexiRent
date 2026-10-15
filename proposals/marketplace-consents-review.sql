-- PROPOSED ONLY: DO NOT EXECUTE AGAINST LIVE DATABASE YET.
-- First export a restorable backup, review current RLS policies, and complete legal review.
-- This file intentionally contains no destructive ALTER/DROP statements.
create table if not exists public.marketplace_consents (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','renter')),
 policy_version text not null,
 owner_authority boolean not null default false,
 accurate_listing boolean not null default false,
 safety_compliance boolean not null default false,
 insurance_responsibility boolean not null default false,
 renter_screening boolean not null default false,
 direct_contract_payments boolean not null default false,
 platform_not_party boolean not null default false,
 terms_accepted boolean not null default false,
 accepted_at timestamptz not null default now(),
 constraint owner_checks_required check (
  role <> 'owner' or (owner_authority and accurate_listing and safety_compliance
  and insurance_responsibility and renter_screening and direct_contract_payments
  and platform_not_party and terms_accepted)),
 constraint renter_checks_required check (
  role <> 'renter' or (insurance_responsibility and direct_contract_payments
  and platform_not_party and terms_accepted))
);
alter table public.marketplace_consents enable row level security;
-- Immutable acceptance audit: authenticated users may insert their own attestations,
-- read their own records, and may not update or delete them through the Data API.
create policy "consent read own" on public.marketplace_consents
 for select to authenticated using ((select auth.uid()) = user_id);
create policy "consent insert own" on public.marketplace_consents
 for insert to authenticated with check ((select auth.uid()) = user_id);
-- NEXT: enforce publication in database with reviewed RLS/trigger after inspecting
-- existing policies and preparing a migration. Do not rely on front-end controls.
-- NEXT: inquiries table must require verified email, current renter consent,
-- rate limits and owner-controlled contact permissions before launch.
-- This proposal is NOT deployed and does NOT secure existing listings yet.
