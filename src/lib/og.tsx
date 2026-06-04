import { type ReactElement } from 'react';

export const OG_SIZE = { width: 1200, height: 630 };

export const OG_CONTENT_TYPE = 'image/png';

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: 'normal';
};

// Memoized across multiple route invocations at build time.
let cachedFonts: OgFont[] | null = null;

// Satori cannot read WOFF2. Fetch the Google Fonts CSS with an old User-Agent
// so Google serves a legacy (TTF/WOFF) font URL, then download that binary.
const LEGACY_UA =
  'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko';

async function fetchFontData(cssUrl: string): Promise<ArrayBuffer> {
  const css = await (
    await fetch(cssUrl, { headers: { 'User-Agent': LEGACY_UA } })
  ).text();

  const match = css.match(/src:\s*url\(([^)]+\.(?:ttf|woff))\)/i);
  if (!match) {
    throw new Error(`Could not extract font URL from CSS: ${cssUrl}`);
  }

  const fontUrl = match[1].replace(/['"]/g, '');
  return await (await fetch(fontUrl)).arrayBuffer();
}

export async function loadOgFonts(): Promise<OgFont[]> {
  if (cachedFonts) {
    return cachedFonts;
  }

  const [interTight, jetBrainsMono] = await Promise.all([
    fetchFontData(
      'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@800',
    ),
    fetchFontData(
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600',
    ),
  ]);

  cachedFonts = [
    { name: 'Inter Tight', data: interTight, weight: 800, style: 'normal' },
    { name: 'JetBrains Mono', data: jetBrainsMono, weight: 600, style: 'normal' },
  ];

  return cachedFonts;
}

export function OgCard({
  kicker,
  title,
}: {
  kicker: string;
  title: string;
}): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#F5F2EA',
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
          border: '2px solid #0A0A0A',
          padding: 56,
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
            color: '#E5241A',
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
            color: '#0A0A0A',
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: 'Inter Tight',
              fontWeight: 800,
              fontSize: 30,
              color: '#0A0A0A',
            }}
          >
            Swissalytics
          </div>
          <div
            style={{
              width: 14,
              height: 14,
              backgroundColor: '#E5241A',
              marginLeft: 8,
            }}
          />
          <div
            style={{
              display: 'flex',
              marginLeft: 'auto',
              fontFamily: 'JetBrains Mono',
              fontSize: 18,
              color: '#0A0A0A',
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
