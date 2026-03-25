/** Supabase Storage public bucket id for per-company logos */
export const COMPANY_LOGOS_BUCKET = "company-logos";

/**
 * Extract the object path (e.g. `company-uuid/logo-123.png`) from a Storage
 * URL. `remove()` and `createSignedUrl()` must receive the full path, not the
 * filename alone. Supports public and authenticated object URL shapes.
 */
export const getStorageObjectPathFromPublicUrl = (
  publicUrl: string,
  bucketId: string,
): string | null => {
  const markers = [`/object/public/${bucketId}/`, `/object/authenticated/${bucketId}/`];
  for (const marker of markers) {
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) continue;
    const raw = publicUrl.slice(idx + marker.length);
    const withoutQuery = raw.split("?")[0] ?? raw;
    try {
      return decodeURIComponent(withoutQuery);
    } catch {
      return null;
    }
  }
  return null;
};
