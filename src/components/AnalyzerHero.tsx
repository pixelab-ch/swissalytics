'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useTheme } from '@/components/design-system/ThemeProvider';
import { COPY } from '@/lib/i18n/copy';
import { Chip, DisplayTitle } from '@/components/design-system/primitives';

interface AnalyzerHeroProps {
  url: string;
  setUrl: (url: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  error?: string;
}

export default function AnalyzerHero({ url, setUrl, onAnalyze, loading, error }: AnalyzerHeroProps) {
  const { lang } = useTheme();
  const copy = COPY[lang];

  // Which crawler animation to run. Both DOMs render (CSS picks the visible
  // one — SSR-safe, no flash); `active` only gates the timers so the hidden
  // one doesn't animate. null until hydrated → animation starts post-mount.
  const [isMobileView, setIsMobileView] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobileView(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return (
    <section className="ink-b" style={{ background: 'var(--sa-bg)' }}>
      <div className="hero-pad" style={{ padding: '80px 24px 56px' }}>
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)',
            gap: 48,
            alignItems: 'stretch',
          }}
          className="sa-hero-grid"
        >
          <div className="sa-rise" style={{ minWidth: 0 }}>
            <div className="hero-chips" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
              <Chip>{copy.hero.badges[0]}</Chip>
              <Chip inverted>{copy.hero.badges[1]}</Chip>
              <Chip>{copy.hero.badges[2]}</Chip>
            </div>

            <DisplayTitle parts={copy.hero.title} size="hero" className="hero-title" />

            <p
              className="hero-sub"
              style={{
                fontSize: 20,
                lineHeight: 1.45,
                maxWidth: 560,
                color: 'var(--sa-ink-2)',
                marginTop: 36,
                marginBottom: 36,
              }}
            >
              {copy.hero.sub}
            </p>

