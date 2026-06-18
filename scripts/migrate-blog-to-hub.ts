/**
 * One-off migration: publish the local MDX blog articles into the CMS hub (Payload).
 *
 *   pnpm migrate:blog            # publish all (skips articles already in the hub)
 *   pnpm migrate:blog --dry      # print what would be sent, POST nothing
 *   pnpm migrate:blog --only=<slug>
 *
 * Reads PAYLOAD_URL / PAYLOAD_API_KEY from .env.local (write-scoped key required).
 * Each MDX file "<slug>.<locale>.mdx" becomes one hub article (site=swissalytics,
 * locale, _status=published). Idempotent: an existing (site,locale,slug) is skipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { mdToBlocks } from '../src/lib/blog/md-to-blocks';

// --- env (mirror test:live: load .env.local without a dotenv dependency) ---
const ENV_FILE = path.join(process.cwd(), '.env.local');
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const HUB = (process.env.PAYLOAD_URL || 'https://cms.pixelab.ch').replace(/\/+$/, '');
const KEY = process.env.PAYLOAD_API_KEY;
const SITE = 'swissalytics';
const CONTENT_DIR = path.join(process.cwd(), 'content/blog');
const LOCALES = ['fr', 'en', 'de', 'it'] as const;

// Author relations in the hub (id): default Dardan (CEO/Lead AI Architect); the most
// technical/implementation pieces go to Minace (CTO/Full-Stack — cloud, APIs, infra).
const AUTHOR = { dardan: 1, minace: 2 } as const;
const MINACE_SLUGS = new Set([
  'le-schema-n-aide-presque-pas-les-citations-ia',
  'schema-org-le-detail-qui-change-tout',
  'llms-txt-mode-d-emploi',
]);

const DRY = process.argv.includes('--dry');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

function authHeaders(): Record<string, string> {
  return { 'content-type': 'application/json', Authorization: `users API-Key ${KEY}` };
}

function toIso(d: string): string {
  return /T/.test(d) ? new Date(d).toISOString() : new Date(`${d}T12:00:00.000Z`).toISOString();
}

/** The hub's tags/entities fields are arrays of { value } objects, not plain strings. */
function toValueList(arr: unknown): { value: string }[] {
  return Array.isArray(arr) ? arr.map((v) => ({ value: String(v) })) : [];
}

function parseFilename(file: string): { slug: string; locale: (typeof LOCALES)[number] } | null {
  const base = file.replace(/\.mdx$/, '');
  const locale = LOCALES.find((l) => base.endsWith(`.${l}`));
  if (!locale) return null;
  return { slug: base.slice(0, -(locale.length + 1)), locale };
}

async function exists(slug: string, locale: string): Promise<boolean> {
  const url =
    `${HUB}/api/articles?where[site][equals]=${SITE}` +
    `&where[locale][equals]=${locale}&where[slug][equals]=${encodeURIComponent(slug)}&limit=1`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`pre-check ${res.status}`);
  const json = (await res.json()) as { totalDocs?: number };
  return (json.totalDocs ?? 0) > 0;
}

async function main() {
  if (!KEY) throw new Error('PAYLOAD_API_KEY missing (set it in .env.local)');
  console.log(`Hub: ${HUB} | site: ${SITE} | mode: ${DRY ? 'DRY-RUN' : 'WRITE'}${ONLY ? ` | only: ${ONLY}` : ''}\n`);

  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx')).sort();
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) continue;
    const { slug, locale } = parsed;
    if (ONLY && slug !== ONLY) continue;

    const { data, content } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8'));
    const authorId = MINACE_SLUGS.has(slug) ? AUTHOR.minace : AUTHOR.dardan;
    const payload: Record<string, unknown> = {
      site: SITE,
      locale,
      title: data.title,
      slug,
      description: data.description,
      type: data.type,
      author: authorId,
      publishedAt: toIso(String(data.publishedAt)),
      ...(data.updatedAt ? { articleUpdatedAt: toIso(String(data.updatedAt)) } : {}),
      // The hub stores tags/entities as arrays of { value } objects (a string array
      // 500s the create hook; the API error spells out "Entities N > Value").
      tags: toValueList(data.tags),
      entities: toValueList(data.entities),
      featured: Boolean(data.featured),
      ...(data.coverAlt ? { coverAlt: data.coverAlt } : {}),
      ...(data.coverCaption ? { coverCaption: data.coverCaption } : {}),
      body: mdToBlocks(content),
    };

    const tag = `${slug} [${locale}] → author ${authorId === AUTHOR.minace ? 'minace' : 'dardan'} (${payload.body && (payload.body as unknown[]).length} blocks)`;

    if (DRY) {
      console.log(`DRY  ${tag}`);
      continue;
    }

    try {
      if (await exists(slug, locale)) {
        console.log(`skip ${tag} (already in hub)`);
        skipped++;
        continue;
      }
      // Two-step create: POST as draft, then PATCH to published. The combined
      // POST+_status:published path triggers a 500 in a hub publish-hook for some
      // articles; draft→publish is the reliable path (and atomic enough here).
      const res = await fetch(`${HUB}/api/articles`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ...payload, _status: 'draft' }),
      });
      if (!res.ok) {
        console.error(`FAIL ${tag} → create HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
        failed++;
        continue;
      }
      const id = ((await res.json()) as { doc?: { id?: string | number } }).doc?.id;
      const pub = await fetch(`${HUB}/api/articles/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ _status: 'published' }),
      });
      if (!pub.ok) {
        console.error(`FAIL ${tag} → publish HTTP ${pub.status}: ${(await pub.text()).slice(0, 300)} (left as draft, id=${id})`);
        failed++;
        continue;
      }
      console.log(`OK   ${tag}`);
      created++;
    } catch (e) {
      console.error(`FAIL ${tag} → ${(e as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. created=${created} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
