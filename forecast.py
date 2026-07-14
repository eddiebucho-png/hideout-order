import json
import time
import csv
import io
import os
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from config import ACCOUNTS
try:
    from xero_wage import wage_block, review_view, store_kpi_strip, pastry_combined_view
except Exception:
    def wage_block(*a, **k):
        return ""
    def review_view(*a, **k):
        return "<p>Xero unavailable</p>"
    def store_kpi_strip(*a, **k):
        return ""
    def pastry_combined_view(*a, **k):
        return ""
try:
    from config import TICKETMASTER_KEY
except ImportError:
    TICKETMASTER_KEY = ""
try:
    from config import EVENTS_SHEET_CSV
except ImportError:
    EVENTS_SHEET_CSV = ""
try:
    from config import SETTINGS_SHEET_CSV
except ImportError:
    SETTINGS_SHEET_CSV = ""

# ===== settings =====
START_DATE = "2026-06-01"   # week (Mon) containing this date is the start. Change monthly.
BLOCK_WEEKS = 5
LOOKBACK_WEEKS = 6
TARGETS = {"foh": 0.33, "boh": 0.33, "pastry": 0.38}  # settings 읽은 뒤 시트값으로 덮어씀

BNE = timezone(timedelta(hours=10))
LOAD_URL = "https://connect.squareup.com/reporting/v1/load"
BIG_VENUES = ["Suncorp Stadium", "Riverstage", "Brisbane Entertainment Centre",
              "Gabba", "Brisbane Cricket Ground", "Brisbane Convention", "Showgrounds"]
DEFAULT_SETTINGS = {
    "adelaide_long": 8.5, "adelaide_short": 5.0,
    "edward_long": 9.0, "edward_short": 4.0,
    "stpauls_long": 9.0, "stpauls_short": 4.0,
    "wage_foh": 40.8, "wage_boh": 40.8, "wage_pastry": 40.8,
}
STORE_KEY = {"Adelaide St": "adelaide", "Edward St": "edward", "St Pauls Ter": "stpauls"}
DISPLAY_ORDER = ["Adelaide St", "Edward St", "St Pauls Ter"]
STORE_COLOR = {"Adelaide St": "#2563eb", "Edward St": "#d97706", "St Pauls Ter": "#7c3aed"}
WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def run_query(account, q):
    body = json.dumps({"query": q}).encode("utf-8")
    headers = {"Authorization": "Bearer " + account["token"], "Content-Type": "application/json"}
    for _ in range(10):
        try:
            req = urllib.request.Request(LOAD_URL, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=30) as resp:
                r = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            print("  ! query error", e.code)
            return None
        if "data" in r:
            return r["data"]
        time.sleep(2)
    return None


def daily_category(account, start_iso, end_iso):
    data = run_query(account, {
        "measures": ["ItemSales.item_net_sales"],
        "dimensions": ["ItemSales.local_date", "ItemSales.category_name"],
        "filters": [
            {"member": "ItemSales.location_id", "operator": "equals", "values": [account["location_id"]]},
            {"member": "ItemSales.local_date", "operator": "inDateRange", "values": [start_iso, end_iso]},
        ],
    })
    out = {}
    for row in data or []:
        d = (row.get("ItemSales.local_date") or "")[:10]
        cat = row.get("ItemSales.category_name") or "(Uncategorized)"
        if not d:
            continue
        out.setdefault(d, {})
        out[d][cat] = out[d].get(cat, 0.0) + float(row.get("ItemSales.item_net_sales") or 0)
    return out


def read_kv_sheet(url):
    out = {}
    if not url:
        return out
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            text = resp.read().decode("utf-8")
    except Exception as e:
        print("  ! settings sheet error:", e)
        return out
    for r in list(csv.reader(io.StringIO(text)))[1:]:
        if len(r) >= 2 and r[0].strip():
            try:
                out[r[0].strip()] = float(r[1])
            except (ValueError, IndexError):
                pass
    return out


