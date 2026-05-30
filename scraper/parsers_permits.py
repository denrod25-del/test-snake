"""
Per-platform permit parsers.

Each parser is a callable:
    parser(session: requests.Session, source_cfg: dict) -> list[dict]

It returns a list of permit dicts using the schema declared in
data/permits/index.json -> schema.permit. Required fields:
    permitNumber, parcelId, address, type, status, appliedDate, url
Optional fields:
    subtype, description, applicantName, contractor, valuation,
    issuedDate, finalDate, expirationDate

If a page yields no parseable data, raise NoPermitDataError so the caller
can fall back to manual data without writing an empty result.

Design notes
------------
Permit portals are a heterogeneous mess:
  - Palm Beach County (legacy eDSWeb)   DEFUNCT — county migrated to a
                                        registration + reCAPTCHA-gated SPA.
                                        See parse_pbc_edsweb() for details.
  - Tyler EnerGov SelfService (WPB)     Modern Angular SPA with public search.
                                        Requires browser-captured XHR payloads
                                        to reverse engineer endpoints; see
                                        parse_tyler_energov() scaffold.
  - CentralSquare Click2Gov (Royal Palm) Old eGov ASP-style HTML form. NO
                                        bulk "recent permits" listing — every
                                        search needs PCN/address/name.
                                        See parse_click2gov() scaffold.
  - SagesGov (Boynton Beach)            ASP.NET WebForms behind a 1MB SPA.
                                        Same single-record-lookup limitation.
                                        See parse_sagesgov() scaffold.
  - Accela Citizen Access               Stable JSON endpoints; covers ~25 FL
                                        counties with one parser. Stub only.

The single biggest reality of FL permit portals: NONE of them give an
anonymous "give me all permits applied in last 90 days" feed. Every public
portal is structured for "look up THIS permit/address/contractor". That's
why this project pre-scrapes incrementally and applies keyword filtering
client-side.

References
----------
- PBC NEW Open Permit Search:  https://pbc.gov/ePZB.Admin.WebSPA/#/
                               (registration + paid for certified results)
- PBC NEW unauth permit info:  https://discover.pbc.gov/pzb/IWantTo/Online%20Permit%20Search.aspx
- WPB Civic Access:            https://westpalmbeachfl-energovpub.tylerhost.net/Apps/SelfService
- Royal Palm Click2Gov:        https://click2gov.royalpalmbeach.com/Click2GovBP/
- Boynton SagesGov:            https://www.sagesgov.com/boyntonbeach-fl/portal/search.aspx
- Accela Citizen Access docs:  https://accela.com/support/products/accela-civic-platform/citizen-access/
"""

import re
import time
from datetime import datetime, timedelta
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from dateutil import parser as dateparser


class NoPermitDataError(Exception):
    """Raised when a permit page contains no parseable data."""


def _to_iso(s):
    if not s:
        return None
    s = s.strip()
    if not s or s in ("-", "--", "N/A", "NA"):
        return None
    try:
        return dateparser.parse(s, fuzzy=True).strftime("%Y-%m-%d")
    except (ValueError, TypeError, OverflowError):
        return None


def _to_money(s):
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s)
    digits = re.sub(r"[^\d.]", "", str(s))
    if not digits:
        return None
    try:
        return float(digits)
    except ValueError:
        return None


def _normalize_pcn(s):
    return re.sub(r"[^0-9A-Za-z]", "", str(s or "")).upper()


# -----------------------------------------------------------------------------
# Palm Beach County eDSWeb (DEFUNCT — portal migrated)
# -----------------------------------------------------------------------------
# UPDATE 2026-04: epzb.pbcgov.org no longer resolves. PBC migrated their
# Online Permit Search to https://pbc.gov/ePZB.Admin.WebSPA/#/, an Angular
# SPA gated by:
#   - User registration (free account required)
#   - Google reCAPTCHA on search submission
#   - $63/search fee for "certified" searches with 7-10 day turnaround
#
# As of the migration there is no anonymous, free, scriptable bulk search
# for unincorporated PBC permits. The discoverable public landing page,
# https://discover.pbc.gov/pzb/IWantTo/Online%20Permit%20Search.aspx, just
# redirects users into the SPA above.
#
# This parser is kept so existing sources_permits.json entries don't
# break, but it now raises NoPermitDataError immediately with a message
# telling operators to use a municipal scraper or manual data instead.

