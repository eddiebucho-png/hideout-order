# partc.py - Owner P&L + Advisor (Combined + 3 stores, 평탄화, prep_cost, BG interest, tax, loan cash)
import json
import base64
import csv
import io
import time
import os
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone, date
from config import XERO_ORGS, SETTINGS_SHEET_CSV, ACCOUNTS

try:
    from xero_wage import wage_kpi_data
except Exception:
    def wage_kpi_data(*a, **k):
        return {"status": "no_org"}

try:
    import advisor as advisor_mod
except Exception as _e:
    print("  ! advisor module not loaded:", _e)
    advisor_mod = None

BNE = timezone(timedelta(hours=10))
TOKEN_URL = "https://identity.xero.com/connect/token"
ACC = "https://api.xero.com/api.xro/2.0"
SCOPES = "accounting.reports.profitandloss.read accounting.settings.read"
LOAD_URL = "https://connect.squareup.com/reporting/v1/load"
WEB_DIR = os.environ.get("DASH_OUT", r"C:\DashboardWeb")
# 오너 전용 사이트 출력 (Netlify Pro 비밀번호 보호). 미설정 시 기존처럼 WEB_DIR.
OWNER_DIR = os.environ.get("DASH_OWNER_OUT", WEB_DIR)
# OP 모드: Operation Manager(루크) 대시보드. OP_MODE=1 + DASH_OP_OUT 설정 시에만 동작.
# 켜지면 매장별 P&L 탭 숨기고 별도 폴더(op)로 출력. 안 켜면 오너 동작 그대로.
OP_MODE = os.environ.get("OP_MODE") == "1"
_OP_DIR = os.environ.get("DASH_OP_OUT", "")
if OP_MODE and _OP_DIR:
    OWNER_DIR = _OP_DIR
    OUT = os.path.join(_OP_DIR, "index.html")
else:
    OP_MODE = False
    OUT = os.path.join(OWNER_DIR, "index.html" if OWNER_DIR != WEB_DIR else "partc.html")

DISPLAY_ORDER = ["Adelaide St", "Edward St", "St Pauls Ter"]
STORE_COLOR = {"Adelaide St": "#2563eb", "Edward St": "#d97706", "St Pauls Ter": "#7c3aed"}
COMBINED_COLOR = "#0d9488"
HISTORY_START = "2024-03-01"

_token_cache, _tenant_cache, _catid_cache = {}, {}, {}
_acc_by_name = {a["name"]: a for a in ACCOUNTS}

ALL_SLUGS = ["adelaide", "edward", "stpauls"]
STORE_SLUG = {"Adelaide St": "adelaide", "Edward St": "edward", "St Pauls Ter": "stpauls"}


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
        print("  ! settings load error:", e)
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
            print("  ! api error:", e, "|", url[:110])
            return None


def catid(org, token, tenant):
    nm = org["name"]
    if nm in _catid_cache:
        return _catid_cache[nm]
    tc = api_get(ACC + "/TrackingCategories", token, tenant)
    cid = None
    for c in (tc or {}).get("TrackingCategories", []):
        if c.get("Status") == "ACTIVE" and "wage" in (c.get("Name", "").lower()):
            cid = c.get("TrackingCategoryID")
            break
    _catid_cache[nm] = cid
    return cid


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


def wage_role(name):
    n = name.lower()
    if "pastry" in n:
        return "pastry"
    if "director" in n:
        return "director"
    if "foh" in n:
        return "foh"
    if "boh" in n:
        return "boh"
    if "marketing" in n:
        return "marketing"
    if "admin" in n:
        return "admin"
    return None


def overhead_bucket(name):
    n = name.lower()
    if "bank" in n:
        return "Bank fees"
    if "parking" in n or "toll" in n:
        return "Parking/Toll"
    if "printing" in n or "stationery" in n:
        return "Printing & Stationery"
    if "kitchen" in n:
        return "Kitchen supplies"
    if "equipment" in n:
        return "Shop Equipment"
    if "shop" in n and ("supply" in n or "supplies" in n):
        if "boh" in n:
            return "BOH - Shop Supplies"
        return "FOH - Shop Supplies"
    if "subscription" in n:
        return "Subscriptions"
    if "insurance" in n:
        return "Insurance"
    if "licen" in n or "permit" in n or "regulat" in n:
        return "Licensing Fee"
    if "motor" in n or "vehicle" in n or "car " in n:
        return "Motor Vehicle Expenses"
    if "repair" in n or "maintenance" in n:
        return "Repairs & Maintenance"
    if "amenities" in n:
        return "Staff amenities"
    if "office" in n:
        return "Office expenses"
    if "cleaning" in n or "rubbish" in n or "shop service" in n or "newspaper" in n or "towel" in n or "grease" in n:
        return "Shop Services"
    return "Other overheads"


OVERHEAD_ORDER = ["Bank fees", "Parking/Toll", "Printing & Stationery", "Kitchen supplies",
                  "FOH - Shop Supplies", "BOH - Shop Supplies", "Shop Equipment", "Subscriptions",
                  "Insurance", "Licensing Fee", "Motor Vehicle Expenses", "Repairs & Maintenance",
                  "Staff amenities", "Office expenses", "Shop Services", "Other overheads"]

VARIABLE_OH = ("FOH - Shop Supplies", "BOH - Shop Supplies")
FLAT_12MO = ("Insurance", "Licensing Fee")


def parse_pl(org, token, tenant, d0, d1):
    cid = catid(org, token, tenant)
    url = ACC + "/Reports/ProfitAndLoss?fromDate={}&toDate={}".format(d0, d1)
    if cid:
        url += "&trackingCategoryID=" + cid
    rep = api_get(url, token, tenant)
    d = {
        "net_sales": 0.0,
        "invoiced": {},  # Xero 인보이스 매출 (구독·카트·기타) — 메인 Sales(Square 정산) 제외
        "cogs": {"foh": 0.0, "boh": 0.0, "pastry": 0.0, "other": 0.0, "_accounts": {}},
        "wage": {"foh": 0.0, "boh": 0.0, "pastry": 0.0, "marketing": 0.0, "admin": 0.0, "director": 0.0},
        "rent_base": 0.0, "outgoings": 0.0, "turnover_rent": 0.0,
        "overheads": {},
        "marketing_cost": 0.0,
        "interest": 0.0,
        "bg_interest": 0.0,
    }
    if not rep or not rep.get("Reports"):
        return d
    cols, total_idx, section = [], None, ""
    for row in rep["Reports"][0].get("Rows", []):
        rt = row.get("RowType")
        if rt == "Header":
            cols = [c.get("Value", "") for c in row.get("Cells", [])]
            for i, cn in enumerate(cols):
                if cn.strip().lower() == "total":
                    total_idx = i
        elif rt == "Section":
            section = (row.get("Title") or "").lower()
            for rr in row.get("Rows", []):
                cells = [c.get("Value", "") for c in rr.get("Cells", [])]
                if not cells:
                    continue
                name = cells[0]
                nlow = name.lower()
                tot = f(cells[total_idx]) if (total_idx is not None and total_idx < len(cells)) else f(cells[-1])
                if "income" in section:
                    if "total" in nlow:
                        continue
                    if "interest" in nlow:
                        d["bg_interest"] += tot
                    else:
                        d["net_sales"] += tot
                        # 메인 "Sales" 계정 = Square 정산분 (매출은 Square API로 보므로 제외).
                        # 그 외 income 계정 = 인보이스 매출 (Sale - Coffee cart, Subscription,
                        # Sales - Other 등) → 별도 보존 (Eddie 확정 2026-07-06)
                        if nlow.strip() != "sales" and tot != 0:
                            d["invoiced"][name] = d["invoiced"].get(name, 0.0) + tot
                    continue
                if "cost of sales" in section:
                    if "total" in nlow:
                        continue
                    d["cogs"][cogs_role(name)] += tot
                    d["cogs"]["_accounts"][name] = d["cogs"]["_accounts"].get(name, 0.0) + tot
                    continue
                if "operating expense" in section:
                    if "total" in nlow:
                        continue
                    if ("wage" in nlow) or ("salar" in nlow) or ("super" in nlow):
                        any_role = False
                        for i in range(1, len(cells)):
                            cn = cols[i] if i < len(cols) else ""
                            if cn.strip().lower() in ("total", "unassigned", ""):
                                continue
                            r = wage_role(cn)
                            if r:
                                d["wage"][r] += f(cells[i]); any_role = True
                        if not any_role:
                            d["wage"][wage_role(name) or "foh"] += tot
                        continue
                    if "turnover" in nlow:
                        d["turnover_rent"] += tot
                        continue
                    if "outgoing" in nlow or "electric" in nlow or "power" in nlow or "water" in nlow:
                        d["outgoings"] += tot
                        continue
                    if "rent" in nlow:
                        d["rent_base"] += tot
                        continue
                    if "marketing" in nlow or "advertis" in nlow:
                        d["marketing_cost"] += tot
                        continue
                    if "interest" in nlow:
                        d["interest"] += tot
                        continue
                    b = overhead_bucket(name)
                    d["overheads"][b] = d["overheads"].get(b, 0.0) + tot
    return d


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


def square_net_sales(acc, d0, d1):
    """Square 총 net sales (Orders.net_sales) — 매니저 대시보드 헤드라인과 동일 기준.
    partc 매출은 회계(Xero)가 아니라 이 Square 값으로 본다 (운영 현금흐름 관점)."""
    body = json.dumps({"query": {
        "measures": ["Orders.net_sales"],
        "dimensions": ["Orders.location_id"],
        "filters": [{"member": "Orders.local_date", "operator": "inDateRange", "values": [d0, d1]}],
        "segments": ["Orders.closed_checks"],
    }}).encode()
    h = {"Authorization": "Bearer " + acc["token"], "Content-Type": "application/json"}
    data = None
    for _ in range(10):
        try:
            req = urllib.request.Request(LOAD_URL, data=body, headers=h, method="POST")
            with urllib.request.urlopen(req, timeout=30) as resp:
                r = json.loads(resp.read().decode())
        except Exception as e:
            print("  ! square net error:", e)
            return 0.0
        if "data" in r:
            data = r["data"]
            break
        time.sleep(2)
    for row in data or []:
        if row.get("Orders.location_id") == acc["location_id"]:
            return f(row.get("Orders.net_sales"))
    return 0.0


def sum_role_sales(role_sales, d0, d1):
    out = {"foh": 0.0, "boh": 0.0, "pastry": 0.0}
    cur = d0
    while cur <= d1:
        di = cur.isoformat()
        if di in role_sales:
            for r in out:
                out[r] += role_sales[di][r]
        cur += timedelta(days=1)
    return out


