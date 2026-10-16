# Connection-hub security findings (2026-10-15)

## Observed live configuration (read-only inspection)
- public.listings owner UPDATE policy checks owner_id only; it does **not** check acceptance or restrict status to draft.
- public.listings owner INSERT policy checks owner_id only.
- Public SELECT policy exposes published listings.
- One published car listing, one published equipment listing, one draft equipment listing exist.
- booking_requests, bookings, owner_subscriptions and other booking-era tables remain present. Do not delete them.
- Development browser now filters car/truck categories, but client-side filtering is not a database access control.

## Deployment gates
1. Obtain and verify restorable backup of live Supabase database, including policy definitions and critical data. Preserve uploaded objects separately.
2. Confirm whether Cloudflare production is deployed from main; keep feature branch unmerged.
3. Finish and obtain review of legal terms and consent version, operator identity, jurisdictions, and category restrictions.
4. Implement an immutable consent audit and verified email check, then enforce eligible category and current owner consent in database-level INSERT/UPDATE checks. Ensure previously published listings are explicitly reviewed before being displayed in the new launch.
5. Keep owner access to their own drafts; do not accidentally break photo upload or account dashboards.
6. Implement owner-contact inquiries with authenticated verified renters, explicit renter consent, owner authorization, privacy-preserving messaging, abuse reporting and rate limiting. An inquiry is not a booking.
7. Audit existing booking RPCs/functions, grants, triggers, endpoints and policies. Disable rental checkout in launch configuration without dropping historical records.
8. Test bypass attempts against Supabase REST API, anonymous browsing, cross-account access, old policy versions, mobile accessibility, consent logs and revocation.
9. Only after testing and legal review: merge, deploy and confirm production.

## Current status
NOT LAUNCH READY. Draft policy page and checkbox UI are not sufficient proof of consent. No live schema or production branch has been changed as part of this redesign.
