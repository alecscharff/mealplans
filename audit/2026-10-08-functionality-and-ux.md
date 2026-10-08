# Sunday Menu functionality and UX audit

**Latest status:** the previously unverified failure and concurrency checks are completed. See the final emulator verification section below.

Audited October 8, 2026 against https://alotta.fun/mealplans/.

The normal save flows work and survive a reload. Several functional defects and usability problems prevent a clean overall pass. The most important are invalid family-size saves, cooking progress attached to the wrong week, and stale checklist displays.

The library contains 28 entries. All original database documents were compared with a snapshot after testing and match their original contents, apart from modification timestamps on the two tested menu weeks. Family size is back to 4; test menu picks, checks and the temporary recipe have been removed. App code is unchanged.

## What was exercised

| Area | Result and evidence |
| --- | --- |
| Automated core logic | `node --test docs/shared/*.test.js`: **116 passed, 0 failed**. Covers candidate generation, rollover, ingredient parsing, grocery merging/scaling, scraping, filtering and instruction splitting. |
| Loading and navigation | All five tabs and recipe/detail/edit views opened. No application warnings or errors were captured in the browser console during the final inspection. |
| Menu saving | Saved the current week, reloaded, and generated its grocery list from the saved picks. |
| Future-week saving | Saved Oct 11 and verified its grocery list. |
| Manual selection | Unpicked a suggestion, searched for Dinner salad, selected it and saved it. |
| Shuffle | Retained selected recipes, changed alternatives, and preserved the resulting candidates across reload. All 16 displayed candidate slots contained different recipes. |
| Save conflicts | A second tab displayed the warning that the week had changed elsewhere before overwriting. The cancel branch was not reliably verified because the browser's native dialog closed between automation calls. |
| Grocery list | Both/individual-recipe filters, checkbox saving, previous/next week controls, final-week disabled state, and the empty-menu message worked. Checklist display has a defect described below. |
| Recipe detail | Source link URL, ingredient scaling from 4 to 8 servings, image/initial fallback, and cooking-step checks were exercised. Ingredient quantities scaled; instruction text retained original quantities. |
| Recipe import | A bare NYT URL fetched successfully. Re-importing the exact same URL offered Update existing recipe and kept the library count unchanged. A tracking-parameter variant produced a duplicate. |
| New recipe saving and editing | Imported a temporary Niçoise entry, changed its name, image, servings, cook time, ingredients and steps, then reloaded and verified every edited field. |
| Source refresh | Retrieved fresh NYT content into the edit form for review before saving. |
| Skip/include | Toggled the temporary recipe out of and back into rotation. |
| Recipe removal | The temporary recipe was removed; the final library returned to its original 28 entries. No original recipe was deleted. |
| Import errors | Invalid URL and unsupported Marley Spoon metadata errors displayed, and Fetch recipe became usable again. |
| Settings | Saved family size 6 and verified it after reload. An empty value saved as 0. Restored 4 afterward. |
| History | Past weeks rendered in descending order. Their original recipes are archived outside the active library, so the view displays “These recipes are no longer in your rotation.” |
| Responsive layout | Inspected the default desktop layout and a 390 × 844 phone viewport. Reset the viewport afterward. |

The date rollover was covered by the automated tests; the production clock was not changed. Offline, permission-denied and simultaneous-write failures were reviewed in code rather than injected into the live app.

## Functional findings, in recommended fix order

### 1. An empty family size saves as zero

**Reproduced in the live UI.** Clear Family size and click Save settings. The saved field becomes 0, which makes grocery quantities zero. The field has `min="1"` but is optional; the handler converts an empty string with `Number("")`.

Require a nonempty positive integer, validate again before writing, and keep the current setting when validation fails. [Settings implementation](/Users/alexanderscharff/Documents/mealplans/docs/views/settings.js:24).

### 2. Future-week cooking progress is saved under the current week

**Reproduced in the UI and confirmed in Firestore.** Open Asian Grilled Salmon from Oct 11 and check its first instruction. Its progress is stored under Oct 4; Oct 11 has no corresponding progress. Recipe detail always reads and writes the current week's state.

Pass the selected week through menu/grocery → detail → edit/back navigation, and save progress to that week. Decide explicitly how progress should behave when opening a recipe from the library or history. [Detail implementation](/Users/alexanderscharff/Documents/mealplans/docs/views/recipeDetail.js:136).

