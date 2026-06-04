import { buildHowToSchema, serializeJsonLd } from '@/lib/blog/schema';

export function HowTo({ name, steps }: { name: string; steps: { name: string; text: string }[] }) {
  return (
    <section style={{ border: '2px solid var(--sa-ink)', padding: 20, margin: '28px 0' }}>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        {steps.map((s, i) => (
          <li key={i} style={{ margin: '8px 0' }}>
            <strong>{s.name}.</strong> {s.text}
          </li>
        ))}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildHowToSchema(name, steps)) }}
      />
    </section>
  );
}
