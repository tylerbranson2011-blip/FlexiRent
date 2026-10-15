(()=>{"use strict";
const client=window.supabaseClient;if(!client)return;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const panel=document.createElement("div");panel.className="auth-backdrop public-owner-backdrop";panel.hidden=true;
panel.innerHTML='<div class="auth-panel public-owner-panel" role="dialog" aria-modal="true" aria-labelledby="publicOwnerTitle"><button type="button" class="auth-close" aria-label="Close owner profile">×</button><h2 id="publicOwnerTitle">Owner storefront</h2><div id="publicOwnerContent" aria-live="polite"></div></div>';
document.body.appendChild(panel);
const body=panel.querySelector("#publicOwnerContent");let generation=0;
function close(){generation++;panel.hidden=true;}
panel.querySelector(".auth-close").addEventListener("click",close);
panel.addEventListener("click",e=>{if(e.target===panel)close();});
panel.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
async function open(ownerId){
 if(!/^[0-9a-f-]{36}$/i.test(String(ownerId||"")))return false;
 const request=++generation;panel.hidden=false;body.textContent="Loading owner storefront...";
 const [profileResult,listingsResult]=await Promise.all([
 client.rpc("get_public_profile",{p_user_id:ownerId}),
 client.from("listings").select("id,title,category,city,state,price_per_day,image_url").eq("owner_id",ownerId).eq("status","published").order("created_at",{ascending:false})
 ]);
 if(request!==generation||panel.hidden)return false;
 if(profileResult.error||!profileResult.data){body.textContent="This owner profile is unavailable.";return true;}
 const p=profileResult.data;
 const contact=(p.email?'<p>✉️ <a href="mailto:'+encodeURIComponent(p.email)+'">'+esc(p.email)+'</a></p>':'')+(p.phone?'<p>📞 '+esc(p.phone)+'</p>':'');
 const items=listingsResult.data||[];
 body.innerHTML='<div class="public-owner-intro"><div class="renter-profile-avatar">👤</div><h3>'+esc(p.display_name||"FlexiRent owner")+'</h3>'+(p.bio?'<p>'+esc(p.bio)+'</p>':'')+contact+'</div><h3>Published rentals ('+items.length+')</h3>'+(listingsResult.error?'<p>Unable to load owner listings.</p>':items.length?'<div class="public-owner-listings">'+items.map(item=>'<article class="public-owner-card">'+(item.image_url?'<img src="'+esc(item.image_url)+'" alt="" loading="lazy">':'')+'<div><strong>'+esc(item.title)+'</strong><p>'+esc([item.city,item.state].filter(Boolean).join(", "))+'</p><p>$'+Number(item.price_per_day).toFixed(2)+' / day</p><button type="button" class="button button-primary" data-owner-listing="'+esc(item.id)+'">View listing ↗</button></div></article>').join("")+'</div>':'<p>No published listings right now.</p>');
}
body.addEventListener("click",async e=>{const btn=e.target.closest("[data-owner-listing]");if(!btn)return;const id=btn.dataset.ownerListing;close();if(window.FlexiRentListing?.open)window.FlexiRentListing.open(id);});
window.FlexiRentOwnerProfile={open,close};
})();