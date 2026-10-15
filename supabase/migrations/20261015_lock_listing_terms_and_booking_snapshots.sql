-- Published listing rental terms cannot change until unpublished.
create or replace function public.guard_published_listing_terms() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='published' and (new.price_per_day is distinct from old.price_per_day or new.price_per_hour is distinct from old.price_per_hour or new.operator_option is distinct from old.operator_option or new.category is distinct from old.category) then
  raise exception 'Unpublish listing before changing rental terms';
 end if;
 return new;
end; $$;
drop trigger if exists guard_published_listing_terms_trigger on public.listings;
create trigger guard_published_listing_terms_trigger before update on public.listings for each row execute function public.guard_published_listing_terms();
-- Record immutable listing terms when a booking request is created.
alter table public.booking_requests add column if not exists agreed_price_per_day numeric(12,2);
alter table public.booking_requests add column if not exists agreed_price_per_hour numeric(12,2);
alter table public.booking_requests add column if not exists agreed_operator_option text;
alter table public.booking_requests add column if not exists agreed_listing_title text;
alter table public.booking_requests add column if not exists agreed_listing_description text;
create or replace function public.snapshot_booking_terms() returns trigger language plpgsql set search_path='' as $$
declare l record;
begin
 if tg_op='INSERT' then
  select title,description,price_per_day,price_per_hour,operator_option into l from public.listings where id=new.listing_id;
  if not found then raise exception 'Listing not found'; end if;
  new.agreed_price_per_day:=l.price_per_day;
  new.agreed_price_per_hour:=l.price_per_hour;
  new.agreed_operator_option:=l.operator_option;
  new.agreed_listing_title:=l.title;
  new.agreed_listing_description:=l.description;
 else
  new.agreed_price_per_day:=old.agreed_price_per_day;
  new.agreed_price_per_hour:=old.agreed_price_per_hour;
  new.agreed_operator_option:=old.agreed_operator_option;
  new.agreed_listing_title:=old.agreed_listing_title;
  new.agreed_listing_description:=old.agreed_listing_description;
 end if;
 return new;
end; $$;
drop trigger if exists snapshot_booking_terms_trigger on public.booking_requests;
create trigger snapshot_booking_terms_trigger before insert or update on public.booking_requests for each row execute function public.snapshot_booking_terms();