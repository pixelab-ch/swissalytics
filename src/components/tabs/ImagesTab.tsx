'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { ImagesAnalysis, Issue } from '@/lib/types';

type ImageItem = ImagesAnalysis['images'][number];

/** Strip the trailing URL from an analyzer message → just the human reason.
 *  "Image sans attribut alt: https://…" → "Image sans attribut alt". */
function issueReason(message: string): string {
  return message.split(/:\s*(?:https?:\/\/|\/|data:)/)[0].trim();
}

/** Best-effort format from a URL, for the synthetic preview item. */
function formatFromUrl(url: string): string {
  if (url.startsWith('data:image/')) return url.slice(11).split(/[;,+]/)[0] || 'image';
  try {
    const ext = new URL(url, 'https://x.test').pathname.split('.').pop()?.toLowerCase();
    return ext && ext.length <= 4 ? ext : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Long media URLs: wrap onto up to 3 lines, then ellipsis (mirrors LinksTab). */
const clamp3: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};
import IssuesList from '../IssuesList';
import CTABanner from '../CTABanner';
import InfoBox from '../InfoBox';
import { SectionHeader, TabFrame } from './_v2';

function statColor(v: number, good: number, mid: number): string {
  if (v >= good) return 'var(--sa-ok)';
  if (v >= mid) return 'var(--sa-warn)';
  return 'var(--sa-red)';
}

function StatCell({ value, label, color = 'var(--sa-ink)' }: { value: number | string; label: string; color?: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--sa-rule)',
        background: 'var(--sa-cream-2)',
        padding: '14px 12px',
        textAlign: 'center',
      }}
    >
      <div className="display tnum" style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div className="mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sa-ink-4)' }}>
        {label}
      </div>
    </div>
  );
}

