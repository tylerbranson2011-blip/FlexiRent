# Production security advisor review

Read-only Supabase security advisor check on 2026-10-15 identified **seven SECURITY DEFINER functions executable by anonymous users** and additional functions executable by authenticated users.

Examples flagged:
- `public.enforce_listing_owner_role()`
- `public.get_public_profile(p_user_id uuid)`
- `public.guard_published_availability()`
- `public.handle_new_user()`
- `public.initialize_account_role()`
- `public.listing_unavailable_dates(p_listing uuid)`
- `public.submit_rental_review(p_booking uuid, p_stars integer, p_comment text)`

**Warning is not proof of an exploit.** Each function's definition, intended callers, permissions, triggers, and side effects must be inspected before modifying grants or moving code. Some may be trigger functions and should not be exposed as API RPCs. Do not automatically revoke EXECUTE without testing account creation, listing workflows and historical booking functionality.

Next actions: obtain restorable database and storage backup; inspect pg_proc definitions and grants; verify exposed RPC authorization and old booking endpoints; prepare reviewed security migration on staging; rerun advisors and exercise bypass tests. No production schema or grants have been modified.
