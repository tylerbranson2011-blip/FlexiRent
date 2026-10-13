const listings = [
 {id:1,title:"2023 Ford F-150 XLT",category:"truck",categoryLabel:"Pickup truck",location:"Nashville, TN",price:89,period:"day",seats:"5 seats",transmission:"Automatic",badge:"POPULAR PICK",image:"https://images.unsplash.com/photo-1551830820-330a71b99659?auto=format&fit=crop&w=1000&q=85",description:"A versatile pickup for weekend projects, road trips, and hauling everyday gear. Sample listing only; details and availability are fictional."},
 {id:2,title:"2022 Forest River Travel Trailer",category:"trailer",categoryLabel:"Travel trailer",location:"Louisville, KY",price:115,period:"day",seats:"Sleeps 4",transmission:"Towable",badge:"ROAD-TRIP READY",image:"https://images.unsplash.com/photo-1563223771-5fe9a5b6c8b8?auto=format&fit=crop&w=1000&q=85",description:"Make the campground your home base with a comfortable travel-trailer concept listing. Confirm tow capacity and hookup requirements in a real listing."},
 {id:3,title:"2024 Toyota Camry SE",category:"car",categoryLabel:"Sedan",location:"Austin, TX",price:58,period:"day",seats:"5 seats",transmission:"Automatic",badge:"GREAT VALUE",image:"https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1000&q=85",description:"A practical sedan concept for city errands, business travel, or a comfortable weekend away. Sample listing only."},
 {id:4,title:"2021 Jayco Jay Flight",category:"rv",categoryLabel:"Camper",location:"Denver, CO",price:139,period:"day",seats:"Sleeps 6",transmission:"Towable",badge:"FAMILY FAVORITE",image:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=85",description:"A camper-style sample listing for your next outdoors escape. The photo is illustrative and does not verify the listed model."},
 {id:5,title:"2020 Utility Equipment Trailer",category:"trailer",categoryLabel:"Utility trailer",location:"Columbus, OH",price:42,period:"day",seats:"14 ft deck",transmission:"Towable",badge:"WORK-READY",image:"https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1000&q=85",description:"A utility-trailer concept for moving tools, landscaping equipment, and supplies. Check hitch, payload, and tie-down specifications before any real rental."},
 {id:6,title:"2023 Chevrolet Silverado 1500",category:"truck",categoryLabel:"Pickup truck",location:"Phoenix, AZ",price:99,period:"day",seats:"5 seats",transmission:"Automatic",badge:"ROAD-TRIP READY",image:"https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1000&q=85",description:"A full-size pickup sample for travel, towing within rated limits, and project work. Sample listing only; not a bookable vehicle."}
];
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
 <div class="listing-image"><img src="${item.image}" alt="${escapeHTML(item.title)}" loading="lazy" onerror="this.style.opacity='.2';this.alt='Sample vehicle image unavailable'"><span class="image-badge">${escapeHTML(item.badge)}</span><button class="favorite" data-favorite="${item.id}" aria-label="Save ${escapeHTML(item.title)} to favorites">♡</button></div>
 <div class="listing-info"><div class="listing-category">${escapeHTML(item.categoryLabel)}</div><h4>${escapeHTML(item.title)}</h4><div class="listing-location">⌖ ${escapeHTML(item.location)}</div>
 <div class="listing-meta"><span>◷ ${escapeHTML(item.seats)}</span><span>⚙ ${escapeHTML(item.transmission)}</span></div>
 <div class="listing-bottom"><div class="price"><strong>$${item.price}</strong> <small>/ day</small><div class="price-note">Sample price</div></div><button class="details-button" data-details="${item.id}">View details ↗</button></div></div></article>`).join("");
 emptyState.classList.toggle("hidden",items.length>0);
 grid.classList.toggle("hidden",items.length===0);
 resultsText.textContent=`${items.length} sample ${items.length===1?"listing":"listings"} shown. Browse the demo; these aren't real offers.`;
}
function openDetails(id){
 const item=listings.find(x=>x.id===Number(id));if(!item)return;
 detailContent.innerHTML=`<img class="detail-hero" src="${item.image}" alt="${escapeHTML(item.title)}"><div class="detail-body"><div class="listing-category">${escapeHTML(item.categoryLabel)} · SAMPLE LISTING</div><h2 id="detailTitle">${escapeHTML(item.title)}</h2><div class="listing-location">⌖ ${escapeHTML(item.location)}</div><p class="detail-price">$${item.price}<small> / day · illustrative price</small></p><div class="detail-specs"><span>${escapeHTML(item.seats)}</span><span>${escapeHTML(item.transmission)}</span><span>Owner details not connected</span></div><p class="detail-description">${escapeHTML(item.description)}</p><p class="detail-description"><b>Demo notice:</b> This is a prototype. No reservation or payment will be made, and the displayed location, price, vehicle details, and availability are not verified.</p><div class="detail-actions"><button class="button button-primary" id="demoBook">Request a booking <span>↗</span></button><button class="button button-ghost" id="demoContact">Contact owner</button></div></div>`;
 modal.classList.remove("hidden");document.body.style.overflow="hidden";
 document.getElementById("demoBook").addEventListener("click",()=>showToast("Booking isn't connected yet. Next step: add accounts and a real booking database."));
 document.getElementById("demoContact").addEventListener("click",()=>showToast("Owner messaging isn't connected yet. We'll add it after account setup."));
}
function closeDetails(){modal.classList.add("hidden");document.body.style.overflow="";}
document.getElementById("searchForm").addEventListener("submit",e=>{e.preventDefault();selectedCategory="all";document.querySelectorAll(".category-pill").forEach(p=>p.classList.toggle("active",p.dataset.category==="all"));render();});
document.getElementById("categoryPills").addEventListener("click",e=>{const pill=e.target.closest("[data-category]");if(!pill)return;selectedCategory=pill.dataset.category;categorySelect.value="all";document.querySelectorAll(".category-pill").forEach(p=>p.classList.toggle("active",p===pill));render();});
categorySelect.addEventListener("change",()=>{selectedCategory="all";document.querySelectorAll(".category-pill").forEach(p=>p.classList.toggle("active",p.dataset.category==="all"));render();});
priceSelect.addEventListener("change",render);sortSelect.addEventListener("change",render);
grid.addEventListener("click",e=>{const detail=e.target.closest("[data-details]");if(detail){openDetails(detail.dataset.details);return;}const favorite=e.target.closest("[data-favorite]");if(favorite){favorite.classList.toggle("saved");favorite.textContent=favorite.classList.contains("saved")?"♥":"♡";showToast(favorite.classList.contains("saved")?"Saved for this demo session":"Removed from demo favorites");}});
document.getElementById("resetFilters").addEventListener("click",()=>{categorySelect.value="all";priceSelect.value="9999";locationInput.value="";sortSelect.value="recommended";selectedCategory="all";document.querySelectorAll(".category-pill").forEach(p=>p.classList.toggle("active",p.dataset.category==="all"));render();});
document.getElementById("closeModal").addEventListener("click",closeDetails);
modal.addEventListener("click",e=>{if(e.target===modal)closeDetails();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDetails();});
function listPrompt(){showToast("Owner accounts and the $9.99/month listing plan are on the build roadmap. Nothing is charged in this demo.");}
document.getElementById("listTop").addEventListener("click",listPrompt);document.getElementById("listBottom").addEventListener("click",listPrompt);
document.getElementById("menuToggle").addEventListener("click",()=>{showToast("Use Explore below to browse listings. Mobile navigation will expand in the next pass.");});
document.getElementById("year").textContent=new Date().getFullYear();
render();