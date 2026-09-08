/* ============================================================
   ASROTEX GROUP — scroll engine
   · Lenis smooth scroll
   · One sticky stage, four chained frame sequences scrubbed by scroll progress
   · Chapter rail, progress-window overlay copy
   · Reveals, counters, line-draw animations, nav, form
   · Mobile / reduced-motion: poster + muted clip per chapter (no scrub)
   ============================================================ */
(() => {
  "use strict";

  const TOUR = window.TOUR;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const narrow = () => window.innerWidth < 900;
  const staticTour = reduced || narrow() || (coarse && window.innerWidth < 1100);
  const html = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

  /* ---------------------------------------------------------- Lenis */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
    window.__lenis = lenis;
  }

  /* ---------------------------------------------------------- nav */
  const nav = $("#nav");
  const toggle = $("#nav-toggle");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$("a[href^='#']").forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      const offset = id === "#tour" ? 0 : -(parseInt(getComputedStyle(html).getPropertyValue("--nav-h")) || 72) + 8;
      if (lenis) lenis.scrollTo(target, { offset, duration: 1.4 });
      else target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", id);
    });
  });
  function updateNav(y) {
    nav.classList.toggle("solid", y > 24);
    const cue = $("#scroll-cue");
    if (cue) cue.style.opacity = y > 80 ? "0" : "1";
  }

  /* ---------------------------------------------------------- reveals + counters */
  function fmt(n) { return new Intl.NumberFormat("en-US").format(n); }
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || "", suffix = el.dataset.suffix || "";
    if (reduced) { el.textContent = prefix + fmt(target) + suffix; return; }
    const dur = 1500, t0 = performance.now();
    (function step(t) {
      const k = clamp((t - t0) / dur, 0, 1);
      el.textContent = prefix + fmt(Math.round(target * easeOutExpo(k))) + suffix;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      $$("[data-count]", e.target).forEach(animateCount);
      if (e.target.dataset.count) animateCount(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal, .reveal-line, .prow").forEach((el) => io.observe(el));

  /* ---------------------------------------------------------- marquee: duplicate for seamless loop */
  const track = $("#marquee-track");
  if (track) track.innerHTML += track.innerHTML;

  /* ---------------------------------------------------------- form */
  const form = $("#enquiry");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let ok = true;
      $$(".field", form).forEach((f) => {
        const input = $("input, select, textarea", f);
        const bad = input.required && (!input.value.trim() || (input.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value)));
        f.classList.toggle("invalid", bad);
        if (bad) ok = false;
      });
      if (!ok) { $(".field.invalid input, .field.invalid select", form)?.focus(); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      try {
        if (window.FORM_ENDPOINT) {
          const r = await fetch(window.FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
          if (!r.ok) throw new Error("submit failed");
        } else {
          console.info("[Asrotex] Enquiry (demo mode, no endpoint configured):", data);
        }
        form.hidden = true;
        $("#form-ok").classList.add("show");
      } catch (err) {
        btn.disabled = false;
        alert("Sorry, the enquiry could not be sent. Please email us directly.");
      }
    });
    $$("input, select, textarea", form).forEach((i) => i.addEventListener("input", () => i.closest(".field").classList.remove("invalid")));
  }

  /* ---------------------------------------------------------- tour */
  const rail = $("#rail");
  const railFill = $("#rail-fill");
  const railItems = $$("li", rail);
  const status = $("#nav-status");

  function setupStaticTour() {
    html.classList.add("tour-static");
    if (status) status.classList.add("done");
    if (reduced) return; // posters only
    // lazy-attach the muted clips as they scroll into view
    const vio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const v = e.target;
        if (e.isIntersecting) {
          if (!v.src) { v.src = v.dataset.src; v.load(); }
          v.play().catch(() => {});
        } else if (v.src) v.pause();
      });
    }, { threshold: 0.35 });
    $$("#tour-mobile video").forEach((v) => vio.observe(v));
  }

  function setupScrubTour() {
    const section = $("#tour");
    const canvas = $("#tour-canvas");
    const poster = $("#tour-poster");
    const ctx = canvas.getContext("2d", { alpha: false });
    const copies = $$(".tour-copy", section);
    const lines = copies.map((c) => $$(".line", c).map((el) => ({ el, a: parseFloat(el.dataset.in), b: parseFloat(el.dataset.out) })));
    const indexEl = $("#tour-index");
    html.style.setProperty("--tour-chapter-vh", TOUR.chapterVh);

    // flat frame list across chapters
    const frames = [];
    TOUR.chapters.forEach((ch, ci) => { for (let i = 1; i <= ch.frames; i++) frames.push({ src: TOUR.framePath(ch, i), ch: ci, img: null, ok: false }); });
    const total = frames.length;
    let loaded = 0, firstDrawn = false, current = -1, chapter = -1;

    function draw(index) {
      // nearest loaded frame at or before index, else after
      let f = frames[index];
      if (!f.ok) {
        let k = index; while (k >= 0 && !frames[k].ok) k--;
        if (k < 0) { k = index; while (k < total && !frames[k].ok) k++; }
        if (k < 0 || k >= total) return;
        f = frames[k];
      }
      const img = f.img;
      const cw = canvas.clientWidth, chh = canvas.clientHeight;
      const ir = img.naturalWidth / img.naturalHeight, cr = cw / chh;
      let dw, dh, dx, dy;
      if (ir > cr) { dh = chh; dw = chh * ir; dx = (cw - dw) / 2; dy = 0; }
      else { dw = cw; dh = cw / ir; dx = 0; dy = (chh - dh) / 2; }
      ctx.fillStyle = "#0B0F0C"; ctx.fillRect(0, 0, cw, chh);
      ctx.drawImage(img, dx, dy, dw, dh);
      if (!firstDrawn) { firstDrawn = true; poster.classList.add("hide"); }
    }
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (current >= 0) draw(current); else draw(0);
    }

    // preload: chapter 1 first (priority), then the rest, limited concurrency
    function load(i) {
      return new Promise((res) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => { frames[i].img = img; frames[i].ok = true; loaded++; if (i === 0 || current === i) draw(current < 0 ? 0 : current); res(); };
        img.onerror = () => { loaded++; res(); };
        img.src = frames[i].src;
      });
    }
    async function preload() {
      const queue = frames.map((_, i) => i);
      const workers = Array.from({ length: 6 }, async () => {
        while (queue.length) {
          const i = queue.shift();
          await load(i);
          if (status && loaded % 12 === 0) status.textContent = `Preparing tour · ${Math.round((loaded / total) * 100)}%`;
        }
      });
      await Promise.all(workers);
      if (status) { status.textContent = "Tour ready"; setTimeout(() => status.classList.add("done"), 1200); }
    }
    preload();

    const chapterCount = TOUR.chapters.length;
    // chapter is derived from the frame index (not from raw progress), so the rail and the
    // overlay copy switch on exactly the frame where the next clip begins
    const starts = []; TOUR.chapters.reduce((acc, ch) => { starts.push(acc); return acc + ch.frames; }, 0);
    function update() {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const inView = rect.top < vh * 0.5 && rect.bottom > vh * 0.5;
      rail.classList.toggle("on", inView);
      if (rect.bottom < -vh || rect.top > vh) return;
      const p = clamp(-rect.top / (rect.height - vh), 0, 1);
      const idx = Math.min(total - 1, Math.round(p * (total - 1)));
      if (idx !== current) { current = idx; draw(idx); }
      let ci = 0; for (let k = 1; k < chapterCount; k++) if (idx >= starts[k]) ci = k;
      const q = clamp((idx - starts[ci]) / (TOUR.chapters[ci].frames - 1), 0, 1);
      if (ci !== chapter) {
        chapter = ci;
        railItems.forEach((li, k) => li.classList.toggle("active", k === ci));
        if (indexEl) indexEl.textContent = `Yarn to shipment · 0${ci + 1} / 0${chapterCount}`;
      }
      railFill.style.height = (p * 100).toFixed(2) + "%";
      // overlay copy: trapezoid opacity over [in,out] with 0.07 ramps; other chapters hidden
      lines.forEach((chLines, k) => {
        chLines.forEach(({ el, a, b }) => {
          let o = 0;
          if (k === ci) o = clamp(Math.min((q - a) / 0.07, (b - q) / 0.07), 0, 1);
          el.style.opacity = o.toFixed(3);
          el.style.transform = `translateY(${((1 - o) * 24).toFixed(1)}px)`;
        });
      });
    }
    window.addEventListener("resize", resize);
    resize();
    // debug / QA handle
    window.__tour = { frames, total, get current() { return current; }, get chapter() { return chapter; }, get loaded() { return loaded; }, canvas, update };
    return update;
  }

  let tourUpdate = null;
  if (staticTour) setupStaticTour();
  else tourUpdate = setupScrubTour();

  /* ---------------------------------------------------------- frame loop */
  let lastY = -1;
  function frame(t) {
    if (lenis) lenis.raf(t);
    const y = window.scrollY;
    if (y !== lastY) { lastY = y; updateNav(y); }
    if (tourUpdate) tourUpdate();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  updateNav(window.scrollY);

  // if the viewport crosses the static/scrub threshold, reload to rebuild the right mode
  let lastMode = staticTour;
  window.addEventListener("resize", () => {
    const now = reduced || narrow() || (coarse && window.innerWidth < 1100);
    if (now !== lastMode) { lastMode = now; location.reload(); }
  });
})();
