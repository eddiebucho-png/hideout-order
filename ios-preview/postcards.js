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
  var LOGO="https://order.hideoutdb.com/hideout-logo.png";
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

  /* AUTH GATE (2026-07-24): the host app adds html.hideout-authed after its own Google-login
     gate is cleared. All staff widgets stay hidden (CSS) until then. Secure-by-default: if the
     class check throws we treat the session as NOT authed (widgets stay hidden). */
  function isAuthed(){ try{ return document.documentElement.classList.contains("hideout-authed"); }catch(e){ return false; } }
  /* When auth is lost (logout / gate screen shown), force any open modal or story viewer shut
     and re-render the tray so its contents are cleared. Fail-safe: wrapped so it can't break the app. */
  function enforceAuthGate(){
    if(!isAuthed()){
      var o=document.getElementById("pc-overlay"); if(o) o.style.display="none";
      var s=document.getElementById("pc-story"); if(s) s.style.display="none";
      var cm=document.getElementById("pc-comments"); if(cm){ try{ if(cm.__close) cm.__close(); else if(cm.parentNode) cm.parentNode.removeChild(cm); }catch(e){} }
      storyState=null;
    }
    try{ renderTray(); }catch(e){}
  }

  /* ===================== SSO (2026-07-24): reuse the host app's Google session =====================
     RCC loads its own DEFAULT firebase app (same hideout-recipe-cost project); postcards runs its
     own "postcards" app, so their auth sessions are separate and staff were asked to sign in TWICE.
     Fix (extremely conservative): when OUR postcards app has no session, look for an already
     signed-in user in ANY other firebase app and reuse that identity (email) for onAuth. Firestore
     reads/writes stay on the postcards-app db (rules/permission consistency). The original self
     sign-in path is NEVER removed — if no host session is found we fall back to the Sign-in button
     / signInWithPopup exactly as before. Everything is try/catch'd so it can never stall the app.
     IOS already shares APP="postcards", so its own callback fires with a user and none of this runs. */
  function hostUser(){
    try{
      var apps=(window.firebase&&firebase.apps)||[];
      for(var i=0;i<apps.length;i++){
        var a=apps[i]; if(!a||a.name===APP) continue;
        try{
          var au=a.auth&&a.auth();
          var u=au&&au.currentUser;
          if(u&&u.email) return u;
        }catch(e){}
      }
    }catch(e){}
    return null;
  }
  var hostWatched=false;
  function watchHostApps(){
    /* Observe other apps' auth so a host session that resolves slightly AFTER us is still adopted.
       Only adopts while our OWN app has no user (never fights our own login). Fail-safe throughout. */
    if(hostWatched) return;
    try{
      var apps=(window.firebase&&firebase.apps)||[];
      for(var i=0;i<apps.length;i++){
        (function(a){
          if(!a||a.name===APP) return;
          try{
            var au=a.auth&&a.auth();
            if(!au||!au.onAuthStateChanged) return;
            au.onAuthStateChanged(function(hu){
              try{
                if(auth&&auth.currentUser) return; /* our own postcards session wins */
                if(hu&&hu.email){ if(!me||me.email!==(hu.email||"").toLowerCase()){ stopAdopt(); onAuth(hu); } }
                else if(me&&(!auth||!auth.currentUser)){ onAuth(null); } /* host signed out */
              }catch(e){}
            });
          }catch(e){}
        })(apps[i]);
      }
      hostWatched=true;
    }catch(e){}
  }
  var adoptTimer=null, adoptTries=0;
  function stopAdopt(){ try{ if(adoptTimer){ clearInterval(adoptTimer); adoptTimer=null; } }catch(e){} }
  function adoptHostSession(){
    /* Bounded (~8s) search for an existing host session so viewing/writing works without a 2nd popup.
       Stops as soon as our own app logs in, a host session is adopted, or the budget runs out. */
    try{
      watchHostApps();
      var hu0=hostUser();
      if(hu0){ onAuth(hu0); return; }
      if(adoptTimer) return;
      adoptTries=0;
      adoptTimer=setInterval(function(){
        try{
          adoptTries++;
          if((auth&&auth.currentUser)||me){ stopAdopt(); return; }
          var hu=hostUser();
          if(hu){ stopAdopt(); onAuth(hu); return; }
          if(adoptTries>=20){ stopAdopt(); }
        }catch(e){ stopAdopt(); }
      },400);
    }catch(e){}
  }

  function initFb(){
    if(!window.firebase||!firebase.initializeApp){ return false; }
    try{
      var existing=(firebase.apps||[]).filter(function(a){return a.name===APP;})[0];
      app=existing||firebase.initializeApp(FB,APP);
    }catch(e){ try{ app=firebase.app(APP); }catch(e2){ return false; } }
    try{ auth=app.auth(); db=app.firestore(); }catch(e){ return false; }
    try{ auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){}
    auth.onAuthStateChanged(function(u){
      try{
        if(u){ stopAdopt(); onAuth(u); return; }
        /* No session on our own app — reuse a host app's session (SSO) if one exists, else fall back. */
        var hu=hostUser();
        if(hu){ onAuth(hu); return; }
        onAuth(null);
        adoptHostSession();
      }catch(e){ try{ onAuth(u||null); }catch(_){} }
    });
    return true;
  }

  function onAuth(u){
    if(!u){ me=null; render(); try{ renderTray(); }catch(e){} return; }
    db.collection("allowlist").doc((u.email||"").toLowerCase()).get().then(function(snap){
      var d=snap&&snap.exists?snap.data():{};
      me={email:(u.email||"").toLowerCase(),name:(d&&d.name)||u.displayName||(u.email||"").split("@")[0],role:(d&&d.role)||"staff",branch:(d&&d.branch)||""};
      loadStaff(); subscribeFeed(); render();
    }).catch(function(){
      me={email:(u.email||"").toLowerCase(),name:u.displayName||(u.email||"").split("@")[0],role:"staff",branch:""};
      loadStaff(); subscribeFeed(); render();
    });
  }

  var staffMap={}; /* email -> {name, photoURL} for P5 avatars / P6 tray */
  function loadStaff(){
    db.collection("allowlist").get().then(function(qs){
      var list=[], map={};
      qs.forEach(function(doc){
        if(String(doc.id).indexOf("cfg-")===0) return;
        var d=doc.data()||{};
        var rec={email:doc.id,name:d.name||doc.id,role:d.role||"staff",photoURL:(typeof d.photoURL==="string"?d.photoURL:"")};
        list.push(rec); map[String(doc.id).toLowerCase()]=rec;
      });
      list.sort(function(a,b){ return (a.name||"").localeCompare(b.name||""); });
      staff=list; staffMap=map; render();
    }).catch(function(){ staff=[]; staffMap={}; });
  }

  function signIn(){
    if(!auth){ toast("Not ready — reload the page."); return; }
    /* SSO: if a host app is already signed in, reuse it — no second Google popup. Fail-safe. */
    try{ var hu=hostUser(); if(hu&&hu.email){ onAuth(hu); return; } }catch(e){}
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
      }).then(function(ref){ done({ok:true, id:ref&&ref.id}); })
        .catch(function(e){ done({error:(e&&e.message)||"Could not send. Try again."}); });
    });
  }

  var feedItems=[];
  function subscribeFeed(){
    if(feedUnsub){ try{ feedUnsub(); }catch(e){} feedUnsub=null; }
    feedUnsub=db.collection("postcards").orderBy("createdAt","desc").limit(60).onSnapshot(function(qs){
      var arr=[]; qs.forEach(function(doc){ var d=doc.data()||{}; d._id=doc.id; arr.push(d); });
      feedItems=arr; renderFeed(); renderTray(); /* keep the always-on top tray fresh even when the modal is closed */
    }, function(){ });
  }

  function injectCSS(){
    if(document.getElementById("pc-css")) return;
    var st=document.createElement("style"); st.id="pc-css";
    st.textContent=[
"@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800;900&display=swap');",
/* P4: sticker text font presets (loaded once, small subset for size). */
"@import url('https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Playfair+Display:wght@700;900&family=Space+Mono:wght@700&family=Caveat:wght@700&display=swap');",
":root{--pc-cream:#f3f2f2;--pc-paper:#f8f4f4;--pc-ink:#201e1d;--pc-accent:#ec3013;--pc-accent-2:#ae1800;--pc-muted:#7d7979;--pc-line:rgba(236,48,19,.12);--pc-line-strong:rgba(236,48,19,.18);--pc-disp:'Archivo',system-ui,sans-serif}",
/* ---- AUTH GATE (2026-07-24): staff widgets are hidden until the host app adds html.hideout-authed (after its Google-login gate). Default = hidden; revealed only when authed. ---- */
"#pc-fab,#pc-try,#pc-toptray{display:none!important}",
"html.hideout-authed #pc-fab,html.hideout-authed #pc-try{display:flex!important}",
"html:not(.hideout-authed) #pc-tray-host,html:not(.hideout-authed) #pc-overlay,html:not(.hideout-authed) #pc-story{display:none!important}",
"#pc-fab{position:fixed;left:20px;bottom:20px;z-index:99998;width:60px;height:60px;border:none;border-radius:0;cursor:pointer;background:var(--pc-accent);color:#fff;box-shadow:0 12px 26px rgba(174,24,0,.42);display:flex;align-items:center;justify-content:center;transition:transform .18s ease,box-shadow .18s ease}",
"#pc-fab:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 16px 30px rgba(174,24,0,.5)}#pc-fab:active{transform:scale(.96)}",
"#pc-try{position:fixed;left:20px;bottom:92px;z-index:99998;border:none;border-radius:0;cursor:pointer;background:var(--pc-ink);color:var(--pc-cream);font-family:var(--pc-disp);font-weight:800;font-size:13px;letter-spacing:.06em;padding:11px 17px 11px 14px;box-shadow:0 8px 20px rgba(32,30,29,.3);display:flex;align-items:center;gap:7px;transition:transform .18s ease}",
"#pc-try:hover{transform:translateY(-2px)}#pc-try:active{transform:scale(.97)}",
".ic{width:1em;height:1em;display:block;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
"#pc-overlay{position:fixed;inset:0;z-index:99999;background:rgba(32,30,29,.55);display:none;align-items:center;justify-content:center;padding:16px;font-family:var(--pc-disp)}",
"#pc-modal{position:relative;background:var(--pc-paper);width:min(940px,96vw);max-height:92vh;border-radius:0;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 34px 80px rgba(32,30,29,.42);border:2px solid var(--pc-ink)}",
".pc-head{position:relative;display:flex;align-items:center;gap:12px;padding:16px 18px 15px;background:var(--pc-paper);border-bottom:2px solid var(--pc-ink)}",
".pc-head .brand{height:34px;width:34px;object-fit:contain;flex:none}",
".pc-titles{display:flex;flex-direction:column;line-height:1;margin-right:auto}",
".pc-head h3{margin:0;font-family:var(--pc-disp);font-weight:900;font-size:21px;letter-spacing:-.01em;text-transform:uppercase;color:var(--pc-ink)}",
".pc-head .sub{font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--pc-accent);font-weight:700;margin-top:4px}",
".pc-x{border:none;background:transparent;cursor:pointer;color:var(--pc-muted);width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:22px;border-radius:0;line-height:1}",
".pc-x:hover{background:rgba(0,0,0,.06);color:var(--pc-ink)}",
".pc-ribbon{background:var(--pc-accent);overflow:hidden;display:flex;align-items:center;min-height:26px;padding:0}",
".pc-marq{display:inline-flex;align-items:center;white-space:nowrap;animation:pc-marquee 24s linear infinite;will-change:transform;line-height:1}",
".pc-marq span{display:inline-flex;align-items:center;font-family:var(--pc-disp);font-weight:800;font-size:10px;line-height:26px;letter-spacing:.22em;color:#fff;opacity:.92;text-transform:uppercase}",
".pc-ribbon b{opacity:.55;margin:0 10px;font-weight:800}",
/* P2: marquee flows to the LEFT (from 0 → -50%; track is 2x-duplicated so it loops seamlessly). */
"@keyframes pc-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
".pc-body{padding:16px 18px 20px;overflow:auto}",
".pc-grid{background-color:var(--pc-cream);background-image:linear-gradient(var(--pc-line) 1px,transparent 1px),linear-gradient(90deg,var(--pc-line) 1px,transparent 1px),linear-gradient(var(--pc-line-strong) 1px,transparent 1px),linear-gradient(90deg,var(--pc-line-strong) 1px,transparent 1px);background-size:22px 22px,22px 22px,110px 110px,110px 110px}",
".pc-signin{text-align:center;padding:30px 12px}",
".pc-tabs{display:flex;gap:6px;margin-bottom:16px;background:rgba(32,30,29,.06);padding:4px;border-radius:0}",
".pc-tab{flex:1;text-align:center;padding:9px;border-radius:0;cursor:pointer;font-family:var(--pc-disp);font-weight:700;font-size:13px;letter-spacing:.02em;color:var(--pc-muted);background:transparent;border:none;transition:all .18s ease}",
".pc-tab.on{background:var(--pc-ink);color:var(--pc-cream);box-shadow:0 3px 8px rgba(32,30,29,.24)}",
".pc-pinlbl{display:flex;align-items:center;gap:7px;font-family:var(--pc-disp);font-size:11px;font-weight:800;color:var(--pc-accent-2);text-transform:uppercase;letter-spacing:.12em;margin:2px 0 12px}",
".pc-pinwrap{margin-bottom:18px;padding-bottom:14px;border-bottom:2px dashed rgba(236,48,19,.28)}",
".pc-card{position:relative;border-radius:0;padding:17px 16px 14px;margin-bottom:20px;background:var(--pc-paper);color:var(--pc-ink);box-shadow:0 5px 16px rgba(32,30,29,.14);border:1px solid rgba(32,30,29,.07)}",
".pc-card::after{content:'';position:absolute;inset:0;border-radius:0;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)}",
".pc-card.pinned{transform:rotate(-1.4deg);box-shadow:0 12px 26px rgba(32,30,29,.24);animation:pc-stick .45s cubic-bezier(.2,.85,.3,1.25)}",
"@keyframes pc-stick{0%{transform:scale(.82) rotate(-8deg);opacity:0}60%{transform:scale(1.02) rotate(-1.4deg);opacity:1}100%{transform:rotate(-1.4deg)}}",
"@keyframes pc-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
"#pc-feed>.pc-card,#pc-flow>.pc-card{animation:pc-fadein .24s ease}",
".pc-route{display:flex;align-items:center;gap:6px;font-family:var(--pc-disp);font-size:11.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;margin-bottom:9px;padding-right:34px}",
".pc-route .arw{opacity:.5}",
".pc-msg{font-size:15.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word}",
".pc-card img{width:100%;border-radius:0;margin-top:11px;display:block;border:1px solid rgba(32,30,29,.1)}",
".pc-when{display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-family:var(--pc-disp);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--pc-muted);border:1.5px solid rgba(125,121,121,.4);border-radius:0;padding:3px 7px;transform:rotate(-1.5deg)}",
".pc-when .stamp{width:9px;height:9px;border-radius:50%;background:var(--pc-accent);opacity:.7}",
/* Card footer: timestamp (left) and Edit/Remove actions (right) on one row so they never overlap. */
".pc-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;flex-wrap:wrap}",
".pc-foot .pc-when{margin-top:0}",
".pc-acts{display:flex;align-items:center;gap:2px;flex:none;margin-left:auto}",
".pc-pinbtn{position:absolute;top:-13px;right:16px;width:44px;height:44px;border:none;background:transparent;cursor:pointer;display:flex;align-items:flex-start;justify-content:center;padding:0;transition:transform .18s ease}",
".pc-pinbtn:hover{transform:translateY(-2px)}",
".tack{width:26px;height:30px;position:relative}",
".tack .dome{position:absolute;top:0;left:3px;width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 33% 28%,#ff7a5e,var(--pc-accent) 58%,var(--pc-accent-2));box-shadow:0 4px 7px rgba(174,24,0,.45),inset -2px -2px 3px rgba(0,0,0,.28),inset 2px 2px 4px rgba(255,255,255,.55)}",
".tack .pin{position:absolute;top:17px;left:12px;width:2px;height:12px;border-radius:0 0 2px 2px;background:linear-gradient(#b9b3ab,#6f6a63);transform:rotate(4deg);transform-origin:top}",
".tack-flat{width:22px;height:22px;border-radius:50%;border:2px solid rgba(125,121,121,.5);position:relative;opacity:.6;margin-top:2px}",
".tack-flat::after{content:'';position:absolute;left:50%;top:50%;width:5px;height:5px;border-radius:50%;background:rgba(125,121,121,.6);transform:translate(-50%,-50%)}",
".pc-pinbtn:hover .tack-flat{opacity:.95;border-color:var(--pc-accent)}",
".pc-del{border:none;background:transparent;color:var(--pc-muted);cursor:pointer;font-size:10.5px;font-family:var(--pc-disp);font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.65;padding:8px 9px;border-radius:0;min-height:36px}",
".pc-del:hover{opacity:1;color:var(--pc-accent-2);background:rgba(236,48,19,.08)}",
".pc-pinbtn:hover .tack-flat::after{background:var(--pc-accent)}",
".pc-lbl{display:block;font-family:var(--pc-disp);font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--pc-ink);margin:14px 0 6px;font-weight:800}",
".pc-inp,.pc-sel,.pc-ta{width:100%;box-sizing:border-box;border:1.5px solid rgba(32,30,29,.18);border-radius:0;padding:12px;font-size:16px;font-family:inherit;background:#fff;color:var(--pc-ink)}",
".pc-inp:focus,.pc-sel:focus,.pc-ta:focus{outline:none;border-color:var(--pc-accent);box-shadow:0 0 0 3px rgba(236,48,19,.14)}",
".pc-ta{min-height:88px;resize:vertical;line-height:1.5}",
".pc-preview{max-width:100%;border-radius:0;margin-top:10px;border:1px solid rgba(32,30,29,.12);display:none}",
".pc-photowrap{position:relative;margin-top:10px;display:none;border-radius:0;overflow:hidden;border:1px solid rgba(32,30,29,.12)}",
".pc-photowrap img{display:block;width:100%;margin:0;border:none;border-radius:0}",
".pc-capov{position:absolute;left:0;right:0;padding:12px 14px;color:#fff;font-family:var(--pc-disp);font-weight:800;font-size:18px;line-height:1.2;text-shadow:0 1px 6px rgba(0,0,0,.65);word-break:break-word;pointer-events:none}",
".pc-capov.top{top:0;background:linear-gradient(rgba(0,0,0,.5),transparent 90%)}",
".pc-capov.center{top:50%;transform:translateY(-50%);text-align:center}",
".pc-capov.bottom{bottom:0;background:linear-gradient(transparent,rgba(0,0,0,.58))}",
".pc-capov.banner{bottom:0;background:var(--pc-accent);padding:11px 14px;text-shadow:none;font-size:16px;letter-spacing:.02em}",
".pc-capov.headline{top:50%;transform:translateY(-50%);text-align:center;font-size:26px;font-weight:900;letter-spacing:-.01em;text-transform:uppercase;padding:16px}",
".pc-ed{margin-top:10px;display:none}",
".pc-edcanvas-wrap{position:relative;border-radius:0;overflow:hidden;border:1px solid rgba(32,30,29,.14);background:#111;touch-action:none;line-height:0}",
".pc-ed canvas{display:block;width:100%;touch-action:none;cursor:crosshair}",
".pc-edbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}",
".pc-edtool{border:1.5px solid rgba(32,30,29,.2);background:#fff;border-radius:0;padding:7px 10px;font-size:12.5px;font-family:var(--pc-disp);font-weight:800;cursor:pointer;color:var(--pc-ink)}",
".pc-edtool.on{background:var(--pc-ink);color:#fff;border-color:var(--pc-ink)}",
".pc-edcols{display:inline-flex;gap:5px;margin-left:2px}",
".pc-edcol{width:22px;height:22px;border-radius:0;cursor:pointer;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)}",
".pc-edcol.on{box-shadow:0 0 0 2px var(--pc-ink)}",
".pc-edhint{font-size:11px;color:var(--pc-muted);margin-top:6px;line-height:1.5}",
".pc-edfilts{display:flex;gap:6px;overflow-x:auto;margin-top:8px;padding-bottom:2px;-webkit-overflow-scrolling:touch}",
".pc-edfilt{flex:none;border:1.5px solid rgba(32,30,29,.2);background:#fff;border-radius:0;padding:6px 11px;font-size:12px;font-family:var(--pc-disp);font-weight:800;cursor:pointer;color:var(--pc-ink);white-space:nowrap}",
".pc-edfilt.on{background:var(--pc-accent);color:#fff;border-color:var(--pc-accent)}",
".pc-themes{display:flex;gap:10px;margin-top:8px}",
".pc-sw{width:34px;height:34px;border-radius:0;cursor:pointer;border:2px solid transparent;box-shadow:0 2px 5px rgba(32,30,29,.14);transition:transform .15s ease}",
".pc-sw:hover{transform:translateY(-2px)}.pc-sw.sel{border-color:var(--pc-ink);transform:translateY(-2px)}",
".pc-err{color:var(--pc-accent-2);font-size:13px;margin-top:10px;min-height:16px;font-weight:600}",
".pc-btn{border:none;border-radius:0;background:var(--pc-accent);color:#fff;font-family:var(--pc-disp);font-weight:800;font-size:15px;letter-spacing:.04em;text-transform:uppercase;padding:14px 18px;cursor:pointer;margin-top:18px;width:100%;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 10px 24px rgba(174,24,0,.34);transition:transform .18s ease}",
".pc-btn:hover{transform:translateY(-2px)}.pc-btn:active{transform:scale(.98)}",
".pc-note{display:flex;gap:8px;font-size:11.5px;color:var(--pc-muted);margin-top:12px;line-height:1.55;background:rgba(236,48,19,.06);border-radius:0;padding:10px 11px}",
".pc-note svg{flex:none;margin-top:1px;color:var(--pc-accent);opacity:.8}",
".pc-note a{color:var(--pc-muted)}",
".pc-empty{text-align:center;color:var(--pc-muted);padding:34px 10px;font-size:14px}",
".pc-tabs{max-width:430px;margin-left:auto;margin-right:auto}",
".pc-write{max-width:430px;margin:0 auto}",
/* FAB group: floating + / emoji buttons anchored to the bottom-right of the modal (feed view only). */
"#pc-fabgroup{position:absolute;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:30;display:flex;align-items:center;gap:12px}",
"#pc-fabgroup.hidden{display:none}",
"#pc-addfab{width:56px;height:56px;border:none;border-radius:0;background:var(--pc-accent);color:#fff;font-size:32px;font-weight:400;line-height:1;cursor:pointer;box-shadow:0 12px 26px rgba(174,24,0,.42);display:flex;align-items:center;justify-content:center;transition:transform .18s ease,box-shadow .18s ease}",
"#pc-addfab:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 16px 30px rgba(174,24,0,.5)}#pc-addfab:active{transform:scale(.95)}",
".pc-backbtn{border:none;background:transparent;color:var(--pc-muted);font-family:var(--pc-disp);font-weight:800;font-size:12px;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;padding:6px 0;margin:2px 0 4px;display:inline-flex;align-items:center;gap:6px}",
".pc-backbtn:hover{color:var(--pc-accent)}",
"#pc-feed{position:relative;min-height:150vh}",
"#pc-flow{max-width:430px}",
".pc-card.pc-abs{position:absolute;width:min(330px,72%);margin:0;box-shadow:0 10px 24px rgba(32,30,29,.22)}",
".pc-grip{position:absolute;top:2px;left:50%;transform:translateX(-50%);padding:3px 16px;cursor:grab;touch-action:none;color:var(--pc-muted);opacity:.5;line-height:1;font-size:10px;letter-spacing:3px;user-select:none;-webkit-user-select:none}",
".pc-grip:hover{opacity:1;color:var(--pc-accent)}",
".pc-card.pc-dragging{z-index:1000;transform:scale(1.04);box-shadow:0 22px 44px rgba(32,30,29,.38);cursor:grabbing;opacity:.96}",
".pc-card.pc-dragging .pc-grip{cursor:grabbing}",
/* ---- P1: placed-card scale + resize handle ---- */
".pc-card.pc-abs{transform-origin:top left}",
".pc-resize{display:none;position:absolute;right:0;bottom:0;width:44px;height:44px;cursor:nwse-resize;touch-action:none;z-index:6;align-items:flex-end;justify-content:flex-end;padding:4px}",
".pc-card.pc-abs .pc-resize{display:flex}",
".pc-resize::after{content:'';width:14px;height:14px;border-right:3px solid var(--pc-accent);border-bottom:3px solid var(--pc-accent);opacity:.55;border-bottom-right-radius:0}",
".pc-resize:hover::after{opacity:1}",
".pc-card.pc-resizing{z-index:1000;box-shadow:0 22px 44px rgba(32,30,29,.38)}",
".pc-scalebadge{position:absolute;top:4px;right:4px;background:var(--pc-ink);color:#fff;font-family:var(--pc-disp);font-weight:800;font-size:11px;letter-spacing:.04em;padding:3px 7px;border-radius:0;z-index:7;pointer-events:none}",
/* ---- P3: edit button (author/manager) ---- */
".pc-edit{border:none;background:transparent;color:var(--pc-muted);cursor:pointer;font-size:10.5px;font-family:var(--pc-disp);font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.65;padding:8px 9px;border-radius:0;min-height:36px}",
".pc-edit:hover{opacity:1;color:var(--pc-accent);background:rgba(236,48,19,.08)}",
/* Placed (free-positioned) cards carry a bottom-right resize handle — keep the footer actions clear of it. */
".pc-card.pc-abs .pc-foot{padding-right:38px}",
".pc-editbadge{display:inline-block;margin-left:6px;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--pc-muted);opacity:.7}",
/* ---- P4: sticker overlay on posted photos ---- */
".pc-stklayer{position:absolute;inset:0;pointer-events:none;z-index:2}",
".pc-stk{position:absolute;transform-origin:center center;white-space:nowrap;will-change:transform}",
".pc-stk.emoji{font-size:34px;line-height:1}",
".pc-stk.txt{font-weight:800;font-size:24px;line-height:1.05;text-shadow:0 1px 4px rgba(0,0,0,.55),0 0 2px rgba(0,0,0,.4)}",
".pc-stkbtn{position:absolute;top:8px;right:8px;z-index:5;border:none;border-radius:0;background:rgba(32,30,29,.6);color:#fff;font-size:15px;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}",
".pc-stkbtn:hover{background:rgba(32,30,29,.82)}",
/* ---- P4: sticker editor sheet ---- */
"#pc-stkedit{position:fixed;inset:0;z-index:100001;background:rgba(32,30,29,.72);display:flex;align-items:center;justify-content:center;padding:12px;font-family:var(--pc-disp)}",
"#pc-stkedit .sheet{background:var(--pc-paper);width:min(560px,96vw);max-height:94vh;border-radius:0;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 34px 80px rgba(32,30,29,.5)}",
"#pc-stkedit .shead{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:2px solid var(--pc-ink)}",
"#pc-stkedit .shead h4{margin:0;flex:1;font-family:var(--pc-disp);font-weight:900;font-size:16px;text-transform:uppercase;color:var(--pc-ink)}",
"#pc-stkedit .sbody{padding:12px 14px;overflow:auto}",
"#pc-stkstage{position:relative;border-radius:0;overflow:hidden;background:#111;touch-action:none;line-height:0;user-select:none;-webkit-user-select:none}",
"#pc-stkstage img{display:block;width:100%}",
"#pc-stkstage .pc-stklayer{pointer-events:none}",
"#pc-stkstage .pc-stk{pointer-events:auto;cursor:grab;touch-action:none}",
"#pc-stkstage .pc-stk.sel{outline:2px dashed rgba(255,255,255,.85);outline-offset:4px}",
".pc-stk .h-del,.pc-stk .h-size{position:absolute;width:30px;height:30px;border-radius:999px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:none;align-items:center;justify-content:center;font-size:14px;line-height:1;color:var(--pc-ink);cursor:pointer;touch-action:none}",
".pc-stk.sel .h-del,.pc-stk.sel .h-size{display:flex}",
".pc-stk .h-del{top:-15px;right:-15px;color:var(--pc-accent-2)}",
".pc-stk .h-size{bottom:-15px;right:-15px;cursor:nwse-resize}",
".pc-stktools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px}",
".pc-emojis{display:flex;flex-wrap:wrap;gap:4px;max-height:96px;overflow:auto;margin-top:8px}",
".pc-emoji{border:none;background:rgba(32,30,29,.06);border-radius:0;font-size:22px;line-height:1;padding:6px 8px;cursor:pointer;min-width:40px;min-height:40px}",
".pc-emoji:hover{background:rgba(236,48,19,.12)}",
".pc-fontrow,.pc-colrow{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}",
".pc-fontchip{border:1.5px solid rgba(32,30,29,.2);background:#fff;border-radius:0;padding:6px 10px;font-size:13px;cursor:pointer;color:var(--pc-ink)}",
".pc-fontchip.on{background:var(--pc-ink);color:#fff;border-color:var(--pc-ink)}",
"#pc-stkedit .sfoot{display:flex;gap:8px;padding:12px 14px;border-top:1px solid rgba(32,30,29,.14)}",
"#pc-stkedit .sfoot button{flex:1;border:none;border-radius:0;font-family:var(--pc-disp);font-weight:800;font-size:14px;letter-spacing:.04em;text-transform:uppercase;padding:13px;cursor:pointer}",
"#pc-stkedit .sfoot .save{background:var(--pc-accent);color:#fff}",
"#pc-stkedit .sfoot .cancel{background:rgba(32,30,29,.08);color:var(--pc-ink)}",
/* ---- SOCIAL (2026-07-24): reactions + comments ---- */
".pc-social{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}",
".pc-reacts{display:flex;flex-wrap:wrap;gap:5px}",
".pc-react{display:inline-flex;align-items:center;gap:4px;border:1.5px solid rgba(32,30,29,.14);background:#fff;border-radius:0;padding:5px 8px;font-size:15px;line-height:1;cursor:pointer;color:var(--pc-ink);min-height:32px}",
".pc-react:hover{border-color:var(--pc-accent)}",
".pc-react.on{background:rgba(236,48,19,.12);border-color:var(--pc-accent)}",
".pc-rn{font-family:var(--pc-disp);font-weight:800;font-size:11px;color:var(--pc-muted)}",
".pc-react.on .pc-rn{color:var(--pc-accent-2)}",
".pc-cbtn{display:inline-flex;align-items:center;gap:5px;border:1.5px solid rgba(32,30,29,.14);background:#fff;border-radius:0;padding:5px 9px;font-family:var(--pc-disp);font-weight:800;font-size:12px;letter-spacing:.03em;cursor:pointer;color:var(--pc-ink);min-height:32px;margin-left:auto}",
".pc-cbtn:hover{border-color:var(--pc-accent);color:var(--pc-accent)}",
".pc-cbtnl{text-transform:uppercase;letter-spacing:.06em}",
"#pc-comments{position:fixed;inset:0;z-index:100001;background:rgba(32,30,29,.72);display:flex;align-items:flex-end;justify-content:center;padding:0;font-family:var(--pc-disp)}",
"#pc-comments .sheet{background:var(--pc-paper);width:min(520px,100vw);max-height:88vh;border-radius:0;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 -12px 60px rgba(32,30,29,.5)}",
"#pc-comments .shead{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:2px solid var(--pc-ink)}",
"#pc-comments .shead h4{margin:0;flex:1;font-family:var(--pc-disp);font-weight:900;font-size:16px;text-transform:uppercase;color:var(--pc-ink)}",
"#pc-comments .cbody{padding:6px 14px 10px;overflow:auto;flex:1;min-height:120px}",
"#pc-comments .cfoot{border-top:1px solid rgba(32,30,29,.14);padding:10px 14px;display:flex;flex-direction:column;gap:6px}",
".pc-cmtta{width:100%;box-sizing:border-box;border:1.5px solid rgba(32,30,29,.18);border-radius:0;padding:10px;font-size:16px;font-family:inherit;background:#fff;color:var(--pc-ink);min-height:60px;resize:vertical;line-height:1.4}",
".pc-cmtta:focus{outline:none;border-color:var(--pc-accent);box-shadow:0 0 0 3px rgba(236,48,19,.14)}",
".pc-cmtsend{border:none;border-radius:0;background:var(--pc-accent);color:#fff;font-family:var(--pc-disp);font-weight:800;font-size:13px;letter-spacing:.04em;text-transform:uppercase;padding:11px;cursor:pointer}",
".pc-cmtsend:disabled{opacity:.6;cursor:default}",
".pc-cmt{display:flex;gap:9px;padding:9px 0;border-bottom:1px solid rgba(32,30,29,.08)}",
"#pc-comments .pc-cmt .pc-avatar{width:34px;height:34px;font-size:13px;flex:none}",
".pc-cmtmain{flex:1;min-width:0}",
".pc-cmthead{display:flex;align-items:baseline;gap:8px}",
".pc-cmtname{font-family:var(--pc-disp);font-weight:800;font-size:13px;color:var(--pc-ink)}",
".pc-cmtt{font-family:var(--pc-disp);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--pc-muted)}",
".pc-cmttext{font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word;margin-top:2px;color:var(--pc-ink)}",
/* ---- P6: story tray ---- */
".pc-tray{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 14px;margin-bottom:8px;touch-action:pan-x;-webkit-overflow-scrolling:touch;border-bottom:1px solid rgba(236,48,19,.14)}",
".pc-trayitem{flex:none;display:flex;flex-direction:column;align-items:center;gap:5px;width:66px;cursor:pointer;background:none;border:none;padding:0}",
".pc-ring{position:relative;width:60px;height:60px;border-radius:999px;padding:3px;display:flex;align-items:center;justify-content:center;background:rgba(125,121,121,.35)}",
/* Ring rotation: unseen rings spin a conic-gradient on a ::before layer under the avatar (avatar lifted to z-index:1 covers the centre, so only the 3px rim appears to turn). */
".pc-ring.unseen{background:transparent}",
".pc-ring.unseen::before{content:'';position:absolute;inset:0;border-radius:999px;background:conic-gradient(from 210deg,#ff7a5e,var(--pc-accent),#ae1800,#ff7a5e);animation:pc-ringspin 7s linear infinite;z-index:0}",
"@keyframes pc-ringspin{to{transform:rotate(360deg)}}",
".pc-ring .pc-avatar{position:relative;z-index:1}",
".pc-avatar{width:100%;height:100%;border-radius:999px;object-fit:cover;background:#fff;border:2px solid var(--pc-paper);display:flex;align-items:center;justify-content:center;font-family:var(--pc-disp);font-weight:900;font-size:20px;color:#fff;overflow:hidden}",
".pc-avatar img{width:100%;height:100%;object-fit:cover;border:none;margin:0;border-radius:0}",
".pc-trayname{font-family:var(--pc-disp);font-weight:700;font-size:11px;color:var(--pc-ink);max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
/* ---- top tray: always-on story strip inserted at the very top of the page (outside the modal). Normal flow → sits above the app's sticky dark header, so it never covers it. ---- */
"#pc-toptray{display:none;background:var(--pc-paper);border-bottom:2px solid var(--pc-accent);box-shadow:0 2px 8px rgba(32,30,29,.12);font-family:var(--pc-disp);padding:7px 12px 2px}",
"#pc-toptray .pc-tray{margin-bottom:0;padding:2px 2px 8px;border-bottom:none;gap:12px}",
"#pc-toptray .pc-trayitem{width:56px;gap:3px}",
"#pc-toptray .pc-ring{width:46px;height:46px;padding:2.5px}",
"#pc-toptray .pc-avatar{font-size:16px}",
"#pc-toptray .pc-trayname{font-size:10px;max-width:54px}",
/* ---- app-provided top slot: Instagram-style story row rendered inside the host's #pc-tray-host (sits under the title band, cream background). Preferred over the body strip; empty → hidden. ---- */
"#pc-tray-host{background:var(--pc-cream);font-family:var(--pc-disp)}",
"#pc-tray-host:empty{display:none}",
"#pc-tray-host .pc-tray{margin-bottom:0;padding:9px 12px 11px;border-bottom:1px solid rgba(236,48,19,.12);gap:14px;justify-content:flex-start}",
"#pc-tray-host .pc-trayitem{width:58px;gap:4px}",
"#pc-tray-host .pc-ring{width:46px;height:46px;padding:2.5px}",
"#pc-tray-host .pc-avatar{font-size:16px}",
"#pc-tray-host .pc-trayname{font-size:10px;max-width:56px}",
/* ---- P6: story viewer ---- */
"#pc-story{position:fixed;inset:0;z-index:100002;background:rgba(20,19,18,.96);display:none;flex-direction:column;font-family:var(--pc-disp)}",
"#pc-story .sbars{display:flex;gap:4px;padding:10px 12px 4px}",
"#pc-story .sbar{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.3);overflow:hidden}",
"#pc-story .sbar.done{background:#fff}",
"#pc-story .sbar.cur{background:#fff}",
"#pc-story .stophead{display:flex;align-items:center;gap:10px;padding:6px 14px;color:#fff}",
"#pc-story .stophead .pc-avatar{width:38px;height:38px;font-size:15px;flex:none}",
"#pc-story .stophead .who{font-family:var(--pc-disp);font-weight:800;font-size:14px}",
"#pc-story .stophead .cls{margin-left:auto;background:none;border:none;color:#fff;font-size:26px;cursor:pointer;width:44px;height:44px;line-height:1}",
"#pc-story .stostage{flex:1;position:relative;display:flex;align-items:center;justify-content:center;padding:8px 16px 24px;overflow:hidden}",
"#pc-story .stocard{width:min(430px,92vw);max-height:100%;overflow:auto}",
"#pc-story .stonav{position:absolute;top:0;bottom:0;width:34%;cursor:pointer;z-index:2}",
"#pc-story .stonav.prev{left:0}",
"#pc-story .stonav.next{right:0;width:66%}",
"@media (prefers-reduced-motion:reduce){#pc-fab,#pc-try,.pc-card.pinned,#pc-feed>.pc-card,#pc-flow>.pc-card,.pc-tab,.pc-sw,.pc-btn,.pc-pinbtn,.pc-marq{animation:none;transition:none}.pc-ring.unseen::before{animation:none}}",
"@media (max-width:640px){#pc-modal{max-height:94vh}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  var state={tab:"feed", themeId:"cream", file:null, editId:null};
  var editor=null;
  /* P3: open the Write form in edit mode for an existing card (author/manager only). */
  function startEdit(id){
    var d=docById(id); if(!d){ toast("Couldn't open that card"); return; }
    if(!canDelete(d)){ toast("You can only edit your own postcards"); return; }
    state.editId=id; state.themeId=d.theme||"cream"; state.tab="write"; render();
  }

  function toast(m){
    var t=document.createElement("div");
    t.textContent=m; t.style.cssText="position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#201e1d;color:#f3f2f2;padding:11px 16px;border-radius:0;z-index:100000;font-family:'Archivo',system-ui,sans-serif;font-size:14px;max-width:88vw;box-shadow:0 10px 30px rgba(0,0,0,.3)";
    document.body.appendChild(t); setTimeout(function(){ t.remove(); },3600);
  }

  function open(){ var o=document.getElementById("pc-overlay"); if(o){ o.style.display="flex"; render(); } }
  function openCompose(){ state.editId=null; state.tab="write"; open(); }
  function close(){ var o=document.getElementById("pc-overlay"); if(o) o.style.display="none"; }

  function render(){
    var body=document.getElementById("pc-bodyc"); if(!body) return;
    if(!me){
      var fg0=document.getElementById("pc-fabgroup"); if(fg0) fg0.classList.add("hidden");
      body.innerHTML='<div class="pc-signin"><p style="color:var(--pc-muted);font-size:14px;margin-bottom:18px;line-height:1.5">Sign in with your Hideout Google account to send and read postcards.</p><button class="pc-btn" id="pc-signin-b" style="width:auto;display:inline-flex">Sign in with Google</button></div>';
      var b=document.getElementById("pc-signin-b"); if(b) b.onclick=signIn;
      return;
    }
    body.innerHTML='<div id="pc-tabc"></div>';
    /* Tab bar removed — feed is the default view; the "+" FAB group (bottom-right) opens the write form. */
    var fg=document.getElementById("pc-fabgroup");
    if(state.tab==="write"){ if(fg) fg.classList.add("hidden"); renderWrite(); }
    else { if(fg) fg.classList.remove("hidden"); renderFeedInto(); }
  }

  /* Instagram/Canva-style photo editor: freehand draw + draggable text, baked into the image on send. */
  function makeEditor(file){
    var wrap=document.getElementById("pc-ed"); if(!wrap) return;
    wrap.style.display="block";
    var COLORS=["#c81a22","#ffffff","#241d16","#3f6f9c","#4f6a44","#f4c20d"];
    var FILTERS=[["Original","none"],["Vivid","saturate(1.6) contrast(1.18)"],["Clarendon","saturate(1.35) contrast(1.12) brightness(1.05)"],["Warm","sepia(.25) saturate(1.25) brightness(1.05)"],["Cool","saturate(1.1) hue-rotate(-12deg) brightness(1.03) contrast(1.05)"],["Fade","contrast(.9) brightness(1.1) saturate(.85)"],["B&W","grayscale(1) contrast(1.1)"]];
    wrap.innerHTML='<div class="pc-edcanvas-wrap"><canvas id="pc-cv"></canvas></div>'+
      '<div class="pc-edfilts">'+FILTERS.map(function(f,i){return '<button type="button" class="pc-edfilt'+(i===0?" on":"")+'" data-f="'+f[1]+'">'+f[0]+'</button>';}).join("")+'</div>'+
      '<div class="pc-edbar">'+
        '<button type="button" class="pc-edtool on" data-mode="draw">✏️ Draw</button>'+
        '<button type="button" class="pc-edtool" data-mode="text">T Text</button>'+
        '<span class="pc-edcols">'+COLORS.map(function(c,i){return '<span class="pc-edcol'+(i===0?" on":"")+'" data-c="'+c+'" style="background:'+c+'"></span>';}).join("")+'</span>'+
        '<button type="button" class="pc-edtool" id="pc-edundo">↩ Undo</button>'+
        '<button type="button" class="pc-edtool" id="pc-edclear">Clear</button>'+
      '</div>'+
      '<div class="pc-edhint">Draw with your finger or mouse. Tap “T Text”, then tap the photo to add words (drag to move).</div>';
    var st={mode:"draw",color:COLORS[0],filter:"none",strokes:[],texts:[],order:[],cur:null,img:null,drag:null,doff:null};
    var cv=wrap.querySelector("#pc-cv"), ctx=cv.getContext("2d");
    editor={getBlob:null};
    function drawStroke(s){ if(!s.pts.length) return; ctx.strokeStyle=s.color; ctx.lineWidth=s.w; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.beginPath(); ctx.moveTo(s.pts[0].x,s.pts[0].y); for(var i=1;i<s.pts.length;i++) ctx.lineTo(s.pts[i].x,s.pts[i].y); ctx.stroke(); }
    function drawText(t){ ctx.font="800 "+t.size+"px 'Archivo',system-ui,sans-serif"; ctx.textBaseline="top"; ctx.fillStyle=t.color; ctx.shadowColor="rgba(0,0,0,.55)"; ctx.shadowBlur=4; ctx.fillText(t.str,t.x,t.y); ctx.shadowBlur=0; }
    function redraw(){ if(!st.img) return; ctx.clearRect(0,0,cv.width,cv.height); try{ctx.filter=st.filter||"none";}catch(_){} ctx.drawImage(st.img,0,0,cv.width,cv.height); try{ctx.filter="none";}catch(_){} st.strokes.forEach(drawStroke); if(st.cur) drawStroke(st.cur); st.texts.forEach(drawText); }
    function P(e){ var r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*cv.width/r.width, y:(e.clientY-r.top)*cv.height/r.height}; }
    function hit(p){ for(var i=st.texts.length-1;i>=0;i--){ var t=st.texts[i]; ctx.font="800 "+t.size+"px 'Archivo',system-ui,sans-serif"; var w=ctx.measureText(t.str).width; if(p.x>=t.x-6&&p.x<=t.x+w+6&&p.y>=t.y-6&&p.y<=t.y+t.size*1.2+6) return t; } return null; }
    cv.addEventListener("pointerdown",function(e){ e.preventDefault(); var p=P(e);
      if(st.mode==="draw"){ st.cur={color:st.color,w:Math.max(2.5,cv.width/110),pts:[p]}; try{cv.setPointerCapture(e.pointerId);}catch(_){} }
      else { var h=hit(p); if(h){ st.drag=h; st.doff={x:p.x-h.x,y:p.y-h.y}; } else { var s=window.prompt("Words to add:"); if(s&&s.trim()){ var t={str:s.trim(),x:p.x,y:p.y,color:st.color,size:Math.max(20,cv.width/13)}; st.texts.push(t); st.order.push({k:"t",v:t}); redraw(); } } }
    });
    cv.addEventListener("pointermove",function(e){ if(st.mode==="draw"&&st.cur){ e.preventDefault(); st.cur.pts.push(P(e)); redraw(); } else if(st.drag){ e.preventDefault(); var p=P(e); st.drag.x=p.x-st.doff.x; st.drag.y=p.y-st.doff.y; redraw(); } });
    function endp(){ if(st.cur){ st.strokes.push(st.cur); st.order.push({k:"s",v:st.cur}); st.cur=null; } st.drag=null; }
    cv.addEventListener("pointerup",endp); cv.addEventListener("pointercancel",endp);
    var img=new Image();
    img.onload=function(){ st.img=img; var maxW=wrap.clientWidth||360; var s=Math.min(1,maxW/img.width); cv.width=Math.round(img.width*s)||maxW; cv.height=Math.round(cv.width*img.height/img.width); redraw(); };
    img.src=URL.createObjectURL(file);
    Array.prototype.forEach.call(wrap.querySelectorAll(".pc-edtool[data-mode]"),function(b){ b.onclick=function(){ st.mode=b.getAttribute("data-mode"); Array.prototype.forEach.call(wrap.querySelectorAll(".pc-edtool[data-mode]"),function(x){ x.className="pc-edtool"+(x===b?" on":""); }); cv.style.cursor=st.mode==="draw"?"crosshair":"text"; }; });
    Array.prototype.forEach.call(wrap.querySelectorAll(".pc-edcol"),function(cel){ cel.onclick=function(){ st.color=cel.getAttribute("data-c"); Array.prototype.forEach.call(wrap.querySelectorAll(".pc-edcol"),function(x){ x.className="pc-edcol"+(x===cel?" on":""); }); }; });
    Array.prototype.forEach.call(wrap.querySelectorAll(".pc-edfilt"),function(fb){ fb.onclick=function(){ st.filter=fb.getAttribute("data-f"); Array.prototype.forEach.call(wrap.querySelectorAll(".pc-edfilt"),function(x){ x.className="pc-edfilt"+(x===fb?" on":""); }); redraw(); }; });
    wrap.querySelector("#pc-edundo").onclick=function(){ var last=st.order.pop(); if(!last) return; var arr=last.k==="s"?st.strokes:st.texts; var i=arr.indexOf(last.v); if(i>=0) arr.splice(i,1); redraw(); };
    wrap.querySelector("#pc-edclear").onclick=function(){ st.strokes=[]; st.texts=[]; st.order=[]; redraw(); };
    editor.getBlob=function(cb){ if(!st.img){ cb(null); return; } var out=document.createElement("canvas"); var cap=1280, sc=Math.min(1,cap/Math.max(st.img.width,st.img.height)); out.width=Math.round(st.img.width*sc); out.height=Math.round(st.img.height*sc); var o=out.getContext("2d"); try{o.filter=st.filter||"none";}catch(_){} o.drawImage(st.img,0,0,out.width,out.height); try{o.filter="none";}catch(_){} var rx=out.width/cv.width, ry=out.height/cv.height;
      st.strokes.forEach(function(s){ o.strokeStyle=s.color; o.lineWidth=s.w*rx; o.lineCap="round"; o.lineJoin="round"; o.beginPath(); o.moveTo(s.pts[0].x*rx,s.pts[0].y*ry); for(var i=1;i<s.pts.length;i++) o.lineTo(s.pts[i].x*rx,s.pts[i].y*ry); o.stroke(); });
      st.texts.forEach(function(t){ o.font="800 "+(t.size*rx)+"px 'Archivo',system-ui,sans-serif"; o.textBaseline="top"; o.fillStyle=t.color; o.shadowColor="rgba(0,0,0,.55)"; o.shadowBlur=4*rx; o.fillText(t.str,t.x*rx,t.y*ry); o.shadowBlur=0; });
      try{ out.toBlob(function(b){ cb(b); },"image/jpeg",0.9); }catch(_){ cb(null); }
    };
  }

  function renderWrite(){
    var c=document.getElementById("pc-tabc"); if(!c) return;
    var editing=!!state.editId, ed=editing?docById(state.editId):null;
    if(editing&&!ed){ editing=false; state.editId=null; }
    var opts=staff.filter(function(s){ return s.email!==me.email; }).map(function(s){ return '<option value="'+esc(s.email)+'">'+esc(s.name)+'</option>'; }).join("");
    var sw=THEMES.map(function(t){ return '<div class="pc-sw'+(t.id===state.themeId?" sel":"")+'" data-th="'+t.id+'" style="background:'+t.bg+'"></div>'; }).join("");
    c.innerHTML=
      '<div class="pc-write">'+
      '<button type="button" class="pc-backbtn" id="pc-back">← Back to board</button>'+
      (editing
        ? '<div class="pc-pinlbl" style="justify-content:space-between">Editing your postcard<a href="#" id="pc-canceledit" style="color:var(--pc-muted);text-transform:none;letter-spacing:0;font-weight:700">cancel</a></div>'
        : '<label class="pc-lbl">To</label><select class="pc-sel" id="pc-to"><option value="">Everyone (open)</option>'+opts+'</select>')+
      '<label class="pc-lbl">Message</label><textarea class="pc-ta" id="pc-msg" maxlength="600" placeholder="Say something kind…">'+(editing?esc(ed.message||""):"")+'</textarea>'+
      (editing?"":'<label class="pc-lbl">Photo (optional — draw &amp; add text after you pick one)</label><input class="pc-inp" type="file" accept="image/*" id="pc-file"><div class="pc-ed" id="pc-ed"></div>')+
      '<label class="pc-lbl">Postcard colour</label><div class="pc-themes">'+sw+'</div>'+
      '<div class="pc-err" id="pc-err"></div>'+
      '<button class="pc-btn" id="pc-send">'+(editing?'Save changes':(ICON_SEND+' Send postcard'))+'</button>'+
      '<div style="text-align:center;margin-top:8px;font-size:13px;color:var(--pc-muted)" id="pc-status"></div>'+
      '<div class="pc-note">'+ICON_SHIELD+'<span>Every postcard is checked automatically before it posts. Messages meant to insult, mock or mislead won’t go through. Signed in as '+esc(me.name)+' · <a href="#" id="pc-out">sign out</a></span></div>'+
      '</div>';
    Array.prototype.forEach.call(c.querySelectorAll(".pc-sw"),function(el){ el.onclick=function(){ state.themeId=el.getAttribute("data-th"); Array.prototype.forEach.call(c.querySelectorAll(".pc-sw"),function(x){ x.className="pc-sw"+(x.getAttribute("data-th")===state.themeId?" sel":""); }); }; });
    var fileEl=document.getElementById("pc-file");
    if(fileEl){ fileEl.onchange=function(){ var f=(fileEl.files||[])[0]; if(f){ makeEditor(f); } else { editor=null; var w=document.getElementById("pc-ed"); if(w){ w.style.display="none"; w.innerHTML=""; } } }; }
    var ce=document.getElementById("pc-canceledit"); if(ce) ce.onclick=function(e){ e.preventDefault(); state.editId=null; state.tab="feed"; render(); };
    var bk=document.getElementById("pc-back"); if(bk) bk.onclick=function(){ state.editId=null; state.tab="feed"; render(); };
    var out=document.getElementById("pc-out"); if(out) out.onclick=function(e){ e.preventDefault(); signOut(); };
    var sb=document.getElementById("pc-send");
    sb.onclick=function(){
      var msg=document.getElementById("pc-msg").value;
      var err=document.getElementById("pc-err"), stt=document.getElementById("pc-status");
      err.textContent=""; sb.disabled=true;
      if(editing){
        var newMsg=(msg||"").trim();
        if(!newMsg){ err.textContent="Write a message first."; sb.disabled=false; return; }
        stt.textContent="Checking…";
        moderate(newMsg).then(function(mod){
          if(!mod.allow){ sb.disabled=false; stt.textContent=""; err.textContent=(mod._soft?"":"Held: ")+(mod.reason||"That message can't be posted."); return; }
          var oldFields={message:ed.message||"", theme:ed.theme||"cream"};
          db.collection("postcards").doc(state.editId).update({message:newMsg,theme:state.themeId,editedAt:firebase.firestore.FieldValue.serverTimestamp(),editedBy:me.email})
            .then(function(){ pushUndo({type:"restoreFields", id:state.editId, fields:oldFields}); toast("Postcard updated"); state.editId=null; state.tab="feed"; render(); })
            .catch(function(e){ sb.disabled=false; stt.textContent=""; err.textContent=(e&&e.message)||"Couldn't save. Try again."; });
        });
        return;
      }
      var toSel=document.getElementById("pc-to");
      var toEmail=toSel.value, toName=toEmail?(toSel.options[toSel.selectedIndex].text):"Everyone";
      function fire(fileToSend){
        stt.textContent="Sending…";
        send({toName:toName,toEmail:toEmail,message:msg,themeId:state.themeId,file:fileToSend},function(res){
          sb.disabled=false; stt.textContent="";
          if(res.error){ err.textContent=res.error; return; }
          if(res.blocked){ err.textContent=(res.soft?"":"Held: ")+res.reason; return; }
          if(res.ok){ if(res.id) pushUndo({type:"delete", id:res.id}); toast("Postcard sent ❤"); state.tab="feed"; render(); }
        });
      }
      if(editor&&editor.getBlob){ stt.textContent="Preparing photo…"; editor.getBlob(function(b){ fire(b?new File([b],"postcard.jpg",{type:"image/jpeg"}):null); }); }
      else fire(null);
    };
  }

  function renderFeedInto(){
    var c=document.getElementById("pc-tabc"); if(!c) return;
    state.editId=null;
    c.innerHTML='<div id="pc-tray-c"></div><div id="pc-feed"></div>'; renderFeed();
  }
  function canDelete(d){
    return !!(me&&(me.email===(d.fromEmail||"").toLowerCase()||me.role==="manager"));
  }
  /* Free-placement position: pos.x = % of board width (0-100), pos.y = px from board top.
     Any malformed/missing pos falls back to the normal flow layout (fail-safe). */
  function getPos(d){
    try{
      var p=d&&d.pos; if(!p) return null;
      var x=Number(p.x), y=Number(p.y);
      if(!isFinite(x)||!isFinite(y)) return null;
      return {x:Math.max(0,Math.min(100,x)), y:Math.max(0,Math.min(50000,y))};
    }catch(e){ return null; }
  }
  /* P1: per-card scale (shared). Non-number or out-of-range → 1 (fail-safe). */
  function getScale(d){
    try{ var s=Number(d&&d.scale); if(!isFinite(s)) return 1; return Math.max(0.5,Math.min(2.5,s)); }catch(e){ return 1; }
  }
  function docById(id){ for(var i=0;i<feedItems.length;i++){ if(feedItems[i]._id===id) return feedItems[i]; } return null; }
  /* P4: sticker overlay data. Always returns a safe array (bad data → []). */
  var STK_FONTS=[
    {id:"system",name:"Aa",css:"system-ui,sans-serif"},
    {id:"archivo",name:"Archivo",css:"'Archivo',system-ui,sans-serif"},
    {id:"marker",name:"Marker",css:"'Permanent Marker',cursive"},
    {id:"serif",name:"Serif",css:"'Playfair Display',serif"},
    {id:"mono",name:"Mono",css:"'Space Mono',monospace"},
    {id:"hand",name:"Hand",css:"'Caveat',cursive"}
  ];
  function fontCss(id){ for(var i=0;i<STK_FONTS.length;i++){ if(STK_FONTS[i].id===id) return STK_FONTS[i].css; } return STK_FONTS[0].css; }
  function clampNum(v,lo,hi,dft){ v=Number(v); if(!isFinite(v)) return dft; return Math.max(lo,Math.min(hi,v)); }
  function getStickers(d){
    try{
      var a=d&&d.stickers; if(!a||Object.prototype.toString.call(a)!=="[object Array]") return [];
      var out=[];
      for(var i=0;i<a.length&&out.length<20;i++){
        var s=a[i]||{}; if(s.t!=="emoji"&&s.t!=="text") continue;
        var o={t:s.t,x:clampNum(s.x,0,1,.5),y:clampNum(s.y,0,1,.5),scale:clampNum(s.scale,0.3,3,1),rot:clampNum(s.rot,-180,180,0)};
        if(s.t==="emoji"){ o.ch=String(s.ch||"").slice(0,8); if(!o.ch) continue; }
        else { o.str=String(s.str||"").slice(0,60); if(!o.str) continue; o.font=String(s.font||"system"); o.color=/^#[0-9a-fA-F]{3,8}$/.test(s.color)?s.color:"#ffffff"; }
        out.push(o);
      }
      return out;
    }catch(e){ return []; }
  }
  function stickerLayerHtml(list){
    if(!list.length) return "";
    var h='<div class="pc-stklayer">';
    list.forEach(function(s){
      var tf='translate(-50%,-50%) scale('+s.scale+') rotate('+s.rot+'deg)';
      var pos='left:'+(s.x*100)+'%;top:'+(s.y*100)+'%;transform:'+tf;
      if(s.t==="emoji") h+='<div class="pc-stk emoji" style="'+pos+'">'+esc(s.ch)+'</div>';
      else h+='<div class="pc-stk txt" style="'+pos+';font-family:'+fontCss(s.font)+';color:'+esc(s.color)+'">'+esc(s.str)+'</div>';
    });
    return h+'</div>';
  }
  /* P5/P6: avatar — photoURL if present, else initials on an email-hashed colour. */
  function avColor(email){
    var h=0, s=String(email||""); for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; }
    var hues=["#c81a22","#8f1015","#3f6f9c","#4f6a44","#a05a00","#6b4c9a","#0f7b6c"];
    return hues[h%hues.length];
  }
  function initials(name,email){
    var n=String(name||email||"?").trim(); if(!n) return "?";
    var parts=n.split(/\s+/);
    if(parts.length>=2) return (parts[0].charAt(0)+parts[1].charAt(0)).toUpperCase();
    return n.slice(0,2).toUpperCase();
  }
  function avatarHtml(email,name,photoURL,cls){
    var url=photoURL||(staffMap[String(email||"").toLowerCase()]||{}).photoURL||"";
    var nm=name||(staffMap[String(email||"").toLowerCase()]||{}).name||email;
    if(url) return '<div class="pc-avatar '+(cls||"")+'" style="background:'+avColor(email)+'"><img src="'+esc(url)+'" alt="" onerror="this.style.display=\'none\'"></div>';
    return '<div class="pc-avatar '+(cls||"")+'" style="background:'+avColor(email)+'">'+esc(initials(nm,email))+'</div>';
  }
  /* P3: local-only undo stack of inverse ops (own actions only; max 20; lost on reload). */
  var undoStack=[];
  function pushUndo(entry){ if(!entry) return; entry.by=(me&&me.email)||""; undoStack.push(entry); if(undoStack.length>20) undoStack.shift(); }
  function fv(){ return firebase.firestore.FieldValue; }
  function applyInverse(en){
    if(!db||!en) return;
    var col=db.collection("postcards");
    if(en.type==="delete"){ /* undo a create */
      col.doc(en.id).delete().then(function(){ toast("Undo — postcard removed"); }).catch(function(e){ toast("Couldn't undo — "+((e&&e.message)||"try again")); });
    } else if(en.type==="recreate"){ /* undo a delete — new ID (content re-posted) */
      var data={}; for(var k in en.data){ if(en.data.hasOwnProperty(k)&&k!=="_id") data[k]=en.data[k]; }
      data.createdAt=fv().serverTimestamp();
      col.add(data).then(function(){ toast("Undo — postcard re-posted (new card)"); }).catch(function(e){ toast("Couldn't undo — "+((e&&e.message)||"try again")); });
    } else if(en.type==="restorePos"){ /* undo a move/resize */
      col.doc(en.id).get().then(function(snap){
        if(!snap||!snap.exists){ toast("That card is gone — nothing to undo"); return; }
        var patch={posBy:(me&&me.email)||"",posAt:fv().serverTimestamp()};
        patch.pos=en.pos?{x:en.pos.x,y:en.pos.y}:fv().delete();
        patch.scale=(en.scale==null)?fv().delete():en.scale;
        return col.doc(en.id).set(patch,{merge:true}).then(function(){ toast("Undo"); });
      }).catch(function(e){ toast("Couldn't undo — "+((e&&e.message)||"try again")); });
    } else if(en.type==="restoreFields"){ /* undo an edit / sticker change */
      col.doc(en.id).get().then(function(snap){
        if(!snap||!snap.exists){ toast("That card is gone — nothing to undo"); return; }
        return col.doc(en.id).set(en.fields,{merge:true}).then(function(){ toast("Undo"); });
      }).catch(function(e){ toast("Couldn't undo — "+((e&&e.message)||"try again")); });
    }
  }
  function doUndo(){
    var en=undoStack.pop(); if(!en) return;
    if(en.by!==((me&&me.email)||"")) return; /* only your own actions */
    applyInverse(en);
  }
  function cardHtml(d, pinned){
    var th=theme(d.theme);
    var pos=getPos(d);
    var sc=getScale(d);
    var route=esc(d.fromName||"?")+' <span class="arw">→</span> '+esc(d.toName||"Everyone");
    var mine=canDelete(d);
    var stk=d.photoUrl?getStickers(d):[];
    var styleTf=(pos&&sc!==1)?';transform:scale('+sc+')':'';
    return '<div class="pc-card'+(pinned?" pinned":"")+(pos?" pc-abs":"")+'" data-id="'+esc(d._id)+'" data-scale="'+sc+'" style="background:'+th.bg+';color:'+th.ink+(pos?';left:'+pos.x+'%;top:'+pos.y+'px':'')+styleTf+'">'+
      '<span class="pc-grip" title="Drag to move" aria-hidden="true">•&nbsp;•&nbsp;•</span>'+
      '<button class="pc-pinbtn" data-pin="'+esc(d._id)+'" data-cur="'+(pinned?"1":"0")+'" aria-label="'+(pinned?"Unpin":"Pin")+' postcard">'+(pinned?TACK_ON:TACK_OFF)+'</button>'+
      '<div class="pc-route" style="color:'+th.accent+'">'+route+'</div>'+
      '<div class="pc-msg">'+esc(d.message||"")+'</div>'+
      (d.photoUrl?('<div class="pc-photowrap" style="display:block"><img src="'+esc(d.photoUrl)+'" alt="">'+
        (d.caption?'<div class="pc-capov '+esc(d.capPos||"bottom")+'">'+esc(d.caption)+'</div>':"")+
        stickerLayerHtml(stk)+
        (mine?'<button class="pc-stkbtn" data-stk="'+esc(d._id)+'" title="Add stickers" aria-label="Add stickers">😀</button>':"")+
      '</div>'):"")+
      '<div class="pc-social">'+reactionBarHtml(d)+
        '<button type="button" class="pc-cbtn" data-comments="'+esc(d._id)+'" aria-label="Comments">💬<span class="pc-cbtnl">Comments</span>'+(commentCount(d)?'<span class="pc-rn">'+commentCount(d)+'</span>':"")+'</button>'+
      '</div>'+
      '<div class="pc-foot">'+
        '<div class="pc-when"><span class="stamp"></span>'+esc(fmtTime(d.createdAt))+(d.editedAt?'<span class="pc-editbadge">edited</span>':"")+'</div>'+
        (mine?('<div class="pc-acts">'+
          '<button class="pc-edit" data-edit="'+esc(d._id)+'" aria-label="Edit postcard">Edit</button>'+
          '<button class="pc-del" data-del="'+esc(d._id)+'" aria-label="Remove postcard">Remove</button>'+
        '</div>'):"")+
      '</div>'+
      (pos?'<span class="pc-resize" data-resize="'+esc(d._id)+'" title="Drag to resize" aria-hidden="true"></span>':"")+
    '</div>';
  }
  var dragCur=null, dragPending=false;
  function renderFeed(){
    var f=document.getElementById("pc-feed"); if(!f) return;
    if(dragCur){ dragPending=true; return; }
    if(!feedItems.length){ f.innerHTML='<div class="pc-empty">No postcards yet. Be the first to send one!</div>'; return; }
    var posed=[], pins=[], rest=[];
    feedItems.forEach(function(d){ if(getPos(d)) posed.push(d); else if(d.pinned) pins.push(d); else rest.push(d); });
    var html='<div id="pc-flow">';
    if(pins.length){ html+='<div class="pc-pinlbl">'+ICON_PINLBL+' Pinned</div><div class="pc-pinwrap">'+pins.map(function(d){ return cardHtml(d,true); }).join("")+'</div>'; }
    html+=rest.map(function(d){ return cardHtml(d,false); }).join("")+'</div>';
    html+=posed.map(function(d){ return cardHtml(d,!!d.pinned); }).join("");
    f.innerHTML=html;
    Array.prototype.forEach.call(f.querySelectorAll(".pc-pinbtn"),function(el){ el.onclick=function(){ togglePin(el.getAttribute("data-pin"), el.getAttribute("data-cur")==="1"); }; });
    Array.prototype.forEach.call(f.querySelectorAll(".pc-del"),function(el){ el.onclick=function(){ removeCard(el.getAttribute("data-del"), el); }; });
    Array.prototype.forEach.call(f.querySelectorAll(".pc-edit"),function(el){ el.onclick=function(){ startEdit(el.getAttribute("data-edit")); }; });
    Array.prototype.forEach.call(f.querySelectorAll(".pc-stkbtn"),function(el){ el.onclick=function(e){ e.preventDefault(); e.stopPropagation(); openStickerEditor(el.getAttribute("data-stk")); }; });
    Array.prototype.forEach.call(f.querySelectorAll(".pc-react"),function(el){ el.onclick=function(e){ e.preventDefault(); e.stopPropagation(); toggleReaction(el.getAttribute("data-rid"), el.getAttribute("data-emo")); }; });
    Array.prototype.forEach.call(f.querySelectorAll(".pc-cbtn"),function(el){ el.onclick=function(e){ e.preventDefault(); e.stopPropagation(); openComments(el.getAttribute("data-comments")); }; });
    Array.prototype.forEach.call(f.querySelectorAll(".pc-card[data-id]"),function(el){ enableDrag(el,f); enableResize(el,f); });
    renderTray();
    try{ requestAnimationFrame(function(){ fitBoard(f); }); }catch(e){}
  }
  /* Keep every placed card inside the board and grow the board so nothing is cut off. */
  function fitBoard(board){
    try{
      if(!board||!board.clientWidth) return;
      board.style.minHeight="";
      var bw=board.clientWidth, maxB=0;
      Array.prototype.forEach.call(board.querySelectorAll(".pc-card.pc-abs"),function(el){
        var sc=parseFloat(el.getAttribute("data-scale"))||1;
        var w=el.offsetWidth*sc, l=el.offsetLeft, t=el.offsetTop;
        var nl=Math.max(0,Math.min(l,bw-w));
        if(Math.abs(nl-l)>1) el.style.left=((nl/bw)*100).toFixed(2)+"%";
        if(t<0){ el.style.top="0px"; t=0; }
        /* P1: use the SCALED height so a bigger post-it never gets cut off. */
        var h=el.getBoundingClientRect().height||el.offsetHeight*sc;
        maxB=Math.max(maxB,t+h);
      });
      if(maxB+40>board.clientHeight) board.style.minHeight=(maxB+40)+"px";
    }catch(e){}
  }
  /* Shared pinboard position — merge-saved so it never touches other card fields.
     Fail-safe: if the save fails we toast and re-render from server state. */
  function savePos(id,x,y){ savePosScale(id,x,y,undefined); }
  /* P1: merge-save pos and/or scale together (pass undefined to leave a field untouched). */
  function savePosScale(id,x,y,scale){
    if(!db||!id) return;
    try{
      var patch={posBy:(me&&me.email)||"",posAt:firebase.firestore.FieldValue.serverTimestamp()};
      if(x!=null&&y!=null) patch.pos={x:x,y:y};
      if(scale!=null) patch.scale=scale;
      db.collection("postcards").doc(id).set(patch,{merge:true})
        .catch(function(e){ toast("Couldn't save the new spot — "+((e&&e.message)||"try again")); renderFeed(); });
    }catch(e){}
  }
  /* Drag to place: mouse can grab the card body (buttons/links excluded);
     touch uses the "• • •" grip (touch-action:none) so normal scrolling never fights the drag. */
  function enableDrag(el, board){
    var grip=el.querySelector(".pc-grip");
    if(grip){
      grip.addEventListener("pointerdown",function(e){
        if(dragCur) return;
        if(e.button&&e.button!==0) return;
        e.preventDefault();
        beginDrag(el,board,e,true);
      });
    }
    el.addEventListener("pointerdown",function(e){
      if(dragCur) return;
      if(e.pointerType!=="mouse"||e.button!==0) return;
      if(e.target&&e.target.closest&&e.target.closest("button,a,select,input,textarea,.pc-grip,.pc-resize")) return;
      e.preventDefault();
      beginDrag(el,board,e,false);
    });
  }
  function beginDrag(el, board, e, immediate){
    var pid=e.pointerId, startX=e.clientX, startY=e.clientY, active=false, orig=null;
    var _pd=docById(el.getAttribute("data-id")), prevPos=_pd?getPos(_pd):null, prevScale=_pd?getScale(_pd):1;
    function activate(){
      if(active) return; active=true; dragCur=el;
      var brect=board.getBoundingClientRect(), r=el.getBoundingClientRect();
      orig={ox:startX-r.left, oy:startY-r.top};
      if(!el.classList.contains("pc-abs")){
        el.style.width=r.width+"px";
        el.style.left=(r.left-brect.left)+"px";
        el.style.top=(r.top-brect.top)+"px";
        el.classList.add("pc-abs");
      }
      el.classList.add("pc-dragging");
      try{ el.setPointerCapture(pid); }catch(_){}
    }
    function onMove(ev){
      if(ev.pointerId!==pid) return;
      if(!active){ if(Math.abs(ev.clientX-startX)+Math.abs(ev.clientY-startY)<6) return; activate(); }
      ev.preventDefault();
      var brect=board.getBoundingClientRect();
      var bw=board.clientWidth, bh=board.clientHeight, w=el.offsetWidth, h=el.offsetHeight;
      var l=ev.clientX-brect.left-orig.ox, t=ev.clientY-brect.top-orig.oy;
      l=Math.max(0,Math.min(l,Math.max(0,bw-w)));
      t=Math.max(0,Math.min(t,Math.max(0,bh-h)));
      el.style.left=l+"px"; el.style.top=t+"px";
    }
    function onUp(ev){ if(ev.pointerId!==pid) return; var was=active; cleanup(); if(was) finish(); }
    function onCancel(ev){
      if(ev.pointerId!==pid) return;
      var was=active; cleanup();
      if(was){ dragCur=null; dragPending=false; renderFeed(); }
    }
    function cleanup(){
      el.removeEventListener("pointermove",onMove);
      el.removeEventListener("pointerup",onUp);
      el.removeEventListener("pointercancel",onCancel);
      try{ el.releasePointerCapture(pid); }catch(_){}
      el.classList.remove("pc-dragging");
    }
    function finish(){
      var bw=board.clientWidth||1;
      var x=Math.round((el.offsetLeft/bw)*10000)/100;
      var y=Math.round(el.offsetTop);
      x=Math.max(0,Math.min(100,x)); y=Math.max(0,y);
      el.style.left=x+"%"; el.style.top=y+"px";
      dragCur=null;
      var id=el.getAttribute("data-id");
      pushUndo({type:"restorePos", id:id, pos:prevPos, scale:(prevScale===1?null:prevScale)});
      savePos(id, x, y);
      if(dragPending){ dragPending=false; renderFeed(); }
      else fitBoard(board);
    }
    if(immediate) activate();
    el.addEventListener("pointermove",onMove);
    el.addEventListener("pointerup",onUp);
    el.addEventListener("pointercancel",onCancel);
  }
  /* P1: corner-handle resize (keeps aspect ratio — uniform scale only). Shared via {merge}. */
  function enableResize(el, board){
    var h=el.querySelector(".pc-resize"); if(!h) return;
    h.addEventListener("pointerdown",function(e){
      if(dragCur) return;
      if(e.button&&e.button!==0) return;
      e.preventDefault(); e.stopPropagation();
      beginResize(el,board,e);
    });
  }
  function beginResize(el, board, e){
    var pid=e.pointerId, id=el.getAttribute("data-id");
    var _d=docById(id), prevPos=_d?getPos(_d):null, prevScale=_d?getScale(_d):1;
    dragCur=el; /* reuse the drag lock so onSnapshot doesn't re-render mid-resize */
    var baseW=el.offsetWidth||1;                       /* unscaled layout width */
    var curScale=parseFloat(el.getAttribute("data-scale"))||1;
    el.classList.add("pc-resizing");
    var badge=document.createElement("span"); badge.className="pc-scalebadge"; badge.textContent=Math.round(curScale*100)+"%"; el.appendChild(badge);
    try{ el.setPointerCapture(pid); }catch(_){}
    function onMove(ev){
      if(ev.pointerId!==pid) return; ev.preventDefault();
      var b=board.getBoundingClientRect();
      var leftVp=b.left+el.offsetLeft;                 /* top-left stays put (origin top-left) */
      var s=(ev.clientX-leftVp)/baseW;
      s=Math.max(0.5,Math.min(2.5,s));
      curScale=s; el.style.transform="scale("+s+")"; badge.textContent=Math.round(s*100)+"%";
    }
    function cleanup(){
      el.removeEventListener("pointermove",onMove);
      el.removeEventListener("pointerup",onUp);
      el.removeEventListener("pointercancel",onCancel);
      try{ el.releasePointerCapture(pid); }catch(_){}
      el.classList.remove("pc-resizing");
      if(badge&&badge.parentNode) badge.parentNode.removeChild(badge);
    }
    function onUp(ev){
      if(ev.pointerId!==pid) return; cleanup();
      var s=Math.round(curScale*100)/100; el.setAttribute("data-scale",s); dragCur=null;
      pushUndo({type:"restorePos", id:id, pos:prevPos, scale:(prevScale===1?null:prevScale)});
      var bw=board.clientWidth||1;
      var x=Math.max(0,Math.min(100,Math.round((el.offsetLeft/bw)*10000)/100));
      var y=Math.max(0,Math.round(el.offsetTop));
      savePosScale(id, x, y, s);
      if(dragPending){ dragPending=false; renderFeed(); } else fitBoard(board);
    }
    function onCancel(ev){ if(ev.pointerId!==pid) return; cleanup(); dragCur=null; dragPending=false; renderFeed(); }
    el.addEventListener("pointermove",onMove);
    el.addEventListener("pointerup",onUp);
    el.addEventListener("pointercancel",onCancel);
  }
  function removeCard(id, el){
    if(!db||!id) return;
    if(!window.confirm("Remove this postcard? You can undo with Ctrl/⌘+Z (it re-posts as a new card).")) return;
    if(el) el.disabled=true;
    var snap=docById(id), data=null;
    if(snap){ data={}; for(var k in snap){ if(snap.hasOwnProperty(k)&&k!=="_id") data[k]=snap[k]; } }
    db.collection("postcards").doc(id).delete()
      .then(function(){ if(data) pushUndo({type:"recreate", data:data}); toast("Postcard removed"); })
      .catch(function(e){ if(el) el.disabled=false; toast("Couldn't remove — "+((e&&e.message)||"try again")); });
  }
  function togglePin(id, cur){
    if(!db||!id) return;
    db.collection("postcards").doc(id).update({pinned:!cur, pinnedAt:firebase.firestore.FieldValue.serverTimestamp()})
      .catch(function(e){ toast("Couldn't pin — "+((e&&e.message)||"try again")); });
  }

  /* ===================== SOCIAL: emoji reactions (2026-07-24) =====================
     Stored on the postcard doc as reactions map {emoji:[email,...]}, merged in with
     arrayUnion/arrayRemove so a toggle never clobbers other people's reactions. The existing
     onSnapshot feed keeps counts live. Fail-safe: bad/missing data renders as no reactions. */
  var REACTIONS=["👍","❤️","😂","🔥","👏"];
  function getReactions(d){
    try{
      var r=d&&d.reactions; if(!r||typeof r!=="object") return {};
      var out={};
      for(var k in r){ if(!r.hasOwnProperty(k)) continue; var a=r[k]; if(Object.prototype.toString.call(a)==="[object Array]"){ var em=[]; for(var i=0;i<a.length;i++){ if(typeof a[i]==="string") em.push(a[i].toLowerCase()); } out[k]=em; } }
      return out;
    }catch(e){ return {}; }
  }
  function reactionBarHtml(d){
    try{
      var map=getReactions(d), myEmail=(me&&me.email)||"";
      var h='<div class="pc-reacts">';
      for(var i=0;i<REACTIONS.length;i++){
        var emo=REACTIONS[i], arr=map[emo]||[], n=arr.length, on=myEmail&&arr.indexOf(myEmail)>=0;
        h+='<button type="button" class="pc-react'+(on?" on":"")+'" data-rid="'+esc(d._id)+'" data-emo="'+esc(emo)+'" aria-label="React '+esc(emo)+'">'+emo+(n?'<span class="pc-rn">'+n+'</span>':"")+'</button>';
      }
      return h+'</div>';
    }catch(e){ return ""; }
  }
  function toggleReaction(id, emo){
    if(!db||!id||!me||!me.email) return;
    try{
      var d=docById(id), arr=(getReactions(d)[emo])||[];
      var on=arr.indexOf(me.email)>=0;
      var val=on?firebase.firestore.FieldValue.arrayRemove(me.email):firebase.firestore.FieldValue.arrayUnion(me.email);
      db.collection("postcards").doc(id).update(new firebase.firestore.FieldPath("reactions",emo), val)
        .catch(function(e){ toast("Couldn't react — "+((e&&e.message)||"try again")); });
    }catch(e){}
  }

  /* ===================== SOCIAL: comments (2026-07-24) =====================
     Comments live in the subcollection postcards/{id}/comments ({text,byEmail,byName,ts}) to keep
     the parent doc small. A live commentCount on the parent (FieldValue.increment) drives the feed
     badge without extra reads. The thread opens in a dedicated modal with its own onSnapshot that is
     unsubscribed on close. Every message runs through the same moderate() check as postcards. */
  var CMT_MAX=500;
  function commentCount(d){ try{ var n=Number(d&&d.commentCount); return isFinite(n)&&n>0?n:0; }catch(e){ return 0; } }
  function openComments(id){
    var d=docById(id); if(!d){ toast("Couldn't open that card"); return; }
    if(!me){ toast("Sign in to comment"); return; }
    var unsub=null;
    var host=document.createElement("div"); host.id="pc-comments";
    host.innerHTML='<div class="sheet">'+
      '<div class="shead"><h4>Comments</h4><button class="pc-x" id="pc-cmtx" aria-label="Close">×</button></div>'+
      '<div class="cbody" id="pc-cmtlist"><div class="pc-empty" style="padding:20px 10px">Loading…</div></div>'+
      '<div class="cfoot"><textarea class="pc-cmtta" id="pc-cmtinput" maxlength="'+CMT_MAX+'" placeholder="Write a comment…"></textarea>'+
        '<div class="pc-err" id="pc-cmterr" style="margin:2px 0 0"></div>'+
        '<button type="button" class="pc-cmtsend" id="pc-cmtsend">Post comment</button></div>'+
    '</div>';
    document.body.appendChild(host);
    function close(){ try{ if(unsub) unsub(); }catch(e){} unsub=null; if(host.parentNode) host.parentNode.removeChild(host); }
    host.__close=close; /* so global Escape / auth-loss handlers can unsubscribe cleanly */
    var listEl=host.querySelector("#pc-cmtlist");
    function renderList(items){
      if(!items.length){ listEl.innerHTML='<div class="pc-empty" style="padding:24px 10px">No comments yet. Say something kind.</div>'; return; }
      listEl.innerHTML=items.map(function(c){
        var st=staffMap[String(c.byEmail||"").toLowerCase()]||{};
        var nm=st.name||c.byName||c.byEmail||"Someone";
        return '<div class="pc-cmt">'+avatarHtml(c.byEmail,nm,st.photoURL,"")+
          '<div class="pc-cmtmain"><div class="pc-cmthead"><span class="pc-cmtname">'+esc(nm)+'</span><span class="pc-cmtt">'+esc(fmtTime(c.ts))+'</span></div>'+
          '<div class="pc-cmttext">'+esc(c.text||"")+'</div></div></div>';
      }).join("");
      listEl.scrollTop=listEl.scrollHeight;
    }
    try{
      unsub=db.collection("postcards").doc(id).collection("comments").orderBy("ts","asc").limit(200)
        .onSnapshot(function(qs){ var arr=[]; qs.forEach(function(doc){ var c=doc.data()||{}; arr.push(c); }); renderList(arr); },
          function(){ listEl.innerHTML='<div class="pc-empty" style="padding:24px 10px">Couldn\'t load comments right now.</div>'; });
    }catch(e){ listEl.innerHTML='<div class="pc-empty" style="padding:24px 10px">Couldn\'t load comments right now.</div>'; }
    var ta=host.querySelector("#pc-cmtinput"), errEl=host.querySelector("#pc-cmterr"), sendB=host.querySelector("#pc-cmtsend");
    sendB.onclick=function(){
      var text=(ta.value||"").trim();
      errEl.textContent="";
      if(!text){ errEl.textContent="Write something first."; return; }
      if(text.length>CMT_MAX){ text=text.slice(0,CMT_MAX); }
      sendB.disabled=true; sendB.textContent="Checking…";
      moderate(text).then(function(mod){
        if(!mod.allow){ sendB.disabled=false; sendB.textContent="Post comment"; errEl.textContent=(mod._soft?"":"Held: ")+(mod.reason||"That comment can't be posted."); return; }
        var rec={text:text, byEmail:me.email, byName:me.name, ts:firebase.firestore.FieldValue.serverTimestamp()};
        db.collection("postcards").doc(id).collection("comments").add(rec)
          .then(function(){
            try{ db.collection("postcards").doc(id).set({commentCount:firebase.firestore.FieldValue.increment(1)},{merge:true}); }catch(e){}
            ta.value=""; sendB.disabled=false; sendB.textContent="Post comment";
          })
          .catch(function(e){ sendB.disabled=false; sendB.textContent="Post comment"; errEl.textContent=(e&&e.message)||"Couldn't post. Try again."; });
      });
    };
    host.querySelector("#pc-cmtx").onclick=close;
    host.addEventListener("click",function(e){ if(e.target===host) close(); });
  }

  /* ===================== P4: sticker editor ===================== */
  var EMOJIS=["❤️","🔥","✨","😂","😍","🎉","👏","☕","🙌","💯","😎","🥳","👍","🌟","💪","🤝","🍀","🌈","😅","🥰","😭","🤔","👀","💖","🙏","😜","🤩","🍰","🎂","🌸","⭐","💥","😴","🤗","😇","🫶","💛","🧋","🥐","🍓"];
  var STK_COLORS=["#ffffff","#241d16","#c81a22","#f4c20d","#3f6f9c","#4f6a44","#ff6b60"];
  function cloneSticker(s){ var o={}; for(var k in s){ if(s.hasOwnProperty(k)) o[k]=s[k]; } return o; }
  function openStickerEditor(id){
    var d=docById(id); if(!d||!d.photoUrl){ toast("No photo to add stickers to"); return; }
    if(!canDelete(d)){ toast("You can only edit your own postcards"); return; }
    var stickers=getStickers(d).map(cloneSticker);
    var sel=-1, curFont="system", curColor="#ffffff";
    var host=document.createElement("div"); host.id="pc-stkedit";
    var emojiBtns=EMOJIS.map(function(e){ return '<button type="button" class="pc-emoji" data-emoji="'+e+'">'+e+'</button>'; }).join("");
    var fontChips=STK_FONTS.map(function(fn,i){ return '<button type="button" class="pc-fontchip'+(i===0?" on":"")+'" data-font="'+fn.id+'" style="font-family:'+fn.css+'">'+esc(fn.name)+'</button>'; }).join("");
    var colChips=STK_COLORS.map(function(c,i){ return '<button type="button" class="pc-fontchip'+(i===0?" on":"")+'" data-col="'+c+'" style="background:'+c+';width:30px;height:30px;padding:0;color:transparent">.</button>'; }).join("");
    host.innerHTML='<div class="sheet">'+
      '<div class="shead"><h4>Stickers</h4><button class="pc-x" id="pc-stkx" aria-label="Close">×</button></div>'+
      '<div class="sbody">'+
        '<div id="pc-stkstage"><img src="'+esc(d.photoUrl)+'" alt="" onerror="this.style.opacity=.3"><div class="pc-stklayer" id="pc-stklayer2"></div></div>'+
        '<div class="pc-stktools"><button type="button" class="pc-fontchip" id="pc-addtext">+ Text</button><span style="font-size:11.5px;color:var(--pc-muted)">Tap a sticker to select · drag to move · ✕ delete · ⤢ resize/rotate</span></div>'+
        '<div class="pc-emojis">'+emojiBtns+'</div>'+
        '<div class="pc-fontrow" id="pc-fontrow" style="display:none">'+fontChips+'</div>'+
        '<div class="pc-colrow" id="pc-colrow" style="display:none">'+colChips+'</div>'+
      '</div>'+
      '<div class="sfoot"><button type="button" class="cancel" id="pc-stkcancel">Cancel</button><button type="button" class="save" id="pc-stksave">Save</button></div>'+
    '</div>';
    document.body.appendChild(host);
    var stage=host.querySelector("#pc-stkstage"), layer=host.querySelector("#pc-stklayer2");
    function close(){ if(host.parentNode) host.parentNode.removeChild(host); }
    function stageRect(){ return stage.getBoundingClientRect(); }
    function setChips(attr,val){ Array.prototype.forEach.call(host.querySelectorAll("["+attr+"]"),function(b){ b.className="pc-fontchip"+(b.getAttribute(attr)===val?" on":""); }); }
    function draw(){
      layer.innerHTML="";
      stickers.forEach(function(s,idx){
        var node=document.createElement("div");
        node.className="pc-stk "+(s.t==="emoji"?"emoji":"txt")+(idx===sel?" sel":"");
        node.style.left=(s.x*100)+"%"; node.style.top=(s.y*100)+"%";
        node.style.transform="translate(-50%,-50%) scale("+s.scale+") rotate("+s.rot+"deg)";
        node.textContent=(s.t==="emoji"?s.ch:s.str);
        if(s.t==="text"){ node.style.fontFamily=fontCss(s.font); node.style.color=s.color; }
        var del=document.createElement("span"); del.className="h-del"; del.setAttribute("data-h","del"); del.textContent="✕";
        var sz=document.createElement("span"); sz.className="h-size"; sz.setAttribute("data-h","size"); sz.textContent="⤢";
        node.appendChild(del); node.appendChild(sz);
        attachSticker(node, idx);
        layer.appendChild(node);
      });
      var showText=sel>=0&&stickers[sel]&&stickers[sel].t==="text";
      host.querySelector("#pc-fontrow").style.display=showText?"flex":"none";
      host.querySelector("#pc-colrow").style.display=showText?"flex":"none";
      if(showText){ setChips("data-font",stickers[sel].font); setChips("data-col",stickers[sel].color); }
    }
    function attachSticker(node, idx){
      node.addEventListener("pointerdown",function(e){
        var h=(e.target&&e.target.getAttribute)?e.target.getAttribute("data-h"):null;
        e.preventDefault(); e.stopPropagation(); sel=idx;
        if(h==="del"){ stickers.splice(idx,1); sel=-1; draw(); return; }
        if(h==="size"){ beginTransform(idx,e); return; }
        beginMove(idx,e,node);
      });
    }
    function beginMove(idx,e,node){
      var pid=e.pointerId, r=stageRect();
      try{ node.setPointerCapture(pid); }catch(_){}
      function mv(ev){ if(ev.pointerId!==pid) return; ev.preventDefault(); var s=stickers[idx]; if(!s) return;
        s.x=Math.max(0,Math.min(1,(ev.clientX-r.left)/(r.width||1)));
        s.y=Math.max(0,Math.min(1,(ev.clientY-r.top)/(r.height||1)));
        node.style.left=(s.x*100)+"%"; node.style.top=(s.y*100)+"%";
      }
      function up(ev){ if(ev.pointerId!==pid) return; node.removeEventListener("pointermove",mv); node.removeEventListener("pointerup",up); node.removeEventListener("pointercancel",up); draw(); }
      node.addEventListener("pointermove",mv); node.addEventListener("pointerup",up); node.addEventListener("pointercancel",up);
    }
    function beginTransform(idx,e){
      var pid=e.pointerId, r=stageRect(), s=stickers[idx]; if(!s) return;
      var cx=r.left+s.x*r.width, cy=r.top+s.y*r.height;
      var startDist=Math.max(6,Math.sqrt(Math.pow(e.clientX-cx,2)+Math.pow(e.clientY-cy,2)));
      var startScale=s.scale, startRot=s.rot;
      var startAng=Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI;
      function mv(ev){ if(ev.pointerId!==pid) return; ev.preventDefault();
        var dist=Math.max(6,Math.sqrt(Math.pow(ev.clientX-cx,2)+Math.pow(ev.clientY-cy,2)));
        s.scale=Math.max(0.3,Math.min(3,startScale*dist/startDist));
        var ang=Math.atan2(ev.clientY-cy,ev.clientX-cx)*180/Math.PI;
        s.rot=Math.max(-180,Math.min(180,startRot+(ang-startAng)));
        var nd=layer.children[idx]; if(nd) nd.style.transform="translate(-50%,-50%) scale("+s.scale+") rotate("+s.rot+"deg)";
      }
      function up(ev){ if(ev.pointerId!==pid) return; document.removeEventListener("pointermove",mv); document.removeEventListener("pointerup",up); document.removeEventListener("pointercancel",up); draw(); }
      document.addEventListener("pointermove",mv); document.addEventListener("pointerup",up); document.addEventListener("pointercancel",up);
    }
    host.querySelector("#pc-addtext").onclick=function(){
      if(stickers.length>=20){ toast("That's the max of 20 stickers"); return; }
      var t=window.prompt("Text sticker (up to 60 characters):"); if(!t) return; t=t.trim().slice(0,60); if(!t) return;
      stickers.push({t:"text",str:t,x:.5,y:.5,scale:1,rot:0,font:curFont,color:curColor}); sel=stickers.length-1; draw();
    };
    Array.prototype.forEach.call(host.querySelectorAll(".pc-emoji"),function(b){ b.onclick=function(){ if(stickers.length>=20){ toast("That's the max of 20 stickers"); return; } stickers.push({t:"emoji",ch:b.getAttribute("data-emoji"),x:.5,y:.5,scale:1,rot:0}); sel=stickers.length-1; draw(); }; });
    Array.prototype.forEach.call(host.querySelectorAll("[data-font]"),function(b){ b.onclick=function(){ curFont=b.getAttribute("data-font"); if(sel>=0&&stickers[sel]&&stickers[sel].t==="text") stickers[sel].font=curFont; draw(); }; });
    Array.prototype.forEach.call(host.querySelectorAll("[data-col]"),function(b){ b.onclick=function(){ curColor=b.getAttribute("data-col"); if(sel>=0&&stickers[sel]&&stickers[sel].t==="text") stickers[sel].color=curColor; draw(); }; });
    stage.addEventListener("pointerdown",function(e){ if(e.target===stage||e.target===layer||(e.target&&e.target.tagName==="IMG")){ sel=-1; draw(); } });
    host.addEventListener("click",function(e){ if(e.target===host) close(); });
    host.querySelector("#pc-stkx").onclick=close;
    host.querySelector("#pc-stkcancel").onclick=close;
    host.querySelector("#pc-stksave").onclick=function(){
      var clean=stickers.slice(0,20).map(function(s){
        var o={t:s.t,x:clampNum(s.x,0,1,.5),y:clampNum(s.y,0,1,.5),scale:clampNum(s.scale,0.3,3,1),rot:clampNum(s.rot,-180,180,0)};
        if(s.t==="emoji") o.ch=String(s.ch||"").slice(0,8); else { o.str=String(s.str||"").slice(0,60); o.font=String(s.font||"system"); o.color=s.color||"#ffffff"; }
        return o;
      });
      var old=(d.stickers&&Object.prototype.toString.call(d.stickers)==="[object Array]")?d.stickers:[];
      db.collection("postcards").doc(id).update({stickers:clean,editedAt:firebase.firestore.FieldValue.serverTimestamp(),editedBy:me.email})
        .then(function(){ pushUndo({type:"restoreFields", id:id, fields:{stickers:old}}); toast("Stickers saved"); close(); })
        .catch(function(e){ toast("Couldn't save stickers — "+((e&&e.message)||"try again")); });
    };
    draw();
  }

  /* ===================== P6: story tray + viewer ===================== */
  function seenMap(){ try{ return JSON.parse(localStorage.getItem("pc-seen")||"{}")||{}; }catch(e){ return {}; } }
  function saveSeen(m){ try{ localStorage.setItem("pc-seen",JSON.stringify(m)); }catch(e){} }
  function tsMillis(ts){ try{ if(!ts) return 0; if(ts.toMillis) return ts.toMillis(); if(ts.seconds) return ts.seconds*1000; var d=new Date(ts); return isFinite(d.getTime())?d.getTime():0; }catch(e){ return 0; } }
  function buildStoryGroups(){
    var by={}, order=[];
    feedItems.forEach(function(d){
      var em=(d.fromEmail||"").toLowerCase(); if(!em) return;
      if(!by[em]){ by[em]={email:em,name:d.fromName||em,cards:[],latest:0}; order.push(em); }
      by[em].cards.push(d); var m=tsMillis(d.createdAt); if(m>by[em].latest) by[em].latest=m;
    });
    var mine=(me&&me.email)||"";
    var groups=order.map(function(em){ var g=by[em]; g.cards.sort(function(a,b){ return tsMillis(b.createdAt)-tsMillis(a.createdAt); }); return g; });
    groups.sort(function(a,b){ if(a.email===mine&&b.email!==mine) return -1; if(b.email===mine&&a.email!==mine) return 1; return b.latest-a.latest; });
    return groups;
  }
  /* Build the tray HTML once (empty string when there are no stories) so the modal tray
     and the always-on top tray share the exact same markup + ordering. */
  function trayHtml(){
    var groups=buildStoryGroups();
    if(!groups.length) return "";
    var seen=seenMap(), mine=(me&&me.email)||"";
    var html='<div class="pc-tray">';
    groups.forEach(function(g){
      var unseen=g.latest>(seen[g.email]||0);
      var st=staffMap[g.email]||{};
      var nm=(g.email===mine)?"You":(st.name||g.name);
      html+='<button class="pc-trayitem" data-story="'+esc(g.email)+'"><span class="pc-ring'+(unseen?" unseen":"")+'">'+avatarHtml(g.email, st.name||g.name, st.photoURL, "")+'</span><span class="pc-trayname">'+esc(nm)+'</span></button>';
    });
    return html+'</div>';
  }
  function bindTray(root){
    if(!root) return;
    Array.prototype.forEach.call(root.querySelectorAll(".pc-trayitem"),function(el){ el.onclick=function(){ openStory(el.getAttribute("data-story")); }; });
  }
  /* Renders BOTH the modal tray (#pc-tray-c, when the modal is open) and the always-on
     page-top tray (#pc-toptray). Each is guarded independently so either can be absent. */
  function renderTray(){
    var html=trayHtml();
    var authed=isAuthed(); /* AUTH GATE: only expose tray content once the host app is authed */
    var host=document.getElementById("pc-tray-c");
    if(host){ if(html&&me&&authed){ host.innerHTML=html; bindTray(host); } else { host.innerHTML=""; } }
    /* App-provided top slot under the header (Instagram-style). Preferred target: the host
       app renders an empty <div id="pc-tray-host"> just below the title band and keeps it
       across tab switches; postcards only fills its innerHTML. Empty → :empty CSS hides it.
       When this slot exists it WINS: remove the legacy body-top strip so the tray never
       renders twice (the mount-time strip is created before React renders this slot). */
    var slot=document.getElementById("pc-tray-host");
    var top=document.getElementById("pc-toptray"), topc=document.getElementById("pc-toptray-c");
    if(slot){
      if(top){ try{ top.parentNode&&top.parentNode.removeChild(top); }catch(e){ try{ top.style.setProperty("display","none","important"); }catch(_){} } }
      if(html&&me&&authed){ slot.innerHTML=html; bindTray(slot); }
      else { slot.innerHTML=""; }
      return;
    }
    if(top&&topc){
      /* setProperty(...,"important") so this inline value wins over the base #pc-toptray{display:none!important} gate. */
      if(html&&me&&authed){ topc.innerHTML=html; bindTray(topc); top.style.setProperty("display","block","important"); }
      else { topc.innerHTML=""; top.style.setProperty("display","none","important"); }
    }
  }
  var storyState=null;
  function storyCardHtml(d){
    var th=theme(d.theme);
    var route=esc(d.fromName||"?")+' <span class="arw">→</span> '+esc(d.toName||"Everyone");
    var stk=d.photoUrl?getStickers(d):[];
    return '<div class="pc-card" style="background:'+th.bg+';color:'+th.ink+'">'+
      '<div class="pc-route" style="color:'+th.accent+'">'+route+'</div>'+
      '<div class="pc-msg">'+esc(d.message||"")+'</div>'+
      (d.photoUrl?('<div class="pc-photowrap" style="display:block"><img src="'+esc(d.photoUrl)+'" alt="">'+(d.caption?'<div class="pc-capov '+esc(d.capPos||"bottom")+'">'+esc(d.caption)+'</div>':"")+stickerLayerHtml(stk)+'</div>'):"")+
      '<div class="pc-when"><span class="stamp"></span>'+esc(fmtTime(d.createdAt))+(d.editedAt?'<span class="pc-editbadge">edited</span>':"")+'</div>'+
    '</div>';
  }
  function openStory(email){
    var groups=buildStoryGroups(), g=null;
    for(var i=0;i<groups.length;i++){ if(groups[i].email===email){ g=groups[i]; break; } }
    if(!g||!g.cards.length) return;
    storyState={g:g, idx:0};
    var ov=document.getElementById("pc-story"); if(!ov) return;
    ov.style.display="flex"; renderStory();
  }
  function renderStory(){
    var ov=document.getElementById("pc-story"); if(!ov||!storyState) return;
    var g=storyState.g, idx=storyState.idx, cards=g.cards, st=staffMap[g.email]||{}, mine=(me&&me.email)||"";
    var bars=cards.map(function(_,i){ return '<span class="sbar'+(i<idx?" done":(i===idx?" cur":""))+'"></span>'; }).join("");
    var d=cards[idx];
    ov.innerHTML='<div class="sbars">'+bars+'</div>'+
      '<div class="stophead">'+avatarHtml(g.email, st.name||g.name, st.photoURL, "")+'<span class="who">'+esc(g.email===mine?"You":(st.name||g.name))+'</span><button class="cls" id="pc-storyx" aria-label="Close">×</button></div>'+
      '<div class="stostage"><div class="stonav prev" id="pc-stoprev"></div><div class="stonav next" id="pc-stonext"></div><div class="stocard">'+storyCardHtml(d)+'</div></div>';
    ov.querySelector("#pc-storyx").onclick=closeStory;
    ov.querySelector("#pc-stoprev").onclick=function(e){ e.stopPropagation(); storyPrev(); };
    ov.querySelector("#pc-stonext").onclick=function(e){ e.stopPropagation(); storyNext(); };
    if(storyState.idx>=cards.length-1){ var m=seenMap(); m[g.email]=g.latest; saveSeen(m); }
  }
  function storyNext(){ if(!storyState) return; if(storyState.idx<storyState.g.cards.length-1){ storyState.idx++; renderStory(); } else closeStory(); }
  function storyPrev(){ if(!storyState) return; if(storyState.idx>0){ storyState.idx--; renderStory(); } }
  function closeStory(){ var ov=document.getElementById("pc-story"); if(ov) ov.style.display="none"; storyState=null; renderTray(); }

  function mount(){
    injectCSS();
    var fab=document.createElement("button"); fab.id="pc-fab"; fab.title="Staff postcards"; fab.setAttribute("aria-label","Staff postcards"); fab.innerHTML=ICON_MAIL;
    fab.onclick=open; document.body.appendChild(fab);
    var tryb=document.createElement("button"); tryb.id="pc-try"; tryb.title="Write a postcard"; tryb.innerHTML=ICON_PEN+" TRY";
    tryb.onclick=openCompose; document.body.appendChild(tryb);
    var ov=document.createElement("div"); ov.id="pc-overlay";
    ov.innerHTML='<div id="pc-modal">'+
      '<div class="pc-head"><img class="brand" src="'+LOGO+'" alt="The Hideout" onerror="this.style.display=\'none\'"><div class="pc-titles"><h3>Postcards</h3><span class="sub">The Hideout · staff board</span></div><button class="pc-x" id="pc-close" aria-label="Close">×</button></div>'+
      '<div class="pc-ribbon"><div class="pc-marq"><span>The Hideout staff board<b>✦</b>Say something kind<b>✦</b>The Hideout staff board<b>✦</b>Say something kind<b>✦</b></span><span>The Hideout staff board<b>✦</b>Say something kind<b>✦</b>The Hideout staff board<b>✦</b>Say something kind<b>✦</b></span></div></div>'+
      '<div class="pc-body pc-grid"><div id="pc-bodyc"></div></div>'+
      '<div id="pc-fabgroup" class="hidden"><button id="pc-addfab" type="button" title="Write a postcard" aria-label="Write a postcard">+</button></div>'+
    '</div>';
    document.body.appendChild(ov);
    /* Always-on story tray at the very top of the page. Inserted as body's FIRST child in
       normal flow so it sits ABOVE the host app's sticky dark header (never covering it) and
       is visible immediately without opening the mail modal. Stays hidden until there are
       stories AND the user is signed in (renderTray toggles display). Fail-safe: if anything
       fails it is just an empty hidden div and the app is unaffected. */
    try{
      /* Skip the body strip entirely when the host app provides its own #pc-tray-host slot
         (avoids a duplicate tray). Only fall back to the body-top strip for older hosts. */
      if(!document.getElementById("pc-tray-host")){
        var tt=document.createElement("div"); tt.id="pc-toptray"; tt.style.display="none";
        tt.innerHTML='<div id="pc-toptray-c"></div>';
        document.body.insertBefore(tt, document.body.firstChild);
      }
    }catch(e){}
    /* P6: full-screen story viewer overlay (hidden until an avatar is tapped). */
    var sov=document.createElement("div"); sov.id="pc-story"; document.body.appendChild(sov);
    /* Intentionally NO backdrop-click-to-close — an accidental outside click must never
       throw away a postcard someone is writing. Close only via the × button (or Esc). */
    document.getElementById("pc-close").onclick=close;
    /* FAB group → open the write form (openCompose logic, modal already open). */
    var addfab=document.getElementById("pc-addfab"); if(addfab) addfab.onclick=function(){ state.editId=null; state.tab="write"; render(); };
    document.addEventListener("keydown",function(e){
      if(e.key==="Escape"){
        var so=document.getElementById("pc-story"); if(so&&so.style.display==="flex"){ closeStory(); return; }
        var cm=document.getElementById("pc-comments"); if(cm){ if(cm.__close) cm.__close(); else cm.parentNode&&cm.parentNode.removeChild(cm); return; }
        var se=document.getElementById("pc-stkedit"); if(se){ se.parentNode&&se.parentNode.removeChild(se); return; }
        var o=document.getElementById("pc-overlay"); if(o&&o.style.display==="flex") close();
      }
    });
    /* P6 story nav + P3 undo. */
    document.addEventListener("keydown",function(e){
      var so=document.getElementById("pc-story");
      if(so&&so.style.display==="flex"){
        if(e.key==="ArrowRight"){ e.preventDefault(); storyNext(); return; }
        if(e.key==="ArrowLeft"){ e.preventDefault(); storyPrev(); return; }
      }
      if((e.ctrlKey||e.metaKey)&&(e.key==="z"||e.key==="Z")&&!e.shiftKey){
        var o=document.getElementById("pc-overlay"); if(!o||o.style.display!=="flex") return;
        var t=e.target;
        if(t&&t.closest&&t.closest("input,textarea,select,[contenteditable='true']")) return; /* yield native undo while typing */
        e.preventDefault(); doUndo();
      }
    });
    /* AUTH GATE: react to the host app toggling html.hideout-authed (custom event) and, as a
       fail-safe, observe the <html> class directly. Either way, losing auth closes any open
       modal/story and clears the tray; gaining auth lets renderTray fill it. */
    try{ document.addEventListener("hideout-authed", enforceAuthGate); }catch(e){}
    try{ var _authMo=new MutationObserver(function(){ enforceAuthGate(); }); _authMo.observe(document.documentElement,{attributes:true,attributeFilter:["class"]}); }catch(e){}
    if(!initFb()){ if(!booting){ booting=true; var n=0; var iv=setInterval(function(){ n++; if(initFb()||n>20){ clearInterval(iv); } },400); } }
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mount); else mount();
  /* P5: expose the Cloudinary uploader so the IOS Settings › Profile tab reuses it. */
  window.HideoutPostcards={open:open, compose:openCompose, uploadPhoto:uploadPhoto};
})();
