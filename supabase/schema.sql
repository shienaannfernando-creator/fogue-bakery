-- ============================================================
-- Fogue Bakery — Supabase schema
-- Run this whole file in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is safe to re-run: everything is IF NOT EXISTS / idempotent.
-- ============================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ============================================================
-- 1. RECIPES TABLE
-- ============================================================
create table if not exists public.recipes (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,               -- used in recipe.html?id=<slug>
  title        text not null,
  category     text not null,
  image        text,                               -- public URL (Supabase Storage or external)
  excerpt      text,
  intro        text,
  time         text,                               -- e.g. "35 min"
  yield        text,                               -- e.g. "About 24 pieces"
  difficulty   text,                               -- Easy | Medium | Hard
  featured     boolean not null default false,
  ingredients  jsonb not null default '[]'::jsonb, -- array of strings
  steps        jsonb not null default '[]'::jsonb, -- array of strings
  gallery      jsonb not null default '[]'::jsonb, -- array of extra photo URLs, separate from the cover `image`
  sort_order   int    not null default 0,          -- lower = earlier
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- for databases created before the gallery column existed
alter table public.recipes add column if not exists gallery jsonb not null default '[]'::jsonb;

create index if not exists recipes_category_idx  on public.recipes (category);
create index if not exists recipes_created_idx    on public.recipes (created_at desc);
create index if not exists recipes_sort_idx        on public.recipes (sort_order, created_at desc);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. ROW LEVEL SECURITY
--    - Anyone (anon) may READ recipes  → powers the public site.
--    - Only authenticated users may INSERT / UPDATE / DELETE → the dashboard.
-- ============================================================
alter table public.recipes enable row level security;

drop policy if exists "recipes public read"      on public.recipes;
drop policy if exists "recipes auth insert"       on public.recipes;
drop policy if exists "recipes auth update"       on public.recipes;
drop policy if exists "recipes auth delete"       on public.recipes;

create policy "recipes public read"
  on public.recipes for select
  using (true);

create policy "recipes auth insert"
  on public.recipes for insert
  to authenticated
  with check (true);

create policy "recipes auth update"
  on public.recipes for update
  to authenticated
  using (true) with check (true);

create policy "recipes auth delete"
  on public.recipes for delete
  to authenticated
  using (true);

-- ============================================================
-- 3. STORAGE BUCKET for recipe images
--    Public bucket so <img src> works without signed URLs.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do update set public = true;

-- Storage RLS: anyone can read; only authenticated users can write/delete.
drop policy if exists "recipe images public read"   on storage.objects;
drop policy if exists "recipe images auth insert"    on storage.objects;
drop policy if exists "recipe images auth update"    on storage.objects;
drop policy if exists "recipe images auth delete"    on storage.objects;

create policy "recipe images public read"
  on storage.objects for select
  using (bucket_id = 'recipe-images');

create policy "recipe images auth insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'recipe-images');

create policy "recipe images auth update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'recipe-images') with check (bucket_id = 'recipe-images');

create policy "recipe images auth delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'recipe-images');

-- ============================================================
-- 4. SEED — the 8 recipes that shipped with the static site.
--    Images point at the files already in /public/images.
--    ON CONFLICT keeps this safe to re-run without duplicating.
-- ============================================================
insert into public.recipes
  (slug, title, category, image, excerpt, intro, time, yield, difficulty, featured, ingredients, steps, sort_order)
values
(
  'cookie-crumble-ice-cream',
  'No-Churn Cookie Crumble Ice Cream',
  'Ice Cream',
  '/public/images/hero-icecream.jpg',
  'Our creamiest scoop yet — a cinnamon-kissed no-churn base folded with buttery homemade cookie chunks.',
  'This no-churn cookie crumble ice cream is the one we keep making on repeat. A sweet, cinnamon-infused base loaded with buttery cookie dough bites and plenty of chocolate for the ultimate nostalgic scoop — no ice cream maker required.',
  '20 min + freeze', '1 loaf pan (8 scoops)', 'Easy', true,
  '["2 cups heavy whipping cream, cold","1 (14 oz) can sweetened condensed milk","1 tsp pure vanilla extract","½ tsp ground cinnamon","Pinch of fine sea salt","1½ cups crumbled butter cookies","½ cup chopped dark chocolate"]'::jsonb,
  '["Chill a metal loaf pan in the freezer while you work.","In a large bowl, whip the cold heavy cream to stiff peaks, about 3 minutes.","In a second bowl, whisk together the condensed milk, vanilla, cinnamon and salt.","Gently fold the whipped cream into the condensed milk mixture until no streaks remain.","Fold in the crumbled cookies and chopped chocolate, saving a handful to scatter on top.","Spread into the chilled pan, top with reserved crumbs, cover and freeze at least 6 hours."]'::jsonb,
  10
),
(
  'vanilla-bean-layer-cake',
  'Vanilla Bean Layer Cake',
  'Cakes',
  '/public/images/cake-orange.jpg',
  'Three tender vanilla-bean layers under a cloud of silky vanilla buttercream — our signature celebration cake.',
  'The cake we reach for whenever something is worth celebrating. Soft, buttery vanilla-bean layers, a tight crumb, and a swoop of vanilla buttercream that never tastes too sweet.',
  '1 hr 15 min', '3-layer 8" cake', 'Medium', true,
  '["3 cups cake flour","1 tbsp baking powder","1 cup unsalted butter, softened","2 cups granulated sugar","4 large eggs, room temperature","Seeds of 1 vanilla bean (or 2 tsp vanilla bean paste)","1¼ cups whole milk","Vanilla buttercream, for filling and frosting"]'::jsonb,
  '["Heat oven to 350°F. Butter and line three 8-inch cake pans.","Whisk the cake flour and baking powder together; set aside.","Cream the butter and sugar until pale and fluffy, about 4 minutes.","Beat in the eggs one at a time, then the vanilla bean seeds.","Add the flour mixture in three additions, alternating with the milk.","Divide between the pans and bake 24–28 minutes, until a skewer comes out clean.","Cool completely, then fill and frost with vanilla buttercream."]'::jsonb,
  20
),
(
  'classic-chocolate-brigadeiros',
  'Classic Chocolate Brigadeiros',
  'Brigadeiros',
  '/public/images/brigadeiros.jpg',
  'Fudgy Brazilian chocolate truffles rolled in sprinkles — three ingredients, endless joy.',
  'The little chocolate truffle that started it all. Brigadeiros are rich, fudgy, and impossibly simple — just three pantry ingredients cooked low and slow, then rolled in sprinkles.',
  '35 min', 'About 24 pieces', 'Easy', true,
  '["1 (14 oz) can sweetened condensed milk","3 tbsp unsweetened cocoa powder","1 tbsp unsalted butter, plus more for your hands","Pinch of salt","Chocolate sprinkles, for rolling"]'::jsonb,
  '["Sift the cocoa to remove any lumps.","Combine condensed milk, cocoa, butter and salt in a saucepan over medium-low heat.","Stir constantly until the mixture thickens and pulls away from the pan, 10–12 minutes.","Pour onto a buttered plate and cool completely.","With buttered hands, roll into small balls and coat in sprinkles."]'::jsonb,
  30
),
(
  'dulce-de-leche-meringue-pie',
  'Dulce de Leche Meringue Pie',
  'Pies & Tarts',
  '/public/images/pie-meringue.jpg',
  'A buttery crust, a layer of dulce de leche, and a tower of toasted meringue.',
  'Everything we love about a classic meringue pie, made richer with a layer of caramel-y dulce de leche under billows of toasted Swiss meringue.',
  '1 hr', '9" pie', 'Medium', true,
  '["1 fully baked 9-inch pie crust","1¼ cups dulce de leche","4 large egg whites","¾ cup granulated sugar","¼ tsp cream of tartar","1 tsp vanilla extract"]'::jsonb,
  '["Spread the dulce de leche evenly into the cooled, baked crust.","Set a heatproof bowl over simmering water and whisk the egg whites, sugar and cream of tartar until warm and the sugar dissolves.","Whip to stiff, glossy peaks, then beat in the vanilla.","Pile the meringue over the dulce de leche, sealing to the edges.","Toast the peaks with a torch (or under a broiler) until golden."]'::jsonb,
  40
),
(
  'brown-butter-snack-cake',
  'Brown Butter Snack Cake',
  'Cakes',
  '/public/images/butter-cake.jpg',
  'A humble one-bowl cake with deep, nutty brown-butter flavor. The everyday cake.',
  'Not every cake needs three layers. This brown butter snack cake is the one-bowl, eat-straight-from-the-pan kind of cake that somehow disappears by morning.',
  '50 min', '8" square cake', 'Easy', false,
  '["¾ cup unsalted butter","1 cup brown sugar","2 large eggs","1½ cups all-purpose flour","1 tsp baking powder","½ tsp salt","½ cup sour cream","1 tsp vanilla extract"]'::jsonb,
  '["Brown the butter in a saucepan until golden and nutty; let cool slightly.","Whisk the brown butter with the sugar, then beat in the eggs and vanilla.","Fold in the dry ingredients alternately with the sour cream.","Spread into a lined 8-inch square pan.","Bake at 350°F for 30–34 minutes, until set in the center."]'::jsonb,
  50
),
(
  'rainbow-sprinkle-cookies',
  'Rainbow Sprinkle Cookies',
  'Cookies',
  '/public/images/sprinkle-cookies.jpg',
  'Soft, thick sugar cookies packed with rainbow sprinkles and crisp golden edges.',
  'The cookie that makes everyone smile. Thick and soft in the middle, crisp at the edges, and absolutely loaded with rainbow sprinkles.',
  '30 min', 'About 18 cookies', 'Easy', false,
  '["1 cup unsalted butter, softened","1 cup granulated sugar","1 large egg","2 tsp vanilla extract","2½ cups all-purpose flour","1 tsp baking soda","½ tsp salt","¾ cup rainbow sprinkles"]'::jsonb,
  '["Cream the butter and sugar until light, then beat in the egg and vanilla.","Mix in the flour, baking soda and salt until just combined.","Fold in the sprinkles.","Scoop into balls and chill 20 minutes.","Bake at 350°F for 10–12 minutes, until the edges are set."]'::jsonb,
  60
),
(
  'carrot-cake-ice-cream',
  'Carrot Cake Ice Cream',
  'Ice Cream',
  '/public/images/icecream-coupe.jpg',
  'Spiced no-churn ice cream swirled with real carrot cake crumbs and cream cheese ribbons.',
  'All the warm spice of carrot cake, frozen into a creamy no-churn scoop with ribbons of tangy cream cheese.',
  '20 min + freeze', '1 loaf pan', 'Easy', false,
  '["2 cups heavy whipping cream, cold","1 (14 oz) can sweetened condensed milk","1 tsp cinnamon","¼ tsp ground ginger","1 cup crumbled carrot cake","⅓ cup cream cheese frosting"]'::jsonb,
  '["Whip the cream to stiff peaks.","Whisk the condensed milk with the cinnamon and ginger, then fold in the whipped cream.","Fold in the carrot cake crumbs.","Layer into a loaf pan, dolloping cream cheese frosting and swirling with a knife.","Freeze at least 6 hours before scooping."]'::jsonb,
  70
),
(
  'toasted-meringue-pie',
  'Toasted Meringue Pie',
  'Pies & Tarts',
  '/public/images/icecream-top.jpg',
  'A bright citrus curd under torched meringue peaks — sunshine in a pie tin.',
  'Tart, bright citrus curd under clouds of torched meringue. The kind of pie that disappears the moment it hits the table.',
  '1 hr 10 min', '9" pie', 'Medium', false,
  '["1 baked 9-inch pie crust","1¼ cups citrus curd","4 large egg whites","¾ cup sugar","¼ tsp cream of tartar"]'::jsonb,
  '["Spread the citrus curd into the baked crust.","Whisk the egg whites, sugar and cream of tartar over simmering water until warm.","Whip to stiff, glossy peaks.","Pile over the curd and seal to the edges.","Torch until golden and serve chilled."]'::jsonb,
  80
)
on conflict (slug) do nothing;
