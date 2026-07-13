# Sunday Menu — build plan

A family meal-selection app that replaces HelloFresh's "pick from a queue or we'll pick for you" flow, but for groceries you buy yourself. This document is the spec — hand it to Claude Code and build from it.

## What this app does

Twice a week the family cooks a meal with leftovers the next day (so 2 recipe picks cover 4 dinners). Each week the app:
1. Offers a small menu of candidate recipes, weighted toward ones not cooked recently
2. Lets any family member pick 2 of them
3. If nobody's picked by a deadline day, auto-picks the remaining slots
4. Produces a combined, scaled grocery list from the 2 picks
5. Logs the week to history once it's over, so recipes rotate instead of repeating

## Non-goals (explicitly out of scope)

- Do **not** push the grocery list into Paprika's own grocery list feature — this app owns grocery list generation
- Do **not** build an email-to-recipe intake pipeline — Paprika's own recipe clipper already covers adding new recipes
- Push notifications / SMS reminders are not in scope for v1 — the app checks state whenever someone opens it, it doesn't proactively contact anyone

## Architecture

```
family browsers ──► GitHub Pages (static frontend)
                          │
                          ▼
                     Firestore (weekly picks, history, settings, recipe cache)
                          ▲
                          │ (writes, on a schedule)
              Firebase Cloud Function ──► Paprika API (read-only)
```

Important: **Paprika credentials must never live in the frontend bundle.** GitHub Pages is public, static, and inspectable by anyone — so the Paprika email/password can only be used server-side, inside a Firebase Cloud Function, stored as a Firebase secret/environment config. The frontend only ever reads recipes out of Firestore's cache; it never talks to Paprika directly.

### Components

- **Frontend**: static HTML/CSS/JS (or React, your call), hosted on GitHub Pages. No build step required if kept vanilla.
- **Firestore**: free Spark-tier project. Holds app state (see schema below). This app is low-traffic (one family), so free tier limits are a non-issue.
- **Cloud Function** (scheduled, e.g. once daily): logs into Paprika, pulls recipes, filters to the chosen category, writes the result into Firestore's recipe cache. This is the only thing that ever touches Paprika credentials.
- **Firestore security rules**: since the frontend's Firebase config is public, rules must restrict reads/writes to this app's specific document paths — don't leave the project wide open.

## Firestore schema

- `settings` (single doc): `{ familySize, deadlineDay, cookDay1, cookDay2, paprikaCategoryId }`
  - `deadlineDay`/`cookDay1`/`cookDay2` use Monday=0 … Sunday=6
- `recipeCache` (single doc, written only by the Cloud Function): `{ recipes: [...], lastSynced }`
  - Each cached recipe: `{ uid, name, ingredientsRaw, categories, lastCooked }` — `ingredientsRaw` is Paprika's raw newline-separated ingredient text (see gotcha below)
- `weekState/{weekKey}` — `weekKey` is the Monday of that week as `YYYY-MM-DD`:
  - `{ candidates: [uid,...], picks: [uid,...], autoPickedIds: [...], groceryChecks: {...}, archived: bool }`
- `history`: array of `{ weekKey, recipeUids, loggedAt }`, or a doc per week if you prefer querying

## Core logic to replicate

This logic already exists and works in a prior prototype (attach that file to the Claude Code session as a working reference for exact behavior) — port the algorithm, not necessarily the code:

- **Week key**: the Monday of the current week, as `YYYY-MM-DD`. String-sortable, no ISO week-number edge cases.
- **Candidate generation**: from the recipe cache, sort by `lastCooked` ascending (never-cooked = oldest), take the least-recently-cooked pool (~9), then deterministically shuffle using a seeded PRNG keyed on `weekKey + shuffleSeed` so everyone opening the app the same week sees the same candidates. Take 5.
- **Deadline auto-pick**: on load, if today's weekday ≥ `settings.deadlineDay` and `picks.length < 2`, fill remaining slots from the candidates by least-recently-cooked, mark them in `autoPickedIds`.
- **Week rollover / history archiving**: on load, list all `weekState` docs. For any whose `weekKey` isn't the current week and isn't archived: if it has picks, append to `history`, update each picked recipe's `lastCooked` to that week's Monday date, and mark the week doc archived.
- **Grocery list**: aggregate ingredients from the 2 picked recipes, scaled by `familySize / 4` (or whatever base you choose), grouped by grocery category, with persisted checkboxes per week.

## Paprika integration

Read-only. Unofficial, reverse-engineered API (no official public API exists) — treat as best-effort and expect it could break on a future Paprika update.

- Auth: email/password → token, via Paprika's sync API
- Fetch categories, find the ID matching a category you've tagged in the app (e.g. "Weeknight rotation") — this is how you keep the pool to recipes you actually want in rotation instead of your whole library
- Fetch recipes, filter to ones whose `categories` array contains that ID
- **Known gotcha**: Paprika stores ingredients as a single newline-separated text block per recipe, not structured `{quantity, unit, name}` fields. This app's grocery-merging logic needs structured fields to combine and scale ingredients correctly. Two options:
  - **Simple**: skip merging/scaling for Paprika-sourced recipes — just concatenate the raw ingredient lines per recipe under a heading. Less clean, zero extra work.
  - **Better**: add a lightweight parsing step (regex for common patterns like "2 cups flour", or a small Claude API call per recipe to extract structured fields) that runs once when a recipe enters the cache, not on every render. Store the parsed result alongside `ingredientsRaw` in the cache.
  - Decide which before building the grocery-list step — it changes that component's shape.
- Rate limits: the official app makes a small number of calls per session. Don't poll aggressively — a once-daily scheduled sync is plenty and avoids the IP-blocking some hobbyists have hit.

## Stretch goal (attempt only after the core app is solid)

Writing the week's picks back into Paprika's own meal planner/scheduler, via its meals sync endpoint. This corner of the unofficial API is less proven than reading recipes — treat it as an experiment, not a dependency. Fall back gracefully to "just display the picks in this app" if it doesn't pan out.

## Build order

1. Port the prototype's frontend logic to read/write Firestore instead of the Claude artifact's storage API; deploy static site to GitHub Pages
2. Set up the Firebase project, Firestore, and security rules
3. Build the Cloud Function: Paprika login → fetch categories → fetch recipes filtered by category → write to `recipeCache`. Decide on the ingredient-parsing approach here.
4. Wire the frontend's candidate generation to read from `recipeCache` instead of a hardcoded seed list
5. Test the full loop for a couple of real weeks
6. Attempt the Paprika meal-planner write-back, if desired

## Things to gather before starting

- A Firebase project (free tier) with Firestore enabled, and its config object
- A GitHub repo with Pages enabled
- Paprika account email/password (the one used for Cloud Sync), with a category created and recipes tagged for "in rotation"
- Decide: family size, which two weekdays you cook, and which weekday is the auto-pick deadline
- Decide on the ingredient-parsing approach above

## Open risks

- Paprika's API is unofficial and undocumented by Hindsight Labs — it could change without notice
- Recipe creation/meal-plan writes are less proven in the community's reverse-engineering than reads — reads should be solid, writes may need iteration
- Ingredient text is unstructured — grocery-list quality depends on the parsing approach chosen above
