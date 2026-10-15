let listings = [];
const grid=document.getElementById("listingGrid");
const categorySelect=document.getElementById("category");
const locationInput=document.getElementById("location");
const distanceRadius=document.getElementById("distanceRadius");
let searchCenter=null,locationSearchActive=false,locationError="";
const geocodeCache=new Map();
let geocodeQueue=Promise.resolve(),lastGeocode=0;
function geocode(place){
 const key=place.trim().toLowerCase();
 if(geocodeCache.has(key))return Promise.resolve(geocodeCache.get(key));
 const job=geocodeQueue.catch(()=>{}).then(async()=>{
  const wait=Math.max(0,1100-(Date.now()-lastGeocode));
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  lastGeocode=Date.now();
  let point=null;
  if(/^\\d{5}$/.test(key)){
   const response=await fetch("https://api.zippopotam.us/us/"+encodeURIComponent(key));
   if(response.ok){const result=await response.json();const first=result.places?.[0];if(first)point={lat:Number(first.latitude),lon:Number(first.longitude)};}
  }else{
   const response=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q="+encodeURIComponent(place));
   if(!response.ok)throw Error("Location lookup unavailable");
   const result=await response.json();if(result[0])point={lat:Number(result[0].lat),lon:Number(result[0].lon)};
  }
  geocodeCache.set(key,point);return point;
 });
 geocodeQueue=job.catch(()=>{});return job;
}
function milesBetween(a,b){const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;const v=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;return 3958.7613*2*Math.asin(Math.min(1,Math.sqrt(v)));}
async function runLocationSearch(){
 const term=locationInput.value.trim();const radius=distanceRadius.value;
 locationSearchActive=Boolean(term&&radius!=="all");searchCenter=null;locationError="";
 if(!locationSearchActive){render();return;}
 resultsText.textContent="Finding rentals near "+term+"...";
 try{
  const center=await geocode(term);
  if(!center){locationError="Location not found. Enter a US ZIP code or city and state.";render();return;}
  searchCenter=center;
  for(const item of listings){if(item.coords)continue;try{item.coords=await geocode(item.location+", USA");}catch{item.coords=null;}}
 }catch{locationError="Distance lookup unavailable. Please try again.";}
 render();
}