def weekly_fixed(org, token, tenant, today):
    this_mon = today - timedelta(days=today.weekday())
    w4_end = this_mon - timedelta(days=1)
    w4_start = w4_end - timedelta(days=27)
    m12_end = today - timedelta(days=1)
    m12_start = m12_end - timedelta(days=364)
    p4 = parse_pl(org, token, tenant, w4_start.isoformat(), w4_end.isoformat())
    p12 = parse_pl(org, token, tenant, m12_start.isoformat(), m12_end.isoformat())
    fixed = {}
    fixed["Rent"] = p4["rent_base"] / 4
    fixed["Outgoings"] = p4["outgoings"] / 4
    fixed["Turnover Rent"] = p12["turnover_rent"] / 52
    oh = {}
    for b in OVERHEAD_ORDER:
        if b in VARIABLE_OH:
            continue
        if b in FLAT_12MO:
            oh[b] = p12["overheads"].get(b, 0.0) / 52
        else:
            oh[b] = p4["overheads"].get(b, 0.0) / 4
    bg_wk = p4["bg_interest"] / 4
    int_wk = p4["interest"] / 4  # 론 이자 (Xero 실측, 4주 평활)
    return fixed, oh, bg_wk, int_wk


def month_list(start_iso, today):
    y, m = int(start_iso[:4]), int(start_iso[5:7])
    out = []
    while True:
        first = date(y, m, 1)
        if first > today:
            break
        last = (date(y, 12, 31) if m == 12 else date(y, m + 1, 1) - timedelta(days=1))
        out.append((first, last))
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return out


