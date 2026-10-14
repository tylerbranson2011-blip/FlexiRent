
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

  let dashboardRequest=0;
  async function openDashboard() {
    const request=++dashboardRequest;
    const { data, error } = await client.auth.getUser();

    if(request!==dashboardRequest)return;
    if (error || !data.user) {
      alert("Please log in to view your listings.");
      return;
    }

    modal.hidden = false;
    content.textContent = "Loading your listings...";

    const { data: listings, error: loadError } =
      await client
        .from("listings")
   .select("id,title,category,price_per_day,status,image_url")
     .eq("owner_id", data.user.id)
        .order("created_at", { ascending: false });

    if(request!==dashboardRequest||modal.hidden)return;
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
      
        <div class="dashboard-gallery" data-listing-id="${escapeHTML(item.id)}"></div>

        <strong>${escapeHTML(item.title)}</strong>
        <p>${escapeHTML(item.category)}</p>
        <p>$${Number(item.price_per_day).toFixed(2)} / day</p>
        <p>Status: ${escapeHTML(item.status)}</p>
        <button type="button"
  class="edit-listing"
  data-id="${escapeHTML(item.id)}">
  ✏️ Edit Listing
</button>

<button type="button"
  class="edit-listing-photos"
  data-id="${escapeHTML(item.id)}">
  📸 Edit Photos
</button>

${item.status === "draft" ? `
  <button type="button"
    class="publish-listing"
    data-id="${escapeHTML(item.id)}">
    🚀 Publish Listing
  </button>
` : ""}

${item.status === "published" ? `
  <button type="button"
    class="unpublish-listing"
    data-id="${escapeHTML(item.id)}">
    📥 Unpublish Listing
  </button>
` : ""}

      </div>
    `).join("");
    const galleries=[...content.querySelectorAll(".dashboard-gallery")];
    const mountGalleries=(photos=[],unavailable=false)=>galleries.forEach((gallery,index)=>{const item=listings[index];window.FlexiRentGallery.mount(gallery,{title:item.title,cover:item.image_url,compact:true,unavailable,photos:photos.filter(photo=>String(photo.listing_id)===String(item.id))})});
    mountGalleries();
    try{const {data:photos,error:photoError}=await client.from("listing_photos").select("listing_id,image_url,position").in("listing_id",listings.map(item=>item.id)).order("position",{ascending:true});if(request!==dashboardRequest||modal.hidden)return;mountGalleries(photoError?[]:photos||[],Boolean(photoError))}catch{if(request===dashboardRequest&&!modal.hidden)mountGalleries([],true)}
  }

  async function editListing(id) {
    const { data: authData, error: authError } =
      await client.auth.getUser();

    if (authError || !authData.user) {
      alert("Please log in again.");
      return;
    }

    const { data: listing, error } = await client
      .from("listings")
      .select("id,title,description,price_per_day")
      .eq("id", id)
      .eq("owner_id", authData.user.id)
      .single();

    if (error || !listing) {
      alert("Could not load this listing.");
      return;
    }

    const title = prompt("Listing title:", listing.title);
    if (title === null) return;

    const price = prompt(
      "Daily rental price ($):",
      listing.price_per_day
    );
    if (price === null) return;

    const description = prompt(
      "Description:",
      listing.description || ""
    );
    if (description === null) return;

    const amount = Number(price);

    if (!title.trim() || !price.trim() ||
        !Number.isFinite(amount) || amount <= 0) {
      alert("Enter a title and a valid price above $0.");
      return;
    }

    const { error: saveError } = await client
      .from("listings")
      .update({
        title: title.trim(),
        price_per_day: amount,
        description: description.trim()
      })
      .eq("id", id)
      .eq("owner_id", authData.user.id);

    if (saveError) {
      alert("Save failed: " + saveError.message);
      return;
    }

    alert("Listing updated successfully!");
    openDashboard();
  }

  async function publishListing(id) {
    const { data: authData, error: authError } =
      await client.auth.getUser();

    if (authError || !authData.user) {
      alert("Please log in again.");
      return;
    }

    const { data: listing, error: loadError } = await client
      .from("listings")
      .select("id,title,description,city,state,price_per_day,status")
      .eq("id", id)
      .eq("owner_id", authData.user.id)
      .single();

    if (loadError || !listing || listing.status !== "draft") {
      alert("This draft could not be loaded.");
      return;
    }

    if (!listing.title?.trim() ||
        !listing.description?.trim() ||
        !listing.city?.trim() ||
        !listing.state?.trim() ||
        Number(listing.price_per_day) <= 0) {
      alert("Complete the title, description, location and price before publishing.");
      return;
    }

    const confirmed = confirm(
      "Publish this rental publicly? Anyone visiting Flexi Rent will be able to see its details and listed price. Bookings and payments are not enabled."
    );

    if (!confirmed) return;

    const { data: updated, error: saveError } = await client
      .from("listings")
      .update({ status: "published" })
      .eq("id", id)
      .eq("owner_id", authData.user.id)
      .eq("status", "draft")
      .select("id");

    if (saveError || !updated?.length) {
      alert("Publishing failed. Please try again.");
      return;
    }

    alert("Your listing is now published!");
    openDashboard();
  }

  
  async function unpublishListing(id) {
    const { data: authData, error: authError } =
      await client.auth.getUser();

    if (authError || !authData.user) {
      alert("Please log in again.");
      return;
    }

    const confirmed = confirm(
      "Unpublish this listing? It will disappear from the public storefront, but you can publish it again later."
    );

    if (!confirmed) return;

    const { data: updated, error: saveError } = await client
      .from("listings")
      .update({ status: "draft" })
      .eq("id", id)
      .eq("owner_id", authData.user.id)
      .eq("status", "published")
      .select("id");

    if (saveError || !updated?.length) {
      alert("Unpublishing failed. Please try again.");
      return;
    }

    alert("Listing unpublished successfully!");
    openDashboard();
  }

  content.addEventListener("click", event => {
    const editButton = event.target.closest(".edit-listing");

    if (editButton) {
      editListing(editButton.dataset.id);
      return;
    }

    
    const publishButton = event.target.closest(".publish-listing");

    if (publishButton) {
      publishListing(publishButton.dataset.id);
      return;
    }

    
    const unpublishButton = event.target.closest(".unpublish-listing");

    if (unpublishButton) {
      unpublishListing(unpublishButton.dataset.id);
      return;
    }

    const photoButton = event.target.closest(".edit-listing-photos");

    if (photoButton) {
      window.FlexiRentPhotoEditor.open(photoButton.dataset.id);
      return;
    }
  });




  client.auth.onAuthStateChange((_event,session)=>{if(!session?.user){++dashboardRequest;modal.hidden=true;content.replaceChildren()}});
  button.addEventListener("click", openDashboard);

  modal.querySelector(".auth-close")
    .addEventListener("click", () => {
      ++dashboardRequest;
        modal.hidden = true;
    });

  modal.addEventListener("click", event => {
    if (event.target === modal) {
      modal.hidden = true;
    }
  });
})();
