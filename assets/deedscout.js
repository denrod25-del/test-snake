(function () {
  var file = (window.location.pathname.split("/").pop() || "index.html").replace(/\?.*$/, "");
  var pathDir = window.location.pathname.replace(/[^/]*$/, "");
  var depth = pathDir.split("/").filter(Boolean).length;
  var base = depth ? Array(depth + 1).join("../") : "";
  var inLearn = /\/learn\//.test(window.location.pathname);

  var mainNav = [
    { href: "index.html", label: "Home" },
    { href: "counties/index.html", label: "Counties" },
    { href: "tax-deeds.html", label: "Tax Deeds" },
    { href: "parcel-lookup.html", label: "Parcel Lookup" },
    { href: "property-intelligence.html", label: "Intelligence" },
    { href: "permit-search.html", label: "Permit Search" },
    { href: "pricing.html", label: "Pricing" },
    { href: "learn/index.html", label: "Learn" },
    { href: "account.html", label: "Account" },
  ];

  var labsLinks = [
    { href: "labs/plumbing-reviews.html", label: "Plumbing Reviews (demo)" },
    { href: "subdivision-index.html", label: "Subdivision Index" },
    { href: "plat-index.html", label: "Plat Index" },
    { href: "data-sources.html", label: "Data Sources" },
    { href: "status.html", label: "System Status" },
  ];

  function href(path) {
    return base + path;
  }

  function isActive(navHref) {
    var target = navHref.split("#")[0];
    if (target === file) return true;
    if (file === "index.html" && target === "index.html") return true;
    if (inLearn && target.indexOf("learn") >= 0) return true;
    if (file === "index.html" && pathDir.indexOf("counties") >= 0 && target === "counties/index.html") return true;
    if ((file === "subdivision-index.html" || file === "plat-index.html" || file === "subdivisions-plats.html") &&
        (target.indexOf("subdivision") >= 0 || target.indexOf("plat") >= 0)) return true;
    return false;
  }

  var linksHtml = mainNav
    .map(function (item) {
      var cls = isActive(item.href) ? " active" : "";
      return '<a href="' + href(item.href) + '" class="' + cls.trim() + '">' + item.label + "</a>";
    })
    .join("");

  linksHtml +=
    '<details class="ds-nav-labs"><summary>Labs</summary><div class="ds-nav-labs-menu">' +
    labsLinks.map(function (l) {
      return '<a href="' + href(l.href) + '">' + l.label + "</a>";
    }).join("") +
    "</div></details>";

  var topbar = document.createElement("div");
  topbar.className = "ds-topbar";
  topbar.innerHTML =
    '<div class="ds-topbar-inner">' +
    '<span>DeedScout &mdash; <a href="' + href("trust.html") + '" class="ds-beta-link" title="Data coverage varies by county and source">Public Beta</a></span>' +
    '<span><a href="' + href("tax-deeds.html") + '">DeedScout Tax Deeds</a> &nbsp;|&nbsp; <a href="' + href("account.html") + '">Sign In</a></span>' +
    "</div>";
  document.body.insertBefore(topbar, document.body.firstChild);

  var masthead = document.createElement("header");
  masthead.className = "ds-masthead";
  masthead.innerHTML =
    '<div class="ds-masthead-inner">' +
    '<a class="ds-brand" href="' + href("index.html") + '">' +
    '<div class="ds-brand-mark">D</div>' +
    '<div class="ds-brand-text"><div class="name">DeedScout</div><div class="tag">Florida public-records research layer</div></div>' +
    "</a>" +
    '<nav class="ds-primary-nav" aria-label="Main">' + linksHtml + "</nav>" +
    "</div>";
  document.body.insertBefore(masthead, topbar.nextSibling);

  var footer = document.createElement("footer");
  footer.className = "ds-footer";
  footer.innerHTML =
    '<div class="ds-footer-inner">' +
    '<div class="ds-footer-brand">' +
    '<a class="ds-brand" href="' + href("index.html") + '" style="border:none;">' +
    '<div class="ds-brand-mark">D</div>' +
    '<div class="ds-brand-text"><div class="name">DeedScout</div><div class="tag">Florida public-records research</div></div></a>' +
    "<p>Florida's public-records research layer for tax deed investors, contractors, and title researchers.</p></div>" +
    "<div><h4>Products</h4>" +
    '<a href="' + href("tax-deeds.html") + '" style="border:none;">DeedScout Tax Deeds</a>' +
    '<a href="' + href("parcel-lookup.html") + '" style="border:none;">DeedScout Parcel Lookup</a>' +
    '<a href="' + href("property-intelligence.html") + '" style="border:none;">Property Intelligence</a>' +
    '<a href="' + href("permit-search.html") + '" style="border:none;">DeedScout Permits</a>' +
    '<a href="' + href("subdivision-index.html") + '" style="border:none;">DeedScout Subdivision Index</a>' +
    '<a href="' + href("plat-index.html") + '" style="border:none;">DeedScout Plat Index</a></div>' +
    "<div><h4>Company</h4>" +
    '<a href="' + href("trust.html") + '" style="border:none;">Trust Center</a>' +
    '<a href="' + href("about.html") + '" style="border:none;">About</a>' +
    '<a href="' + href("methodology.html") + '" style="border:none;">Methodology</a>' +
    '<a href="' + href("data-sources.html") + '" style="border:none;">Data Sources</a>' +
    '<a href="' + href("status.html") + '" style="border:none;">Status</a>' +
    '<a href="' + href("faq.html") + '" style="border:none;">FAQ</a>' +
    '<a href="' + href("pricing.html") + '" style="border:none;">Pricing</a>' +
    '<a href="' + href("contact.html") + '" style="border:none;">Contact</a>' +
    '<a href="' + href("security.html") + '" style="border:none;">Security</a></div>' +
    "<div><h4>Legal</h4>" +
    '<a href="' + href("terms.html") + '" style="border:none;">Terms</a>' +
    '<a href="' + href("privacy.html") + '" style="border:none;">Privacy</a>' +
    '<a href="' + href("changelog.html") + '" style="border:none;">Changelog</a>' +
    '<a href="' + href("index.html") + '#disclaimer" style="border:none;">Data Disclaimer</a></div></div>' +
    '<div class="ds-footer-bottom">' +
    '<span class="ds-beta-footer"><a href="' + href("trust.html") + '">Public Beta</a> &mdash; data coverage varies by county and source. </span>' +
    "&copy; 2026 DeedScout &middot; Not affiliated with any county, clerk, auction platform, property appraiser, or government agency. Not legal, tax, investment, title, or brokerage advice. Always verify with official county sources before bidding.</div>";
  document.body.appendChild(footer);
})();
