
(() => {
  "use strict";

  const client = window.supabaseClient;
  if (!client) return;

  // Create the My Listings button.
  const button = document.createElement("button");
  button.id = "myListingsButton";
  button.className = "button button-ghost";
  button.textContent = "🏠 Owner Dashboard";
  button.classList.add("account-shortcut");

  const shortcuts = document.getElementById("accountShortcuts");
  if (!shortcuts) return;
  shortcuts.appendChild(button);

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
      <h2 id="dashboardTitle">Owner Dashboard</h2>
      <p>Manage listings, requests and availability in one place.</p>
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

    const {data:requests,error:requestsError}=await client.from("booking_requests")
      .select("id,listing_id,status,expires_at,created_at,start_date,end_date")
      .in("listing_id",listings.map(item=>item.id))
      .order("created_at",{ascending:false});
    if(request!==dashboardRequest||modal.hidden)return;
    const now=Date.now();
    const effectiveStatus=r=>r.status==="pending"&&r.expires_at&&new Date(r.expires_at).getTime()<=now?"expired":r.status;
    const allRequests=requests||[];
    const pending=allRequests.filter(r=>effectiveStatus(r)==="pending");
    const approved=allRequests.filter(r=>effectiveStatus(r)==="approved");
    const published=listings.filter(l=>l.status==="published");
    const summary='<div class="owner-summary">'+[
      ["Total listings",listings.length],["Published",published.length],["Pending requests",requestsError?"—":pending.length],["Approved bookings",requestsError?"—":approved.length]
    ].map(([label,value])=>'<div class="owner-stat"><strong>'+value+'</strong><span>'+label+'</span></div>').join("")+'</div>';
    const queue=requestsError?'<p role="status">Booking summary unavailable: '+escapeHTML(requestsError.message)+'</p>':
      '<h3>Recent booking requests</h3>'+(allRequests.length?
      '<div class="owner-requests">'+allRequests.slice(0,8).map(r=>{
        const listing=listings.find(l=>l.id===r.listing_id);
        return '<div class="owner-request"><div><strong>'+escapeHTML(listing?.title||"Rental")+'</strong><small>'+escapeHTML(r.start_date)+' to '+escapeHTML(r.end_date)+' · '+escapeHTML(effectiveStatus(r))+'</small></div><button type="button" class="manage-booking-dates button button-ghost" data-id="'+escapeHTML(r.listing_id)+'">Manage</button></div>';
      }).join("")+'</div>':'<p>No booking requests yet.</p>');
    content.innerHTML=summary+queue+'<h3>Your listings</h3><div class="owner-filters"><button type="button" class="button button-ghost" data-owner-filter="all" aria-pressed="true">All</button><button type="button" class="button button-ghost" data-owner-filter="published" aria-pressed="false">Published</button><button type="button" class="button button-ghost" data-owner-filter="draft" aria-pressed="false">Drafts</button></div>'+listings.map(item => `
      <div class="owner-listing" data-listing-status="${escapeHTML(item.status)}" style="
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

<button type="button" class="manage-booking-dates" data-id="${escapeHTML(item.id)}">📅 Availability & Requests</button>
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
    content.querySelectorAll("[data-owner-filter]").forEach(filter=>filter.addEventListener("click",()=>{
      const selected=filter.dataset.ownerFilter;
      content.querySelectorAll("[data-owner-filter]").forEach(b=>b.setAttribute("aria-pressed",String(b===filter)));
      content.querySelectorAll(".owner-listing").forEach(card=>card.hidden=selected!=="all"&&card.dataset.listingStatus!==selected);
    }));
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
      "Publish this rental publicly? Anyone visiting Flexi Rent will be able to see its details and listed price. Booking requests are enabled, but payments are not enabled."
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

    const bookingButton = event.target.closest(".manage-booking-dates");
    if (bookingButton) { window.FlexiRentBooking?.open(bookingButton.dataset.id,true); return; }
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
