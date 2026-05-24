import type { BotResult } from '@/lib/analyzer/bot-coverage';

const AI_BOTS_WARN = ['GPTBot', 'ClaudeBot', 'PerplexityBot'];

interface BotCoverageProps {
  bots: BotResult[];
  isFr: boolean;
}

export default function BotCoverage({ bots, isFr }: BotCoverageProps) {
  const blockedAiBots = bots.filter(
    (b) => b.status === 'blocked' && AI_BOTS_WARN.includes(b.name),
  );

  return (
    <section className="frame" style={{ background: 'var(--sa-cream)' }}>
      {/* Panel header — same pattern as PanelHeader in GeoTabContent */}
      <div
        className="ink-b mono"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '12px 24px',
          background: 'var(--sa-ink)',
          color: 'var(--sa-cream)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        <span>
          §10 — {isFr ? 'Robots IA (robots.txt)' : 'AI Robots (robots.txt)'}
        </span>
        <span style={{ opacity: 0.85, fontWeight: 700 }}>
          {bots.filter((b) => b.status !== 'blocked').length}/{bots.length}{' '}
          {isFr ? 'autorisés' : 'allowed'}
        </span>
      </div>

      {/* Warning banner if any important AI bot is blocked */}
      {blockedAiBots.length > 0 && (
        <div
          className="mono"
          style={{
            padding: '12px 24px',
            background: 'var(--sa-red, #cc1f1a)',
            color: 'var(--sa-cream)',
            fontSize: 11,
            letterSpacing: '0.06em',
            fontWeight: 700,
            borderTop: '2px solid var(--sa-ink)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {blockedAiBots.map((b) => (
            <span key={b.name}>
              ⚠️{' '}
              {isFr
                ? `Ton site bloque ${b.name} — il ne pourra pas te citer.`
                : `Your site blocks ${b.name} — it won't be able to cite you.`}
            </span>
          ))}
        </div>
      )}

      {/* Bot list */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {bots.map((bot, i) => {
          const isAllowed = bot.status === 'allowed';
          const isBlocked = bot.status === 'blocked';
          const isUnmentioned = bot.status === 'unmentioned';

          const pillColor = isAllowed
            ? 'var(--sa-ok, var(--sa-green, #2d8e4f))'
            : isBlocked
            ? 'var(--sa-red, #cc1f1a)'
            : 'var(--sa-ink-4)';

          const pillIcon = isAllowed ? '●' : isBlocked ? '○' : '—';

          const pillLabel = isAllowed
            ? isFr
              ? 'Autorisé'
              : 'Allowed'
            : isBlocked
            ? isFr
              ? 'Bloqué'
              : 'Blocked'
            : isFr
            ? 'Non mentionné'
            : 'Not mentioned';

          return (
            <li
              key={bot.name}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                gap: 16,
                padding: '14px 24px',
                borderTop:
                  i === 0 ? '2px solid var(--sa-ink)' : '1px solid var(--sa-rule)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sa-ink)' }}>
                  {bot.name}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--sa-ink-4)',
                  }}
                >
                  {bot.crawls}
                </span>
              </div>

              {/* Status pill */}
              <span
                aria-label={pillLabel}
                title={pillLabel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  border: `2px solid ${isUnmentioned ? 'var(--sa-rule)' : pillColor}`,
                  color: isUnmentioned ? 'var(--sa-ink-4)' : pillColor,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
                className="mono"
              >
                <span aria-hidden="true">{pillIcon}</span>
                {pillLabel}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Explanatory caption */}
      <div
        className="mono"
        style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--sa-rule)',
          fontSize: 10,
          letterSpacing: '0.08em',
          color: 'var(--sa-ink-4)',
          textTransform: 'uppercase',
        }}
      >
        {isFr
          ? '« Non mentionné » = aucune règle dans robots.txt — accès autorisé par défaut.'
          : '"Not mentioned" = no rule in robots.txt — access allowed by default.'}
      </div>
    </section>
  );
}
