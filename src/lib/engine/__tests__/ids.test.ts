import { describe, it, expect } from 'vitest';
import { newReportId, newShareToken } from '../ids';
import { newReportSlug } from '../slug';

describe('newReportId', () => {
  it('is 12 chars from the unambiguous alphabet', () => {
    expect(newReportId()).toMatch(/^[a-z2-9]{12}$/);
  });
});

describe('newShareToken', () => {
  it('is 24 chars from the unambiguous alphabet', () => {
    expect(newShareToken()).toMatch(/^[a-z2-9]{24}$/);
  });

  // A share token is the only credential a recipient holds. Anything shorter
  // than the report id it protects would be a downgrade, not a safeguard.
  it('is at least as long as a report id', () => {
    expect(newShareToken().length).toBeGreaterThanOrEqual(newReportId().length);
  });

  it('does not repeat across calls', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => newShareToken()));
    expect(tokens.size).toBe(500);
  });

  // The whole point of the token: a recipient given /s/<token> must not be able
  // to work back to /r/<id>, because that route has no expiry or auth check.
  it('carries nothing derived from the report slug it may protect', () => {
    const slug = newReportSlug('https://pixelab.ch/about');
    const token = newShareToken();
    expect(token).not.toContain('pixelab');
    expect(token).not.toContain(slug);
    expect(slug).not.toContain(token);
  });
});
