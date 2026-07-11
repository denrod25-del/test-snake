/**
 * DeedScout parcel registry — multi-county ArcGIS lookup helpers.
 * Consumes data/parcels/registry.json (or window.DEEDSCOUT_PARCEL_REGISTRY).
 */
(function (global) {
  var registryCache = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/'/g, "''");
  }

  function normalizeId(s) {
    return String(s || "").replace(/[^\dA-Za-z]/g, "").toUpperCase();
  }

  function firstAttr(attrs, keys) {
    if (!attrs || !keys) return null;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (attrs[k] != null && String(attrs[k]).trim() !== "") return attrs[k];
      // case-insensitive fallback
      var lower = k.toLowerCase();
      for (var ak in attrs) {
        if (ak.toLowerCase() === lower && attrs[ak] != null && String(attrs[ak]).trim() !== "") {
          return attrs[ak];
        }
      }
    }
    return null;
  }

  function loadRegistry() {
    if (registryCache) return Promise.resolve(registryCache);
    if (global.DEEDSCOUT_PARCEL_REGISTRY) {
      registryCache = global.DEEDSCOUT_PARCEL_REGISTRY;
      return Promise.resolve(registryCache);
    }
    var base = "";
    try {
      var scripts = document.getElementsByTagName("script");
      for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].src || "";
        if (src.indexOf("parcel-registry.js") >= 0) {
          base = src.replace(/assets\/parcel-registry\.js.*$/, "");
          break;
        }
      }
    } catch (e) { /* ignore */ }
    return fetch(base + "data/parcels/registry.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("parcel registry HTTP " + r.status);
        return r.json();
      })
      .then(function (doc) {
        registryCache = doc;
        return doc;
      });
  }

  function listCounties(doc) {
    doc = doc || registryCache;
    if (!doc || !doc.counties) return [];
    return Object.keys(doc.counties)
      .map(function (slug) {
        var c = doc.counties[slug];
        return {
          slug: slug,
          name: c.name || slug,
          status: c.status || "coming-soon",
          searchModes: c.searchModes || ["pcn"],
          note: c.note || "",
          paUrl: c.paUrl || "",
        };
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
  }

  function getCounty(slug, doc) {
    doc = doc || registryCache;
    if (!doc || !doc.counties) return null;
    return doc.counties[slug] || null;
  }

  function buildWhere(county, mode, query) {
    var v = String(query || "").trim();
    if (!v || !county) return null;
    var idFields = county.idFields || [];
    var map = county.map || {};
    switch (mode) {
      case "pcn": {
        var clean = normalizeId(v);
        if (!clean) return null;
        var parts = idFields.map(function (f) {
          return f + "='" + esc(clean) + "'";
        });
        return parts.length ? parts.join(" OR ") : null;
      }
      case "pcn-prefix": {
        var pref = normalizeId(v);
        if (!pref) return null;
        return idFields
          .map(function (f) {
            return f + " LIKE '" + esc(pref) + "%'";
          })
          .join(" OR ");
      }
      case "owner": {
        var ownerFields = map.owner && map.owner.length ? map.owner : ["OWNER", "OWNER1", "OWNER_NAME"];
        return ownerFields
          .map(function (f) {
            return "UPPER(" + f + ") LIKE UPPER('%" + esc(v) + "%')";
          })
          .join(" OR ");
      }
      case "address": {
        var addrFields = map.address && map.address.length ? map.address : ["SITE_ADDRESS", "SITUS_ADDRESS", "ADDRESS"];
        return addrFields
          .map(function (f) {
            return "UPPER(" + f + ") LIKE UPPER('%" + esc(v) + "%')";
          })
          .join(" OR ");
      }
      case "legal": {
        return ["LEGAL1", "LEGAL2", "LEGAL3"]
          .map(function (f) {
            return "UPPER(" + f + ") LIKE UPPER('%" + esc(v) + "%')";
          })
          .join(" OR ");
      }
      case "subdiv": {
        return "UPPER(SUBDIV_NAME) LIKE UPPER('%" + esc(v) + "%')";
      }
      default:
        return null;
    }
  }

  function normalizeFeature(county, attrs) {
    attrs = attrs || {};
    var map = county.map || {};
    var market = firstAttr(attrs, map.market || []);
    // Pinellas lists land+imp separately — sum if both numeric
    if (map.market && map.market.length >= 2 && market != null) {
      var nums = map.market
        .map(function (k) {
          return Number(attrs[k]);
        })
        .filter(function (n) {
          return !isNaN(n);
        });
      if (nums.length >= 2) market = nums.reduce(function (a, b) { return a + b; }, 0);
    }
    return {
      pcn: firstAttr(attrs, map.pcn || county.idFields || []) || "",
      owner: firstAttr(attrs, map.owner || []) || "",
      address: firstAttr(attrs, map.address || []) || "",
      city: firstAttr(attrs, map.city || []) || "",
      zip: firstAttr(attrs, map.zip || []) || "",
      market: market,
      assessed: firstAttr(attrs, map.assessed || []),
      saleDate: firstAttr(attrs, map.saleDate || []),
      salePrice: firstAttr(attrs, map.salePrice || []),
      homestead: firstAttr(attrs, map.homestead || []),
      raw: attrs,
      countySlug: null,
      countyName: county.name || "",
      sourceNote: county.note || "",
    };
  }

  function queryCounty(countyOrSlug, opts) {
    opts = opts || {};
    return loadRegistry().then(function (doc) {
      var county =
        typeof countyOrSlug === "string" ? getCounty(countyOrSlug, doc) : countyOrSlug;
      if (!county) throw new Error("Unknown county in parcel registry");
      if ((county.status || "") === "coming-soon") {
        throw new Error((county.name || "County") + " parcel GIS is not wired yet");
      }
      var where =
        opts.where ||
        buildWhere(county, opts.mode || "pcn", opts.query || opts.pcn || "");
      if (!where) throw new Error("Enter a search value");
      var outFields = (county.outFields || ["*"]).join(",");
      var params = new URLSearchParams({
        where: where,
        outFields: outFields,
        returnGeometry: opts.returnGeometry ? "true" : "false",
        f: "json",
        resultRecordCount: String(opts.limit || 25),
      });
      if (opts.resultOffset) params.set("resultOffset", String(opts.resultOffset));
      return fetch(county.endpoint + "?" + params.toString(), { credentials: "omit" }).then(
        function (resp) {
          if (!resp.ok) throw new Error("ArcGIS HTTP " + resp.status);
          return resp.json();
        }
      ).then(function (json) {
        if (json.error) throw new Error(json.error.message || "ArcGIS error");
        var features = json.features || [];
        return {
          county: county,
          count: features.length,
          exceededTransferLimit: !!json.exceededTransferLimit,
          results: features.map(function (f) {
            var n = normalizeFeature(county, f.attributes || {});
            n.geometry = f.geometry || null;
            return n;
          }),
        };
      });
    });
  }

  global.DeedScoutParcels = {
    loadRegistry: loadRegistry,
    listCounties: listCounties,
    getCounty: getCounty,
    buildWhere: buildWhere,
    normalizeFeature: normalizeFeature,
    queryCounty: queryCounty,
    normalizeId: normalizeId,
  };
})(typeof window !== "undefined" ? window : globalThis);
