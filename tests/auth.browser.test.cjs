const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs");
(async()=>{
const browser=await chromium.launch({headless:true});
try{
for(const width of [1280,390]){
const page=await browser.newPage({viewport:{width,height:800}});
const errors=[];page.on("pageerror",e=>errors.push(e.message));
await page.setContent('<!doctype html><html><head></head><body><button id="loginButton">Log In</button><button id="signupButton">Sign Up</button></body></html>');
await page.evaluate(()=>{
 window.signups=[];
 const callbacks=[];
 window.supabaseClient={auth:{
 signUp:async payload=>{window.signups.push(payload);return {data:{user:{id:"new-user",email:payload.email,user_metadata:payload.options.data},session:{access_token:"test"}},error:null}},
 signInWithPassword:async()=>({data:{user:{id:"existing",email:"existing@example.com",user_metadata:{account_type:"renter"}}},error:null}),
 signOut:async()=>({error:null}),
 getUser:async()=>({data:{user:null},error:null}),
 onAuthStateChange:cb=>{callbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}}}
 }};
});
await page.addScriptTag({content:fs.readFileSync("auth.js","utf8")});
for(const type of ["renter","owner"]){
await page.locator("#signupButton").click();
assert.equal(await page.locator("#accountType").isVisible(),true);
await page.locator("#accountType").selectOption(type);
await page.locator("#authEmail").fill(type+"@example.com");
await page.locator("#authPassword").fill("test-password-123");
await page.locator("#authSubmit").click();
await page.waitForFunction(expected=>window.signups.some(x=>x.options.data.account_type===expected),type);
assert.equal(await page.locator("#signupButton").innerText(),type==="owner"?"Owner Account":"Renter Account");
await page.locator("#loginButton").click();
}
await page.locator("#loginButton").click();
assert.equal(await page.locator("#accountType").isVisible(),false);
assert.equal(await page.locator("#accountType").isDisabled(),true);
assert.deepEqual(errors,[]);
console.log("PASS "+width+"px: renter and owner signup, role display, login hides role selector");
await page.close();
}
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
