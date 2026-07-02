(function () {
  window.addEventListener("error", function (ev) {
    console.error("[DeedScout]", ev.message);
  });
  window.addEventListener("unhandledrejection", function (ev) {
    console.error("[DeedScout] unhandled rejection", ev.reason);
  });
  window.DeedScoutOnError = function (container, message) {
    var el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) return;
    el.innerHTML =
      '<div class="ds-trust-panel ds-trust-broken" role="alert"><strong>Something went wrong loading this section.</strong> ' +
      (message || "Refresh the page or visit the <a href=\"trust.html\">Trust Center</a>.") +
      "</div>";
  };
})();
