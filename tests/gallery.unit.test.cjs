// Dependency-free behavior checks: node tests/gallery.unit.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

class Element {
  constructor() {
    this.children = []; this.attrs = {}; this.events = {}; this.dataset = {};
    this.clientWidth = 300; this.scrollLeft = 0; this.style = {}; this.hidden = false;
    this.value = "all";
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.nodes = new Map();
  }
  append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
  appendChild(child) { this.append(child); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  replaceWith(child) { this.parent.children.splice(this.parent.children.indexOf(this), 1, child); }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(event, callback) { this.events[event] = callback; }
  scrollTo({ left }) { this.scrollLeft = left; this.events.scroll?.(); }
  insertAdjacentElement() {}
  querySelector(selector) {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector);
  }
  querySelectorAll() {
    return [...(this.innerHTML || "").matchAll(/data-listing-id="([^"]+)"/g)].map(match => {
      const element = new Element(); element.dataset.listingId = match[1]; return element;
    });
  }
}
function environment(client) {
  const nodes = new Map();
  const document = {
    createElement: () => new Element(), body: new Element(), head: new Element(),
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); },
    querySelectorAll: () => [], addEventListener() {}
  };
  document.getElementById("price").value = "9999";
  document.getElementById("location").value = "";
  const context = vm.createContext({ window: { supabaseClient: client }, document, URL, console, setTimeout, clearTimeout, alert() {} });
  vm.runInContext(source("gallery.js"), context);
  return { context, document, gallery: context.window.FlexiRentGallery };
}
test("orders photos, deduplicates cover, keeps URL-only covers, rejects unsafe URLs", () => {
  const { gallery } = environment();
  assert.deepEqual(Array.from(gallery.photoUrls("https://test/cover", [
    { position: 2, image_url: "https://test/last" }, { position: 0, image_url: "https://test/cover" },
    { position: 1, image_url: "https://test/middle" }, { position: 3, image_url: "javascript:alert(1)" }
  ])), ["https://test/cover", "https://test/middle", "https://test/last"]);
  assert.deepEqual(Array.from(gallery.photoUrls("https://test/legacy")), ["https://test/legacy"]);
  assert.equal(gallery.photoUrls(null, [{ image_url: null }, { image_url: "bad URL" }]).length, 0);
});
test("navigation, keyboard endpoints and swipe scroll update the photo counter", () => {
  const { gallery } = environment();
  const element = new Element();
  gallery.mount(element, { title: "Rental", cover: "https://test/0", photos: [1, 2].map(position => ({ position, image_url: `https://test/${position}` })) });
  const [track, controls] = element.children;
  const [previous, count, next] = controls.children;
  assert.equal(count.textContent, "1 / 3");
  next.events.click(); assert.equal(count.textContent, "2 / 3");
  previous.events.click(); assert.equal(count.textContent, "1 / 3");
  track.events.keydown({ key: "End", preventDefault() {} }); assert.equal(count.textContent, "3 / 3");
  next.events.click(); assert.equal(count.textContent, "3 / 3");
  track.events.keydown({ key: "Home", preventDefault() {} }); assert.equal(count.textContent, "1 / 3");
  track.scrollLeft = 300; track.events.scroll(); assert.equal(count.textContent, "2 / 3");
});
test("empty, single-photo, failed-image and photo-query-error states", () => {
  const { gallery } = environment(); const element = new Element();
  gallery.mount(element, { title: "Rental" });
  assert.equal(element.children[0].textContent, "No photos available");
  gallery.mount(element, { title: '<img onerror="alert(1)">', cover: "https://test/0", unavailable: true });
  assert.equal(element.children.length, 2);
  const img = element.children[0].children[0].children[0];
  assert.match(img.alt, /<img onerror=/);
  img.events.error();
  assert.equal(element.children[0].children[0].children[0].textContent, "Photo 1 unavailable");
  assert.match(element.children[1].textContent, /could not be loaded/);
});

function database() {
  const queries = []; const pending = []; const callbacks = [];
  let delay = false;
  const listings = [
    { id: "public", title: "Published", status: "published", category: "trailer", owner_id: "owner", price_per_day: 40, image_url: "https://test/0" },
    { id: "draft", title: "Private", status: "draft", owner_id: "owner", price_per_day: 40 },
    { id: "other", title: "Other owner", status: "draft", owner_id: "other", price_per_day: 40 }
  ];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }), onAuthStateChange: cb => callbacks.push(cb) },
    from(table) {
      const q = { table, filters: [] };
      const builder = {
        select(fields) { q.fields = fields; return this; },
        eq(key, value) { q.filters.push([key, value]); return this; },
        in(key, value) { q.filters.push([key, value]); return this; },
        order(key) { q.order = key; return this; },
        async then(resolve) {
          queries.push(q);
          if (table === "listing_photos" && delay) await new Promise(r => pending.push(r));
          resolve({ data: table === "listings" ? listings.filter(row => q.filters.every(([k, v]) => row[k] === v)) : [{ listing_id: "public", position: 1, image_url: "https://test/1" }] });
        }
      };
      return builder;
    }
  };
  return { client, queries, callbacks, pending, setDelay(value) { delay = value; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test("public details retain the published filter and ignore photo responses after close", async () => {
  const db = database(); const env = environment(db.client);
  vm.runInContext(source("app.js"), env.context); await tick();
  assert(db.queries[0].filters.some(([key, value]) => key === "status" && value === "published"));
  db.setDelay(true);
  const request = vm.runInContext('openDetails("public")', env.context); await tick();
  const gallery = env.document.getElementById("detailGallery");
  assert.equal(gallery.children[0].children.length, 1);
  vm.runInContext("closeDetails()", env.context);
  db.pending[0](); await request;
  assert.equal(gallery.children[0].children.length, 1);
  assert(db.queries[1].filters.some(([key, value]) => key === "listing_id" && value === "public"));
});
test("dashboard fetches only owner listing IDs and clears on sign-out during photo load", async () => {
  const db = database();
  let dashboardButton;
  const fresh = environment(db.client);
  fresh.document.getElementById("list").insertAdjacentElement = (_position, element) => { dashboardButton = element; };
  vm.runInContext(source("dashboard.js"), fresh.context);
  db.setDelay(true);
  const request = dashboardButton.events.click(); await tick();
  assert(db.queries[0].filters.some(([key, value]) => key === "owner_id" && value === "owner"));
  assert.deepEqual(Array.from(db.queries[1].filters[0][1]), ["public", "draft"]);
  const modal = fresh.document.body.children[0]; const content = modal.querySelector("#dashboardContent");
  db.callbacks.forEach(cb => cb("SIGNED_OUT", null));
  db.pending[0](); await request;
  assert.equal(modal.hidden, true);
  assert.equal(content.children.length, 0);
});
