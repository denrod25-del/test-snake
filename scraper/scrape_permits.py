"""
scrape_permits.py
-----------------
Daily permit scraper. For each county configured in sources_permits.json,
runs the appropriate parser (pbc_edsweb, accela, manual, ...), merges
manual overrides from manual_permits.json, and writes:

    data/permits/index.json           coverage manifest (always written)
    data/permits/<county-slug>.json   one file per county with permits

The site (tax-deeds.html) loads the index on page load to know which
counties have data, and lazy-loads each county file when a user opens
that county's research notebook entries.

Run:
    cd scraper
    pip install -r requirements.txt
    python scrape_permits.py
    python scrape_permits.py --only "Palm Beach" -v
    python scrape_permits.py --dry-run -v
    python scrape_permits.py --skip-network            # writes index/manual only

Designed to be run by GitHub Actions on a daily cron.
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

from parsers_permits import PERMIT_PARSERS, NoPermitDataError

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass


HERE = Path(__file__).parent
ROOT = HERE.parent
SOURCES_PATH       = HERE / "sources_permits.json"
MANUAL_PATH        = HERE / "manual_permits.json"
DATA_DIR           = ROOT / "data" / "permits"
INDEX_PATH         = DATA_DIR / "index.json"

HEADERS = {
    "User-Agent": "FloridaTaxDeedRegistry-Permits/1.0 (+contact: hello@example.com)",
    "Accept":     "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
REQUEST_TIMEOUT = 30
DELAY_BETWEEN_COUNTIES = 2.5  # polite — permit portals get cranky


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def make_session():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def scrape_county(county_name, cfg, session, verbose=False):
    parser_name = cfg.get("parser", "manual")
    if parser_name in ("manual", "unsupported"):
        return None, f"non-scraping parser ({parser_name})"
    parser = PERMIT_PARSERS.get(parser_name)
    if not parser:
        return None, f"unknown parser '{parser_name}'"
    try:
        if verbose:
            print(f"    → calling parser '{parser_name}' for {county_name}...")
        permits = parser(session, cfg)
        return permits, None
    except NoPermitDataError as e:
        return None, str(e)
    except requests.RequestException as e:
        return None, f"network error: {type(e).__name__}: {e}"
    except Exception as e:  # pylint: disable=broad-except
        return None, f"parse error: {type(e).__name__}: {e}"


def merge_manual(scraped_permits, manual_permits):
    """Union scraped + manual permits. Manual entries win on permitNumber collision."""
    by_no = {p["permitNumber"]: p for p in (scraped_permits or [])}
    for p in (manual_permits or []):
        by_no[p["permitNumber"]] = p  # manual overwrites
    return list(by_no.values())


def index_by_parcel(permits):
    """Group permits by normalized parcelId for fast UI lookup."""
    out = {}
    for p in permits:
        pid = p.get("parcelId")
        if not pid:
            continue
        out.setdefault(pid, []).append(p)
    # Sort each parcel's permits by appliedDate descending (most recent first)
    for arr in out.values():
        arr.sort(key=lambda x: x.get("appliedDate") or "0000-00-00", reverse=True)
    return out


def write_county_file(county_name, slug, cfg, permits, out_dir, dry_run, verbose):
    by_parcel = index_by_parcel(permits)
    payload = {
        "county":       county_name,
        "slug":         slug,
        "generated":    datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source":       cfg.get("portalUrl") or cfg.get("url") or "",
        "portalUrl":    cfg.get("portalUrl") or cfg.get("url") or "",
        "scope":        cfg.get("scope") or "Recent permits",
        "permitCount":  len(permits),
        "permitsByParcel": by_parcel,
    }
    if dry_run:
        if verbose:
            print(json.dumps(payload, indent=2)[:2000] + ("..." if len(json.dumps(payload)) > 2000 else ""))
        return
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{slug}.json"
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_index(coverage, dry_run, partial=False):
    """Write data/permits/index.json.

    When `partial` is True (i.e. invoked via --only), merge new coverage
    entries into the existing index rather than replacing it. This way a
    single-county debug run doesn't blank out the rest of the manifest.
    """
    final_coverage = coverage
    if partial and INDEX_PATH.exists():
        try:
            existing = load_json(INDEX_PATH)
            existing_cov = existing.get("coverage") or []
            new_slugs = {c["slug"] for c in coverage}
            kept = [c for c in existing_cov if c.get("slug") not in new_slugs]
            final_coverage = kept + coverage
        except Exception:  # pylint: disable=broad-except
            pass  # fall through to fresh write

    payload = {
        "_comment": "Auto-generated by scrape_permits.py. Do not edit by hand.",
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": 1,
        "schema": {
            "permit": [
                "permitNumber", "parcelId", "address", "type", "subtype",
                "description", "status", "applicantName", "contractor",
                "valuation", "appliedDate", "issuedDate", "finalDate",
                "expirationDate", "url"
            ]
        },
        "coverage": final_coverage,
    }
    if dry_run:
        print(json.dumps(payload, indent=2))
        return
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="Comma-separated list of counties to scrape (debug)")
    ap.add_argument("--dry-run", action="store_true", help="Don't write any files")
    ap.add_argument("--skip-network", action="store_true",
                    help="Don't make HTTP requests; only refresh manual+index")
    ap.add_argument("--verbose", "-v", action="store_true")
    args = ap.parse_args()

    sources = {k: v for k, v in load_json(SOURCES_PATH).items() if not k.startswith("_")}
    manual_all = {k: v for k, v in load_json(MANUAL_PATH).items() if not k.startswith("_")}

    only = set(s.strip() for s in args.only.split(",")) if args.only else None
    if only:
        sources = {k: v for k, v in sources.items() if k in only}

    session = make_session()

    coverage = []
    stats = {"scraped": 0, "scraped_with_data": 0, "manual_only": 0, "failed": 0, "unsupported": 0}
    sources_list = list(sources.items())

    for i, (county, cfg) in enumerate(sources_list):
        slug = slugify(county)
        parser_name = cfg.get("parser", "manual")
        manual_for_county = manual_all.get(county) or manual_all.get(slug) or []

        if i > 0 and parser_name not in ("manual", "unsupported") and not args.skip_network:
            time.sleep(DELAY_BETWEEN_COUNTIES)

        print(f"[{i+1}/{len(sources_list)}] {county:<16} ({parser_name:<11}) ", end="", flush=True)

        if parser_name == "unsupported":
            stats["unsupported"] += 1
            print("SKIP no public portal")
            coverage.append({
                "county":     county,
                "slug":       slug,
                "status":     "unsupported",
                "portalUrl":  cfg.get("portalUrl"),
                "note":       "No public permit portal available."
            })
            continue

        scraped = None
        err = None
        if parser_name == "manual" or args.skip_network:
            err = "skipped (manual or --skip-network)" if parser_name == "manual" else "skipped (--skip-network)"
        else:
            scraped, err = scrape_county(county, cfg, session, verbose=args.verbose)

        merged = merge_manual(scraped, manual_for_county)

        if merged:
            if scraped:
                stats["scraped_with_data"] += 1
                stats["scraped"] += 1
                print(f"OK  scraped {len(scraped)} + manual {len(manual_for_county)} = {len(merged)} permits")
            else:
                stats["manual_only"] += 1
                print(f"OK  manual {len(manual_for_county)} permits ({err})")
            write_county_file(county, slug, cfg, merged, DATA_DIR, args.dry_run, args.verbose)
            coverage.append({
                "county":      county,
                "slug":        slug,
                "status":      "active" if scraped else "manual",
                "dataFile":    f"data/permits/{slug}.json",
                "lastUpdated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "sourceLabel": cfg.get("portalUrl") or cfg.get("url"),
                "portalUrl":   cfg.get("portalUrl") or cfg.get("url"),
                "scope":       cfg.get("scope") or ("Manually-entered permits only" if not scraped else "Recent permits"),
                "permitCount": len(merged),
            })
        else:
            # Preserve an existing per-county file when this run produced nothing.
            # Rationale: a transient scrape failure or --skip-network shouldn't
            # blank out the UI for a county that had working data yesterday.
            existing_path = DATA_DIR / f"{slug}.json"
            preserved = None
            if existing_path.exists() and not args.dry_run:
                try:
                    preserved = load_json(existing_path)
                except Exception:  # pylint: disable=broad-except
                    preserved = None
            if preserved:
                stats["manual_only"] += 1  # treat as "served from cache" for stats
                print(f"--  no fresh data ({err}); preserving previous file ({preserved.get('permitCount', 0)} permits)")
                coverage.append({
                    "county":      county,
                    "slug":        slug,
                    "status":      "stale",
                    "dataFile":    f"data/permits/{slug}.json",
                    "lastUpdated": preserved.get("generated"),
                    "sourceLabel": cfg.get("portalUrl") or cfg.get("url"),
                    "portalUrl":   cfg.get("portalUrl") or cfg.get("url"),
                    "scope":       preserved.get("scope") or "Cached permits (last successful run)",
                    "permitCount": preserved.get("permitCount", 0),
                    "note":        f"Last scrape failed: {err}",
                })
            elif parser_name == "manual":
                stats["unsupported"] += 1
                print(f"--  no data (manual entries empty)")
                coverage.append({
                    "county":    county,
                    "slug":      slug,
                    "status":    "manual",
                    "portalUrl": cfg.get("portalUrl") or cfg.get("url"),
                    "note":      "No manual entries yet — see portalUrl for manual lookup."
                })
            else:
                stats["failed"] += 1
                print(f"FAIL {err}")
                coverage.append({
                    "county":    county,
                    "slug":      slug,
                    "status":    "available",
                    "portalUrl": cfg.get("portalUrl") or cfg.get("url"),
                    "note":      err or "No data yet — see portalUrl for manual lookup."
                })

    write_index(coverage, args.dry_run, partial=bool(only))

    print()
    print("=" * 72)
    print(f"Scraped (with data):  {stats['scraped_with_data']}")
    print(f"Manual-only:          {stats['manual_only']}")
    print(f"Failed:               {stats['failed']}")
    print(f"Unsupported:          {stats['unsupported']}")
    print(f"Total counties:       {len(sources_list)}")
    if args.dry_run:
        print("\n[dry-run] not writing any files")
    else:
        print(f"\nWrote {INDEX_PATH.relative_to(ROOT)} + {stats['scraped_with_data'] + stats['manual_only']} county files in {DATA_DIR.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
