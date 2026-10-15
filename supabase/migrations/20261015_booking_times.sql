-- Booking time phase 2: staged migration. Apply before deploying the updated UI.
-- Day-based conflict checks remain in force, even when times differ.
create table if not exists public.listing_pickup_hours (
 listing_id uuid primary key references public.listings(id) on delete cascade,
 timezone text not null,
 open_time time not null default '08:00',
 close_time time not null default '18:00',
 updated_at timestamptz not null default now(),
 constraint pickup_hours_order check (open_time < close_time)
);
alter table public.listing_pickup_hours enable row level security;
create policy "Published schedule or owner" on public.listing_pickup_hours for select to authenticated
using (exists (select 1 from public.listings l where l.id=listing_id and (l.status='published' or l.owner_id=(select auth.uid()))));
alter table public.booking_requests add column if not exists pickup_time time;
alter table public.booking_requests add column if not exists return_time time;
alter table public.booking_requests add column if not exists booking_timezone text;
-- Owners must explicitly choose a time zone and operating hours before timed requests.
create or replace function public.set_listing_pickup_hours(p_listing uuid,p_timezone text,p_open time,p_close time)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.listings where id=p_listing and owner_id=(select auth.uid())) then raise exception 'Not your listing'; end if;
 if p_open is null or p_close is null or p_open>=p_close then raise exception 'Invalid pickup hours'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid time zone'; end if;
 insert into public.listing_pickup_hours(listing_id,timezone,open_time,close_time)
 values(p_listing,p_timezone,p_open,p_close)
 on conflict(listing_id) do update set timezone=excluded.timezone,open_time=excluded.open_time,close_time=excluded.close_time,updated_at=now();
end $$;
revoke all on function public.set_listing_pickup_hours(uuid,text,time,time) from public,anon;
grant execute on function public.set_listing_pickup_hours(uuid,text,time,time) to authenticated;

create or replace function public.request_booking_timed(p_listing uuid,p_start date,p_end date,p_pickup time,p_return time)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_schedule public.listing_pickup_hours%rowtype;v_id uuid;
begin
 select * into v_schedule from public.listing_pickup_hours where listing_id=p_listing;
 if not found then raise exception 'Owner has not set pickup hours yet'; end if;
 if p_pickup is null or p_return is null or p_pickup<v_schedule.open_time or p_pickup>v_schedule.close_time or p_return<v_schedule.open_time or p_return>v_schedule.close_time then raise exception 'Choose a time within owner pickup hours'; end if;
 if extract(minute from p_pickup)::int % 30<>0 or extract(minute from p_return)::int % 30<>0 or extract(second from p_pickup)<>0 or extract(second from p_return)<>0 then raise exception 'Use 30-minute time slots'; end if;
 -- The existing RPC checks identity, date validity, ownership, and conflicts under a listing lock.
 v_id:=public.request_booking(p_listing,p_start,p_end);
 update public.booking_requests set pickup_time=p_pickup,return_time=p_return,booking_timezone=v_schedule.timezone where id=v_id;
 return v_id;
end $$;
revoke all on function public.request_booking_timed(uuid,date,date,time,time) from public,anon;
grant execute on function public.request_booking_timed(uuid,date,date,time,time) to authenticated;