PBC_NEW_PORTAL = "https://pbc.gov/ePZB.Admin.WebSPA/#/"
PBC_LEGACY_BASE = "https://epzb.pbcgov.org/eDSWeb/"  # historical, no longer resolves


def parse_pbc_edsweb(session, source_cfg):  # pylint: disable=unused-argument
    raise NoPermitDataError(
        "PBC eDSWeb (epzb.pbcgov.org) is DEFUNCT as of 2024-2025. The county "
        "migrated permit search to a registration + reCAPTCHA-gated SPA at "
        f"{PBC_NEW_PORTAL}. Anonymous bulk scraping is no longer possible "
        "for unincorporated PBC. Use municipal scrapers (WPB, Royal Palm, "
        "Boynton) or manual entries instead."
    )


# -----------------------------------------------------------------------------
# Tyler EnerGov SelfService / Civic Access (West Palm Beach, etc.)
# -----------------------------------------------------------------------------
# Tyler's SelfService is used by hundreds of jurisdictions nationwide. Each
# site is hosted on a tenant-specific subdomain like:
#   https://<tenant-slug>.tylerhost.net/Apps/SelfService
# and exposes an internal JSON API at /apps/selfservice/api/... .
#
# Anonymous public search is available WITHOUT any OAuth/bearer token. The
# endpoint just needs tenant-identifying headers, which we discover with one
# call to /api/tenants/gettenantslist.
#
# Endpoint:
#   POST /apps/selfservice/api/energov/search/search
# Required headers:
#   tenantId, tenantName, Tyler-TenantUrl (all from gettenantslist)
#   Tyler-Tenant-Culture: en-US
#   Referer:  <host>/apps/selfservice/<tenantUrl>   (anti-hotlink check)
# Body is a single large object with one "criteria block" per record type
# (Permit, Plan, Inspection, ...). The server chokes on NullReferenceException
# if those blocks are missing, so we always send the full template below and
# just fill in PermitCriteria.
#
# Permit-only search is triggered by:
#   SearchModule = 1  (the UI's "All" option — server uses FilterModule=2 to
#                      actually restrict to permits)
#   FilterModule = 2  (Permit module id)
# Inside PermitCriteria we set ApplyDateFrom/ApplyDateTo to bound the window,
# else you'll get 20+ years of history.
#
# Known limitations of the PUBLIC results:
#   - No contractor name      (not returned by public search)
#   - No valuation / job cost (stripped from public responses)
#   - No applicant name       (stripped from public responses)
# Tyler does expose those on the authenticated permit detail page, but that
# requires a logged-in user with a Tyler ID, which defeats "anonymous bulk".
# For contractor research, use the manual upload CSV path (the portal's CSV
# export retains contractor names for detail lookups done one at a time).

TYLER_LOOKBACK_DAYS = 90
TYLER_PAGE_SIZE = 100
TYLER_MAX_PAGES = 40           # hard cap — 4000 permits / window is plenty
TYLER_REQUEST_DELAY_SEC = 0.4  # be a good citizen; Tyler has rate limits