def quarter_list(today, n=2):
    q_month = ((today.month - 1) // 3) * 3 + 1
    y, m = today.year, q_month
    out = []
    for _ in range(n):
        first = date(y, m, 1)
        em = m + 2
        last = (date(y, 12, 31) if em == 12 else date(y, em + 1, 1) - timedelta(days=1))
        out.append((first, last, "Q{} {}".format((m - 1) // 3 + 1, y)))
        m -= 3
        if m < 1:
            m += 12
            y -= 1
    return out


def year_list(today, start_year):
    out = []
    for y in range(today.year, start_year - 1, -1):
        out.append((date(y, 1, 1), date(y, 12, 31), str(y)))
    return out


def recent_weeks(today, n):
    this_mon = today - timedelta(days=today.weekday())
    out = []
    w = this_mon - timedelta(days=7)
    while len(out) < n:
        out.append((w, w + timedelta(days=6)))
        w -= timedelta(days=7)
    return out


def pct(v, base):
    return (v / base * 100) if base else 0


def _summary_from_row(item):
    """주간 row 튜플에서 JSON 요약을 뽑는다 (읽기 전용, 기존 계산값 그대로 사용).
    item 구조: (title, net_sales, cogs, wage, role_sales, fixed, oh,
                mkt, director, admin, intr, warn, bg)"""
    if len(item) == 2 and item[1] is None:
        return None
    (_title, ns, cogs, wage, rss, _fixed, _oh,
     _mkt, _dir, _admin, _intr, warn, _bg) = item[:13]
    inv = item[13] if len(item) > 13 else {}
    cogs_tot = cogs["foh"] + cogs["boh"] + cogs["pastry"] + cogs["other"]
    wage_tot = wage["foh"] + wage["boh"] + wage["pastry"]

    def r2(x):
        return round(x, 2)

    return {
        "net_sales": r2(ns),
        "wage": {"foh": r2(wage["foh"]), "boh": r2(wage["boh"]),
                 "pastry": r2(wage["pastry"]), "total": r2(wage_tot)},
        "wage_pct": {"foh_of_role_sales": r2(pct(wage["foh"], rss["foh"])),
                     "boh_of_role_sales": r2(pct(wage["boh"], rss["boh"])),
                     "pastry_of_role_sales": r2(pct(wage["pastry"], rss["pastry"])),
                     "total_of_net_sales": r2(pct(wage_tot, ns))},
        "cogs": {"foh": r2(cogs["foh"]), "boh": r2(cogs["boh"]),
                 "pastry": r2(cogs["pastry"]), "other": r2(cogs["other"]),
                 "total": r2(cogs_tot)},
        "cogs_pct": {"foh_of_role_sales": r2(pct(cogs["foh"], rss["foh"])),
                     "boh_of_role_sales": r2(pct(cogs["boh"], rss["boh"])),
                     "pastry_of_role_sales": r2(pct(cogs["pastry"], rss["pastry"])),
                     "total_of_net_sales": r2(pct(cogs_tot, ns))},
        "role_sales": {"foh": r2(rss["foh"]), "boh": r2(rss["boh"]),
                       "pastry": r2(rss["pastry"])},
        "cogs_accounts": {k: r2(v) for k, v in (cogs.get("_accounts") or {}).items()
                          if abs(v) >= 1},
        "invoiced_sales": {"total": r2(sum(inv.values())),
                           "accounts": {k: r2(v) for k, v in inv.items() if abs(v) >= 1}},
        "wage_not_yet_paid": bool(warn),
    }


def write_latest_json(weeks, ordered, comb_w, store_w, today):
    """전 매장 급여가 확정된 가장 최근 주의 매장별 + 합산 핵심 숫자를
    data/latest.json 에 저장. 급여 미확정 주(인건비가 0으로 잡혀 비율이
    실제보다 좋아 보이는 주)는 건너뛴다 — 인건비 판단용이므로 정확성이 우선.
    HTML 생성과 완전히 분리된 읽기 전용 단계 — 실패해도 대시보드엔 영향 없음."""
    # comb_w / store_w / weeks 는 모두 같은 주 순서(최근주 우선)로 정렬돼 있다.
    # comb_w[i] 의 warn(=급여 미지급)이 False면 그 주는 전 매장 급여가 확정된 것.
    chosen = None
    for i in range(min(len(comb_w), len(weeks))):
        item = comb_w[i]
        if len(item) == 2 and item[1] is None:
            continue
        if not item[11]:  # item[11] = warn. False = 전 매장 급여 확정
            chosen = i
            break
    payroll_confirmed = chosen is not None
    if chosen is None:
        chosen = 0  # 폴백: 확정된 주가 하나도 없으면 최근 주 (아래 플래그로 표시)
    ws0, we0 = weeks[chosen]
    out = {
        "as_of": today.isoformat(),
        "generated_at": datetime.now(BNE).strftime("%Y-%m-%d %H:%M"),
        "currency": "AUD",
        "period": {"type": "week",
                   "start": ws0.isoformat(), "end": we0.isoformat(),
                   "label": "{} – {}".format(ws0.strftime("%d/%m"), we0.strftime("%d/%m")),
                   "payroll_confirmed": payroll_confirmed,
                   "weeks_back": chosen},
        "stores": {},
    }
    comb = _summary_from_row(comb_w[chosen]) if chosen < len(comb_w) else None
    if comb:
        out["stores"]["Combined"] = comb
    for nm in ordered:
        rows = store_w.get(nm, [])
        s = _summary_from_row(rows[chosen]) if chosen < len(rows) else None
        if s:
            out["stores"][nm] = s
    data_dir = os.path.join(WEB_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    path = os.path.join(data_dir, "latest.json")
    with open(path, "w", encoding="utf-8") as jf:
        json.dump(out, jf, ensure_ascii=False, indent=2)
    print("[OK] ->", path)


def _weeks_summaries(rows, weeks, today=None):
    """주간 row 리스트 → advisor/JSON용 요약 리스트 (최근 주 먼저, 기존 계산값 재사용).
    today를 주면 cogs_not_final 플래그 계산: 그 주의 원가(=다음 주 지불분)는
    다음 주 수요일에 직불 인출이 끝난다(Eddie 확정) → 목요일부터 확정."""
    out = []
    for i, item in enumerate(rows):
        s = _summary_from_row(item)
        if not s:
            continue
        s["label"] = item[0]
        if i < len(weeks):
            s["week_start"] = weeks[i][0].isoformat()
            s["week_end"] = weeks[i][1].isoformat()
            if today is not None:
                # weeks[i][1] = 일요일. +4일 = 다음 주 목요일. 목요일 전이면 미확정.
                s["cogs_not_final"] = today < (weeks[i][1] + timedelta(days=4))
        out.append(s)
    return out


def write_advisor_json(weeks, ordered, comb_w, store_w, K, today):
    """주간 딥다이브(Claude)용 데이터 — 최근 4주 전 매장 요약 + KPI 목표를
    data/advisor-data.json 으로 저장. HTML 생성과 분리된 읽기 전용 단계."""
    out = {
        "as_of": today.isoformat(),
        "generated_at": datetime.now(BNE).strftime("%Y-%m-%d %H:%M"),
        "currency": "AUD",
        "kpi_targets_pct": {k: round(v, 2) for k, v in K.items()},
        "note": "weeks are most-recent-first; wage_not_yet_paid=true weeks understate wages",
        "stores": {"Combined": _weeks_summaries(comb_w, weeks, today)},
    }
    for nm in ordered:
        out["stores"][nm] = _weeks_summaries(store_w.get(nm, []), weeks, today)
    data_dir = os.path.join(WEB_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    path = os.path.join(data_dir, "advisor-data.json")
    with open(path, "w", encoding="utf-8") as jf:
        json.dump(out, jf, ensure_ascii=False, indent=2)
    print("[OK] ->", path)


# gid 제거 (2026-07-13): gid=223892282는 빈 탭 — 실제 응답은 기본(첫) 탭에 쌓임 (4주 오인 사고)
FEEDBACK_CSV = ("https://docs.google.com/spreadsheets/d/1hjgUHzEFnHb71QXKGqdSdEZAA62k0KRWWh3TjdXCPHQ"
                "/gviz/tq?tqx=out:csv&headers=1")

# 회의 구글 폼 응답 시트 CSV (Hideout Meeting Log, 2026-07-13 생성)
MEETINGS_CSV = ("https://docs.google.com/spreadsheets/d/1INkZiSAlVR5pRnyVx_SDRrSeivRMRbgDozOaEwjdSCI"
                "/gviz/tq?tqx=out:csv&headers=1&gid=1934569787")
MEETING_FORM_URL = ("https://docs.google.com/forms/d/e/"
                    "1FAIpQLScA6Pe6EYajLbn8XM7rBvJc-hswk8pgOUcZU9vcnZtcjWSsgQ/viewform")
MEETING_COLORS = {"Operation Manager": "#0e7490", "Store Manager": "#2563eb",
                  "Marketing": "#be185d", "Executive Chef": "#b45309", "기타": "#6b7280"}


def _fb_log():
    """feedback_log.json — Tim 분석 + 에디 확인 기록 (피드백 루프의 축적 데이터)"""
    try:
        with open("feedback_log.json", encoding="utf-8") as f:
            return json.load(f).get("entries") or []
    except Exception:
        return []


def _ma_index():
    """manager_actions.json에서 액션 ID -> (부서, 내용) 매핑 (v1/v2 스키마 겸용)"""
    m = {}
    try:
        with open("manager_actions.json", encoding="utf-8") as f:
            d = json.load(f)
    except Exception:
        return m
    for sec in ("sales", "roster", "cogs"):
        for _store, a in (d.get(sec) or {}).items():
            deps = a.get("departments")
            if deps:
                for dn, dv in deps.items():
                    for ac in (dv.get("actions") or []):
                        if ac.get("id"):
                            m[ac["id"]] = (dn, ac.get("text", ""))
            else:
                for ac in (a.get("actions") or []):
                    if ac.get("id"):
                        m[ac["id"]] = (ac.get("role", "ALL"), ac.get("text", ""))
    return m


def feedback_panel(today, en=False):
    """매니저 피드백 시트(구글 폼 응답)를 읽어 최근 2주 응답을 패널로 렌더.
    실패해도 빈 문자열 — 대시보드엔 영향 없음."""
    def L(ko, en_s):
        return en_s if en else ko
    try:
        req = urllib.request.Request(FEEDBACK_CSV, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read().decode("utf-8")
        rows = list(csv.reader(io.StringIO(text)))
    except Exception as e:
        print("  ! feedback read skipped:", e)
        return ""
    if not rows:
        return ""
    head = [h.strip().lower() for h in rows[0]]
    idx = {name: i for i, name in enumerate(head)}

    def col(r, key):
        i = idx.get(key)
        return r[i].strip() if i is not None and i < len(r) else ""

    raw = []
    for ri, r in enumerate(rows[1:]):
        try:
            d = datetime.strptime(col(r, "timestamp").split(" ")[0], "%m/%d/%Y").date()
        except (ValueError, IndexError):
            continue
        if (today - d).days > 14:
            continue
        raw.append((d, ri, col(r, "action id"), col(r, "store"),
                    col(r, "status"), col(r, "comment")))
    # 같은 액션 ID 재제출 시 최신 응답이 이긴다 (실수 눌렀으면 다시 제출 = undo)
    latest = {}
    for item in raw:  # 시트 순서 = 제출 순서, 뒤가 최신
        key = item[2] or "row{}".format(item[1])
        latest[key] = item
    out_rows = [(d, aid, st, status, cm) for (d, _ri, aid, st, status, cm)
                in latest.values()]
    out_rows.sort(key=lambda x: x[0], reverse=True)
    if not out_rows:
        inner = '<p class="stnote">' + L('최근 2주 응답 없음 — 매니저가 대시보드 버튼으로 응답하면 여기 자동으로 쌓인다.', 'No responses in the last 2 weeks — manager replies from the dashboard buttons show up here automatically.') + '</p>'
    else:
        trs = ""
        ma_idx = _ma_index()
        role_c = {"FOH": "#2563eb", "BOH": "#b45309", "PASTRY": "#7c3aed", "ALL": "#6b7280"}
        for d, aid, st, status, cm in out_rows[:20]:
            s = status.lower()
            cls = "ok" if s.startswith("done") else ("over" if s.startswith("can") else "")
            dept, txt = ma_idx.get(aid, ("", ""))
            dch = ""
            if dept:
                c = role_c.get(dept.upper(), "#6b7280")
                dch = (' <span style="font-size:9px;font-weight:800;color:{c};'
                       'border:1px solid {c};border-radius:6px;padding:0 5px">{d}</span>'
                       ).format(c=c, d=dept.upper())
            detail = ""
            if txt:
                detail = ('<div style="font-size:11px;color:#8a8378;font-weight:400;'
                          'max-width:360px;line-height:1.4">{}</div>').format(
                    txt[:110] + ("&hellip;" if len(txt) > 110 else ""))
            trs += ('<tr><td>{dt}</td><td><b>{a}</b>{dch}{detail}</td><td>{st}</td>'
                    '<td class="pct {c}">{stat}</td>'
                    '<td style="color:#6f695f;max-width:420px;white-space:pre-wrap;'
                    'word-break:break-word">{cm}</td></tr>').format(
                dt=d.strftime("%d/%m"), a=aid or "&ndash;", dch=dch, detail=detail,
                st=st.replace(" St", "").replace(" Ter", "") or "&ndash;",
                c=cls, stat=status or "&ndash;", cm=(cm or ""))
        inner = ('<table class="pl"><tr>'
                 '<td style="color:#8a8378">' + L('날짜', 'Date') + '</td><td style="color:#8a8378">' + L('액션', 'Action') + '</td>'
                 '<td style="color:#8a8378">' + L('매장', 'Store') + '</td><td style="color:#8a8378">' + L('상태', 'Status') + '</td>'
                 '<td style="color:#8a8378">' + L('코멘트', 'Comment') + '</td></tr>' + trs + '</table>')
    # 피드백 루프 로그: Tim 분석 → 에디 확인 → 매니저 회신 (feedback_log.json)
    log = _fb_log()
    if log:
        def _fb_block(e):
            ok = (e.get("eddie_decision") or "").lower() in ("approved", "ok", "confirmed")
            badge = '<span class="adv-badge {}">{}</span>'.format(
                "green" if ok else "amber", (L("에디 확인", "Owner OK") if ok else L("확인 대기", "Pending")))
            reply = e.get("reply_to_manager", "")
            return ('<div class="advcard {cls}"><div class="adv-title">{b}{aid} &middot; '
                    '{st} &middot; {stat} <span class="stidx">{wk}</span></div>'
                    '<div class="adv-bg"><b>' + L('매니저.', 'Manager.') + '</b> {cm}<br><b>' + L('Tim 분석.', 'Tim analysis.') + '</b> {an}{rep}'
                    '</div></div>').format(
                cls=("green" if ok else "amber"), b=badge, aid=e.get("action_id", ""),
                st=e.get("store", ""), stat=e.get("status", ""), wk=e.get("week", ""),
                cm=e.get("comment", "") or "&ndash;", an=e.get("tim_analysis", "") or "&ndash;",
                rep=("<br><b>" + L('매니저 회신.', 'Manager reply.') + "</b> " + reply) if (reply and ok) else "")

        entries = list(reversed(log))
        blocks = "".join(_fb_block(e) for e in entries[:5])
        if len(entries) > 5:
            blocks += ('<details class="adv-more"><summary>' + L('지난 분석 {}개 더 보기', '{} earlier analyses') + '</summary>{}'
                       '</details>').format(min(len(entries) - 5, 25),
                                            "".join(_fb_block(e) for e in entries[5:30]))
        inner += ('<h4>&#129504; ' + L('피드백 분석 로그 &middot; Tim 분석 &rarr; 에디 확인 &rarr; 매니저 회신 (딥다이브 데이터로 축적)',
                  'Feedback analysis log &middot; Tim analysis &rarr; owner OK &rarr; manager reply') + '</h4>' + blocks)
    return '<h4>&#128172; ' + L('매니저 피드백 (최근 2주, 매일 갱신)', 'Manager feedback (last 2 weeks, updated daily)') + '</h4>' + inner


def _read_web_json(name):
    """빌드 중 web/data/에 이미 생성된 JSON 읽기 (없으면 None — 실행 순서 의존)"""
    try:
        with open(os.path.join(WEB_DIR, "data", name), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _median(vals):
    s = sorted(vals)
    n = len(s)
    if not n:
        return 0
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2.0


COMPETE_BASE_WEEKS = ("2026-06-01", "2026-06-08")  # 경쟁자 신규 진입(Cubic 6월 말) 전 베이스라인
COMPETE_SETS = {
    "Edward St": "Maillard&middot;Cubic&middot;Anthology",
    "Adelaide St": "Industry Beans&middot;Edward Espresso&middot;Two Sons",
    "St Pauls Ter": "Allpress&middot;Supernova",
}


def _compete_section(am):
    title = ('<div class="ctitle">경쟁 압력 모니터 &middot; 평일 아침(6~11시) 주문수, '
             '베이스라인=6월 초 대비 지수 &middot; 지수&lt;90 = 그 상권 경쟁·요인 점검</div>')
    if not am or "Edward St" not in am:
        return ('<div class="card">' + title +
                '<div class="stnote">hourly.json 대기 중 — daily.yml에서 hourly_data.py가 '
                'partc.py보다 먼저 실행되면 다음 빌드부터 표시됩니다.</div></div>')
    stores = [n for n in ("Edward St", "Adelaide St", "St Pauls Ter") if n in am]
    wk_keys = sorted(am["Edward St"].keys())[-6:]
    base = {}
    for n in stores:
        b = [am[n][w]["orders"] for w in COMPETE_BASE_WEEKS if w in am.get(n, {})]
        base[n] = (sum(b) / len(b)) if b else None
    head = "".join('<td class="amt" style="color:#8a8378">{}</td>'.format(w[5:]) for w in wk_keys)
    rows = ""
    latest_idx = {}
    for n in stores:
        cells = ""
        for w in wk_keys:
            v = am.get(n, {}).get(w, {}).get("orders")
            if v is None or not base.get(n):
                cells += '<td class="amt">&ndash;</td>'
                continue
            idx = v / base[n] * 100
            if w == wk_keys[-1]:
                latest_idx[n] = idx
            cls = "over" if idx < 90 else ""
            cells += '<td class="amt {c}">{v:,} <span class="stidx">({i:.0f})</span></td>'.format(
                c=cls, v=int(v), i=idx)
        rows += "<tr><td>{}</td>{}</tr>".format(n.replace(" St", "").replace(" Ter", ""), cells)
    verdict = ""
    if latest_idx:
        low = {n: v for n, v in latest_idx.items() if v < 90}
        high_ok = [v for n, v in latest_idx.items() if n not in low]
        if not low:
            verdict = ('<div class="stnote">특이 신호 없음 — 전 매장 지수 90 이상 '
                       '(최저 {:.0f}).</div>'.format(min(latest_idx.values())))
        elif len(low) == len(latest_idx):
            verdict = ('<div class="stnote">전 매장 동반 하락 — 특정 경쟁자보다 '
                       '시장/계절 요인(방학 등) 우세.</div>')
        else:
            lines = ""
            for n, v in low.items():
                lines += ('<div class="stnote" style="color:#d2372c;font-weight:700">'
                          '{s} 아침 지수 {i:.0f} — 이 매장만 이탈. 상권 경쟁({c}) 또는 '
                          '해당 상권 요인 점검. 주간 리뷰 참조.</div>').format(
                    s=n.replace(" St", "").replace(" Ter", ""), i=v,
                    c=COMPETE_SETS.get(n, ""))
            verdict = lines
    return ('<div class="card">' + title +
            '<table class="pl"><tr><td></td>' + head + '</tr>' + rows + '</table>' +
            verdict + '</div>')


def _menu_section(menu):
    title = '<div class="ctitle">메뉴 엔지니어링 &middot; 이번 달 Combined (판매 데이터 기준, 원가 미반영)</div>'
    if not menu:
        return ('<div class="card">' + title +
                '<div class="stnote">menu.json 대기 중 — build_dashboard.py 업로드 후 다음 빌드부터 표시됩니다.</div></div>')
    items = [x for x in (menu.get("stores", {}).get("Combined") or []) if x.get("qty", 0) >= 5]
    if len(items) < 8:
        return ('<div class="card">' + title +
                '<div class="stnote">월초라 표본 부족 — 데이터가 쌓이면 자동 표시됩니다 ({}).</div></div>').format(
            menu.get("range", ""))
    medn = _median([x["net"] for x in items])
    medq = _median([x["qty"] for x in items])
    stars = sorted([x for x in items if x["net"] >= medn and x["qty"] >= medq], key=lambda x: -x["net"])
    puzzles = sorted([x for x in items if x["net"] >= medn and x["qty"] < medq], key=lambda x: -x["net"])
    horses = sorted([x for x in items if x["net"] < medn and x["qty"] >= medq], key=lambda x: -x["qty"])
    dogs = sorted([x for x in items if x["net"] < medn and x["qty"] < medq], key=lambda x: x["net"])

    def lst(xs, n=6):
        return '<ul class="adv-act">' + "".join(
            '<li>{} <span class="stidx">${:,.0f} &middot; {:.0f}개</span></li>'.format(
                x["item"][:36], x["net"], x["qty"]) for x in xs[:n]) + '</ul>'

    quad = ('<div class="strat-grid">'
            '<div class="advcard green"><div class="adv-title">&#11088; Stars — 유지·전면 배치</div>{}</div>'
            '<div class="advcard info"><div class="adv-title">&#129513; Puzzles — 돈은 되는데 덜 팔림 (노출·추천 강화)</div>{}</div>'
            '<div class="advcard amber"><div class="adv-title">&#128014; Workhorses — 많이 팔리는데 돈이 안 됨 (가격·세트 검토)</div>{}</div>'
            '<div class="advcard red"><div class="adv-title">&#128062; Dogs — 컷/리워크 후보</div>{}</div>'
            '</div>').format(lst(stars), lst(puzzles), lst(horses), lst(dogs))
    return ('<div class="card">' + title + quad +
            '<div class="stnote">기준: 이번 달({}) 매출·수량 중앙값. 5개 미만 판매 아이템 제외. '
            '시즌 스페셜은 감안해서 볼 것.</div></div>').format(menu.get("range", ""))


def _load_meetings():
    """meetings.json — Tim이 정리한 회의 기록 (스키마는 파일 note 참조)"""
    try:
        with open("meetings.json", encoding="utf-8") as f:
            return json.load(f).get("meetings") or []
    except Exception:
        return []


def _meeting_form_rows():
    """회의 구글 폼 응답 시트(CSV) 원본 — Tim 정리(meetings.json 등록) 전 제출분"""
    if not MEETINGS_CSV:
        return []
    try:
        req = urllib.request.Request(MEETINGS_CSV, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read().decode("utf-8")
        rows = list(csv.reader(io.StringIO(text)))
    except Exception as e:
        print("  ! meetings form read skipped:", e)
        return []
    if len(rows) < 2:
        return []
    head = [h.strip().lower() for h in rows[0]]

    def col(r, *keys):
        for k in keys:
            for i, hname in enumerate(head):
                if k in hname and i < len(r):
                    return r[i].strip()
        return ""

    out = []
    for r in rows[1:]:
        title = col(r, "meeting name", "회의 이름", "회의명", "title")
        if not title:
            continue
        out.append({"ts": col(r, "timestamp", "타임스탬프"),
                    "title": title,
                    "type": col(r, "type", "종류") or "기타",
                    "attendees": col(r, "attendee", "참석"),
                    "date": col(r, "date", "날짜"),
                    "notes": col(r, "note", "내용"),
                    "actions": col(r, "action", "액션", "할 일")})
    return out


def _esc_pre(s):
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_meetings_view(today, en=False):
    def L(ko, en_s):
        return en_s if en else ko
    h = '<h2><span class="dot" style="background:#0e7490"></span>Meetings</h2>'
    h += ('<div class="sub">' + L(
        '회의 후 폼으로 제출하면 "정리 대기"로 들어오고, Tim이 요약·결정·'
        '액션(담당/마감)을 뽑아 목록에 올린다. 맨 위 표 = 전 회의에서 나온 해야 할 것들 '
        '통합 (주간 브리핑에도 포함). 완료 처리나 수정은 Tim에게 말하면 된다. '
        '매니저 Sales 페이지에도 Meetings 탭이 있음 — 민감한 회의는 Tim에게 '
        '"owner만"이라고 하면 매니저 탭에선 숨겨진다.',
        'After a meeting, submit the form and it lands under "waiting for summary"; '
        'Tim then writes a clean summary with decisions and actions (owner/due) into the list. '
        'The table at the top = all open action items across meetings (also in the weekly brief). '
        'To mark something done or fix it, tell Tim.') + '</div>')
    h += ('<a class="mtformbtn" target="_blank" href="{u}">&#9998; '
          + L('회의 기록 작성 (폼 열기)', 'Log a meeting (open form)')
          + '</a>').format(u=MEETING_FORM_URL)
    meetings = sorted(_load_meetings(), key=lambda m: m.get("date", ""), reverse=True)
    # 1) 통합 액션 롤업 — 전 회의 open 액션, 마감일순 (Tim 주간 브리핑도 이 데이터를 읽음)
    acts = []
    for m in meetings:
        for a in (m.get("actions") or []):
            if (a.get("status") or "open").lower() in ("done", "closed", "cancelled"):
                continue
            acts.append((a.get("due") or "9999-12-31", a.get("text", ""),
                         a.get("owner", ""), m.get("title", "")))
    acts.sort()
    if acts:
        trs = ""
        for due, text, owner, mt in acts[:20]:
            overdue = due != "9999-12-31" and due < today.isoformat()
            dd = "&ndash;" if due == "9999-12-31" else due[5:].replace("-", "/")
            trs += ('<tr><td class="pct {c}">{d}</td><td>{t}</td><td>{o}</td>'
                    '<td style="color:#8a8378">{m}</td></tr>').format(
                c=("over" if overdue else ""), d=dd, t=_esc_pre(text),
                o=_esc_pre(owner), m=_esc_pre(mt))
        more_note = ((' &middot; ' + L('외 {}건 (회의 카드에서 확인)', '+{} more (see meeting cards)').format(len(acts) - 20))
                     if len(acts) > 20 else "")
        h += ('<div class="card"><div class="ctitle">'
              + L('해야 할 것들 &middot; 전 회의 통합, 마감일순', 'To do &middot; all meetings, by due date') + '</div>'
              '<table class="pl"><tr><td style="color:#8a8378">' + L('마감', 'Due') + '</td>'
              '<td style="color:#8a8378">' + L('액션', 'Action') + '</td><td style="color:#8a8378">' + L('담당', 'Owner') + '</td>'
              '<td style="color:#8a8378">' + L('회의', 'Meeting') + '</td></tr>' + trs + '</table>'
              '<div class="stnote">' + L('빨간 날짜 = 마감 지남', 'Red date = overdue') + '{}.</div></div>'.format(more_note))
    # 2) 종류 필터 칩
    types = []
    for m in meetings:
        t = m.get("type", "기타")
        if t not in types:
            types.append(t)
    if types:
        chips = '<button class="mtc on" data-mt="all" onclick="mtF(\'all\')">All</button>' + "".join(
            '<button class="mtc" data-mt="{t}" onclick="mtF(\'{t}\')">{t}</button>'.format(t=_esc_pre(t))
            for t in types)
        h += '<div class="pillrow" id="mtchips">' + chips + '</div>'
    # 3) 회의 카드 — 최근 5개는 펼쳐서, 그 이전은 접어서
    if not meetings:
        h += ('<div class="card"><div class="stnote">' + L(
            '아직 정리된 회의가 없다. 회의 후 폼으로 제출하거나 Tim에게 내용을 주면 여기 쌓인다.',
            'No meetings logged yet. Submit the form after a meeting or give Tim the notes and they will show here.')
            + '</div></div>')

    def _mtg_card(m):
        t = m.get("type", "기타")
        c = MEETING_COLORS.get(t, "#6b7280")
        att = m.get("attendees") or []
        att = ", ".join(att) if isinstance(att, list) else str(att)
        dec = "".join("<li>{}</li>".format(_esc_pre(x)) for x in (m.get("decisions") or []))
        dec_html = ('<div class="mtlabel">' + L('결정', 'Decisions') + '</div><ul class="adv-act">' + dec + '</ul>') if dec else ""
        arows = ""
        for a in (m.get("actions") or []):
            st = (a.get("status") or "open").lower()
            ok = st in ("done", "closed")
            due = a.get("due") or ""
            arows += ('<li>{t} <span class="stidx">{o}{d}</span> '
                      '<span class="adv-badge {c}">{s}</span></li>').format(
                t=_esc_pre(a.get("text", "")), o=_esc_pre(a.get("owner", "")),
                d=(" &middot; ~" + due[5:].replace("-", "/")) if due else "",
                c=("green" if ok else "amber"), s=("done" if ok else "open"))
        act_html = ('<div class="mtlabel">' + L('액션', 'Actions') + '</div><ul class="adv-act">' + arows + '</ul>') if arows else ""
        notes = m.get("notes", "")
        notes_html = ('<div class="adv-bg" style="white-space:pre-wrap">{}</div>'.format(
            _esc_pre(notes))) if notes else ""
        return ('<div class="card mtg" data-mt="{t}">'
                '<div class="ctitle"><span class="adv-badge" style="background:{c}1a;color:{c}">{t}</span> '
                '{title} <span class="stidx">{date}{att}</span></div>'
                '{notes}{dec}{act}</div>').format(
            t=_esc_pre(t), c=c, title=_esc_pre(m.get("title", "")),
            date=m.get("date", ""), att=(" &middot; " + _esc_pre(att)) if att else "",
            notes=notes_html, dec=dec_html, act=act_html)

    for m in meetings[:5]:
        h += _mtg_card(m)
    if len(meetings) > 5:
        older = "".join(_mtg_card(m) for m in meetings[5:50])
        h += ('<details class="adv-more"><summary>'
              + L('지난 회의 {}개 더 보기', '{} earlier meetings')
              + '</summary>{}</details>').format(min(len(meetings) - 5, 45), older)
    # 4) 폼 제출 원본 (Tim 정리 전) — meetings.json의 form_ts에 등록되면 숨김
    forms = _meeting_form_rows()
    done_ts = {m.get("form_ts") for m in meetings if m.get("form_ts")}
    raw = [fr for fr in forms if fr["ts"] and fr["ts"] not in done_ts]
    if raw:
        rcards = ""
        for fr in raw[:15]:
            rcards += ('<div class="advcard info"><div class="adv-title">{t} '
                       '<span class="stidx">{d} &middot; {a} &middot; ' + L('제출', 'submitted') + ' {ts}</span></div>'
                       '<div class="adv-bg" style="white-space:pre-wrap">{n}</div>{ac}</div>').format(
                t=_esc_pre(fr["title"]), d=_esc_pre(fr["date"]), a=_esc_pre(fr["attendees"]),
                ts=_esc_pre(fr["ts"]),
                n=_esc_pre(fr["notes"]),
                ac=('<div class="adv-bg"><b>' + L('액션(원문).', 'Actions (raw).') + '</b> ' + _esc_pre(fr["actions"]) + '</div>')
                if fr["actions"] else "")
        h += ('<div class="card"><div class="ctitle">&#128229; '
              + L('폼 제출 원본 &middot; Tim 정리 대기', 'Submitted &middot; waiting for Tim\'s summary') + '</div>'
              '<div class="stnote">'
              + L('Tim이 다음 세션에서 요약·액션 추출해 위 목록으로 올린다.',
                  'Tim will summarise and pull actions into the list above next session.') + '</div>'
              + rcards + '</div>')
    elif not MEETINGS_CSV:
        h += ('<div class="card"><div class="stnote">' + L(
            '회의 제출 폼이 아직 연결 안 됨 — 구글 폼을 만들어 응답 시트 CSV URL을 partc.py의 '
            'MEETINGS_CSV에 넣으면 제출 원본이 여기 표시된다. 그 전에도 Tim에게 회의 내용을 직접 주면 기록된다.',
            'Meeting form not connected yet.') + '</div></div>')
    return h


def build_op_strategy_view(store_w, comb_w, ordered):
    """Operation Manager(Luke) FOH Strategy — English. Sales trend + customer service + FOH actions."""
    h = '<h2><span class="dot" style="background:#6d28d9"></span>FOH Strategy</h2>'
    # 1) Sales Trend (last 4 weeks, Square net)
    all_rows = [("Combined", comb_w)] + [(n, store_w.get(n, [])) for n in ordered]
    labels, body = "", ""
    if comb_w:
        tl = [it[0].replace("Week ", "") for it in comb_w]
        labels = "".join('<td class="amt" style="color:#8a8378">{}</td>'.format(t) for t in reversed(tl))
    for nm, rows in all_rows:
        ns = [(it[1] if not (len(it) == 2 and it[1] is None) else None) for it in rows]
        cells = "".join('<td class="amt">{}</td>'.format(
            "${:,.0f}".format(v) if v else "&ndash;") for v in reversed(ns))
        if len(ns) >= 2 and ns[0] and ns[1]:
            p = (ns[0] / ns[1] - 1) * 100
            wow = '<td class="pct {}">{:+.1f}%</td>'.format("ok" if p >= 0 else "over", p)
        else:
            wow = "<td></td>"
        body += "<tr><td>{}</td>{}{}</tr>".format(
            nm.replace(" St", "").replace(" Ter", ""), cells, wow)
    h += ('<div class="card"><div class="ctitle">Sales Trend &middot; last 4 weeks (Square net)</div>'
          '<table class="pl"><tr><td></td>{}<td style="color:#8a8378">WoW</td></tr>{}</table>'
          '<div class="stnote">Grow sales: watch week-on-week per store. Cost % detail is in the COGS tab.</div></div>').format(labels, body)
    # 2) Customer Service (Google reviews — service quality)
    try:
        with open("reviews.json", encoding="utf-8") as rf:
            rv = json.load(rf)
    except Exception:
        rv = None
    if rv:
        ov = rv.get("overall") or {}
        cards = ""
        for nm, sd in (rv.get("stores") or {}).items():
            cards += ('<div class="status-card"><b>{n}</b><br>&#11088; {r} '
                      '<span class="stidx">({c} total)</span></div>').format(
                n=nm, r=sd.get("rating", "&ndash;"), c=sd.get("count", 0))
        th = ""
        for t in (rv.get("themes") or []):
            fix = (t.get("kind") == "fix")
            act = ('<div class="adv-bg"><b>Do this.</b> ' + _esc_pre(t.get("action", "")) + '</div>') if t.get("action") else ""
            th += ('<div class="advcard {c}"><div class="adv-title">{i} {ti}</div>'
                   '<div class="adv-bg">{no}</div>{a}</div>').format(
                c=("amber" if fix else "green"), i=("&#9888;" if fix else "&#128077;"),
                ti=_esc_pre(t.get("title", "")), no=_esc_pre(t.get("note", "")), a=act)
        h += ('<div class="card"><div class="ctitle">Customer Service &middot; {w} &middot; '
              '{nr} new reviews, avg &#11088; {av}</div>'
              '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">{cards}</div>'
              '{th}</div>').format(w=rv.get("week", ""), nr=ov.get("new_reviews", 0),
                                   av=ov.get("avg_stars", "&ndash;"), cards=cards, th=th)
    return h


def build_strategy_view(store_w, comb_w, ordered):
    h = '<h2><span class="dot" style="background:#6d28d9"></span>Strategy</h2>'
    # 0) SWOT/전략 브리프 임베드 (전략 부서 리포트 기반, 딥다이브에서 갱신)
    try:
        with open("strategy_brief.html", encoding="utf-8") as bf:
            h += '<div class="adv-review">' + bf.read() + '</div>'
    except Exception:
        h += ('<div class="card"><div class="stnote">strategy_brief.html 없음 — '
              'SWOT/경쟁 지형 브리프는 파일이 리포에 올라오면 표시됩니다.</div></div>')
    # 1) 매출 흐름 (최근 4주, Square net)
    all_rows = [("Combined", comb_w)] + [(n, store_w.get(n, [])) for n in ordered]
    labels, body = "", ""
    if comb_w:
        tl = [it[0].replace("Week ", "") for it in comb_w]
        labels = "".join('<td class="amt" style="color:#8a8378">{}</td>'.format(t) for t in reversed(tl))
    for nm, rows in all_rows:
        ns = [(it[1] if not (len(it) == 2 and it[1] is None) else None) for it in rows]
        cells = "".join('<td class="amt">{}</td>'.format(
            "${:,.0f}".format(v) if v else "&ndash;") for v in reversed(ns))
        if len(ns) >= 2 and ns[0] and ns[1]:
            p = (ns[0] / ns[1] - 1) * 100
            wow = '<td class="pct {}">{:+.1f}%</td>'.format("ok" if p >= 0 else "over", p)
        else:
            wow = "<td></td>"
        body += "<tr><td>{}</td>{}{}</tr>".format(
            nm.replace(" St", "").replace(" Ter", ""), cells, wow)
    h += ('<div class="card"><div class="ctitle">매출 흐름 &middot; 최근 4주 (Square net)</div>'
          '<table class="pl"><tr><td></td>{}<td style="color:#8a8378">WoW</td></tr>{}</table>'
          '<div class="stnote">증감의 원인 해석은 Advisor 탭의 주간 딥다이브 리뷰 참고.</div></div>').format(labels, body)
    # 2) 경쟁 압력 모니터 (전 매장 상권)
    hj = _read_web_json("hourly.json")
    h += _compete_section((hj or {}).get("weekly_am") or {})
    # 3) 메뉴 엔지니어링
    h += _menu_section(_read_web_json("menu.json"))
    return h


def row(label, amount, base, target_pct=None, indent=0, role_pct=None, role_target=None):
    p = pct(amount, base)
    cls = ("over" if (target_pct and p > target_pct) else "ok") if target_pct else ""
    pad = 12 + indent * 18
    rp = ""
    if role_pct is not None:
        rcls = ("over" if (role_target and role_pct > role_target) else "ok") if role_target else ""
        rp = '<span class="rolep {c}">{p:.0f}% of role</span>'.format(c=rcls, p=role_pct)
    tgt = '<span class="tgt">{:.0f}%</span>'.format(target_pct) if target_pct else ""
    return ('<tr><td style="padding-left:{pad}px">{nm} {rp}</td>'
            '<td class="amt">${a:,.0f}</td><td class="pct {cls}">{p:.1f}%</td>'
            '<td>{tgt}</td></tr>').format(pad=pad, nm=label, rp=rp, a=amount, cls=cls, p=p, tgt=tgt)


def grp(label, amount, base, target_pct):
    p = pct(amount, base)
    cls = "over" if (target_pct and p > target_pct) else "ok"
    tgt = '<span class="tgt">{:.0f}%</span>'.format(target_pct) if target_pct else ""
    return ('<tr class="g"><td><b>{l}</b></td><td class="amt"><b>${a:,.0f}</b></td>'
            '<td class="pct {c}"><b>{p:.1f}%</b></td><td>{t}</td></tr>').format(
        l=label, a=amount, c=cls, p=p, t=tgt)


def render_card(title, ns, cogs, wage, role_sales_sum, fixed, oh,
                mkt, director, admin, interest, K, warn=False,
                bg_interest=0, loan_interest=0, loan_principal=0, tax_rate=0, show_cash=False,
                invoiced=None):
    cogs_tot = cogs["foh"] + cogs["boh"] + cogs["pastry"] + cogs["other"]
    wage_tot = wage["foh"] + wage["boh"] + wage["pastry"]
    rent_tot = fixed.get("Rent", 0) + fixed.get("Outgoings", 0) + fixed.get("Turnover Rent", 0)
    oh_tot = sum(oh.values())
    inv_tot = sum((invoiced or {}).values())
    notes = []
    rs = role_sales_sum

    h = '<tr class="g"><td>NET SALES (Square)</td><td class="amt">${:,.0f}</td><td>100%</td><td></td></tr>'.format(ns)
    if inv_tot > 0:
        # 인보이스 매출 (Xero: 구독·카트·기타) — KPI % 분모엔 미포함, 이익에는 가산
        inv_items = ", ".join(sorted((invoiced or {}).keys()))[:80]
        h += ('<tr class="g"><td><b>INVOICED SALES</b> <span class="tgt" title="{ti}">Xero &middot; '
              'not in % base</span></td><td class="amt"><b>+${a:,.0f}</b></td>'
              '<td class="pct ok"></td><td></td></tr>').format(ti=inv_items, a=inv_tot)

    h += grp("WAGE", wage_tot, ns, K["wage_total"])
    h += row("FOH wage", wage["foh"], ns, indent=1,
             role_pct=pct(wage["foh"], rs["foh"]), role_target=K["wage_foh"])
    h += row("BOH wage", wage["boh"], ns, indent=1,
             role_pct=pct(wage["boh"], rs["boh"]), role_target=K["wage_boh"])
    h += row("Pastry wage", wage["pastry"], ns, indent=1,
             role_pct=pct(wage["pastry"], rs["pastry"]), role_target=K["wage_pastry"])
    if pct(wage_tot, ns) > K["wage_total"]:
        notes.append("Wage {:.0f}% &gt; {:.0f}%".format(pct(wage_tot, ns), K["wage_total"]))

    h += grp("COGS", cogs_tot, ns, K["cogs_total"])
    h += row("FOH COGS", cogs["foh"], ns, indent=1,
             role_pct=pct(cogs["foh"], rs["foh"]), role_target=K["cogs_foh"])
    h += row("BOH COGS", cogs["boh"], ns, indent=1,
             role_pct=pct(cogs["boh"], rs["boh"]), role_target=K["cogs_boh"])
    h += row("Pastry COGS", cogs["pastry"], ns, indent=1,
             role_pct=pct(cogs["pastry"], rs["pastry"]), role_target=K["cogs_pastry"])
    if cogs["other"] > 0:
        h += row("Unsplit COGS", cogs["other"], ns, indent=1)
    if pct(cogs_tot, ns) > K["cogs_total"]:
        notes.append("COGS {:.0f}% &gt; {:.0f}%".format(pct(cogs_tot, ns), K["cogs_total"]))

    h += grp("RENT + OUTGOINGS", rent_tot, ns, K["rent"])
    h += row("Rent", fixed.get("Rent", 0), ns, indent=1)
    h += row("Outgoings", fixed.get("Outgoings", 0), ns, indent=1)
    if fixed.get("Turnover Rent", 0) > 0:
        h += row("Turnover Rent", fixed["Turnover Rent"], ns, indent=1)
    if pct(rent_tot, ns) > K["rent"]:
        notes.append("Rent {:.0f}% &gt; {:.0f}%".format(pct(rent_tot, ns), K["rent"]))

    h += grp("OVERHEADS", oh_tot, ns, K["overheads"])
    for b in OVERHEAD_ORDER:
        if oh.get(b, 0) > 0:
            h += row(b, oh[b], ns, indent=1)
    if pct(oh_tot, ns) > K["overheads"]:
        big = max(oh.items(), key=lambda x: x[1], default=("", 0))
        notes.append("Overheads {:.0f}% &gt; {:.0f}%{}".format(
            pct(oh_tot, ns), K["overheads"], " ({} top)".format(big[0]) if big[0] else ""))

    h += grp("MARKETING", mkt, ns, K["marketing"])
    if pct(mkt, ns) > K["marketing"]:
        notes.append("Marketing {:.0f}% &gt; {:.0f}%".format(pct(mkt, ns), K["marketing"]))

    if director > 0:
        h += grp("DIRECTOR PAYMENT", director, ns, None)
    if admin > 0:
        h += grp("ADMIN", admin, ns, None)

    # 론 이자: Xero 실측(interest, 매장별 계정)이 있으면 그걸 쓰고,
    # 없으면 Settings 값(loan_interest, Combined 전용 폴백) — 이중 계상 방지
    li = interest if interest > 0 else loan_interest
    if li > 0:
        h += grp("LOAN INTEREST", li, ns, None)
    if bg_interest > 0:
        h += ('<tr class="g"><td><b>BG INTEREST (income)</b></td>'
              '<td class="amt"><b>+${a:,.0f}</b></td>'
              '<td class="pct ok"><b>{p:.1f}%</b></td><td></td></tr>').format(
            a=bg_interest, p=pct(bg_interest, ns))

    op_profit = (ns + inv_tot - cogs_tot - wage_tot - rent_tot - oh_tot
                 - mkt - director - admin - li + bg_interest)

    if show_cash:
        opcls = "ok" if op_profit >= 0 else "over"
        h += ('<tr class="g profit"><td><b>OPERATING PROFIT</b></td><td class="amt"><b>${:,.0f}</b></td>'
              '<td class="pct {c}"><b>{p:.1f}%</b></td><td></td></tr>').format(
            op_profit, c=opcls, p=pct(op_profit, ns))
        tax = op_profit * tax_rate if op_profit > 0 else 0
        h += row("Company tax ({:.0f}%)".format(tax_rate * 100), tax, ns, indent=1)
        after_tax = op_profit - tax
        h += ('<tr class="g"><td><b>PROFIT AFTER TAX</b></td><td class="amt"><b>${:,.0f}</b></td>'
              '<td class="pct"><b>{p:.1f}%</b></td><td></td></tr>').format(
            after_tax, p=pct(after_tax, ns))
        h += row("Loan principal repayment", loan_principal, ns, indent=1)
        cash = after_tax - loan_principal
        ccls = "ok" if cash >= 0 else "over"
        h += ('<tr class="g profit"><td><b>CASH IN POCKET</b></td><td class="amt"><b>${:,.0f}</b></td>'
              '<td class="pct {c}"><b>{p:.1f}%</b></td><td></td></tr>').format(
            cash, c=ccls, p=pct(cash, ns))
    else:
        npcls = "ok" if pct(op_profit, ns) >= K["profit_margin"] else "over"
        h += ('<tr class="g profit"><td><b>NET PROFIT MARGIN</b></td><td class="amt"><b>${:,.0f}</b></td>'
              '<td class="pct {c}"><b>{p:.1f}%</b></td><td><span class="tgt">{t:.0f}%</span></td></tr>').format(
            op_profit, c=npcls, p=pct(op_profit, ns), t=K["profit_margin"])
        if pct(op_profit, ns) < K["profit_margin"]:
            notes.append("Net margin {:.0f}% &lt; {:.0f}%".format(pct(op_profit, ns), K["profit_margin"]))

    warn_html = ""
    if warn:
        warn_html = ('<div class="warn">&#9888; WAGE NOT YET PAID for this week &mdash; '
                     'profit is overstated until payroll posts.</div>')
    note_html = ""
    if notes:
        note_html = '<div class="notes"><b>&#9888;</b> ' + " &middot; ".join(notes) + '</div>'
    return ('<div class="card"><div class="ctitle">{t}</div>{w}'
            '<table class="pl">{h}</table>{n}</div>').format(t=title, w=warn_html, h=h, n=note_html)


def _wk_cat(rsales, ws, we):
    out = {}
    cur = ws
    while cur <= we:
        di = cur.isoformat()
        if di in rsales:
            out[di] = {"Beverage": rsales[di]["foh"], "Food": rsales[di]["boh"],
                       "Monthly Pastry Special": rsales[di]["pastry"]}
        cur += timedelta(days=1)
    return out


def main():
    print("loading settings ...")
    S = load_settings()
    today = datetime.now(BNE).date()
    weeks = recent_weeks(today, 4)
    months = month_list(HISTORY_START, today)[-3:]
    quarters = quarter_list(today, 2)
    years = year_list(today, today.year - 1)
    name_to_org = {o["name"]: o for o in XERO_ORGS}
    ordered = [n for n in DISPLAY_ORDER if n in name_to_org]
    COMBINED = "Combined"

    K = {k: S.get("kpi_" + k, dv) * 100 for k, dv in {
        "cogs_total": 0.30, "cogs_foh": 0.25, "cogs_boh": 0.25, "cogs_pastry": 0.25,
        "wage_total": 0.33, "wage_foh": 0.33, "wage_boh": 0.33, "wage_pastry": 0.38,
        "rent": 0.08, "overheads": 0.12, "marketing": 0.05, "profit_margin": 0.15}.items()}

    LOAN_INT_M = S.get("loan_interest_monthly", 0) or 0
    LOAN_PRIN_M = S.get("loan_principal_monthly", 0) or 0
    TAX_RATE = S.get("company_tax_rate", 0.25) or 0.25

    def weekly_rows(org, token, tenant, acc):
        rows = []
        if not (token and tenant and acc):
            return rows
        fixed, oh, bg_wk, int_wk = weekly_fixed(org, token, tenant, today)
        wk0, wk1 = weeks[-1][0], weeks[0][1]
        rsales = square_role_sales(acc, wk0.isoformat(), wk1.isoformat())
        slug = STORE_SLUG.get(org["name"])
        # COGS 1주 시프트 (Eddie 확정 2026-07-05): 공급처 대부분이 직불로 "다음 주"에
        # 청구 → 뱅크룰 리콘사일 = 지불 날짜로 장부에 잡힘. 따라서 각 주의 실제 소비
        # 원가 = 그 "다음 주" P&L의 COGS. 다음 주가 아직 안 끝났으면 미확정(진행 중).
        pls = {}
        for (ws, we) in weeks:
            pls[ws] = parse_pl(org, token, tenant, ws.isoformat(), we.isoformat())
        pay_ws = weeks[0][0] + timedelta(days=7)
        pay_we = min(weeks[0][1] + timedelta(days=7), today)
        pls[pay_ws] = parse_pl(org, token, tenant, pay_ws.isoformat(), pay_we.isoformat())
        for (ws, we) in weeks:
            p = pls[ws]
            p_pay = pls.get(ws + timedelta(days=7))
            cogs_src = p_pay["cogs"] if p_pay else p["cogs"]
            cogs = apply_prep_cost(cogs_src, slug, S) if slug else dict(cogs_src)
            rss = sum_role_sales(rsales, ws, we)
            wd = wage_kpi_data(org["name"], ws, we, _wk_cat(rsales, ws, we), S)
            wage = {"foh": 0.0, "boh": 0.0, "pastry": 0.0, "marketing": 0.0, "admin": 0.0, "director": 0.0}
            paid = (wd.get("status") == "ok")
            if paid:
                for r in ["foh", "boh", "pastry"]:
                    wage[r] = wd["roles"][r]["net"]
            ex = wd.get("extra") if paid else None
            if ex:
                wage["marketing"] = ex["marketing"]
                wage["director"] = ex["director"]
                wage["admin"] = ex["admin"]
            else:
                wage["marketing"] = p["wage"]["marketing"]
                wage["director"] = p["wage"]["director"]
                wage["admin"] = p["wage"]["admin"]
            ns_sq = square_net_sales(acc, ws.isoformat(), we.isoformat())
            rng = "{} &ndash; {}".format(ws.strftime("%d/%m"), we.strftime("%d/%m"))
            rows.append(("Week " + rng, ns_sq, cogs, wage, rss, fixed, oh,
                         p["marketing_cost"] + wage["marketing"],
                         wage["director"], wage["admin"], int_wk, not paid, bg_wk,
                         p.get("invoiced", {})))
        return rows

    def period_rows(org, token, tenant, acc, period_defs):
        rows = []
        if not (token and tenant):
            return rows
        for (d0, d1, title) in period_defs:
            p = parse_pl(org, token, tenant, d0.isoformat(), d1.isoformat())
            ns_sq = square_net_sales(acc, d0.isoformat(), d1.isoformat()) if acc else 0.0
            if ns_sq <= 0:
                rows.append((title, None))
                continue
            rss = {"foh": 0.0, "boh": 0.0, "pastry": 0.0}
            if acc:
                ms = square_role_sales(acc, d0.isoformat(), d1.isoformat())
                rss = sum_role_sales(ms, d0, d1)
            fixed_m = {"Rent": p["rent_base"], "Outgoings": p["outgoings"], "Turnover Rent": p["turnover_rent"]}
            rows.append((title, ns_sq, p["cogs"], p["wage"], rss, fixed_m, p["overheads"],
                         p["marketing_cost"] + p["wage"]["marketing"],
                         p["wage"]["director"], p["wage"]["admin"], p["interest"], False,
                         p["bg_interest"], p.get("invoiced", {})))
        return rows

    month_defs = [(mf, ml, mf.strftime("%B %Y")) for (mf, ml) in reversed(months)]

    store_w, store_m, store_q, store_y = {}, {}, {}, {}
    for nm in ordered:
        org = name_to_org[nm]
        acc = _acc_by_name.get(nm)
        print("build:", nm)
        token = get_token(org)
        tenant = get_tenant(org, token) if token else None
        store_w[nm] = weekly_rows(org, token, tenant, acc)
        store_m[nm] = period_rows(org, token, tenant, acc, month_defs)
        store_q[nm] = period_rows(org, token, tenant, acc, quarters)
        store_y[nm] = period_rows(org, token, tenant, acc, years)

    def combine(store_dict):
        titles = []
        for nm in ordered:
            for item in store_dict.get(nm, []):
                if item[0] not in titles:
                    titles.append(item[0])
        out = []
        for t in titles:
            ns = 0.0
            cogs = {"foh": 0.0, "boh": 0.0, "pastry": 0.0, "other": 0.0}
            wage = {"foh": 0.0, "boh": 0.0, "pastry": 0.0, "marketing": 0.0, "admin": 0.0, "director": 0.0}
            rss = {"foh": 0.0, "boh": 0.0, "pastry": 0.0}
            fixed = {"Rent": 0.0, "Outgoings": 0.0, "Turnover Rent": 0.0}
            oh = {}
            mkt = director = admin = bg = intr = 0.0
            inv = {}
            warn = False
            found = False
            for nm in ordered:
                for item in store_dict.get(nm, []):
                    if item[0] != t:
                        continue
                    if len(item) == 2 and item[1] is None:
                        continue
                    found = True
                    (_, i_ns, i_cogs, i_wage, i_rss, i_fixed, i_oh, i_mkt, i_dir, i_admin, _i_int, i_warn, i_bg) = item[:13]
                    i_inv = item[13] if len(item) > 13 else {}
                    for k2, v2 in i_inv.items():
                        inv[k2] = inv.get(k2, 0.0) + v2
                    ns += i_ns
                    for r in cogs:
                        cogs[r] += i_cogs[r]
                    for r in wage:
                        wage[r] += i_wage[r]
                    for r in rss:
                        rss[r] += i_rss[r]
                    for k2 in ("Rent", "Outgoings", "Turnover Rent"):
                        fixed[k2] = fixed.get(k2, 0.0) + i_fixed.get(k2, 0.0)
                    for b, v in i_oh.items():
                        oh[b] = oh.get(b, 0.0) + v
                    mkt += i_mkt; director += i_dir; admin += i_admin; bg += i_bg
                    intr += _i_int
                    warn = warn or i_warn
            if found:
                out.append((t, ns, cogs, wage, rss, fixed, oh, mkt, director, admin, intr, warn, bg, inv))
            else:
                out.append((t, None))
        return out

    comb_w = combine(store_w)
    comb_m = combine(store_m)
    comb_q = combine(store_q)
    comb_y = combine(store_y)

    def render_rows(rows, is_combined=False, loan_factor=0):
        body = ""
        for item in rows:
            if len(item) == 2 and item[1] is None:
                continue
            (title, ns, cogs, wage, rss, fixed, oh, mkt, director, admin, intr, warn, bg) = item[:13]
            inv = item[13] if len(item) > 13 else {}
            if is_combined:
                body += render_card(title, ns, cogs, wage, rss, fixed, oh,
                                    mkt, director, admin, intr, K, warn=warn,
                                    bg_interest=bg,
                                    loan_interest=LOAN_INT_M * loan_factor,
                                    loan_principal=LOAN_PRIN_M * loan_factor,
                                    tax_rate=TAX_RATE, show_cash=True, invoiced=inv)
            else:
                body += render_card(title, ns, cogs, wage, rss, fixed, oh,
                                    mkt, director, admin, intr, K, warn=warn,
                                    bg_interest=bg, show_cash=False, invoiced=inv)
        return body or '<p class="empty">No data</p>'

    # ---- Advisor 탭 (규칙 기반 진단 + 주간 Claude 리뷰 임베드) ----
    adv_html = ""
    if OP_MODE:
        try:
            adv_html = feedback_panel(today, en=True)  # op(루크): 매니저 피드백(액션카드)만, 영어
        except Exception as e:
            print("  ! op advisor skipped:", e)
    elif advisor_mod:
        try:
            adv_stores = [(COMBINED, COMBINED_COLOR, _weeks_summaries(comb_w, weeks, today))]
            for nm in ordered:
                adv_stores.append((nm, STORE_COLOR.get(nm, "#6b7280"),
                                   _weeks_summaries(store_w[nm], weeks, today)))
            wr_html = ""
            try:
                with open("weekly_review.html", encoding="utf-8") as wf:
                    wr_html = wf.read()
            except Exception:
                pass
            try:
                wr_html += feedback_panel(today)
            except Exception as e:
                print("  ! feedback panel skipped:", e)
            adv_html = advisor_mod.render(adv_stores, K, wr_html,
                                          datetime.now(BNE).strftime("%Y-%m-%d %H:%M"))
        except Exception as e:
            print("  ! advisor tab skipped:", e)

    strat_html = ""
    try:
        strat_html = build_op_strategy_view(store_w, comb_w, ordered) if OP_MODE else build_strategy_view(store_w, comb_w, ordered)
    except Exception as e:
        print("  ! strategy tab skipped:", e)

    meet_html = ""
    try:
        meet_html = build_meetings_view(today, en=OP_MODE)
    except Exception as e:
        print("  ! meetings tab skipped:", e)

    views = ""

    tab_order = [(COMBINED, COMBINED_COLOR, comb_w, comb_m, comb_q, comb_y)]
    for nm in ordered:
        tab_order.append((nm, STORE_COLOR.get(nm, "#6b7280"),
                          store_w[nm], store_m[nm], store_q[nm], store_y[nm]))

    if OP_MODE:
        tab_order = []  # op(루크) 대시보드: 매장별 P&L 탭 숨김
    LOAN_FACTOR = {"w": 12 / 52.0, "m": 1.0, "q": 3.0, "y": 12.0}

    first = (adv_html == "")
    store_btns = ""
    if adv_html:
        store_btns += ('<button class="nb on" data-s="advisor" onclick="svS(\'advisor\')" '
                       'style="--c:#0f766e">&#128161; Advisor</button>')
        views += '<div class="vw" id="v-advisor" style="display:block">' + adv_html + '</div>'
    if strat_html:
        store_btns += ('<button class="nb" data-s="strategy" onclick="svS(\'strategy\')" '
                       'style="--c:#6d28d9">&#127919; Strategy</button>')
        views += '<div class="vw" id="v-strategy" style="display:none">' + strat_html + '</div>'
    if meet_html:
        store_btns += ('<button class="nb" data-s="meetings" onclick="svS(\'meetings\')" '
                       'style="--c:#0e7490">&#128101; Meetings</button>')
        views += '<div class="vw" id="v-meetings" style="display:none">' + meet_html + '</div>'
    # 매니저 페이지 임베드 뷰 (탭 줄엔 버튼 안 넣음 — 상단 우측 Sales/Roster/COGS
    # 링크가 svS()로 이 뷰를 연다. 첫 클릭 시에만 iframe 로드)
    for sid, url in [
            ("mgr-sales", "https://hideoutdb.com/"),
            ("mgr-roster", "https://hideoutdb.com/roster.html"),
            ("mgr-cogs", "https://hideoutdb.com/cogs.html")]:
        views += ('<div class="vw" id="v-{s}" style="display:none">'
                  '<iframe class="mgrframe" data-src="{u}" title="{s}"></iframe>'
                  '</div>').format(s=sid, u=url)
    for (nm, col, rw, rm, rq, ry) in tab_order:
        base = nm.lower().replace(" ", "-")
        short = nm.replace(" St", "").replace(" Ter", "")
        is_combined = (nm == COMBINED)
        store_btns += '<button class="nb{a}" data-s="{s}" onclick="svS(\'{s}\')" style="--c:{c}">{l}</button>'.format(
            a=(" on" if first else ""), s=base, c=col, l=short)
        for key, label, rows in [("w", "Weekly", rw), ("m", "Monthly", rm),
                                  ("q", "3 Month", rq), ("y", "1 Year", ry)]:
            sl = base + "-" + key
            disp = "block" if (first and key == "w") else "none"
            lf = LOAN_FACTOR[key] if is_combined else 0
            views += ('<div class="vw" id="v-{s}" style="display:{d}">'
                      '<h2><span class="dot" style="background:{c}"></span>{l} &middot; {lab}</h2>{b}</div>').format(
                s=sl, d=disp, c=col, l=nm, lab=label,
                b=render_rows(rows, is_combined=is_combined, loan_factor=lf))
        first = False

    period_btns = "".join(
        '<button class="pb{a}" data-p="{k}" onclick="svP(\'{k}\')">{l}</button>'.format(
            a=(" on" if k == "w" else ""), k=k, l=lbl)
        for k, lbl in [("w", "Weekly"), ("m", "Monthly"), ("q", "3 Month"), ("y", "1 Year")])
    if OP_MODE:
        period_btns = ""  # 매장별 P&L 없으니 기간 버튼도 숨김
    nav = ('<div class="pillrow">' + store_btns + '</div>'
           '<div class="pillrow"><div class="pbtns">' + period_btns + '</div></div>')

    html = PAGE.replace("{{NAV}}", nav).replace(
        "{{VIEWS}}", views).replace("{{TS}}", datetime.now(BNE).strftime("%Y-%m-%d %H:%M")).replace(
        "{{BADGE}}", "&#128296; OPERATION MANAGER" if OP_MODE else "&#128273; OWNER")
    os.makedirs(WEB_DIR, exist_ok=True)
    os.makedirs(OWNER_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fp:
        fp.write(html)
    print("[OK] ->", OUT)

    # data/latest.json 저장 (대시보드 생성과 분리; 실패해도 위 HTML엔 영향 없음)
    try:
        write_latest_json(weeks, ordered, comb_w, store_w, today)
    except Exception as e:
        print("  ! latest.json export skipped:", e)

    # data/advisor-data.json 저장 (주간 Claude 딥다이브용; 실패해도 영향 없음)
    try:
        write_advisor_json(weeks, ordered, comb_w, store_w, K, today)
    except Exception as e:
        print("  ! advisor-data.json export skipped:", e)


PAGE = """<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Hideout - Owner P&L</title>
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f4f1;color:#211d19}
main{max-width:900px;margin:0 auto;padding:0 16px 56px}
.topbar{position:sticky;top:0;z-index:20;background:rgba(246,244,241,.95);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:3px solid #211d19}
.pagetag{font-size:11px;font-weight:800;color:#fff;border-radius:8px;padding:4px 10px;letter-spacing:.08em;vertical-align:middle;margin-left:6px}
.tbin{max-width:900px;margin:0 auto;padding:10px 16px 10px}
.tbrow{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
h1{font-size:16px;font-weight:800;margin:0;letter-spacing:-.01em;white-space:nowrap}
h1 span{color:#8a8378;font-weight:600}
.tblinks{display:flex;gap:6px}
.tblinks a{font-size:12px;font-weight:700;color:#4b4740;background:#fff;border:1px solid #e2ddd5;border-radius:999px;padding:6px 12px;text-decoration:none;white-space:nowrap}
.pillrow{display:flex;gap:6px;overflow-x:auto;padding-top:10px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.pillrow::-webkit-scrollbar{display:none}
.nb{font:inherit;font-size:13px;font-weight:700;color:#4b4740;background:#fff;border:1px solid #e2ddd5;border-radius:999px;padding:9px 15px;cursor:pointer;white-space:nowrap;flex-shrink:0}
.nb:hover{background:#f1eee9}
.nb.on{background:var(--c,#211d19);color:#fff;border-color:var(--c,#211d19)}
.pbtns{display:flex;gap:2px;background:#f1eee9;border-radius:999px;padding:3px}
.pb{font:inherit;font-size:12px;font-weight:700;color:#6f695f;background:transparent;border:0;border-radius:999px;padding:6px 14px;cursor:pointer;white-space:nowrap}
.pb.on{background:#fff;color:#211d19;box-shadow:0 1px 2px rgba(0,0,0,.1)}
h2{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;margin:0 0 12px;color:#211d19}
.dot{width:10px;height:10px;border-radius:99px;flex-shrink:0}
.sub{color:#8a8378;font-size:12px;margin:14px 2px}
.card{background:#fff;border:1px solid #e7e2db;border-radius:16px;padding:16px 18px;margin-bottom:12px;box-shadow:0 1px 2px rgba(30,25,20,.04)}
.ctitle{font-size:14px;font-weight:800;margin-bottom:8px;color:#211d19}
.warn{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-size:11px;color:#b45309;font-weight:700;margin-bottom:8px}
table.pl{border-collapse:collapse;width:100%;font-size:13px}
table.pl td{padding:6px 8px;border-bottom:1px solid #f6f4f1;font-variant-numeric:tabular-nums}
table.pl .amt{text-align:right;color:#4b4740;white-space:nowrap}
table.pl .pct{text-align:right;font-weight:700;width:60px}
table.pl td:nth-child(4){text-align:right;width:44px}
.tgt{color:#a39b8e;font-size:11px}
.rolep{font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;margin-left:6px;background:#f1eee9}
.rolep.ok{color:#0f8a43;background:#e8f6ee} .rolep.over{color:#d2372c;background:#fdeceb}
.pct.ok{color:#0f8a43} .pct.over{color:#d2372c}
tr.g td{background:#faf8f5;font-weight:700;border-top:1px solid #e7e2db}
tr.profit td{background:#211d19;color:#fff;border-top:none;font-size:14px}
tr.profit td.amt{color:#fff}
tr.profit .pct.ok{color:#7ee2a8} tr.profit .pct.over{color:#ffb3ab}
tr.profit .tgt{color:#a39b8e}
.notes{margin-top:8px;background:#fdeceb;border:1px solid #f6c6c1;border-radius:10px;padding:8px 12px;font-size:11px;color:#991b1b}
.empty{color:#a39b8e;padding:20px}
.advcard{background:#fff;border:1px solid #e7e2db;border-left:4px solid #e7e2db;border-radius:14px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 2px rgba(30,25,20,.04)}
.advcard.red{border-left-color:#d2372c}
.advcard.amber{border-left-color:#d97706}
.advcard.info{border-left-color:#2563eb}
.advcard.green{border-left-color:#0f8a43}
.adv-title{font-weight:800;font-size:14px;color:#211d19}
.adv-bg{font-size:12.5px;color:#4b4740;margin-top:6px;line-height:1.6}
.adv-act{margin:8px 0 0;padding-left:18px;font-size:12.5px;color:#211d19;line-height:1.6}
.adv-act li{margin:3px 0}
.adv-store{margin:22px 0 8px;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800}
.adv-pri{background:#211d19;color:#fff;border-radius:16px;padding:14px 18px;margin-bottom:14px}
.adv-pri ol{margin:8px 0 0;padding-left:20px;font-size:13px;line-height:1.7}
.adv-pri li{margin:4px 0}
.adv-review{background:#fff;border:1px solid #e7e2db;border-radius:16px;padding:14px 18px;margin-bottom:14px;font-size:13px;line-height:1.65}
.adv-review h3{font-size:14px;margin:0 0 8px}
.adv-review h4{font-size:13px;margin:12px 0 4px}
.adv-note{font-size:11px;color:#8a8378;margin-top:14px;line-height:2}
.adv-badge{display:inline-block;font-size:10px;font-weight:800;border-radius:999px;padding:2px 8px;margin-right:6px;vertical-align:middle}
.adv-badge.red{background:#fdeceb;color:#d2372c}
.adv-badge.amber{background:#fef3c7;color:#b45309}
.adv-badge.info{background:#dbeafe;color:#1d4ed8}
.adv-badge.green{background:#e8f6ee;color:#0f8a43}
.adv-cnts{margin-left:6px;display:inline-flex;gap:2px}
.stnote{font-size:11px;color:#8a8378;margin-top:8px;line-height:1.6}
.stidx{font-size:10px;color:#a39b8e;font-weight:600}
.mtformbtn{display:block;text-align:center;font-size:14px;font-weight:800;color:#fff;background:#0e7490;border-radius:14px;padding:14px 16px;text-decoration:none;margin:2px 0 12px;box-shadow:0 1px 3px rgba(30,25,20,.12)}
.mtc{font:inherit;font-size:12px;font-weight:700;color:#6f695f;background:#fff;border:1px solid #e2ddd5;border-radius:999px;padding:6px 14px;cursor:pointer;white-space:nowrap;flex-shrink:0}
.mtc.on{background:#0e7490;color:#fff;border-color:#0e7490}
.mtlabel{font-size:10px;letter-spacing:.07em;font-weight:800;color:#8a8378;margin-top:10px}
.pillrow#mtchips{margin-bottom:10px}
.strat-grid{display:grid;gap:10px;margin-top:8px}
@media(min-width:640px){.strat-grid{grid-template-columns:1fr 1fr}}
.adv-more{margin-bottom:10px}
.adv-more summary{cursor:pointer;font-size:12px;font-weight:700;color:#8a8378;padding:7px 4px;user-select:none}
.adv-more summary:hover{color:#4b4740}
.mgrframe{width:100%;height:calc(100vh - 150px);border:1px solid #e7e2db;border-radius:14px;background:#fff}
@media(max-width:600px){.tblinks a{padding:6px 9px}
.card{overflow-x:auto}
table.pl{min-width:420px}
.adv-review{overflow-x:auto}
.mgrframe{height:calc(100vh - 120px)}}
</style></head><body>
<!-- 접근 보호는 Netlify Password Protection이 담당 (오너 전용 사이트, 2026-07-08 전환) -->
<div id="content">
<header class="topbar"><div class="tbin">
<div class="tbrow"><h1>The Hideout <span class="pagetag" style="background:#211d19">{{BADGE}}</span></h1>
<div class="tblinks"><a href="javascript:void(0)" onclick="svS('mgr-sales')">&#128202; Sales</a><a href="javascript:void(0)" onclick="svS('mgr-roster')">&#128197; Roster</a><a href="javascript:void(0)" onclick="svS('mgr-cogs')">&#129534; COGS</a><a href="https://order.hideoutdb.com" target="_top">&#129386; Orders</a></div></div>
{{NAV}}
</div></header>
<main>
<div class="sub">Weekly = variable actual + fixed smoothed &middot; COGS shifted +1wk (direct-debit paid week after use). Monthly/Quarter/Year = full P&amp;L. Combined includes tax &amp; loan cash. KPI from Settings &middot; {{TS}}</div>
{{VIEWS}}
</main>
</div>
<script>
var curS=null,curP='w';
function apply(){
  document.querySelectorAll('.vw').forEach(function(v){v.style.display='none';});
  var t=document.getElementById('v-'+curS+'-'+curP)||document.getElementById('v-'+curS);
  if(t){t.style.display='block';
    var fr=t.querySelector('iframe[data-src]');
    if(fr){fr.src=fr.getAttribute('data-src');fr.removeAttribute('data-src');}
  }
  document.querySelectorAll('.nb').forEach(function(b){b.classList.toggle('on',b.dataset.s===curS);});
  document.querySelectorAll('.pb').forEach(function(b){b.classList.toggle('on',b.dataset.p===curP);});
  window.scrollTo(0,0);
}
function svS(s){curS=s;apply();}
function svP(p){curP=p;apply();}
function mtF(t){
  document.querySelectorAll('.mtg').forEach(function(m){m.style.display=(t==='all'||m.dataset.mt===t)?'block':'none';});
  document.querySelectorAll('#mtchips .mtc').forEach(function(b){b.classList.toggle('on',b.dataset.mt===t);});
}
document.addEventListener('DOMContentLoaded',function(){
  var f=document.querySelector('.nb');
  if(f){curS=f.dataset.s;apply();}
});
</script>
</body></html>"""


if __name__ == "__main__":
    main()