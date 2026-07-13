import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { runSync } from "./syncPaprika.js";

// Set these via: firebase functions:secrets:set PAPRIKA_EMAIL / PAPRIKA_PASSWORD
// Never hardcode credentials here — this is the only place in the whole app allowed
// to touch them, per the build plan's frontend-must-never-see-Paprika-creds requirement.
const paprikaEmail = defineSecret("PAPRIKA_EMAIL");
const paprikaPassword = defineSecret("PAPRIKA_PASSWORD");

initializeApp();

// Once-daily sync, well within Paprika's informal rate limits. Adjust `timeZone` and
// the cron schedule to taste in the Firebase console or here before deploying.
export const syncPaprika = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "America/Chicago",
    secrets: [paprikaEmail, paprikaPassword],
  },
  async () => {
    const db = getFirestore();
    const settingsSnap = await db.doc("settings/main").get();
    const categoryId = settingsSnap.exists ? settingsSnap.data().paprikaCategoryId : null;

    const result = await runSync({
      email: paprikaEmail.value(),
      password: paprikaPassword.value(),
      categoryId,
      db,
    });

    console.log(`Synced ${result.count} recipes from Paprika (category ${categoryId || "none set"}).`);
  }
);
