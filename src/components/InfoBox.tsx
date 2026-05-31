'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';

interface InfoItem {
  term: string;
  definition: string;
}

interface InfoBoxProps {
  items: InfoItem[];
}

export default function InfoBox({ items }: InfoBoxProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Below 640px the popover becomes a bottom sheet portaled to <body> so it
  // escapes transformed ancestors (e.g. the .sa-rise MetricStrip, whose
  // lingering translateY traps position:fixed) and is always readable.
  const [isMobile, setIsMobile] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Shared panel content (header + glossary list).
  const panel = (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--sa-ink)',
          color: 'var(--sa-cream)',
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}
        >
          § Lexique
        </span>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--sa-cream)',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
          }}
          aria-label="Fermer"
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item) => (
          <div key={item.term}>
            <dt
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--sa-ink)',
                marginBottom: 4,
              }}
            >
              {item.term}
            </dt>
            <dd
              style={{
                fontSize: 13,
                color: 'var(--sa-ink-3)',
                margin: 0,
                lineHeight: 1.55,
                overflowWrap: 'break-word',
              }}
            >
              {item.definition}
            </dd>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        aria-label="Aide"
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          background: 'var(--sa-cream-2)',
          border: '1px solid var(--sa-rule)',
          color: 'var(--sa-ink-3)',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <HelpCircle style={{ width: 12, height: 12 }} />
      </button>

      {/* Desktop: anchored popover below the icon. */}
      {open && !isMobile && (
        <div
          ref={popoverRef}
          className="infobox-popover"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            zIndex: 50,
            width: 320,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 384,
            overflowY: 'auto',
            background: 'var(--sa-cream)',
            border: '2px solid var(--sa-ink)',
          }}
        >
          {panel}
        </div>
      )}

      {/* Mobile: full-width bottom sheet + scrim, portaled to body so no
          transformed ancestor can trap or clip it. */}
      {open && isMobile && mounted &&
        createPortal(
          <>
            <div
              aria-hidden="true"
              onClick={() => setOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(10, 10, 10, 0.45)', zIndex: 1000 }}
            />
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Lexique"
              className="infobox-popover"
              style={{
                position: 'fixed',
                left: 16,
                right: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 1001,
                maxHeight: '80vh',
                overflowY: 'auto',
                background: 'var(--sa-cream)',
                border: '2px solid var(--sa-ink)',
              }}
            >
              {panel}
            </div>
          </>,
          document.body,
        )}
    </span>
  );
}
