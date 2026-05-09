/**
 * Atom-Clipboard
 * 設計: ../../../50_Mission/Mermaid Maker/Atom-Clipboard.md
 */

export async function copyToClipboard(text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
  } catch {
    // fallback below
  }
  // フォールバック: 一時 textarea + execCommand
  if (typeof document === 'undefined') {
    return { ok: false, error: 'no document' };
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return { ok };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
