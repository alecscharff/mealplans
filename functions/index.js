import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { scrapeRecipeFromHtml } from "./shared/recipeScrape.js";

initializeApp();

// Hostnames/IP literals that must never be fetched server-side — mainly the cloud
// metadata endpoint, which would hand back this function's service account
// credentials to anyone who passed it in as a "recipe URL".
const BLOCKED_HOSTS = new Set(["169.254.169.254", "metadata.google.internal", "localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
];

function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new HttpsError("invalid-argument", "That doesn't look like a valid URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new HttpsError("invalid-argument", "URL must be http or https.");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname) || PRIVATE_IP_PATTERNS.some((p) => p.test(hostname))) {
    throw new HttpsError("invalid-argument", "That URL isn't allowed.");
  }
  return parsed;
}

// Paste-a-URL recipe import. Fetches the page server-side (avoids the frontend's CORS
// restrictions), pulls out schema.org Recipe JSON-LD (what recipe sites embed for
// Google/Pinterest rich results), and returns structured data for the client to
// preview and save. Read-only — never writes to Firestore itself.
export const scrapeRecipeUrl = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required.");
  }
  const url = request.data?.url;
  if (!url || typeof url !== "string") {
    throw new HttpsError("invalid-argument", "url is required.");
  }
  const parsed = assertSafeUrl(url);

  let res;
  try {
    res = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SundayMenuBot/1.0)" },
    });
  } catch (err) {
    throw new HttpsError("unavailable", `Couldn't reach that page: ${err.message}`);
  }
  if (!res.ok) {
    throw new HttpsError("not-found", `Page returned HTTP ${res.status}.`);
  }

  const html = await res.text();
  const recipe = scrapeRecipeFromHtml(html, parsed.toString());
  if (!recipe) {
    throw new HttpsError("not-found", "No recipe data found on that page.");
  }
  return recipe;
});
