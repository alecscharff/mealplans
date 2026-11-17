import { weeklyEmailPlan, replaceMealDay } from "./shared/weekNotes.js";
import { createHash, randomBytes } from "node:crypto";
import { defineSecret, defineString } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { address, replyText, resendRequest, verifyResendWebhook } from "./resendMail.js";
import { importRecipeFromUrl } from "./recipeImport.js";
import { handleRecipeDeletion, saveImportedRecipe } from "./menuLibrary.js";
import { getHouseholdEmails, householdToken } from "./household.js";
import { emailMode, interpretMenuReply } from "./shared/menuEmail.js";
import { replaceCandidate } from "./shared/candidates.js";
import { askGemini, validateGeminiPlan, visiblePicks } from "./geminiMenu.js";
import { addWeeks, weekKey } from "./shared/weekKey.js";

const timeZone = "America/Los_Angeles";
const resendKey = defineSecret("MENU_RESEND_API_KEY");
const webhookSecret = defineSecret("MENU_RESEND_WEBHOOK_SECRET");
const geminiKey = defineSecret("MENU_GEMINI_API_KEY");
const sender = defineString("MENU_FROM_EMAIL", { default: "" });
// Reply handling is optional; outbound email can deploy before receiving is configured.
const replyMailbox = () => process.env.MENU_INBOUND_EMAIL || "";
const menuUrl = "https://alotta.fun/mealplans/";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const link = (week) => `${menuUrl}?week=${week}`;
const settingsRef = (db) => db.doc("settings/main");

function currentWeek() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts();
  const { year, month, day } = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
  return weekKey(new Date(year, month - 1, day));
}

async function sendEmail(message) {
  if (!sender.value()) throw new Error("Configure MENU_FROM_EMAIL before enabling delivery.");
  const { To, ReplyTo, Subject, TextBody, Headers } = message;
  await resendRequest(resendKey.value(), "/emails", {
    method: "POST",
    body: JSON.stringify({
      from: sender.value(), to: [To], reply_to: ReplyTo, subject: Subject,
      text: TextBody, headers: Headers && Object.fromEntries(Headers.map(({ Name, Value }) => [Name, Value])),
    }),
  });
}

export const sendMenuTestEmail = onCall({ secrets: [resendKey] }, async (request) => {
  const token = request.auth?.token;
  if (!await householdToken(token)) {
    throw new HttpsError("permission-denied", "Household sign-in required.");
  }
  if (!sender.value()) {
    throw new HttpsError("failed-precondition", "The Sunday Menu email sender has not been configured.");
  }
  const email = token.email.toLowerCase();
  const db = getFirestore();
  const quotaRef = db.doc(`menuTestEmailLimits/${hash(email)}`);
  await db.runTransaction(async (tx) => {
    const previous = (await tx.get(quotaRef)).data();
    const now = Date.now();
    if (previous && now - previous.sentAt < 60000) {
      throw new HttpsError("resource-exhausted", "Wait a minute before sending another test email.");
    }
    tx.set(quotaRef, { sentAt: now });
  });
  try {
    await sendEmail({
      To: email,
      Subject: "Sunday Menu | Test email",
      TextBody: `This is a test of Sunday Menu's email delivery.\n\nOpen this week's menu\n${link(currentWeek())}`,
    });
  } catch (error) {
    console.error("Test menu delivery failed", error.message);
    throw new HttpsError("unavailable", "The email provider couldn't accept the test. Try again in a minute.");
  }
  return { email };
});

