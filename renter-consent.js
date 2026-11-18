(() => {
"use strict";
const button=document.getElementById("demoBook");
const detail=document.getElementById("detailContent");
if(!detail)return;
const checklist=[
"I understand this is an inquiry, not a reservation or rental agreement.",
"I will verify the owner's authority and the equipment's condition and suitability.",
"I will confirm licenses, towing/operating requirements and insurance coverage, including rental exclusions.",
"I will agree directly with the owner on price, deposits, pickup, return, cancellation and damage.",
"I understand Flexi Rent does not collect rental payments, insure equipment or handle rental refunds.",
"I have read the Renter Agreement and Marketplace Terms."
];
const dialog=document.createElement("div");
dialog.className="auth-backdrop";dialog.hidden=true;
dialog.innerHTML='<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="renterTitle" style="max-height:90vh;overflow:auto;max-width:540px"><button class="auth-close" type="button" aria-label="Close">×</button><h2 id="renterTitle">Before contacting an owner</h2><p>Renters must acknowledge each responsibility. This workflow is not active until secure acceptance records and messaging are enabled.</p><form id="renterCheckForm"></form><p id="renterCheckStatus" role="status"></p></div>';
document.body.appendChild(dialog);
const form=dialog.querySelector("form");
checklist.forEach((label,i)=>{
 const wrapper=document.createElement("label");
 wrapper.style.cssText="display:flex;gap:10px;margin:12px 0;align-items:flex-start";
 const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.required=true;checkbox.name="ack_"+i;
 const text=document.createElement("span");text.textContent=label;
 wrapper.append(checkbox,text);form.appendChild(wrapper);
});
const terms=document.createElement("p");terms.innerHTML='<a href="legal.html#renter" target="_blank" rel="noopener">Renter Agreement</a> · <a href="legal.html#marketplace" target="_blank" rel="noopener">Marketplace Terms</a>';form.appendChild(terms);
const submit=document.createElement("button");submit.type="submit";submit.className="button button-primary";submit.textContent="Continue (not yet available)";submit.disabled=true;form.appendChild(submit);
function close(){dialog.hidden=true;}
dialog.querySelector(".auth-close").addEventListener("click",close);
dialog.addEventListener("click",e=>{if(e.target===dialog)close();});
document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
document.addEventListener("click",e=>{
 if(!e.target.closest("#demoBook"))return;
 e.preventDefault();e.stopImmediatePropagation();
 dialog.hidden=false;form.reset();
},true);
})();