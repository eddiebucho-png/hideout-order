# hourly_data.py - 요일x시간 수요(주문수+매출$) JSON 내보내기 (Advisor 딥다이브용)
# hourly_analysis.py와 같은 Orders API 방식. 결과: {DASH_OUT}/data/hourly.json
# 실패해도 빌드를 깨지 않도록 항상 exit 0.
import json
import os
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from config import ACCOUNTS

BNE = timezone(timedelta(hours=10))
ORDERS_URL = "https://connect.squareup.com/v2/orders/search"
SQUARE_VERSION = "2024-12-18"
WEEKS = 8
WEB_DIR = os.environ.get("DASH_OUT", r"C:\DashboardWeb")

WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def search_orders(acc, start_at, end_at):
    orders, cursor = [], None
    while True:
        body = {
            "location_ids": [acc["location_id"]],
            "query": {
                "filter": {
                    "date_time_filter": {"created_at": {"start_at": start_at, "end_at": end_at}},
                    "state_filter": {"states": ["COMPLETED"]},
                },
                "sort": {"sort_field": "CREATED_AT", "sort_order": "ASC"},
            },
            "limit": 500,
        }
        if cursor:
            body["cursor"] = cursor
        req = urllib.request.Request(ORDERS_URL, data=json.dumps(body).encode(), method="POST",
                                     headers={"Authorization": "Bearer " + acc["token"],
                                              "Content-Type": "application/json",
                                              "Square-Version": SQUARE_VERSION})
        resp = None
        for attempt in range(3):  # 일시 오류(타임아웃/레이트리밋) 재시도
            try:
                with urllib.request.urlopen(req, timeout=40) as r:
                    resp = json.loads(r.read().decode())
                break
            except Exception as e:
                print("  ! orders error ({}, try {}/3): {}".format(acc["name"], attempt + 1, e))
                time.sleep(2 * (attempt + 1))
        if resp is None:
            return None
        orders.extend(resp.get("orders", []))
        cursor = resp.get("cursor")
        if not cursor:
            break
        time.sleep(0.3)
    return orders


def weekday_occurrences(d0, d1):
    occ = {i: 0 for i in range(7)}
    cur = d0
    while cur <= d1:
        occ[cur.weekday()] += 1
        cur += timedelta(days=1)
    return occ


AM_START, AM_END = 6, 11  # 아침 지표 구간 (6:00 ~ 10:59, 평일)
LIVE_URL = "https://hideoutdb.com/data/hourly.json"


def fetch_previous():
    """직전 배포본 — 이번 런에서 실패한 매장을 빈 값으로 덮어쓰지 않기 위한 폴백"""
    try:
        req = urllib.request.Request(LIVE_URL + "?cb=" + str(int(time.time())),
                                     headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        print("  ! previous hourly.json fetch failed:", e)
        return None


def store_grid(acc, d0, d1, occ):
    """요일x시간 평균 그리드 + 주별 평일 아침(AM) 지표를 함께 반환"""
    start_at = datetime(d0.year, d0.month, d0.day, tzinfo=BNE).astimezone(timezone.utc).isoformat()
    end_at = datetime(d1.year, d1.month, d1.day, 23, 59, 59, tzinfo=BNE).astimezone(timezone.utc).isoformat()
    orders = search_orders(acc, start_at, end_at)
    if not orders:
        return None, None
    grid = {}
    weekly_am = {}  # 주 시작 월요일 iso -> [orders, sales] (평일 6~10시)
    for o in orders:
        ca = o.get("created_at")
        if not ca:
            continue
        try:
            dt = datetime.fromisoformat(ca.replace("Z", "+00:00")).astimezone(BNE)
        except ValueError:
            continue
        amt = ((o.get("total_money") or {}).get("amount") or 0) / 100.0
        g = grid.setdefault((dt.weekday(), dt.hour), [0, 0.0])
        g[0] += 1
        g[1] += amt
        if dt.weekday() < 5 and AM_START <= dt.hour < AM_END:
            mon = (dt.date() - timedelta(days=dt.weekday())).isoformat()
            w = weekly_am.setdefault(mon, [0, 0.0])
            w[0] += 1
            w[1] += amt
    # 요일별 평균으로 변환: {"Mon": {"7": {"orders": 51.4, "sales": 612.3}, ...}, ...}
    out = {}
    for (wd, h), (cnt, amt) in grid.items():
        n = occ[wd] or 1
        day = out.setdefault(WD[wd], {})
        day[str(h)] = {"orders": round(cnt / n, 1), "sales": round(amt / n, 2)}
    am = {k: {"orders": v[0], "sales": round(v[1], 2)}
          for k, v in sorted(weekly_am.items())}
    return out, am


def main():
    today = datetime.now(BNE).date()
    d1 = today - timedelta(days=1)
    this_mon = today - timedelta(days=today.weekday())
    d0 = this_mon - timedelta(weeks=WEEKS)
    occ = weekday_occurrences(d0, d1)
    out = {
        "as_of": today.isoformat(),
        "generated_at": datetime.now(BNE).strftime("%Y-%m-%d %H:%M"),
        "window": {"start": d0.isoformat(), "end": d1.isoformat(), "weeks": WEEKS},
        "note": ("per weekday-hour averages over window; sales in AUD incl GST (Square total_money). "
                 "weekly_am = weekday {}:00-{}:59 totals per week (Mon key) — Cubic watch용".format(AM_START, AM_END - 1)),
        "stores": {},
        "weekly_am": {},
    }
    for acc in ACCOUNTS:
        print("hourly:", acc["name"])
        g, am = store_grid(acc, d0, d1, occ)
        if g:
            out["stores"][acc["name"]] = g
        if am:
            out["weekly_am"][acc["name"]] = am
    # 실패한 매장은 직전 배포본으로 채운다 (빈 파일로 좋은 데이터 덮어쓰기 방지)
    missing = [a["name"] for a in ACCOUNTS if a["name"] not in out["stores"]]
    if missing:
        prev = fetch_previous()
        if prev:
            for nm in missing:
                if nm in (prev.get("stores") or {}):
                    out["stores"][nm] = prev["stores"][nm]
                    if nm in (prev.get("weekly_am") or {}):
                        out["weekly_am"].setdefault(nm, prev["weekly_am"][nm])
                    out.setdefault("stale", {})[nm] = prev.get("generated_at", "unknown")
                    print("  ! {}: this run failed, reused previous data ({})".format(
                        nm, prev.get("generated_at")))
    data_dir = os.path.join(WEB_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    path = os.path.join(data_dir, "hourly.json")
    with open(path, "w", encoding="utf-8") as fp:
        json.dump(out, fp, ensure_ascii=False, indent=1)
    print("[OK] -> {} (stores: {}/{}{})".format(
        path, len(out["stores"]), len(ACCOUNTS),
        ", stale: " + ",".join(out.get("stale", {})) if out.get("stale") else ""))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("  ! hourly_data failed (build continues):", e)
