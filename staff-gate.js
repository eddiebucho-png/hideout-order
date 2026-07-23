/* =====================================================================
   Hideout Staff Gate — soft Google-login identity gate (self-contained)
   ---------------------------------------------------------------------
   Purpose: confirm WHO is using the Ordering app. Identity only —
   backend ordering keeps using the existing shared token, so a login
   hiccup must NEVER halt ordering (fail-open on SDK/network failure).

   Shared RCC Firebase project (hideout-recipe-cost), same "postcards"
   app instance as postcards.js → ONE sign-in covers app + postcards.

   Behaviour (decisions by Ju An, 2026-07-23):
     • Soft full-screen gate on load.
     • allowlist member  → gate lifts, app shows, no role tiers (pass = full).
     • not on allowlist   → "access needed" screen; email saved to
                            accessRequests (best-effort) for Ju An to approve.
     • personal accounts  → each staffer signs in with their own Google acct.
     • persistence LOCAL  → tablets stay signed in.
   ===================================================================== */
(function(){
  "use strict";
  if(window.__HIDEOUT_GATE__) return; window.__HIDEOUT_GATE__=true;
  if(window.__HIDEOUT_GATE_DISABLED__) return; /* debug escape hatch */

  var FB={apiKey:"AIzaSyC6-J5PoHy_Y4JGgN0cmi2iVImuEADYK9s",authDomain:"hideout-recipe-cost.firebaseapp.com",projectId:"hideout-recipe-cost",storageBucket:"hideout-recipe-cost.firebasestorage.app",messagingSenderId:"717961739938",appId:"1:717961739938:web:752af54de485d7f7c921fb"};
  var APP="postcards";                 /* reuse postcards.js instance → shared session */
  var FAIL_OPEN_MS=12000;              /* if Firebase never loads, stop blocking ordering */
  var LOGO="https://order.hideoutdb.com/hideout-logo.png";
  /* Open-enrollment window (Ju An, 2026-07-24): for the first month, ANY signed-in
     Google account is let straight in — we STILL record who signed in so Ju An can
     verify accounts later. After this date the gate reverts to strict allowlist
     (non-members get the "access needed" screen). Brisbane time (UTC+10). */
  var OPEN_ENROLL_UNTIL=new Date("2026-08-24T23:59:59+10:00");
  function openEnroll(){ return Date.now() < OPEN_ENROLL_UNTIL.getTime(); }

  var app,auth,db,me=null,firstAuth=false,failed=false,requesting=false,lastReqEmail="";

  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  /* ---- Firebase (idempotent; mirrors postcards.js) ---- */
  function initFb(){
    if(!window.firebase||!firebase.initializeApp){ return false; }
    try{
      var existing=(firebase.apps||[]).filter(function(a){return a.name===APP;})[0];
      app=existing||firebase.initializeApp(FB,APP);
    }catch(e){ try{ app=firebase.app(APP); }catch(e2){ return false; } }
    try{ auth=app.auth(); db=app.firestore(); }catch(e){ return false; }
    try{ auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){}
    /* complete any redirect-based sign-in (tablet popup fallback) */
    try{ auth.getRedirectResult().catch(function(){}); }catch(e){}
    auth.onAuthStateChanged(function(u){ firstAuth=true; onAuth(u); });
    return true;
  }

  function onAuth(u){
    /* Note: we do NOT early-return when failed. A late-arriving resolution should
       still populate identity (grantAccess). The blocking screens (showSignIn/
       showAccessNeeded) self-suppress when failed, so we never re-block ordering. */
    if(!u){ me=null; window.HideoutUser=null; showSignIn(); return; }
    var email=(u.email||"").toLowerCase();
    /* Definitive allowlist membership check (doc must EXIST). */
    db.collection("allowlist").doc(email).get().then(function(snap){
      if(snap&&snap.exists){
        var d=snap.data()||{};
        me={email:email,name:d.name||u.displayName||email.split("@")[0],role:d.role||"staff",branch:d.branch||""};
        grantAccess();
      } else if(openEnroll()){
        /* Open-enrollment month: let anyone signed in through, but log them for
           Ju An to verify later. */
        me={email:email,name:u.displayName||email.split("@")[0],role:"staff",branch:"",autoEnrolled:true};
        saveRequest(u,"auto");
        grantAccess();
      } else {
        showAccessNeeded(u);
      }
    }).catch(function(err){
      /* Can't verify allowlist (rules/network). Soft-fail: don't lock out a
         possibly-valid staffer over a transient read error — let them in but
         flag unverified so the app can decide later if it wants to. */
      try{console.warn("[gate] allowlist read failed — granting unverified access:",err&&err.code);}catch(e){}
      me={email:email,name:u.displayName||email.split("@")[0],role:"staff",branch:"",unverified:true};
      grantAccess();
    });
  }

  /* ---- Access granted → lift the gate ---- */
  function grantAccess(){
    window.HideoutUser={email:me.email,name:me.name,role:me.role,branch:me.branch,unverified:!!me.unverified,autoEnrolled:!!me.autoEnrolled};
    removeGate();
    try{ document.dispatchEvent(new CustomEvent("hideout-auth",{detail:window.HideoutUser})); }catch(e){}
  }

  /* ---- Sign in / out ---- */
  function signIn(){
    if(!auth){ note("Not ready yet — give it a second and try again."); return; }
    var btn=document.getElementById("hg-btn");
    if(btn){ if(btn.disabled) return; btn.disabled=true; }   /* double-click guard */
    function reenable(){ if(btn) btn.disabled=false; }
    var pr=new firebase.auth.GoogleAuthProvider();
    pr.setCustomParameters({prompt:"select_account"});
    auth.signInWithPopup(pr).catch(function(e){
      var code=(e&&e.code)||"";
      if(code==="auth/popup-blocked"||code==="auth/operation-not-supported-in-this-environment"){
        try{ auth.signInWithRedirect(pr).catch(function(){ reenable(); note("Sign-in failed. Open the app from its web address (order.hideoutdb.com)."); }); return; }catch(_){ reenable(); }
      }
      reenable();
      if(code==="auth/popup-closed-by-user"||code==="auth/cancelled-popup-request"){ return; }
      note("Sign-in failed: "+((e&&e.message)||e)+" (open the app from its web address, not a file).");
    });
  }
  function signOut(){ if(auth) auth.signOut().catch(function(){}); }

  /* ---- Best-effort access request (see README for Firestore rule) ---- */
  /* kind: "auto"  = auto-let-in during the open-enrollment month (logged for review)
           "pending" = hard-block request after the window closed (needs approval) */
  function saveRequest(u, kind){
    if(!db||!u) return Promise.resolve(false);
    var email=(u.email||"").toLowerCase();
    if(!email) return Promise.resolve(false);
    if(requesting||lastReqEmail===email) return Promise.resolve(true);
    requesting=true;
    var newStatus=(kind==="auto")?"auto":"pending";
    var ref=db.collection("accessRequests").doc(email);
    /* Read first: never stomp a request Ju An has already handled
       (approved/rejected) back to a fresh status on a reload or "try again". */
    return ref.get().then(function(snap){
      var exists=snap&&snap.exists, prev=exists?(snap.data()||{}):{};
      var rec={email:email,name:u.displayName||email,lastSeenAt:firebase.firestore.FieldValue.serverTimestamp()};
      try{ rec.ua=(navigator.userAgent||"").slice(0,300); }catch(e){}
      if(!exists){ rec.status=newStatus; rec.requestedAt=firebase.firestore.FieldValue.serverTimestamp(); }
      else if(!prev.status){ rec.status=newStatus; }   /* legacy doc w/o status */
      /* else: leave existing (Ju An-set) status untouched */
      return ref.set(rec,{merge:true});
    }).then(function(){ requesting=false; lastReqEmail=email; return true; })
      .catch(function(err){ requesting=false; try{console.warn("[gate] accessRequest save failed:",err&&err.code);}catch(e){} return false; });
  }

  /* ============================ UI ============================ */
  function injectCSS(){
    if(document.getElementById("hg-css")) return;
    var st=document.createElement("style"); st.id="hg-css";
    st.textContent=[
"@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&display=swap');",
"#hg-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));background:#f6ede1;background-image:linear-gradient(rgba(200,26,34,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(200,26,34,.10) 1px,transparent 1px),linear-gradient(rgba(200,26,34,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(200,26,34,.16) 1px,transparent 1px);background-size:22px 22px,22px 22px,110px 110px,110px 110px;font-family:'SF Pro Text','Inter',system-ui,-apple-system,sans-serif;color:#241d16;-webkit-font-smoothing:antialiased}",
"#hg-card{width:min(430px,100%);max-height:calc(100vh - 48px);overflow-y:auto;-webkit-overflow-scrolling:touch;background:#fdf8ef;border:1.5px solid rgba(200,26,34,.18);border-radius:24px;box-shadow:0 34px 80px rgba(30,18,6,.42);padding:34px 28px 28px;text-align:center;animation:hg-in .35s cubic-bezier(.2,.85,.3,1.15)}",
"@keyframes hg-in{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}",
"#hg-card .brand{height:46px;width:46px;object-fit:contain;margin:0 auto 14px;display:block}",
"#hg-card .pill{display:inline-block;background:#c81a22;color:#fff;font-family:'Archivo',system-ui,sans-serif;font-weight:800;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;padding:5px 12px;border-radius:999px;margin-bottom:16px}",
"#hg-card h1{font-family:'Archivo',system-ui,sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;font-size:25px;line-height:1.08;margin:0 0 10px;color:#241d16}",
"#hg-card p{color:#6a5f52;line-height:1.6;font-size:14.5px;margin:0 auto 18px;max-width:340px;overflow-wrap:anywhere}",
"#hg-card .who{font-weight:700;color:#241d16}",
"#hg-btn{border:none;border-radius:12px;background:#c81a22;color:#fff;font-family:'Archivo',system-ui,sans-serif;font-weight:800;font-size:15px;letter-spacing:.03em;text-transform:uppercase;padding:14px 22px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 10px 24px rgba(150,16,21,.32);transition:transform .18s ease}",
"@media(hover:hover){#hg-btn:hover{transform:translateY(-2px)}}#hg-btn:active{transform:scale(.98)}#hg-btn[disabled]{opacity:.6;cursor:default}",
"#hg-btn svg{width:18px;height:18px;display:block}",
"#hg-alt{margin-top:12px;font-size:13px}",
"#hg-alt a{display:inline-flex;align-items:center;min-height:44px;padding:8px 14px;color:#6a5f52;text-decoration:underline;cursor:pointer}",
"#hg-note{display:flex;gap:8px;text-align:left;font-size:11.5px;color:#6a5f52;margin-top:20px;line-height:1.55;background:rgba(200,26,34,.06);border-radius:10px;padding:11px 12px}",
"#hg-note svg{flex:none;margin-top:1px;color:#c81a22;opacity:.85;width:15px;height:15px}",
"#hg-spin{width:34px;height:34px;border-radius:50%;border:3px solid rgba(200,26,34,.18);border-top-color:#c81a22;margin:8px auto 0;animation:hg-rot .8s linear infinite}",
"@keyframes hg-rot{to{transform:rotate(360deg)}}",
"#hg-toast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);background:#241d16;color:#f6ede1;padding:11px 16px;border-radius:12px;z-index:2147483001;font-size:14px;max-width:88vw;box-shadow:0 10px 30px rgba(0,0,0,.3)}",
"@media (prefers-reduced-motion:reduce){#hg-card,#hg-spin{animation:none}#hg-btn{transition:none}}"
    ].join("\n");
    (document.head||document.documentElement).appendChild(st);
  }

  function ensureGate(){
    if(failed) return null;            /* failed open — never re-block ordering */
    injectCSS();
    var g=document.getElementById("hg-gate");
    if(!g){
      g=document.createElement("div"); g.id="hg-gate";
      g.setAttribute("role","dialog"); g.setAttribute("aria-modal","true"); g.setAttribute("aria-label","The Hideout staff sign-in");
      g.innerHTML='<div id="hg-card"></div>';
      document.body.appendChild(g);
    }
    return document.getElementById("hg-card");
  }
  function focusCard(){ try{ var b=document.getElementById("hg-btn"); if(b) b.focus(); }catch(e){} }
  function removeGate(){ var g=document.getElementById("hg-gate"); if(g) g.parentNode.removeChild(g); }

  var GOOGLE_G='<svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.6 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c11 0 19.5-8 19.5-19.5 0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.6 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/><path fill="#4CAF50" d="M24 43.5c5.5 0 10.3-1.9 13.8-5.1l-6.4-5.4C29.4 34.7 26.9 35.5 24 35.5c-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.6 39 16.2 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.4 5.4c-.5.4 6.8-4.9 6.8-14.9 0-1.3-.1-2.3-.9-3.5z"/></svg>';
  var SHIELD='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';

  function logoTag(){ return '<img class="brand" src="'+LOGO+'" alt="The Hideout" onerror="this.style.display=\'none\'">'; }

  function showLoading(){
    var c=ensureGate(); if(!c) return;
    c.innerHTML=logoTag()+'<div class="pill">The Hideout</div><h1>Ordering</h1><p>Checking your sign-in…</p><div id="hg-spin"></div>';
  }
  function showSignIn(){
    var c=ensureGate(); if(!c) return;
    c.innerHTML=logoTag()+
      '<div class="pill">Staff only</div>'+
      '<h1>Sign in to order</h1>'+
      '<p>Use your Hideout Google account. You’ll only need to do this once on this device.</p>'+
      '<button id="hg-btn">'+GOOGLE_G+'Sign in with Google</button>'+
      '<div id="hg-note">'+SHIELD+'<span>This just confirms who’s ordering — it doesn’t change how orders are sent.</span></div>';
    var b=document.getElementById("hg-btn"); if(b) b.onclick=signIn;
    focusCard();
  }
  function showAccessNeeded(u){
    var c=ensureGate(); if(!c) return;
    var email=esc((u.email||"").toLowerCase());
    c.innerHTML=logoTag()+
      '<div class="pill">Access needed</div>'+
      '<h1>Almost there</h1>'+
      '<p>You’re signed in as <span class="who">'+email+'</span>, but this account isn’t on the staff list yet.</p>'+
      '<p id="hg-reqstate" aria-live="polite" style="font-size:13px">Saving your request…</p>'+
      '<button id="hg-btn">'+GOOGLE_G+'Use a different account</button>'+
      '<div id="hg-alt"><a id="hg-retry" role="button" tabindex="0">I’ve been added — try again</a></div>'+
      '<div id="hg-note">'+SHIELD+'<span>Ask Ju An to approve <b>'+email+'</b>. Once added, tap “try again”.</span></div>';
    var b=document.getElementById("hg-btn"); if(b) b.onclick=signOut;
    var r=document.getElementById("hg-retry");
    if(r){ var retry=function(){ var uu=auth&&auth.currentUser; if(uu){ showLoading(); onAuth(uu); } }; r.onclick=retry; r.onkeydown=function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); retry(); } }; }
    focusCard();
    saveRequest(u,"pending").then(function(ok){
      var s=document.getElementById("hg-reqstate"); if(!s) return;
      s.textContent=ok?"Your request has been sent to Ju An." :"Couldn’t save automatically — please message Ju An directly.";
    });
  }

  function note(m){
    var t=document.createElement("div"); t.id="hg-toast"; t.textContent=m;
    document.body.appendChild(t); setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); },4200);
  }

  /* ---- Boot ---- */
  function failOpen(why){
    if(failed) return; failed=true; removeGate();
    try{console.warn("[gate] "+why+" — failing open so ordering is never blocked.");}catch(e){}
  }
  function boot(){
    showLoading();
    /* Arm the fail-open backstop UNCONDITIONALLY first: covers both "SDK never
       loads" AND "SDK loaded but onAuthStateChanged never fires" (blocked
       IndexedDB/cookies, proxy blocking identitytoolkit, etc.). Ordering must
       never stay blocked on the spinner. */
    setTimeout(function(){ if(!firstAuth) failOpen("No sign-in response within "+((FAIL_OPEN_MS+4000)/1000)+"s"); }, FAIL_OPEN_MS+4000);
    /* Soften the spinner copy so a slow connection doesn't read as frozen. */
    setTimeout(function(){ if(!firstAuth&&!failed){ var p=document.querySelector("#hg-card p"); if(p) p.textContent="Still checking your sign-in…"; } }, 5000);
    if(initFb()) return;
    var start=Date.now();
    var iv=setInterval(function(){
      if(initFb()){ clearInterval(iv); return; }
      if(Date.now()-start>=FAIL_OPEN_MS){ clearInterval(iv); if(!firstAuth) failOpen("Firebase SDK unavailable"); }
    },400);
  }

  window.HideoutGate={signIn:signIn,signOut:signOut,user:function(){return me;}};

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot); else boot();
})();
