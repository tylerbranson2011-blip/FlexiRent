create or replace function public.enforce_listing_owner_role() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.role()='service_role' then return new; end if;
 if auth.uid() is null or new.owner_id is distinct from auth.uid() then raise exception 'Only the signed-in listing owner may change listings'; end if;
 if not exists(select 1 from public.account_roles r where r.user_id=auth.uid() and r.account_type='owner') then
 raise exception 'Owner account required. Switch to Owner before listing equipment.';
 end if;
 return new;
end;$$;