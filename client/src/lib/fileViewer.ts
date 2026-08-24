/**
 * Shared VIEW/DOWNLOAD helpers for team-uploaded files (pitch decks,
 * documents, project assets), used by both the team hub (DeliverablesSection)
 * and the judge team detail page.
 *
 * Why this exists: pitch decks/documents upload to Cloudinary as
 * resource_type 'raw'. Newer uploads get a real extension in their Cloudinary
 * publicId (see hackathon-server's files.service.ts, rawPublicId), but files
 * uploaded before that fix have a bare-UUID URL with no extension at all —
 * Cloudinary serves those back as generic application/octet-stream, which
 * neither a plain new-tab open nor an <iframe src> can render inline
 * regardless of anything done client-side; the browser just downloads it.
 * Fetching the actual bytes and reconstructing them as a Blob — with an
 * explicit `type` for viewing, and an explicit `download` filename for
 * saving — sidesteps that entirely: a blob: URL's Content-Type/save-name
 * come from the Blob/anchor themselves, never the network response that
 * produced the bytes. So both of these work correctly for every file,
 * old or new.
 */

export function isPdf(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf');
}

/** True if the buffer starts with the PDF magic bytes ("%PDF"). Guards
 * against silently treating an error page (e.g. Cloudinary returning HTML
 * for an auth/permission failure, or a genuinely non-PDF response) as a
 * valid PDF — forcing `type: 'application/pdf'` on the Blob regardless
 * would otherwise hand the browser's PDF viewer bytes it can't actually
 * parse, and Chrome's response to that is often to just download the
 * "file" instead of showing an error, which looks identical to the exact
 * bug this whole module exists to fix. */
function looksLikePdf(buffer: ArrayBuffer): boolean {
  const header = new Uint8Array(buffer.slice(0, 4));
  const magic = '%PDF';
  return header.length === 4 && String.fromCharCode(...header) === magic;
}

/**
 * Returns a blob: URL suitable for viewing inline (iframe src or a new tab)
 * with `mimeType` forced explicitly, or null if the fetch failed OR the
 * fetched bytes don't actually look like a PDF (see looksLikePdf) — callers
 * should show a clear "couldn't load" message on null, NOT fall back to the
 * original fileUrl as an iframe/new-tab target: for a file uploaded before
 * raw Cloudinary uploads got a real extension, that URL has no extension at
 * all and Cloudinary serves it back as generic application/octet-stream,
 * which silently downloads instead of displaying — the exact symptom this
 * function exists to avoid, so falling back to it on failure just
 * reproduces the bug under a different code path. Not revoked here — the
 * caller is actively displaying it; revoking immediately would break that.
 * Left to be cleaned up when the page/tab that created it closes, which is
 * fine for an occasional manual "view" click.
 */
export async function viewFileAsBlob(fileUrl: string, mimeType: string): Promise<string | null> {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('view fetch failed');
    const arrayBuffer = await response.arrayBuffer();
    if (mimeType === 'application/pdf' && !looksLikePdf(arrayBuffer)) {
      throw new Error('response does not look like a PDF');
    }
    const blob = new Blob([arrayBuffer], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Fetches `fileUrl` and triggers a save under `filename` (correct name +
 * extension guaranteed, regardless of what the URL itself looks like).
 * Returns whether the blob-based save succeeded; callers should fall back
 * to opening fileUrl directly on `false` so a download-blocking issue (e.g.
 * a CORS hiccup) still gets the user to the file some way.
 */
export async function downloadFileAsBlob(fileUrl: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('download fetch failed');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch {
    return false;
  }
}
