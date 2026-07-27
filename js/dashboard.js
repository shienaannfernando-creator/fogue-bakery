/* ============================================================
   Fogue Bakery — Dashboard app
   Handles: auth (login / password reset), listing recipes,
   and the add/edit modal with image upload to Supabase Storage.
   Depends on js/supabase.js (window.supabaseClient, STORAGE_BUCKET).
   ============================================================ */
(function () {
  "use strict";

  const sb = window.supabaseClient;
  const $ = (id) => document.getElementById(id);

  /* ---------- views ---------- */
  const authView = $("authView");
  const appView = $("appView");
  const authMsg = $("authMsg");

  const loginForm = $("loginForm");
  const resetForm = $("resetForm");
  const newPassForm = $("newPassForm");
  const authSub = $("authSub");

  function showMsg(el, text, kind) {
    el.textContent = text;
    el.className = "msg show " + (kind || "");
  }
  function clearMsg(el) {
    el.textContent = "";
    el.className = "msg";
  }

  if (!sb) {
    showMsg(
      authMsg,
      "Supabase isn't configured yet. Add your Project URL and anon key in js/supabase.js.",
      "error"
    );
    return;
  }

  /* ---------- auth flows ---------- */
  function showAuthForm(which) {
    loginForm.classList.toggle("hidden", which !== "login");
    resetForm.classList.toggle("hidden", which !== "reset");
    newPassForm.classList.toggle("hidden", which !== "new");
    clearMsg(authMsg);
    if (which === "login") authSub.textContent = "Sign in to manage recipes";
    if (which === "reset") authSub.textContent = "Reset your password";
    if (which === "new") authSub.textContent = "Choose a new password";
  }

  $("showReset").addEventListener("click", () => showAuthForm("reset"));
  $("backToLogin").addEventListener("click", () => showAuthForm("login"));

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("loginBtn");
    btn.disabled = true;
    clearMsg(authMsg);
    const { error } = await sb.auth.signInWithPassword({
      email: $("loginEmail").value.trim(),
      password: $("loginPassword").value,
    });
    btn.disabled = false;
    if (error) {
      showMsg(authMsg, error.message, "error");
      return;
    }
    // onAuthStateChange will switch to the app view.
  });

  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("resetBtn");
    btn.disabled = true;
    clearMsg(authMsg);
    const email = $("resetEmail").value.trim();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    btn.disabled = false;
    if (error) {
      showMsg(authMsg, error.message, "error");
      return;
    }
    showMsg(
      authMsg,
      "Check your inbox — if an account exists for that email, a reset link is on its way.",
      "ok"
    );
  });

  newPassForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("newPassBtn");
    btn.disabled = true;
    clearMsg(authMsg);
    const { error } = await sb.auth.updateUser({ password: $("newPass").value });
    btn.disabled = false;
    if (error) {
      showMsg(authMsg, error.message, "error");
      return;
    }
    showMsg(authMsg, "Password updated. You're signed in.", "ok");
    // Session is active now; move to the app.
    setTimeout(enterApp, 700);
  });

  $("logoutBtn").addEventListener("click", async () => {
    await sb.auth.signOut();
  });

  /* When a user clicks the reset email, Supabase fires a PASSWORD_RECOVERY event. */
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      authView.classList.remove("hidden");
      appView.classList.add("hidden");
      showAuthForm("new");
      return;
    }
    if (session) {
      enterApp();
    } else {
      authView.classList.remove("hidden");
      appView.classList.add("hidden");
      showAuthForm("login");
    }
  });

  async function enterApp() {
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) return;
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    $("whoami").textContent = session.user.email || "";
    loadList();
  }

  /* ============================================================
     RECIPE LIST
     ============================================================ */
  const listEl = $("recipeList");
  const listEmpty = $("listEmpty");
  const listLoading = $("listLoading");
  let currentRecipes = [];

  async function loadList() {
    listLoading.classList.remove("hidden");
    listEmpty.classList.add("hidden");
    listEl.innerHTML = "";

    const { data, error } = await sb
      .from("recipes")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    listLoading.classList.add("hidden");

    if (error) {
      listEl.innerHTML =
        '<div class="empty-state">Could not load recipes: ' +
        escapeHtml(error.message) +
        "</div>";
      return;
    }

    currentRecipes = data || [];
    $("recipeCount").textContent =
      currentRecipes.length +
      (currentRecipes.length === 1 ? " recipe" : " recipes");

    if (!currentRecipes.length) {
      listEmpty.classList.remove("hidden");
      return;
    }

    listEl.innerHTML = currentRecipes.map(rowHTML).join("");
  }

  function rowHTML(r) {
    const img = r.image || "";
    return `
      <div class="recipe-row" data-id="${r.id}">
        <img class="thumb" src="${escapeAttr(img)}" alt="" onerror="this.style.visibility='hidden'" />
        <div class="meta">
          <h3>${escapeHtml(r.title)}</h3>
          <div class="tags">
            <span class="tag-pill">${escapeHtml(r.category || "—")}</span>
            ${r.difficulty ? `<span class="tag-pill">${escapeHtml(r.difficulty)}</span>` : ""}
            ${r.featured ? '<span class="tag-pill feat">Featured</span>' : ""}
          </div>
        </div>
        <div class="row-actions">
          <a class="btn btn-ghost" href="../recipe?id=${encodeURIComponent(r.slug)}" target="_blank" rel="noopener">View</a>
          <button class="btn btn-ghost" data-action="edit" data-id="${r.id}">Edit</button>
          <button class="btn btn-danger" data-action="delete" data-id="${r.id}">Delete</button>
        </div>
      </div>`;
  }

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const recipe = currentRecipes.find((r) => r.id === id);
    if (btn.dataset.action === "edit") openModal(recipe);
    if (btn.dataset.action === "delete") deleteRecipe(recipe);
  });

  async function deleteRecipe(r) {
    if (!r) return;
    if (!confirm(`Delete “${r.title}”? This can't be undone.`)) return;
    const { error } = await sb.from("recipes").delete().eq("id", r.id);
    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }
    // best-effort: remove its uploaded photos if they lived in our bucket
    removeStoredImage(r.image);
    (r.gallery || []).forEach(removeStoredImage);
    loadList();
  }

  /* ============================================================
     ADD / EDIT MODAL
     ============================================================ */
  const backdrop = $("modalBackdrop");
  const form = $("recipeForm");
  const formMsg = $("formMsg");
  const imgPreview = $("imgPreview");
  const fileInput = $("f_image");
  let editingImage = ""; // existing image URL when editing

  /* ---------- additional photos (gallery) ---------- */
  const galleryGrid = $("galleryGrid");
  const galleryInput = $("f_gallery");
  let existingGallery = []; // URLs already saved, kept unless removed
  let newGalleryFiles = []; // File objects picked this session, kept unless removed

  function renderGallery() {
    const existingChips = existingGallery.map(
      (url, i) => `
        <div class="gallery-chip" data-kind="existing" data-index="${i}">
          <img src="${escapeAttr(url)}" alt="" />
          <button type="button" class="chip-remove" aria-label="Remove photo">&times;</button>
        </div>`
    );
    const newChips = newGalleryFiles.map(
      (file, i) => `
        <div class="gallery-chip" data-kind="new" data-index="${i}">
          <img src="${URL.createObjectURL(file)}" alt="" />
          <button type="button" class="chip-remove" aria-label="Remove photo">&times;</button>
        </div>`
    );
    galleryGrid.innerHTML = existingChips.concat(newChips).join("");
  }

  galleryGrid.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip-remove");
    if (!btn) return;
    const chip = btn.closest(".gallery-chip");
    const index = Number(chip.dataset.index);
    if (chip.dataset.kind === "existing") existingGallery.splice(index, 1);
    else newGalleryFiles.splice(index, 1);
    renderGallery();
  });

  galleryInput.addEventListener("change", () => {
    newGalleryFiles = newGalleryFiles.concat(Array.from(galleryInput.files || []));
    galleryInput.value = "";
    renderGallery();
  });

  $("addBtn").addEventListener("click", () => openModal(null));
  $("modalClose").addEventListener("click", closeModal);
  $("cancelBtn").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop.classList.contains("open")) closeModal();
  });

  function openModal(recipe) {
    clearMsg(formMsg);
    form.reset();
    fileInput.value = "";
    galleryInput.value = "";
    editingImage = "";
    existingGallery = [];
    newGalleryFiles = [];

    if (recipe) {
      $("modalTitle").textContent = "Edit recipe";
      $("f_id").value = recipe.id;
      $("f_title").value = recipe.title || "";
      $("f_category").value = recipe.category || "";
      $("f_difficulty").value = recipe.difficulty || "Easy";
      $("f_time").value = recipe.time || "";
      $("f_yield").value = recipe.yield || "";
      $("f_excerpt").value = recipe.excerpt || "";
      $("f_intro").value = recipe.intro || "";
      $("f_featured").checked = !!recipe.featured;
      editingImage = recipe.image || "";
      setPreview(editingImage);
      existingGallery = (recipe.gallery || []).slice();
      renderListInputs("ingredientsList", recipe.ingredients || [], "ingredient");
      renderListInputs("stepsList", recipe.steps || [], "step");
    } else {
      $("modalTitle").textContent = "New recipe";
      $("f_id").value = "";
      setPreview("");
      renderListInputs("ingredientsList", [""], "ingredient");
      renderListInputs("stepsList", [""], "step");
    }
    renderGallery();

    backdrop.classList.add("open");
    document.body.style.overflow = "hidden";
    $("f_title").focus();
  }

  function closeModal() {
    backdrop.classList.remove("open");
    document.body.style.overflow = "";
  }

  function setPreview(url) {
    if (url) {
      imgPreview.src = url;
      imgPreview.classList.remove("empty");
      imgPreview.alt = "Recipe photo preview";
    } else {
      imgPreview.removeAttribute("src");
      imgPreview.classList.add("empty");
      imgPreview.alt = "";
    }
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      setPreview(editingImage);
      return;
    }
    try {
      setPreview(URL.createObjectURL(await convertHeicIfNeeded(file)));
    } catch (_) {
      setPreview(URL.createObjectURL(file)); // fall back to raw file if conversion fails
    }
  });

  /* dynamic ingredient/step inputs */
  document.querySelectorAll(".li-add").forEach((btn) => {
    btn.addEventListener("click", () => {
      addListRow(btn.dataset.target, "", btn.dataset.kind);
      const wrap = document.getElementById(btn.dataset.target);
      const inputs = wrap.querySelectorAll("input, textarea");
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
  });

  function renderListInputs(targetId, values, kind) {
    const wrap = $(targetId);
    wrap.innerHTML = "";
    const list = values.length ? values : [""];
    list.forEach((v) => addListRow(targetId, v, kind));
  }

  function addListRow(targetId, value, kind) {
    const wrap = $(targetId);
    const row = document.createElement("div");
    row.className = "li-row";
    const field =
      kind === "step"
        ? `<textarea rows="2" placeholder="Describe this step…">${escapeHtml(value)}</textarea>`
        : `<input type="text" placeholder="e.g. 1 cup flour" value="${escapeAttr(value)}" />`;
    row.innerHTML = `${field}<button type="button" class="li-remove" aria-label="Remove">&times;</button>`;
    row.querySelector(".li-remove").addEventListener("click", () => {
      row.remove();
      if (!wrap.querySelector(".li-row")) addListRow(targetId, "", kind);
    });
    wrap.appendChild(row);
  }

  function collectList(targetId) {
    return Array.from($(targetId).querySelectorAll("input, textarea"))
      .map((el) => el.value.trim())
      .filter(Boolean);
  }

  /* slug helper — keeps recipe?id= links pretty and stable */
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
    let slug = base || "recipe";
    let n = 1;
    // ensure uniqueness against other rows
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data } = await sb
        .from("recipes")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!data || data.id === ownId) return slug;
      n += 1;
      slug = `${base}-${n}`;
    }
  }

  /* ---------- save ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg(formMsg);
    const saveBtn = $("saveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {
      const id = $("f_id").value || null;
      const title = $("f_title").value.trim();
      const category = $("f_category").value.trim();

      if (!title || !category) {
        throw new Error("Title and category are required.");
      }

      // upload image if a new file was chosen
      let imageUrl = editingImage;
      const file = fileInput.files && fileInput.files[0];
      if (file) {
        imageUrl = await uploadImage(file);
      }

      // upload any newly-added gallery photos, then combine with the ones kept from before
      const uploadedGalleryUrls = await Promise.all(newGalleryFiles.map(uploadImage));
      const gallery = existingGallery.concat(uploadedGalleryUrls);

      const base = slugify(title);
      const slug = await uniqueSlug(base, id);

      const payload = {
        slug,
        title,
        category,
        image: imageUrl || null,
        excerpt: $("f_excerpt").value.trim(),
        intro: $("f_intro").value.trim(),
        time: $("f_time").value.trim(),
        yield: $("f_yield").value.trim(),
        difficulty: $("f_difficulty").value,
        featured: $("f_featured").checked,
        ingredients: collectList("ingredientsList"),
        steps: collectList("stepsList"),
        gallery,
      };

      let error;
      if (id) {
        ({ error } = await sb.from("recipes").update(payload).eq("id", id));
      } else {
        ({ error } = await sb.from("recipes").insert(payload));
      }
      if (error) throw error;

      closeModal();
      loadList();
    } catch (err) {
      showMsg(formMsg, err.message || String(err), "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save recipe";
    }
  });

  async function uploadImage(file) {
    file = await convertHeicIfNeeded(file);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage
      .from(window.STORAGE_BUCKET)
      .upload(path, file, { cacheControl: "31536000", upsert: false });
    if (error) throw new Error("Image upload failed: " + error.message);
    const { data } = sb.storage.from(window.STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  /* Best-effort cleanup: delete an image from our bucket when a recipe is removed. */
  async function removeStoredImage(url) {
    if (!url) return;
    const marker = `/storage/v1/object/public/${window.STORAGE_BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return; // external/seed image — leave it alone
    const path = url.slice(idx + marker.length);
    try {
      await sb.storage.from(window.STORAGE_BUCKET).remove([path]);
    } catch (_) {
      /* non-fatal */
    }
  }

  /* ---------- tiny escapers ---------- */
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }

  /* kick things off — onAuthStateChange fires on load with the current session */
})();