# Empty template for the TWELVE criteria blocks Tyler expects in every
# search call. Captured from a live XHR (see scraper/README.md § Tyler).
# We build a fresh copy per request then overwrite PermitCriteria.
_TYLER_BODY_TEMPLATE_JSON = """
{
 "Keyword":"","ExactMatch":false,"SearchModule":1,"FilterModule":2,"SearchMainAddress":false,
 "PlanCriteria":{"PlanNumber":null,"PlanTypeId":null,"PlanWorkclassId":null,"PlanStatusId":null,"ProjectName":null,"ApplyDateFrom":null,"ApplyDateTo":null,"ExpireDateFrom":null,"ExpireDateTo":null,"CompleteDateFrom":null,"CompleteDateTo":null,"Address":null,"Description":null,"SearchMainAddress":false,"ContactId":null,"ParcelNumber":null,"TypeId":null,"WorkClassIds":null,"ExcludeCases":null,"EnableDescriptionSearch":false,"PageNumber":0,"PageSize":0,"SortBy":"relevance","SortAscending":false},
 "PermitCriteria":{"PermitNumber":null,"PermitTypeId":"none","PermitWorkclassId":null,"PermitStatusId":"none","ProjectName":null,"IssueDateFrom":null,"IssueDateTo":null,"Address":null,"Description":null,"ExpireDateFrom":null,"ExpireDateTo":null,"FinalDateFrom":null,"FinalDateTo":null,"ApplyDateFrom":null,"ApplyDateTo":null,"SearchMainAddress":false,"ContactId":null,"TypeId":null,"WorkClassIds":null,"ParcelNumber":null,"ExcludeCases":null,"EnableDescriptionSearch":false,"PageNumber":0,"PageSize":0,"SortBy":"PermitNumber.keyword","SortAscending":false},
 "InspectionCriteria":{"Keyword":null,"ExactMatch":false,"Complete":null,"InspectionNumber":null,"InspectionTypeId":null,"InspectionStatusId":null,"RequestDateFrom":null,"RequestDateTo":null,"ScheduleDateFrom":null,"ScheduleDateTo":null,"Address":null,"SearchMainAddress":false,"ContactId":null,"TypeId":[],"WorkClassIds":[],"ParcelNumber":null,"DisplayCodeInspections":false,"ExcludeCases":[],"ExcludeFilterModules":[],"HiddenInspectionTypeIDs":null,"PageNumber":0,"PageSize":0,"SortBy":null,"SortAscending":false},
 "CodeCaseCriteria":{"CodeCaseNumber":null,"CodeCaseTypeId":null,"CodeCaseStatusId":null,"ProjectName":null,"OpenedDateFrom":null,"OpenedDateTo":null,"ClosedDateFrom":null,"ClosedDateTo":null,"Address":null,"ParcelNumber":null,"Description":null,"SearchMainAddress":false,"RequestId":null,"ExcludeCases":null,"ContactId":null,"EnableDescriptionSearch":false,"PageNumber":0,"PageSize":0,"SortBy":null,"SortAscending":false},
 "RequestCriteria":{"RequestNumber":null,"RequestTypeId":null,"RequestStatusId":null,"ProjectName":null,"EnteredDateFrom":null,"EnteredDateTo":null,"DeadlineDateFrom":null,"DeadlineDateTo":null,"CompleteDateFrom":null,"CompleteDateTo":null,"Address":null,"ParcelNumber":null,"SearchMainAddress":false,"PageNumber":0,"PageSize":0,"SortBy":null,"SortAscending":false},
 "BusinessLicenseCriteria":{"LicenseNumber":null,"LicenseTypeId":null,"LicenseClassId":null,"LicenseStatusId":null,"BusinessStatusId":null,"LicenseYear":null,"ApplicationDateFrom":null,"ApplicationDateTo":null,"IssueDateFrom":null,"IssueDateTo":null,"ExpirationDateFrom":null,"ExpirationDateTo":null,"SearchMainAddress":false,"CompanyTypeId":null,"CompanyName":null,"BusinessTypeId":null,"Description":null,"CompanyOpenedDateFrom":null,"CompanyOpenedDateTo":null,"CompanyClosedDateFrom":null,"CompanyClosedDateTo":null,"LastAuditDateFrom":null,"LastAuditDateTo":null,"ParcelNumber":null,"Address":null,"TaxID":null,"DBA":null,"ExcludeCases":null,"TypeId":null,"WorkClassIds":null,"ContactId":null,"PageNumber":0,"PageSize":0,"SortBy":null,"SortAscending":false},
 "ProfessionalLicenseCriteria":{"LicenseNumber":null,"HolderFirstName":null,"HolderMiddleName":null,"HolderLastName":null,"HolderCompanyName":null,"LicenseTypeId":null,"LicenseClassId":null,"LicenseStatusId":null,"IssueDateFrom":null,"IssueDateTo":null,"ExpirationDateFrom":null,"ExpirationDateTo":null,"ApplicationDateFrom":null,"ApplicationDateTo":null,"Address":null,"MainParcel":null,"SearchMainAddress":false,"ExcludeCases":null,"TypeId":null,"WorkClassIds":null,"ContactId":null,"PageNumber":0,"PageSize":0,"SortBy":null,"SortAscending":false},
 "LicenseCriteria":{"LicenseNumber":null,"LicenseTypeId":null,"LicenseClassId":null,"LicenseStatusId":null,"BusinessStatusId":null,"ApplicationDateFrom":null,"ApplicationDateTo":null,"IssueDateFrom":null,"IssueDateTo":null,"ExpirationDateFrom":null,"ExpirationDateTo":null,"SearchMainAddress":false,"CompanyTypeId":null,"CompanyName":null,"BusinessTypeId":null,"Description":null,"CompanyOpenedDateFrom":null,"CompanyOpenedDateTo":null,"CompanyClosedDateFrom":null,"CompanyClosedDateTo":null,"LastAuditDateFrom":null,"LastAuditDateTo":null,"ParcelNumber":null,"Address":null,"TaxID":null,"DBA":null,"ExcludeCases":null,"TypeId":null,"WorkClassIds":null,"ContactId":null,"HolderFirstName":null,"HolderMiddleName":null,"HolderLastName":null,"MainParcel":null,"EnableDescriptionSearchForBLicense":false,"EnableDescriptionSearchForPLicense":false,"EnableDescriptionSearchForOperationalPermit":false,"IsOperationalPermit":false,"PageNumber":0,"PageSize":0,"SortBy":null,"SortAscending":false},
 "ProjectCriteria":{"ProjectNumber":null,"ProjectName":null,"Address":null,"ParcelNumber":null,"StartDateFrom":null,"StartDateTo":null,"ExpectedEndDateFrom":null,"ExpectedEndDateTo":null,"CompleteDateFrom":null,"CompleteDateTo":null,"Description":null,"SearchMainAddress":false,"ContactId":null,"TypeId":null,"ExcludeCases":null,"EnableDescriptionSearch":false,"PageNumber":0,"PageSize":0,"SortBy":null,"SortAscending":false},
 "ExcludeCases":null,"HiddenInspectionTypeIDs":null,
 "PageNumber":1,"PageSize":100,"SortBy":"ApplyDate","SortAscending":false
}
"""


