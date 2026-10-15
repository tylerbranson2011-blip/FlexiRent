create or replace function public.guard_published_availability()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_listing uuid; v_status text;
begin
 v_listing:=case when tg_op='DELETE' then old.listing_id else new.listing_id end;
 select status into v_status from public.listings where id=v_listing for update;
 if v_status='published' then
  raise exception 'Unpublish this listing before changing pickup hours or blocked dates.';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;$$;
drop trigger if exists guard_published_pickup_hours on public.listing_pickup_hours;
create trigger guard_published_pickup_hours before insert or update or delete on public.listing_pickup_hours for each row execute function public.guard_published_availability();
drop trigger if exists guard_published_blocks on public.listing_blocks;
create trigger guard_published_blocks before insert or update or delete on public.listing_blocks for each row execute function public.guard_published_availability();