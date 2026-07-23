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
      feedItems=arr; renderFeed();
    }, function(){ });
  }

  function injectCSS(){
    if(document.getElementById("pc-css")) return;
    var st=document.createElement("style"); st.id="pc-css";
    st.textContent=[
"@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&display=swap');",
/* P4: sticker text font presets (loaded once, small subset for size). */
"@import url('https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Playfair+Display:wght@700;900&family=Space+Mono:wght@700&family=Caveat:wght@700&display=swap');",
":root{--pc-cream:#f6ede1;--pc-paper:#fdf8ef;--pc-ink:#241d16;--pc-accent:#c81a22;--pc-accent-2:#8f1015;--pc-muted:#9a8b76;--pc-line:rgba(200,26,34,.11);--pc-line-strong:rgba(200,26,34,.16);--pc-disp:'Archivo',system-ui,sans-serif}",
"#pc-fab{position:fixed;left:20px;bottom:20px;z-index:99998;width:60px;height:60px;border:none;border-radius:999px;cursor:pointer;background:var(--pc-accent);color:#fff;box-shadow:0 12px 26px rgba(150,16,21,.42);display:flex;align-items:center;justify-content:center;transition:transform .18s ease,box-shadow .18s ease}",
"#pc-fab:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 16px 30px rgba(150,16,21,.5)}#pc-fab:active{transform:scale(.96)}",
"#pc-try{position:fixed;left:20px;bottom:92px;z-index:99998;border:none;border-radius:999px;cursor:pointer;background:var(--pc-ink);color:var(--pc-cream);font-family:var(--pc-disp);font-weight:800;font-size:13px;letter-spacing:.06em;padding:11px 17px 11px 14px;box-shadow:0 8px 20px rgba(20,12,4,.3);display:flex;align-items:center;gap:7px;transition:transform .18s ease}",
"#pc-try:hover{transform:translateY(-2px)}#pc-try:active{transform:scale(.97)}",
".ic{width:1em;height:1em;display:block;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
"#pc-overlay{position:fixed;inset:0;z-index:99999;background:rgba(20,12,4,.48);display:none;align-items:center;justify-content:center;padding:16px;font-family:'SF Pro Text','Inter',system-ui,sans-serif}",
"#pc-modal{background:var(--pc-paper);width:min(940px,96vw);max-height:92vh;border-radius:24px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 34px 80px rgba(30,18,6,.42);border:1.5px solid rgba(200,26,34,.18)}",
".pc-head{position:relative;display:flex;align-items:center;gap:12px;padding:16px 18px 15px;background:var(--pc-paper);border-bottom:2px solid var(--pc-ink)}",
".pc-head .brand{height:34px;width:34px;object-fit:contain;flex:none}",
".pc-titles{display:flex;flex-direction:column;line-height:1;margin-right:auto}",
".pc-head h3{margin:0;font-family:var(--pc-disp);font-weight:900;font-size:21px;letter-spacing:-.01em;text-transform:uppercase;color:var(--pc-ink)}",
".pc-head .sub{font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--pc-accent);font-weight:700;margin-top:4px}",
".pc-x{border:none;background:transparent;cursor:pointer;color:var(--pc-muted);width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:22px;border-radius:50%;line-height:1}",
".pc-x:hover{background:rgba(0,0,0,.06);color:var(--pc-ink)}",
".pc-ribbon{background:var(--pc-accent);overflow:hidden;padding:6px 0}",
".pc-marq{display:inline-flex;white-space:nowrap;animation:pc-marquee 24s linear infinite;will-change:transform}",
".pc-marq span{font-family:var(--pc-disp);font-weight:800;font-size:10px;letter-spacing:.22em;color:#fff;opacity:.92;text-transform:uppercase}",
".pc-ribbon b{opacity:.55;margin:0 10px;font-weight:800}",
/* P2: marquee flows to the LEFT (from 0 → -50%; track is 2x-duplicated so it loops seamlessly). */
"@keyframes pc-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
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
"#pc-feed>.pc-card,#pc-flow>.pc-card{animation:pc-fadein .24s ease}",
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
".pc-del{position:absolute;bottom:8px;right:10px;border:none;background:transparent;color:var(--pc-muted);cursor:pointer;font-size:10.5px;font-family:var(--pc-disp);font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.65;padding:10px 10px;border-radius:8px;min-height:36px}",
".pc-del:hover{opacity:1;color:var(--pc-accent-2);background:rgba(200,26,34,.08)}",
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
".pc-ed{margin-top:10px;display:none}",
".pc-edcanvas-wrap{position:relative;border-radius:6px;overflow:hidden;border:1px solid rgba(36,29,22,.14);background:#111;touch-action:none;line-height:0}",
".pc-ed canvas{display:block;width:100%;touch-action:none;cursor:crosshair}",
".pc-edbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}",
".pc-edtool{border:1.5px solid rgba(36,29,22,.2);background:#fff;border-radius:8px;padding:7px 10px;font-size:12.5px;font-family:var(--pc-disp);font-weight:800;cursor:pointer;color:var(--pc-ink)}",
".pc-edtool.on{background:var(--pc-ink);color:#fff;border-color:var(--pc-ink)}",
".pc-edcols{display:inline-flex;gap:5px;margin-left:2px}",
".pc-edcol{width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)}",
".pc-edcol.on{box-shadow:0 0 0 2px var(--pc-ink)}",
".pc-edhint{font-size:11px;color:var(--pc-muted);margin-top:6px;line-height:1.5}",
".pc-edfilts{display:flex;gap:6px;overflow-x:auto;margin-top:8px;padding-bottom:2px;-webkit-overflow-scrolling:touch}",
".pc-edfilt{flex:none;border:1.5px solid rgba(36,29,22,.2);background:#fff;border-radius:8px;padding:6px 11px;font-size:12px;font-family:var(--pc-disp);font-weight:800;cursor:pointer;color:var(--pc-ink);white-space:nowrap}",
".pc-edfilt.on{background:var(--pc-accent);color:#fff;border-color:var(--pc-accent)}",
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
".pc-tabs{max-width:430px;margin-left:auto;margin-right:auto}",
".pc-write{max-width:430px;margin:0 auto}",
"#pc-feed{position:relative;min-height:150vh}",
"#pc-flow{max-width:430px}",
".pc-card.pc-abs{position:absolute;width:min(330px,72%);margin:0;box-shadow:0 10px 24px rgba(30,18,6,.22)}",
".pc-grip{position:absolute;top:2px;left:50%;transform:translateX(-50%);padding:3px 16px;cursor:grab;touch-action:none;color:var(--pc-muted);opacity:.5;line-height:1;font-size:10px;letter-spacing:3px;user-select:none;-webkit-user-select:none}",
".pc-grip:hover{opacity:1;color:var(--pc-accent)}",
".pc-card.pc-dragging{z-index:1000;transform:scale(1.04);box-shadow:0 22px 44px rgba(30,18,6,.38);cursor:grabbing;opacity:.96}",
".pc-card.pc-dragging .pc-grip{cursor:grabbing}",
/* ---- P1: placed-card scale + resize handle ---- */
".pc-card.pc-abs{transform-origin:top left}",
".pc-resize{display:none;position:absolute;right:0;bottom:0;width:44px;height:44px;cursor:nwse-resize;touch-action:none;z-index:6;align-items:flex-end;justify-content:flex-end;padding:4px}",
".pc-card.pc-abs .pc-resize{display:flex}",
".pc-resize::after{content:'';width:14px;height:14px;border-right:3px solid var(--pc-accent);border-bottom:3px solid var(--pc-accent);opacity:.55;border-bottom-right-radius:4px}",
".pc-resize:hover::after{opacity:1}",
".pc-card.pc-resizing{z-index:1000;box-shadow:0 22px 44px rgba(30,18,6,.38)}",
".pc-scalebadge{position:absolute;top:4px;right:4px;background:var(--pc-ink);color:#fff;font-family:var(--pc-disp);font-weight:800;font-size:11px;letter-spacing:.04em;padding:3px 7px;border-radius:6px;z-index:7;pointer-events:none}",
/* ---- P3: edit button (author/manager) ---- */
".pc-edit{position:absolute;bottom:8px;right:78px;border:none;background:transparent;color:var(--pc-muted);cursor:pointer;font-size:10.5px;font-family:var(--pc-disp);font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.65;padding:10px 10px;border-radius:8px;min-height:36px}",
".pc-edit:hover{opacity:1;color:var(--pc-accent);background:rgba(200,26,34,.08)}",
".pc-card.pc-abs .pc-del{right:auto;left:10px}",
".pc-card.pc-abs .pc-edit{right:auto;left:74px}",
".pc-editbadge{display:inline-block;margin-left:6px;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--pc-muted);opacity:.7}",
/* ---- P4: sticker overlay on posted photos ---- */
".pc-stklayer{position:absolute;inset:0;pointer-events:none;z-index:2}",
".pc-stk{position:absolute;transform-origin:center center;white-space:nowrap;will-change:transform}",
".pc-stk.emoji{font-size:34px;line-height:1}",
".pc-stk.txt{font-weight:800;font-size:24px;line-height:1.05;text-shadow:0 1px 4px rgba(0,0,0,.55),0 0 2px rgba(0,0,0,.4)}",
".pc-stkbtn{position:absolute;top:8px;right:8px;z-index:5;border:none;border-radius:999px;background:rgba(20,12,4,.6);color:#fff;font-size:15px;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}",
".pc-stkbtn:hover{background:rgba(20,12,4,.82)}",
/* ---- P4: sticker editor sheet ---- */
"#pc-stkedit{position:fixed;inset:0;z-index:100001;background:rgba(20,12,4,.72);display:flex;align-items:center;justify-content:center;padding:12px;font-family:'SF Pro Text','Inter',system-ui,sans-serif}",
"#pc-stkedit .sheet{background:var(--pc-paper);width:min(560px,96vw);max-height:94vh;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 34px 80px rgba(30,18,6,.5)}",
"#pc-stkedit .shead{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:2px solid var(--pc-ink)}",
"#pc-stkedit .shead h4{margin:0;flex:1;font-family:var(--pc-disp);font-weight:900;font-size:16px;text-transform:uppercase;color:var(--pc-ink)}",
"#pc-stkedit .sbody{padding:12px 14px;overflow:auto}",
"#pc-stkstage{position:relative;border-radius:8px;overflow:hidden;background:#111;touch-action:none;line-height:0;user-select:none;-webkit-user-select:none}",
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
".pc-emoji{border:none;background:rgba(36,29,22,.06);border-radius:8px;font-size:22px;line-height:1;padding:6px 8px;cursor:pointer;min-width:40px;min-height:40px}",
".pc-emoji:hover{background:rgba(200,26,34,.12)}",
".pc-fontrow,.pc-colrow{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}",
".pc-fontchip{border:1.5px solid rgba(36,29,22,.2);background:#fff;border-radius:8px;padding:6px 10px;font-size:13px;cursor:pointer;color:var(--pc-ink)}",
".pc-fontchip.on{background:var(--pc-ink);color:#fff;border-color:var(--pc-ink)}",
"#pc-stkedit .sfoot{display:flex;gap:8px;padding:12px 14px;border-top:1px solid rgba(36,29,22,.14)}",
"#pc-stkedit .sfoot button{flex:1;border:none;border-radius:12px;font-family:var(--pc-disp);font-weight:800;font-size:14px;letter-spacing:.04em;text-transform:uppercase;padding:13px;cursor:pointer}",
"#pc-stkedit .sfoot .save{background:var(--pc-accent);color:#fff}",
"#pc-stkedit .sfoot .cancel{background:rgba(36,29,22,.08);color:var(--pc-ink)}",
/* ---- P6: story tray ---- */
".pc-tray{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 14px;margin-bottom:8px;touch-action:pan-x;-webkit-overflow-scrolling:touch;border-bottom:1px solid rgba(200,26,34,.14)}",
".pc-trayitem{flex:none;display:flex;flex-direction:column;align-items:center;gap:5px;width:66px;cursor:pointer;background:none;border:none;padding:0}",
".pc-ring{width:60px;height:60px;border-radius:999px;padding:3px;display:flex;align-items:center;justify-content:center;background:rgba(154,139,118,.35)}",
".pc-ring.unseen{background:conic-gradient(from 210deg,#ff6b60,var(--pc-accent),#8f1015,#ff6b60)}",
".pc-avatar{width:100%;height:100%;border-radius:999px;object-fit:cover;background:#fff;border:2px solid var(--pc-paper);display:flex;align-items:center;justify-content:center;font-family:var(--pc-disp);font-weight:900;font-size:20px;color:#fff;overflow:hidden}",
".pc-avatar img{width:100%;height:100%;object-fit:cover;border:none;margin:0;border-radius:0}",
".pc-trayname{font-family:var(--pc-disp);font-weight:700;font-size:11px;color:var(--pc-ink);max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
/* ---- P6: story viewer ---- */
"#pc-story{position:fixed;inset:0;z-index:100002;background:rgba(10,6,2,.94);display:none;flex-direction:column;font-family:'SF Pro Text','Inter',system-ui,sans-serif}",
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
"@media (prefers-reduced-motion:reduce){#pc-fab,#pc-try,.pc-card.pinned,#pc-feed>.pc-card,#pc-flow>.pc-card,.pc-tab,.pc-sw,.pc-btn,.pc-pinbtn,.pc-marq{animation:none;transition:none}}",
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
    t.textContent=m; t.style.cssText="position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#241d16;color:#f6ede1;padding:11px 16px;border-radius:12px;z-index:100000;font-family:'SF Pro Text','Inter',system-ui;font-size:14px;max-width:88vw;box-shadow:0 10px 30px rgba(0,0,0,.3)";
    document.body.appendChild(t); setTimeout(function(){ t.remove(); },3600);
  }

  function open(){ var o=document.getElementById("pc-overlay"); if(o){ o.style.display="flex"; render(); } }
  function openCompose(){ state.editId=null; state.tab="write"; open(); }
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
    Array.prototype.forEach.call(body.querySelectorAll(".pc-tab"),function(el){ el.onclick=function(){ var t=el.getAttribute("data-t"); if(t==="write") state.editId=null; state.tab=t; render(); }; });
    if(state.tab==="write") renderWrite(); else { renderFeedInto(); }
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
      '<div class="pc-when"><span class="stamp"></span>'+esc(fmtTime(d.createdAt))+(d.editedAt?'<span class="pc-editbadge">edited</span>':"")+'</div>'+
      (mine?'<button class="pc-edit" data-edit="'+esc(d._id)+'" aria-label="Edit postcard">Edit</button>':"")+
      (mine?'<button class="pc-del" data-del="'+esc(d._id)+'" aria-label="Remove postcard">Remove</button>':"")+
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
  function renderTray(){
    var host=document.getElementById("pc-tray-c"); if(!host) return;
    var groups=buildStoryGroups();
    if(!groups.length){ host.innerHTML=""; return; }
    var seen=seenMap(), mine=(me&&me.email)||"";
    var html='<div class="pc-tray">';
    groups.forEach(function(g){
      var unseen=g.latest>(seen[g.email]||0);
      var st=staffMap[g.email]||{};
      var nm=(g.email===mine)?"You":(st.name||g.name);
      html+='<button class="pc-trayitem" data-story="'+esc(g.email)+'"><span class="pc-ring'+(unseen?" unseen":"")+'">'+avatarHtml(g.email, st.name||g.name, st.photoURL, "")+'</span><span class="pc-trayname">'+esc(nm)+'</span></button>';
    });
    host.innerHTML=html+'</div>';
    Array.prototype.forEach.call(host.querySelectorAll(".pc-trayitem"),function(el){ el.onclick=function(){ openStory(el.getAttribute("data-story")); }; });
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
    '</div>';
    document.body.appendChild(ov);
    /* P6: full-screen story viewer overlay (hidden until an avatar is tapped). */
    var sov=document.createElement("div"); sov.id="pc-story"; document.body.appendChild(sov);
    /* Intentionally NO backdrop-click-to-close — an accidental outside click must never
       throw away a postcard someone is writing. Close only via the × button (or Esc). */
    document.getElementById("pc-close").onclick=close;
    document.addEventListener("keydown",function(e){
      if(e.key==="Escape"){
        var so=document.getElementById("pc-story"); if(so&&so.style.display==="flex"){ closeStory(); return; }
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
    if(!initFb()){ if(!booting){ booting=true; var n=0; var iv=setInterval(function(){ n++; if(initFb()||n>20){ clearInterval(iv); } },400); } }
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mount); else mount();
  /* P5: expose the Cloudinary uploader so the IOS Settings › Profile tab reuses it. */
  window.HideoutPostcards={open:open, compose:openCompose, uploadPhoto:uploadPhoto};
})();