            <div style={{ maxWidth: 640 }}>
              <div className="frame hero-form" style={{ display: 'flex', background: 'var(--sa-bg)' }}>
                <div
                  className="mono hero-form-prefix"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 18px',
                    background: 'var(--sa-ink)',
                    color: 'var(--sa-cream)',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                  }}
                >
                  HTTPS://
                </div>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onAnalyze()}
                  placeholder={copy.hero.placeholder}
                  disabled={loading}
                  aria-label={lang === 'fr' ? 'URL du site à analyser' : 'Site URL to analyze'}
                  className="hero-input"
                  style={{
                    flex: 1,
                    border: 0,
                    outline: 'none',
                    background: 'transparent',
                    padding: '18px',
                    fontSize: 16,
                    fontFamily: 'var(--sa-font-mono)',
                    fontWeight: 500,
                    color: 'var(--sa-ink)',
                    minWidth: 0,
                  }}
                />
                <button
                  onClick={onAnalyze}
                  disabled={loading}
                  className="hero-form-btn"
                  style={{
                    border: 0,
                    borderLeft: '2px solid var(--sa-ink)',
                    background: 'var(--sa-red)',
                    color: 'var(--sa-cream)',
                    padding: '0 28px',
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: '0.04em',
                    fontFamily: 'var(--sa-font-sans)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? copy.hero.btnRun : copy.hero.btnIdle}
                </button>
              </div>

              <div
                className="mono"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 24,
                  marginTop: 14,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  opacity: 0.65,
                }}
              >
                {copy.hero.proofs.map((p, i) => (
                  <span key={i}>{p}</span>
                ))}
              </div>

              {error && (
                <div
                  className="mono sa-rise"
                  style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    background: 'var(--sa-red)',
                    color: 'var(--sa-cream)',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                >
                  ERR · {error}
                </div>
              )}
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <div className="hero-aside-desktop">
              <HeroAsideCrawler lang={lang} active={isMobileView === false} />
            </div>
            <div className="hero-aside-mobile">
              <HeroAsideCrawlerMobile lang={lang} active={isMobileView === true} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .hero-aside-mobile { display: none; }
        @media (max-width: 960px) {
          .sa-hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
        @media (max-width: 640px) {
          .hero-pad { padding: 36px 16px 32px !important; }
          .hero-chips { margin-bottom: 18px !important; }
          .hero-title { font-size: 34px !important; line-height: 1.0 !important; letter-spacing: -0.02em !important; }
          .hero-sub { font-size: 15px !important; line-height: 1.4 !important; margin-top: 18px !important; margin-bottom: 22px !important; }
          .hero-form-prefix { padding: 0 12px !important; font-size: 10px !important; }
          .hero-input { padding: 13px 14px !important; }
          .hero-form-btn { padding: 13px 14px !important; font-size: 12px !important; }
          /* Swap desktop crawler for the compact mobile animation. */
          .hero-aside-desktop { display: none !important; }
          .hero-aside-mobile { display: block !important; }
        }
        @media (min-width: 641px) and (max-width: 768px) {
          .hero-title { font-size: clamp(44px, 8vw, 64px) !important; }
        }
      `}</style>
    </section>
  );
}

function HeroAsideCrawler({ lang, active = true }: { lang: 'fr' | 'en'; active?: boolean }) {
  const isFr = lang === 'fr';
  const [counts, setCounts] = useState({ h: 0, p: 0, img: 0, a: 0 });

  useEffect(() => {
    if (!active) return;
    const seq: Array<[Partial<typeof counts>, number]> = [
      [{ h: 1 }, 100], [{ p: 1 }, 200], [{ p: 2 }, 280], [{ p: 3 }, 360],
      [{ img: 1 }, 600], [{ img: 2 }, 680],
      [{ h: 2 }, 900], [{ p: 4 }, 1020], [{ p: 5 }, 1100],
      [{ a: 1 }, 1280], [{ a: 2 }, 1360], [{ a: 3 }, 1440],
      [{ h: 3 }, 1640], [{ p: 6 }, 1760], [{ p: 7 }, 1840], [{ p: 8 }, 1920],
      [{ a: 4 }, 2080], [{ a: 5 }, 2160],
      [{ p: 9 }, 2320], [{ p: 10 }, 2400],
    ];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setCounts({ h: 0, p: 0, img: 0, a: 0 });
      seq.forEach(([v, t]) =>
        timers.push(setTimeout(() => setCounts((c) => ({ ...c, ...v })), t))
      );
    };
    run();
    const i = setInterval(run, 2800);
    return () => {
      clearInterval(i);
      timers.forEach(clearTimeout);
    };
  }, [active]);

  interface Block {
    t: string;
    w: string;
    d: number;
    big?: boolean;
    img?: boolean;
    link?: boolean;
  }
  const blocks: Block[] = [
    { t: 'H1', w: '82%', d: 0.0, big: true },
    { t: 'P',  w: '96%', d: 0.12 },
    { t: 'P',  w: '88%', d: 0.22 },
    { t: 'P',  w: '74%', d: 0.32 },
    { t: 'IMG',w: '100%', d: 0.55, img: true },
    { t: 'H2', w: '64%', d: 0.88 },
    { t: 'P',  w: '92%', d: 1.0 },
    { t: 'P',  w: '84%', d: 1.1 },
    { t: 'A',  w: '70%', d: 1.25, link: true },
    { t: 'A',  w: '56%', d: 1.35, link: true },
    { t: 'A',  w: '62%', d: 1.45, link: true },
    { t: 'H3', w: '48%', d: 1.6 },
    { t: 'P',  w: '94%', d: 1.72 },
    { t: 'P',  w: '82%', d: 1.82 },
    { t: 'P',  w: '76%', d: 1.92 },
    { t: 'A',  w: '66%', d: 2.08, link: true },
    { t: 'A',  w: '44%', d: 2.18, link: true },
    { t: 'P',  w: '90%', d: 2.3 },
    { t: 'P',  w: '72%', d: 2.4 },
  ];

  const wrapStyle: CSSProperties = {
    background: 'var(--sa-bg)',
    animationDelay: '120ms',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 680,
    height: '100%',
  };

  return (
    <aside className="frame sa-rise hero-aside" style={wrapStyle}>
      <div style={{ background: 'var(--sa-ink)', padding: '10px 14px', borderBottom: '2px solid var(--sa-ink)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: 'var(--sa-red)' }} />
          <span style={{ width: 8, height: 8, background: '#E8A800' }} />
          <span style={{ width: 8, height: 8, background: 'var(--sa-ok)' }} />
          <span
            className="mono"
            style={{
              marginLeft: 8,
              fontSize: 10,
              letterSpacing: '0.14em',
              color: 'var(--sa-cream)',
              opacity: 0.6,
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {isFr ? 'Swissalytics · analyse' : 'Swissalytics · analysis'}
          </span>
          <span
            className="sa-ping"
            style={{ marginLeft: 'auto', display: 'inline-block', width: 6, height: 6, background: 'var(--sa-red)' }}
          />
        </div>
        <div
          style={{
            background: 'rgba(245,242,234,0.08)',
            border: '1px solid rgba(245,242,234,0.15)',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span className="mono" style={{ fontSize: 10, color: 'var(--sa-red)', fontWeight: 800, letterSpacing: '0.1em' }}>
            GET
          </span>
          <span
            className="mono"
            style={{
              fontSize: 12,
              color: 'var(--sa-cream)',
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            https://pixelab.ch
          </span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--sa-ok)', fontWeight: 700, letterSpacing: '0.1em' }}>
            200 OK
          </span>
        </div>
      </div>

      <div className="hero-aside-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 160px', flex: 1, minHeight: 0 }}>
        <div className="hero-aside-doc" style={{ position: 'relative', padding: '22px 20px', overflow: 'hidden' }}>
          {blocks.map((b, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '42px 1fr',
                gap: 12,
                marginBottom: 10,
                animation: `sa-flash 2.8s ${b.d}s infinite`,
                alignItems: 'center',
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  padding: '3px 5px',
                  height: 'fit-content',
                  textAlign: 'center',
                  border: `1px solid ${b.link ? 'var(--sa-red)' : 'var(--sa-ink-4)'}`,
                  color: b.link ? 'var(--sa-red)' : 'var(--sa-ink-4)',
                  background: 'var(--sa-bg)',
                }}
              >
                {b.t}
              </span>
              <div
                style={{
                  height: b.img ? 64 : b.big ? 20 : 12,
                  width: b.w,
                  background: b.img ? 'var(--sa-cream-2)' : b.link ? 'rgba(229,36,26,0.18)' : 'var(--sa-rule)',
                  border: b.img ? '1px dashed var(--sa-ink-4)' : 0,
                  position: 'relative',
                }}
              >
                {b.img && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: 'var(--sa-ink-4)', letterSpacing: '0.14em', fontWeight: 700 }}
                    >
                      alt=&quot;?&quot;
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div
            className="sa-scanner"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 2,
              background: 'var(--sa-red)',
              boxShadow: '0 0 16px var(--sa-red), 0 0 4px var(--sa-red)',
            }}
          />
        </div>

        <div
          className="hero-aside-stats"
          style={{
            borderLeft: '2px solid var(--sa-ink)',
            background: 'var(--sa-cream-2)',
            padding: '22px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--sa-ink-4)',
            }}
          >
            {isFr ? 'Éléments détectés' : 'Elements found'}
          </div>
          {[
            { k: 'H1–H3', v: counts.h,   max: 3,  c: 'var(--sa-ink)' as const },
            { k: 'P',     v: counts.p,   max: 10, c: 'var(--sa-ink)' as const },
            { k: 'IMG',   v: counts.img, max: 2,  c: 'var(--sa-warn)' as const },
            { k: 'A',     v: counts.a,   max: 5,  c: 'var(--sa-red)' as const },
          ].map((r) => (
            <div key={r.k}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 4,
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--sa-ink)' }}
                >
                  {r.k}
                </span>
                <span
                  className="display tnum"
                  style={{ fontSize: 22, fontWeight: 800, color: r.c, lineHeight: 1 }}
                >
                  {r.v}
                </span>
              </div>
              <div style={{ height: 3, background: 'var(--sa-rule)', position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: -1,
                    height: 5,
                    width: `${Math.min(100, (r.v / r.max) * 100)}%`,
                    background: r.c,
                    transition: 'width 180ms ease',
                  }}
                />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--sa-ink-4)', paddingTop: 14 }}>
            <div
              className="mono"
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--sa-ink-4)',
              }}
            >
              {isFr ? 'Temps' : 'Elapsed'}
            </div>
            <div className="mono tnum" style={{ fontSize: 16, fontWeight: 800, color: 'var(--sa-ink)' }}>
              0.{(counts.h + counts.p + counts.img + counts.a).toString().padStart(2, '0')}s
            </div>
          </div>
        </div>
      </div>

      <div
        className="mono"
        style={{
          padding: '8px 14px',
          background: 'var(--sa-ink)',
          color: 'var(--sa-cream)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontWeight: 700,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>● {isFr ? 'Analyse en cours' : 'Analysis in progress'}</span>
        <span style={{ color: 'var(--sa-red)' }}>
          {counts.h + counts.p + counts.img + counts.a}/20 {isFr ? 'nœuds' : 'nodes'}
        </span>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .hero-aside { min-height: 0 !important; }
          .hero-aside-grid { grid-template-columns: 1fr 140px !important; }
        }
        @media (max-width: 640px) {
          .hero-aside-grid { grid-template-columns: 1fr !important; }
          .hero-aside-doc { padding: 18px 16px !important; }
          .hero-aside-stats {
            border-left: 0 !important;
            border-top: 2px solid var(--sa-ink) !important;
          }
        }
      `}</style>
    </aside>
  );
}