### 3. Saved checklist changes disappear from the screen until a reload

**Reproduced in the live UI.** Check a grocery item, switch Both to one recipe, and the check can disappear. Check a cooking instruction, leave its detail page, and reopen it; the check can disappear there too. Reloading restores the saved checks. The server save succeeds, but view rendering uses the old in-memory snapshot.

Keep checkbox state in the shared state after each successful change, or subscribe to updates. Show save failures and recover optimistic changes when a write fails. [Grocery snapshot](/Users/alexanderscharff/Documents/mealplans/docs/views/grocery.js:115), [step snapshot](/Users/alexanderscharff/Documents/mealplans/docs/views/recipeDetail.js:117).

### 4. Tracking parameters bypass duplicate detection

**Reproduced through a full import and save.** The existing Niçoise URL and the same URL with `?art=100000010852361` are treated as different recipes. Exact URL matching detects only an identical string.

Store a canonical source identity. Use publisher canonical URLs where available; otherwise remove known tracking parameters and normalize fragments, hostnames and trailing slashes without discarding meaningful recipe parameters. [Duplicate check](/Users/alexanderscharff/Documents/mealplans/docs/views/addRecipe.js:86).

### 5. Save failures lack recovery in several views

**Code review; network failures were not injected.** Menu, recipe-edit, recipe-add-save and settings handlers disable their buttons and await writes without a `catch`/`finally`. A rejected write can leave a “Saving…” button disabled without a useful message. Grocery and cooking checks also lack failure feedback.

Give every write a consistent pending/success/error state, re-enable controls after failure, and preserve the user's draft for retry. The menu's conflict check and write are separate operations, and recipe mutations read and replace the entire recipe array; concurrent writes should use transactions or document-level updates. [Menu save](/Users/alexanderscharff/Documents/mealplans/docs/views/menu.js:334), [recipe edit](/Users/alexanderscharff/Documents/mealplans/docs/views/editRecipe.js:129), [recipe storage](/Users/alexanderscharff/Documents/mealplans/docs/firestore.js:48).

### 6. Cook times and protein filters are unreliable for current recipes

**Observed in the live UI and source data.** Weeknight Bolognese appears Vegetarian because “sirloin” is not recognized. Chicken and Zucchini Meatballs appears Turkey because an optional turkey substitution takes priority. Broth and optional meat choices can determine the tag for otherwise vegetarian dishes.

Food Network's Bolognese publishes `P0Y0M0DT0H45M0.000S`; the duration parser accepts only the shorter `PT…H…M` format, so the app loses the 45-minute time. Unknown times remain eligible for “30 min or less,” making that filter misleading.

Support the duration formats used by the current sources. Allow explicit editable dietary/protein tags, prefer the primary ingredient over substitutions, and make inclusion of unknown times visible. [Tag derivation](/Users/alexanderscharff/Documents/mealplans/docs/shared/recipeTags.js:20), [duration parser](/Users/alexanderscharff/Documents/mealplans/docs/shared/recipeScrape.js:137), [time filtering](/Users/alexanderscharff/Documents/mealplans/docs/shared/recipeFilter.js:12).

### 7. Grocery categorization and quantity presentation need refinement

**Observed in live grocery lists.** Black pepper, garlic powder and apple cider vinegar appear under Produce; paneer and turmeric appear under Other. Matar Paneer's `1/2 -1 teaspoon Kosher Salt` becomes an awkward `0.5 -1 teaspoon Kosher Salt` entry. Salmon scaling produces `0.67 side … (about 3 pounds)`, retaining the original parenthetical weight.

Match specific pantry/spice terms before generic produce words. Parse fractional ranges as a whole, preserve uncertainty rather than silently inventing an exact amount, and improve display of fractions and package weights. [Categories](/Users/alexanderscharff/Documents/mealplans/docs/shared/grocery.js:4), [quantity parser](/Users/alexanderscharff/Documents/mealplans/docs/shared/ingredientParser.js:112).

### 8. Returning from a future grocery recipe resets the selected week

**Reproduced in the live UI.** Browse Oct 11 groceries, open a recipe, then Back: the grocery view returns to Oct 4. Preserve selected week and recipe filter in navigation state. [Grocery initialization](/Users/alexanderscharff/Documents/mealplans/docs/views/grocery.js:20), [navigation](/Users/alexanderscharff/Documents/mealplans/docs/app.js:144).

