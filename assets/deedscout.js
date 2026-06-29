(function () {
  var path = (window.location.pathname.split("/").pop() || "index.html").replace(/\?.*$/, "");

  var navItems = [
    { href: "tax-deeds.html", label: "Tax Deeds" },
    { href: "parcel-lookup.html", label: "Parcels" },
    { href: "permit-search.html", label: "Permits" },
    { href: "subdivisions-plats.html", label: "Subdivisions & Plats" },
    { href: "tax-deeds.html#/surplus", label: "Surplus Funds" },
    { href: "contractor-intelligence.html", label: "Contractor Intel" },
    { href: "pricing.html", label: "Pricing" },
    { href: "about.html", label: "About" },
  ];

  function isActive(href) {
    var file = href.split("#")[0];
    if (file === path) return true;
    if (path === "index.html" && file === "index.html") return true;
    return false;
  }

  var linksHtml = navItems
    .map(function (item) {
      var cls = isActive(item.href) ? ' class="active"' : "";
      return '<a href="' + item.href + '"' + cls + ">" + item.label + "</a>";
    })
    .join("");

  var nav = document.createElement("header");
  nav.className = "ds-nav";
  nav.innerHTML =
    '<div class="ds-nav-inner">' +
    '<a class="ds-logo" href="index.html">' +
    '<span class="ds-logo-mark">DS</span><span>DeedScout</span></a>' +
    '<nav class="ds-nav-links" aria-label="Main">' +
    linksHtml +
    "</nav>" +
    '<div class="ds-nav-actions">' +
    '<a class="ds-btn ds-btn-ghost" href="account.html">Account</a>' +
    '<a class="ds-btn ds-btn-primary" href="tax-deeds.html">Open App</a>' +
    "</div></div>";
  document.body.insertBefore(nav, document.body.firstChild);

  var footer = document.createElement("footer");
  footer.className = "ds-footer";
  footer.innerHTML =
    '<div class="ds-footer-inner">' +
    '<div class="ds-footer-brand">' +
    '<a class="ds-logo" href="index.html" style="color:#fff;">' +
    '<span class="ds-logo-mark">DS</span><span>DeedScout</span></a>' +
    "<p>Florida property intelligence from public records.</p></div>" +
    "<div><h4>Tools</h4>" +
    '<a href="tax-deeds.html">Tax Deeds</a>' +
    '<a href="parcel-lookup.html">Parcel Lookup</a>' +
    '<a href="permit-search.html">Permit Search</a>' +
    '<a href="subdivisions-plats.html">Subdivisions &amp; Plats</a>' +
    '<a href="tax-deeds.html#/surplus">Surplus Funds</a>' +
    '<a href="contractor-intelligence.html">Contractor Intelligence</a></div>' +
    "<div><h4>Company</h4>" +
    '<a href="about.html">About</a>' +
    '<a href="pricing.html">Pricing</a>' +
    '<a href="contact.html">Contact</a>' +
    '<a href="investor-pitch.html">Investor Pitch</a>' +
    '<a href="tax-deed-investors.html">For Investors</a></div>' +
    "<div><h4>Legal</h4>" +
    '<a href="terms.html">Terms</a>' +
    '<a href="privacy.html">Privacy</a>' +
    '<a href="index.html#disclaimer">Data Disclaimer</a></div></div>' +
    '<div class="ds-footer-bottom">' +
    "&copy; 2026 DeedScout &middot; " +
    "DeedScout is not a government agency, law firm, title company, brokerage, or financial advisor. " +
    "Always verify records with official county sources before bidding, buying, or contacting owners.</div>";
  document.body.appendChild(footer);

  window.DeedScoutDisclaimer = function (opts) {
    opts = opts || {};
    return (
      '<div class="ds-disclaimer" role="note">' +
      "<strong>Research disclaimer</strong>" +
      (opts.text ||
        "DeedScout organizes public-record information for research purposes only. It does not replace official county records, legal due diligence, title searches, investment advice, or professional verification. Always confirm details with the official county source before bidding, buying, contacting owners, or making financial decisions.") +
      "</div>"
    );
  };

  window.DeedScoutTrustBlock = function (opts) {
    opts = opts || {};
    return (
      '<dl class="ds-trust-block">' +
      "<dt>Last updated</dt><dd>" +
      (opts.updated || "See county source") +
      "</dd>" +
      "<dt>Data source</dt><dd>" +
      (opts.source || "Florida county public records") +
      "</dd>" +
      "<dt>Coverage</dt><dd>" +
      (opts.coverage || "Varies by county and tool") +
      "</dd>" +
      "<dt>Official source</dt><dd>" +
      (opts.official || "Linked on each county page") +
      "</dd>" +
      "<dt>Known limitations</dt><dd>" +
      (opts.limitations ||
        "Data may be delayed, incomplete, or reformatted by the county.") +
      "</dd>" +
      "<dt>Verification required</dt><dd>" +
      (opts.verification ||
        "Always confirm sale dates, parcel details, bid rules, and legal status with the official county source before acting.") +
      "</dd></dl>"
    );
  };
})();
