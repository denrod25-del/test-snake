"""Command-line entry point.

    python -m fwq probe                    check which sources are reachable
    python -m fwq resolve                  resolve utility configs to PWSIDs
    python -m fwq ingest                   full pipeline -> data/water/
    python -m fwq validate                 check committed output against the schema
    python -m fwq lookup --zip 33410       query the built service index locally
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import analytes as analyte_registry
from . import build, utilities
from .geo import ServiceIndex
from .schema import DataStatus
from .sources.http import Client, SourceUnavailable


def _configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(levelname)-7s %(name)s: %(message)s",
        stream=sys.stderr,
    )


def cmd_probe(args: argparse.Namespace) -> int:
    with Client(use_cache=False, rate_limit_sec=args.rate_limit) as client:
        payload = build.probe_sources(client, out_dir=args.out)
    reachable = sum(1 for r in payload["results"] if r["reachable"])
    total = len(payload["results"])
    print(f"\n{reachable}/{total} sources reachable")
    if reachable == 0:
        print(
            "No sources reachable. If this is a sandboxed environment, outbound "
            "access to EPA/FDEP hosts is likely blocked by network policy; run the "
            "ingest in CI instead.",
            file=sys.stderr,
        )
        return 2
    return 0 if reachable == total else 1


def cmd_resolve(args: argparse.Namespace) -> int:
    configs = utilities.load_configs()
    if args.utility:
        configs = {k: v for k, v in configs.items() if k in set(args.utility)}
    if not configs:
        print("no utility configs matched", file=sys.stderr)
        return 1

    with Client(use_cache=not args.no_cache, rate_limit_sec=args.rate_limit) as client:
        outcomes = build.resolve_utilities(client, configs)

    path = utilities.write_lockfile(outcomes)
    print(f"\nwrote {path.relative_to(build.REPO_ROOT)}")
    for outcome in outcomes:
        marker = {"high": "OK", "medium": "REVIEW", "low": "REVIEW", "unresolved": "FAIL"}
        print(
            f"  {marker.get(outcome.confidence, '?'):7} {outcome.slug:12} "
            f"{outcome.pwsid or '-':10} {outcome.matched_name or ''}"
        )
        for warning in outcome.warnings:
            print(f"          ! {warning}")
    unresolved = [o for o in outcomes if o.confidence in ("unresolved", "low")]
    return 1 if unresolved else 0


def cmd_ingest(args: argparse.Namespace) -> int:
    configs = utilities.load_configs()
    utilities.apply_lockfile(configs)
    if args.utility:
        configs = {k: v for k, v in configs.items() if k in set(args.utility)}

    focus = [c.pwsid for c in configs.values() if c.pwsid]
    focus.extend(args.pwsid or [])
    if not focus:
        print(
            "No focus systems. Run `python -m fwq resolve` first so utility configs "
            "have PWSIDs, or pass --pwsid explicitly.",
            file=sys.stderr,
        )

    with Client(
        use_cache=not args.no_cache,
        cache_ttl_hours=args.cache_ttl,
        rate_limit_sec=args.rate_limit,
    ) as client:
        result = build.ingest_state(
            client, state=args.state, focus_pwsids=focus,
            ucmr5_bulk_path=args.ucmr5_file,
        )
        result.resolutions = [
            utilities.ResolutionOutcome(**{
                "slug": slug,
                "pwsid": entry.get("pwsid"),
                "matched_name": entry.get("matchedName"),
                "confidence": entry.get("confidence", "unresolved"),
                "checks": entry.get("checks", {}),
                "rejected": entry.get("rejected", []),
                "resolved_at": entry.get("resolvedAt"),
                "warnings": entry.get("warnings", []),
            })
            for slug, entry in utilities.load_lockfile().get("utilities", {}).items()
        ]
        stats = client.stats.to_dict()

    manifest = build.write_dataset(result, configs, out_dir=args.out)

    print(json.dumps({"manifest": manifest["counts"], "http": stats}, indent=2))
    print(f"status: {manifest['meta']['status']}")
    for outcome in result.outcomes:
        if outcome.status in (DataStatus.BLOCKED, DataStatus.BROKEN):
            print(f"  degraded: {outcome.source_id} — {outcome.detail}", file=sys.stderr)
    if not result.report.is_clean:
        print(
            f"  normalization dropped rows: {dict(result.report.skipped)}",
            file=sys.stderr,
        )
    return 0 if result.systems else 2


def cmd_dictionary(args: argparse.Namespace) -> int:
    """Publish the analyte dictionary on its own.

    The dictionary is the one part of the dataset that needs no network: it is
    a maintained reference table, not upstream data. Publishing it separately
    means `/api/water/analytes` works from the first deploy, before any ingest
    has run.
    """
    out_dir = Path(args.out or build.DEFAULT_OUT_DIR)
    configs = utilities.load_configs()
    utilities.apply_lockfile(configs)
    empty = build.IngestResult(generated_at=datetime.now(timezone.utc))
    build.write_dataset(empty, configs, out_dir=out_dir)
    reg = analyte_registry.registry()
    print(f"wrote {len(reg.analytes)} analytes to {out_dir / 'analytes.json'}")
    print(f"limit table reviewed {reg.limit_review.get('reviewed', 'unknown')}")
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    """Re-read published output and check it against the schema's invariants."""
    out_dir = Path(args.out or build.DEFAULT_OUT_DIR)
    problems: list[str] = []

    index_path = out_dir / "index.json"
    if not index_path.exists():
        print(f"no dataset at {out_dir} — run `python -m fwq ingest` first", file=sys.stderr)
        return 2
    manifest = json.loads(index_path.read_text(encoding="utf-8"))

    try:
        analyte_registry.registry()
    except Exception as exc:  # noqa: BLE001
        problems.append(f"analyte registry failed to load: {exc}")

    systems_path = out_dir / "systems.json"
    if systems_path.exists():
        systems = json.loads(systems_path.read_text(encoding="utf-8"))["systems"]
        seen: set[str] = set()
        for system in systems:
            pwsid = system.get("pwsid")
            if pwsid in seen:
                problems.append(f"duplicate system {pwsid}")
            seen.add(pwsid)
            if not system.get("provenance", {}).get("source"):
                problems.append(f"{pwsid}: missing provenance")
        if len(seen) != manifest["counts"]["systems"]:
            problems.append(
                f"manifest says {manifest['counts']['systems']} systems, "
                f"systems.json has {len(seen)}"
            )

    for profile_path in sorted((out_dir / "systems").glob("*.json")):
        profile = json.loads(profile_path.read_text(encoding="utf-8"))
        pwsid = profile.get("system", {}).get("pwsid")
        if pwsid != profile_path.stem:
            problems.append(f"{profile_path.name}: filename does not match pwsid {pwsid}")
        for record in profile.get("results", []):
            if record.get("detected") is False and record.get("comparison"):
                problems.append(
                    f"{pwsid}/{record.get('analyteId')}: non-detect carries a limit "
                    "comparison, which would misreport it as an exceedance"
                )
            if not record.get("provenance", {}).get("source"):
                problems.append(f"{pwsid}/{record.get('analyteId')}: result missing provenance")

    if problems:
        print(f"{len(problems)} problem(s):", file=sys.stderr)
        for problem in problems[:50]:
            print(f"  - {problem}", file=sys.stderr)
        return 1
    print(f"dataset at {out_dir} is valid")
    return 0


