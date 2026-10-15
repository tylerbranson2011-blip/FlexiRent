create table if not exists public.identity_verifications (
 user_id uuid primary key references auth.users(id) on delete cascade,
 stripe_session_id text unique,
 status text not null default 'unverified' check(status in ('unverified','verified','needs_retry','canceled')),
 verified_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.identity_verifications enable row level security;
revoke all on public.identity_verifications from anon,authenticated;
grant select on public.identity_verifications to authenticated;
create policy "Users can read own identity status" on public.identity_verifications for select to authenticated using ((select auth.uid())=user_id);
-- Only the signed Stripe webhook using service role may write verification results.
