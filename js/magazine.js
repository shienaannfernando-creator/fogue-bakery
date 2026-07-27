/* ============================================================
   Fogue Bakery — flip-through magazine viewers (book.html)
   Renders one cutout-paper headline + one flip-through viewer per
   magazine issue. Each PDF is rasterized with pdf.js, then handed
   to StPageFlip for the page-turning animation. Both libraries are
   loaded from a CDN only on this page — see the <script> tags in
   book.html.
   ============================================================ */
(function () {
  "use strict";

  const root = document.getElementById("magazineIssues");
  if (!root) return;

  const PDFJS_VERSION = "3.11.174";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* Renders a title as scattered cutout-paper letters, cycling through
     six colourway/shape combos so any issue title gets the same style
     as the hand-built "Issue 1" headline. */
  function headlineHTML(title) {
    let letterIndex = 0;
    const spans = String(title || "")
      .split("")
      .map((ch) => {
        if (ch.trim() === "") return '<span class="cutout-space"></span>';
        const combo = (letterIndex % 6) + 1;
        letterIndex += 1;
        return `<span class="cutout cutout-c${combo}"><span class="cutout-letter">${escapeHtml(ch)}</span></span>`;
      })
      .join("");
    return `<h2 class="issue-headline" aria-label="${escapeHtml(title)}">${spans}</h2>`;
  }

  const ARROW_ICONS = {
    prev: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    next: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  };

  function issueSectionHTML(issue, index) {
    return `
      <section class="issue-headline-section">
        <div class="wrap">${headlineHTML(issue.title)}</div>
      </section>
      <section class="section magazine-section">
        <div class="wrap">
          <div class="magazine-stage">
            <button type="button" class="magazine-arrow magazine-arrow-prev" aria-label="Previous page" disabled>${ARROW_ICONS.prev}</button>
            <div class="magazine-viewer" id="magazineFlipbook-${index}"></div>
            <button type="button" class="magazine-arrow magazine-arrow-next" aria-label="Next page" disabled>${ARROW_ICONS.next}</button>
          </div>
        </div>
      </section>`;
  }

  async function loadIssueIntoViewer(issue, container) {
    const stage = container.closest(".magazine-stage");
    const prevBtn = stage ? stage.querySelector(".magazine-arrow-prev") : null;
    const nextBtn = stage ? stage.querySelector(".magazine-arrow-next") : null;

    const statusEl = document.createElement("div");
    statusEl.className = "magazine-status";
    container.appendChild(statusEl);
    const setStatus = (text) => { statusEl.textContent = text; };

    setStatus("Loading this issue…");

    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;

    let pdf;
    try {
      pdf = await window.pdfjsLib.getDocument(issue.url).promise;
    } catch (err) {
      setStatus("Couldn't load the magazine PDF.");
      return;
    }

    try {
      const images = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        setStatus(`Preparing page ${i} of ${pdf.numPages}…`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        images.push(canvas.toDataURL("image/jpeg", 0.85));
      }

      statusEl.remove();
      const flipEl = document.createElement("div");
      flipEl.className = "magazine-flip";
      container.appendChild(flipEl);

      const firstImg = new Image();
      firstImg.onload = () => {
        const pageFlip = new St.PageFlip(flipEl, {
          width: firstImg.naturalWidth,
          height: firstImg.naturalHeight,
          size: "stretch",
          minWidth: 320,
          maxWidth: 1600,
          minHeight: 420,
          maxHeight: 2200,
          showCover: false,
          usePortrait: false,
          mobileScrollSupport: true,
        });
        pageFlip.loadFromImages(images);

        function updateArrows() {
          if (!prevBtn || !nextBtn) return;
          const current = pageFlip.getCurrentPageIndex();
          const total = pageFlip.getPageCount();
          prevBtn.disabled = current <= 0;
          nextBtn.disabled = current >= total - 1;
        }
        if (prevBtn) prevBtn.addEventListener("click", () => pageFlip.flipPrev());
        if (nextBtn) nextBtn.addEventListener("click", () => pageFlip.flipNext());
        pageFlip.on("flip", updateArrows);
        updateArrows();
      };
      firstImg.src = images[0];
    } catch (err) {
      setStatus("Couldn't display the magazine.");
    }
  }

  async function init() {
    if (!window.fetchMagazineIssues) {
      root.innerHTML = '<p class="magazine-status">Magazine viewer isn\'t configured yet.</p>';
      return;
    }

    root.innerHTML = '<p class="magazine-status">Loading issues…</p>';
    const issues = await window.fetchMagazineIssues();

    if (!issues.length) {
      root.innerHTML = '<p class="magazine-status">No issues uploaded yet — check back soon.</p>';
      return;
    }

    root.innerHTML = issues.map(issueSectionHTML).join("");
    issues.forEach((issue, index) => {
      const container = document.getElementById(`magazineFlipbook-${index}`);
      if (container) loadIssueIntoViewer(issue, container);
    });
  }

  init();
})();
