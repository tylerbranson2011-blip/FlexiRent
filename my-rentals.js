(() => {
"use strict";
const client=window.supabaseClient;
if(!client)return;
const button=document.createElement("button");
button.type="button";button.className="button button-ghost";button.id="myRentalsButton";
button.textContent="📋 My Rentals";button.classList.add("account-shortcut");
const shortcuts=document.getElementById("accountShortcuts");
if(shortcuts)shortcuts.appendChild(button);
const shell=document.createElement("div");
shell.className="auth-backdrop";shell.hidden=true;
shell.innerHTML='<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="myRentalsTitle" style="max-width:680px;max-height:90vh;overflow:auto"><button class="auth-close" type="button" aria-label="Close my rentals">×</button><h2 id="myRentalsTitle">My Rentals</h2><p>View your requests and booking history. Payments are not enabled yet.</p><div id="myRentalsContent" aria-live="polite"></div></div>';
document.body.append(shell);
const area=shell.querySelector("#myRentalsContent");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const time=s=>{const m=/^(\d{2}):(\d{2})/.exec(String(s||""));if(!m)return "Time not set";const h=Number(m[1]);return (h%12||12)+":"+m[2]+" "+(h<12?"AM":"PM");};
const date=s=>{if(!s)return "Not set";const parts=String(s).split("-");return parts.length===3?parts[1]+"/"+parts[2]+"/"+parts[0]:s;};
const ownerProfile=document.createElement("div");
ownerProfile.className="auth-backdrop approved-renter-backdrop";ownerProfile.hidden=true;
ownerProfile.innerHTML='<div class="auth-panel approved-renter-panel" role="dialog" aria-modal="true" aria-labelledby="ownerProfileTitle"><button type="button" class="auth-close" aria-label="Close owner profile">×</button><h2 id="ownerProfileTitle">Owner Profile</h2><div id="ownerProfileContent" role="status">Loading...</div><button type="button" class="button button-ghost owner-profile-back">← Back to My Rentals</button></div>';
document.body.appendChild(ownerProfile);
function closeOwnerProfile(){ownerProfile.hidden=true;shell.hidden=false;}
ownerProfile.querySelector(".auth-close").addEventListener("click",closeOwnerProfile);
ownerProfile.querySelector(".owner-profile-back").addEventListener("click",closeOwnerProfile);
ownerProfile.addEventListener("click",e=>{if(e.target===ownerProfile)closeOwnerProfile();});
async function openOwnerProfile(bookingId){
 const body=ownerProfile.querySelector("#ownerProfileContent");
 shell.hidden=true;ownerProfile.hidden=false;body.textContent="Loading owner profile...";
 const {data,error}=await client.rpc("renter_approved_owner_profile",{p_booking:bookingId});
 if(ownerProfile.hidden)return;
 if(error){body.textContent="Unable to open profile: "+error.message;return;}
 const stars=data.average_rating==null?"No ratings yet":Number(data.average_rating).toFixed(1)+" / 5 stars";
 body.innerHTML='<div class="renter-profile-avatar">👤</div><h3>'+esc(data.display_name||"FlexiRent owner")+'</h3><p class="renter-profile-rating">⭐ '+esc(stars)+' ('+Number(data.review_count||0)+' reviews)</p><h4>About owner</h4><p>'+esc(data.bio||"This owner has not added a bio yet.")+'</p><p class="renter-profile-privacy">Email and phone are kept private.</p>';
}
let generation=0;
function close(){generation++;shell.hidden=true;ownerProfile.hidden=true;}
shell.querySelector(".auth-close").onclick=close;
shell.addEventListener("click",e=>{if(e.target===shell)close();});
async function open(){
 const request=++generation;
 const {data:{user},error:authError}=await client.auth.getUser();
 if(request!==generation)return;
 if(authError||!user){alert("Please log in to view My Rentals.");return;}
 shell.hidden=false;area.textContent="Loading your rentals...";
 const {data:bookings,error}=await client.from("booking_requests").select("id,listing_id,start_date,end_date,pickup_time,return_time,booking_timezone,status,expires_at,created_at").eq("renter_id",user.id).order("created_at",{ascending:false});
 if(request!==generation||shell.hidden)return;
 if(error){area.textContent="Unable to load rentals: "+error.message;return;}
 if(!bookings?.length){area.innerHTML="<p>You haven't requested a rental yet. Browse listings to get started!</p>";return;}
 const eligible=await window.FlexiRentReviews?.eligibility(bookings,"renter",user.id)||new Set();
 const ids=[...new Set(bookings.map(b=>b.listing_id).filter(Boolean))];
 const {data:listingData,error:listingError}=ids.length?await client.from("listings").select("id,title,category").in("id",ids):{data:[],error:null};
 if(request!==generation||shell.hidden)return;
 const titles=new Map((listingData||[]).map(l=>[l.id,l]));
 area.innerHTML=(listingError?'<p>Some listing details are temporarily unavailable.</p>':"")+bookings.map(b=>{
 const listing=titles.get(b.listing_id);
 const expired=b.status==="pending"&&b.expires_at&&new Date(b.expires_at)<=new Date();
 const status=expired?"expired":b.status;
 return '<article style="background:#101317;border:1px solid #42434c;border-radius:12px;padding:16px;margin:14px 0">'+
 '<h3 style="margin:0 0 8px">'+esc(listing?.title||"Rental listing")+'</h3>'+
 '<p style="margin:4px 0">Status: <strong>'+esc(status.charAt(0).toUpperCase()+status.slice(1))+'</strong></p>'+
 '<p style="margin:4px 0">Pickup: '+esc(date(b.start_date))+' at '+esc(time(b.pickup_time))+'</p>'+
 '<p style="margin:4px 0">Return: '+esc(date(b.end_date))+' at '+esc(time(b.return_time))+'</p>'+
 (b.booking_timezone?'<p style="margin:4px 0">Time zone: '+esc(b.booking_timezone)+'</p>':'')+
 '<button type="button" class="button button-primary" data-view-listing="'+esc(b.listing_id)+'" style="margin-top:10px">View Listing ↗</button>'+(b.status==="approved"?'<button type="button" class="button button-ghost renter-view-owner" data-owner-booking="'+esc(b.id)+'">👤 View owner profile</button>':'')+ (eligible.has(b.id)?'<button type="button" class="button button-ghost" data-rate-booking="'+esc(b.id)+'">⭐ Rate owner</button>':'')+'</article>';
 }).join("");
}
area.addEventListener("click",async e=>{
 const profile=e.target.closest("[data-owner-booking]");if(profile){await openOwnerProfile(profile.dataset.ownerBooking);return;}
 const rate=e.target.closest("[data-rate-booking]");if(rate){window.FlexiRentReviews?.open(rate.dataset.rateBooking,open);return;}
 const b=e.target.closest("[data-view-listing]");if(!b)return;
 if(!window.FlexiRentListing?.open){area.insertAdjacentHTML("afterbegin","<p>Listing details are unavailable. Refresh the page.</p>");return;}
 close();await window.FlexiRentListing.open(b.dataset.viewListing);
});
button.addEventListener("click",open);
client.auth.onAuthStateChange((_event,session)=>{if(!session?.user)close();});
window.FlexiRentMyRentals={open};
})();