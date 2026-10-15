alter table public.listings add column if not exists price_per_hour numeric(12,2), add column if not exists operator_option text not null default 'without_operator';
alter table public.listings drop constraint if exists listings_hourly_price_positive;
alter table public.listings add constraint listings_hourly_price_positive check(price_per_hour is null or price_per_hour>0);
alter table public.listings drop constraint if exists listings_operator_option_check;
alter table public.listings add constraint listings_operator_option_check check(operator_option in ('without_operator','operator_available','operator_required'));