
(() => {
  "use strict";

  const client = window.supabaseClient;

  if (!client) {
    console.error("Supabase is not connected.");
    return;
  }

  const categories = [
    ["trailer", "Trailers"],
    ["rv", "Towable Campers Only"],
    ["equipment", "Equipment (subject to review)"]
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
      <h2 id="listingTitle">Create an Owner Listing Draft</h2>
      <p>Draft only. Your self-certifications are not yet recorded by the server, and publishing is disabled pending review.</p>

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

<label for="rentalPhoto">Or upload a photo from your phone</label>
<input id="rentalPhoto"
       type="file"
       multiple       
       accept="image/jpeg,image/png,image/webp"
       style="width:100%;padding:13px">
<small>JPG, PNG or WebP. Maximum 5 MB.</small>

        <fieldset style="margin:18px 0;border:1px solid #8b5cf6;border-radius:10px;padding:14px"><legend>Owner self-certification (required)</legend>
<p>Check each statement individually. These are draft acknowledgments only, not yet recorded in a secure audit log. Flexi Rent does not independently verify your answers.</p>
<label style="display:block"><input type="checkbox" class="owner-cert" required> I own this item or am legally authorized to rent it.</label>
<label style="display:block"><input type="checkbox" class="owner-cert" required> The listing, photos, condition, price and availability are accurate.</label>
<label style="display:block"><input type="checkbox" class="owner-cert" required> I am responsible for maintenance, safety, recalls, registration, permits and applicable taxes.</label>
<label style="display:block"><input type="checkbox" class="owner-cert" required> I will confirm insurance coverage for rental use. Flexi Rent provides and verifies no insurance.</label>
<label style="display:block"><input type="checkbox" class="owner-cert" required> I will independently check renter qualifications, licenses and towing/operating suitability.</label>
<label style="display:block"><input type="checkbox" class="owner-cert" required> I handle rental contracts, payments, deposits, refunds, damages and disputes directly.</label>
<label style="display:block"><input type="checkbox" class="owner-cert" required> I understand Flexi Rent is a connection platform and not a party to the rental.</label>
<label style="display:block"><input type="checkbox" class="owner-cert" required> I agree to the <a href="legal.html#owner" target="_blank" rel="noopener">draft Owner Agreement</a> and <a href="legal.html#marketplace" target="_blank" rel="noopener">draft Marketplace Terms</a>.</label>
</fieldset><p id="listingMessage" role="status"></p>
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

    
    const photos = Array.from(
      document.getElementById("rentalPhoto").files
    );

    if (photos.length > 10) {
      message.textContent = "Maximum 10 photos per listing.";
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    for (const photo of photos) {
      if (!allowedTypes.includes(photo.type)) {
        message.textContent = "Only JPG, PNG or WebP photos are allowed.";
        return;
      }

      if (photo.size > 5 * 1024 * 1024) {
        message.textContent = "Each photo must be 5 MB or smaller.";
        return;
      }
    }


    if (!["trailer","rv","equipment"].includes(document.getElementById("rentalCategory").value)) { message.textContent = "This category is not eligible for the connection-only launch."; return; }

    if (!data.user.email_confirmed_at) { message.textContent = "Please verify your email address before saving a draft."; return; }

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
      
      
      const uploadedPhotos = [];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];

        message.textContent =
          `Uploading photo ${i + 1} of ${photos.length}...`;

        const extension = photo.type === "image/png"
          ? "png"
          : photo.type === "image/webp" ? "webp" : "jpg";

        const filePath =
          `${data.user.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await client.storage
          .from("listing-images")
          .upload(filePath, photo, {
            contentType: photo.type,
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: photoData } = client.storage
          .from("listing-images")
          .getPublicUrl(filePath);

        uploadedPhotos.push({
          image_url: photoData.publicUrl,
          storage_path: filePath,
          position: i
        });
      }

      if (uploadedPhotos.length > 0) {
        listing.image_url = uploadedPhotos[0].image_url;
      }


      
      const { data: savedListing, error } = await client
        .from("listings")
        .insert(listing)
        .select("id")
        .single();

      if (error) throw error;

      if (uploadedPhotos.length > 0) {
        message.textContent = "Saving photo gallery...";

        const photoRecords = uploadedPhotos.map(photo => ({
          listing_id: savedListing.id,
          image_url: photo.image_url,
          storage_path: photo.storage_path,
          position: photo.position
        }));

        const { error: photoError } = await client
          .from("listing_photos")
          .insert(photoRecords);

        if (photoError) throw photoError;
      }


      message.textContent = "Draft saved. Publishing is paused until secure owner certification and legal review are complete.";
      form.reset();
    } catch (error) {
      message.textContent = error.message ||
        "Could not save listing.";
    } finally {
      submit.disabled = false;
    }
  });
})();
