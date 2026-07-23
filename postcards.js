/* =====================================================================
   Hideout Postcards — staff-to-staff messaging widget (self-contained)
   Design: "takeaway cup" brand language (Archivo, graph grid, brand red,
   napkin ribbon, thumbtack pins). Logic unchanged from 2026-07-23 build.
   Shared RCC Firebase project (hideout-recipe-cost). Photos → Storage URL.
   ===================================================================== */
(function(){
  "use strict";
  if(window.__HIDEOUT_POSTCARDS__) return; window.__HIDEOUT_POSTCARDS__=true;

  var FB={apiKey:"AIzaSyC6-J5PoHy_Y4JGgN0cmi2iVImuEADYK9s",authDomain:"hideout-recipe-cost.firebaseapp.com",projectId:"hideout-recipe-cost",storageBucket:"hideout-recipe-cost.firebasestorage.app",messagingSenderId:"717961739938",appId:"1:717961739938:web:752af54de485d7f7c921fb"};
  var APP="postcards";
  var BACKEND="https://script.google.com/macros/s/AKfycbyT4pJ5QuF1HwLCBzbSS2eXcQoAwCNjeE2WqNucJcG20JQ5hlG3BBuBLWDA50llNZCh/exec";
  var TOKEN="hideout-9f2a7c-orders";
  /* Photos → Cloudinary (same account as RCC). Unsigned preset, tagged 'pinboard'. */
  var CLOUD={name:"ghfmwnbn",preset:"THC IMAGE LIBRARY",tag:"pinboard"};
  var THEMES=[
    {id:"cream",name:"Cream",bg:"#fdf8ef",ink:"#241d16",accent:"#c81a22"},
    {id:"blush",name:"Rose",bg:"#fbeae7",ink:"#3a2320",accent:"#8f1015"},
    {id:"sage",name:"Sage",bg:"#eaefe4",ink:"#26301f",accent:"#4f6a44"},
    {id:"sky",name:"Sky",bg:"#e6eef4",ink:"#1d2b38",accent:"#3f6f9c"}
  ];
  var LOGO="assets/hideout-logo.png";
  var ICON_MAIL='<svg class="ic" viewBox="0 0 24 24" style="font-size:26px"><rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
  var ICON_PEN='<svg class="ic" viewBox="0 0 24 24" style="font-size:15px"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  var ICON_SEND='<svg class="ic" viewBox="0 0 24 24" style="font-size:16px"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>';
  var ICON_SHIELD='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  var ICON_PINLBL='<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2l8 8-4 1-3 3-1 6-2-2-4 4-1-1 4-4-2-2 6-1 3-3z"/></svg>';
  var TACK_ON='<span class="tack"><span class="dome"></span><span class="pin"></span></span>';
  var TACK_OFF='<span class="tack-flat"></span>';

  var app,auth,db,storage,me=null,staff=[],feedUnsub=null,booting=false;

  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function theme(id){ for(var i=0;i<THEMES.length;i++){ if(THEMES[i].id===id) return THEMES[i]; } return THEMES[0]; }
  function fmtTime(ts){ try{ var d=ts&&ts.toDate?ts.toDate():(ts?new Date(ts):new Date()); return d.toLocaleString("en-AU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }catch(e){ return ""; } }

  function initFb(){
    if(!window.firebase||!firebase.initializeApp){ return false; }
    try{
      var existing=(firebase.apps||[]).filter(function(a){return a.name===APP;})[0];
      app=existing||firebase.initializeApp(FB,APP);
    }catch(e){ try{ app=firebase.app(APP); }catch(e2){ return false; } }
    try{ auth=app.auth(); db=app.firestore(); }catch(e){ return false; }
    try{ auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){}
    auth.onAuthStateChanged(function(u){ onAuth(u); });
    return true;
  }

  function onAuth(u){
    if(!u){ me=null; render(); return; }
    db.collection("allowlist").doc((u.email||"").toLowerCase()).get().then(function(snap){
      var d=snap&&snap.exists?snap.data():{};
      me={email:(u.email||"").toLowerCase(),name:(d&&d.name)||u.displayName||(u.email||"").split("@")[0],role:(d&&d.role)||"staff",branch:(d&&d.branch)||""};
      loadStaff(); subscribeFeed(); render();
    }).catch(function(){
      me={email:(u.email||"").toLowerCase(),name:u.displayName||(u.email||"").split("@")[0],role:"staff",branch:""};
      loadStaff(); subscribeFeed(); render();
    });
  }

  function loadStaff(){
    db.collection("allowlist").get().then(function(qs){
      var list=[]; qs.forEach(function(doc){ var d=doc.data()||{}; list.push({email:doc.id,name:d.name||doc.id,role:d.role||"staff"}); });
      list.sort(function(a,b){ return (a.name||"").localeCompare(b.name||""); });
      staff=list; render();
    }).catch(function(){ staff=[]; });
  }

  function signIn(){
    if(!auth){ toast("Not ready — reload the page."); return; }
    var pr=new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(pr).catch(function(e){
      toast("Sign-in failed: "+(e&&e.message?e.message:e)+" (open the app from its web address, not a file).");
    });
  }
  function signOut(){ if(auth) auth.signOut(); }

  function moderate(text){
    var url=BACKEND+"?action=moderatePostcard&token="+encodeURIComponent(TOKEN)+"&text="+encodeURIComponent(text||"");
    return fetch(url,{cache:"no-store"}).then(function(r){ return r.json(); }).then(function(j){
      if(j&&typeof j.allow==="boolean") return j;
      return {allow:false,reason:"Could not check the message right now. Try again in a moment.",_soft:true};
    }).catch(function(){
      return {allow:false,reason:"Could not reach the safety check. Try again in a moment.",_soft:true};
    });
  }

  function uploadPhoto(file){
    if(!file) return Promise.resolve("");
    var fd=new FormData();
    fd.append("file",file);
    fd.append("upload_preset",CLOUD.preset);
    fd.append("tags",CLOUD.tag);
    return fetch("https://api.cloudinary.com/v1_1/"+encodeURIComponent(CLOUD.name)+"/image/upload",{method:"POST",body:fd})
      .then(function(r){ return r.json(); })
      .then(function(j){ if(j&&j.secure_url) return j.secure_url; throw new Error((j&&j.error&&j.error.message)||"Image upload failed"); });
  }

  function send(opts, done){
    var msg=(opts.message||"").trim();
    if(!msg){ done({error:"Write a message first."}); return; }
    moderate(msg).then(function(mod){
      if(!mod.allow){ done({blocked:true, reason:mod.reason||"That message can't be posted.", soft:!!mod._soft}); return; }
      uploadPhoto(opts.file).then(function(photoUrl){
        var rec={
          fromEmail:me.email, fromName:me.name,
          toName:opts.toName||"Everyone", toEmail:opts.toEmail||"",
          message:msg, photoUrl:photoUrl||"", theme:opts.themeId||"cream",
          caption:(opts.caption||"").trim(), capPos:opts.capPos||"bottom",
          status:"approved",
          createdAt:firebase.firestore.FieldValue.serverTimestamp()
        };
        return db.collection("postcards").add(rec);
      }).then(function(){ done({ok:true}); })
        .catch(function(e){ done({error:(e&&e.message)||"Could not send. Try again."}); });
    });
  }

  var feedItems=[];
  function subscribeFeed(){
    if(feedUnsub){ try{ feedUnsub(); }catch(e){} feedUnsub=null; }
    feedUnsub=db.collection("postcards").orderBy("createdAt","desc").limit(60).onSnapshot(function(qs){
      var arr=[]; qs.forEach(function(doc){ var d=doc.data()||{}; d._id=doc.id; arr.push(d); });
      feedItems=arr; renderFeed();
    }, function(){ });
  }

  function injectCSS(){
    if(document.getElementById("pc-css")) return;
    var st=document.createElement("style"); st.id="pc-css";
    st.textContent=[
"@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&display=swap');",
":root{--pc-cream:#f6ede1;--pc-paper:#fdf8ef;--pc-ink:#241d16;--pc-accent:#c81a22;--pc-accent-2:#8f1015;--pc-muted:#9a8b76;--pc-line:rgba(200,26,34,.11);--pc-line-strong:rgba(200,26,34,.16);--pc-disp:'Archivo',system-ui,sans-serif}",
"#pc-fab{position:fixed;left:20px;bottom:20px;z-index:99998;width:60px;height:60px;border:none;border-radius:999px;cursor:pointer;background:var(--pc-accent);color:#fff;box-shadow:0 12px 26px rgba(150,16,21,.42);display:flex;align-items:center;justify-content:center;transition:transform .18s ease,box-shadow .18s ease}",
"#pc-fab:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 16px 30px rgba(150,16,21,.5)}#pc-fab:active{transform:scale(.96)}",
"#pc-try{position:fixed;left:20px;bottom:92px;z-index:99998;border:none;border-radius:999px;cursor:pointer;background:var(--pc-ink);color:var(--pc-cream);font-family:var(--pc-disp);font-weight:800;font-size:13px;letter-spacing:.06em;padding:11px 17px 11px 14px;box-shadow:0 8px 20px rgba(20,12,4,.3);display:flex;align-items:center;gap:7px;transition:transform .18s ease}",
"#pc-try:hover{transform:translateY(-2px)}#pc-try:active{transform:scale(.97)}",
".ic{width:1em;height:1em;display:block;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
"#pc-overlay{position:fixed;inset:0;z-index:99999;background:rgba(20,12,4,.48);display:none;align-items:center;justify-content:center;padding:16px;font-family:'SF Pro Text','Inter',system-ui,sans-serif}",
"#pc-modal{background:var(--pc-paper);width:min(430px,100%);max-height:88vh;border-radius:24px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 34px 80px rgba(30,18,6,.42);border:1.5px solid rgba(200,26,34,.18)}",
".pc-head{position:relative;display:flex;align-items:center;gap:12px;padding:16px 18px 15px;background:var(--pc-paper);border-bottom:2px solid var(--pc-ink)}",
".pc-head .brand{height:34px;width:34px;object-fit:contain;flex:none}",
".pc-titles{display:flex;flex-direction:column;line-height:1;margin-right:auto}",
".pc-head h3{margin:0;font-family:var(--pc-disp);font-weight:900;font-size:21px;letter-spacing:-.01em;text-transform:uppercase;color:var(--pc-ink)}",
".pc-head .sub{font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--pc-accent);font-weight:700;margin-top:4px}",
".pc-x{border:none;background:transparent;cursor:pointer;color:var(--pc-muted);width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:22px;border-radius:50%;line-height:1}",
".pc-x:hover{background:rgba(0,0,0,.06);color:var(--pc-ink)}",
".pc-ribbon{background:var(--pc-accent);overflow:hidden;white-space:nowrap;padding:6px 0}",
".pc-ribbon span{font-family:var(--pc-disp);font-weight:800;font-size:10px;letter-spacing:.22em;color:#fff;opacity:.92;text-transform:uppercase}",
".pc-ribbon b{opacity:.55;margin:0 10px;font-weight:800}",
".pc-body{padding:16px 18px 20px;overflow:auto}",
".pc-grid{background-color:var(--pc-cream);background-image:linear-gradient(var(--pc-line) 1px,transparent 1px),linear-gradient(90deg,var(--pc-line) 1px,transparent 1px),linear-gradient(var(--pc-line-strong) 1px,transparent 1px),linear-gradient(90deg,var(--pc-line-strong) 1px,transparent 1px);background-size:22px 22px,22px 22px,110px 110px,110px 110px}",
".pc-signin{text-align:center;padding:30px 12px}",
".pc-tabs{display:flex;gap:6px;margin-bottom:16px;background:rgba(36,29,22,.06);padding:4px;border-radius:12px}",
".pc-tab{flex:1;text-align:center;padding:9px;border-radius:9px;cursor:pointer;font-family:var(--pc-disp);font-weight:700;font-size:13px;letter-spacing:.02em;color:var(--pc-muted);background:transparent;border:none;transition:all .18s ease}",
".pc-tab.on{background:var(--pc-ink);color:var(--pc-cream);box-shadow:0 3px 8px rgba(20,12,4,.24)}",
".pc-pinlbl{display:flex;align-items:center;gap:7px;font-family:var(--pc-disp);font-size:11px;font-weight:800;color:var(--pc-accent-2);text-transform:uppercase;letter-spacing:.12em;margin:2px 0 12px}",
".pc-pinwrap{margin-bottom:18px;padding-bottom:14px;border-bottom:2px dashed rgba(200,26,34,.28)}",
".pc-card{position:relative;border-radius:4px;padding:17px 16px 14px;margin-bottom:20px;background:var(--pc-paper);color:var(--pc-ink);box-shadow:0 5px 16px rgba(30,18,6,.14);border:1px solid rgba(36,29,22,.07)}",
".pc-card::after{content:'';position:absolute;inset:0;border-radius:4px;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.5)}",
".pc-card.pinned{transform:rotate(-1.4deg);box-shadow:0 12px 26px rgba(30,18,6,.24);animation:pc-stick .45s cubic-bezier(.2,.85,.3,1.25)}",
"@keyframes pc-stick{0%{transform:scale(.82) rotate(-8deg);opacity:0}60%{transform:scale(1.02) rotate(-1.4deg);opacity:1}100%{transform:rotate(-1.4deg)}}",
"@keyframes pc-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
"#pc-feed>.pc-card{animation:pc-fadein .24s ease}",
".pc-route{display:flex;align-items:center;gap:6px;font-family:var(--pc-disp);font-size:11.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;margin-bottom:9px;padding-right:34px}",
".pc-route .arw{opacity:.5}",
".pc-msg{font-size:15.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word}",
".pc-card img{width:100%;border-radius:4px;margin-top:11px;display:block;border:1px solid rgba(36,29,22,.1)}",
".pc-when{display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-family:var(--pc-disp);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--pc-muted);border:1.5px solid rgba(154,139,118,.4);border-radius:3px;padding:3px 7px;transform:rotate(-1.5deg)}",
".pc-when .stamp{width:9px;height:9px;border-radius:50%;background:var(--pc-accent);opacity:.7}",
".pc-pinbtn{position:absolute;top:-13px;right:16px;width:44px;height:44px;border:none;background:transparent;cursor:pointer;display:flex;align-items:flex-start;justify-content:center;padding:0;transition:transform .18s ease}",
".pc-pinbtn:hover{transform:translateY(-2px)}",
".tack{width:26px;height:30px;position:relative}",
".tack .dome{position:absolute;top:0;left:3px;width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 33% 28%,#ff6b60,var(--pc-accent) 58%,var(--pc-accent-2));box-shadow:0 4px 7px rgba(120,10,14,.45),inset -2px -2px 3px rgba(0,0,0,.28),inset 2px 2px 4px rgba(255,255,255,.55)}",
".tack .pin{position:absolute;top:17px;left:12px;width:2px;height:12px;border-radius:0 0 2px 2px;background:linear-gradient(#b9b3ab,#6f6a63);transform:rotate(4deg);transform-origin:top}",
".tack-flat{width:22px;height:22px;border-radius:50%;border:2px solid rgba(154,139,118,.5);position:relative;opacity:.6;margin-top:2px}",
".tack-flat::after{content:'';position:absolute;left:50%;top:50%;width:5px;height:5px;border-radius:50%;background:rgba(154,139,118,.6);transform:translate(-50%,-50%)}",
".pc-pinbtn:hover .tack-flat{opacity:.95;border-color:var(--pc-accent)}",
".pc-pinbtn:hover .tack-flat::after{background:var(--pc-accent)}",
".pc-lbl{display:block;font-family:var(--pc-disp);font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--pc-ink);margin:14px 0 6px;font-weight:800}",
".pc-inp,.pc-sel,.pc-ta{width:100%;box-sizing:border-box;border:1.5px solid rgba(36,29,22,.18);border-radius:8px;padding:12px;font-size:16px;font-family:inherit;background:#fff;color:var(--pc-ink)}",
".pc-inp:focus,.pc-sel:focus,.pc-ta:focus{outline:none;border-color:var(--pc-accent);box-shadow:0 0 0 3px rgba(200,26,34,.14)}",
".pc-ta{min-height:88px;resize:vertical;line-height:1.5}",
".pc-preview{max-width:100%;border-radius:4px;margin-top:10px;border:1px solid rgba(36,29,22,.12);display:none}",
".pc-photowrap{position:relative;margin-top:10px;display:none;border-radius:4px;overflow:hidden;border:1px solid rgba(36,29,22,.12)}",
".pc-photowrap img{display:block;width:100%;margin:0;border:none;border-radius:0}",
".pc-capov{position:absolute;left:0;right:0;padding:12px 14px;color:#fff;font-family:var(--pc-disp);font-weight:800;font-size:18px;line-height:1.2;text-shadow:0 1px 6px rgba(0,0,0,.65);word-break:break-word;pointer-events:none}",
".pc-capov.top{top:0;background:linear-gradient(rgba(0,0,0,.5),transparent 90%)}",
".pc-capov.center{top:50%;transform:translateY(-50%);text-align:center}",
".pc-capov.bottom{bottom:0;background:linear-gradient(transparent,rgba(0,0,0,.58))}",
".pc-capov.banner{bottom:0;background:var(--pc-accent);padding:11px 14px;text-shadow:none;font-size:16px;letter-spacing:.02em}",
".pc-capov.headline{top:50%;transform:translateY(-50%);text-align:center;font-size:26px;font-weight:900;letter-spacing:-.01em;text-transform:uppercase;padding:16px}",
".pc-themes{display:flex;gap:10px;margin-top:8px}",
".pc-sw{width:34px;height:34px;border-radius:6px;cursor:pointer;border:2px solid transparent;box-shadow:0 2px 5px rgba(30,18,6,.14);transition:transform .15s ease}",
".pc-sw:hover{transform:translateY(-2px)}.pc-sw.sel{border-color:var(--pc-ink);transform:translateY(-2px)}",
".pc-err{color:var(--pc-accent-2);font-size:13px;margin-top:10px;min-height:16px;font-weight:600}",
".pc-btn{border:none;border-radius:12px;background:var(--pc-accent);color:#fff;font-family:var(--pc-disp);font-weight:800;font-size:15px;letter-spacing:.04em;text-transform:uppercase;padding:14px 18px;cursor:pointer;margin-top:18px;width:100%;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 10px 24px rgba(150,16,21,.34);transition:transform .18s ease}",
".pc-btn:hover{transform:translateY(-2px)}.pc-btn:active{transform:scale(.98)}",
".pc-note{display:flex;gap:8px;font-size:11.5px;color:var(--pc-muted);margin-top:12px;line-height:1.55;background:rgba(200,26,34,.06);border-radius:8px;padding:10px 11px}",
".pc-note svg{flex:none;margin-top:1px;color:var(--pc-accent);opacity:.8}",
".pc-note a{color:var(--pc-muted)}",
".pc-empty{text-align:center;color:var(--pc-muted);padding:34px 10px;font-size:14px}",
"@media (prefers-reduced-motion:reduce){#pc-fab,#pc-try,.pc-card.pinned,#pc-feed>.pc-card,.pc-tab,.pc-sw,.pc-btn,.pc-pinbtn{animation:none;transition:none}}",
"@media (max-width:640px){#pc-modal{max-height:94vh}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  var state={tab:"feed", themeId:"cream", file:null};

  function toast(m){
    var t=document.createElement("div");
    t.textContent=m; t.style.cssText="position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#241d16;color:#f6ede1;padding:11px 16px;border-radius:12px;z-index:100000;font-family:'SF Pro Text','Inter',system-ui;font-size:14px;max-width:88vw;box-shadow:0 10px 30px rgba(0,0,0,.3)";
    document.body.appendChild(t); setTimeout(function(){ t.remove(); },3600);
  }

  function open(){ var o=document.getElementById("pc-overlay"); if(o){ o.style.display="flex"; render(); } }
  function openCompose(){ state.tab="write"; open(); }
  function close(){ var o=document.getElementById("pc-overlay"); if(o) o.style.display="none"; }

  function render(){
    var body=document.getElementById("pc-bodyc"); if(!body) return;
    if(!me){
      body.innerHTML='<div class="pc-signin"><p style="color:var(--pc-muted);font-size:14px;margin-bottom:18px;line-height:1.5">Sign in with your Hideout Google account to send and read postcards.</p><button class="pc-btn" id="pc-signin-b" style="width:auto;display:inline-flex">Sign in with Google</button></div>';
      var b=document.getElementById("pc-signin-b"); if(b) b.onclick=signIn;
      return;
    }
    body.innerHTML=
      '<div class="pc-tabs"><button class="pc-tab '+(state.tab==="feed"?"on":"")+'" data-t="feed">Postcards</button><button class="pc-tab '+(state.tab==="write"?"on":"")+'" data-t="write">Write one</button></div>'+
      '<div id="pc-tabc"></div>';
    Array.prototype.forEach.call(body.querySelectorAll(".pc-tab"),function(el){ el.onclick=function(){ state.tab=el.getAttribute("data-t"); render(); }; });
    if(state.tab==="write") renderWrite(); else { renderFeedInto(); }
  }

  function renderWrite(){
    var c=document.getElementById("pc-tabc"); if(!c) return;
    var opts=staff.filter(function(s){ return s.email!==me.email; }).map(function(s){ return '<option value="'+esc(s.email)+'">'+esc(s.name)+'</option>'; }).join("");
    var sw=THEMES.map(function(t){ return '<div class="pc-sw'+(t.id===state.themeId?" sel":"")+'" data-th="'+t.id+'" style="background:'+t.bg+'"></div>'; }).join("");
    c.innerHTML=
      '<label class="pc-lbl">To</label><select class="pc-sel" id="pc-to"><option value="">Everyone (open)</option>'+opts+'</select>'+
      '<label class="pc-lbl">Message</label><textarea class="pc-ta" id="pc-msg" maxlength="600" placeholder="Say something kind…"></textarea>'+
      '<label class="pc-lbl">Photo (optional)</label><input class="pc-inp" type="file" accept="image/*" id="pc-file">'+
      '<div class="pc-photowrap" id="pc-prevwrap"><img id="pc-preview" alt=""><div class="pc-capov bottom" id="pc-capov"></div></div>'+
      '<label class="pc-lbl" id="pc-caplbl" style="display:none">Words on the photo (optional)</label><input class="pc-inp" id="pc-cap" maxlength="80" placeholder="e.g. New oat milk — try it!" style="display:none">'+
      '<div id="pc-cappos-wrap" style="display:none;margin-top:8px"><select class="pc-sel" id="pc-cappos"><option value="bottom">Bottom fade</option><option value="banner">Red banner</option><option value="headline">Big headline</option><option value="center">Centre</option><option value="top">Top fade</option></select></div>'+
      '<label class="pc-lbl">Postcard colour</label><div class="pc-themes">'+sw+'</div>'+
      '<div class="pc-err" id="pc-err"></div>'+
      '<button class="pc-btn" id="pc-send">'+ICON_SEND+' Send postcard</button>'+
      '<div style="text-align:center;margin-top:8px;font-size:13px;color:var(--pc-muted)" id="pc-status"></div>'+
      '<div class="pc-note">'+ICON_SHIELD+'<span>Every postcard is checked automatically before it posts. Messages meant to insult, mock or mislead won’t go through. Signed in as '+esc(me.name)+' · <a href="#" id="pc-out">sign out</a></span></div>';
    Array.prototype.forEach.call(c.querySelectorAll(".pc-sw"),function(el){ el.onclick=function(){ state.themeId=el.getAttribute("data-th"); Array.prototype.forEach.call(c.querySelectorAll(".pc-sw"),function(x){ x.className="pc-sw"+(x.getAttribute("data-th")===state.themeId?" sel":""); }); }; });
    var fileEl=document.getElementById("pc-file"), prev=document.getElementById("pc-preview"), pwrap=document.getElementById("pc-prevwrap");
    var capEl=document.getElementById("pc-cap"), capLbl=document.getElementById("pc-caplbl"), capPosWrap=document.getElementById("pc-cappos-wrap"), capOv=document.getElementById("pc-capov"), capPos=document.getElementById("pc-cappos");
    function showCapTools(on){ var v=on?"block":"none"; if(capLbl)capLbl.style.display=v; if(capEl)capEl.style.display=on?"block":"none"; if(capPosWrap)capPosWrap.style.display=v; }
    if(fileEl){ fileEl.onchange=function(){ var f=(fileEl.files||[])[0]; if(f){ try{ prev.src=URL.createObjectURL(f); pwrap.style.display="block"; showCapTools(true); }catch(e){} } else { pwrap.style.display="none"; showCapTools(false); } }; }
    if(capEl&&capOv){ capEl.oninput=function(){ capOv.textContent=capEl.value; }; }
    if(capPos&&capOv){ capPos.onchange=function(){ capOv.className="pc-capov "+capPos.value; }; }
    var out=document.getElementById("pc-out"); if(out) out.onclick=function(e){ e.preventDefault(); signOut(); };
    var sb=document.getElementById("pc-send");
    sb.onclick=function(){
      var toSel=document.getElementById("pc-to");
      var toEmail=toSel.value, toName=toEmail?(toSel.options[toSel.selectedIndex].text):"Everyone";
      var msg=document.getElementById("pc-msg").value;
      var file=(document.getElementById("pc-file").files||[])[0]||null;
      var capV=(document.getElementById("pc-cap")||{}).value||"";
      var capPosV=(document.getElementById("pc-cappos")||{}).value||"bottom";
      var err=document.getElementById("pc-err"), stt=document.getElementById("pc-status");
      err.textContent=""; stt.textContent="Sending…"; sb.disabled=true;
      send({toName:toName,toEmail:toEmail,message:msg,themeId:state.themeId,file:file,caption:capV,capPos:capPosV},function(res){
        sb.disabled=false; stt.textContent="";
        if(res.error){ err.textContent=res.error; return; }
        if(res.blocked){ err.textContent=(res.soft?"":"Held: ")+res.reason; return; }
        if(res.ok){ toast("Postcard sent ❤"); state.tab="feed"; render(); }
      });
    };
  }

  function renderFeedInto(){
    var c=document.getElementById("pc-tabc"); if(!c) return;
    c.innerHTML='<div id="pc-feed"></div>'; renderFeed();
  }
  function cardHtml(d, pinned){
    var th=theme(d.theme);
    var route=esc(d.fromName||"?")+' <span class="arw">→</span> '+esc(d.toName||"Everyone");
    return '<div class="pc-card'+(pinned?" pinned":"")+'" style="background:'+th.bg+';color:'+th.ink+'">'+
      '<button class="pc-pinbtn" data-pin="'+esc(d._id)+'" data-cur="'+(pinned?"1":"0")+'" aria-label="'+(pinned?"Unpin":"Pin")+' postcard">'+(pinned?TACK_ON:TACK_OFF)+'</button>'+
      '<div class="pc-route" style="color:'+th.accent+'">'+route+'</div>'+
      '<div class="pc-msg">'+esc(d.message||"")+'</div>'+
      (d.photoUrl?('<div class="pc-photowrap" style="display:block"><img src="'+esc(d.photoUrl)+'" alt="">'+(d.caption?'<div class="pc-capov '+esc(d.capPos||"bottom")+'">'+esc(d.caption)+'</div>':"")+'</div>'):"")+
      '<div class="pc-when"><span class="stamp"></span>'+esc(fmtTime(d.createdAt))+'</div>'+
    '</div>';
  }
  function renderFeed(){
    var f=document.getElementById("pc-feed"); if(!f) return;
    if(!feedItems.length){ f.innerHTML='<div class="pc-empty">No postcards yet. Be the first to send one!</div>'; return; }
    var pins=feedItems.filter(function(d){ return d.pinned; });
    var rest=feedItems.filter(function(d){ return !d.pinned; });
    var html="";
    if(pins.length){ html+='<div class="pc-pinlbl">'+ICON_PINLBL+' Pinned</div><div class="pc-pinwrap">'+pins.map(function(d){ return cardHtml(d,true); }).join("")+'</div>'; }
    html+=rest.map(function(d){ return cardHtml(d,false); }).join("");
    f.innerHTML=html;
    Array.prototype.forEach.call(f.querySelectorAll(".pc-pinbtn"),function(el){ el.onclick=function(){ togglePin(el.getAttribute("data-pin"), el.getAttribute("data-cur")==="1"); }; });
  }
  function togglePin(id, cur){
    if(!db||!id) return;
    db.collection("postcards").doc(id).update({pinned:!cur, pinnedAt:firebase.firestore.FieldValue.serverTimestamp()})
      .catch(function(e){ toast("Couldn't pin — "+((e&&e.message)||"try again")); });
  }

  function mount(){
    injectCSS();
    var fab=document.createElement("button"); fab.id="pc-fab"; fab.title="Staff postcards"; fab.setAttribute("aria-label","Staff postcards"); fab.innerHTML=ICON_MAIL;
    fab.onclick=open; document.body.appendChild(fab);
    var tryb=document.createElement("button"); tryb.id="pc-try"; tryb.title="Write a postcard"; tryb.innerHTML=ICON_PEN+" TRY";
    tryb.onclick=openCompose; document.body.appendChild(tryb);
    var ov=document.createElement("div"); ov.id="pc-overlay";
    ov.innerHTML='<div id="pc-modal">'+
      '<div class="pc-head"><img class="brand" src="'+LOGO+'" alt="The Hideout" onerror="this.style.display=\'none\'"><div class="pc-titles"><h3>Postcards</h3><span class="sub">The Hideout · staff board</span></div><button class="pc-x" id="pc-close" aria-label="Close">×</button></div>'+
      '<div class="pc-ribbon"><span>&nbsp;&nbsp;The Hideout staff board<b>✦</b>Say something kind<b>✦</b>The Hideout staff board<b>✦</b>Say something kind&nbsp;&nbsp;</span></div>'+
      '<div class="pc-body pc-grid"><div id="pc-bodyc"></div></div>'+
    '</div>';
    document.body.appendChild(ov);
    ov.addEventListener("click",function(e){ if(e.target===ov) close(); });
    document.getElementById("pc-close").onclick=close;
    if(!initFb()){ if(!booting){ booting=true; var n=0; var iv=setInterval(function(){ n++; if(initFb()||n>20){ clearInterval(iv); } },400); } }
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mount); else mount();
  window.HideoutPostcards={open:open, compose:openCompose};
})();
