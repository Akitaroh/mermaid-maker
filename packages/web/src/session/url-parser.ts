/**
 * Extract sessionId from a URL string. Accepts both query (?session=xxx) and
 * hash fragment (#session=xxx) variants; query takes precedence.
 *
 * Allowed characters in sessionId: alphanumeric, '-', '_'. Values containing
 * other characters are rejected (returns null) — defensive against XSS / URL
 * injection if the value is later round-tripped.
 */

const SESSION_RE = /^[A-Za-z0-9_-]+$/;

export function parseSessionFromUrl(href: string): { sessionId: string } | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  const fromQuery = url.searchParams.get('session');
  if (fromQuery && SESSION_RE.test(fromQuery)) {
    return { sessionId: fromQuery };
  }

  // Try hash fragment of form "#session=xxx" or "#a=1&session=xxx"
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    const fromHash = hashParams.get('session');
    if (fromHash && SESSION_RE.test(fromHash)) {
      return { sessionId: fromHash };
    }
  }
  return null;
}
