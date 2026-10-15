create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 booking_id uuid not null references public.booking_requests(id) on delete cascade,
 kind text not null check(kind in ('booking_requested','booking_approved','booking_declined')),
 title text not null,
 message text not null,
 is_read boolean not null default false,
 created_at timestamptz not null default now(),
 unique(booking_id,recipient_id,kind)
);
create index if not exists notifications_recipient_recent_idx on public.notifications(recipient_id,created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;
grant update(is_read) on public.notifications to authenticated;
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated using (recipient_id=(select auth.uid()));
drop policy if exists notifications_mark_own on public.notifications;
create policy notifications_mark_own on public.notifications for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
create or replace function public.notify_booking_changes() returns trigger language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_title text; v_message text; v_kind text; v_recipient uuid;
begin
 select l.owner_id into v_owner from public.listings l where l.id=new.listing_id;
 if tg_op='INSERT' then
   if new.status<>'pending' or v_owner is null then return new; end if;
   v_recipient:=v_owner;v_kind:='booking_requested';v_title:='New rental request';
   v_message:='A renter requested your listing for '||new.start_date||' to '||new.end_date||'.';
 elsif new.status is distinct from old.status and new.status in ('approved','declined') then
   v_recipient:=new.renter_id;v_kind:=case when new.status='approved' then 'booking_approved' else 'booking_declined' end;
   v_title:=case when new.status='approved' then 'Booking approved' else 'Booking declined' end;
   v_message:='Your rental request for '||new.start_date||' to '||new.end_date||' was '||new.status||'.';
 else return new; end if;
 if v_recipient is not null then
 insert into public.notifications(recipient_id,booking_id,kind,title,message)
 values(v_recipient,new.id,v_kind,v_title,v_message) on conflict(booking_id,recipient_id,kind) do nothing;
 end if;
 return new;
end;$$;
revoke all on function public.notify_booking_changes() from public,anon,authenticated;
drop trigger if exists booking_notifications_trigger on public.booking_requests;
create trigger booking_notifications_trigger after insert or update of status on public.booking_requests for each row execute function public.notify_booking_changes();