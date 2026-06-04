import { buildFaqPageSchema, serializeJsonLd } from '@/lib/blog/schema';

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section style={{ borderTop: '2px solid var(--sa-ink)', marginTop: 40, paddingTop: 24 }}>
      {items.map((it, i) => (
        <details key={i} style={{ borderBottom: '1px solid var(--sa-rule)', padding: '14px 0' }}>
          <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{it.q}</summary>
          <p style={{ marginTop: 8 }}>{it.a}</p>
        </details>
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildFaqPageSchema(items)) }}
      />
    </section>
  );
}
