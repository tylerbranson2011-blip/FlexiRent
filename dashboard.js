
(() => {
  "use strict";

  const client = window.supabaseClient;
  if (!client) return;

  // Create the My Listings button.
  const button = document.createElement("button");
  button.id = "myListingsButton";
  button.className = "button button-ghost";
  button.textContent = "My Listings";
  button.style.margin = "12px 17px";

  const section = document.getElementById("list");
  if (!section) return;

  section.insertAdjacentElement("beforebegin", button);

  // Create the dashboard popup.
  const modal = document.createElement("div");
  modal.className = "auth-backdrop";
  modal.hidden = true;

  modal.innerHTML = `
    <div class="auth-panel" role="dialog"
         aria-modal="true"
         aria-labelledby="dashboardTitle"
         style="max-width:650px;max-height:90vh;overflow:auto">
      <button class="auth-close" type="button"
              aria-label="Close dashboard">×</button>
      <h2 id="dashboardTitle">My Listings</h2>
      <p>Manage your Flexi Rent rentals.</p>
      <div id="dashboardContent" aria-live="polite"></div>
    </div>
  `;

  document.body.appendChild(modal);

  const content = modal.querySelector("#dashboardContent");

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]
    );
  }

  async function openDashboard() {
    const { data, error } = await client.auth.getUser();

    if (error || !data.user) {
      alert("Please log in to view your listings.");
      return;
    }

    modal.hidden = false;
    content.textContent = "Loading your listings...";

    const { data: listings, error: loadError } =
      await client
        .from("listings")
        .select("id,title,category,price_per_day,status")
        .eq("owner_id", data.user.id)
        .order("created_at", { ascending: false });

    if (loadError) {
      content.textContent = loadError.message;
      return;
    }

    if (!listings || listings.length === 0) {
      content.textContent = "You have no listings yet.";
      return;
    }

    content.innerHTML = listings.map(item => `
      <div style="
        padding:15px;
        margin:12px 0;
        background:#101317;
        border:1px solid #343941;
        border-radius:10px;
      ">
        <strong>${escapeHTML(item.title)}</strong>
        <p>${escapeHTML(item.category)}</p>
        <p>$${Number(item.price_per_day).toFixed(2)} / day</p>
        <p>Status: ${escapeHTML(item.status)}</p>
      </div>
    `).join("");
  }

  button.addEventListener("click", openDashboard);

  modal.querySelector(".auth-close")
    .addEventListener("click", () => {
      modal.hidden = true;
    });

  modal.addEventListener("click", event => {
    if (event.target === modal) {
      modal.hidden = true;
    }
  });
})();
