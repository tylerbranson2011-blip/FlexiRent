-- Phase 1: no payments. Apply only after branch review and tests.
create table if not exists public.listing_blocks (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.listings(id) on delete cascade,
 owner_id uuid not null references auth.users(id),
 start_date date not null,
 end_date date not null,
 created_at timestamptz not null default now(),
 constraint block_dates_valid check (end_date > start_date)
);
create table if not exists public.booking_requests (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.listings(id) on delete cascade,
 renter_id uuid not null references auth.users(id),
 start_date date not null,
 end_date date not null,
 status text not null default 'pending' check (status in ('pending','approved','declined','expired','cancelled')),
 expires_at timestamptz not null default (now() + interval '24 hours'),
 created_at timestamptz not null default now(),
 constraint request_dates_valid check (end_date > start_date)
);
create index if not exists booking_requests_listing_dates_idx on public.booking_requests(listing_id,start_date,end_date,status);
create index if not exists listing_blocks_listing_dates_idx on public.listing_blocks(listing_id,start_date,end_date);
alter table public.listing_blocks enable row level security;
alter table public.booking_requests enable row level security;
create policy "Read blocks for published or owned listings" on public.listing_blocks for select to anon,authenticated using (exists (select 1 from public.listings l where l.id=listing_id and (l.status='published' or l.owner_id=(select auth.uid()))));
-- Block writes are restricted to checked RPCs; direct table writes would bypass overlap checks.
create policy "Participants read requests" on public.booking_requests for select to authenticated using (renter_id=(select auth.uid()) or exists(select 1 from public.listings l where l.id=listing_id and l.owner_id=(select auth.uid())));
-- All mutations run through SECURITY DEFINER RPCs with ownership and overlap checks.
create or replace function public.booking_conflict(p_listing uuid,p_start date,p_end date,p_ignore uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.listing_blocks b where b.listing_id=p_listing and b.start_date<p_end and b.end_date>p_start)
 or exists(select 1 from public.booking_requests r where r.listing_id=p_listing and r.id is distinct from p_ignore and r.start_date<p_end and r.end_date>p_start and (r.status='approved' or (r.status='pending' and r.expires_at>now())));
$$;
revoke all on function public.booking_conflict(uuid,date,date,uuid) from public,anon,authenticated;
create or replace function public.request_booking(p_listing uuid,p_start date,p_end date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_owner uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_start<current_date or p_end<=p_start or p_end>p_start+365 then raise exception 'Invalid rental dates'; end if;
 select owner_id into v_owner from public.listings where id=p_listing and status='published';
 if v_owner is null or v_owner=auth.uid() then raise exception 'Listing unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_listing::text,0));
 if public.booking_conflict(p_listing,p_start,p_end,null) then raise exception 'Dates unavailable'; end if;
 insert into public.booking_requests(listing_id,renter_id,start_date,end_date) values(p_listing,auth.uid(),p_start,p_end) returning id into v_id;
 return v_id;
end $$;
create or replace function public.block_listing_dates(p_listing uuid,p_start date,p_end date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.listings where id=p_listing and owner_id=auth.uid()) then raise exception 'Not your listing'; end if;
 if p_start<current_date or p_end<=p_start then raise exception 'Invalid dates'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_listing::text,0));
 if public.booking_conflict(p_listing,p_start,p_end,null) then raise exception 'Dates unavailable'; end if;
 insert into public.listing_blocks(listing_id,owner_id,start_date,end_date) values(p_listing,auth.uid(),p_start,p_end) returning id into v_id;
 return v_id;
end $$;
create or replace function public.respond_booking(p_request uuid,p_approve boolean)
returns void language plpgsql security definer set search_path='' as $$
declare r public.booking_requests%rowtype;
begin
 select * into r from public.booking_requests where id=p_request;
 if not found or not exists(select 1 from public.listings where id=r.listing_id and owner_id=auth.uid()) then raise exception 'Request not found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.listing_id::text,0));
 select * into r from public.booking_requests where id=p_request for update;
 if r.status<>'pending' or r.expires_at<=now() then raise exception 'Request expired or already handled'; end if;
 if p_approve and public.booking_conflict(r.listing_id,r.start_date,r.end_date,r.id) then raise exception 'Dates unavailable'; end if;
 update public.booking_requests set status=case when p_approve then 'approved' else 'declined' end where id=p_request;
end $$;
revoke all on function public.request_booking(uuid,date,date),public.block_listing_dates(uuid,date,date),public.respond_booking(uuid,boolean) from public,anon;
grant execute on function public.request_booking(uuid,date,date),public.block_listing_dates(uuid,date,date),public.respond_booking(uuid,boolean) to authenticated;
-- Pending requests are considered expired immediately after expires_at even before cleanup.
-- Schedule: select public.expire_booking_requests() from pg_cron every hour if pg_cron is enabled.
create or replace function public.expire_booking_requests()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update public.booking_requests set status='expired' where status='pending' and expires_at<=now();
 get diagnostics n=row_count;
 return n;
end $$;
revoke all on function public.expire_booking_requests() from public,anon,authenticated;

-- Unblocking is owner-only. Existing approved bookings are never modified.
create or replace function public.unblock_listing_dates(p_block uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_listing uuid;
begin
 select b.listing_id into v_listing from public.listing_blocks b
 join public.listings l on l.id=b.listing_id
 where b.id=p_block and l.owner_id=auth.uid();
 if v_listing is null then raise exception 'Blocked dates not found or access denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_listing::text,0));
 delete from public.listing_blocks b where b.id=p_block and b.listing_id=v_listing
 and exists(select 1 from public.listings l where l.id=b.listing_id and l.owner_id=auth.uid());
 if not found then raise exception 'Could not unblock dates'; end if;
end $$;
revoke all on function public.unblock_listing_dates(uuid) from public,anon;
grant execute on function public.unblock_listing_dates(uuid) to authenticated;
