import { type ReactElement } from 'react';

export const OG_SIZE = { width: 1200, height: 630 };

export const OG_CONTENT_TYPE = 'image/png';

// Brand tokens, mirror of globals.css --sa-cream / --sa-ink / --sa-red.
// Inlined as hex because Satori cannot read CSS custom properties.
const OG = { cream: '#F5F2EA', ink: '#0A0A0A', red: '#E5241A' } as const;

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: 'normal';
};

// Memoized per process. OG routes are statically generated (generateStaticParams),
// so this normally runs once at build, not on production requests.
let cachedFonts: OgFont[] | null = null;

// Satori cannot read WOFF2. Fetch the Google Fonts CSS with an old User-Agent
// so Google serves a legacy (TTF/WOFF) font URL, then download that binary.
const LEGACY_UA = 'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko';

async function fetchFontData(cssUrl: string): Promise<ArrayBuffer> {
  const cssRes = await fetch(cssUrl, {
    headers: { 'User-Agent': LEGACY_UA },
    signal: AbortSignal.timeout(5000),
  });
  if (!cssRes.ok) throw new Error(`Font CSS fetch failed (${cssRes.status}): ${cssUrl}`);
  const css = await cssRes.text();

  const match = css.match(/src:\s*url\(([^)]+\.(?:ttf|woff))\)/i);
  if (!match) throw new Error(`Could not extract font URL from CSS: ${cssUrl}`);

  const fontUrl = match[1].replace(/['"]/g, '');
  const fontRes = await fetch(fontUrl, { signal: AbortSignal.timeout(5000) });
  if (!fontRes.ok) throw new Error(`Font binary fetch failed (${fontRes.status}): ${fontUrl}`);
  return await fontRes.arrayBuffer();
}

/**
 * Load Inter Tight 800 + JetBrains Mono 600 for Satori. Fails SOFT: if the fetch or
 * the legacy-UA regex ever breaks, we return [] so ImageResponse falls back to its
 * default font and still produces a valid image — never a 500. Failures are not cached,
 * so a transient network blip recovers on the next render.
 */
export async function loadOgFonts(): Promise<OgFont[]> {
  if (cachedFonts) return cachedFonts;
  try {
    const [interTight, jetBrainsMono] = await Promise.all([
      fetchFontData('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@800'),
      fetchFontData('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600'),
    ]);
    cachedFonts = [
      { name: 'Inter Tight', data: interTight, weight: 800, style: 'normal' },
      { name: 'JetBrains Mono', data: jetBrainsMono, weight: 600, style: 'normal' },
    ];
    return cachedFonts;
  } catch (err) {
    console.error('[og] font load failed; rendering with default font', err);
    return [];
  }
}

export function OgCard({ kicker, title }: { kicker: string; title: string }): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: OG.cream,
        display: 'flex',
        flexDirection: 'column',
        padding: 64,
        fontFamily: 'Inter Tight',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: `2px solid ${OG.ink}`,
          padding: 56,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: 'JetBrains Mono',
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: OG.red,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Inter Tight',
            fontWeight: 800,
            fontSize: 68,
            lineHeight: 1.05,
            letterSpacing: -2,
            color: OG.ink,
          }}
        >
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Inter Tight',
              fontWeight: 800,
              fontSize: 30,
              color: OG.ink,
            }}
          >
            Swissalytics
          </div>
          <div style={{ width: 14, height: 14, backgroundColor: OG.red, marginLeft: 8 }} />
          <div
            style={{
              display: 'flex',
              marginLeft: 'auto',
              fontFamily: 'JetBrains Mono',
              fontSize: 18,
              color: OG.ink,
              opacity: 0.6,
            }}
          >
            swissalytics.com
          </div>
        </div>
      </div>
    </div>
  );
}
