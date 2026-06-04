'use client';

import React from 'react';
import Link from 'next/link';
import Shell from '@/components/design-system/Shell';
import { Pixel } from '@/components/design-system/primitives';
import { useTheme } from '@/components/design-system/ThemeProvider';

type Column = {
  n: string;
  k: string;
  body: React.ReactNode;
};

type Stat = {
  n: string;
  l: string;
};

export default function AProposPage() {
  const { lang } = useTheme();
  const isFr = lang === 'fr';

  const columns: Column[] = [
    {
      n: '01',
      k: isFr ? 'Qui' : 'Who',
      body: isFr ? (
        <>
          Pixelab, fondé en <b>2020</b> à Genève. Une poignée d&apos;obsédés du web qui construisent
          des sites, des outils, et des marques pour des entreprises suisses.
        </>
      ) : (
        <>
          Pixelab, founded in <b>2020</b> in Geneva. A handful of web-obsessed people who build
          sites, tools, and brands for Swiss companies.
        </>
      ),
    },
    {
      n: '02',
      k: isFr ? 'Où' : 'Where',
      body: isFr ? (
        <>
          Genève. Serveurs chez <b>Infomaniak</b>, à 12 minutes à pied du bureau. Si ça tombe, on
          sait qui appeler.
        </>
      ) : (
        <>
          Geneva. Servers at <b>Infomaniak</b>, 12 minutes on foot from the office. If it breaks,
          we know who to call.
        </>
      ),
    },
    {
      n: '03',
      k: isFr ? 'Pourquoi' : 'Why',
      body: isFr ? (
        <>
          Les outils d&apos;audit SEO existants sont chers, américains, et ignorent que les gens
          demandent maintenant à <b>ChatGPT</b>, pas à Google.
        </>
      ) : (
        <>
          Existing SEO tools are expensive, American, and ignore that people now ask{' '}
          <b>ChatGPT</b>, not Google.
        </>
      ),
    },
  ];

  const stats: Stat[] = [
    { n: '2020', l: isFr ? 'Création · Genève' : 'Founded · Geneva' },
    { n: '120+', l: isFr ? 'Projets livrés' : 'Projects shipped' },
    { n: '100 %', l: isFr ? 'Hébergement suisse' : 'Swiss hosting' },
    { n: 'CHF 0', l: isFr ? 'Prix de Swissalytics' : 'Price of Swissalytics' },
  ];

  return (
    <Shell>
      <div className="ap-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 24px' }}>
        {/* Section kicker */}
        <div
          className="mono caption-red"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--sa-red)',
            marginBottom: 20,
            marginTop: 12,
          }}
        >
          § {isFr ? 'À propos' : 'About'}
        </div>

        <h1
          className="display"
          style={{
            fontSize: 'clamp(44px, 6vw, 96px)',
            letterSpacing: '0.015em',
            lineHeight: 1.2,
            margin: 0,
            color: 'var(--sa-ink)',
            overflowWrap: 'break-word',
          }}
        >
          {isFr ? 'Fait par ' : 'Made by '}
          <br />
          <svg
            viewBox="245 305 535 160"
            role="img"
            aria-label="Pixelab"
            style={{
              height: '1.05em',
              width: 'auto',
              display: 'inline-block',
              verticalAlign: '-0.12em',
              fill: 'currentColor',
            }}
          >
            <path d="m711.883 311.572-21.47 7.157v69.566c0 5.44 1 10.877 3.148 15.887 2.003 4.866 5.008 9.16 8.73 12.882 3.722 3.865 8.159 6.729 13.025 8.733 5.01 2.147 10.307 3.29 15.89 3.29 5.438 0 10.735-1.143 15.888-3.29 4.723-2.004 9.161-5.011 12.883-8.733 3.721-3.721 6.726-8.016 8.73-12.882 2.147-5.153 3.293-10.448 3.293-15.887 0-5.582-1.146-10.879-3.293-15.889-2.004-4.866-5.009-9.304-8.73-13.025s-8.017-6.729-12.883-8.733c-5.153-2.147-10.45-3.148-15.889-3.148-5.582 0-10.879 1.001-15.889 3.148-1.288.573-2.431 1.003-3.433 1.72zm-135.807 1.145-21.613 7.156v108.213h21.613zm-205.295 32.78-21.613 7.155v75.434h21.613zm280.114 2.003.142 4.58c-5.725-2.863-12.024-4.437-18.465-4.437-5.439 0-10.877 1-15.886 3.148-4.867 2.147-9.163 5.01-13.028 8.732-3.721 3.722-6.583 8.16-8.73 13.026-2.004 5.01-3.149 10.45-3.149 15.889s1.145 10.878 3.149 15.888c2.147 4.867 5.009 9.16 8.73 13.026 3.865 3.721 8.16 6.583 13.028 8.73 5.01 2.004 10.447 3.15 15.886 3.15 6.441 0 12.74-1.574 18.465-4.437l-.142 3.29h21.47V347.5zm-358.1.143c-5.44 0-10.879 1-15.889 3.148a44.3 44.3 0 0 0-13.025 8.732c-3.722 3.722-6.585 8.16-8.733 13.026-2.004 5.01-3.148 10.306-3.148 15.889v60.833l21.47 7.157v-32.063c1.146.573 2.291 1.145 3.436 1.574 5.01 2.148 10.45 3.293 15.889 3.293 5.44 0 10.879-1.145 15.889-3.293 4.866-2.003 9.16-4.865 13.025-8.73 3.722-3.722 6.583-8.016 8.73-12.883 2.148-5.01 3.149-10.45 3.149-15.889 0-5.582-1.001-10.878-3.149-15.888-2.147-4.867-5.008-9.16-8.73-13.026a44.3 44.3 0 0 0-13.025-8.732c-5.01-2.147-10.307-3.148-15.89-3.148m207.664.287c-10.879 0-20.9 4.294-28.629 11.88-7.586 7.587-11.736 17.75-11.736 28.485s4.15 20.898 11.736 28.484c7.73 7.587 17.75 11.88 28.629 11.88 5.582 0 11.02-1.144 16.174-3.434 5.01-2.147 9.446-5.298 13.168-9.163l-15.172-14.312c-3.722 4.008-8.73 6.154-14.17 6.154-7.014 0-13.17-3.72-16.605-9.16h56.826v-10.45c0-10.734-4.15-20.897-11.737-28.483s-17.749-11.881-28.484-11.881m-120.99.43 29.058 39.505-28.914 40.22h25.334l16.606-22.042 16.46 22.043h25.48l-29.06-40.078 28.772-39.649h-25.908l-15.889 22.186-15.601-22.186zm120.99 20.324c6.87 0 13.025 3.722 16.603 9.304h-33.208c3.435-5.582 9.591-9.304 16.605-9.304m230.746.287c10.592 0 19.324 8.589 19.324 19.324 0 10.592-8.732 19.322-19.324 19.322-10.735 0-19.322-8.73-19.322-19.322a19.243 19.243 0 0 1 19.322-19.324m-438.41.142c10.592 0 19.322 8.732 19.322 19.324s-8.73 19.325-19.322 19.325-19.324-8.732-19.324-19.324 8.732-19.325 19.324-19.325m339.777 0c3.722 0 7.444 1.002 10.45 3.149 3.149 1.86 5.582 4.725 7.013 8.017 1.288 2.577 1.861 5.296 1.861 8.158 0 3.436-.858 6.727-2.576 9.733-1.717 2.863-4.007 5.296-7.013 6.871-2.863 1.718-6.3 2.72-9.735 2.72-10.592 0-19.322-8.731-19.322-19.323s8.73-19.325 19.322-19.325" />
          </svg>
          <Pixel style={{ verticalAlign: '0.14em' }} />
        </h1>

        <p
          style={{
            fontSize: 'clamp(22px, 2.2vw, 30px)',
            color: 'var(--sa-ink-2)',
            marginTop: 32,
            maxWidth: 820,
            lineHeight: 1.4,
            fontWeight: 500,
            textWrap: 'pretty',
          }}
        >
          {isFr ? (
            <>
              Swissalytics est un outil <b>gratuit</b> fait par <b>Pixelab</b>, agence web
              genevoise depuis <b>2020</b>. Parce qu&apos;on en avait marre de voir nos clients
              passer à côté de <b>ChatGPT</b>.
            </>
          ) : (
            <>
              Swissalytics is a <b>free</b> tool by <b>Pixelab</b>, a Geneva web agency since{' '}
              <b>2020</b>. Because we got tired of watching our clients get ignored by{' '}
              <b>ChatGPT</b>.
            </>
          )}
        </p>

        {/* Three-column editorial slab */}
        <div
          className="ap-cols"
          style={{
            marginTop: 80,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            borderTop: '2px solid var(--sa-ink)',
            borderBottom: '2px solid var(--sa-ink)',
          }}
        >
          {columns.map((c, i) => (
            <div
              key={c.n}
              className="ap-col"
              style={{
                padding: '36px 32px',
                borderLeft: i === 0 ? 0 : '1px solid var(--sa-rule)',
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: 'var(--sa-red)',
                  textTransform: 'uppercase',
                  marginBottom: 14,
                }}
              >
                §{c.n} · {c.k}
              </div>
              <div
                style={{
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: 'var(--sa-ink-2)',
                  textWrap: 'pretty',
                }}
              >
                {c.body}
              </div>
            </div>
          ))}
        </div>

        {/* Editorial manifesto */}
        <div
          className="ap-split"
          style={{
            marginTop: 80,
            display: 'grid',
            gridTemplateColumns: '1fr 2fr',
            gap: 48,
          }}
        >
          <div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--sa-red)',
                marginBottom: 12,
              }}
            >
              § {isFr ? 'Le contexte' : 'Context'}
            </div>
            <h2
              className="display"
              style={{
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              {isFr ? 'Le web change' : 'The web is changing'}
              <Pixel />
            </h2>
          </div>
          <div
            style={{
              fontSize: 17,
              lineHeight: 1.7,
              color: 'var(--sa-ink-2)',
              textWrap: 'pretty',
            }}
          >
            <p style={{ margin: '0 0 18px 0' }}>
              {isFr ? (
                <>
                  Chez Pixelab, on regarde nos clients depuis cinq ans. Quelque chose a changé
                  vers fin 2023 : le trafic Google devient plat, les conversions stagnent, mais
                  les mentions « j&apos;ai entendu parler de vous par ChatGPT » explosent.
                </>
              ) : (
                <>
                  At Pixelab, we&apos;ve been watching our clients for five years. Something
                  changed in late 2023: Google traffic flattened, conversions stagnated, but
                  &ldquo;I heard about you from ChatGPT&rdquo; mentions exploded.
                </>
              )}
            </p>
            <p style={{ margin: '0 0 18px 0' }}>
              {isFr ? (
                <>
                  Les règles du jeu ne sont plus les mêmes. Google indexait des pages ; ChatGPT
                  cite des phrases. Ce qui rend un site visible dans une IA n&apos;est pas ce qui
                  le rend visible dans un moteur de recherche.
                </>
              ) : (
                <>
                  The rules of the game have changed. Google indexed pages; ChatGPT cites
                  sentences. What makes a site visible to an AI is not what makes it visible to a
                  search engine.
                </>
              )}
            </p>
            <p style={{ margin: 0 }}>
              {isFr ? (
                <>
                  Swissalytics, c&apos;est notre tentative d&apos;en tirer un outil. Gratuit,
                  suisse, en trente secondes. Parce que la plupart de nos clients n&apos;ont pas
                  envie de payer 200 $ par mois à un outil américain pour apprendre qu&apos;il
                  leur manque un schéma{' '}
                  <span
                    className="mono"
                    style={{ fontSize: 15, fontStyle: 'normal' }}
                  >
                    Organization
                  </span>
                  .
                </>
              ) : (
                <>
                  Swissalytics is our attempt at turning that into a tool. Free, Swiss, in thirty
                  seconds. Because most of our clients don&apos;t want to pay $200/month to an
                  American tool to learn they&apos;re missing an{' '}
                  <span
                    className="mono"
                    style={{ fontSize: 15, fontStyle: 'normal' }}
                  >
                    Organization
                  </span>{' '}
                  schema.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div
          className="ap-stats"
          style={{
            marginTop: 96,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            borderTop: '2px solid var(--sa-ink)',
            borderBottom: '2px solid var(--sa-ink)',
          }}
        >
          {stats.map((s, i) => (
            <div
              key={s.n}
              className="ap-stat"
              data-i={i}
              style={{
                padding: '40px 28px',
                borderLeft: i === 0 ? 0 : '1px solid var(--sa-rule)',
              }}
            >
              <div
                className="display tnum"
                style={{
                  fontSize: 'clamp(42px, 5vw, 72px)',
                  fontWeight: 800,
                  color: 'var(--sa-ink)',
                  letterSpacing: '-0.04em',
                  lineHeight: 0.92,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.n}
              </div>
              <div
                className="mono"
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--sa-ink-4)',
                }}
              >
                {s.l}
              </div>
            </div>
          ))}
        </div>

        {/* Privacy block */}
        <div
          className="ap-split"
          style={{
            marginTop: 80,
            display: 'grid',
            gridTemplateColumns: '1fr 2fr',
            gap: 48,
          }}
        >
          <div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--sa-red)',
                marginBottom: 12,
              }}
            >
              § {isFr ? 'Vie privée' : 'Privacy'}
            </div>
            <h2
              className="display"
              style={{
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              {isFr ? 'Anonyme par défaut' : 'Anonymous by default'}
              <Pixel />
            </h2>
          </div>
          <div
            style={{
              fontSize: 17,
              lineHeight: 1.7,
              color: 'var(--sa-ink-2)',
              textWrap: 'pretty',
            }}
          >
            <p style={{ margin: '0 0 14px 0' }}>
              {isFr
                ? "Pas de compte requis. Pas de cookie de tracking. Aucun email ni nom collecté."
                : 'No account required. No tracking cookies. No email or name collected.'}
            </p>
            <p style={{ margin: '0 0 14px 0' }}>
              {isFr
                ? "À chaque analyse, nous enregistrons l'URL et quelques métadonnées techniques (pays, navigateur, IP pseudonymisée par HMAC-SHA-256). Conservation 180 jours, base de données à Zurich (Supabase)."
                : 'On each analysis, we store the URL and some technical metadata (country, browser, HMAC-SHA-256 pseudonymized IP). 180-day retention, database in Zurich (Supabase).'}
            </p>
            <p style={{ margin: 0 }}>
              {isFr ? 'Détail complet : ' : 'Full details: '}
              <Link
                href="/mentions-legales"
                style={{ color: 'var(--sa-ink)', textDecoration: 'underline' }}
              >
                {isFr ? 'mentions légales' : 'legal notice'}
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Dual CTA block */}
        <div
          className="ap-cta"
          style={{
            marginTop: 80,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 0,
            border: '2px solid var(--sa-ink)',
          }}
        >
          <div className="ap-cta-a" style={{ padding: '40px 32px', background: 'var(--sa-cream)' }}>
            <div
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--sa-ink-4)',
                marginBottom: 14,
              }}
            >
              {isFr ? "Utiliser l'outil" : 'Use the tool'}
            </div>
            <h3
              className="display"
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: '0 0 10px 0',
                lineHeight: 1.05,
              }}
            >
              {isFr ? 'Auditer un site, gratuitement' : 'Audit a site, free'}
            </h3>
            <p
              style={{
                fontSize: 15,
                color: 'var(--sa-ink-3)',
                margin: '0 0 22px 0',
                lineHeight: 1.5,
              }}
            >
              {isFr ? "Entrez l'URL, c'est tout." : "Enter the URL, that's it."}
            </p>
            <Link
              href="/"
              style={{
                display: 'inline-block',
                padding: '12px 22px',
                background: 'var(--sa-ink)',
                color: 'var(--sa-cream)',
                border: 0,
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              {isFr ? 'Lancer →' : 'Launch →'}
            </Link>
          </div>
          <div
            className="ap-cta-b"
            style={{
              padding: '40px 32px',
              background: 'var(--sa-ink)',
              color: 'var(--sa-cream)',
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--sa-red)',
                marginBottom: 14,
              }}
            >
              {isFr ? 'Travailler avec nous' : 'Work with us'}
            </div>
            <h3
              className="display"
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: '0 0 10px 0',
                lineHeight: 1.05,
                color: 'var(--sa-cream)',
              }}
            >
              {isFr ? 'Un projet web ? Pixelab.' : 'A web project? Pixelab.'}
            </h3>
            <p
              style={{
                fontSize: 15,
                color: 'var(--sa-cream)',
                opacity: 0.7,
                margin: '0 0 22px 0',
                lineHeight: 1.5,
              }}
            >
              {isFr ? 'Sites, outils, refontes, IA. Genève.' : 'Sites, tools, redesigns, AI. Geneva.'}
            </p>
            <a
              href="https://pixelab.ch"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-block',
                padding: '12px 22px',
                background: 'var(--sa-red)',
                color: 'var(--sa-cream)',
                border: 0,
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              pixelab.ch →
            </a>
          </div>
        </div>

        <style>{`
          @media (max-width: 1024px){
            .ap-stats{ grid-template-columns:1fr 1fr !important; }
            /* 2-col: left column has no left border; rows after the first get a top rule. */
            .ap-stat:nth-child(2n+1){ border-left:0 !important; }
            .ap-stat:nth-child(n+3){ border-top:1px solid var(--sa-rule) !important; }
          }
          @media (max-width: 640px){
            .ap-wrap{ padding:48px 20px !important; }
            .ap-cols{ grid-template-columns:1fr !important; }
            .ap-col{ padding:28px 0 !important; border-left:0 !important; }
            .ap-col + .ap-col{ border-top:1px solid var(--sa-rule) !important; }
            .ap-split{ grid-template-columns:1fr !important; gap:24px !important; margin-top:56px !important; }
            .ap-stats{ grid-template-columns:1fr 1fr !important; }
            .ap-stat{ padding:28px 20px !important; }
            .ap-cta{ grid-template-columns:1fr !important; }
            .ap-cta-a, .ap-cta-b{ padding:32px 20px !important; }
            .ap-cta-b{ border-top:2px solid var(--sa-ink) !important; }
          }
        `}</style>
      </div>
    </Shell>
  );
}