const priceSelect=document.getElementById("price");
const rateType=document.getElementById("rateType");
const operatorFilter=document.getElementById("operatorFilter");
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
function displayRate(item){return rateType.value==="hour"?item.hourlyPrice:item.price;}
function priceMatches(item,max){if(rateType.value==="any")return item.price<=max||(item.hourlyPrice!=null&&item.hourlyPrice<=max);const value=displayRate(item);return value!=null&&value<=max;}
function filteredListings(){
 const cat=categorySelect.value;
 const max=Number(priceSelect.value);
 const loc=locationInput.value.trim().toLowerCase();
 let result=listings.filter(item=>(cat==="all"||item.category===cat)&&(selectedCategory==="all"||item.category===selectedCategory)&&priceMatches(item,max)&&(operatorFilter.value==="all"||item.operatorOption===operatorFilter.value)&&(!locationSearchActive||(searchCenter&&item.coords&&milesBetween(searchCenter,item.coords)<=Number(distanceRadius.value))));
 if(sortSelect.value==="low")result.sort((a,b)=>(rateType.value==="hour"?a.hourlyPrice:a.price)-(rateType.value==="hour"?b.hourlyPrice:b.price));
 if(sortSelect.value==="high")result.sort((a,b)=>(rateType.value==="hour"?b.hourlyPrice:b.price)-(rateType.value==="hour"?a.hourlyPrice:a.price));
 return result;
}
function render(){
 const items=filteredListings();
 grid.innerHTML=items.map(item=>`<article class="listing-card">
 <div class="listing-image"><img src="${item.image}" alt="${escapeHTML(item.title)}" loading="lazy" onerror="this.style.opacity='.2';this.alt='Rental photo unavailable'"><span class="image-badge">${escapeHTML(item.badge)}</span><button class="favorite" data-favorite="${item.id}" aria-label="Save ${escapeHTML(item.title)} to favorites">♡</button></div>
 <div class="listing-info"><div class="listing-category">${escapeHTML(item.categoryLabel)}</div><h4>${escapeHTML(item.title)}</h4><div class="listing-location">⌖ ${escapeHTML(item.location)}${locationSearchActive&&searchCenter&&item.coords?" · "+Math.round(milesBetween(searchCenter,item.coords))+" mi away":""}</div>
 <div class="listing-meta"><span>◷ ${escapeHTML(item.seats)}</span><span>⚙ ${escapeHTML(item.operatorLabel)}</span></div>
 <div class="listing-bottom"><div class="price"><strong>${rateType.value==="hour"?item.hourlyPrice:item.price}</strong> <small>/ ${rateType.value==="hour"?"hour":"day"}</small>${rateType.value==="any"&&item.hourlyPrice!=null?`<div class="price-note">${item.hourlyPrice} / hour also available</div>`:`<div class="price-note">Listed ${rateType.value==="hour"?"hourly":"daily"} rate</div>`}</div><button class="details-button" data-details="${item.id}">View details ↗</button></div></div></article>`).join("");
 emptyState.classList.toggle("hidden",items.length>0);
 grid.classList.toggle("hidden",items.length===0);
 resultsText.textContent=locationError||`${items.length} ${items.length===1?"rental":"rentals"} found.${locationSearchActive?" Within "+distanceRadius.value+" miles (straight-line distance).":""}`;
}
let detailRequest=0;
async function openDetails(id){
 const request=++detailRequest;
 let item=listings.find(x=>String(x.id)===String(id));
 if(!item){
  const {data:record,error}=await window.supabaseClient.from("listings").select("id,owner_id,title,description,category,city,state,price_per_day,price_per_hour,operator_option,image_url,status").eq("id",id).maybeSingle();
  if(request!==detailRequest)return false;
  if(error||!record){showToast("Listing details are unavailable.");return false;}
  const names={trailer:"Trailers",rv:"Campers",equipment:"Heavy Equipment",light_equipment:"Light Equipment",boat:"Boats",jetski:"Jet Skis / PWCs",paddlecraft:"Kayaks, Canoes & Paddleboards"};
  item={id:record.id,ownerId:record.owner_id,title:record.title||"Rental listing",categoryLabel:names[record.category]||"Rental",location:[record.city,record.state].filter(Boolean).join(", "),price:Number(record.price_per_day)||0,hourlyPrice:record.price_per_hour==null?null:Number(record.price_per_hour),operatorLabel:({without_operator:"Without operator",operator_available:"Operator available on request",operator_required:"Operator required"})[record.operator_option]||"Without operator",description:record.description||"No description provided.",image:record.image_url||""};
 }


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
        ${item.price}<small> / day</small>${item.hourlyPrice!=null?`<p>${item.hourlyPrice} / hour</p>`:""}<p>${escapeHTML(item.operatorLabel)}</p>
      </p>

      <p class="detail-description">
        ${escapeHTML(item.description)}
      </p>

      <p class="detail-description">
        <b>Important:</b> Rental availability and details
        must be confirmed with the owner. Payments are not yet available.
      </p>

      <div class="listing-owner-link"><button type="button" class="button button-ghost" id="viewListingOwner">👤 View owner profile & listings ↗</button></div>\n      <div class="detail-actions">
        <button class="button button-primary" id="demoBook">
          Request booking
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
  document.getElementById("viewListingOwner").addEventListener("click",async()=>{const opener=window.FlexiRentOwnerProfile?.open;if(!opener){showToast("Owner storefront is unavailable. Please refresh.");return;}let ownerId=item.ownerId;if(!ownerId){const lookup=await window.supabaseClient.from("listings").select("owner_id").eq("id",item.id).maybeSingle();ownerId=lookup.data?.owner_id;}if(!ownerId){showToast("Could not identify this listing owner.");return;}try{const opened=await opener(ownerId);if(opened)closeDetails();else showToast("Unable to open owner storefront. Please try again.");}catch(error){console.error("Owner storefront failed",error);showToast("Owner storefront failed to load.");}});
  document.getElementById("demoBook").addEventListener("click",()=>{closeDetails();window.FlexiRentBooking?.open(item.id);});
 document.getElementById("demoContact").addEventListener("click",()=>showToast("Owner messaging isn't connected yet. We'll add it after account setup."));
 try {
  const {data:photos,error}=await window.supabaseClient.from("listing_photos").select("image_url,position").eq("listing_id",item.id).order("position",{ascending:true});
  if(request!==detailRequest)return;
  window.FlexiRentGallery.mount(gallery,{title:item.title,cover:item.image,photos:error?[]:photos||[],unavailable:Boolean(error)});
 }catch{if(request===detailRequest)window.FlexiRentGallery.mount(gallery,{title:item.title,cover:item.image,unavailable:true});}
 return true;
}
window.FlexiRentListing={open:openDetails};
function closeDetails(){++detailRequest;modal.classList.add("hidden");document.body.style.overflow="";}
document.getElementById("searchForm").addEventListener("submit",e=>{e.preventDefault();selectedCategory="all";document.querySelectorAll(".category-pill").forEach(p=>p.classList.toggle("active",p.dataset.category==="all"));runLocationSearch();});
document.getElementById("categoryPills").addEventListener("click",e=>{const pill=e.target.closest("[data-category]");if(!pill)return;selectedCategory=pill.dataset.category;categorySelect.value="all";document.querySelectorAll(".category-pill").forEach(p=>p.classList.toggle("active",p===pill));render();});
categorySelect.addEventListener("change",()=>{selectedCategory="all";document.querySelectorAll(".category-pill").forEach(p=>p.classList.toggle("active",p.dataset.category==="all"));render();});
distanceRadius.addEventListener("change",runLocationSearch);priceSelect.addEventListener("change",render);rateType.addEventListener("change",render);operatorFilter.addEventListener("change",render);sortSelect.addEventListener("change",render);
grid.addEventListener("click",e=>{const detail=e.target.closest("[data-details]");if(detail){openDetails(detail.dataset.details);return;}const favorite=e.target.closest("[data-favorite]");if(favorite){favorite.classList.toggle("saved");favorite.textContent=favorite.classList.contains("saved")?"♥":"♡";showToast(favorite.classList.contains("saved")?"Saved for this demo session":"Removed from demo favorites");}});
document.getElementById("resetFilters").addEventListener("click",()=>{categorySelect.value="all";priceSelect.value="9999";rateType.value="any";operatorFilter.value="all";locationInput.value="";distanceRadius.value="50";searchCenter=null;locationSearchActive=false;locationError="";sortSelect.value="recommended";selectedCategory="all";document.querySelectorAll(".category-pill").forEach(p=>p.classList.toggle("active",p.dataset.category==="all"));render();});
document.getElementById("closeModal").addEventListener("click",closeDetails);
modal.addEventListener("click",e=>{if(e.target===modal)closeDetails();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDetails();});



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
    .select("id,owner_id,title,description,category,city,state,price_per_day,price_per_hour,operator_option,image_url")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    resultsText.textContent = "Unable to load rentals.";
    console.error("Listing load failed:", error);
    return;
  }

  const supportedCategories=new Set(["trailer","rv","equipment","light_equipment","boat","jetski","paddlecraft"]);
  const categoryNames={trailer:"Trailers",rv:"Campers",equipment:"Heavy Equipment",light_equipment:"Light Equipment",boat:"Boats",jetski:"Jet Skis / PWCs",paddlecraft:"Kayaks, Canoes & Paddleboards"};
  listings = (data || []).filter(item=>supportedCategories.has(item.category)).map(item => ({
    id: item.id,
    title: item.title || "Untitled rental",
    category: item.category || "equipment",
    categoryLabel: categoryNames[item.category] || "Rental",
    location: [item.city, item.state].filter(Boolean).join(", "),
    price: Number(item.price_per_day) || 0,
    hourlyPrice: item.price_per_hour==null?null:Number(item.price_per_hour),
    operatorOption: item.operator_option||"without_operator",
    operatorLabel: ({without_operator:"Without operator",operator_available:"Operator available on request",operator_required:"Operator required"})[item.operator_option]||"Without operator",
    period: "day",
    seats: "Details available",
    transmission: "Ask owner",
    badge: "AVAILABLE",
    image: item.image_url || "",
    description: item.description || "No description provided."
  }));

  if(locationSearchActive)await runLocationSearch();else render();
}


