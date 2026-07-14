# Sunday Menu

Family meal-picker app, live at **https://alotta.fun/mealplans/**. See
`sunday-menu-build-plan.md` for the original spec this was built from — a lot has
diverged since (Paprika sync was dropped, the single-week picker became a 4-week
planner, deadline auto-pick was removed). This README covers current state.

## What's built

- `docs/shared/` — framework-free, unit-tested core logic
  (`node --test docs/shared/*.test.js` — 78 tests): week key math, seeded shuffle,
  candidate generation, week rollover/history, recipe-page JSON-LD scraping, ingredient
  parsing, grocery merge+scale, HelloFresh proprietary spice-blend lookup, and
  protein/style tag derivation. Lives under `docs/` (not a top-level `shared/`) so
  GitHub Pages, which only publishes `docs/`, can serve it to the frontend;
  `functions/` reaches it via a predeploy-copied `./shared/...` (see below).
- `docs/` — the static frontend (vanilla JS ES modules, Firebase JS SDK via CDN, zero
  build step). Four tabs:
  - **Menu** — the current week plus 3 weeks ahead, each showing 2 picked recipes + 2
    alternatives (click any card to swap it in/out of the picks) and a Shuffle button
    per week. The same recipe can't be suggested twice across the 4 weeks. Every week
    behaves identically — there's no special-cased "current week" or deadline logic.
  - **Grocery List** — merged/scaled shopping list for the currently-viewed week, with
    Previous/Next buttons to browse across the same 4 planned weeks. Ingredients
    matching a known HelloFresh proprietary spice blend (e.g. "Shawarma Spice Blend")
    get an expandable "mix your own" note with the actual ratios.
  - **Add Recipe** — paste a URL, preview the scraped result, save it. Re-submitting a
    URL already in the rotation updates that recipe instead of duplicating it. Below
    the form, the full recipe list with inline delete.
  - **Settings** — family size, first/second cook day (display-only; nothing reads
    them yet).
  - Plus two views reached by navigation rather than a tab: **recipe detail**
    (hero image, servings-adjustable ingredients, tap-to-cross-out steps with bold
    ingredient mentions, source link) and **edit recipe** (editable name/image/
    servings/cook time/ingredients/steps, "Refresh from source" to re-scrape, delete).
