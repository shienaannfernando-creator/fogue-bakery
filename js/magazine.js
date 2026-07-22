/* ============================================================
   Fogue Bakery — flip-through magazine viewer (book.html)
   Loads the PDF uploaded via the dashboard, rasterizes each page
   with pdf.js, then hands the page images to StPageFlip for the
   page-turning animation. Both libraries are loaded from a CDN
   only on this page — see the <script> tags in book.html.
   ============================================================ */
(function () {
  "use strict";

  const container = document.getElementById("magazineFlipbook");
  if (!container) return;

  const PDFJS_VERSION = "3.11.174";
  const statusEl = document.createElement("div");
  statusEl.className = "magazine-status";
  container.appendChild(statusEl);

  function setStatus(text) {
    statusEl.textContent = text;
  }

  async function init() {
    if (!window.fetchMagazineInfo) {
      setStatus("Magazine viewer isn't configured yet.");
      return;
    }

    setStatus("Loading this issue…");
    const info = await window.fetchMagazineInfo();
    if (!info) {
      setStatus("No issue uploaded yet — check back soon.");
      return;
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;

    let pdf;
    try {
      pdf = await window.pdfjsLib.getDocument(info.url).promise;
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
      };
      firstImg.src = images[0];
    } catch (err) {
      setStatus("Couldn't display the magazine.");
    }
  }

  init();
})();
