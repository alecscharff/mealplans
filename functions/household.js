import { getFirestore } from "firebase-admin/firestore";

export async function getHouseholdEmails(db = getFirestore()) {
  const snapshot = await db.doc("privateConfig/household").get();
  const emails = snapshot.data()?.emails;
  return Array.isArray(emails) ? emails.filter((email) => typeof email === "string") : [];
}

export async function householdToken(token) {
  return token?.firebase?.sign_in_provider === "google.com"
    && token.email_verified === true
    && typeof token.email === "string"
    && (await getHouseholdEmails()).includes(token.email.toLowerCase());
}
