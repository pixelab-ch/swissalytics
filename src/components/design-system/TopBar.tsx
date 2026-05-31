'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from './primitives';
import { useTheme, type Lang } from './ThemeProvider';
import { COPY } from '@/lib/i18n/copy';

interface NavItem {
  key: string;
  href: string;
  label: (copy: (typeof COPY)['fr']) => string;
}

const NAV: NavItem[] = [
  { key: 'methode',  href: '/methode',   label: (c) => c.nav[0] },
  { key: 'exemples', href: '/exemples',  label: (c) => c.nav[1] },
  { key: 'journal',  href: '/journal',   label: (c) => c.nav[2] },
  { key: 'apropos',  href: '/a-propos',  label: (c) => c.nav[3] },
];

export default function TopBar() {
  const { lang, setLang, dark, setDark } = useTheme();
  const pathname = usePathname();
  const copy = COPY[lang];
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // While open, close the mobile menu on Escape or a click/tap outside the bar.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  return (
    <div
      ref={barRef}
      className="rule-b sa-topbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        background: 'var(--sa-bg)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <Link href="/" style={{ cursor: 'pointer' }}>
        <Logo />
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          className="mono"
          style={{
            display: 'none',
            gap: 28,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
          data-md-flex
        >
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== '/' && pathname?.startsWith(n.href));
            return (
              <Link
                key={n.key}
                href={n.href}
                style={{
                  borderBottom: active ? '2px solid var(--sa-ink)' : '2px solid transparent',
                  paddingBottom: 2,
                  color: 'var(--sa-ink)',
                }}
              >
                {n.label(copy)}
              </Link>
            );
          })}
          <span style={{ opacity: 0.35 }}>·</span>
          <Link
            href="/"
            className="caption-red"
            style={{ color: 'var(--sa-red)' }}
          >
            {copy.cta}
          </Link>
        </div>

        {/* Dark mode toggle — hidden on mobile (<768px) where night mode is off. */}
        <button
          onClick={() => setDark(!dark)}
          aria-label={dark ? 'Light mode' : 'Dark mode'}
          title={dark ? 'Light' : 'Dark'}
          className="mono sa-dark-toggle"
          style={{
            border: '2px solid var(--sa-ink)',
            background: 'transparent',
            color: 'var(--sa-ink)',
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {dark ? '☀' : '☾'}
        </button>

        {/* FR / EN toggle */}
        <div
          className="frame mono"
          style={{
            display: 'inline-flex',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
          }}
        >
          {(['fr', 'en'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                padding: '6px 10px',
                border: 'none',
                background: lang === l ? 'var(--sa-ink)' : 'transparent',
                color: lang === l ? 'var(--sa-cream)' : 'var(--sa-ink)',
                borderLeft: l === 'en' ? '2px solid var(--sa-ink)' : 'none',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                fontWeight: 'inherit',
                letterSpacing: 'inherit',
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Mobile hamburger — hidden on md+ via scoped style */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          className="mono sa-burger"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            border: '2px solid var(--sa-ink)',
            background: 'transparent',
            color: 'var(--sa-ink)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {menuOpen ? <X size={18} strokeWidth={2.5} /> : <Menu size={18} strokeWidth={2.5} />}
        </button>
      </div>

      {/* Mobile nav panel — full-width drop below the bar */}
      {menuOpen && (
        <nav
          className="sa-mobile-nav"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--sa-bg)',
            borderBottom: '2px solid var(--sa-ink)',
            borderTop: '1px solid var(--sa-rule)',
            display: 'flex',
            flexDirection: 'column',
            padding: '8px 16px 16px',
            zIndex: 39,
          }}
        >
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== '/' && pathname?.startsWith(n.href));
            return (
              <Link
                key={n.key}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className="mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: 48,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--sa-ink)',
                  borderBottom: '1px solid var(--sa-rule)',
                  borderLeft: active ? '3px solid var(--sa-ink)' : '3px solid transparent',
                  paddingLeft: active ? 12 : 12,
                }}
              >
                {n.label(copy)}
              </Link>
            );
          })}
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="mono caption-red"
            style={{
              display: 'flex',
              alignItems: 'center',
              minHeight: 48,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--sa-red)',
              paddingLeft: 12,
            }}
          >
            {copy.cta}
          </Link>
        </nav>
      )}

      {/* Inline hack to show nav on md+ without a plugin; hide burger + mobile nav on md+ */}
      <style>{`
        @media (min-width: 768px) {
          [data-md-flex] { display: flex !important; }
          .sa-burger { display: none !important; }
          .sa-mobile-nav { display: none !important; }
        }
        @media (max-width: 767px) {
          /* No night mode on phones — hide the day/night toggle. */
          .sa-dark-toggle { display: none !important; }
        }
        @media (max-width: 640px) {
          .sa-topbar { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
