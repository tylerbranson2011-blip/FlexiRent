create or replace function public.enforce_supported_listing_categories()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='published' and new.category not in ('trailer','rv','equipment','light_equipment') then
  raise exception 'Only trailers, campers, heavy equipment and light equipment may be published.';
 end if;
 return new;
end;$$;
drop trigger if exists enforce_supported_listing_categories on public.listings;
create trigger enforce_supported_listing_categories before insert or update on public.listings
for each row execute function public.enforce_supported_listing_categories();