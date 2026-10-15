(() => {
"use strict";
let timer;
const notice=document.createElement("div");
notice.id="flexirentActionNotice";
notice.className="action-notice";
notice.setAttribute("role","status");
notice.setAttribute("aria-live","polite");
notice.hidden=true;
notice.innerHTML='<span class="action-notice-icon" aria-hidden="true"></span><span class="action-notice-text"></span><button type="button" aria-label="Dismiss notification">×</button>';
document.body.appendChild(notice);
notice.querySelector("button").addEventListener("click",()=>{notice.hidden=true;clearTimeout(timer);});
function show(message,type="success"){
 clearTimeout(timer);
 notice.querySelector(".action-notice-icon").textContent=type==="error"?"⚠️":"✓";
 notice.querySelector(".action-notice-text").textContent=String(message||"");
 notice.dataset.type=type;
 notice.hidden=false;
 timer=setTimeout(()=>{notice.hidden=true;},5000);
}
window.FlexiRentNotice={show};
})();