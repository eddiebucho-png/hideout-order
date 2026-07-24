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
  /* Venues — ids match the RCC allowlist branch codes; names match what staff
     see on the Ordering app's branch screen. b1=100 Edward, b2=340 Adelaide,
     b3=515 St Pauls Ter (Fortitude Valley). */
  var BRANCHES=[{id:"b1",name:"Edward St"},{id:"b2",name:"Adelaide St"},{id:"b3",name:"St Pauls Ter"}];
  /* Regexes to find each venue's button on the app's "Select your branch" screen. */
  var BRANCH_MATCH={b1:/edward/i,b2:/adelaide/i,b3:/pauls|valley/i};
  var ADELAIDE="b2"; /* Adelaide St stays on the default "Today" tab; others jump to Submit Order */

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

  var authBusy="";
  function onAuth(u){
    /* Note: we do NOT early-return when failed. A late-arriving resolution should
       still populate identity (grantAccess). The blocking screens (showSignIn/
       showAccessNeeded) self-suppress when failed, so we never re-block ordering. */
    if(!u){ authBusy=""; me=null; window.HideoutUser=null; showSignIn(); return; }
    var email=(u.email||"").toLowerCase();
    if(authBusy===email) return;       /* dedupe concurrent resolutions for same user */
    authBusy=email;
    /* Definitive allowlist membership check (doc must EXIST). */
    db.collection("allowlist").doc(email).get().then(function(snap){
      authBusy="";
      if(snap&&snap.exists){
        var d=snap.data()||{};
        me={email:email,name:d.name||u.displayName||email.split("@")[0],role:d.role||"staff",branch:d.branch||""};
        grantAccess();
      } else if(openEnroll()){
        /* Open-enrollment month: first sign-in → pick a nickname, then straight in.
           Saved to allowlist with self:true (matches RCC self-enrol pattern) so
           Ju An can review the accounts later and postcards shows the nickname. */
        showNickname(u);
      } else {
        showAccessNeeded(u);
      }
    }).catch(function(err){
      authBusy="";
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
    startAutofill();
  }

  /* ---- Autofill "Ordered by" (etc.) with the nickname ------------------
     The ordering app's React inputs are untouched source — instead of editing
     index.html we fill any empty text input whose surrounding label mentions
     "Ordered by" / "your name", using the native value setter + input event so
     React state picks it up. Runs on grant + whenever the app re-renders. */
  var autofillObs=null;
  function setNativeValue(inp,val){
    try{
      var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value");
      d.set.call(inp,val);
      inp.dispatchEvent(new Event("input",{bubbles:true}));
      inp.dispatchEvent(new Event("change",{bubbles:true}));
    }catch(e){ try{ inp.value=val; }catch(_){} }
  }
  function fillOrderedBy(){
    if(!me||!me.name) return;
    var inputs=document.querySelectorAll('input[type="text"],input:not([type])');
    for(var i=0;i<inputs.length;i++){
      var inp=inputs[i];
      if(inp.__hgFilled||inp.value) continue;
      if(inp.id&&inp.id.indexOf("hg-")===0) continue;          /* skip our own UI */
      var el=inp,txt="",hops=0;
      while(el&&hops<4){ el=el.parentElement; hops++;
        if(el){ var t=(el.textContent||""); if(t.length<260){ txt=t; } else break; } }
      if(/ordered\s*by|your\s*name/i.test(txt)){ setNativeValue(inp,me.name); inp.__hgFilled=true; }
    }
  }
  /* ---- Auto-navigate after sign-in --------------------------------------
     1) On the app's "Select your branch" screen, click the button matching the
        user's profile venue (one-shot per page load).
     2) Once the tab bar appears, jump to "Submit Order" — EXCEPT Adelaide St,
        which stays on the default "Today" tab (Ju An, 2026-07-24).
     One-shot flags mean later manual navigation is never hijacked. */
  var branchClicked=false, tabClicked=false;
  function textNear(el,hops,needle){
    var n=el,h=0;
    while(n&&h<hops){ n=n.parentElement; h++;
      if(n&&(n.textContent||"").indexOf(needle)!==-1) return true; }
    return false;
  }
  function autoNavigate(){
    /* Navigate ONLY on a fully-verified profile with a known venue. An
       unverified/blank-branch grant (transient allowlist read failure) must
       never steer the app — that caused a wrong Submit-Order jump on 7/24. */
    if(!me||me.unverified||!me.branch||!BRANCH_MATCH[me.branch]) return;
    var rx=BRANCH_MATCH[me.branch];
    /* 1) branch screen */
    if(!branchClicked&&rx){
      var btns=document.querySelectorAll("button");
      for(var i=0;i<btns.length;i++){
        var t=(btns[i].textContent||"").trim();
        if(t.length<40&&rx.test(t)&&textNear(btns[i],7,"Select your branch")){
          branchClicked=true;
          try{ btns[i].click(); }catch(e){}
          break;
        }
      }
    }
    /* 2) tab bar → Submit Order (skip for Adelaide St = keep Today first) */
    if(!tabClicked&&me.branch!==ADELAIDE){
      var all=document.querySelectorAll("button");
      var seenTabs=false, target=null;
      for(var j=0;j<all.length;j++){
        var tt=(all[j].textContent||"").trim();
        if(tt==="Today") seenTabs=true;                 /* tab bar is mounted */
        if(tt==="Submit Order") target=all[j];
      }
      if(seenTabs&&target){ tabClicked=true; try{ target.click(); }catch(e){} }
    }
  }
  var autofillTimer=null;
  function integrationPass(){ fillOrderedBy(); autoNavigate(); }
  function startAutofill(){
    integrationPass();
    if(autofillObs||!window.MutationObserver) return;
    autofillObs=new MutationObserver(function(){
      if(autofillTimer) clearTimeout(autofillTimer);
      autofillTimer=setTimeout(integrationPass,350);
    });
    try{ autofillObs.observe(document.body,{childList:true,subtree:true}); }catch(e){}
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
      else if(newStatus==="auto"&&prev.status==="pending"){ rec.status="auto"; } /* self-enrolled now — clear stale approval queue entry */
      /* else: leave existing (Ju An-set) status untouched */
      return ref.set(rec,{merge:true});
    }).then(function(){ requesting=false; lastReqEmail=email; return true; })
      .catch(function(err){ requesting=false; try{console.warn("[gate] accessRequest save failed:",err&&err.code);}catch(e){} return false; });
  }

  /* ============================ UI ============================ */
  function injectCSS(){
    if(document.getElementById("hg-css")) return;
    var st=document.createElement("style"); st.id="hg-css";
    /* Packaging design language (2026-07-24): paper ground + red grid + steaming-bowl
       motif, ink text, Archivo, Modernist zero-radius, 2px ink rules, red as a mark.
       Logic/structure/ids unchanged — this is a palette/shape reskin of the CSS only. */
    st.textContent=[
"@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800;900&display=swap');",
"#hg-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));background:#f3f2f2;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='620' height='620' viewBox='0 0 620 620'%3E%3Cg fill='none' stroke='%23ec3013' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round' opacity='0.13' transform='translate(210 185)'%3E%3Cpath d='M74 96 C64 80 88 72 78 54 C70 40 88 32 78 16'/%3E%3Cpath d='M104 96 C94 80 118 72 108 54 C100 40 118 32 108 16'/%3E%3Cpath d='M134 96 C124 80 148 72 138 54 C130 40 148 32 138 16'/%3E%3Cellipse cx='104' cy='126' rx='48' ry='11'/%3E%3Cpath d='M58 128 C60 162 74 182 82 188 C90 194 118 194 126 188 C134 182 148 162 150 128'/%3E%3Cpath d='M150 140 C170 140 170 168 148 168'/%3E%3Cellipse cx='104' cy='204' rx='66' ry='13'/%3E%3C/g%3E%3C/svg%3E\"),linear-gradient(rgba(236,48,19,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(236,48,19,.16) 1px,transparent 1px);background-size:620px 620px,24px 24px,24px 24px;background-position:center top;font-family:'Archivo',system-ui,-apple-system,sans-serif;color:#201e1d;-webkit-font-smoothing:antialiased}",
"#hg-gate{overflow-y:auto}",
"#hg-card{width:min(430px,100%);margin:auto;max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);overflow-y:auto;-webkit-overflow-scrolling:touch;background:#f3f2f2;border:2px solid #201e1d;border-radius:0;box-shadow:0 16px 44px rgba(32,30,29,.16);padding:34px 28px 28px;text-align:center;animation:hg-in .35s cubic-bezier(.2,.85,.3,1.15)}",
"@keyframes hg-in{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}",
"#hg-card .brand{height:46px;width:46px;object-fit:contain;margin:0 auto 14px;display:block}",
"#hg-card .pill{display:inline-block;background:#ec3013;color:#f3f2f2;font-family:'Archivo',system-ui,sans-serif;font-weight:800;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;padding:5px 12px;border-radius:0;margin-bottom:16px}",
"#hg-card h1{font-family:'Archivo',system-ui,sans-serif;font-weight:800;text-transform:uppercase;letter-spacing:-.02em;font-size:25px;line-height:1.08;margin:0 0 10px;color:#201e1d}",
"#hg-card p{color:#5c5754;line-height:1.6;font-size:14.5px;margin:0 auto 18px;max-width:340px;overflow-wrap:anywhere}",
"#hg-card .who{font-weight:700;color:#201e1d}",
"#hg-btn{border:none;border-radius:0;background:#ec3013;color:#f3f2f2;font-family:'Archivo',system-ui,sans-serif;font-weight:800;font-size:15px;letter-spacing:.03em;text-transform:uppercase;padding:14px 22px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:10px;box-shadow:none;transition:transform .18s ease,background .18s ease}",
"@media(hover:hover){#hg-btn:hover{transform:translateY(-2px);background:#ae1800}}#hg-btn:active{transform:scale(.98)}#hg-btn[disabled]{opacity:.6;cursor:default}",
"#hg-btn svg{width:18px;height:18px;display:block}",
"#hg-card .lbl{display:block;text-align:left;font-family:'Archivo',system-ui,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#201e1d;margin:14px 0 6px;font-weight:800}",
"#hg-card input[type=text],#hg-card select{width:100%;box-sizing:border-box;border:2px solid #201e1d;border-radius:0;padding:12px;font-size:16px;font-family:inherit;background:#fff;color:#201e1d;text-align:left}",
"#hg-card input[type=text]:focus,#hg-card select:focus{outline:none;border-color:#ec3013;box-shadow:0 0 0 3px rgba(236,48,19,.16)}",
"#hg-err{color:#ae1800;font-size:13px;margin-top:10px;min-height:16px;font-weight:600}",
"#hg-alt{margin-top:12px;font-size:13px}",
"#hg-alt a{display:inline-flex;align-items:center;min-height:44px;padding:8px 14px;color:#5c5754;text-decoration:underline;cursor:pointer}",
"#hg-note{display:flex;gap:8px;text-align:left;font-size:11.5px;color:#5c5754;margin-top:20px;line-height:1.55;background:rgba(236,48,19,.07);border-radius:0;padding:11px 12px}",
"#hg-note svg{flex:none;margin-top:1px;color:#ec3013;opacity:.9;width:15px;height:15px}",
"#hg-spin{width:34px;height:34px;border-radius:50%;border:3px solid rgba(236,48,19,.18);border-top-color:#ec3013;margin:8px auto 0;animation:hg-rot .8s linear infinite}",
"@keyframes hg-rot{to{transform:rotate(360deg)}}",
"#hg-toast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);background:#201e1d;color:#f3f2f2;padding:11px 16px;border-radius:0;z-index:2147483001;font-size:14px;max-width:88vw;box-shadow:0 10px 30px rgba(0,0,0,.3)}",
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
      '<p>Use your Google account. New here? Sign up once and you can start ordering right away.</p>'+
      '<button id="hg-btn">'+GOOGLE_G+'Sign in with Google</button>'+
      '<div id="hg-note">'+SHIELD+'<span>Your login details are never stored — sign-in is handled securely by Google. You’ll stay signed in on this device.</span></div>';
    var b=document.getElementById("hg-btn"); if(b) b.onclick=signIn;
    focusCard();
  }
  /* First sign-in during open enrollment: pick nickname + venue, then straight in. */
  function showNickname(u){
    var c=ensureGate(); if(!c){ /* gate failed open — still record identity silently */ return; }
    var email=(u.email||"").toLowerCase();
    var def=esc((u.displayName||email.split("@")[0]||"").trim());
    var opts=BRANCHES.map(function(b){ return '<option value="'+b.id+'">'+esc(b.name)+'</option>'; }).join("");
    c.innerHTML=logoTag()+
      '<div class="pill">First sign-in</div>'+
      '<h1>Create your profile</h1>'+
      '<p>Signed in as <span class="who">'+esc(email)+'</span>. Pick a nickname — that’s the name your team will see.</p>'+
      '<label class="lbl" for="hg-nick">Nickname</label>'+
      '<input type="text" id="hg-nick" maxlength="30" value="'+def+'" autocomplete="off">'+
      '<label class="lbl" for="hg-venue">Your venue</label>'+
      '<select id="hg-venue"><option value="">Choose your venue…</option>'+opts+'</select>'+
      '<div id="hg-err" aria-live="polite"></div>'+
      '<button id="hg-btn">Sign up &amp; start ordering</button>'+
      '<div id="hg-alt"><a id="hg-switch" role="button" tabindex="0">Use a different account</a></div>'+
      '<div id="hg-note">'+SHIELD+'<span>Your login details are never stored — Google handles sign-in securely. Sign up and you’re in — no waiting for approval.</span></div>';
    var sw=document.getElementById("hg-switch");
    if(sw){ sw.onclick=signOut; sw.onkeydown=function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); signOut(); } }; }
    var nick=document.getElementById("hg-nick"); if(nick){ try{ nick.focus(); nick.select(); }catch(e){} }
    var b=document.getElementById("hg-btn");
    if(b) b.onclick=function(){
      var err=document.getElementById("hg-err");
      var name=(document.getElementById("hg-nick").value||"").trim();
      var venue=document.getElementById("hg-venue").value;
      if(name.length<2){ if(err) err.textContent="Nickname needs at least 2 characters."; return; }
      if(!venue){ if(err) err.textContent="Choose your venue."; return; }
      if(err) err.textContent="";
      b.disabled=true; b.textContent="Setting up…";
      var ref=db.collection("allowlist").doc(email);
      /* Re-check right before writing: if Ju An added/edited this email while the
         form sat open, keep the admin-set doc — never clobber role/branch. */
      ref.get().then(function(snap){
        if(snap&&snap.exists&&!(snap.data()||{}).self){
          var d=snap.data()||{};
          me={email:email,name:d.name||name,role:d.role||"staff",branch:d.branch||venue};
          grantAccess(); return null;
        }
        return ref.set({name:name,role:"staff",branch:venue,self:true,ts:Date.now()},{merge:true}).then(function(){
          me={email:email,name:name,role:"staff",branch:venue,autoEnrolled:true};
          saveRequest(u,"auto");
          grantAccess();
        });
      }).catch(function(e2){
        b.disabled=false; b.innerHTML="Sign up &amp; start ordering";
        if(err) err.textContent="Couldn’t save right now — check your connection and try again.";
        try{console.warn("[gate] self-enrol failed:",e2&&e2.code);}catch(e3){}
      });
    };
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
    var retrying=false;
    if(r){ var retry=function(){ if(retrying) return; retrying=true; var uu=auth&&auth.currentUser; if(uu){ showLoading(); onAuth(uu); } }; r.onclick=retry; r.onkeydown=function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); retry(); } }; }
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

  window.HideoutGate={signIn:signIn,signOut:signOut,user:function(){return me;},db:function(){return db;}};

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot); else boot();
})();
