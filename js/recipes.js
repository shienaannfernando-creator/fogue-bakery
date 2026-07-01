/* ============================================================
   Fogue Bakery — recipe data loader
   Recipes now live in Supabase (see supabase/schema.sql). This file
   fetches them once, exposes them on window.RECIPES / window.CATEGORIES,
   and fires a "recipes:ready" event so the render scripts can run.

   The rendering scripts (main.js, list.js, recipe.js) wait for that
   event via the onRecipesReady() helper below.
   ============================================================ */
(function () {
  window.RECIPES = window.RECIPES || [];
  window.CATEGORIES = window.CATEGORIES || [];
  window.RECIPES_READY = false;

  // Register a callback to run once recipes are loaded (or immediately if already loaded).
  const readyQueue = [];
  window.onRecipesReady = function (cb) {
    if (window.RECIPES_READY) cb();
    else readyQueue.push(cb);
  };

  async function load() {
    let recipes = [];
    try {
      recipes = await window.fetchRecipes();
    } catch (e) {
      console.error("Recipe load failed:", e);
    }
    window.RECIPES = recipes;
    window.CATEGORIES = window.deriveCategories
      ? window.deriveCategories(recipes)
      : [];
    window.RECIPES_READY = true;
    document.dispatchEvent(new CustomEvent("recipes:ready"));
    readyQueue.splice(0).forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error(e);
      }
    });
  }

  // supabase.js must already be loaded (it defines window.fetchRecipes).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
