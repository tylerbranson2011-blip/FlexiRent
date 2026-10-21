-- STAGING ONLY. Participant reporting of abusive or misleading listings.
-- Never expose a public report table without RLS.
create table if not exists public.connection_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id),
 listing_id uuid references public.listings(id),
 inquiry_id uuid references public.connection_inquiries(id),
 reason text not null check (reason in ('fraud','unsafe','harassment','misleading','other')),
 details text not null check (length(btrim(details)) between 10 and 2000),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 constraint report_has_target check ((listing_id is not null) or (inquiry_id is not null))
);
alter table public.connection_reports enable row level security;
revoke all on public.connection_reports from anon,authenticated;
grant select on public.connection_reports to authenticated;
create policy "reporter_reads_own_reports" on public.connection_reports
 for select to authenticated using (reporter_id=(select auth.uid()));
create or replace function public.submit_connection_report(
 p_listing uuid,p_inquiry uuid,p_reason text,p_details text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
 if v_user is null or not exists (select 1 from auth.users u where u.id=v_user and u.email_confirmed_at is not null)
 then raise exception 'Verified account required'; end if;
 if p_listing is null and p_inquiry is null then raise exception 'Report target required'; end if;
 if p_reason not in ('fraud','unsafe','harassment','misleading','other')
 or length(btrim(coalesce(p_details,''))) not between 10 and 2000
 then raise exception 'Invalid report'; end if;
 if p_inquiry is not null and not exists (
  select 1 from public.connection_inquiries i
  where i.id=p_inquiry and (i.renter_id=v_user or i.owner_id=v_user)
 ) then raise exception 'Not an inquiry participant'; end if;
 if p_listing is not null and not exists (
  select 1 from public.listings l where l.id=p_listing and l.status='published'
 ) then raise exception 'Listing not available'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,881921));
 if (select count(*) from public.connection_reports r where r.reporter_id=v_user
 and r.created_at > now()-interval '1 hour') >= 5 then raise exception 'Report limit reached'; end if;
 insert into public.connection_reports(reporter_id,listing_id,inquiry_id,reason,details)
 values(v_user,p_listing,p_inquiry,p_reason,btrim(p_details)) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.submit_connection_report(uuid,uuid,text,text) from public,anon;
grant execute on function public.submit_connection_report(uuid,uuid,text,text) to authenticated;
-- A private staff moderation interface, escalation workflow, notification policy,
-- retention schedule, and abuse controls must be implemented before launch.
