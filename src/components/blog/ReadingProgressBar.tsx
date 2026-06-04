'use client';
import { useEffect, useState } from 'react';

export function ReadingProgressBar() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? (h.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, height: 3, width: `${p}%`, background: 'var(--sa-red)', zIndex: 50 }}
    />
  );
}
