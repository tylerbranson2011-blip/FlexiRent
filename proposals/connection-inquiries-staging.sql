-- STAGING PROPOSAL ONLY. Do not run on production before a verified backup.
-- Contact-only inquiry, never a reservation, payment, or rental contract.
create table if not exists public.connection_inquiries (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.listings(id),
 renter_id uuid not null references auth.users(id),
 owner_id uuid not null references auth.users(id),
 subject text not null check (length(btrim(subject)) between 3 and 120),
 message text not null check (length(btrim(message)) between 10 and 2000),
 status text not null default 'open' check (status in ('open','closed','reported')),
 created_at timestamptz not null default now(),
 constraint inquiry_not_self check (renter_id <> owner_id)
);
alter table public.connection_inquiries enable row level security;
revoke all on public.connection_inquiries from anon,authenticated;
grant select on public.connection_inquiries to authenticated;
create policy "inquiry_participants_read" on public.connection_inquiries
 for select to authenticated using (
 renter_id=(select auth.uid()) or owner_id=(select auth.uid())
 );
-- Inserts only through controlled RPC; no client UPDATE/DELETE.
create or replace function public.send_connection_inquiry(
 p_listing uuid,p_subject text,p_message text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid := auth.uid(); v_owner uuid; v_id uuid;
begin
 if v_user is null or not exists (
  select 1 from auth.users u where u.id=v_user and u.email_confirmed_at is not null
 ) then raise exception 'Verified account required'; end if;
 if not exists (
  select 1 from public.marketplace_consents c
  where c.user_id=v_user and c.role='renter'
    and c.policy_version='REPLACE_WITH_APPROVED_VERSION'
 ) then raise exception 'Renter terms acceptance required'; end if;
 select l.owner_id into v_owner from public.listings l
 where l.id=p_listing and l.status='published'
 and l.category in ('trailer','rv','equipment');
 if v_owner is null then raise exception 'Listing unavailable'; end if;
 if v_owner=v_user then raise exception 'Cannot inquire about your own listing'; end if;
 if not exists (select 1 from public.marketplace_consents c where c.user_id=v_owner and c.role='owner' and c.policy_version='REPLACE_WITH_APPROVED_VERSION') then raise exception 'Owner agreement not current'; end if;
 if length(btrim(coalesce(p_subject,''))) not between 3 and 120
  or length(btrim(coalesce(p_message,''))) not between 10 and 2000
 then raise exception 'Invalid inquiry length'; end if;
 -- Serialize concurrent inquiries from this account within the transaction.
 perform pg_advisory_xact_lock(hashtextextended(v_user::text, 881920));
 if (select count(*) from public.connection_inquiries i
   where i.renter_id=v_user and i.created_at > now()-interval '1 hour') >= 5
 then raise exception 'Inquiry limit reached; try again later'; end if;
 insert into public.connection_inquiries(listing_id,renter_id,owner_id,subject,message)
 values(p_listing,v_user,v_owner,btrim(p_subject),btrim(p_message))
 returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.send_connection_inquiry(uuid,text,text) from public,anon;
grant execute on function public.send_connection_inquiry(uuid,text,text) to authenticated;
-- NOTE: count-based rate limiting can be raced by concurrent requests; replace with atomic\n-- server-side throttle and abuse controls before public activation.\n-- Before launch: test concurrent rate-limit behavior, moderation/reporting,
-- verified owner consent, owner blocking, privacy retention and notification abuse.