## UX improvements

1. **Make saved versus draft picks obvious.** On an untouched week, two recipes are already labeled Picked even though nothing is saved and the grocery list is empty. Use “Suggested” for defaults, “Unsaved changes” while editing and “Saved” after success. Warn before leaving a changed menu or recipe form.
2. **Make replacement a single clear action.** Alternatives are disabled while two recipes are selected. Add “Replace…” or let an alternative prompt which selected meal to replace. Explain what Shuffle changes, and disable Save when nothing changed.
3. **Keep all primary navigation reachable on phones.** At 390 px, the tab strip has 451 px of content inside a 340 px visible area; Settings is offscreen. A compact bottom navigation or a layout with visible labels would improve discoverability. Increase small tap targets and keep the week label on one line where possible. [Mobile screenshot](/Users/alexanderscharff/Documents/mealplans/audit/mobile-menu-2026-10-08.jpg).
4. **Separate the recipe library from importing.** Rename Add Recipe to Recipes and put clear “Import URL,” “Add manually” and “Meal idea” actions above the searchable library. Meal ideas such as Dinner salad and Taco bowls should show mix-ins and variations as notes, without a meaningless servings scaler or a numbered cooking checklist.
5. **Improve cooking and grocery accessibility.** Cooking steps are clickable `<li>` elements with no checkbox/button role and `tabIndex=-1`; keyboard users cannot toggle them. Use real checkboxes, label both filter selects, expose active navigation/selection state, and announce save results to assistive technology. [Cooking-step handler](/Users/alexanderscharff/Documents/mealplans/docs/views/recipeDetail.js:133).
6. **Keep scaling context visible.** Ingredients scale but embedded quantities in instructions do not. Label the original yield and show “Instructions use original quantities” until instruction scaling is supported. Prefer readable fractions and usable shopping units over decimals such as 0.67 of a side of salmon.
7. **Provide an import fallback.** When a publisher blocks access or lacks recipe metadata, offer manual entry or pasted recipe text. Show an editable preview before saving and a comparison before overwriting a recipe that has been customized. Marley Spoon's recipe is saved, but its standard URL importer still cannot recover it automatically.
8. **Retain meaningful history.** History currently resolves only active recipe IDs, so replacing the library erases the displayed names from every old week. Store recipe names/source links with history entries or resolve the archived library when rendering them.

## Import coverage

Retested every linked entry in the current library through the live callable importer: **21 of 26 URLs returned a recipe with both ingredients and instructions. All eight NYT URLs passed.**

The five unavailable imports are the two Serious Eats recipes and The Kitchn soup (HTTP 403), the RecipePes squash mirror (no recipe metadata), and Marley Spoon bibimbap (no standard recipe metadata). These entries remain saved and usable; the limitation concerns importing or refreshing their source URLs.

Detailed per-URL results: [import checks](/Users/alexanderscharff/Documents/mealplans/audit/import-checks-2026-10-08.json).

Recommended implementation sequence: fix validation and week ownership first; then checklist synchronization and save-error recovery; then canonical imports, metadata parsing and grocery accuracy; then the mobile/navigation and meal-idea UX changes.

## Implementation and verification handoff

Implemented the findings above in the shared app code. The changes add transaction-backed recipe and week writes with stale-save detection; selected-week checklist persistence with rollback/error feedback; validation and recoverable save states; canonical URL identity; source refresh comparison and overwrite protection; readable quantity/range handling; duration parsing and explicit protein tags; manual recipe and meal-idea entry; import fallback; archive-backed read-only history; and responsive/accessibility improvements. The predeploy hook now includes the canonical URL helper used by the scraper. The original recipe/menu snapshot remains preserved in `archive/2026-10-08-recipes-and-menu.json`; archived recipes are also served read-only for history display.

Verification completed in this checkout:

- `node --test docs/shared/*.test.js`: **126 passed, 0 failed** (including publisher-canonical URL safety).
- `node --check` for all 43 app/function JavaScript modules: **passed**.
- `git diff --check`: **passed**.
- Isolated local preview with a mock in-memory Firestore seeded from the archive: manual recipe with multiline ingredients/instructions saved, survived reload, and both fields were present in Edit; meal-idea form saved successfully. No production data was changed.
- A local Firebase Emulator run was unavailable because this host has no Java runtime. The parent completed a phone-sized browser pass: all five navigation tabs were visible, and checked future-week cooking progress, future-week grocery back-navigation, grocery checklist persistence, and family-size validation/save/reload passed in the isolated preview. Emulator-backed failure injection remains unverified because Java is unavailable.

