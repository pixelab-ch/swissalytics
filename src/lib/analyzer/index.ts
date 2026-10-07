import * as cheerio from 'cheerio';
import { safeFetch } from '@/lib/security/safe-fetch';
import type { AnalysisResult } from '../types';
import { analyzeHeadings } from './headings';
import { analyzeImages } from './images';
import { analyzeLinks } from './links';
import { analyzeTechnical } from './technical';
import { analyzeMetadata } from './metadata';
import { analyzeReadability } from './readability';
import { analyzeKeywords } from './keywords';
import { detectSpa } from './spa-detection';
import { calculateGlobalScore } from './score';

async function fetchHtml(url: string): Promise<{ html: string; headers: Record<string, string> }> {
  // SSRF-guarded: every hop validated + pinned, TLS verified, 5 MB cap
  // (the technical analysis flags HTML > 2 MB, so the cap must stay above it).
  const res = await safeFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'identity',
    },
    timeoutMs: 10000,
    maxBytes: 5 * 1024 * 1024,
    maxRedirects: 5,
    accept: 'html',
  });

  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return { html: await res.text(), headers: responseHeaders };
}

export async function analyzePage(url: string): Promise<AnalysisResult> {
  const parsed = new URL(url);
  const normalizedUrl = parsed.href;

  const { html, headers: responseHeaders } = await fetchHtml(normalizedUrl);
  const $ = cheerio.load(html);

  // Extract keywords BEFORE readability (which removes script/style tags)
  const keywords = analyzeKeywords($, normalizedUrl);
  const primaryKeyword = keywords.placement?.primary;

  const [headings, images, links, metadata, readability, technical] = await Promise.all([
    Promise.resolve(analyzeHeadings($, primaryKeyword)),
    Promise.resolve(analyzeImages($, normalizedUrl)),
    analyzeLinks($, normalizedUrl),
    Promise.resolve(analyzeMetadata($, normalizedUrl)),
    Promise.resolve(analyzeReadability($)),
    analyzeTechnical($, normalizedUrl, html, responseHeaders, primaryKeyword),
  ]);

  const score = calculateGlobalScore({
    headings, images, links, technical, metadata, readability, keywords,
  });

  const spa = detectSpa($, html);

  return {
    url: normalizedUrl,
    timestamp: new Date().toISOString(),
    score,
    keywords,
    headings, images, links, technical, metadata, readability,
    spa,
  };
}
