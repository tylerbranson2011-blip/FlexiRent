create table if not exists public.account_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 account_type text not null check(account_type in ('owner','renter')),
 created_at timestamptz not null default now()
);
alter table public.account_roles enable row level security;
revoke all on public.account_roles from anon,authenticated;
grant select on public.account_roles to authenticated;
drop policy if exists account_roles_read_self on public.account_roles;
create policy account_roles_read_self on public.account_roles for select to authenticated using(user_id=(select auth.uid()));
insert into public.account_roles(user_id,account_type)
select id,case when raw_user_meta_data->>'account_type'='owner' then 'owner' else 'renter' end from auth.users
on conflict(user_id) do nothing;
create or replace function public.initialize_account_role() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.account_roles(user_id,account_type) values(new.id,case when new.raw_user_meta_data->>'account_type'='owner' then 'owner' else 'renter' end) on conflict do nothing;
 return new;
end;$$;
drop trigger if exists initialize_account_role_trigger on auth.users;
create trigger initialize_account_role_trigger after insert on auth.users for each row execute function public.initialize_account_role();
create or replace function public.become_flexirent_owner() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 insert into public.account_roles(user_id,account_type) values(auth.uid(),'owner')
 on conflict(user_id) do update set account_type='owner';
end;$$;
revoke all on function public.become_flexirent_owner() from public,anon;
grant execute on function public.become_flexirent_owner() to authenticated;
create or replace function public.enforce_listing_owner_role() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_user in ('postgres','service_role') then return new; end if;
 if auth.uid() is null or new.owner_id is distinct from auth.uid() then raise exception 'Only the signed-in listing owner may change listings'; end if;
 if not exists(select 1 from public.account_roles r where r.user_id=auth.uid() and r.account_type='owner') then
 raise exception 'Owner account required. Switch to Owner before listing equipment.';
 end if;
 return new;
end;$$;
drop trigger if exists enforce_listing_owner_role_trigger on public.listings;
create trigger enforce_listing_owner_role_trigger before insert or update on public.listings for each row execute function public.enforce_listing_owner_role();