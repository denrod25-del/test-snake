"""
check_links.py — HEAD-check a sample of official county links (rate-limited sample).

Uses urllib only; skips on network failure with warnings (does not fail CI by default).
Pass --strict to treat unreachable links as errors.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = "DeedScout-LinkCheck/1.0 (+https://deedscout.app/)"


def head_ok(url: str, timeout: float = 15.0) -> tuple[bool, str]:
    if not url or not url.startswith("http"):
        return False, "invalid url"
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return 200 <= resp.status < 400, f"HTTP {resp.status}"
    except urllib.error.HTTPError as exc:
        if exc.code in (403, 405, 429):
            return True, f"HTTP {exc.code} (treated as reachable)"
        return False, f"HTTP {exc.code}"
    except Exception as exc:  # noqa: BLE001
        req = urllib.request.Request(url, method="GET", headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return 200 <= resp.status < 400, f"GET HTTP {resp.status}"
        except Exception as exc2:  # noqa: BLE001
            return False, str(exc2)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", type=int, default=12, help="Number of counties to check")
    parser.add_argument("--strict", action="store_true", help="Fail on any bad link")
    args = parser.parse_args()

    links_path = ROOT / "data" / "county-links.json"
    links = json.loads(links_path.read_text(encoding="utf-8"))
    names = sorted(links.keys())[: args.sample]

    bad: list[str] = []
    for name in names:
        entry = links[name]
        for key in ("pa", "clerk", "auction"):
            block = entry.get(key) or {}
            url = block.get("url")
            if not url:
                continue
            ok, detail = head_ok(url)
            status = "OK" if ok else "FAIL"
            print(f"{status}: {name} {key} -> {url} ({detail})")
            if not ok:
                bad.append(f"{name}/{key}: {detail}")

    if bad and args.strict:
        for line in bad:
            print(f"ERROR: {line}", file=sys.stderr)
        return 1
    if bad:
        print(f"WARN: {len(bad)} link(s) failed (non-strict mode)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
