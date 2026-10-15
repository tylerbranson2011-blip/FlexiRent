(() => {
"use strict";
const client=window.supabaseClient;if(!client)return;
const style=document.createElement("style");
style.textContent=".fr-notify-bell{position:fixed;right:16px;bottom:20px;z-index:2147483000;background:#a855f7;color:#111;border:0;border-radius:999px;padding:12px 16px;font-weight:800;box-shadow:0 4px 24px #0008}.fr-notify-bell[hidden],.fr-notify-panel[hidden]{display:none!important}.fr-notify-panel{position:fixed;right:12px;bottom:78px;z-index:2147483001;width:min(420px,calc(100vw - 24px));max-height:65vh;overflow:auto;background:#191b22;color:white;border:1px solid #555;border-radius:16px;padding:20px;box-shadow:0 10px 45px #000b}.fr-notify-item{padding:14px 0;border-bottom:1px solid #444}.fr-notify-item small{display:block;color:#b9b9c6}.fr-notify-item button,.fr-notify-panel button{cursor:pointer}.fr-notify-item button{background:#a855f7;border:0;border-radius:6px;padding:6px 10px;margin-top:6px}";
document.head.append(style);
const bell=document.createElement("button");bell.type="button";bell.className="fr-notify-bell";bell.textContent="🔔 Notifications";bell.hidden=true;bell.setAttribute("aria-label","Open notifications");
const panel=document.createElement("section");panel.className="fr-notify-panel";panel.hidden=true;panel.setAttribute("aria-label","Notification center");panel.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><h2 style="margin:0">Notifications</h2><button type="button" id="frNotifyClose" aria-label="Close notifications">✕</button></div><div id="frNotifyItems" role="status">Loading...</div>';
document.body.append(bell,panel);
const items=panel.querySelector("#frNotifyItems");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let userId=null,channel=null;
async function load(){
 if(!userId)return;
 const {data,error}=await client.from("notifications").select("id,booking_id,kind,title,message,is_read,created_at").order("created_at",{ascending:false}).limit(50);
 if(error){items.textContent="Unable to load notifications: "+error.message;return;}
 const unread=(data||[]).filter(n=>!n.is_read).length;
 bell.textContent="🔔 Notifications"+(unread?" ("+unread+")":"");
 items.innerHTML=(data||[]).length?(data||[]).map(n=>'<article class="fr-notify-item" role="button" tabindex="0" data-open="'+esc(n.id)+'" aria-label="Open '+esc(n.title)+'"><strong>'+esc(n.title)+(n.is_read?"":" • New")+'</strong><p>'+esc(n.message)+'</p><small>'+esc(new Date(n.created_at).toLocaleString())+'</small>'+(n.is_read?"":'<button type="button" data-read="'+esc(n.id)+'">Mark as read</button>')+'</article>').join(""):"<p>No notifications yet.</p>";
 items.querySelectorAll("[data-open]").forEach(el=>{
  const activate=async()=>{
   const n=(data||[]).find(x=>x.id===el.dataset.open);
   if(!n)return;
   if(!n.is_read){const {error:readError}=await client.from("notifications").update({is_read:true}).eq("id",n.id);if(readError)console.warn("Could not mark notification as read",readError);}
   if(!n.booking_id){items.textContent="This notification has no linked booking.";return;}
   const {data:booking,error:bookingError}=await client.from("booking_requests").select("listing_id").eq("id",n.booking_id).maybeSingle();
   if(bookingError||!booking?.listing_id){items.textContent="Unable to open this booking. It may no longer be available.";return;}
   const ownerNotification=n.kind==="booking_requested";
   if(ownerNotification&&!window.FlexiRentBooking?.open){items.textContent="Booking screen is unavailable. Please refresh.";return;}
   if(!ownerNotification&&!window.FlexiRentListing?.open){items.textContent="Listing details are unavailable. Please refresh.";return;}
   panel.hidden=true;
   if(ownerNotification)await window.FlexiRentBooking.open(booking.listing_id,true);
   else await window.FlexiRentListing.open(booking.listing_id);
   await load();
  };
  el.addEventListener("click",e=>{if(e.target.closest("[data-read]"))return;activate();});
  el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();activate();}});
 });
 items.querySelectorAll("[data-read]").forEach(b=>b.onclick=async()=>{b.disabled=true;const {error}=await client.from("notifications").update({is_read:true}).eq("id",b.dataset.read);if(error){b.disabled=false;items.textContent=error.message;}else await load();});
}
async function sync(){
 const {data:{user}}=await client.auth.getUser();
 const next=user?.id||null;
 if(next===userId)return;
 if(channel){await client.removeChannel(channel);channel=null;}
 userId=next;bell.hidden=!userId;panel.hidden=true;
 if(!userId)return;
 await load();
 channel=client.channel("notifications-"+userId).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:"recipient_id=eq."+userId},()=>load()).subscribe();
}
bell.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden)load();};
panel.querySelector("#frNotifyClose").onclick=()=>panel.hidden=true;
client.auth.onAuthStateChange(()=>{setTimeout(sync,0);});
sync();
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&userId)load();});
setInterval(()=>{if(userId)load();},30000);
})();