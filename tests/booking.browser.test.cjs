const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
 const page=await browser.newPage({viewport});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.setContent('<!doctype html><html><body><div class="auth-backdrop" id="dashboard"><button aria-label="Close dashboard">Close</button></div></body></html>');
 await page.evaluate(()=>{
  const state={blocks:[],requests:[],calls:[],role:"owner"};
  window.testState=state;
  const query=(table)=>({
   select(){return this},eq(){return this},order(){return Promise.resolve({data:table==="listing_blocks"?state.blocks:state.role==="owner"?state.requests:[],error:null})},
   maybeSingle(){return Promise.resolve({data:{id:"listing-1"},error:null})}
  });
  window.supabaseClient={
   auth:{getUser:async()=>({data:{user:{id:state.role}},error:null})},
   from:query,
   rpc:async(name,args)=>{
    state.calls.push({name,args});
    if(name==="listing_unavailable_dates")return {data:state.blocks.map(b=>({start_date:b.start_date,end_date:b.end_date,reason:"blocked"})).concat(state.requests.filter(r=>r.status==="pending"||r.status==="approved").map(r=>({start_date:r.start_date,end_date:r.end_date,reason:"reserved"}))),error:null};
    if(name==="block_listing_dates"){state.blocks.push({id:"block-1",start_date:args.p_start,end_date:args.p_end});return {data:"block-1",error:null}}
    if(name==="unblock_listing_dates"){state.blocks=[];return {data:null,error:null}}
    if(name==="request_booking"){state.requests.push({id:"request-1",start_date:args.p_start,end_date:args.p_end,status:"pending",expires_at:"2099-01-01T00:00:00Z",renter_id:"renter"});return {data:"request-1",error:null}}
    if(name==="respond_booking"){state.requests[0].status=args.p_approve?"approved":"declined";return {data:null,error:null}}
    return {data:null,error:new Error("unexpected rpc "+name)};
   }
  };
 });
 await page.addScriptTag({content:fs.readFileSync("booking.js","utf8")});
 await page.evaluate(()=>window.FlexiRentBooking.open("listing-1",true));
 await page.locator('input[name="start"]').fill("2026-12-01");
 await page.locator('input[name="end"]').fill("2026-12-03");
 await page.getByRole("button",{name:"Block dates"}).click();
 await page.getByText("Owner blocked").waitFor();
 assert.equal(await page.locator("#dashboard").isVisible(),false,"dashboard should hide behind booking dialog");
 page.on("dialog",dialog=>dialog.accept());
 await page.getByRole("button",{name:/Unblock/}).click();
 await page.getByText("No dates blocked yet.").waitFor();
 await page.getByRole("button",{name:"Close booking"}).click();
 assert.equal(await page.locator("#dashboard").isVisible(),true,"dashboard should reopen");
 await page.evaluate(()=>window.testState.role="renter");
 await page.evaluate(()=>window.FlexiRentBooking.open("listing-1",false));
 await page.locator('input[name="start"]').fill("2026-12-10");
 await page.locator('input[name="end"]').fill("2026-12-12");
 await page.getByRole("button",{name:"Request booking"}).click();
 await page.getByText("Unavailable dates",{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.testState.requests.length),1,"renter booking request should be created");
 assert.equal(await page.evaluate(()=>window.testState.calls.some(x=>x.name==="request_booking")),true,"request_booking RPC should run");
 await page.evaluate(()=>window.testState.role="owner");
 await page.getByRole("button",{name:"Close booking"}).click();
 await page.evaluate(()=>window.FlexiRentBooking.open("listing-1",true));
 await page.getByRole("button",{name:"Approve"}).click();
 assert.equal(await page.evaluate(()=>window.testState.requests[0].status),"approved");
 assert.deepEqual(errors,[],"no browser JavaScript errors");
 await page.close();
 console.log("Booking browser checks passed for "+viewport.width+"px");
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
