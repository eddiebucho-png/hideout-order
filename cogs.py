# cogs.py - Manager COGS dashboard (주별 6주 + 월 요약, 역할매출%, 2단, prep_cost)
import json
import base64
import time
import os
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone, date
from config import XERO_ORGS, SETTINGS_SHEET_CSV, ACCOUNTS

BNE = timezone(timedelta(hours=10))
TOKEN_URL = "https://identity.xero.com/connect/token"
ACC = "https://api.xero.com/api.xro/2.0"
SCOPES = "accounting.reports.profitandloss.read accounting.settings.read"
LOAD_URL = "https://connect.squareup.com/reporting/v1/load"
WEB_DIR = os.environ.get("DASH_OUT", r"C:\DashboardWeb")
OUT = os.path.join(WEB_DIR, "cogs.html")

DISPLAY_ORDER = ["Adelaide St", "Edward St", "St Pauls Ter"]
STORE_COLOR = {"Adelaide St": "#2563eb", "Edward St": "#d97706", "St Pauls Ter": "#7c3aed"}
COMBINED_COLOR = "#0d9488"
WEEKS = 6

_token_cache, _tenant_cache = {}, {}
_acc_by_name = {a["name"]: a for a in ACCOUNTS}
_org_by_name = {o["name"]: o for o in XERO_ORGS}

ALL_SLUGS = ["adelaide", "edward", "stpauls"]
STORE_SLUG = {"Adelaide St": "adelaide", "Edward St": "edward", "St Pauls Ter": "stpauls"}

# ---- 매니저 어드바이스 카드 (manager_actions.json, 목요일 딥다이브 발행) ----
# 원칙(Eddie): 정보 최소화 — 카드당 액션 최대 2개, 한 문장씩. 색으로 상태 즉시 전달.
MA_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSfSM_wy_OhOkKvNw8EAUX6kD4dAc8UFUn-sU8VgjiNpxi20Dw/viewform"
MA_MISSION = "Our goal on this page: cut cost without cutting quality."
# gid 제거 (2026-07-13): gid=223892282는 빈 탭 — 실제 응답은 기본(첫) 탭에 쌓임
FEEDBACK_CSV = ("https://docs.google.com/spreadsheets/d/1hjgUHzEFnHb71QXKGqdSdEZAA62k0KRWWh3TjdXCPHQ"
                "/gviz/tq?tqx=out:csv&headers=1")


