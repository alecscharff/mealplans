const TRACKING = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid)$/i;

export function canonicalRecipeUrl(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) throw new TypeError("Recipe links must use HTTP or HTTPS.");
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
    if (url.hostname === "cooking.nytimes.com") for (const key of ["art", "smid", "campaign"]) url.searchParams.delete(key);
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return url.toString();
  } catch { return ""; }
}
