/* Hideout closing checklist — drop-in module.
 * Built from CLO_1_core.jsx + CLO_2_ui.jsx + CLO_3_tab.jsx. Do not edit here; edit those and
 * re-run build-closing-module.js.
 *
 *   <script src="https://order.hideoutdb.com/closing.js"></script>
 *   HideoutClosing.open()            // opens over whatever page you are on
 *
 * Records use the same keys as the IOS Closing tab (closing:<date>:<branch>), so a night closed
 * from RCC and a night closed from the ordering app are one record, not two.
 */
(function(){
  if (window.HideoutClosing && window.HideoutClosing.open) return;   // already attached

  var CDN = "https://cdnjs.cloudflare.com/ajax/libs/";
  function need(src){
    return new Promise(function(res, rej){
      var s = document.createElement("script");
      s.src = src; s.async = false;
      s.onload = res; s.onerror = function(){ rej(new Error("could not load " + src)); };
      document.head.appendChild(s);
    });
  }
  /* Borrow the host's React when it has one - RCC and the ordering app both do, and loading a
     second copy into the same page is how you get two Reacts arguing about hooks. */
  function react(){
    if (window.React && window.ReactDOM && window.ReactDOM.createRoot) return Promise.resolve();
    return need(CDN + "react/18.2.0/umd/react.production.min.js")
      .then(function(){ return need(CDN + "react-dom/18.2.0/umd/react-dom.production.min.js"); });
  }

  /* The host button, styled here so both apps look identical without either of them owning it. */
  (function(){
    if (document.getElementById("clo-btn-css")) return;
    var st = document.createElement("style");
    st.id = "clo-btn-css";
    /* Reviewed by Codex 2026-09-13 (hermes/_reports/closing-review-codex-20260913).
       Paper outline on the ink header rather than yellow: yellow is what an ACTIVE TAB is,
       and the button is not a tab. Contrast 16.44:1; focus ring 10.96:1. Crescent dropped -
       it read as decoration and cost width the 375px header does not have. */
    st.textContent =
      "" +
      ".clobtn { box-sizing: border-box; appearance: none; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 96px; width: 96px; min-width: 96px; min-height: 44px; margin: 0; padding: 8px 6px; border: 2px solid #f3f1ec; border-radius: 0; background: #141312; color: #f3f1ec; font: 700 12px/1.2 Jost, Archivo, system-ui, sans-serif; letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; cursor: pointer; -webkit-user-select: none; user-select: none; touch-action: manipulation; transform: translate(0, 0); box-shadow: none; transition: transform 120ms ease; }" +
      ".clobtn::before, .clobtn::after { content: none; }" +
      "@media (hover: hover) and (pointer: fine) { .clobtn:hover { transform: translate(-2px, -2px); box-shadow: 4px 4px 0 #f3f1ec; }}" +
      ".clobtn:focus-visible { outline: 3px solid #f2c100; outline-offset: 3px; }.clobtn:active { transform: translate(0, 0); box-shadow: none; }" +
      ".clobtn:disabled { opacity: .5; cursor: default; transform: none; box-shadow: none; }" +
      "@media (max-width: 560px) { .clobtn { flex-basis: 84px; width: 84px; min-width: 84px; padding-inline: 4px; letter-spacing: .02em; }}" +
      "@media (prefers-reduced-motion: reduce) { .clobtn, .clobtn:hover, .clobtn:active { transition: none; transform: none; }}";
    document.head.appendChild(st);
  })();

  var LS = {
    get: function(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
    set: function(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
  };
  var LOCATIONS = [{id:"340",name:"Adelaide St"},{id:"100",name:"Edward St"},{id:"515",name:"St Pauls Ter"}];

  /* Store adapter. Same keys as the IOS tab either way; the backend is used when one is
     configured, and the browser holds it when not, so the sheet always works. */
  function makeStore(backend, token){
    function url(action, extra){
      return backend + "?action=" + action + "&token=" + encodeURIComponent(token) + (extra||"");
    }
    if (!backend) return {
      get: function(k){ return Promise.resolve(LS.get("hideout_clo:"+k)); },
      set: function(k,v){ LS.set("hideout_clo:"+k, v); return Promise.resolve(true); },
      getBatch: function(keys){ var o={}; keys.forEach(function(k){ o[k]=LS.get("hideout_clo:"+k); }); return Promise.resolve(o); }
    };
    var j = function(r){ return r.json(); };
    var ck = function(x){ if (x && x.error) throw new Error(x.error); return x; };
    return {
      get: function(k){ return fetch(url("get","&key="+encodeURIComponent(k)),{cache:"no-store"})
        .then(j).then(ck).then(function(x){ return x && x.value != null ? x.value : null; }); },
      getBatch: function(keys){ return fetch(url("getBatch","&keys="+encodeURIComponent(JSON.stringify(keys))),{cache:"no-store"})
        .then(j).then(ck).then(function(x){ return (x && x.values) || {}; }); },
      set: function(k,v){ return fetch(url("set","&key="+encodeURIComponent(k)+"&value="+encodeURIComponent(v)),{cache:"no-store"})
        .then(j).then(ck).then(function(){ return true; }); }
    };
  }

  var overlay = null, root = null;

  function shut(){
    try { if (root) root.unmount(); } catch(e){}
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null; root = null;
    document.documentElement.style.overflow = "";
  }

  function frame(){
    var o = document.createElement("div");
    o.id = "hideout-closing-overlay";
    o.setAttribute("role","dialog");
    o.setAttribute("aria-label","Closing checklist");
    o.style.cssText = "position:fixed;inset:0;z-index:99998;background:#f3f1ec;overflow:auto;" +
      "-webkit-overflow-scrolling:touch";
    var x = document.createElement("button");
    x.type = "button";
    x.setAttribute("aria-label","Close the closing checklist");
    x.textContent = "\u00d7";
    x.style.cssText = "position:fixed;top:10px;right:10px;z-index:99999;width:44px;height:44px;" +
      "font:700 26px/1 Jost,system-ui,sans-serif;background:#141312;color:#f3f1ec;border:3px solid #141312;" +
      "cursor:pointer;border-radius:0";
    x.onclick = shut;
    var mount = document.createElement("div");
    o.appendChild(x); o.appendChild(mount);
    document.body.appendChild(o);
    /* the host page must not scroll behind the sheet */
    document.documentElement.style.overflow = "hidden";
    overlay = o;
    return mount;
  }

  function gate(mount, go){
    mount.innerHTML = "";
    var w = document.createElement("div");
    w.className = "clo";
    w.style.cssText = "max-width:520px;margin:56px auto;padding:0 14px";
    var h = document.createElement("div");
    h.style.cssText = "border:3px solid #141312;background:#fff";
    h.innerHTML = "<div style=\"padding:16px;border-bottom:3px solid #141312;font:700 19px/1.2 Jost,system-ui,sans-serif\">" +
      "Which kitchen are you closing?</div>" +
      "<div style=\"padding:12px 16px;font:14px Jost,system-ui,sans-serif;color:rgba(20,19,18,.62)\">" +
      "Pick once \u2014 this device remembers it.</div>";
    LOCATIONS.forEach(function(l){
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = l.name;
      b.style.cssText = "display:block;width:100%;text-align:left;padding:18px 16px;min-height:60px;" +
        "font:700 17px/1.2 Jost,system-ui,sans-serif;background:#fff;color:#141312;border:0;" +
        "border-top:2px solid rgba(20,19,18,.18);cursor:pointer;-webkit-user-select:none;user-select:none;" +
        "touch-action:manipulation";
      b.onclick = function(){ LS.set("hideout_closing_branch", l.id); go(l.id); };
      h.appendChild(b);
    });
    w.appendChild(h);
    mount.appendChild(w);
  }

  var __CLO_ATTACHED = false;
  function ATTACH_MODULE(){
    if (__CLO_ATTACHED) return;
    __CLO_ATTACHED = true;
    var React = window.React, ReactDOM = window.ReactDOM;
  /* CLO-START — Closing checklist (2026-09-11)
     ═══════════════════════════════════════════════════════════════════════════════════════
     Ju An: "주방 마감 체크리스트. 호주 food standard 에 맞춰야 되고 council 이 venue 검사
     하러 왔을 때 증빙할 수 있는 evidence. Prep list 랑 ordering 도 추적. 마감할 땐 빨리 하고
     집에 가는 게 제일 행복한 사람들이니까."
  
     SELF-CONTAINED ON PURPOSE. This block defines `window.HideoutClosing` and depends on
     nothing but React. The host supplies a tiny store adapter, so the same source runs:
       · inside IOS  (01_ordering-app) as the Closing tab, storing through OrderCore's kv
       · standalone  (closing-standalone.html) for casuals with no app login
       · inside RCC  — not mounted; RCC only gets a header button that links out
     Everything a venue differs on (fridge units, equipment, tasks, prep template, supervisor
     email) is CONFIG, editable in the app — never hardcoded here beyond a sane default.
  
     THE SPEED RULE that shapes every screen below: the happy path is taps, the unhappy path
     is where the writing happens. A normal close should be under three minutes. The moment
     something is out of range, the form stops being fast and starts demanding a corrective
     action — which is exactly the record an EHO asks for.
     ═══════════════════════════════════════════════════════════════════════════════════════ */
  (function () {
    "use strict";
  
    var React = window.React;
    var useState = React.useState,
      useEffect = React.useEffect,
      useMemo = React.useMemo,
      useRef = React.useRef;
  
    /* ── dates: LOCAL calendar, never toISOString (same rule as OrderCore) ───────────────── */
    function pad2(n) {
      return (n < 10 ? "0" : "") + n;
    }
    function localISO(d) {
      d = d || new Date();
      return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    }
    function hhmm(d) {
      d = d || new Date();
      return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    }
    function addDays(iso, n) {
      var p = String(iso).split("-");
      var d = new Date(+p[0], +p[1] - 1, +p[2]);
      d.setDate(d.getDate() + n);
      return localISO(d);
    }
    var DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    function dowOf(iso) {
      var p = String(iso).split("-");
      return DOW[new Date(+p[0], +p[1] - 1, +p[2]).getDay()];
    }
    function prettyDate(iso) {
      var p = String(iso).split("-");
      var d = new Date(+p[0], +p[1] - 1, +p[2]);
      var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      var W = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return W[d.getDay()] + " " + d.getDate() + " " + M[d.getMonth()];
    }
    function uid(p) {
      return (p || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }
  
    /* ── the default venue config ────────────────────────────────────────────────────────────
       Temperature limits and the wording of the food-safety tasks follow the Food Standards
       Code as it is applied to a QLD food business: cold holding at or below 5 °C, hot holding
       at or above 60 °C, the two-stage cooling rule (60→21 °C within 2 h, then 21→5 °C within
       4 h), receiving checks, cleaning and sanitising of food-contact surfaces, and an accurate
       probe thermometer. `critical:true` marks the ones that carry a temperature or a legal
       record — those can never be swept by "All good", they have to be answered one at a time. */
    var DEFAULT_CONFIG = {
      supervisorEmail: "",
      ccEmail: "",
      /* Ju An 2026-09-13, the real list. Ids are descriptive rather than u1..u4 so that a reading
         recorded against a fridge can never be relabelled as a different one by a later edit. */
      units: [{
        id: "f_sandwich",
        name: "Sandwich fridge",
        kind: "fridge",
        min: 0,
        max: 5
      }, {
        id: "f_prep",
        name: "Prep fridge",
        kind: "fridge",
        min: 0,
        max: 5
      }, {
        id: "f_service",
        name: "Service fridge",
        kind: "fridge",
        min: 0,
        max: 5
      }, {
        id: "z_chest",
        name: "Chest freezer",
        kind: "freezer",
        min: -25,
        max: -15
      }, {
        id: "f_pastry",
        name: "Pastry fridge",
        kind: "fridge",
        min: 0,
        max: 5
      }],
      /* Ju An 2026-09-11: "Combi oven, stoves, fryer, griddle 정도일거같은데" — plus the ones a
         closing chef also has to kill. Edit the list in Setup; it is per venue. */
      equipment: [{
        id: "e1",
        name: "Combi oven",
        hint: "door ajar after cool-down"
      }, {
        id: "e2",
        name: "Stoves / burners",
        hint: "all knobs at zero"
      }, {
        id: "e3",
        name: "Fryer",
        hint: "off · oil filtered · lid on"
      }, {
        id: "e4",
        name: "Griddle / grill plate",
        hint: "off · scraped · tray emptied"
      }, {
        id: "e5",
        name: "Gas isolation valve",
        hint: "main valve closed"
      }, {
        id: "e6",
        name: "Extraction / rangehood",
        hint: "off after the plate has cooled"
      }, {
        id: "e7",
        name: "Bain-marie / hot display",
        hint: "off and emptied"
      }, {
        id: "e8",
        name: "Sandwich press / toaster",
        hint: ""
      }, {
        id: "e9",
        name: "Dishwasher",
        hint: "drained and off"
      }],
      /* The counterweight to the list above, and the reason it exists: someone in a hurry kills
         the wrong switch and a fridge full of stock is at ambient by morning. Naming what STAYS
         on is as much a control as naming what goes off. */
      leaveOn: [{
        id: "l1",
        name: "All fridges & freezers"
      }, {
        id: "l2",
        name: "Ice machine"
      }, {
        id: "l3",
        name: "Cool room"
      }],
      tasks: {
        food: [{
          id: "f1",
          label: "Hot food cooled by the 2 h / 4 h rule",
          hint: "60→21 °C within 2 h, then 21→5 °C within 4 h — log it below",
          freq: "daily",
          critical: true,
          cooling: true
        }, {
          id: "f2",
          label: "Open food covered, dated and labelled",
          hint: "ready-to-eat, date-marked",
          freq: "daily"
        }, {
          id: "f3",
          label: "Allergen items sealed and stored apart",
          hint: "declared allergens kept off shared shelves",
          freq: "daily"
        }, {
          id: "f4",
          label: "Out-of-date / unsafe food discarded",
          hint: "record it as wastage",
          freq: "daily"
        }, {
          id: "f5",
          label: "Deliveries today checked on arrival",
          hint: "chilled ≤5 °C · frozen hard · supplier + temp recorded",
          freq: "daily"
        }],
        clean: [{
          id: "c1",
          label: "Benches, boards and food-contact surfaces sanitised",
          freq: "daily"
        }, {
          id: "c2",
          label: "Dishwasher / sanitiser working",
          hint: "final rinse hot, or sanitiser at the right strength",
          freq: "daily"
        }, {
          id: "c3",
          label: "Handwash basin stocked",
          hint: "soap, paper towel, warm water — nothing stacked in it",
          freq: "daily"
        }, {
          id: "c4",
          label: "Floors, drains and mats cleaned",
          freq: "daily"
        }, {
          id: "c5",
          label: "Bins emptied, lids on, area clear",
          freq: "daily"
        }, {
          id: "c6",
          label: "No pest activity seen",
          hint: "droppings, gnaw marks, flies — say where if you saw any",
          freq: "daily"
        }, {
          id: "c7",
          label: "Deep clean: extraction filters",
          freq: "fri"
        }, {
          id: "c8",
          label: "Deep clean: fridge seals and shelves",
          freq: "fri"
        }],
        secure: [{
          id: "s1",
          label: "Chemicals stored away from food",
          freq: "daily"
        }, {
          id: "s2",
          label: "Back door and windows locked",
          freq: "daily"
        }, {
          id: "s3",
          label: "Lights off, alarm set",
          freq: "daily"
        }]
      },
      prepTemplate: [],
      /* Weekly probe-thermometer accuracy check. An EHO will ask how you know the readings on
         this sheet are true; this is the answer. Ice slurry should read 0 °C ±1. */
      probeDay: "mon"
    };
  
    /* ── evidence helpers ───────────────────────────────────────────────────────────────── */
    function tempState(unit, val) {
      if (val === "" || val == null || isNaN(Number(val))) return "empty";
      var n = Number(val);
      if (n > Number(unit.max) || n < Number(unit.min)) return "bad";
      // within 1 °C of the limit — worth a glance, not a breach
      if (n > Number(unit.max) - 1) return "warn";
      return "ok";
    }
    function dueToday(task, iso) {
      var f = task.freq || "daily";
      if (f === "daily") return true;
      if (DOW.indexOf(f) >= 0) return dowOf(iso) === f;
      return true;
    }
    function blankRecord(date, branch, branchName, dept) {
      return {
        v: 3,
        date: date,
        branch: branch,
        branchName: branchName || "",
        dept: dept || "chef",
        by: "",
        startedAt: new Date().toISOString(),
        finishedAt: "",
        temps: {},
        probe: {},
        checks: {},
        equipment: {},
        leaveOn: {},
        issues: [],
        cooling: [],
        prep: [],
        order: [],
        handover: "",
        waste: "",
        sent: ""
      };
    }
  
    /* What still stands between the person and the door. Returned as a list so the bottom bar
       can name the first one instead of just refusing to submit. */
    function outstanding(rec, cfg, date) {
      var out = [];
      cfg.units.forEach(function (u) {
        var st = tempState(u, rec.temps[u.id] && rec.temps[u.id].v);
        if (st === "empty") out.push({
          k: "temp:" + u.id,
          where: "Temperatures",
          what: u.name + " — no reading"
        });else if (st === "bad" && !(rec.temps[u.id] && String(rec.temps[u.id].action || "").trim())) out.push({
          k: "act:" + u.id,
          where: "Temperatures",
          what: u.name + " is out of range — what did you do?"
        });
      });
      if ((cfg.probeDay === "always" || dowOf(date) === cfg.probeDay) && !(rec.probe && rec.probe.done)) out.push({
        k: "probe",
        where: "Temperatures",
        what: "Probe thermometer check"
      });
      ["food", "clean", "secure"].forEach(function (g) {
        (cfg.tasks[g] || []).forEach(function (t) {
          if (!dueToday(t, date)) return;
          if (rec.checks[t.id] !== true && rec.checks[t.id] !== "na") out.push({
            k: "chk:" + t.id,
            where: GROUP_LABEL[g],
            what: t.label
          });
        });
      });
      cfg.equipment.forEach(function (e) {
        if (!rec.equipment[e.id]) out.push({
          k: "eq:" + e.id,
          where: "Shut down",
          what: e.name
        });
      });
      cfg.leaveOn.forEach(function (l) {
        if (!rec.leaveOn[l.id]) out.push({
          k: "on:" + l.id,
          where: "Shut down",
          what: l.name + " — confirm still running"
        });
      });
      if (!String(rec.by || "").trim()) out.push({
        k: "by",
        where: "Sign off",
        what: "Your name"
      });
      return out;
    }
    var GROUP_LABEL = {
      food: "Food",
      clean: "Cleaning",
      secure: "Secure"
    };
  
    /* A close is only evidence if it can leave the building in a form someone else reads.
       One row per line item, the same shape the email and the council export use. */
    function recordToRows(rec, cfg) {
      var rows = [];
      var meta = [rec.date, rec.branchName || rec.branch, rec.by || ""];
      cfg.units.forEach(function (u) {
        var t = rec.temps[u.id] || {};
        rows.push(meta.concat(["Temperature", u.name, t.v === "" || t.v == null ? "" : t.v + " C", tempState(u, t.v) === "bad" ? "OUT OF RANGE" : "ok", t.action || ""]));
      });
      if (rec.probe && rec.probe.done) rows.push(meta.concat(["Temperature", "Probe thermometer check", rec.probe.reading != null ? rec.probe.reading + " C" : "", rec.probe.ok === false ? "FAILED" : "ok", rec.probe.note || ""]));
      (rec.cooling || []).forEach(function (c) {
        rows.push(meta.concat(["Cooling", c.food || "", (c.t0 || "") + " → " + (c.t2 || "") + " → " + (c.t6 || ""), c.pass === false ? "FAILED" : "ok", c.note || ""]));
      });
      ["food", "clean", "secure"].forEach(function (g) {
        (cfg.tasks[g] || []).forEach(function (t) {
          if (!dueToday(t, rec.date)) return;
          var v = rec.checks[t.id];
          rows.push(meta.concat([GROUP_LABEL[g], t.label, "", v === true ? "done" : v === "na" ? "n/a" : "NOT DONE", ""]));
        });
      });
      cfg.equipment.forEach(function (e) {
        rows.push(meta.concat(["Shut down", e.name, "", rec.equipment[e.id] ? "off" : "NOT CONFIRMED", ""]));
      });
      cfg.leaveOn.forEach(function (l) {
        rows.push(meta.concat(["Left running", l.name, "", rec.leaveOn[l.id] ? "running" : "NOT CONFIRMED", ""]));
      });
      (rec.issues || []).forEach(function (i) {
        rows.push(meta.concat(["Issue", i.what || "", "", "corrective action", i.action || ""]));
      });
      if (String(rec.waste || "").trim()) rows.push(meta.concat(["Wastage", rec.waste, "", "", ""]));
      if (String(rec.handover || "").trim()) rows.push(meta.concat(["Handover", rec.handover, "", "", ""]));
      return rows;
    }
    var CSV_HEAD = ["Date", "Venue", "Closed by", "Section", "Item", "Reading", "Result", "Corrective action"];
    function toCsv(rows) {
      function q(s) {
        s = String(s == null ? "" : s);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }
      return [CSV_HEAD].concat(rows).map(function (r) {
        return r.map(q).join(",");
      }).join("\r\n");
    }
  
    /* ── styles ──────────────────────────────────────────────────────────────────────────────
       Scoped to `.clo`, and every token has a literal fallback so the standalone page looks the
       same as the tab inside IOS. Nothing here touches the host's stylesheet. */
    var CLO_CSS = "" + ".clo{--ink:var(--color-ink,#141312);--r:var(--color-primary,#ec3013);--rt:var(--color-primary-focus,#b82412);--y:var(--color-warning,#f2c100);--ok:var(--color-ok,#1e7a46);--b:var(--color-info,#1e4fb0);--paper:var(--color-canvas,#f3f1ec);--muted:rgba(20,19,18,.72);--line:rgba(20,19,18,.28);color:var(--ink);font-family:Jost,system-ui,-apple-system,sans-serif;font-weight:500}" + ".clo *{box-sizing:border-box;border-radius:0!important;font-family:inherit}" + ".clo .wrap{max-width:840px;margin:0 auto;padding-bottom:96px}"
    /* sticky head: where you are, how much is left */ + ".clo .head{position:sticky;top:0;z-index:20;background:var(--ink);color:#f3f1ec;padding:10px 14px}" + ".clo .head .l1{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}" + ".clo .head .ttl{font-size:19px;font-weight:700;letter-spacing:-.01em}" + ".clo .head .sub{font-size:13px;color:rgba(243,241,236,.72);font-weight:500}" + ".clo .head .pick{margin-left:auto;display:flex;gap:6px}" + ".clo .head select{font:inherit;font-size:13px;font-weight:700;background:transparent;color:#f3f1ec;border:2px solid rgba(243,241,236,.5);padding:5px 6px}" + ".clo .head select option{color:#141312}" + ".clo .bar{height:8px;background:rgba(243,241,236,.22);margin-top:9px;position:relative;overflow:hidden}" + ".clo .bar i{position:absolute;inset:0 auto 0 0;background:var(--y);transition:width .35s cubic-bezier(.2,.8,.2,1)}" + ".clo .bar i.full{background:var(--ok)}"
    /* section navigation — thumb sized, never wraps to two rows on a phone */ + ".clo .nav{display:flex;gap:0;border-bottom:3px solid var(--ink);background:#fff;position:sticky;top:var(--headh,86px);z-index:19;overflow-x:auto;-webkit-overflow-scrolling:touch}" + ".clo .nav button{flex:1 0 auto;min-width:84px;min-height:52px;border:0;border-right:1.5px solid var(--line);background:#fff;font:inherit;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);cursor:pointer;padding:6px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;transition:background .15s,color .15s}" + ".clo .nav button:last-child{border-right:0}" + ".clo .nav button[aria-pressed=true]{background:var(--ink);color:#f3f1ec}" + ".clo .nav button .n{font-size:11px;font-weight:700;padding:1px 6px;background:var(--r);color:#fff;min-width:18px}" + ".clo .nav button[aria-pressed=true] .n{background:var(--y);color:var(--ink)}" + ".clo .nav button .n.done{background:var(--ok);color:#fff}"
    /* group heading + the one-tap sweep */ + ".clo .grp{display:flex;align-items:center;gap:10px;padding:20px 14px 8px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}" + ".clo .grp::after{content:'';flex:1;height:3px;background:var(--ink)}" + ".clo .grp .sweep{flex:none;font:inherit;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border:2px solid var(--ink);background:#fff;color:var(--ink);padding:6px 10px;cursor:pointer;order:3}" + ".clo .grp .sweep:hover{background:var(--y)}" + ".clo .note{padding:0 14px 10px;font-size:13.5px;font-weight:400;color:var(--muted);line-height:1.45;max-width:70ch}"
    /* a check row: the whole thing is the target */ + ".clo .row{display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:12px;align-items:center;width:100%;text-align:left;background:#fff;border:0;border-bottom:1px solid var(--line);padding:10px 14px;min-height:64px;font:inherit;color:inherit;cursor:pointer}" + ".clo .row:active{background:rgba(242,193,0,.25)}" + ".clo .row .box{width:44px;height:44px;border:3px solid var(--ink);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;background:#fff;flex:none}" + ".clo .row.on .box{background:var(--ok);border-color:var(--ok);color:#fff}" + ".clo .row.na .box{background:var(--line);border-color:var(--muted);color:#fff;font-size:13px}" + ".clo .row .lb{font-size:16px;font-weight:600;line-height:1.25}" + ".clo .row.on .lb{color:var(--muted)}" + ".clo .row .hint{display:block;font-size:13px;font-weight:400;color:var(--muted);margin-top:3px;line-height:1.35}" + ".clo .row .tag{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border:2px solid var(--b);color:var(--b);padding:1px 6px;white-space:nowrap}" + ".clo .row .skip{font:inherit;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);background:none;border:2px solid var(--line);padding:6px 10px;cursor:pointer;min-height:44px;min-width:52px}" /* 44px floor: measured 46x34 on a 375px phone, and it sits next to the tick box */
    /* temperature row */ + ".clo .trow{display:grid;grid-template-columns:minmax(0,1fr) 128px;gap:12px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);background:#fff;min-height:68px}" + ".clo .trow .nm{font-size:16px;font-weight:600}" + ".clo .trow .lim{display:block;font-size:12.5px;font-weight:400;color:var(--muted);margin-top:2px}" + ".clo .tin{display:flex;align-items:center;border:3px solid var(--ink);background:#fff;height:52px}" + ".clo .tin input{width:100%;min-width:0;border:0;outline:none;background:transparent;font:inherit;font-size:22px;font-weight:700;text-align:right;padding:0 4px 0 8px;font-variant-numeric:tabular-nums}" + ".clo .tin .u{font-size:14px;font-weight:700;color:var(--muted);padding-right:9px}" + ".clo .tin.ok{border-color:var(--ok)} .clo .tin.warn{border-color:var(--y);box-shadow:inset 0 0 0 2px var(--y)} .clo .tin.bad{border-color:var(--rt);background:#fdeceb}" + ".clo .alert{background:#fdeceb;border-left:6px solid var(--rt);padding:12px 14px;margin:0;font-size:14px;line-height:1.45}" + ".clo .alert b{font-weight:700}" + ".clo .alert textarea,.clo .fld textarea,.clo .fld input{width:100%;font:inherit;font-size:15px;border:2px solid var(--ink);background:#fff;padding:9px 10px;margin-top:8px;resize:vertical}" + ".clo .fld{padding:12px 14px}" + ".clo .fld label{display:block;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}"
    /* buttons */ + ".clo .btn{font:inherit;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.04em;padding:12px 16px;border:3px solid var(--ink);background:#fff;color:var(--ink);cursor:pointer;min-height:48px}" + ".clo .btn:hover{background:var(--y)} .clo .btn.p{background:var(--r);border-color:var(--r);color:#fff} .clo .btn.p:hover{background:var(--rt);border-color:var(--rt)}" + ".clo .btn.sm{padding:7px 10px;font-size:12px;min-height:38px}" + ".clo .btn[disabled]{opacity:.45;cursor:not-allowed}"
    /* the bottom bar — the only thing that matters at 10pm */ + "/* one page: five folding sections instead of five screens */" + ".clo .sec{border-bottom:3px solid var(--ink)}" + ".clo .sec:last-of-type{border-bottom:0}" + ".clo .sech{display:flex;align-items:center;gap:10px;width:100%;text-align:left;font:inherit;font-size:15px;font-weight:700;letter-spacing:.02em;background:#fff;color:var(--ink);border:0;padding:14px;min-height:56px;cursor:pointer;position:sticky;top:var(--stickytop,164px);z-index:5}" + ".clo .sec.clear .sech{background:var(--paper);color:var(--muted)}" + ".clo .sech .car{flex:none;font-size:17px;line-height:1;width:12px}" + ".clo .sech .t{flex:1;min-width:0}" + ".clo .sech .n{flex:none;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:var(--rt);color:#fff;padding:3px 8px}" + ".clo .sech .n.done{background:var(--ok)}" + ".clo .secb{border-top:2px solid var(--line)}" + "/* the jump strip scrolls the page; it no longer swaps screens */" + ".clo .nav.jump button{white-space:nowrap}" + "/* a tap that drifts must still press the button, not select the label */" + ".clo button,.clo .sech,.clo label{-webkit-user-select:none;user-select:none;touch-action:manipulation;-webkit-tap-highlight-color:rgba(242,193,0,.35)}" + "/* text you might actually want to copy stays selectable */" + ".clo input,.clo textarea,.clo .note,.clo .hint{-webkit-user-select:text;user-select:text}" + "/* three states in words, not an abbreviation nobody can read at 10pm */" + ".clo .row.na .lb{color:var(--muted);text-decoration:line-through;text-decoration-thickness:1px}" + ".clo .row .nachip{flex:none;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);border:2px solid var(--line);padding:3px 7px;white-space:nowrap}" + ".clo .legend{display:flex;flex-wrap:wrap;gap:14px;padding:10px 14px;border-bottom:2px solid var(--line);background:var(--paper);font-size:12px;color:var(--muted)}" + ".clo .legend b{color:var(--ink);font-weight:700}" + ".clo .legend span{display:inline-flex;align-items:center;gap:6px}" + "@media (max-width:430px){.clo .row .skip{font-size:11px;padding:6px 8px;min-width:0}}" + "/* the one note, first on the page */" + ".clo .note-first .sech{background:var(--ink);color:#f3f1ec}" + ".clo .note-first .sech .n.opt{background:transparent;border:2px solid rgba(243,241,236,.45);color:#f3f1ec}" + ".clo .notebox{width:100%;box-sizing:border-box;font:inherit;font-size:16px;line-height:1.5;padding:12px;border:3px solid var(--ink);background:#fff;color:var(--ink);resize:vertical;min-height:104px}" + ".clo .notebox:focus{outline:none;box-shadow:4px 4px 0 var(--y)}" + ".clo .prepchk{display:flex;align-items:center;gap:10px;margin-top:12px;min-height:48px;font-size:15px;font-weight:700;cursor:pointer}" + ".clo .prepchk input{width:26px;height:26px;flex:none;accent-color:var(--ink)}" + ".clo .foot{position:fixed;left:0;right:0;bottom:0;z-index:30;background:var(--ink);color:#f3f1ec;padding:10px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 -4px 0 var(--y)}" + ".clo .foot .txt{flex:1;min-width:0;font-size:13.5px;line-height:1.3}" + ".clo .foot .txt b{display:block;font-size:15px;font-weight:700}" + ".clo .foot .go{flex:none;font:inherit;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;border:3px solid var(--y);background:var(--y);color:var(--ink);padding:13px 18px;cursor:pointer;min-height:54px}" + ".clo .foot .go.wait{background:transparent;color:#f3f1ec;border-color:rgba(243,241,236,.5)}" + ".clo .foot .go[disabled]{opacity:.5}"
    /* lists (prep / order / records) */ + ".clo .lrow{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 14px;border-bottom:1px solid var(--line);background:#fff;min-height:58px}" + ".clo .lrow .box{width:38px;height:38px;border:3px solid var(--ink);display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:700;cursor:pointer;background:#fff}" + ".clo .lrow.on .box{background:var(--ok);border-color:var(--ok);color:#fff}" + ".clo .lrow.on .nm{text-decoration:line-through;color:var(--muted)}" + ".clo .lrow .nm{font-size:16px;font-weight:600}" + ".clo .lrow .sub{display:block;font-size:12.5px;font-weight:400;color:var(--muted)}" + ".clo .lrow .x{background:none;border:0;color:var(--r);font-size:20px;font-weight:700;cursor:pointer;padding:6px 10px;line-height:1}" + ".clo .add{display:flex;gap:8px;padding:12px 14px;background:var(--paper);border-bottom:1px solid var(--line)}" + ".clo .add input{flex:1;min-width:0;font:inherit;font-size:16px;border:3px solid var(--ink);padding:10px;background:#fff}" + ".clo .empty{padding:26px 14px;color:var(--muted);font-weight:400;font-size:14.5px;line-height:1.5}" + ".clo .card{border:3px solid var(--ink);background:#fff;margin:14px}" + ".clo .card h4{margin:0;padding:11px 14px;border-bottom:3px solid var(--ink);font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}" + ".clo .kv{display:flex;justify-content:space-between;gap:12px;padding:9px 14px;border-bottom:1px solid var(--line);font-size:15px}" + ".clo .kv b{font-weight:700}" + ".clo .pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border:2px solid var(--ink);padding:2px 7px}" + ".clo .pill.ok{background:var(--ok);border-color:var(--ok);color:#fff} .clo .pill.bad{background:var(--rt);border-color:var(--rt);color:#fff} .clo .pill.warn{background:var(--y);border-color:var(--y)}" + ".clo .done{padding:44px 20px;text-align:center}" + ".clo .done .big{font-size:34px;font-weight:700;line-height:1.1;letter-spacing:-.02em}" + ".clo .done .sm{color:var(--muted);font-weight:400;margin:12px auto 22px;max-width:46ch;line-height:1.5;font-size:15px}" + "@media (max-width:520px){.clo .trow{grid-template-columns:minmax(0,1fr) 112px}.clo .row{grid-template-columns:52px minmax(0,1fr) auto;gap:10px;padding:10px}.clo .foot .txt b{font-size:14px}.clo .done .big{font-size:26px}}" + "@media (prefers-reduced-motion:reduce){.clo *{transition:none!important;animation:none!important}}";
    function CloStyle() {
      useEffect(function () {
        var el = document.getElementById("clo-css");
        if (!el) {
          el = document.createElement("style");
          el.id = "clo-css";
          document.head.appendChild(el);
        }
        if (el.textContent !== CLO_CSS) el.textContent = CLO_CSS;
      }, []);
      return null;
    }
    window.HideoutClosing = window.HideoutClosing || {};
    window.HideoutClosing._core = {
      React: React,
      useState: useState,
      useEffect: useEffect,
      useMemo: useMemo,
      useRef: useRef,
      pad2: pad2,
      localISO: localISO,
      hhmm: hhmm,
      addDays: addDays,
      dowOf: dowOf,
      prettyDate: prettyDate,
      uid: uid,
      DOW: DOW,
      DEFAULT_CONFIG: DEFAULT_CONFIG,
      GROUP_LABEL: GROUP_LABEL,
      tempState: tempState,
      dueToday: dueToday,
      blankRecord: blankRecord,
      outstanding: outstanding,
      recordToRows: recordToRows,
      toCsv: toCsv,
      CSV_HEAD: CSV_HEAD,
      CloStyle: CloStyle
    };
  })();
  (function () {
    "use strict";
  
    var K = window.HideoutClosing._core;
    var React = K.React,
      useState = K.useState,
      useEffect = K.useEffect,
      useMemo = K.useMemo,
      useRef = K.useRef;
    var localISO = K.localISO,
      hhmm = K.hhmm,
      dowOf = K.dowOf,
      prettyDate = K.prettyDate,
      uid = K.uid;
    var DEFAULT_CONFIG = K.DEFAULT_CONFIG,
      tempState = K.tempState,
      dueToday = K.dueToday;
    var blankRecord = K.blankRecord,
      outstanding = K.outstanding,
      recordToRows = K.recordToRows,
      toCsv = K.toCsv;
    var F = React.Fragment;
  
    /* ── one check row ────────────────────────────────────────────────────────────────────
       The entire row is the hit target. "Skip" is deliberately smaller and separate: marking
       something not-applicable is a claim on the record, not a way past it. */
    function Check({
      on,
      na,
      label,
      hint,
      tag,
      onToggle,
      onNa
    }) {
      /* aria-checked="mixed" for "not tonight": the item is neither done nor outstanding, and saying
         "false" would report it as unanswered to anyone using a screen reader.
         The keydown guard matters more than it looks - without it, Enter on the "Not tonight" button
         bubbled up and ticked the row as well, so one keypress gave two different answers. */
      return /*#__PURE__*/React.createElement("div", {
        className: "row" + (on ? " on" : "") + (na ? " na" : ""),
        role: "checkbox",
        "aria-checked": on ? "true" : na ? "mixed" : "false",
        tabIndex: 0,
        onClick: onToggle,
        onKeyDown: function (e) {
          if (e.target !== e.currentTarget) return;
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onToggle();
          }
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "box",
        "aria-hidden": "true"
      }, on ? "\u2713" : na ? "\u2013" : ""), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
        className: "lb"
      }, label), hint ? /*#__PURE__*/React.createElement("span", {
        className: "hint"
      }, hint) : null), /*#__PURE__*/React.createElement("span", {
        style: {
          display: "flex",
          gap: 8,
          alignItems: "center"
        }
      }, tag ? /*#__PURE__*/React.createElement("span", {
        className: "tag"
      }, tag) : null, na ? /*#__PURE__*/React.createElement("span", {
        className: "nachip"
      }, "not tonight") : null, onNa ? /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "skip",
        onClick: function (e) {
          e.stopPropagation();
          onNa();
        }
      }, na ? "Undo" : "Not tonight") : null));
    }
  
    /* ── step 1 · temperatures ──────────────────────────────────────────────────────────────
       The legally load-bearing screen. A reading outside the unit's range does not merely turn
       red — it opens a corrective-action box that the close cannot finish without. That box is
       the single most useful thing on the whole sheet when an inspector reads it back. */
    function TempStep({
      cfg,
      rec,
      set,
      date
    }) {
      var probeDue = cfg.probeDay === "always" || dowOf(date) === cfg.probeDay;
      function setTemp(u, field, val) {
        set(function (r) {
          r.temps = Object.assign({}, r.temps);
          r.temps[u.id] = Object.assign({
            v: "",
            action: ""
          }, r.temps[u.id]);
          r.temps[u.id][field] = val;
          if (field === "v") r.temps[u.id].at = hhmm();
        });
      }
      return /*#__PURE__*/React.createElement(F, null, /*#__PURE__*/React.createElement("div", {
        className: "grp"
      }, "Fridges & freezers"), /*#__PURE__*/React.createElement("p", {
        className: "note"
      }, "Read each unit\u2019s own display or probe it. Cold holding is at or below 5\xA0\xB0C; a freezer should sit around \u221218\xA0\xB0C. Anything outside the range asks you what you did about it \u2014 that answer is the record."), cfg.units.map(function (u) {
        var t = rec.temps[u.id] || {};
        var st = tempState(u, t.v);
        return /*#__PURE__*/React.createElement(F, {
          key: u.id
        }, /*#__PURE__*/React.createElement("div", {
          className: "trow"
        }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
          className: "nm"
        }, u.name), /*#__PURE__*/React.createElement("span", {
          className: "lim"
        }, "safe ", u.min, "\xA0\xB0C to ", u.max, "\xA0\xB0C", t.at ? " · entered " + t.at : "")), /*#__PURE__*/React.createElement("label", {
          className: "tin " + (st === "empty" ? "" : st)
        }, /*#__PURE__*/React.createElement("input", {
          type: "text",
          inputMode: "decimal",
          pattern: "-?[0-9.]*",
          value: t.v == null ? "" : t.v,
          "aria-label": u.name + " temperature in celsius",
          placeholder: "\u2014",
          onChange: function (e) {
            setTemp(u, "v", e.target.value.replace(/[^0-9.\-]/g, ""));
          }
        }), /*#__PURE__*/React.createElement("span", {
          className: "u"
        }, "\xB0C"))), st === "bad" && /*#__PURE__*/React.createElement("div", {
          className: "alert"
        }, /*#__PURE__*/React.createElement("b", null, u.name, " is out of range."), " Say what you did \u2014 moved the stock, turned the unit down, called the tech, threw it out. Council asks for this, not for a tidy number.", /*#__PURE__*/React.createElement("textarea", {
          rows: 2,
          value: t.action || "",
          placeholder: "e.g. moved all dairy to Fridge 2, turned thermostat down, logged a service call",
          onChange: function (e) {
            setTemp(u, "action", e.target.value);
          }
        })));
      }), probeDue && /*#__PURE__*/React.createElement(F, null, /*#__PURE__*/React.createElement("div", {
        className: "grp"
      }, "Probe thermometer"), /*#__PURE__*/React.createElement("p", {
        className: "note"
      }, "Weekly accuracy check. Pack a cup with crushed ice, add a splash of water, stir, and probe it \u2014 a good thermometer reads 0\xA0\xB0C give or take one. This is how you show the readings above are true."), /*#__PURE__*/React.createElement("div", {
        className: "trow"
      }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
        className: "nm"
      }, "Ice slurry reading"), /*#__PURE__*/React.createElement("span", {
        className: "lim"
      }, "should be \u22121 to 1\xA0\xB0C")), /*#__PURE__*/React.createElement("label", {
        className: "tin " + (rec.probe && rec.probe.done ? rec.probe.ok ? "ok" : "bad" : "")
      }, /*#__PURE__*/React.createElement("input", {
        type: "text",
        inputMode: "decimal",
        value: rec.probe && rec.probe.reading != null ? rec.probe.reading : "",
        placeholder: "\u2014",
        "aria-label": "Probe thermometer ice slurry reading",
        onChange: function (e) {
          var v = e.target.value.replace(/[^0-9.\-]/g, "");
          var n = Number(v);
          var ok = v !== "" && !isNaN(n) && n >= -1 && n <= 1;
          set(function (r) {
            r.probe = {
              done: v !== "",
              reading: v,
              ok: ok,
              note: r.probe && r.probe.note || ""
            };
          });
        }
      }), /*#__PURE__*/React.createElement("span", {
        className: "u"
      }, "\xB0C"))), rec.probe && rec.probe.done && !rec.probe.ok && /*#__PURE__*/React.createElement("div", {
        className: "alert"
      }, /*#__PURE__*/React.createElement("b", null, "That probe is off."), " Recalibrate it or take it out of service and use a spare \u2014 every reading above was taken with it.", /*#__PURE__*/React.createElement("textarea", {
        rows: 2,
        value: rec.probe.note || "",
        placeholder: "e.g. recalibrated to 0.0, or bagged and tagged, using the spare probe",
        onChange: function (e) {
          var v = e.target.value;
          set(function (r) {
            r.probe = Object.assign({}, r.probe, {
              note: v
            });
          });
        }
      }))));
    }
  
    /* ── the 2 h / 4 h cooling log ────────────────────────────────────────────────────────── */
    function CoolingLog({
      rec,
      set
    }) {
      var rows = rec.cooling || [];
      function upd(i, k, v) {
        set(function (r) {
          r.cooling = (r.cooling || []).slice();
          r.cooling[i] = Object.assign({}, r.cooling[i]);
          r.cooling[i][k] = v;
          var c = r.cooling[i];
          var a = Number(c.t2),
            b = Number(c.t6);
          c.pass = (c.t2 === "" || c.t2 == null || isNaN(a) ? null : a <= 21) === false ? false : c.t6 === "" || c.t6 == null || isNaN(b) ? null : b <= 5 && a <= 21;
        });
      }
      return /*#__PURE__*/React.createElement("div", {
        style: {
          background: "#fff"
        }
      }, rows.length === 0 && /*#__PURE__*/React.createElement("div", {
        className: "empty"
      }, "Nothing cooling today \u2014 leave it empty. Add a line only if hot food went into the fridge to cool."), rows.map(function (c, i) {
        return /*#__PURE__*/React.createElement("div", {
          key: c.id || i,
          style: {
            borderBottom: "1px solid var(--line)",
            padding: "10px 14px"
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 8
          }
        }, /*#__PURE__*/React.createElement("input", {
          value: c.food || "",
          placeholder: "What was cooled (e.g. bolognese)",
          "aria-label": "Food cooled",
          style: {
            flex: 1,
            minWidth: 0,
            font: "inherit",
            fontSize: 15,
            border: "2px solid var(--ink)",
            padding: "9px 10px",
            background: "#fff"
          },
          onChange: function (e) {
            upd(i, "food", e.target.value);
          }
        }), /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "x",
          "aria-label": "Remove line",
          style: {
            background: "none",
            border: 0,
            color: "var(--r)",
            fontSize: 20,
            fontWeight: 700,
            cursor: "pointer"
          },
          onClick: function () {
            set(function (r) {
              r.cooling = (r.cooling || []).filter(function (_, j) {
                return j !== i;
              });
            });
          }
        }, "\xD7")), /*#__PURE__*/React.createElement("div", {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(3,minmax(0,1fr))",
            gap: 8
          }
        }, [["t0", "start °C", ""], ["t2", "after 2 h", "≤ 21"], ["t6", "after 4 h more", "≤ 5"]].map(function (f) {
          var bad = f[0] === "t2" && c.t2 !== "" && c.t2 != null && Number(c.t2) > 21 || f[0] === "t6" && c.t6 !== "" && c.t6 != null && Number(c.t6) > 5;
          return /*#__PURE__*/React.createElement("label", {
            key: f[0],
            style: {
              display: "block"
            }
          }, /*#__PURE__*/React.createElement("span", {
            style: {
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".05em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 3
            }
          }, f[1], f[2] ? " " + f[2] : ""), /*#__PURE__*/React.createElement("span", {
            className: "tin" + (bad ? " bad" : ""),
            style: {
              height: 46
            }
          }, /*#__PURE__*/React.createElement("input", {
            type: "text",
            inputMode: "decimal",
            value: c[f[0]] == null ? "" : c[f[0]],
            "aria-label": (c.food || "item") + " " + f[1],
            onChange: function (e) {
              upd(i, f[0], e.target.value.replace(/[^0-9.\-]/g, ""));
            }
          }), /*#__PURE__*/React.createElement("span", {
            className: "u"
          }, "\xB0C")));
        })), c.pass === false && /*#__PURE__*/React.createElement("div", {
          className: "alert",
          style: {
            marginTop: 8
          }
        }, /*#__PURE__*/React.createElement("b", null, "That batch missed the cooling rule."), " It cannot go back on the menu \u2014 say what happened to it.", /*#__PURE__*/React.createElement("textarea", {
          rows: 2,
          value: c.note || "",
          placeholder: "e.g. discarded 4 L, split into shallow trays next time",
          onChange: function (e) {
            upd(i, "note", e.target.value);
          }
        })));
      }), /*#__PURE__*/React.createElement("div", {
        className: "add"
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        style: {
          width: "100%"
        },
        onClick: function () {
          set(function (r) {
            r.cooling = (r.cooling || []).concat([{
              id: uid("cl"),
              food: "",
              t0: "",
              t2: "",
              t6: "",
              pass: null,
              note: ""
            }]);
          });
        }
      }, "+ Add a cooling line")));
    }
  
    /* ── steps 2 & 3 · food and cleaning ──────────────────────────────────────────────────── */
    function TaskStep({
      group,
      title,
      blurb,
      cfg,
      rec,
      set,
      date
    }) {
      var tasks = (cfg.tasks[group] || []).filter(function (t) {
        return dueToday(t, date);
      });
      var sweepable = tasks.filter(function (t) {
        return !t.critical;
      });
      var allSwept = sweepable.length > 0 && sweepable.every(function (t) {
        return rec.checks[t.id] === true;
      });
      function toggle(t) {
        set(function (r) {
          r.checks = Object.assign({}, r.checks);
          r.checks[t.id] = r.checks[t.id] === true ? false : true;
        });
      }
      function na(t) {
        set(function (r) {
          r.checks = Object.assign({}, r.checks);
          r.checks[t.id] = r.checks[t.id] === "na" ? false : "na";
        });
      }
      return /*#__PURE__*/React.createElement(F, null, /*#__PURE__*/React.createElement("div", {
        className: "grp"
      }, title, sweepable.length > 1 && /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "sweep",
        onClick: function () {
          set(function (r) {
            r.checks = Object.assign({}, r.checks);
            sweepable.forEach(function (t) {
              r.checks[t.id] = allSwept ? false : true;
            });
          });
        }
      }, allSwept ? "clear" : "all good")), blurb ? /*#__PURE__*/React.createElement("p", {
        className: "note"
      }, blurb) : null, tasks.length === 0 && /*#__PURE__*/React.createElement("div", {
        className: "empty"
      }, "Nothing due tonight in this section."), tasks.map(function (t) {
        return /*#__PURE__*/React.createElement(F, {
          key: t.id
        }, /*#__PURE__*/React.createElement(Check, {
          on: rec.checks[t.id] === true,
          na: rec.checks[t.id] === "na",
          label: t.label,
          hint: t.hint,
          tag: t.freq && t.freq !== "daily" ? t.freq === "always" ? "" : t.freq.toUpperCase() + " only" : t.critical ? "record" : "",
          onToggle: function () {
            toggle(t);
          },
          onNa: t.critical ? null : function () {
            na(t);
          }
        }), t.cooling && rec.checks[t.id] === true && /*#__PURE__*/React.createElement(CoolingLog, {
          rec: rec,
          set: set
        }));
      }));
    }
  
    /* ── step 4 · shut down ────────────────────────────────────────────────────────────────
       Two lists, deliberately: what must be OFF, and what must still be RUNNING. The second
       list exists because the expensive mistake at this hour is killing a fridge, not leaving
       a toaster on. */
    function ShutdownStep({
      cfg,
      rec,
      set
    }) {
      var allOff = cfg.equipment.length > 0 && cfg.equipment.every(function (e) {
        return rec.equipment[e.id];
      });
      return /*#__PURE__*/React.createElement(F, null, /*#__PURE__*/React.createElement("div", {
        className: "grp"
      }, "Turn off", cfg.equipment.length > 1 && /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "sweep",
        onClick: function () {
          set(function (r) {
            r.equipment = Object.assign({}, r.equipment);
            cfg.equipment.forEach(function (e) {
              r.equipment[e.id] = !allOff;
            });
          });
        }
      }, allOff ? "clear" : "all off")), /*#__PURE__*/React.createElement("p", {
        className: "note"
      }, "Walk the line and look at each one. Gas last, after the extraction has pulled the heat out."), cfg.equipment.length === 0 && /*#__PURE__*/React.createElement("div", {
        className: "empty"
      }, "No equipment listed yet \u2014 add yours in Setup."), cfg.equipment.map(function (e) {
        return /*#__PURE__*/React.createElement(Check, {
          key: e.id,
          on: !!rec.equipment[e.id],
          label: e.name,
          hint: e.hint,
          onToggle: function () {
            set(function (r) {
              r.equipment = Object.assign({}, r.equipment);
              r.equipment[e.id] = !r.equipment[e.id];
            });
          }
        });
      }), /*#__PURE__*/React.createElement("div", {
        className: "grp",
        style: {
          color: "var(--ok)"
        }
      }, "Leave running"), /*#__PURE__*/React.createElement("p", {
        className: "note"
      }, "Check these are still on before you hit the lights. A fridge switched off tonight is a bin full of stock in the morning."), cfg.leaveOn.map(function (l) {
        return /*#__PURE__*/React.createElement(Check, {
          key: l.id,
          on: !!rec.leaveOn[l.id],
          label: l.name,
          hint: "still running and cold",
          onToggle: function () {
            set(function (r) {
              r.leaveOn = Object.assign({}, r.leaveOn);
              r.leaveOn[l.id] = !r.leaveOn[l.id];
            });
          }
        });
      }), /*#__PURE__*/React.createElement("div", {
        className: "grp"
      }, "Secure"), /*#__PURE__*/React.createElement(ShutSecure, {
        cfg: cfg,
        rec: rec,
        set: set
      }));
    }
    function ShutSecure({
      cfg,
      rec,
      set
    }) {
      return /*#__PURE__*/React.createElement(F, null, (cfg.tasks.secure || []).map(function (t) {
        return /*#__PURE__*/React.createElement(Check, {
          key: t.id,
          on: rec.checks[t.id] === true,
          label: t.label,
          hint: t.hint,
          onToggle: function () {
            set(function (r) {
              r.checks = Object.assign({}, r.checks);
              r.checks[t.id] = r.checks[t.id] === true ? false : true;
            });
          }
        });
      }));
    }
  
    /* ── step 5 · sign off ────────────────────────────────────────────────────────────────── */
    function FinishStep({
      cfg,
      rec,
      set,
      left
    }) {
      return /*#__PURE__*/React.createElement(F, null, /*#__PURE__*/React.createElement("div", {
        className: "grp"
      }, "Anything worth passing on"), /*#__PURE__*/React.createElement("div", {
        className: "fld"
      }, /*#__PURE__*/React.createElement("label", {
        htmlFor: "clo-waste"
      }, "Wastage tonight"), /*#__PURE__*/React.createElement("textarea", {
        id: "clo-waste",
        rows: 2,
        value: rec.waste || "",
        placeholder: "What went in the bin and roughly how much.",
        onChange: function (e) {
          var v = e.target.value;
          set(function (r) {
            r.waste = v;
          });
        }
      })), /*#__PURE__*/React.createElement("div", {
        className: "grp"
      }, "Sign off"), /*#__PURE__*/React.createElement("div", {
        className: "fld"
      }, /*#__PURE__*/React.createElement("label", {
        htmlFor: "clo-by"
      }, "Who closed tonight"), /*#__PURE__*/React.createElement("input", {
        id: "clo-by",
        value: rec.by || "",
        placeholder: "Your name",
        autoComplete: "name",
        onChange: function (e) {
          var v = e.target.value;
          set(function (r) {
            r.by = v;
          });
        }
      })), left.length > 0 && /*#__PURE__*/React.createElement("div", {
        className: "alert"
      }, /*#__PURE__*/React.createElement("b", null, left.length, " thing", left.length > 1 ? "s" : "", " still open."), " You can send anyway \u2014 an honest gap beats a tick that was never true \u2014 but the email and the council export will both show it.", /*#__PURE__*/React.createElement("div", {
        style: {
          marginTop: 8,
          fontSize: 13.5
        }
      }, left.slice(0, 6).map(function (o, i) {
        return /*#__PURE__*/React.createElement("div", {
          key: i
        }, "\xB7 ", o.where, ": ", o.what);
      }), left.length > 6 ? /*#__PURE__*/React.createElement("div", null, "\xB7 and ", left.length - 6, " more") : null)));
    }
  
    /* ── prep and order tabs ─────────────────────────────────────────────────────────────── */
    function ListTab({
      items,
      setItems,
      placeholder,
      blurb,
      emptyText,
      extra
    }) {
      var [draft, setDraft] = useState("");
      function add() {
        var t = draft.trim();
        if (!t) return;
        setItems(items.concat([{
          id: uid("i"),
          name: t,
          done: false,
          at: new Date().toISOString()
        }]));
        setDraft("");
      }
      return /*#__PURE__*/React.createElement(F, null, blurb ? /*#__PURE__*/React.createElement("p", {
        className: "note",
        style: {
          paddingTop: 14
        }
      }, blurb) : null, /*#__PURE__*/React.createElement("div", {
        className: "add"
      }, /*#__PURE__*/React.createElement("input", {
        value: draft,
        placeholder: placeholder,
        "aria-label": placeholder,
        enterKeyHint: "done",
        onChange: function (e) {
          setDraft(e.target.value);
        },
        onKeyDown: function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }
      }), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn p",
        onClick: add
      }, "Add")), extra || null, items.length === 0 && /*#__PURE__*/React.createElement("div", {
        className: "empty"
      }, emptyText), items.map(function (it, i) {
        return /*#__PURE__*/React.createElement("div", {
          key: it.id,
          className: "lrow" + (it.done ? " on" : "")
        }, /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "box",
          "aria-label": (it.done ? "Untick " : "Tick ") + it.name,
          onClick: function () {
            setItems(items.map(function (x, j) {
              return j === i ? Object.assign({}, x, {
                done: !x.done
              }) : x;
            }));
          }
        }, it.done ? "✓" : ""), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
          className: "nm"
        }, it.name), it.note ? /*#__PURE__*/React.createElement("span", {
          className: "sub"
        }, it.note) : null), /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "x",
          "aria-label": "Remove " + it.name,
          onClick: function () {
            setItems(items.filter(function (_, j) {
              return j !== i;
            }));
          }
        }, "\xD7"));
      }));
    }
  
    /* ── records tab — the council-facing side ────────────────────────────────────────────── */
    function RecordsTab({
      store,
      cfg,
      branch,
      locations,
      onOpen
    }) {
      var [rows, setRows] = useState(null);
      var [busy, setBusy] = useState(false);
      /* 30 nights. One batched read where the host can do it (the ordering app's kv can), and
         only otherwise 30 round trips — on a phone over the shop wifi that difference is the
         gap between "instant" and "why is this spinning". */
      useEffect(function () {
        var dead = false;
        var keys = [];
        for (var i = 0; i < 30; i++) keys.push("closing:" + K.addDays(localISO(), -i) + ":" + branch);
        function done(list) {
          if (!dead) setRows(list);
        }
        function parse(raw) {
          if (!raw) return null;
          try {
            return JSON.parse(raw);
          } catch (e) {
            return null;
          }
        }
        if (store.getBatch) {
          store.getBatch(keys).then(function (map) {
            done(keys.map(function (k) {
              return parse(map && map[k]);
            }).filter(Boolean));
          }).catch(function () {
            done([]);
          });
        } else {
          var out = [],
            n = 0;
          (function step() {
            if (dead) return;
            if (n >= keys.length) return done(out);
            var k = keys[n++];
            store.get(k).then(function (raw) {
              var r = parse(raw);
              if (r) out.push(r);
              step();
            }).catch(function () {
              step();
            });
          })();
        }
        return function () {
          dead = true;
        };
      }, [branch]);
      function exportCsv() {
        if (!rows || !rows.length) return;
        setBusy(true);
        var all = [];
        rows.slice().reverse().forEach(function (r) {
          all = all.concat(recordToRows(r, cfg));
        });
        var csv = toCsv(all);
        var loc = (locations.find(function (l) {
          return l.id === branch;
        }) || {}).name || branch;
        var name = "closing-records_" + loc.replace(/[^A-Za-z0-9]+/g, "-") + "_" + localISO() + ".csv";
        try {
          var blob = new Blob(["﻿" + csv], {
            type: "text/csv;charset=utf-8"
          });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          setTimeout(function () {
            URL.revokeObjectURL(url);
            a.remove();
          }, 0);
        } catch (e) {
          alert("Could not build the file — " + (e && e.message || e));
        }
        setBusy(false);
      }
      if (rows === null) return /*#__PURE__*/React.createElement("div", {
        className: "empty"
      }, "Looking up the last 30 nights\u2026");
      return /*#__PURE__*/React.createElement(F, null, /*#__PURE__*/React.createElement("div", {
        className: "grp"
      }, "Last 30 nights ", /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 500,
          letterSpacing: 0,
          textTransform: "none",
          color: "var(--muted)"
        }
      }, rows.length, " closed")), /*#__PURE__*/React.createElement("p", {
        className: "note"
      }, "This is what you hand an environmental health officer. Every reading, every tick, and every corrective action, by date. Export gives you one CSV that opens in Excel."), /*#__PURE__*/React.createElement("div", {
        style: {
          padding: "0 14px 14px"
        }
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn p",
        onClick: exportCsv,
        disabled: busy || !rows.length
      }, "Export for council (CSV)")), rows.length === 0 && /*#__PURE__*/React.createElement("div", {
        className: "empty"
      }, "Nothing recorded yet for this venue. Tonight\u2019s close will be the first."), rows.map(function (r) {
        var left = outstanding(r, cfg, r.date);
        var breaches = cfg.units.filter(function (u) {
          return tempState(u, r.temps && r.temps[u.id] && r.temps[u.id].v) === "bad";
        }).length;
        return /*#__PURE__*/React.createElement("div", {
          key: r.date,
          className: "lrow",
          style: {
            cursor: "pointer"
          },
          onClick: function () {
            onOpen(r);
          }
        }, /*#__PURE__*/React.createElement("span", {
          className: "box",
          style: {
            border: 0,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.1,
            flexDirection: "column",
            display: "flex"
          }
        }, r.date.slice(8), /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 9,
            color: "var(--muted)"
          }
        }, r.date.slice(5, 7))), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
          className: "nm"
        }, prettyDate(r.date)), /*#__PURE__*/React.createElement("span", {
          className: "sub"
        }, r.by || "unsigned", r.finishedAt ? " · " + hhmm(new Date(r.finishedAt)) : " · not finished", r.sent ? " · emailed" : "")), /*#__PURE__*/React.createElement("span", {
          style: {
            display: "flex",
            gap: 6
          }
        }, breaches > 0 && /*#__PURE__*/React.createElement("span", {
          className: "pill bad"
        }, breaches, " temp"), left.length > 0 && /*#__PURE__*/React.createElement("span", {
          className: "pill warn"
        }, left.length, " open"), breaches === 0 && left.length === 0 && /*#__PURE__*/React.createElement("span", {
          className: "pill ok"
        }, "clean")));
      }));
    }
  
    /* ── setup ────────────────────────────────────────────────────────────────────────────── */
    function EditList({
      title,
      note,
      items,
      onChange,
      fields
    }) {
      return /*#__PURE__*/React.createElement("div", {
        className: "card"
      }, /*#__PURE__*/React.createElement("h4", null, title), note ? /*#__PURE__*/React.createElement("p", {
        className: "note",
        style: {
          padding: "10px 14px 4px"
        }
      }, note) : null, items.map(function (it, i) {
        return /*#__PURE__*/React.createElement("div", {
          key: it.id,
          style: {
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto",
            gap: 8,
            padding: "9px 14px",
            borderBottom: "1px solid var(--line)",
            alignItems: "center"
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            display: "grid",
            gap: 6
          }
        }, fields.map(function (f) {
          return /*#__PURE__*/React.createElement("input", {
            key: f.k,
            value: it[f.k] == null ? "" : it[f.k],
            placeholder: f.ph,
            "aria-label": f.ph,
            style: {
              font: "inherit",
              fontSize: 15,
              border: "2px solid var(--ink)",
              padding: "8px 9px",
              background: "#fff",
              width: f.w || "100%"
            },
            onChange: function (e) {
              var v = f.num ? e.target.value.replace(/[^0-9.\-]/g, "") : e.target.value;
              onChange(items.map(function (x, j) {
                return j === i ? Object.assign({}, x, function (o) {
                  o[f.k] = v;
                  return o;
                }({})) : x;
              }));
            }
          });
        })), /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "x",
          "aria-label": "Remove",
          onClick: function () {
            onChange(items.filter(function (_, j) {
              return j !== i;
            }));
          }
        }, "\xD7"));
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          padding: 12
        }
      }, /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn sm",
        onClick: function () {
          var o = {
            id: uid("n")
          };
          fields.forEach(function (f) {
            o[f.k] = f.def != null ? f.def : "";
          });
          onChange(items.concat([o]));
        }
      }, "+ Add")));
    }
    function SetupView({
      cfg,
      saveCfg
    }) {
      function upd(patch) {
        saveCfg(Object.assign({}, cfg, patch));
      }
      return /*#__PURE__*/React.createElement(F, null, /*#__PURE__*/React.createElement("div", {
        className: "grp"
      }, "Who gets the report"), /*#__PURE__*/React.createElement("div", {
        className: "fld"
      }, /*#__PURE__*/React.createElement("label", {
        htmlFor: "clo-sup"
      }, "Supervisor email"), /*#__PURE__*/React.createElement("input", {
        id: "clo-sup",
        type: "email",
        value: cfg.supervisorEmail || "",
        placeholder: "supervisor@thehideoutspecialtycoffee.com",
        onChange: function (e) {
          upd({
            supervisorEmail: e.target.value
          });
        }
      })), /*#__PURE__*/React.createElement("div", {
        className: "fld"
      }, /*#__PURE__*/React.createElement("label", {
        htmlFor: "clo-cc"
      }, "Copy to (optional)"), /*#__PURE__*/React.createElement("input", {
        id: "clo-cc",
        type: "email",
        value: cfg.ccEmail || "",
        placeholder: "second address",
        onChange: function (e) {
          upd({
            ccEmail: e.target.value
          });
        }
      })), /*#__PURE__*/React.createElement(EditList, {
        title: "Fridges & freezers",
        note: "Name them the way the kitchen calls them, and set each one's safe range.",
        items: cfg.units,
        onChange: function (v) {
          upd({
            units: v
          });
        },
        fields: [{
          k: "name",
          ph: "Unit name"
        }, {
          k: "min",
          ph: "min °C",
          num: true,
          def: 0
        }, {
          k: "max",
          ph: "max °C",
          num: true,
          def: 5
        }]
      }), /*#__PURE__*/React.createElement(EditList, {
        title: "Equipment to turn off",
        note: "Everything a closing chef has to kill. Add the hint that stops the argument \u2014 'oil filtered', 'main valve'.",
        items: cfg.equipment,
        onChange: function (v) {
          upd({
            equipment: v
          });
        },
        fields: [{
          k: "name",
          ph: "Equipment"
        }, {
          k: "hint",
          ph: "Note shown under it"
        }]
      }), /*#__PURE__*/React.createElement(EditList, {
        title: "Must stay running",
        note: "The list that protects the stock.",
        items: cfg.leaveOn,
        onChange: function (v) {
          upd({
            leaveOn: v
          });
        },
        fields: [{
          k: "name",
          ph: "What stays on"
        }]
      }), /*#__PURE__*/React.createElement("div", {
        className: "card"
      }, /*#__PURE__*/React.createElement("h4", null, "Probe check day"), /*#__PURE__*/React.createElement("div", {
        style: {
          padding: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap"
        }
      }, [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"], ["always", "Every night"]].map(function (d) {
        return /*#__PURE__*/React.createElement("button", {
          key: d[0],
          type: "button",
          className: "btn sm",
          "aria-pressed": cfg.probeDay === d[0],
          style: cfg.probeDay === d[0] ? {
            background: "var(--ink)",
            color: "#f3f1ec"
          } : null,
          onClick: function () {
            upd({
              probeDay: d[0]
            });
          }
        }, d[1]);
      }))));
    }
  
    /* ── a finished record, read back ─────────────────────────────────────────────────────── */
    function RecordView({
      rec,
      cfg,
      onClose
    }) {
      var rows = recordToRows(rec, cfg);
      return /*#__PURE__*/React.createElement("div", {
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 60,
          background: "rgba(20,19,18,.6)",
          overflow: "auto",
          padding: 14
        },
        onClick: onClose
      }, /*#__PURE__*/React.createElement("div", {
        className: "clo",
        style: {
          maxWidth: 720,
          margin: "0 auto"
        },
        onClick: function (e) {
          e.stopPropagation();
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          border: "3px solid var(--ink)",
          background: "#fff"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          background: "var(--ink)",
          color: "#f3f1ec",
          padding: "12px 14px",
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center"
        }
      }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
        style: {
          fontSize: 17
        }
      }, prettyDate(rec.date)), /*#__PURE__*/React.createElement("span", {
        style: {
          display: "block",
          fontSize: 13,
          color: "rgba(243,241,236,.72)"
        }
      }, rec.branchName || rec.branch, " \xB7 ", rec.by || "unsigned")), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn sm",
        style: {
          background: "transparent",
          color: "#f3f1ec",
          borderColor: "#f3f1ec"
        },
        onClick: onClose
      }, "Close")), /*#__PURE__*/React.createElement("div", {
        style: {
          maxHeight: "70vh",
          overflow: "auto"
        }
      }, rows.map(function (r, i) {
        var bad = /OUT OF RANGE|NOT DONE|NOT CONFIRMED|FAILED/.test(r[6]);
        return /*#__PURE__*/React.createElement("div", {
          key: i,
          className: "kv",
          style: bad ? {
            background: "#fdeceb"
          } : null
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            minWidth: 0
          }
        }, /*#__PURE__*/React.createElement("b", null, r[4]), /*#__PURE__*/React.createElement("span", {
          style: {
            display: "block",
            fontSize: 12,
            color: "var(--muted)"
          }
        }, r[3], r[7] ? " · " + r[7] : "")), /*#__PURE__*/React.createElement("span", {
          style: {
            whiteSpace: "nowrap"
          }
        }, r[5] ? r[5] + " " : "", /*#__PURE__*/React.createElement("span", {
          className: "pill " + (bad ? "bad" : "ok")
        }, r[6])));
      })))));
    }
    window.HideoutClosing._ui = {
      Check: Check,
      TempStep: TempStep,
      TaskStep: TaskStep,
      ShutdownStep: ShutdownStep,
      FinishStep: FinishStep,
      ListTab: ListTab,
      RecordsTab: RecordsTab,
      SetupView: SetupView,
      RecordView: RecordView
    };
  })();
  (function () {
    "use strict";
  
    var K = window.HideoutClosing._core,
      U = window.HideoutClosing._ui;
    var React = K.React,
      useState = K.useState,
      useEffect = K.useEffect,
      useMemo = K.useMemo,
      useRef = K.useRef;
    var localISO = K.localISO,
      hhmm = K.hhmm,
      prettyDate = K.prettyDate,
      dowOf = K.dowOf;
    var DEFAULT_CONFIG = K.DEFAULT_CONFIG,
      tempState = K.tempState,
      dueToday = K.dueToday;
    var blankRecord = K.blankRecord,
      outstanding = K.outstanding;
    var F = React.Fragment;
    var STEPS = [["temps", "Temps"], ["food", "Food"], ["clean", "Clean"], ["shut", "Shut down"], ["finish", "Sign off"]];
  
    /* Which outstanding items belong to which step — drives the per-step badge so the nav
       itself tells you where the remaining work is instead of making you hunt for it. */
    function stepOf(o) {
      if (o.k.indexOf("temp:") === 0 || o.k.indexOf("act:") === 0 || o.k === "probe") return "temps";
      if (o.k.indexOf("eq:") === 0 || o.k.indexOf("on:") === 0) return "shut";
      if (o.k === "by") return "finish";
      if (o.where === "Food") return "food";
      if (o.where === "Cleaning") return "clean";
      if (o.where === "Secure") return "shut";
      return "finish";
    }
  
    /* Plain-text report — used for the mailto fallback, and as the email body when the backend
       sends it. Deliberately readable on a phone: a supervisor reads this at the pub. */
    function reportText(rec, cfg, locName) {
      var L = [];
      L.push("CLOSING REPORT — " + (locName || rec.branch));
      L.push(prettyDate(rec.date) + "  ·  closed by " + (rec.by || "unsigned") + (rec.finishedAt ? " at " + hhmm(new Date(rec.finishedAt)) : ""));
      L.push("");
      /* The note first, before the checklists. Whoever opens this in the morning wants the one thing
         the closing chef chose to write down, not page three of a temperature log. */
      if (String(rec.handover || "").trim()) {
        L.push("NOTE FROM THE CLOSE");
        String(rec.handover).split("\n").forEach(function (ln) {
          L.push("  " + ln);
        });
        L.push("");
      }
      var breaches = [],
        open = outstanding(rec, cfg, rec.date);
      L.push("TEMPERATURES");
      cfg.units.forEach(function (u) {
        var t = (rec.temps || {})[u.id] || {},
          st = tempState(u, t.v);
        L.push("  " + u.name + ": " + (t.v === "" || t.v == null ? "— not read" : t.v + " C") + (st === "bad" ? "   *** OUT OF RANGE (" + u.min + " to " + u.max + ") ***" : ""));
        if (st === "bad") {
          breaches.push(u.name);
          L.push("      action: " + (t.action || "(none recorded)"));
        }
      });
      if (rec.probe && rec.probe.done) L.push("  Probe check: " + rec.probe.reading + " C — " + (rec.probe.ok ? "accurate" : "*** FAILED *** " + (rec.probe.note || "")));
      if ((rec.cooling || []).length) {
        L.push("");
        L.push("COOLING (2h / 4h rule)");
        rec.cooling.forEach(function (c) {
          L.push("  " + (c.food || "(unnamed)") + ": " + (c.t0 || "?") + " -> " + (c.t2 || "?") + " -> " + (c.t6 || "?") + " C" + (c.pass === false ? "   *** FAILED — " + (c.note || "no note") + " ***" : ""));
        });
      }
      ["food", "clean", "secure"].forEach(function (g) {
        var due = (cfg.tasks[g] || []).filter(function (t) {
          return dueToday(t, rec.date);
        });
        if (!due.length) return;
        L.push("");
        L.push(K.GROUP_LABEL[g].toUpperCase());
        due.forEach(function (t) {
          var v = (rec.checks || {})[t.id];
          L.push("  [" + (v === true ? "x" : v === "na" ? "-" : " ") + "] " + t.label);
        });
      });
      L.push("");
      L.push("SHUT DOWN");
      cfg.equipment.forEach(function (e) {
        L.push("  [" + ((rec.equipment || {})[e.id] ? "x" : " ") + "] " + e.name);
      });
      L.push("  left running: " + cfg.leaveOn.map(function (l) {
        return l.name + ((rec.leaveOn || {})[l.id] ? "" : " (NOT CONFIRMED)");
      }).join(", "));
      if (String(rec.waste || "").trim()) {
        L.push("");
        L.push("WASTAGE");
        L.push("  " + rec.waste);
      }
      /* the note is at the top now, not repeated here */
      L.push("");
      L.push("PREP LIST FOR TOMORROW: " + (rec.prepWritten ? "written" : "NOT WRITTEN"));
      L.push("");
      L.push(breaches.length ? "!! " + breaches.length + " temperature breach" + (breaches.length > 1 ? "es" : "") + ": " + breaches.join(", ") : "No temperature breaches.");
      if (open.length) L.push("!! " + open.length + " item" + (open.length > 1 ? "s" : "") + " left open at sign-off.");
      return L.join("\n");
    }
    function ClosingTab({
      ctx
    }) {
      var store = ctx.store;
      var branch = ctx.branch || ctx.locations[0] && ctx.locations[0].id || "";
      var locName = (ctx.locations.find(function (l) {
        return l.id === branch;
      }) || {}).name || branch;
      var [date, setDate] = useState(localISO());
      var [cfg, setCfg] = useState(null);
      var [rec, setRec] = useState(null);
      var [prep, setPrep] = useState([]);
      var [order, setOrder] = useState([]);
      var [view, setView] = useState("close"); // close | prep | order | records | setup
      /* One page now. `shut` is the set of sections folded BY HAND; a finished section folds itself
         without being added here, so re-opening one to correct it still works. */
      var [shutSecs, setShutSecs] = useState({});
      /* Flip what the row is SHOWING, not what is stored. A finished section is folded by the
         derived rule with nothing in shutSecs, so flipping the stored value wrote folded over folded
         and the first tap did nothing. */
      function toggleSec(k, isFolded) {
        setShutSecs(function (p) {
          var n = Object.assign({}, p);
          n[k] = !isFolded;
          return n;
        });
      }
      /* Open it first, then go to it - landing on a closed header is not arriving. The scroll waits
         a frame so the section has actually expanded before the browser measures where it is. */
      function jumpTo(k) {
        setShutSecs(function (p) {
          var n = Object.assign({}, p);
          n[k] = false;
          return n;
        });
        var go = function () {
          try {
            var el = document.getElementById("clo-sec-" + k);
            if (!el) return;
            var calm = false;
            try {
              calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            } catch (e) {}
            el.scrollIntoView({
              behavior: calm ? "auto" : "smooth",
              block: "start"
            });
          } catch (e) {}
        };
        if (window.requestAnimationFrame) requestAnimationFrame(function () {
          requestAnimationFrame(go);
        });else setTimeout(go, 32);
      }
      var [busy, setBusy] = useState("");
      var [openRec, setOpenRec] = useState(null);
      var [sentMsg, setSentMsg] = useState("");
      var dirty = useRef(false),
        timer = useRef(null),
        headRef = useRef(null);
      var recKey = "closing:" + date + ":" + branch;
      var prepKey = "closing:prep:" + branch;
      var orderKey = "closing:lowstock:" + branch;
  
      /* load */
      useEffect(function () {
        var dead = false;
        Promise.all([store.get("closing:config"), store.get(recKey), store.get(prepKey), store.get(orderKey)]).then(function (v) {
          if (dead) return;
          var c;
          try {
            c = v[0] ? JSON.parse(v[0]) : null;
          } catch (e) {
            c = null;
          }
          /* Merge over the defaults rather than replacing them: a config saved before a new
             default task group existed must not blank that group out. */
          c = c ? Object.assign({}, DEFAULT_CONFIG, c, {
            tasks: Object.assign({}, DEFAULT_CONFIG.tasks, c.tasks || {})
          }) : JSON.parse(JSON.stringify(DEFAULT_CONFIG));
          setCfg(c);
          var r;
          try {
            r = v[1] ? JSON.parse(v[1]) : null;
          } catch (e) {
            r = null;
          }
          setRec(r || blankRecord(date, branch, locName, ctx.department));
          try {
            setPrep(v[2] ? JSON.parse(v[2]) : []);
          } catch (e) {
            setPrep([]);
          }
          try {
            setOrder(v[3] ? JSON.parse(v[3]) : []);
          } catch (e) {
            setOrder([]);
          }
        }).catch(function (e) {
          if (dead) return;
          setCfg(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
          setRec(blankRecord(date, branch, locName, ctx.department));
        });
        return function () {
          dead = true;
        };
      }, [date, branch]);
  
      /* autosave — debounced, and only after something actually changed */
      function set(fn) {
        setRec(function (prev) {
          var next = JSON.parse(JSON.stringify(prev || {}));
          fn(next);
          return next;
        });
        dirty.current = true;
      }
      useEffect(function () {
        if (!rec || !dirty.current) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(function () {
          dirty.current = false;
          try {
            localStorage.setItem("hideout_closing_draft:" + recKey, JSON.stringify(rec));
          } catch (e) {}
          store.set(recKey, JSON.stringify(rec)).catch(function () {});
        }, 900);
        return function () {
          if (timer.current) clearTimeout(timer.current);
        };
      }, [rec]);
      function savePrep(v) {
        setPrep(v);
        store.set(prepKey, JSON.stringify(v)).catch(function () {});
      }
      function saveOrder(v) {
        setOrder(v);
        store.set(orderKey, JSON.stringify(v)).catch(function () {});
      }
      function saveCfg(v) {
        setCfg(v);
        store.set("closing:config", JSON.stringify(v)).catch(function () {});
      }
      var left = useMemo(function () {
        return cfg && rec ? outstanding(rec, cfg, date) : [];
      }, [cfg, rec, date]);
      var total = useMemo(function () {
        if (!cfg) return 0;
        var n = cfg.units.length + cfg.equipment.length + cfg.leaveOn.length + 1;
        if (cfg.probeDay === "always" || dowOf(date) === cfg.probeDay) n++;
        ["food", "clean", "secure"].forEach(function (g) {
          n += (cfg.tasks[g] || []).filter(function (t) {
            return dueToday(t, date);
          }).length;
        });
        return n;
      }, [cfg, date]);
      var done = Math.max(0, total - left.length);
      var pctDone = total ? Math.round(done / total * 100) : 0;
      var byStep = useMemo(function () {
        var m = {};
        left.forEach(function (o) {
          var s = stepOf(o);
          m[s] = (m[s] || 0) + 1;
        });
        return m;
      }, [left]);
  
      /* keep the section nav glued under the header whatever its height turns out to be */
      useEffect(function () {
        function measure() {
          if (headRef.current) try {
            headRef.current.parentNode.style.setProperty("--headh", headRef.current.offsetHeight + "px");
          } catch (e) {}
        }
        measure();
        window.addEventListener("resize", measure);
        return function () {
          window.removeEventListener("resize", measure);
        };
      });
      async function finish() {
        if (busy) return;
        if (left.length) {
          if (!confirm(left.length + " item" + (left.length > 1 ? "s" : "") + " still open:\n\n" + left.slice(0, 8).map(function (o) {
            return "· " + o.where + ": " + o.what;
          }).join("\n") + (left.length > 8 ? "\n· and " + (left.length - 8) + " more" : "") + "\n\nSend the report anyway? It will show these as not done.")) return;
        }
        setBusy("Saving…");
        var finished = JSON.parse(JSON.stringify(rec));
        finished.finishedAt = new Date().toISOString();
        finished.by = String(finished.by || "").trim();
        finished.branchName = locName;
        finished.prep = prep.slice();
        finished.order = order.slice();
        finished.openCount = left.length;
        try {
          await store.set(recKey, JSON.stringify(finished));
        } catch (e) {
          setBusy("");
          alert("Could not save the close — " + (e && e.message || e) + "\n\nNothing was sent. Check the connection and try again.");
          return;
        }
  
        /* Prep that got made tonight drops off the rolling list; what is still outstanding
           carries into tomorrow. Low-stock lines stay until someone actually orders them. */
        var carried = prep.filter(function (p) {
          return !p.done;
        });
        if (carried.length !== prep.length) savePrep(carried);
        setBusy("Sending…");
        var text = reportText(finished, cfg, locName);
        var to = (cfg.supervisorEmail || "").trim();
        var subject = "Closing report — " + locName + " — " + finished.date;
        var outcome = "";
        if (!to) {
          outcome = "no-address";
        } else if (ctx.sendReport) {
          try {
            var r = await ctx.sendReport({
              to: to,
              cc: (cfg.ccEmail || "").trim(),
              subject: subject,
              text: text,
              date: finished.date,
              branch: branch
            });
            outcome = r && r.ok ? "sent" : "failed:" + (r && r.error || "unknown");
          } catch (e) {
            outcome = "failed:" + (e && e.message || e);
          }
        } else {
          outcome = "mailto";
        }
        if (outcome === "sent") {
          finished.sent = new Date().toISOString();
          try {
            await store.set(recKey, JSON.stringify(finished));
          } catch (e) {}
        }
        setRec(finished);
        dirty.current = false;
        setBusy("");
        if (outcome === "mailto" || outcome.indexOf("failed") === 0 && to) {
          /* No server to send it, or the server refused: hand the whole report to the phone's
             mail app so it still reaches the supervisor tonight. The record is already saved
             either way — the email is the notification, not the evidence. */
          var href = "mailto:" + encodeURIComponent(to) + "?subject=" + encodeURIComponent(subject) + (cfg.ccEmail ? "&cc=" + encodeURIComponent(cfg.ccEmail.trim()) : "") + "&body=" + encodeURIComponent(text);
          try {
            window.location.href = href;
          } catch (e) {}
          setSentMsg(outcome.indexOf("failed") === 0 ? "Saved. The server could not send it (" + outcome.slice(7) + ") — your mail app has been opened with the report instead." : "Saved. Your mail app has been opened with the report — press send.");
        } else if (outcome === "no-address") {
          setSentMsg("Saved. No supervisor email is set yet — add one in Setup and tonight's report can go out automatically.");
        } else {
          setSentMsg("Saved and emailed to " + to + ".");
        }
        setView("done");
      }
      if (!cfg || !rec) return /*#__PURE__*/React.createElement("div", {
        className: "clo"
      }, /*#__PURE__*/React.createElement(K.CloStyle, null), /*#__PURE__*/React.createElement("div", {
        className: "empty"
      }, "Loading tonight\u2019s sheet\u2026"));
      var isToday = date === localISO();
      var finishedAlready = !!rec.finishedAt;
      return /*#__PURE__*/React.createElement("div", {
        className: "clo"
      }, /*#__PURE__*/React.createElement(K.CloStyle, null), /*#__PURE__*/React.createElement("div", {
        className: "head",
        ref: headRef
      }, /*#__PURE__*/React.createElement("div", {
        className: "l1"
      }, /*#__PURE__*/React.createElement("span", {
        className: "ttl"
      }, "Closing"), /*#__PURE__*/React.createElement("span", {
        className: "sub"
      }, prettyDate(date), " \xB7 ", locName), /*#__PURE__*/React.createElement("span", {
        className: "pick"
      }, /*#__PURE__*/React.createElement("select", {
        value: date,
        "aria-label": "Date",
        onChange: function (e) {
          setDate(e.target.value);
          setView("close");
        }
      }, [0, 1, 2, 3, 4, 5, 6].map(function (n) {
        var d = K.addDays(localISO(), -n);
        return /*#__PURE__*/React.createElement("option", {
          key: d,
          value: d
        }, n === 0 ? "Tonight" : n === 1 ? "Yesterday" : prettyDate(d));
      })), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn sm",
        style: {
          background: "transparent",
          color: "#f3f1ec",
          borderColor: "rgba(243,241,236,.5)",
          minHeight: 34,
          padding: "5px 9px"
        },
        "aria-label": "Setup",
        onClick: function () {
          setView(view === "setup" ? "close" : "setup");
        }
      }, "\u2699"))), view === "close" && /*#__PURE__*/React.createElement("div", {
        className: "bar",
        role: "progressbar",
        "aria-valuenow": pctDone,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-label": "Close progress"
      }, /*#__PURE__*/React.createElement("i", {
        className: left.length === 0 ? "full" : "",
        style: {
          width: pctDone + "%"
        }
      }))), /*#__PURE__*/React.createElement("div", {
        className: "nav"
      }, [["close", "Close"], ["records", "Records"]].map(function (v) {
        var badge = v[0] === "close" ? left.length || null : v[0] === "prep" ? prep.filter(function (p) {
          return !p.done;
        }).length || null : v[0] === "order" ? order.length || null : null;
        return /*#__PURE__*/React.createElement("button", {
          key: v[0],
          type: "button",
          "aria-pressed": view === v[0],
          onClick: function () {
            setView(v[0]);
          }
        }, v[1], badge ? /*#__PURE__*/React.createElement("span", {
          className: "n" + (v[0] === "close" && left.length === 0 ? " done" : "")
        }, badge) : null);
      })), /*#__PURE__*/React.createElement("div", {
        className: "wrap"
      }, view === "setup" && /*#__PURE__*/React.createElement(U.SetupView, {
        cfg: cfg,
        saveCfg: saveCfg
      }), view === "done" && /*#__PURE__*/React.createElement("div", {
        className: "done"
      }, /*#__PURE__*/React.createElement("div", {
        className: "big"
      }, "Kitchen closed."), /*#__PURE__*/React.createElement("p", {
        className: "sm"
      }, sentMsg), /*#__PURE__*/React.createElement("p", {
        className: "sm",
        style: {
          fontSize: 14
        }
      }, left.length ? left.length + " item" + (left.length > 1 ? "s" : "") + " went out marked not done." : "Everything on the sheet was answered.", " The record is kept for council under Records."), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: function () {
          setView("records");
        }
      }, "See the record"), " ", /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "btn",
        onClick: function () {
          setView("close");
        }
      }, "Back to the sheet")), view === "close" && /*#__PURE__*/React.createElement(F, null, finishedAlready && /*#__PURE__*/React.createElement("div", {
        className: "alert",
        style: {
          borderLeftColor: "var(--ok)",
          background: "#eef6f1"
        }
      }, /*#__PURE__*/React.createElement("b", null, "This night is already signed off"), " by ", rec.by || "someone", rec.finishedAt ? " at " + hhmm(new Date(rec.finishedAt)) : "", ". You can still correct it \u2014 save it again to update the record."), /*#__PURE__*/React.createElement("section", {
        className: "sec note-first"
      }, /*#__PURE__*/React.createElement("div", {
        className: "sech",
        style: {
          cursor: "default"
        }
      }, /*#__PURE__*/React.createElement("span", {
        className: "t"
      }, "Note for the morning"), String(rec.handover || "").trim() ? /*#__PURE__*/React.createElement("span", {
        className: "n done"
      }, "written") : /*#__PURE__*/React.createElement("span", {
        className: "n opt"
      }, "optional")), /*#__PURE__*/React.createElement("div", {
        className: "secb",
        style: {
          padding: "12px 14px"
        }
      }, /*#__PURE__*/React.createElement("textarea", {
        id: "clo-note",
        rows: 4,
        className: "notebox",
        value: rec.handover || "",
        placeholder: "What ran low, what broke, what the morning needs to know. This goes to the top of the report.",
        onChange: function (e) {
          var v = e.target.value;
          set(function (r) {
            r.handover = v;
          });
        }
      }), /*#__PURE__*/React.createElement("label", {
        className: "prepchk"
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: !!rec.prepWritten,
        onChange: function (e) {
          var v = e.target.checked;
          set(function (r) {
            r.prepWritten = v;
          });
        }
      }), /*#__PURE__*/React.createElement("span", null, "Prep list for tomorrow is written")))), /*#__PURE__*/React.createElement("div", {
        className: "legend"
      }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "\u2713"), " done"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "Not tonight"), " didn\u2019t apply \u2014 counts as answered"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "blank"), " goes out as NOT DONE")), /*#__PURE__*/React.createElement("div", {
        className: "nav jump",
        style: {
          position: "static",
          borderTop: 0
        }
      }, STEPS.map(function (s) {
        return /*#__PURE__*/React.createElement("button", {
          key: s[0],
          type: "button",
          onClick: function () {
            jumpTo(s[0]);
          }
        }, s[1], byStep[s[0]] ? /*#__PURE__*/React.createElement("span", {
          className: "n"
        }, byStep[s[0]]) : /*#__PURE__*/React.createElement("span", {
          className: "n done"
        }, "\u2713"));
      })), STEPS.map(function (sd) {
        var k = sd[0],
          outstanding = byStep[k] || 0;
        /* a finished section folds itself; an unfinished one only folds if you fold it */
        var folded = shutSecs[k] != null ? shutSecs[k] : outstanding === 0 && k !== "finish";
        return /*#__PURE__*/React.createElement("section", {
          key: k,
          id: "clo-sec-" + k,
          className: "sec" + (folded ? " folded" : "") + (outstanding === 0 ? " clear" : "")
        }, /*#__PURE__*/React.createElement("button", {
          type: "button",
          className: "sech",
          "aria-expanded": !folded,
          "aria-controls": "clo-secb-" + k,
          onClick: function () {
            toggleSec(k, folded);
          }
        }, /*#__PURE__*/React.createElement("span", {
          className: "car",
          "aria-hidden": "true"
        }, folded ? "\u203a" : "\u2304"), /*#__PURE__*/React.createElement("span", {
          className: "t"
        }, sd[1]), outstanding ? /*#__PURE__*/React.createElement("span", {
          className: "n"
        }, outstanding, " left") : /*#__PURE__*/React.createElement("span", {
          className: "n done"
        }, "done")), !folded && /*#__PURE__*/React.createElement("div", {
          className: "secb",
          id: "clo-secb-" + k
        }, k === "temps" && /*#__PURE__*/React.createElement(U.TempStep, {
          cfg: cfg,
          rec: rec,
          set: set,
          date: date
        }), k === "food" && /*#__PURE__*/React.createElement(U.TaskStep, {
          group: "food",
          title: "Food",
          cfg: cfg,
          rec: rec,
          set: set,
          date: date,
          blurb: "The part that actually keeps people well. Tick what you did; the cooling log opens under the first line when it applies."
        }), k === "clean" && /*#__PURE__*/React.createElement(U.TaskStep, {
          group: "clean",
          title: "Cleaning & sanitising",
          cfg: cfg,
          rec: rec,
          set: set,
          date: date,
          blurb: "Surfaces food touches, the machine that sanitises them, and the basin you wash your hands in."
        }), k === "shut" && /*#__PURE__*/React.createElement(U.ShutdownStep, {
          cfg: cfg,
          rec: rec,
          set: set
        }), k === "finish" && /*#__PURE__*/React.createElement(U.FinishStep, {
          cfg: cfg,
          rec: rec,
          set: set,
          left: left
        })));
      })), view === "records" && /*#__PURE__*/React.createElement(U.RecordsTab, {
        store: store,
        cfg: cfg,
        branch: branch,
        locations: ctx.locations,
        onOpen: function (r) {
          setOpenRec(r);
        }
      })), view === "close" && /*#__PURE__*/React.createElement("div", {
        className: "foot"
      }, /*#__PURE__*/React.createElement("div", {
        className: "txt"
      }, left.length === 0 ? /*#__PURE__*/React.createElement(F, null, /*#__PURE__*/React.createElement("b", null, "All done \u2014 go home."), cfg.supervisorEmail ? "Report goes to " + cfg.supervisorEmail : "Set a supervisor email in Setup") : /*#__PURE__*/React.createElement(F, null, /*#__PURE__*/React.createElement("b", null, left.length, " left"), left[0] ? left[0].where + ": " + left[0].what : "")), /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: "go",
        onClick: finish,
        disabled: !!busy
      }, busy || "Finish & send")), openRec && /*#__PURE__*/React.createElement(U.RecordView, {
        rec: openRec,
        cfg: cfg,
        onClose: function () {
          setOpenRec(null);
        }
      }));
    }
    window.HideoutClosing.Tab = ClosingTab;
    window.HideoutClosing.reportText = reportText;
  
    /* Standalone mount — same component, a store the host provides. */
    window.HideoutClosing.mount = function (el, ctx) {
      var root = window.ReactDOM.createRoot(el);
      root.render(React.createElement(ClosingTab, {
        ctx: ctx
      }));
      return root;
    };
  })();
  /* CLO-END */
  }
  
  window.HideoutClosing = window.HideoutClosing || {};

  window.HideoutClosing.open = function(opts){
    opts = opts || {};
    if (overlay) return;                                  // already open
    var mount = frame();
    return react().then(function(){
      /* the compiled module defines window.HideoutClosing.mount */
      ATTACH_MODULE();
      var backend = opts.backend || LS.get("hideout_closing_backend") || "";
      var token   = opts.token   || LS.get("hideout_closing_token")   || "";
      var store   = opts.store   || makeStore(backend, token);
      function start(branch){
        mount.innerHTML = "";
        root = window.HideoutClosing.mount(mount, {
          store: store,
          branch: branch,
          locations: opts.locations || LOCATIONS,
          department: "chef",
          sendReport: opts.sendReport || null,
          openOrdering: function(){ window.open("https://order.hideoutdb.com/","_blank","noopener"); }
        });
      }
      var saved = opts.branch || LS.get("hideout_closing_branch");
      if (saved && (opts.locations || LOCATIONS).some(function(l){ return l.id === saved; })) start(saved);
      else gate(mount, start);
    }).catch(function(e){
      mount.innerHTML = "<p style=\"font:15px Jost,system-ui,sans-serif;padding:24px\">" +
        "Could not open the closing sheet (" + (e && e.message ? e.message : e) + ").</p>";
    });
  };

  window.HideoutClosing.close = shut;

  /* Esc closes, like every other overlay in both apps */
  window.addEventListener("keydown", function(e){
    if (e.key === "Escape" && overlay) { e.stopPropagation(); shut(); }
  }, true);
})();
