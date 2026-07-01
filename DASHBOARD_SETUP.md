# Fogue Dashboard — Setup

The site now stores recipes in **Supabase** and has an admin dashboard at **`/dashboard`**
for adding, editing and deleting recipes (with photo upload). New recipes appear on the
public site automatically.

Follow these steps once.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> → **New project**. Pick a name and a database password.
2. Wait for it to finish provisioning (~1 minute).

## 2. Run the database setup

1. In your project, open **SQL Editor → New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this repo, copy the whole file,
   paste it in, and click **Run**.

That creates the `recipes` table, security rules (public can read, only logged-in
admins can write), the `recipe-images` storage bucket, and seeds the 8 original recipes.

## 3. Paste your keys into the site

1. In Supabase go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public** key.
3. Open [`js/supabase.js`](js/supabase.js) and replace the two placeholders at the top:

   ```js
   const SUPABASE_URL = "https://YOUR-PROJECT-ref.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
   ```

   The anon key is meant to be public — Row Level Security is what protects your data.

## 4. Create your single admin login

1. In Supabase go to **Authentication → Users → Add user → Create new user**.
2. Enter your email + a password, and **check "Auto Confirm User"** so it's active immediately.

That is the only account. There is no public signup — the dashboard only offers
**Sign in** and **Forgot password**.

### Make password reset emails work (for "Forgot password")

- **Authentication → URL Configuration**: set **Site URL** to your live site
  (e.g. `https://your-site.vercel.app`) and add `https://your-site.vercel.app/dashboard`
  to **Redirect URLs**. For local testing also add `http://localhost:3000/dashboard`.
- Supabase's built-in email works for low volume out of the box. For reliable delivery,
  configure your own SMTP under **Project Settings → Auth → SMTP**.

## 5. Use it

- Public site: `index.html`, `recipes.html`, etc.
- Dashboard: **`/dashboard`** (locally: `http://localhost:3000/dashboard`).
  Sign in, click **+ New recipe**, fill in the fields, upload a photo, **Save** —
  it appears on the site right away.

Run locally with:

```bash
npm install
npm run dev      # serves at http://localhost:3000
```

---

## Notes

- **Existing images** (the original 8 recipes) are still served from `/public/images`.
  New uploads go to Supabase Storage and are served from there.
- Deleting a recipe also deletes its uploaded photo from storage (best-effort).
  Original seed images in `/public/images` are never deleted.
- The old hardcoded recipe array is gone — everything is driven by the database now.
- `/dashboard` is marked `noindex` so search engines won't list it.
