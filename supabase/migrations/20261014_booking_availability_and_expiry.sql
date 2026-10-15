-- Applied to Supabase after Phase 1 migration. Reproduce on fresh environments.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('flexirent-expire-booking-requests','*/15 * * * *',$$select public.expire_booking_requests();$$);

create or replace function public.listing_unavailable_dates(p_listing uuid)
returns table(start_date date,end_date date,reason text)
language sql stable security definer set search_path='' as $$
 select b.start_date,b.end_date,'blocked'::text
 from public.listing_blocks b
 where b.listing_id=p_listing and exists(select 1 from public.listings l where l.id=p_listing and (l.status='published' or l.owner_id=(select auth.uid())))
 union all
 select r.start_date,r.end_date,'reserved'::text
 from public.booking_requests r
 where r.listing_id=p_listing and (r.status='approved' or (r.status='pending' and r.expires_at>now()))
 and exists(select 1 from public.listings l where l.id=p_listing and (l.status='published' or l.owner_id=(select auth.uid())));
$$;
revoke all on function public.listing_unavailable_dates(uuid) from public;
grant execute on function public.listing_unavailable_dates(uuid) to anon,authenticated;
