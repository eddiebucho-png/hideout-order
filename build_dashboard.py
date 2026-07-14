import json
import re
import time
import os
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from config import ACCOUNTS
try:
    from config import TICKETMASTER_KEY
except ImportError:
    TICKETMASTER_KEY = ""
try:
    from config import EVENTS_SHEET_CSV
except ImportError:
    EVENTS_SHEET_CSV = ""

LOAD_URL = "https://connect.squareup.com/reporting/v1/load"
ORDERS_URL = "https://connect.squareup.com/v2/orders/search"
BNE = timezone(timedelta(hours=10))
BIG_VENUES = [
    "Suncorp Stadium",                # NRL/Origin/대형 콘서트 — CBD·Valley 근처
    "Riverstage",                     # 대형 야외공연 — CBD 옆
    "Brisbane Entertainment Centre",  # 대형 아레나 (Boondall, 좀 멈)
    "Gabba",
    "Brisbane Cricket Ground",
    "Brisbane Convention",            # 컨퍼런스/엑스포 (South Bank)
    "Showgrounds",                    # Ekka 등
]

def run_query(account, q):
    body = json.dumps({"query": q}).encode("utf-8")
    headers = {"Authorization": "Bearer " + account["token"], "Content-Type": "application/json"}
    for _ in range(10):
        try:
            req = urllib.request.Request(LOAD_URL, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req) as resp:
                r = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print("  ! " + account["name"] + " error", e.code)
            return None
        if "data" in r:
            return r["data"]
        time.sleep(2)
    return None


def net_sales(account, date_range):
    data = run_query(account, {
        "measures": ["Orders.net_sales", "Orders.count"],
        "dimensions": ["Orders.location_id"],
        "filters": [{"member": "Orders.local_date", "operator": "inDateRange", "values": date_range}],
        "segments": ["Orders.closed_checks"],
    })
    for row in data or []:
        if row.get("Orders.location_id") == account["location_id"]:
            return (float(row.get("Orders.net_sales") or 0), int(float(row.get("Orders.count") or 0)))
    return (0.0, 0)


def categories(account, date_range):
    data = run_query(account, {
        "measures": ["ItemSales.item_net_sales"],
        "dimensions": ["ItemSales.category_name"],
        "filters": [
            {"member": "ItemSales.location_id", "operator": "equals", "values": [account["location_id"]]},
            {"member": "ItemSales.local_date", "operator": "inDateRange", "values": date_range},
        ],
    })
    cats = {}
    for row in data or []:
        name = row.get("ItemSales.category_name") or "(Uncategorized)"
        cats[name] = cats.get(name, 0.0) + float(row.get("ItemSales.item_net_sales") or 0)
    return cats


def items_by_cat(account, date_range):
    data = run_query(account, {
        "measures": ["ItemSales.item_net_sales", "ItemSales.quantity_sold"],
        "dimensions": ["ItemSales.category_name", "ItemSales.item_name"],
        "filters": [
            {"member": "ItemSales.location_id", "operator": "equals", "values": [account["location_id"]]},
            {"member": "ItemSales.local_date", "operator": "inDateRange", "values": date_range},
        ],
    })
    cats = {}
    for row in data or []:
        cat = row.get("ItemSales.category_name") or "(Uncategorized)"
        name = row.get("ItemSales.item_name") or "(Unnamed)"
        name = name.rstrip(".").strip() or "(Unnamed)"
        net = float(row.get("ItemSales.item_net_sales") or 0)
        qty = float(row.get("ItemSales.quantity_sold") or 0)
        cats.setdefault(cat, {})
        if name in cats[cat]:
            cats[cat][name][0] += net; cats[cat][name][1] += qty
        else:
            cats[cat][name] = [net, qty]
    return cats


def _norm_item(name):
    return (name or "").rstrip(".").strip().lower()


def orders_item_qty(account, date_range):
    """Orders API에서 아이템별 실제 판매 수량을 집계한다.
    reporting/v1의 ItemSales.quantity_sold는 modifier 줄까지 수량으로 세서
    부풀려지므로 (2026-07 검증: flat white 약 4.3배) 수량은 이걸 쓴다."""
    out = {}
    cursor = None
    headers = {"Authorization": "Bearer " + account["token"], "Content-Type": "application/json"}
    while True:
        body = {
            "location_ids": [account["location_id"]],
            "limit": 500,
            "query": {"filter": {
                "date_time_filter": {"closed_at": {
                    "start_at": date_range[0] + "T00:00:00+10:00",
                    "end_at": date_range[1] + "T23:59:59+10:00"}},
                "state_filter": {"states": ["COMPLETED"]}},
                "sort": {"sort_field": "CLOSED_AT"}},
        }
        if cursor:
            body["cursor"] = cursor
        try:
            req = urllib.request.Request(ORDERS_URL, data=json.dumps(body).encode("utf-8"),
                                         headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=60) as resp:
                r = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print("  ! " + account["name"] + " orders error", e.code)
            return out
        for o in r.get("orders", []):
            for li in o.get("line_items", []):
                key = _norm_item(li.get("name"))
                if key:
                    out[key] = out.get(key, 0.0) + float(li.get("quantity") or 0)
        cursor = r.get("cursor")
        if not cursor:
            break
    return out


def fix_quantities(ci_map, real_qty):
    """items_by_cat 결과의 수량을 Orders API 실측치로 교체한다.
    같은 아이템명이 여러 카테고리에 있으면 reporting 수량 비율로 배분."""
    totals = {}
    for idict in ci_map.values():
        for name, v in idict.items():
            k = _norm_item(name)
            totals[k] = totals.get(k, 0.0) + v[1]
    for idict in ci_map.values():
        for name, v in idict.items():
            k = _norm_item(name)
            if k in real_qty:
                if totals[k] > 0:
                    v[1] = real_qty[k] * v[1] / totals[k]
                else:
                    v[1] = real_qty[k]
    return ci_map


# ---------- A-7: holidays / school holidays / events ----------
def fetch_holidays(year):
    out = {}
    for y in (year, year + 1):
        url = "https://date.nager.at/api/v3/PublicHolidays/{}/AU".format(y)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                arr = json.loads(resp.read().decode("utf-8"))
            for h in arr:
                counties = h.get("counties")
                if counties is None or "AU-QLD" in counties:
                    out[h["date"]] = h.get("localName") or h.get("name")
        except Exception as e:
            print("  ! holiday error:", e)
    return out


def fetch_events(start_iso, end_iso):
    out = {}
    if not TICKETMASTER_KEY:
        print("  ! TICKETMASTER_KEY 없음 - 이벤트 스킵")
        return out
    base = ("https://app.ticketmaster.com/discovery/v2/events.json"
            "?apikey={k}&city=Brisbane&countryCode=AU"
            "&startDateTime={s}T00:00:00Z&endDateTime={e}T23:59:59Z"
            "&size=200&sort=date,asc")
    page = 0
    while page < 5:
        url = base.format(k=TICKETMASTER_KEY, s=start_iso, e=end_iso) + "&page={}".format(page)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                d = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print("  ! events error:", e)
            break
        evs = (d.get("_embedded") or {}).get("events") or []
        for ev in evs:
            ld = ((ev.get("dates") or {}).get("start") or {}).get("localDate")
            if not ld:
                continue
            venues = (ev.get("_embedded") or {}).get("venues") or []
            venue = venues[0].get("name", "") if venues else ""
            if BIG_VENUES and not any(bv.lower() in venue.lower() for bv in BIG_VENUES):
                continue
            cls = ev.get("classifications") or []
            seg = ((cls[0].get("segment") or {}).get("name") or "") if cls else ""
            kind = {"Music": "music", "Sports": "sport"}.get(seg, "other")
            out.setdefault(ld, []).append({"name": ev.get("name", ""), "venue": venue, "kind": kind})
        total = (d.get("page") or {}).get("totalPages", 1)
        page += 1
        if page >= total:
            break
    return out


def fetch_weather(past_days=7, forecast_days=16):
    """Open-Meteo daily rain, recent past + forecast, Brisbane CBD (free, no key)."""
    url = ("https://api.open-meteo.com/v1/forecast"
           "?latitude=-27.4698&longitude=153.0251&daily=precipitation_sum"
           "&timezone=Australia%2FBrisbane&past_days={}&forecast_days={}").format(past_days, forecast_days)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            d = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print("  ! weather error:", e)
        return {}
    daily = d.get("daily", {})
    times = daily.get("time", []) or []
    mm = daily.get("precipitation_sum", []) or []
    out = {}
    for i in range(min(len(times), len(mm))):
        if mm[i] is not None:
            out[times[i]] = float(mm[i])
    return out


# 공립(state) 학교 방학 — QLD 2026 (사립/카톨릭은 ±1주 차이 날 수 있음)
SCHOOL_HOLIDAYS = [
    ("2026-04-03", "2026-04-19", "School holidays"),
    ("2026-06-27", "2026-07-12", "School holidays"),
    ("2026-09-19", "2026-10-05", "School holidays"),
    ("2026-12-12", "2027-01-26", "School holidays"),
]

