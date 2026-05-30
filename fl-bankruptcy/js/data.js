// Shared data layer + utilities. All pages import this via <script src="js/data.js">.
// Exposes window.FLBK with helpers; no module bundler needed.

(function () {
  const state = {
    payload: null,        // full JSON
    loaded: null,         // Promise
  };

  async function load() {
    if (state.payload) return state.payload;
    if (state.loaded)  return state.loaded;
    state.loaded = fetch("data/filings.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load filings.json: " + r.status);
        return r.json();
      })
      .then((j) => { state.payload = j; return j; });
    return state.loaded;
  }

  function fmtMoney(n) {
    if (n == null) return "—";
    return "$" + Number(n).toLocaleString("en-US");
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  function relDays(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diff <= 0)  return "today";
    if (diff === 1) return "yesterday";
    if (diff < 7)   return diff + " days ago";
    if (diff < 30)  return Math.floor(diff / 7)  + "w ago";
    if (diff < 365) return Math.floor(diff / 30) + "mo ago";
    return Math.floor(diff / 365) + "y ago";
  }

  function chapterChip(ch) {
    return `<span class="chip ch${ch}">Ch. ${ch}</span>`;
  }
  function statusChip(s) {
    return `<span class="chip status-${s}">${s}</span>`;
  }

  // Highlight active nav link based on current page filename.
  function highlightNav() {
    const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    document.querySelectorAll(".nav-links a").forEach((a) => {
      const href = (a.getAttribute("href") || "").toLowerCase();
      if (href === file || (file === "" && href === "index.html")) {
        a.classList.add("active");
      }
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function getQueryParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function downloadCSV(rows, filename) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [headers.join(",")]
      .concat(rows.map((r) => headers.map((h) => escape(r[h])).join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // Inject the shared nav into a <div id="site-nav"></div> placeholder.
  function injectNav() {
    const host = document.getElementById("site-nav");
    if (!host) return;
    host.innerHTML = `
      <nav class="nav">
        <div class="nav-inner">
          <a href="index.html" class="brand">
            <span class="brand-mark">FL</span>
            <span>Florida Bankruptcy Tracker</span>
          </a>
          <div class="nav-links">
            <a href="index.html">Dashboard</a>
            <a href="filings.html">Filings</a>
            <a href="about.html">About</a>
          </div>
        </div>
      </nav>
    `;
    highlightNav();
  }

  function injectFooter() {
    const host = document.getElementById("site-footer");
    if (!host) return;
    host.innerHTML = `
      <footer class="footer">
        <div class="container">
          Florida Bankruptcy Tracker &middot; Demonstration data &middot;
          <a href="about.html">About &amp; data sources</a>
        </div>
      </footer>
    `;
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectNav();
    injectFooter();
  });

  window.FLBK = {
    load, fmtMoney, fmtDate, relDays,
    chapterChip, statusChip, escapeHtml,
    getQueryParam, downloadCSV,
  };
})();
