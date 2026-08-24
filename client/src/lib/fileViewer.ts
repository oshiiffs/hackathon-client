/**
 * Shared VIEW/DOWNLOAD helpers for team-uploaded files (pitch decks,
 * documents, project assets), used by both the team hub (DeliverablesSection)
 * and the judge team detail page.
 *
 * This used to fetch the file's bytes client-side (via `fetch`) and
 * reconstruct them as a Blob, specifically to force a correct Content-Type
 * for viewing and a correct filename for downloading. That approach turned
 * out to be broken in production: Cloudinary's delivery CDN doesn't send
 * permissive CORS headers for `raw` resource type files (pitch decks/
 * documents — see hackathon-server's files.service.ts), so the browser
 * blocks the fetch entirely — "couldn't load preview" / download silently
 * doing nothing, for every raw file, not just older ones.
 *
 * Neither VIEW nor DOWNLOAD needs to fetch anything client-side at all: an
 * <iframe src> or <a href> is a plain browser NAVIGATION, not a scripted
 * fetch/XHR — CORS doesn't apply to those regardless of what headers
 * Cloudinary sends. DOWNLOAD's filename comes from Cloudinary's own
 * `fl_attachment:<filename>` delivery flag (forces
 * `Content-Disposition: attachment; filename="..."` server-side) rather
 * than a client-side blob — no fetch, no CORS dependency, no popup-blocker
 * risk (a plain <a> click is never treated as a popup).
 *
 * Files uploaded before hackathon-server's rawPublicId fix (a bare-UUID
 * Cloudinary URL with no extension at all) still won't render inline for
 * VIEW — Cloudinary serves those as generic application/octet-stream
 * regardless of any of this, and neither an <iframe> nor a fetch can change
 * what content-type the server itself decided to send. DOWNLOAD still works
 * correctly for those either way, since fl_attachment:<filename> sets the
 * filename explicitly regardless of the URL's own extension.
 */

export function isPdf(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf');
}

/** Cloudinary delivery URL with `fl_attachment:<filename>` inserted right
 * after `/upload/` — forces a download (not a navigation/view) under the
 * given filename, entirely server-side. `filename` is URL-encoded since it
 * can contain spaces/punctuation from whatever the uploader originally
 * named the file. */
export function toDownloadUrl(fileUrl: string, filename: string): string {
  const safeName = encodeURIComponent(filename);
  return fileUrl.replace('/upload/', `/upload/fl_attachment:${safeName}/`);
}
