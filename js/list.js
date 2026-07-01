/* Recipes listing: category filter chips + grid, synced to the URL hash. */
(function () {
  const grid = document.getElementById("recipeGrid");
  const filterBar = document.getElementById("filterBar");
  const noResults = document.getElementById("noResults");
  if (!grid || !filterBar) return;

  grid.innerHTML = '<p class="no-results">Loading recipes…</p>';

  window.onRecipesReady(init);

  function init() {
  const recipes = window.RECIPES || [];
  const categories = ["All", ...new Set(recipes.map((r) => r.category))];

  function cardHTML(r) {
    return `
      <a class="card reveal is-in" href="recipe?id=${r.id}">
        <span class="card-img"><img src="${r.image}" alt="${r.title}" loading="lazy" /></span>
        <span class="cat">${r.category}</span>
        <h3 class="serif">${r.title}</h3>
        <p class="card-excerpt">${r.excerpt}</p>
      </a>`;
  }

  function render(active) {
    // chips
    filterBar.innerHTML = categories
      .map(
        (c) =>
          `<button class="chip${c === active ? " active" : ""}" data-cat="${c}">${c}</button>`
      )
      .join("");

    const list =
      active === "All" ? recipes : recipes.filter((r) => r.category === active);

    grid.innerHTML = list.map(cardHTML).join("");
    noResults.hidden = list.length > 0;
  }

  function catFromHash() {
    const raw = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!raw || raw === "summer") return "All";
    const match = categories.find((c) => c.toLowerCase() === raw.toLowerCase());
    return match || "All";
  }

  function setActive(cat) {
    render(cat);
    const newHash = cat === "All" ? "" : "#" + encodeURIComponent(cat);
    if (window.location.hash !== newHash) {
      history.replaceState(null, "", window.location.pathname + newHash);
    }
  }

  filterBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    setActive(btn.dataset.cat);
    window.scrollTo({ top: filterBar.offsetTop - 120, behavior: "smooth" });
  });

  window.addEventListener("hashchange", () => render(catFromHash()));

  render(catFromHash());
  }
})();
