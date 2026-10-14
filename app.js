let listings = [];
const grid=document.getElementById("listingGrid");
const categorySelect=document.getElementById("category");
const locationInput=document.getElementById("location");
const priceSelect=document.getElementById("price");
const sortSelect=document.getElementById("sort");
const emptyState=document.getElementById("emptyState");
const resultsText=document.getElementById("resultsText");
const modal=document.getElementById("detailModal");
const detailContent=document.getElementById("detailContent");
const toast=document.getElementById("toast");
let selectedCategory="all";
let toastTimer;
const escapeHTML=(value)=>String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2800);}
function filteredListings(){
 const cat=categorySelect.value;
 const max=Number(priceSelect.value);
 const loc=locationInput.value.trim().toLowerCase();
 let result=listings.filter(item=>(cat==="all"||item.category===cat)&&(selectedCategory==="all"||item.category===selectedCategory)&&item.price<=max&&(!loc||item.location.toLowerCase().includes(loc)||loc.length<3));
 if(sortSelect.value==="low")result.sort((a,b)=>a.price-b.price);
 if(sortSelect.value==="high")result.sort((a,b)=>b.price-a.price);
 return result;
}
function render(){
 const items=filteredListings();
 grid.innerHTML=items.map(item=>`<article class="listing-card">
 <div class="listing-image"><img src="${item.image}" alt="${escapeHTML(item.title)}" loading="lazy" onerror="this.style.opacity='.2';this.alt='Rental photo unavailable'"><span class="image-badge">${escapeHTML(item.badge)}</span><button class="favorite" data-favorite="${item.id}" aria-label="Save ${escapeHTML(item.title)} to favorites">♡</button></div>
 <div class="listing-info"><div class="listing-category">${escapeHTML(item.categoryLabel)}</div><h4>${escapeHTML(item.title)}</h4><div class="listing-location">⌖ ${escapeHTML(item.location)}</div>
 <div class="listing-meta"><span>◷ ${escapeHTML(item.seats)}</span><span>⚙ ${escapeHTML(item.transmission)}</span></div>
 <div class="listing-bottom"><div class="price"><strong>$${item.price}</strong> <small>/ day</small><div class="price-note">Listed daily rate</div></div><button class="details-button" data-details="${item.id}">View details ↗</button></div></div></article>`).join("");
 emptyState.classList.toggle("hidden",items.length>0);
 grid.classList.toggle("hidden",items.length===0);
 resultsText.textContent=`${items.length} ${items.length===1?"rental":"rentals"} found.`;
}
let detailRequest=0;
async function openDetails(id){
 const request=++detailRequest;
 const item=listings.find(x=>String(x.id)===String(id));if(!item)return;

  detailContent.innerHTML = `
    <div id="detailGallery"></div>

    <div class="detail-body">
      <div class="listing-category">
        ${escapeHTML(item.categoryLabel)}
      </div>

      <h2 id="detailTitle">${escapeHTML(item.title)}</h2>

      <div class="listing-location">
        ⌖ ${escapeHTML(item.location)}
      </div>

      <p class="detail-price">
        $${item.price}<small> / day</small>
      </p>

      <p class="detail-description">
        ${escapeHTML(item.description)}
      </p>

      <p class="detail-description">
        <b>Important:</b> Rental availability and details
        must be confirmed with the owner. Online bookings
        and payments are not yet available.
      </p>

      <div class="detail-actions">
        <button class="button button-primary" id="demoBook">
          Booking coming soon
        </button>
        <button class="button button-ghost" id="demoContact">
          Messaging coming soon
        </button>
      </div>
    </div>
  `;
  const gallery=document.getElementById("detailGallery");
  window.FlexiRentGallery.mount(gallery,{title:item.title,cover:item.image});
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  document.getElementById("demoBook").addEventListener("click",()=>showToast("Booking isn't connected yet. Next step: add accounts and a real booking database."));
 document.getElementById("demoContact").addEventListener("click",()=>showToast("Owner messaging isn't connected yet. We'll add it after account setup."));
 try {
  const {data:photos,error}=await window.supabaseClient.from("listing_photos").select("image_url,position").eq("listing_id",item.id).order("position",{ascending:true});
  if(request!==detailRequest)return;
  window.FlexiRentGallery.mount(gallery,{title:item.title,cover:item.image,photos:error?[]:photos||[],unavailable:Boolean(error)});
 }catch{if(request===detailRequest)window.FlexiRentGallery.mount(gallery,{title:item.title,cover:item.image,unavailable:true});}
}
function closeDetails(){++detailRequest;modal.classList.add("hidden");document.body.style.overflow="";}
document.getElementById("searchForm").addEventListener("submit",e=>{e.preventDefault();selectedCategory="all";document.querySelectorAll(".category-pill").forEach(p=>p.classList.toggle("active",p.dataset.category==="all"));render();});
document.getElementById("categoryPills").addEventListener("click",e=>{const pill=e.target.closest("[data-category]");if(!pill)return;selectedCategory=pill.dataset.category;categorySelect.value="all";document.querySelectorAll(".category-pill").forEach(p=>p.classList.toggle("active",p===pill));render();});
categorySelect.addEventListener("change",()=>{selectedCategory="all";document.querySelectorAll(".category-pill").forEach(p=>p.classList.toggle("active",p.dataset.category==="all"));render();});
priceSelect.addEventListener("change",render);sortSelect.addEventListener("change",render);
grid.addEventListener("click",e=>{const detail=e.target.closest("[data-details]");if(detail){openDetails(detail.dataset.details);return;}const favorite=e.target.closest("[data-favorite]");if(favorite){favorite.classList.toggle("saved");favorite.textContent=favorite.classList.contains("saved")?"♥":"♡";showToast(favorite.classList.contains("saved")?"Saved for this demo session":"Removed from demo favorites");}});
document.getElementById("resetFilters").addEventListener("click",()=>{categorySelect.value="all";priceSelect.value="9999";locationInput.value="";sortSelect.value="recommended";selectedCategory="all";document.querySelectorAll(".category-pill").forEach(p=>p.classList.toggle("active",p.dataset.category==="all"));render();});
document.getElementById("closeModal").addEventListener("click",closeDetails);
modal.addEventListener("click",e=>{if(e.target===modal)closeDetails();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDetails();});


document.getElementById("menuToggle").addEventListener("click",()=>{showToast("Use Explore below to browse listings. Mobile navigation will expand in the next pass.");});
document.getElementById("year").textContent=new Date().getFullYear();
loadRealListings();
async function loadRealListings() {
  const client = window.supabaseClient;

  if (!client) {
    resultsText.textContent = "Database connection unavailable.";
    return;
  }

  resultsText.textContent = "Loading available rentals...";

  const { data, error } = await client
    .from("listings")
    .select("id,title,description,category,city,state,price_per_day,image_url")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    resultsText.textContent = "Unable to load rentals.";
    console.error("Listing load failed:", error);
    return;
  }

  listings = (data || []).map(item => ({
    id: item.id,
    title: item.title || "Untitled rental",
    category: item.category || "equipment",
    categoryLabel: item.category || "Rental",
    location: [item.city, item.state].filter(Boolean).join(", "),
    price: Number(item.price_per_day) || 0,
    period: "day",
    seats: "Details available",
    transmission: "Ask owner",
    badge: "AVAILABLE",
    image: item.image_url || "",
    description: item.description || "No description provided."
  }));

  render();
}


