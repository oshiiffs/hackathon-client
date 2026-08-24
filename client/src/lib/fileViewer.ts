/**
 * Shared VIEW/DOWNLOAD helpers for team-uploaded files (pitch decks,
 * documents, project assets), used by both the team hub (DeliverablesSection)
 * and the judge team detail page.
 *
 * VIEW is a plain `<a href={fileUrl} target="_blank">` for every file type,
 * PDFs included — a real full-tab browser navigation, not a scripted
 * fetch/XHR or window.open(). Two earlier approaches were tried and found
 * unreliable in production:
 *   1. Fetching the file's bytes client-side (via `fetch`) and
 *      reconstructing them as a Blob, to force a correct Content-Type/
 *      filename. Broken outright: Cloudinary's delivery CDN doesn't send
 *      permissive CORS headers for `raw` resource type files (pitch decks/
 *      documents — see hackathon-server's files.service.ts), so the browser
 *      blocks the fetch entirely.
 *   2. An `<iframe src={fileUrl}>` toggled inline on the page (no fetch, so
 *      CORS-safe). This avoided the CORS block but hit its own quirk:
 *      Chrome's built-in PDF viewer running inside an <iframe> could show
 *      "Failed to load PDF document" for a file that opens fine when
 *      navigated to directly — an iframe/PDF.js-specific rendering issue,
 *      not a data problem.
 * A plain full-tab navigation avoids both: it's not a fetch (CORS doesn't
 * apply to navigations regardless of what headers Cloudinary sends), and
 * it's not an embedded iframe (browsers handle a direct PDF navigation the
 * most reliably of any embedding method). It's also never subject to a
 * popup blocker, unlike a scripted window.open().
 *
 * DOWNLOAD's filename comes from Cloudinary's own `fl_attachment:<filename>`
 * delivery flag (forces `Content-Disposition: attachment; filename="..."`
 * server-side) rather than a client-side blob — no fetch, no CORS
 * dependency, no popup-blocker risk either.
 *
 * Files uploaded before hackathon-server's rawPublicId fix (a bare-UUID
 * Cloudinary URL with no extension at all) still won't render inline for
 * VIEW — Cloudinary serves those as generic application/octet-stream
 * regardless of any of this, and nothing client-side can change what
 * content-type the server itself decided to send. DOWNLOAD still works
 * correctly for those either way, since fl_attachment:<filename> sets the
 * filename explicitly regardless of the URL's own extension.
 */

/** Cloudinary delivery URL with `fl_attachment:<filename>` inserted right
 * after `/upload/` — forces a download (not a navigation/view) under the
 * given filename, entirely server-side. `filename` is URL-encoded since it
 * can contain spaces/punctuation from whatever the uploader originally
 * named the file. */
export function toDownloadUrl(fileUrl: string, filename: string): string {
  const safeName = encodeURIComponent(filename);
  return fileUrl.replace('/upload/', `/upload/fl_attachment:${safeName}/`);
}
