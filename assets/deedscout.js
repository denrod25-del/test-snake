(function () {
  var path = (window.location.pathname.split("/").pop() || "index.html").replace(/\?.*$/, "");

  var navItems = [
    { href: "index.html", label: "Home" },
    { href: "tax-deeds.html", label: "Tax Deeds" },
    { href: "parcel-lookup.html", label: "Parcels" },
    { href: "permit-search.html", label: "Permits" },
    { href: "subdivisions-plats.html", label: "Subdivisions" },
    { href: "tax-deeds.html#/surplus", label: "Surplus" },
    { href: "pricing.html", label: "Pricing" },
    { href: "tax-deeds.html#/pricing", label: "Pro", pro: true },
  ];

  function isActive(href) {
    var file = href.split("#")[0];
    if (file === path) return true;
    if (path === "index.html" && file === "index.html") return true;
    if (path === "subdivisions-plats.html" && (file === "subdivision-index.html" || file === "plat-index.html" || file === "subdivisions-plats.html")) return true;
    return false;
  }

  var linksHtml = navItems.map(function (item) {
    var cls = isActive(item.href) ? " active" : "";
    if (item.pro) cls += " nav-pro";
    return '<a href="' + item.href + '" class="' + cls.trim() + '">' + item.label + "</a>";
  }).join("");

  var topbar = document.createElement("div");
  topbar.className = "ds-topbar";
  topbar.innerHTML =
    '<div class="ds-topbar-inner">' +
    "<span>Florida Statewide Coverage &mdash; All 67 Counties</span>" +
    '<span><a href="tax-deeds.html">Open Registry</a> &nbsp;|&nbsp; <a href="account.html">Sign In</a></span>' +
    "</div>";
  document.body.insertBefore(topbar, document.body.firstChild);

  var masthead = document.createElement("header");
  masthead.className = "ds-masthead";
  masthead.innerHTML =
    '<div class="ds-masthead-inner">' +
    '<a class="ds-brand" href="index.html">' +
    '<div class="ds-brand-mark">D</div>' +
    '<div class="ds-brand-text"><div class="name">DeedScout</div><div class="tag">Florida Property Intelligence</div></div>' +
    "</a>" +
    '<nav class="ds-primary-nav" aria-label="Main">' + linksHtml + "</nav>" +
    "</div>";
  document.body.insertBefore(masthead, topbar.nextSibling);

  var footer = document.createElement("footer");
  footer.className = "ds-footer";
  footer.innerHTML =
    '<div class="ds-footer-inner">' +
    '<div class="ds-footer-brand">' +
    '<a class="ds-brand" href="index.html" style="border:none;">' +
    '<div class="ds-brand-mark">D</div>' +
    '<div class="ds-brand-text"><div class="name">DeedScout</div><div class="tag">Public records workflow</div></div></a>' +
    "<p>Florida property intelligence from public records.</p></div>" +
    "<div><h4>Tools</h4>" +
    '<a href="tax-deeds.html" style="border:none;">Tax Deeds</a>' +
    '<a href="parcel-lookup.html" style="border:none;">Parcel Lookup</a>' +
    '<a href="permit-search.html" style="border:none;">Permit Search</a>' +
    '<a href="subdivisions-plats.html" style="border:none;">Subdivisions &amp; Plats</a>' +
    '<a href="contractor-intelligence.html" style="border:none;">Contractor Intelligence</a></div>' +
    "<div><h4>Company</h4>" +
    '<a href="about.html" style="border:none;">About</a>' +
    '<a href="pricing.html" style="border:none;">Pricing</a>' +
    '<a href="contact.html" style="border:none;">Contact</a>' +
    '<a href="investor-pitch.html" style="border:none;">Investor Pitch</a></div>' +
    "<div><h4>Legal</h4>" +
    '<a href="terms.html" style="border:none;">Terms</a>' +
    '<a href="privacy.html" style="border:none;">Privacy</a>' +
    '<a href="index.html#disclaimer" style="border:none;">Data Disclaimer</a></div></div>' +
    '<div class="ds-footer-bottom">' +
    "&copy; 2026 DeedScout &middot; Not a government agency, law firm, title company, brokerage, or financial advisor. Always verify with official county sources.</div>";
  document.body.appendChild(footer);
})();
