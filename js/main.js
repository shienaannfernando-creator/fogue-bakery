/* ============================================================
   Fogue Bakery — site interactions
   Shared across every page. Safely no-ops when an element
   isn't present on the current page.
   ============================================================ */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- footer year ---------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- mobile nav ---------- */
  const toggle = $("#navToggle");
  const nav = $("#mainNav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    $$("a", nav).forEach((a) =>
      a.addEventListener("click", () => {
        nav.classList.remove("open");
        toggle.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* ---------- sticky header shadow on scroll ---------- */
  const header = $("#siteHeader");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- scroll reveal (re-usable; called again after async render) ---------- */
  let _io = null;
  function observeReveal() {
    const revealEls = $$(".reveal:not(.is-in)");
    if (revealEls.length && "IntersectionObserver" in window) {
      if (!_io) {
        _io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-in");
                _io.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
        );
      }
      revealEls.forEach((el) => _io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("is-in"));
    }
  }
  observeReveal();

  /* ---------- spatula divider: progress tied directly to scroll position ---------- */
  const spatulaDividers = $$(".spatula-divider");
  if (spatulaDividers.length) {
    let ticking = false;
    const updateSpatulaProgress = () => {
      const vh = window.innerHeight;
      spatulaDividers.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const progress = (vh - rect.top) / (vh + rect.height);
        el.style.setProperty("--p", Math.min(1, Math.max(0, progress)).toFixed(3));
      });
      ticking = false;
    };
    const onSpatulaScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateSpatulaProgress);
        ticking = true;
      }
    };
    updateSpatulaProgress();
    window.addEventListener("scroll", onSpatulaScroll, { passive: true });
    window.addEventListener("resize", onSpatulaScroll);
  }

  /* ---------- soft bell chime when the tagline heading scrolls into view ---------- */
  const chimeTarget = $("#dreamHeading");
  if (chimeTarget && "IntersectionObserver" in window) {
    let audioCtx = null;
    const getAudioCtx = () => {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      return audioCtx;
    };
    // unlock audio on the first user interaction so autoplay-blocking browsers allow it later
    ["pointerdown", "keydown", "scroll"].forEach((evt) =>
      window.addEventListener(evt, () => getAudioCtx(), { once: true, passive: true })
    );

    const playBellChime = () => {
      const ctx = getAudioCtx();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(0.1, now + 0.008);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      master.connect(ctx.destination);

      [
        { freq: 1568, gain: 1 },
        { freq: 2349, gain: 0.35 },
        { freq: 3136, gain: 0.15 },
      ].forEach(({ freq, gain }) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(gain, now);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + 1.4);
      });
    };

    const chimeIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            playBellChime();
            chimeIO.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    chimeIO.observe(chimeTarget);
  }

  /* ---------- recipe-driven rendering (waits for Supabase load) ---------- */
  const onReady = window.onRecipesReady || function (cb) { cb(); };
  onReady(function () {
    const recipes = window.RECIPES || [];
    const categories = window.CATEGORIES || [];

    /* homepage hero cards */
    const heroCards = $("#heroCards");
    if (heroCards) {
      const featured = recipes.filter((r) => r.featured).slice(1, 4);
      heroCards.innerHTML = featured
        .map(
          (r) => `
          <article class="mini-card">
            <a href="recipe?id=${r.id}" class="mini-img"><img src="${r.image}" alt="${r.title}" loading="lazy" /></a>
            <div>
              <span class="cat">${r.category}</span>
              <h3><a href="recipe?id=${r.id}">${r.title}</a></h3>
              <a href="recipe?id=${r.id}" class="link-arrow">read now <span class="arr">&rarr;</span></a>
            </div>
          </article>`
        )
        .join("");
    }

    /* homepage summer grid */
    const summerGrid = $("#summerGrid");
    if (summerGrid) {
      const four = recipes.slice(0, 4);
      summerGrid.innerHTML = four
        .map(
          (r) => `
          <a class="card reveal" href="recipe?id=${r.id}">
            <span class="card-img"><img src="${r.image}" alt="${r.title}" loading="lazy" /></span>
            <span class="cat">${r.category}</span>
            <h3 class="serif">${r.title}</h3>
          </a>`
        )
        .join("");
    }

    /* category rail */
    const catRail = $("#catRail");
    if (catRail) {
      catRail.innerHTML = categories
        .map(
          (c) => `
          <a class="cat-item reveal" href="recipes.html#${encodeURIComponent(c.name)}">
            <span class="cat-img"><img src="${c.image}" alt="${c.name}" loading="lazy" /></span>
            <span>${c.name}</span>
          </a>`
        )
        .join("");
    }

    observeReveal();
  });

  /* ---------- search modal ---------- */
  const modal = $("#searchModal");
  const openBtn = $("#searchOpen");
  const closeBtn = $("#searchClose");
  const modalInput = $("#modalSearchInput");
  const results = $("#searchResults");

  function openModal() {
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => modalInput && modalInput.focus(), 50);
    renderResults("");
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  function renderResults(q) {
    if (!results) return;
    const recipes = window.RECIPES || [];
    const query = q.trim().toLowerCase();
    const matches = !query
      ? recipes.slice(0, 5)
      : recipes.filter(
          (r) =>
            r.title.toLowerCase().includes(query) ||
            r.category.toLowerCase().includes(query) ||
            r.excerpt.toLowerCase().includes(query)
        );

    if (!matches.length) {
      results.innerHTML = `<p class="search-empty">No recipes match “${q}”. Try “cake”, “cookie” or “ice cream”.</p>`;
      return;
    }
    results.innerHTML =
      `<p class="search-label">${query ? matches.length + " result" + (matches.length > 1 ? "s" : "") : "Popular recipes"}</p>` +
      matches
        .map(
          (r) => `
          <a class="search-hit" href="recipe?id=${r.id}">
            <img src="${r.image}" alt="" loading="lazy" />
            <span>
              <span class="search-hit-cat">${r.category}</span>
              <strong>${r.title}</strong>
            </span>
          </a>`
        )
        .join("");
  }

  if (openBtn) openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
  if (modalInput) {
    modalInput.addEventListener("input", (e) => renderResults(e.target.value));
  }
  const modalForm = $("#modalSearchForm");
  if (modalForm) modalForm.addEventListener("submit", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  /* ---------- yellow band search → open modal pre-filled ---------- */
  const bandSearch = $("#bandSearch");
  if (bandSearch) {
    bandSearch.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = bandSearch.querySelector("input").value;
      openModal();
      if (modalInput) {
        modalInput.value = val;
        renderResults(val);
      }
    });
  }

  /* ---------- newsletter ---------- */
  const newsForm = $("#newsForm");
  if (newsForm) {
    newsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const msg = $("#newsMsg");
      const input = newsForm.querySelector('input[type="email"]');
      if (msg) {
        msg.textContent = `You're on the list — sweet things coming to ${input.value}. 🧁`;
        msg.classList.add("show");
      }
      input.value = "";
    });
  }
})();
