(() => {
  const params = new URLSearchParams(location.search);
  const q = (params.get("q") || "").trim();
  const qInput = document.getElementById("q");
  const meta = document.getElementById("meta");
  const adsEl = document.getElementById("ads");
  const hitsEl = document.getElementById("hits");
  const empty = document.getElementById("empty");
  if (qInput) qInput.value = q;
  document.title = q ? `${q} — SYMBOLIC` : "SYMBOLIC — results";

  if (!q) {
    meta.textContent = "Enter a query to search.";
    return;
  }

  const sessionId = (() => {
    let s = localStorage.getItem("symbolic_sid");
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("symbolic_sid", s);
    }
    return s;
  })();

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  fetch(`/search?q=${encodeURIComponent(q)}&k=15`)
    .then((r) => r.json())
    .then((data) => {
      meta.textContent = `${data.total} result${data.total === 1 ? "" : "s"} · ${data.took_ms} ms`;

      if ((data.ads || []).length) {
        adsEl.innerHTML = data.ads
          .map(
            (a) => `
          <div class="ad">
            <div><span class="ad-tag">AD</span><span class="ad-title">${escapeHtml(a.title || "")}</span></div>
            <div class="ad-url">${escapeHtml(a.url || "")}</div>
            <div class="ad-desc">${escapeHtml(a.description || "")}</div>
          </div>`
          )
          .join("");
      }

      if (!data.hits.length) {
        empty.style.display = "block";
        return;
      }

      hitsEl.innerHTML = data.hits
        .map((h, idx) => {
          const f = h.features || {};
          return `
          <article class="hit" data-doc="${h.doc_id}" data-pos="${idx}">
            <div class="url-line">${escapeHtml(h.url)}</div>
            <div class="title-line"><a href="${escapeHtml(h.url)}" target="_blank" rel="noopener">${escapeHtml(h.title || h.url)}</a></div>
            <div class="snippet">${escapeHtml(h.snippet || "")}</div>
            <div class="features">score=${h.score.toFixed(3)} · bm25=${(f.bm25||0).toFixed(2)} · cos=${(f.cosine||0).toFixed(2)} · in=${(f.log_inlinks||0).toFixed(2)}</div>
          </article>`;
        })
        .join("");

      hitsEl.querySelectorAll(".hit a").forEach((a) => {
        a.addEventListener("click", (e) => {
          const article = e.currentTarget.closest(".hit");
          const doc_id = parseInt(article.dataset.doc, 10);
          const position = parseInt(article.dataset.pos, 10);
          navigator.sendBeacon(
            "/click",
            new Blob(
              [JSON.stringify({ query: q, doc_id, position, session_id: sessionId })],
              { type: "application/json" }
            )
          );
        });
      });
    })
    .catch((err) => {
      meta.textContent = "Error: " + err.message;
    });
})();
