// Client for Paprika's unofficial, reverse-engineered sync API (v2). No official public
// API exists for Paprika/Hindsight Labs — this is best-effort and could break on a future
// Paprika update. Read-only: login + fetch categories/recipes. Isolated into small,
// individually-testable methods so a wire-format change only needs a local patch here.
//
// UNVERIFIED: this has not been exercised against a live Paprika account in this build
// session (no credentials available). The endpoint shapes below match the commonly
// documented behavior used by community projects, but treat `getRecipeDetail`'s response
// shape especially as the most likely thing to need adjustment once tested for real.

const BASE_URL = "https://www.paprikaapp.com/api/v2";

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/account/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Paprika login failed: HTTP ${res.status}`);
  }
  const json = await res.json();
  const token = json?.result?.token;
  if (!token) {
    throw new Error("Paprika login response did not include a token");
  }
  return token;
}

async function authedGet(path, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Paprika request to ${path} failed: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.result;
}

// -> [{ uid, name, parent_uid }, ...]
async function listCategories(token) {
  return authedGet("/sync/categories/", token);
}

// -> [{ uid, hash }, ...] — stubs only; fetch each recipe's detail separately.
async function listRecipeStubs(token) {
  return authedGet("/sync/recipes/", token);
}

// -> { uid, name, ingredients, directions, categories: [uid,...], ... }
async function getRecipeDetail(token, uid) {
  return authedGet(`/sync/recipe/${uid}/`, token);
}

export const paprikaClient = { login, listCategories, listRecipeStubs, getRecipeDetail };
