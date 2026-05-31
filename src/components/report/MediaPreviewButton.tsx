'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon } from 'lucide-react';

/**
 * A compact "Voir le média" trigger + portaled preview popup, used wherever an
 * issue or action-plan item references a specific resource by URL (e.g. an
 * image flagged for a missing alt). It loads the media as an image; if that
 * fails (CORS, hotlink protection, non-image URL) it falls back to showing the
 * URL with an "open" action — so the control is always useful, never dead.
 *
 * Portaled to <body> so it escapes the report's transformed/scrolled ancestors
 * (the .sa-rise translateY traps position:fixed otherwise).
 */
export function MediaPreviewButton({ url, label = 'Voir le média' }: { url: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mono"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '4px 9px',
          border: '1px solid var(--sa-ink)',
          background: 'var(--sa-cream)',
          color: 'var(--sa-ink)',
          cursor: 'pointer',
        }}
      >
        <ImageIcon style={{ width: 12, height: 12 }} strokeWidth={1.75} />
        {label}
      </button>
      {open && <MediaPreview url={url} onClose={() => setOpen(false)} />}
    </>
  );
}

function MediaPreview({ url, onClose }: { url: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!mounted) return null;

  const isAbsolute = /^https?:\/\//i.test(url);

  return createPortal(
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.55)', zIndex: 1000 }}
      />
      <div
        role="dialog"
        aria-label="Aperçu du média"
        style={{
          position: 'fixed', left: 16, right: 16, top: '50%', transform: 'translateY(-50%)',
          margin: '0 auto', maxWidth: 560, maxHeight: '86vh', overflowY: 'auto',
          zIndex: 1001, background: 'var(--sa-cream)', border: '2px solid var(--sa-ink)',
        }}
      >
        <div
          className="ink-b mono"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: 'var(--sa-ink)', color: 'var(--sa-cream)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
          }}
        >
          <span>Aperçu du média</span>
          <button onClick={onClose} aria-label="Fermer" style={{ background: 'transparent', border: 'none', color: 'var(--sa-cream)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="placeholder-hatch" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 160 }}>
          {!failed ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={url}
              alt=""
              onError={() => setFailed(true)}
              style={{ maxWidth: '100%', maxHeight: '56vh', objectFit: 'contain', border: '1px solid var(--sa-rule)', background: 'var(--sa-cream)' }}
            />
          ) : (
            <span className="mono" style={{ fontSize: 11, color: 'var(--sa-ink-4)', fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center' }}>
              Média non affichable — utilisez « Ouvrir » ci-dessous
            </span>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--sa-rule)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--sa-ink-4)', marginBottom: 3 }}>Source</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--sa-ink-2)', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{url}</div>
          </div>
          {isAbsolute && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mono"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 16px', background: 'var(--sa-red)', color: 'var(--sa-cream)', border: '2px solid var(--sa-ink)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}
            >
              Ouvrir <span aria-hidden>↗</span>
            </a>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
