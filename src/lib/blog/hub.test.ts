import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  absoluteMediaUrl,
  hubBase,
  isHubEnabled,
  normalizeBody,
  mapMeta,
  mapArticle,
  fetchArticles,
  fetchArticleBySlug,
} from './hub';

// A real hub document shape, captured from cms.pixelab.ch (helvee article, depth=2).
const REAL_DOC: Record<string, unknown> = {
  id: 'abc',
  site: 'helvee',
  locale: 'fr',
  title: 'Bienvenue',
  slug: 'bienvenue',
  description: 'Un article de bienvenue.',
  type: 'authority',
  publishedAt: '2026-06-18T11:00:00.000Z',
  articleUpdatedAt: '2026-06-18T12:00:00.000Z',
  author: { id: 1, name: 'Dardan Tushi', slug: 'dardan', role: 'Fondateur', avatar: null, linkedin: null },
  tags: [{ tag: 'geo' }, 'seo'],
  entities: [],
  readingMinutes: 4,
  featured: false,
  coverImage: null,
  body: [
    { id: '6a33', md: 'Bienvenue sur le **blog**.', blockType: 'paragraph' },
    { id: 'notre-mission', level: '2', text: 'Notre mission', blockType: 'heading' },
  ],
  _status: 'published',
};

const BASE = 'https://cms.pixelab.ch';

const originalFetch = global.fetch;
let originalPayloadUrl: string | undefined;

beforeEach(() => {
  originalPayloadUrl = process.env.PAYLOAD_URL;
  delete process.env.PAYLOAD_URL;
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalPayloadUrl === undefined) delete process.env.PAYLOAD_URL;
  else process.env.PAYLOAD_URL = originalPayloadUrl;
  vi.restoreAllMocks();
});

describe('hubBase / isHubEnabled', () => {
  it('returns null and disabled when PAYLOAD_URL is unset', () => {
    expect(hubBase()).toBeNull();
    expect(isHubEnabled()).toBe(false);
  });
  it('normalizes a trailing slash', () => {
    process.env.PAYLOAD_URL = 'https://cms.pixelab.ch/';
    expect(hubBase()).toBe('https://cms.pixelab.ch');
    expect(isHubEnabled()).toBe(true);
  });
});

describe('absoluteMediaUrl', () => {
  it('keeps an already-absolute URL', () => {
    expect(absoluteMediaUrl('https://cms.pixelab.ch/api/media/x.webp', BASE)).toBe(
      'https://cms.pixelab.ch/api/media/x.webp',
    );
  });
  it('resolves a root-relative path against the hub origin', () => {
    expect(absoluteMediaUrl('/api/media/x.webp', BASE)).toBe('https://cms.pixelab.ch/api/media/x.webp');
  });
  it('reads a media object {url}', () => {
    expect(absoluteMediaUrl({ url: '/api/media/y.webp' }, BASE)).toBe('https://cms.pixelab.ch/api/media/y.webp');
  });
  it('returns undefined for null/empty', () => {
    expect(absoluteMediaUrl(null, BASE)).toBeUndefined();
    expect(absoluteMediaUrl('', BASE)).toBeUndefined();
  });
});

describe('mapMeta', () => {
  it('maps the core fields from a real hub doc', () => {
    const m = mapMeta(REAL_DOC, BASE);
    expect(m.slug).toBe('bienvenue');
    expect(m.locale).toBe('fr');
    expect(m.title).toBe('Bienvenue');
    expect(m.type).toBe('authority');
    expect(m.publishedAt).toBe('2026-06-18T11:00:00.000Z');
    expect(m.updatedAt).toBe('2026-06-18T12:00:00.000Z');
    expect(m.readingMinutes).toBe(4);
    expect(m.draft).toBe(false);
  });
  it('maps author from the populated relation', () => {
    expect(mapMeta(REAL_DOC, BASE).author).toMatchObject({ key: 'dardan', name: 'Dardan Tushi', role: 'Fondateur' });
  });
  it('flattens tags (string or {tag})', () => {
    expect(mapMeta(REAL_DOC, BASE).tags).toEqual(['geo', 'seo']);
  });
  it('coerces an unknown type to a safe default', () => {
    expect(mapMeta({ ...REAL_DOC, type: 'wat' }, BASE).type).toBe('authority');
  });
  it('falls back to a computed reading time when absent', () => {
    const m = mapMeta({ ...REAL_DOC, readingMinutes: undefined }, BASE);
    expect(m.readingMinutes).toBeGreaterThanOrEqual(1);
  });
});