- `functions/` — one Cloud Function, `scrapeRecipeUrl`, an HTTPS callable that fetches a
  pasted recipe URL server-side (avoids the frontend's CORS restrictions) and extracts
  its schema.org Recipe JSON-LD: name, image, servings, cook time, ingredients, and
  steps (splitting a source page's `<ul><li>` sub-steps into discrete steps, and
  preserving `<strong>` ingredient mentions as `**bold**` markers the frontend renders
  as real `<strong>` elements — never raw HTML, so there's no injection surface from
  third-party page content).
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `.firebaserc` — project config.

## Why not Paprika

The original build plan called for a daily Cloud Function that synced recipes from
Paprika's unofficial sync API. That was tried against a real account and hit a wall:
Paprika added client verification to that API (mid-2024ish), so
`/api/v2/account/login/` now rejects any client it doesn't recognize as the official
app with "Unrecognized client" — independent of whether the credentials are correct. The
one community workaround (the `kappari` project) gets past this by decompiling
Paprika's official app binary and extracting its embedded signing secrets, which is
circumventing a vendor access control rather than using a sanctioned API — not something
built here.

Instead, recipes are added by pasting a URL. Recipe sites almost universally embed
schema.org `Recipe` JSON-LD in their pages specifically so Google/Pinterest can render
rich results — this is public, intentionally-machine-readable metadata, not a protected
API. Verified working end-to-end against real sites (HelloFresh, Budget Bytes) after
deploying the function — some heavily bot-protected sites (e.g. allrecipes.com) may
reject the fetch outright; most independent recipe blogs work fine.

## Firebase project: `mealplan-a82b0` (live)

- Firestore database (`nam5`), security rules deployed, Anonymous Auth enabled.
- Web app registered; config in `docs/firebase-config.js` / `.firebaserc` (not secret —
  safe to be public in the static bundle).
- `settings/main`: `familySize`, `cookDay1`, `cookDay2`, `shuffleSeed`.
- `recipeCache/main`: `{ recipes: [...] }`, currently ~30 recipes (vegetarian, chicken,
  turkey — screened for anything deep-fried per household preference).

Console: https://console.firebase.google.com/project/mealplan-a82b0/overview
Live site: https://alotta.fun/mealplans/ (GitHub Pages, custom domain inherited from
the `alecscharff.github.io` user-site repo's CNAME — cascades to all project sites on
that account, this wasn't configured specifically for this repo).

### Deploying changes

```
firebase deploy --only functions   # after any docs/shared/recipeScrape.js or functions/ change
git push                           # GitHub Pages auto-rebuilds docs/ on push to main
```

Cloud Functions v2 requires the Blaze (pay-as-you-go) plan — already set up. The
`predeploy` hook in `firebase.json` copies `docs/shared/{ingredientParser,recipeScrape}.js`
into `functions/shared/` before each deploy, since Firebase only bundles the
`functions/` directory — a cross-directory `../docs/shared/...` import would 404 in the
deployed container otherwise. `functions/shared/` is generated, gitignored.

## Architecture notes worth knowing

- **`recipeCache` write access**: `recipeCache/main` is seeded once and never recreated,
  so client writes (add/edit/delete a recipe, or the rollover pass updating
  `lastCooked`) are always `update`s to that existing doc. `create`/`delete` on that
  path are blocked in `firestore.rules` so a client can't fabricate a fresh doc there or
  wipe the whole cache.
- **4-week candidate generation**: each of the 4 displayed weeks draws candidates only
  from recipes not already used in an earlier-processed week (both on load and on
  Shuffle), so nothing repeats across the view. A per-week `shuffleNonce` is appended to
  the deterministic seed and persisted, so a shuffled week stays stable across reloads
  until shuffled again. `computeRollover` only archives weeks strictly *before* the
  current one (a real bug caught mid-build: it originally archived any non-current
  week, which would've wiped out weeks planned ahead of time).
- **Protein/style tags** (`docs/shared/recipeTags.js`): HelloFresh's page metadata
  doesn't publish a clean dietary/style taxonomy (`recipeCategory` is just "main
  course"), so these are inferred from the recipe's own name/ingredients/cook time —
  best-effort, not authoritative. A recipe with no meat keyword anywhere defaults to
  "Vegetarian".
- **The "unit" ingredient quantity**: HelloFresh writes whole-item ingredients as e.g.
  "1 unit Onion" — `unit` is recognized as a real unit so it doesn't leak into the
  ingredient name, but display code omits the word itself ("1 Onion", not "1 unit
  Onion") since it carries no shopping information.
- **Grocery categories** (produce/dairy/pantry/etc.) — keyword-based categorizer in
  `docs/shared/grocery.js` with an "Other" fallback. Adjust `CATEGORY_KEYWORDS` there if
  items land in the wrong bucket.
- **Grocery scaling**: each recipe scales by its own `servings` relative to
  `settings.familySize`, falling back to an assumed 4 servings if a source page didn't
  publish a yield.
- **HelloFresh spice blends** (`docs/shared/hellofreshSpiceBlends.js`): 38
  community-sourced blend ratios (e.g. "Shawarma Spice Blend"), matched against
  ingredient names so the grocery list and recipe detail view can show what to mix
  yourself instead of needing HelloFresh's own packet.
- **SSRF guard**: `scrapeRecipeUrl` blocks fetches to loopback/private/link-local
  addresses and the cloud metadata hostname, since it's a server-side fetch of a
  client-supplied URL.

## Running the tests

```
node --test docs/shared/*.test.js
```
