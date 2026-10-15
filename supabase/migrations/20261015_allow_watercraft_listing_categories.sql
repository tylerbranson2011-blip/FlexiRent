create or replace function public.enforce_supported_listing_categories()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='published' and new.category not in ('trailer','rv','equipment','light_equipment','boat','jetski','paddlecraft') then
  raise exception 'This rental category is not supported.';
 end if;
 return new;
end;$$;