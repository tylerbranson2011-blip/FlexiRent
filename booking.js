(() => {
"use strict";
const client=window.supabaseClient;
if(!client)return;
const shell=document.createElement("div");
shell.className="auth-backdrop";shell.hidden=true;shell.style.zIndex="2147483646";
shell.innerHTML='<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="bookingTitle" style="max-width:640px;max-height:90vh;overflow:auto"><button class="auth-close" type="button" aria-label="Close booking">×</button><h2 id="bookingTitle">Availability & Booking</h2><p>Dates use pickup inclusive, return exclusive. No payments are taken.</p><div id="bookingBody"></div><p id="bookingMessage" role="status" aria-live="polite"></p></div>';
document.body.append(shell);
const body=shell.querySelector("#bookingBody"),message=shell.querySelector("#bookingMessage");
let listingId=null,ownerMode=false,previousDashboard=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"));
function close(){shell.hidden=true;listingId=null;if(previousDashboard){previousDashboard.hidden=false;previousDashboard=null;}}
shell.querySelector(".auth-close").onclick=close;
shell.addEventListener("click",e=>{if(e.target===shell)close();});
async function refresh(){
 if(!listingId)return;
 const id=listingId;
 const [b,r,a]=await Promise.all([
 client.from("listing_blocks").select("id,start_date,end_date").eq("listing_id",id).order("start_date"),
 client.from("booking_requests").select("id,start_date,end_date,status,expires_at,renter_id").eq("listing_id",id).order("created_at",{ascending:false}),
 client.rpc("listing_unavailable_dates",{p_listing:id})
 ]);
 if(id!==listingId)return;
 if(b.error||r.error||a.error){body.textContent=(b.error||r.error||a.error).message;return;}
 const blocks=b.data||[],requests=r.data||[];
 const dates=[...blocks.map(x=>({id:x.id,start:x.start_date,end:x.end_date,label:"Owner blocked"})),...(a.data||[]).filter(x=>x.reason==="reserved").map(x=>({start:x.start_date,end:x.end_date,label:"Unavailable"}))];
 body.innerHTML='<h3>Unavailable dates</h3>'+(dates.length?'<ul>'+dates.map(x=>'<li>'+esc(x.start)+' to '+esc(x.end)+' ('+esc(x.label)+')'+(ownerMode&&x.id?' <button type="button" data-unblock="'+esc(x.id)+'" aria-label="Unblock '+esc(x.start)+' to '+esc(x.end)+'">Unblock dates</button>':'')+'</li>').join("")+'</ul>':'<p>No dates blocked yet.</p>')+
 '<form id="bookingForm"><label>Pickup date <input type="date" name="start" required></label><label>Return date <input type="date" name="end" required></label><button class="button button-primary" type="submit">'+(ownerMode?"Block dates":"Request booking")+'</button></form>'+
 (ownerMode?'<h3>Booking requests</h3>'+(requests.length?requests.map(x=>'<div class="booking-request"><p>'+esc(x.start_date)+' to '+esc(x.end_date)+' · '+esc(x.status==="pending"&&new Date(x.expires_at)<=new Date()?"expired":x.status)+'</p>'+(x.status==="pending"&&new Date(x.expires_at)>new Date()?'<button data-respond="'+esc(x.id)+'" data-approve="true">Approve</button> <button data-respond="'+esc(x.id)+'" data-approve="false">Decline</button>':'')+'</div>').join(""):'<p>No requests yet.</p>'):'<p>Owners have 24 hours to approve. Unanswered requests expire automatically.</p>');
 const form=body.querySelector("#bookingForm");
 if(!ownerMode){
  const unavailable=(a.data||[]).map(x=>({start:x.start_date,end:x.end_date}));
  const today=new Date();today.setHours(0,0,0,0);
  const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  const addDay=d=>{const n=new Date(d);n.setDate(n.getDate()+1);return n;};
  const blocked=d=>unavailable.some(x=>iso(d)>=x.start&&iso(d)<x.end);
  const inputs=[form.elements.start,form.elements.end];
  let selectedStart=null;
  inputs.forEach((input,index)=>{
   input.type="text";input.readOnly=true;input.placeholder="Tap to choose a date";input.autocomplete="off";
   input.setAttribute("aria-label",index?"Choose return date":"Choose pickup date");
   const picker=document.createElement("div");picker.className="booking-calendar";picker.hidden=true;
   input.insertAdjacentElement("afterend",picker);
   let month=new Date(today.getFullYear(),today.getMonth(),1);
   function render(){
    const first=new Date(month.getFullYear(),month.getMonth(),1);
    const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    const startDay=first.getDay();
    const cells=Array.from({length:startDay},()=>'<span></span>');
    for(let day=1;day<=count;day++){
     const d=new Date(month.getFullYear(),month.getMonth(),day),value=iso(d);
     const invalid=d<today||blocked(d)||(index===1&&(!selectedStart||d<=selectedStart||(()=>{for(let p=addDay(selectedStart);p<d;p=addDay(p))if(blocked(p))return true;return false;})()));
     cells.push('<button type="button" data-date="'+value+'" '+(invalid?'disabled':'')+' aria-label="'+value+'">'+day+'</button>');
    }
    picker.innerHTML='<div class="booking-calendar-header"><button type="button" data-month="-1" aria-label="Previous month">‹</button><strong>'+month.toLocaleDateString(undefined,{month:"long",year:"numeric"})+'</strong><button type="button" data-month="1" aria-label="Next month">›</button></div><div class="booking-calendar-grid">'+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>'<b>'+x+'</b>').join("")+cells.join("")+'</div><small>Unavailable dates are disabled.</small>';
    picker.querySelectorAll("[data-month]").forEach(b=>b.onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+Number(b.dataset.month),1);render();});
    picker.querySelectorAll("[data-date]").forEach(b=>b.onclick=()=>{
     input.value=b.dataset.date;
     if(index===0){selectedStart=new Date(b.dataset.date+"T12:00:00");inputs[1].value="";}
     picker.hidden=true;
     if(index===0)inputs[1].click();
    });
   }
   input.addEventListener("click",()=>{inputs.forEach(el=>{const p=el.nextElementSibling;if(p!==picker&&p?.classList.contains("booking-calendar"))p.hidden=true;});picker.hidden=!picker.hidden;if(!picker.hidden)render();});
  });
 }

 form.elements.start.min=[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,"0"),String(new Date().getDate()).padStart(2,"0")].join("-");
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
 if(previousDashboard){previousDashboard.hidden=false;previousDashboard=null;}
 previousDashboard=asOwner?document.querySelector('[aria-label="Close dashboard"]')?.closest(".auth-backdrop"):null;
 if(previousDashboard)previousDashboard.hidden=true;
 listingId=id;ownerMode=asOwner;message.textContent="";shell.hidden=false;body.textContent="Loading availability...";await refresh();
}
window.FlexiRentBooking={open};
})();