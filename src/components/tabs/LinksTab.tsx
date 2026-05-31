'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { LinksAnalysis, LinkInfo } from '@/lib/types';
import { groupLinksByHref } from '@/lib/analyzer/dedup-links';
import IssuesList from '../IssuesList';
import CTABanner from '../CTABanner';
import InfoBox from '../InfoBox';
import { SectionHeader, TabFrame } from './_v2';

/** Long URLs / texts: wrap and break onto up to 3 lines, then ellipsis. */
const clamp3: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};

/** Details about a link, for the preview popup. */
export interface LinkPreviewData {
  href: string;
  texts?: string[];
  isNofollow?: boolean;
  isSponsored?: boolean;
  isUgc?: boolean;
  status?: number;
  error?: string;
}

function StatCell({ value, label, color = 'var(--sa-ink)' }: { value: number | string; label: string; color?: string }) {
  return (
    <div style={{ border: '1px solid var(--sa-rule)', background: 'var(--sa-cream-2)', padding: '14px 12px', textAlign: 'center' }}>
      <div className="display tnum" style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div className="mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sa-ink-4)' }}>
        {label}
      </div>
    </div>
  );
}

function attrChip(label: string, color: string) {
  return (
    <span
      key={label}
      className="mono"
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        padding: '2px 6px',
        border: `1px solid ${color}`,
        color,
        background: 'var(--sa-cream)',
      }}
    >
      {label}
    </span>
  );
}

