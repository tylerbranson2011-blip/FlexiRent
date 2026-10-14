(() => {
"use strict";
const client=window.supabaseClient;
if(!client)return;
const shell=document.createElement("div");
shell.className="auth-backdrop";shell.hidden=true;shell.style.zIndex="2147483646";
shell.innerHTML='<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="bookingTitle" style="max-width:640px;max-height:90vh;overflow:auto"><button class="auth-close" type="button" aria-label="Close booking">×</button><h2 id="bookingTitle">Availability & Booking</h2><p>Dates use pickup inclusive, return exclusive. No payments are taken.</p><div id="bookingBody"></div><p id="bookingMessage" role="status" aria-live="polite"></p></div>';
document.body.append(shell);
const body=shell.querySelector("#bookingBody"),message=shell.querySelector("#bookingMessage");
let listingId=null,ownerMode=false;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"));
function close(){shell.hidden=true;listingId=null;}
shell.querySelector(".auth-close").onclick=close;
shell.addEventListener("click",e=>{if(e.target===shell)close();});
async function refresh(){
 if(!listingId)return;
 const id=listingId;
 const [b,r]=await Promise.all([
 client.from("listing_blocks").select("id,start_date,end_date").eq("listing_id",id).order("start_date"),
 client.from("booking_requests").select("id,start_date,end_date,status,expires_at,renter_id").eq("listing_id",id).order("created_at",{ascending:false})
 ]);
 if(id!==listingId)return;
 if(b.error||r.error){body.textContent=(b.error||r.error).message;return;}
 const blocks=b.data||[],requests=r.data||[];
 const busy=requests.filter(x=>x.status==="approved"||(x.status==="pending"&&new Date(x.expires_at)>new Date()));
 const dates=[...blocks.map(x=>({id:x.id,start:x.start_date,end:x.end_date,label:"Owner blocked"})),...busy.map(x=>({start:x.start_date,end:x.end_date,label:x.status==="approved"?"Reserved":"Pending request"}))];
 body.innerHTML='<h3>Unavailable dates</h3>'+(dates.length?'<ul>'+dates.map(x=>'<li>'+esc(x.start)+' to '+esc(x.end)+' ('+esc(x.label)+')'+(ownerMode&&x.id?' <button type="button" data-unblock="'+esc(x.id)+'" aria-label="Unblock '+esc(x.start)+' to '+esc(x.end)+'">Unblock dates</button>':'')+'</li>').join("")+'</ul>':'<p>No dates blocked yet.</p>')+
 '<form id="bookingForm"><label>Pickup date <input type="date" name="start" required></label><label>Return date <input type="date" name="end" required></label><button class="button button-primary" type="submit">'+(ownerMode?"Block dates":"Request booking")+'</button></form>'+
 (ownerMode?'<h3>Booking requests</h3>'+(requests.length?requests.map(x=>'<div class="booking-request"><p>'+esc(x.start)+' to '+esc(x.end)+' · '+esc(x.status==="pending"&&new Date(x.expires_at)<=new Date()?"expired":x.status)+'</p>'+(x.status==="pending"&&new Date(x.expires_at)>new Date()?'<button data-respond="'+esc(x.id)+'" data-approve="true">Approve</button> <button data-respond="'+esc(x.id)+'" data-approve="false">Decline</button>':'')+'</div>').join(""):'<p>No requests yet.</p>'):'<p>Owners have 24 hours to approve. Unanswered requests expire automatically.</p>');
 const form=body.querySelector("#bookingForm");
 form.elements.start.min=new Date().toLocaleDateString("en-CA");
 form.elements.end.min=form.elements.start.min;
 form.addEventListener("submit",async e=>{
 e.preventDefault();const start=form.elements.start.value,end=form.elements.end.value;
 if(!date(start)||!date(end)||end<=start){message.textContent="Return must be after pickup.";return;}
 const {data,error}=await client.auth.getUser();if(error||!data?.user){message.textContent="Please log in first.";return;}
 const result=await client.rpc(ownerMode?"block_listing_dates":"request_booking",{p_listing:id,p_start:start,p_end:end});
 message.textContent=result.error?result.error.message:ownerMode?"Dates blocked.":"Request submitted. Owner has 24 hours to respond.";
 if(!result.error)await refresh();
 });
 body.querySelectorAll("[data-unblock]").forEach(button=>button.addEventListener("click",async()=>{
 if(!ownerMode||!confirm("Make these dates available again?"))return;
 button.disabled=true;
 const result=await client.rpc("unblock_listing_dates",{p_block:button.dataset.unblock});
 message.textContent=result.error?"Could not unblock dates: "+result.error.message:"Dates are available again.";
 await refresh();
 }));
 body.querySelectorAll("[data-respond]").forEach(button=>button.addEventListener("click",async()=>{
 const result=await client.rpc("respond_booking",{p_request:button.dataset.respond,p_approve:button.dataset.approve==="true"});
 message.textContent=result.error?result.error.message:"Request updated.";
 await refresh();
 }));
}
async function open(id,asOwner=false){
 const {data,error}=await client.auth.getUser();
 if(error||!data?.user){alert("Please log in to manage bookings.");return;}
 if(asOwner){const own=await client.from("listings").select("id").eq("id",id).eq("owner_id",data.user.id).maybeSingle();if(own.error||!own.data){alert("Not your listing.");return;}}
 listingId=id;ownerMode=asOwner;message.textContent="";shell.hidden=false;body.textContent="Loading availability...";await refresh();
}
window.FlexiRentBooking={open};
})();