export const sendWeeklyMenu = onSchedule({
  schedule: "0 9 * * 0", timeZone, secrets: [resendKey],
}, async () => {
  const db = getFirestore();
  const week = currentWeek();
  const weekRef = db.doc(`weekState/${week}`);
  const cacheRef = db.doc("recipeCache/main");
  const householdEmails = await getHouseholdEmails(db);
  for (const email of householdEmails) {
    const token = randomBytes(24).toString("hex");
    const deliveryRef = db.doc(`menuDeliveries/${week}-${hash(email)}`);
    const threadRef = db.doc(`menuEmailThreads/${hash(token)}`);
    const delivery = await db.runTransaction(async (tx) => {
      const [settings, stored, cache, prior] = await tx.getAll(settingsRef(db), weekRef, cacheRef, deliveryRef);
      const mode = emailMode(settings.data());
      const modeVersion = settings.data()?.emailModeChangedAt || null;
      if (mode === "off" || prior.exists) return null;
      if (!sender.value() || (mode === "replies" && !replyMailbox().includes("@"))) {
        throw new Error("Configure the sender and, for automated replies, the inbound address.");
      }
      const state = stored.data();
      const recipes = new Map((cache.data()?.recipes || []).map((recipe) => [recipe.uid, recipe]));
      const picked = !!state?.planConfirmed || state?.picks?.length > 0;
      const ids = picked ? (state.picks || []) : (state?.candidates || []).slice(0, 2);
      const alternatives = (state?.candidates || []).filter((id) => !ids.includes(id))
        .map((id) => recipes.get(id)).filter((recipe) => recipe && !recipe.skipped).map((recipe) => recipe.name);
      tx.create(deliveryRef, { week, status: "claimed", createdAt: new Date() });
      if (mode === "replies") {
        tx.create(threadRef, { email, week, sentVersion: state?.updatedAt || null, modeVersion });
      }
      return { mode, modeVersion, alternatives, planText: weeklyEmailPlan(state, Object.fromEntries(recipes)) };
    });
    if (!delivery) continue;
    const latestSettings = (await settingsRef(db).get()).data();
    if (emailMode(latestSettings) !== delivery.mode
        || (latestSettings?.emailModeChangedAt || null) !== delivery.modeVersion) {
      await deliveryRef.update({ status: "cancelled" });
      continue;
    }
    const replyTo = delivery.mode === "replies"
      ? `${token}@${replyMailbox().split("@").at(-1)}`
      : householdEmails[0];
    const alternatives = delivery.alternatives.length ? `\n\nAlternatives: ${delivery.alternatives.join(", ")}` : "";
    try {
      await sendEmail({
        To: email, ReplyTo: replyTo, Subject: `Sunday Menu | Week of ${week}`,
        TextBody: `${delivery.planText}${alternatives}\n\nView or change this week’s menu\n${link(week)}\n\nReply with a swap or a recipe idea.`,
      });
    } catch (error) {
      await deliveryRef.update({ status: "send-failed" });
      console.error("Weekly menu delivery failed", error.message);
      continue;
    }
    await deliveryRef.update({ status: "sent" });
  }
});

function replyHeaders(headers) {
  if (!Array.isArray(headers)) return [];
  const id = headers.find(({ Name }) => Name?.toLowerCase() === "message-id")?.Value;
  return typeof id === "string" && /^<[^<>\s]+>$/.test(id)
    ? [{ Name: "In-Reply-To", Value: id }, { Name: "References", Value: id }]
    : [];
}

