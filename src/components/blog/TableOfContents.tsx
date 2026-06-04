'use client';
import { useEffect, useState } from 'react';

type Item = { id: string; text: string; level: number };

export function TableOfContents() {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState('');

  useEffect(() => {
    const hs = Array.from(document.querySelectorAll('.blog-prose h2, .blog-prose h3')) as HTMLElement[];
    setItems(
      hs
        .filter((h) => h.id)
        .map((h) => ({ id: h.id, text: h.textContent || '', level: h.tagName === 'H2' ? 2 : 3 }))
    );
    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive((e.target as HTMLElement).id)),
      { rootMargin: '0px 0px -75% 0px' }
    );
    hs.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, []);

  if (items.length < 3) return null;
  return (
    <nav className="mono" style={{ position: 'sticky', top: 96, fontSize: 12, lineHeight: 1.9 }}>
      {items.map((it) => (
        <a
          key={it.id}
          href={`#${it.id}`}
          style={{
            display: 'block',
            paddingLeft: it.level === 3 ? 12 : 0,
            color: active === it.id ? 'var(--sa-red)' : 'var(--sa-ink-4)',
            textDecoration: 'none',
          }}
        >
          {it.text}
        </a>
      ))}
    </nav>
  );
}