def fb_latest():
    """피드백 시트에서 액션 ID별 최신 응답 (같은 ID 재제출 = 최신이 이김, undo 가능)"""
    import csv as _csv
    import io as _io
    try:
        req = urllib.request.Request(FEEDBACK_CSV, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read().decode("utf-8")
        rows = list(_csv.reader(_io.StringIO(text)))
    except Exception as e:
        print("  ! feedback read skipped:", e)
        return {}
    if not rows:
        return {}
    head = [h.strip().lower() for h in rows[0]]
    idx = {n: i for i, n in enumerate(head)}
    out = {}
    for r in rows[1:]:
        aid_i = idx.get("action id")
        aid = r[aid_i].strip() if aid_i is not None and aid_i < len(r) else ""
        if not aid:
            continue
        st_i, cm_i = idx.get("status"), idx.get("comment")
        st = r[st_i].strip() if st_i is not None and st_i < len(r) else ""
        cm = r[cm_i].strip() if cm_i is not None and cm_i < len(r) else ""
        out[aid] = (st, cm)
    return out


FB = fb_latest()


def fb_chip(aid):
    st, cm = FB.get(aid, ("", ""))
    s = st.lower()
    if s.startswith("done"):
        cls, label = "done", "Done"
    elif s.startswith("in"):
        cls, label = "prog", "In progress"
    elif s.startswith("can"):
        cls, label = "cant", "Can&#39;t do"
    else:
        cls, label = "none", "No reply yet"
    return '<span class="machip {c}" title="{t}">{l}</span>'.format(
        c=cls, t=(cm.replace('"', "&#39;") if cm else ""), l=label)


def fb_replies(week):
    """feedback_log.json에서 에디 확인(approved)된 매니저 회신 — 현재 게시 주만"""
    try:
        with open("feedback_log.json", encoding="utf-8") as f:
            d = json.load(f)
    except Exception:
        return {}
    out = {}
    for e in d.get("entries") or []:
        if (e.get("week") == week and e.get("action_id") and e.get("reply_to_manager")
                and (e.get("eddie_decision") or "").lower() in ("approved", "ok", "confirmed")):
            out[e["action_id"]] = e["reply_to_manager"]
    return out


FB_REPLY = {}


def fb_reply_html(aid):
    rep = FB_REPLY.get(aid)
    if not rep:
        return ""
    return '<div class="mareply">&#8617; <b>Our reply.</b> {}</div>'.format(rep)


ROLE_COLORS = {"FOH": "#2563eb", "BOH": "#b45309", "PASTRY": "#7c3aed", "ALL": "#6b7280"}
MA_STORE_COLORS = {"Adelaide St": "#2563eb", "Edward St": "#d97706", "St Pauls Ter": "#7c3aed"}


def role_chip(ac):
    r = (ac.get("role") or "ALL").upper()
    c = ROLE_COLORS.get(r, "#6b7280")
    return '<span class="marole" style="color:{c};border-color:{c}">{r}</span>'.format(c=c, r=r)


def _ma_rows(actions, store, mode):
    rows = ""
    for ac in actions[:2]:
        if mode == "status":
            rows += ('<div class="marow"><div class="matop"><span class="maid">{i}</span>'
                     '<span class="matx">{t}</span></div>'
                     '<div class="mabtns">{chip}</div>{rep}</div>').format(
                i=ac["id"], t=ac["text"], chip=fb_chip(ac["id"]),
                rep=fb_reply_html(ac["id"]))
            continue
        base = (MA_FORM + "?usp=pp_url&entry.1960681206=" + urllib.parse.quote_plus(ac["id"])
                + "&entry.2067273977=" + urllib.parse.quote_plus(store)
                + "&entry.426210159=")
        rows += ('<div class="marow"><div class="matop"><span class="maid">{i}</span>'
                 '<span class="matx">{t}</span></div>'
                 '<div class="mabtns">{chip}'
                 '<a class="mabtn ok" target="_blank" href="{d}">&#10003; Done</a>'
                 '<a class="mabtn no" target="_blank" href="{n}">&#9888; Can&#39;t do</a></div>{rep}</div>').format(
            i=ac["id"], t=ac["text"], chip=fb_chip(ac["id"]),
            d=base + urllib.parse.quote_plus("Done"),
            n=base + urllib.parse.quote_plus("Can't do (see comment)"),
            rep=fb_reply_html(ac["id"]))
    return rows


def ma_card_v2(store, a, week, show_store=False, mode="buttons"):
    """부서별(FOH/BOH/PASTRY/ALL) 어드바이스 카드 — v2 스키마 (departments)"""
    depts = a.get("departments") or {}
    any_over = any((d.get("status") or "").lower() == "over" for d in depts.values())
    any_act = any(d.get("actions") for d in depts.values())
    need = any_over or any_act
    body = ""
    if a.get("summary"):
        body += '<div class="maline"><b>Situation.</b> {}</div>'.format(a["summary"])
    st_label = {"over": "OVER TARGET", "watch": "WATCH", "ok": "ON TARGET"}
    for dn in ("FOH", "BOH", "PASTRY", "ALL"):
        d = depts.get(dn)
        if not d:
            continue
        st = (d.get("status") or "ok").lower()
        acts = _ma_rows(d.get("actions") or [], store, mode)
        note = d.get("note", "")
        note_html = '<div class="maline">{}</div>'.format(note) if note else ""
        c = ROLE_COLORS.get(dn, "#6b7280")
        dchip = ('<span class="marole mabig" style="background:{c};border-color:{c};'
                 'color:#fff">{d}</span>').format(c=c, d=dn)
        body += ('<div class="madept" style="border-left-color:{c};background:{c}0d">'
                 '<div class="madhead">{chip}<span class="madst {st}">{sl}</span></div>'
                 '{note}{acts}</div>').format(
            c=c, chip=dchip, st=st,
            sl=st_label.get(st, st.upper()), note=note_html, acts=acts)
    mission = '<div class="mamission">{}</div>'.format(MA_MISSION) if mode == "buttons" else ""
    sc = MA_STORE_COLORS.get(store, "#211d19")
    head = ('<div class="mahead2"><span class="mastore" style="background:{sc}">{s}</span>'
            '<span class="mawk">THIS WEEK</span>'
            '<span class="mastat {g}">{tag}</span></div>').format(
        sc=sc, s=store.upper(), g=("need" if need else "good"),
        tag=("ACTION NEEDED" if need else "ON TARGET"))
    return ('<div class="macard{cls}" style="border-left-color:{sc}">{head}'
            '{mission}{body}</div>').format(
        cls=("" if need else " good"), sc=sc, head=head, mission=mission, body=body)


def ma_load(section):
    try:
        with open("manager_actions.json", encoding="utf-8") as f:
            d = json.load(f)
        return d.get("week", ""), (d.get(section) or {})
    except Exception:
        return "", {}


def ma_card(store, a, week, show_store=False, mode="buttons"):
    """mode="buttons": 지점 매니저용 (응답 버튼 + 현재 상태 칩, 재제출 = undo)
    mode="status": Review 탭용 (오퍼레이션 매니저·총괄 셰프가 응답 상태만 조회)"""
    if not a:
        return ""
    if a.get("departments"):
        return ma_card_v2(store, a, week, show_store, mode)
    actions = a.get("actions", [])[:2]
    need = bool(actions)
    cls = "" if need else " good"
    tag = "ACTION NEEDED" if need else "ON TARGET"
    if show_store:
        tag = store.upper() + " &middot; " + tag
    acts = ""
    for ac in actions:
        if mode == "status":
            acts += ('<div class="marow"><div class="matop"><span class="maid">{i}</span>{role}'
                     '<span class="matx">{t}</span></div>'
                     '<div class="mabtns">{chip}</div></div>').format(
                i=ac["id"], role=role_chip(ac), t=ac["text"], chip=fb_chip(ac["id"]))
            continue
        base = (MA_FORM + "?usp=pp_url&entry.1960681206=" + urllib.parse.quote_plus(ac["id"])
                + "&entry.2067273977=" + urllib.parse.quote_plus(store)
                + "&entry.426210159=")
        acts += ('<div class="marow"><div class="matop"><span class="maid">{i}</span>{role}'
                 '<span class="matx">{t}</span></div>'
                 '<div class="mabtns">{chip}'
                 '<a class="mabtn ok" target="_blank" href="{d}">&#10003; Done</a>'
                 '<a class="mabtn no" target="_blank" href="{n}">&#9888; Can&#39;t do</a></div></div>').format(
            i=ac["id"], role=role_chip(ac), t=ac["text"], chip=fb_chip(ac["id"]),
            d=base + urllib.parse.quote_plus("Done"),
            n=base + urllib.parse.quote_plus("Can't do (see comment)"))
    return ('<div class="macard{cls}"><div class="mahead">THIS WEEK &middot; {tag}</div>'
            '<div class="maline"><b>Situation.</b> {sit}</div>'
            '<div class="maline"><b>Why.</b> {why}</div>{acts}</div>').format(
        cls=cls, tag=tag, sit=a.get("situation", ""), why=a.get("why", ""), acts=acts)


MA_WEEK, MA_COGS = ma_load("cogs")
FB_REPLY = fb_replies(MA_WEEK)


def prep_cost_adjust(slug, role, settings):
    sent = recv = 0.0
    for other in ALL_SLUGS:
        if other == slug:
            continue
        sent += settings.get("prep_cost_{}_{}_to_{}".format(role, slug, other), 0) or 0
        recv += settings.get("prep_cost_{}_{}_to_{}".format(role, other, slug), 0) or 0
    return sent, recv


def intra_cost_adjust(slug, role, settings):
    """같은 매장 안 BOH <-> Pastry cost 이동 (MOCO 재료 중 페이스트리분 등)"""
    sent = recv = 0.0
    for (frm, to) in [("boh", "pastry"), ("pastry", "boh")]:
        amt = settings.get("intra_cost_{}_to_{}_{}".format(frm, to, slug), 0) or 0
        if role == frm:
            sent += amt
        if role == to:
            recv += amt
    return sent, recv


def apply_prep_cost(cogs, slug, settings):
    out = dict(cogs)
    for role in ["foh", "boh", "pastry"]:
        sent, recv = prep_cost_adjust(slug, role, settings)
        isent, irecv = intra_cost_adjust(slug, role, settings)
        out[role] = out.get(role, 0.0) - sent + recv - isent + irecv
    return out


def f(s):
    try:
        return float(str(s).replace(",", "") or 0)
    except ValueError:
        return 0.0


def load_settings():
    out = {}
    try:
        import csv, io
        req = urllib.request.Request(SETTINGS_SHEET_CSV, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read().decode("utf-8")
        for row in list(csv.reader(io.StringIO(text)))[1:]:
            if len(row) >= 2 and row[0].strip():
                try:
                    out[row[0].strip()] = float(row[1])
                except (ValueError, IndexError):
                    pass
    except Exception as e:
        print("  ! settings error:", e)
    return out


def get_token(org):
    nm = org["name"]
    if nm in _token_cache:
        return _token_cache[nm]
    cred = base64.b64encode((org["client_id"] + ":" + org["client_secret"]).encode()).decode()
    body = urllib.parse.urlencode({"grant_type": "client_credentials", "scopes": SCOPES}).encode()
    req = urllib.request.Request(TOKEN_URL, data=body, method="POST", headers={
        "Authorization": "Basic " + cred, "Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            tok = json.loads(r.read().decode())["access_token"]
    except Exception as e:
        print("  ! token error ({}): {}".format(nm, e)); tok = None
    _token_cache[nm] = tok
    return tok


def get_tenant(org, token):
    nm = org["name"]
    if nm in _tenant_cache:
        return _tenant_cache[nm]
    req = urllib.request.Request("https://api.xero.com/connections",
                                 headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            c = json.loads(r.read().decode())
        tid = c[0]["tenantId"] if c else None
    except Exception:
        tid = None
    _tenant_cache[nm] = tid
    return tid


def api_get(url, token, tenant):
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + token, "Xero-tenant-id": tenant, "Accept": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if attempt < 2:
                time.sleep(2)
                continue
            print("  ! api error:", e)
            return None


def cogs_role(name):
    n = name.lower()
    if "pastr" in n:
        return "pastry"
    if "boh" in n:
        return "boh"
    if "foh" in n:
        return "foh"
    if "coffee" in n or "milk" in n:
        return "foh"
    if "food" in n or "fruit" in n or "bakery" in n:
        return "boh"
    return "other"


def cogs_pl(org, token, tenant, d0, d1):
    url = ACC + "/Reports/ProfitAndLoss?fromDate={}&toDate={}".format(d0, d1)
    rep = api_get(url, token, tenant)
    out = {"foh": 0.0, "boh": 0.0, "pastry": 0.0, "other": 0.0}
    if not rep or not rep.get("Reports"):
        return out
    total_idx, section = None, ""
    for row in rep["Reports"][0].get("Rows", []):
        rt = row.get("RowType")
        if rt == "Header":
            cols = [c.get("Value", "") for c in row.get("Cells", [])]
            for i, cn in enumerate(cols):
                if cn.strip().lower() == "total":
                    total_idx = i
        elif rt == "Section":
            section = (row.get("Title") or "").lower()
            if "cost of sales" not in section:
                continue
            for rr in row.get("Rows", []):
                cells = [c.get("Value", "") for c in rr.get("Cells", [])]
                if not cells or "total" in cells[0].lower():
                    continue
                tot = f(cells[total_idx]) if (total_idx is not None and total_idx < len(cells)) else f(cells[-1])
                out[cogs_role(cells[0])] += tot
    return out


def square_role_sales(acc, d0, d1):
    body = json.dumps({"query": {
        "measures": ["ItemSales.item_net_sales"],
        "dimensions": ["ItemSales.local_date", "ItemSales.category_name"],
        "filters": [
            {"member": "ItemSales.location_id", "operator": "equals", "values": [acc["location_id"]]},
            {"member": "ItemSales.local_date", "operator": "inDateRange", "values": [d0, d1]},
        ],
    }}).encode()
    h = {"Authorization": "Bearer " + acc["token"], "Content-Type": "application/json"}
    data = None
    for _ in range(10):
        try:
            req = urllib.request.Request(LOAD_URL, data=body, headers=h, method="POST")
            with urllib.request.urlopen(req, timeout=30) as resp:
                r = json.loads(resp.read().decode())
        except Exception as e:
            print("  ! square error:", e); return {}
        if "data" in r:
            data = r["data"]; break
        time.sleep(2)
    out = {}
    for row in data or []:
        dt = (row.get("ItemSales.local_date") or "")[:10]
        cat = (row.get("ItemSales.category_name") or "").lower()
        v = f(row.get("ItemSales.item_net_sales"))
        if not dt:
            continue
        if "monthly pastry" in cat or "pastr" in cat:
            r = "pastry"
        elif "special" in cat:
            r = "foh"
        elif "food" in cat:
            r = "boh"
        elif ("beverage" in cat or "retail" in cat or "gift" in cat
              or "education" in cat or "class" in cat or "workshop" in cat):
            r = "foh"
        else:
            r = None
        out.setdefault(dt, {"foh": 0.0, "boh": 0.0, "pastry": 0.0})
        if r:
            out[dt][r] += v
    return out


def sum_role(rsales, d0, d1):
    out = {"foh": 0.0, "boh": 0.0, "pastry": 0.0}
    cur = d0
    while cur <= d1:
        di = cur.isoformat()
        if di in rsales:
            for r in out:
                out[r] += rsales[di][r]
        cur += timedelta(days=1)
    return out


def recent_weeks(today, n):
    this_mon = today - timedelta(days=today.weekday())
    out = []
    w = this_mon - timedelta(days=7)
    while len(out) < n:
        out.append((w, w + timedelta(days=6)))
        w -= timedelta(days=7)
    return out


def pct(v, b):
    return (v / b * 100) if b else 0


def cogs_card(rng, cogs, rs, K, is_month=False, sub=""):
    sales_tot = rs["foh"] + rs["boh"] + rs["pastry"]
    cogs_tot = cogs["foh"] + cogs["boh"] + cogs["pastry"] + cogs["other"]

    def line(label, amt, role_sales, role_kpi):
        rolep = pct(amt, role_sales)
        rcls = "over" if (role_kpi and rolep > role_kpi) else "ok"
        return ('<tr><td>{l}</td><td class="amt">${a:,.0f}</td>'
                '<td class="rolep {rc}">{rp:.0f}%</td><td class="tgt">{t:.0f}%</td></tr>').format(
            l=label, a=amt, rc=rcls, rp=rolep, t=(role_kpi or 0))

    tcls = "over" if pct(cogs_tot, sales_tot) > K["cogs_total"] else "ok"
    rows = ('<tr class="g"><td><b>TOTAL COGS</b></td><td class="amt"><b>${a:,.0f}</b></td>'
            '<td class="rolep {c}"><b>{p:.1f}%</b></td><td class="tgt">{t:.0f}%</td></tr>').format(
        a=cogs_tot, c=tcls, p=pct(cogs_tot, sales_tot), t=K["cogs_total"])
    rows += line("FOH COGS", cogs["foh"], rs["foh"], K["cogs_foh"])
    rows += line("BOH COGS", cogs["boh"], rs["boh"], K["cogs_boh"])
    rows += line("Pastry COGS", cogs["pastry"], rs["pastry"], K["cogs_pastry"])
    if cogs["other"] > 0:
        rows += line("Unsplit COGS", cogs["other"], sales_tot, None)

    cls = "card month" if is_month else "card"
    subtxt = '<span class="csub">{}</span>'.format(sub) if sub else ""
    hdr = ("&#128197; " + rng) if is_month else ("Week " + rng)
    return ('<div class="{cls}"><div class="ctitle">{h} {s}</div>'
            '<table class="t">{rows}</table></div>').format(cls=cls, h=hdr, s=subtxt, rows=rows)


def month_bounds(d):
    first = d.replace(day=1)
    last = (date(d.year, 12, 31) if d.month == 12 else date(d.year, d.month + 1, 1) - timedelta(days=1))
    return first, last


def main():
    print("loading settings ...")
    S = load_settings()
    today = datetime.now(BNE).date()
    weeks = recent_weeks(today, WEEKS)
    ordered = [n for n in DISPLAY_ORDER if n in _org_by_name]

    K = {k: S.get("kpi_" + k, dv) * 100 for k, dv in {
        "cogs_total": 0.30, "cogs_foh": 0.25, "cogs_boh": 0.25, "cogs_pastry": 0.25}.items()}

    wk1 = weeks[0][1]
    sq_start = weeks[-1][0].replace(day=1)
    rsales_by_store = {}
    for nm in ordered:
        acc = _acc_by_name.get(nm)
        if acc:
            print("square:", nm)
            rsales_by_store[nm] = square_role_sales(acc, sq_start.isoformat(), wk1.isoformat())

    wk_store = {}
    for nm in ordered:
        org = _org_by_name.get(nm)
        token = get_token(org)
        tenant = get_tenant(org, token) if token else None
        if not token or not tenant:
            continue
        print("xero week:", nm)
        slug = STORE_SLUG.get(nm)
        for (ws, we) in weeks:
            c = cogs_pl(org, token, tenant, ws.isoformat(), we.isoformat())
            if slug:
                c = apply_prep_cost(c, slug, S)
            rs = sum_role(rsales_by_store.get(nm, {}), ws, we)
            wk_store[(nm, ws)] = (c, rs)

    month_set = []
    for (ws, we) in weeks:
        mf, ml = month_bounds(ws)
        if (mf, ml) not in month_set:
            month_set.append((mf, ml))

    mo_store = {}
    for nm in ordered:
        org = _org_by_name.get(nm)
        token = get_token(org)
        tenant = get_tenant(org, token) if token else None
        if not token or not tenant:
            continue
        print("xero month:", nm)
        for (mf, ml) in month_set:
            c = cogs_pl(org, token, tenant, mf.isoformat(), ml.isoformat())
            rs = sum_role(rsales_by_store.get(nm, {}), mf, ml)
            mo_store[(nm, mf)] = (c, rs)

    def combine_wk(ws):
        c = {"foh": 0.0, "boh": 0.0, "pastry": 0.0, "other": 0.0}
        rs = {"foh": 0.0, "boh": 0.0, "pastry": 0.0}
        has = False
        for nm in ordered:
            d = wk_store.get((nm, ws))
            if d:
                has = True
                for r in c:
                    c[r] += d[0][r]
                for r in rs:
                    rs[r] += d[1][r]
        return (c, rs) if has else None

    def combine_mo(mf):
        c = {"foh": 0.0, "boh": 0.0, "pastry": 0.0, "other": 0.0}
        rs = {"foh": 0.0, "boh": 0.0, "pastry": 0.0}
        has = False
        for nm in ordered:
            d = mo_store.get((nm, mf))
            if d:
                has = True
                for r in c:
                    c[r] += d[0][r]
                for r in rs:
                    rs[r] += d[1][r]
        return (c, rs) if has else None

    nav = '<div class="nav">'
    views = ""
    tabs = [("combined", "&#128202; Review", "#7c3aed")] + \
           [(nm.lower().replace(" ", "-"), nm, STORE_COLOR.get(nm, "#6b7280")) for nm in ordered]

    for i, (sl, label, col) in enumerate(tabs):
        nm = None if sl == "combined" else [n for n in ordered if n.lower().replace(" ", "-") == sl][0]
        wk_html = ""
        for (ws, we) in weeks:
            d = combine_wk(ws) if sl == "combined" else wk_store.get((nm, ws))
            if d:
                rng = "{} &ndash; {}".format(ws.strftime("%d/%m"), we.strftime("%d/%m"))
                wk_html += cogs_card(rng, d[0], d[1], K)
        mo_html = ""
        for (mf, ml) in month_set:
            md = combine_mo(mf) if sl == "combined" else mo_store.get((nm, mf))
            if md:
                mo_html += cogs_card(mf.strftime("%B %Y"), md[0], md[1], K,
                                     is_month=True, sub="month total")
        body = ('<div class="cols"><div class="col-wk">'
                '<div class="collabel">WEEKLY</div>{w}</div>'
                '<div class="col-mo"><div class="collabel">MONTHLY</div>{m}</div></div>').format(
            w=wk_html or '<p class="empty">No data</p>',
            m=mo_html or '<p class="empty">No data</p>')
        if nm:
            # 지점 탭: 그 매장 매니저가 응답 (버튼 + 현재 상태, 재제출 = undo)
            body = ma_card(nm, MA_COGS.get(nm), MA_WEEK) + body
        else:
            # Review 탭: 오퍼레이션 매니저·총괄 셰프가 3매장 응답 상태 조회 + 통합 숫자
            ma_all = "".join(ma_card(n, MA_COGS.get(n), MA_WEEK, show_store=True, mode="status")
                             for n in ordered)
            body = ma_all + body

        nav += '<button class="navbtn{a}" onclick="sv(\'{s}\')" style="--c:{c}">{l}</button>'.format(
            a=(" on" if i == 0 else ""), s=sl, c=col, l=label)
        views += ('<div class="vw" id="v-{s}" style="display:{d}">'
                  '<h2><span class="dot" style="background:{c}"></span>{l} &middot; COGS (last {n} weeks)</h2>{b}</div>').format(
            s=sl, d=("block" if i == 0 else "none"), c=col, l=label, n=WEEKS, b=body)
    nav += '</div>'

    html = PAGE.replace("{{NAV}}", nav).replace("{{VIEWS}}", views).replace(
        "{{TS}}", datetime.now(BNE).strftime("%Y-%m-%d %H:%M"))
    os.makedirs(WEB_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fp:
        fp.write(html)
    print("[OK] ->", OUT)


PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Hideout - COGS</title>
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f4f1;color:#211d19}
main{max-width:1180px;margin:0 auto;padding:0 16px 56px}
.topbar{position:sticky;top:0;z-index:20;background:rgba(246,244,241,.95);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:3px solid #b45309}
.pagetag{font-size:11px;font-weight:800;color:#fff;border-radius:8px;padding:4px 10px;letter-spacing:.08em;vertical-align:middle;margin-left:6px}
.tbin{max-width:1180px;margin:0 auto;padding:10px 16px 0}
.tbrow{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
h1{font-size:16px;font-weight:800;margin:0;letter-spacing:-.01em;white-space:nowrap}
h1 span{color:#8a8378;font-weight:600}
.tblinks{display:flex;gap:6px}
.tblinks a{font-size:12px;font-weight:700;color:#4b4740;background:#fff;border:1px solid #e2ddd5;border-radius:999px;padding:6px 12px;text-decoration:none;white-space:nowrap}
.nav{display:flex;gap:6px;overflow-x:auto;padding:10px 0;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.nav::-webkit-scrollbar{display:none}
.navbtn{font:inherit;font-size:13px;font-weight:700;color:#4b4740;background:#fff;border:1px solid #e2ddd5;border-radius:999px;padding:9px 15px;cursor:pointer;white-space:nowrap;flex-shrink:0}
.navbtn:hover{background:#f1eee9}
.navbtn.on{background:var(--c,#211d19);color:#fff;border-color:var(--c,#211d19)}
h2{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;margin:0 0 12px;color:#211d19}
.dot{width:10px;height:10px;border-radius:99px;flex-shrink:0}
.sub{color:#8a8378;font-size:12px;margin:14px 2px}
details.howto{margin:0 0 14px}
.howto summary{cursor:pointer;font-size:12px;font-weight:700;color:#6f695f;padding:10px 14px;background:#fff;border:1px solid #e7e2db;border-radius:12px;list-style:none}
.howto summary::-webkit-details-marker{display:none}
.note{font-size:12px;color:#6f695f;background:#fff;border:1px solid #e7e2db;border-top:none;border-radius:0 0 12px 12px;padding:12px 16px;line-height:1.8;margin-top:-6px}
.macard{background:#fff;border:1px solid #e7e2db;border-left:4px solid #d97706;border-radius:14px;padding:12px 16px;margin-bottom:10px;box-shadow:0 1px 2px rgba(30,25,20,.04)}
.macard.good{border-left-color:#0f8a43}
.mahead{font-size:11px;letter-spacing:.07em;color:#8a6014;font-weight:800;margin-bottom:6px}
.macard.good .mahead{color:#0f8a43}
.maline{font-size:12.5px;color:#4b4740;margin:3px 0;line-height:1.55}
.marow{margin-top:10px;padding-top:8px;border-top:1px solid #f6f4f1}
.matop{display:flex;gap:8px;align-items:flex-start}
.maid{font-size:10px;font-weight:800;color:#8a8378;background:#f1eee9;border-radius:999px;padding:2px 8px;flex-shrink:0;margin-top:1px}
.matx{font-size:12.5px;color:#211d19;flex:1;line-height:1.5}
.mabtns{display:flex;gap:8px;align-items:center;margin-top:7px;flex-wrap:wrap}
.marole{font-size:9px;font-weight:800;border:1.5px solid;border-radius:6px;padding:1px 6px;flex-shrink:0;margin:2px 0 0 0;letter-spacing:.04em}
.mabtn{font-size:11px;font-weight:700;text-decoration:none;border-radius:999px;padding:5px 10px;white-space:nowrap}
.mabtn.ok{background:#e8f6ee;color:#0f8a43}
.mabtn.no{background:#fdeceb;color:#d2372c}
.machip{font-size:10px;font-weight:800;border-radius:999px;padding:3px 9px;white-space:nowrap;cursor:help}
.machip.done{background:#e8f6ee;color:#0f8a43}
.machip.prog{background:#fef3c7;color:#b45309}
.machip.cant{background:#fdeceb;color:#d2372c}
.machip.none{background:#f1eee9;color:#a39b8e}
.mareply{font-size:11.5px;color:#0f766e;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:8px;padding:6px 10px;margin-top:7px;line-height:1.5}
.madept{margin-top:10px;background:#faf9f7;border:1px solid #eee9e2;border-left:4px solid #6b7280;border-radius:10px;padding:10px 12px}
.madept .marow{border-top-color:#ece7df}
.mabig{font-size:11px;padding:3px 10px;border-radius:7px;letter-spacing:.05em}
.mahead2{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.mastore{font-size:11px;font-weight:800;color:#fff;border-radius:7px;padding:3px 10px;letter-spacing:.05em}
.mawk{font-size:10px;letter-spacing:.07em;color:#a39b8e;font-weight:800}
.mastat{font-size:10px;font-weight:800;border-radius:999px;padding:3px 10px;letter-spacing:.04em;margin-left:auto}
.mastat.need{background:#fef3c7;color:#8a6014}
.mastat.good{background:#e8f6ee;color:#0f8a43}
.madhead{display:flex;gap:8px;align-items:center;margin-bottom:3px}
.madst{font-size:9px;font-weight:800;border-radius:6px;padding:2px 7px;letter-spacing:.04em}
.madst.over{background:#fdeceb;color:#d2372c}
.madst.watch{background:#fef3c7;color:#b45309}
.madst.ok{background:#e8f6ee;color:#0f8a43}
.mamission{font-size:11px;color:#8a8177;font-style:italic;margin:-4px 0 8px}
details.mawhy{margin:2px 0 4px}
.mawhy summary{cursor:pointer;list-style:none;font-size:11px;font-weight:700;color:#8a8177;display:inline-block}
.mawhy summary::-webkit-details-marker{display:none}
.mawhy[open] summary{color:#4b4740}
.mawhy .maline{margin-top:4px}
.cols{display:flex;gap:14px;align-items:flex-start}
.col-wk{flex:1;min-width:0} .col-mo{flex:1;min-width:0}
.collabel{font-size:11px;letter-spacing:.07em;font-weight:800;color:#8a8378;margin:0 0 8px}
.card{background:#fff;border:1px solid #e7e2db;border-radius:16px;padding:14px 18px;margin-bottom:12px;box-shadow:0 1px 2px rgba(30,25,20,.04)}
.card.month{background:#f5f3ff;border-color:#ddd6fe}
.ctitle{font-size:14px;font-weight:800;margin-bottom:8px;color:#211d19}
.csub{font-size:11px;font-weight:600;color:#a39b8e;margin-left:6px}
table.t{border-collapse:collapse;width:100%;font-size:13px}
table.t td{padding:7px 8px;border-bottom:1px solid #f6f4f1;font-variant-numeric:tabular-nums}
table.t .amt{text-align:right;color:#4b4740;white-space:nowrap;width:100px}
table.t .rolep{text-align:right;font-weight:800;width:70px}
table.t .rolep.ok{color:#0f8a43} table.t .rolep.over{color:#d2372c}
table.t .tgt{text-align:right;color:#a39b8e;font-size:11px;width:48px}
tr.g td{background:#faf8f5;border-top:1px solid #e7e2db}
.card.month tr.g td{background:#ede9fe}
@media(max-width:760px){.cols{flex-direction:column}.tblinks a{padding:6px 9px}}
.empty{color:#a39b8e;padding:20px}
</style></head><body>
<header class="topbar"><div class="tbin">
<div class="tbrow"><h1>The Hideout <span class="pagetag" style="background:#b45309">&#129534; COGS</span></h1>
<div class="tblinks"><a href="https://hideoutdb.com/" target="_top">&#128202; Sales</a><a href="https://hideoutdb.com/roster.html" target="_top">&#128197; Roster</a><a href="https://order.hideoutdb.com" target="_top">&#129386; Orders</a><a href="https://hideoutdb.com/#voices" target="_top">&#128172; Voices</a><a href="https://hideoutdb.com/#meetings" target="_top">&#129309; Meetings</a></div></div>
{{NAV}}
</div></header>
<main>
<div class="sub">Weekly COGS as % of that role's sales &middot; purple card = month total &middot; KPI from Settings &middot; {{TS}}</div>
<div class="sub">&#9888; <b>Every week, no exceptions:</b> watch wastage closely, and keep staff meals within the $30 allowance per person. Over-ordering staff food shows up here as COGS.</div>
<details class="howto"><summary>&#8505; How to read this page</summary>
<div class="note"><b>When numbers are final:</b> a week's (Mon to Sun) costs are charged by suppliers the following week and settle by <b>Wednesday</b>, so judge last week's COGS from <b>Thursday</b>. Until then the latest week looks lower than reality.<br>
<b>THIS WEEK</b> card is our advice from the Thursday review. Reply with the Done / Can't do buttons.<br>
Weekly COGS swings are often supplier billing dates, not the kitchen. We judge week by week and flag only real patterns.</div></details>
{{VIEWS}}
</main>
<script>
function sv(id){
  document.querySelectorAll('.vw').forEach(function(v){v.style.display='none';});
  document.querySelectorAll('.navbtn').forEach(function(b){b.classList.remove('on');});
  document.getElementById('v-'+id).style.display='block';
  event.target.classList.add('on');
}
// 해시 딥링크: /cogs#adelaide-st 처럼 열면 해당 탭 자동 (매니저 북마크·QR용)
window.addEventListener('DOMContentLoaded',function(){
  var h=decodeURIComponent(location.hash.slice(1)); if(!h){return;}
  var bs=document.querySelectorAll('.navbtn');
  for(var i=0;i<bs.length;i++){var b=bs[i];
    if((b.getAttribute('onclick')||'').indexOf("'"+h+"'")>=0){b.click();break;}}
});
</script>
</body></html>"""


if __name__ == "__main__":
    main()