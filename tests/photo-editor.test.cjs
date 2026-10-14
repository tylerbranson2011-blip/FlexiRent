const assert=require("node:assert/strict");const fs=require("node:fs");const vm=require("node:vm");const read=p=>fs.readFileSync(p,"utf8");const editor=read("photo-editor.js"),dash=read("dashboard.js"),html=read("index.html");
for(const name of ["photo-editor.js","dashboard.js","gallery.js","app.js"])new vm.Script(read(name),{filename:name});
assert.match(html,/<script src="photo-editor.js"><\/script>/);
assert.match(dash,/Edit Photos/);assert.match(dash,/FlexiRentPhotoEditor.open/);
assert.match(editor,/\.from\("listing_photos"\)\.delete\(\)/);
assert.match(editor,/\.from\("listing_photos"\)\.insert\(/);
assert.match(editor,/\.eq\("owner_id",owner\)/);
assert.match(editor,/Maximum 10 photos/);
console.log("PASS photo editor syntax and integration checks");
