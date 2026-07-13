# Sunday Menu

Family meal-picker app. See `sunday-menu-build-plan.md` for the full spec this was built
from. This README covers what's built, what's not, and exactly what to do to bring it live.

## What's built (this session)

- `docs/shared/` — all core algorithm logic (week key, seeded shuffle, candidate
  generation, deadline auto-pick, week rollover/history, ingredient parsing, grocery
  merge+scale), framework-free and unit-tested (`node --test docs/shared/*.test.js` — 30
  tests, all passing). Lives under `docs/` (not a top-level `shared/`) so GitHub Pages,
  which only publishes the `docs/` folder, can actually serve it to the frontend;
  `functions/` reaches it via a relative `../docs/shared/...` import.
- `docs/` — the static frontend (vanilla JS ES modules, Firebase JS SDK via CDN, zero
  build step). Three tabs: This Week (pick 2), Grocery List, Settings.
- `functions/` — the Cloud Function that syncs recipes from Paprika into Firestore.
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `.firebaserc` — project config.

## Not done / needs your input

- **Paprika integration is unverified.** `functions/paprikaClient.js` implements the
  commonly-documented unofficial Paprika v2 sync API, but there were no real Paprika
  credentials available to test against in this session. Test it for real before relying
  on it — see "Deploy the Cloud Function" below. If the recipe-detail response shape
  doesn't match what `syncPaprika.js` expects, that's the most likely place to need a patch.
- **Paprika meal-planner write-back** (the spec's stretch goal) — not attempted.

## Firebase project: `mealplan-a82b0` (live)

Set up via the Firebase CLI + REST API in this session:
- Firestore database created (`nam5`), security rules deployed.
- Anonymous Auth enabled and verified end-to-end with a real sign-in call.
- Web app registered; real config already in `docs/firebase-config.js` and `.firebaserc`
  (this config is not secret — safe to be public in the static bundle).
- `settings/main` seeded with placeholder household values (edit via the Settings tab
  once the site is deployed, or directly in the Firestore console):
  `familySize: 4, deadlineDay: 1, cookDay1: 2, cookDay2: 5, paprikaCategoryId: "", shuffleSeed: "sunday-menu-mealplan-a82b0"`
  (`deadlineDay`/`cookDay1`/`cookDay2` use Monday=0 … Sunday=6.)
- `recipeCache/main` seeded as `{ recipes: [], lastSynced: null }` — the Cloud Function
  overwrites this once deployed and run (see below).

Console: https://console.firebase.google.com/project/mealplan-a82b0/overview

## Setup still needed

### 1. Paprika: tag recipes and find your category ID

1. In the Paprika app, create a category (e.g. "Weeknight rotation") and tag the recipes
   you want in the pool with it.
2. Find that category's UID (Paprika's sync API, not the Firestore doc) so the sync
   function can filter to it:
   ```
   PAPRIKA_EMAIL=you@example.com PAPRIKA_PASSWORD=yourpassword node functions/listCategories.js
   ```
   (run `npm install` inside `functions/` first). Copy the `uid` for your category into
   `settings.paprikaCategoryId` in Firestore.

### 2. Deploy the Cloud Function

```
firebase functions:secrets:set PAPRIKA_EMAIL
firebase functions:secrets:set PAPRIKA_PASSWORD
firebase deploy --only functions
```
It runs once daily (6am America/Chicago by default — edit the `schedule`/`timeZone` in
`functions/index.js` before deploying if that's wrong for you). You can also trigger a
manual run from the Firebase Console → Functions → syncPaprika → "Run now" to test it
immediately rather than waiting a day. Check the function logs for the recipe count, or
for errors if Paprika's response shape doesn't match what's expected.

### 3. GitHub Pages

1. Push this repo to GitHub.
2. Repo Settings → Pages → Source: "Deploy from a branch" → branch `main`, folder `/docs`.
3. Share the resulting `https://<you>.github.io/<repo>/` URL with the family.

## Architecture notes worth knowing

- **`recipeCache` write access**: the build plan says this doc is "written only by the
  Cloud Function," but the spec's own rollover logic ("on load... update each picked
  recipe's `lastCooked`") requires a client write. Resolved by allowing authenticated
  `update` (not `create`/`delete`) on `recipeCache/main` from the client — see the comment
  in `firestore.rules`. This is a deliberate low-stakes tradeoff for a single-family app;
  if you want to harden it later, move that update into a callable Cloud Function instead.
- **History storage**: implemented as one doc per week (`history/{weekKey}`) rather than a
  single growing array doc — the spec explicitly allows either, and per-doc avoids the
  1 MiB single-document limit over years of use.
- **Grocery categories** (produce/dairy/pantry/etc.) aren't part of Paprika's data — added
  a small keyword-based categorizer in `shared/grocery.js` with an "Other" fallback.
  Adjust `CATEGORY_KEYWORDS` there if items land in the wrong bucket.

## Running the tests

```
node --test docs/shared/*.test.js
```