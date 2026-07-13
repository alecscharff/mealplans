# Sunday Menu

Family meal-picker app. See `sunday-menu-build-plan.md` for the original spec this was
built from — note that the Paprika sync described there was replaced with a paste-a-URL
recipe importer (see "Why not Paprika" below). This README covers what's built, what's
not, and exactly what to do to bring it live.

## What's built

- `docs/shared/` — all core algorithm logic (week key, seeded shuffle, candidate
  generation, deadline auto-pick, week rollover/history, recipe-page JSON-LD scraping,
  ingredient parsing, grocery merge+scale), framework-free and unit-tested
  (`node --test docs/shared/*.test.js` — 49 tests, all passing). Lives under `docs/`
  (not a top-level `shared/`) so GitHub Pages, which only publishes the `docs/` folder,
  can actually serve it to the frontend; `functions/` reaches it via a relative
  `../docs/shared/...` import.
- `docs/` — the static frontend (vanilla JS ES modules, Firebase JS SDK via CDN, zero
  build step). Four tabs: This Week (pick 2), Grocery List, Add Recipe, Settings — plus
  a recipe detail view (servings adjuster + tap-to-cross-out steps) reached by clicking
  a recipe name on the This Week or Grocery List tabs.
- `functions/` — one Cloud Function, `scrapeRecipeUrl`, an HTTPS callable that fetches a
  pasted recipe URL server-side (avoids the frontend's CORS restrictions) and extracts
  its schema.org Recipe JSON-LD.
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `.firebaserc` — project config.

## Why not Paprika

The original build plan called for a daily Cloud Function that synced recipes from
Paprika's unofficial sync API. That was tried against a real account in this session and
hit a wall: Paprika added client verification to that API (mid-2024ish), so
`/api/v2/account/login/` now rejects any client it doesn't recognize as the official
app with "Unrecognized client" — independent of whether the credentials are correct. The
one community workaround (the `kappari` project) gets past this by decompiling
Paprika's official app binary and extracting its embedded signing secrets, which is
circumventing a vendor access control rather than using a sanctioned API — not something
built here.

Instead, recipes are added by pasting a URL. Recipe sites almost universally embed
schema.org `Recipe` JSON-LD in their pages specifically so Google/Pinterest can render
rich results — this is public, intentionally-machine-readable metadata, not a protected
API. `scrapeRecipeUrl` fetches the page and extracts name, servings, ingredients, and
steps from it.

**Caveat:** this was verified with unit tests against hand-built JSON-LD fixtures (see
`docs/shared/recipeScrape.test.js`), but not against live recipe sites — this dev
environment's network access is sandboxed/proxied and returns stub pages for real
fetches, so a true smoke test could only happen after deploying the function (see
below). Most modern recipe blogs should work out of the box; sites that don't publish
Recipe JSON-LD (rare among dedicated recipe sites) will return a "no recipe data found"
error, and pages behind a bot-detection challenge may fail the fetch entirely.

## Firebase project: `mealplan-a82b0` (live)

- Firestore database created (`nam5`), security rules deployed.
- Anonymous Auth enabled and verified end-to-end with a real sign-in call.
- Web app registered; real config already in `docs/firebase-config.js` and `.firebaserc`
  (this config is not secret — safe to be public in the static bundle).
- `settings/main` seeded with placeholder household values (edit via the Settings tab
  once the site is deployed, or directly in the Firestore console):
  `familySize: 4, deadlineDay: 1, cookDay1: 2, cookDay2: 5, shuffleSeed: "sunday-menu-mealplan-a82b0"`
  (`deadlineDay`/`cookDay1`/`cookDay2` use Monday=0 … Sunday=6.)
- `recipeCache/main` seeded as `{ recipes: [] }` — populate it via the Add Recipe tab
  once the site is deployed.

Console: https://console.firebase.google.com/project/mealplan-a82b0/overview

## Setup still needed

### 1. Deploy the Cloud Function

```
firebase deploy --only functions
```

No secrets needed anymore (no Paprika credentials to store). Once deployed, use the Add
Recipe tab to paste a URL and confirm it actually extracts a real recipe — that's the
first live test of the scraper against a real site.

### 2. GitHub Pages

1. Push this repo to GitHub.
2. Repo Settings → Pages → Source: "Deploy from a branch" → branch `main`, folder `/docs`.
3. Share the resulting `https://<you>.github.io/<repo>/` URL with the family.

### 3. Add your first recipes

Open the Add Recipe tab, paste a few recipe URLs in, and confirm each looks right
(ingredients, steps, servings) before adding it to the rotation. New recipes join the
candidate pool starting the following week's menu, not immediately (candidates for the
current week are picked once, deterministically, at the start of that week) — except
when the pool is completely empty, in which case adding recipes repopulates the current
week's candidates right away.

## Architecture notes worth knowing

- **`recipeCache` write access**: `recipeCache/main` is seeded once and never recreated,
  so client writes (adding a recipe, or the "on load" rollover pass updating a picked
  recipe's `lastCooked`) are always `update`s to that existing doc. `create`/`delete` on
  that path are blocked in `firestore.rules` so a client can't fabricate a fresh doc
  there or wipe the whole cache.
- **History storage**: implemented as one doc per week (`history/{weekKey}`) rather than
  a single growing array doc — the original spec explicitly allowed either, and per-doc
  avoids the 1 MiB single-document limit over years of use.
- **Grocery categories** (produce/dairy/pantry/etc.) aren't part of any recipe site's
  data — added a small keyword-based categorizer in `docs/shared/grocery.js` with an
  "Other" fallback. Adjust `CATEGORY_KEYWORDS` there if items land in the wrong bucket.
- **Grocery scaling**: each recipe scales by its own `servings` (from the scraped page)
  relative to `settings.familySize`, falling back to an assumed 4 servings for recipes
  where the source page didn't publish a yield.
- **SSRF guard**: `scrapeRecipeUrl` blocks fetches to loopback/private/link-local
  addresses and the cloud metadata hostname, since it's a server-side fetch of a
  client-supplied URL.

## Running the tests

```
node --test docs/shared/*.test.js
```
