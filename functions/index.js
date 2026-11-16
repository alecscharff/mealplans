import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { householdToken } from "./household.js";
import { importRecipeFromUrl } from "./recipeImport.js";

initializeApp();

export const scrapeRecipeUrl = onCall(async (request) => {
  if (!await householdToken(request.auth?.token)) {
    throw new HttpsError("permission-denied", "Household sign-in required.");
  }
  const url = request.data?.url;
  if (!url || typeof url !== "string") {
    throw new HttpsError("invalid-argument", "url is required.");
  }
  return importRecipeFromUrl(url);
});

export { sendWeeklyMenu, receiveMenuReply, sendMenuTestEmail } from "./menuEmail.js";
