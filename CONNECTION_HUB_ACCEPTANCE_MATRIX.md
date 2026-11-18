# Connection hub: staged end-to-end acceptance matrix

This document is for the **isolated staging environment**, not production. No SQL in `proposals/` has been deployed to the live database.

| Scenario | Expected result | Status |
| --- | --- | --- |
| Anonymous visitor opens public preview | Demo loads without accessing Supabase | Static checks passing |
| Anonymous user sends inquiry via RPC | Rejected: verified account required | Rollback SQL test passed |
| Anonymous user submits report via RPC | Rejected: verified account required | Rollback SQL test passed |
| Verified renter with current consent contacts published eligible listing | Inquiry created with correct owner, user and timestamp | **Not tested** |
| Renter without current consent contacts owner | Rejected | **Not tested** |
| Owner without current consent receives inquiry | Rejected | **Not tested** |
| Renter contacts their own listing | Rejected | **Not tested** |
| Contact a draft, car, or ineligible listing | Rejected | **Not tested** |
| Other signed-in user reads inquiry | RLS denies | **Not tested** |
| Renter and owner read their inquiry | RLS permits | **Not tested** |
| Concurrent submissions over hourly limit | Exactly 5 per account/hour | **Not tested** |
| Report an inquiry without being a participant | Rejected | **Not tested** |
| Report a published listing | Only reporter can read report | **Not tested** |
| Report moderation workflow | Staff can triage, act, appeal, and audit | **Not built** |
| Owner blocks renter / abuse prevention | Further contact denied | **Not built** |
| Email and browser notifications | No sensitive details exposed | **Not built** |
| Real database and Storage restore | Successful isolated restore | **Not done** |
| Legal and privacy policy review | Approved, versioned text | **Not done** |
| Separate Cloudflare Pages preview | Accessible test URL | **Not confirmed** |

## Test sequencing
1. Create a restorable database dump and Storage export, verify restore off production.
2. Establish a separate Supabase staging project, with fictional test users and listings.
3. Replace all `REPLACE_WITH_APPROVED_VERSION` placeholders with reviewed version IDs.
4. Apply proposals only to staging and execute the matrix with authenticated sessions.
5. Add owner blocking, reporting moderation, retention, and notification controls.
6. Connect front-end forms to staging RPCs and test mobile and desktop.
7. Obtain legal/privacy review, then decide separately whether to migrate production.

**Never** use production customer records or credentials in a public test site. Never commit database passwords, access tokens, or dumps to Git.
