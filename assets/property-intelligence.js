/**
 * DeedScout Property Intelligence — parcel signal lookups.
 * Zoning / ownership / flood deep-links / permits feed / tax-deed stage / Pro rent comps.
 */
(function () {
  "use strict";

  var ZONING_URL =
    "https://maps.co.palm-beach.fl.us/arcgis/rest/services/OpenData/Planning_Open_Data/MapServer/9/query";
  var REGISTRY_URL = "data/parcels/registry.json";
  var PERMITS_URL = "data/signals/recent-permits.json";
  var CATALOG_URL = "data/signals/catalog.json";
  var SALES_URL = "sales.json";

  var registry = null;
  var $ = function (id) {
    return document.getElementById(id);
  };

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(n) {
    n = Number(n);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  }

  function fmtDate(v) {
    if (v == null || v === "") return "—";
    if (typeof v === "number") {
      try {
        return new Date(v).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch (e) {
        return String(v);
      }
    }
    var s = String(v).slice(0, 10);
    return s || "—";
  }

  function setStatus(el, html) {
    if (el) el.innerHTML = html;
  }

  function badge(status) {
    if (window.DeedScoutTrust && DeedScoutTrust.renderBadge) {
      return DeedScoutTrust.renderBadge(status, { compact: true });
    }
    return '<span class="ds-status">' + esc(status) + "</span>";
  }

  async function loadJson(url) {
    var res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(url + " → " + res.status);
    return res.json();
  }

  async function arcgisQuery(endpoint, params) {
    var q = new URLSearchParams(params);
    var res = await fetch(endpoint + "?" + q.toString());
    if (!res.ok) throw new Error("ArcGIS " + res.status);
    var data = await res.json();
    if (data.error) throw new Error(data.error.message || "ArcGIS error");
    return data;
  }

  function pick(attrs, keys) {
    if (!attrs || !keys) return null;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (attrs[k] != null && attrs[k] !== "") return attrs[k];
    }
    return null;
  }

  function buildAddress(attrs, map) {
    var addr = pick(attrs, map.address || []);
    var city = pick(attrs, map.city || []);
    var zip = pick(attrs, map.zip || []);
    return [addr, city, zip ? "FL " + zip : "FL"].filter(Boolean).join(", ");
  }

  function centroid(geom) {
    if (!geom || !geom.rings || !geom.rings[0] || !geom.rings[0].length) return null;
    var ring = geom.rings[0];
    var xs = 0;
    var ys = 0;
    for (var i = 0; i < ring.length; i++) {
      xs += ring[i][0];
      ys += ring[i][1];
    }
    return { lon: xs / ring.length, lat: ys / ring.length };
  }

  async function lookupParcel(countySlug, mode, query) {
    if (!registry) registry = await loadJson(REGISTRY_URL);
    var county = registry.counties[countySlug];
    if (!county || county.status !== "live") {
      throw new Error("County GIS is not live yet.");
    }
    var where;
    var q = String(query || "").trim();
    if (!q) throw new Error("Enter a PCN, owner, or address.");

    if (mode === "pcn") {
      var idField = (county.idFields && county.idFields[0]) || "PCN";
      var cleaned = q.replace(/[-\s]/g, "");
      where = idField + " LIKE '%" + cleaned.replace(/'/g, "''") + "%'";
    } else if (mode === "owner") {
      var ownerField = (county.map.owner && county.map.owner[0]) || "OWNER_NAME1";
      where = "UPPER(" + ownerField + ") LIKE '%" + q.toUpperCase().replace(/'/g, "''") + "%'";
    } else {
      var addrField = (county.map.address && county.map.address[0]) || "SITE_ADDR_STR";
      where = "UPPER(" + addrField + ") LIKE '%" + q.toUpperCase().replace(/'/g, "''") + "%'";
    }

    var data = await arcgisQuery(county.endpoint, {
      where: where,
      outFields: (county.outFields || ["*"]).join(","),
      returnGeometry: "true",
      outSR: "4326",
      resultRecordCount: "8",
      f: "json",
    });
    var features = data.features || [];
    return features.map(function (f) {
      var a = f.attributes || {};
      var map = county.map || {};
      return {
        countySlug: countySlug,
        countyName: county.name,
        paUrl: county.paUrl,
        pcn: pick(a, map.pcn || county.idFields || []),
        owner: [pick(a, map.owner || []), pick(a, ["OWNER_NAME2"])].filter(Boolean).join(" "),
        address: buildAddress(a, map),
        market: pick(a, map.market || []),
        assessed: pick(a, map.assessed || []),
        saleDate: pick(a, map.saleDate || []),
        salePrice: pick(a, map.salePrice || []),
        homestead: pick(a, map.homestead || []),
        yearBuilt: pick(a, ["YRBLT", "YEAR_BUILT"]),
        centroid: centroid(f.geometry),
        raw: a,
      };
    });
  }

  async function lookupZoning(lon, lat) {
    var data = await arcgisQuery(ZONING_URL, {
      geometry: lon + "," + lat,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FNAME,FCODE,ZONING_DESC,DT_CHG",
      returnGeometry: "false",
      f: "json",
    });
    var f = (data.features || [])[0];
    if (!f) return null;
    return f.attributes;
  }

  async function recentZoningUpdates() {
    var data = await arcgisQuery(ZONING_URL, {
      where: "DT_CHG IS NOT NULL",
      outFields: "FNAME,FCODE,ZONING_DESC,DT_CHG",
      returnGeometry: "false",
      orderByFields: "DT_CHG DESC",
      resultRecordCount: "12",
      f: "json",
    });
    return (data.features || []).map(function (f) {
      return f.attributes;
    });
  }

  function renderParcelCards(parcels) {
    if (!parcels.length) {
      return '<p class="pi-empty">No parcels matched. Try a full PCN or a shorter address fragment.</p>';
    }
    return parcels
      .map(function (p, idx) {
        return (
          '<button type="button" class="pi-parcel" data-idx="' +
          idx +
          '">' +
          "<strong>" +
          esc(p.address || p.pcn || "Parcel") +
          "</strong>" +
          '<span class="pi-meta">' +
          esc(p.pcn || "") +
          (p.owner ? " · " + esc(p.owner) : "") +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderOwnership(p) {
    return (
      '<dl class="pi-dl">' +
      "<div><dt>Owner</dt><dd>" +
      esc(p.owner || "—") +
      "</dd></div>" +
      "<div><dt>PCN</dt><dd>" +
      esc(p.pcn || "—") +
      "</dd></div>" +
      "<div><dt>Market value</dt><dd>" +
      money(p.market) +
      "</dd></div>" +
      "<div><dt>Assessed</dt><dd>" +
      money(p.assessed) +
      "</dd></div>" +
      "<div><dt>Last sale</dt><dd>" +
      esc(fmtDate(p.saleDate)) +
      (p.salePrice ? " · " + money(p.salePrice) : "") +
      "</dd></div>" +
      "<div><dt>Homestead</dt><dd>" +
      esc(p.homestead || "—") +
      "</dd></div>" +
      "</dl>" +
      '<p class="pi-note">Current PA GIS owner — not a full deed chain. Confirm on the clerk Official Records and <a href="' +
      esc(p.paUrl || "#") +
      '" target="_blank" rel="noopener">property appraiser</a>.</p>'
    );
  }

  function renderZoning(z) {
    if (!z) {
      return '<p class="pi-empty">No unincorporated PBC zoning polygon hit this point (may be inside a municipality with its own code).</p>';
    }
    return (
      '<dl class="pi-dl">' +
      "<div><dt>District</dt><dd>" +
      esc(z.FNAME || "—") +
      "</dd></div>" +
      "<div><dt>Code</dt><dd>" +
      esc(z.FCODE || "—") +
      "</dd></div>" +
      "<div><dt>Category</dt><dd>" +
      esc(z.ZONING_DESC || "—") +
      "</dd></div>" +
      "<div><dt>Map last changed</dt><dd>" +
      esc(fmtDate(z.DT_CHG)) +
      "</dd></div>" +
      "</dl>" +
      '<p class="pi-note">Live from Palm Beach County PZB zoning GIS. Municipal parcels may use city zoning instead.</p>'
    );
  }

  function renderInsurance(p) {
    var q = encodeURIComponent(p.address || p.pcn || "Palm Beach County FL");
    return (
      '<p>Carrier premium “shifts” are not a free public feed. Use flood determination tools first, then quote carriers.</p>' +
      '<div class="pi-actions">' +
      '<a class="ds-btn ds-btn-secondary" href="https://msc.fema.gov/portal/search?AddressSearch=' +
      q +
      '" target="_blank" rel="noopener">Open FEMA MSC map</a>' +
      '<a class="ds-btn ds-btn-secondary" href="https://www.floodsmart.gov/" target="_blank" rel="noopener">FloodSmart.gov</a>' +
      "</div>" +
      '<p class="pi-note">Coming soon on DeedScout: in-app FEMA flood zone (SFHA) stamp per parcel. Until then, MSC is the authoritative public map.</p>'
    );
  }

  function renderRentPanel(p) {
    return (
      '<p>Long-term rent estimate + nearby rental comps via RentCast (uses one Pro AVM credit).</p>' +
      '<div class="pi-rent-form">' +
      '<label>Bedrooms <input id="rent-beds" type="number" min="0" max="12" step="1" placeholder="optional" /></label>' +
      '<label>Baths <input id="rent-baths" type="number" min="0" max="12" step="0.5" placeholder="optional" /></label>' +
      '<label>Living sqft <input id="rent-sqft" type="number" min="0" step="1" placeholder="optional" /></label>' +
      "</div>" +
      '<div class="pi-actions">' +
      '<button type="button" class="ds-btn ds-btn-primary" id="rent-run">Estimate rent (Pro)</button>' +
      '<a class="ds-btn ds-btn-secondary" href="pricing.html">View Pro</a>' +
      "</div>" +
      '<div id="rent-result" class="pi-rent-result"></div>' +
      '<p class="pi-note">Estimates only — verify with local property managers and active listings.</p>'
    );
  }

  function matchPermits(permitsPayload, parcel) {
    var pcn = String(parcel.pcn || "").replace(/[-\s]/g, "");
    var addr = String(parcel.address || "").toUpperCase();
    var street = addr.split(",")[0] || "";
    var hits = [];
    (permitsPayload.permits || []).forEach(function (row) {
      var rpcn = String(row.parcelId || "").replace(/[-\s]/g, "");
      var rad = String(row.address || "").toUpperCase();
      if (pcn && rpcn && (rpcn === pcn || rpcn.indexOf(pcn) >= 0 || pcn.indexOf(rpcn) >= 0)) {
        hits.push(row);
        return;
      }
      if (street.length > 8 && rad.indexOf(street.slice(0, 12)) >= 0) hits.push(row);
    });
    return hits.slice(0, 12);
  }

  function renderPermits(hits, permitsPayload) {
    var head =
      badge("cached") +
      ' <span class="pi-inline-meta">Cached municipal scrapes · pool ' +
      esc(String(permitsPayload.poolSize || permitsPayload.count || "")) +
      "</span>";
    if (!hits.length) {
      return (
        head +
        '<p class="pi-empty">No recent cached permits matched this parcel in WPB / Boca / Jupiter / St. Lucie. Browse the full <a href="permit-search.html">Permit Search</a>.</p>'
      );
    }
    var list = hits
      .map(function (h) {
        return (
          "<li><strong>" +
          esc(h.type || "Permit") +
          "</strong> · " +
          esc(h.status || "") +
          "<br /><span class=\"pi-meta\">" +
          esc(h.date || "") +
          " · " +
          esc(h.source) +
          (h.permitNumber ? " · #" + esc(h.permitNumber) : "") +
          "</span></li>"
        );
      })
      .join("");
    return head + "<ul class=\"pi-list\">" + list + "</ul>";
  }

  function salesByCounty(sales) {
    return (sales && sales.sales) || {};
  }

  function renderTax(sales, parcel) {
    var byCounty = salesByCounty(sales);
    var name = parcel.countyName || "";
    var rows = byCounty[name] || byCounty[name.replace("-", " ")] || [];
    if (!rows.length) {
      // fuzzy: "Palm Beach" etc.
      Object.keys(byCounty).forEach(function (k) {
        if (k.toLowerCase() === name.toLowerCase()) rows = byCounty[k];
      });
    }

    var html =
      badge("cached") +
      ' <span class="pi-inline-meta">Auction-stage signal from tax deed calendars — not a full early-delinquency certificate list.</span>';

    if (!rows.length) {
      return (
        html +
        '<p class="pi-empty">No upcoming scraped sale dates for ' +
        esc(name || "this county") +
        '. Open <a href="tax-deeds.html">Tax Deeds</a> and confirm on the clerk / auction site.</p>' +
        '<p class="pi-note">Early tax-certificate / collector delinquency lists are Coming Soon.</p>'
      );
    }

    var list = rows
      .slice(0, 8)
      .map(function (s) {
        var link = s.officialUrl
          ? ' · <a href="' + esc(s.officialUrl) + '" target="_blank" rel="noopener">Official</a>'
          : "";
        return (
          "<li><strong>" +
          esc(fmtDate(s.date || s.saleDate)) +
          "</strong> · " +
          esc(String(s.count != null ? s.count : "—")) +
          " parcels · " +
          esc(s.source || "") +
          link +
          "</li>"
        );
      })
      .join("");
    return (
      html +
      '<ul class="pi-list">' +
      list +
      "</ul>" +
      '<p class="pi-note">Early tax-certificate / collector delinquency lists are <strong>Coming Soon</strong>. Today we surface auction-stage calendars only.</p>'
    );
  }

  async function runRent(parcel) {
    var out = $("rent-result");
    setStatus(out, "<em>Requesting RentCast rent estimate…</em>");
    var token = null;
    try {
      if (window.supabase && window.__dsSupabase) {
        var session = await window.__dsSupabase.auth.getSession();
        token = session?.data?.session?.access_token;
      }
    } catch (e) {
      /* ignore */
    }
    // tax-deeds stores session differently; try localStorage supabase token patterns
    if (!token) {
      try {
        var keys = Object.keys(localStorage);
        for (var i = 0; i < keys.length; i++) {
          if (keys[i].indexOf("sb-") === 0 && keys[i].indexOf("auth-token") >= 0) {
            var raw = JSON.parse(localStorage.getItem(keys[i]));
            token = raw?.access_token || raw?.currentSession?.access_token;
            if (token) break;
          }
        }
      } catch (e2) {
        /* ignore */
      }
    }
    if (!token) {
      setStatus(
        out,
        '<p class="pi-empty">Sign in with Pro on <a href="tax-deeds.html">Tax Deeds</a> / Account, then return here to spend an AVM credit on rent comps.</p>'
      );
      return;
    }

    var body = {
      accessToken: token,
      parcelId: parcel.pcn,
      countySlug: parcel.countySlug,
      address: parcel.address,
      bedrooms: $("rent-beds")?.value || null,
      bathrooms: $("rent-baths")?.value || null,
      livingSqft: $("rent-sqft")?.value || null,
    };
    ["bedrooms", "bathrooms", "livingSqft"].forEach(function (k) {
      if (body[k] === "" || body[k] == null) delete body[k];
      else body[k] = Number(body[k]);
    });

    try {
      var res = await fetch("/api/rent-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      var data = await res.json();
      if (!res.ok) {
        setStatus(
          out,
          '<p class="pi-empty">' +
            esc(data.message || data.error || "Rent lookup failed") +
            "</p>"
        );
        return;
      }
      var r = data.rent || {};
      var comps = (r.comparables || [])
        .map(function (c) {
          return (
            "<li>" +
            esc(c.address || "") +
            " · " +
            money(c.rent) +
            (c.distance != null ? " · " + esc(String(c.distance)) + " mi" : "") +
            "</li>"
          );
        })
        .join("");
      setStatus(
        out,
        "<p><strong>Est. rent " +
          money(r.rent) +
          "</strong> (range " +
          money(r.rentLow) +
          " – " +
          money(r.rentHigh) +
          ")</p>" +
          (comps ? '<ul class="pi-list">' + comps + "</ul>" : "") +
          '<p class="pi-meta">Credits left: ' +
          esc(String(data.creditsRemaining)) +
          (data.cached ? " · cached" : "") +
          "</p>"
      );
    } catch (err) {
      setStatus(out, '<p class="pi-empty">' + esc(err.message || err) + "</p>");
    }
  }

  var selected = null;
  var permitsPayload = { permits: [] };
  var salesPayload = {};

  async function selectParcel(parcel) {
    selected = parcel;
    $("pi-selected").textContent = (parcel.address || parcel.pcn) + " · " + parcel.countyName;
    setStatus($("panel-ownership"), renderOwnership(parcel));
    setStatus($("panel-insurance"), renderInsurance(parcel));
    setStatus($("panel-rent"), renderRentPanel(parcel));
    setStatus($("panel-permits"), renderPermits(matchPermits(permitsPayload, parcel), permitsPayload));
    setStatus($("panel-tax"), renderTax(salesPayload, parcel));

    var zEl = $("panel-zoning");
    setStatus(zEl, "<em>Querying PZB zoning…</em>");
    if (parcel.centroid) {
      try {
        var z = await lookupZoning(parcel.centroid.lon, parcel.centroid.lat);
        setStatus(zEl, renderZoning(z));
      } catch (err) {
        setStatus(zEl, '<p class="pi-empty">Zoning lookup failed: ' + esc(err.message) + "</p>");
      }
    } else {
      setStatus(zEl, '<p class="pi-empty">No parcel geometry returned for zoning intersect.</p>');
    }

    var rentBtn = $("rent-run");
    if (rentBtn) {
      rentBtn.onclick = function () {
        runRent(parcel);
      };
    }
  }

  async function onSearch(e) {
    e.preventDefault();
    var county = $("pi-county").value;
    var mode = $("pi-mode").value;
    var q = $("pi-query").value;
    var box = $("pi-results");
    setStatus(box, "<em>Searching live GIS…</em>");
    try {
      var parcels = await lookupParcel(county, mode, q);
      setStatus(box, renderParcelCards(parcels));
      box.querySelectorAll(".pi-parcel").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = Number(btn.getAttribute("data-idx"));
          selectParcel(parcels[idx]);
          box.querySelectorAll(".pi-parcel").forEach(function (b) {
            b.classList.toggle("is-active", b === btn);
          });
        });
      });
      if (parcels.length === 1) {
        selectParcel(parcels[0]);
        var first = box.querySelector(".pi-parcel");
        if (first) first.classList.add("is-active");
      }
    } catch (err) {
      setStatus(box, '<p class="pi-empty">' + esc(err.message || err) + "</p>");
    }
  }

  async function initFeeds() {
    try {
      var zoning = await recentZoningUpdates();
      var html = zoning
        .map(function (z) {
          return (
            "<li><strong>" +
            esc(z.FCODE || "") +
            "</strong> " +
            esc(z.FNAME || "") +
            '<br /><span class="pi-meta">Map updated ' +
            esc(fmtDate(z.DT_CHG)) +
            "</span></li>"
          );
        })
        .join("");
      setStatus(
        $("feed-zoning"),
        badge("live") + " Recent PBC zoning map edits<ul class=\"pi-list\">" + html + "</ul>"
      );
    } catch (err) {
      setStatus($("feed-zoning"), '<p class="pi-empty">Could not load zoning feed: ' + esc(err.message) + "</p>");
    }

    try {
      permitsPayload = await loadJson(PERMITS_URL);
      var recent = (permitsPayload.permits || []).slice(0, 10);
      var list = recent
        .map(function (h) {
          return (
            "<li><strong>" +
            esc(h.type || "Permit") +
            "</strong> · " +
            esc(h.source) +
            "<br /><span class=\"pi-meta\">" +
            esc(h.date || "") +
            " · " +
            esc(h.address || h.parcelId || "") +
            "</span></li>"
          );
        })
        .join("");
      setStatus(
        $("feed-permits"),
        badge("cached") +
          " Newest cached permits<ul class=\"pi-list\">" +
          list +
          '</ul><p class="pi-note"><a href="permit-search.html">Open full Permit Search →</a></p>'
      );
    } catch (err) {
      setStatus($("feed-permits"), '<p class="pi-empty">Permit feed unavailable.</p>');
    }

    try {
      salesPayload = await loadJson(SALES_URL);
      var byCounty = salesByCounty(salesPayload);
      var entries = [];
      Object.keys(byCounty).forEach(function (county) {
        (byCounty[county] || []).forEach(function (s) {
          entries.push({
            county: county,
            saleDate: s.date,
            parcels: s.count,
            source: s.source,
            url: s.officialUrl,
          });
        });
      });
      entries.sort(function (a, b) {
        return String(a.saleDate || "").localeCompare(String(b.saleDate || ""));
      });
      var today = new Date().toISOString().slice(0, 10);
      entries = entries.filter(function (e) {
        return !e.saleDate || e.saleDate >= today;
      });
      var list2 = entries
        .slice(0, 12)
        .map(function (s) {
          return (
            "<li><strong>" +
            esc(s.county) +
            "</strong> · " +
            esc(fmtDate(s.saleDate)) +
            (s.parcels != null ? " · " + esc(String(s.parcels)) + " parcels" : "") +
            "</li>"
          );
        })
        .join("");
      setStatus(
        $("feed-tax"),
        badge("cached") +
          ' Upcoming tax deed sale dates<ul class="pi-list">' +
          (list2 || "<li>No future dates in current sales.json</li>") +
          '</ul><p class="pi-note"><a href="tax-deeds.html">Open Tax Deeds →</a></p>'
      );
    } catch (err) {
      setStatus($("feed-tax"), '<p class="pi-empty">Sales calendar unavailable.</p>');
    }

    try {
      var catalog = await loadJson(CATALOG_URL);
      var cards = (catalog.signals || [])
        .map(function (s) {
          return (
            '<div class="pi-signal">' +
            badge(s.status) +
            "<h3>" +
            esc(s.name) +
            "</h3>" +
            "<p>" +
            esc(s.coverage) +
            "</p>" +
            '<p class="pi-meta">' +
            esc(s.verification) +
            "</p>" +
            "</div>"
          );
        })
        .join("");
      setStatus($("signal-catalog"), cards);
    } catch (err) {
      /* non-fatal */
    }
  }

  function init() {
    var form = $("pi-search");
    if (form) form.addEventListener("submit", onSearch);
    initFeeds();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
