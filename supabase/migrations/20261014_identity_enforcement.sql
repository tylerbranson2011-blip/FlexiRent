-- Identity is mandatory before a listing is published or a booking is requested/approved.
-- Draft listings and blocked dates remain available to owners during onboarding.
create or replace function public.require_verified_identity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'listings' then
    if new.status = 'published' and not exists (
      select 1 from public.identity_verifications i
      where i.user_id = new.owner_id and i.status = 'verified'
    ) then raise exception 'Owner identity verification required before publishing'; end if;
  elsif tg_table_name = 'booking_requests' then
    if tg_op = 'INSERT' or (new.status = 'approved' and old.status is distinct from 'approved') then
      if not exists (
        select 1 from public.identity_verifications i
        where i.user_id = new.renter_id and i.status = 'verified'
      ) then raise exception 'Renter identity verification required before booking'; end if;
      if not exists (
        select 1 from public.listings l
        join public.identity_verifications i on i.user_id = l.owner_id
        where l.id = new.listing_id and i.status = 'verified'
      ) then raise exception 'Owner identity verification required before booking'; end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists listings_require_verified_identity on public.listings;
create trigger listings_require_verified_identity before insert or update on public.listings
for each row execute function public.require_verified_identity();
drop trigger if exists bookings_require_verified_identity on public.booking_requests;
create trigger bookings_require_verified_identity before insert or update on public.booking_requests
for each row execute function public.require_verified_identity();
