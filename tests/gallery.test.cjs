// Run: npm install --no-save --package-lock=false playwright && node tests/gallery.test.cjs
// Uses a local Supabase double; never reads or writes production data.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

function mockSupabase() {
  const photo = (listing_id, position) => ({ listing_id, position, image_url: `https://photos.test/${listing_id}-${position}.png` });
  const item = (id, status, owner_id = "owner", image_url = `https://photos.test/${id}-0.png`) => ({
    id, status, owner_id, image_url, title: `Rental ${id}`, category: "truck", city: "Louisville", state: "KY",
    price_per_day: 40, description: "Test rental", created_at: id
  });
  window.testDB = {
    listings: [item("multi", "published"), item("legacy", "published"), item("empty", "published", "owner", null), item("draft", "draft"), item("other", "draft", "other-owner")],
    listing_photos: [photo("multi", 2), photo("multi", 0), photo("multi", 1), photo("draft", 1), photo("draft", 0)],
    queries: [], uploads: [], user: { id: "owner", email: "owner@example.test" }, callbacks: [], failPhotos: false, delayPhotos: false
  };
  const db = window.testDB;
  const client = {
    auth: {
      getUser: async () => ({ data: { user: db.user }, error: null }),
      onAuthStateChange: callback => { db.callbacks.push(callback); },
      signOut: async () => { db.user = null; db.callbacks.forEach(cb => cb("SIGNED_OUT", null)); return { error: null }; }
    },
    storage: { from: () => ({
      upload: async (storage_path, file) => { db.uploads.push({ storage_path, type: file.type }); return { error: null }; },
      getPublicUrl: storage_path => ({ data: { publicUrl: `https://photos.test/${storage_path}` } })
    }) },
    from(table) {
      const q = { table, filters: [], action: "select" };
      const builder = {
        select(fields) { q.fields = fields; return this; },
        eq(field, value) { q.filters.push([field, value]); return this; },
        in(field, values) { q.filters.push([field, values]); return this; },
        order(field) { q.order = field; return this; },
        insert(records) { q.action = "insert"; q.records = records; return this; },
        update(values) { q.action = "update"; q.values = values; return this; },
        single() { q.single = true; return this; },
        async then(resolve, reject) {
          try {
            db.queries.push(q);
            if (table === "listing_photos" && q.action === "select") {
              if (db.delayPhotos) await new Promise(r => { (db.releasePhotos ||= []).push(r); });
              if (db.failPhotos) return resolve({ data: null, error: { message: "Photo access denied" } });
            }
            let rows;
            if (q.action === "insert") {
              rows = (Array.isArray(q.records) ? q.records : [q.records]).map(row => ({ id: `new-${db[table].length}`, ...row }));
              db[table].push(...rows);
            } else {
              rows = db[table].filter(row => q.filters.every(([field, value]) => Array.isArray(value) ? value.includes(row[field]) : row[field] === value));
              if (q.action === "update") rows.forEach(row => Object.assign(row, q.values));
            }
            if (q.order) rows = [...rows].sort((a, b) => a[q.order] > b[q.order] ? 1 : -1);
            resolve({ data: q.single ? rows[0] : rows, error: null });
          } catch (error) { reject(error); }
        }
      };
      return builder;
    }
  };
  window.supabase = { createClient: () => client };
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: width < 500 });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("dialog", dialog => dialog.accept());
      await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({ contentType: "application/javascript", body: `(${mockSupabase.toString()})();` }));
      await page.route("https://photos.test/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#5c438c"/></svg>' }));
      await page.route("https://flexirent.test/**", async route => {
        const pathname = new URL(route.request().url()).pathname;
        const file = path.join(root, pathname === "/" ? "index.html" : pathname);
        await route.fulfill({ body: await fs.readFile(file), contentType:
          file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/html" });
      });
      await page.goto("https://flexirent.test/");
      await page.waitForFunction(() => document.querySelectorAll("[data-details]").length === 3);
      await page.locator('[data-details="multi"]').click();
      await page.waitForFunction(() => document.querySelectorAll("#detailGallery img").length === 3);
      const gallery = page.locator("#detailGallery");
      assert.deepEqual(await gallery.locator("img").evaluateAll(imgs => imgs.map(img => img.src)), [0, 1, 2].map(i => `https://photos.test/multi-${i}.png`));
      await gallery.getByRole("button", { name: "Next photo" }).click();
      await page.waitForFunction(() => document.querySelector("#detailGallery [role=status]").textContent === "2 / 3");
      await gallery.locator(".photo-gallery-track").focus();
      await page.keyboard.press("End");
      await page.waitForFunction(() => document.querySelector("#detailGallery [role=status]").textContent === "3 / 3");
      await page.keyboard.press("Home");
      await page.waitForFunction(() => document.querySelector("#detailGallery [role=status]").textContent === "1 / 3");
      if (width === 390) {
        const box = await gallery.locator(".photo-gallery-track").boundingBox();
        const cdp = await context.newCDPSession(page);
        const touch = (x) => [{ x, y: box.y + 80 }];
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touch(box.x + box.width - 25) });
        for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touch(box.x + box.width - 25 - step * (box.width - 50) / 8) });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForFunction(() => document.querySelector("#detailGallery [role=status]").textContent !== "1 / 3");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: "/tmp/flexirent-gallery-mobile.png" });
      }
      await page.locator("#closeModal").click();
      await page.locator('[data-details="legacy"]').click();
      assert.equal(await gallery.locator("img").count(), 1);
      assert.equal(await gallery.locator("button").count(), 0);
      await page.locator("#closeModal").click();
      await page.locator('[data-details="empty"]').click();
      assert.equal(await gallery.innerText(), "No photos available");
      await page.locator("#closeModal").click();

      await page.evaluate(() => { testDB.failPhotos = true; });
      await page.locator('[data-details="multi"]').click();
      await page.waitForFunction(() => document.querySelector("#detailGallery .photo-gallery-note"));
      assert.equal(await gallery.locator("img").count(), 1);
      await gallery.locator("img").evaluate(img => img.dispatchEvent(new Event("error")));
      assert.match(await gallery.innerText(), /Photo 1 unavailable/);
      await page.locator("#closeModal").click();
      await page.evaluate(() => { testDB.failPhotos = false; testDB.delayPhotos = true; });
      await page.locator('[data-details="multi"]').click();
      await page.waitForFunction(() => testDB.releasePhotos);
      await page.locator("#closeModal").click();
      await page.locator('[data-details="legacy"]').click();
      await page.evaluate(() => { testDB.delayPhotos = false; testDB.releasePhotos.splice(0).forEach(release => release()); });
      assert.equal(await gallery.locator("img").count(), 1);
      await page.locator("#closeModal").click();

      await page.locator("#myListingsButton").click();
      await page.waitForFunction(() => document.querySelectorAll('#dashboardContent [data-listing-id="multi"] img').length === 3);
      const dashboard = page.locator("#dashboardContent");
      assert.equal(await dashboard.locator("[data-listing-id]").count(), 4);
      assert.equal(await dashboard.locator('[data-listing-id="draft"] img').count(), 2);
      assert.equal(await dashboard.locator('[data-listing-id="other"]').count(), 0);
      await dashboard.locator('[data-listing-id="draft"]').getByRole("button", { name: "Next photo" }).click();
      await page.waitForFunction(() => document.querySelector('#dashboardContent [data-listing-id="draft"] [role=status]').textContent === "2 / 2");
      assert.equal(await dashboard.locator('[data-listing-id="multi"] [role=status]').innerText(), "1 / 3");
      const queries = await page.evaluate(() => testDB.queries);
      assert(queries.some(q => q.table === "listings" && q.filters.some(([key, value]) => key === "status" && value === "published")));
      assert(queries.some(q => q.table === "listings" && q.filters.some(([key, value]) => key === "owner_id" && value === "owner")));
      assert(queries.some(q => q.table === "listing_photos" && q.filters.some(([key, value]) => key === "listing_id" && Array.isArray(value) && !value.includes("other"))));

      // The photo editor opens and displays existing photos.
      await dashboard.locator('.edit-listing-photos[data-id="multi"]').click();
      await page.waitForFunction(() => document.querySelectorAll('#photoEditorGrid img').length > 0);
      await page.locator('[aria-label="Close photo editor"]').click();
      await page.waitForFunction(() => document.querySelector("#photoEditorTitle").closest(".auth-backdrop").hidden);
      await page.locator('[aria-label="Close dashboard"]').click();

      // The existing multi-file upload still saves a private draft and ordered photo rows.
      await page.locator("#listBottom").click();
      for (const [id, value] of Object.entries({ rentalTitle: "New rental", rentalDescription: "Description", rentalCity: "Louisville", rentalState: "KY", rentalPrice: "45" })) await page.locator(`#${id}`).fill(value);
      await page.locator("#rentalPhoto").setInputFiles([0, 1].map(i => ({ name: `photo${i}.png`, mimeType: "image/png", buffer: Buffer.from("photo") })));
      await page.locator("#listingSubmit").click();
      await page.waitForFunction(() => document.querySelector("#listingMessage").textContent === "Listing saved successfully!");
      const saved = await page.evaluate(() => ({ listing: testDB.listings.at(-1), photos: testDB.listing_photos.slice(-2), uploads: testDB.uploads }));
      assert.equal(saved.listing.status, "draft");
      assert.equal(saved.listing.owner_id, "owner");
      assert.deepEqual(saved.photos.map(p => p.position), [0, 1]);
      assert.equal(saved.listing.image_url, saved.photos[0].image_url);
      assert.equal(saved.uploads.length, 3);
      await page.locator('[aria-labelledby="listingTitle"] .auth-close').click();
      await page.locator("#myListingsButton").click();
      await page.evaluate(() => supabaseClient.auth.signOut());
      assert.equal(await dashboard.innerText(), "");
      assert.equal(await dashboard.isVisible(), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: gallery, touch/keyboard, fallbacks, isolated dashboards, permission filters, uploads, sign-out`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
