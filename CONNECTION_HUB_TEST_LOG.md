# Connection-hub database security test log

Date: 2026-10-15. Target: current Supabase project, **transaction rollback only**.

## Checks performed
1. Temporary SQL table with a publication CHECK rule: a draft trailer without consent was accepted; a published car without consent and a published trailer without consent were rejected; a published trailer with consent was accepted.
2. Executed the proposed `connection-hub-staging-guard.sql` inside an explicit transaction and exercised the trigger against an existing published car row, then issued ROLLBACK. The SQL tool returned no error, but did not expose NOTICE messages, so this is **not** sufficient evidence of a verified trigger rejection. Repeat with a test query that returns explicit PASS/FAIL rows.
3. Post-test read-only verification: `public.marketplace_consents` absent, `connection_hub_publish_guard_trg` absent, and listing count still **3**. No schema changes persisted.

## Still required before production
- Verify actual trigger rejection with explicit result rows and RLS under authenticated JWT identities, not admin-only SQL.
- Prevent user-supplied consent timestamps and audit records from being forged; review consent integrity and agreement versioning.
- Ensure consent policy uses verified email and does not let a user attest for another account.
- Resolve existing published listing grandfathering, type moderation, and the old booking RPC exposure.
- Complete backup, legal review, subscription disclosures and owner contact flow before launch.

Status: preliminary test passed for simplified constraint logic; full security enforcement **not yet validated or deployed**.

## Follow-up actual trigger checks
- Executed proposed SQL in an explicit transaction, ran updates against the existing published car and published equipment rows, and captured PASS/FAIL into a temporary results table.
- Result: **PASS: rejected** for both car and equipment without owner consent.
- Issued ROLLBACK; no permanent database changes from this test.
- These tests use SQL administrative context and do not replace authenticated-user REST/RLS tests.

## Server-controlled consent RPC rollback tests
- Ran revised consent schema, publishing guard and acceptance RPC inside one rollback transaction.
- **PASS:** unauthenticated SQL context cannot accept terms (`Verified login required`).
- **PASS:** published car update blocked by trigger.
- Rollback preserved live schema. Further signed-in user, grant and spoofing tests remain required.
