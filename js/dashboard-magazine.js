/* ============================================================
   Fogue Bakery — Dashboard: Magazine PDF
   Lets the admin upload a single PDF that powers the flip-through
   viewer on book.html. The file always lands at the same storage
   path, so uploading a new one simply replaces the current issue.
   Runs alongside js/dashboard.js and shares the same Supabase
   client (window.supabaseClient).
   ============================================================ */
(function () {
  "use strict";

  const sb = window.supabaseClient;
  const $ = (id) => document.getElementById(id);
  if (!sb) return; // dashboard.js already warns the user

  const statusEl = $("magazineStatus");
  const fileInput = $("mag_file");
  const uploadBtn = $("magUploadBtn");
  const msgEl = $("magazineMsg");
  const viewLink = $("magazineViewLink");

  function showMsg(text, kind) {
    msgEl.textContent = text;
    msgEl.className = "msg show " + (kind || "");
  }
  function clearMsg() {
    msgEl.textContent = "";
    msgEl.className = "msg";
  }
  function fmtDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
      });
    } catch (_) {
      return "";
    }
  }

  let loaded = false;
  async function loadPanel() {
    statusEl.textContent = "Checking…";
    viewLink.classList.add("hidden");
    const info = await window.fetchMagazineInfo();
    loaded = true;
    if (!info) {
      statusEl.textContent = "No magazine uploaded yet.";
      return;
    }
    const when = fmtDate(info.updatedAt);
    statusEl.textContent = "Current issue" + (when ? " — last updated " + when : "") + ".";
    viewLink.href = info.url;
    viewLink.classList.remove("hidden");
  }
  window.loadMagazinePanel = function () {
    if (!loaded) loadPanel();
  };

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      const panel = $("panelMagazine");
      if (panel && !panel.classList.contains("hidden")) loadPanel();
    } else {
      loaded = false;
    }
  });

  uploadBtn.addEventListener("click", async () => {
    clearMsg();
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      showMsg("Choose a PDF file first.", "error");
      return;
    }
    if (file.type !== "application/pdf") {
      showMsg("Please choose a PDF file.", "error");
      return;
    }
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading…";
    try {
      const { error } = await sb.storage
        .from(window.MAGAZINE_BUCKET)
        .upload(window.MAGAZINE_PDF_PATH, file, {
          cacheControl: "60",
          upsert: true,
          contentType: "application/pdf",
        });
      if (error) throw error;
      fileInput.value = "";
      showMsg("Magazine updated — it'll appear on the Magazine page in a moment.", "ok");
      loaded = false;
      loadPanel();
    } catch (err) {
      showMsg(err.message || String(err), "error");
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload magazine PDF";
    }
  });
})();
