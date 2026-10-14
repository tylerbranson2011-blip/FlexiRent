Run dependency-free behavior checks with `node tests/gallery.unit.test.cjs`.

For browser integration checks, install `playwright@1.56.1` with
`npm install --no-save --package-lock=false playwright@1.56.1`, run
`npx playwright install chromium`, then `node tests/gallery.test.cjs`.
Set `CHROMIUM_PATH` to use an existing Chromium binary instead.
The GitHub Actions workflow runs both suites.

Browser requests are intercepted: the app files are read locally and Supabase
and image requests use fixtures. These tests never contact production services.
Coverage includes desktop and mobile layouts, touch swiping, keyboard navigation,
photo order, cover deduplication, empty and failed-image states, gallery query
failures, responses after closing, independent owner galleries, published/owner
query filters, existing single-cover updates and multi-file draft uploads, and
sign-out. These checks do not validate live Supabase RLS.

The gallery reads the existing `listing_photos` fields `listing_id`, `image_url`
and `position`. It retains `listings.image_url` as the first photo, deduplicates
that URL from ordered gallery rows, and supports older URL-only listings. The
existing Change Photo action replaces the cover; saved gallery rows remain visible.
No database, authentication, storage or publication policy changes are required.
