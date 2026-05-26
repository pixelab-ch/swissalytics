'use client';

import type { CSSProperties } from 'react';

interface NavEntryProps {
  num: string;
  label: string;
  active: boolean;
  onClick: () => void;
  /**
   * `rail` — vertical left-rail entry: red left-border + cream-2 bg on active
   *   (used for the 4 main report tabs in ReportView).
   * `bar`  — horizontal sub-section bar entry: red bottom-border underline on
   *   active (used for the 6 Détails sub-sections in DetailsContent).
   */
  variant: 'rail' | 'bar';
}

/**
 * Shared nav primitive for the report's two tab strips. Both render the same
 * structure (§NN mono prefix + uppercase mono label) but differ in the active
 * "selected" treatment per `variant`. Both variants expose `role="tab"` +
 * `aria-selected` so screen readers announce selection consistently.
 */
export function NavEntry({ num, label, active, onClick, variant }: NavEntryProps) {
  const railStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    textAlign: 'left',
    padding: '14px 16px',
    borderLeft: `3px solid ${active ? 'var(--sa-red)' : 'transparent'}`,
    borderTop: 'none',
    borderRight: 'none',
    borderBottom: 'none',
    background: active ? 'var(--sa-cream-2)' : 'transparent',
    color: 'var(--sa-ink)',
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  const barStyle: CSSProperties = {
    appearance: 'none',
    background: 'none',
    border: 'none',
    borderBottom: `2px solid ${active ? 'var(--sa-red)' : 'transparent'}`,
    marginBottom: -1,
    padding: '8px 0',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 700,
    color: active ? 'var(--sa-ink)' : 'var(--sa-ink-4)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  if (variant === 'rail') {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={onClick}
        className="mono"
        style={railStyle}
      >
        <span
          className="tnum"
          style={{ color: active ? 'var(--sa-red)' : 'var(--sa-ink-4)' }}
        >
          §{num}
        </span>
        <span style={{ color: 'var(--sa-ink)' }}>{label}</span>
      </button>
    );
  }

  // variant === 'bar'
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="mono"
      style={barStyle}
    >
      <span className="tnum">§{num}</span> {label}
    </button>
  );
}
