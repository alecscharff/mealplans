import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";
import { HttpsError } from "firebase-functions/v2/https";
import { scrapeRecipeFromHtml } from "./shared/recipeScrape.js";

function fetchPage(url, signal) {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.get(url, {
      signal,
      agent: false,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SundayMenuBot/1.0)" },
      lookup(hostname, options, done) {
        lookup(hostname, { all: true }).then((addresses) => {
          if (!addresses.length || addresses.some(({ address }) => ipaddr.process(address).range() !== "unicast")) {
            done(new Error("Recipe URLs must resolve to public addresses."));
            return;
          }
          if (options.all) done(null, addresses);
          else done(null, addresses[0].address, addresses[0].family);
        }).catch(done);
      },
    }, resolve);
    request.on("error", reject);
  });
}

export async function importRecipeFromUrl(rawUrl) {
  let address = rawUrl;
  const signal = AbortSignal.timeout(10000);
  for (let redirects = 0; redirects <= 4; redirects++) {
    let url;
    try {
      url = new URL(address);
    } catch {
      throw new HttpsError("invalid-argument", "Enter a valid recipe URL.");
    }
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port
        || (ipaddr.isValid(host) && ipaddr.process(host).range() !== "unicast")) {
      throw new HttpsError("invalid-argument", "Use a public HTTP or HTTPS recipe URL.");
    }
    try {
      const response = await fetchPage(url, signal);
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.destroy();
        address = new URL(response.headers.location, url).href;
        continue;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.destroy();
        throw new HttpsError("not-found", `Recipe page returned HTTP ${response.statusCode}.`);
      }
      const chunks = [];
      let length = 0;
      for await (const chunk of response) {
        length += chunk.length;
        if (length > 5_000_000) throw new HttpsError("resource-exhausted", "The recipe page is too large.");
        chunks.push(chunk);
      }
      const recipe = scrapeRecipeFromHtml(Buffer.concat(chunks).toString("utf8"), url.href);
      if (!recipe) throw new HttpsError("not-found", "No recipe data found on that page.");
      return recipe;
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("unavailable", "Could not reach that recipe page.");
    }
  }
  throw new HttpsError("invalid-argument", "The recipe URL redirects too many times.");
}