# 수동 이벤트 (Ticketmaster가 못 잡는 거: Ticketek 경기, 마라톤/사이클, 로컬 축제)
# 형식: ("YYYY-MM-DD","이름") 또는 ("시작","끝","이름")
EVENTS_MANUAL = [
    # ("2026-08-07", "2026-08-16", "Ekka (Royal QLD Show)"),
]


def date_iter(start, end):
    s = datetime.fromisoformat(start).date()
    e = datetime.fromisoformat(end).date()
    cur = s
    while cur <= e:
        yield cur.isoformat()
        cur += timedelta(days=1)


def build_context_tags():
    tags = {}
    for s, e, label in SCHOOL_HOLIDAYS:
        for d in date_iter(s, e):
            tags.setdefault(d, []).append(("school", label))
    for ev in EVENTS_MANUAL:
        if len(ev) == 2:
            tags.setdefault(ev[0], []).append(("other", ev[1]))
        else:
            for d in date_iter(ev[0], ev[1]):
                tags.setdefault(d, []).append(("other", ev[2]))
    return tags


def get_periods(today):
    WD3 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    tdy_prev = today - timedelta(days=7)
    wk = today - timedelta(days=today.weekday())
    iw = (today - wk).days
    lwk = wk - timedelta(days=7)
    mo = today.replace(day=1)
    im = (today - mo).days
    lme = mo - timedelta(days=1)
    lms = lme.replace(day=1)
    lmo_end = min(lms + timedelta(days=im), lme)
    yr = today.replace(month=1, day=1)
    lys = yr.replace(year=today.year - 1)
    try:
        lye = today.replace(year=today.year - 1)
    except ValueError:
        lye = today.replace(year=today.year - 1, day=28)
    iso = lambda d: d.isoformat()
    return [
        ("Today",      "last " + WD3[today.weekday()], [iso(today), iso(today)], [iso(tdy_prev), iso(tdy_prev)]),
        ("This Week",  "last week",  [iso(wk), iso(today)], [iso(lwk), iso(lwk + timedelta(days=iw))]),
        ("This Month", "last month", [iso(mo), iso(today)], [iso(lms), iso(lmo_end)]),
        ("This Year",  "last year",  [iso(yr), iso(today)], [iso(lys), iso(lye)]),
    ]


def pct(c, p):
    return None if p == 0 else (c - p) / p * 100.0


def slug(s):
    out = ""
    for ch in s.lower():
        out += ch if ch.isalnum() else "-"
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-")


WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
def fmt_d(s):
    d = datetime.fromisoformat(s).date()
    return "{:02d}/{:02d}({})".format(d.day, d.month, WD[d.weekday()])
def fmt_range(a, b):
    if a == b:
        return fmt_d(a)
    return fmt_d(a) + " ~ " + fmt_d(b)


today = datetime.now(BNE).date()
periods = get_periods(today)
item_range = next(cr for lbl, vs, cr, pr in periods if lbl == "This Month")
ITEM_RANGE_STR = fmt_range(item_range[0], item_range[1])

# ---- 아이템 이름 병합 (매장 간 표기 차이 자동 통일, Eddie 확정 2026-07-07) ----
# 같은 아이템인데 "(June Special)" 프리픽스, 공백 수, 식이 태그((VE) 등) 차이로 이름이
# 다르면 Combined에서 딴 아이템으로 쪼개진다 → 키 정규화로 병합해서 집계.
# 정규화로 못 잡는 동일 아이템은 ITEM_ALIASES에 추가 (Eddie 확인 후).
# 새 유사 이름 발견은 목요일 딥다이브가 스캔해 Eddie에게 같은/다른 아이템인지 확인 요청.
_SPECIAL_PREFIX = re.compile(
    r"^\(\s*(january|february|march|april|may|june|july|august|september|october|"
    r"november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\s+special\s*\)\s*", re.I)
_DIET_SUFFIX = re.compile(r"\s*\(\s*(ve|vg|v|gf|gfo)(\s*/\s*(ve|vg|v|gf|gfo))*\s*\)\s*$", re.I)
ITEM_ALIASES = {  # 확정된 동일 아이템만 (Eddie 확인 후 추가)
    # 2026-07-07 Eddie 판정: Mellow/Mellows, Saba Drink/Saba Kombucha Drink는
    # 서로 다른 음료 — 병합 금지 (딥다이브 스캔에서도 재질문 금지)
}


def _item_key(name):
    n = re.sub(r"\s+", " ", (name or "")).strip()
    n = _SPECIAL_PREFIX.sub("", n)
    n = _DIET_SUFFIX.sub("", n)
    k = n.lower()
    return ITEM_ALIASES.get(k, k)


def merge_item_names(ci_map):
    """카테고리 안에서 같은 키로 정규화되는 아이템 합산. 표시 이름은 식이 태그
    보존한 쪽 우선, 그다음 매출 큰 쪽. 스페셜 프리픽스는 표시에서 제거."""
    out = {}
    for cat, idict in ci_map.items():
        groups = {}
        for name, v in idict.items():
            groups.setdefault(_item_key(name), []).append((name, float(v[0]), float(v[1])))
        nd = {}
        for _k, lst in groups.items():
            if len(lst) == 1:
                nm2, net, qty = lst[0]
            else:
                nm2 = sorted(lst, key=lambda x: (_DIET_SUFFIX.search(x[0]) is None, -x[1]))[0][0]
                net, qty = sum(x[1] for x in lst), sum(x[2] for x in lst)
            nm2 = re.sub(r"\s+", " ", _SPECIAL_PREFIX.sub("", nm2)).strip()
            if nm2 in nd:
                nd[nm2][0] += net
                nd[nm2][1] += qty
            else:
                nd[nm2] = [net, qty]
        out[cat] = nd
    return out


store_data, store_cats, store_catitems = {}, {}, {}
combined_cats = {p[0]: {} for p in periods}
combined_catitems = {}
ccur = {p[0]: [0.0, 0] for p in periods}
cprev = {p[0]: [0.0, 0] for p in periods}
cvalid = {p[0]: True for p in periods}

for acc in ACCOUNTS:
    print("fetching", acc["name"], "...")
    nm = acc["name"]
    store_data[nm] = {}
    store_cats[nm] = {}
    for label, vs, cr, pr in periods:
        cur = net_sales(acc, cr)
        prev = net_sales(acc, pr)
        store_data[nm][label] = {"sales": cur[0], "count": cur[1],
                                 "pct": pct(cur[0], prev[0]),
                                 "aov": (cur[0] / cur[1]) if cur[1] else 0,
                                 "cur": fmt_range(cr[0], cr[1]),
                                 "prev": fmt_range(pr[0], pr[1])}
        ccur[label][0] += cur[0]; ccur[label][1] += cur[1]
        cprev[label][0] += prev[0]; cprev[label][1] += prev[1]
        if prev[0] == 0:
            cvalid[label] = False
        cts = categories(acc, cr)
        store_cats[nm][label] = cts
        for k, v in cts.items():
            combined_cats[label][k] = combined_cats[label].get(k, 0.0) + v
    ci_map = items_by_cat(acc, item_range)
    ci_map = fix_quantities(ci_map, orders_item_qty(acc, item_range))
    ci_map = merge_item_names(ci_map)  # 매장 간 표기 통일
    store_catitems[nm] = ci_map
    for cat, idict in ci_map.items():
        cc = combined_catitems.setdefault(cat, {})
        for name, v in idict.items():
            if name in cc:
                cc[name][0] += v[0]; cc[name][1] += v[1]
            else:
                cc[name] = [v[0], v[1]]

# 매장별 표시 이름이 달라도 (예: St Pauls만 (VE) 없음) Combined에서 한 번 더 병합
combined_catitems = merge_item_names(combined_catitems)

combined = {}
for label, vs, cr, pr in periods:
    c, p = ccur[label], cprev[label]
    combined[label] = {"sales": c[0], "count": c[1],
                       "pct": (pct(c[0], p[0]) if cvalid[label] else None),
                       "aov": (c[0] / c[1]) if c[1] else 0,
                       "cur": fmt_range(cr[0], cr[1]),
                       "prev": fmt_range(pr[0], pr[1])}

# 완결 주(월~일) 최근 4주 비교 — 표시 4주 + WoW 계산용 5주차 (Eddie 스펙 2026-07-05)
print("fetching completed weeks ...")
this_mon = today - timedelta(days=today.weekday())
week_ranges = []
for _i in range(1, 6):
    _ws = this_mon - timedelta(days=7 * _i)
    week_ranges.append((_ws, _ws + timedelta(days=6)))
