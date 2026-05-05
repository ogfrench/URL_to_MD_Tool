export function normalizeUrl(value) {
  let url = (value || "").trim();
  if (!url) return null;
  if (url.startsWith("//")) url = `https:${url}`;
  if (!url.includes("://")) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(".") || parsed.hostname.includes(" ")) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function domainFor(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

export function titleFor(url) {
  try {
    const u = new URL(url);
    const slug = u.pathname.replace(/\/$/, "").split("/").filter(Boolean).pop();
    if (!slug) return domainFor(url);
    return slug.replace(/\.html?$/, "").replace(/[-_]/g, " ").slice(0, 80);
  } catch { return "Untitled"; }
}

export function faviconFor(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; }
  catch { return null; }
}