_TYLER_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)


def _tyler_fetch_tenant(session, host):
    """Discover the tenant id/name/url for a Tyler EnerGov host.

    All public Tyler SelfService installations expose
    /apps/selfservice/api/tenants/gettenantslist without auth, which returns
    exactly one tenant per site. Cached per-session via a private attribute
    so a scraper run only hits this endpoint once per host.

    Tyler's CDN rejects non-browser User-Agents with an HTML challenge page,
    so we always send a realistic Chrome UA for Tyler hosts.
    """
    cache = getattr(session, "_tyler_tenant_cache", {})
    if host in cache:
        return cache[host]

    url = f"https://{host}/apps/selfservice/api/tenants/gettenantslist"
    resp = session.get(url, timeout=30, headers={
        "User-Agent": _TYLER_BROWSER_UA,
        "Accept": "application/json, text/plain, */*",
        "Referer": f"https://{host}/Apps/SelfService",
    })
    resp.raise_for_status()
    ct = resp.headers.get("Content-Type", "")
    if "json" not in ct:
        raise NoPermitDataError(
            f"Tyler tenants list at {url} returned non-JSON ({ct}); "
            f"portal may be gated or hostname wrong."
        )
    data = resp.json()
    tenants = data.get("Result") or []
    if not tenants:
        raise NoPermitDataError(
            f"Tyler tenants list at {url} returned no tenants. "
            f"Host may not be a Tyler EnerGov SelfService site."
        )
    t = tenants[0]
    resolved = {
        "id":        str(t["TenantID"]),
        "name":      t["TenantName"],
        "url":       t["TenantUrl"],
        "isActive":  bool(t.get("IsActive", True)),
    }
    cache[host] = resolved
    session._tyler_tenant_cache = cache  # pylint: disable=protected-access
    return resolved


