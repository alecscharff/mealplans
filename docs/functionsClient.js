import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";

// initFirebase() in firestore.js already called initializeApp() for the default app —
// getApp() picks that up rather than needing the app instance threaded through here too.
let scrapeRecipeUrlCallable = null;

export async function scrapeRecipeUrl(url) {
  if (!scrapeRecipeUrlCallable) {
    const functions = getFunctions(getApp());
    scrapeRecipeUrlCallable = httpsCallable(functions, "scrapeRecipeUrl");
  }
  const result = await scrapeRecipeUrlCallable({ url });
  return result.data;
}