function LinkTable({ links, title, onOpen }: { links: LinkInfo[]; title: string; onOpen: (d: LinkPreviewData) => void }) {
  const [showAll, setShowAll] = useState(false);
  // P10: dedup display by canonical href. The raw count (links.length)
  // stays exposed in the section title so users see the duplication
  // exists; the table itself shows one row per unique URL.
  const deduped = groupLinksByHref(links);
  const displayed = showAll ? deduped : deduped.slice(0, 10);

  if (links.length === 0) return null;
  return (
    <section>
      <SectionHeader
        title={`${title} — ${deduped.length} URL${deduped.length > 1 ? 's' : ''} unique${deduped.length > 1 ? 's' : ''} (${links.length} liens DOM)`}
        rightSlot={
          deduped.length > 10 ? (
            <button
              onClick={() => setShowAll(!showAll)}
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
              {showAll ? 'Réduire' : `Tout afficher (${deduped.length})`}
            </button>
          ) : null
        }
      />
      <div className="noscrollbar" style={{ border: '1px solid var(--sa-rule)', background: 'var(--sa-cream-2)', overflowX: 'auto' }}>
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--sa-ink)' }}>
              <th className="mono" style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sa-ink-4)', width: '45%' }}>
                URL
              </th>
              <th className="mono" style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sa-ink-4)', width: '35%' }}>
                Texte(s) d&apos;ancrage
              </th>
              <th className="mono" style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sa-ink-4)', width: '20%' }}>
                Attributs
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((link, i) => (
              <tr key={`${link.href}-${i}`} style={{ borderBottom: i < displayed.length - 1 ? '1px solid var(--sa-rule)' : 'none' }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => onOpen({ href: link.href, texts: link.texts, isNofollow: link.isNofollow, isSponsored: link.isSponsored, isUgc: link.isUgc })}
                      title="Voir le lien"
                      className="mono"
                      style={{
                        ...clamp3,
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                        fontSize: 11,
                        color: 'var(--sa-ink-3)',
                        background: 'transparent',
                        border: 0,
                        padding: 0,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                      }}
                    >
                      {link.href}
                    </button>
                    {link.count > 1 && (
                      <span
                        className="mono tnum"
                        title={`${link.count} occurrences DOM`}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          padding: '2px 6px',
                          border: '1px solid var(--sa-rule)',
                          background: 'var(--sa-cream)',
                          color: 'var(--sa-ink-4)',
                          flexShrink: 0,
                        }}
                      >
                        ×{link.count}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {link.texts.length > 0 ? (
                    <span style={{ ...clamp3, color: 'var(--sa-ink-2)' }}>
                      {link.texts.join(' · ')}
                    </span>
                  ) : (
                    <em style={{ color: 'var(--sa-warn)', fontSize: 11 }}>Aucun texte</em>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {link.isNofollow && attrChip('nofollow', 'var(--sa-red)')}
                    {link.isSponsored && attrChip('sponsored', 'var(--sa-ink-4)')}
                    {link.isUgc && attrChip('ugc', 'var(--sa-ink-4)')}
                    {!link.isNofollow && !link.isSponsored && !link.isUgc && attrChip('dofollow', 'var(--sa-ok)')}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BrokenLinkRow({ href, status, error, onOpen }: { href: string; status: number; error?: string; onOpen: (d: LinkPreviewData) => void }) {
  const tone = status === 404 ? 'var(--sa-red)' : status >= 500 ? 'var(--sa-warn)' : 'var(--sa-ink-4)';
  const display = status === 0 ? error || 'timeout' : String(status);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 14px',
        borderBottom: '1px solid var(--sa-rule)',
      }}
    >
      <button
        type="button"
        onClick={() => onOpen({ href, status, error })}
        title="Voir le lien"
        className="mono"
        style={{ ...clamp3, fontSize: 11, color: 'var(--sa-ink-2)', flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 0, padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
      >
        {href}
      </button>
      <span
        className="mono"
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          padding: '3px 8px',
          border: `1px solid ${tone}`,
          color: tone,
          background: 'var(--sa-cream)',
          flexShrink: 0,
        }}
      >
        {display}
      </span>
    </div>
  );
}

export default function LinksTab({ data }: { data: LinksAnalysis }) {
  const internalPercent = data.total > 0 ? Math.round((data.internal.length / data.total) * 100) : 0;
  const externalPercent = data.total > 0 ? Math.round((data.external.length / data.total) * 100) : 0;
  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null);

  return (
    <TabFrame>
      {/* §01 — Stats */}
      <section>
        <SectionHeader
          num="01"
          title="Analyse des liens"
          info={
            <InfoBox
              items={[
                { term: 'Liens internes', definition: "Liens vers d'autres pages de votre site. Aident Google à découvrir la structure et transmettent l'autorité." },
                { term: 'Liens externes', definition: "Liens vers d'autres sites. Montrent que vous citez des sources fiables." },
                { term: "Texte d'ancrage", definition: "Texte cliquable du lien. Évitez « cliquez ici ». Préférez des textes descriptifs." },
                { term: 'Dofollow / Nofollow', definition: 'Dofollow transmet l\'autorité SEO. Nofollow non — utilisez-le pour les liens sponsorisés ou non fiables.' },
                { term: 'Ancres vides', definition: 'Liens sans texte visible — souvent des images non optimisées.' },
                { term: 'Liens cassés', definition: 'Liens vers des pages 404 ou 5xx. Nuisent à l\'UX et gaspillent le budget de crawl.' },
              ]}
            />
          }
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <StatCell value={data.total} label="Total liens" />
          <StatCell value={data.internal.length} label="Internes" />
          <StatCell value={data.external.length} label="Externes" />
          <StatCell value={data.uniqueAnchors} label="Ancres uniques" />
        </div>
      </section>

      {/* §02 — Anchor quality (only when issues present) */}
      {(data.emptyAnchors > 0 || data.genericAnchors > 0) && (
        <section>
          <SectionHeader num="02" title="Qualité des textes d'ancrage" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {data.emptyAnchors > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: '1px solid var(--sa-red)', background: 'rgba(229, 36, 26, 0.05)' }}>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--sa-ink)', fontWeight: 600 }}>Ancres vides</div>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--sa-ink-4)', marginTop: 2 }}>
                    Liens sans texte ni image
                  </div>
                </div>
                <div className="display tnum" style={{ fontSize: 28, fontWeight: 800, color: 'var(--sa-red)' }}>{data.emptyAnchors}</div>
              </div>
            )}
            {data.genericAnchors > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: '1px solid var(--sa-warn)', background: 'rgba(184, 123, 0, 0.06)' }}>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--sa-ink)', fontWeight: 600 }}>Ancres génériques</div>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--sa-ink-4)', marginTop: 2 }}>
                    « Cliquez ici », « En savoir plus »…
                  </div>
                </div>
                <div className="display tnum" style={{ fontSize: 28, fontWeight: 800, color: 'var(--sa-warn)' }}>{data.genericAnchors}</div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* §03 — Issues */}
      <IssuesList issues={data.issues} />

      {/* §04 — Ratio + attributes */}
      <section>
        <SectionHeader num="04" title="Distribution & attributs" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{ border: '1px solid var(--sa-rule)', background: 'var(--sa-cream-2)', padding: 18 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sa-ink-4)', fontWeight: 700, marginBottom: 14 }}>
              Ratio interne / externe
            </div>
            {data.total > 0 ? (
              <>
                <div style={{ display: 'flex', height: 14, border: '1px solid var(--sa-ink)', marginBottom: 14, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--sa-ink)', width: `${internalPercent}%` }} />
                  <div style={{ background: 'var(--sa-cream-3)', width: `${externalPercent}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, background: 'var(--sa-ink)' }} />
                    <span style={{ color: 'var(--sa-ink-3)' }}>Internes</span>
                    <span className="tnum" style={{ color: 'var(--sa-ink)', fontWeight: 700 }}>{internalPercent}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, background: 'var(--sa-cream-3)', border: '1px solid var(--sa-rule)' }} />
                    <span style={{ color: 'var(--sa-ink-3)' }}>Externes</span>
                    <span className="tnum" style={{ color: 'var(--sa-ink)', fontWeight: 700 }}>{externalPercent}%</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="mono" style={{ fontSize: 12, color: 'var(--sa-ink-4)', fontStyle: 'italic', margin: 0 }}>Aucun lien détecté</p>
            )}
          </div>

          <div style={{ border: '1px solid var(--sa-rule)', background: 'var(--sa-cream-2)', padding: 18 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sa-ink-4)', fontWeight: 700, marginBottom: 14 }}>
              Attributs des liens
            </div>
            {[
              ['Dofollow',  data.dofollow, 'var(--sa-ok)'],
              ['Nofollow',  data.nofollow, 'var(--sa-red)'],
              ['Avec images', data.withImages, 'var(--sa-warn)'],
            ].map(([label, value, color]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, background: color as string }} />
                  <span style={{ color: 'var(--sa-ink-3)' }}>{label}</span>
                </div>
                <span className="tnum" style={{ color: color as string, fontWeight: 700 }}>{value as number}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* §05 — Internal broken */}
      {data.internalBrokenLinks && data.internalBrokenLinks.length > 0 && (
        <section>
          <SectionHeader num="05" title={`Liens internes cassés (${data.internalBrokenLinks.length})`} />
          <div style={{ border: '1px solid var(--sa-red)', background: 'var(--sa-cream-2)' }}>
            {data.internalBrokenLinks.map((link, i) => (
              <BrokenLinkRow key={i} href={link.href} status={link.status} error={link.error} onOpen={setLinkPreview} />
            ))}
          </div>
        </section>
      )}

      {/* §06 — External broken */}
      {data.brokenLinks.length > 0 && (
        <section>
          <SectionHeader num="06" title={`Liens externes cassés (${data.brokenLinks.length})`} />
          <div style={{ border: '1px solid var(--sa-red)', background: 'var(--sa-cream-2)' }}>
            {data.brokenLinks.map((link, i) => (
              <BrokenLinkRow key={i} href={link.href} status={link.status} error={link.error} onOpen={setLinkPreview} />
            ))}
          </div>
        </section>
      )}

      {/* Link tables — no §number, they're details */}
      <LinkTable links={data.internal} title="Liens internes" onOpen={setLinkPreview} />
      <LinkTable links={data.external} title="Liens externes" onOpen={setLinkPreview} />

      <CTABanner variant="inline" />

      {linkPreview && <LinkPreview data={linkPreview} onClose={() => setLinkPreview(null)} />}
    </TabFrame>
  );
}

/**
 * Link preview — portaled to <body>. Shows the full URL (wrapped, never
 * overflowing), anchor text(s), attributes / status, and an "open" action for
 * absolute URLs so you can act on the exact link.
 */
function LinkPreview({ data, onClose }: { data: LinkPreviewData; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!mounted) return null;

  const isAbsolute = /^https?:\/\//i.test(data.href);
  const attrs: string[] = [];
  if (data.isNofollow) attrs.push('nofollow');
  if (data.isSponsored) attrs.push('sponsored');
  if (data.isUgc) attrs.push('ugc');
  if (!data.isNofollow && !data.isSponsored && !data.isUgc && data.status === undefined) attrs.push('dofollow');

  return createPortal(
    <>
      <div aria-hidden="true" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.55)', zIndex: 1000 }} />
      <div
        role="dialog"
        aria-label="Aperçu du lien"
        style={{
          position: 'fixed', left: 16, right: 16, top: '50%', transform: 'translateY(-50%)',
          margin: '0 auto', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto',
          zIndex: 1001, background: 'var(--sa-cream)', border: '2px solid var(--sa-ink)',
        }}
      >
        <div className="ink-b mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--sa-ink)', color: 'var(--sa-cream)', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          <span>Aperçu du lien</span>
          <button onClick={onClose} aria-label="Fermer" style={{ background: 'transparent', border: 'none', color: 'var(--sa-cream)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--sa-ink-4)', marginBottom: 3 }}>URL</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--sa-ink-2)', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{data.href}</div>
          </div>

          {data.texts && data.texts.length > 0 && (
            <div>
              <div className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--sa-ink-4)', marginBottom: 3 }}>Texte(s) d&apos;ancrage</div>
              <div style={{ fontSize: 13, color: 'var(--sa-ink-2)', overflowWrap: 'anywhere' }}>{data.texts.join(' · ')}</div>
            </div>
          )}

          {(attrs.length > 0 || data.status !== undefined) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {data.status !== undefined && attrChip(data.status === 0 ? data.error || 'timeout' : `HTTP ${data.status}`, 'var(--sa-red)')}
              {attrs.map((a) => attrChip(a, a === 'dofollow' ? 'var(--sa-ok)' : a === 'nofollow' ? 'var(--sa-red)' : 'var(--sa-ink-4)'))}
            </div>
          )}

          {isAbsolute && (
            <a
              href={data.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mono"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 16px', background: 'var(--sa-red)', color: 'var(--sa-cream)', border: '2px solid var(--sa-ink)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}
            >
              Ouvrir le lien <span aria-hidden>↗</span>
            </a>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