def _tyler_iso_date(s):
    """Convert Tyler's ISO8601-with-ms timestamps to plain YYYY-MM-DD."""
    if not s:
        return None
    try:
        return dateparser.parse(s).strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def _tyler_normalize(entity, host, tenant_url):
    """Map one Tyler EntityResult dict to our permit schema."""
    addr = entity.get("Address") or {}
    city = (addr.get("City") or "").strip()
    case_id = entity.get("CaseId")
    # The Angular route at /Apps/SelfService#/permit/:id takes the CaseId.
    detail_url = (
        f"https://{host}/Apps/SelfService#/permit/{case_id}"
        if case_id else
        f"https://{host}/Apps/SelfService#/search"
    )
    return {
        "permitNumber":   (entity.get("CaseNumber") or "").strip(),
        "parcelId":       (entity.get("MainParcel") or "").strip() or None,
        "address":        (entity.get("AddressDisplay") or addr.get("FullAddress") or "").strip(),
        "city":           city,
        "type":           entity.get("CaseType") or "",
        "subtype":        entity.get("CaseWorkclass") or "",
        "description":    entity.get("Description") or "",
        "status":         entity.get("CaseStatus") or "",
        "applicantName":  None,   # not exposed in public search
        "contractor":     None,   # not exposed in public search
        "valuation":      None,   # not exposed in public search
        "appliedDate":    _tyler_iso_date(entity.get("ApplyDate")),
        "issuedDate":     _tyler_iso_date(entity.get("IssueDate")),
        "finalDate":      _tyler_iso_date(entity.get("FinalDate")),
        "expirationDate": _tyler_iso_date(entity.get("ExpireDate")),
        "url":            detail_url,
    }


