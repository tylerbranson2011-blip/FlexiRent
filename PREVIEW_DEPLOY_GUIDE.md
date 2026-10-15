# Safe test-site deployment (phone-friendly)

This branch contains `preview/index.html`, a standalone demo that has **no Supabase connection, no booking/payment features, and no persistence**.

## Cloudflare Pages (separate project)
1. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Select GitHub repository `tylerbranson2011-blip/FlexiRent`.
3. **Create a NEW Cloudflare Pages project**, such as `flexirent-hub-preview`. Do **not** change the existing `flexirent-afc` project.
4. Production branch for the NEW project: `feature/connection-hub-legal-2026-10-15`.
5. Framework preset: **None**; build command: **leave blank**; build output directory: **preview**.
6. Deploy. Verify the new `*.pages.dev` address loads the test banner, category cards, owner checklist, and renter checklist.
7. Keep the preview unindexed. Its robots meta tag discourages indexing but does not provide authentication; do not put secrets or real customer information there.

## Acceptance checklist
- Demo banner visible on desktop and mobile.
- Trailer, towable camper and equipment buttons open a checklist.
- Each checkbox is individually required and the confirmation says **demo only**.
- Links to `../legal.html` will **not work** when only `preview` is deployed. Legal copy must be copied into the preview output or links updated before public sharing.
- No network calls to Supabase, no checkout, no messages, no uploads.

**Known blocker:** `../legal.html` links from the standalone preview are not deployed when the build output is `preview`. Resolve before sharing the test URL externally.

This is a static UI demonstration, not a production launch.
