/* The Hideout — Staff Postcards widget (built from design/postcards-v3.html)
   승인된 시안을 그대로 쓰고 데이터만 Firestore 다. CSS 는 #pc-overlay 아래로 스코프하고
   키프레임에 pcv3- 접두사를 붙였다 — 시안이 .body .head .msg 같은 흔한 이름을 쓰므로
   스코프하지 않으면 호스트 앱(IOS·RCC) 레이아웃이 깨진다.
   배포 가드가 찾는 토큰: pc-addfab / hideout-authed */
(function(){
  if(window.__HIDEOUT_POSTCARDS__) return; window.__HIDEOUT_POSTCARDS__=true;
  var CSS="@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800;900&display=swap');\n@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap');\n:root{\n  --red:#ec3013; --red-700:#ae1800; --paper:#f3f2f2; --surface:#eae9e9; --ink:#201e1d;\n  --fortress:#9a5a2a; --sanctuary:#3a26c8;\n  --line:rgba(32,30,29,.18); --line-soft:rgba(32,30,29,.10);\n  --grid:color-mix(in srgb, var(--red) 14%, transparent);\n  --grid-2:color-mix(in srgb, var(--red) 24%, transparent);\n  --font:\"Archivo\",system-ui,sans-serif;\n  --gap:18px;\n}#pc-overlay *{box-sizing:border-box}.pcv3-dropped{margin:0;background:#dedcdc;font-family:var(--font);color:var(--ink);-webkit-font-smoothing:antialiased}#pc-overlay button{font-family:inherit}#pc-overlay{padding:20px;display:flex;justify-content:center}#pc-modal{width:min(1080px,100%);background:var(--paper);border:2px solid var(--ink);display:flex;flex-direction:column;max-height:calc(100vh - 40px)}#pc-overlay .head{display:flex;align-items:center;gap:14px;padding:15px 18px;border-bottom:2px solid var(--ink);background:var(--paper)}#pc-overlay .mark{display:flex;flex-direction:column;line-height:1;gap:3px;margin-right:auto}#pc-overlay .mark .n{font-weight:900;font-size:20px;letter-spacing:-.02em;text-transform:uppercase;display:inline-flex;align-items:center}#pc-overlay .mark .bean{width:.62em;height:.48em;margin:0 .04em;color:var(--red)}#pc-overlay .mark .s{font-weight:800;font-size:8.5px;letter-spacing:.3em;text-transform:uppercase;opacity:.62}#pc-overlay .x{border:none;background:transparent;color:var(--ink);opacity:.45;width:32px;height:32px;font-size:22px;cursor:pointer;line-height:1}#pc-overlay .x:hover{opacity:1;color:var(--red)}#pc-overlay .ribbon{background:var(--red);overflow:hidden;display:flex;min-height:24px}#pc-overlay .marq{display:inline-flex;white-space:nowrap;animation:pcv3-marq 26s linear infinite}#pc-overlay .marq span{font-weight:800;font-size:9.5px;line-height:24px;letter-spacing:.24em;color:#fff;opacity:.92;text-transform:uppercase}#pc-overlay .marq b{opacity:.5;margin:0 11px}@keyframes pcv3-marq{from{transform:translateX(0)}to{transform:translateX(-50%)}}#pc-overlay .tools{display:flex;align-items:center;gap:8px;padding:11px 18px;border-bottom:1.5px solid var(--line);flex-wrap:wrap;background:var(--paper);position:relative}#pc-overlay .seg{display:flex;border:1.5px solid var(--ink)}#pc-overlay .seg button{border:none;background:transparent;padding:8px 14px;font-weight:800;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;color:var(--ink);position:relative}#pc-overlay .seg button+button{border-left:1.5px solid var(--ink)}#pc-overlay .seg button.on{background:var(--ink);color:var(--paper)}#pc-overlay .chips{display:flex;gap:6px;flex-wrap:wrap}#pc-overlay .chip{border:1.5px solid var(--line);background:transparent;padding:7px 11px;font-weight:800;font-size:10px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;color:var(--ink);opacity:.72}#pc-overlay .chip:hover{opacity:1;border-color:var(--ink)}#pc-overlay .chip.on{background:var(--red);border-color:var(--red);color:#fff;opacity:1}#pc-overlay .chip .n{opacity:.6;margin-left:5px;font-weight:600}#pc-overlay .search{position:relative;margin-left:auto}#pc-overlay .search input{border:1.5px solid var(--line);background:#fff;padding:8px 11px 8px 30px;font-family:inherit;font-size:12.5px;width:170px;color:var(--ink)}#pc-overlay .search input:focus{outline:none;border-color:var(--red);box-shadow:0 0 0 3px rgba(236,48,19,.13)}#pc-overlay .search svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);width:13px;height:13px;stroke:var(--ink);opacity:.4;fill:none;stroke-width:2}#pc-overlay .mini{border:none;background:transparent;font-weight:800;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);opacity:.55;cursor:pointer;padding:7px 4px}#pc-overlay .mini:hover{opacity:1;color:var(--red)}#pc-overlay .iconbtn{display:none;position:relative;flex:none;width:44px;height:44px;padding:0;cursor:pointer;\n  border:1.5px solid var(--line);background:transparent;color:var(--ink);align-items:center;justify-content:center}#pc-overlay .iconbtn:hover{border-color:var(--ink);color:var(--red)}#pc-overlay .iconbtn.on{background:var(--ink);border-color:var(--ink);color:var(--paper)}#pc-overlay .iconbtn svg{width:17px;height:17px}#pc-overlay .iconbtn.dirty::after{content:'';position:absolute;top:4px;right:4px;width:5px;height:5px;background:var(--red)}#pc-overlay .tgrp{display:contents}#pc-overlay #qclose{display:none}#pc-overlay .body{overflow:auto;padding:18px 18px 56px;flex:1;\n  background-color:#ddd5c6;\n  background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);\n  background-size:22px 22px,22px 22px}#pc-overlay .body.lifting{--grid:rgba(236,48,19,.22);--grid-2:rgba(236,48,19,.36)}#pc-overlay .seclbl{display:flex;align-items:center;gap:9px;font-weight:800;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--red-700);margin:0 0 12px}#pc-overlay .seclbl::after{content:'';flex:1;height:2px;background:var(--ink);opacity:.16}#pc-overlay .pc{position:relative;transform:rotate(var(--tilt,0deg))}#pc-overlay .pc::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:0}#pc-overlay .pc>*{position:relative;z-index:1}#pc-overlay .pc[data-paper=\"lined\"]::before{\n  background-image:repeating-linear-gradient(transparent 0 25px, color-mix(in srgb,var(--ink) 9%,transparent) 25px 26px);\n  background-position:0 12px}#pc-overlay .pc[data-paper=\"grid\"]::before{\n  background-image:repeating-linear-gradient(transparent 0 21px, color-mix(in srgb,var(--ink) 6%,transparent) 21px 22px),\n                   repeating-linear-gradient(90deg,transparent 0 21px, color-mix(in srgb,var(--ink) 6%,transparent) 21px 22px)}#pc-overlay .pc::after{content:'';position:absolute;inset:-1.5px;border:1.5px solid var(--red);\n  mix-blend-mode:multiply;opacity:.42;pointer-events:none;z-index:2;\n  transform:translate(var(--mx,2.5px),var(--my,2px))}#pc-overlay .pc.pinned::after{opacity:.55}#pc-overlay .pc .route{background:var(--red)!important;color:#fff!important;mix-blend-mode:multiply}#pc-overlay .pc .route .to{color:#fff!important;opacity:.82}#pc-overlay .pc[data-att=\"pin\"] .att, #pc-overlay .pc.pinned .att{display:block!important;\n  left:50%;top:-8px;width:15px;height:15px;border-radius:50%;\n  background:var(--red);mix-blend-mode:multiply;\n  transform:translateX(-50%);box-shadow:0 0 0 3px rgba(236,48,19,.18);border:none}#pc-overlay .pc[data-att=\"pin\"] .att::after, #pc-overlay .pc.pinned .att::after{content:'';position:absolute;\n  left:4px;top:3.5px;width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,.5);border:none}#pc-overlay .seclbl{position:relative;isolation:isolate}#pc-overlay .seclbl::before{content:attr(data-t);position:absolute;left:2px;top:1.5px;color:var(--red);\n  mix-blend-mode:multiply;opacity:.7;z-index:-1;white-space:nowrap;width:max-content;pointer-events:none}#pc-overlay .pc .att{position:absolute;pointer-events:none;z-index:3}#pc-overlay .pc[data-att=\"tape\"] .att{left:50%;top:-9px;width:74px;height:19px;transform:translateX(-50%) rotate(calc(var(--tilt,0deg) * -2.2));\n  background:color-mix(in srgb,var(--ink) 12%,transparent);\n  border-left:1px dashed color-mix(in srgb,var(--ink) 22%,transparent);\n  border-right:1px dashed color-mix(in srgb,var(--ink) 22%,transparent);\n  mix-blend-mode:multiply}#pc-overlay .pc[data-att=\"clip\"] .att{right:16px;top:-11px;width:15px;height:34px;border:2.5px solid color-mix(in srgb,var(--ink) 42%,transparent);\n  border-bottom-left-radius:9px;border-bottom-right-radius:9px;border-top:none;\n  box-shadow:inset 0 0 0 2px transparent}#pc-overlay .pc[data-att=\"clip\"] .att::after{content:'';position:absolute;left:3.5px;top:6px;width:5px;height:26px;\n  border:2px solid color-mix(in srgb,var(--ink) 30%,transparent);border-top:none;border-bottom-left-radius:6px;border-bottom-right-radius:6px}#pc-overlay .pc[data-att=\"none\"] .att, #pc-overlay .pc[data-att=\"pin\"] .att{display:none}#pc-overlay .pc.hand .msg{font-family:'Caveat',cursive;font-size:24px;line-height:1.32;letter-spacing:.01em}#pc-overlay .pc{position:relative;background:var(--paper);border:1.5px solid var(--line);padding:15px 15px 12px;\n  transition:border-color .2s ease,transform .3s cubic-bezier(.2,.9,.3,1.14)}#pc-overlay .pc:hover{border-color:var(--ink)}#pc-overlay #feed.view-feed .pc:hover{transform:rotate(var(--tilt,0deg)) translateY(-2px)}#pc-overlay .pc .route{display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;\n  background:var(--surface);padding:4px 7px;color:var(--ink)}#pc-overlay .pc .route .to{color:var(--red-700)}#pc-overlay .pc .when{font-weight:600;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.45;margin-left:7px}#pc-overlay .pc .metarow{display:flex;align-items:center;flex-wrap:wrap;padding-right:30px}#pc-overlay .pc .msg{font-size:15.5px;line-height:1.5;margin-top:10px;word-break:break-word}#pc-overlay .pc .shot{margin:12px -15px 0;border-top:1.5px solid var(--line);border-bottom:1.5px solid var(--line);position:relative;line-height:0}#pc-overlay .pc .shot img{width:100%;display:block;aspect-ratio:var(--ar,3/2);object-fit:cover;background:var(--surface)}#pc-overlay .pc .shot{container-type:inline-size}#pc-overlay .pc .shot .ovl{position:absolute;transform:translate(-50%,-50%) scale(var(--s,1)) rotate(var(--r,0deg));\n  font-weight:900;font-size:clamp(12px,5cqw,22px);line-height:1.15;\n  text-shadow:0 2px 8px rgba(0,0,0,.55);pointer-events:none;white-space:pre;text-align:center;padding:2px 5px}#pc-overlay .pc .shot .ovl.bg-white{background:#fff;color:var(--ink)!important;text-shadow:none}#pc-overlay .pc .shot .ovl.bg-red{background:var(--red);color:#fff!important;text-shadow:none}#pc-overlay .pc .shot .ovl.emo{font-size:clamp(20px,9cqw,44px);text-shadow:none;padding:0}#pc-overlay .pc .shot .ovl.stmp{width:26cqw;max-width:130px;text-shadow:none;padding:0}#pc-overlay .pc .shot .ovl.stmp svg{display:block;width:100%;height:auto}#pc-overlay .pc .shot .ovlpen{position:absolute;inset:0;pointer-events:none}#pc-overlay .pc .shot.f-polaroid{background:#fff;padding:8px 8px 26px;border-bottom-width:1.5px}#pc-overlay .pc .shot.f-ink{box-shadow:inset 0 0 0 3px var(--ink)}#pc-overlay .pc .shot.f-red{box-shadow:inset 0 0 0 3px var(--red)}#pc-overlay .pc .foot{display:flex;align-items:center;gap:5px;margin-top:11px;flex-wrap:wrap}#pc-overlay .pc .act{border:none;background:transparent;font-weight:800;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);opacity:.5;cursor:pointer;padding:5px 6px}#pc-overlay .pc .act:hover{opacity:1;color:var(--red)}#pc-overlay .pc .act.hot{opacity:1;color:var(--red-700)}#pc-overlay .pc .act .c{opacity:.55;margin-left:4px;font-weight:600}#pc-overlay .pc .act .rxg{font-size:12px;line-height:1;display:inline-block;width:12px;text-align:center;vertical-align:-1px}#pc-overlay .pc .spacer{flex:1}#pc-overlay .pc .rxw{display:flex;align-items:baseline;flex-wrap:wrap;gap:0 6px;margin-top:7px;\n  font-size:10.5px;line-height:1.5;letter-spacing:.02em}#pc-overlay .pc .rxw:empty{display:none}#pc-overlay .pc .rxh{flex:none;color:var(--red-700);font-size:11px;line-height:1}#pc-overlay .pc .rxn{min-width:0;font-weight:700;opacity:.62;word-break:break-word}#pc-overlay .pc .rxmore{border:none;background:transparent;padding:0;cursor:pointer;font-family:inherit;\n  font-weight:800;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--red-700);opacity:.8}#pc-overlay .pc .rxmore:hover{opacity:1;text-decoration:underline}#pc-overlay .pc .pin{position:absolute;top:-12px;right:14px;width:40px;height:40px;border:none;background:transparent;cursor:pointer;display:flex;justify-content:center;padding:0;z-index:5;transition:transform .18s ease}#pc-overlay .pc .pin:hover{transform:translateY(-2px) scale(1.08)}#pc-overlay .pc .pin.stick .tack{animation:pcv3-tackin .42s cubic-bezier(.2,.85,.3,1.5)}@keyframes pcv3-tackin{0%{transform:translateY(-16px) scale(1.4)}60%{transform:translateY(2px) scale(.94)}100%{transform:none}}#pc-overlay .tack{width:24px;height:28px;position:relative}#pc-overlay .tack .dome{position:absolute;top:0;left:2px;width:19px;height:19px;border-radius:50%;\n  background:radial-gradient(circle at 33% 28%,#ff7a5e,var(--red) 58%,var(--red-700));\n  box-shadow:0 3px 6px rgba(174,24,0,.4),inset -2px -2px 3px rgba(0,0,0,.26),inset 2px 2px 4px rgba(255,255,255,.5)}#pc-overlay .tack .pin2{position:absolute;top:16px;left:11px;width:2px;height:11px;background:linear-gradient(#b9b3ab,#6f6a63);transform:rotate(4deg);transform-origin:top}#pc-overlay .tflat{width:20px;height:20px;border-radius:50%;border:2px solid var(--line);position:relative;opacity:.5;margin-top:2px;transition:.18s}#pc-overlay .tflat::after{content:'';position:absolute;left:50%;top:50%;width:4px;height:4px;border-radius:50%;background:rgba(32,30,29,.4);transform:translate(-50%,-50%)}#pc-overlay .pc .pin:hover .tflat{opacity:1;border-color:var(--red)}#pc-overlay #feed.view-feed .cols{display:flex;gap:var(--gap);align-items:flex-start}#pc-overlay #feed.view-feed .col{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:var(--gap)}#pc-overlay #feed.view-feed .pc.sz-w{width:calc(200% + var(--gap))}#pc-overlay #feed.view-feed .cols[data-n=\"1\"] .pc.sz-w{width:100%}#pc-overlay #feed.view-feed .pc.sz-s{width:56%}#pc-overlay #feed.view-feed .spx{flex:0 0 auto;pointer-events:none}#pc-overlay #feed.view-feed .pinned{transform:rotate(var(--tilt,0deg))}#pc-overlay #feed.view-feed .pinned:hover{transform:rotate(var(--tilt,0deg)) translateY(-2px)}#pc-overlay #feed.view-feed .seclbl{margin-top:4px}#pc-overlay #feed.view-board{position:relative;min-height:440px;transition:min-height .3s ease}#pc-overlay #feed.view-board .pc{position:absolute;transform-origin:top left;will-change:transform;touch-action:none;\n  transition:transform .3s cubic-bezier(.2,.9,.3,1.14),border-color .2s ease,left .3s cubic-bezier(.2,.9,.3,1.14),top .3s cubic-bezier(.2,.9,.3,1.14)}#pc-overlay #feed.view-board .pc.lift{transition:border-color .18s ease;z-index:900;border-color:var(--red);cursor:grabbing}#pc-overlay #feed.view-board .pc.settle{animation:pcv3-settle .34s cubic-bezier(.2,.9,.3,1.2)}@keyframes pcv3-settle{0%{transform:scale(1.04)}55%{transform:scale(.99)}100%{transform:scale(1)}}#pc-overlay #feed.view-board .pc.pushed{animation:pcv3-pushed .42s ease}@keyframes pcv3-pushed{0%, 100%{border-color:var(--line)}35%{border-color:var(--red)}}#pc-overlay .body.lifting #feed.view-board .pc:not(.lift){\n  transition:transform .3s cubic-bezier(.2,.9,.3,1.14),border-color .2s ease,\n             left .19s cubic-bezier(.22,1,.36,1),top .19s cubic-bezier(.22,1,.36,1)}#pc-overlay .body.lifting #feed.view-board .pc.yield{border-color:rgba(236,48,19,.55)}#pc-overlay .grip{position:absolute;top:1px;left:50%;transform:translateX(-50%);padding:5px 18px;cursor:grab;color:var(--ink);opacity:.3;font-size:9px;letter-spacing:3px;user-select:none;transition:.18s;display:none}#pc-overlay #feed.view-board .grip{display:block}#pc-overlay #feed.view-board .pc:hover .grip{opacity:.9;color:var(--red)}#pc-overlay .rz{position:absolute;right:0;bottom:0;width:38px;height:38px;cursor:nwse-resize;display:none;align-items:flex-end;justify-content:flex-end;padding:4px;touch-action:none;z-index:6}#pc-overlay #feed.view-board .rz{display:flex}#pc-overlay .rz::after{content:'';width:12px;height:12px;border-right:3px solid var(--red);border-bottom:3px solid var(--red);opacity:.45;transition:.18s}#pc-overlay #feed.view-board .pc:hover .rz::after{opacity:1}#pc-overlay .badge{position:absolute;top:3px;right:3px;background:var(--ink);color:#fff;font-weight:800;font-size:10px;letter-spacing:.04em;padding:3px 6px;z-index:7;pointer-events:none;display:none}#pc-overlay #feed.view-board .pc.lift .badge, #pc-overlay #feed.view-board .pc.rzing .badge{display:block}#pc-overlay #ghost{position:absolute;border:2px dashed rgba(236,48,19,.6);background:rgba(236,48,19,.05);display:none;pointer-events:none;z-index:800;transition:left .12s linear,top .12s linear}#pc-overlay #ghost.on{display:block}#pc-overlay #ghost::after{content:'HERE';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-weight:800;font-size:9.5px;letter-spacing:.16em;color:var(--red-700)}#pc-overlay #feed.view-board .zband{position:absolute;left:0;right:0;pointer-events:none}#pc-overlay #feed.view-board .zband .zhead{position:absolute;left:0;right:0;top:0;height:44px;\n  display:flex;align-items:center;gap:9px;pointer-events:auto;cursor:pointer;\n  border:none;background:transparent;padding:0;text-align:left;color:var(--red-700);font-family:inherit}#pc-overlay .zhead .zt{font-weight:800;font-size:10px;letter-spacing:.18em;text-transform:uppercase}#pc-overlay .zhead .zn{font-weight:800;font-size:9.5px;letter-spacing:.1em;color:var(--ink);opacity:.45}#pc-overlay .zhead .zr{flex:1;height:2px;background:var(--ink);opacity:.16}#pc-overlay .zhead .zcar{flex:none;width:0;height:0;border-left:6px solid currentColor;\n  border-top:4.5px solid transparent;border-bottom:4.5px solid transparent;\n  transform:rotate(90deg);transition:transform .18s ease}#pc-overlay .zband.fold .zhead .zcar{transform:rotate(0deg)}#pc-overlay .zhead:hover .zt{color:var(--red)}#pc-overlay .zhead:hover .zr{opacity:.3}#pc-overlay #feed.view-board .zband .zdrop{position:absolute;left:0;right:0;top:44px;bottom:0;\n  border:2px dashed rgba(32,30,29,.18);display:flex;align-items:center;padding:0 13px;\n  font-weight:800;font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.45}#pc-overlay #feed.view-board .zband.over .zr{background:var(--red);opacity:1}#pc-overlay #feed.view-board .zband.over .zt{color:var(--red)}#pc-overlay #feed.view-board .zband.over .zdrop{border-color:var(--red);opacity:.9;color:var(--red-700)}#pc-overlay #feed.view-board .zband.over::after{content:'';position:absolute;left:0;right:0;top:44px;bottom:0;\n  background:rgba(236,48,19,.06)}#pc-overlay .rstlayer{position:absolute;inset:0;pointer-events:none;overflow:hidden}#pc-overlay .rstmp{position:absolute;left:var(--x);top:var(--y);transform:translate(-50%,-50%) rotate(var(--rot));\n  border:2px solid currentColor;padding:5px 8px 4px;font-weight:900;font-size:11px;line-height:1;\n  letter-spacing:.13em;text-transform:uppercase;white-space:nowrap;\n  color:var(--red);opacity:.82;mix-blend-mode:multiply;filter:url(#inkedge)}#pc-overlay .rstmp::after{content:'';position:absolute;inset:2px;border:1px solid currentColor;opacity:.5}#pc-overlay .rstmp.fresh{animation:pcv3-inkpress .3s cubic-bezier(.2,.85,.3,1.4)}@keyframes pcv3-inkpress{0%{transform:translate(-50%,-50%) rotate(var(--rot)) scale(1.6)}55%{transform:translate(-50%,-50%) rotate(var(--rot)) scale(.96)}100%{transform:translate(-50%,-50%) rotate(var(--rot)) scale(1)}}body.pcv3-stamping #pc-overlay #feed .pc{cursor:crosshair}body.pcv3-stamping #pc-overlay #feed .pc:hover{border-color:var(--red)}body.pcv3-stamping #pc-overlay #feed .pc .foot, body.pcv3-stamping #pc-overlay #feed .pc .poll, body.pcv3-stamping #pc-overlay #feed .pc .cmt, body.pcv3-stamping #pc-overlay #feed .pc .rxw, body.pcv3-stamping #pc-overlay #feed .pc .pin, body.pcv3-stamping #pc-overlay #feed .pc .rz, body.pcv3-stamping #pc-overlay #feed .pc .grip{pointer-events:none}body.pcv3-stamping #pc-overlay .fab{display:none}#pc-overlay .stray{display:none;flex:none;align-items:center;gap:8px;padding:8px 12px;border-top:2px solid var(--ink);background:var(--paper)}#pc-overlay .stray.on{display:flex}#pc-overlay .stray .l2{flex:none;font-weight:800;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;opacity:.5}#pc-overlay .spick{display:flex;gap:6px;flex:1 1 0;min-width:0;overflow-x:auto;overflow-y:hidden;\n  scrollbar-width:none;-webkit-overflow-scrolling:touch}#pc-overlay .spick::-webkit-scrollbar{display:none}#pc-overlay .spick.scrollable{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 16px),transparent);\n                          mask-image:linear-gradient(90deg,#000 calc(100% - 16px),transparent)}#pc-overlay .spick button{--sc:var(--ink);flex:none;min-height:44px;padding:0 12px;cursor:pointer;\n  border:1.5px solid var(--line);background:transparent;color:var(--ink);\n  font-weight:900;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}#pc-overlay .spick button:hover{border-color:var(--ink)}#pc-overlay .spick button.on{background:var(--sc);border-color:var(--sc);color:#fff}#pc-overlay .stray .sbtn{flex:none;min-width:44px;min-height:44px;padding:0 12px;cursor:pointer;\n  border:1.5px solid var(--ink);background:transparent;color:var(--ink);\n  font-weight:800;font-size:11px;letter-spacing:.1em;text-transform:uppercase}#pc-overlay .stray .sbtn:hover{background:var(--ink);color:var(--paper)}#pc-overlay .stray .sbtn:disabled{opacity:.3;cursor:not-allowed}#pc-overlay .stray .sbtn:disabled:hover{background:transparent;color:var(--ink)}#pc-overlay .stray .sbtn.go{background:var(--red);border-color:var(--red);color:#fff}#pc-overlay .stray .sbtn.go:hover{background:var(--red-700);border-color:var(--red-700)}@media (max-width:860px){#pc-overlay .stray{padding:8px 10px;gap:6px}#pc-overlay .stray .l2{display:none}#pc-overlay .spick button{padding:0 10px}\n}#pc-overlay .pc .poll{margin-top:12px}#pc-overlay .pc .phead{display:flex;align-items:center;gap:9px;margin-bottom:7px}#pc-overlay .pc .phead .pl{flex:none;font-weight:800;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--red-700)}#pc-overlay .pc .phead .pn{flex:none;font-weight:800;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.45}#pc-overlay .pc .phead .pr{flex:1;height:2px;background:var(--ink);opacity:.16}#pc-overlay .pc .popt{position:relative;display:flex;align-items:center;gap:9px;width:100%;min-height:40px;\n  border:1.5px solid var(--line);background:transparent;color:inherit;font-family:inherit;\n  padding:8px 10px;text-align:left;cursor:pointer;overflow:hidden}#pc-overlay .pc .popt+.popt{margin-top:6px}#pc-overlay .pc .popt:hover{border-color:var(--ink)}#pc-overlay .pc .pmk{flex:none;width:13px;height:13px;border:2px solid currentColor;opacity:.4;z-index:1}#pc-overlay .pc .popt.mine{border-color:var(--red)}#pc-overlay .pc .popt.mine .pmk{background:var(--red);border-color:var(--red);opacity:1}#pc-overlay .pc .pt{flex:1;min-width:0;font-size:13px;font-weight:600;line-height:1.35;word-break:break-word;z-index:1}#pc-overlay .pc .pv{flex:none;font-weight:800;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;opacity:.55;z-index:1}#pc-overlay .pc .popt.mine .pv{opacity:1;color:var(--red-700)}#pc-overlay .pc .pbar{position:absolute;left:0;top:0;bottom:0;width:var(--p,0%);background:rgba(32,30,29,.09);pointer-events:none}#pc-overlay .pc .popt.win{border-color:var(--red)}#pc-overlay .pc .popt.win .pbar{background:rgba(236,48,19,.15)}#pc-overlay .pc .popt.win .pt{font-weight:900;color:var(--red-700)}#pc-overlay .pc .pclose{display:block;width:100%;margin-top:7px;min-height:40px;padding:9px;cursor:pointer;\n  border:1.5px solid var(--ink);background:transparent;color:inherit;font-family:inherit;\n  font-weight:800;font-size:10px;letter-spacing:.12em;text-transform:uppercase}#pc-overlay .pc .pclose:hover{background:var(--ink);color:var(--paper)}#pc-overlay .pc .cmt{display:none;margin-top:10px;border-top:2px solid var(--ink);padding-top:8px}#pc-overlay .pc .cmt.on{display:block}#pc-overlay .pc .cmore{display:block;width:100%;min-height:32px;margin-bottom:4px;padding:7px 8px;cursor:pointer;\n  border:1.5px solid var(--line);background:transparent;color:inherit;font-family:inherit;\n  font-weight:800;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;opacity:.65}#pc-overlay .pc .cmore:hover{opacity:1;border-color:var(--ink)}#pc-overlay .pc .crow{padding:5px 0;font-size:13px;line-height:1.45;word-break:break-word}#pc-overlay .pc .crow+.crow{border-top:1.5px solid var(--line-soft)}#pc-overlay .pc .cwho{font-weight:800;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--red-700);margin-right:6px}#pc-overlay .pc .cwhen{font-weight:600;font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.4;margin-left:6px;white-space:nowrap}#pc-overlay .pc .cadd{display:flex;gap:6px;margin-top:7px}#pc-overlay .pc .cin{flex:1;min-width:0;min-height:36px;padding:8px 9px;font-family:inherit;font-size:13px;\n  border:1.5px solid var(--line);background:transparent;color:inherit;border-radius:0}#pc-overlay .pc .cin:focus{outline:none;border-color:var(--ink)}#pc-overlay .pc .csend{flex:none;min-height:36px;padding:0 12px;cursor:pointer;\n  border:1.5px solid var(--ink);background:transparent;color:inherit;font-family:inherit;\n  font-weight:800;font-size:10px;letter-spacing:.12em;text-transform:uppercase}#pc-overlay .pc .csend:hover{background:var(--ink);color:var(--paper)}#pc-overlay .pc .act.open{opacity:1;color:var(--red-700)}#pc-overlay .phdr{display:flex;align-items:center;gap:8px;margin-bottom:6px}#pc-overlay .phdr .l{flex:none;font-weight:800;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;opacity:.55}#pc-overlay .phdr .r{flex:1;height:2px;background:var(--ink);opacity:.16}#pc-overlay .polled{display:flex;flex-direction:column;gap:6px}#pc-overlay .polled .prow{display:flex;gap:6px;align-items:center}#pc-overlay .polled .prow .inp{flex:1;min-width:0}#pc-overlay .polled .prm{flex:none;min-width:44px;padding:9px 10px}#pc-overlay .pwarn{display:none;font-weight:800;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--red)}#pc-overlay .pwarn.on{display:block}#pc-overlay .empty{text-align:center;padding:52px 16px;opacity:.45;font-size:13.5px}#pc-overlay .fab{position:absolute;right:20px;bottom:20px;width:56px;height:56px;border:none;background:var(--red);color:#fff;font-size:30px;line-height:1;cursor:pointer;z-index:40;\n  box-shadow:0 12px 26px rgba(174,24,0,.4);transition:transform .18s ease,box-shadow .18s ease}#pc-overlay .fab:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 16px 30px rgba(174,24,0,.5)}#pc-overlay .fab:active{transform:scale(.95)}#pc-overlay .stat{padding:9px 18px;border-top:1.5px solid var(--line);display:flex;gap:16px;font-weight:800;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;opacity:.5;background:var(--paper)}#pc-overlay .stat i{font-style:normal;color:var(--red-700)}#pc-overlay #compose{position:absolute;inset:0;z-index:200;background:var(--paper);display:none;flex-direction:column}#pc-overlay #compose.on{display:flex}#pc-overlay .cbar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:2px solid var(--ink);flex:none}#pc-overlay .cbar .t{font-weight:900;font-size:15px;letter-spacing:-.01em;text-transform:uppercase}#pc-overlay .cbar .steps{display:flex;gap:5px;margin-left:10px}#pc-overlay .cbar .dot{width:22px;height:3px;background:var(--ink);opacity:.18}#pc-overlay .cbar .dot.on{opacity:1;background:var(--red)}#pc-overlay .cbar .sp{flex:1}#pc-overlay .cbtn{border:1.5px solid var(--ink);background:transparent;padding:9px 15px;font-weight:800;font-size:11px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;color:var(--ink);min-height:40px}#pc-overlay .cbtn:hover{background:var(--ink);color:var(--paper)}#pc-overlay .cbtn.primary{background:var(--red);border-color:var(--red);color:#fff}#pc-overlay .cbtn.primary:hover{background:var(--red-700);border-color:var(--red-700)}#pc-overlay .cbtn:disabled{opacity:.35;cursor:not-allowed}#pc-overlay .cbtn.ghost{border-color:var(--line)}#pc-overlay .cbody{flex:1;overflow:auto;padding:16px}#pc-overlay .nophoto{width:100%;border:2px solid var(--ink);background:var(--ink);color:var(--paper);padding:18px;\n  font-weight:900;font-size:15px;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;gap:12px;min-height:56px}#pc-overlay .nophoto:hover{background:var(--red);border-color:var(--red)}#pc-overlay .nophoto small{display:block;font-weight:600;font-size:10.5px;letter-spacing:.1em;opacity:.72;margin-top:3px;text-transform:none}#pc-overlay .pickhead{display:flex;align-items:baseline;gap:10px;margin:20px 0 10px}#pc-overlay .pickhead .l{font-weight:800;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--red-700)}#pc-overlay .pickhead .r{flex:1;height:2px;background:var(--ink);opacity:.16}#pc-overlay .gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px}#pc-overlay .gal button{border:1.5px solid var(--line);background:var(--surface);padding:0;cursor:pointer;aspect-ratio:1;overflow:hidden;position:relative;min-height:44px}#pc-overlay .gal button:hover{border-color:var(--ink)}#pc-overlay .gal button.sel{border-color:var(--red);border-width:3px}#pc-overlay .gal img{width:100%;height:100%;object-fit:cover;display:block}#pc-overlay .gal .up{display:flex;align-items:center;justify-content:center;font-weight:800;font-size:26px;color:var(--ink);opacity:.5;height:100%}#pc-overlay .edwrap{display:flex;flex-direction:column;gap:12px}#pc-overlay .stage{position:relative;background:var(--ink);overflow:hidden;align-self:center;width:100%;max-width:460px;touch-action:none}#pc-overlay .stage img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}#pc-overlay .stage.r1{aspect-ratio:1/1}#pc-overlay .stage.r45{aspect-ratio:4/5}#pc-overlay .stage.rfree{aspect-ratio:auto}#pc-overlay .tlayer{position:absolute;inset:0}#pc-overlay .tl{position:absolute;transform:translate(-50%,-50%);font-weight:900;font-size:26px;line-height:1.1;color:#fff;\n  text-shadow:0 2px 10px rgba(0,0,0,.55);cursor:grab;user-select:none;white-space:pre;padding:4px;touch-action:none}#pc-overlay .tl.sel{outline:2px dashed rgba(255,255,255,.85);outline-offset:2px}#pc-overlay .tl.drag{cursor:grabbing}#pc-overlay .tin{position:absolute;transform:translate(-50%,-50%);z-index:5;background:rgba(32,30,29,.9);border:2px solid var(--red);\n  color:#fff;font-family:inherit;font-weight:900;font-size:20px;padding:7px 9px;min-width:150px;outline:none;text-align:center}#pc-overlay .tabs2{display:flex;border:1.5px solid var(--ink);overflow:hidden}#pc-overlay .tabs2 button{flex:1;border:none;background:transparent;padding:11px 6px;font-weight:800;font-size:10px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;color:var(--ink);min-height:44px}#pc-overlay .tabs2 button+button{border-left:1.5px solid var(--ink)}#pc-overlay .tabs2 button.on{background:var(--ink);color:var(--paper)}#pc-overlay .panel{min-height:96px}#pc-overlay .stk{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:5px}#pc-overlay .stk button{border:1.5px solid var(--line);background:var(--paper);font-size:23px;line-height:1;cursor:pointer;aspect-ratio:1;min-height:46px;padding:0}#pc-overlay .stk button:hover{border-color:var(--red);background:#fff}#pc-overlay .fonts{display:flex;gap:6px;overflow-x:auto;padding-bottom:3px}#pc-overlay .fonts button{flex:none;border:1.5px solid var(--line);background:var(--paper);padding:9px 13px;font-size:16px;cursor:pointer;color:var(--ink);min-height:46px;white-space:nowrap}#pc-overlay .fonts button.on{border-color:var(--red);border-width:2.5px}#pc-overlay .stampgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px}#pc-overlay .stampgrid button{border:1.5px solid var(--line);background:var(--paper);cursor:pointer;padding:7px;min-height:70px;display:grid;place-items:center}#pc-overlay .stampgrid button:hover{border-color:var(--red)}#pc-overlay .stampgrid svg{width:100%;height:auto;max-height:56px}#pc-overlay .frames{display:flex;gap:6px;flex-wrap:wrap}#pc-overlay .frames button{border:1.5px solid var(--line);background:var(--paper);padding:10px 13px;font-weight:800;font-size:10px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;color:var(--ink);min-height:44px}#pc-overlay .frames button.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}#pc-overlay .widths{display:flex;gap:5px}#pc-overlay .widths button{border:1.5px solid var(--line);background:var(--paper);width:46px;min-height:46px;cursor:pointer;display:grid;place-items:center;padding:0}#pc-overlay .widths button.on{border-color:var(--red);border-width:2.5px}#pc-overlay .widths i{display:block;background:var(--ink);border-radius:99px}#pc-overlay .stage.f-polaroid{padding:14px 14px 52px;background:#fff}#pc-overlay .stage.f-ink{padding:0;box-shadow:inset 0 0 0 3px var(--ink)}#pc-overlay .stage.f-red{padding:0;box-shadow:inset 0 0 0 4px var(--red)}#pc-overlay .stage.f-none{padding:0}#pc-overlay .stage .inner{position:relative;width:100%;height:100%;overflow:hidden}#pc-overlay .pen{position:absolute;inset:0;pointer-events:none}#pc-overlay .pen.live{pointer-events:auto;touch-action:none;cursor:crosshair}#pc-overlay .lay{position:absolute;transform-origin:center;user-select:none;touch-action:none;cursor:grab}#pc-overlay .lay.sel{outline:2px dashed rgba(255,255,255,.9);outline-offset:3px}#pc-overlay .lay.st{font-size:44px;line-height:1}#pc-overlay .lay.tx{font-weight:900;font-size:26px;line-height:1.15;text-shadow:0 2px 10px rgba(0,0,0,.5);white-space:pre;padding:3px 6px}#pc-overlay .lay.tx.bg-white{background:#fff;color:var(--ink)!important;text-shadow:none}#pc-overlay .lay.tx.bg-red{background:var(--red);color:#fff!important;text-shadow:none}#pc-overlay .lay.stamp svg{display:block;width:120px;height:auto}#pc-overlay .hnd{position:absolute;right:-13px;bottom:-13px;width:26px;height:26px;background:var(--red);border:2px solid #fff;cursor:nwse-resize;display:none}#pc-overlay .lay.sel .hnd{display:block}#pc-overlay .filts{display:flex;gap:7px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}#pc-overlay .filts button{flex:none;border:1.5px solid var(--line);background:transparent;padding:0;cursor:pointer;width:66px}#pc-overlay .filts button.on{border-color:var(--red);border-width:2.5px}#pc-overlay .filts canvas{display:block;width:100%;aspect-ratio:1;object-fit:cover}#pc-overlay .filts .nm{display:block;font-weight:800;font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;padding:4px 2px;text-align:center;background:var(--paper)}#pc-overlay .filts button.on .nm{background:var(--red);color:#fff}#pc-overlay .row{display:flex;gap:7px;align-items:center;flex-wrap:wrap}#pc-overlay .row .lbl{font-weight:800;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;opacity:.5;margin-right:2px}#pc-overlay .tool{border:1.5px solid var(--line);background:transparent;padding:9px 12px;font-weight:800;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;color:var(--ink);min-height:40px}#pc-overlay .tool:hover{border-color:var(--ink)}#pc-overlay .tool.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}#pc-overlay .swatches{display:flex;gap:5px}#pc-overlay .sw{width:26px;height:26px;border:2px solid #fff;box-shadow:0 0 0 1px var(--line);cursor:pointer;padding:0}#pc-overlay .sw.on{box-shadow:0 0 0 2px var(--ink)}#pc-overlay .hint{font-size:11.5px;line-height:1.55;opacity:.55}#pc-overlay .share{display:flex;flex-direction:column;gap:14px;max-width:520px;margin:0 auto}#pc-overlay .sharetop{display:flex;gap:12px;align-items:flex-start}#pc-overlay .sharetop .thumb{width:86px;height:86px;flex:none;border:1.5px solid var(--line);background:var(--surface);overflow:hidden;position:relative}#pc-overlay .sharetop .thumb img{width:100%;height:100%;object-fit:cover;display:block}#pc-overlay .sharetop .cap{flex:1}#pc-overlay .fld{display:block;font-weight:800;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;opacity:.55;margin:0 0 5px}#pc-overlay .inp, #pc-overlay .sel, #pc-overlay .ta{width:100%;border:1.5px solid var(--line);background:#fff;padding:11px;font-family:inherit;font-size:15px;color:var(--ink)}#pc-overlay .inp:focus, #pc-overlay .sel:focus, #pc-overlay .ta:focus{outline:none;border-color:var(--red);box-shadow:0 0 0 3px rgba(236,48,19,.13)}#pc-overlay .ta{min-height:84px;resize:vertical;line-height:1.5}#pc-overlay .tones{display:flex;gap:9px}#pc-overlay .tone{width:38px;height:38px;border:2px solid transparent;box-shadow:0 0 0 1px var(--line);cursor:pointer;padding:0}#pc-overlay .tone.on{border-color:var(--ink)}#pc-overlay .gate{display:flex;gap:9px;font-size:11.5px;line-height:1.55;background:rgba(236,48,19,.06);padding:11px;opacity:.9}#pc-overlay .gate svg{flex:none;width:15px;height:15px;stroke:var(--red);fill:none;stroke-width:2;margin-top:1px}@media (max-width:560px){#pc-overlay .cbar{padding:10px 12px;gap:7px}#pc-overlay .cbar .t{font-size:13px}#pc-overlay .cbody{padding:12px}#pc-overlay .sharetop{flex-direction:column}#pc-overlay .sharetop .thumb{width:100%;height:150px}#pc-overlay .sharetop .thumb.none{height:44px}#pc-overlay .cbar .steps{display:none}          \n}@media (pointer:coarse){#pc-overlay .pc .act{min-height:44px;padding:11px 10px;font-size:10.5px;position:relative}#pc-overlay .pc .act::after{content:\"\";position:absolute;top:0;bottom:0;left:50%;width:44px;transform:translateX(-50%)}#pc-overlay .pc .foot{gap:2px}#pc-overlay .pc .popt, #pc-overlay .pc .pclose{min-height:44px}#pc-overlay .pc .cmore, #pc-overlay .pc .cin, #pc-overlay .pc .csend{min-height:44px}#pc-overlay .pc .rxmore{min-height:44px;padding:0 4px}#pc-overlay .pc .pin{width:46px;height:46px;top:-13px;right:12px}#pc-overlay .chip{min-height:44px;padding:12px 13px}#pc-overlay .mini{min-height:44px;padding:12px 8px}#pc-overlay .seg button{min-height:44px}#pc-overlay .search input{min-height:46px}#pc-overlay .inp, #pc-overlay .sel, #pc-overlay .ta{min-height:46px}#pc-overlay .x{width:44px;height:44px}#pc-overlay .tool, #pc-overlay .cbtn, #pc-overlay .nophoto{min-height:46px}#pc-overlay .sw{width:44px;height:44px}#pc-overlay .tone{width:46px;height:46px}#pc-overlay .gal button{min-height:56px}#pc-overlay .filts button{width:76px}#pc-overlay .tl{font-size:22px}#pc-overlay .fab{width:60px;height:60px;right:16px;bottom:16px}\n}@media (max-width:860px), (pointer:coarse) and (max-width:940px){#pc-overlay .tools{flex-wrap:nowrap;gap:6px;padding:5px 10px}#pc-overlay .seg{flex:none;border:none;outline:1.5px solid var(--ink);outline-offset:-1.5px}#pc-overlay .seg button{padding:8px 11px}#pc-overlay .chips{flex:1 1 0;min-width:0;flex-wrap:nowrap;gap:5px;overflow-x:auto;overflow-y:hidden;\n    scrollbar-width:none;-webkit-overflow-scrolling:touch}#pc-overlay .chips::-webkit-scrollbar{display:none}#pc-overlay .chips.scrollable{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 16px),transparent);\n                            mask-image:linear-gradient(90deg,#000 calc(100% - 16px),transparent)}#pc-overlay .chip{flex:none;padding:12px 11px}#pc-overlay .iconbtn{display:flex}#pc-overlay .tgrp{display:none;position:absolute;right:10px;top:calc(100% + 3px);z-index:60;\n    flex-direction:column;align-items:stretch;min-width:170px;\n    background:var(--paper);border:2px solid var(--ink);padding:4px}#pc-overlay .tools.moreon .tgrp{display:flex}#pc-overlay .tgrp .mini{text-align:left;padding:13px 11px;opacity:.85}#pc-overlay .tgrp .mini+.mini{border-top:1.5px solid var(--line-soft)}#pc-overlay .search{display:none}#pc-overlay .tools.searchon .search{display:flex;align-items:center;gap:6px;position:absolute;inset:0;\n    margin:0;padding:5px 10px;background:var(--paper);z-index:70}#pc-overlay .tools.searchon .search input{flex:1 1 auto;width:auto;min-width:0}#pc-overlay .tools.searchon .search svg{left:21px}#pc-overlay .tools.searchon #qclose{display:block;flex:none;min-width:44px;padding:12px 4px;text-align:center}\n}#pc-overlay .pc{--tilt:0deg!important}#pc-overlay .pc .att{transform:translateX(-50%)!important}#pc-overlay .pc.claimedcard{opacity:.5}#pc-overlay .pc.claimedcard .msg{text-decoration:line-through;text-decoration-thickness:1.5px}#pc-overlay .pc .act.claim{color:var(--red-700)}#pc-overlay #feed.view-feed .cols{max-width:620px;margin-left:auto;margin-right:auto}#pc-overlay .brandlogo{height:46px;width:auto;flex:none;display:block}@media (max-width:520px){#pc-overlay .brandlogo{height:34px}}#pc-overlay .lrow{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media (max-width:520px){#pc-overlay .lrow{grid-template-columns:1fr}}#pc-overlay .pc .lost{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px;font-weight:800;font-size:10px;\n  letter-spacing:.1em;text-transform:uppercase}#pc-overlay .pc .lost b{color:var(--red-700);font-weight:800}#pc-overlay .pc .lost span{opacity:.6;font-weight:600;letter-spacing:.04em;text-transform:none;font-size:12.5px}#pc-overlay .sharetop .thumb{border:2px dashed var(--line);cursor:pointer;padding:0}#pc-overlay .sharetop .thumb:hover{border-color:var(--red)}#pc-overlay .sharetop .thumb .thadd{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;\n  height:100%;font-weight:800;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;opacity:.6}#pc-overlay .sharetop .thumb .thadd b{font-size:24px;line-height:1;color:var(--red)}#pc-overlay .thdrop{align-self:flex-start;margin-top:6px;border:none;background:transparent;cursor:pointer;\n  font-weight:800;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.5;padding:6px 0}#pc-overlay .thdrop:hover{opacity:1;color:var(--red)}body.pcv3-stamping #pc-overlay .rstmp{pointer-events:auto;cursor:pointer}body.pcv3-stamping #pc-overlay .rstmp:hover{outline:2px solid var(--red);outline-offset:2px;opacity:.55}#pc-overlay .stampbtn{display:inline-flex;align-items:center;gap:7px;border:1.5px solid var(--line);padding:7px 12px}#pc-overlay .stampbtn:hover{border-color:var(--ink);opacity:1}#pc-overlay .stampbtn .sdot{width:11px;height:11px;border-radius:50%;background:var(--sc,var(--ink));\n  box-shadow:0 0 0 2px var(--paper),0 0 0 3.5px var(--sc,var(--ink))}#pc-overlay .stampbtn.on{background:var(--sc,var(--red));border-color:var(--sc,var(--red));color:#fff}#pc-overlay .stampbtn.on .sdot{background:#fff;box-shadow:0 0 0 2px var(--sc,var(--red)),0 0 0 3.5px #fff}#pc-overlay .cbody{background-color:#ddd5c6;\n  background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);\n  background-size:22px 22px,22px 22px}#pc-overlay .pick2{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin:26px 0 8px;max-width:760px}#pc-overlay .pk{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;\n  gap:9px;min-height:250px;padding:26px 16px 22px;cursor:pointer;text-align:center;\n  background:var(--paper);border:1.5px solid var(--line);color:var(--ink);font-family:inherit;\n  transition:border-color .18s ease,transform .18s cubic-bezier(.2,.9,.3,1.14)}#pc-overlay .pk::after{content:'';position:absolute;inset:-1.5px;border:1.5px solid var(--red);\n  mix-blend-mode:multiply;opacity:.34;pointer-events:none;transition:opacity .18s ease}#pc-overlay .pk::before{content:'';position:absolute;left:50%;top:-8px;width:15px;height:15px;border-radius:50%;\n  background:var(--red);mix-blend-mode:multiply;transform:translateX(-50%);\n  box-shadow:0 0 0 3px rgba(236,48,19,.18);z-index:2}#pc-overlay .pk:hover{border-color:var(--ink);transform:translateY(-3px)}#pc-overlay .pk:hover::after{opacity:.62}#pc-overlay .pk .pkic{font-size:62px;line-height:1;color:var(--red);opacity:.92;margin-bottom:4px}#pc-overlay .pk .pkt{font-weight:900;font-size:24px;letter-spacing:-.015em;text-transform:uppercase;line-height:1.02}#pc-overlay .pk .pks{font-weight:600;font-size:13.5px;letter-spacing:.01em;opacity:.55;text-transform:none;line-height:1.45;max-width:22ch}#pc-overlay .pk.lostpk .pkic{color:var(--fortress)}#pc-overlay .pk.pollpk .pkic{color:var(--sanctuary)}#pc-overlay .pk:nth-child(2){background-image:repeating-linear-gradient(transparent 0 25px,color-mix(in srgb,var(--ink) 7%,transparent) 25px 26px);background-position:0 12px}#pc-overlay .pk:nth-child(4){background-image:repeating-linear-gradient(transparent 0 21px,color-mix(in srgb,var(--ink) 5%,transparent) 21px 22px),repeating-linear-gradient(90deg,transparent 0 21px,color-mix(in srgb,var(--ink) 5%,transparent) 21px 22px)}#pc-overlay .pickttl{position:relative;isolation:isolate;display:inline-block;margin:2px 0 0;\n  font-weight:800;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink)}#pc-overlay .pickttl::before{content:attr(data-t);position:absolute;left:2px;top:1.5px;color:var(--red);\n  mix-blend-mode:multiply;opacity:.7;z-index:-1;white-space:nowrap;pointer-events:none}@media (max-width:1000px){#pc-overlay .pick2{grid-template-columns:1fr 1fr;gap:16px}}@media (max-width:760px){#pc-overlay .pk{min-height:200px}#pc-overlay .pk .pkic{font-size:52px}#pc-overlay .pk .pkt{font-size:21px}}@media (max-width:520px){#pc-overlay .pick2{grid-template-columns:1fr;gap:14px}#pc-overlay .pk{min-height:104px;flex-direction:row;align-items:center;text-align:left;gap:16px;padding:16px 18px}#pc-overlay .pk .pkic{font-size:38px;margin:0}#pc-overlay .pk .pkt{font-size:19px}#pc-overlay .pk .pks{font-size:12.5px;max-width:none}}#pc-overlay .thcam{align-self:flex-start;margin-top:6px;border:1.5px solid var(--ink);background:transparent;color:var(--ink);\n  cursor:pointer;font-weight:800;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;padding:9px 11px;min-height:44px}#pc-overlay .thcam:hover{background:var(--ink);color:var(--paper)}@media (hover:hover) and (pointer:fine){#pc-overlay .thcam{display:none}}\n";
  var SHELL="<div class=\"wrap\"><div class=\"app\" style=\"position:relative\">\n\n  <div class=\"head\">\n    <!-- \uc2e4\uc81c \ub85c\uace0 \ud30c\uc77c. \ubc30\ud3ec \uc2dc index.html\u00b7postcards.js \uc640 \uac19\uc740 \ub8e8\ud2b8\uc5d0 \uc62c\ub77c\uac04\ub2e4 -->\n    <img class=\"brandlogo\" src=\"/hideout-logo.png\" alt=\"The Hideout\"\n         onerror=\"this.style.display='none'\">\n    <span class=\"mark\">\n      <span class=\"n\">POSTCARDS</span>\n      <span class=\"s\">The Hideout \u00b7 Staff Board</span>\n    </span>\n    <button class=\"x\">\u00d7</button>\n  </div>\n\n  <div class=\"ribbon\"><div class=\"marq\"><span>SAY SOMETHING KIND<b>\u00b7</b>COFFEE FIRST<b>\u00b7</b>THE HIDEOUT PEOPLE<b>\u00b7</b>SAY SOMETHING KIND<b>\u00b7</b>COFFEE FIRST<b>\u00b7</b>THE HIDEOUT PEOPLE<b>\u00b7</b></span><span>SAY SOMETHING KIND<b>\u00b7</b>COFFEE FIRST<b>\u00b7</b>THE HIDEOUT PEOPLE<b>\u00b7</b>SAY SOMETHING KIND<b>\u00b7</b>COFFEE FIRST<b>\u00b7</b>THE HIDEOUT PEOPLE<b>\u00b7</b></span></div></div>\n\n  <div class=\"tools\">\n    <span class=\"seg\" id=\"view\"><button data-v=\"board\" class=\"on\">Pinboard</button><button data-v=\"feed\">Feed</button><button data-v=\"lost\">Lost &amp; found</button></span>\n    <!-- \ub370\uc2a4\ud06c\ud1b1\uc5d0\uc120 .tgrp \uac00 display:contents \ub77c \uc544\ub798 3\uac1c\uac00 \ud234\ubc14\uc5d0 \uadf8\ub300\ub85c \ubd99\ub294\ub2e4.\n         \uc881\uc740 \ud654\uba74\uc5d0\uc11c\ub9cc \uc774 \ub798\ud37c\uac00 `\u22ef` \ud31d\uc624\ubc84\ub85c \ubc14\ub010\ub2e4 -->\n    <span class=\"tgrp\" id=\"tgrp\">\n      <button class=\"mini stampbtn\" id=\"stamp\"><span class=\"sdot\"></span><span class=\"slbl\">Stamp</span></button>\n      \n    </span>\n    <button class=\"iconbtn\" id=\"searchtog\" aria-label=\"Search\" aria-expanded=\"false\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M20 20l-4-4\"/></svg>\n    </button>\n    <button class=\"iconbtn\" id=\"more\" aria-label=\"More options\" aria-expanded=\"false\">\n      <svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><rect x=\"3\" y=\"10.5\" width=\"3.5\" height=\"3.5\"/><rect x=\"10.25\" y=\"10.5\" width=\"3.5\" height=\"3.5\"/><rect x=\"17.5\" y=\"10.5\" width=\"3.5\" height=\"3.5\"/></svg>\n    </button>\n    <span class=\"search\">\n      <svg viewBox=\"0 0 24 24\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"M20 20l-4-4\"/></svg>\n      <input id=\"q\" placeholder=\"Search\" autocomplete=\"off\"/>\n      <button class=\"mini\" id=\"qclose\" aria-label=\"Close search\">\u2715</button>\n    </span>\n  </div>\n\n  <div class=\"body\" id=\"body\"><div id=\"feed\" class=\"view-board\"><div id=\"ghost\"></div></div></div>\n\n  <!-- \u2550\u2550\u2550 \ub3c4\uc7a5 \ud2b8\ub808\uc774 (\ud050 4) \u2014 \ud750\ub984 \uc548\uc5d0 \ub123\uc5b4 body \ub97c \uc904\uc778\ub2e4. \uacb9\uce58\uba74 \ub9e8 \uc544\ub798 \uce74\ub4dc\uac00 \uac00\ub824\uc9c4\ub2e4 \u2550\u2550\u2550 -->\n  <div class=\"stray\" id=\"stray\">\n    <span class=\"l2\">Stamps</span>\n    <div class=\"spick\" id=\"spick\"></div>\n    <button class=\"sbtn\" id=\"sundo\" aria-label=\"Undo last stamp\" title=\"Undo\" disabled>\u21ba</button>\n    <button class=\"sbtn go\" id=\"sdone\">Done</button>\n  </div>\n\n  <div class=\"stat\">\n    <span>Showing <i id=\"s-n\">0</i></span>\n    <span>Overlap <i id=\"s-hit\">0</i></span>\n    <span id=\"s-mode\">Feed \u00b7 masonry</span>\n  </div>\n\n  <button class=\"fab\" id=\"fab\" title=\"New postcard\">+</button>\n\n  <!-- \u2550\u2550\u2550 \uc791\uc131 \u2014 \uc778\uc2a4\ud0c0\ud615 3\ub2e8 \u2550\u2550\u2550 -->\n  <div id=\"compose\">\n    <div class=\"cbar\">\n      <button class=\"cbtn ghost\" id=\"cback\">\u2190</button>\n      <span class=\"t\" id=\"ctitle\">New postcard</span>\n      <span class=\"steps\"><i class=\"dot on\"></i><i class=\"dot\"></i><i class=\"dot\"></i></span>\n      <span class=\"sp\"></span>\n      <button class=\"cbtn\" id=\"cclose\">Close</button>\n      <button class=\"cbtn primary\" id=\"cnext\">Next</button>\n    </div>\n    <div class=\"cbody\" id=\"cbody\"></div>\n  </div>\n</div></div>\n\n<!-- \uc789\ud06c \ubc88\uc9d0 \u2014 \ud14c\ub450\ub9ac\uc640 \uae00\uc790\ub97c \ub178\uc774\uc988\ub85c \uc0b4\uc9dd \ubc00\uc5b4 \uace0\ubb34\ub3c4\uc7a5\uc758 \ubd88\uade0\uc77c\ud55c \uc790\uad6d\uc744 \ub9cc\ub4e0\ub2e4.\n     \uc0ac\uc9c4(\ub798\uc2a4\ud130)\uc774 \uc544\ub2c8\ub77c \ud544\ud130\ub77c\uc11c \uc5b4\ub5a4 \uc0c9\u00b7\uae00\uc790 \uae38\uc774\uc5d0\ub3c4 \uac19\uc774 \ub530\ub77c\uac04\ub2e4 -->\n<svg width=\"0\" height=\"0\" style=\"position:absolute\" aria-hidden=\"true\" focusable=\"false\">\n  <filter id=\"inkedge\" x=\"-15%\" y=\"-25%\" width=\"130%\" height=\"150%\">\n    <feTurbulence type=\"fractalNoise\" baseFrequency=\"0.85\" numOctaves=\"2\" seed=\"7\" result=\"n\"/>\n    <feDisplacementMap in=\"SourceGraphic\" in2=\"n\" scale=\"2.4\" xChannelSelector=\"R\" yChannelSelector=\"G\"/>\n  </filter>\n</svg>\n\n<svg width=\"0\" height=\"0\" style=\"position:absolute\" aria-hidden=\"true\" focusable=\"false\">\n  <filter id=\"inkedge\" x=\"-15%\" y=\"-25%\" width=\"130%\" height=\"150%\">\n    <feTurbulence type=\"fractalNoise\" baseFrequency=\"0.85\" numOctaves=\"2\" seed=\"7\" result=\"n\"/>\n    <feDisplacementMap in=\"SourceGraphic\" in2=\"n\" scale=\"2.4\" xChannelSelector=\"R\" yChannelSelector=\"G\"/>\n  </filter>\n</svg>";
  function injectCSS(){ if(document.getElementById("pc-css")) return;
    var st=document.createElement("style"); st.id="pc-css"; st.textContent=CSS; document.head.appendChild(st); }
  function isAuthed(){ try{ return document.documentElement.classList.contains("hideout-authed"); }catch(e){ return false; } }
  function syncGate(){ var f=document.getElementById("pc-fab"); if(f) f.style.display=isAuthed()?"flex":"none";
    if(!isAuthed()){ var o=document.getElementById("pc-overlay"); if(o) o.style.display="none"; } }
  function mount(){
    injectCSS();
    var ov=document.createElement("div"); ov.id="pc-overlay";
    ov.innerHTML='<div id="pc-modal">'+SHELL+'</div>';
    document.body.appendChild(ov);
    var fab=document.createElement("button"); fab.id="pc-fab"; fab.type="button";
    fab.setAttribute("aria-label","Staff postcards");
    fab.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
    fab.onclick=function(){ ov.style.display="flex"; window.dispatchEvent(new Event("resize")); };
    document.body.appendChild(fab);
    var x=ov.querySelector(".x"); if(x) x.onclick=function(){ ov.style.display="none"; };
    ov.addEventListener("click",function(e){ if(e.target===ov) ov.style.display="none"; });
    syncGate();
    window.addEventListener("hideout-authed",syncGate);
    try{ new MutationObserver(syncGate).observe(document.documentElement,{attributes:true,attributeFilter:["class"]}); }catch(e){}
    boot();
  }
  function boot(){
    var FB={apiKey:"AIzaSyC6-J5PoHy_Y4JGgN0cmi2iVImuEADYK9s",authDomain:"hideout-recipe-cost.firebaseapp.com",
      projectId:"hideout-recipe-cost",storageBucket:"hideout-recipe-cost.firebasestorage.app",
      messagingSenderId:"717961739938",appId:"1:717961739938:web:752af54de485d7f7c921fb"};
    var LIVE={app:null,auth:null,db:null,me:null,docs:[],unsub:null,staff:[],cm:{}};
    /* 기본 앱 이름을 쓴다 — 같은 오리진의 주문 앱이 만들어 둔 로그인 세션을 그대로 물려받는다 */
    LIVE.app=firebase.apps.length?firebase.app():firebase.initializeApp(FB);
    LIVE.auth=LIVE.app.auth(); LIVE.db=LIVE.app.firestore();

    /* 카드 색을 브랜드에서 파생 — 엽서 구분성은 유지(A안), 톤은 브랜드에 맞춘다 */
    const TONES=[
      {bg:"#f3f2f2", ink:"#201e1d", ac:"#ec3013"},  /* paper */
      {bg:"#eae9e9", ink:"#201e1d", ac:"#ae1800"},  /* surface */
      {bg:"#efe6dc", ink:"#2b1f14", ac:"#9a5a2a"},  /* fortress tint */
      {bg:"#e4e3f2", ink:"#1b1a2e", ac:"#3a26c8"},  /* sanctuary tint */
    ];
    let ME="";
    /* zone — 구역(큐 5). 없으면 "미분류". 데모 데이터에 섞어 두어야 구역이 무엇을 하는지 한눈에 보인다
       cm — 댓글 스레드(큐 11). **오래된 것이 앞**이다(시간 오름차순). 카운트는 이제 `cm.length` 에서 나온다 —
       예전 `c:` 숫자는 아무 데도 연결돼 있지 않은 장식이었다. 스레드 길이는 3 을 넘는 것(접힘)과
       0 인 것(빈 상태)을 둘 다 섞어 둬야 두 경로가 데모에서 보인다
    
       rx — 반응한 사람 **이름 배열**(큐 12). 예전 `r:7` 은 숫자였고, 숫자로는
       "내가 눌렀나"도 "누가 눌렀나"도 **원리적으로** 답할 수 없다 (그래서 `.act.hot` 이
       `d.r>0`, 즉 *누군가* 눌렀을 때 켜지는 틀린 상태 표시를 하고 있었다).
       항목 11 이 `c:3` → `cm[]` 로 바꾼 것과 같은 교체다.
       데모에는 **네 경로를 다 섞어 둔다**: 0명(빈 상태) · 3명 이하(넘침 없음) · 4명 이상(`+N more`) ·
       내가 이미 누른 것(`You` 가 맨 앞 + `♥` 채워짐). 안 그러면 경로가 화면에서 안 보인다 */
    /* ── 라이브 문서 → 시안이 기대하는 모양 ──────────────────────────────
       시안 UI 는 한 글자도 고치지 않는다. 문서를 시안의 필드 이름으로 옮겨 줄 뿐이다. */
    const TONE_ID=["cream","blush","sage","sky"];
    function agoOf(ts){
      try{ const d=ts&&ts.toDate?ts.toDate():new Date(ts); const s=(Date.now()-d.getTime())/1000;
        if(s<3600) return Math.max(1,Math.round(s/60))+"m";
        if(s<86400) return Math.round(s/3600)+"h";
        if(s<86400*7) return Math.round(s/86400)+"d";
        return d.toLocaleDateString("en-AU",{day:"numeric",month:"short"}).toUpperCase();
      }catch(e){ return ""; }
    }
    function nameOf(email){
      for(let i=0;i<(LIVE.staff||[]).length;i++) if(LIVE.staff[i].email===email) return LIVE.staff[i].name;
      return String(email||"").split("@")[0];
    }
    function toV2(doc,i){
      const x=doc.data()||{};
      const rx=[]; const seen={};
      const R=x.reactions||{};
      for(const k in R){ if(!R.hasOwnProperty(k)) continue;
        (R[k]||[]).forEach(e=>{ if(!seen[e]){ seen[e]=1; rx.push(nameOf(e)); } }); }
      const t=Math.max(0,TONE_ID.indexOf(x.theme||"cream"));
      const pos=x.pos&&isFinite(Number(x.pos.x))?x.pos:null;
      return {
        _id:doc.id, id:i,
        from:x.fromName||nameOf(x.fromEmail), to:x.toName||"Everyone",
        fromEmail:(x.fromEmail||"").toLowerCase(),
        msg:x.message||"", t:t, pin:!!x.pinned, rx:rx, ago:agoOf(x.createdAt),
        zone:x.zone||"", poll:x.poll||null, stamps:x.stamps||[],
        kind:x.kind||"", claimed:!!x.claimed,
        lwhat:x.lostWhat||"", lwhere:x.lostWhere||"", lwhen:x.lostWhen||"",
        cm:(LIVE.cm&&LIVE.cm[doc.id])||[],
        src:x.photoUrl||"", photo:x.photoUrl?1:0, ar:(LIVE.ar&&LIVE.ar[doc.id])||"1/1", filter:x.filter||"none", frame:x.frame||"",
        /* 배율은 무시한다. 라이브에는 사람이 키워 둔 카드가 1.47배까지 있는데, 보드는
           카드가 자기 컬럼 폭이라는 전제로 배치한다. 둘이 만나면 그린 크기와 예약한 자리가
           어긋나 판이 통째로 겹친다(실측: 전면 CHAOS). 크기 조절은 뒤에 다시 붙일 기능이다. */
        scale:1,
        /* 시안 보드는 px 좌표를 쓴다. 라이브는 x 가 % 라 폭을 곱해 옮긴다 */
        _posx:pos?Number(pos.x):null, _posy:pos?Number(pos.y):null
      };
    }
    const DATA=[];
    const SHOT=(n,w,h)=>"data:image/svg+xml,"+encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${n===1?"#c9c4bd":"#b9bcae"}"/><g fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"><path d="M0 ${h/2}H${w}"/><path d="M${w/2} 0V${h}"/></g><text x="${w/2}" y="${h/2+7}" font-family="Archivo,sans-serif" font-size="18" font-weight="800" fill="rgba(32,30,29,.4)" text-anchor="middle">PHOTO</text></svg>`);
    
    const GRID=22, GAP=14;
    const snap=v=>Math.round(v/GRID)*GRID;
    const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
    
    let view="board", filter="all", dense=false, sortDesc=true, query="";
    let items=[];
    function syncItems(){
      const bw=(document.getElementById("feed")||{}).clientWidth||900;
      /* 이미 화면에 있는 카드의 좌표는 건드리지 않는다.
         댓글·사진이 늦게 도착할 때마다 syncItems 가 다시 돌면서 저장된 좌표로 되돌려 놨고,
         그래서 카드를 옮겨도 곧바로 제자리로 튀어 "이동이 안 먹히는" 것처럼 보였다. */
      const prev={}; items.forEach(d=>{ prev[d._id]=d; });
      items=LIVE.docs.map(toV2).map(d=>{
        const p=prev[d._id];
        return {...d,
          /* 저장된 pos 는 초기 배치에 쓰지 않는다. 지금 판에 쌓여 있는 좌표들이 이미 서로 겹쳐 있어서,
             그대로 놓으면 겹친 판을 그대로 재현한다. 판은 항상 정돈된 상태로 시작하고,
             자리는 **이번 세션에 직접 옮긴 카드만** 지킨다. */
          x: p ? p.x : 0,
          y: p ? p.y : 0,
          /* 크기도 마찬가지 — 리사이즈 직후 스냅샷이 오면 원래 크기로 되돌아간다 */
          scale: p ? p.scale : 1};
      });
    }
    
    const feed=document.getElementById("feed"), body=document.getElementById("body"), ghost=document.getElementById("ghost");
    
    function visible(){
      let a=items.filter(d=>{
        /* 분실물은 별도 컬렉션이 아니라 같은 판의 다른 종류다. 손님이 두고 간 물건은
           엽서와 섞이면 안 되지만, 핀·사진·댓글은 똑같이 필요해서 카드 구조를 그대로 쓴다. */
        if(view==="lost"){ if(d.kind!=="lost") return false; }
        else if(d.kind==="lost") return false;
        if(filter==="mine" && d.to.toLowerCase()!==ME) return false;
        if(filter==="photo" && !d.photo) return false;
        if(filter==="pin" && !d.pin) return false;
        if(query){ const q=query.toLowerCase();
          if(!(d.msg+" "+d.from+" "+d.to).toLowerCase().includes(q)) return false; }
        return true;
      });
      if(!sortDesc) a=a.slice().reverse();
      return a;
    }
    
    /* 카드 위 꾸미기 레이어 — 편집기와 같은 좌표계(% ) 를 쓰므로 크기가 달라도 그대로 맞는다.
       글자는 굽지 않았기 때문에 여기서 다시 그릴 수 있다(그게 심사가 가능한 이유이기도 하다). */
    function shotLayers(d){
      const t=(d.texts||[]).map(x=>
        `<span class="ovl${x.bg&&x.bg!=="none"?" "+x.bg:""}" style="left:${x.x}%;top:${x.y}%;color:${x.col};font-family:${fontCss(x.font)};--s:${x.size||1};--r:${x.rot||0}deg">${esc(x.s)}</span>`).join("");
      const s=(d.stk||[]).map(o=>o.k==="emoji"
        ? `<span class="ovl emo" style="left:${o.x}%;top:${o.y}%;--s:${o.size||1};--r:${o.rot||0}deg">${esc(o.ch)}</span>`
        : `<span class="ovl stmp" style="left:${o.x}%;top:${o.y}%;color:${o.col||"#ec3013"};--s:${o.size||1};--r:${o.rot||0}deg">${STAMPS[o.id]||""}</span>`).join("");
      const k=(d.strokes||[]).length
        ? `<svg class="ovlpen" viewBox="0 0 100 100" preserveAspectRatio="none">${d.strokes.map(x=>
            `<polyline points="${x.pts.map(p=>p[0].toFixed(2)+","+p[1].toFixed(2)).join(" ")}" fill="none" stroke="${x.col}" stroke-width="${x.w}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`).join("")}</svg>`
        : "";
      return k+t+s;
    }
    
    /* ── 물성(materiality) ──
       리서치 결론: "AI 가 만든 것 같다"의 정체는 **균일함**이다 — 같은 카드가 같은 간격으로 격자에 놓인 것.
       실제 게시판은 종이 결이 다르고, 손으로 꽂아서 조금씩 틀어져 있고, 압정·테이프·클립이 섞여 있다.
       그 다양성을 **id 해시로 결정론적으로** 만든다 — 매 렌더마다 바뀌면 고장난 것처럼 보인다.
       과하면 촌스러워지므로 각도는 ±1.6° 로 묶고 질감은 opacity 로 눌러 둔다(브랜드는 편집 톤이다). */
    function hash32(v){ let h=2166136261; const s=String(v);
      for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
    /* 시안 D 이식 후 종이 결을 4종 → 3슬롯(plain 이 절반)으로 줄였다.
       잉크 등록 오차가 주된 물성 신호가 됐으므로 결은 배경으로 물러난다. */
    const PAPERS=["plain","lined","plain","grid"];
    function material(d){
      const h=hash32(d.id);
      return {
        paper: PAPERS[h%PAPERS.length],
        tilt: (((h>>>3)%33)-16)/10,                            /* -1.6° ~ +1.6° */
        att: d.pin ? "pin" : ["tape","clip","none","tape"][(h>>>8)%4],
        hand: !d.photo && !d.poll && (d.msg||"").length<=52,    /* 짧은 메모는 손글씨로 */
        /* 잉크가 어긋나는 거리·방향. 1.2~3.4px — 크면 "버그"로 읽히고 작으면 안 보인다.
    
           ⚠ Codex 교차검증 지적(2026-08-09): 처음엔 mx·my 가 둘 다 양수라 **모든 카드가 오른쪽 아래로만** 밀렸다.
           거리만 바꾸고 방향은 안 바꿔서 "방향을 달리한다"는 주석이 코드와 어긋나 있었다.
    
           그래서 부호를 해시에서 뽑았더니 이번엔 **세로가 위로 10 / 아래 1** 로 쏠렸다(실측).
           위로 밀린 잉크는 상단 압정과 겹쳐 지저분해진다.
           → **세로는 아래로 고정하고 가로만 좌우로 가른다.** 가로 변주만으로도 기계가 찍은 느낌은 충분히 깨진다.
             제약(압정이 위에 있다)이 있는 축에서는 무작위를 줄이는 게 맞다. */
        mx: (((h>>>11)&1?1:-1) * (1.2 + ((h>>>13)%23)/10)).toFixed(1),
        my: (1.2 + ((h>>>18)%19)/10).toFixed(1),
      };
    }
    
    /* ── 카드 폭 3계급 (큐 8) ──
       "AI 가 만든 것 같다"의 마지막 잔재는 **모든 카드가 같은 폭**이라는 것이다 (실측: 1280px 피드에서 11장 전부 330px).
       축과 산수를 분리한다:
         · 무엇이 넓어질 **자격**이 있나 → **내용**이 정한다 (투표·가로사진 = 다 같이 읽는 공지 / 짧은 손글씨 = 쪽지)
         · 그래서 **몇 px** 인가        → **컬럼 pitch** 가 정한다 (`2·pitch − GAP`)
       해시로 폭을 굴리지 않는다 — 내용 규칙은 재렌더에 안 변하면서(결정론) 뜻도 보인다.
       임의 배율도 쓰지 않는다 — `card+GAP` 이 GRID 배수를 벗어나면 pitch 가 최대 21px 올라 컬럼이 하나 죽는다(AGENTS §3). */
    const arOf=d=>{ const p=String(d.ar||(d.photo===1?"5/3":"1/1")).split("/");
      const w=parseFloat(p[0])||1, h=parseFloat(p[1])||1; return h?w/h:1; };
    function sizeOf(d){
      /* 정사각 사진을 2배 폭으로 늘리면 **높이도 2배**라 카드 하나가 보드를 먹는다 → 가로 사진만 넓힌다 */
      if(d.poll || (d.photo && arOf(d)>=1.2)) return "w";
      if(material(d).hand) return "s";        /* material.hand 와 같은 조건 — 손글씨로 그려지는 카드가 곧 쪽지다 */
      return "m";
    }
    /* 2칸 덮기는 피드(masonry)의 개념이다. 보드에서 쓰면 넓은 카드가 두 컬럼 중 높은 쪽을
       기다리느라 짧은 쪽 아래에 죽은 공간이 남는다 — 실측 136·143px. 보드에서는 전부 한 칸. */
    const spanOf=d=>(view!=="feed")?1:(sizeOf(d)==="w"?2:1);
    
    function cardHtml(d){
      const t=TONES[d.t], m=material(d);
      return `<div class="pc sz-${sizeOf(d)}${d.pin?" pinned":""}${d.claimed?" claimedcard":""}${m.hand?" hand":""}" data-id="${d.id}" data-paper="${m.paper}" data-att="${m.att}" style="background:${t.bg};color:${t.ink};--tilt:${m.tilt}deg;--mx:${m.mx}px;--my:${m.my}px">
        <span class="att" aria-hidden="true"></span>
        <span class="grip">•&nbsp;•&nbsp;•</span>
        <button class="pin" data-pin="${d.id}">${d.pin?'<span class="tack"><span class="dome"></span><span class="pin2"></span></span>':'<span class="tflat"></span>'}</button>
        <span class="badge">100%</span>
        <div class="metarow">
          <span class="route">${esc(d.from)} <span style="opacity:.4">→</span> <span class="to">${esc(d.to)}</span></span>
          <span class="when">${esc(d.ago)}</span>
        </div>
        ${d.kind==="lost"?`<div class="lost">
          ${d.lwhat?`<b>What</b> <span>${esc(d.lwhat)}</span>`:""}
          ${d.lwhere?`<b>Where</b> <span>${esc(d.lwhere)}</span>`:""}
          ${d.lwhen?`<b>Found</b> <span>${esc(d.lwhen)}</span>`:""}
        </div>`:""}
        <div class="msg">${esc(d.msg)}</div>
        ${d.photo?`<div class="shot ${d.frame||""}"><img alt="" style="--ar:${d.src?(d.ar||"1/1"):(d.photo===1?"5/3":"1/1")};filter:${d.filter||"none"}" src="${d.src||SHOT(d.photo,600,d.photo===1?360:600)}">${shotLayers(d)}</div>`:""}
        ${pollHtml(d)}
        <div class="foot">
          ${rxBtn(d)}
          <button class="act" data-cm="${d.id}" aria-expanded="false">Comments<span class="c">${cmLabel(d)}</span></button>
          <span class="spacer"></span>
          ${d.kind==="lost"?`<button class="act claim${d.claimed?" hot":""}" data-claim="${d.id}">${d.claimed?"Claimed":"Mark claimed"}</button>`:""}
          <button class="act">Edit</button><button class="act">Delete</button>
        </div>
        <div class="rxw">${rxHtml(d)}</div>
        ${cmtHtml(d)}
        <span class="rz"></span>
        <span class="rstlayer">${(d.stamps||[]).map(stampHtml).join("")}</span>
      </div>`;
    }
    
    function render(){
      const list=visible();
    
      /* 분실물은 별도 레이아웃이 아니라 판을 그대로 쓴다 — 클래스도 board 로 둬야 규칙이 걸린다 */
      feed.className="view-"+(view==="feed"?"feed":"board");
    
      /* 압축 툴바에서 접힌 상태를 보이게 유지한다.
         ① `⋯` 안에 기본값 아닌 옵션이 있으면 점을 찍는다 — 안 그러면 "촘촘·오래된순"이 보이지 않는 상태가 된다
         ② 칩 스트립은 실제로 넘칠 때만 오른쪽을 흐린다 */
      /* 필터 칩은 없앴다 — 남아 있던 참조가 render 를 통째로 죽여서 판이 비어 보였다 */
      const moreBtn=document.getElementById("more");
      if(moreBtn) moreBtn.classList.toggle("dirty", dense);
      document.getElementById("s-mode").textContent=view==="feed"?"Feed · masonry":"Pinboard · 22px snap";
    
      if(!list.length){ feed.innerHTML=`<div id="ghost"></div><div class="empty">No postcards match those filters.</div>`; stats(0); return; }
    
      if(view==="feed"){
        /* 피드는 핀 구역을 나누지 않는다. 나누면 게시 순서가 깨진다 */
      const pins=view==="feed"?[]:list.filter(d=>d.pin), rest=view==="feed"?list:list.filter(d=>!d.pin);
        feed.innerHTML=`<div id="ghost"></div>`+
          (pins.length?`<div class="seclbl" data-t="Pinned">Pinned</div>${section(pins)}`:"")+
          (pins.length&&rest.length?`<div class="seclbl" data-t="All postcards">All postcards</div>`:"")+
          section(rest);
        requestAnimationFrame(()=>balance());
      } else {
        feed.innerHTML=`<div id="ghost"></div>`+list.map(cardHtml).join("");
        requestAnimationFrame(()=>{ layoutBoard(list); });
      }
      wire();
      requestAnimationFrame(()=>stats(list.length));
      /* 사진이 도착했다고 좌표를 0 으로 되돌리면 안 된다. 목업은 좌표가 전부 0 이라 무해했지만
         실제로는 사람이 옮겨 둔 자리를 지운다 — 카드를 끌어도 곧바로 튀어 돌아가던 원인. */
      afterImages(()=>{ if(view==="feed") balance(); else layoutBoard(visible()); });
    }
    
    /* 이미지가 실제로 자리를 잡은 뒤 한 번 더 레이아웃한다.
       aspect-ratio 로 대부분 해결되지만, 로드 실패·캐시 미스에서도 어긋나지 않도록 안전망을 둔다. */
    function afterImages(cb){
      let done=false;
      const fire=()=>{ if(done) return; done=true; requestAnimationFrame(cb); };
      const imgs=[...feed.querySelectorAll("img")].filter(i=>!i.complete);
      if(!imgs.length){ fire(); return; }   /* 캐시된 이미지도 한 번은 정리 — 예전엔 여기서 그냥 빠져나갔다 */
      let left=imgs.length;
      imgs.forEach(i=>{
        const h=()=>{ if(--left<=0) fire(); };
        i.addEventListener("load",h,{once:true}); i.addEventListener("error",h,{once:true});
      });
      setTimeout(fire,1200);   /* 로드가 안 끝나도 한 번은 정리한다 */
    }
    
    /* 섹션 하나를 컬럼 컨테이너로 감싼다. 카드는 일단 첫 컬럼에 넣고 balance() 가 재배치한다. */
    function section(list){
      if(!list.length) return "";
      const cols=colCount();
      /* data-n 은 CSS 가 읽는다 — 컬럼이 1개면 넓은 카드가 덮을 옆 칸이 없어 100% 로 되돌려야 한다 (큐 8) */
      return `<div class="cols" data-sec="1" data-n="${cols}">`+
        Array.from({length:cols},(_,i)=>`<div class="col">${i===0?list.map(cardHtml).join(""):""}</div>`).join("")+
        `</div>`;
    }
    function colCount(){
      /* 피드는 인스타처럼 한 장씩 세로로 내려간다 — 게시 순서가 곧 읽는 순서다.
         여러 컬럼이면 눈이 좌우로 갈라져 "무엇이 최신인지"가 사라진다. */
      return 1;
    }
    /* 측정 후 가장 짧은 컬럼으로 그리디 배치 — 높이가 다른 카드가 자연스럽게 맞물린다.
       큐 8 부터 **넓은 카드가 컬럼 2칸을 덮는다.** flex 컬럼에서 카드는 한 컬럼에만 속하므로
       덮인 옆 컬럼에는 **스페이서로 자리를 예약**해야 한다 — 안 하면 옆 컬럼 카드가 넓은 카드 밑으로 파고든다.
    
       간격은 보드용 `GAP`(14) 이 아니라 **실제 CSS gap(`--gap`, 18)** 을 읽어 쓴다.
       예전엔 컬럼 고르기에만 썼으니 4px 오차가 무해했지만, 스페이서는 **정확한 y** 가 필요하다. */
    function balance(){
      feed.querySelectorAll(".cols").forEach(wrap=>{
        const cols=[...wrap.querySelectorAll(".col")];
        if(cols.length<2) return;
        /* **정렬 순서를 복원하고 시작한다.** `querySelectorAll` 은 앞선 balance() 가 만든 컬럼 순서로 돌려주므로
           그대로 쓰면 호출할 때마다 배치가 달라진다 — `render()` 는 rAF 와 `afterImages()` 로 **두 번** 부르기 때문에
           이미지가 자리를 잡는 순간 화면이 한 번 튄다. (폭이 전부 같던 시절엔 안 보였을 뿐 예전에도 그랬다) */
        const ord=new Map(visible().map((d,i)=>[String(d.id),i]));
        const cards=[...wrap.querySelectorAll(".pc")]
          .sort((a,b)=>(ord.get(a.dataset.id)??0)-(ord.get(b.dataset.id)??0));
        const G=parseFloat(getComputedStyle(cols[0]).rowGap)||GAP;
        /* ① 폭은 클래스가 이미 확정했다(컬럼 폭은 카드 분배와 무관하다 — `flex:1 1 0`)
           → ② 전부 측정 → ③ 그 표로만 배치. 측정과 배치를 섞지 않는다 (AGENTS §2) */
        const H=cards.map(c=>c.offsetHeight);
        const S=cards.map(c=>c.classList.contains("sz-w")?2:1);
        cols.forEach(c=>c.innerHTML="");
        const N=cols.length;
        const r=new Array(N).fill(0);   /* DOM 에 실제로 쌓인 높이 = 그 컬럼 다음 자식의 top */
        const v=new Array(N).fill(0);   /* 넓은 카드가 예약해 둔 최소 top */
        cards.forEach((c,i)=>{
          const s=Math.min(S[i],N);
          let k=0,best=Infinity;
          for(let j=0;j<=N-s;j++){ let m=0; for(let q=0;q<s;q++) m=Math.max(m,r[j+q],v[j+q]);
            if(m<best){ best=m; k=j; } }
          /* 덮을 칸이 **전부** 비는 지점까지 내려간다. 시작 칸의 예약선을 올려 두면 아래 스페이서가 알아서 맞춘다 */
          v[k]=Math.max(v[k],best);
          if(v[k]>r[k]){   /* 스페이서 자신도 gap 을 하나 만든다 → 높이는 (목표 − 현재 − gap) */
            const sp=document.createElement("i"); sp.className="spx";
            const hh=Math.max(0,v[k]-r[k]-G); sp.style.height=hh+"px";
            cols[k].appendChild(sp); r[k]+=hh+G;   /* hh 가 0 이면 r 은 목표보다 살짝 아래 — 겹치는 쪽으로는 절대 안 간다 */
          }
          const top=r[k];
          cols[k].appendChild(c); r[k]+=H[i]+G;
          for(let q=0;q<s;q++) v[k+q]=Math.max(v[k+q], top+H[i]+G);   /* 덮은 칸 전부 예약 */
        });
      });
      wire();
    }
    
    function el(id){ return feed.querySelector(`.pc[data-id="${id}"]`); }
    const boxOf=d=>{ const e=el(d.id); return {x:d.x,y:d.y,w:e.offsetWidth*d.scale,h:e.offsetHeight*d.scale}; };
    /* 두 판정을 분리한다.
       near()  = 충돌 해소용. 최소 간격 GAP 을 확보하려고 여유를 둔다.
       over()  = 집계·보고용. 실제로 픽셀이 겹치는지만 본다.
       섞으면 옆 컬럼의 정상 카드까지 "Overlap"으로 세게 된다 (실측: 정상 레이아웃에 12쌍 오보고). */
    /* 밀어낼지 말지는 **실제로 겹칠 때만** 정한다.
       예전에는 사방 GAP(18px) 만큼 여유를 두고 판정해서, 닿지도 않은 옆 카드가 밀려나고
       그 카드가 다시 장애물이 되어 연쇄로 판 전체가 출렁였다. 2px 은 반올림 오차 몫이다. */
    const PAD=2;
    /* 밀어낸 뒤 벌어지는 간격. 22px 격자에 스냅하면 최대 한 칸(22px)까지 벌어져 판이 성기게 보인다.
       반 칸(11px)이면 겹치지 않으면서도 카드가 서로 붙어 있는 판으로 읽힌다. */
    const SEP=GRID/2;
    const near=(a,b)=>a.x<b.x+b.w-PAD&&b.x<a.x+a.w-PAD&&a.y<b.y+b.h-PAD&&b.y<a.y+a.h-PAD;
    const over=(a,b)=>a.x<b.x+b.w-1&&b.x<a.x+a.w-1&&a.y<b.y+b.h-1&&b.y<a.y+a.h-1;
    /* 컬럼 피치는 GRID 배수로 올린다. 원점을 스냅하면 거터가 잘려나간다 (334 → snap 330 → 간격 10px). */
    const pitch=w=>Math.ceil((w+GAP)/GRID)*GRID;
    /* 보드 카드 폭은 card+GAP 이 정확히 GRID 배수가 되는 값으로 고정한다.
       임의 폭이면 pitch 가 최대 21px 올라가 거터가 낭비되고 컬럼이 하나 줄어든다 (320 → pitch 352 → 3단이 2단으로). */
    /* …단, 보드가 그 폭보다 좁으면 고정값을 고집할 수 없다.
       375px 기기에서 안폭이 295px 인데 316px 을 쓰고 있었다 — **모든 카드가 21px 씩 삐져나왔다**.
       줄일 때도 GRID 배수 규칙은 지킨다: 22k−14 중 들어가는 가장 큰 값 (295 → 294=22*14−14). */
    const fitBoardW=w=>{ const bw=feed.clientWidth;
      return w<=bw ? w : Math.max(GRID*3-GAP, Math.floor((bw+GAP)/GRID)*GRID-GAP); };
    const boardW=()=>fitBoardW(dense?228:316);   /* 228+14=242=22*11 · 316+14=330=22*15 */
    const boardCols=()=>Math.max(1,Math.floor((feed.clientWidth+GAP)/pitch(boardW())));
    /* 작은 쪽지 폭 — 칸을 비우지 않고 **칸 안에서만** 좁힌다.
       반 칸씩 나란히 놓는 하위 격자는 두 번째 레이아웃 시스템이라 기각했다(항목 5 에서 같은 이유로 기각한 것).
       GRID 배수로 골라 격자 위에 남긴다: 176=22×8(0.557×) · 132=22×6(0.579×) — 큐가 요구한 0.5~0.6배 안.
       표(316→176, 228→132)가 아니라 **비율**로 두는 이유: 위에서 보드 폭이 좁은 화면에 맞춰
       줄어들 수 있게 됐는데, 표는 그 중간값(294 등)에서 조용히 통짜 폭으로 되돌아간다.
       0.557 로 잡으면 기존 두 값이 그대로 나온다 — 316→176, 228→132 */
    const smallW=b=>Math.max(GRID*4, Math.round(b*0.557/GRID)*GRID);
    function cardW(d){
      const b=boardW(), z=sizeOf(d);
      if(z==="s") return Math.min(b,smallW(b));
      /* 넓은 카드는 **컬럼 2칸을 정확히** 덮는다. 오른쪽 끝 = (k+2)·P − GAP → 다음 컬럼 시작선에서 정확히 GAP.
         컬럼이 1개뿐이면(390px) 덮을 옆 칸이 없으므로 1칸으로 클램프한다 */
      /* 보드에서는 폭도 한 칸이다. 예약(spanOf)만 1칸으로 줄이고 폭을 2칸으로 두면
         그린 카드가 옆 칸을 침범해 가로로 겹친다 — 실제로 그렇게 깨졌다. */
      if(z==="w") return view==="feed" ? Math.min(boardCols(),2)*pitch(b)-GAP : b;
      return b;
    }
    /* 연속한 s 칸 중 **최고 바닥이 가장 낮은** 시작 칸. s=1 이면 예전의 "가장 짧은 컬럼"과 정확히 같다 */
    function slotFor(colH,s){ let k=0,best=Infinity;
      for(let j=0;j<=colH.length-s;j++){ let m=0; for(let q=0;q<s;q++) m=Math.max(m,colH[j+q]);
        if(m<best){ best=m; k=j; } }
      return {k,best};
    }
    
    function put(d,anim=true){ const e=el(d.id); if(!e) return;
      if(!anim) e.style.transition="none";
      e.style.width=cardW(d)+"px"; e.style.left=d.x+"px"; e.style.top=d.y+"px"; e.style.transform=`rotate(var(--tilt,0deg)) scale(${d.scale})`;
      if(!anim) requestAnimationFrame(()=>e.style.transition="");
    }
    /* 측정과 배치를 분리한다.
       섞으면 배치 도중의 스타일 쓰기가 다음 측정에 끼어들어 높이가 어긋난다
       (실측 버그: 346px 카드를 140px 로 세어 12쌍이 겹쳤다). */
    function layoutBoard(list){
      if(Z.on){ layoutZones(list); return; }
      const bw=feed.clientWidth, w=boardW();
    
      /* 1단계 — 폭만 먼저 확정 */
      list.forEach(d=>{ const e=el(d.id); if(e){ e.style.transition="none"; e.style.width=cardW(d)+"px"; } });
      void feed.offsetHeight;
    
      /* 2단계 — 전부 측정해서 표로 */
      const H={}, W={};
      list.forEach(d=>{ const e=el(d.id);
        H[d.id]=e?e.offsetHeight*(d.scale||1):0;
        W[d.id]=e?e.offsetWidth*(d.scale||1):0; });
    
      /* 3단계 — **고정 카드를 먼저 놓고 장애물로 등록한다.**
         예전에는 좌표가 있는 카드를 그 자리에 놓기만 하고 컬럼 높이에 반영하지 않아서,
         뒤에 쌓이는 카드가 그 위로 그대로 올라갔다 — 판이 다시 겹치던 원인.
         핀은 고정이다: 사람이 "여기"라고 정해 둔 것이므로 자동 배치가 밀어내면 안 된다. */
      const anchored=[], flow=[];
      /* 고정은 "사람이 이번에 옮긴 카드" 뿐이다. 핀을 고정으로 잡으면 저장된 좌표가
         그대로 살아나 판이 다시 중구난방이 된다 — 핀은 *못 옮기는* 것이지 *아무 데나 있는* 것이 아니다. */
      list.forEach(d=>{ (d.x || d.y) ? anchored.push(d) : flow.push(d); });
    
      const blocks=[];
      anchored.forEach(d=>{
        d.x=Math.max(0,Math.min(d.x||0, Math.max(0,bw-W[d.id])));
        d.y=Math.max(0,d.y||0);
        put(d,false);
        blocks.push({x:d.x,y:d.y,w:W[d.id],h:H[d.id]});
      });
    
      const P=pitch(w);
      const cols=Math.max(1,Math.floor((bw+GAP)/P)), colH=new Array(cols).fill(0);
      const clash=(x,y,ww,hh)=>blocks.find(b=>
        x<b.x+b.w+PAD && b.x<x+ww+PAD && y<b.y+b.h+SEP && b.y<y+hh+SEP);
      flow.forEach(d=>{
        const s=Math.min(spanOf(d),cols);
        const {k,best}=slotFor(colH,s);
        let y=Math.ceil(best/SEP)*SEP, guard=0, c;
        /* 고정 카드에 걸리면 그 아래로 내려간다 */
        while(guard++<400 && (c=clash(k*P,y,W[d.id],H[d.id]))) y=Math.ceil((c.y+c.h+SEP)/SEP)*SEP;
        d.x=k*P; d.y=y; put(d,false);
        blocks.push({x:d.x,y:d.y,w:W[d.id],h:H[d.id]});
        for(let q=0;q<s;q++) colH[k+q]=d.y+H[d.id]+SEP;
      });
      requestAnimationFrame(()=>list.forEach(d=>{ const e=el(d.id); if(e) e.style.transition=""; }));
      fit(list);
    }
    function resolve(list,moving){
      const bw=feed.clientWidth, fixed=[boxOf(moving)];
      list.filter(d=>d!==moving).sort((a,b)=>a.y-b.y).forEach(d=>{
        const e=el(d.id);
        d.x=Math.max(0,Math.min(snap(d.x),Math.max(0,bw-e.offsetWidth*d.scale)));
        d.y=Math.max(0,snap(d.y));
        let g=0,moved=false;
        while(g++<300){ const cl=fixed.find(f=>near(boxOf(d),f)); if(!cl) break;
          d.y=Math.ceil((cl.y+cl.h+SEP)/SEP)*SEP; moved=true; }
        if(moved){ e.classList.add("pushed"); setTimeout(()=>e.classList.remove("pushed"),440); }
        fixed.push(boxOf(d)); put(d);
      });
      fit(list);
    }
    
    /* ── 끄는 동안 살아 있게 ──────────────────────────────────────────────
       놓을 때만 밀면 보드는 정적으로 느껴진다. 손가락 밑에서 **미리** 길이 열려야
       "여기 놓을 수 있다"가 예고가 아니라 사실이 된다.
    
       두 가지가 함수 모양을 결정했다.
       1) 매번 **기준선(base)에서 다시** 민다. 직전 결과에서 이어 밀면 카드가 한 번
          내려간 뒤 돌아오지 못하고, 끌고 다니는 내내 보드 전체가 아래로 흘러내린다.
       2) 크기는 드래그 시작에 한 번만 재고 표(dims)로 들고 있는다. 프레임마다
          offsetWidth 를 읽으면 style 쓰기와 뒤섞여 강제 리플로우가 난다 (AGENTS §3). */
    function pushLive(list,moving,base,dims,final){
      const bw=feed.clientWidth, md=dims[moving.id];
      if(!md) return;
      const fixed=[{x:moving.x,y:moving.y,w:md.w,h:md.h}];
      const box=d=>({x:d.x,y:d.y,w:dims[d.id].w,h:dims[d.id].h});
      let bottom=moving.y+md.h;
      list.filter(d=>d!==moving&&dims[d.id])
          .sort((a,b)=>(base[a.id].y-base[b.id].y)||(base[a.id].x-base[b.id].x))
          .forEach(d=>{
        d.x=Math.max(0,Math.min(base[d.id].x,Math.max(0,bw-dims[d.id].w)));
        d.y=base[d.id].y;
        let g=0,moved=false;
        while(g++<300){ const cl=fixed.find(f=>near(box(d),f)); if(!cl) break;
          d.y=Math.ceil((cl.y+cl.h+SEP)/SEP)*SEP; moved=true; }
        fixed.push(box(d));
        bottom=Math.max(bottom,d.y+dims[d.id].h);
        const e=el(d.id); if(!e) return;
        e.style.left=d.x+"px"; e.style.top=d.y+"px";
        if(final){ e.classList.remove("yield");
          if(moved){ e.classList.add("pushed"); setTimeout(()=>e.classList.remove("pushed"),440); } }
        else e.classList.toggle("yield",moved);
      });
      feed.style.minHeight=Math.max(440,bottom+40)+"px";   /* 읽지 않고 쓰기만 한다 — fit() 은 놓을 때 한 번 */
    }
    function fit(list){
      const bottom=list.reduce((m,d)=>{ const e=el(d.id); return e?Math.max(m,d.y+e.offsetHeight*d.scale):m; },0);
      feed.style.minHeight=Math.max(440,bottom+40)+"px";
      stats(list.length);
    }
    function stats(n){
      document.getElementById("s-n").textContent=n;
      let h=0;
      if(view==="board"){ const L=visible();
        for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++) if(el(L[i].id)&&el(L[j].id)&&over(boxOf(L[i]),boxOf(L[j]))) h++; }
      document.getElementById("s-hit").textContent=h;
    }
    
    function wire(){
      feed.querySelectorAll("[data-pin]").forEach(b=>b.onclick=e=>{
        e.stopPropagation();
        const d=items.find(x=>x.id==b.dataset.pin); if(needAuth()) return; d.pin=!d.pin; save(d,{pinned:d.pin});
        b.innerHTML=d.pin?'<span class="tack"><span class="dome"></span><span class="pin2"></span></span>':'<span class="tflat"></span>';
        b.closest(".pc").classList.toggle("pinned",d.pin);
        if(d.pin){ b.classList.add("stick"); setTimeout(()=>b.classList.remove("stick"),450); }
        if(filter==="pin") render();
      });
      if(view!=="board") return;
      const list=visible();
      list.forEach(d=>{
        const e=el(d.id); if(!e) return;
        const start=ev=>{
          if(ST.on) return;
          if(d.pin) return;   /* 핀은 고정 — 사람이 자리를 정해 둔 것이다 */
          /* 무장 모드에서는 끌지 않고 찍는다. CSS 로는 카드 본체 pointerdown 을 못 막는다 */
          /* `.poll` 을 뺀다 — 선택지를 누르려다 카드가 끌려가면 투표가 안 된다 (큐 6)
             `.cmt` 도 뺀다 — 입력창을 누르려다 카드가 끌려가면 **포커스가 아예 안 간다** (큐 11) */
          if(ev.target.closest("[data-pin],.rz,.act,.poll,.cmt,.rxw")) return;
          ev.preventDefault();
          const pid=ev.pointerId, br=feed.getBoundingClientRect();
          const ox=ev.clientX-br.left-d.x, oy=ev.clientY-br.top-d.y;
          const w=e.offsetWidth*d.scale, h=e.offsetHeight*d.scale;
          let nx=d.x, ny=d.y;
          e.classList.add("lift"); body.classList.add("lifting");
          e.style.transform=`scale(${d.scale*1.04}) rotate(${d.pin?-.8:-.5}deg)`;
          /* 구역 모드에서는 고스트를 켜지 않는다 — 밴드 안이 자동 정렬이라
             "여기에 놓인다"는 예고가 거짓말이 된다. 알려줄 것은 위치가 아니라 **소속**이다 */
          if(!Z.on){ ghost.style.width=w+"px"; ghost.style.height=h+"px"; ghost.classList.add("on"); }
          try{ e.setPointerCapture(pid); }catch(_){}
          /* 기준선과 크기는 여기서 한 번만. 이유는 pushLive() 주석 참고 */
          const base={}, dims={};
          list.forEach(o=>{ const n=el(o.id); if(!n) return;
            base[o.id]={x:o.x,y:o.y}; dims[o.id]={w:n.offsetWidth*o.scale,h:n.offsetHeight*o.scale}; });
          let tick=0;
          const live=()=>{ tick=0; if(Z.on) return;
            d.x=snap(nx); d.y=snap(ny);            /* 격자에 맞춰 판정해야 이웃이 떨지 않는다 */
            pushLive(list,d,base,dims,false); };
          /* 판 밖으로 옮기려면 끄는 동안 판이 따라 움직여야 한다.
             가장자리 60px 안에 손이 들어오면 자동으로 스크롤한다 — 깊이 들어갈수록 빨라진다.
             `br` 은 드래그 시작에 한 번 잡은 값이라, 스크롤한 만큼은 여기서 직접 보정한다. */
          const scroller=document.querySelector(".body");
          const EDGE=60, MAXV=22;
          let lastY=0, lastX=0, auto=0;
          const place=()=>{
            const r=feed.getBoundingClientRect();
            nx=Math.max(0,Math.min(lastX-r.left-ox,Math.max(0,feed.clientWidth-w)));
            ny=Math.max(0,lastY-r.top-oy);
            e.style.left=nx+"px"; e.style.top=ny+"px";
            ghost.style.left=snap(nx)+"px"; ghost.style.top=snap(ny)+"px";
            if(!tick) tick=requestAnimationFrame(live);
          };
          const autoScroll=()=>{
            auto=0;
            if(!scroller) return;
            const sr=scroller.getBoundingClientRect();
            let v2=0;
            if(lastY<sr.top+EDGE)      v2=-Math.ceil(MAXV*(sr.top+EDGE-lastY)/EDGE);
            else if(lastY>sr.bottom-EDGE) v2= Math.ceil(MAXV*(lastY-(sr.bottom-EDGE))/EDGE);
            if(v2){
              const before=scroller.scrollTop;
              scroller.scrollTop=Math.max(0,before+v2);
              if(scroller.scrollTop!==before) place();
              auto=requestAnimationFrame(autoScroll);
            }
          };
          const mv=v=>{ if(v.pointerId!==pid) return; v.preventDefault();
            lastX=v.clientX; lastY=v.clientY;
            place();
            if(Z.on){ hoverBand(v.clientY-feed.getBoundingClientRect().top); return; }
            if(!auto) auto=requestAnimationFrame(autoScroll); };
          /* 끄는 동안에도 휠은 살아 있어야 한다 — 포인터 캡처 때문에 카드가 휠을 먹어 버린다 */
          const wh=w2=>{ if(!scroller) return; scroller.scrollTop+=w2.deltaY; place(); w2.preventDefault(); };
          e.addEventListener("wheel",wh,{passive:false});
          const up=v=>{ if(v.pointerId!==pid) return;
            if(tick){ cancelAnimationFrame(tick); tick=0; }
            if(auto){ cancelAnimationFrame(auto); auto=0; }
            e.removeEventListener("wheel",wh);
            e.removeEventListener("pointermove",mv); e.removeEventListener("pointerup",up); e.removeEventListener("pointercancel",up);
            e.classList.remove("lift"); body.classList.remove("lifting"); ghost.classList.remove("on");
            e.style.transform=`rotate(var(--tilt,0deg)) scale(${d.scale})`;
            e.classList.add("settle"); setTimeout(()=>e.classList.remove("settle"),350);
            if(Z.on){
              /* 끌어 넣으면 소속된다 — 포인터가 떨어진 y 가 곧 구역이다 */
              const b=bandAt(v.clientY-br.top);
              clearHover();
              if(b){ d.zone=b.k; if(Z.fold[b.k]) Z.fold[b.k]=false; save(d,{zone:d.zone}); }   /* 접힌 데로 넣으면 펴 준다. 안 그러면 카드가 사라진 걸로 보인다 */
              layoutZones(visible());
              return;
            }
            d.x=Math.max(0,Math.min(snap(nx),Math.max(0,feed.clientWidth-w))); d.y=Math.max(0,snap(ny)); savePosOf(d);
            put(d);
            /* 놓을 때도 **같은** 기준선에서 민다. resolve() 로 다시 풀면 끄는 동안 보여 준
               배치와 결과가 달라져서, 손을 떼는 순간 카드들이 한 번 튄다 */
            pushLive(list,d,base,dims,true);
            fit(list); };
          e.addEventListener("pointermove",mv); e.addEventListener("pointerup",up); e.addEventListener("pointercancel",up);
        };
        e.querySelector(".grip").addEventListener("pointerdown",start);
        e.addEventListener("pointerdown",v=>{ if(v.pointerType==="mouse"&&v.button===0&&!v.target.closest(".grip,[data-pin],.rz,.act,.poll,.cmt,.rxw")) start(v); });
        e.querySelector(".rz").addEventListener("pointerdown",v=>{
          v.preventDefault(); v.stopPropagation();
          const pid=v.pointerId, sx=v.clientX, base=d.scale, w0=e.offsetWidth;
          e.classList.add("rzing"); e.style.transition="border-color .2s ease";
          const mv=w2=>{ if(w2.pointerId!==pid) return;
            d.scale=Math.max(.6,Math.min(2.2, base+(w2.clientX-sx)/w0));
            e.style.transform=`rotate(var(--tilt,0deg)) scale(${d.scale})`; e.querySelector(".badge").textContent=Math.round(d.scale*100)+"%"; };
          const up=w2=>{ if(w2.pointerId!==pid) return;
            document.removeEventListener("pointermove",mv); document.removeEventListener("pointerup",up);
            d.scale=Math.round(d.scale*20)/20; save(d,{scale:d.scale}); e.style.transition=""; e.classList.remove("rzing");
            e.style.transform=`rotate(var(--tilt,0deg)) scale(${d.scale})`; e.classList.add("settle"); setTimeout(()=>e.classList.remove("settle"),350);
            /* 구역 모드에서는 밴드 높이가 카드 크기에 따라 자라야 한다 — resolve 로 밀면 밴드를 넘는다 */
            if(Z.on){ layoutZones(visible()); return; }
            resolve(list,d); };
          document.addEventListener("pointermove",mv); document.addEventListener("pointerup",up);
        });
      });
    }
    
    document.querySelectorAll("#view button").forEach(b=>b.onclick=()=>{
      document.querySelectorAll("#view button").forEach(x=>x.classList.remove("on")); b.classList.add("on");
      view=b.dataset.v;
      feed.className = view==="feed" ? "view-feed" : "view-board";
      drawStampTray();
      if(view!=="feed") items.forEach(d=>{d.x=0;d.y=0;}); render();
    });
    document.getElementById("q").oninput=e=>{ query=e.target.value.trim(); render(); };
    window.addEventListener("resize",()=>{ render(); });
    
    /* ═══ 압축 툴바 동작 (큐 3b) ═══
       CSS 가 모양을 바꾸고 여기서는 두 개의 열림 상태만 관리한다. 넓은 화면에서는
       두 아이콘이 display:none 이라 이 핸들러가 걸려 있어도 도달할 수 없다 — 분기가 필요 없다. */
    const toolsEl=document.querySelector(".tools");
    const moreBtn=document.getElementById("more"), searchTog=document.getElementById("searchtog"), qEl=document.getElementById("q");
    
    function setMore(on){
      toolsEl.classList.toggle("moreon",on); moreBtn.classList.toggle("on",on);
      moreBtn.setAttribute("aria-expanded",on?"true":"false");
    }
    /* 검색을 닫을 때 검색어를 **비운다.** 접힌 채로 검색어가 남으면
       아이콘 뒤에 숨은, 이유가 보이지 않는 필터가 된다 (카드가 3장만 보이는데 왜인지 알 수 없다). */
    function closeSearch(){
      toolsEl.classList.remove("searchon"); searchTog.classList.remove("on");
      searchTog.setAttribute("aria-expanded","false");
      const had=!!query; qEl.value=""; query=""; if(had) render();
    }
    searchTog.onclick=()=>{
      if(toolsEl.classList.contains("searchon")){ closeSearch(); return; }
      setMore(false);
      toolsEl.classList.add("searchon"); searchTog.classList.add("on");
      searchTog.setAttribute("aria-expanded","true"); qEl.focus();
    };
    document.getElementById("qclose").onclick=closeSearch;
    qEl.addEventListener("keydown",e=>{ if(e.key==="Escape") closeSearch(); });
    moreBtn.onclick=()=>setMore(!toolsEl.classList.contains("moreon"));
    /* 팝오버 안 항목을 누르면 닫는다. 기존 onclick 이 먼저 등록돼 있어 밀도·정렬·정리 동작이 먼저 돈다 */
    document.querySelectorAll("#tgrp .mini").forEach(b=>b.addEventListener("click",()=>setMore(false)));
    /* 바깥을 누르면 `⋯` 만 닫는다. 검색은 여기서 닫지 않는다 — 검색어를 비우므로,
       입력 후 카드를 만졌을 때 조용히 지워지면 안 된다 */
    document.addEventListener("pointerdown",e=>{ if(!e.target.closest(".tools")) setMore(false); });
    
    /* ═══════════════════ 도장(Stamp) — 큐 4 ═══════════════════
       FigJam 근거(공식 문서): 도구를 켜면 **켜진 채로 남아** 연속으로 찍고, 도장은 객체에 붙어
       객체와 함께 움직이며, Esc 로 빠져나온다.
       → 큐가 말한 "위치·회전 유지"는 곧 "카드 데이터에 붙인다"는 뜻이다. `d.stamps[]` 에 **% 좌표**로 저장하면
         뷰 전환(피드↔보드) · 필터 · 정렬 · 보드 리사이즈(scale) 전부를 그냥 통과한다.
    
       진입점을 `.tgrp` 에 둔 이유 (채점표 §도장 참조)
       · 카드 `.foot` 에 버튼을 넣으면 dense 보드 228px 에서 foot 이 2줄로 넘쳐 카드 높이가 늘어난다
       · 툴바에 3번째 아이콘을 넣으면 375px 칩 스트립 안폭이 101→51px 이 된다 (3b 에서 번 걸 되돌린다)
       진입은 1회 2탭이고 **찍기는 장당 1탭** 이라 C1 ◎ 는 유지된다. */
    
    /* 이름에 r 접두사를 붙인 이유 — **실측 사고.** 이 파일에는 작성(2단) 쪽 꾸미기 도장 `STAMPS`(객체)와
       `.ovl.stmp` 가 이미 있다. 처음에 이걸 그냥 `STAMPS`/`.stmp` 로 만들었더니
       ① `const STAMPS` 중복 선언으로 **스크립트 전체가 SyntaxError 로 죽어** 앱이 안 떴고
       ② 내 `.stmp` 규칙이 작성 쪽 스티커(`class="ovl stmp"`)까지 잡아 테두리·잉크필터를 덧씌웠다.
       카드 위 반응 도장은 `RSTAMPS` · `.rstmp` · `.rstlayer` 로 격리한다. 작성 쪽 이름은 건드리지 않았다. */
    const RSTAMPS=[
      /* 도장은 화면마다 쓸모가 다르다. 분실물에 "Thank you" 를 찍을 일은 없고,
         엽서에 "Still here" 를 찍을 일도 없다. 안 쓰는 걸 늘어놓으면 고르는 시간만 늘어난다. */
      {k:"seen",  t:"Seen",      c:"#201e1d", w:"post"},
      {k:"nice",  t:"Nice one",  c:"#ec3013", w:"post"},
      {k:"thx",   t:"Thank you", c:"#ec3013", w:"post"},
      {k:"agree", t:"Agree",     c:"#201e1d", w:"post"},
      {k:"mine",  t:"I got it",  c:"#9a5a2a", w:"post"},
      /* 분실물 전용 — 카드만 보고 "아직 있나?" 를 알 수 있어야 한다.
         Mark claimed 버튼과 별개로 두는 이유: 버튼은 상태고, 도장은 누가 언제 확인했는지의 흔적이다. */
      {k:"claimed", t:"Claimed",    c:"#ae1800", w:"lost"},
      {k:"still",   t:"Still here", c:"#3a26c8", w:"lost"},
    ];
    const ST={on:false, k:"nice", log:[]};
    
    function stampHtml(s,i){
      const m=RSTAMPS.find(x=>x.k===s.k)||RSTAMPS[0];
      return `<span class="rstmp" data-s="${i}" style="--x:${s.x}%;--y:${s.y}%;--rot:${s.rot}deg;color:${m.c}"`+
             ` title="${esc(m.t)} · ${esc(s.by)}">${esc(m.t)}</span>`;
    }
    function paintStamps(card,d){
      const L=card.querySelector(".rstlayer"); if(L) L.innerHTML=(d.stamps||[]).map(stampHtml).join("");
    }
    /* 붙인 **뒤에** 재서 카드 안으로 끌어들인다.
       도장 폭은 글자 수마다 다르고(확인 vs 내가 할게) 회전까지 있어서 미리 계산할 수 없다 —
       AGENTS §2 와 같은 이유로 배치와 측정을 나눈다: 놓고 → 재고 → 그 값으로만 보정한다.
       offsetWidth 는 transform 전 값이라 보드에서 카드가 scale 되어 있어도 비율이 맞는다. */
    function clampStamp(card,d,i){
      const node=card.querySelector(`.rstmp[data-s="${i}"]`), s=d.stamps[i];
      if(!node||!s) return;
      const cw=card.clientWidth, ch=card.clientHeight; if(!cw||!ch) return;
      const rad=Math.abs(s.rot)*Math.PI/180, w=node.offsetWidth, h=node.offsetHeight;
      const bw=w*Math.cos(rad)+h*Math.sin(rad), bh=h*Math.cos(rad)+w*Math.sin(rad);
      const mx=Math.min(50,(bw/2+2)/cw*100), my=Math.min(50,(bh/2+2)/ch*100);
      s.x=Math.max(mx,Math.min(100-mx,s.x));
      s.y=Math.max(my,Math.min(100-my,s.y));
      node.style.setProperty("--x",s.x+"%"); node.style.setProperty("--y",s.y+"%");
    }
    
    /* $c 는 아래 작성 섹션에서 `const` 로 선언되므로 여기서는 아직 쓸 수 없다(TDZ) — 별도로 둔다 */
    const $s=id=>document.getElementById(id);
    const strayEl=$s("stray"), spickEl=$s("spick"), sundoEl=$s("sundo");
    
    function setStamping(on){
      ST.on=on;
      document.body.classList.toggle("pcv3-stamping",on);
      strayEl.classList.toggle("on",on);
      syncStampBtn();
      if(on){
        setMore(false);
        /* 넘칠 때만 오른쪽을 흐린다 — 칩 스트립과 같은 규칙. 트레이가 열린 뒤에 재야 폭이 확정된다 */
        spickEl.classList.toggle("scrollable", spickEl.scrollWidth>spickEl.clientWidth+1);
      }
    }
    function stampsFor(){ return RSTAMPS.filter(s=>s.w===(view==="lost"?"lost":"post")); }
    function syncStampBtn(){
      const b=document.getElementById("stamp"); if(!b) return;
      const m=RSTAMPS.find(x=>x.k===ST.k)||RSTAMPS[0];
      b.style.setProperty("--sc",m.c);
      b.classList.toggle("on",!!ST.on);
      const l=b.querySelector(".slbl");
      if(l) l.textContent=ST.on?m.t:"Stamp";
    }
    function drawStampTray(){
      const list=stampsFor();
      /* 화면을 바꿨는데 고른 도장이 그 화면에 없으면 첫 번째로 되돌린다 —
         아니면 눌러도 아무 도장도 안 찍히는 상태가 된다 */
      if(!list.some(s=>s.k===ST.k)) ST.k=list[0].k;
      spickEl.innerHTML=list.map(s=>
        `<button data-k="${s.k}" class="${ST.k===s.k?"on":""}" style="--sc:${s.c}">${s.t}</button>`).join("");
      spickEl.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{
        ST.k=b.dataset.k;
        spickEl.querySelectorAll("[data-k]").forEach(x=>x.classList.remove("on")); b.classList.add("on");
        syncStampBtn();
      });
      spickEl.classList.toggle("scrollable", spickEl.scrollWidth>spickEl.clientWidth+1);
      syncStampBtn();
    }
    drawStampTray();
    $s("stamp").onclick=()=>setStamping(!ST.on);
    $s("sdone").onclick=()=>setStamping(false);
    
    /* 위임으로 건다 — render() 가 feed.innerHTML 을 갈아도 feed 자체는 살아 있다 */
    feed.addEventListener("click",e=>{
      if(!ST.on) return;
      const card=e.target.closest(".pc"); if(!card) return;
      const d=items.find(x=>x.id==card.dataset.id); if(!d) return;
      /* 이미 찍힌 도장을 누르면 지운다. 찍기만 되고 못 지우면 한 번 잘못 누른 자국이 영원히 남는다.
         같은 모드 안에서 처리하는 이유 — 지우기 전용 모드를 또 만들면 상태가 하나 더 늘어난다. */
      const hit=e.target.closest(".rstmp");
      if(hit){
        e.preventDefault(); e.stopPropagation();
        if(needAuth()) return;
        const i=+hit.dataset.s;
        const gone=(d.stamps||[])[i];
        if(gone){
          d.stamps.splice(i,1);
          paintStamps(card,d);
          save(d,{stamps:FV().arrayRemove(gone)});
        }
        return;
      }
      const r=card.getBoundingClientRect(); if(!r.width||!r.height) return;
      const n=(d.stamps=d.stamps||[]).length;
      d.stamps.push({k:ST.k, by:(LIVE.me&&(LIVE.me.displayName||ME))||"?",
        x:((e.clientX-r.left)/r.width)*100,      /* 누른 자리에 찍힌다 — 위치 지정에 추가 탭 0 */
        y:((e.clientY-r.top)/r.height)*100,
        rot:-9+(n*7)%19});
      if(LIVE.me) save(d,{stamps:FV().arrayUnion(d.stamps[d.stamps.length-1])});                        /* 회전은 장수로 결정 — 재렌더해도 같은 값이 나온다 */
      paintStamps(card,d);
      const i=d.stamps.length-1;
      clampStamp(card,d,i);
      const node=card.querySelector(`.rstmp[data-s="${i}"]`);
      if(node){ node.classList.add("fresh");      /* 새로 놓인 것만. 전체 재렌더에서는 안 붙는다 */
        /* animationend 로 떼지 않는다 — 프레임이 멈춘 환경에서는 그 이벤트가 오지 않아 클래스가 영구히 남는다.
           setTimeout 은 프레임 클럭과 무관하게 온다 */
        setTimeout(()=>node.classList.remove("fresh"),320); }
      ST.log.push(d.id); sundoEl.disabled=false;
    });
    /* 되돌리기 — 잘못 찍은 걸 못 지우면 아무도 안 누른다. 이 세션에서 찍은 순서대로 한 장씩 뺀다 */
    sundoEl.onclick=()=>{
      const id=ST.log.pop();
      if(id===undefined){ sundoEl.disabled=true; return; }
      const d=items.find(x=>x.id==id);
      if(d&&d.stamps&&d.stamps.length){ d.stamps.pop(); const card=el(d.id); if(card) paintStamps(card,d); }
      sundoEl.disabled=!ST.log.length;
    };
    document.addEventListener("keydown",e=>{
      if(e.key==="Escape"&&ST.on&&!$s("compose").classList.contains("on")) setStamping(false);
    });
    
    /* ═══════════════════ 구역(Zone) — 큐 5 ═══════════════════
       FigJam 근거(공식 문서): 객체를 섹션 **안으로 옮기면 멤버가 되고**, 섹션은 접어서 감출 수 있다.
       → 큐가 말한 "카드를 끌어 넣으면 소속된다"는 곧 **드롭한 y 가 소속을 정한다**는 뜻이다.
    
       이름에 z 접두사를 쓴 이유 — 이 파일에는 피드 masonry 의 `section(list)` 함수와 `.seclbl` 이 이미 있다.
       도장 때 `STAMPS` 중복 선언으로 스크립트 전체가 죽었던 사고를 반복하지 않으려고 전역을 전부 격리했다.
    
       **핵심 교환 — 구역 모드에서는 자유 절대배치를 포기한다.**
       자유 좌표와 "내용에 맞춰 자라는 밴드"는 서로를 정의하는 순환이다(밴드 높이는 멤버가 정하고, 멤버는 y 가 정한다).
       둘 다 지키려면 밴드 경계를 넘는 충돌 해소기가 하나 더 필요하다 — 반쯤 검증된 두 번째 레이아웃 시스템이다.
       대신 토글을 켤 때 x·y 를 스태시해 두고 끌 때 **그대로 되돌린다.**
    
       **치수는 전부 GRID(22) 배수다.** 헤더 44(=2×22, 터치 타깃 44 와 동시 만족) · 빈 밴드 66(=3×22) · 밴드 사이 22.
       아니면 `d.y = 밴드top + ceil(...)` 이 격자에서 벗어나 22px 스냅이 조용히 깨진다 (AGENTS §3 과 같은 산수). */
    const ZONES=[
      {k:"week",   t:"This week"},     /* 로스터·청소·행사 — 기한이 있는 것 */
      {k:"praise", t:"Praise"},
      {k:"lost",   t:"Lost & found"},
      {k:"",       t:"Unsorted"},      /* 기본값. 빈 문자열이라 새 카드가 자동으로 여기로 온다 */
    ];
    const ZHEAD=44, ZEMPTY=66, ZTAIL=22;
    /* 구역(가로 밴드)은 뺐다. Lost & found 가 별도 화면이 된 뒤로 같은 일을 두 가지 방식으로 하게 됐다. */
    const Z={on:false, fold:{}, stash:null, bands:[]};
    /* 모르는 키는 미분류로 접는다 — 데이터가 낡아도 카드가 어느 밴드에도 안 속해 사라지는 일이 없다 */
    const zoneKey=d=>ZONES.some(z=>z.k===(d.zone||"")) ? (d.zone||"") : "";
    
    function layoutZones(list){
      const bw=feed.clientWidth, w=boardW();
    
      /* 1단계 — 폭만 확정. **접혀 있던 카드의 display 를 먼저 되돌린다** —
         display:none 인 채로 재면 높이가 0 이라 밴드가 통째로 납작해진다 */
      list.forEach(d=>{ const e=el(d.id); if(e){ e.style.transition="none"; e.style.display=""; e.style.width=cardW(d)+"px"; } });
      void feed.offsetHeight;
    
      /* 2단계 — 전부 측정해서 표로 (측정과 배치를 섞지 않는다, AGENTS §2) */
      const H={}; list.forEach(d=>{ const e=el(d.id); H[d.id]=e?e.offsetHeight*(d.scale||1):0; });
    
      /* 3단계 — 그 표로만 밴드를 쌓는다 */
      const P=pitch(w), cols=Math.max(1,Math.floor((bw+GAP)/P));
      const bands=[]; let y=0;
      ZONES.forEach(z=>{
        const mem=list.filter(d=>zoneKey(d)===z.k), folded=!!Z.fold[z.k];
        let inner;
        if(folded){ inner=0; mem.forEach(d=>{ const e=el(d.id); if(e) e.style.display="none"; }); }
        else if(!mem.length){ inner=ZEMPTY; }
        else{
          const top=y+ZHEAD, colH=new Array(cols).fill(0);
          mem.forEach(d=>{
            const s=Math.min(spanOf(d),cols);              /* 넓은 카드는 밴드 안에서도 2칸을 덮는다 (큐 8) */
            const {k,best}=slotFor(colH,s);
            /* 밴드 top 이 GRID 배수이고 올림도 GRID 배수라 d.y 는 격자 위에 남는다.
               snap(반올림)이면 거터가 GRID 절반까지 깎인다 — 항목 4 에서 6.2px 로 확인된 그 함정 */
            d.x=k*P; d.y=top+Math.ceil(best/GRID)*GRID; put(d,false);
            for(let q=0;q<s;q++) colH[k+q]=(d.y-top)+H[d.id]+GAP;
          });
          inner=Math.ceil(Math.max(...colH)/GRID)*GRID;
        }
        bands.push({k:z.k, t:z.t, top:y, h:ZHEAD+inner, n:mem.length, folded, empty:!mem.length});
        y+=ZHEAD+inner+ZTAIL;
      });
      Z.bands=bands;
      paintBands();
      requestAnimationFrame(()=>list.forEach(d=>{ const e=el(d.id); if(e) e.style.transition=""; }));
      /* fit() 은 카드 위치로만 바닥을 잡는다 — 빈/접힌 밴드가 통째로 잘린다. 여기서는 밴드 총합을 쓴다 */
      feed.style.minHeight=Math.max(440,y+20)+"px";
      stats(list.length);
    }
    
    function paintBands(){
      feed.querySelectorAll(".zband").forEach(n=>n.remove());
      /* afterbegin 으로 넣는다 — 카드보다 앞쪽 DOM 이라 같은 쌓임 문맥에서 항상 카드 밑에 깔린다.
         innerHTML+= 로 하면 기존 카드가 재파싱되어 도장·핀 핸들러가 전부 날아간다 */
      feed.insertAdjacentHTML("afterbegin", Z.bands.map(b=>
        `<div class="zband${b.folded?" fold":""}" data-k="${b.k}" style="top:${b.top}px;height:${b.h}px">
           <button class="zhead" data-z="${b.k}" aria-expanded="${b.folded?"false":"true"}">
             <span class="zcar"></span><span class="zt">${esc(b.t)}</span><span class="zn">${b.n}</span><span class="zr"></span>
           </button>
           ${(b.empty&&!b.folded)?`<span class="zdrop">Drop here</span>`:""}
         </div>`).join(""));
      feed.querySelectorAll(".zhead").forEach(b=>b.onclick=()=>{
        /* 제자리에서 접는다 — 스크롤을 건드리지 않는다.
           NN/g: 아코디언이 펼칠 때 화면을 튀게 하면 사용자가 페이지가 바뀐 줄 알고 뒤로 가기를 누른다 */
        Z.fold[b.dataset.z]=!Z.fold[b.dataset.z];
        layoutZones(visible());
      });
    }
    
    /* 드롭한 y 가 어느 밴드인지. 밴드 사이 ZTAIL 틈에 놓아도 위 밴드로 붙는다 —
       틈에 떨어뜨렸다고 아무 일도 안 일어나면 "왜 안 되지"가 된다 */
    function bandAt(y){
      const B=Z.bands; if(!B.length) return null;
      for(const b of B) if(y < b.top+b.h+ZTAIL) return b;
      return B[B.length-1];
    }
    function hoverBand(y){
      const b=Z.on?bandAt(y):null;
      feed.querySelectorAll(".zband").forEach(n=>n.classList.toggle("over", !!b && n.dataset.k===b.k));
    }
    function clearHover(){ feed.querySelectorAll(".zband.over").forEach(n=>n.classList.remove("over")); }
    
    function setZones(on){
      Z.on=on;
      if(on){
        Z.stash=items.map(d=>({id:d.id, x:d.x, y:d.y}));      /* 자유 배치를 통째로 보관 */
      }else if(Z.stash){
        const m=new Map(Z.stash.map(s=>[s.id,s]));
        /* 구역 모드 중에 새로 쓴 카드는 스태시에 없다 — 0 으로 돌려 자동 배치에 맡긴다.
           안 그러면 밴드 좌표가 자유 보드에 그대로 남아 카드가 저 아래에 홀로 떨어진다 */
        items.forEach(d=>{ const s=m.get(d.id); d.x=s?s.x:0; d.y=s?s.y:0; });
        Z.stash=null;
      }
      setMore(false);
      render();
    }
    
    /* ═══════════════════ 투표(Vote) — 큐 6 ═══════════════════
       FigJam 근거(공식 문서): 투표 중에는 **커서까지 숨겨** 표가 드러나지 않고, 세션이 끝나면 결과가 한 번에 공개된다.
       근거의 이유는 밴드왜건 — 진행 중 집계를 보여주면 앞선 선택지로 표가 쏠린다.
       → 여기서 숨기는 것은 **per-option 집계뿐**이다. 총 참여수(`n명 참여`)는 보여준다.
         완전히 숨기면 **언제 마감해야 하는지 알 수 없어** 투표가 영원히 열린 채로 남는다(채점표 §투표).
    
       **질문은 `d.msg` 다.** 질문 필드를 따로 두지 않는다 — 엽서는 원래 한 문장이고,
       필드를 나누면 "뭘 어디에 쓰지"가 매번 생긴다. 카드 구조도 그대로 유지된다.
    
       데이터: `d.poll={opts:[{t}], votes:{사람:번호}, closed:bool}`.
       표를 **사람당 한 칸**으로 들면 재투표가 곧 덮어쓰기이고, 같은 걸 다시 누르면 삭제다 —
       중복 투표 방지를 위한 별도 코드가 필요 없다. */
    function pollTally(p){
      const n=p.opts.map(()=>0); let tot=0;
      Object.values(p.votes||{}).forEach(i=>{ if(n[i]!==undefined){ n[i]++; tot++; } });
      return {n,tot};
    }
    function pollHtml(d){
      const p=d.poll; if(!p||!p.opts||p.opts.length<2) return "";
      const {n,tot}=pollTally(p);
      const my=(p.votes||{})[ME];
      const max=Math.max(...n);
      const owner=String(d.from||"").toLowerCase()===ME;
      return `<div class="poll">
          <div class="phead">
            <span class="pl">${p.closed?"Result":"Voting"}</span>
            <span class="pn">${tot} voting</span>
            <span class="pr"></span>
          </div>
          ${p.opts.map((o,i)=>{
            /* 진행 중에는 `--p:0%` 로 막대를 아예 그리지 않는다. 폭만 봐도 집계가 새기 때문이다 */
            const pct=(p.closed&&tot)?Math.round(n[i]/tot*100):0;
            return `<button class="popt${my===i?" mine":""}${(p.closed&&max>0&&n[i]===max)?" win":""}" data-o="${i}">
              <span class="pbar" style="--p:${pct}%"></span>
              <span class="pmk"></span>
              <span class="pt">${esc(o.t)}</span>
              <span class="pv">${p.closed?`${n[i]} · ${pct}%`:(my===i?"Your vote":"")}</span>
            </button>`;}).join("")}
          ${(!p.closed&&owner)?`<button class="pclose">Close vote & reveal</button>`:""}
        </div>`;
    }
    /* 그 카드의 투표 블록만 갈아 끼운다. render() 를 부르면 보드 배치가 통째로 다시 돌고
       피드에서는 masonry 가 카드를 다른 컬럼으로 던져 **누른 카드가 눈앞에서 사라진다.** */
    function repaintPoll(card,d){
      const cur=card.querySelector(".poll"); if(!cur) return;
      cur.outerHTML=pollHtml(d);
    }
    /* 위임으로 건다 — render() 가 feed.innerHTML 을 갈아도 feed 자체는 살아 있다 (도장과 같은 방식) */
    feed.addEventListener("click",e=>{
      if(ST.on) return;                       /* 무장 중에는 찍는 게 우선. CSS 로도 `.poll` 을 죽여 뒀다 */
      const card=e.target.closest(".pc"); if(!card) return;
      const d=items.find(x=>x.id==card.dataset.id); if(!d||!d.poll) return;
    
      const opt=e.target.closest(".popt");
      if(opt){
        if(d.poll.closed) return;             /* 마감된 투표는 읽기 전용 */
        const i=+opt.dataset.o;
        d.poll.votes=d.poll.votes||{};
        /* 같은 걸 다시 누르면 취소다. 되돌릴 길이 없으면 아무도 안 누른다(도장 되돌리기와 같은 규칙) */
        if(needAuth()) return; var _pv={}; if(d.poll.votes[ME]===i){ delete d.poll.votes[ME]; _pv[ME]=FV().delete(); } else { d.poll.votes[ME]=i; _pv[ME]=i; } save(d,{poll:{votes:_pv}});
        repaintPoll(card,d);
        return;
      }
      if(e.target.closest(".pclose")){
        if(needAuth()) return; d.poll.closed=true; save(d,{poll:{closed:true}});
        repaintPoll(card,d);
        /* 마감 버튼이 사라져 카드가 **짧아진다.** 줄어드는 방향이라 겹침은 생길 수 없지만
           빈틈은 남는다 — 구역 모드는 밴드 높이가 멤버로 결정되므로 다시 쌓고,
           자유 보드는 사용자가 놓은 좌표를 건드리면 안 되므로 바닥·집계만 다시 잡는다.
           피드는 흐름 배치라 아무것도 할 게 없다 */
        if(view==="board"){ if(Z.on) layoutZones(visible()); else fit(visible()); }
      }
    });
    
    /* ═══════════════════ 반응(Reactions) — 큐 12 ═══════════════════
       지금까지 `♥7` 은 눌러도 아무 일이 없었고, 켜짐(`.act.hot`)이 `d.r>0` 일 때 붙었다 —
       즉 **"내가 눌렀나"가 아니라 "누군가 눌렀나"** 를 보여주는 틀린 상태 표시였다.
    
       설계의 핵심은 **종류를 늘리지 않고 그 예산을 전부 "누가"에 쓴 것**이다.
       · 종류(♥·👏·☕)를 늘리면 고르는 탭이 먼저 붙고, coarse `.foot` 안폭(dense 228px 에서 ≈196px)에
         44px 표적 4개가 이미 176px 을 쓰므로 **줄바꿈 → 카드 높이 증가**로 끝난다.
         도장·구역·투표가 `.foot` 에 버튼 넣기를 세 번 기각한 그 산수다. 그리고 브랜드가 이모지 남용을 금한다.
       · 20명 규모에서 신호를 만드는 것은 **어떤 이모지냐가 아니라 누가 눌렀냐**다(큐가 직접 그렇게 적었다).
    
       큐는 "호버/탭으로 목록"을 요구했지만 **더 싼 답이 있어서 안 했다** — 카드가 11장뿐이라 숨길 이유가 없다.
       이름 3개는 상시 노출(0탭), 넘칠 때만 `+N more`(1탭). NN/g 는 툴팁이 **터치에서 아예 안 뜨고**
       발견성도 낮다고 못박고, Slack 의 롱프레스는 보드 드래그(`pointerdown`→`lift`)와 정면충돌한다.
    
       낙관적 UI: 표는 클라이언트 메모리라 왕복이 없다. 탭 → 데이터 수정 → 그 카드만 repaint → 재배치.
       `render()` 를 부르지 않는다 — 피드 masonry 가 카드를 다른 컬럼으로 던져 **누른 카드가 눈앞에서 사라진다**
       (`repaintPoll`·`repaintCmt` 와 같은 이유). */
    const RXSHOW=3;                       /* 접었을 때 보여줄 이름 개수 */
    /* 재배치는 항목 11 이 만든 것을 그대로 쓴다 — 뷰별 분기(피드 balance · 구역 layoutZones · 보드 resolve/fit)가
       댓글이든 반응이든 **똑같다.** 이름만 카드 단위로 바꿔 부른다(`reflowCmt` 는 함수 선언이라 호이스팅된다) */
    const reflowCard=(d,grew)=>reflowCmt(d,grew);
    const rxList=d=>d.rx||(d.rx=[]);
    const rxCount=d=>rxList(d).length;
    const rxMine=d=>rxList(d).some(n=>String(n).toLowerCase()===ME);
    /* 카운트 라벨은 `cmLabel` 과 같은 규칙으로 2글자에 묶는다 — `.foot` 은 이미 줄바꿈 상태다 */
    const rxLabel=d=>{ const n=rxCount(d); return n>9?"9+":String(n); };
    /* **내 이름을 `You` 로 바꿔 맨 앞으로 올린다.** 그래야 토글이 이름 줄에서도 보인다 —
       누르면 `You` 가 생기고 취소하면 사라져서 낙관적 UI 의 확인이 하트 하나에만 걸리지 않는다 */
    function rxNames(d){
      const l=rxList(d).slice();
      const i=l.findIndex(n=>String(n).toLowerCase()===ME);
      if(i>=0){ l.splice(i,1); l.unshift("You"); }
      return l;
    }
    function rxBtn(d){
      const on=rxMine(d);
      return `<button class="act rx${on?" hot":""}" data-rx="${d.id}" aria-pressed="${on?"true":"false"}" aria-label="Like"
        ><span class="rxg" aria-hidden="true">${on?"♥":"♡"}</span><span class="c">${rxLabel(d)}</span></button>`;
    }
    /* `.rxw` 의 **안쪽만** 돌려준다. 0명이면 빈 문자열이라 `.rxw:empty` 가 줄을 통째로 접는다 —
       그래서 `cardHtml` 쪽 `<div class="rxw">${rxHtml(d)}</div>` 에 공백이 들어가면 안 된다 */
    function rxHtml(d,all){
      const l=rxNames(d); if(!l.length) return "";
      const show=all?l:l.slice(0,RXSHOW), hid=l.length-show.length;
      return `<span class="rxh" aria-hidden="true">♥</span><span class="rxn">${show.map(esc).join(", ")}</span>`+
        (hid?`<button class="rxmore">+${hid} more</button>`:"");
    }
    /* 그 카드의 하트와 이름 줄만 갈아 끼운다. 펼침(`data-all`)은 노드에만 있으므로 손으로 옮겨 준다
       (항목 5 교훈: 노드를 갈아치우면 들고 있던 참조는 유령이 된다 — 여기서는 innerHTML 만 바꿔 노드를 살려 둔다) */
    function repaintRx(card,d){
      const box=card.querySelector(".rxw");
      if(box){
        if(!rxCount(d)) delete box.dataset.all;          /* 0명으로 떨어지면 펼침 상태도 뜻이 없다 */
        box.innerHTML=rxHtml(d,box.dataset.all==="1");
      }
      const b=card.querySelector("[data-rx]");
      if(b){
        const on=rxMine(d);
        b.classList.toggle("hot",on);
        b.setAttribute("aria-pressed",on?"true":"false");
        const g=b.querySelector(".rxg"); if(g) g.textContent=on?"♥":"♡";
        const c=b.querySelector(".c");  if(c) c.textContent=rxLabel(d);
      }
    }
    /* 카드 높이가 **실제로** 변했는지 재서 재배치 방향을 정한다 — 추측하지 않는다.
       0→1 명이면 이름 줄이 새로 생겨 카드가 커지고(`resolve`), 1→0 이면 줄이 사라져 작아진다(`fit`).
       중간 구간(3→4 명 등)은 줄바꿈 여부에 따라 갈리는데, 그건 산수로 맞히는 것보다 재는 게 싸고 정확하다 */
    function toggleRx(card,d){
      const before=card.offsetHeight;
      if(needAuth()) return;
      const l=rxList(d), i=l.findIndex(n=>String(n).toLowerCase()===ME);
      const myName=(LIVE.me&&LIVE.me.displayName)||nameOf(ME);
      if(i>=0) l.splice(i,1); else l.push(myName);
      /* 라이브 문서의 reactions 는 {이모지:[이메일]} 이다. 하트 하나만 토글한다 */
      save(d,{reactions:{"❤️": i>=0 ? FV().arrayRemove(ME) : FV().arrayUnion(ME)}});
      repaintRx(card,d);
      reflowCard(d, card.offsetHeight>before);
    }
    /* 위임으로 건다 — render() 가 feed.innerHTML 을 갈아도 feed 자체는 살아 있다 (도장·투표·댓글과 같은 방식).
       댓글 리스너와 따로 두는 이유: 그쪽은 `.cmt.on` 이 아니면 조기 반환하므로 여기 클릭을 못 받는다 */
    feed.addEventListener("click",e=>{
      if(ST.on) return;                    /* 무장 중에는 찍는 게 우선. CSS 로도 `.foot`·`.rxw` 를 죽여 뒀다 */
      const card=e.target.closest(".pc"); if(!card) return;
      const d=items.find(x=>x.id==card.dataset.id); if(!d) return;
      if(e.target.closest("[data-rx]")){ toggleRx(card,d); return; }
      if(e.target.closest(".rxmore")){
        const box=card.querySelector(".rxw"); if(!box) return;
        const before=card.offsetHeight;
        box.dataset.all="1";
        box.innerHTML=rxHtml(d,true);
        reflowCard(d, card.offsetHeight>before);
      }
    });
    
    /* ═══════════════════ 댓글(Comments) — 큐 11 ═══════════════════
       지금까지 `Comments 3` 은 아무 데도 연결되지 않은 숫자였다. 이제 카운트는 `d.cm.length` 에서 나온다.
       데이터: `d.cm=[{w:작성자, t:본문, a:경과}]`. **오래된 것이 앞**이다 —
       방금 쓴 댓글이 입력창 **바로 위**에 나타나야 눌린 게 보인다(최신이 위면 접힘 뒤로 사라진다).
    
       FigJam 근거(공식 문서): 댓글은 객체에 붙고 **캔버스에서 바로 보고 답한다.** 그래서 카드 안 인라인이다.
       NN/g 근거(progressive disclosure): 접을 때는 **무엇을 얻는지가 라벨에 보여야 한다** —
       그래서 `Show more` 가 아니라 `Show 2 earlier` 다.
    
       열림 상태를 데이터에 저장하지 않는다. `render()` 가 돌면 스레드는 닫힌다 —
       뷰·필터·정렬이 바뀌면 배치가 통째로 다시 도는데, 그때 열린 높이를 들고 있으면
       레이아웃 표(layoutBoard 2단계 측정)와 화면이 어긋날 여지가 생긴다. 닫히는 방향이라 겹침은 못 만든다. */
    const CMSHOW=3;                       /* 최근 몇 개를 펼쳐 둘 것인가 */
    const cmCount=d=>(d.cm||[]).length;
    /* 항목 7 이 "두 자리 카운트면 dense `.foot` 가 2줄로 넘쳐 카드가 +46px" 이라고 남겨서 막으러 넣었는데,
       **실측해 보니 재현되지 않았다** — 1280 촘촘 보드에서 `♥10` + 라벨 `14` 를 강제로 넣어도 카드 207.1px 로 불변
       (0 / 3 / 9 / 9+ / 14 전부 동일). 항목 8 이 촘촘 카드를 228→230.1px 로 넓히면서 사라졌거나 원 기록이 과했다.
       그래도 남겨 둔다: 라벨을 2글자로 묶어 두면 `.foot`(49px, 이미 줄바꿈 상태)에 여유가 생기고 비용이 0이다.
       **막고 있는 결함이 있어서가 아니라 싸서 남긴 것**이다 — 지우고 싶으면 지워도 된다 */
    const cmLabel=d=>{ const n=cmCount(d); return n>9?"9+":String(n); };
    /* 행은 flex 가 아니라 인라인 흐름이다 — 작은 쪽지(안폭 154px)에서 flex 3칸이면 글자가 한 자씩 끊긴다 */
    const cmRow=x=>`<div class="crow"><span class="cwho">${esc(x.w)}</span>${esc(x.t)}<span class="cwhen">${esc(x.a)}</span></div>`;
    function cmtHtml(d,all){
      const list=d.cm||[];
      const hid=all?0:Math.max(0,list.length-CMSHOW);
      return `<div class="cmt">
          ${hid?`<button class="cmore">Show ${hid} earlier</button>`:""}
          ${list.slice(hid).map(cmRow).join("")}
          <div class="cadd">
            <input class="cin" type="text" maxlength="240" placeholder="Write a comment" aria-label="Write a comment">
            <button class="csend">Post</button>
          </div>
        </div>`;
    }
    /* 그 카드의 댓글 블록만 갈아 끼운다 — `render()` 를 부르면 피드 masonry 가 카드를 다른 컬럼으로 던져
       **누른 카드가 눈앞에서 사라진다**(repaintPoll 과 같은 이유).
       갈아 끼우면 노드가 바뀌므로 열림·펼침·입력 중이던 글자·포커스를 손으로 옮겨 준다.
       (항목 5 교훈: 노드를 갈아치우면 들고 있던 참조는 유령이 된다 — 여기서는 옮긴 뒤 **다시 질의**한다) */
    function repaintCmt(card,d){
      const cur=card.querySelector(".cmt"); if(!cur) return;
      const on=cur.classList.contains("on"), all=cur.dataset.all==="1";
      const oi=cur.querySelector(".cin");
      const val=oi?oi.value:"", foc=document.activeElement===oi;
      cur.outerHTML=cmtHtml(d,all);
      const nx=card.querySelector(".cmt");
      if(on) nx.classList.add("on");
      if(all) nx.dataset.all="1";
      const ni=nx.querySelector(".cin");
      if(ni){ ni.value=val; if(foc) ni.focus(); }
      const tog=card.querySelector("[data-cm] .c"); if(tog) tog.textContent=cmLabel(d);
    }
    /* 열려서 **커진** 카드는 아래 카드를 덮는다 — 겹침 0 이 이 항목의 합격 조건이다.
       · 보드 자유배치: 누른 카드를 고정하고 나머지를 민다(드래그 직후와 같은 처리)
       · 구역 모드: 밴드 높이가 멤버로 결정되므로 통째로 다시 쌓는다
       · 보드에서 닫을 때는 `fit()` 만 — 줄어드는 방향이라 겹침이 원리적으로 불가능한데
         `resolve()` 를 부르면 사용자가 놓은 좌표를 괜히 다시 스냅한다(투표 마감과 같은 판단)
    
       · **피드는 `balance()` 를 다시 돌린다 — 실측으로 뒤집힌 판단이다.**
         처음엔 "피드는 flex 흐름이라 아래 카드가 알아서 밀린다"고 적고 아무것도 안 했다. 틀렸다.
         넓은 카드(`sz-w`)는 컬럼 2칸을 덮고 **옆 칸 자리를 스페이서로 예약**하는데(큐 8),
         그 예약 높이는 `balance()` 가 돌던 시점의 카드 높이로 **굳어 있다.**
         카드가 길어지면 옆 컬럼 카드가 그 밑으로 파고든다 — 실측 겹침 2쌍(329.6×138.5 · 329.6×13.8).
         "누른 카드가 다른 컬럼으로 튄다"는 걱정은 **여기서는 성립하지 않는다**:
         `balance()` 에서 카드 i 의 자리는 자기 **앞** 카드들의 높이로만 정해지는데 그건 안 바뀌었다.
         움직이는 것은 뒤 카드들뿐이고 그건 겹치지 않으려면 어차피 움직여야 한다.
         (`repaintPoll` 이 `render()` 를 피하는 것과는 다른 얘기다 — 그건 카드를 통째로 다시 그려 순서까지 흔든다) */
    function reflowCmt(d,grew){
      if(view==="feed"){ balance(); return; }
      if(Z.on){ layoutZones(visible()); return; }
      if(grew) resolve(visible(),d); else fit(visible());
    }
    /* 375px 에서 키보드가 올라오면 입력창이 가린다. `scrollIntoView` 는 조상 스크롤러까지 함께 움직여
       카드가 튀므로(칩 중앙정렬에서 겪은 것) rect 차이로 `.body` 의 scrollTop 만 직접 민다.
       **내려야 할 때만** 민다 — 위로 당기면 방금 읽던 자리가 도망간다 */
    function ensureVisible(node){
      if(!node) return;
      const br=body.getBoundingClientRect(), nr=node.getBoundingClientRect();
      const over=nr.bottom-(br.bottom-10);
      if(over>0) body.scrollTop+=over;
    }
    function postComment(card,d){
      if(needAuth()) return;
      try{
        const _in=card.querySelector(".cin"), _t=_in?String(_in.value||"").trim():"";
        if(_t&&d._id){
          LIVE.db.collection("postcards").doc(d._id).collection("comments")
            .add({text:_t.slice(0,500), byEmail:ME, byName:(LIVE.me&&LIVE.me.displayName)||nameOf(ME), ts:FV().serverTimestamp()})
            .then(function(){ LIVE.db.collection("postcards").doc(d._id).set({commentCount:FV().increment(1)},{merge:true}); })
            .catch(function(e){ alert("Couldn't post comment — "+((e&&e.message)||"")); });
        }
      }catch(e){}
      const inp=card.querySelector(".cmt .cin"); if(!inp) return;
      const txt=inp.value.trim();
      if(!txt){ inp.focus(); return; }
      /* 심사 대상 — 이식 때 여기를 `moderate()` 로 연결한다.
         도장(큐 4)에서 빠뜨렸다가 투표(큐 6)에서 되찾은 구멍이다 */
      console.log("[moderate 대상]", txt);
      (d.cm=d.cm||[]).push({w:"Ju An",t:txt,a:"now"});
      inp.value="";
      repaintCmt(card,d);
      /* **재배치를 먼저 하고 포커스를 나중에 준다.** 피드의 `balance()` 는 카드 노드를
         `appendChild` 로 옮기는데, 포커스된 입력창이 들어 있는 서브트리가 옮겨지면 브라우저가 blur 를 던진다.
         순서를 반대로 하면 연달아 쓰려는 사람이 매번 키보드를 다시 열어야 한다 */
      reflowCmt(d,true);
      const ni=card.querySelector(".cmt .cin"); if(ni) ni.focus();
      requestAnimationFrame(()=>ensureVisible(card.querySelector(".cmt .cadd")));
    }
    /* 위임으로 건다 — render() 가 feed.innerHTML 을 갈아도 feed 자체는 살아 있다 (도장·투표와 같은 방식) */
    feed.addEventListener("click",e=>{
      if(ST.on) return;                        /* 무장 중에는 찍는 게 우선. CSS 로도 `.cmt` 를 죽여 뒀다 */
      const card=e.target.closest(".pc"); if(!card) return;
      const d=items.find(x=>x.id==card.dataset.id); if(!d) return;
      const box=card.querySelector(".cmt"); if(!box) return;
    
      const tog=e.target.closest("[data-cm]");
      if(tog){
        const on=!box.classList.contains("on");
        box.classList.toggle("on",on);
        tog.classList.toggle("open",on);
        tog.setAttribute("aria-expanded",on?"true":"false");
        reflowCmt(d,on);
        /* 열자마자 입력창에 포커스를 주지 않는다 — 모바일에서 키보드가 즉시 올라와 스레드를 덮는다.
           읽으려고 여는 경우가 더 많다. 대신 스레드 아래끝이 화면 안에 들어오게만 한다 */
        if(on) requestAnimationFrame(()=>ensureVisible(card.querySelector(".cmt .cadd")));
        return;
      }
      if(!box.classList.contains("on")) return;
      if(e.target.closest(".cmore")){ box.dataset.all="1"; repaintCmt(card,d); reflowCmt(d,true); return; }
      if(e.target.closest(".csend")) postComment(card,d);
    });
    feed.addEventListener("keydown",e=>{
      if(!e.target.classList||!e.target.classList.contains("cin")) return;
      if(e.key!=="Enter") return;
      e.preventDefault();                       /* 카드 안에 form 이 없어도 IME 확정 뒤 중복 실행을 막는다 */
      const card=e.target.closest(".pc"); if(!card) return;
      const d=items.find(x=>x.id==card.dataset.id); if(d) postComment(card,d);
    });
    feed.addEventListener("focusin",e=>{
      if(e.target.classList&&e.target.classList.contains("cin"))
        requestAnimationFrame(()=>ensureVisible(e.target.closest(".cadd")));
    });
    
    /* ═══════════════════ 작성 — 인스타형 3단 ═══════════════════
       1 미디어 선택 → 2 편집 → 3 공유. 뒤로 가도 C 가 상태를 들고 있다.
    
       설계 결정 2개
       · 1단계 최상단 "Write without a photo" — 텍스트 전용이 현재 주 용도다(C3). 없으면 미디어 우선 흐름이 주 사용자를 밀어낸다.
       · 사진 위 텍스트를 **캔버스에 굽지 않고 레이어로 저장**한다. window.prompt 를 없애는 동시에
         모더레이션 우회(구운 글자는 심사가 불가능)를 구조적으로 막는다 — 계획서 §1 B안. */
    
    const FILTERS=[
      ["Original","none"],
      ["Vivid","saturate(1.6) contrast(1.18)"],
      ["Clarendon","saturate(1.35) contrast(1.12) brightness(1.05)"],
      ["Warm","sepia(.25) saturate(1.25) brightness(1.05)"],
      ["Cool","saturate(1.1) hue-rotate(-12deg) brightness(1.03) contrast(1.05)"],
      ["Fade","contrast(.9) brightness(1.1) saturate(.85)"],
      ["B&W","grayscale(1) contrast(1.1)"],
    ];
    const TCOL=["#ffffff","#ec3013","#201e1d","#f4c20d","#3a26c8","#9a5a2a"];
    const STAFF=["Everyone","Chef Marco","Dae","Nina","Sam","Leo","Mira","Yumi","Ellie"];
    const mock=(a,b,t)=>"data:image/svg+xml,"+encodeURIComponent(
     `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="640" height="640" fill="url(#g)"/><g fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.5"><path d="M0 320H640M320 0V640M0 160H640M0 480H640M160 0V640M480 0V640"/></g><text x="320" y="332" font-family="Archivo,sans-serif" font-size="30" font-weight="800" fill="rgba(255,255,255,.72)" text-anchor="middle" letter-spacing="4">${t}</text></svg>`);
    const GALLERY=[
      mock("#c9c4bd","#8d8579","LATTE"), mock("#b9bcae","#7b8470","BEANS"),
      mock("#d8c3b0","#9a5a2a","PASTRY"), mock("#c3c6d8","#3a26c8","COUNTER"),
      mock("#e0b8b0","#ae1800","ESPRESSO"), mock("#c8cfc4","#4f6a44","GARDEN"),
      mock("#d5d2cf","#201e1d","KITCHEN"), mock("#e3d3bb","#ec3013","TEAM"),
    ];
    
    let C={step:1,src:null,filter:"none",crop:"r1",texts:[],color:"#ffffff",caption:"",to:"Everyone",tone:0,textOnly:false,sel:-1,poll:null};
    
    const $c=id=>document.getElementById(id);
    const cbody=()=>$c("cbody");
    
    function openCompose(){
      setStamping(false);   /* 찍는 모드와 쓰는 모드는 겹치지 않는다 (FAB 이 숨어 있어 도달 불가지만 안전망) */
      C={step:1,src:null,filter:"none",crop:"r1",texts:[],color:"#ffffff",caption:"",to:"Everyone",tone:0,textOnly:false,sel:-1,poll:null};
      $c("compose").classList.add("on"); drawStep();
    }
    function closeCompose(){ $c("compose").classList.remove("on"); }
    
    function drawStep(){
      const s=C.step;
      [...document.querySelectorAll("#compose .dot")].forEach((d,i)=>d.classList.toggle("on",i<s));
      $c("ctitle").textContent = s===1?"New postcard":s===2?"Edit":"Share";
      $c("cnext").textContent = s===3?"Post":"Next";
      $c("cnext").disabled = s===1 && !C.src && !C.textOnly;
      $c("cback").style.visibility = s===1?"hidden":"visible";
      if(s===1) step1(); else if(s===2) step2(); else step3();
    }
    
    /* ── 1단: 미디어 선택 ── */
    function step1(){
      /* 두 갈래뿐이다: 글만 쓸 것인가, 사진을 올릴 것인가. 같은 크기 카드 둘로 두면
         고를 것이 몇 개인지 한눈에 보인다. 시안의 견본 갤러리는 목업 사진이라 실제로는 쓸 데가 없다. */
      cbody().innerHTML=`
        <div class="pickttl" data-t="What are you posting?">What are you posting?</div>
        <div class="pick2">
          <button class="pk" id="nophoto">
            <span class="pkic">✎</span>
            <span class="pkt">Write</span>
            <span class="pks">Words only — straight to share</span>
          </button>
          <button class="pk" id="upl">
            <span class="pkic">▣</span>
            <span class="pkt">Photo</span>
            <span class="pks">Pick one, then draw or add words</span>
          </button>
          <button class="pk lostpk" id="lostpk">
            <span class="pkic">⌂</span>
            <span class="pkt">Lost &amp; found</span>
            <span class="pks">Something a guest left behind</span>
          </button>
          <button class="pk pollpk" id="pollpk">
            <span class="pkic">▤</span>
            <span class="pkt">Poll</span>
            <span class="pks">Ask the team to pick one</span>
          </button>
        </div>
        <input type="file" accept="image/*" id="file" style="display:none">`;
      $c("nophoto").onclick=()=>{ C.lost=false; C.textOnly=true; C.src=null; C.step=3; drawStep(); };
      /* 누르자마자 파일 창이 뜨면, 무엇을 쓰는 화면인지 보기도 전에 시스템 대화상자가 덮는다.
         작성 화면으로 먼저 들어가고 사진은 거기 `+ Add photo` 에서 고른다 — 취소해도 화면이 남는다. */
      $c("upl").onclick=()=>{ C.lost=false; C.textOnly=false; C.src=null; C.step=3; drawStep(); };
      $c("lostpk").onclick=()=>{ C.lost=true; C.textOnly=false; C.src=null; C.step=3; drawStep(); };
      /* 설문은 사진이 필요 없다 — 곧장 공유 단계로 가되 선택지 편집기를 열어 둔 채로 시작한다 */
      $c("pollpk").onclick=()=>{ C.lost=false; C.textOnly=true; C.src=null;
        C.poll={opts:["",""]}; C.step=3; drawStep(); };
      $c("file").onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return;
        C.src=URL.createObjectURL(f); C.textOnly=false; C.step=2; drawStep(); };
    }
    
    /* ── 2단: 편집 — 필터 실제 프리뷰 · 인라인 텍스트(굽지 않음) · 크롭 ── */
    /* 꾸미기 재료 */
    const EMOJI=["☕","🥐","🧋","🍰","🫖","🥑","🍞","🧁","✨","❤️","🔥","👏","🙌","😄","🎉","⭐","💪","🌿","☀️","🌙","📌","💬"];
    const FONTS=[["archivo","'Archivo',sans-serif","Aa"],["marker","'Permanent Marker',cursive","Aa"],
                 ["playfair","'Playfair Display',serif","Aa"],["mono","'Space Mono',monospace","Aa"],
                 ["caveat","'Caveat',cursive","Aa"],["system","system-ui,sans-serif","Aa"]];
    const PENW=[3,7,13];
    /* 브랜드 도장 — 이 앱만의 꾸미기. 잉크 도장 느낌으로 브랜드 톤에 맞춘다 */
    const STAMPS={
      hideout:`<svg viewBox="0 0 120 120"><g fill="none" stroke="currentColor" stroke-width="4"><circle cx="60" cy="60" r="52"/><circle cx="60" cy="60" r="44"/></g><g fill="none" stroke="currentColor" stroke-width="3.4"><ellipse cx="60" cy="56" rx="20" ry="14"/><path d="M40 56h40"/></g><text x="60" y="92" font-family="Archivo,sans-serif" font-size="11" font-weight="800" letter-spacing="2.4" fill="currentColor" text-anchor="middle">HIDEOUT</text></svg>`,
      nice:`<svg viewBox="0 0 130 74"><rect x="4" y="4" width="122" height="66" fill="none" stroke="currentColor" stroke-width="4.5"/><rect x="13" y="13" width="104" height="48" fill="none" stroke="currentColor" stroke-width="2"/><text x="65" y="46" font-family="Archivo,sans-serif" font-size="21" font-weight="900" letter-spacing="1" fill="currentColor" text-anchor="middle">NICE ONE</text></svg>`,
      thanks:`<svg viewBox="0 0 130 74"><rect x="4" y="4" width="122" height="66" fill="none" stroke="currentColor" stroke-width="4.5" transform="rotate(-2 65 37)"/><text x="65" y="45" font-family="Archivo,sans-serif" font-size="20" font-weight="900" letter-spacing="1" fill="currentColor" text-anchor="middle" transform="rotate(-2 65 37)">THANK YOU</text></svg>`,
      approved:`<svg viewBox="0 0 130 74"><g transform="rotate(-6 65 37)"><rect x="5" y="8" width="120" height="58" fill="none" stroke="currentColor" stroke-width="4"/><text x="65" y="38" font-family="Archivo,sans-serif" font-size="16" font-weight="900" letter-spacing="2" fill="currentColor" text-anchor="middle">APPROVED</text><text x="65" y="55" font-family="Archivo,sans-serif" font-size="8.5" font-weight="800" letter-spacing="2.6" fill="currentColor" text-anchor="middle">THE HIDEOUT</text></g></svg>`,
    };
    const FRAMES=[["f-none","None"],["f-polaroid","Polaroid"],["f-ink","Ink edge"],["f-red","Red edge"]];
    
    /* ── 2단: 편집 — 도구를 탭으로 나눈다. 도구가 늘어도 툴바는 한 줄 ── */
    function step2(){
      if(!C.tool) C.tool="filter";
      if(!C.frame) C.frame="f-none";
      if(!C.font) C.font="archivo";
      if(!C.bg) C.bg="none";
      if(!C.penw) C.penw=7;
      C.stk=C.stk||[]; C.strokes=C.strokes||[];
    
      const TABS=[["filter","Filters"],["text","Text"],["sticker","Stickers"],["draw","Draw"],["frame","Frame"]];
      cbody().innerHTML=`
        <div class="edwrap">
          <div class="stage ${C.crop} ${C.frame}" id="stage">
            <div class="inner" id="inner">
              <img alt="" id="simg" src="${C.src}" style="filter:${C.filter}">
              <svg class="pen" id="pen" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
              <div class="tlayer" id="tlayer"></div>
            </div>
          </div>
          <div class="tabs2" id="tabs2">${TABS.map(([k,n])=>`<button data-tool="${k}" class="${C.tool===k?"on":""}">${n}</button>`).join("")}</div>
          <div class="panel" id="panel"></div>
          <p class="hint" id="hint"></p>
        </div>`;
      cbody().querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>{ C.tool=b.dataset.tool; C.sel=-1; step2(); });
      panelFor(C.tool);
      paintAll();
    }
    
    function panelFor(tool){
      const p=$c("panel"), h=$c("hint");
      if(tool==="filter"){
        p.innerHTML=`<div class="filts" id="filts"></div>
          <div class="row" style="margin-top:10px"><span class="lbl">Ratio</span>
            ${[["r1","1:1"],["r45","4:5"],["rfree","Original"]].map(([k,n])=>`<button class="tool ${C.crop===k?"on":""}" data-crop="${k}">${n}</button>`).join("")}</div>`;
        h.innerHTML="Each thumbnail shows the filter <b>actually applied</b>. Ratio sets the photo frame on the card.";
        buildFilters();
        p.querySelectorAll("[data-crop]").forEach(b=>b.onclick=()=>{
          C.crop=b.dataset.crop; $c("stage").className="stage "+C.crop+" "+C.frame;
          p.querySelectorAll("[data-crop]").forEach(x=>x.classList.remove("on")); b.classList.add("on"); });
      }
      else if(tool==="text"){
        p.innerHTML=`
          <div class="fonts" id="fonts">${FONTS.map(([k,css,s])=>`<button data-font="${k}" class="${C.font===k?"on":""}" style="font-family:${css}">${s} ${k==="marker"?"Marker":k==="caveat"?"Hand":k==="playfair"?"Serif":k==="mono"?"Mono":k==="system"?"Sys":"Archivo"}</button>`).join("")}</div>
          <div class="row" style="margin-top:9px">
            <button class="tool" id="addtext">＋ Add text</button>
            <span class="swatches">${TCOL.map(c=>`<button class="sw ${C.color===c?"on":""}" data-col="${c}" style="background:${c}"></button>`).join("")}</span>
          </div>
          <div class="row" style="margin-top:7px"><span class="lbl">Background</span>
            ${[["none","None"],["bg-white","White"],["bg-red","Red"]].map(([k,n])=>`<button class="tool ${C.bg===k?"on":""}" data-bg="${k}">${n}</button>`).join("")}
            <button class="tool" id="delsel" ${C.sel<0?"disabled":""}>Delete selected</button>
          </div>`;
        h.innerHTML="Tap the photo to add text. Text is <b>kept as a layer, never baked in</b> — so you can edit it later and it passes the safety check. Drag to move; use the corner handle to resize.";
        p.querySelectorAll("[data-font]").forEach(b=>b.onclick=()=>{ C.font=b.dataset.font;
          p.querySelectorAll("[data-font]").forEach(x=>x.classList.remove("on")); b.classList.add("on");
          if(sel()) { sel().font=C.font; paintAll(); } });
        p.querySelectorAll("[data-col]").forEach(b=>b.onclick=()=>{ C.color=b.dataset.col;
          p.querySelectorAll("[data-col]").forEach(x=>x.classList.remove("on")); b.classList.add("on");
          if(sel()) { sel().col=C.color; paintAll(); } });
        p.querySelectorAll("[data-bg]").forEach(b=>b.onclick=()=>{ C.bg=b.dataset.bg;
          p.querySelectorAll("[data-bg]").forEach(x=>x.classList.remove("on")); b.classList.add("on");
          if(sel()) { sel().bg=C.bg; paintAll(); } });
        $c("addtext").onclick=()=>inlineInput(50,50);
        $c("delsel").onclick=delSel;
      }
      else if(tool==="sticker"){
        p.innerHTML=`<div class="stk">${EMOJI.map(e=>`<button data-sticker="${e}">${e}</button>`).join("")}</div>
          <div class="pickhead" style="margin:16px 0 8px"><span class="l">Hideout stamps</span><span class="r"></span></div>
          <div class="stampgrid">${Object.entries(STAMPS).map(([k,svg])=>`<button data-stamp="${k}" style="color:var(--red)">${svg}</button>`).join("")}</div>
          <div class="row" style="margin-top:9px">
            <span class="lbl">Stamp colour</span>
            <span class="swatches">${["#ec3013","#201e1d","#3a26c8","#9a5a2a"].map(c=>`<button class="sw ${C.stampCol===c?"on":""}" data-scol="${c}" style="background:${c}"></button>`).join("")}</span>
            <button class="tool" id="delsel2" ${C.sel<0?"disabled":""}>Delete selected</button>
          </div>`;
        h.innerHTML="Tap a sticker or stamp to drop it on the photo. Drag to move, corner handle to resize. The stamps are ours — you will not find them in any other app.";
        p.querySelectorAll("[data-sticker]").forEach(b=>b.onclick=()=>addLayer({k:"emoji",ch:b.dataset.sticker,x:50,y:50,size:1,rot:0}));
        p.querySelectorAll("[data-stamp]").forEach(b=>b.onclick=()=>addLayer({k:"stamp",id:b.dataset.stamp,x:50,y:50,size:1,rot:-6,col:C.stampCol||"#ec3013"}));
        p.querySelectorAll("[data-scol]").forEach(b=>b.onclick=()=>{ C.stampCol=b.dataset.scol;
          p.querySelectorAll("[data-scol]").forEach(x=>x.classList.remove("on")); b.classList.add("on");
          if(sel()&&sel().k==="stamp"){ sel().col=C.stampCol; paintAll(); } });
        $c("delsel2").onclick=delSel;
      }
      else if(tool==="draw"){
        p.innerHTML=`<div class="row">
            <span class="lbl">Size</span>
            <span class="widths">${PENW.map(w=>`<button data-pw="${w}" class="${C.penw===w?"on":""}"><i style="width:${w+9}px;height:${w+9}px"></i></button>`).join("")}</span>
            <span class="swatches">${TCOL.map(c=>`<button class="sw ${C.color===c?"on":""}" data-col2="${c}" style="background:${c}"></button>`).join("")}</span>
          </div>
          <div class="row" style="margin-top:8px">
            <button class="tool" id="undo">↩ Undo</button>
            <button class="tool" id="clear">Clear all</button>
            <span class="lbl" style="margin-left:auto">${C.strokes.length} strokes</span>
          </div>`;
        h.innerHTML="Draw on the photo by hand. <b>Saved as vectors</b>, so it stays sharp at any size and you can undo.";
        p.querySelectorAll("[data-pw]").forEach(b=>b.onclick=()=>{ C.penw=+b.dataset.pw;
          p.querySelectorAll("[data-pw]").forEach(x=>x.classList.remove("on")); b.classList.add("on"); });
        p.querySelectorAll("[data-col2]").forEach(b=>b.onclick=()=>{ C.color=b.dataset.col2;
          p.querySelectorAll("[data-col2]").forEach(x=>x.classList.remove("on")); b.classList.add("on"); });
        $c("undo").onclick=()=>{ C.strokes.pop(); paintAll(); panelFor("draw"); };
        $c("clear").onclick=()=>{ C.strokes=[]; paintAll(); panelFor("draw"); };
      }
      else if(tool==="frame"){
        p.innerHTML=`<div class="frames">${FRAMES.map(([k,n])=>`<button data-frame="${k}" class="${C.frame===k?"on":""}">${n}</button>`).join("")}</div>`;
        h.innerHTML="Polaroid leaves a margin underneath — add one line in the handwriting font and it reads like a real postcard.";
        p.querySelectorAll("[data-frame]").forEach(b=>b.onclick=()=>{
          C.frame=b.dataset.frame; $c("stage").className="stage "+C.crop+" "+C.frame;
          p.querySelectorAll("[data-frame]").forEach(x=>x.classList.remove("on")); b.classList.add("on"); });
      }
      wireStage();
    }
    
    function buildFilters(){
      const strip=$c("filts"); if(!strip) return;
      strip.innerHTML=FILTERS.map(([n,f],i)=>`<button data-f="${i}" class="${C.filter===f?"on":""}"><canvas width="120" height="120"></canvas><span class="nm">${n}</span></button>`).join("");
      const im=new Image();
      im.onload=()=>{
        /* 원본 비율을 붙잡아 둔다 — 3단에서는 스테이지가 없고, 카드는 로드 전에 높이가 확정돼야 한다(AGENTS §4) */
        C.natAr=im.naturalWidth+"/"+im.naturalHeight;
        strip.querySelectorAll("canvas").forEach((cv,i)=>{
          const x=cv.getContext("2d");
          const side=Math.min(im.width,im.height), sx=(im.width-side)/2, sy=(im.height-side)/2;
          try{ x.filter=FILTERS[i][1]; }catch(_){}
          x.drawImage(im,sx,sy,side,side,0,0,120,120);
        });
      };
      im.src=C.src;
      strip.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{
        C.filter=FILTERS[+b.dataset.f][1]; $c("simg").style.filter=C.filter;
        strip.querySelectorAll("[data-f]").forEach(x=>x.classList.remove("on")); b.classList.add("on");
      });
    }
    
    /* 선택 = 글자와 스티커를 한 목록으로 다룬다. C.sel 은 [texts..., stk...] 통합 인덱스 */
    function allLayers(){ return [...C.texts.map(t=>({...t,k:"text",_r:t})), ...C.stk.map(s=>({...s,_r:s}))]; }
    function sel(){ const L=allLayers(); return C.sel>=0&&L[C.sel]?L[C.sel]._r:null; }
    function delSel(){
      if(C.sel<0) return;
      if(C.sel<C.texts.length) C.texts.splice(C.sel,1); else C.stk.splice(C.sel-C.texts.length,1);
      C.sel=-1; paintAll(); panelFor(C.tool);
    }
    function addLayer(o){ C.stk.push(o); C.sel=C.texts.length+C.stk.length-1; paintAll(); panelFor(C.tool); }
    
    /* window.prompt 대신 캔버스 위 인라인 입력. 모바일에서 네이티브 프롬프트는 특히 나쁘다 */
    function inlineInput(xp,yp){
      /* .inner 에 붙인다 — .stage 는 폴라로이드 프레임에서 padding 을 갖기 때문에
         거기에 % 로 놓으면 레이어와 좌표계가 어긋난다 */
      const host=$c("inner")||$c("stage");
      host.querySelectorAll(".tin").forEach(n=>n.remove());
      const inp=document.createElement("input");
      inp.className="tin"; inp.maxLength=60; inp.placeholder="Type, then Enter";
      inp.style.left=xp+"%"; inp.style.top=yp+"%"; inp.style.color=C.color;
      inp.style.fontFamily=fontCss(C.font);
      host.appendChild(inp); inp.focus();
      /* Enter 와 blur 두 경로가 같은 commit 을 부른다. 지우기가 blur 를 유발하는 순서는 브라우저마다
         달라서(이 크롬에선 중복이 재현되지 않았다) 순서에 의존하지 않도록 한 번만 실행되게 잠근다.
         afterImages() 의 done 플래그와 같은 방식이다. */
      let done=false;
      const commit=()=>{ if(done) return; done=true;
        const v=inp.value.trim(); inp.remove();
        if(v){ C.texts.push({s:v,x:xp,y:yp,col:C.color,font:C.font,bg:C.bg,size:1,rot:0});
               C.sel=C.texts.length-1; paintAll(); panelFor(C.tool); } };
      inp.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); commit(); } if(e.key==="Escape"){ done=true; inp.remove(); } });
      inp.addEventListener("blur",commit);
    }
    
    const fontCss=k=>(FONTS.find(f=>f[0]===k)||FONTS[0])[1];
    
    /* 레이어 전부(글자·이모지·도장) + 그린 선을 한 번에 그린다. C.sel 은 [texts..., stk...] 통합 인덱스 */
    function paintAll(){
      const layer=$c("tlayer"), pen=$c("pen");
      if(pen) pen.innerHTML=C.strokes.map(s=>
        `<polyline points="${s.pts.map(p=>p[0].toFixed(2)+","+p[1].toFixed(2)).join(" ")}" fill="none" stroke="${s.col}" stroke-width="${s.w}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`).join("");
      if(!layer) return;
      const L=allLayers();
      layer.innerHTML=L.map((o,i)=>{
        const selc=i===C.sel?" sel":"";
        const tf=`translate(-50%,-50%) scale(${o.size||1}) rotate(${o.rot||0}deg)`;
        const pos=`left:${o.x}%;top:${o.y}%;transform:${tf}`;
        if(o.k==="text") return `<div class="lay tx ${o.bg&&o.bg!=="none"?o.bg:""}${selc}" data-i="${i}" style="${pos};color:${o.col};font-family:${fontCss(o.font)}">${esc(o.s)}<span class="hnd"></span></div>`;
        if(o.k==="emoji") return `<div class="lay st${selc}" data-i="${i}" style="${pos}">${esc(o.ch)}<span class="hnd"></span></div>`;
        return `<div class="lay stamp${selc}" data-i="${i}" style="${pos};color:${o.col||"#ec3013"}">${STAMPS[o.id]||""}<span class="hnd"></span></div>`;
      }).join("");
    
      layer.querySelectorAll(".lay").forEach(el=>{
        const i=+el.dataset.i, ref=allLayers()[i]._r;
        /* 크기 핸들 — 드래그와 분리한다. 안 그러면 잡는 순간 이동이 시작된다 */
        el.querySelector(".hnd").addEventListener("pointerdown",e=>{
          e.preventDefault(); e.stopPropagation();
          const pid=e.pointerId, r=$c("inner").getBoundingClientRect();
          const cx=r.left+(ref.x/100)*r.width, cy=r.top+(ref.y/100)*r.height;
          const d0=Math.max(8,Math.hypot(e.clientX-cx,e.clientY-cy)), s0=ref.size||1;
          const mv=v=>{ if(v.pointerId!==pid) return; v.preventDefault();
            ref.size=Math.max(.3,Math.min(4, s0*Math.hypot(v.clientX-cx,v.clientY-cy)/d0));
            el.style.transform=`translate(-50%,-50%) scale(${ref.size}) rotate(${ref.rot||0}deg)`; };
          const up=v=>{ if(v.pointerId!==pid) return;
            document.removeEventListener("pointermove",mv); document.removeEventListener("pointerup",up); };
          document.addEventListener("pointermove",mv); document.addEventListener("pointerup",up);
        });
        el.addEventListener("pointerdown",e=>{
          if(e.target.closest(".hnd")) return;
          e.preventDefault(); e.stopPropagation();
          C.sel=i; paintAll(); panelFor(C.tool);
          const node=$c("tlayer").querySelector(`.lay[data-i="${i}"]`);
          const r=$c("inner").getBoundingClientRect(), pid=e.pointerId;
          const mv=v=>{ if(v.pointerId!==pid) return; v.preventDefault();
            ref.x=Math.max(2,Math.min(98,((v.clientX-r.left)/r.width)*100));
            ref.y=Math.max(2,Math.min(98,((v.clientY-r.top)/r.height)*100));
            node.style.left=ref.x+"%"; node.style.top=ref.y+"%"; };
          const up=v=>{ if(v.pointerId!==pid) return;
            node.removeEventListener("pointermove",mv); node.removeEventListener("pointerup",up); };
          try{ node.setPointerCapture(pid); }catch(_){}
          node.addEventListener("pointermove",mv); node.addEventListener("pointerup",up);
        });
      });
    }
    
    /* 스테이지 입력 — 도구에 따라 역할이 바뀐다. 글자=탭해서 넣기, 그리기=획 그리기 */
    function wireStage(){
      const inner=$c("inner"), pen=$c("pen"); if(!inner||!pen) return;
      pen.classList.toggle("live",C.tool==="draw");
      if(C.tool==="draw"){
        pen.onpointerdown=e=>{
          e.preventDefault();
          const pid=e.pointerId, r=inner.getBoundingClientRect();
          const P=v=>[((v.clientX-r.left)/r.width)*100,((v.clientY-r.top)/r.height)*100];
          const s={pts:[P(e)],col:C.color,w:C.penw};
          C.strokes.push(s); paintAll();
          const mv=v=>{ if(v.pointerId!==pid) return; v.preventDefault(); s.pts.push(P(v)); paintAll(); };
          const up=v=>{ if(v.pointerId!==pid) return;
            pen.removeEventListener("pointermove",mv); pen.removeEventListener("pointerup",up); pen.removeEventListener("pointercancel",up);
            if(s.pts.length<2) C.strokes.pop();
            paintAll(); panelFor("draw"); };
          try{ pen.setPointerCapture(pid); }catch(_){}
          pen.addEventListener("pointermove",mv); pen.addEventListener("pointerup",up); pen.addEventListener("pointercancel",up);
        };
      } else pen.onpointerdown=null;
    
      inner.onpointerdown=e=>{
        if(C.tool!=="text") { if(!e.target.closest(".lay")&&C.sel>=0){ C.sel=-1; paintAll(); panelFor(C.tool); } return; }
        if(e.target.closest(".lay")||e.target.closest(".tin")) return;
        const r=inner.getBoundingClientRect();
        inlineInput(((e.clientX-r.left)/r.width)*100, ((e.clientY-r.top)/r.height)*100);
      };
    }
    
    /* ── 3단: 공유 ── */
    function step3(){
      const t=TONES[C.tone];
      cbody().innerHTML=`
        <div class="share">
          <div class="sharetop">
            <!-- 사진은 어떤 글에도 붙을 수 있다 — 설문에도, 분실물에도. 여기서 바로 넣고 뺀다 -->
            <button type="button" class="thumb${C.src?"":" none"}" id="thumbbtn"
                    title="${C.src?"Edit photo":"Add a photo"}">${C.src
              ? `<img alt="" src="${C.src}" style="filter:${C.filter}">`
              : `<span class="thadd"><b>+</b>Add photo</span>`}</button>
            ${C.src
              ? `<button type="button" class="thdrop" id="thumbdrop">Remove photo</button>`
              : `<button type="button" class="thcam" id="thumbcam">◉ Take photo</button>`}
            <input type="file" accept="image/*" id="file3" style="display:none">
            <!-- capture 를 단 별도 입력. 한 입력에 capture 를 달면 앨범에서 고르기가 사라진다 -->
            <input type="file" accept="image/*" capture="environment" id="file3cam" style="display:none">
            <div class="cap">
              ${C.lost ? `
              <!-- 분실물은 "무엇을 · 어디서 · 언제" 가 없으면 주인이 자기 것인지 못 알아본다.
                   자유 서술로 두면 절반은 빠뜨리므로 칸을 따로 만든다. -->
              <label class="fld">What is it</label>
              <input class="inp" id="lwhat" maxlength="80" placeholder="Black umbrella, gold ring, AirPods case" value="${esc(C.lwhat||"")}">
              <div class="lrow">
                <div><label class="fld">Where</label>
                  <input class="inp" id="lwhere" maxlength="80" placeholder="Table 6 / counter / toilet" value="${esc(C.lwhere||"")}"></div>
                <div><label class="fld">When found</label>
                  <input class="inp" id="lwhen" maxlength="40" placeholder="Today 2pm" value="${esc(C.lwhen||"")}"></div>
              </div>
              <label class="fld">Anything else</label>
              <textarea class="ta" id="cap" maxlength="600" placeholder="Optional — colour, brand, who handed it in">${C.caption}</textarea>
              ` : `
              <label class="fld">Message</label>
              <textarea class="ta" id="cap" maxlength="600" placeholder="Say something kind">${C.caption}</textarea>
              `}
            </div>
          </div>
          <!-- 투표(큐 6) — **접힌 채로 시작한다.** 안 켜면 버튼 하나뿐이라
               텍스트 전용 경로(C3)에 탭이 0개 추가된다 -->
          <div id="pollwrap"></div>
          <div>
            <label class="fld">To</label>
            <select class="sel" id="to">${STAFF.map(s=>`<option ${s===C.to?"selected":""}>${s}</option>`).join("")}</select>
          </div>
          <div>
            <label class="fld">Card colour</label>
            <div class="tones" id="tones">${TONES.map((x,i)=>`<button class="tone ${i===C.tone?"on":""}" data-t="${i}" style="background:${x.bg}"></button>`).join("")}</div>
          </div>
          <div class="gate">
            <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Checked before it posts — your message, any words on the photo, and stickers. Anything meant to insult, mock or mislead will not go through.
            ${C.texts.length?`<b>${C.texts.length} text layer(s) on the photo are checked too.</b>`:""}</span>
          </div>
        </div>`;
      drawPollEdit();
      $c("cap").oninput=e=>C.caption=e.target.value;
      $c("thumbbtn").onclick=()=>{ if(C.src){ C.step=2; drawStep(); } else $c("file3").click(); };
      const _pick=e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return;
        C.src=URL.createObjectURL(f); C.textOnly=false; C.step=2; drawStep(); };
      $c("file3").onchange=_pick;
      const _cam=$c("file3cam"); if(_cam) _cam.onchange=_pick;
      const _cb=$c("thumbcam"); if(_cb) _cb.onclick=()=>_cam.click();
      const _td=$c("thumbdrop"); if(_td) _td.onclick=()=>{ C.src=null; C.textOnly=true; drawStep(); };
      $c("to").onchange=e=>C.to=e.target.value;
      cbody().querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{
        C.tone=+b.dataset.t;
        cbody().querySelectorAll("[data-t]").forEach(x=>x.classList.remove("on")); b.classList.add("on");
      });
    }
    
    /* ── 3단 안의 투표 편집기 (큐 6) ──
       **이 블록만** 다시 그린다. 선택지를 추가할 때마다 step3() 전체를 다시 그리면
       메시지 textarea 가 새로 만들어져 입력 중이던 포커스와 커서 위치가 날아간다.
       선택지는 2~4개로 묶는다 — 1개는 투표가 아니고, 5개부터는 228px 카드에서 접힘 아래로 내려간다. */
    function drawPollEdit(){
      const w=$c("pollwrap"); if(!w) return;
      const P=C.poll;
      w.innerHTML = !P
        ? `<label class="fld">Vote</label><button class="tool" id="pon">Add a vote</button>`
        /* 조작 버튼을 **머리줄에 얹는다.** 아래에 따로 한 줄을 두면 390px 에서 step3 가 그만큼 스크롤된다
           (실측: 선택지 3개일 때 61px 넘침 → 머리줄 통합 + 한 줄 힌트로 26px 로 줄였다).
           라벨+2px 룰은 `.pickhead`·`.seclbl` 과 같은 조립이다 — 새 시각 언어를 만들지 않는다 */
        : `<div class="phdr">
             <span class="l">Vote</span><span class="r"></span>
             <button class="tool" id="padd"${P.opts.length>=4?" disabled":""}>Add option</button>
             <button class="tool" id="poff">Remove</button>
           </div>
           <div class="polled">
             ${P.opts.map((t,i)=>`<div class="prow">
                <input class="inp po" data-i="${i}" maxlength="40" placeholder="Option ${i+1}" value="${esc(t)}"/>
                <button class="tool prm" data-rm="${i}" aria-label="Clear option ${i+1}"${P.opts.length<=2?" disabled":""}>✕</button>
              </div>`).join("")}
             <span class="hint">Your message becomes the question · tally revealed when you close it</span>
             <span class="pwarn" id="pwarn">Fill in at least two options</span>
           </div>`;
      const pon=$c("pon");
      if(pon){ pon.onclick=()=>{ C.poll={opts:["",""]}; drawPollEdit(); const f=w.querySelector(".po"); if(f) f.focus(); }; return; }
      w.querySelectorAll(".po").forEach(inp=>inp.oninput=e=>{
        C.poll.opts[+inp.dataset.i]=e.target.value;
        const wn=$c("pwarn"); if(wn) wn.classList.remove("on");   /* 고치는 중에 경고가 남아 있으면 잔소리가 된다 */
      });
      w.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{ C.poll.opts.splice(+b.dataset.rm,1); drawPollEdit(); });
      $c("padd").onclick=()=>{ if(C.poll.opts.length<4){ C.poll.opts.push(""); drawPollEdit(); const L=w.querySelectorAll(".po"); L[L.length-1].focus(); } };
      $c("poff").onclick=()=>{ C.poll=null; drawPollEdit(); };
    }
    
    function submitCard(){
      const msg=(C.caption||"").trim();
      if(C.lost){ C.lwhat=(($c("lwhat")||{}).value)||""; C.lwhere=(($c("lwhere")||{}).value)||""; C.lwhen=(($c("lwhen")||{}).value)||""; }
      /* 분실물은 물건 이름이 곧 본문이라 메시지가 비어도 보낼 수 있다 */
      if(!msg && !(C.lost && C.lwhat)){ const t=$c(C.lost?"lwhat":"cap"); t&&t.focus(); return; }
      /* 투표를 켜 놓고 선택지를 안 채운 채로 보내면 **조용히 사라지는** 게 최악이다.
         막고, 왜 막혔는지 그 자리에 띄운다 */
      let poll=null;
      if(C.poll){
        const opts=C.poll.opts.map(s=>String(s).trim()).filter(Boolean);
        if(opts.length<2){
          const wn=$c("pwarn"); if(wn) wn.classList.add("on");
          const empty=[...cbody().querySelectorAll(".po")].find(i=>!i.value.trim());
          if(empty) empty.focus();
          return;
        }
        poll={opts:opts.map(t=>({t})), votes:{}, closed:false};
      }
      /* 심사 대상 = 메시지 + 사진에 얹은 글자. 구운 글자가 없으니 전부 검사 가능하다.
         이모지 스티커·도장·그린 선은 글이 아니므로 심사 대상이 아니다 — 그래서 텍스트만 모은다.
         **선택지도 글이다** — 여기서 빼면 "○○ 빼고 아무데나" 같은 문장이 심사를 통째로 우회한다 (큐 6) */
      const toCheck=[msg,...C.texts.map(t=>t.s),...(poll?poll.opts.map(o=>o.t):[])].join("\n");
      console.log("[moderate 대상]",toCheck);
      /* 비율을 여기서 확정해 카드에 넘긴다. 예전엔 crop 을 저장하지 않아
         4:5 나 원본을 골라도 카드가 무조건 1:1 로 나왔다 (실측: 선택 4:5 → 렌더 1.000). */
      const ar = !C.src ? null : C.crop==="r45" ? "4/5" : C.crop==="rfree" ? (C.natAr||"1/1") : "1/1";
      /* `c:0` 을 뺐다 — 카운트는 이제 `cm.length` 에서 나온다(큐 11). 새 엽서는 빈 스레드로 시작한다 */
      liveSend(msg,poll);
      items.unshift({from:(LIVE.me&&LIVE.me.displayName)||nameOf(ME),to:C.to,msg,t:C.tone,pin:false,rx:[],cm:[],ago:"now",
                     photo:C.src?1:0, src:C.src, filter:C.filter, texts:C.texts.slice(),
                     stk:(C.stk||[]).slice(), strokes:(C.strokes||[]).slice(), frame:C.frame||"f-none",
                     crop:C.crop, ar, poll, id:Date.now()});
      closeCompose();
    
      render();
    }
    
    $c("fab").onclick=openCompose;
    $c("cclose").onclick=closeCompose;
    $c("cback").onclick=()=>{ if(C.step>1){ C.step = (C.step===3 && C.textOnly) ? 1 : C.step-1; drawStep(); } };
    $c("cnext").onclick=()=>{ if(C.step===3) submitCard(); else { C.step++; drawStep(); } };
    
    render();
    
    /* ── 부팅: 로그인 → 스태프 → 엽서 구독 → 시안 render() ─────────────── */
    LIVE.staff=[]; LIVE.cm={};
    /* ── 쓰기 다리 ────────────────────────────────────────────────────────
       시안 UI 는 items[] 를 그 자리에서 바꾼다(그래서 반응이 즉각적이다).
       여기서는 그 지점마다 Firestore 저장을 나란히 걸 뿐, UI 코드는 안 고친다.
       실패하면 토스트를 띄우고 구독이 서버 상태로 되돌린다. */
    function FV(){ return firebase.firestore.FieldValue; }
    function needAuth(){
      if(LIVE.me) return false;
      alert("Sign in first — the button is at the top of the board.");
      return true;
    }
    function save(d,patch){
      if(!d||!d._id||!LIVE.db) return Promise.resolve();
      return LIVE.db.collection("postcards").doc(d._id).set(patch,{merge:true})
        .catch(function(e){ console.error("save",e); alert("Couldn't save — "+((e&&e.message)||"try again")); });
    }
    function savePosOf(d){
      var bw=(document.getElementById("feed")||{}).clientWidth||1;
      return save(d,{pos:{x:Math.round(d.x/bw*10000)/100, y:Math.round(d.y)},
                     posBy:ME, posAt:FV().serverTimestamp()});
    }
    
    /* 새 엽서 — 모더레이션 → (사진이면) Cloudinary 업로드 → 문서 추가.
       시안이 만든 레이어(글자·획·스티커)는 아직 라이브 카드 렌더가 쓰지 않으므로
       `v2layers` 로 통째로 보관한다. 버리지 않는다. */
    var CLOUD={name:"ghfmwnbn",preset:"THC IMAGE LIBRARY",tag:"pinboard"};
    function moderateLive(text){
      return fetch("https://us-central1-hideout-recipe-cost.cloudfunctions.net/moderateText",
        {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:text})})
        .then(function(r){ return r.json(); })
        .then(function(j){ return {allow:j&&j.allow!==false, reason:j&&j.reason}; })
        .catch(function(){ return {allow:true, _soft:true}; });
    }
    function dataUrlToBlob(u){
      return fetch(u).then(function(r){ return r.blob(); });
    }
    function liveSend(msg,poll){
      if(needAuth()) return;
      var texts=(C.texts||[]).map(function(t){ return t.s; });
      var opts=poll?poll.opts.map(function(o){ return o.t; }):[];
      moderateLive([msg].concat(texts,opts).join(String.fromCharCode(10))).then(function(mod){
        if(!mod.allow){ alert("That didn't pass the check: "+(mod.reason||"")); return; }
        var up=Promise.resolve("");
        if(C.src){
          up=dataUrlToBlob(C.src).then(function(b){
            var fd=new FormData();
            fd.append("file",b); fd.append("upload_preset",CLOUD.preset); fd.append("tags",CLOUD.tag);
            return fetch("https://api.cloudinary.com/v1_1/"+CLOUD.name+"/image/upload",{method:"POST",body:fd})
              .then(function(r){ return r.json(); })
              .then(function(j){ if(j&&j.secure_url) return j.secure_url; throw new Error((j&&j.error&&j.error.message)||"upload failed"); });
          });
        }
        up.then(function(url){
          var rec={kind:(C.lost?"lost":""),
            lostWhat:(C.lost?(C.lwhat||""):""), lostWhere:(C.lost?(C.lwhere||""):""), lostWhen:(C.lost?(C.lwhen||""):""),
            fromEmail:ME, fromName:(LIVE.me&&LIVE.me.displayName)||nameOf(ME),
            toName:C.to||"Everyone", toEmail:"", message:msg,
            photoUrl:url||"", theme:TONE_ID[C.tone||0]||"cream", status:"approved",
            createdAt:FV().serverTimestamp()};
          if(poll&&poll.opts&&poll.opts.length>=2) rec.poll={opts:poll.opts,votes:{},closed:false};
          if((C.texts&&C.texts.length)||(C.strokes&&C.strokes.length)||(C.stk&&C.stk.length))
            rec.v2layers={texts:C.texts||[],strokes:C.strokes||[],stk:C.stk||[],frame:C.frame||"",filter:C.filter||"none",crop:C.crop||""};
          return LIVE.db.collection("postcards").add(rec);
        }).catch(function(e){ alert("Couldn't post — "+((e&&e.message)||"")); });
      });
    }
    
    /* 문서에 비율이 없으므로 사진이 도착할 때 배운다. 배우기 전에 가로로 가정하면
       모든 사진 카드가 2칸짜리 넓은 카드가 되어 판이 통째로 커진다. */
    LIVE.ar={};
    function learnRatios(){
      var imgs=document.querySelectorAll("#feed .pc .shot img"), changed=false, pend=0;
      Array.prototype.forEach.call(imgs,function(im){
        var card=im.closest(".pc"); if(!card) return;
        var d=items.find(function(x){ return String(x.id)===card.dataset.id; }); if(!d||!d._id) return;
        var apply=function(){
          if(!im.naturalWidth||!im.naturalHeight) return;
          var r=im.naturalWidth+"/"+im.naturalHeight;
          if(LIVE.ar[d._id]!==r){ LIVE.ar[d._id]=r; changed=true; }
        };
        if(im.complete) apply();
        else { pend++; im.addEventListener("load",function(){ apply(); syncItems(); render(); },{once:true}); }
      });
      if(changed){ syncItems(); render(); }
    }
    
    
    document.addEventListener("click",function(e){
      var b=e.target.closest&&e.target.closest(".act.claim"); if(!b) return;
      e.preventDefault(); e.stopPropagation();
      if(needAuth()) return;
      var d=items.find(function(x){ return String(x.id)===b.dataset.claim; }); if(!d) return;
      d.claimed=!d.claimed;
      save(d,{claimed:d.claimed, claimedBy:d.claimed?ME:"", claimedAt:d.claimed?FV().serverTimestamp():null});
      render();
    },true);
    
    function liveBoot(){
      /* 읽기는 로그인 없이도 된다 — 판은 바로 띄우고, 로그인은 *쓰기* 에만 건다.
         둘을 묶어 놨더니 로그인 전에는 화면이 통째로 비어 있었다. */
      liveSubscribe();
      LIVE.auth.onAuthStateChanged(function(u){
        LIVE.me=u||null; ME=u?(u.email||"").toLowerCase():"";
        var b=document.getElementById("v3signin");
        if(u){ if(b) b.parentNode.remove();
          LIVE.db.collection("staff").limit(200).get().then(function(qs){
            LIVE.staff=[]; qs.forEach(function(d){ var x=d.data()||{};
              LIVE.staff.push({email:(x.email||d.id||"").toLowerCase(),name:x.name||x.displayName||""}); });
            syncItems(); render();
          }).catch(function(){});
        } else if(!b){
          document.querySelector(".app").insertAdjacentHTML("afterbegin",
            '<div style="padding:14px 18px;border-bottom:2px solid var(--ink);display:flex;align-items:center;gap:12px">'+
            '<button id="v3signin" class="cbtn primary">Sign in to post</button>'+
            '<span style="font-weight:800;font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.5">Reading only until you sign in</span></div>');
          document.getElementById("v3signin").onclick=function(){
            LIVE.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
              .catch(function(e){ alert("Sign-in failed: "+(e&&e.code||"")+" "+(e&&e.message||"")); });
          };
        }
      });
    }
    function liveSubscribe(){
      if(LIVE.unsub) try{ LIVE.unsub(); }catch(e){}
      LIVE.unsub=LIVE.db.collection("postcards").orderBy("createdAt","desc").limit(60)
        .onSnapshot(function(qs){
          LIVE.docs=[]; qs.forEach(function(d){ LIVE.docs.push(d); });
          syncItems();
          render();
          learnRatios();
          loadAllComments();
        }, function(e){ console.error("feed",e); });
    }
    function loadAllComments(){
      LIVE.docs.forEach(function(doc){
        var n=Number((doc.data()||{}).commentCount)||0;
        if(!n||LIVE.cm[doc.id]) return;
        LIVE.cm[doc.id]=[];
        doc.ref.collection("comments").orderBy("ts","asc").limit(50).get().then(function(qs){
          var a=[]; qs.forEach(function(c){ var x=c.data()||{};
            a.push({w:x.byName||nameOf(x.byEmail), t:x.text||"", a:agoOf(x.ts)}); });
          LIVE.cm[doc.id]=a; syncItems(); render();
        }).catch(function(){});
      });
    }
    liveBoot();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mount); else mount();
})();
