
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
  button.hidden = true;
  let roleRequest=0;
  async function syncOwnerButton(){
    const request=++roleRequest;
    button.hidden=true;
    const {data:{user},error}=await client.auth.getUser();
    if(request!==roleRequest||error||!user)return;
    const result=await client.from("account_roles").select("account_type").eq("user_id",user.id).maybeSingle();
    if(request!==roleRequest)return;
    button.hidden=Boolean(result.error||result.data?.account_type!=="owner");
  }
  window.addEventListener("flexirent:account-role-changed",syncOwnerButton);
  client.auth.onAuthStateChange(()=>{setTimeout(syncOwnerButton,0);});
  syncOwnerButton();
  window.addEventListener("flexirent:listing-created",()=>{if(!modal.hidden)openDashboard();});

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

    const role=await client.from("account_roles").select("account_type").eq("user_id",data.user.id).maybeSingle();
    if(request!==dashboardRequest)return;
    if(role.error||role.data?.account_type!=="owner"){
      button.hidden=true;
      alert("Owner account required. Upgrade your account to manage listings.");
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
      content.innerHTML = '<button type="button" class="button button-primary new-owner-listing">＋ New Listing</button><p>You have no listings yet.</p>';
      return;
    }

    const {data:requests,error:requestsError}=await client.from("booking_requests")
      .select("id,listing_id,renter_id,status,expires_at,created_at,start_date,end_date,pickup_time,return_time,booking_timezone,agreed_price_per_day,agreed_price_per_hour,agreed_operator_option")
      .in("listing_id",listings.map(item=>item.id))
      .order("created_at",{ascending:false});
    if(request!==dashboardRequest||modal.hidden)return;
    const reviewEligible=await window.FlexiRentReviews?.eligibility(requests||[],"owner",data.user.id)||new Set();
    const now=Date.now();
    const effectiveStatus=r=>r.status==="pending"&&r.expires_at&&new Date(r.expires_at).getTime()<=now?"expired":r.status;
    const allRequests=requests||[];
    const pending=allRequests.filter(r=>effectiveStatus(r)==="pending");
    const approved=allRequests.filter(r=>effectiveStatus(r)==="approved");
    const published=listings.filter(l=>l.status==="published");
    const summary='<div class="owner-summary">'+[
      ["Total listings",listings.length],["Published",published.length],["Pending requests",requestsError?"—":pending.length],["Approved bookings",requestsError?"—":approved.length]
    ].map(([label,value])=>'<div class="owner-stat"><strong>'+value+'</strong><span>'+label+'</span></div>').join("")+'</div>';
    const approvedList=requestsError?'':('<section class="approved-bookings-section"><button type="button" class="approved-bookings-toggle" aria-expanded="false" aria-controls="approvedBookingsList"><span>✅ Approved bookings ('+approved.length+')</span><span class="approved-chevron" aria-hidden="true">▾</span></button><div id="approvedBookingsList" hidden>'+ (approved.length?approved.map(r=>{
      const listing=listings.find(l=>l.id===r.listing_id);
      const date=s=>/^\\d{4}-\\d{2}-\\d{2}$/.test(s||"")?s.slice(5,7)+"/"+s.slice(8,10)+"/"+s.slice(0,4):s||"Not set";
      const time=s=>{const m=/^(\\d{2}):(\\d{2})/.exec(s||"");if(!m)return "Not set";const h=Number(m[1]);return (h%12||12)+":"+m[2]+" "+(h<12?"AM":"PM");};
      return '<article class="approved-booking-card"><strong>'+escapeHTML(listing?.title||"Rental")+'</strong><p>Pickup: '+escapeHTML(date(r.start_date))+' at '+escapeHTML(time(r.pickup_time))+'</p><p>Return: '+escapeHTML(date(r.end_date))+' at '+escapeHTML(time(r.return_time))+'</p>'+(r.booking_timezone?'<p>Time zone: '+escapeHTML(r.booking_timezone)+'</p>':'')+'<button type="button" class="approved-renter-profile button button-ghost" data-booking="'+escapeHTML(r.id)+'">👤 View renter profile</button></article>';
    }).join(""):'<p>No approved rentals yet.</p>')+'</div></section>');
    const reviewsQueue=allRequests.filter(r=>reviewEligible.has(r.id));
    const reviewActions=reviewsQueue.length?'<h3>Rate completed renters</h3>'+reviewsQueue.map(r=>'<button type="button" class="button button-ghost owner-rate-renter" data-booking="'+escapeHTML(r.id)+'">⭐ Rate renter for '+escapeHTML(listings.find(l=>l.id===r.listing_id)?.title||'rental')+'</button>').join(''):'';
    const queue=requestsError?'<p role="status">Booking summary unavailable: '+escapeHTML(requestsError.message)+'</p>':
      '<h3>Pending booking requests</h3>'+(pending.length?
      '<div class="owner-requests">'+pending.map(r=>{
        const listing=listings.find(l=>l.id===r.listing_id);
        return '<div class="owner-request"><div><strong>'+escapeHTML(listing?.title||"Rental")+'</strong><small>'+escapeHTML(r.start_date)+' to '+escapeHTML(r.end_date)+' · '+escapeHTML(effectiveStatus(r))+'</small></div><div class="owner-request-actions"><button type="button" class="owner-respond button button-primary" data-request="'+escapeHTML(r.id)+'" data-approve="true">Approve</button><button type="button" class="owner-respond button button-ghost" data-request="'+escapeHTML(r.id)+'" data-approve="false">Decline</button><button type="button" class="manage-booking-dates button button-ghost" data-id="'+escapeHTML(r.listing_id)+'">Details</button></div></div>';
      }).join("")+'</div>':'<p>No pending booking requests.</p>');
    content.innerHTML='<button type="button" class="button button-primary new-owner-listing">＋ New Listing</button>'+summary+approvedList+queue+reviewActions+'<h3>Your listings</h3><div class="owner-filters"><button type="button" class="button button-ghost" data-owner-filter="all" aria-pressed="true">All</button><button type="button" class="button button-ghost" data-owner-filter="published" aria-pressed="false">Published</button><button type="button" class="button button-ghost" data-owner-filter="draft" aria-pressed="false">Drafts</button></div>'+listings.map(item => `
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

  // Dedicated editor replaces native browser prompts.
  const editor = document.createElement("div");
  editor.className = "auth-backdrop listing-editor-backdrop";
  editor.hidden = true;
  editor.innerHTML = `
    <div class="auth-panel listing-editor-panel" role="dialog" aria-modal="true" aria-labelledby="editListingTitle">
      <button class="auth-close" type="button" aria-label="Close editor">×</button>
      <h2 id="editListingTitle">✏️ Edit Listing</h2>
      <p>Update your rental details. Changes save to your listing.</p>
      <form id="editListingForm">
        <label for="editListingName">Listing title</label>
        <input id="editListingName" name="title" maxlength="120" required>
        <div class="listing-editor-prices">
          <div><label for="editListingDaily">Daily price ($)</label><input id="editListingDaily" name="daily" type="number" min="0.01" step="0.01" required></div>
          <div><label for="editListingHourly">Hourly price ($), optional</label><input id="editListingHourly" name="hourly" type="number" min="0.01" step="0.01" placeholder="Not offered"></div>
        </div>
        <label for="editListingOperator">Operator availability</label>
        <select id="editListingOperator" name="operator">
          <option value="without_operator">Without operator</option>
          <option value="operator_available">Operator available</option>
          <option value="operator_required">Operator required</option>
        </select>
        <label for="editListingDescription">Description</label>
        <textarea id="editListingDescription" name="description" rows="5" maxlength="5000"></textarea>
        <p class="listing-editor-hint">To change available dates or pickup times, unpublish the listing first and use Availability & Requests.</p>
        <p id="editListingMessage" role="status" aria-live="polite"></p>
        <div class="listing-editor-actions">
          <button type="button" class="button button-ghost listing-editor-cancel">Cancel</button>
          <button type="submit" class="button button-primary listing-editor-save">Save Changes</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(editor);
  const editForm=editor.querySelector("#editListingForm");
  const editMessage=editor.querySelector("#editListingMessage");
  let editingId=null;
  let editingPublished=false;
  function closeEditor(){
    editor.hidden=true;
    editingId=null;
    editingPublished=false;
    modal.hidden=false;
  }
  editor.querySelector(".auth-close").addEventListener("click",closeEditor);
  editor.querySelector(".listing-editor-cancel").addEventListener("click",closeEditor);
  editor.addEventListener("click",event=>{if(event.target===editor)closeEditor();});
  editor.addEventListener("keydown",event=>{if(event.key==="Escape")closeEditor();});
  async function editListing(id) {
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user){window.FlexiRentNotice?.show("Please log in again.","error");return;}
    const {data:listing,error}=await client.from("listings")
      .select("id,title,description,price_per_day,price_per_hour,operator_option,status")
      .eq("id",id).eq("owner_id",user.id).single();
    if(error||!listing){window.FlexiRentNotice?.show("Could not load this listing.","error");return;}
    editingId=id;
    editingPublished=listing.status==="published";
    for(const field of ["daily","hourly","operator"])editForm.elements[field].disabled=editingPublished;
    editor.querySelector(".listing-editor-hint").textContent=editingPublished?"🔒 Published listing: prices and operator terms are locked. Unpublish first to change them. Existing booking agreements remain unchanged.":"To change available dates or pickup times, unpublish the listing first and use Availability & Requests.";
    editForm.elements.title.value=listing.title||"";
    editForm.elements.daily.value=listing.price_per_day??"";
    editForm.elements.hourly.value=listing.price_per_hour??"";
    editForm.elements.operator.value=listing.operator_option||"without_operator";
    editForm.elements.description.value=listing.description||"";
    editMessage.textContent="";
    modal.hidden=true;
    editor.hidden=false;
    editForm.elements.title.focus();
  }
  editForm.addEventListener("submit",async event=>{
    event.preventDefault();
    if(!editingId)return;
    const title=editForm.elements.title.value.trim();
    const daily=Number(editForm.elements.daily.value);
    const hourlyRaw=editForm.elements.hourly.value.trim();
    const hourly=hourlyRaw===""?null:Number(hourlyRaw);
    const operator=editForm.elements.operator.value;
    if(!title||!Number.isFinite(daily)||daily<=0||(hourly!==null&&(!Number.isFinite(hourly)||hourly<=0))){
      editMessage.textContent="Enter a title and valid prices above $0.";
      return;
    }
    const save=editor.querySelector(".listing-editor-save");
    save.disabled=true;editMessage.textContent="Saving changes...";
    try{
      const {data:{user},error:authError}=await client.auth.getUser();
      if(authError||!user)throw Error("Please log in again.");
      const changes=editingPublished?{title,description:editForm.elements.description.value.trim()}:{title,price_per_day:daily,price_per_hour:hourly,operator_option:operator,description:editForm.elements.description.value.trim()};
      const {data,error}=await client.from("listings").update(changes).eq("id",editingId).eq("owner_id",user.id).select("id");
      if(error)throw error;
      if(!data?.length)throw Error("Listing not found or permission denied.");
      window.FlexiRentNotice?.show("Listing changes saved!");
      editor.hidden=true;editingId=null;
      modal.hidden=false;
      await openDashboard();
    }catch(error){editMessage.textContent=error.message||"Could not save listing.";}
    finally{save.disabled=false;}
  });

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

    window.FlexiRentNotice?.show("Listing published!");
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

    window.FlexiRentNotice?.show("Listing unpublished!");
    openDashboard();
  }

  const renterProfile=document.createElement("div");
  renterProfile.className="auth-backdrop approved-renter-backdrop";
  renterProfile.hidden=true;
  renterProfile.innerHTML='<div class="auth-panel approved-renter-panel" role="dialog" aria-modal="true" aria-labelledby="renterProfileTitle"><button type="button" class="auth-close" aria-label="Close renter profile">×</button><h2 id="renterProfileTitle">Renter Profile</h2><div id="renterProfileContent" role="status">Loading...</div><button type="button" class="button button-ghost approved-profile-back">← Back to approved bookings</button></div>';
  document.body.appendChild(renterProfile);
  const closeRenterProfile=()=>{renterProfile.hidden=true;modal.hidden=false;};
  renterProfile.querySelector(".auth-close").addEventListener("click",closeRenterProfile);
  renterProfile.querySelector(".approved-profile-back").addEventListener("click",closeRenterProfile);
  renterProfile.addEventListener("click",e=>{if(e.target===renterProfile)closeRenterProfile();});
  async function openRenterProfile(bookingId){
    const details=renterProfile.querySelector("#renterProfileContent");
    modal.hidden=true;renterProfile.hidden=false;details.textContent="Loading renter profile...";
    const {data,error}=await client.rpc("owner_approved_renter_profile",{p_booking:bookingId});
    if(renterProfile.hidden)return;
    if(error){details.textContent="Unable to open profile: "+error.message;return;}
    const stars=data.average_rating==null?"No ratings yet":Number(data.average_rating).toFixed(1)+" / 5 stars";
    details.innerHTML='<div class="renter-profile-avatar">👤</div><h3>'+escapeHTML(data.display_name||"FlexiRent renter")+'</h3><p class="renter-profile-rating">⭐ '+escapeHTML(stars)+' ('+Number(data.review_count||0)+' reviews)</p><h4>About renter</h4><p>'+escapeHTML(data.bio||"This renter has not added a bio yet.")+'</p><p class="renter-profile-privacy">Email and phone are kept private.</p>';
  }
  content.addEventListener("click", async event => {
    const toggleApproved=event.target.closest(".approved-bookings-toggle");
    if(toggleApproved){const list=content.querySelector("#approvedBookingsList");if(list){list.hidden=!list.hidden;toggleApproved.setAttribute("aria-expanded",String(!list.hidden));}return;}
    const renterButton=event.target.closest(".approved-renter-profile");
    if(renterButton){await openRenterProfile(renterButton.dataset.booking);return;}

    const reviewButton=event.target.closest(".owner-rate-renter");
    if(reviewButton){window.FlexiRentReviews?.open(reviewButton.dataset.booking,openDashboard);return;}

    if(event.target.closest(".new-owner-listing")){
      if(!window.FlexiRentNewListing?.open){
        window.FlexiRentNotice?.show("Listing form unavailable. Refresh and try again.","error");
        return;
      }
      ++dashboardRequest;
      modal.hidden=true;
      try{await window.FlexiRentNewListing.open();}
      catch(error){window.FlexiRentNotice?.show(error?.message||"Could not open listing form.","error");}
      return;
    }
    const response=event.target.closest(".owner-respond");
    if(response){
      const id=response.dataset.request,approve=response.dataset.approve==="true";
      if(!confirm(approve?"Approve this booking request?":"Decline this booking request?"))return;
      const {data:{user},error:authError}=await client.auth.getUser();
      if(authError||!user){alert("Please log in again.");return;}
      const {data:role,error:roleError}=await client.from("account_roles").select("account_type").eq("user_id",user.id).maybeSingle();
      if(roleError||role?.account_type!=="owner"){alert("Owner account required.");return;}
      const controls=[...content.querySelectorAll(".owner-respond")].filter(b=>b.dataset.request===id);
      controls.forEach(b=>b.disabled=true);
      const result=await client.rpc("respond_booking",{p_request:id,p_approve:approve});
      if(result.error){alert("Could not update request: "+result.error.message);controls.forEach(b=>b.disabled=false);}
      else{window.FlexiRentNotice?.show(approve?"Rental approved!":"Rental declined.");openDashboard();}
      return;
    }

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