## Deployment steps

From the repository root, run `firebase deploy --only functions` to publish the importer/function changes (the `firebase.json` predeploy hook copies shared modules, including `canonicalUrl.js`). Then push the reviewed commit to `main`; GitHub Pages publishes `docs/` automatically. Neither deployment nor push was performed during this implementation pass.

### Follow-up verification pass

Scraping now chooses a same-publisher HTTP(S) canonical link when present, with `canonicalRecipeUrl()` fallback; tests cover unsafe and off-publisher canonical links. Active tab ARIA state follows in-app navigation, dirty menu/manual/import/edit drafts warn on route changes and browser exit, and initial picks display “Suggested.” Legacy “Dinner salad” and “Taco bowl(s)” titles render as meal ideas even without the new metadata flag. Import previews are editable (name, yield, time, ingredients, instructions) and show saved content before overwrite; save validation checks names and positive whole-number metadata. Follow-up fixes keep step checks in the in-memory week snapshot, preserve a selected future grocery week when returning from detail, synchronize check timestamps, associate grocery labels with checkbox IDs, and avoid duplicate candidate IDs when replacing with an existing alternative (covered by regression tests). Menu saves and shuffles update only the saved week's in-memory state so drafts in other weeks remain intact.

### Final browser verification

A local mock preview (no production writes) passed: phone navigation at 390 × 844 with all five tabs visible; blank family-size rejection; valid family-size save and reload; future-week menu save; cooking-step check retained after Back/reopen; grocery check retained across recipe filters; future-week grocery → detail → Back retained its selected week; edited import name, multiline ingredients and instructions saved and survived reload. Screenshot: `audit/mobile-settings-fixed-2026-10-08.jpg`. Final shared tests: **126 passed, 0 failed**. Production deployment and emulator-backed failure/concurrency injection were not performed.


## Final emulator verification — October 8, 2026

The missing Java runtime was installed through Homebrew (`openjdk@21`), and the
remaining checks ran against an isolated `demo-mealplans` Firebase Auth/Firestore
emulator using the production rules and the same Firebase 10.14.1 SDK as the app.
No production recipes, menus, settings, or checklists were used for fault injection.

**Automated results: 126 shared tests and 12 emulator integration tests passed.**
The emulator suite covers simultaneous recipe additions, edit versus rollover,
delete versus add, competing menu saves, concurrent grocery/cooking checks,
idempotent rollover history, every unauthenticated write path, a physically cut
TCP connection followed by successful retry, concurrent canonical-URL imports,
editing a deleted recipe, identical-clock versioning, and settings validation.
The disconnected test cuts actual connections rather than relying on the SDK's
`disableNetwork()`, which does not exercise transaction failures in this SDK.

**Browser results with actual emulator rules:** permission-denied saves preserve
the settings, menu, recipe-edit, manual-entry and imported-preview drafts and
re-enable retry; restoring access saves the retained draft. Grocery and cooking
checkboxes revert after rejected writes and succeed after restoring access.
Shuffle and skip/include remain usable after failure and retry. A second client
changed a week; clicking Cancel in the stale-save warning retained the first
client's unsaved draft and enabled Save. Saving one week retained another week's
draft. Fresh-week initialization followed by its first save worked without a
false conflict. A screenshot of a retained import draft after permission failure
is saved at `audit/save-failure-recovery-2026-10-08.jpg`.

These checks found and fixed residual problems:

- Rollover's last-cooked update now uses a transaction and cannot move dates backward.
- History append is idempotent under the actual append-only rules.
- History snapshots preserve actual recipe fields without introducing undefined values.
- Settings validate at the storage boundary and use a transaction, so a disconnected
  save rejects instead of remaining queued indefinitely.
- Week stamps strictly increase even for writes within one millisecond.
- Concurrent imports cannot add the same canonical source twice; editing a recipe
  deleted elsewhere fails explicitly and preserves the draft.
- Week initialization/regeneration respects concurrent saves and retains its new
  version stamp.

Repeatable commands and the isolated browser harness are documented in README.
The prior “unverified” failure/concurrency limitation is resolved.
