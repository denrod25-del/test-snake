/**
 * DeedScout Property Intelligence — parcel signal lookups.
 * Zoning / ownership / flood deep-links / permits feed / tax-deed stage / Pro rent comps.
 */
(function () {
  "use strict";

  var FLOOD_LAYERS_URL = "data/signals/flood-layers.json";
  var ZONING_LAYERS_URL = "data/signals/zoning-layers.json";
  var CERTS_URL = "data/signals/pbc-county-held-certs.json";
  var CATALOG_URL = "data/signals/catalog.json";
  var SALES_URL = "sales.json";
  var CLERK_OR_URL = "https://erec.mypalmbeachclerk.com/";
  var TAX_COLLECTOR_CERTS_PAGE =
    "https://www.pbctax.gov/taxes/property-tax/tax-certificates-and-deeds/";
  var REGISTRY_URL = "data/parcels/registry.json";
  var PERMITS_URL = "data/signals/recent-permits.json";
  var ALERTS_STORAGE_KEY = "deedscout_pi_signal_alerts_v1";

  var registry = null;
  var $ = function (id) {
    return document.getElementById(id);
  };

  /** Create/reuse Supabase client so signed-in sessions on this origin can sync watches. */
  function ensureSupabaseClient() {
    if (window.__dsSupabase) return window.__dsSupabase;
    if (window.__dsSb) {
      window.__dsSupabase = window.__dsSb;
      return window.__dsSupabase;
    }
    var cfg = window.FTDR_CONFIG || {};
    if (
      !window.supabase ||
      !cfg.AUTH_ENABLED ||
      !cfg.SUPABASE_URL ||
      cfg.SUPABASE_URL.indexOf("YOUR-PROJECT") >= 0 ||
      !cfg.SUPABASE_ANON_KEY
    ) {
      return null;
    }
    var client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    window.__dsSupabase = client;
    window.__dsSb = client;
    return client;
  }

  async function getSignedInUser() {
    var sb = ensureSupabaseClient();
    if (!sb) return null;
    try {
      var res = await sb.auth.getSession();
      var session = res && res.data && res.data.session;
      if (session && session.user) return session.user;
    } catch (e) {
      /* ignore */
    }
    return null;
  }

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

  async function arcgisQuery(endpoint, params, timeoutMs) {
    var q = new URLSearchParams(params);
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = null;
    var ms = timeoutMs == null ? 20000 : timeoutMs;
    try {
      if (ctrl) timer = setTimeout(function () { ctrl.abort(); }, ms);
      var res = await fetch(endpoint + "?" + q.toString(), ctrl ? { signal: ctrl.signal } : undefined);
      if (!res.ok) throw new Error("ArcGIS " + res.status);
      var data = await res.json();
      if (data.error) throw new Error(data.error.message || "ArcGIS error");
      return data;
    } catch (err) {
      if (err && err.name === "AbortError") throw new Error("GIS request timed out");
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function pick(attrs, keys) {
    if (!attrs || !keys) return null;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (attrs[k] != null && String(attrs[k]).trim() !== "") {
        return typeof attrs[k] === "string" ? String(attrs[k]).trim() : attrs[k];
      }
      // case-insensitive fallback for Hosted layers with mixed case
      var lower = String(k).toLowerCase();
      for (var ak in attrs) {
        if (
          ak.toLowerCase() === lower &&
          attrs[ak] != null &&
          String(attrs[ak]).trim() !== ""
        ) {
          return typeof attrs[ak] === "string" ? String(attrs[ak]).trim() : attrs[ak];
        }
      }
    }
    return null;
  }

  function buildAddress(attrs, map) {
    var addr = null;
    if (map.addressParts && map.addressParts.length) {
      addr = map.addressParts
        .map(function (k) {
          return pick(attrs, [k]);
        })
        .filter(Boolean)
        .join(" ");
    }
    if (!addr) addr = pick(attrs, map.address || []);
    var city = pick(attrs, map.city || []);
    var zip = pick(attrs, map.zip || []);
    if (typeof zip === "number") zip = String(Math.round(zip));
    return [addr, city, zip ? "FL " + zip : "FL"].filter(Boolean).join(", ");
  }

  function centroid(geom) {
    if (!geom) return null;
    // Point layers expose x/y in outSR; polygon layers use rings (including FDOR cadastral).
    if (geom.x != null && geom.y != null && !isNaN(Number(geom.x)) && !isNaN(Number(geom.y))) {
      return { lon: Number(geom.x), lat: Number(geom.y) };
    }
    if (!geom.rings || !geom.rings[0] || !geom.rings[0].length) return null;
    var ring = geom.rings[0];
    var xs = 0;
    var ys = 0;
    for (var i = 0; i < ring.length; i++) {
      xs += ring[i][0];
      ys += ring[i][1];
    }
    return { lon: xs / ring.length, lat: ys / ring.length };
  }

  function composeSaleDate(attrs, map) {
    var direct = pick(attrs, map.saleDate || []);
    if (direct) return direct;
    var y = pick(attrs, map.saleYear || []);
    if (!y) return null;
    var m = pick(attrs, map.saleMonth || []);
    var mm = m != null && String(m).trim() !== "" ? String(m).trim() : "01";
    if (mm.length === 1) mm = "0" + mm;
    return String(y) + "-" + mm + "-01";
  }

  function mergeEnrichParcel(base, extra) {
    if (!extra) return base;
    ["owner", "address", "market", "assessed", "saleDate", "salePrice", "homestead", "yearBuilt"].forEach(
      function (k) {
        if ((base[k] == null || base[k] === "") && extra[k] != null && extra[k] !== "") {
          base[k] = extra[k];
        }
      }
    );
    base.raw = Object.assign({}, base.raw || {}, extra.raw || {});
    return base;
  }

  async function enrichParcels(county, parcels) {
    var cfg = county && county.enrich;
    if (!cfg || !cfg.endpoint || !parcels.length) return parcels;
    var matchField = cfg.matchField;
    if (!matchField) return parcels;
    var ids = [];
    parcels.forEach(function (p) {
      if (p.pcn && ids.indexOf(p.pcn) < 0) ids.push(p.pcn);
    });
    if (!ids.length) return parcels;
    var where = ids
      .map(function (id) {
        return matchField + "='" + String(id).replace(/'/g, "''") + "'";
      })
      .join(" OR ");
    var params = {
      where: where,
      outFields: (cfg.outFields || ["*"]).join(","),
      returnGeometry: "false",
      f: "json",
    };
    if (cfg.supportsPagination !== false) {
      params.resultRecordCount = String(Math.max(ids.length, 8));
    }
    try {
      var data = await arcgisQuery(cfg.endpoint, params, 12000);
      var map = cfg.map || {};
      var byId = {};
      (data.features || []).forEach(function (f) {
        var a = f.attributes || {};
        var pcn = pick(a, map.pcn || []);
        if (!pcn) return;
        byId[String(pcn)] = {
          owner: pick(a, map.owner || []) || "",
          address: buildAddress(a, map),
          market: pick(a, map.market || []),
          assessed: pick(a, map.assessed || []),
          yearBuilt: pick(a, map.yearBuilt || []),
          raw: a,
        };
      });
      parcels.forEach(function (p) {
        mergeEnrichParcel(p, byId[String(p.pcn || "")]);
      });
    } catch (e) {
      /* keep FOLIO-only — enrich is best-effort */
    }
    return parcels;
  }

  async function lookupParcel(countySlug, mode, query) {
    if (!registry) registry = await loadJson(REGISTRY_URL);
    var county = registry.counties[countySlug];
    if (!county || (county.status !== "live" && county.status !== "cached")) {
      throw new Error("County GIS is not live yet.");
    }
    var where;
    var q = String(query || "").trim();
    if (!q) throw new Error("Enter a PCN, owner, or address.");

    if (mode === "pcn") {
      var cleaned = q.replace(/[^\dA-Za-z]/g, "").toUpperCase();
      var raw = q.trim();
      var idFields = (county.idFields && county.idFields.length ? county.idFields : ["PCN"]).slice();
      var formatted = null;
      if (county.idFormat) {
        var pattern = county.idFormat;
        var out = "";
        var di = 0;
        var okFmt = true;
        for (var pi = 0; pi < pattern.length; pi++) {
          if (pattern.charAt(pi) === "#") {
            if (di >= cleaned.length) {
              okFmt = false;
              break;
            }
            out += cleaned.charAt(di++);
          } else {
            out += pattern.charAt(pi);
          }
        }
        if (okFmt && di === cleaned.length) formatted = out;
      }
      var candidates = [];
      function pushCand(v) {
        if (!v) return;
        if (candidates.indexOf(v) < 0) candidates.push(v);
      }
      pushCand(cleaned);
      pushCand(raw);
      pushCand(formatted);
      var parts = [];
      idFields.forEach(function (f) {
        candidates.forEach(function (cand) {
          parts.push(f + "='" + String(cand).replace(/'/g, "''") + "'");
        });
      });
      where = parts.join(" OR ");
    } else if (mode === "owner") {
      var ownerField = (county.map.owner && county.map.owner[0]) || "OWNER_NAME1";
      where = "UPPER(" + ownerField + ") LIKE '%" + q.toUpperCase().replace(/'/g, "''") + "%'";
    } else {
      var addrField = (county.map.address && county.map.address[0]) || "SITE_ADDR_STR";
      where = "UPPER(" + addrField + ") LIKE '%" + q.toUpperCase().replace(/'/g, "''") + "%'";
    }

    if (county.extraWhere) {
      where = "(" + where + ") AND (" + county.extraWhere + ")";
    }

    var queryParams = {
      where: where,
      outFields: (county.outFields || ["*"]).join(","),
      returnGeometry: "true",
      outSR: "4326",
      f: "json",
    };
    if (county.supportsPagination !== false) {
      queryParams.resultRecordCount = "8";
    }

    var data = await arcgisQuery(county.endpoint, queryParams);
    var features = data.features || [];
    var parcels = features.map(function (f) {
      var a = f.attributes || {};
      var map = county.map || {};
      return {
        countySlug: countySlug,
        countyName: county.name,
        paUrl: county.paUrl,
        dataStatus: county.status || "live",
        sourceNote: county.note || "",
        pcn: pick(a, map.pcn || county.idFields || []),
        parid: pick(a, ["PARID", "PARCEL_NUMBER", "PCN"]),
        owner: [pick(a, map.owner || []), pick(a, ["OWNER_NAME2"])].filter(Boolean).join(" "),
        address: buildAddress(a, map),
        market: pick(a, map.market || []),
        assessed: pick(a, map.assessed || []),
        saleDate: composeSaleDate(a, map),
        salePrice: pick(a, map.salePrice || []),
        homestead: pick(a, map.homestead || []),
        yearBuilt: pick(a, map.yearBuilt || ["YRBLT", "YEAR_BUILT"]),
        deedBook: pick(a, map.deedBook || ["BOOK"]),
        deedPage: pick(a, map.deedPage || ["PAGE"]),
        saleKey: pick(a, map.saleKey || ["SALEKEY"]),
        monthsSinceSale: pick(a, map.monthsSinceSale || ["MONTHS_SINCE_SALE"]),
        legal: pick(a, ["LEGAL1", "LEGAL"]),
        centroid: centroid(f.geometry),
        raw: a,
      };
    });
    return enrichParcels(county, parcels);
  }

  async function lookupZoning(lon, lat, countySlug, parcel) {
    if (!zoningConfig) {
      try {
        zoningConfig = await loadJson(ZONING_LAYERS_URL);
      } catch (e) {
        zoningConfig = { layers: {}, parcelAttrFallback: {} };
      }
    }
    var layer = (zoningConfig.layers || {})[countySlug];
    if (layer && layer.status === "live" && layer.endpoint && lon != null && lat != null) {
      var data = await arcgisQuery(layer.endpoint, {
        geometry: lon + "," + lat,
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: layer.outFields || "*",
        returnGeometry: "false",
        f: "json",
      });
      var f = (data.features || [])[0];
      if (f) {
        var a = f.attributes || {};
        var map = layer.map || {};
        return {
          attrs: {
            FNAME: pick(a, map.name || ["FNAME", "ZONING"]),
            FCODE: pick(a, map.code || ["FCODE", "ZONING"]),
            ZONING_DESC: pick(a, map.desc || ["ZONING_DESC", "ZONING_DETAILS"]),
            DT_CHG: pick(a, map.changed || ["DT_CHG"]),
          },
          meta: layer,
          source: "gis",
          raw: a,
        };
      }
      // No polygon hit — try parcel-attribute fallback below when configured.
    }
    var fallback = (zoningConfig.parcelAttrFallback || {})[countySlug];
    if (fallback && fallback.status === "live" && parcel && parcel.raw) {
      var fmap = fallback.map || {};
      var code = pick(parcel.raw, fmap.code || []);
      var name = pick(parcel.raw, fmap.name || []);
      var desc = pick(parcel.raw, fmap.desc || []);
      if (code || name || desc) {
        return {
          attrs: {
            FNAME: name || code || null,
            FCODE: code || null,
            ZONING_DESC: desc || null,
            DT_CHG: null,
          },
          meta: fallback,
          source: "parcel-attrs",
        };
      }
      return { attrs: null, meta: fallback || layer || null, source: "parcel-attrs" };
    }
    return { attrs: null, meta: layer || fallback || null, source: null };
  }

  async function recentZoningUpdates() {
    if (!zoningConfig) {
      try {
        zoningConfig = await loadJson(ZONING_LAYERS_URL);
      } catch (e) {
        zoningConfig = { layers: {} };
      }
    }
    var layer = (zoningConfig.layers || {})["palm-beach"];
    var endpoint =
      (layer && layer.endpoint) ||
      "https://maps.co.palm-beach.fl.us/arcgis/rest/services/OpenData/Planning_Open_Data/MapServer/9/query";
    var data = await arcgisQuery(endpoint, {
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

  async function lookupFlood(lon, lat, countySlug) {
    if (!floodConfig) {
      try {
        floodConfig = await loadJson(FLOOD_LAYERS_URL);
      } catch (e) {
        floodConfig = { layers: {} };
      }
    }
    var layers = floodConfig.layers || {};
    var layer = layers[countySlug];
    var usedDefault = false;
    if (!layer || layer.status !== "live" || !layer.endpoint) {
      layer = floodConfig.defaultLayer || null;
      usedDefault = !!layer;
    }
    if (!layer || layer.status !== "live" || !layer.endpoint) {
      return { attrs: null, meta: layer || null };
    }
    var meta = layer;
    if (usedDefault) {
      meta = Object.assign({}, layer, {
        label:
          (layer.label || "FEMA NFHL Flood Hazard Zones") +
          (countySlug ? " (" + countySlug + ")" : ""),
      });
    }
    var data = await arcgisQuery(layer.endpoint, {
      geometry: lon + "," + lat,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: layer.outFields || "*",
      returnGeometry: "false",
      f: "json",
    });
    var f = (data.features || [])[0];
    if (!f) return { attrs: null, meta: meta };
    var a = f.attributes || {};
    var map = layer.map || {};
    return {
      attrs: {
        FLD_ZONE: pick(a, map.zone || ["FLD_ZONE", "FZONE"]),
        ZONE_SUBTY: pick(a, map.subtype || ["ZONE_SUBTY", "ZONESUBTY"]),
        SFHA_TF: pick(a, map.sfha || ["SFHA_TF"]),
        STATIC_BFE: pick(a, map.bfe || ["STATIC_BFE", "ELEV"]),
        DEPTH: pick(a, map.depth || ["DEPTH"]),
        DFIRM_ID: pick(a, map.firmId || ["DFIRM_ID"]),
      },
      meta: meta,
      raw: a,
    };
  }

  function digitsOnly(s) {
    return String(s || "").replace(/\D/g, "");
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
    var deedBits = "";
    if (p.deedBook || p.deedPage) {
      deedBits =
        "<div><dt>Deed book/page</dt><dd>" +
        esc(p.deedBook || "—") +
        " / " +
        esc(p.deedPage || "—") +
        "</dd></div>";
    }
    if (p.monthsSinceSale != null && p.monthsSinceSale !== "") {
      deedBits +=
        "<div><dt>Months since sale</dt><dd>" +
        esc(String(p.monthsSinceSale)) +
        "</dd></div>";
    }
    var trust =
      p.dataStatus === "cached"
        ? badge("cached") +
          '<p class="pi-note">FDOR annual statewide cadastral snapshot (parcel polygons) — not live county PA GIS. Confirm on the Property Appraiser site.</p>'
        : badge("live");
    var note =
      p.dataStatus === "cached"
        ? "Cached FDOR DOR snapshot owner / JV / last-sale fields (polygon geometry). Not a full multi-deed chain — search Official Records and confirm on the county PA."
        : "Current PA GIS owner + last-sale pointer (book/page when exposed). Not a full multi-deed chain — search Official Records for prior conveyances.";
    return (
      trust +
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
      deedBits +
      "<div><dt>Homestead</dt><dd>" +
      esc(p.homestead || "—") +
      "</dd></div>" +
      "</dl>" +
      '<div class="pi-actions">' +
      '<a class="ds-btn ds-btn-secondary" href="' +
      esc(p.paUrl || "#") +
      '" target="_blank" rel="noopener">Property Appraiser</a>' +
      '<a class="ds-btn ds-btn-secondary" href="' +
      CLERK_OR_URL +
      '" target="_blank" rel="noopener">Clerk Official Records</a>' +
      "</div>" +
      '<p class="pi-note">' +
      note +
      "</p>"
    );
  }

  function renderZoning(result) {
    var z = result && result.attrs;
    var meta = result && result.meta;
    var source = result && result.source;
    if (!z || (!z.FNAME && !z.FCODE && !z.ZONING_DESC)) {
      if (meta && meta.status === "live") {
        return (
          badge("cached") +
          '<p class="pi-empty">No zoning stamp hit this point in ' +
          esc(meta.label || "county zoning") +
          ". Confirm on the county planning / PA map.</p>"
        );
      }
      return (
        badge("coming-soon") +
        '<p class="pi-empty">In-app zoning is live for Palm Beach, Martin, Lee, Hillsborough, Pasco, Bay, Pinellas, Volusia, Miami-Dade, and Polk FLU (GIS) plus Charlotte, Manatee, Orange, Sarasota, and Duval (PA parcel attributes). Use the county planning site for ' +
        esc((meta && meta.name) || "other counties") +
        ".</p>"
      );
    }
    var note =
      source === "parcel-attrs"
        ? "Live from parcel-layer attributes (" +
          esc((meta && meta.label) || "PA fields") +
          "). Not a separate zoning-map intersect — confirm on planning / PA."
        : "Live from " +
          esc((meta && meta.label) || "county zoning GIS") +
          ". " +
          esc((meta && meta.note) || "Confirm on official planning maps.");
    return (
      badge("live") +
      ' <span class="pi-inline-meta">' +
      esc((meta && meta.label) || "Zoning") +
      "</span>" +
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
      (z.DT_CHG
        ? "<div><dt>Map last changed</dt><dd>" + esc(fmtDate(z.DT_CHG)) + "</dd></div>"
        : "") +
      "</dl>" +
      '<p class="pi-note">' +
      note +
      "</p>"
    );
  }

  function renderInsurance(p, floodResult) {
    var q = encodeURIComponent(p.address || p.pcn || "Florida");
    var flood = floodResult && floodResult.attrs;
    var meta = floodResult && floodResult.meta;
    var body = "";
    if (flood && flood.FLD_ZONE) {
      var sfhaRaw = String(flood.SFHA_TF || "").toUpperCase();
      var sfha =
        sfhaRaw === "T"
          ? "Yes — Special Flood Hazard Area"
          : sfhaRaw === "F"
            ? "No — outside SFHA on this layer"
            : sfhaRaw
              ? esc(flood.SFHA_TF)
              : "See zone code (SFHA flag not on this layer)";
      var bfe =
        flood.STATIC_BFE != null && Number(flood.STATIC_BFE) > -9000
          ? String(flood.STATIC_BFE)
          : "—";
      body =
        badge("live") +
        ' <span class="pi-inline-meta">' +
        esc((meta && meta.label) || "County flood GIS") +
        "</span>" +
        '<dl class="pi-dl">' +
        "<div><dt>Flood zone</dt><dd>" +
        esc(flood.FLD_ZONE || "—") +
        "</dd></div>" +
        "<div><dt>Subtype</dt><dd>" +
        esc(flood.ZONE_SUBTY || "—") +
        "</dd></div>" +
        "<div><dt>SFHA</dt><dd>" +
        sfha +
        "</dd></div>" +
        "<div><dt>BFE / elev</dt><dd>" +
        esc(bfe) +
        "</dd></div>" +
        (flood.DFIRM_ID
          ? "<div><dt>FIRM id</dt><dd>" + esc(flood.DFIRM_ID) + "</dd></div>"
          : "") +
        "</dl>";
    } else if (meta && meta.status === "live") {
      body =
        badge("cached") +
        '<p class="pi-empty">No flood polygon hit this point in ' +
        esc(meta.label || "county GIS") +
        ". Use FEMA MSC for the effective determination.</p>";
    } else {
      body =
        badge("coming-soon") +
        '<p class="pi-empty">In-app flood GIS is not wired for ' +
        esc(p.countyName || "this county") +
        " yet. Parcel-wired counties use county GIS or FEMA NFHL; others fall back to FEMA MSC deep-links.</p>";
    }
    return (
      body +
      '<div class="pi-actions">' +
      '<a class="ds-btn ds-btn-secondary" href="https://msc.fema.gov/portal/search?AddressSearch=' +
      q +
      '" target="_blank" rel="noopener">Open FEMA MSC map</a>' +
      '<a class="ds-btn ds-btn-secondary" href="https://www.floodsmart.gov/" target="_blank" rel="noopener">FloodSmart.gov</a>' +
      "</div>" +
      '<p class="pi-note">Flood zone ≠ insurance quote. Carrier premium rate-shift feeds are still Coming Soon. Verify on MSC before underwriting.</p>'
    );
  }

  function matchCerts(certsPayload, parcel) {
    var candidates = [
      digitsOnly(parcel.pcn),
      digitsOnly(parcel.parid),
    ].filter(Boolean);
    // also dashed PIN variants without leading zeros mismatch: keep unique
    var uniq = [];
    candidates.forEach(function (c) {
      if (uniq.indexOf(c) < 0) uniq.push(c);
    });
    if (!uniq.length) return [];
    var hits = [];
    (certsPayload.certificates || []).forEach(function (c) {
      var pin = c.pinDigits || digitsOnly(c.pin);
      if (!pin) return;
      for (var i = 0; i < uniq.length; i++) {
        var pcn = uniq[i];
        if (pin === pcn || pin.indexOf(pcn) >= 0 || pcn.indexOf(pin) >= 0) {
          hits.push(c);
          return;
        }
      }
    });
    return hits;
  }

  function renderTax(sales, parcel, certHits, certsPayload) {
    var byCounty = salesByCounty(sales);
    var name = parcel.countyName || "";
    var rows = byCounty[name] || [];
    if (!rows.length) {
      Object.keys(byCounty).forEach(function (k) {
        if (k.toLowerCase() === name.toLowerCase()) rows = byCounty[k];
      });
    }

    var html =
      badge("cached") +
      ' <span class="pi-inline-meta">Auction-stage calendars + PBC county-held certificates where published.</span>';

    var certHtml = "";
    var portals =
      (floodConfig && floodConfig.delinquencyPortals) ||
      {};
    var portal = portals[parcel.countySlug] || null;

    if (parcel.countySlug === "palm-beach") {
      if (certHits && certHits.length) {
        certHtml =
          '<h3 class="pi-subhead">County-held certificate match</h3><ul class="pi-list">' +
          certHits
            .map(function (c) {
              return (
                "<li><strong>Cert #" +
                esc(c.certificateNumber) +
                "</strong> · tax year " +
                esc(String(c.taxYear || "")) +
                " · face " +
                money(c.faceAmount) +
                " · " +
                esc(String(c.interestRate || "")) +
                "% · sold " +
                esc(fmtDate(c.saleDate)) +
                "<br /><span class=\"pi-meta\">PIN " +
                esc(c.pin) +
                "</span></li>"
              );
            })
            .join("") +
          "</ul>";
      } else {
        certHtml =
          '<p class="pi-empty">No county-held certificate PIN matched this PCN in the Tax Collector XLSX (' +
          esc(String((certsPayload && certsPayload.count) || 0)) +
          " rows).</p>";
      }
    }

    if (portal) {
      var links = [];
      if (portal.countyHeldPage) {
        links.push(
          '<a class="ds-btn ds-btn-secondary" href="' +
            esc(portal.countyHeldPage) +
            '" target="_blank" rel="noopener">County-held / certs page</a>'
        );
      }
      if (portal.delinquentListUrl) {
        links.push(
          '<a class="ds-btn ds-btn-secondary" href="' +
            esc(portal.delinquentListUrl) +
            '" target="_blank" rel="noopener">Advertised delinquent list</a>'
        );
      }
      if (portal.delinquentNotices) {
        links.push(
          '<a class="ds-btn ds-btn-secondary" href="' +
            esc(portal.delinquentNotices) +
            '" target="_blank" rel="noopener">Legal notices</a>'
        );
      }
      if (portal.certificateSearch) {
        links.push(
          '<a class="ds-btn ds-btn-secondary" href="' +
            esc(portal.certificateSearch) +
            '" target="_blank" rel="noopener">Certificate search</a>'
        );
      }
      if (portal.lienhub) {
        links.push(
          '<a class="ds-btn ds-btn-secondary" href="' +
            esc(portal.lienhub) +
            '" target="_blank" rel="noopener">LienHub (login)</a>'
        );
      }
      if (portal.sourceUrl || (certsPayload && certsPayload.sourceUrl && parcel.countySlug === "palm-beach")) {
        links.push(
          '<a class="ds-btn ds-btn-secondary" href="' +
            esc((certsPayload && certsPayload.sourceUrl) || portal.sourceUrl) +
            '" target="_blank" rel="noopener">Download county-held XLSX</a>'
        );
      }
      certHtml +=
        '<div class="pi-actions">' +
        links.join("") +
        "</div>" +
        (portal.note ? '<p class="pi-note">' + esc(portal.note) + "</p>" : "");
    }

    if (!rows.length) {
      return (
        html +
        certHtml +
        '<p class="pi-empty">No upcoming scraped sale dates for ' +
        esc(name || "this county") +
        '. Open <a href="tax-deeds.html">Tax Deeds</a>.</p>'
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
      '<h3 class="pi-subhead">Upcoming tax deed dates</h3><ul class="pi-list">' +
      list +
      "</ul>" +
      certHtml +
      '<p class="pi-note">County-held certs are early-stage vs tax deeds, but not the full advertised delinquency newspaper roll. Always confirm with the Tax Collector.</p>'
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

  async function runRent(parcel) {
    var out = $("rent-result");
    setStatus(out, "<em>Requesting RentCast rent estimate…</em>");
    var token = null;
    try {
      var sb = ensureSupabaseClient();
      if (sb) {
        var session = await sb.auth.getSession();
        token = session?.data?.session?.access_token;
      }
    } catch (e) {
      /* ignore */
    }
    // Fallback: read persisted Supabase auth token from localStorage
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
  var certsPayload = { certificates: [], count: 0 };
  var floodConfig = null;
  var zoningConfig = null;

  async function selectParcel(parcel) {
    selected = parcel;
    $("pi-selected").textContent = (parcel.address || parcel.pcn) + " · " + parcel.countyName;
    setStatus($("panel-ownership"), renderOwnership(parcel));
    setStatus($("panel-rent"), renderRentPanel(parcel));
    setStatus($("panel-permits"), renderPermits(matchPermits(permitsPayload, parcel), permitsPayload));
    var certHits = matchCerts(certsPayload, parcel);
    setStatus($("panel-tax"), renderTax(salesPayload, parcel, certHits, certsPayload));

    var zEl = $("panel-zoning");
    var iEl = $("panel-insurance");
    setStatus(zEl, "<em>Querying zoning…</em>");
    setStatus(iEl, "<em>Querying flood zone…</em>");
    if (parcel.centroid) {
      // Run in parallel so a slow zoning call cannot block flood.
      var zoningPromise = lookupZoning(
        parcel.centroid.lon,
        parcel.centroid.lat,
        parcel.countySlug,
        parcel
      )
        .then(function (z) {
          setStatus(zEl, renderZoning(z));
        })
        .catch(function (err) {
          setStatus(zEl, '<p class="pi-empty">Zoning lookup failed: ' + esc(err.message) + "</p>");
        });
      var floodPromise = lookupFlood(
        parcel.centroid.lon,
        parcel.centroid.lat,
        parcel.countySlug
      )
        .then(function (flood) {
          setStatus(iEl, renderInsurance(parcel, flood));
        })
        .catch(function (err2) {
          setStatus(
            iEl,
            renderInsurance(parcel, null) +
              '<p class="pi-empty">Flood GIS error: ' +
              esc(err2.message) +
              "</p>"
          );
        });
      await Promise.all([zoningPromise, floodPromise]);
    } else {
      // Still try Charlotte-style parcel-attr zoning without geometry.
      try {
        var zOnly = await lookupZoning(null, null, parcel.countySlug, parcel);
        setStatus(zEl, renderZoning(zOnly));
      } catch (e) {
        setStatus(zEl, '<p class="pi-empty">No parcel geometry returned for zoning intersect.</p>');
      }
      setStatus(iEl, renderInsurance(parcel, null));
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
      if (!registry) registry = await loadJson(REGISTRY_URL);
    } catch (e) {
      /* optional for digest labels */
    }
    try {
      floodConfig = await loadJson(FLOOD_LAYERS_URL);
    } catch (e) {
      floodConfig = { layers: {}, delinquencyPortals: {} };
    }

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
      certsPayload = await loadJson(CERTS_URL);
      var topCerts = (certsPayload.certificates || []).slice(0, 8);
      var certList = topCerts
        .map(function (c) {
          return (
            "<li><strong>#" +
            esc(c.certificateNumber) +
            "</strong> · " +
            money(c.faceAmount) +
            " · " +
            esc(String(c.interestRate || "")) +
            "% · PIN " +
            esc(c.pin) +
            "</li>"
          );
        })
        .join("");
      var taxFeed = $("feed-tax");
      if (taxFeed) {
        taxFeed.innerHTML +=
          '<div style="margin-top:16px;">' +
          badge("cached") +
          " PBC county-held certificates (" +
          esc(String(certsPayload.count || 0)) +
          ')<ul class="pi-list">' +
          certList +
          '</ul><p class="pi-note"><a href="' +
          TAX_COLLECTOR_CERTS_PAGE +
          '" target="_blank" rel="noopener">Tax Collector source →</a></p></div>';
      }
    } catch (errCert) {
      /* non-fatal */
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

  function readAlertPrefs() {
    try {
      return JSON.parse(localStorage.getItem(ALERTS_STORAGE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function writeAlertPrefs(prefs) {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(prefs));
  }

  function applyAlertPrefs(prefs) {
    if (!prefs) return;
    if (prefs.email && $("alert-email")) $("alert-email").value = prefs.email;
    if (prefs.county && $("alert-county")) $("alert-county").value = prefs.county;
    if (prefs.notes != null && $("alert-notes")) $("alert-notes").value = prefs.notes;
    var form = $("pi-alerts");
    if (!form) return;
    ["watch_zoning", "watch_permits", "watch_tax", "watch_certs", "watch_flood"].forEach(function (name) {
      var el = form.querySelector('input[name="' + name + '"]');
      if (el) el.checked = !!prefs[name];
    });
  }

  function collectAlertPrefs(form) {
    return {
      email: (form.email && form.email.value) || "",
      county: (form.county && form.county.value) || "",
      notes: (form.notes && form.notes.value) || "",
      watch_zoning: !!(form.watch_zoning && form.watch_zoning.checked),
      watch_permits: !!(form.watch_permits && form.watch_permits.checked),
      watch_tax: !!(form.watch_tax && form.watch_tax.checked),
      watch_certs: !!(form.watch_certs && form.watch_certs.checked),
      watch_flood: !!(form.watch_flood && form.watch_flood.checked),
      savedAt: new Date().toISOString(),
    };
  }

  function countyDisplayName(slug) {
    if (!slug || slug === "statewide") return "Statewide";
    if (registry && registry.counties && registry.counties[slug] && registry.counties[slug].name) {
      return registry.counties[slug].name;
    }
    return slug
      .split("-")
      .map(function (p) {
        return p.charAt(0).toUpperCase() + p.slice(1);
      })
      .join(" ");
  }

  function salesCountyKey(slug) {
    var name = countyDisplayName(slug);
    if (slug === "miami-dade") return "Miami-Dade";
    if (slug === "palm-beach") return "Palm Beach";
    return name;
  }

  function permitMatchesCounty(permit, slug) {
    if (!slug || slug === "statewide") return true;
    // Cached permit scrapes are municipal (PBC-area + St. Lucie). Match loosely.
    var src = String(permit.source || "").toLowerCase();
    var addr = String(permit.address || "").toLowerCase();
    if (slug === "palm-beach") {
      return /west-palm|wpb|boca|jupiter|palm.?beach/.test(src) || /palm beach|west palm|boca|jupiter/.test(addr);
    }
    if (slug === "martin" || slug === "st-lucie") {
      return /st.?lucie|stuart|port st/.test(src + " " + addr);
    }
    return false;
  }

  function renderWatchDigest(prefs) {
    var host = $("watch-digest");
    if (!host) return;
    if (!prefs || !prefs.email) {
      setStatus(
        host,
        badge("coming-soon") +
          '<p class="pi-empty">Save watch prefs above to build an on-page digest from Live/Cached feeds. Automated email delivery is still Coming Soon.</p>'
      );
      return;
    }
    var countySlug = prefs.county || "statewide";
    var countyLabel = countyDisplayName(countySlug);
    var blocks = [];
    blocks.push(
      "<h3>Your watch digest</h3>" +
        '<p class="pi-meta">Filtered for <strong>' +
        esc(countyLabel) +
        "</strong> · saved " +
        esc(fmtDate(prefs.savedAt) || "just now") +
        ". On-page only — email still Coming Soon.</p>"
    );

    if (prefs.watch_zoning) {
      var zoningHtml =
        countySlug === "palm-beach" || countySlug === "statewide"
          ? badge("live") +
            " PBC zoning map edits appear in the Zoning feed below. Open a Palm Beach parcel for a live GIS stamp."
          : badge("live") +
            " Zoning GIS / PA attributes are available for many counties in the parcel lookup above. The rolling “map edits” feed is Palm Beach–specific today.";
      blocks.push('<div class="pi-digest-block"><h4>Zoning</h4><p>' + zoningHtml + "</p></div>");
    }

    if (prefs.watch_permits) {
      var permits = ((permitsPayload && permitsPayload.permits) || []).filter(function (p) {
        return permitMatchesCounty(p, countySlug);
      });
      if (!permits.length && countySlug !== "statewide" && countySlug !== "palm-beach") {
        blocks.push(
          '<div class="pi-digest-block"><h4>Permits</h4>' +
            badge("cached") +
            '<p class="pi-empty">Cached permit scrapes cover WPB / Boca / Jupiter / St. Lucie today — not ' +
            esc(countyLabel) +
            '. <a href="permit-search.html">Browse Permit Search</a>.</p></div>'
        );
      } else {
        var slice = (permits.length ? permits : (permitsPayload && permitsPayload.permits) || []).slice(0, 6);
        var list = slice
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
        blocks.push(
          '<div class="pi-digest-block"><h4>Permits</h4>' +
            badge("cached") +
            " Newest matches<ul class=\"pi-list\">" +
            list +
            '</ul><p class="pi-note"><a href="permit-search.html">Full Permit Search →</a></p></div>'
        );
      }
    }

    if (prefs.watch_tax) {
      var byCounty = salesByCounty(salesPayload);
      var keys =
        countySlug === "statewide"
          ? Object.keys(byCounty)
          : [salesCountyKey(countySlug)].filter(function (k) {
              return byCounty[k];
            });
      var entries = [];
      keys.forEach(function (county) {
        (byCounty[county] || []).forEach(function (s) {
          entries.push({ county: county, saleDate: s.date, parcels: s.count });
        });
      });
      entries.sort(function (a, b) {
        return String(a.saleDate || "").localeCompare(String(b.saleDate || ""));
      });
      var today = new Date().toISOString().slice(0, 10);
      entries = entries.filter(function (e) {
        return !e.saleDate || e.saleDate >= today;
      });
      var taxList = entries
        .slice(0, 8)
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
      blocks.push(
        '<div class="pi-digest-block"><h4>Tax deed calendar</h4>' +
          badge("cached") +
          ' Upcoming sale dates<ul class="pi-list">' +
          (taxList || "<li>No future dates matched for this county in sales.json</li>") +
          '</ul><p class="pi-note"><a href="tax-deeds.html">Open Tax Deeds →</a></p></div>'
      );
    }

    if (prefs.watch_certs) {
      if (countySlug === "palm-beach" || countySlug === "statewide") {
        var topCerts = ((certsPayload && certsPayload.certificates) || []).slice(0, 5);
        var certList = topCerts
          .map(function (c) {
            return (
              "<li><strong>#" +
              esc(c.certificateNumber) +
              "</strong> · " +
              money(c.faceAmount) +
              " · PIN " +
              esc(c.pin) +
              "</li>"
            );
          })
          .join("");
        blocks.push(
          '<div class="pi-digest-block"><h4>PBC certificates</h4>' +
            badge("cached") +
            " County-held sample (" +
            esc(String((certsPayload && certsPayload.count) || 0)) +
            ')<ul class="pi-list">' +
            (certList || "<li>No cert rows loaded</li>") +
            '</ul><p class="pi-note"><a href="' +
            TAX_COLLECTOR_CERTS_PAGE +
            '" target="_blank" rel="noopener">Tax Collector source →</a></p></div>'
        );
      } else {
        blocks.push(
          '<div class="pi-digest-block"><h4>Certificates</h4>' +
            badge("coming-soon") +
            '<p class="pi-empty">County-held certificate cache is Palm Beach only today. Use the Tax Collector / LienHub links from Property Intelligence for ' +
            esc(countyLabel) +
            ".</p></div>"
        );
      }
    }

    if (prefs.watch_flood) {
      var floodLayer =
        (floodConfig && floodConfig.layers && floodConfig.layers[countySlug]) ||
        (floodConfig && floodConfig.defaultLayer) ||
        null;
      var floodLabel = (floodLayer && (floodLayer.label || floodLayer.name)) || "FEMA NFHL / MSC";
      blocks.push(
        '<div class="pi-digest-block"><h4>Flood / FIRM</h4>' +
          badge("live") +
          "<p>Lookup a " +
          esc(countyLabel) +
          " parcel above for a flood GIS stamp (" +
          esc(floodLabel) +
          '). Deep-link: <a href="property-intelligence.html?county=' +
          encodeURIComponent(countySlug === "statewide" ? "palm-beach" : countySlug) +
          '&amp;mode=pcn">open parcel search</a> · <a href="https://msc.fema.gov/portal/home" target="_blank" rel="noopener">FEMA MSC</a>.</p></div>'
      );
    }

    if (prefs.notes) {
      blocks.push(
        '<div class="pi-digest-block"><h4>Your notes</h4><p class="pi-meta">' + esc(prefs.notes) + "</p></div>"
      );
    }

    setStatus(host, blocks.join(""));
  }

  function initAlerts() {
    var badgeHost = $("alerts-badge");
    if (badgeHost && window.DeedScoutTrust) {
      badgeHost.innerHTML = DeedScoutTrust.renderBadge("live", { compact: true });
    }
    var form = $("pi-alerts");
    if (!form) return;
    applyAlertPrefs(readAlertPrefs());
    var status = $("alert-status");
    var authStatus = $("alert-auth-status");
    var clearBtn = $("alert-clear");

    getSignedInUser().then(function (user) {
      if (!authStatus) return;
      if (user) {
        authStatus.textContent =
          "Signed in as " + (user.email || user.id) + " — saving will sync daily email prefs.";
        if (user.email && $("alert-email") && !$("alert-email").value) {
          $("alert-email").value = user.email;
        }
      } else {
        authStatus.innerHTML =
          'Not signed in on this browser. <a href="/tax-deeds.html#/account">Sign in on Tax Deeds</a>, then come back and Save.';
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        localStorage.removeItem(ALERTS_STORAGE_KEY);
        form.reset();
        if (form.watch_zoning) form.watch_zoning.checked = true;
        if (form.watch_permits) form.watch_permits.checked = true;
        if (form.watch_tax) form.watch_tax.checked = true;
        setStatus(status, "Browser prefs cleared. Email intake was not deleted from Netlify Forms.");
        renderWatchDigest(null);
      });
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var prefs = collectAlertPrefs(form);
      writeAlertPrefs(prefs);
      setStatus(status, "Saving…");
      renderWatchDigest(prefs);

      (async function () {
        var syncNote = "";
        try {
          var sb = ensureSupabaseClient();
          var user = await getSignedInUser();
          if (!sb) {
            syncNote = " Supabase client unavailable — browser prefs only.";
          } else if (!user) {
            syncNote =
              " Not signed in — browser prefs saved; sign in on Tax Deeds to enable daily email.";
          } else {
            var up = await sb.from("alert_subscriptions").upsert(
              {
                user_id: user.id,
                county: prefs.county || "statewide",
                watch_zoning: prefs.watch_zoning,
                watch_permits: prefs.watch_permits,
                watch_tax: prefs.watch_tax,
                watch_certs: prefs.watch_certs,
                watch_flood: prefs.watch_flood,
                notes: prefs.notes || "",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,county" }
            );
            if (up.error) {
              syncNote = " Account sync failed: " + up.error.message;
            } else {
              syncNote =
                " Synced to your account for daily email (needs RESEND_API_KEY in Netlify).";
            }
          }
        } catch (e) {
          syncNote = " Account sync skipped.";
        }

        var body = new URLSearchParams();
        body.set("form-name", "signal-alerts");
        body.set("email", prefs.email);
        body.set("county", prefs.county);
        body.set("notes", prefs.notes);
        body.set("watch_zoning", prefs.watch_zoning ? "yes" : "no");
        body.set("watch_permits", prefs.watch_permits ? "yes" : "no");
        body.set("watch_tax", prefs.watch_tax ? "yes" : "no");
        body.set("watch_certs", prefs.watch_certs ? "yes" : "no");
        body.set("watch_flood", prefs.watch_flood ? "yes" : "no");
        try {
          var res = await fetch("/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });
          if (!res.ok) throw new Error("Form submit failed (" + res.status + ")");
          setStatus(status, "Saved. On-page digest refreshed." + syncNote);
        } catch (err) {
          setStatus(
            status,
            "Saved in this browser and refreshed your on-page digest." +
              syncNote +
              " (Netlify form submit failed locally — expected on localhost.)"
          );
        }
      })();
    });

    renderWatchDigest(readAlertPrefs());
  }

  function init() {
    var form = $("pi-search");
    if (form) form.addEventListener("submit", onSearch);
    initAlerts();
    initFeeds().then(function () {
      renderWatchDigest(readAlertPrefs());
      // Deep-link: property-intelligence.html?county=palm-beach&pcn=...&mode=pcn
      try {
        var params = new URLSearchParams(window.location.search || "");
        var county = params.get("county");
        var q = params.get("pcn") || params.get("q") || params.get("query");
        var mode = params.get("mode") || (params.get("pcn") ? "pcn" : "address");
        if (county && $("pi-county")) $("pi-county").value = county;
        if (mode && $("pi-mode")) $("pi-mode").value = mode;
        if (q && $("pi-query")) {
          $("pi-query").value = q;
          if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
        }
      } catch (e) {
        /* ignore */
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
