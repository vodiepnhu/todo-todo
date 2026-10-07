export function safeMapsHref(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.hostname === "maps.app.goo.gl") return url.toString();
    if (url.hostname === "goo.gl") {
      return url.pathname.startsWith("/maps") ? url.toString() : null;
    }
    if (url.hostname === "maps.google.com") return url.toString();
    if (
      (url.hostname === "google.com" || url.hostname === "www.google.com") &&
      url.pathname.startsWith("/maps")
    ) {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}
