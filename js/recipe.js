/* Renders a single recipe page from ?id= against the shared RECIPES data. */
(function () {
  const root = document.getElementById("recipeRoot");
  if (!root) return;

  root.innerHTML =
    '<div class="wrap recipe-missing"><p>Loading recipe…</p></div>';

  window.onRecipesReady(render);

  function render() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const recipe = (window.RECIPES || []).find((r) => r.id === id);

  if (!recipe) {
    root.innerHTML = `
      <div class="wrap recipe-missing">
        <h1 class="serif">Recipe not found</h1>
        <p>We couldn't find that one — it may have been renamed or removed.</p>
        <a href="recipes.html" class="pill">browse all recipes</a>
      </div>`;
    return;
  }

  document.title = `${recipe.title} — Fogue`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", recipe.excerpt);

  const catSlug = encodeURIComponent(recipe.category);

  // Related: same category, then fill with others, excluding self.
  const all = window.RECIPES || [];
  const related = all
    .filter((r) => r.id !== recipe.id && r.category === recipe.category)
    .concat(all.filter((r) => r.id !== recipe.id && r.category !== recipe.category))
    .slice(0, 3);

  const ing = recipe.ingredients.map((i) => `<li>${i}</li>`).join("");
  const steps = recipe.steps
    .map((s, idx) => `<li><span class="step-num">${idx + 1}</span><p>${s}</p></li>`)
    .join("");
  const allPhotos = [recipe.image].concat(Array.isArray(recipe.gallery) ? recipe.gallery : []).filter(Boolean);
  const galleryCols = Math.min(allPhotos.length, 4);
  const galleryHtml = `<div class="wrap recipe-gallery${allPhotos.length === 1 ? " solo" : ""}" style="grid-template-columns: repeat(${galleryCols}, 1fr);">${allPhotos
    .map((url) => `<img src="${url}" alt="${recipe.title}" loading="lazy" />`)
    .join("")}</div>`;

  const relatedCards = related
    .map(
      (r) => `
      <a class="card" href="recipe?id=${r.id}">
        <span class="card-img"><img src="${r.image}" alt="${r.title}" loading="lazy" /></span>
        <span class="cat">${r.category}</span>
        <h3 class="serif">${r.title}</h3>
      </a>`
    )
    .join("");

  root.innerHTML = `
    <article class="recipe">
      <div class="wrap recipe-head">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a href="index.html">Home</a>
          <span>/</span>
          <a href="recipes.html#${catSlug}">${recipe.category}</a>
        </nav>
        <p class="eyebrow">${recipe.category}</p>
        <h1 class="serif recipe-title">${recipe.title}</h1>
        <p class="recipe-intro">${recipe.intro}</p>
        <ul class="recipe-meta">
          <li><span>Time</span><strong>${recipe.time}</strong></li>
          <li><span>Yield</span><strong>${recipe.yield}</strong></li>
          <li><span>Level</span><strong>${recipe.difficulty}</strong></li>
        </ul>
      </div>

      ${galleryHtml}

      <div class="wrap recipe-body">
        <div class="recipe-ingredients">
          <h2 class="serif">Ingredients</h2>
          <ul>${ing}</ul>
        </div>
        <div class="recipe-steps">
          <h2 class="serif">Method</h2>
          <ol>${steps}</ol>
          <a href="recipes.html" class="link-arrow back-link"><span class="arr">&larr;</span> all recipes</a>
        </div>
      </div>
    </article>

    <section class="section related">
      <div class="wrap">
        <div class="section-head">
          <h2 class="serif">you might also love</h2>
          <a href="recipes.html" class="link-arrow">see all <span class="arr">&rarr;</span></a>
        </div>
        <div class="grid-3">${relatedCards}</div>
      </div>
    </section>`;
  }
})();