def parse_tyler_energov(session, source_cfg):
    """Fetch all recent permits from a Tyler EnerGov SelfService tenant.

    Required source_cfg keys:
        host             e.g. "westpalmbeachfl-energovpub.tylerhost.net"
                         (no scheme, no path)
    Optional source_cfg keys:
        lookbackDays     how far back to scan ApplyDate (default 90)
        keyword          server-side free-text filter (default "" = all)
        pageSize         default 100 (Tyler caps at 100)
        tenant           pre-known tenantUrl to skip discovery (optional)
    """
    import json as _json

    host = source_cfg.get("host")
    if not host:
        # Fall back to parsing the portalUrl/url so old configs keep working.
        url = source_cfg.get("portalUrl") or source_cfg.get("url") or ""
        m = re.search(r"https?://([^/]+)", url)
        host = m.group(1) if m else None
    if not host:
        raise NoPermitDataError(
            f"Tyler EnerGov parser for {source_cfg.get('city','?')} has no "
            "host configured. Set source_cfg['host'] to the tylerhost.net "
            "subdomain (e.g. 'westpalmbeachfl-energovpub.tylerhost.net')."
        )

    lookback = int(source_cfg.get("lookbackDays") or TYLER_LOOKBACK_DAYS)
    page_size = int(source_cfg.get("pageSize") or TYLER_PAGE_SIZE)
    keyword = (source_cfg.get("keyword") or "").strip()

    tenant = _tyler_fetch_tenant(session, host)
    if not tenant["isActive"]:
        raise NoPermitDataError(
            f"Tyler tenant {tenant['name']} on {host} is marked inactive."
        )

    today = datetime.utcnow().date()
    date_from = (today - timedelta(days=lookback)).isoformat()
    date_to   = today.isoformat()

    endpoint = f"https://{host}/apps/selfservice/api/energov/search/search"
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "User-Agent": _TYLER_BROWSER_UA,
        "Origin":  f"https://{host}",
        "Referer": f"https://{host}/apps/selfservice/{tenant['url']}",
        "tenantId":        tenant["id"],
        "tenantName":      tenant["name"],
        "Tyler-TenantUrl": tenant["url"],
        "Tyler-Tenant-Culture": "en-US",
    }

    permits = []
    seen_case_ids = set()
    for page in range(1, TYLER_MAX_PAGES + 1):
        body = _json.loads(_TYLER_BODY_TEMPLATE_JSON)
        body["Keyword"] = keyword
        body["PageNumber"] = page
        body["PageSize"] = page_size
        body["SortBy"] = "ApplyDate"
        body["SortAscending"] = False
        body["PermitCriteria"]["ApplyDateFrom"] = date_from
        body["PermitCriteria"]["ApplyDateTo"] = date_to

        resp = session.post(endpoint, json=body, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        if not data.get("Success"):
            err = data.get("ErrorMessage") or "(no error message)"
            raise NoPermitDataError(
                f"Tyler EnerGov {tenant['name']} returned Success=false: {err[:200]}"
            )
        result = data.get("Result") or {}
        ents = result.get("EntityResults") or []
        if not ents:
            break

        added_this_page = 0
        for e in ents:
            # Defensive: only keep permits (ModuleName==2), skip inspections/plans
            if e.get("ModuleName") != 2:
                continue
            case_id = e.get("CaseId")
            if case_id and case_id in seen_case_ids:
                continue
            seen_case_ids.add(case_id)
            permits.append(_tyler_normalize(e, host, tenant["url"]))
            added_this_page += 1

        if len(ents) < page_size:
            break   # last page
        time.sleep(TYLER_REQUEST_DELAY_SEC)
    else:
        # Loop ran to completion WITHOUT the "last page" break, meaning we hit
        # TYLER_MAX_PAGES. Since we sort by ApplyDate DESC we still have the
        # most-recent `permits`, but older ones in the window were truncated.
        # Surface this so the caller can log / adjust lookback.
        print(f"    !! hit TYLER_MAX_PAGES={TYLER_MAX_PAGES} cap "
              f"({TYLER_MAX_PAGES * page_size} permits); older permits in the "
              f"{lookback}-day window were truncated. Reduce lookbackDays "
              f"in sources_permits.json for full coverage.")

    if not permits:
        raise NoPermitDataError(
            f"Tyler EnerGov {tenant['name']} returned 0 permits for the "
            f"{lookback}-day lookback window ({date_from} to {date_to})."
        )
    return permits


# -----------------------------------------------------------------------------
# Royal Palm Beach -- CentralSquare Click2Gov
# -----------------------------------------------------------------------------
# Click2Gov is the legacy CentralSquare/SunGard portal:
#   https://click2gov.royalpalmbeach.com/Click2GovBP/selectpermit.html
#
# Search options (one of):
#   - Application Number (exact)
#   - Address (street #, direction, name, suffix)
#   - Parcel Number
#   - Name (begins with / contains)
#
# Critical limitation: there is NO "recent permits" or date-range listing.
# Every search must specify a criterion. To populate this scraper you need
# to either:
#   (a) Iterate a list of known contractor names (POST with name=...)
#       This is the most useful for market research workflows.
#   (b) Iterate a list of street names (POST with street_name=...)
#   (c) Maintain a list of "active in last N months" PCNs from the
#       parcel-lookup workflow and re-query each.
#
# Form submission flow (HTML POST, no JS required):
#   POST /Click2GovBP/searchresults.html
#   Body (URL-encoded):
#     searchMethod=Name|Address|ApplicationNumber|Parcel
#     name=ABC PLUMBING
#     matchName=Contains|BeginsWith
#     ... (criterion-specific fields)
#   Response: HTML table of permit summaries linked to permit-detail pages
#
# To FINISH:
#   1. Hit selectpermit.html, capture the form fields (they're stable; this
#      portal hasn't changed in years).
#   2. Loop over a contractor-name seed list from source_cfg["contractors"].
#   3. For each result row, follow the link to permitdetails.html?permitNumber=X
#      and parse the detail page.
#   4. Throttle to 1 request / 2 seconds. Click2Gov has weak rate limits but
#      will lock you out for an hour if you slam it.

CLICK2GOV_LOOKBACK_DAYS = 90


def parse_click2gov(session, source_cfg):  # pylint: disable=unused-argument
    """SCAFFOLD: Generic Click2Gov scraper.

    Expects source_cfg to include:
        "url": base URL e.g. https://click2gov.royalpalmbeach.com/Click2GovBP/
        "contractors": optional list of contractor names to seed the search
        "addresses":   optional list of (street_num, street_name) tuples
    """
    portal = source_cfg.get("portalUrl") or source_cfg.get("url") or "(unknown click2gov portal)"
    raise NoPermitDataError(
        f"Click2Gov scraper ({source_cfg.get('city', 'unknown')}) is a scaffold. "
        f"Click2Gov has no bulk listing — searches require a PCN, address, "
        f"name, or application number. Add a 'contractors' or 'addresses' "
        f"seed list to the source config, then implement the loop in "
        f"parse_click2gov(). Until then, search manually at {portal}."
    )


# -----------------------------------------------------------------------------
# Boynton Beach -- SagesGov
# -----------------------------------------------------------------------------
# Boynton migrated from Click2Gov to SagesGov in 2024:
#   https://www.sagesgov.com/boyntonbeach-fl/portal/search.aspx
#
# SagesGov is an ASP.NET WebForms search behind a heavy SPA (~1MB initial
# page). Like Click2Gov it has no "recent permits" listing — every search
# requires at least one criterion (project #, name, address, parcel,
# license #, etc.).
#
# It also requires JavaScript to maintain __VIEWSTATE / __EVENTVALIDATION
# across postbacks AND has anti-bot heuristics (it watches for missing
# JS-set form fields). Plain requests + BeautifulSoup will get an empty
# results page.
#
# To FINISH:
#   1. Capture the search XHR in DevTools (it's a regular ASP.NET postback,
#      not JSON — Content-Type: application/x-www-form-urlencoded).
#   2. Replicate the full form payload including all hidden fields.
#   3. Add a small delay + rotate User-Agent to avoid the anti-bot trap.
#   4. Parse the results grid (results render server-side as a <table>).
#
# Easier alternative for now: SagesGov supports CSV export from the search
# results page. Operators can search by date range (last 30 days),
# export CSV, and feed it to the manual upload UI on permit-search.html.

SAGESGOV_BOYNTON_BASE = "https://www.sagesgov.com/boyntonbeach-fl/portal/"


def parse_sagesgov(session, source_cfg):  # pylint: disable=unused-argument
    """SCAFFOLD: Generic SagesGov scraper."""
    portal = source_cfg.get("portalUrl") or source_cfg.get("url") or SAGESGOV_BOYNTON_BASE
    raise NoPermitDataError(
        f"SagesGov scraper ({source_cfg.get('city', 'unknown')}) is a scaffold. "
        f"SagesGov is JS-protected ASP.NET WebForms with no bulk listing. "
        f"Recommended path: search manually at {portal}, export CSV, then "
        "drop it into the 'Upload manual data' panel on permit-search.html."
    )


# -----------------------------------------------------------------------------
# Accela Citizen Access (template -- not yet active)
# -----------------------------------------------------------------------------
# Accela powers ~25 FL counties (Hillsborough, Orange, Lee, Pasco, Polk, etc.).
# All Accela CitizenAccess deployments share an internal JSON endpoint:
#   POST /CitizenAccess/Cap/CapList.aspx with module=Building & date range
# Returns paginated HTML. A future implementation should:
#   1. Build a generic accela parser that takes (subdomain, module) from cfg
#   2. Add 25+ counties to sources_permits.json with parser="accela"
# This unlocks majority coverage in one PR.
def parse_accela(session, source_cfg):  # pylint: disable=unused-argument
    raise NoPermitDataError(
        "Accela template scraper is not yet implemented. "
        "When ready, this single parser will cover ~25 FL counties at once. "
        "See parsers_permits.py module docstring for spec."
    )


PERMIT_PARSERS = {
    "pbc_edsweb":    parse_pbc_edsweb,    # DEFUNCT — kept for backwards compat
    "tyler_energov": parse_tyler_energov, # WPB scaffold
    "click2gov":     parse_click2gov,     # Royal Palm scaffold
    "sagesgov":      parse_sagesgov,      # Boynton scaffold
    "accela":        parse_accela,        # ~25 FL counties (not yet impl)
}