store_weeks = {}
combined_weeks = [[0.0, 0] for _ in week_ranges]
for acc in ACCOUNTS:
    _wk_vals = []
    for _wi, (_w0, _w1) in enumerate(week_ranges):
        _s, _c = net_sales(acc, [_w0.isoformat(), _w1.isoformat()])
        _wk_vals.append((_s, _c))
        combined_weeks[_wi][0] += _s
        combined_weeks[_wi][1] += _c
    store_weeks[acc["name"]] = _wk_vals

# 완결 월 비교: 최근 3개월 표시 + MoM 계산용 4개월째 (Eddie 스펙 2026-07-06)
month_ranges = []
_m_end = today.replace(day=1) - timedelta(days=1)
for _ in range(4):
    _m_start = _m_end.replace(day=1)
    month_ranges.append((_m_start, _m_end))
    _m_end = _m_start - timedelta(days=1)
store_months = {}
combined_months = [[0.0, 0] for _ in month_ranges]
for acc in ACCOUNTS:
    _mo_vals = []
    for _mi, (_m0, _m1) in enumerate(month_ranges):
        _s, _c = net_sales(acc, [_m0.isoformat(), _m1.isoformat()])
        _mo_vals.append((_s, _c))
        combined_months[_mi][0] += _s
        combined_months[_mi][1] += _c
    store_months[acc["name"]] = _mo_vals

print("fetching context (holidays, events) ...")
holidays = fetch_holidays(today.year)
ctx_tags = build_context_tags()
events = fetch_events((today - timedelta(days=7)).isoformat(), (today + timedelta(days=57)).isoformat())

# context_events.json 병합 — 딥다이브가 웹 리서치로 발행하는 큐레이션 이벤트
# (Ticketmaster가 못 잡는 축제·마라톤·도로 통제·오픈하우스 등). 이름 중복은 제외.
try:
    with open("context_events.json", encoding="utf-8") as _cf:
        _cev = json.load(_cf)
    for _d, _evs in (_cev.get("events") or {}).items():
        cur_names = {e.get("name", "").lower() for e in events.get(_d, [])}
        for _e in _evs:
            if _e.get("name") and _e["name"].lower() not in cur_names:
                events.setdefault(_d, []).append({
                    "name": _e["name"], "venue": _e.get("venue", ""),
                    "kind": _e.get("kind", "other")})
    print("[OK] context_events.json merged")
except Exception as _e:
    print("  ! context_events skip:", _e)
weather = fetch_weather()


def _chg_pill(m, vs):
    if m["pct"] is None:
        return '<span class="chg na">new &middot; no comparison</span>'
    cls = "up" if m["pct"] >= 0 else "down"
    arrow = "&#9650;" if m["pct"] >= 0 else "&#9660;"
    return '<span class="chg {}" title="vs {}">{} {:+.1f}% <small>vs {}</small></span>'.format(
        cls, m["prev"], arrow, m["pct"], vs)


# ---- 매니저 어드바이스 카드 (manager_actions.json, 목요일 딥다이브 발행) ----
# 원칙(Eddie): 정보 최소화 — 카드당 액션 최대 2개, 한 문장씩. 색으로 상태 즉시 전달.
MA_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSfSM_wy_OhOkKvNw8EAUX6kD4dAc8UFUn-sU8VgjiNpxi20Dw/viewform"
MA_MISSION = "Our goal on this page: grow sales."
# gid 제거 (2026-07-13): gid=223892282는 빈 탭을 가리켜 4주간 응답 0건으로 오인.
# 실제 응답은 기본(첫) 탭에 쌓임 — gid 없이 첫 탭을 읽는다.
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
        out[aid] = (st, cm)  # 시트 순서 = 제출 순서, 뒤 제출이 덮어씀
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
    """feedback_log.json에서 에디 확인(approved)된 매니저 회신 — 현재 게시 주만.
    (Tim 분석 → 에디 확인 → 매니저에게 회신하는 피드백 루프의 표시 단계)"""
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


def ma_news():
    """주간 뉴스 (전 매니저 대상 오퍼레이션 브리핑) — 딥다이브가 매주 발행"""
    try:
        with open("manager_actions.json", encoding="utf-8") as f:
            return json.load(f).get("news") or []
    except Exception:
        return []


def ma_card(store, a, week, show_store=False, mode="buttons"):
    """mode="buttons": 지점 매니저용 (응답 버튼 + 상태 칩, 재제출 = undo)
    mode="status": Review 탭용 (오퍼레이션 매니저·총괄 셰프 조회 전용)"""
    if not a:
        return ""
    if a.get("departments"):
        return ma_card_v2(store, a, week, show_store, mode)
    actions = a.get("actions", [])[:2]  # 최대 2개 — 정보 과잉 방지
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


MA_WEEK, MA_SALES = ma_load("sales")
FB_REPLY = fb_replies(MA_WEEK)


