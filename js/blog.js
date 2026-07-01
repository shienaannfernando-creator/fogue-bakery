/* Blog listing — renders published articles from Supabase as image + date +
   title + excerpt cards, linking to article?id=<slug>. */
(function () {
  const list = document.getElementById("blogList");
  const empty = document.getElementById("blogEmpty");
  if (!list) return;

  list.innerHTML = '<p class="no-results">Loading posts…</p>';

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (_) {
      return "";
    }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function cardHTML(a) {
    const date = fmtDate(a.createdAt);
    const img = a.image
      ? `<a class="blog-card-img" href="article?id=${encodeURIComponent(a.id)}">
           <img src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy" onerror="this.closest('.blog-card-img').style.display='none'" />
         </a>`
      : "";
    return `
      <article class="blog-card">
        ${img}
        <div class="blog-card-body">
          ${date ? `<p class="blog-card-date">${esc(date)}</p>` : ""}
          <h2 class="serif"><a href="article?id=${encodeURIComponent(a.id)}">${esc(a.title)}</a></h2>
          ${a.excerpt ? `<p class="blog-card-excerpt">${esc(a.excerpt)}</p>` : ""}
          <a class="link-arrow" href="article?id=${encodeURIComponent(a.id)}">read more <span class="arr">&rarr;</span></a>
        </div>
      </article>`;
  }

  (async function () {
    let articles = [];
    try {
      articles = await window.fetchArticles();
    } catch (e) {
      console.error(e);
    }
    if (!articles.length) {
      list.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    list.innerHTML = articles.map(cardHTML).join("");
  })();
})();
