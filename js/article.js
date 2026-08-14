/* Renders a single blog article from ?id=<slug> against Supabase. */
(function () {
  const root = document.getElementById("articleRoot");
  if (!root) return;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });
    } catch (_) {
      return "";
    }
  }

  // Turn plain text into paragraphs: blank lines separate paragraphs,
  // single newlines become <br>. A paragraph containing only
  // ![alt](url) is rendered as an inline image instead of text, so
  // photos can be dropped in between paragraphs. A paragraph whose
  // FIRST line is ![alt](url) followed by more lines is rendered as a
  // "feature" block instead: big image, then the next line as a
  // headline and any remaining lines as a short blurb — used for
  // things like a favorite-tools rundown.
  const imageLine = /^!\[([^\]]*)\]\(([^)]+)\)$/;

  function bodyHTML(text) {
    return String(text || "")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
        const m = lines[0] && lines[0].match(imageLine);
        if (m && lines.length > 1) {
          const [, alt, url] = m;
          const headline = lines[1];
          const blurb = lines.slice(2).join(" ");
          return `<div class="feature-item">
            <img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" onerror="this.remove()" />
            <div class="feature-copy">
              <h3 class="serif">${esc(headline)}</h3>
              ${blurb ? `<p>${esc(blurb)}</p>` : ""}
            </div>
          </div>`;
        }
        if (m) {
          const [, alt, url] = m;
          return `<img class="article-inline-img" src="${esc(url)}" alt="${esc(alt)}" loading="lazy" onerror="this.remove()" />`;
        }
        return `<p>${esc(p).replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
  }

  function notFound() {
    root.innerHTML = `
      <div class="wrap recipe-missing">
        <h1 class="serif">Post not found</h1>
        <p>We couldn't find that one — it may have been unpublished or removed.</p>
        <a href="blog.html" class="pill">back to the blog</a>
      </div>`;
  }

  (async function () {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return notFound();

    let article = null;
    try {
      article = await window.fetchArticleBySlug(id);
    } catch (e) {
      console.error(e);
    }
    if (!article) return notFound();

    document.title = `${article.title} — Fogue`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && article.excerpt) metaDesc.setAttribute("content", article.excerpt);

    const date = fmtDate(article.createdAt);
    const hero = article.image
      ? `<div class="wrap article-hero"><img src="${esc(article.image)}" alt="${esc(article.title)}" onerror="this.closest('.article-hero').style.display='none'" /></div>`
      : "";

    root.innerHTML = `
      <article class="article">
        <div class="wrap article-head">
          <nav class="crumbs" aria-label="Breadcrumb">
            <a href="index.html">Home</a>
            <span>/</span>
            <a href="blog.html">Blog</a>
          </nav>
          <p class="eyebrow">fogue magazine</p>
          <h1 class="serif article-title">${esc(article.title)}</h1>
          ${date ? `<p class="article-date">${esc(date)}</p>` : ""}
        </div>
        ${hero}
        <div class="wrap article-body">
          ${bodyHTML(article.body)}
          <a href="blog.html" class="link-arrow back-link"><span class="arr">&larr;</span> back to the blog</a>
        </div>
      </article>`;
  })();
})();
