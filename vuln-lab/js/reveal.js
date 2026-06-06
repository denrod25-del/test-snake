/**
 * Reveal-on-scroll: fades+rises elements tagged `.reveal` as they enter view.
 *
 * Robustness: the "hidden until revealed" state is gated behind the
 * `js-reveal` class this module adds to <html>, so if the script never runs the
 * content is fully visible. We also reveal everything immediately when the user
 * prefers reduced motion, when IntersectionObserver is unavailable, or when
 * there is no usable viewport (headless/offscreen) — and a safety timer reveals
 * anything left over so content can never be stranded invisible.
 */
export function revealOnScroll(root = document) {
  document.documentElement.classList.add("js-reveal");
  const els = root.querySelectorAll(".reveal:not(.in)");
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const noViewport = !window.innerHeight; // offscreen/headless — IO can't intersect
  if (reduce || noViewport || typeof IntersectionObserver === "undefined") {
    els.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries, obs) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        obs.unobserve(e.target);
      }
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  els.forEach((el) => io.observe(el));
  // Safety net: never leave content hidden if IO stalls for any reason.
  setTimeout(() => els.forEach((el) => el.classList.add("in")), 2000);
}