describe('normalizeBody', () => {
  it('returns the blocks of a structured body', () => {
    const blocks = normalizeBody(REAL_DOC.body, BASE);
    expect(blocks.map((b) => b.blockType)).toEqual(['paragraph', 'heading']);
  });
  it('resolves an image block media URL to absolute under `src`', () => {
    const blocks = normalizeBody([{ blockType: 'image', image: { url: '/api/media/cover.webp' } }], BASE);
    expect(blocks[0].src).toBe('https://cms.pixelab.ch/api/media/cover.webp');
  });
  it('degrades a non-array body to an empty list', () => {
    expect(normalizeBody('not blocks', BASE)).toEqual([]);
  });
});

describe('mapArticle', () => {
  it('includes the normalized block body', () => {
    const a = mapArticle(REAL_DOC, BASE);
    expect(Array.isArray(a.body)).toBe(true);
    expect((a.body as { blockType: string }[]).length).toBe(2);
  });
});

describe('fetchArticles (safeHub)', () => {
  it('returns [] and never calls fetch when PAYLOAD_URL is unset', async () => {
    expect(await fetchArticles('fr')).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps docs when the hub answers 200', async () => {
    process.env.PAYLOAD_URL = BASE;
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ docs: [REAL_DOC] }),
    });
    const list = await fetchArticles('fr');
    expect(list).toHaveLength(1);
    expect(list[0].slug).toBe('bienvenue');
  });

  it('falls back to [] on a non-200 response', async () => {
    process.env.PAYLOAD_URL = BASE;
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    expect(await fetchArticles('fr')).toEqual([]);
  });

  it('falls back to [] when fetch throws (hub unreachable)', async () => {
    process.env.PAYLOAD_URL = BASE;
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOTFOUND'));
    expect(await fetchArticles('fr')).toEqual([]);
  });

  it('drops docs whose slug is reserved or non-kebab (route-poisoning guard)', async () => {
    process.env.PAYLOAD_URL = BASE;
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        docs: [
          { ...REAL_DOC, slug: 'de' }, // reserved locale prefix
          { ...REAL_DOC, slug: 'Not_Kebab' }, // invalid
          { ...REAL_DOC, slug: 'good-one' }, // kept
        ],
      }),
    });
    const list = await fetchArticles('fr');
    expect(list.map((a) => a.slug)).toEqual(['good-one']);
  });

  it('forces the requested locale rather than trusting the returned field', async () => {
    process.env.PAYLOAD_URL = BASE;
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ docs: [{ ...REAL_DOC, locale: 'fr' }] }),
    });
    const list = await fetchArticles('en');
    expect(list[0].locale).toBe('en');
  });
});

describe('fetchArticleBySlug (safeHub)', () => {
  it('returns null when PAYLOAD_URL is unset', async () => {
    expect(await fetchArticleBySlug('bienvenue', 'fr')).toBeNull();
  });
  it('returns a mapped article on a hit', async () => {
    process.env.PAYLOAD_URL = BASE;
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ docs: [REAL_DOC] }),
    });
    const a = await fetchArticleBySlug('bienvenue', 'fr');
    expect(a?.slug).toBe('bienvenue');
    expect(Array.isArray(a?.body)).toBe(true);
  });
  it('returns null on a miss (empty docs)', async () => {
    process.env.PAYLOAD_URL = BASE;
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200, json: async () => ({ docs: [] }) });
    expect(await fetchArticleBySlug('nope', 'fr')).toBeNull();
  });

  it('draft mode queries draft=true with API-Key auth and no published filter', async () => {
    process.env.PAYLOAD_URL = BASE;
    process.env.PAYLOAD_API_KEY = 'k-test';
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ docs: [REAL_DOC] }) });
    await fetchArticleBySlug('bienvenue', 'fr', true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toContain('draft=true');
    expect(url).not.toContain('_status');
    expect(init.headers.Authorization).toBe('users API-Key k-test');
    delete process.env.PAYLOAD_API_KEY;
  });

  it('published mode sends no auth header and filters on _status=published', async () => {
    process.env.PAYLOAD_URL = BASE;
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ docs: [REAL_DOC] }) });
    await fetchArticleBySlug('bienvenue', 'fr');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toContain('where%5B_status%5D%5Bequals%5D=published');
    expect(init.headers.Authorization).toBeUndefined();
  });
});