def _menu_badges(ci_map):
    """이번 달 아이템 사분면 배지 (판매 데이터 기준, qty>=5)"""
    items = []
    for cat, idict in ci_map.items():
        for n, v in idict.items():
            if float(v[0]) > 0 and float(v[1]) >= 5:
                items.append((n, float(v[0]), float(v[1])))
    if len(items) < 8:
        return {}
    nets = sorted(x[1] for x in items)
    qtys = sorted(x[2] for x in items)
    mn, mq = nets[len(nets) // 2], qtys[len(qtys) // 2]
    out = {}
    for n, net, q in items:
        if net >= mn and q >= mq:
            out[n] = ("&#11088;", "Star: keep it front and centre")
        elif net >= mn:
            out[n] = ("&#129513;", "Push: good money, undersold. Recommend at the till")
        elif q >= mq:
            out[n] = ("&#128014;", "Popular but low dollars: review price or pairing")
        else:
            out[n] = ("&#128062;", "Low seller: cut or rework candidate")
    return out


def menu_panel(ci_map):
    """이번 달 메뉴 사분면 요약 표 — 매장 요약 영역에 표시 (디테일 TOP/BOTTOM은 아래)"""
    items = []
    for cat, idict in ci_map.items():
        for n, v in idict.items():
            if float(v[0]) > 0 and float(v[1]) >= 5:
                items.append((n, float(v[0]), float(v[1])))
    if len(items) < 8:
        return ""
    nets = sorted(x[1] for x in items)
    qtys = sorted(x[2] for x in items)
    mn, mq = nets[len(nets) // 2], qtys[len(qtys) // 2]
    groups = {"star": [], "push": [], "horse": [], "dog": []}
    for n, net, q in items:
        if net >= mn and q >= mq:
            groups["star"].append((net, n))
        elif net >= mn:
            groups["push"].append((net, n))
        elif q >= mq:
            groups["horse"].append((q, n))
        else:
            groups["dog"].append((net, n))
    rows = ""
    spec = [("star", "&#11088;", "Stars &middot; keep front", True),
            ("push", "&#129513;", "Push at the till &middot; good money, undersold", True),
            ("horse", "&#128014;", "Popular, low $ &middot; review price/pairing", True),
            ("dog", "&#128062;", "Cut candidates &middot; lowest sellers", False)]
    for key, em, label, desc in spec:
        g = sorted(groups[key], reverse=desc)
        if not g:
            continue
        names = ", ".join(n for _, n in g[:4])
        if len(g) > 4:
            names += ' <span class="stmore">+{} more</span>'.format(len(g) - 4)
        rows += ('<div class="mqrow"><span class="mqlab">{e} {l}</span>'
                 '<span class="mqnames">{n}</span></div>').format(e=em, l=label, n=names)
    return ('<details class="panel fold" open><summary class="phead"><span class="ptitle">'
            'MENU THIS MONTH &middot; what to push, what to cut</span>'
            '<span class="foldarrow">&#9656;</span></summary>'
            '<div class="foldnote">By sales data only, cost not included.</div>'
            '<div class="wklist">{}</div></details>').format(rows)


def weeks_panel(wk_vals):
    """최근 4주(월~일 완결 주) 매출 비교 패널. wk_vals = [(sales, count) x5], 최근 주 먼저."""
    rows = ""
    for i in range(min(4, len(wk_vals))):
        s, c = wk_vals[i]
        prev = wk_vals[i + 1][0] if i + 1 < len(wk_vals) else 0
        p = pct(s, prev)
        if p is None:
            pill = '<span class="chg na">&ndash;</span>'
        else:
            cls = "up" if p >= 0 else "down"
            arrow = "&#9650;" if p >= 0 else "&#9660;"
            pill = '<span class="chg {}">{} {:+.1f}%</span>'.format(cls, arrow, p)
        ws, we = week_ranges[i]
        rows += ('<div class="wkrow"><span class="wkd">{d}</span>'
                 '<span class="wkv">${v:,.0f}</span>{pill}'
                 '<span class="wka">{cnt:,} orders &middot; AOV ${a:,.2f}</span></div>').format(
            d="{:02d}/{:02d} &ndash; {:02d}/{:02d}".format(ws.day, ws.month, we.day, we.month),
            v=s, pill=pill, cnt=int(c), a=(s / c) if c else 0)
    return ('<div class="panel"><div class="phead"><span class="ptitle">'
            'RECENT WEEKS &middot; MON&ndash;SUN &middot; % vs week before</span></div>'
            '<div class="wklist">{}</div></div>').format(rows)


def months_panel(mo_vals):
    """최근 3개월(완결 월) 매출 비교 패널. mo_vals = [(sales, count) x4], 최근 달 먼저."""
    rows = ""
    for i in range(min(3, len(mo_vals))):
        s, c = mo_vals[i]
        prev = mo_vals[i + 1][0] if i + 1 < len(mo_vals) else 0
        p = pct(s, prev)
        if p is None:
            pill = '<span class="chg na">&ndash;</span>'
        else:
            cls = "up" if p >= 0 else "down"
            arrow = "&#9650;" if p >= 0 else "&#9660;"
            pill = '<span class="chg {}">{} {:+.1f}%</span>'.format(cls, arrow, p)
        ms, me = month_ranges[i]
        rows += ('<div class="wkrow"><span class="wkd"><b>{mn}</b></span>'
                 '<span class="wkv">${v:,.0f}</span>{pill}'
                 '<span class="wka">{cnt:,} orders &middot; AOV ${a:,.2f}</span></div>').format(
            mn=ms.strftime("%B").upper(), v=s, pill=pill, cnt=int(c),
            a=(s / c) if c else 0)
    return ('<details class="panel fold" open><summary class="phead"><span class="ptitle">'
            'RECENT MONTHS &middot; % vs month before</span>'
            '<span class="foldarrow">&#9656;</span></summary>'
            '<div class="wklist">{}</div></details>').format(rows)


def card(label, vs, m, hero=False, color="#0d9488"):
    pill = _chg_pill(m, vs)
    if hero:
        return ('<div class="hero" style="border-top:4px solid {c}">'
                '<div class="plabel">{pl} &middot; NET SALES <span class="hdate">{cur}</span></div>'
                '<div class="hval">${val:,.0f}</div>'
                '<div class="hmeta">{pill}<span class="hsub">{cnt:,} orders &middot; AOV ${aov:,.2f}</span></div>'
                '</div>').format(c=color, pl=label.upper(), cur=m["cur"], val=m["sales"],
                                 pill=pill, cnt=m["count"], aov=m["aov"])
    return ('<div class="card"><div class="plabel">{pl}</div>'
            '<div class="val">${val:,.0f}</div>'
            '{pill}'
            '<div class="sub">{cnt:,} orders &middot; AOV ${aov:,.2f}</div>'
            '<div class="cdate">{cur}</div></div>').format(
        pl=label.upper(), val=m["sales"], pill=pill, cnt=m["count"], aov=m["aov"], cur=m["cur"])


def cat_view(cats, color, date_str, visible):
    disp = "block" if visible else "none"
    total = sum(cats.values())
    if total <= 0:
        return ('<div class="catview" style="display:{d}">'
                '<div class="catdate">{ds}</div><div class="cempty">no data</div></div>').format(d=disp, ds=date_str)
    rows = ""
    for name, val in sorted(cats.items(), key=lambda x: x[1], reverse=True):
        p = val / total * 100
        rows += ('<div class="catrow"><span class="cn" title="{n}">{n}</span>'
                 '<span class="cbar"><span style="width:{p:.1f}%;background:{c}"></span></span>'
                 '<span class="cv">${v:,.0f}</span><span class="cp">{p:.0f}%</span></div>').format(
            n=name, p=p, c=color, v=val)
    return ('<div class="catview" style="display:{d}">'
            '<div class="catdate">{ds}</div>{r}</div>').format(d=disp, ds=date_str, r=rows)


def _irows(rows, max_net=None, badges=None):
    s = ""
    for i, (name, net, qty) in enumerate(rows, 1):
        q = "{:,.0f}".format(qty) if qty > 0 else "&ndash;"
        bar = ""
        if max_net:
            bar = '<span class="ibar" style="width:{:.1f}%"></span>'.format(min(net / max_net * 100, 100))
        bd = ""
        if badges and name in badges:
            em, tip = badges[name]
            bd = '<span class="mbadge" title="{t}">{e}</span> '.format(t=tip, e=em)
        s += ('<div class="irow"><span class="irank">{r}</span>'
              '<span class="iname" title="{n}">{bd}{n}{b}</span>'
              '<span class="ival">${v:,.0f}</span>'
              '<span class="iqty">{q}</span></div>').format(r=i, n=name, v=net, q=q, b=bar, bd=bd)
    return s


def cat_item_card(cat, items_dict, badges=None, n=10):
    total = sum(v[0] for v in items_dict.values())
    sellers = sorted(((name, v[0], v[1]) for name, v in items_dict.items() if v[0] > 0),
                     key=lambda x: x[1], reverse=True)
    top = sellers[:n]
    bottom = sorted(sellers[n:], key=lambda x: x[1])[:n]
    head = ('<div class="itemtitle"><span class="catn">{c}</span>'
            '<span class="cattot">${t:,.0f}</span></div>').format(c=cat, t=total)
    max_net = top[0][1] if top else None
    body = '<div class="ilabel top">TOP {}</div>'.format(len(top)) + _irows(top, max_net, badges)
    if bottom:
        body += '<div class="ilabel bot">BOTTOM {}</div>'.format(len(bottom)) + _irows(bottom, None, badges)
    return '<div class="itemcard">' + head + body + '</div>'


def store_block(name, data, color, cats_by_period, catitems_map, wk_vals=None, mo_vals=None):
    sid = slug(name)
    # hero = Today, compact cards = week/month/year
    hero = card(periods[0][0], periods[0][1], data[periods[0][0]], hero=True, color=color)
    sc = "".join(card(lbl, vs, data[lbl]) for lbl, vs, _, _ in periods[1:])
    wkpanel = weeks_panel(wk_vals) if wk_vals else ""
    mopanel = months_panel(mo_vals) if mo_vals else ""
    menupanel = menu_panel(catitems_map)
    ma = ma_card(name, MA_SALES.get(name), MA_WEEK)
    badges = _menu_badges(catitems_map)
    # category mix: one panel, period toggle
    btns = "".join('<button class="pbtn{a}" onclick="showPeriod(\'{sid}\',{i})">{s}</button>'.format(
        a=(" active" if i == 0 else ""), sid=sid, i=i, s=lbl.replace("This ", ""))
        for i, (lbl, vs, cr, pr) in enumerate(periods))
    cviews = "".join(cat_view(cats_by_period.get(lbl, {}), color, fmt_range(cr[0], cr[1]), i == 0)
                     for i, (lbl, vs, cr, pr) in enumerate(periods))
    catpanel = ('<details class="panel fold" open><summary class="phead"><span class="ptitle">CATEGORY MIX</span>'
                '<span class="foldarrow">&#9656;</span></summary>'
                '<div class="pbtns foldbtns" id="pb-{sid}">{b}</div>'
                '<div id="cats-{sid}">{v}</div></details>').format(sid=sid, b=btns, v=cviews)
    # top/bottom items: biggest categories first, small ones collapsed
    ordered_cats = [(cat, idict) for cat, idict in
                    sorted(catitems_map.items(), key=lambda kv: sum(v[0] for v in kv[1].values()), reverse=True)
                    if sum(v[0] for v in idict.values()) > 0]
    main_cards = "".join(cat_item_card(cat, idict, badges) for cat, idict in ordered_cats[:4])
    more = ""
    if len(ordered_cats) > 4:
        more_cards = "".join(cat_item_card(cat, idict, badges) for cat, idict in ordered_cats[4:])
        more = ('<details class="morecats"><summary>+ {n} more categories</summary>'
                '<div class="cards itemcards">{c}</div></details>').format(
            n=len(ordered_cats) - 4, c=more_cards)
    if not main_cards:
        main_cards = '<div class="itemcard"><div class="cempty">no item data</div></div>'
    tbpanel = ('<details class="panel fold" open><summary class="phead"><span class="ptitle">'
               'TOP &amp; BOTTOM 10 BY CATEGORY &middot; THIS MONTH</span>'
               '<span class="foldarrow">&#9656;</span></summary>'
               '<div class="foldnote">{mr} &middot; $ net &middot; units sold &middot; '
               '&#11088; keep front &middot; &#129513; recommend at till &middot; '
               '&#128014; review price &middot; &#128062; cut candidate</div>'
               '<div class="cards itemcards">{ti}</div>{more}</details>').format(
        mr=ITEM_RANGE_STR, ti=main_cards, more=more)
    howto = ('<details class="howto"><summary>&#8505; How to read this page</summary>'
             '<div class="note"><b>Today</b> card is live and updates on each build. '
             '<b>THIS WEEK</b> card is our advice from the Thursday review. Reply with the '
             'Done / Can&#39;t do buttons. '
             '<b>RECENT WEEKS</b> are finished Mon to Sun weeks, safe to compare. '
             'Tap a section title (&#9656;) to collapse or open it. '
             'All dollars are net sales from Square.</div></details>')
    return ('<section class="store">'
            '<h2><span class="dot" style="background:{c}"></span>{n}</h2>'
            '{ma}'
            '{hero}'
            '<div class="cards periodcards">{sc}</div>'
            '{wkpanel}'
            '{howto}'
            '{mopanel}'
            '{menupanel}'
            '{catpanel}'
            '{tbpanel}</section>').format(
        c=color, n=name, ma=ma, hero=hero, sc=sc, wkpanel=wkpanel, howto=howto,
        mopanel=mopanel, menupanel=menupanel, catpanel=catpanel, tbpanel=tbpanel)


def context_view(holidays, tags, events, weather):
    today_iso = today.isoformat()
    rows = ""
    for off in range(-7, 57):
        dd = today + timedelta(days=off)
        d = dd.isoformat()
        dlabel = "{:02d}/{:02d} ({})".format(dd.day, dd.month, WD[dd.weekday()])
        chips = ""
        if d in weather and weather[d] >= 1:
            chips += '<span class="chip rain">&#127783; {:.0f}mm</span>'.format(weather[d])
        if d in holidays:
            chips += '<span class="chip ph">{}</span>'.format(holidays[d])
        for kind, label in tags.get(d, []):
            chips += '<span class="chip {}">{}</span>'.format(kind, label)
        evs = events.get(d, [])
        for ev in evs[:6]:
            t = (ev["name"] + ((" @ " + ev["venue"]) if ev["venue"] else "")).replace('"', "")
            chips += '<span class="chip {k}" title="{t}">{n}</span>'.format(k=ev.get("kind", "other"), t=t, n=ev["name"])
        if len(evs) > 6:
            chips += '<span class="chip more">+{} more</span>'.format(len(evs) - 6)
        if not chips:
            chips = '<span class="ctxnone">&mdash;</span>'
        cls = "ctxrow"
        td = ""
        if d == today_iso:
            cls += " today"; td = ' <b>&middot; TODAY</b>'
        elif d > today_iso:
            cls += " future"
        rows += ('<div class="{cls}" data-date="{dt}"><span class="ctxdate">{dl}{td}</span>'
                 '<span class="ctxchips">{ch}</span></div>').format(cls=cls, dt=d, dl=dlabel, td=td, ch=chips)
    return ('<section class="store">'
            '<h2><span class="dot" style="background:#0ea5e9"></span>Holidays &amp; Events (Brisbane)</h2>'
            '<div class="ctxnote">Past 2 weeks + next 3 weeks. '
            '<span class="chip ph">Public holiday</span> '
            '<span class="chip school">School holiday</span> '
            '<span class="chip music">Music</span> '
            '<span class="chip sport">Sport</span> '
            '<span class="chip other">Other (run/parade/festival)</span> '
            '&nbsp;(Music/Sport auto; add Ticketek/runs manually)</div>'
            '<div class="ctxlist">' + rows + '</div></section>')


def news_panel(news_lines, holidays, events):
    """THIS WEEK NEWS — 모든 탭 위에 상시 표시. 수동 뉴스(딥다이브 발행) + 7일 이벤트 자동."""
    items = "".join('<div class="newsrow">&#128204; {}</div>'.format(t) for t in news_lines)
    autos = ""
    seen = {t.lower() for t in news_lines}
    for off in range(0, 7):
        dd = today + timedelta(days=off)
        d = dd.isoformat()
        day = "{} {:02d}/{:02d}".format(WD[dd.weekday()], dd.day, dd.month)
        if d in holidays:
            autos += ('<div class="newsrow"><b>{}</b> &middot; Public holiday: {}'
                      '</div>').format(day, holidays[d])
        for ev in events.get(d, [])[:3]:
            nm = ev.get("name", "")
            if any(nm.lower() in s for s in seen):
                continue  # 수동 뉴스에서 이미 언급
            autos += ('<div class="newsrow"><b>{}</b> &middot; {}{}</div>').format(
                day, nm, (" @ " + ev["venue"]) if ev.get("venue") else "")
    if not items and not autos:
        return ""
    return ('<div class="panel newsp"><div class="phead"><span class="ptitle">'
            '&#128240; THIS WEEK &middot; NEWS FOR ALL MANAGERS</span></div>'
            '{}{}</div>').format(items, autos)


COLORS = {"Adelaide St": "#2563eb", "Edward St": "#d97706", "St Pauls Ter": "#7c3aed"}
COMBINED_COLOR = "#0d9488"
DISPLAY_ORDER = ["Adelaide St", "Edward St", "St Pauls Ter"]


# ---- Voices 탭 (reviews.json, 목요일 딥다이브가 주간 리뷰 로그에서 변환·발행) ----
def rv_load():
    try:
        with open("reviews.json", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _rv_stars(n):
    try:
        n = max(0, min(5, int(n)))
    except (TypeError, ValueError):
        n = 0
    return ('<span class="rvstars">' + "&#9733;" * n
            + '<span class="rvoff">' + "&#9733;" * (5 - n) + '</span></span>')


def voices_view():
    rv = rv_load()
    h = ('<section class="store"><h2><span class="dot" style="background:#e11d48"></span>'
         'Customer Voices &middot; Google reviews</h2>')
    if not rv or not rv.get("stores"):
        return (h + '<div class="panel"><div class="cempty">No review data yet &mdash; '
                'published every Thursday.</div></div></section>')
    ov = rv.get("overall") or {}
    h += ('<div class="ctxnote">Week {wk} &middot; <b>{n} new reviews</b> &middot; weekly average '
          '<b>{a} stars</b>.</div>').format(
        wk=rv.get("week", ""), n=ov.get("new_reviews", "?"), a=ov.get("avg_stars", "?"))
    h += ('<details class="howto"><summary>&#8505; How to read this page</summary>'
          '<div class="note">These are real Google reviews from last week, updated every '
          'Thursday. <b>Replies are handled by the owner team</b> &mdash; nothing for you to '
          'answer here. Start with the theme cards: <b>FIX THIS</b> is something guests keep '
          'mentioning that we can fix on the floor, <b>GUESTS LOVE</b> is what is working, '
          'keep doing it. Then open your store panel to read every new review word for word. '
          'The big number is your store&#39;s overall Google rating. '
          'Tap a section title (&#9656;) to collapse or open it.</div></details>')
    for t in rv.get("themes") or []:
        praise = (t.get("kind") or "").lower() == "praise"
        act = ""
        if t.get("action"):
            act = ('<div class="marow"><div class="matop"><span class="maid">DO</span>'
                   '<span class="matx">{}</span></div></div>').format(t["action"])
        h += ('<div class="macard{c}"><div class="mahead">{l} &middot; {ti}</div>'
              '<div class="maline">{n}</div>{a}</div>').format(
            c=(" good" if praise else ""), l=("GUESTS LOVE" if praise else "FIX THIS"),
            ti=t.get("title", ""), n=t.get("note", ""), a=act)
    stores = rv.get("stores") or {}
    order = DISPLAY_ORDER + [k for k in stores if k not in DISPLAY_ORDER]
    for nm in order:
        s = stores.get(nm)
        if not s:
            continue
        col = COLORS.get(nm, "#e11d48")
        rows = ""
        for r in s.get("new") or []:
            tags = "".join('<span class="rvtag">{}</span>'.format(t)
                           for t in (r.get("tags") or []))
            note = ('<div class="rvnote">&#9432; {}</div>'.format(r["note"])
                    if r.get("note") else "")
            rows += ('<div class="rvrow">{st}<span class="rvdate">{d}</span>'
                     '<span class="rvwho">{w}</span>'
                     '<div class="rvtx">{t}</div><div>{tags}</div>{note}</div>').format(
                st=_rv_stars(r.get("stars")), d=r.get("date", ""), w=r.get("who", ""),
                t=(r.get("text") or '<span class="rvonly">(rating only)</span>'),
                tags=tags, note=note)
        if not rows:
            rows = '<div class="cempty">No new reviews this week.</div>'
        h += ('<details class="panel fold" open><summary class="phead">'
              '<span class="ptitle" style="color:{c}">{n} &middot; NEW REVIEWS</span>'
              '<span class="rvbig">{r} <small>&#9733; overall &middot; {cnt:,} reviews</small>'
              '</span><span class="foldarrow">&#9656;</span></summary>{rows}</details>').format(
            c=col, n=nm.upper(), r=s.get("rating", "?"),
            cnt=int(s.get("count", 0) or 0), rows=rows)
    h += '</section>'
    return h

# ---- Meetings 탭 (회의 폼 + meetings.json 정리본, 매니저용) ----
MEETING_FORM_URL = ("https://docs.google.com/forms/d/e/"
                    "1FAIpQLScA6Pe6EYajLbn8XM7rBvJc-hswk8pgOUcZU9vcnZtcjWSsgQ/viewform")
MEETINGS_CSV = ("https://docs.google.com/spreadsheets/d/1INkZiSAlVR5pRnyVx_SDRrSeivRMRbgDozOaEwjdSCI"
                "/gviz/tq?tqx=out:csv&headers=1&gid=1934569787")
MEETING_COLORS = {"Operation Manager": "#0e7490", "Store Manager": "#2563eb",
                  "Marketing": "#be185d", "Executive Chef": "#b45309", "기타": "#6b7280"}


def _mt_esc(s):
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _mt_all():
    try:
        with open("meetings.json", encoding="utf-8") as f:
            return json.load(f).get("meetings") or []
    except Exception:
        return []


def mt_load():
    """매니저 페이지용 — visibility가 owner인 회의는 숨긴다 (오너 사이트에만 표시)"""
    return [m for m in _mt_all() if (m.get("visibility") or "all") != "owner"]


def mt_form_rows():
    """회의 폼 응답 시트 원본 (Tim 정리 전 제출분)"""
    import csv as _csv
    import io as _io
    try:
        req = urllib.request.Request(MEETINGS_CSV, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read().decode("utf-8")
        rows = list(_csv.reader(_io.StringIO(text)))
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
        title = col(r, "meeting name", "title")
        if not title:
            continue
        out.append({"ts": col(r, "timestamp"), "title": title,
                    "type": col(r, "type") or "기타",
                    "attendees": col(r, "attendee"), "date": col(r, "date"),
                    "notes": col(r, "note"), "actions": col(r, "action")})
    return out


def _mt_card(m):
    t = m.get("type", "기타")
    c = MEETING_COLORS.get(t, "#6b7280")
    att = m.get("attendees") or []
    att = ", ".join(att) if isinstance(att, list) else str(att)
    dec = "".join("<li>{}</li>".format(_mt_esc(x)) for x in (m.get("decisions") or []))
    dec_html = ('<div class="ilabel top">DECISIONS</div><ul class="mtul">' + dec + '</ul>') if dec else ""
    arows = ""
    for a in (m.get("actions") or []):
        ok = (a.get("status") or "open").lower() in ("done", "closed")
        due = a.get("due") or ""
        arows += ('<li>{t} <span class="mtmeta">{o}{d}</span> '
                  '<span class="machip {c}">{s}</span></li>').format(
            t=_mt_esc(a.get("text", "")), o=_mt_esc(a.get("owner", "")),
            d=(" &middot; by " + due[5:].replace("-", "/")) if due else "",
            c=("done" if ok else "prog"), s=("done" if ok else "open"))
    act_html = ('<div class="ilabel top">ACTIONS</div><ul class="mtul">' + arows + '</ul>') if arows else ""
    notes_html = ('<div class="mtnotes">{}</div>'.format(_mt_esc(m.get("notes", "")))
                  if m.get("notes") else "")
    return ('<div class="panel"><div class="mthead">'
            '<span class="mttype" style="background:{c}1a;color:{c}">{t}</span>'
            '<b>{title}</b><span class="mtmeta">{date}{att}</span></div>'
            '{notes}{dec}{act}</div>').format(
        c=c, t=_mt_esc(t), title=_mt_esc(m.get("title", "")), date=m.get("date", ""),
        att=(" &middot; " + _mt_esc(att)) if att else "", notes=notes_html,
        dec=dec_html, act=act_html)


def meetings_view():
    h = ('<section class="store"><h2><span class="dot" style="background:#0e7490"></span>'
         'Meetings</h2>')
    h += ('<a class="mtformbtn" target="_blank" href="{u}">&#9998; Log a meeting &mdash; '
          'fill the form right after your meeting</a>').format(u=MEETING_FORM_URL)
    h += ('<details class="howto"><summary>&#8505; How this works</summary>'
          '<div class="note">After any meeting, tap the button above and fill the form '
          '(2 minutes). Your submission shows below as <b>waiting for summary</b>, then Tim '
          'turns it into a clean summary with decisions and actions. Actions from all '
          'meetings are collected in the to-do list at the top, sorted by due date. '
          'Red date = overdue.</div></details>')
    meetings = sorted(mt_load(), key=lambda m: m.get("date", ""), reverse=True)
    acts = []
    for m in meetings:
        for a in (m.get("actions") or []):
            if (a.get("status") or "open").lower() in ("done", "closed", "cancelled"):
                continue
            acts.append((a.get("due") or "9999-12-31", a.get("text", ""),
                         a.get("owner", ""), m.get("title", "")))
    acts.sort()
    if acts:
        rows = ""
        for due, text, owner, mtt in acts[:20]:
            overdue = due != "9999-12-31" and due < today.isoformat()
            dd = "&ndash;" if due == "9999-12-31" else due[5:].replace("-", "/")
            rows += ('<div class="wkrow"><span class="wkd"{st}>{d}</span>'
                     '<span class="matx">{t}</span>'
                     '<span class="wka">{o}{m}</span></div>').format(
                st=(' style="color:#d2372c;font-weight:800"' if overdue else ""), d=dd,
                t=_mt_esc(text), o=_mt_esc(owner),
                m=((" &middot; " + _mt_esc(mtt)) if mtt else ""))
        h += ('<div class="panel"><div class="phead"><span class="ptitle">TO DO FROM '
              'MEETINGS &middot; BY DUE DATE</span></div><div class="wklist">'
              + rows + '</div></div>')
    if not meetings:
        h += ('<div class="panel"><div class="cempty">No meeting summaries yet. '
              'Log your first meeting with the button above.</div></div>')
    for m in meetings[:5]:
        h += _mt_card(m)
    if len(meetings) > 5:
        h += ('<details class="morecats"><summary>+ {n} earlier meetings</summary>{c}'
              '</details>').format(n=len(meetings) - 5,
                                   c="".join(_mt_card(m) for m in meetings[5:50]))
    forms = mt_form_rows()
    done_ts = {m.get("form_ts") for m in _mt_all() if m.get("form_ts")}
    raw = [fr for fr in forms if fr["ts"] and fr["ts"] not in done_ts]
    if raw:
        rc = ""
        for fr in raw[:15]:
            rc += ('<div class="marow"><div class="matop"><span class="maid">NEW</span>'
                   '<span class="matx"><b>{t}</b> <span class="mtmeta">{d}{a}</span>'
                   '<br>{n}</span></div></div>').format(
                t=_mt_esc(fr["title"]), d=_mt_esc(fr["date"]),
                a=((" &middot; " + _mt_esc(fr["attendees"])) if fr["attendees"] else ""),
                n=_mt_esc(fr["notes"]))
        h += ('<div class="panel"><div class="phead"><span class="ptitle">SUBMITTED &middot; '
              'WAITING FOR TIM&#39;S SUMMARY</span></div>' + rc + '</div>')
    h += '</section>'
    return h


name_to_acc = {a["name"]: a for a in ACCOUNTS}
ordered = [name_to_acc[n] for n in DISPLAY_ORDER if n in name_to_acc]
ordered += [a for a in ACCOUNTS if a["name"] not in DISPLAY_ORDER]

# Review 탭 (구 Combined): 3매장 액션 응답 상태 조회(오퍼레이션 매니저·총괄 셰프) + 통합 숫자
_ma_review = "".join(ma_card(a["name"], MA_SALES.get(a["name"]), MA_WEEK,
                             show_store=True, mode="status") for a in ACCOUNTS)
views = [("combined", "&#128202; Review",
          _ma_review +
          store_block("COMBINED &mdash; all 3 cafes", combined, COMBINED_COLOR,
                      combined_cats, combined_catitems, combined_weeks,
                      combined_months))]
for acc in ordered:
    nm = acc["name"]
    views.append((slug(nm), nm,
                  store_block(nm, store_data[nm], COLORS.get(nm, "#6b7280"),
                              store_cats.get(nm, {}), store_catitems.get(nm, {}),
                              store_weeks.get(nm), store_months.get(nm))))
views.append(("voices", "&#128172; Voices", voices_view()))
views.append(("meetings", "&#129309; Meetings", meetings_view()))
views.append(("context", "Context", context_view(holidays, ctx_tags, events, weather)))

NEWS_HTML = news_panel(ma_news(), holidays, events)

nav = '<div class="nav">'
view_html = ""
TOPBAR_VIEWS = ("voices", "meetings")  # 나브 필 대신 상단 우측 링크(Orders 옆)로 노출 (Eddie 2026-07-13)
for i, (sl, label, h) in enumerate(views):
    if sl not in TOPBAR_VIEWS:
        nav += '<button class="navbtn{a}" data-view="{s}" onclick="showView(\'{s}\')">{l}</button>'.format(
            a=(" active" if i == 0 else ""), s=sl, l=label)
    view_html += '<div class="view" id="view-{s}" style="display:{d}">{h}</div>'.format(
        s=sl, d=("block" if i == 0 else "none"), h=h)
nav += '</div>'

TEMPLATE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Hideout - Sales Dashboard</title>
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f4f1;color:#211d19}
main{max-width:1180px;margin:0 auto;padding:0 16px 56px}
.topbar{position:sticky;top:0;z-index:20;background:rgba(246,244,241,.95);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:3px solid #0d9488}
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
.navbtn.active{background:#211d19;color:#fff;border-color:#211d19}
.asof{color:#8a8378;font-size:12px;margin:14px 2px}
.store{margin-bottom:40px}
.store h2{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;margin:0 0 12px}
.dot{width:10px;height:10px;border-radius:99px;flex-shrink:0}
.hero{background:#fff;border:1px solid #e7e2db;border-radius:16px;padding:18px 20px;box-shadow:0 1px 3px rgba(30,25,20,.05);margin-bottom:10px}
.hdate{color:#a39b8e;font-weight:600;letter-spacing:0;margin-left:6px}
.hval{font-size:clamp(34px,9vw,44px);font-weight:800;letter-spacing:-.02em;margin:6px 0 10px;font-variant-numeric:tabular-nums}
.hmeta{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.hsub{font-size:13px;color:#6f695f}
.plabel{font-size:11px;letter-spacing:.07em;color:#8a8378;font-weight:700}
.cards{display:grid;gap:10px}
.periodcards{grid-template-columns:1fr}
.itemcards{margin-top:2px;grid-template-columns:1fr;align-items:start}
@media(min-width:640px){
  .periodcards{grid-template-columns:repeat(3,1fr)}
  .itemcards{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
}
.card{background:#fff;border:1px solid #e7e2db;border-radius:14px;padding:14px 16px;box-shadow:0 1px 2px rgba(30,25,20,.04)}
.val{font-size:24px;font-weight:800;margin:4px 0 8px;font-variant-numeric:tabular-nums}
.chg{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px;vertical-align:middle}
.chg small{font-weight:600;opacity:.75;font-size:11px}
.chg.up{background:#e8f6ee;color:#0f8a43}
.chg.down{background:#fdeceb;color:#d2372c}
.chg.na{background:#efece7;color:#8a8378}
.sub{font-size:12px;color:#6f695f;margin-top:8px}
.cdate{font-size:11px;color:#a39b8e;margin-top:3px}
.panel{background:#fff;border:1px solid #e7e2db;border-radius:16px;padding:14px 18px;margin-top:10px;box-shadow:0 1px 2px rgba(30,25,20,.04)}
.phead{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:4px}
.ptitle{font-size:11px;letter-spacing:.07em;color:#8a8378;font-weight:700}
.pbtns{display:flex;gap:2px;background:#f1eee9;border-radius:999px;padding:3px}
.pbtn{font:inherit;font-size:12px;font-weight:700;color:#6f695f;background:transparent;border:0;border-radius:999px;padding:6px 12px;cursor:pointer;white-space:nowrap}
.pbtn.active{background:#fff;color:#211d19;box-shadow:0 1px 2px rgba(0,0,0,.1)}
.catdate{font-size:11px;color:#a39b8e;margin:2px 0 8px}
.cempty{font-size:12px;color:#a39b8e;padding:8px 0}
.catrow{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px}
.catrow .cn{width:104px;color:#4b4740;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.catrow .cbar{flex:1;height:8px;background:#f1eee9;border-radius:5px;overflow:hidden;min-width:24px}
.catrow .cbar span{display:block;height:100%;border-radius:5px}
.catrow .cv{width:72px;text-align:right;font-weight:700;flex-shrink:0;font-variant-numeric:tabular-nums}
.catrow .cp{width:38px;text-align:right;color:#8a8378;flex-shrink:0;font-variant-numeric:tabular-nums}
.wklist{padding-top:4px}
.wkrow{display:flex;align-items:center;gap:10px;padding:7px 0;font-size:13px;border-bottom:1px solid #f6f4f1}
.wkrow:last-child{border-bottom:none}
.wkd{width:104px;color:#6f695f;flex-shrink:0;font-variant-numeric:tabular-nums}
.wkv{width:78px;text-align:right;font-weight:800;font-variant-numeric:tabular-nums;flex-shrink:0}
.wka{margin-left:auto;font-size:11px;color:#a39b8e;white-space:nowrap}
.wkrow.mo{border-top:2px solid #e7e2db;margin-top:3px;padding-top:10px}
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
.mbadge{cursor:help}
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
.newsp{border-left:4px solid #0d9488;margin:12px 0 2px}
.newsrow{font-size:12.5px;color:#4b4740;padding:5px 0;line-height:1.55;border-bottom:1px solid #f6f4f1}
.newsrow:last-child{border-bottom:none}
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
details.fold summary{cursor:pointer;list-style:none;margin-bottom:0}
details.fold summary::-webkit-details-marker{display:none}
details.fold[open] summary{margin-bottom:4px}
.foldarrow{color:#a39b8e;font-size:12px;transition:transform .15s;flex-shrink:0}
details.fold[open] .foldarrow{transform:rotate(90deg)}
.foldnote{font-size:11px;color:#a39b8e;margin:2px 0 8px;line-height:1.6}
.foldbtns{margin:6px 0 8px;width:max-content;max-width:100%;overflow-x:auto}
details.howto{margin:14px 0 4px}
.howto summary{cursor:pointer;font-size:12px;font-weight:700;color:#6f695f;padding:10px 14px;background:#fff;border:1px solid #e7e2db;border-radius:12px;list-style:none}
.howto summary::-webkit-details-marker{display:none}
.howto .note{font-size:12px;color:#6f695f;background:#fff;border:1px solid #e7e2db;border-top:none;border-radius:0 0 12px 12px;padding:12px 16px;line-height:1.8;margin-top:-6px}
.mqrow{display:flex;gap:10px;padding:7px 0;font-size:12.5px;border-bottom:1px solid #f6f4f1;flex-wrap:wrap}
.mqrow:last-child{border-bottom:none}
.mqlab{font-weight:800;color:#4b4740;flex-shrink:0;min-width:210px}
.mqnames{color:#6f695f;flex:1;min-width:160px}
.stmore{color:#a39b8e;font-size:11px}
@media(max-width:480px){
.wka{display:none}
.wkd{width:92px;font-size:12px}
.wkv{width:70px}
}
.rvstars{color:#f59e0b;font-size:13px;letter-spacing:1px}
.rvstars .rvoff{color:#e7e2db}
.rvrow{padding:9px 0;border-bottom:1px solid #f6f4f1;font-size:13px}
.rvrow:last-child{border-bottom:none}
.rvdate{color:#a39b8e;font-size:11px;margin-left:8px}
.rvwho{color:#8a8378;font-size:11px;font-weight:700;margin-left:8px}
.rvtx{color:#4b4740;line-height:1.55;margin-top:3px}
.rvonly{color:#a39b8e;font-style:italic}
.rvtag{display:inline-block;font-size:10px;font-weight:700;background:#f1eee9;color:#6f695f;border-radius:999px;padding:2px 8px;margin:4px 4px 0 0}
.rvnote{font-size:11px;color:#b45309;margin-top:3px}
.rvbig{font-size:16px;font-weight:800;color:#211d19}
.rvbig small{font-size:11px;color:#a39b8e;font-weight:700}
.mtformbtn{display:block;text-align:center;font-size:14px;font-weight:800;color:#fff;background:#0e7490;border-radius:14px;padding:14px 16px;text-decoration:none;margin:2px 0 10px;box-shadow:0 1px 3px rgba(30,25,20,.12)}
.mthead{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:14px}
.mttype{font-size:10px;font-weight:800;border-radius:7px;padding:3px 9px;letter-spacing:.03em;flex-shrink:0}
.mtmeta{font-size:11px;color:#a39b8e;font-weight:600}
.mtnotes{font-size:12.5px;color:#4b4740;line-height:1.6;margin-top:8px;white-space:pre-wrap}
.mtul{margin:4px 0 0;padding-left:18px;font-size:12.5px;color:#211d19;line-height:1.7}
.mtul li{margin:3px 0}
.sectlabel{font-size:11px;letter-spacing:.06em;color:#8a8378;font-weight:700;margin:20px 2px 8px}
.itemcard{background:#fff;border:1px solid #e7e2db;border-radius:14px;padding:12px 16px;box-shadow:0 1px 2px rgba(30,25,20,.04)}
.itemtitle{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:14px;font-weight:800;margin-bottom:4px;border-bottom:1px solid #f1eee9;padding-bottom:8px}
.itemtitle .catn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cattot{font-size:12px;color:#8a8378;font-weight:700;flex-shrink:0;font-variant-numeric:tabular-nums}
.ilabel{font-size:10px;letter-spacing:.07em;font-weight:800;margin:10px 0 2px}
.ilabel.top{color:#8a8378}
.ilabel.bot{color:#b45309}
.irow{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;border-bottom:1px solid #f6f4f1}
.irow:last-child{border-bottom:none}
.irank{width:16px;color:#c4bcae;font-weight:800;flex-shrink:0;font-variant-numeric:tabular-nums}
.iname{flex:1;color:#4b4740;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:relative;padding-bottom:3px}
.ibar{position:absolute;left:0;bottom:0;height:2px;border-radius:2px;background:#e2ddd5}
.ival{width:66px;text-align:right;font-weight:700;flex-shrink:0;font-variant-numeric:tabular-nums}
.iqty{width:52px;text-align:right;color:#a39b8e;flex-shrink:0;font-variant-numeric:tabular-nums}
details.morecats{margin-top:10px}
.morecats summary{cursor:pointer;font-size:13px;font-weight:700;color:#6f695f;padding:12px;background:#fff;border:1px dashed #d8d2c8;border-radius:12px;text-align:center;list-style:none}
.morecats summary::-webkit-details-marker{display:none}
.morecats[open] summary{margin-bottom:10px}
.ctxnote{font-size:12px;color:#8a8378;margin:0 0 12px;line-height:2.1}
.ctxlist{background:#fff;border:1px solid #e7e2db;border-radius:16px;padding:4px 16px}
.ctxrow{display:flex;align-items:flex-start;gap:12px;padding:9px 0;border-bottom:1px solid #f1eee9;font-size:13px}
.ctxrow:last-child{border-bottom:none}
.ctxrow.today{background:#fbf7ee;margin:0 -16px;padding-left:16px;padding-right:16px;border-radius:8px}
.ctxrow.future{opacity:.85}
.ctxdate{width:140px;color:#4b4740;font-weight:600;flex-shrink:0}
.ctxchips{display:flex;gap:6px;flex-wrap:wrap;flex:1}
.ctxnone{color:#ddd6cb}
.chip{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
.chip.ph{background:#fee2e2;color:#b91c1c}
.chip.school{background:#fef3c7;color:#92400e}
.chip.music{background:#fce7f3;color:#be185d}
.chip.sport{background:#dcfce7;color:#15803d}
.chip.other{background:#ddd6fe;color:#6d28d9}
.chip.more{background:#e7e2db;color:#6f695f}
.chip.rain{background:#dbeafe;color:#1d4ed8}
@media (max-width:640px){
  .ctxrow{flex-direction:column;gap:4px}
  .ctxdate{width:auto}
  .chip{max-width:100%;white-space:normal}
  .tblinks a{padding:6px 9px}
}
</style></head><body>
<header class="topbar"><div class="tbin">
<div class="tbrow"><h1>The Hideout <span class="pagetag" style="background:#0d9488">&#128202; SALES</span></h1>
<div class="tblinks"><a href="https://hideoutdb.com/roster.html" target="_top">&#128197; Roster</a><a href="https://hideoutdb.com/cogs.html" target="_top">&#129534; COGS</a><a href="https://order.hideoutdb.com" target="_top">&#129386; Orders</a><a href="javascript:void(0)" onclick="showView('voices')">&#128172; Voices</a><a href="javascript:void(0)" onclick="showView('meetings')">&#129309; Meetings</a></div></div>
__NAV__
</div></header>
<main>
<p class="asof">As of __ASOF__ (Brisbane) &nbsp;&middot;&nbsp; each period: start date &rarr; today</p>
<div id="newsbox">__NEWS__</div>
__VIEWS__
</main>
<script>
function showView(s){
  var vs=document.querySelectorAll('.view');
  for(var i=0;i<vs.length;i++){vs[i].style.display='none';}
  var t=document.getElementById('view-'+s);
  if(t){t.style.display='block';}
  var bs=document.querySelectorAll('.navbtn');
  for(var j=0;j<bs.length;j++){bs[j].classList.remove('active');}
  var ab=document.querySelector('.navbtn[data-view="'+s+'"]');
  if(ab){ab.classList.add('active');}
  var nb=document.getElementById('newsbox');
  if(nb){nb.style.display=((s==='voices'||s==='meetings')?'none':'');}
  window.scrollTo(0,0);
}
function showPeriod(sid,i){
  var box=document.getElementById('cats-'+sid);
  if(!box)return;
  var vs=box.querySelectorAll('.catview');
  for(var k=0;k<vs.length;k++){vs[k].style.display=(k==i?'block':'none');}
  var bs=document.querySelectorAll('#pb-'+sid+' .pbtn');
  for(var j=0;j<bs.length;j++){bs[j].classList.toggle('active',j==i);}
}
var SHEET_URL="__SHEET_URL__";
function parseCSVLine(line){var out=[],cur="",q=false;for(var i=0;i<line.length;i++){var c=line[i];if(q){if(c=='"'){if(line[i+1]=='"'){cur+='"';i++;}else{q=false;}}else cur+=c;}else{if(c=='"')q=true;else if(c==','){out.push(cur);cur="";}else cur+=c;}}out.push(cur);return out;}
function addDays(iso,n){var d=new Date(iso+"T00:00:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}
function loadSheetEvents(){
  if(!SHEET_URL||SHEET_URL.indexOf("SHEET_ID")>=0)return;
  fetch(SHEET_URL).then(function(r){return r.text();}).then(function(t){
    var lines=t.split(String.fromCharCode(10)).filter(function(l){return l.trim().length;});
    for(var i=1;i<lines.length;i++){
      var f=parseCSVLine(lines[i]);
      var date=(f[0]||"").trim(),end=(f[1]||"").trim();
      var type=(f[2]||"other").trim().toLowerCase(),title=(f[3]||"").trim(),venue=(f[4]||"").trim();
      if(!date||!title)continue;
      if(["sport","music","other"].indexOf(type)<0)type="other";
      var days=[date],c=date,g=0;
      while(end&&c<end&&g<400){c=addDays(c,1);days.push(c);g++;}
      for(var j=0;j<days.length;j++){
        var box=document.querySelector('.ctxrow[data-date="'+days[j]+'"] .ctxchips');
        if(!box)continue;
        var none=box.querySelector('.ctxnone');if(none)none.remove();
        var sp=document.createElement('span');
        sp.className='chip '+type;
        sp.title=(venue?title+' @ '+venue:title);
        sp.textContent=title;
        box.appendChild(sp);
      }
    }
  }).catch(function(e){console.log('sheet load failed',e);});
}
loadSheetEvents();
// 해시 딥링크: /db#adelaide-st 처럼 열면 해당 탭 자동 (매니저 북마크·QR용)
window.addEventListener('DOMContentLoaded',function(){
  var h=decodeURIComponent(location.hash.slice(1)); if(!h){return;}
  if(document.getElementById('view-'+h)){showView(h);return;}
  var bs=document.querySelectorAll('.navbtn');
  for(var i=0;i<bs.length;i++){var b=bs[i];
    if((b.getAttribute('data-view')||'')===h||(b.getAttribute('onclick')||'').indexOf("'"+h+"'")>=0){b.click();break;}}
});
</script>
</body></html>"""

html = (TEMPLATE.replace("__ASOF__", today.isoformat())
                .replace("__NAV__", nav)
                .replace("__NEWS__", NEWS_HTML)
                .replace("__VIEWS__", view_html)
                .replace("__SHEET_URL__", EVENTS_SHEET_CSV))

OUT_DIR = os.environ.get("DASH_OUT", r"C:\DashboardWeb")
os.makedirs(OUT_DIR, exist_ok=True)
out_path = os.path.join(OUT_DIR, "index.html")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(html)

print("")
print("[OK] updated -> " + out_path)
print("Netlify Deploys 탭에 C:\\DashboardWeb 폴더 다시 드래그하면 갱신 끝.")

# --- data/menu.json 내보내기 (Strategy 탭 메뉴 엔지니어링용) ---
# 이번 달 아이템별 net$ + 수량(Orders API 보정치). 실패해도 대시보드엔 영향 없음.
try:
    menu_out = {
        "as_of": today.isoformat(),
        "range": ITEM_RANGE_STR,
        "note": "this-month item net sales + qty (qty from Orders API, modifier-inflation fixed)",
        "stores": {},
    }

    def _menu_items(ci_map):
        items = []
        for cat, idict in ci_map.items():
            for name, v in idict.items():
                net, qty = float(v[0]), float(v[1])
                if net <= 0:
                    continue
                items.append({"item": name, "cat": cat, "net": round(net, 2),
                              "qty": round(qty, 1)})
        items.sort(key=lambda x: -x["net"])
        return items

    menu_out["stores"]["Combined"] = _menu_items(combined_catitems)
    for acc in ACCOUNTS:
        menu_out["stores"][acc["name"]] = _menu_items(store_catitems.get(acc["name"], {}))
    data_dir = os.path.join(OUT_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    menu_path = os.path.join(data_dir, "menu.json")
    with open(menu_path, "w", encoding="utf-8") as f:
        json.dump(menu_out, f, ensure_ascii=False, indent=1)
    print("[OK] -> " + menu_path)
except Exception as e:
    print("  ! menu.json export skipped:", e)