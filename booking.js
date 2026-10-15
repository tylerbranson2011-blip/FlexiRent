(() => {
"use strict";
const client=window.supabaseClient;
if(!client)return;
const shell=document.createElement("div");
shell.className="auth-backdrop";shell.hidden=true;shell.style.zIndex="2147483646";
shell.innerHTML='<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="bookingTitle" style="max-width:640px;max-height:90vh;overflow:auto"><button class="auth-close" type="button" aria-label="Close booking">×</button><h2 id="bookingTitle">Availability & Booking</h2><p>Dates use pickup inclusive, return exclusive. No payments are taken.</p><div id="bookingBody"></div><p id="bookingMessage" role="status" aria-live="polite"></p></div>';
document.body.append(shell);
const body=shell.querySelector("#bookingBody"),message=shell.querySelector("#bookingMessage");
const notify=(text,error=false)=>{message.textContent=text;window.FlexiRentNotice?.show(text,error?"error":"success");};
let listingId=null,ownerMode=false,previousDashboard=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const displayTime=s=>{const m=/^(\d{2}):(\d{2})/.exec(String(s||""));if(!m)return "Time not set";const h=Number(m[1]);return String(h%12||12)+":"+m[2]+" "+(h<12?"AM":"PM");};
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"));
function close(){shell.hidden=true;listingId=null;if(previousDashboard){previousDashboard.hidden=false;previousDashboard=null;}}
shell.querySelector(".auth-close").onclick=close;
shell.addEventListener("click",e=>{if(e.target===shell)close();});
async function refresh(){
 if(!listingId)return;
 const id=listingId;
 const [b,r,a,scheduleResult]=await Promise.all([
 client.from("listing_blocks").select("id,start_date,end_date").eq("listing_id",id).order("start_date"),
 client.from("booking_requests").select("id,start_date,end_date,pickup_time,return_time,booking_timezone,status,expires_at,renter_id").eq("listing_id",id).order("created_at",{ascending:false}),
 client.rpc("listing_unavailable_dates",{p_listing:id}),
 client.from("listing_pickup_hours").select("timezone,open_time,close_time").eq("listing_id",id).maybeSingle()
 ]);
 if(id!==listingId)return;
 if(b.error||r.error||a.error||scheduleResult.error){body.textContent=(b.error||r.error||a.error||scheduleResult.error).message;return;}
 const schedule=scheduleResult.data;
 let published=false;
 if(ownerMode){const state=await client.from("listings").select("status").eq("id",id).maybeSingle();if(state.error){body.textContent=state.error.message;return;}published=state.data?.status==="published";}
 if(id!==listingId)return;
 const blocks=b.data||[],requests=r.data||[];
 const dates=[...blocks.map(x=>({id:x.id,start:x.start_date,end:x.end_date,label:"Owner blocked"})),...(a.data||[]).filter(x=>x.reason==="reserved").map(x=>({start:x.start_date,end:x.end_date,label:"Unavailable"}))];
 body.innerHTML='<h3>Unavailable dates</h3>'+(dates.length?'<ul>'+dates.map(x=>'<li>'+esc(x.start)+' to '+esc(x.end)+' ('+esc(x.label)+')'+(ownerMode&&!published&&x.id?' <button type="button" data-unblock="'+esc(x.id)+'" aria-label="Unblock '+esc(x.start)+' to '+esc(x.end)+'">Unblock dates</button>':'')+'</li>').join("")+'</ul>':'<p>No dates blocked yet.</p>')+
 (ownerMode&&published?'<p role="status"><strong>Availability locked.</strong> Unpublish this listing in Owner Dashboard before changing pickup hours, time zone, or blocked dates. Existing bookings remain.</p><p>Pickup & return hours: '+(schedule?esc(displayTime(schedule.open_time))+' to '+esc(displayTime(schedule.close_time))+' ('+esc(schedule.timezone)+')':'Not configured')+'</p>':ownerMode?'<form id="pickupHoursForm"><h3>Pickup & return hours</h3><label>Time zone <select name="timezone" required><option value="America/New_York">Eastern</option><option value="America/Chicago">Central</option><option value="America/Denver">Mountain</option><option value="America/Phoenix">Arizona</option><option value="America/Los_Angeles">Pacific</option><option value="America/Anchorage">Alaska</option><option value="Pacific/Honolulu">Hawaii</option></select></label><label>Earliest time <input type="time" name="open" step="1800" required></label><label>Latest time <input type="time" name="close" step="1800" required></label><button type="submit" class="button button-primary">Save hours</button></form>':(!schedule?'<p>Owner has not set pickup hours yet. Booking is temporarily unavailable.</p>':'<p>Pickup and return hours: '+esc(displayTime(schedule.open_time))+' to '+esc(displayTime(schedule.close_time))+' ('+esc(schedule.timezone)+')</p>'))+
 (ownerMode&&published?'':'<form id="bookingForm"><label>Pickup date <input type="date" name="start" required></label>'+(!ownerMode?'<label>Pickup time <select name="pickup" required></select></label>':'')+'<label>Return date <input type="date" name="end" required></label>'+(!ownerMode?'<label>Return time <select name="return" required></select></label>':'')+'<button class="button button-primary" type="submit" '+(!ownerMode&&!schedule?'disabled':'')+'>'+(ownerMode?"Block dates":"Request booking")+'</button></form>')+
 (ownerMode?'<h3>Booking requests</h3>'+(requests.length?requests.map(x=>'<div class="booking-request"><p>'+esc(x.start_date)+(x.pickup_time?' at '+esc(displayTime(x.pickup_time)):'')+' to '+esc(x.end_date)+(x.return_time?' at '+esc(displayTime(x.return_time)):'')+(x.booking_timezone?' ('+esc(x.booking_timezone)+')':'')+' · '+esc(x.status==="pending"&&new Date(x.expires_at)<=new Date()?"expired":x.status)+'</p>'+(x.status==="pending"&&new Date(x.expires_at)>new Date()?'<button data-respond="'+esc(x.id)+'" data-approve="true">Approve</button> <button data-respond="'+esc(x.id)+'" data-approve="false">Decline</button>':'')+'</div>').join(""):'<p>No requests yet.</p>'):'<p>Owners have 24 hours to approve. Unanswered requests expire automatically.</p>');
 if(ownerMode&&!published){
  const hours=body.querySelector("#pickupHoursForm");
  hours.elements.timezone.value=schedule?.timezone||"America/New_York";
  hours.elements.open.value=schedule?.open_time?.slice(0,5)||"08:00";
  hours.elements.close.value=schedule?.close_time?.slice(0,5)||"18:00";
  hours.addEventListener("submit",async e=>{
   e.preventDefault();
   const result=await client.rpc("set_listing_pickup_hours",{p_listing:id,p_timezone:hours.elements.timezone.value,p_open:hours.elements.open.value,p_close:hours.elements.close.value});
   notify(result.error?result.error.message:"Pickup hours saved.",Boolean(result.error));
   if(!result.error)await refresh();
  });
 }else if(!ownerMode&&schedule){
  const times=[];
  for(let h=0;h<24;h++)for(let m of [0,30]){
   const t=String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");
   if(t>=schedule.open_time.slice(0,5)&&t<=schedule.close_time.slice(0,5))times.push(t);
  }
  const options='<option value="">Choose a time</option>'+times.map(t=>'<option value="'+t+'">'+new Date("2000-01-01T"+t+":00").toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})+'</option>').join("");
  body.querySelector('[name="pickup"]').innerHTML=options;
  body.querySelector('[name="return"]').innerHTML=options;
 }
 const form=body.querySelector("#bookingForm");
 if(form){
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
 if(!date(start)||!date(end)||end<=start){notify("Return must be after pickup.",true);return;}
 const {data,error}=await client.auth.getUser();if(error||!data?.user){notify("Please log in first.",true);return;}
 const result=await client.rpc(ownerMode?"block_listing_dates":"request_booking_timed",ownerMode?{p_listing:id,p_start:start,p_end:end}:{p_listing:id,p_start:start,p_end:end,p_pickup:form.elements.pickup.value,p_return:form.elements.return.value});
 notify(result.error?result.error.message:ownerMode?"Dates blocked.":"Rental request submitted! Owner has 24 hours to respond.",Boolean(result.error));
 if(!result.error)await refresh();
 });
 }
 body.querySelectorAll("[data-unblock]").forEach(button=>button.addEventListener("click",async()=>{
 if(!ownerMode||!confirm("Make these dates available again?"))return;
 button.disabled=true;
 const result=await client.rpc("unblock_listing_dates",{p_block:button.dataset.unblock});
 notify(result.error?"Could not unblock dates: "+result.error.message:"Dates are available again.",Boolean(result.error));
 await refresh();
 }));
 body.querySelectorAll("[data-respond]").forEach(button=>button.addEventListener("click",async()=>{
 const result=await client.rpc("respond_booking",{p_request:button.dataset.respond,p_approve:button.dataset.approve==="true"});
 notify(result.error?result.error.message:button.dataset.approve==="true"?"Rental approved!":"Rental declined.",Boolean(result.error));
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