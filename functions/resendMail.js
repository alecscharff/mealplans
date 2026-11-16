import { createHmac, timingSafeEqual } from "node:crypto";

export async function resendRequest(apiKey, path, options = {}) {
  const response = await fetch(`https://api.resend.com${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Resend request failed (HTTP ${response.status}).`);
  return response.json();
}

export function verifyResendWebhook(req, secret, now = Date.now()) {
  const id = req.get("svix-id");
  const timestamp = req.get("svix-timestamp");
  const signatures = req.get("svix-signature");
  if (!id || !/^\d+$/.test(timestamp || "") || !signatures || !Buffer.isBuffer(req.rawBody)
      || !secret.startsWith("whsec_") || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const key = Buffer.from(secret.slice(6), "base64");
  if (!key.length) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.`).update(req.rawBody).digest();
  return signatures.split(" ").some((signature) => {
    if (!signature.startsWith("v1,")) return false;
    const actual = Buffer.from(signature.slice(3), "base64");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

export function address(value) {
  if (typeof value !== "string") return "";
  return (value.match(/<([^<>]+)>\s*$/)?.[1] || value).trim().toLowerCase();
}

export function replyText(value) {
  if (typeof value !== "string") return "";
  return value.split(/^\s*>|^On [^\n]*(?:\n(?![ \t]*>)[^\n]*){0,2} wrote:\s*$|^-{2,}\s*(?:Original Message|Forwarded message)\s*-{2,}/im)[0].trim();
}
