import { describe, expect, it } from 'vitest';
import { parseSessionFromUrl } from './url-parser.js';

describe('parseSessionFromUrl', () => {
  it('reads sessionId from query string', () => {
    expect(parseSessionFromUrl('https://example.com/?session=abc123')).toEqual({
      sessionId: 'abc123',
    });
  });

  it('reads sessionId from hash fragment', () => {
    expect(parseSessionFromUrl('https://example.com/#session=def456')).toEqual({
      sessionId: 'def456',
    });
  });

  it('query takes precedence over hash', () => {
    expect(
      parseSessionFromUrl('https://example.com/?session=qa#session=ha')
    ).toEqual({ sessionId: 'qa' });
  });

  it('reads from hash with multiple params', () => {
    expect(
      parseSessionFromUrl('https://example.com/#foo=1&session=zzz&bar=2')
    ).toEqual({ sessionId: 'zzz' });
  });

  it('returns null when missing', () => {
    expect(parseSessionFromUrl('https://example.com/')).toBeNull();
    expect(parseSessionFromUrl('https://example.com/#foo=1')).toBeNull();
  });

  it('rejects sessionId with disallowed characters', () => {
    expect(parseSessionFromUrl('https://example.com/?session=a/b')).toBeNull();
    expect(parseSessionFromUrl('https://example.com/?session=<script>')).toBeNull();
    expect(parseSessionFromUrl('https://example.com/?session=a b')).toBeNull();
  });

  it('accepts allowed characters', () => {
    expect(
      parseSessionFromUrl('https://example.com/?session=ABCabc-_-09')
    ).toEqual({ sessionId: 'ABCabc-_-09' });
  });

  it('returns null for invalid URL', () => {
    expect(parseSessionFromUrl('not a url')).toBeNull();
  });
});
