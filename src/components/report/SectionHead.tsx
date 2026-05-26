'use client';

/* ===================================================================== */
/* Shared section header: §NN red marker + title + optional "more" link. */
/* Used by the cockpit sub-blocks (§01–§04).                              */
/* ===================================================================== */

export function SectionHead({
  num,
  title,
  more,
}: {
  num: string;
  title: string;
  more?: { label: string; onClick: () => void };
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 12,
      }}
    >
      <span
        className="mono"
        style={{ fontSize: 12, fontWeight: 700, color: 'var(--sa-red)' }}
      >
        §{num}
      </span>
      <h2
        style={{
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          margin: 0,
          color: 'var(--sa-ink)',
        }}
      >
        {title}
      </h2>
      {more && (
        <button
          type="button"
          onClick={more.onClick}
          className="mono"
          style={{
            marginLeft: 'auto',
            appearance: 'none',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--sa-ink)',
            padding: 0,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--sa-ink)',
            cursor: 'pointer',
          }}
        >
          {more.label}
        </button>
      )}
    </div>
  );
}