export default function ImagesTab({ data }: { data: ImagesAnalysis }) {
  const [showAllImages, setShowAllImages] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<ImageItem | null>(null);
  const altPercent = data.total > 0 ? Math.round((data.withAlt / data.total) * 100) : 100;

  const formatCounts: Record<string, number> = {};
  data.images.forEach((img) => {
    const f = img.format.toUpperCase();
    formatCounts[f] = (formatCounts[f] || 0) + 1;
  });

  const displayedImages = showAllImages ? data.images : data.images.slice(0, 15);

  // Open a problematic media in the existing rich preview. Reuse the matching
  // analysed image (full metadata) when the issue URL maps to one; otherwise
  // synthesise a minimal item so the popup still shows the media + its source.
  const openIssueMedia = (url: string) => {
    const match = data.images.find((im) => im.src === url);
    setPreview(
      match ?? { src: url, alt: '', hasAlt: false, isLazy: false, format: formatFromUrl(url), hasSrcset: false },
    );
  };

  return (
    <TabFrame>
      {/* §01 — Stats */}
      <section>
        <SectionHeader
          num="01"
          title="Statistiques des images"
          info={
            <InfoBox
              items={[
                { term: 'Attribut Alt (texte alternatif)', definition: "Un texte descriptif associé à chaque image. Lu par les moteurs et lecteurs d'écran. Décrivez en quelques mots." },
                { term: 'Lazy Loading', definition: "Retarde le chargement des images hors écran. Les images se chargent quand l'utilisateur scrolle." },
                { term: 'Format WebP / AVIF', definition: 'Formats modernes (compression -25 à -50% vs JPEG/PNG sans perte visible). Recommandés par Google.' },
                { term: 'Dimensions explicites', definition: 'width + height évitent les sauts de mise en page (CLS).' },
                { term: 'Srcset (responsive)', definition: 'Permet au navigateur de choisir la meilleure taille selon l\'écran. Réduit le temps mobile.' },
              ]}
            />
          }
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <StatCell value={data.total} label="Total" />
          <StatCell value={data.withAlt} label="Avec alt" color={data.withAlt > 0 ? 'var(--sa-ok)' : 'var(--sa-ink)'} />
          <StatCell
            value={data.withoutAlt}
            label="Alt manquant"
            color={data.withoutAlt > 0 ? 'var(--sa-red)' : 'var(--sa-ink)'}
          />
          <StatCell value={`${altPercent}%`} label="Couverture" color={statColor(altPercent, 80, 50)} />
          <StatCell
            value={data.total - data.withoutResponsive}
            label="Responsive (srcset)"
            color={data.total > 0 && data.withoutResponsive === 0 ? 'var(--sa-ok)' : data.total > 3 ? 'var(--sa-warn)' : 'var(--sa-ink)'}
          />
        </div>
      </section>

      {/* §02 — Problèmes détectés. Per-image problems are compacted into a
          thumbnail gallery grouped by reason (click → the preview popup, which
          already shows the source link) instead of one tall card per image.
          Aggregate problems stay as readable cards. */}
      <ImageProblems issues={data.issues} onOpen={openIssueMedia} />

      {/* §03 — Format distribution */}
      {Object.keys(formatCounts).length > 0 && (
        <section>
          <SectionHeader num="03" title="Formats d'image" />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(formatCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([format, count]) => (
                <div
                  key={format}
                  className="mono"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    border: '1px solid var(--sa-rule)',
                    background: 'var(--sa-cream-2)',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: 'var(--sa-ink)',
                  }}
                >
                  <span>{format}</span>
                  <span className="tnum" style={{ color: 'var(--sa-ink-4)', fontWeight: 600 }}>×{count}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* §04 — Image list */}
      {data.images.length > 0 && (
        <section>
          <SectionHeader
            num="04"
            title={`Détail des images (${data.images.length})`}
            rightSlot={
              data.images.length > 15 ? (
                <button
                  onClick={() => setShowAllImages(!showAllImages)}
                  className="mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '6px 12px',
                    border: '1px solid var(--sa-ink)',
                    background: 'var(--sa-cream)',
                    color: 'var(--sa-ink)',
                    cursor: 'pointer',
                  }}
                >
                  {showAllImages ? 'Réduire' : `Tout afficher (${data.images.length})`}
                </button>
              ) : null
            }
          />
          <div style={{ border: '1px solid var(--sa-rule)', background: 'var(--sa-cream-2)' }}>
            {displayedImages.map((img, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr auto',
                  gap: 14,
                  padding: '12px 16px',
                  borderBottom: i < displayedImages.length - 1 ? '1px solid var(--sa-rule)' : 'none',
                  alignItems: 'center',
                }}
              >
                <div
                  onClick={() => img.src && setPreview(img)}
                  title={img.src ? "Voir l'image" : undefined}
                  style={{
                    width: 64,
                    height: 64,
                    background: 'var(--sa-cream-3)',
                    border: '1px solid var(--sa-rule)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    cursor: img.src ? 'zoom-in' : 'default',
                  }}
                >
                  {img.src && !failedImages.has(i) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={img.src}
                      alt={img.alt || ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={() => setFailedImages((prev) => new Set(prev).add(i))}
                    />
                  ) : (
                    <span className="mono" style={{ fontSize: 9, color: 'var(--sa-ink-4)', fontWeight: 700 }}>
                      {img.src ? img.format.toUpperCase() : 'N/A'}
                    </span>
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        padding: '2px 6px',
                        border: '1px solid var(--sa-rule)',
                        background: 'var(--sa-cream)',
                        color: 'var(--sa-ink-3)',
                      }}
                    >
                      {img.format.toUpperCase()}
                    </span>
                    {img.hasAlt && img.alt ? (
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          padding: '2px 6px',
                          border: '1px solid var(--sa-ok)',
                          color: 'var(--sa-ok)',
                          background: 'rgba(47, 107, 63, 0.06)',
                        }}
                      >
                        ALT
                      </span>
                    ) : (
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          padding: '2px 6px',
                          border: '1px solid var(--sa-red)',
                          color: 'var(--sa-red)',
                          background: 'rgba(229, 36, 26, 0.05)',
                        }}
                      >
                        ALT MANQUANT
                      </span>
                    )}
                    {img.isLazy && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          padding: '2px 6px',
                          border: '1px solid var(--sa-rule)',
                          color: 'var(--sa-ink-4)',
                          background: 'var(--sa-cream)',
                        }}
                      >
                        LAZY
                      </span>
                    )}
                  </div>
                  {img.alt && (
                    <p style={{ fontSize: 13, color: 'var(--sa-ink-2)', margin: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {img.alt}
                    </p>
                  )}
                  {img.src ? (
                    <button
                      type="button"
                      onClick={() => setPreview(img)}
                      title="Voir l'image"
                      className="mono"
                      style={{
                        ...clamp3,
                        fontSize: 11,
                        color: 'var(--sa-ink-4)',
                        margin: 0,
                        textAlign: 'left',
                        background: 'transparent',
                        border: 0,
                        padding: 0,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                      }}
                    >
                      {img.src}
                    </button>
                  ) : (
                    <p className="mono" style={{ fontSize: 11, color: 'var(--sa-ink-4)', margin: 0, fontStyle: 'italic' }}>
                      src inline / data-uri
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span className="mono tnum" style={{ fontSize: 11, color: 'var(--sa-ink-4)', textAlign: 'right' }}>
                    {img.width && img.height ? `${img.width}×${img.height}` : '—'}
                  </span>
                  {img.src && (
                    <button
                      onClick={() => setPreview(img)}
                      className="mono"
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        padding: '4px 9px',
                        border: '1px solid var(--sa-ink)',
                        background: 'var(--sa-cream)',
                        color: 'var(--sa-ink)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Voir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <CTABanner variant="inline" />

      {preview && <ImagePreview img={preview} onClose={() => setPreview(null)} />}
    </TabFrame>
  );
}

const issueTone: Record<Issue['type'], { stroke: string; bg: string }> = {
  error:   { stroke: 'var(--sa-red)',   bg: 'rgba(229, 36, 26, 0.05)' },
  warning: { stroke: 'var(--sa-warn)',  bg: 'rgba(184, 123, 0, 0.05)' },
  info:    { stroke: 'var(--sa-ink-4)', bg: 'var(--sa-cream-2)' },
};

/**
 * Compact image-problems block. Per-image issues (those carrying a `url`) are
 * grouped by reason and rendered as a tight thumbnail gallery — each thumb is
 * the offending image and opens the preview popup (which shows the source
 * link). This replaces one tall card per image, so a page with many flagged
 * images no longer produces a kilometre-long list. Aggregate, non-media issues
 * keep their readable cards underneath.
 */
function ImageProblems({ issues, onOpen }: { issues: Issue[]; onOpen: (url: string) => void }) {
  const media = issues.filter((i) => i.url);
  const others = issues.filter((i) => !i.url);
  if (media.length === 0 && others.length === 0) return null;

  const groups: Array<{ type: Issue['type']; reason: string; urls: string[] }> = [];
  const index = new Map<string, number>();
  for (const iss of media) {
    if (!iss.url) continue;
    const reason = issueReason(iss.message);
    const key = `${iss.type}|${reason}`;
    let gi = index.get(key);
    if (gi === undefined) {
      gi = groups.length;
      index.set(key, gi);
      groups.push({ type: iss.type, reason, urls: [] });
    }
    groups[gi].urls.push(iss.url);
  }

  return (
    <section>
      <SectionHeader num="02" title={`Problèmes détectés (${media.length + others.length})`} />
      {groups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: others.length ? 20 : 0 }}>
          {groups.map((g, gi) => {
            const tone = issueTone[g.type];
            return (
              <div key={gi} style={{ border: `1px solid ${tone.stroke}`, background: tone.bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--sa-rule)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone.stroke, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sa-ink)' }}>{g.reason}</span>
                  <span className="mono tnum" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: tone.stroke }}>
                    {g.urls.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12 }}>
                  {g.urls.map((u, ui) => (
                    <IssueThumb key={ui} url={u} onClick={() => onOpen(u)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {others.length > 0 && <IssuesList issues={others} showHeader={false} />}
    </section>
  );
}

function IssueThumb({ url, onClick }: { url: string; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title="Voir le média"
      aria-label="Voir le média"
      style={{
        width: 46,
        height: 46,
        padding: 0,
        border: '1px solid var(--sa-rule)',
        background: 'var(--sa-cream-3)',
        cursor: 'zoom-in',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!failed ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt="" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span className="mono" style={{ fontSize: 14, color: 'var(--sa-ink-4)', fontWeight: 700 }}>?</span>
      )}
    </button>
  );
}

/**
 * Full-size image preview — portaled to <body> so it escapes the report's
 * transformed/scrolled ancestors. Shows the image, its source URL (openable),
 * alt text and key attributes so you know exactly which media to act on.
 */
function ImagePreview({ img, onClose }: { img: ImageItem; onClose: () => void }) {
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(10, 10, 10, 0.55)', zIndex: 1000 }}
      />
      <div
        role="dialog"
        aria-label="Aperçu de l'image"
        style={{
          position: 'fixed',
          left: 16,
          right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          margin: '0 auto',
          maxWidth: 560,
          maxHeight: '86vh',
          overflowY: 'auto',
          zIndex: 1001,
          background: 'var(--sa-cream)',
          border: '2px solid var(--sa-ink)',
        }}
      >
        <div
          className="ink-b mono"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'var(--sa-ink)',
            color: 'var(--sa-cream)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          <span>Aperçu de l&apos;image</span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{ background: 'transparent', border: 'none', color: 'var(--sa-cream)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Image */}
        <div
          className="placeholder-hatch"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 160 }}
        >
          {!failed ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={img.src}
              alt={img.alt || ''}
              onError={() => setFailed(true)}
              style={{ maxWidth: '100%', maxHeight: '56vh', objectFit: 'contain', border: '1px solid var(--sa-rule)', background: 'var(--sa-cream)' }}
            />
          ) : (
            <span className="mono" style={{ fontSize: 11, color: 'var(--sa-ink-4)', fontWeight: 700, letterSpacing: '0.08em' }}>
              Image non chargeable
            </span>
          )}
        </div>

        {/* Meta */}
        <div style={{ borderTop: '1px solid var(--sa-rule)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {img.alt && (
            <div>
              <div className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--sa-ink-4)', marginBottom: 3 }}>
                Alt
              </div>
              <div style={{ fontSize: 13, color: 'var(--sa-ink-2)', overflowWrap: 'anywhere' }}>{img.alt}</div>
            </div>
          )}
          <div>
            <div className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--sa-ink-4)', marginBottom: 3 }}>
              Source · {img.format.toUpperCase()}
              {img.width && img.height ? ` · ${img.width}×${img.height}` : ''}
            </div>
            <a
              href={img.src}
              target="_blank"
              rel="noopener noreferrer"
              className="mono"
              style={{ fontSize: 11, color: 'var(--sa-red)', overflowWrap: 'anywhere', textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              {img.src}
            </a>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
