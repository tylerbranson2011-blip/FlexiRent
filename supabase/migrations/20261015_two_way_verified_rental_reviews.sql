create table if not exists public.rental_reviews (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.booking_requests(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id) on delete cascade,
 reviewee_id uuid not null references auth.users(id) on delete cascade,
 reviewer_role text not null check(reviewer_role in ('renter','owner')),
 stars integer not null check(stars between 1 and 5),
 comment text not null default '' check(char_length(comment)<=500),
 created_at timestamptz not null default now(),
 unique(booking_id,reviewer_role),
 check(reviewer_id<>reviewee_id)
);
create index if not exists rental_reviews_reviewee_idx on public.rental_reviews(reviewee_id);
alter table public.rental_reviews enable row level security;
drop policy if exists rental_reviews_read on public.rental_reviews;
create policy rental_reviews_read on public.rental_reviews for select to authenticated using (true);
revoke insert,update,delete on public.rental_reviews from anon,authenticated;
create or replace function public.submit_rental_review(p_booking uuid,p_stars integer,p_comment text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare b record; actor uuid:=auth.uid(); role text; recipient uuid; new_id uuid;
begin
 if actor is null then raise exception 'Sign in required';end if;
 if p_stars is null or p_stars not between 1 and 5 then raise exception 'Choose 1 to 5 stars';end if;
 if char_length(coalesce(p_comment,''))>500 then raise exception 'Review is too long';end if;
 select br.id,br.renter_id,br.status,br.end_date,br.return_time,l.owner_id
 into b from public.booking_requests br join public.listings l on l.id=br.listing_id where br.id=p_booking;
 if not found then raise exception 'Booking not found';end if;
 if b.status<>'approved' then raise exception 'Only approved rentals can be reviewed';end if;
 if (b.end_date::timestamp+coalesce(b.return_time,time '23:59:59'))>now() at time zone 'UTC' then raise exception 'Wait until the rental return time has passed';end if;
 if actor=b.renter_id then role:='renter';recipient:=b.owner_id;
 elsif actor=b.owner_id then role:='owner';recipient:=b.renter_id;
 else raise exception 'You are not part of this rental';end if;
 if recipient=actor then raise exception 'You cannot review yourself';end if;
 insert into public.rental_reviews(booking_id,reviewer_id,reviewee_id,reviewer_role,stars,comment)
 values(p_booking,actor,recipient,role,p_stars,trim(coalesce(p_comment,''))) returning id into new_id;
 return new_id;
end;$$;
revoke all on function public.submit_rental_review(uuid,integer,text) from public;
grant execute on function public.submit_rental_review(uuid,integer,text) to authenticated;
create or replace view public.rental_review_summaries with (security_invoker=true) as
select reviewee_id,round(avg(stars)::numeric,1) as average_stars,count(*)::integer as review_count
from public.rental_reviews group by reviewee_id;
grant select on public.rental_review_summaries to authenticated;