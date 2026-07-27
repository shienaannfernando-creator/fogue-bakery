/* ============================================================
   Fogue Bakery — Dashboard: Magazine issues
   Lets the admin upload any number of PDFs, each becoming its own
   flip-through viewer (with its own headline) on book.html. Runs
   alongside js/dashboard.js and shares the same Supabase client
   (window.supabaseClient).
   ============================================================ */
(function () {
  "use strict";

  const sb = window.supabaseClient;
  const $ = (id) => document.getElementById(id);
  if (!sb) return; // dashboard.js already warns the user

  const countEl = $("magazineCount");
  const titleInput = $("mag_title");
  const fileInput = $("mag_file");
  const uploadBtn = $("magUploadBtn");
  const msgEl = $("magazineMsg");
  const listEl = $("magazineList");
  const emptyEl = $("magazineEmpty");
  const loadingEl = $("magazineLoading");

  let currentIssues = [];

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
        month: "short", day: "numeric", year: "numeric",
      });
    } catch (_) {
      return "";
    }
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/`/g, "&#96;");
  }

  function rowHTML(issue) {
    return `
      <div class="recipe-row no-thumb" data-id="${issue.id}">
        <div class="meta">
          <h3>${escapeHtml(issue.title)}</h3>
          <div class="tags">
            <span class="tag-pill">${escapeHtml(fmtDate(issue.createdAt))}</span>
          </div>
        </div>
        <div class="row-actions">
          <a class="btn btn-ghost" href="${escapeAttr(issue.url)}" target="_blank" rel="noopener">View PDF ↗</a>
          <button class="btn btn-danger" data-action="delete" data-id="${issue.id}">Delete</button>
        </div>
      </div>`;
  }

  let loaded = false;
  async function loadPanel() {
    loadingEl.classList.remove("hidden");
    emptyEl.classList.add("hidden");
    listEl.innerHTML = "";
    countEl.textContent = "Loading…";

    currentIssues = await window.fetchMagazineIssues();
    loaded = true;
    loadingEl.classList.add("hidden");

    countEl.textContent =
      currentIssues.length + (currentIssues.length === 1 ? " issue" : " issues");

    if (!currentIssues.length) {
      emptyEl.classList.remove("hidden");
      return;
    }
    listEl.innerHTML = currentIssues.map(rowHTML).join("");
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

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="delete"]');
    if (!btn) return;
    const issue = currentIssues.find((i) => i.id === btn.dataset.id);
    if (issue) deleteIssue(issue);
  });

  async function deleteIssue(issue) {
    if (!confirm(`Delete “${issue.title}”? This can't be undone.`)) return;
    const { error } = await sb.from("magazine_issues").delete().eq("id", issue.id);
    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }
    // best-effort: remove the uploaded PDF from storage too
    try {
      await sb.storage.from(window.MAGAZINE_BUCKET).remove([issue.pdfPath]);
    } catch (_) {
      /* non-fatal */
    }
    loadPanel();
  }

  uploadBtn.addEventListener("click", async () => {
    clearMsg();
    const title = titleInput.value.trim();
    const file = fileInput.files && fileInput.files[0];
    if (!title) {
      showMsg("Give this issue a title first.", "error");
      return;
    }
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
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
      const { error: uploadError } = await sb.storage
        .from(window.MAGAZINE_BUCKET)
        .upload(path, file, { cacheControl: "31536000", contentType: "application/pdf" });
      if (uploadError) throw uploadError;

      const sortOrder = currentIssues.length
        ? Math.max(...currentIssues.map((i) => i.sortOrder)) + 1
        : 0;
      const { error: insertError } = await sb
        .from("magazine_issues")
        .insert({ title, pdf_path: path, sort_order: sortOrder });
      if (insertError) throw insertError;

      titleInput.value = "";
      fileInput.value = "";
      showMsg("Issue added — it'll appear on the Magazine page in a moment.", "ok");
      loaded = false;
      loadPanel();
    } catch (err) {
      showMsg(err.message || String(err), "error");
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Add issue";
    }
  });
})();