def fetch_holidays(year):
    out = {}
    for y in (year, year + 1):
        url = "https://date.nager.at/api/v3/PublicHolidays/{}/AU".format(y)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                arr = json.loads(resp.read().decode("utf-8"))
            for h in arr:
                c = h.get("counties")
                if c is None or "AU-QLD" in c:
                    out[h["date"]] = h.get("localName") or h.get("name")
        except Exception as e:
            print("  ! holiday error:", e)
    return out


def fetch_events_window(start_iso, end_iso):
    out = {}
    if not TICKETMASTER_KEY:
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
        for ev in (d.get("_embedded") or {}).get("events") or []:
            ld = ((ev.get("dates") or {}).get("start") or {}).get("localDate")
            if not ld:
                continue
            venues = (ev.get("_embedded") or {}).get("venues") or []
            venue = venues[0].get("name", "") if venues else ""
            if BIG_VENUES and not any(bv.lower() in venue.lower() for bv in BIG_VENUES):
                continue
            out.setdefault(ld, []).append(ev.get("name", ""))
        total = (d.get("page") or {}).get("totalPages", 1)
        page += 1
        if page >= total:
            break
    return out


def fetch_sheet_event_days():
    out = {}
    if not EVENTS_SHEET_CSV:
        return out
    try:
        req = urllib.request.Request(EVENTS_SHEET_CSV, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            text = resp.read().decode("utf-8")
    except Exception:
        return out
    for r in list(csv.reader(io.StringIO(text)))[1:]:
        if len(r) < 4:
            continue
        d0s, ends, title = r[0].strip(), r[1].strip(), r[3].strip()
        if not d0s or not title:
            continue
        try:
            d0 = datetime.fromisoformat(d0s).date()
            d1 = datetime.fromisoformat(ends).date() if ends else d0
        except ValueError:
            continue
        c = d0
        while c <= d1:
            out.setdefault(c.isoformat(), []).append(title)
            c += timedelta(days=1)
    return out


def fetch_weather_forecast():
    """Open-Meteo daily rain forecast, next ~16 days, Brisbane CBD (free, no key)."""
    url = ("https://api.open-meteo.com/v1/forecast"
           "?latitude=-27.4698&longitude=153.0251&daily=precipitation_sum"
           "&timezone=Australia%2FBrisbane&forecast_days=16")
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


def role_of(cat):
    c = cat.lower()
    if "monthly pastry" in c or "pastr" in c:
        return "pastry"
    if "special" in c:
        return "foh"
    if "food" in c:
        return "boh"
    if ("beverage" in c or "retail" in c or "gift" in c
            or "education" in c or "class" in c or "workshop" in c):
        return "foh"
    return None


def median(xs):
    if not xs:
        return 0.0
    s = sorted(xs)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2.0


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ===== period / data =====
today = datetime.now(BNE).date()
sd = datetime.fromisoformat(START_DATE).date()
disp_start = sd - timedelta(days=sd.weekday())
disp_end = disp_start + timedelta(days=BLOCK_WEEKS * 7 - 1)
fetch_from = min(disp_start, today - timedelta(days=LOOKBACK_WEEKS * 7 + 7))

print("loading settings / holidays / events ...")
settings = dict(DEFAULT_SETTINGS)
settings.update(read_kv_sheet(SETTINGS_SHEET_CSV))
TARGETS = {
    "foh": settings.get("kpi_wage_foh", 0.33) or 0.33,
    "boh": settings.get("kpi_wage_boh", 0.33) or 0.33,
    "pastry": settings.get("kpi_wage_pastry", 0.38) or 0.38,
}
holidays = fetch_holidays(fetch_from.year)
events = {}
for d, v in fetch_events_window(disp_start.isoformat(), disp_end.isoformat()).items():
    events.setdefault(d, []).extend(v)
print("loading weather forecast ...")
weather = fetch_weather_forecast()
RAIN_FACTOR = settings.get("rain_factor", 0.95) or 0.95
WET_MM = settings.get("rain_wet_mm", 5.0) or 5.0
for d, v in fetch_sheet_event_days().items():
    events.setdefault(d, []).extend(v)
try:
    with open("context_events.json", encoding="utf-8") as _cf:
        _cev = json.load(_cf)
    for _d, _evs in (_cev.get("events") or {}).items():
        events.setdefault(_d, []).extend(
            e.get("name", "") for e in _evs if e.get("name"))
except Exception:
    pass


def predict_day(cat_hist, target_date):
    wd = target_date.weekday()
    cutoff = today - timedelta(days=LOOKBACK_WEEKS * 7)
    vals = {"foh": [], "boh": [], "pastry": []}
    for d, cats in cat_hist.items():
        dd = datetime.fromisoformat(d).date()
        if dd.weekday() != wd or dd < cutoff or dd >= today or d in holidays:
            continue
        day_roles = {"foh": 0.0, "boh": 0.0, "pastry": 0.0}
        total = 0.0
        for cat, v in cats.items():
            total += v
            r = role_of(cat)
            if r:
                day_roles[r] += v
        if total <= 0:
            continue
        for r in vals:
            vals[r].append(day_roles[r])
    base = {r: median(v) for r, v in vals.items()}
    di = target_date.isoformat()
    if (target_date >= today and target_date.weekday() < 5
            and di in weather and weather[di] >= WET_MM):
        base = {r: x * RAIN_FACTOR for r, x in base.items()}
    return base


def actual_day(cat_hist, d):
    di = d.isoformat()
    roles = {"foh": 0.0, "boh": 0.0, "pastry": 0.0}
    if di in cat_hist:
        for cat, v in cat_hist[di].items():
            r = role_of(cat)
            if r:
                roles[r] += v
    return roles


def hh(x):
    return "&ndash;" if x <= 0 else "{:.0f}h".format(x)


def diff_span(f, a):
    if f <= 0:
        return ""
    d = (a - f) / f * 100
    cls = "up" if d >= 0 else "down"
    arr = "&#9650;" if d >= 0 else "&#9660;"
    return '<span class="{}">{} {:+.0f}%</span>'.format(cls, arr, d)


def rain_mark(d):
    di = d.isoformat()
    if d >= today and di in weather and weather[di] >= WET_MM:
        return ' <span title="{:.0f}mm rain forecast">&#127783;</span>'.format(weather[di])
    return ""


def future_week(cat_hist, ws, we, wage, long_h):
    rows = ""
    tot = {"foh": 0.0, "boh": 0.0, "pastry": 0.0}
    tot_sales = 0.0
    d = ws
    while d <= we:
        di = d.isoformat()
        dl = WD[d.weekday()] + " " + d.strftime("%d/%m") + rain_mark(d)
        if di in holidays:
            rows += '<tr class="hol"><td>{}</td><td colspan="5">Public holiday &middot; {}</td></tr>'.format(
                dl, esc(holidays[di]))
            d += timedelta(days=1)
            continue
        p = predict_day(cat_hist, d)
        ds = p["foh"] + p["boh"] + p["pastry"]
        tot_sales += ds
        hrs = {}
        for r in ["foh", "boh", "pastry"]:
            h = (p[r] * TARGETS[r] / wage[r]) if wage[r] else 0
            hrs[r] = h
            tot[r] += h
        th = hrs["foh"] + hrs["boh"] + hrs["pastry"]
        rows += ('<tr><td>{dl}</td><td>${s:,.0f}</td><td>{f}</td><td>{b}</td><td>{p}</td><td>{t}</td></tr>'.format(
            dl=dl, s=ds, f=hh(hrs["foh"]), b=hh(hrs["boh"]), p=hh(hrs["pastry"]), t=hh(th)))
        d += timedelta(days=1)
    tot_h = tot["foh"] + tot["boh"] + tot["pastry"]
    bud = {r: tot[r] * wage[r] for r in tot}
    tot_bud = bud["foh"] + bud["boh"] + bud["pastry"]
    pct = (tot_bud / tot_sales * 100) if tot_sales else 0
    summary = ('<div class="summary">'
               '<span class="chip2 foh">FOH <b>{:.0f}h</b> &approx;{:.0f}</span>'
               '<span class="chip2 boh">BOH <b>{:.0f}h</b> &approx;{:.0f}</span>'
               '<span class="chip2 pas">Pastry <b>{:.0f}h</b> &approx;{:.0f}</span>'
               '<span class="chip2 tot">Budget <b>${:,.0f}</b> ({:.1f}%)</span></div>').format(
        tot["foh"], tot["foh"] / long_h if long_h else 0,
        tot["boh"], tot["boh"] / long_h if long_h else 0,
        tot["pastry"], tot["pastry"] / long_h if long_h else 0,
        tot_bud, pct)
    head = '<thead><tr><th>Day</th><th>Forecast</th><th>FOH</th><th>BOH</th><th>Pastry</th><th>Total</th></tr></thead>'
    foot = ('<tfoot><tr><td>Week total</td><td>${:,.0f}</td><td>{:.0f}h</td><td>{:.0f}h</td><td>{:.0f}h</td><td>{:.0f}h</td></tr>'
            '<tr class="bud"><td>Wage budget</td><td>${:,.0f}</td><td>${:,.0f}</td><td>${:,.0f}</td><td>${:,.0f}</td><td>{:.1f}%</td></tr></tfoot>').format(
        tot_sales, tot["foh"], tot["boh"], tot["pastry"], tot_h,
        tot_bud, bud["foh"], bud["boh"], bud["pastry"], pct)
    return summary + '<div class="tblwrap"><table>' + head + '<tbody>' + rows + '</tbody>' + foot + '</table></div>'


def review_week(cat_hist, ws, we):
    rows = ""
    tf = ta = 0.0
    d = ws
    while d <= we:
        di = d.isoformat()
        dl = WD[d.weekday()] + " " + d.strftime("%d/%m")
        if di in holidays:
            rows += '<tr class="hol"><td>{}</td><td colspan="3">Public holiday &middot; {}</td></tr>'.format(
                dl, esc(holidays[di]))
            d += timedelta(days=1)
            continue
        p = predict_day(cat_hist, d)
        f = p["foh"] + p["boh"] + p["pastry"]
        completed = d < today
        if completed:
            a = sum(actual_day(cat_hist, d).values())
            tf += f
            ta += a
            rows += '<tr><td>{dl}</td><td>${f:,.0f}</td><td>${a:,.0f}</td><td>{df}</td></tr>'.format(
                dl=dl, f=f, a=a, df=diff_span(f, a))
        else:
            lab = "today" if d == today else "upcoming"
            rows += '<tr class="pend"><td>{dl}</td><td>${f:,.0f}</td><td>&ndash;</td><td>{lab}</td></tr>'.format(
                dl=dl, f=f, lab=lab)
        d += timedelta(days=1)
    summary = ('<div class="summary"><span class="chip2 tot">Forecast <b>${:,.0f}</b></span>'
               '<span class="chip2 tot">Actual <b>${:,.0f}</b></span>'
               '<span class="chip2">{} <span style="color:#9ca3af">completed days</span></span></div>').format(
        tf, ta, diff_span(tf, ta) or "&mdash;")
    head = '<thead><tr><th>Day</th><th>Forecast</th><th>Actual</th><th>Diff</th></tr></thead>'
    foot = '<tfoot><tr><td>Total</td><td>${:,.0f}</td><td>${:,.0f}</td><td>{}</td></tr></tfoot>'.format(
        tf, ta, diff_span(tf, ta))
    return summary + '<div class="tblwrap"><table>' + head + '<tbody>' + rows + '</tbody>' + foot + '</table></div>'


CAT_HIST_BY_STORE = {}
def build_store_view(acc):
    nm = acc["name"]
    pfx = STORE_KEY.get(nm, "edward")
    long_h = settings.get(pfx + "_long", 9.0)
    short_h = settings.get(pfx + "_short", 4.0)
    wage = {"foh": settings.get("wage_foh", 40.8),
            "boh": settings.get("wage_boh", 40.8),
            "pastry": settings.get("wage_pastry", 40.8)}
    cat_hist = daily_category(acc, fetch_from.isoformat(), today.isoformat())
    if not cat_hist:
        return '<p class="empty">No data</p>'
    CAT_HIST_BY_STORE[nm] = cat_hist
    kpi_strip = store_kpi_strip(nm, cat_hist, settings, today)
    weeks = ""
    for i in range(BLOCK_WEEKS):
        ws = disp_start + timedelta(days=7 * i)
        we = ws + timedelta(days=6)
        rng = "Mon {} &ndash; Sun {}".format(ws.strftime("%d/%m"), we.strftime("%d/%m"))
        flags = []
        d = ws
        while d <= we:
            di = d.isoformat()
            if di in events and di not in holidays:
                flags.append("{} ({}) {}".format(d.strftime("%d/%m"), WD[d.weekday()], events[di][0][:40]))
            d += timedelta(days=1)
        fl = ""
        if flags:
            fl = '<div class="flags">' + "".join(
                '<span class="flag">&#9888; {}</span>'.format(esc(x)) for x in flags) + '</div>'

        if ws > today:
            body = future_week(cat_hist, ws, we, wage, long_h)
            tag, tc = "Upcoming", "future"
        elif we < today:
            body = review_week(cat_hist, ws, we) + wage_block(nm, ws, we, cat_hist, settings)
            tag, tc = "Past week", "past"
        else:
            body = review_week(cat_hist, ws, we) + wage_block(nm, ws, we, cat_hist, settings)
            tag, tc = "In progress", "now"

        weeks += ('<div class="wk"><div class="wkhdr"><span class="wktag {tc}">{t}</span> '
                  'Week {r}</div>{b}{f}</div>').format(tc=tc, t=tag, r=rng, b=body, f=fl)

    hdr = ("Long {:.1f}h &middot; Short {:.1f}h &middot; Wage FOH ${:.1f} / BOH ${:.1f} / Pastry ${:.1f} "
           "&middot; Target FOH {:.0f}% / BOH {:.0f}% / Pastry {:.0f}%").format(
        long_h, short_h, wage["foh"], wage["boh"], wage["pastry"],
        TARGETS["foh"] * 100, TARGETS["boh"] * 100, TARGETS["pastry"] * 100)
    return '<div class="storehdr">{}</div>{}{}'.format(hdr, kpi_strip, weeks)


# ===== assemble =====
name_to_acc = {a["name"]: a for a in ACCOUNTS}
ordered = [name_to_acc[n] for n in DISPLAY_ORDER if n in name_to_acc]
ordered += [a for a in ACCOUNTS if a["name"] not in DISPLAY_ORDER]

nav = '<div class="nav">'
views = ""
# ---- 매니저 어드바이스 카드 (manager_actions.json, 목요일 딥다이브 발행) ----
# 원칙(Eddie): 정보 최소화 — 카드당 액션 최대 2개, 한 문장씩. 색으로 상태 즉시 전달.
MA_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSfSM_wy_OhOkKvNw8EAUX6kD4dAc8UFUn-sU8VgjiNpxi20Dw/viewform"
MA_MISSION = "Our goal on this page: right staffing, great service, lower wage cost."
# gid 제거 (2026-07-13): gid=223892282는 빈 탭 — 실제 응답은 기본(첫) 탭에 쌓임
FEEDBACK_CSV = ("https://docs.google.com/spreadsheets/d/1hjgUHzEFnHb71QXKGqdSdEZAA62k0KRWWh3TjdXCPHQ"
                "/gviz/tq?tqx=out:csv&headers=1")


def fb_latest():
    """피드백 시트에서 액션 ID별 최신 응답 (같은 ID 재제출 = 최신이 이김, undo 가능)"""
    try:
        req = urllib.request.Request(FEEDBACK_CSV, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read().decode("utf-8")
        rows = list(csv.reader(io.StringIO(text)))
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
    mode="status": Review 탭용 (오퍼레이션 매니저·총괄 셰프가 각 지점 응답 상태만 조회)"""
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


MA_WEEK, MA_ROSTER = ma_load("roster")
FB_REPLY = fb_replies(MA_WEEK)

store_html = {}
for acc in ordered:
    nm = acc["name"]
    print("build:", nm)
    store_html[nm] = build_store_view(acc)

# Review 탭 (맨 앞, 기본 활성)
rev = review_view([a["name"] for a in ordered], CAT_HIST_BY_STORE, settings, today, STORE_COLOR)
rev += pastry_combined_view(CAT_HIST_BY_STORE, settings, today)
nav += ('<button class="navbtn active" data-view="review" onclick="showView(\'review\')" '
        'style="--c:#7c3aed">&#128202; Review</button>')
ma_all = "".join(ma_card(a["name"], MA_ROSTER.get(a["name"]), MA_WEEK,
                         show_store=True, mode="status")
                 for a in ordered)
views += ('<div class="view" id="view-review" style="display:block">'
          '<h2><span class="dot" style="background:#7c3aed"></span>Last 2 weeks &middot; wage KPI</h2>'
          + ma_all + rev + '</div>')

# 매장 탭
for acc in ordered:
    nm = acc["name"]
    sl = nm.lower().replace(" ", "-")
    col = STORE_COLOR.get(nm, "#6b7280")
    nav += '<button class="navbtn" data-view="{s}" onclick="showView(\'{s}\')" style="--c:{col}">{l}</button>'.format(
        s=sl, col=col, l=nm)
    views += ('<div class="view" id="view-{s}" style="display:none">'
              '<h2><span class="dot" style="background:{col}"></span>{l}</h2>{ma}{h}</div>').format(
        s=sl, col=col, l=nm, ma=ma_card(nm, MA_ROSTER.get(nm), MA_WEEK), h=store_html[nm])
nav += '</div>'

TEMPLATE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Hideout - Roster Forecast</title>
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f4f1;color:#211d19}
main{max-width:1180px;margin:0 auto;padding:0 16px 56px}
.topbar{position:sticky;top:0;z-index:20;background:rgba(246,244,241,.95);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:3px solid #7c3aed}
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
.navbtn.active{background:var(--c,#211d19);color:#fff;border-color:var(--c,#211d19)}
h2{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;margin:0 0 12px;color:#211d19}
.dot{width:10px;height:10px;border-radius:99px;flex-shrink:0}
.asof{color:#8a8378;font-size:12px;margin:14px 2px}
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
details.howto{margin:0 0 16px}
.howto summary{cursor:pointer;font-size:12px;font-weight:700;color:#6f695f;padding:10px 14px;background:#fff;border:1px solid #e7e2db;border-radius:12px;list-style:none}
.howto summary::-webkit-details-marker{display:none}
.note{font-size:12px;color:#6f695f;background:#fff;border:1px solid #e7e2db;border-top:none;border-radius:0 0 12px 12px;padding:12px 16px;line-height:1.8;margin-top:-6px}
.storehdr{font-size:12px;color:#8a8378;margin:0 0 16px;line-height:1.7}
.wk{background:#fff;border:1px solid #e7e2db;border-radius:16px;padding:16px 18px;margin-bottom:12px;box-shadow:0 1px 2px rgba(30,25,20,.04)}
.wkhdr{font-size:14px;font-weight:800;margin-bottom:10px}
.wktag{font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;margin-right:8px;vertical-align:middle}
.wktag.future{background:#e0f2fe;color:#0369a1}
.wktag.now{background:#e8f6ee;color:#0f8a43}
.wktag.past{background:#f1eee9;color:#8a8378}
.summary{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.chip2{font-size:12px;font-weight:600;background:#f1eee9;color:#4b4740;border-radius:999px;padding:5px 12px}
.chip2 b{font-weight:800}
.chip2.foh{background:#ccfbf1;color:#0f766e}
.chip2.boh{background:#fef3c7;color:#92400e}
.chip2.pas{background:#fce7f3;color:#be185d}
.chip2.tot{background:#e7e2db;color:#211d19}
.tblwrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13px;min-width:360px}
th,td{text-align:right;padding:7px 9px;border-bottom:1px solid #f1eee9;white-space:nowrap;font-variant-numeric:tabular-nums}
th:first-child,td:first-child{text-align:left}
thead th{font-size:11px;color:#8a8378;font-weight:700;border-bottom:1px solid #e7e2db;letter-spacing:.04em}
tr.hol td{color:#b91c1c;background:#fef2f2;text-align:left}
tr.pend td{color:#a39b8e}
tfoot td{font-weight:800;border-top:2px solid #e7e2db}
tfoot tr.bud td{font-weight:600;color:#8a8378;border-top:none}
.up{color:#0f8a43;font-weight:700}.down{color:#d2372c;font-weight:700}
.flags{margin-top:12px;display:flex;flex-direction:column;gap:4px}
.flag{font-size:12px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:5px 10px}
.empty{color:#a39b8e;font-size:13px}
@media (max-width:640px){
  .wk{padding:12px 14px}
  table{min-width:0;font-size:12px}
  th,td{padding:6px 6px}
  .tblinks a{padding:6px 9px}
}
</style></head><body>
<header class="topbar"><div class="tbin">
<div class="tbrow"><h1>The Hideout <span class="pagetag" style="background:#7c3aed">&#128197; ROSTER</span></h1>
<div class="tblinks"><a href="https://hideoutdb.com/" target="_top">&#128202; Sales</a><a href="https://hideoutdb.com/cogs.html" target="_top">&#129534; COGS</a><a href="https://order.hideoutdb.com" target="_top">&#129386; Orders</a><a href="https://hideoutdb.com/#voices" target="_top">&#128172; Voices</a><a href="https://hideoutdb.com/#meetings" target="_top">&#129309; Meetings</a></div></div>
__NAV__
</div></header>
<main>
<p class="asof">As of __ASOF__ (Brisbane) &middot; showing __RANGE__</p>
<details class="howto"><summary>&#8505; How to read this page</summary>
<div class="note"><b>When wage numbers are final:</b> a week's (Mon to Sun) wages are paid the following <b>Wednesday</b>, so last week's wage KPI is reliable from <b>Thursday</b>. Before that it shows lower than reality.<br>
<b>THIS WEEK</b> card is our advice from the Thursday review. Reply with the Done / Can't do buttons. These are suggestions, not orders: if a cut does not work on the floor, press Can't do and tell us why, and we will come back with a better option.<br>
<b>Breaks come first:</b> staff on long shifts must take their 30 minute break. When you trim a shift, make sure the floor is still covered while people rotate through breaks.<br>
<b>From Jul 1 2026</b> award pay rates rose 4.75% (casuals slightly more with loading), so wage % runs higher than June on the same roster. Targets already allow for this, and the fix is smarter rostering, not cutting service.<br>
Forecast = median of the last 6 same-weekdays (public holidays excluded). <b>Upcoming</b> weeks show the wage budget per role &rarr; hours &rarr; long-shift count. <b>In progress / past</b> weeks compare forecast vs actual (completed days only). &#9888; marks big city events / public holidays &mdash; sales may vary, use as a heads-up.</div></details>
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
  window.scrollTo(0,0);
}
// 해시 딥링크: /roster#adelaide-st 처럼 열면 해당 탭 자동 (매니저 북마크·QR용)
window.addEventListener('DOMContentLoaded',function(){
  var h=decodeURIComponent(location.hash.slice(1)); if(!h){return;}
  var bs=document.querySelectorAll('.navbtn');
  for(var i=0;i<bs.length;i++){var b=bs[i];
    if((b.getAttribute('data-view')||'')===h||(b.getAttribute('onclick')||'').indexOf("'"+h+"'")>=0){b.click();break;}}
});
</script>
</body></html>"""

html = (TEMPLATE.replace("__ASOF__", today.isoformat())
                .replace("__RANGE__", disp_start.strftime("%d/%m") + " - " + disp_end.strftime("%d/%m"))
                .replace("__NAV__", nav)
                .replace("__VIEWS__", views))

OUT_DIR = os.environ.get("DASH_OUT", r"C:\DashboardWeb")
os.makedirs(OUT_DIR, exist_ok=True)
out_path = os.path.join(OUT_DIR, "roster.html")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(html)

print("\n[OK] -> " + out_path)
print("Drag C:\\DashboardWeb to Netlify to deploy as /roster.html")