import os
import sys
import time
import json
import re
import random
import urllib.request
import urllib.error
import ssl

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "https://www.lnf.ly"
INDEX_URL = "https://www.lnf.ly/drugs"
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "lnf_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "DaliliHealthApp/1.0 (Educational/Patient Safety Research; gentle crawler 1req/3-4s)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ar,en-US;q=0.7,en;q=0.3"
}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def safe_fetch(url, max_retries=2):
    req = urllib.request.Request(url, headers=HEADERS)
    t0 = time.time()
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
                elapsed = time.time() - t0
                if resp.status >= 400:
                    return resp.status, "", elapsed
                raw = resp.read()
                return resp.status, raw.decode('utf-8', errors='replace'), elapsed
        except urllib.error.HTTPError as e:
            elapsed = time.time() - t0
            return e.code, "", elapsed
        except Exception as e:
            elapsed = time.time() - t0
            if attempt == max_retries - 1:
                return 0, str(e), elapsed
            time.sleep(5)
    return 0, "TIMEOUT", 20

def save_progress(phase, current, total, msg=""):
    progress_file = os.path.join(CACHE_DIR, "progress.json")
    pct = round((current / total) * 100, 1) if total > 0 else 0
    with open(progress_file, "w", encoding="utf-8") as f:
        json.dump({
            "phase": phase,
            "current": current,
            "total": total,
            "percentage": pct,
            "message": msg,
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }, f, ensure_ascii=False, indent=2)

def collect_index_pages():
    print("=== PHASE 1: COLLECTING 27 INDEX PAGES ===", flush=True)
    all_drugs = []
    
    for page in range(1, 28):
        cache_file = os.path.join(CACHE_DIR, f"index_page_{page:02d}.html")
        if os.path.exists(cache_file):
            with open(cache_file, "r", encoding="utf-8") as f:
                html = f.read()
            print(f" [Index Page {page}/27] Loaded from cache.", flush=True)
        else:
            url = f"{INDEX_URL}?page={page}"
            status, html, elapsed = safe_fetch(url)
            if status != 200:
                print(f" [CRITICAL ERROR] Failed to fetch {url}: HTTP {status}. Stopping immediately!", flush=True)
                save_progress("index_error", page, 27, f"HTTP {status} on page {page}")
                sys.exit(1)
            with open(cache_file, "w", encoding="utf-8") as f:
                f.write(html)
            print(f" [Index Page {page}/27] Downloaded in {elapsed:.2f}s. Pausing 3.5s...", flush=True)
            time.sleep(random.uniform(3.0, 4.0))

        # Parse rows
        tbody = re.search(r'<tbody[^>]*>(.*?)</tbody>', html, re.DOTALL | re.IGNORECASE)
        if tbody:
            trs = re.findall(r'<tr[^>]*>(.*?)</tr>', tbody.group(1), re.DOTALL | re.IGNORECASE)
            for tr in trs:
                tds = re.findall(r'<td[^>]*>(.*?)</td>', tr, re.DOTALL | re.IGNORECASE)
                if len(tds) >= 5:
                    link_m = re.search(r'href=["\']([^"\']+)["\']', tds[0])
                    detail_url = link_m.group(1) if link_m else ""
                    clean_tds = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', td)).strip() for td in tds]
                    
                    slug = detail_url.rstrip('/').split('/')[-1] if detail_url else clean_tds[0].lower().replace(' ', '-')
                    all_drugs.append({
                        "inn": clean_tds[0],
                        "arabic_name": clean_tds[1],
                        "section": clean_tds[2],
                        "volume": clean_tds[3],
                        "tier": clean_tds[4],
                        "detail_url": detail_url,
                        "slug": slug
                    })
        save_progress("index", page, 27, f"Page {page}/27 collected")

    catalog_file = os.path.join(CACHE_DIR, "index_catalog.json")
    with open(catalog_file, "w", encoding="utf-8") as f:
        json.dump(all_drugs, f, ensure_ascii=False, indent=2)
    print(f"Index complete! Catalog contains {len(all_drugs)} entries saved to {catalog_file}.\n", flush=True)
    return all_drugs

def collect_detail_pages(catalog):
    print("=== PHASE 2: COLLECTING DRUG DETAIL PAGES ===", flush=True)
    total = len(catalog)
    # Estimate time remaining
    cached_count = sum(1 for d in catalog if os.path.exists(os.path.join(CACHE_DIR, f"drug_{d['slug']}.html")))
    remaining = total - cached_count
    est_seconds = remaining * 3.5
    est_min = est_seconds / 60
    print(f"Total drugs in catalog: {total}")
    print(f"Already cached: {cached_count}")
    print(f"Remaining to download: {remaining}")
    print(f"Estimated time: ~{est_min:.1f} minutes ({est_seconds:.0f} seconds) at 1 request every 3-4s.\n", flush=True)

    done_count = cached_count
    consecutive_slow = 0

    for idx, drug in enumerate(catalog, 1):
        slug = drug["slug"]
        url = drug["detail_url"]
        if not url:
            continue
        cache_file = os.path.join(CACHE_DIR, f"drug_{slug}.html")

        if os.path.exists(cache_file):
            continue

        status, html, elapsed = safe_fetch(url)

        # Check for errors
        if status in (429, 500, 502, 503, 504):
            print(f"\n[ALERT] Server returned HTTP {status} on {url}. Stopping immediately to protect the server!", flush=True)
            save_progress("error", done_count, total, f"Server returned HTTP {status} on {slug}")
            sys.exit(1)

        if status != 200:
            print(f"\n[WARNING] HTTP {status} for {slug}. Skipping.", flush=True)
            continue

        with open(cache_file, "w", encoding="utf-8") as f:
            f.write(html)

        done_count += 1
        rem = total - done_count
        rem_min = (rem * 3.5) / 60
        pct = (done_count / total) * 100

        # Slow down detector
        if elapsed > 10.0:
            consecutive_slow += 1
            print(f"\n[WARNING] Request took {elapsed:.1f}s (slow!).", flush=True)
            if consecutive_slow >= 3:
                print("\n[ALERT] Site slowed down for 3 consecutive requests. Pausing to be gentle.", flush=True)
                save_progress("slowdown_paused", done_count, total, "Site slowed down, stopping")
                sys.exit(1)
        else:
            consecutive_slow = 0

        print(f"[{done_count}/{total}] ({pct:.1f}%) Fetched: {drug['inn']} ({elapsed:.2f}s) | Est remaining: {rem_min:.1f} min", flush=True)
        save_progress("details", done_count, total, f"Fetched {drug['inn']}")

        # Gentle pause: 3.0 to 4.5 seconds
        time.sleep(random.uniform(3.0, 4.2))

    print("\n=== DETAIL COLLECTION FINISHED ===", flush=True)
    save_progress("completed", total, total, "All detail pages downloaded successfully")

if __name__ == "__main__":
    drugs = collect_index_pages()
    collect_detail_pages(drugs)