def cmd_lookup(args: argparse.Namespace) -> int:
    path = Path(args.out or build.DEFAULT_OUT_DIR) / "service-index.json"
    if not path.exists():
        print(f"no service index at {path} — run `python -m fwq ingest` first", file=sys.stderr)
        return 2
    index = ServiceIndex.load(path)
    if args.zip:
        payload = index.lookup_zip(args.zip, city=args.city)
    elif args.city:
        payload = index.lookup_city(args.city)
    else:
        print("pass --zip or --city", file=sys.stderr)
        return 1
    print(json.dumps(payload, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="fwq", description=__doc__)
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("--out", type=Path, default=None, help="output directory")
    parser.add_argument(
        "--rate-limit", type=float, default=0.2,
        help="minimum seconds between upstream requests (default: 0.2)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_probe = sub.add_parser("probe", help="check source reachability")
    p_probe.set_defaults(func=cmd_probe)

    p_resolve = sub.add_parser("resolve", help="resolve utility configs to PWSIDs")
    p_resolve.add_argument("--utility", action="append", help="limit to a utility slug")
    p_resolve.add_argument("--no-cache", action="store_true")
    p_resolve.set_defaults(func=cmd_resolve)

    p_ingest = sub.add_parser("ingest", help="run the full pipeline")
    p_ingest.add_argument("--state", default="FL")
    p_ingest.add_argument("--utility", action="append", help="limit to a utility slug")
    p_ingest.add_argument("--pwsid", action="append", help="extra PWSID to deep-pull")
    p_ingest.add_argument("--no-cache", action="store_true")
    p_ingest.add_argument("--cache-ttl", type=float, default=24.0)
    p_ingest.add_argument(
        "--ucmr5-file", type=Path, default=None,
        help="UCMR 5 bulk file (.zip or delimited text) downloaded from EPA, "
             "used when the Envirofacts UCMR tables do not answer",
    )
    p_ingest.set_defaults(func=cmd_ingest)

    p_dictionary = sub.add_parser(
        "dictionary", help="publish the analyte dictionary (no network needed)"
    )
    p_dictionary.set_defaults(func=cmd_dictionary)

    p_validate = sub.add_parser("validate", help="validate committed output")
    p_validate.set_defaults(func=cmd_validate)

    p_lookup = sub.add_parser("lookup", help="query the service index")
    p_lookup.add_argument("--zip")
    p_lookup.add_argument("--city")
    p_lookup.set_defaults(func=cmd_lookup)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    _configure_logging(args.verbose)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