/* ============================================================
   HeroAsideCrawlerMobile — compact, fast animation for phones.
   Lean version of the desktop crawler: ~5 scan rows + a tight
   inline stat strip, ~1.8s loop so it never feels slow.
   ============================================================ */
function HeroAsideCrawlerMobile({ lang, active = true }: { lang: 'fr' | 'en'; active?: boolean }) {
  const isFr = lang === 'fr';
  const [counts, setCounts] = useState({ h: 0, p: 0, img: 0, a: 0 });

  useEffect(() => {
    if (!active) return;
    const seq: Array<[Partial<typeof counts>, number]> = [
      [{ h: 1 }, 120], [{ p: 1 }, 260], [{ p: 2 }, 360],
      [{ img: 1 }, 520], [{ h: 2 }, 660], [{ p: 3 }, 780],
      [{ a: 1 }, 920], [{ a: 2 }, 1020], [{ p: 4 }, 1160],
      [{ img: 2 }, 1280], [{ a: 3 }, 1400],
    ];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setCounts({ h: 0, p: 0, img: 0, a: 0 });
      seq.forEach(([v, t]) => timers.push(setTimeout(() => setCounts((c) => ({ ...c, ...v })), t)));
    };
    run();
    const i = setInterval(run, 1900);
    return () => {
      clearInterval(i);
      timers.forEach(clearTimeout);
    };
  }, [active]);

  const rows: Array<{ t: string; w: string; d: number; big?: boolean; img?: boolean; link?: boolean }> = [
    { t: 'H1', w: '78%', d: 0.0, big: true },
    { t: 'P', w: '92%', d: 0.18 },
    { t: 'P', w: '74%', d: 0.3 },
    { t: 'IMG', w: '100%', d: 0.52, img: true },
    { t: 'A', w: '64%', d: 0.9, link: true },
  ];

  const total = counts.h + counts.p + counts.img + counts.a;
  const stats: Array<{ k: string; v: number; c: string }> = [
    { k: 'H', v: counts.h, c: 'var(--sa-ink)' },
    { k: 'P', v: counts.p, c: 'var(--sa-ink)' },
    { k: 'IMG', v: counts.img, c: 'var(--sa-warn)' },
    { k: 'A', v: counts.a, c: 'var(--sa-red)' },
  ];

  return (
    <aside className="frame sa-rise" style={{ background: 'var(--sa-bg)', overflow: 'hidden' }}>
      {/* Terminal header */}
      <div style={{ background: 'var(--sa-ink)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, background: 'var(--sa-red)' }} />
        <span style={{ width: 7, height: 7, background: '#E8A800' }} />
        <span style={{ width: 7, height: 7, background: 'var(--sa-ok)' }} />
        <span
          className="mono"
          style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--sa-cream)', opacity: 0.6, textTransform: 'uppercase', fontWeight: 700 }}
        >
          {isFr ? 'Analyse' : 'Analysis'}
        </span>
        <span
          className="mono"
          style={{ marginLeft: 'auto', fontSize: 9, letterSpacing: '0.1em', color: 'var(--sa-ok)', fontWeight: 700 }}
        >
          200 OK
        </span>
        <span className="sa-ping" style={{ display: 'inline-block', width: 6, height: 6, background: 'var(--sa-red)' }} />
      </div>

      {/* Scan rows */}
      <div style={{ position: 'relative', padding: '14px 14px', overflow: 'hidden' }}>
        {rows.map((b, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '34px 1fr',
              gap: 10,
              marginBottom: 9,
              alignItems: 'center',
              animation: `sa-flash 1.9s ${b.d}s infinite`,
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.06em',
                padding: '2px 4px',
                textAlign: 'center',
                border: `1px solid ${b.link ? 'var(--sa-red)' : 'var(--sa-ink-4)'}`,
                color: b.link ? 'var(--sa-red)' : 'var(--sa-ink-4)',
                background: 'var(--sa-bg)',
              }}
            >
              {b.t}
            </span>
            <div
              style={{
                height: b.img ? 40 : b.big ? 16 : 10,
                width: b.w,
                background: b.img ? 'var(--sa-cream-2)' : b.link ? 'rgba(229,36,26,0.18)' : 'var(--sa-rule)',
                border: b.img ? '1px dashed var(--sa-ink-4)' : 0,
              }}
            />
          </div>
        ))}
        <div
          className="sa-scanner"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 2,
            background: 'var(--sa-red)',
            boxShadow: '0 0 12px var(--sa-red), 0 0 3px var(--sa-red)',
          }}
        />
      </div>

      {/* Compact inline stat strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: '2px solid var(--sa-ink)',
          background: 'var(--sa-cream-2)',
        }}
      >
        {stats.map((s, i) => (
          <div
            key={s.k}
            style={{
              padding: '10px 6px',
              textAlign: 'center',
              borderRight: i < 3 ? '1px solid var(--sa-rule)' : 0,
            }}
          >
            <div className="mono" style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--sa-ink-4)', textTransform: 'uppercase' }}>
              {s.k}
            </div>
            <div className="display tnum" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1, color: s.c }}>
              {s.v}
            </div>
          </div>
        ))}
      </div>

      {/* Footer status */}
      <div
        className="mono"
        style={{
          padding: '7px 12px',
          background: 'var(--sa-ink)',
          color: 'var(--sa-cream)',
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontWeight: 700,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>● {isFr ? 'Analyse en cours' : 'Analyzing'}</span>
        <span style={{ color: 'var(--sa-red)' }}>
          {total}/11 {isFr ? 'nœuds' : 'nodes'}
        </span>
      </div>
    </aside>
  );
}
