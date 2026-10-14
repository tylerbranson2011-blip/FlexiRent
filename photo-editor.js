(() => {
"use strict";
const client=window.supabaseClient;
if(!client)return;
const editor=document.createElement("div");
editor.className="auth-backdrop";
editor.hidden=true;
editor.style.zIndex="2147483647";
let dashboardBackdrop=null;
editor.innerHTML=`<div class="auth-panel photo-editor-panel" role="dialog" aria-modal="true" aria-labelledby="photoEditorTitle">
<button type="button" class="auth-close" aria-label="Close photo editor">×</button>
<h2 id="photoEditorTitle">Edit Photos</h2>
<p>Add or remove photos, or choose the main listing photo. Maximum 10 photos, 5 MB each.</p>
<div id="photoEditorGrid" class="photo-editor-grid"></div>
<label for="photoEditorUpload">Add photos</label>
<input id="photoEditorUpload" type="file" multiple accept="image/jpeg,image/png,image/webp">
<button type="button" id="photoEditorAdd" class="button button-primary">Upload selected photos</button>
<p id="photoEditorMessage" role="status" aria-live="polite"></p>
</div>`;
document.body.append(editor);
const grid=editor.querySelector("#photoEditorGrid"),input=editor.querySelector("#photoEditorUpload"),message=editor.querySelector("#photoEditorMessage"),add=editor.querySelector("#photoEditorAdd");
let current=null,busy=false,photos=[],cover=null,owner=null,sequence=0;
const valid=url=>{try{return typeof url==="string"&&["https:","http:"].includes(new URL(url).protocol)}catch{return false}};
function close(){if(busy)return;sequence++;editor.hidden=true;if(dashboardBackdrop){dashboardBackdrop.hidden=false;dashboardBackdrop=null;}current=null;input.value="";}
function render(){
grid.replaceChildren();
const ordered=[...photos].sort((a,b)=>a.position-b.position);
const entries=ordered.map(p=>({url:p.image_url,id:p.id,position:p.position}));
if(valid(cover)&&!entries.some(p=>p.url===cover))entries.unshift({url:cover,id:null});
if(!entries.length){const empty=document.createElement("p");empty.textContent="No photos yet. Upload one below.";grid.append(empty);}
for(const entry of entries){
 const tile=document.createElement("div");tile.className="photo-editor-tile";
 const img=document.createElement("img");img.src=entry.url;img.alt="Listing photo";
 const controls=document.createElement("div");controls.className="photo-editor-actions";
 const main=document.createElement("button");main.type="button";main.textContent=entry.url===cover?"Main photo ✓":"Make main";main.disabled=busy||entry.url===cover;main.addEventListener("click",()=>setMain(entry.url));
 const remove=document.createElement("button");remove.type="button";remove.textContent="Remove";remove.disabled=busy;remove.addEventListener("click",()=>removePhoto(entry));
 controls.append(main,remove);tile.append(img,controls);grid.append(tile);
}
add.disabled=busy;
}
async function verify(){const {data,error}=await client.auth.getUser();if(error||!data?.user||data.user.id!==owner)throw Error("Please sign in again.");}
async function load(id,token){
const {data:listing,error}=await client.from("listings").select("id,image_url,owner_id").eq("id",id).eq("owner_id",owner).single();
if(error||!listing)throw Error("Could not access your listing.");
const {data:rows,error:photoError}=await client.from("listing_photos").select("id,image_url,position,storage_path").eq("listing_id",id).order("position",{ascending:true});
if(photoError)throw Error("Cannot load photos. Check listing_photos permissions.");
if(token!==sequence)return;
cover=listing.image_url;photos=rows||[];render();
}
async function open(id){
if(busy)return;dashboardBackdrop=document.querySelector('[aria-label="Close dashboard"]')?.closest(".auth-backdrop")||null;if(dashboardBackdrop)dashboardBackdrop.hidden=true;const token=++sequence;current=id;photos=[];cover=null;message.textContent="Loading photos...";editor.hidden=false;grid.replaceChildren();input.value="";
try{const {data,error}=await client.auth.getUser();if(error||!data?.user)throw Error("Please log in first.");owner=data.user.id;await load(id,token);if(token===sequence)message.textContent="";}catch(error){if(token===sequence){message.textContent=error.message;add.disabled=true;}}
}
async function setMain(url){
if(busy||!current)return;busy=true;render();message.textContent="Updating main photo...";
try{await verify();const {error}=await client.from("listings").update({image_url:url}).eq("id",current).eq("owner_id",owner);if(error)throw error;cover=url;message.textContent="Main photo updated.";render();}catch(e){message.textContent=e.message;}finally{busy=false;render();}
}
async function removePhoto(entry){
if(busy||!current)return;
if(!confirm("Remove this photo from the listing?"))return;
busy=true;render();message.textContent="Removing photo...";
try{
await verify();
const remaining=photos.filter(p=>p.id!==entry.id);
if(entry.id){const {error}=await client.from("listing_photos").delete().eq("id",entry.id).eq("listing_id",current);if(error)throw error;}
const nextCover=entry.url===cover?(remaining.find(p=>valid(p.image_url))?.image_url||null):cover;
if(nextCover!==cover){const {error}=await client.from("listings").update({image_url:nextCover}).eq("id",current).eq("owner_id",owner);if(error)throw error;}
photos=remaining;cover=nextCover;
message.textContent="Photo removed from listing."; 
}catch(e){message.textContent="Could not remove photo: "+e.message;try{await load(current,sequence)}catch{}}
finally{busy=false;render();}
}
add.addEventListener("click",async()=>{
if(busy||!current)return;
const files=[...input.files];if(!files.length){message.textContent="Choose photos first.";return;}
const count=new Set([...(valid(cover)?[cover]:[]),...photos.map(p=>p.image_url)]).size;
if(files.length+count>10){message.textContent="Maximum 10 photos per listing.";return;}
if(files.some(f=>!["image/jpeg","image/png","image/webp"].includes(f.type)||f.size>5*1024*1024)){message.textContent="Use JPG, PNG or WebP images, up to 5 MB each.";return;}
busy=true;render();let completed=0;
try{
await verify();
let nextPosition=Math.max(-1,...photos.map(p=>Number(p.position)||0))+1;
for(const file of files){
message.textContent=`Uploading ${completed+1} of ${files.length}...`;
const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
const path=`${owner}/${crypto.randomUUID()}.${ext}`;
const {error:uploadError}=await client.storage.from("listing-images").upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;
const {data:publicData}=client.storage.from("listing-images").getPublicUrl(path);
const url=publicData.publicUrl;
const {error:insertError}=await client.from("listing_photos").insert({listing_id:current,image_url:url,storage_path:path,position:nextPosition++});if(insertError)throw insertError;
if(!valid(cover)){const {error:coverError}=await client.from("listings").update({image_url:url}).eq("id",current).eq("owner_id",owner);if(coverError)throw coverError;cover=url;}
completed++;
}
input.value="";message.textContent="Photos added successfully.";
}catch(e){message.textContent=`Uploaded ${completed} of ${files.length}. ${e.message}`;}
finally{busy=false;try{await load(current,sequence)}catch(e){message.textContent+=" "+e.message;}render();}
});
editor.querySelector(".auth-close").addEventListener("click",close);
editor.addEventListener("click",e=>{if(e.target===editor)close()});
window.FlexiRentPhotoEditor={open};
})();