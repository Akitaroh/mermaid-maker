/**
 * Atom-URLState
 * URL hash に state を埋め込む / 取り出す
 * 設計: ../../../50_Mission/Mermaid Maker/Atom-URLState.md
 */

const HASH_PREFIX = '#mm=';

export function encodeStateToHash(text: string): string {
  // UTF-8 → URL-safe base64
  const utf8 = encodeURIComponent(text);
  // unescape は deprecated だが、btoa で UTF-8 を扱う伝統的な方法
  // 代替: TextEncoder + Uint8Array → btoa
  const enc = new TextEncoder();
  const bytes = enc.encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  void utf8;
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeStateFromHash(hash: string): string | null {
  try {
    let s = hash;
    if (s.startsWith(HASH_PREFIX)) s = s.slice(HASH_PREFIX.length);
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dec = new TextDecoder();
    return dec.decode(bytes);
  } catch {
    return null;
  }
}

export function setURLState(text: string): void {
  if (typeof location === 'undefined' || typeof history === 'undefined') return;
  const hash = HASH_PREFIX + encodeStateToHash(text);
  history.replaceState(null, '', location.pathname + location.search + hash);
}

export function readURLState(): string | null {
  if (typeof location === 'undefined') return null;
  if (location.hash.startsWith(HASH_PREFIX)) {
    return decodeStateFromHash(location.hash);
  }
  return null;
}
