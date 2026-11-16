import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { replyText, verifyResendWebhook } from "../../functions/resendMail.js";

test("Resend webhook authentication rejects modified and expired events", () => {
  const key = Buffer.from("local test signing key");
  const secret = `whsec_${key.toString("base64")}`;
  const rawBody = Buffer.from('{"type":"email.received"}');
  const timestamp = "1794844800";
  const signature = createHmac("sha256", key).update(`event-id.${timestamp}.`).update(rawBody).digest("base64");
  const headers = { "svix-id": "event-id", "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` };
  const request = { rawBody, get: (name) => headers[name] };
  assert.equal(verifyResendWebhook(request, secret, Number(timestamp) * 1000), true);
  assert.equal(verifyResendWebhook({ ...request, rawBody: Buffer.from("{}") }, secret, Number(timestamp) * 1000), false);
  assert.equal(verifyResendWebhook(request, secret, Number(timestamp) * 1000 + 301000), false);
});

test("inbound parsing removes the quoted Gmail message before interpreting the reply", () => {
  assert.equal(replyText("Something quicker?\n\nOn Sun, Nov 15, Sunday Menu\n <menu@example.com> wrote:\n> Add this recipe"), "Something quicker?");
});
