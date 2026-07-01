/**
 * DeedScout Data Trust — reusable status badges and trust panels.
 * Statuses: live | cached | sample | blocked | broken | coming-soon
 */
(function (global) {
  var STATUSES = {
    live: {
      label: "Live",
      desc: "Pulled from an official/public source within the last 72 hours.",
      cls: "ds-status-live",
    },
    cached: {
      label: "Cached",
      desc: "Real source data, but not refreshed in the last 72 hours.",
      cls: "ds-status-cached",
    },
    sample: {
      label: "Sample",
      desc: "Demo data only. Do not rely on it for decisions.",
      cls: "ds-status-sample",
    },
    blocked: {
      label: "Blocked",
      desc: "Source requires login, payment, reCAPTCHA, or manual lookup.",
      cls: "ds-status-blocked",
    },
    broken: {
      label: "Broken",
      desc: "Scraper or source is currently failing.",
      cls: "ds-status-broken",
    },
    "coming-soon": {
      label: "Coming Soon",
      desc: "UI exists; data connection not wired yet.",
      cls: "ds-status-soon",
    },
  };

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "Unknown";
    try {
      return new Date(iso).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch (e) {
      return iso;
    }
  }

  function ageHours(iso) {
    if (!iso) return null;
    try {
      return (Date.now() - new Date(iso).getTime()) / 3600000;
    } catch (e) {
      return null;
    }
  }

  /** Map permit index.json / sources.json status to trust status */
  function permitTrustStatus(entry) {
    if (!entry) return "coming-soon";
    var scope = (entry.scope || entry.note || "").toLowerCase();
    var st = (entry.status || "").toLowerCase();
    if (/sample|illustrative|demo|not real/.test(scope)) return "sample";
    if (st === "unsupported" || st === "unsupported_paywall") return "blocked";
    if (st === "scaffold" || st === "manual") return st === "manual" ? "cached" : "coming-soon";
    if (st === "active") {
      var h = ageHours(entry.lastUpdated || entry.lastScrape);
      if (h != null && h <= 72) return "live";
      return "cached";
    }
    if (st === "stale") return /sample|illustrative/.test(scope) ? "sample" : "cached";
    if (st === "broken" || st === "error") return "broken";
    return "coming-soon";
  }

  /** Map sales scraper state */
  function salesTrustStatus(hasSales, salesGenerated, sourceUrl) {
    if (!sourceUrl) return "coming-soon";
    if (hasSales) {
      var h = ageHours(salesGenerated);
      if (h != null && h <= 72) return "live";
      return "cached";
    }
    return "broken";
  }

  /**
   * Render inline status badge.
   * opts: { status, source, lastRefreshed, verification, compact }
   */
  function renderBadge(status, opts) {
    opts = opts || {};
    var meta = STATUSES[status] || STATUSES["coming-soon"];
    var title = meta.desc;
    if (opts.source) title += " Source: " + opts.source;
    if (opts.lastRefreshed) title += " Last refreshed: " + opts.lastRefreshed;
    var inner = escapeHtml(meta.label);
    if (!opts.compact && opts.verification) {
      inner += ' <span class="ds-status-note">' + escapeHtml(opts.verification) + "</span>";
    }
    return (
      '<span class="ds-status ' +
      meta.cls +
      '" title="' +
      escapeHtml(title) +
      '" role="status">' +
      inner +
      "</span>"
    );
  }

  /**
   * Render full trust panel (banner or card).
   */
  function renderTrustPanel(opts) {
    opts = opts || {};
    var status = opts.status || "coming-soon";
    var meta = STATUSES[status] || STATUSES["coming-soon"];
    var rows = [];
    rows.push(renderBadge(status, { compact: true }));
    if (opts.headline) {
      rows.unshift("<strong>" + escapeHtml(opts.headline) + "</strong>");
    } else {
      rows.unshift("<strong>" + escapeHtml(meta.desc) + "</strong>");
    }
    var dl = [];
    if (opts.source) dl.push("<dt>Source</dt><dd>" + escapeHtml(opts.source) + "</dd>");
    if (opts.lastRefreshed) dl.push("<dt>Last refreshed</dt><dd>" + escapeHtml(formatDate(opts.lastRefreshed)) + "</dd>");
    if (opts.verification) dl.push("<dt>Verification</dt><dd>" + escapeHtml(opts.verification) + "</dd>");
    if (opts.note) dl.push("<dt>Note</dt><dd>" + escapeHtml(opts.note) + "</dd>");

    var bannerCls = "ds-trust-panel ds-trust-" + status.replace("coming-soon", "soon");
    if (opts.large) bannerCls += " ds-trust-large";

    return (
      '<div class="' +
      bannerCls +
      '" role="region" aria-label="Data status">' +
      '<div class="ds-trust-head">' +
      rows.join(" ") +
      "</div>" +
      (dl.length ? '<dl class="ds-trust-meta">' + dl.join("") + "</dl>" : "") +
      (opts.extraHtml || "") +
      "</div>"
    );
  }

  /** Render table of source health rows */
  function renderSourceTable(rows) {
    if (!rows || !rows.length) return "";
    var head =
      "<thead><tr><th>Source</th><th>Status</th><th>Records</th><th>Last refreshed</th><th>Portal</th></tr></thead>";
    var body = rows
      .map(function (r) {
        return (
          "<tr>" +
          "<td><strong>" +
          escapeHtml(r.label) +
          "</strong>" +
          (r.scope ? '<div class="ds-status-sub">' + escapeHtml(r.scope) + "</div>" : "") +
          "</td>" +
          "<td>" +
          renderBadge(r.status, { compact: true }) +
          "</td>" +
          "<td>" +
          (r.count != null ? escapeHtml(String(r.count)) : "—") +
          "</td>" +
          "<td>" +
          escapeHtml(r.lastRefreshed ? formatDate(r.lastRefreshed) : "—") +
          "</td>" +
          "<td>" +
          (r.portalUrl
            ? '<a href="' + escapeHtml(r.portalUrl) + '" target="_blank" rel="noopener">Official portal</a>'
            : "—") +
          "</td></tr>"
        );
      })
      .join("");
    return (
      '<div class="ds-table-wrap"><table class="ds-source-table">' +
      head +
      "<tbody>" +
      body +
      "</tbody></table></div>"
    );
  }

  /** Full dataset inventory table (data-sources / status pages) */
  function renderDatasetTable(rows) {
    if (!rows || !rows.length) return "";
    var head =
      "<thead><tr><th>Dataset</th><th>Jurisdiction</th><th>Status</th><th>Records</th><th>Last success</th><th>Last attempt</th><th>Limitations</th><th>Verify</th></tr></thead>";
    var body = rows
      .map(function (r) {
        return (
          "<tr>" +
          "<td><strong>" + escapeHtml(r.name || r.label) + "</strong>" +
          (r.sourceUrl ? '<div class="ds-status-sub"><a href="' + escapeHtml(r.sourceUrl) + '" target="_blank" rel="noopener">' + escapeHtml(r.sourceUrl.replace(/^https?:\/\//, "")) + "</a></div>" : "") +
          "</td>" +
          "<td>" + escapeHtml(r.jurisdiction || "—") + "</td>" +
          "<td>" + renderBadge(r.status, { compact: true }) + "</td>" +
          "<td>" + (r.count != null ? escapeHtml(String(r.count)) : "—") + "</td>" +
          "<td>" + escapeHtml(r.lastSuccess ? formatDate(r.lastSuccess) : "—") + "</td>" +
          "<td>" + escapeHtml(r.lastAttempt ? formatDate(r.lastAttempt) : "—") + "</td>" +
          "<td>" + escapeHtml(r.limitations || "—") + "</td>" +
          "<td>" + escapeHtml(r.verification || "Official county/municipal source required") + "</td>" +
          "</tr>"
        );
      })
      .join("");
    return (
      '<div class="ds-table-wrap"><table class="ds-source-table ds-dataset-table">' +
      head + "<tbody>" + body + "</tbody></table></div>"
    );
  }

  function mount(selector, html) {
    var el = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (el) el.innerHTML = html;
  }

  global.DeedScoutTrust = {
    STATUSES: STATUSES,
    formatDate: formatDate,
    permitTrustStatus: permitTrustStatus,
    salesTrustStatus: salesTrustStatus,
    renderBadge: renderBadge,
    renderTrustPanel: renderTrustPanel,
    renderSourceTable: renderSourceTable,
    renderDatasetTable: renderDatasetTable,
    mount: mount,
    escapeHtml: escapeHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
