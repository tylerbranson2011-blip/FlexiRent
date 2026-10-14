
(() => {
  "use strict";

  const client = window.supabaseClient;

  if (!client) {
    console.error("Supabase is not connected.");
    return;
  }

  const categories = [
    ["car", "Cars"],
    ["truck", "Trucks"],
    ["trailer", "Trailers"],
    ["rv", "RVs & Campers"],
    ["equipment", "Heavy Equipment"]
  ];

  const modal = document.createElement("div");
  modal.className = "auth-backdrop";
  modal.hidden = true;

  modal.innerHTML = `
    <div class="auth-panel" role="dialog"
         aria-modal="true" aria-labelledby="listingTitle"
         style="max-height:90vh;overflow:auto">
      <button class="auth-close" type="button"
              aria-label="Close">×</button>
      <h2 id="listingTitle">List Your Rental</h2>
      <p>Tell renters what you have available.</p>

      <form id="newListingForm">
        <label for="rentalTitle">Listing title</label>
        <input id="rentalTitle" maxlength="120" required
               placeholder="2022 Bobcat Skid Steer">

        <label for="rentalCategory">Category</label>
        <select id="rentalCategory" required
                style="width:100%;padding:13px;background:#0d1014;color:white">
          ${categories.map(([value, label]) =>
            `<option value="${value}">${label}</option>`
          ).join("")}
        </select>

        <label for="rentalDescription">Description</label>
        <textarea id="rentalDescription" required
                  maxlength="2000" rows="4"
                  style="width:100%;padding:13px;background:#0d1014;color:white"
                  placeholder="Describe your rental"></textarea>

        <label for="rentalCity">City</label>
        <input id="rentalCity" required maxlength="100">

        <label for="rentalState">State</label>
        <input id="rentalState" required maxlength="50"
               placeholder="KY">

        <label for="rentalPrice">Price per day ($)</label>
        <input id="rentalPrice" type="number"
               min="1" step="0.01" required>

        <label for="rentalImage">Photo URL (optional)</label>
        <input id="rentalImage" type="url"
               placeholder="https://example.com/photo.jpg">

        <p id="listingMessage" role="status"></p>
        <button id="listingSubmit" type="submit">
          Save Listing
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = modal.querySelector("#newListingForm");
  const message = modal.querySelector("#listingMessage");
  const submit = form.querySelector('[type="submit"]');

  function closeForm() {
    modal.hidden = true;
  }

  async function openForm() {
    const { data, error } = await client.auth.getUser();

    if (error || !data.user) {
      alert("Please log in before listing a rental.");
      return;
    }

    message.textContent = "";
    modal.hidden = false;
  }

  document.getElementById("listTop")
    ?.addEventListener("click", openForm);

  document.getElementById("listBottom")
    ?.addEventListener("click", openForm);

  modal.querySelector(".auth-close")
    .addEventListener("click", closeForm);

  modal.addEventListener("click", event => {
    if (event.target === modal) closeForm();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const { data, error: authError } =
      await client.auth.getUser();

    if (authError || !data.user) {
      message.textContent = "Please log in again.";
      return;
    }

    const listing = {
      owner_id: data.user.id,
      title: document.getElementById("rentalTitle").value.trim(),
      category: document.getElementById("rentalCategory").value,
      description: document.getElementById("rentalDescription").value.trim(),
      city: document.getElementById("rentalCity").value.trim(),
      state: document.getElementById("rentalState").value.trim(),
      price_per_day: Number(
        document.getElementById("rentalPrice").value
      ),
      image_url: document.getElementById("rentalImage").value.trim() || null,
      status: "draft"
    };

    submit.disabled = true;
    message.textContent = "Saving your listing...";

    try {
      const { error } = await client
        .from("listings")
        .insert(listing);

      if (error) throw error;

      message.textContent = "Listing saved successfully!";
      form.reset();
    } catch (error) {
      message.textContent = error.message ||
        "Could not save listing.";
    } finally {
      submit.disabled = false;
    }
  });
})();