export const receiveMenuReply = onRequest({ secrets: [resendKey, webhookSecret, geminiKey] }, async (req, res) => {
  if (req.method !== "POST" || !verifyResendWebhook(req, webhookSecret.value())) {
    res.sendStatus(401);
    return;
  }
  if (req.body?.type !== "email.received") {
    res.sendStatus(200);
    return;
  }
  const event = req.body.data;
  const MessageID = event?.email_id;
  const email = address(event?.from);
  const domain = replyMailbox().split("@").at(-1).toLowerCase();
  const recipients = Array.isArray(event?.to) ? event.to.map(address) : [];
  const MailboxHash = recipients.find((recipient) => recipient.split("@")[1] === domain)?.split("@")[0];
  if (!email || !/^[a-f0-9]{48}$/.test(MailboxHash || "") || !/^[a-f0-9-]{36}$/i.test(MessageID || "")) {
    res.sendStatus(200);
    return;
  }

  const db = getFirestore();
  if (emailMode((await settingsRef(db).get()).data()) !== "replies") {
    res.sendStatus(200);
    return;
  }
  const inbound = await resendRequest(resendKey.value(), `/emails/receiving/${MessageID}`);
  const text = replyText(inbound.text);
  const Headers = Object.entries(inbound.headers || {}).map(([Name, Value]) => ({ Name, Value }));
  if (typeof event.message_id === "string") Headers.unshift({ Name: "Message-ID", Value: event.message_id });
  if (!text || Headers.some(({ Name, Value }) =>
    Name.toLowerCase() === "auto-submitted" && String(Value).toLowerCase() !== "no")) {
    res.sendStatus(200);
    return;
  }

  const threadRef = db.doc(`menuEmailThreads/${hash(MailboxHash)}`);
  const householdRef = db.doc("privateConfig/household");
  const eventRef = db.doc(`menuEmailEvents/${hash(MessageID)}`);
  const result = await db.runTransaction(async (tx) => {
    const [settings, threadSnapshot, event, household] = await tx.getAll(settingsRef(db), threadRef, eventRef, householdRef);
    const thread = threadSnapshot.data();
    if (emailMode(settings.data()) !== "replies" || event.exists || !household.data()?.emails?.includes(email) || thread?.email !== email
        || thread.week < currentWeek() || thread.modeVersion !== (settings.data()?.emailModeChangedAt || null)) return null;
    const weekRef = db.doc(`weekState/${thread.week}`);
    const [weekSnapshot, cache] = await tx.getAll(weekRef, db.doc("recipeCache/main"));
    const state = weekSnapshot.data();
    const recipes = cache.data()?.recipes || [];
    const picks = visiblePicks(state)
      .map((uid) => recipes.find((recipe) => recipe.uid === uid)).filter(Boolean);
    const alternatives = (state?.candidates || []).map((uid) => recipes.find((recipe) => recipe.uid === uid))
      .filter((recipe) => recipe && !recipe.skipped && !picks.some(({ uid }) => uid === recipe.uid));
    const action = interpretMenuReply(text.slice(0, 4000), picks, alternatives);
    const example = picks[0] && alternatives[0] ? ` For example: Swap ${picks[0].name} for ${alternatives[0].name}.` : "";
    let message = `To make a swap by email, include the exact names of both dishes.${example} You can also edit the menu directly.`;
    if (action.type === "requestDelete" || action.type === "confirmDelete") {
      message = await handleRecipeDeletion({ action, tx, db, cache, threadRef, start: currentWeek() });
    } else if (action.type === "import") {
      tx.create(eventRef, { createdAt: new Date(), status: "importing" });
      return { message, week: thread.week, modeVersion: thread.modeVersion, importUrl: action.url };
    } else if (action.type === "swap") {
      if (state.archived || (state.updatedAt || null) !== thread.sentVersion) {
        message = "The menu has changed since this email. Open the current menu to review the picks and make your swap.";
      } else {
        const { outgoing, incoming } = action;
        const updatedAt = new Date(Math.max(Date.now(), (Date.parse(state.updatedAt) || 0) + 1)).toISOString();
        tx.update(weekRef, {
          candidates: replaceCandidate(state.candidates, outgoing.uid, incoming.uid),
          picks: picks.map(({ uid }) => uid === outgoing.uid ? incoming.uid : uid),
          dayAssignments: replaceMealDay(state.dayAssignments, outgoing.uid, incoming.uid),
          planConfirmed: true,
          updatedAt,
        });
        tx.update(threadRef, { sentVersion: updatedAt });
        message = `Swapped ${outgoing.name} for ${incoming.name}.`;
      }
    } else if (action.type === "suggestion") {
      tx.create(db.doc(`menuSuggestions/${eventRef.id}`), {
        week: thread.week, email, url: action.url, createdAt: new Date(),
      });
      message = "I saved that recipe link for review in Sunday Menu settings.";
    } else if (action.type === "quicker") {
      const longest = Math.max(...picks.map((recipe) => recipe.totalTimeMinutes || 0));
      const faster = alternatives.filter((recipe) => recipe.totalTimeMinutes > 0 && recipe.totalTimeMinutes < longest);
      if (faster.length) {
        message = `Quicker options: ${faster.map((recipe) => `${recipe.name} (${recipe.totalTimeMinutes} min)`).join(", ")}. Which meal would you like to swap?`;
      }
    }
    if (action.type === "clarify" || (action.type === "quicker" && message.startsWith("To make a swap"))) {
      const start = currentWeek();
      const keys = Array.from({ length: 4 }, (_, index) => addWeeks(start, index));
      const snapshots = await tx.getAll(...keys.map((week) => db.doc(`weekState/${week}`)));
      const weeks = Object.fromEntries(snapshots.map((snapshot) => [snapshot.id, snapshot.data() || null])
        .filter(([, value]) => !value?.archived));
      tx.create(eventRef, { createdAt: new Date(), status: "interpreting" });
      return { message, week: thread.week, modeVersion: thread.modeVersion, ai: { weeks, recipes, sentVersion: thread.sentVersion, cacheVersion: cache.updateTime, threadVersion: threadSnapshot.updateTime } };
    }
    tx.create(eventRef, { createdAt: new Date() });
    return { message, week: thread.week, modeVersion: thread.modeVersion };
  });

  if (result?.importUrl) {
    const active = (await settingsRef(db).get()).data();
    if (emailMode(active) === "replies" && (active?.emailModeChangedAt || null) === result.modeVersion) {
      try {
        const recipe = await importRecipeFromUrl(result.importUrl);
        result.message = await db.runTransaction(async (tx) => {
          const [settings, household, cache] = await tx.getAll(settingsRef(db), householdRef, db.doc("recipeCache/main"));
          if (emailMode(settings.data()) !== "replies" || (settings.data()?.emailModeChangedAt || null) !== result.modeVersion
              || !household.data()?.emails?.includes(email)) return "";
          return saveImportedRecipe(tx, cache, recipe);
        });
      } catch (error) {
        console.error("Email recipe import failed", error.code || error.name);
        result.message = "I couldn't import a recipe from that link. Try the link in the Recipes tab or send a different recipe page.";
      }
    }
    await eventRef.update({ status: "processed" });
  }

  if (result?.ai) {
    const { ai } = result;
    try {
      const active = (await settingsRef(db).get()).data();
      if (emailMode(active) === "replies" && (active?.emailModeChangedAt || null) === result.modeVersion) {
        const plan = await askGemini({ apiKey: geminiKey.value(), text: text.slice(0, 4000), anchor: result.week, ...ai });
        const updates = validateGeminiPlan(plan, ai.weeks, ai.recipes);
        if (updates?.length === 0 && plan.changes.length === 0 && typeof plan.deleteRecipeId === "string"
            && ai.recipes.some(({ uid }) => uid === plan.deleteRecipeId)) {
          result.message = await db.runTransaction(async (tx) => {
            const [settings, thread, household, cache] = await tx.getAll(
              settingsRef(db), threadRef, householdRef, db.doc("recipeCache/main"),
            );
            if (emailMode(settings.data()) !== "replies"
                || (settings.data()?.emailModeChangedAt || null) !== result.modeVersion
                || !household.data()?.emails?.includes(email) || thread.data()?.email !== email
                || result.week < currentWeek()) return "";
            return handleRecipeDeletion({
              action: { type: "requestDelete", uid: plan.deleteRecipeId },
              tx, db, cache, threadRef, start: currentWeek(),
            });
          });
        } else if (updates?.length && !plan.deleteRecipeId) {
          result.message = await db.runTransaction(async (tx) => {
            const keys = Object.keys(ai.weeks);
            const refs = keys.map((week) => db.doc(`weekState/${week}`));
            const [settings, thread, cache, household, ...weeks] = await tx.getAll(
              settingsRef(db), threadRef, db.doc("recipeCache/main"), householdRef, ...refs,
            );
            if (emailMode(settings.data()) !== "replies"
                || (settings.data()?.emailModeChangedAt || null) !== result.modeVersion
                || !household.data()?.emails?.includes(email)) return "";
            if (!ai.threadVersion.isEqual(thread.updateTime) || !ai.cacheVersion?.isEqual(cache.updateTime)
                || result.week < currentWeek()
                || (ai.weeks[result.week]?.updatedAt || null) !== ai.sentVersion
                || weeks.some((snapshot) => (snapshot.data()?.updatedAt || null) !== (ai.weeks[snapshot.id]?.updatedAt || null))) {
              return "The menu or recipe list changed while I was checking. Open Sunday Menu to review the latest plan.";
            }
            const lines = [];
            for (const { week, candidates, picks } of updates) {
              const previous = ai.weeks[week];
              const updatedAt = new Date(Math.max(Date.now(), (Date.parse(previous?.updatedAt) || 0) + 1)).toISOString();
              tx.set(db.doc(`weekState/${week}`), { candidates, picks, updatedAt }, { merge: true });
              if (week === result.week) tx.update(threadRef, { sentVersion: updatedAt });
              lines.push(`Week of ${week}: ${picks.map((uid) => ai.recipes.find((recipe) => recipe.uid === uid).name).join(", ")}`);
            }
            return `I updated Sunday Menu.\n${lines.join("\n")}`;
          });
        } else if (updates && typeof plan.question === "string" && plan.question.trim()) {
          result.message = plan.question.trim().slice(0, 700);
        }
      }
    } catch (error) {
      console.error("Gemini menu interpretation failed", error.name);
    }
    await eventRef.update({ status: "processed" });
  }

  const latestSettings = result && (await settingsRef(db).get()).data();
  if (result?.message && emailMode(latestSettings) === "replies"
      && result.modeVersion === (latestSettings?.emailModeChangedAt || null)) {
    try {
      await sendEmail({
        To: email,
        ReplyTo: `${MailboxHash}@${replyMailbox.value().split("@").at(-1)}`,
        Subject: `Re: Sunday Menu | Week of ${result.week}`,
        TextBody: `${result.message}\n\n${link(result.week)}`,
        Headers: replyHeaders(Headers),
      });
    } catch (error) {
      console.error("Menu reply confirmation failed", error.message);
    }
  }
  res.sendStatus(200);
});
