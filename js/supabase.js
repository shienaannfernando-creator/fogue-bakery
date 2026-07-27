/* ============================================================
   Fogue Bakery — Supabase client + shared data helpers
   Loaded by both the public site and the dashboard.

   >>> FILL IN THE TWO VALUES BELOW <<<
   Find them in your Supabase project:
     Settings → API → Project URL         →  SUPABASE_URL
     Settings → API → Project API keys →  anon / public key  →  SUPABASE_ANON_KEY
   The anon key is safe to expose in the browser; Row Level Security
   (set up in supabase/schema.sql) is what actually protects your data.
   ============================================================ */

const SUPABASE_URL = "https://aqynfaewkqsowozllauf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxeW5mYWV3a3Fzb3dvemxsYXVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODM1NjEsImV4cCI6MjA5ODQ1OTU2MX0.EIIVjJ5-3vwmIGwvlaWJR9Usu02SjNPoI-NqJbyd0AM";

// Requires the supabase-js UMD bundle to be loaded first (see the <script> tags in the HTML).
const supabaseClient =
  window.supabase && SUPABASE_URL && !SUPABASE_URL.includes("YOUR-PROJECT")
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const STORAGE_BUCKET = "recipe-images";

/* ---------- shape a DB row into what the front-end templates expect ----------
   The site was originally written around objects with an `id` used in
   recipe.html?id=… — we map the DB `slug` onto that `id` so nothing else
   in the rendering code has to change. */
function mapRecipe(row) {
  return {
    id: row.slug,
    dbId: row.id,
    title: row.title,
    category: row.category,
    image: row.image || "",
    excerpt: row.excerpt || "",
    intro: row.intro || "",
    time: row.time || "",
    yield: row.yield || "",
    difficulty: row.difficulty || "",
    featured: !!row.featured,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    steps: Array.isArray(row.steps) ? row.steps : [],
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
  };
}

/* Fetch every recipe, ordered the way the site should show them. */
async function fetchRecipes() {
  if (!supabaseClient) {
    console.error("Supabase is not configured — fill in js/supabase.js");
    return [];
  }
  const { data, error } = await supabaseClient
    .from("recipes")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load recipes:", error.message);
    return [];
  }
  return (data || []).map(mapRecipe);
}

/* Fetch a single recipe by its slug (used on recipe.html). */
async function fetchRecipeBySlug(slug) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from("recipes")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("Failed to load recipe:", error.message);
    return null;
  }
  return data ? mapRecipe(data) : null;
}

/* Derive the category rail from whatever categories exist, reusing one
   recipe image per category as its cover. Falls back to a fixed order. */
function deriveCategories(recipes) {
  const preferredOrder = [
    "Cookies",
    "Cakes",
    "Brigadeiros",
    "Ice Cream",
    "Pies & Tarts",
    "Custom",
  ];
  const byCat = new Map();
  recipes.forEach((r) => {
    if (r.category && !byCat.has(r.category)) byCat.set(r.category, r.image);
  });
  const names = Array.from(byCat.keys());
  names.sort((a, b) => {
    const ia = preferredOrder.indexOf(a);
    const ib = preferredOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return names.map((name) => ({ name, image: byCat.get(name) || "" }));
}

/* ---------- blog articles ---------- */
const ARTICLE_BUCKET = "article-images";

function mapArticle(row) {
  return {
    id: row.slug,
    dbId: row.id,
    title: row.title,
    image: row.image || "",
    excerpt: row.excerpt || "",
    body: row.body || "",
    published: row.published !== false,
    createdAt: row.created_at || null,
  };
}

/* Fetch published articles for the public blog, newest first. */
async function fetchArticles() {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from("articles")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load articles:", error.message);
    return [];
  }
  return (data || []).map(mapArticle);
}

/* Fetch one published article by slug. */
async function fetchArticleBySlug(slug) {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) {
    console.error("Failed to load article:", error.message);
    return null;
  }
  return data ? mapArticle(data) : null;
}

/* ---------- magazine issues (flip-through viewers on book.html) ----------
   Each row in magazine_issues points at its own PDF in this bucket, so
   any number of issues can be uploaded and shown side by side. */
const MAGAZINE_BUCKET = "magazine-files";

function mapMagazineIssue(row) {
  const { data: pub } = supabaseClient.storage
    .from(MAGAZINE_BUCKET)
    .getPublicUrl(row.pdf_path);
  return {
    id: row.id,
    title: row.title,
    url: pub.publicUrl,
    pdfPath: row.pdf_path,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at || null,
  };
}

/* Fetch every magazine issue, in the order they should be shown. */
async function fetchMagazineIssues() {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from("magazine_issues")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to load magazine issues:", error.message);
    return [];
  }
  return (data || []).map(mapMagazineIssue);
}

/* ---------- HEIC conversion (iPhone photos) ----------
   Browsers can't render HEIC in an <img> tag, so the dashboard transcodes
   it to JPEG (via the heic2any CDN script) before it ever reaches
   Supabase Storage. Only loaded/used on the dashboard page. */
function isHeicFile(file) {
  const name = (file.name || "").toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

async function convertHeicIfNeeded(file) {
  if (!isHeicFile(file)) return file;
  if (typeof window.heic2any !== "function") {
    throw new Error("HEIC conversion isn't available right now — please convert this photo to JPEG and try again.");
  }
  let converted;
  try {
    converted = await window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  } catch (err) {
    throw new Error(
      "This HEIC photo couldn't be converted (it may be a Live Photo, burst shot, or an unusual HEIC variant browsers can't decode). Please export it as JPEG or PNG and try again."
    );
  }
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

if (typeof window !== "undefined") {
  window.supabaseClient = supabaseClient;
  window.STORAGE_BUCKET = STORAGE_BUCKET;
  window.ARTICLE_BUCKET = ARTICLE_BUCKET;
  window.MAGAZINE_BUCKET = MAGAZINE_BUCKET;
  window.fetchRecipes = fetchRecipes;
  window.fetchRecipeBySlug = fetchRecipeBySlug;
  window.deriveCategories = deriveCategories;
  window.mapRecipe = mapRecipe;
  window.fetchArticles = fetchArticles;
  window.fetchArticleBySlug = fetchArticleBySlug;
  window.mapArticle = mapArticle;
  window.fetchMagazineIssues = fetchMagazineIssues;
  window.mapMagazineIssue = mapMagazineIssue;
  window.convertHeicIfNeeded = convertHeicIfNeeded;
}
