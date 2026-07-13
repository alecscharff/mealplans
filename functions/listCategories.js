// One-off CLI helper — not deployed, not exported from index.js. Run locally to find
// the Paprika category UID to paste into settings.paprikaCategoryId:
//
//   PAPRIKA_EMAIL=you@example.com PAPRIKA_PASSWORD=yourpassword node functions/listCategories.js
import { paprikaClient } from "./paprikaClient.js";

const email = process.env.PAPRIKA_EMAIL;
const password = process.env.PAPRIKA_PASSWORD;
if (!email || !password) {
  console.error("Set PAPRIKA_EMAIL and PAPRIKA_PASSWORD env vars first.");
  process.exit(1);
}

const token = await paprikaClient.login(email, password);
const categories = await paprikaClient.listCategories(token);
console.log(JSON.stringify(categories, null, 2));
