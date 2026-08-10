/* ============================================================
   Fogue Bakery — Dashboard: Blog articles
   Adds the Articles tab: list + add/edit modal with cover-image
   upload. Runs alongside js/dashboard.js and shares the same
   Supabase client (window.supabaseClient).
   ============================================================ */
(function () {
  "use strict";

  const sb = window.supabaseClient;
  const $ = (id) => document.getElementById(id);
  if (!sb) return; // dashboard.js already warns the user

  /* ---------- tab switching ---------- */
  const tabs = {
    recipes: { tab: $("tabRecipes"), panel: $("panelRecipes") },
    articles: { tab: $("tabArticles"), panel: $("panelArticles") },
    magazine: { tab: $("tabMagazine"), panel: $("panelMagazine") },
  };

  function activate(name) {
    Object.keys(tabs).forEach((key) => {
      const isActive = key === name;
      tabs[key].tab.classList.toggle("active", isActive);
      tabs[key].tab.setAttribute("aria-selected", String(isActive));
      tabs[key].panel.classList.toggle("hidden", !isActive);
    });
    if (name === "articles" && !loadedOnce) loadList();
    if (name === "magazine" && window.loadMagazinePanel) window.loadMagazinePanel();
  }
  Object.keys(tabs).forEach((key) =>
    tabs[key].tab.addEventListener("click", () => activate(key))
  );

  /* ---------- load articles when signed in ---------- */
  let loadedOnce = false;
  sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      // panel may be hidden; load lazily when the tab is first opened,
      // but refresh now if it's already the active tab.
      if (!panelArticles.classList.contains("hidden")) loadList();
    } else {
      loadedOnce = false;
    }
  });

  const listEl = $("articleList");
  const emptyEl = $("articleEmpty");
  const loadingEl = $("articleLoading");
  let current = [];

  async function loadList() {
    loadingEl.classList.remove("hidden");
    emptyEl.classList.add("hidden");
    listEl.innerHTML = "";

    const { data, error } = await sb
      .from("articles")
      .select("*")
      .order("created_at", { ascending: false });

    loadingEl.classList.add("hidden");
    loadedOnce = true;

    if (error) {
      listEl.innerHTML =
        '<div class="empty-state">Could not load articles: ' +
        escapeHtml(error.message) +
        ". Did you run supabase/articles.sql?</div>";
      return;
    }

    current = data || [];
    $("articleCount").textContent =
      current.length + (current.length === 1 ? " article" : " articles");

    if (!current.length) {
      emptyEl.classList.remove("hidden");
      return;
    }
    listEl.innerHTML = current.map(rowHTML).join("");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      });
    } catch (_) { return ""; }
  }

  function rowHTML(a) {
    return `
      <div class="recipe-row" data-id="${a.id}">
        <img class="thumb" src="${escapeAttr(a.image || "")}" alt="" onerror="this.style.visibility='hidden'" />
        <div class="meta">
          <h3>${escapeHtml(a.title)}</h3>
          <div class="tags">
            <span class="tag-pill">${escapeHtml(fmtDate(a.created_at))}</span>
            ${a.published ? '<span class="tag-pill feat">Published</span>' : '<span class="tag-pill">Draft</span>'}
          </div>
        </div>
        <div class="row-actions">
          <a class="btn btn-ghost" href="../article?id=${encodeURIComponent(a.slug)}" target="_blank" rel="noopener">View</a>
          <button class="btn btn-ghost" data-action="edit" data-id="${a.id}">Edit</button>
          <button class="btn btn-danger" data-action="delete" data-id="${a.id}">Delete</button>
        </div>
      </div>`;
  }

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const a = current.find((x) => x.id === btn.dataset.id);
    if (btn.dataset.action === "edit") openModal(a);
    if (btn.dataset.action === "delete") remove(a);
  });

  async function remove(a) {
    if (!a) return;
    if (!confirm(`Delete “${a.title}”? This can't be undone.`)) return;
    const { error } = await sb.from("articles").delete().eq("id", a.id);
    if (error) { alert("Delete failed: " + error.message); return; }
    removeStoredImage(a.image);
    loadList();
  }

  /* ---------- modal ---------- */
  const backdrop = $("articleBackdrop");
  const form = $("articleForm");
  const formMsg = $("articleFormMsg");
  const imgPreview = $("aImgPreview");
  const fileInput = $("a_image");
  let editingImage = "";

  $("addArticleBtn").addEventListener("click", () => openModal(null));
  $("articleModalClose").addEventListener("click", close);
  $("articleCancelBtn").addEventListener("click", close);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop.classList.contains("open")) close();
  });

  function openModal(a) {
    clearMsg(formMsg);
    form.reset();
    fileInput.value = "";
    editingImage = "";

    if (a) {
      $("articleModalTitle").textContent = "Edit article";
      $("a_id").value = a.id;
      $("a_title").value = a.title || "";
      $("a_excerpt").value = a.excerpt || "";
      $("a_body").value = a.body || "";
      $("a_published").checked = a.published !== false;
      editingImage = a.image || "";
      setPreview(editingImage);
    } else {
      $("articleModalTitle").textContent = "New article";
      $("a_id").value = "";
      $("a_published").checked = true;
      setPreview("");
    }
    backdrop.classList.add("open");
    document.body.style.overflow = "hidden";
    $("a_title").focus();
  }
  function close() {
    backdrop.classList.remove("open");
    document.body.style.overflow = "";
  }

  function setPreview(url) {
    if (url) {
      imgPreview.src = url;
      imgPreview.classList.remove("empty");
    } else {
      imgPreview.removeAttribute("src");
      imgPreview.classList.add("empty");
    }
  }
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) {
      setPreview(editingImage);
      return;
    }
    try {
      setPreview(URL.createObjectURL(await convertHeicIfNeeded(f)));
    } catch (_) {
      setPreview(URL.createObjectURL(f)); // fall back to raw file if conversion fails
    }
  });

  /* ---------- insert photo into article body ---------- */
  const bodyEl = $("a_body");
  const bodyImageInput = $("a_body_image");
  $("aInsertImageBtn").addEventListener("click", () => bodyImageInput.click());
  bodyImageInput.addEventListener("change", async () => {
    const f = bodyImageInput.files && bodyImageInput.files[0];
    bodyImageInput.value = "";
    if (!f) return;
    const btn = $("aInsertImageBtn");
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Uploading…";
    try {
      const url = await uploadImage(f);
      const start = bodyEl.selectionStart ?? bodyEl.value.length;
      const end = bodyEl.selectionEnd ?? bodyEl.value.length;
      const before = bodyEl.value.slice(0, start);
      const after = bodyEl.value.slice(end);
      const leadIn = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
      const leadOut = after && !after.startsWith("\n\n") ? (after.startsWith("\n") ? "\n" : "\n\n") : "";
      const snippet = `${leadIn}![](${url})${leadOut}`;

      bodyEl.value = before + snippet + after;
      const cursor = (before + snippet).length;
      bodyEl.focus();
      bodyEl.setSelectionRange(cursor, cursor);
    } catch (err) {
      alert(err.message || String(err));
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  function slugify(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }
  async function uniqueSlug(base, ownId) {
    let slug = base || "post";
    let n = 1;
    while (true) {
      const { data } = await sb
        .from("articles")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!data || data.id === ownId) return slug;
      n += 1;
      slug = `${base}-${n}`;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg(formMsg);
    const btn = $("articleSaveBtn");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      const id = $("a_id").value || null;
      const title = $("a_title").value.trim();
      const body = $("a_body").value.trim();
      if (!title || !body) throw new Error("Title and article text are required.");

      let imageUrl = editingImage;
      const file = fileInput.files && fileInput.files[0];
      if (file) imageUrl = await uploadImage(file);

      const slug = await uniqueSlug(slugify(title), id);
      const payload = {
        slug,
        title,
        image: imageUrl || null,
        excerpt: $("a_excerpt").value.trim(),
        body,
        published: $("a_published").checked,
      };

      let error;
      if (id) ({ error } = await sb.from("articles").update(payload).eq("id", id));
      else ({ error } = await sb.from("articles").insert(payload));
      if (error) throw error;

      close();
      loadList();
    } catch (err) {
      showMsg(formMsg, err.message || String(err), "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save article";
    }
  });

  async function uploadImage(file) {
    file = await convertHeicIfNeeded(file);
    const bucket = window.ARTICLE_BUCKET;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage
      .from(bucket)
      .upload(path, file, { cacheControl: "31536000", upsert: false });
    if (error) throw new Error("Image upload failed: " + error.message);
    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function removeStoredImage(url) {
    if (!url) return;
    const bucket = window.ARTICLE_BUCKET;
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    try {
      await sb.storage.from(bucket).remove([url.slice(idx + marker.length)]);
    } catch (_) { /* non-fatal */ }
  }

  /* ---------- helpers ---------- */
  function showMsg(el, text, kind) {
    el.textContent = text;
    el.className = "msg show " + (kind || "");
  }
  function clearMsg(el) {
    el.textContent = "";
    el.className = "msg";
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
