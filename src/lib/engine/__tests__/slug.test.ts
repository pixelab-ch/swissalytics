import { describe, it, expect } from 'vitest';
import { newReportSlug } from '../slug';

describe('newReportSlug', () => {
  it('returns slug from hostname with 10-char suffix', () => {
    const slug = newReportSlug('https://pixelab.ch/about');
    expect(slug).toMatch(/^pixelab-ch-[a-z2-9]{10}$/);
  });

  // The hostname half is public, so the suffix carries all the unguessability
  // of a /r/<id> link. Pin it: shortening this silently re-opens enumeration.
  it('suffix is long enough to resist enumeration', () => {
    const suffix = newReportSlug('https://pixelab.ch').split('-').pop() ?? '';
    expect(suffix.length).toBeGreaterThanOrEqual(10);
  });

  it('strips www prefix', () => {
    const slug = newReportSlug('https://www.example.com');
    expect(slug.startsWith('example-com-')).toBe(true);
    expect(slug).not.toMatch(/^www-/);
  });

  it('handles subdomains', () => {
    const slug = newReportSlug('https://shop.example.com/');
    expect(slug.startsWith('shop-example-com-')).toBe(true);
  });

  it('caps slug body at 40 chars', () => {
    const longHost = 'a'.repeat(60) + '.com';
    const slug = newReportSlug(`https://${longHost}/`);
    const body = slug.split('-').slice(0, -1).join('-');
    expect(body.length).toBeLessThanOrEqual(40);
  });

  it('handles IDN by punycode (URL normalises)', () => {
    const slug = newReportSlug('https://xn--rksmrgs-5wao1o.com/');
    expect(slug).toMatch(/^xn--rksmrgs-5wao1o-com-[a-z2-9]{10}$/);
  });

  it('produces different suffixes on repeated calls (collision-free)', () => {
    const slugs = new Set<string>();
    for (let i = 0; i < 50; i++) {
      slugs.add(newReportSlug('https://pixelab.ch/'));
    }
    expect(slugs.size).toBeGreaterThan(45); // tolerate <5% collision in 50 calls
  });

  it('strips disallowed characters from hostname', () => {
    const slug = newReportSlug('https://example_foo.com/');
    expect(slug.startsWith('examplefoo-com-')).toBe(true);
  });
});
